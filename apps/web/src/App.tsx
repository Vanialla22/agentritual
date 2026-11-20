import { useEffect, useState } from "react";
import { getMode, MODES, setMode, type Mode } from "./lib/api";
import { AdminPage } from "./pages/Admin";
import { CampaignPage } from "./pages/Campaign";
import { CollectionPage } from "./pages/Collection";
import { HomePage } from "./pages/Home";
import { OpenSourcePage } from "./pages/OpenSource";
import { TrackerPage } from "./pages/Tracker";

const PAGES = [
  { hash: "home", label: "Home", nav: true },
  { hash: "campaign", label: "Campaign 001", nav: true },
  { hash: "collection", label: "NFT Collection", nav: true },
  { hash: "tracker", label: "Live Mint Tracker", nav: true },
  { hash: "opensource", label: "Open Source", nav: true },
  // Admin stays a valid page hash (direct #admin link still works) but
  // is NOT shown in the navigation — casual visitors never see it.
  // The project admin knows the URL.
  { hash: "admin", label: "Admin", nav: false },
] as const;

type PageHash = (typeof PAGES)[number]["hash"];

function readHash(): PageHash {
  const h = window.location.hash.replace(/^#\/?/, "") as PageHash;
  return PAGES.some((p) => p.hash === h) ? h : "home";
}

export function GoldButton({
  children,
  onClick,
  href,
  disabled = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const cls =
    "inline-block rounded-md bg-gold px-5 py-2.5 font-semibold text-black transition hover:brightness-110 disabled:opacity-50";
  if (href) {
    return (
      <a className={cls} href={href}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} onClick={onClick} type={type} disabled={disabled}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-line bg-panel p-5 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xl font-bold text-white">{children}</h2>
  );
}

export function HonestNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-line bg-panel-2 px-3 py-2 text-sm text-muted">
      {children}
    </p>
  );
}

export default function App() {
  const [page, setPage] = useState<PageHash>(() => readHash());
  // Mode state mirrors api.ts (single source of truth): initialized from
  // getMode() and updated only through setMode(). No separate mode state.
  const [mode, setModeState] = useState<Mode>(() => getMode());

  function changeMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setModeState(next);
  }

  useEffect(() => {
    const onChange = () => setPage(readHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return (
    <div className="min-h-screen bg-ink text-zinc-100">
      {mode === "testnet" ? (
        <div className="border-b border-line bg-panel px-4 py-2 text-center text-xs text-muted sm:text-sm">
          <span className="font-semibold text-gold">DEMO — TESTNET</span>
          {" — "}
          The NFT contract is deployed on BSC testnet (chain 97). Try the
          full quest flow with a Mock Agent ID — no real funds involved.
          Nothing on this page is a live transaction unless you approve one
          yourself.
        </div>
      ) : (
        <div className="border-b border-line bg-panel px-4 py-2 text-center text-xs text-muted sm:text-sm">
          <span className="font-semibold text-gold">
            MAINNET — METADATA LIVE
          </span>
          {" — "}
          NFT metadata is live on IPFS (baseURI set 20 Nov 2026), but
          minting via agent has never been tested end-to-end and is not
          open yet. Nothing on this page is a live transaction unless you
          approve one yourself.
        </div>
      )}

      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5">
        <a href="#home" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gold text-lg font-black text-gold">
            AR
          </span>
          <span className="text-xl font-black tracking-tight text-white">
            Agent<span className="text-gold">Ritual</span>
          </span>
        </a>
        <nav className="flex flex-wrap gap-1 text-sm">
          {PAGES.filter((p) => p.nav).map((p) => (
            <a
              key={p.hash}
              href={`#${p.hash}`}
              className={`rounded-md px-3 py-2 font-medium transition ${
                page === p.hash
                  ? "bg-gold text-black"
                  : "text-zinc-300 hover:bg-panel-2 hover:text-white"
              }`}
            >
              {p.label}
            </a>
          ))}
        </nav>
        <div
          className="flex items-center gap-1 rounded-md border border-line bg-panel p-1 text-sm"
          role="group"
          aria-label="Network mode"
        >
          {(["testnet", "mainnet"] as const).map((m) => {
            const available = Boolean(MODES[m].apiUrl);
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => changeMode(m)}
                disabled={!available}
                title={
                  !available ? "API belum dikonfigurasi" : undefined
                }
                className={`rounded px-3 py-1.5 font-semibold transition ${
                  active
                    ? "bg-gold text-black"
                    : "text-zinc-300 hover:bg-panel-2 hover:text-white"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {m === "testnet" ? "Testnet" : "Mainnet"}
                {!available ? " (API belum dikonfigurasi)" : ""}
              </button>
            );
          })}
        </div>
      </header>

      {/* key={mode} remounts the page on mode change: no stale tracker,
          eligibility, submission, voucher, or admin-token state survives
          a switch, so mode A's data can never render as mode B's. */}
      <main key={mode} className="mx-auto max-w-6xl px-4 pb-16">
        {page === "home" && <HomePage />}
        {page === "campaign" && <CampaignPage />}
        {page === "collection" && <CollectionPage />}
        {page === "tracker" && <TrackerPage />}
        {page === "opensource" && <OpenSourcePage />}
        {page === "admin" && <AdminPage />}
      </main>

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
        <p>
          Mode:{" "}
          <span className="font-semibold text-gold">
            {mode === "testnet" ? "Testnet" : "Mainnet"}
          </span>{" "}
          — {MODES[mode].chainName} (chain {MODES[mode].chainId}) · Contract{" "}
          <a
            className="text-gold underline"
            href={`${MODES[mode].explorerBase}/address/${MODES[mode].contractAddress}`}
            target="_blank"
            rel="noreferrer"
          >
            {MODES[mode].contractAddress}
          </a>
        </p>
        <p className="mt-2">
          <a
            className="text-gold underline"
            href="https://github.com/Vanialla22/agentritual"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          {" · "}
          <a
            className="text-gold underline"
            href="https://www.binance.com/en/square/profile/vanilla22"
            target="_blank"
            rel="noreferrer"
          >
            Binance Square — Vanilla22
          </a>
          {" · "}
          <a
            className="text-gold underline"
            href="https://x.com/vaniabona1"
            target="_blank"
            rel="noreferrer"
          >
            X — @vaniabona1
          </a>
        </p>
        <p className="mt-2">
          AgentRitual — Agent-Native Social Quest &amp; NFT Mint Platform.
          Built for the Binance Agent ID Hackathon.
        </p>
        <p className="mt-1">
          This site never asks for a wallet connection, QR pairing, seed
          phrase, private key, or API secret. On-chain actions happen only
          through your own AI agent, with your explicit approval.
        </p>
      </footer>
    </div>
  );
}
