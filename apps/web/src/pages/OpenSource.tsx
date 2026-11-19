import { Card, HonestNote, SectionTitle } from "../App";

const REAL: string[] = [
  "Proof submission API — POST /api/submissions stores a pending submission (Phase 1).",
  "SQLite database with migrations for submissions, audit log, and vouchers (Phase 1).",
  "Honest tracker states — the tracker shows “no on-chain data yet” until a contract exists.",
];

const PLANNED: string[] = [
  "NFT contract deployment (Phase 2) — ERC-721, cap 1,000, voucher EIP-712.",
  "Agent ID on-chain verification (Phase 3) — balanceOf on the official registry.",
  "Binance AI Pro end-to-end test (Phase 3) — not validated yet.",
  "Admin authentication + review + append-only audit log (Phase 4).",
  "End-to-end tests: voucher expiry, replay, duplicate mint, supply limit, failed transactions (Phase 5).",
  "Mainnet deployment (Phase 5) — only after all tests pass, with tx hash + BscScan verification.",
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
            <span className="font-semibold text-white">github.com/vanialla22/agentritual</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            Public repository (to be created by the project owner — Phase 1
            scaffolding lives locally until then). Monorepo: web app, API,
            contracts, agent skill, docs.
          </p>
        </Card>
        <Card>
          <SectionTitle>Contract on BscScan</SectionTitle>
          <p className="text-sm text-zinc-200">
            <span className="font-semibold text-gold">Not deployed</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            The contract address and BscScan verification link appear here
            only after a real deployment — testnet in Phase 2, mainnet in
            Phase 5.
          </p>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle>What is real (Phase 1)</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            {REAL.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Still to build / test</SectionTitle>
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
