// test-auth-eip712.ts — EIP-712 challenge variant: EIP-191 must keep working,
// EIP-712 must verify, and every negative case must fail closed.
//
// Run from apps/api:
//   DATABASE_PATH=$(mktemp -d)/test.db AUTH_SECRET=test-secret \
//   ADMIN_SESSION_SECRET=test-secret NFT_CHAIN_ID=97 \
//   NFT_CONTRACT_ADDRESS=0xca998896041A761E315125cf42E8dBE8D3cE087C \
//   npx tsx src/scripts/test-auth-eip712.ts
//
// Env must be set on the command line (config reads env at import time).
// Exits 0 when every case passes, 1 otherwise.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ethers } from "ethers";
import { buildServer } from "../server";
import {
  buildChallenge,
  challengeTag,
  verifyProofToken,
} from "../auth";

const TEST_CONTRACT = "0xca998896041A761E315125cf42E8dBE8D3cE087C";

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

  const app = await buildServer();
  await app.listen({ host: "127.0.0.1", port: 0 });
  const addr = app.server.address();
  if (!addr || typeof addr === "string") throw new Error("listen failed");
  const base = `http://127.0.0.1:${addr.port}`;

  const post = async (pathName: string, body: unknown) => {
    const res = await fetch(`${base}${pathName}`, {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    return { json: (await res.json()) as Record<string, unknown>, status: res.status };
  };
  const getChallenge = async (address: string) => {
    const res = await fetch(
      `${base}/api/auth/challenge?address=${encodeURIComponent(address)}`,
    );
    return { json: (await res.json()) as Record<string, any>, status: res.status };
  };

  const user = ethers.Wallet.createRandom();
  const stranger = ethers.Wallet.createRandom();

  try {
    // 1. Challenge response carries typedData bound to the same challenge.
    const ch1 = await getChallenge(user.address);
    const td = ch1.json.typedData as Record<string, any> | undefined;
    check(
      "challenge returns typedData with server domain",
      ch1.status === 200 &&
        !!td &&
        td.domain?.name === "AgentRitual" &&
        td.domain?.version === "1" &&
        td.domain?.chainId === 97 &&
        (td.domain?.verifyingContract as string)?.toLowerCase() ===
          TEST_CONTRACT.toLowerCase() &&
        td.primaryType === "OwnershipProof" &&
        (td.message?.wallet as string)?.toLowerCase() ===
          user.address.toLowerCase() &&
        typeof td.message?.nonce === "string" &&
        typeof td.message?.expiresAt === "number",
      `status=${ch1.status}`,
    );

    // 2. EIP-191 happy path (regression: the old flow still works).
    const ch2 = await getChallenge(user.address);
    const sig191 = await user.signMessage(ch2.json.message as string);
    const v191 = await post("/api/auth/verify", {
      address: user.address,
      message: ch2.json.message,
      signature: sig191,
      tag: ch2.json.tag,
    });
    check(
      "EIP-191 verify succeeds + proofToken valid",
      v191.status === 200 &&
        typeof v191.json.proofToken === "string" &&
        !!verifyProofToken(v191.json.proofToken as string, user.address),
      `status=${v191.status}`,
    );

    // 3. EIP-712 happy path (the new flow BAW agents need).
    const ch3 = await getChallenge(user.address);
    const td3 = ch3.json.typedData as Record<string, any>;
    const sig712 = await user.signTypedData(
      td3.domain,
      td3.types,
      td3.message,
    );
    const v712 = await post("/api/auth/verify", {
      address: user.address,
      message: ch3.json.message,
      signature: sig712,
      signType: "eip712",
      tag: ch3.json.tag,
    });
    check(
      "EIP-712 verify succeeds + proofToken valid",
      v712.status === 200 &&
        typeof v712.json.proofToken === "string" &&
        !!verifyProofToken(v712.json.proofToken as string, user.address),
      `status=${v712.status}`,
    );

    // 4. EIP-712 with the wrong signer -> 403.
    const ch4 = await getChallenge(user.address);
    const td4 = ch4.json.typedData as Record<string, any>;
    const sigWrong = await stranger.signTypedData(
      td4.domain,
      td4.types,
      td4.message,
    );
    const vWrong = await post("/api/auth/verify", {
      address: user.address,
      message: ch4.json.message,
      signature: sigWrong,
      signType: "eip712",
      tag: ch4.json.tag,
    });
    check("EIP-712 wrong signer -> 403", vWrong.status === 403, `status=${vWrong.status}`);

    // 5. EIP-191 signature verified as eip712 -> 403 (type mismatch).
    const ch5 = await getChallenge(user.address);
    const sig191b = await user.signMessage(ch5.json.message as string);
    const vMismatch1 = await post("/api/auth/verify", {
      address: user.address,
      message: ch5.json.message,
      signature: sig191b,
      signType: "eip712",
      tag: ch5.json.tag,
    });
    check(
      "EIP-191 sig as eip712 -> 403",
      vMismatch1.status === 403,
      `status=${vMismatch1.status}`,
    );

    // 6. EIP-712 signature verified as eip191 (default) -> 403.
    const ch6 = await getChallenge(user.address);
    const td6 = ch6.json.typedData as Record<string, any>;
    const sig712b = await user.signTypedData(td6.domain, td6.types, td6.message);
    const vMismatch2 = await post("/api/auth/verify", {
      address: user.address,
      message: ch6.json.message,
      signature: sig712b,
      tag: ch6.json.tag,
    });
    check(
      "EIP-712 sig as eip191 -> 403",
      vMismatch2.status === 403,
      `status=${vMismatch2.status}`,
    );

    // 7. Single-use is shared across both types: verify EIP-712 once,
    // then the same challenge as EIP-191 must fail as already used.
    const ch7 = await getChallenge(user.address);
    const td7 = ch7.json.typedData as Record<string, any>;
    const sig712c = await user.signTypedData(td7.domain, td7.types, td7.message);
    const v7a = await post("/api/auth/verify", {
      address: user.address,
      message: ch7.json.message,
      signature: sig712c,
      signType: "eip712",
      tag: ch7.json.tag,
    });
    const sig191c = await user.signMessage(ch7.json.message as string);
    const v7b = await post("/api/auth/verify", {
      address: user.address,
      message: ch7.json.message,
      signature: sig191c,
      tag: ch7.json.tag,
    });
    check(
      "challenge single-use across both types",
      v7a.status === 200 && v7b.status === 400,
      `first=${v7a.status} second=${v7b.status}`,
    );

    // 8. Cross-chain replay: sign typed data for chain 56, server is 97 -> 403.
    const ch8 = await getChallenge(user.address);
    const td8 = ch8.json.typedData as Record<string, any>;
    const sig56 = await user.signTypedData(
      { ...td8.domain, chainId: 56 },
      td8.types,
      td8.message,
    );
    const v8 = await post("/api/auth/verify", {
      address: user.address,
      message: ch8.json.message,
      signature: sig56,
      signType: "eip712",
      tag: ch8.json.tag,
    });
    check("cross-chain EIP-712 sig -> 403", v8.status === 403, `status=${v8.status}`);

    // 9. Expired challenge -> 400 (crafted with a past expiry + valid tag).
    const past = buildChallenge(user.address);
    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    const expiredMsg = `AgentRitual ownership proof for ${user.address.toLowerCase()} — nonce ${past.nonce} — ${expiredAt}`;
    const expiredTag = challengeTag({
      address: past.address,
      expiresAt: expiredAt,
      nonce: past.nonce,
    });
    const sigExpired = await user.signMessage(expiredMsg);
    const v9 = await post("/api/auth/verify", {
      address: user.address,
      message: expiredMsg,
      signature: sigExpired,
      tag: expiredTag,
    });
    check("expired challenge -> 400", v9.status === 400, `status=${v9.status}`);

    // 10. Invalid signType -> 400.
    const ch10 = await getChallenge(user.address);
    const sig10 = await user.signMessage(ch10.json.message as string);
    const v10 = await post("/api/auth/verify", {
      address: user.address,
      message: ch10.json.message,
      signature: sig10,
      signType: "eip999",
      tag: ch10.json.tag,
    });
    check("invalid signType -> 400", v10.status === 400, `status=${v10.status}`);

    // 11. Tampered tag -> 400.
    const ch11 = await getChallenge(user.address);
    const sig11 = await user.signMessage(ch11.json.message as string);
    const badTag = `00${(ch11.json.tag as string).slice(2)}`;
    const v11 = await post("/api/auth/verify", {
      address: user.address,
      message: ch11.json.message,
      signature: sig11,
      tag: badTag,
    });
    check("tampered tag -> 400", v11.status === 400, `status=${v11.status}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n${results.length - failed.length}/${results.length} cases passed.`,
  );
  if (failed.length > 0) {
    console.log(`FAILED: ${failed.map((f) => f.name).join("; ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
