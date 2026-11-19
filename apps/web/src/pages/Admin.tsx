import { Card, HonestNote, SectionTitle } from "../App";

export function AdminPage() {
  return (
    <div className="space-y-10 pt-8">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
          Review dashboard
        </h1>
        <p className="mt-3 max-w-3xl text-muted">
          Admins manually review Square proof submissions and approve or
          reject them. Approval issues a signed claim voucher bound to the
          submitter&apos;s wallet.
        </p>
      </section>

      <Card>
        <SectionTitle>Not implemented yet — Phase 4</SectionTitle>
        <p className="text-sm text-zinc-200">
          Admin sign-in, the review queue, and the audit log are{" "}
          <span className="font-semibold text-gold">not built yet</span>.
          The API returns <span className="font-mono text-xs">501 Not Implemented</span> for{" "}
          <span className="font-mono text-xs">POST /api/admin/login</span> and{" "}
          <span className="font-mono text-xs">POST /api/admin/review</span> in
          Phase 1. This page deliberately has no sign-in form and no fake
          review controls — a simulation would mislead.
        </p>
        <p className="mt-3 text-sm text-muted">
          What Phase 4 will add: password authentication (hash in env, server
          sessions), a review queue of pending submissions, approve/reject with
          a reason, an append-only audit log of every decision, and voucher
          issuance on approval.
        </p>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle>Admin CAN</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            <li>Approve or reject a submission after reading the Square post.</li>
            <li>Sign claim vouchers (automatic on approval, bound to the submitter&apos;s wallet).</li>
            <li>Rotate the voucher signer key if it is ever compromised.</li>
            <li>Change the NFT metadata base URI.</li>
            <li>Pause minting in an emergency (pause stops minting; it does not change supply).</li>
          </ul>
        </Card>
        <Card>
          <SectionTitle>Admin CANNOT</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            <li>Mint an NFT for anyone — minting only happens through the contract, by the voucher holder.</li>
            <li>Raise the 1,000 supply cap or bypass one-per-wallet.</li>
            <li>Move a voucher or change its recipient after it is signed.</li>
            <li>Change tracker numbers — the tracker reads the chain.</li>
            <li>Approve their own submission — a submission from the reviewer&apos;s own wallet is blocked from self-approval.</li>
            <li>See or store any user&apos;s private key — the backend never receives one.</li>
          </ul>
        </Card>
      </section>

      <HonestNote>
        Every admin decision will be written to an append-only audit log
        (Phase 4). The log has no edit or delete path — by design.
      </HonestNote>
    </div>
  );
}
