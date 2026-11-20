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
          <img
            src="/genesis-seal.webp"
            alt="Genesis Seal artwork"
            className="h-72 w-72 rounded-2xl object-cover sm:h-80 sm:w-80"
          />
          <p className="mt-3 text-center text-xs text-muted">
            The Genesis Seal artwork — pinned on IPFS (Filebase). The
            mainnet contract baseURI points at the live metadata since 20
            Nov 2026.
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
                <dt className="text-muted">Mainnet (56)</dt>
                <dd className="break-all font-semibold text-gold">
                  <a
                    href="https://bscscan.com/address/0x60153D5098EB900273164cb1f8623Fa91EC653B4"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    0x60153D5098EB900273164cb1f8623Fa91EC653B4
                  </a>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Mainnet minted</dt>
                <dd className="font-semibold text-white">Not open yet — see Live Mint Tracker</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Testnet (97)</dt>
                <dd className="break-all font-semibold text-gold">
                  <a
                    href="https://testnet.bscscan.com/address/0xca998896041A761E315125cf42E8dBE8D3cE087C"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    0xca998896041A761E315125cf42E8dBE8D3cE087C
                  </a>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Testnet minted</dt>
                <dd className="font-semibold text-white">Demo mints — see Live Mint Tracker</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Max supply</dt>
                <dd className="font-semibold text-white">1,000</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Per wallet</dt>
                <dd className="font-semibold text-white">1 per campaign</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <SectionTitle>Rules — enforced on-chain (Phase 2)</SectionTitle>
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
              <li>Caller must hold a Binance Agent ID (balanceOf &gt; 0 on the registry — official registry on mainnet, mock registry on testnet).</li>
              <li>The voucher recipient, the Agent ID owner wallet, and the minting wallet must be the same address.</li>
              <li>Each voucher is single-use, has an expiry, and cannot be replayed.</li>
              <li>Supply cap 1,000 and one-per-wallet cannot be bypassed by an admin.</li>
            </ul>
          </Card>
        </div>
      </section>

      <HonestNote>
        Both contracts are deployed and Sourcify-verified: mainnet (chain
        56) and testnet (chain 97). A contract address is listed
        here only after deployment with a transaction hash and BscScan
        verification — both deployments meet that bar. The NFT metadata is
        live on IPFS (baseURI set 20 Nov 2026); minting via agent has never
        been tested end-to-end and is not open yet. See Live Mint Tracker
        for current minted counts.
      </HonestNote>
    </div>
  );
}
