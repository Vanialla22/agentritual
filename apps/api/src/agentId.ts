import { ethers } from "ethers";
import { config } from "./config";

const REGISTRY_ABI = ["function balanceOf(address) view returns (uint256)"];

/**
 * Read-only Agent ID check (Phase 3): how many Agent IDs does `address`
 * hold on the configured registry? Mainnet registry is the official
 * 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F; testnet uses the mock
 * registry from the Phase 2 deployment (AGENT_ID_REGISTRY_ADDRESS).
 *
 * Fail-closed: throws when the registry is not configured or the RPC
 * call fails. Callers translate that into HTTP 503 — never silently
 * skip the check.
 */
export async function getAgentIdBalance(address: string): Promise<bigint> {
  if (!config.agentIdRegistryAddress) {
    throw new Error("Agent ID registry not configured");
  }
  const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
  const registry = new ethers.Contract(
    config.agentIdRegistryAddress,
    REGISTRY_ABI,
    provider,
  );
  return (await registry.balanceOf(address)) as bigint;
}
