import { useState } from "react";
import { Card, GoldButton, HonestNote, SectionTitle } from "../App";
import { fetchSubmission, submitProof } from "../lib/api";

const AGENT_PROMPT = `Join Campaign 001 on AgentRitual. Read the AgentRitual agent skill
(skill.md, published with the project repository — Phase 3) and follow it.

1. Check my Agentic Wallet address and confirm I hold a Binance Agent ID
   (balanceOf on the official Agent ID contract
   0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F must be greater than 0).
2. Draft an original Binance Square post for Campaign 001 with the hashtags
   #BinanceWalletHackathon and #AgenticWallet.
3. Show me the draft. I will publish it myself from my own Square account.
4. After I paste the post URL, submit it as proof for manual review.
5. If the proof is approved and a claim voucher is issued, show me the full
   mint transaction first — chain, contract address, recipient, NFT, and gas
   estimate — and wait for my explicit approval before executing anything.

Rules: never ask me for a seed phrase, private key, API secret, or pairing
code. Never enable Secure Auto Sign or skip the preview + confirmation step.
This website never shows a QR login — sign in only through Binance AI Pro or
a trusted agent of my own.`;

export function CampaignPage() {
  const [wallet, setWallet] = useState("");
  const [squareUrl, setSquareUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const sub = await submitProof({
        campaignId: "001",
        squareUrl: squareUrl.trim(),
        wallet: wallet.trim(),
      });
      const checked = await fetchSubmission(sub.id);
      setMessage(
        `Proof received — submission ${checked.id} is ${checked.status}. An admin will manually review your Square post. Agent ID ownership is verified on-chain before any approval.`,
      );
      setWallet("");
      setSquareUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AGENT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-10 pt-8">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
          Campaign 001
        </p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
          The Genesis Quest
        </h1>
        <p className="mt-3 max-w-3xl text-muted">
          Prove you hold a Binance Agent ID, post about AgentRitual on Binance
          Square, and mint the Genesis Seal NFT. Max supply 1,000 — one NFT
          per wallet per campaign, enforced by the smart contract (Phase 2),
          not just by this website.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle>Eligibility</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            <li>Hold a Binance Agent ID (the Agent ID owner wallet is the wallet that mints).</li>
            <li>The Agent ID owner wallet, the voucher recipient, and the NFT recipient must be the same address.</li>
            <li>One NFT per wallet per campaign.</li>
            <li>Post must be published on Binance Square by you, from your own account.</li>
          </ul>
        </Card>
        <Card>
          <SectionTitle>Square post requirements</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            <li>Include the hashtags <span className="font-semibold text-gold">#BinanceWalletHackathon</span> and <span className="font-semibold text-gold">#AgenticWallet</span>.</li>
            <li>Original post about AgentRitual / Campaign 001 — no copy-paste spam.</li>
            <li>Submit the post URL here. A URL alone is not proof: an admin reads the post before approving.</li>
            <li>Post content is verified by manual review. This site does not claim to automatically verify the post owner, likes, or engagement.</li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>Agent prompt — copy &amp; paste to your own AI agent</SectionTitle>
        <Card>
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-200 sm:text-sm">
            {AGENT_PROMPT}
          </pre>
          <div className="mt-4">
            <GoldButton onClick={copyPrompt}>
              {copied ? "Copied ✓" : "Copy prompt"}
            </GoldButton>
          </div>
        </Card>
        <div className="mt-3">
          <HonestNote>
            Your agent runs in your own environment (BAW CLI or Binance AI
            Pro). This website never shows a QR login and never asks for your
            seed phrase, private key, API secret, or pairing code.
          </HonestNote>
        </div>
      </section>

      <section>
        <SectionTitle>Submit your proof URL</SectionTitle>
        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="wallet" className="mb-1 block text-sm font-semibold text-white">
                Your Agentic Wallet address (Agent ID owner)
              </label>
              <input
                id="wallet"
                type="text"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="squareUrl" className="mb-1 block text-sm font-semibold text-white">
                Binance Square post URL
              </label>
              <input
                id="squareUrl"
                type="url"
                value={squareUrl}
                onChange={(e) => setSquareUrl(e.target.value)}
                placeholder="https://www.binance.com/square/post/…"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-gold focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted">
                Format checked: the URL must be on binance.com under
                /square/post/&lt;id&gt;. Content is checked by a human
                reviewer, not by this form.
              </p>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-gold px-5 py-2.5 font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit proof"}
            </button>
          </form>
          {message && (
            <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
              {message}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </Card>
        <div className="mt-3">
          <HonestNote>
            Phase 1: submissions are stored with status “pending”. Admin
            review, voucher issuance, and minting arrive in later phases.
            On-chain Agent ID verification runs before any approval (Phase 3).
          </HonestNote>
        </div>
      </section>
    </div>
  );
}
