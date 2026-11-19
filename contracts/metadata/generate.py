#!/usr/bin/env python3
"""Generate AgentRitual Genesis Seal token metadata (Campaign 001).

Deterministic, stdlib only. Produces one JSON file per token ID, named
by the token ID with NO file extension — the contract's tokenURI is
baseURI + tokenId, so a file named `42` must answer at
ipfs://<METADATA_CID>/42.

Shape matches the API route GET /metadata/:id
(apps/api/src/routes/metadata.ts): same keys — name, description,
image, external_url, attributes, note — and the same values for
Campaign 001. The one intentional difference: the API's hardcoded
`note` still says the artwork "ships with the contract (Phase 2)";
the pinned files carry the final note. Update the API note to match
before the mainnet launch so the two sources agree.

Pinning is TWO steps (see docs/metadata.md) because the image URI
contains the image file's own IPFS CID:
  1. Pin genesis-seal.png FIRST -> IMAGE_CID.
  2. Run this script with --image-uri ipfs://<IMAGE_CID>/genesis-seal.png,
     then pin the generated folder -> METADATA_CID.
     baseURI for the deploy is ipfs://<METADATA_CID>/.

Usage:
  python3 contracts/metadata/generate.py \
      --image-uri ipfs://<IMAGE_CID>/genesis-seal.png \
      --out-dir contracts/metadata/generated
  # first 10 tokens only:
  python3 contracts/metadata/generate.py --end 9 --out-dir contracts/metadata/generated

Determinism: output is json.dumps(..., sort_keys=True, indent=2) with a
trailing newline; re-running with the same --image-uri produces
byte-identical files (verify with sha256sum).
"""

import argparse
import hashlib
import json
import os
import sys

CAMPAIGN_ID = "001"
CAMPAIGN_LABEL = "001 — The Genesis Quest"
MAX_TOKEN_ID = 999  # Campaign 001 mints token IDs 0–999.

PLACEHOLDER_IMAGE_URI = "ipfs://<IMAGE_CID>/genesis-seal.png"

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PATH = os.path.join(HERE, "template.json")


def build_metadata(token_id: int, image_uri: str) -> dict:
    return {
        "attributes": [
            {"trait_type": "Campaign", "value": CAMPAIGN_LABEL},
            {"trait_type": "Collection", "value": "Genesis Seal"},
        ],
        "description": (
            "AgentRitual Genesis Seal — minted by completing Campaign 001 "
            "with a Binance Agent ID. Max supply 1,000, one per wallet."
        ),
        "external_url": "",
        "image": image_uri,
        "name": f"AgentRitual Genesis Seal #{token_id}",
        "note": (
            "Final Genesis Seal metadata, pinned to IPFS for the mainnet "
            "launch (Campaign 001)."
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate Genesis Seal metadata files (Campaign 001)."
    )
    parser.add_argument(
        "--image-uri",
        default=PLACEHOLDER_IMAGE_URI,
        help="IPFS URI of the seal artwork, e.g. "
        "ipfs://<IMAGE_CID>/genesis-seal.png (default: placeholder)",
    )
    parser.add_argument(
        "--start", type=int, default=0, help="First token ID (default 0)"
    )
    parser.add_argument(
        "--end", type=int, default=MAX_TOKEN_ID,
        help=f"Last token ID (default {MAX_TOKEN_ID})",
    )
    parser.add_argument(
        "--out-dir",
        default=os.path.join(HERE, "generated"),
        help="Output directory (default contracts/metadata/generated)",
    )
    parser.add_argument(
        "--template", default=TEMPLATE_PATH, help="Template JSON path"
    )
    args = parser.parse_args()

    if not (0 <= args.start <= args.end <= MAX_TOKEN_ID):
        print(
            f"error: range must be within 0–{MAX_TOKEN_ID} "
            f"(got {args.start}–{args.end})",
            file=sys.stderr,
        )
        return 1

    # The template is the source of truth for the shape: every key the
    # generator emits must exist in the template, and vice versa.
    with open(args.template, encoding="utf-8") as f:
        template = json.load(f)
    template_keys = set(template.keys())

    os.makedirs(args.out_dir, exist_ok=True)
    digest = hashlib.sha256()
    for token_id in range(args.start, args.end + 1):
        meta = build_metadata(token_id, args.image_uri)
        if set(meta.keys()) != template_keys:
            print(
                f"error: generated keys {sorted(meta.keys())} do not match "
                f"template keys {sorted(template_keys)}",
                file=sys.stderr,
            )
            return 1
        text = json.dumps(meta, sort_keys=True, indent=2, ensure_ascii=False) + "\n"
        path = os.path.join(args.out_dir, str(token_id))
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        digest.update(text.encode("utf-8"))

    count = args.end - args.start + 1
    print(f"wrote {count} file(s) ({args.start}–{args.end}) to {args.out_dir}")
    print(f"image: {args.image_uri}")
    print(f"sha256 of concatenated output: {digest.hexdigest()}")
    if args.image_uri == PLACEHOLDER_IMAGE_URI:
        print(
            "WARNING: placeholder image URI — pin the artwork first, then "
            "re-run with --image-uri ipfs://<IMAGE_CID>/genesis-seal.png "
            "before pinning the metadata folder."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
