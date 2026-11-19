import { useEffect, useState } from "react";
import { AdminPage } from "./pages/Admin";
import { CampaignPage } from "./pages/Campaign";
import { CollectionPage } from "./pages/Collection";
import { HomePage } from "./pages/Home";
import { OpenSourcePage } from "./pages/OpenSource";
import { TrackerPage } from "./pages/Tracker";

const PAGES = [
  { hash: "home", label: "Home" },
  { hash: "campaign", label: "Campaign 001" },
  { hash: "collection", label: "NFT Collection" },
  { hash: "tracker", label: "Live Mint Tracker" },
  { hash: "opensource", label: "Open Source" },
  { hash: "admin", label: "Admin" },
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

  useEffect(() => {
    const onChange = () => setPage(readHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return (
    <div className="min-h-screen bg-ink text-zinc-100">
      <div className="border-b border-line bg-panel px-4 py-2 text-center text-xs text-muted sm:text-sm">
        <span className="font-semibold text-gold">DEMO — TESTNET</span>
        {" — "}
        The NFT contract is deployed on BSC testnet (chain 97); mainnet
        (chain 56) is on HOLD — no public mint yet. Nothing on this page is
        a live transaction unless you approve one yourself.
      </div>

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
          {PAGES.map((p) => (
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
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        {page === "home" && <HomePage />}
        {page === "campaign" && <CampaignPage />}
        {page === "collection" && <CollectionPage />}
        {page === "tracker" && <TrackerPage />}
        {page === "opensource" && <OpenSourcePage />}
        {page === "admin" && <AdminPage />}
      </main>

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
        <p>
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
