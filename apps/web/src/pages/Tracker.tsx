import { useEffect, useState } from "react";
import { Card, HonestNote, SectionTitle } from "../App";
import { fetchTracker, type TrackerData } from "../lib/api";

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: TrackerData }
  | { kind: "unavailable"; reason: string };

// Explorer base URL follows the tracker's own chain — every recent mint
// comes from that chain, because the API serves one configured contract
// (chain 97 = testnet, chain 56 = mainnet). Never assume mainnet.
function explorerTxUrl(chainId: number, txHash: string): string {
  const base =
    chainId === 97
      ? "https://testnet.bscscan.com/tx/"
      : "https://bscscan.com/tx/";
  return `${base}${txHash}`;
}

export function TrackerPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchTracker()
      .then((data) => {
        if (!cancelled) setState({ kind: "ready", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            kind: "unavailable",
            reason: err instanceof Error ? err.message : "Tracker unavailable.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-10 pt-8">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold">
          Live Mint Tracker
        </p>
        <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
          Minted on-chain
        </h1>
        <p className="mt-3 max-w-3xl text-muted">
          Counts and recent mints come from the NFT contract&apos;s state and
          events — never from an admin, and never from mock data.
        </p>
      </section>

      {state.kind === "loading" && (
        <Card>
          <p className="text-sm text-muted">Loading on-chain data…</p>
        </Card>
      )}

      {state.kind === "unavailable" && (
        <Card>
          <SectionTitle>Tracker temporarily unavailable</SectionTitle>
          <p className="text-sm text-zinc-200">
            The tracker cannot show minted numbers right now because the
            API is unreachable.
          </p>
          <p className="mt-2 rounded-md border border-line bg-panel-2 px-3 py-2 text-sm text-muted">
            {state.reason}
          </p>
          <p className="mt-3 text-sm text-muted">
            Once the API is reachable again, this page shows the real total
            minted, remaining supply, and the latest mints with transaction
            links.
          </p>
        </Card>
      )}

      {state.kind === "ready" && (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Minted</p>
              <p className="mt-1 text-3xl font-black text-gold">
                {state.data.totalSupply.toLocaleString("en-US")}
                <span className="text-lg text-muted"> / {state.data.maxSupply.toLocaleString("en-US")}</span>
              </p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Remaining</p>
              <p className="mt-1 text-3xl font-black text-white">
                {state.data.remaining.toLocaleString("en-US")}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Chain</p>
              <p className="mt-1 text-lg font-bold text-white">
                {state.data.chainName} ({state.data.chainId})
              </p>
              <p className="mt-1 break-all font-mono text-xs text-muted">
                {state.data.contractAddress}
              </p>
            </Card>
          </div>

          <Card>
            <SectionTitle>Recent mints</SectionTitle>
            {state.data.recentMints.length === 0 ? (
              <p className="text-sm text-muted">No mints recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {state.data.recentMints.map((m) => (
                  <li
                    key={`${m.txHash}-${m.tokenId}`}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0"
                  >
                    <span className="font-semibold text-white">#{m.tokenId}</span>
                    <span className="break-all font-mono text-xs text-muted">{m.minter}</span>
                    <a
                      className="font-mono text-xs text-gold underline"
                      href={explorerTxUrl(state.data.chainId, m.txHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {m.txHash.slice(0, 10)}…{m.txHash.slice(-8)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}

      <HonestNote>
        The tracker reads contract state and Mint events from the chain. An
        admin cannot change the minted count or the remaining supply.
      </HonestNote>
    </div>
  );
}
