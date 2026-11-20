import { useEffect, useRef, useState } from "react";
import { Card, GoldButton, HonestNote, SectionTitle } from "../App";
import {
  fetchChallenge,
  fetchEligibility,
  fetchSubmission,
  getMode,
  MODES,
  submitProof,
  verifyChallenge,
  type Challenge,
  type Eligibility,
  type Mode,
  type Voucher,
} from "../lib/api";

// The prompt follows the active mode: the only differences are the Agent ID
// registry address (Mock on testnet, official on mainnet) and one mode
// marker line. Everything else is identical in both modes.
function agentPrompt(mode: Mode): string {
  const registry = MODES[mode].registryAddress;
  const modeLine =
    mode === "testnet" ? "Mode: Testnet — demo." : "Mode: Mainnet — real.";
  const idPhrase =
    mode === "testnet"
      ? "a Mock Agent ID (balanceOf on the Mock Agent ID registry"
      : "a Binance Agent ID (balanceOf on the official Agent ID contract";
  return `Join Campaign 001 on AgentRitual. Read the AgentRitual agent skill
(skill.md, published with the project repository) and follow it.
${modeLine}

1. Check my Agentic Wallet address and confirm I hold ${idPhrase}
   ${registry} must be greater than 0).
2. Draft an original Binance Square post for Campaign 001 with the
   hashtags #BinanceWalletHackathon and #AgenticWallet.
3. Show me the draft. I will publish it myself from my own Square
   account.
4. After I paste the post URL, prove I own the wallet first: request
   an ownership challenge from the API, sign the challenge message with
   my wallet, verify the signature, then submit the proof with the
   proof token. If your wallet is a Binance Agentic Wallet (BAW), it
   cannot personal_sign — sign the challenge's typedData instead
   (EIP-712, eth_signTypedData_v4) and verify with signType "eip712".
5. If the proof is approved and a claim voucher is issued, show me
   the full mint transaction first — chain, contract address,
   recipient, NFT, and gas estimate — and wait for my explicit
   approval before executing anything.

Rules: never ask me for a seed phrase, private key, API secret, or
pairing code. Never enable Secure Auto Sign or skip the preview +
confirmation step. This website never shows a QR login — sign in
only through Binance AI Pro or a trusted agent of my own.`;
}

export function CampaignPage() {
  // Mode is stable for this component's lifetime: App remounts the page
  // (key={mode}) whenever the mode changes.
  const mode = getMode();
  const prompt = agentPrompt(mode);
  const [wallet, setWallet] = useState("");
  const [squareUrl, setSquareUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [checkAddress, setCheckAddress] = useState("");
  const [checking, setChecking] = useState(false);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [eligibilityError, setEligibilityError] = useState<string | null>(
    null,
  );
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(
    null,
  );
  // The claim voucher, when the API returns one. Kept in memory only —
  // never localStorage — and only ever set from a fetchSubmission
  // response (the API includes it only when status === "approved").
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [signature, setSignature] = useState("");
  // Which signature the user pasted: EIP-191 (personal_sign, default) or
  // EIP-712 (BAW agents — BAW cannot personal_sign). The verify call must
  // send the matching signType, or the server recovers the wrong address
  // (this bit us live on 20 Nov 2026: an EIP-712 signature verified as
  // EIP-191 always fails with "signature does not match the address").
  // Switching type clears the pasted signature — a signature made for
  // one type never verifies as the other.
  const [signType, setSignType] = useState<"eip191" | "eip712">("eip191");
  const [proofToken, setProofToken] = useState<string | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const pollCount = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voucher validity, computed at render time (deadline is unix seconds).
  const voucherExpired =
    voucher !== null && Date.now() / 1000 > voucher.deadline;
  const voucherMinutesLeft =
    voucher !== null
      ? Math.max(0, Math.floor((voucher.deadline - Date.now() / 1000) / 60))
      : 0;

  // Poll the submission status for up to 60 s after submit (status only
  // changes when an admin reviews it — Phase 4 — so the poll stops on
  // its own; the Refresh button below always works).
  useEffect(() => {
    if (!submittedId) return;
    pollCount.current = 0;
    pollTimer.current = setInterval(async () => {
      pollCount.current += 1;
      try {
        const sub = await fetchSubmission(submittedId);
        setSubmittedStatus(sub.status);
        setVoucher(sub.voucher ?? null);
        if (sub.status !== "pending" || pollCount.current >= 12) {
          if (pollTimer.current) clearInterval(pollTimer.current);
        }
      } catch {
        if (pollTimer.current) clearInterval(pollTimer.current);
      }
    }, 5000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [submittedId]);

  async function onCheckEligibility(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setEligibility(null);
    setEligibilityError(null);
    try {
      const res = await fetchEligibility(checkAddress.trim());
      setEligibility(res);
    } catch (err) {
      setEligibilityError(
        err instanceof Error ? err.message : "Eligibility check failed.",
      );
    } finally {
      setChecking(false);
    }
  }

  async function refreshStatus() {
    if (!submittedId) return;
    setRefreshing(true);
    try {
      const sub = await fetchSubmission(submittedId);
      setSubmittedStatus(sub.status);
      setVoucher(sub.voucher ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status check failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function onGetChallenge() {
    if (!wallet.trim()) {
      setProofError("Enter your Agentic Wallet address first.");
      return;
    }
    setProofBusy(true);
    setProofError(null);
    setProofToken(null);
    try {
      const ch = await fetchChallenge(wallet.trim());
      setChallenge(ch);
    } catch (err) {
      setProofError(
        err instanceof Error ? err.message : "Challenge request failed.",
      );
    } finally {
      setProofBusy(false);
    }
  }

  async function onVerifySignature(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge || !signature.trim()) return;
    setProofBusy(true);
    setProofError(null);
    try {
      const res = await verifyChallenge({
        address: challenge.address,
        message: challenge.message,
        signature: signature.trim(),
        signType,
        tag: challenge.tag,
      });
      setProofToken(res.proofToken);
    } catch (err) {
      setProofError(
        err instanceof Error ? err.message : "Signature verification failed.",
      );
    } finally {
      setProofBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      if (!proofToken) {
        throw new Error(
          "Prove wallet ownership first (step above) — submissions require a valid proof token.",
        );
      }
      const sub = await submitProof({
        campaignId: "001",
        proofToken,
        squareUrl: squareUrl.trim(),
        wallet: wallet.trim(),
      });
      const checked = await fetchSubmission(sub.id);
      setSubmittedId(checked.id);
      setSubmittedStatus(checked.status);
      setVoucher(checked.voucher ?? null);
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
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function copyText(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setCopiedField(null);
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
        <SectionTitle>Check Agent ID eligibility</SectionTitle>
        <Card>
          <form onSubmit={onCheckEligibility} className="space-y-4">
            <div>
              <label
                htmlFor="checkAddress"
                className="mb-1 block text-sm font-semibold text-white"
              >
                Wallet address to check
              </label>
              <input
                id="checkAddress"
                type="text"
                value={checkAddress}
                onChange={(e) => setCheckAddress(e.target.value)}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-gold focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted">
                Read-only check against the Agent ID registry on-chain. No
                wallet connection, no signature, nothing is stored.
              </p>
            </div>
            <button
              type="submit"
              disabled={checking}
              className="rounded-md bg-gold px-5 py-2.5 font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {checking ? "Checking…" : "Check eligibility"}
            </button>
          </form>
          {eligibility && (
            <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
              {eligibility.hasAgentId
                ? `✓ ${eligibility.address} holds a Binance Agent ID — eligible for Campaign 001.`
                : `✗ ${eligibility.address} holds no Agent ID on the registry — not eligible.`}
            </p>
          )}
          {eligibilityError && (
            <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {eligibilityError}
            </p>
          )}
          {mode === "testnet" && (
            <div className="mt-4 rounded-md border border-line bg-ink px-3 py-2 text-sm text-zinc-200">
              <p className="font-semibold text-white">
                Need testnet BNB for gas?
              </p>
              <p className="mt-1 text-xs text-muted">
                The mint transaction on BSC testnet needs a little tBNB for
                gas. Testnet BNB is free play money — it has no real value.
              </p>
              <a
                href="https://www.bnbchain.org/en/testnet-faucet"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block rounded-md bg-gold px-4 py-2 text-xs font-semibold text-black transition hover:brightness-110"
              >
                Get testnet BNB (faucet)
              </a>
            </div>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>
          Agent prompt — {mode === "testnet" ? "Testnet (demo)" : "Mainnet (real)"} — copy &amp; paste to your own AI agent
        </SectionTitle>
        <Card>
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-200 sm:text-sm">
            {prompt}
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
        <SectionTitle>Prove wallet ownership</SectionTitle>
        <Card>
          <p className="text-sm text-zinc-200">
            Before submitting, prove you control the wallet by signing a
            one-time challenge message. Signing a message is not sharing a
            private key — and the message authorizes nothing, it only proves
            ownership for 10 minutes.
          </p>
          <div className="mt-4">
            <GoldButton onClick={onGetChallenge} disabled={proofBusy}>
              {proofBusy ? "Working…" : "Get challenge"}
            </GoldButton>
          </div>
          {challenge && (
            <div className="mt-4 space-y-3">
              <p className="break-all rounded-md border border-line bg-ink px-3 py-2 font-mono text-xs text-zinc-200">
                {challenge.message}
              </p>
              <p className="text-xs text-muted">
                {signType === "eip712"
                  ? "Sign the typed data below with your wallet (EIP-712), then paste the signature below. Challenge expires "
                  : "Ask your agent to sign this exact message with your wallet (personal_sign), then paste the signature below. Challenge expires "}
                {challenge.expiresAt}.
              </p>
              {signType === "eip712" && challenge.typedData && (
                <div className="space-y-1">
                  <p className="text-xs text-muted">
                    BAW agents: sign this typed data (EIP-712) via the
                    eth_signTypedData_v4 JSON-RPC request, then verify with
                    signType "eip712".
                  </p>
                  <p className="break-all rounded-md border border-line bg-ink px-3 py-2 font-mono text-xs text-zinc-200">
                    {JSON.stringify(challenge.typedData)}
                  </p>
                </div>
              )}
              <form onSubmit={onVerifySignature} className="space-y-3">
                <div className="flex gap-4 text-sm text-zinc-200">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="signType"
                      checked={signType === "eip191"}
                      onChange={() => {
                        setSignType("eip191");
                        setSignature("");
                      }}
                      className="accent-yellow-500"
                    />
                    Personal sign (EIP-191)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="signType"
                      checked={signType === "eip712"}
                      onChange={() => {
                        setSignType("eip712");
                        setSignature("");
                      }}
                      className="accent-yellow-500"
                    />
                    EIP-712 (BAW)
                  </label>
                </div>
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="0x… signature"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-gold focus:outline-none"
                />
                <GoldButton disabled={proofBusy || !signature.trim()} type="submit">
                  {proofBusy ? "Verifying…" : "Verify signature"}
                </GoldButton>
              </form>
            </div>
          )}
          {proofToken && (
            <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
              ✓ Wallet ownership proven — you can submit your proof below.
            </p>
          )}
          {proofError && (
            <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {proofError}
            </p>
          )}
        </Card>
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
                Tempel link postingan Binance Square di sini. Link share
                dari aplikasi Binance maupun link web juga bisa digunakan.
                Konten diperiksa oleh human reviewer, bukan otomatis oleh
                form.
              </p>
            </div>
            <button
              type="submit"
              disabled={busy || !proofToken}
              className="rounded-md bg-gold px-5 py-2.5 font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit proof"}
            </button>
            {!proofToken && (
              <p className="mt-1 text-xs text-muted">
                Prove wallet ownership (step above) to enable this button.
              </p>
            )}
          </form>
          {message && (
            <p className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
              {message}
            </p>
          )}
          {submittedId && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-line bg-ink px-3 py-2 text-sm text-zinc-200">
              <span>
                Status:{" "}
                <span className="font-semibold text-gold">
                  {submittedStatus ?? "pending"}
                </span>
              </span>
              <button
                type="button"
                onClick={refreshStatus}
                disabled={refreshing}
                className="rounded-md border border-gold/60 px-3 py-1 text-xs font-semibold text-gold transition hover:bg-gold/10 disabled:opacity-50"
              >
                {refreshing ? "Refreshing…" : "Refresh status"}
              </button>
              <span className="text-xs text-muted">
                Status changes when an admin reviews the submission (Phase
                4). This page polls for 60 s after submit.
              </span>
            </div>
          )}
          {submittedStatus === "approved" && voucher && (
            <div className="mt-4 space-y-3 rounded-md border border-gold/40 bg-gold/10 px-3 py-3 text-sm">
              <p className="font-semibold text-gold">
                ✓ Approved — your claim voucher
              </p>
              <p className="text-xs text-muted">
                Chain: {MODES[mode].chainName} ({MODES[mode].chainId}) ·
                Contract{" "}
                <span className="break-all font-mono">
                  {MODES[mode].contractAddress}
                </span>
              </p>
              <p className="text-zinc-200">
                Campaign {String(voucher.campaignId).padStart(3, "0")} ·
                Recipient{" "}
                <span className="break-all font-mono text-xs">
                  {voucher.recipient}
                </span>
              </p>
              {voucherExpired ? (
                <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300">
                  KEDALUWARSA — this voucher can no longer be used. An
                  approved submission cannot be re-reviewed or re-submitted,
                  so there is no way to get a new voucher for this campaign
                  until a re-issue policy exists. Do not try to mint with it.
                </p>
              ) : (
                <p className="text-zinc-200">
                  Valid for 1 hour from approval — expires{" "}
                  {new Date(voucher.deadline * 1000).toISOString()} (in about{" "}
                  {voucherMinutesLeft} minutes). Use it before then: after
                  expiry the contract rejects the mint.
                </p>
              )}
              <div>
                <p className="text-xs font-semibold text-muted">Nonce</p>
                <p className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-xs text-zinc-200">
                    {voucher.nonce.slice(0, 18)}…
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(voucher.nonce, "nonce")}
                    className="rounded-md border border-gold/60 px-2 py-0.5 text-xs font-semibold text-gold transition hover:bg-gold/10"
                  >
                    {copiedField === "nonce" ? "Copied ✓" : "Copy full nonce"}
                  </button>
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted">
                  Signature — give the full value to your agent
                </p>
                <p className="mt-1 break-all font-mono text-xs text-zinc-200">
                  {voucher.signature}
                </p>
                <button
                  type="button"
                  onClick={() => copyText(voucher.signature, "signature")}
                  className="mt-2 rounded-md border border-gold/60 px-2 py-0.5 text-xs font-semibold text-gold transition hover:bg-gold/10"
                >
                  {copiedField === "signature"
                    ? "Copied ✓"
                    : "Copy signature"}
                </button>
              </div>
              <p className="text-xs text-muted">
                Give this voucher to your agent; your agent must show you
                the mint transaction first (chain, contract, recipient, gas)
                and wait for your explicit approval before executing
                anything.
              </p>
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </Card>
        <div className="mt-3">
          <HonestNote>
            Submissions are stored with status “pending” and the wallet is
            checked on-chain for an Agent ID before acceptance (Phase 3).
            Since Phase 4, a submission also requires a wallet-ownership
            proof (signed challenge, 10 min) — so nobody can submit a proof
            URL in someone else&apos;s name. Admin review issues the
            voucher on approval.
          </HonestNote>
        </div>
      </section>
    </div>
  );
}
