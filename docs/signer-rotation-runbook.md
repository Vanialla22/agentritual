# Voucher signer rotation runbook (audit M-3)

The voucher signer is a single key (audit finding M-3: the sole mint
authority, bounded by the 1,000 cap, one-per-wallet, and the Agent ID
gate). If it is ever compromised — or as routine hygiene — rotate it
with these steps. Vouchers signed by the old key stop working the
moment rotation lands on-chain, by design: the contract only trusts
`authorizedSigner`.

## 1. Incident response (if compromise is suspected)

1. **Pause minting first** (owner only, from the owner key):
   ```bash
   cast send <NFT_CONTRACT> "pause()" \
     --private-key "$OWNER_KEY" --rpc-url <BSC_RPC_URL>
   ```
   Verify: `cast call <NFT_CONTRACT> "paused()"` returns `true`.
   Pausing stops `mint()` but changes no supply, ownership, or minted
   token. Existing vouchers cannot be used while paused.
2. **Check for abuse** with the mint audit (admin token required):
   ```bash
   curl -H "Authorization: Bearer <ADMIN_TOKEN>" <API>/api/admin/mint-audit
   ```
   Any entry in `unmatched` is a mint with no voucher on record —
   investigate it before unpausing. Check `windowTruncated` first: if
   it is `true`, the scan covered only the trailing 5,000 blocks
   (`NFT_DEPLOY_BLOCK` unset) and a clean-looking answer is NOT a full
   audit — set the deploy block and re-run.
3. **Rotate** (step 2 below), then **unpause** only after the new
   signer is verified on-chain and the backend env is updated.

## 2. Rotate the signer

Prerequisites: a NEW signer keypair (generate offline, e.g.
`cast wallet new`), the owner key, and the NFT contract address.
The new signer address must be different from the old one.

```bash
# 1. Rotate on-chain (owner only)
cast send <NFT_CONTRACT> "setAuthorizedSigner(address)" <NEW_SIGNER_ADDRESS> \
  --private-key "$OWNER_KEY" --rpc-url <BSC_RPC_URL>

# 2. Verify on-chain
cast call <NFT_CONTRACT> "authorizedSigner()" --rpc-url <BSC_RPC_URL>
# → must print <NEW_SIGNER_ADDRESS>

# 3. Update the backend env (the API reads it at startup)
ADMIN_SIGNER_PRIVATE_KEY=<new signer private key>
# Restart the API. The API signs new vouchers with the new key;
# vouchers signed by the old key now recover to the old address and
# the contract rejects them (InvalidSigner) — no separate revocation
# step exists or is needed.
```

## 3. After rotation

- Old vouchers are invalidated automatically (the contract trusts
  only `authorizedSigner`). Approved submissions whose vouchers were
  signed by the old key need a fresh approval to get a new voucher.
- Voucher deadlines are capped at 1 hour (enforced in `signVoucher`),
  so at most one hour of vouchers can ever be live at once.
- Monitoring: watch `Mint` events against the vouchers table
  (`GET /api/admin/mint-audit`). A mint with no matching voucher is
  the earliest sign of signer abuse — alert on it.
- Keep the old signer key revoked/destroyed; never reuse it.

## 4. Testnet reference

- Testnet NFT: `0xca998896041A761E315125cf42E8dBE8D3cE087C` (chain 97)
- Testnet signer (test-only, never mainnet): key in
  `~/.config/agentritual/testnet-signer.key`
- Testnet owner/deployer: `0x07dC8Cdc8AaDF988cB1D54EC9D25a9F27c5527b2`
  (key in `~/.config/agentritual/testnet-deployer.key`, testnet-only)
