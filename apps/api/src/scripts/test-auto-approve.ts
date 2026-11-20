// test-auto-approve.ts — auto-approve at submit time (21 Nov 2026, both
// chains): a submission that passes every automated check must come back
// 201 approved WITH a voucher whose signature recovers the authorized
// signer; with AUTO_APPROVE=false it must come back 201 pending with no
// voucher. The manual admin-review path is unchanged (see admin.ts).
//
// Run from apps/api (two runs — config reads env at import time, so the
// off-case needs its own process):
//   DATABASE_PATH=$(mktemp -d)/test.db AUTH_SECRET=test-secret \
//   ADMIN_SESSION_SECRET=test-secret NFT_CHAIN_ID=97 \
//   NFT_CONTRACT_ADDRESS=0xca998896041A761E315125cf42E8dBE8D3cE087C \
//   AGENT_ID_REGISTRY_ADDRESS=0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7 \
//   BSC_RPC_URL=https://bsc-testnet.publicnode.com \
//   ADMIN_SIGNER_PRIVATE_KEY=$(cat ~/.config/agentritual/testnet-signer.key) \
//   npx tsx src/scripts/test-auto-approve.ts
//   # ...then the same with AUTO_APPROVE=false for the pending case.
//
// The submitting wallet is the testnet DEPLOYER (holds 1 Mock Agent ID);
// its key is read from ~/.config/agentritual/testnet-deployer.key and
// never printed. Exits 0 when every case passes, 1 otherwise.

import fs from "node:fs";
import { ethers } from "ethers";
import { buildServer } from "../server";
import { VOUCHER_TYPES } from "../voucher";

const TEST_CONTRACT = "0xca998896041A761E315125cf42E8dBE8D3cE087C";
const MOCK_REGISTRY = "0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7";
const TESTNET_SIGNER = "0x1EAE2306559725B54102D96a9333667a4292599b";
const SQUARE_URL = "https://www.binance.com/square/post/380847377801319";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`ERROR: env ${name} is not set — see the header comment.`);
    process.exit(2);
  }
  return v;
}

const results: Array<{ name: string; pass: boolean; detail?: string }> = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

async function main() {
  mustEnv("AUTH_SECRET");
  mustEnv("DATABASE_PATH");
  mustEnv("ADMIN_SIGNER_PRIVATE_KEY");
  if (process.env.NFT_CHAIN_ID !== "97") {
    console.error("ERROR: run this test with NFT_CHAIN_ID=97.");
    process.exit(2);
  }
  if (
    (process.env.NFT_CONTRACT_ADDRESS ?? "").toLowerCase() !==
    TEST_CONTRACT.toLowerCase()
  ) {
    console.error(
      `ERROR: run this test with NFT_CONTRACT_ADDRESS=${TEST_CONTRACT}.`,
    );
    process.exit(2);
  }
  if (
    (process.env.AGENT_ID_REGISTRY_ADDRESS ?? "").toLowerCase() !==
    MOCK_REGISTRY.toLowerCase()
  ) {
    console.error(
      `ERROR: run this test with AGENT_ID_REGISTRY_ADDRESS=${MOCK_REGISTRY}.`,
    );
    process.exit(2);
  }
  const autoApprove = process.env.AUTO_APPROVE !== "false";
  console.log(`mode: AUTO_APPROVE=${autoApprove ? "on (default)" : "off"}`);

  const deployerKey = fs
    .readFileSync(
      `${process.env.HOME}/.config/agentritual/testnet-deployer.key`,
      "utf8",
    )
    .trim();
  const wallet = new ethers.Wallet(deployerKey);

  const app = await buildServer();
  await app.listen({ host: "127.0.0.1", port: 0 });
  const addr = app.server.address();
  if (!addr || typeof addr === "string") throw new Error("no listen addr");
  const base = `http://127.0.0.1:${addr.port}`;

  async function jfetch(path: string, init?: RequestInit) {
    const res = await fetch(base + path, init);
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
    return { res, json: json as Record<string, unknown> | null, text };
  }

  try {
    // 1. Challenge + EIP-191 verify → proof token.
    const ch = await jfetch(
      `/api/auth/challenge?address=${wallet.address}`,
    );
    check("challenge 200", ch.res.status === 200, String(ch.res.status));
    const message = ch.json?.message as string;
    const tag = ch.json?.tag as string;
    const sig = await wallet.signMessage(message);
    const ver = await jfetch("/api/auth/verify", {
      body: JSON.stringify({
        address: wallet.address,
        message,
        signature: sig,
        tag,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    check("verify 200", ver.res.status === 200, String(ver.res.status));
    const proofToken = ver.json?.proofToken as string;
    check("proof token issued", typeof proofToken === "string");

    // 2. Submit.
    const sub = await jfetch("/api/submissions", {
      body: JSON.stringify({
        campaignId: "001",
        proofToken,
        squareUrl: SQUARE_URL,
        wallet: wallet.address,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    check("submit 201", sub.res.status === 201, String(sub.res.status));
    const id = sub.json?.id as string;
    check("submission id returned", typeof id === "string");

    if (autoApprove) {
      check(
        "auto-approved: status approved",
        sub.json?.status === "approved",
        String(sub.json?.status),
      );
      const v = sub.json?.voucher as Record<string, unknown> | undefined;
      check("auto-approved: voucher in response", !!v);
      if (v) {
        check(
          "voucher recipient is the submitter",
          (v.recipient as string)?.toLowerCase() ===
            wallet.address.toLowerCase(),
        );
        check(
          "voucher campaignId is 1",
          v.campaignId === 1,
          String(v.campaignId),
        );
        const deadline = v.deadline as number;
        const now = Math.floor(Date.now() / 1000);
        check(
          "voucher deadline within 1 hour",
          deadline > now && deadline <= now + 3600,
          `deadline=${deadline} now=${now}`,
        );
        check(
          "voucher nonce is bytes32",
          /^0x[0-9a-fA-F]{64}$/.test(v.nonce as string),
        );
        // The signature must recover the authorized signer for the
        // testnet domain — the same check the contract does on-chain.
        const recovered = ethers.verifyTypedData(
          {
            chainId: 97,
            name: "AgentRitual",
            verifyingContract: TEST_CONTRACT,
            version: "1",
          },
          VOUCHER_TYPES,
          {
            campaignId: v.campaignId,
            deadline: v.deadline,
            nonce: v.nonce,
            recipient: v.recipient,
          },
          v.signature as string,
        );
        check(
          "voucher signature recovers authorized signer",
          recovered.toLowerCase() === TESTNET_SIGNER.toLowerCase(),
          recovered,
        );
      }
      // GET must also carry the voucher.
      const got = await jfetch(`/api/submissions/${id}`);
      check("GET submission 200", got.res.status === 200);
      check(
        "GET carries the voucher",
        !!(got.json?.voucher as Record<string, unknown> | undefined),
      );
      // A second submit with a fresh token must 409 (one active
      // submission per wallet per campaign).
      const ch2 = await jfetch(
        `/api/auth/challenge?address=${wallet.address}`,
      );
      const sig2 = await wallet.signMessage(ch2.json?.message as string);
      const ver2 = await jfetch("/api/auth/verify", {
        body: JSON.stringify({
          address: wallet.address,
          message: ch2.json?.message,
          signature: sig2,
          tag: ch2.json?.tag,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const sub2 = await jfetch("/api/submissions", {
        body: JSON.stringify({
          campaignId: "001",
          proofToken: ver2.json?.proofToken,
          squareUrl: SQUARE_URL,
          wallet: wallet.address,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      check(
        "second submit 409 (duplicate active submission)",
        sub2.res.status === 409,
        String(sub2.res.status),
      );
    } else {
      check(
        "manual mode: status pending",
        sub.json?.status === "pending",
        String(sub.json?.status),
      );
      check(
        "manual mode: no voucher in response",
        sub.json?.voucher === undefined,
      );
      const got = await jfetch(`/api/submissions/${id}`);
      check(
        "manual mode: GET carries no voucher",
        got.json?.voucher === undefined,
      );
    }
  } finally {
    await app.close();
  }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\nTOTAL: ${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
