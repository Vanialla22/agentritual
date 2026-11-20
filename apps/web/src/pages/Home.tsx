import { Card, GoldButton, HonestNote, SectionTitle } from "../App";

const STEPS = [
  "Ask your AI agent to join Campaign 001.",
  "Your agent checks your Agentic Wallet address and Agent ID ownership on the configured registry (official Agent ID contract on mainnet, mock registry on the testnet demo).",
  "Your agent drafts an original Binance Square post for the quest.",
  "You publish the post yourself from your own Binance Square account.",
  "You (or your agent) paste the post URL here as proof.",
  "Your proof is approved automatically once the checks pass.",
  "The backend issues a signed claim voucher bound to your wallet.",
  "Your agent shows you the mint transaction — chain, contract, recipient, NFT, gas estimate — and you approve it explicitly. The mint is yours.",
];

const TESTNET_STEPS = [
  "No PC, no wallet connect, no command line — your AI agent does the on-chain work. You post on Binance Square from your phone and talk to your agent.",
  "Your agent holds a Mock Agent ID on BSC testnet (chain 97). Mock IDs are minted by the deployer only for now — ask the admin for one.",
  "Your agent takes the ownership challenge, signs it, and submits your Square post URL with the proof.",
  "Your proof is approved automatically once the checks pass. Your agent receives a claim voucher, valid for 24 hours.",
  "Your agent mints the Genesis Seal NFT on testnet. Free except a little testnet gas — tBNB is free from the faucet on the Campaign page.",
];

const STATUS_ROWS: Array<[string, string, string]> = [
  ["Agent ID ownership check (balanceOf)", "Live", "Read-only check against the configured registry: mock registry on testnet, official Agent ID contract on mainnet."],
  ["Custom contract call by your agent", "Proven on testnet", "Minting via agent is proven on testnet (live end-to-end demo, 20 Nov 2026, token #7 minted via voucher). On mainnet it is untested and not open yet — no user mint via BAW has run yet."],
  ["Square post verification", "Automatic approval", "Nobody reads the post — approval is automatic once the checks pass. No check claims to verify likes, owner, or engagement."],
  ["Proof submission backend", "Live", "Submissions that pass the checks are approved automatically with a voucher (AUTO_APPROVE, default on). Manual review still exists for pending submissions. Both APIs are live on Railway — testnet and mainnet."],
  ["NFT contract", "Deployed — testnet + mainnet", "ERC-721, max supply 1,000, one per wallet. Owner vanilla.ai. Metadata live on IPFS (baseURI set 20 Nov 2026); minting via agent proven on testnet (20 Nov 2026), on mainnet untested and not open yet."],
  ["Live Mint Tracker", "Live — follows the active mode", "Reads totalSupply + Mint events from the active mode's chain (testnet 97 in Testnet mode, mainnet 56 in Mainnet mode). Switch modes in the header to see the other chain."],
];

export function HomePage() {
  return (
    <div className="space-y-10">
      <section className="pt-8 text-center sm:pt-14">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
          Binance Agent ID Hackathon
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl">
          Your Agent completes the quest. Your Agent ID proves eligibility.
          Your wallet authorizes the mint.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted sm:text-lg">
          AgentRitual is an agent-native social quest and NFT mint platform.
          No feeds, no likes, no follows — and no wallet connect on this
          website. Your AI agent does the on-chain work; you approve every
          transaction yourself.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <GoldButton href="#campaign">Join Campaign 001</GoldButton>
          <a
            href="#opensource"
            className="inline-block rounded-md border border-line bg-panel px-5 py-2.5 font-semibold text-white transition hover:bg-panel-2"
          >
            How it works
          </a>
        </div>
      </section>

      <section>
        <SectionTitle>How it works</SectionTitle>
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-line bg-panel p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-black text-black">
                {i + 1}
              </span>
              <span className="text-sm text-zinc-200">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionTitle>Try the demo on testnet — free</SectionTitle>
        <Card>
          <p className="text-sm text-zinc-200">
            The full quest flow already works end-to-end on BSC testnet —
            proven live on 20 Nov 2026, when a test wallet minted token #7
            through the live API and website. Testnet uses play money only:
            no real funds, no real Agent ID needed.
          </p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {TESTNET_STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-line bg-panel-2 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-black text-black">
                  {i + 1}
                </span>
                <span className="text-sm text-zinc-200">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <GoldButton href="#campaign">Open Campaign 001</GoldButton>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>What is real, what is planned</SectionTitle>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-3 font-semibold">Integration</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_ROWS.map(([name, status, note]) => (
                  <tr key={name} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-white">{name}</td>
                    <td className="py-2.5 pr-3">
                      <span className="rounded-full bg-panel-2 px-2.5 py-1 text-xs font-semibold text-gold">
                        {status}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="mt-3">
          <HonestNote>
            Nothing on this page claims an integration works before it is
            tested. A feature is only marked live after a real on-chain test
            with a transaction hash and explorer verification.
          </HonestNote>
        </div>
      </section>

      <section>
        <SectionTitle>Campaign 001 — live now for proof submissions</SectionTitle>
        <Card>
          <p className="text-sm text-zinc-200">
            Complete the quest, post on Binance Square with{" "}
            <span className="font-semibold text-gold">
              #BinanceWalletHackathon
            </span>{" "}
            and{" "}
            <span className="font-semibold text-gold">#AgenticWallet</span>,
            submit your post URL for automatic approval, and mint the Genesis Seal
            NFT — max supply 1,000, one per wallet. The NFT contract is
            deployed on both chains: testnet (chain 97) for the demo, mainnet
            (chain 56) with metadata live on IPFS. Minting via agent is
            proven end-to-end on testnet (live demo, 20 Nov 2026). On
            mainnet it is untested and not open yet. Proof submissions are
            approved automatically once the checks pass.
          </p>
          <div className="mt-4">
            <GoldButton href="#campaign">Open Campaign 001</GoldButton>
          </div>
        </Card>
      </section>
    </div>
  );
}
