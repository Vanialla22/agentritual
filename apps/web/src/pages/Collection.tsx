import { Card, HonestNote, SectionTitle } from "../App";

export function CollectionPage() {
  return (
    <div className="space-y-10 pt-8">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
          NFT Collection
        </p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
          Genesis Seal
        </h1>
        <p className="mt-3 max-w-3xl text-muted">
          The Campaign 001 mint. One Genesis Seal per wallet — enforced by the
          smart contract, not just by this website.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col items-center justify-center">
          <svg
            viewBox="0 0 200 200"
            className="h-56 w-56"
            role="img"
            aria-label="Genesis Seal artwork placeholder"
          >
            <circle cx="100" cy="100" r="96" fill="#141416" stroke="#ffd60a" strokeWidth="3" />
            <circle cx="100" cy="100" r="78" fill="none" stroke="#ffd60a" strokeWidth="1" strokeDasharray="4 6" />
            <circle cx="100" cy="100" r="58" fill="none" stroke="#ffd60a" strokeWidth="1.5" />
            <text x="100" y="118" textAnchor="middle" fontSize="52" fontWeight="900" fill="#ffd60a" fontFamily="system-ui, sans-serif">
              AR
            </text>
            <text x="100" y="150" textAnchor="middle" fontSize="11" letterSpacing="3" fill="#9a9aa3" fontFamily="system-ui, sans-serif">
              GENESIS SEAL
            </text>
          </svg>
          <p className="mt-3 text-center text-xs text-muted">
            Artwork placeholder — final Genesis Seal art ships with the
            contract (Phase 2).
          </p>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle>Contract</SectionTitle>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Standard</dt>
                <dd className="font-semibold text-white">ERC-721</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Chain</dt>
                <dd className="font-semibold text-white">BNB Smart Chain (56)</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Contract address</dt>
                <dd className="font-semibold text-gold">Not deployed</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Max supply</dt>
                <dd className="font-semibold text-white">1,000</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Per wallet</dt>
                <dd className="font-semibold text-white">1 per campaign</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Minted</dt>
                <dd className="font-semibold text-gold">No on-chain data yet</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <SectionTitle>Rules — enforced on-chain (Phase 2)</SectionTitle>
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
              <li>Caller must hold a Binance Agent ID (balanceOf &gt; 0 on the official registry).</li>
              <li>The voucher recipient, the Agent ID owner wallet, and the minting wallet must be the same address.</li>
              <li>Each voucher is single-use, has an expiry, and cannot be replayed.</li>
              <li>Supply cap 1,000 and one-per-wallet cannot be bypassed by an admin.</li>
            </ul>
          </Card>
        </div>
      </section>

      <HonestNote>
        The contract address is shown as “Not deployed” because no contract
        exists yet. A contract is only listed here after deployment with a
        transaction hash and BscScan verification.
      </HonestNote>
    </div>
  );
}
