// test-resubmit-mint.ts — resubmit fix, already-minted guard
// (21 Nov 2026): a wallet that already minted for a campaign must get
// 409 "already minted" when it submits again, even after its voucher
// has expired. Without the guard the resubmit would mint a fresh
// voucher whose on-chain mint must revert — wasting the user's gas.
//
// Run from apps/api (testnet only; uses a FRESH wallet each run so
// the script stays re-runnable — the deployer mints it a Mock Agent
// ID and funds it with a little tBNB for the mint):
//   DATABASE_PATH=$(mktemp -d)/test.db AUTH_SECRET=test-secret \
//   ADMIN_SESSION_SECRET=test-secret NFT_CHAIN_ID=97 \
//   NFT_CONTRACT_ADDRESS=0xca998896041A761E315125cf42E8dBE8D3cE087C \
//   AGENT_ID_REGISTRY_ADDRESS=0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7 \
//   BSC_RPC_URL=https://bsc-testnet.publicnode.com \
//   ADMIN_SIGNER_PRIVATE_KEY=$(cat ~/.config/agentritual/testnet-signer.key) \
//   npx tsx src/scripts/test-resubmit-mint.ts
//
// The deployer key is read from ~/.config/agentritual/testnet-deployer.key
// and never printed. Exits 0 when every case passes, 1 otherwise.

import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { ethers } from "ethers";
import { buildServer } from "../server";

const TEST_CONTRACT = "0xca998896041A761E315125cf42E8dBE8D3cE087C";
const MOCK_REGISTRY = "0x6E1EE2FF55042a7B689b87eF3C1B490F6d23c3C7";
const SQUARE_URL = "https://www.binance.com/square/post/380847377801319";
const NFT_ABI = [
  "function mint(uint256,address,uint256,bytes32,bytes)",
  "function hasMinted(uint256,address) view returns (bool)",
  "function totalSupply() view returns (uint256)",
];
const REGISTRY_ABI = ["function mint(address to) returns (uint256)"];

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
  console.log(
    `${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`,
  );
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
  const rpc = process.env.BSC_RPC_URL as string;
  const provider = new ethers.JsonRpcProvider(rpc);
  const deployerKey = fs
    .readFileSync(
      `${process.env.HOME}/.config/agentritual/testnet-deployer.key`,
      "utf8",
    )
    .trim();
  const deployer = new ethers.Wallet(deployerKey, provider);
  // Fresh wallet each run — never printed, never stored.
  const fresh = ethers.Wallet.createRandom().connect(provider);
  console.log(`fresh test wallet: ${fresh.address}`);

  // 1. Mock Agent ID + tBNB for the fresh wallet (deployer is the
  // Mock registry owner and holds the tBNB).
  const registry = new ethers.Contract(MOCK_REGISTRY, REGISTRY_ABI, deployer);
  const mockTx = await registry.mint(fresh.address);
  const mockRc = await mockTx.wait();
  check("mock Agent ID minted to fresh wallet", mockRc?.status === 1);
  const fundTx = await deployer.sendTransaction({
    to: fresh.address,
    value: ethers.parseEther("0.0005"),
  });
  const fundRc = await fundTx.wait();
  check("fresh wallet funded", fundRc?.status === 1);

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

  async function freshProof() {
    const ch = await jfetch(`/api/auth/challenge?address=${fresh.address}`);
    const sig = await fresh.signMessage(ch.json?.message as string);
    const ver = await jfetch("/api/auth/verify", {
      body: JSON.stringify({
        address: fresh.address,
        message: ch.json?.message,
        signature: sig,
        tag: ch.json?.tag,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    return ver.json?.proofToken as string;
  }

  try {
    // 2. Submit → 201 approved + voucher.
    const sub = await jfetch("/api/submissions", {
      body: JSON.stringify({
        campaignId: "001",
        proofToken: await freshProof(),
        squareUrl: SQUARE_URL,
        wallet: fresh.address,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    check("submit 201", sub.res.status === 201, String(sub.res.status));
    check(
      "submit approved",
      sub.json?.status === "approved",
      String(sub.json?.status),
    );
    const id = sub.json?.id as string;
    const v = sub.json?.voucher as Record<string, unknown> | undefined;
    check("voucher issued", !!v);
    if (!v) throw new Error("no voucher — cannot continue");

    // 3. Mint on-chain with the voucher (the real product path).
    const nft = new ethers.Contract(TEST_CONTRACT, NFT_ABI, fresh);
    const before = (await nft.totalSupply()) as bigint;
    const mintTx = await nft.mint(
      1,
      fresh.address,
      v.deadline,
      v.nonce,
      v.signature,
      { gasLimit: 300_000 },
    );
    const mintRc = await mintTx.wait();
    check("on-chain mint succeeded", mintRc?.status === 1, mintTx.hash);
    const after = (await nft.totalSupply()) as bigint;
    check("totalSupply +1", after === before + 1n, `${before} -> ${after}`);
    check(
      "hasMinted true after mint",
      (await nft.hasMinted(1, fresh.address)) === true,
    );

    // 4. Expire the voucher, then resubmit — must 409 "already
    // minted" (not a fresh 201). This is the discriminating case:
    // without the guard the expired voucher would allow a new one.
    {
      const tdb = new DatabaseSync(process.env.DATABASE_PATH as string);
      tdb
        .prepare("UPDATE vouchers SET deadline = ? WHERE submission_id = ?")
        .run(Math.floor(Date.now() / 1000) - 60, id);
      tdb.close();
    }
    const sub2 = await jfetch("/api/submissions", {
      body: JSON.stringify({
        campaignId: "001",
        proofToken: await freshProof(),
        squareUrl: SQUARE_URL,
        wallet: fresh.address,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    check(
      "minted wallet resubmit 409",
      sub2.res.status === 409,
      String(sub2.res.status),
    );
    check(
      "minted wallet resubmit says already minted",
      String(sub2.json?.error ?? "").includes("already minted"),
      String(sub2.json?.error),
    );
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
