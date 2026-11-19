import { Card, GoldButton, HonestNote, SectionTitle } from "../App";

const STEPS = [
  "Ask your AI agent to join Campaign 001.",
  "Your agent checks your Agentic Wallet address and Agent ID ownership on the configured registry (official Agent ID contract on mainnet, mock registry on the testnet demo).",
  "Your agent drafts an original Binance Square post for the quest.",
  "You publish the post yourself from your own Binance Square account.",
  "You (or your agent) paste the post URL here as proof.",
  "An admin manually reviews the post.",
  "If approved, the backend issues a signed claim voucher bound to your wallet.",
  "Your agent shows you the mint transaction — chain, contract, recipient, NFT, gas estimate — and you approve it explicitly. The mint is yours.",
];

const STATUS_ROWS: Array<[string, string, string]> = [
  ["Agent ID ownership check (balanceOf)", "Live", "Read-only check against the configured registry: mock registry on testnet, official Agent ID contract on mainnet."],
  ["Custom contract call by your agent", "Partially validated", "Balance checks and the ownership-accept transaction are proven via BAW CLI on mainnet. A user mint via BAW has not run yet — mainnet mint is on HOLD."],
  ["Square post verification", "Manual review", "An admin reads the post. No automatic check claims to verify likes, owner, or engagement."],
  ["Proof submission backend", "Live", "Submissions are stored with status “pending”. Admin review and voucher issuance are implemented (Phase 4). The demo API is not deployed yet — it runs locally for now."],
  ["NFT contract", "Deployed — testnet + mainnet (HOLD)", "ERC-721, max supply 1,000, one per wallet. Testnet (chain 97) totalSupply 7; mainnet (chain 56) totalSupply 0, owner vanilla.ai, no public mint yet."],
  ["Live Mint Tracker", "Live — testnet data", "Reads totalSupply + Mint events from the configured chain. Shows testnet mints; mainnet has 0 mints so far (HOLD)."],
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
            submit your post URL for manual review, and mint the Genesis Seal
            NFT — max supply 1,000, one per wallet. The NFT contract is
            deployed: testnet (chain 97) for the demo, mainnet (chain 56) on
            HOLD with no public mint yet. Proof submissions are accepted and
            queued for review.
          </p>
          <div className="mt-4">
            <GoldButton href="#campaign">Open Campaign 001</GoldButton>
          </div>
        </Card>
      </section>
    </div>
  );
}
