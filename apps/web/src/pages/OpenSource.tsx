import { Card, HonestNote, SectionTitle } from "../App";

const REAL: string[] = [
  "Proof submission API — POST /api/submissions stores a pending submission.",
  "SQLite database with migrations for submissions, audit log, and vouchers (001–005).",
  "Live Mint Tracker reads totalSupply + Mint events from the active mode's chain (testnet 97 / mainnet 56) — switch modes in the header.",
  "NFT contract deployed — ERC-721, cap 1,000, voucher EIP-712. Testnet (chain 97) + mainnet (chain 56), Sourcify exact_match both.",
  "Agent ID on-chain verification — balanceOf on the official registry (mainnet) and the mock registry (testnet demo); eligibility endpoint + BAW balanceOf proven.",
  "Admin authentication + review + append-only audit log — implemented (Phase 4) + hardening review.",
  "End-to-end tests — voucher expiry, replay, duplicate mint, supply limit, failed transactions (Phase 4 e2e 25/25, Phase 5 e2e 7/7).",
  "Mainnet deployment — deployed 19 Nov 2026, tx 0x704dcd77…, block 134.475.521, Sourcify exact_match, owner vanilla.ai.",
  "NFT metadata live on IPFS — image + 1,000 metadata files pinned on Filebase (verified via gateway); mainnet baseURI set 20 Nov 2026, tx 0xa31e44cc….",
  "Live deployment — web on Vercel, APIs on Railway (testnet + mainnet), Turso databases; free tiers.",
  "First product-flow mainnet mint — token #1 minted 22 Nov 2026 by our first tester via an approved submission and voucher. Needs an approved submission from an Agent ID holder (the owner cannot self-approve).",
  "Single admin wallet (vanilla.ai) — self-approval is blocked; limitation documented in docs/admin-rights.md.",
];

const PLANNED: string[] = [
  "Binance AI Pro end-to-end test — not validated yet.",
];

export function OpenSourcePage() {
  return (
    <div className="space-y-10 pt-8">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
          Open Source
        </p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
          Open by design
        </h1>
        <p className="mt-3 max-w-3xl text-muted">
          The hackathon requires contracts to be verified on BscScan and
          open-source. This project is public from the start.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle>Repository</SectionTitle>
          <p className="text-sm text-zinc-200">
            <a
              href="https://github.com/Vanialla22/agentritual"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-gold underline"
            >
              github.com/Vanialla22/agentritual
            </a>
          </p>
          <p className="mt-2 text-sm text-muted">
            Public since 19 Nov 2026 — pushed eb2aa44. Monorepo: web app,
            API, contracts, agent skill, docs.
          </p>
          <p className="mt-2 text-sm text-muted">
            IPFS CAR backup:{" "}
            <a
              href="https://github.com/Vanialla22/agentritual/releases/tag/ipfs-artifacts-v1"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-gold underline"
            >
              Release ipfs-artifacts-v1
            </a>{" "}
            (image.car + metadata.car + SHA256SUMS).
          </p>
        </Card>
        <Card>
          <SectionTitle>Contract on BscScan</SectionTitle>
          <p className="text-sm text-zinc-200">
            Mainnet (56):{" "}
            <a
              href="https://bscscan.com/address/0x60153D5098EB900273164cb1f8623Fa91EC653B4"
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-xs font-semibold text-gold underline"
            >
              0x60153D5098EB900273164cb1f8623Fa91EC653B4
            </a>
          </p>
          <p className="mt-2 text-sm text-zinc-200">
            Testnet (97):{" "}
            <a
              href="https://testnet.bscscan.com/address/0xca998896041A761E315125cf42E8dBE8D3cE087C"
              target="_blank"
              rel="noreferrer"
              className="break-all font-mono text-xs font-semibold text-gold underline"
            >
              0xca998896041A761E315125cf42E8dBE8D3cE087C
            </a>
          </p>
          <p className="mt-2 text-sm text-muted">
            Both contracts are deployed and Sourcify-verified. Mainnet mint
            is open — the first mint (token #0) is done and the first
            product mint (token #1) is done, 22 Nov 2026. Testnet is the
            demo chain — see Live Mint Tracker for current minted counts.
          </p>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle>What is real</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            {REAL.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Still pending</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            {PLANNED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>Architecture (short)</SectionTitle>
        <Card>
          <p className="text-sm text-zinc-200">
            Frontend (Vite + React + TypeScript) — API (Node + Fastify) —
            SQLite/Turso database — Foundry smart contract — agent skill.md.
            The website never touches a wallet or a private key; on-chain
            actions happen only through the user&apos;s own AI agent with
            preview + explicit confirmation. Full architecture and admin
            rights: <span className="font-mono text-xs">docs/architecture.md</span> and{" "}
            <span className="font-mono text-xs">docs/admin-rights.md</span> in
            the repository.
          </p>
        </Card>
        <div className="mt-3">
          <HonestNote>
            Items marked “planned” are not claimed as working. They become
            “real” only when built and tested — with evidence, not promises.
          </HonestNote>
        </div>
      </section>
    </div>
  );
}
