// Test normalizeSquareUrl() — run with:
//   npx tsx src/scripts/test-square-url.ts        (from apps/api)
// Exits non-zero on the first failure. No network, no database, no
// new dependencies — it only imports the function under test.
import assert from "node:assert/strict";
import { normalizeSquareUrl, SQUARE_URL_RE } from "../routes/submissions";

const CANON = "https://www.binance.com/square/post/380847377801319";
const APP_FULL =
  "https://app.binance.com/uni-qr/cpos/380847377801319?r=MQ0IE1NW&l=en&uco=gy_VIJHPuNFEazZMaV5GQg&uc=app_square_share_link&us=copylink";

let passed = 0;

function accepts(label: string, input: string, expected = CANON): void {
  const got = normalizeSquareUrl(input);
  assert.equal(got, expected, `${label}: expected ${expected}, got ${got}`);
  passed += 1;
  console.log(`  ok accept  ${label}`);
}

function rejects(label: string, input: string): void {
  const got = normalizeSquareUrl(input);
  assert.equal(got, null, `${label}: expected null, got ${got}`);
  passed += 1;
  console.log(`  ok reject  ${label}`);
}

// The old regex alone must NOT accept the app link — the normalizer is
// what makes it pass.
assert.equal(
  SQUARE_URL_RE.test(APP_FULL),
  false,
  "old regex must reject the raw app share link",
);
passed += 1;
console.log("  ok sanity  old regex rejects raw app link");

console.log("valid formats:");
accepts("canonical", CANON);
accepts("no www", "https://binance.com/square/post/380847377801319");
accepts(
  "trailing slash",
  "https://www.binance.com/square/post/380847377801319/",
);
accepts("locale en", "https://www.binance.com/en/square/post/380847377801319");
accepts("locale id", "https://www.binance.com/id/square/post/380847377801319");
accepts(
  "cpos id 19 digits (max)",
  "https://app.binance.com/uni-qr/cpos/1234567890123456789",
  "https://www.binance.com/square/post/1234567890123456789",
);
accepts(
  "web id 19 chars (max)",
  `https://www.binance.com/square/post/${"a".repeat(19)}`,
  `https://www.binance.com/square/post/${"a".repeat(19)}`,
);
accepts("app share (full, Vanilla's example)", APP_FULL);
accepts("app share (bare)", "https://app.binance.com/uni-qr/cpos/380847377801319");
accepts(
  "app share + fragment",
  "https://app.binance.com/uni-qr/cpos/380847377801319#top",
);
accepts(
  "canonical + dangerous query (dropped)",
  "https://www.binance.com/square/post/380847377801319?x=https://evil.com&next=//evil.com",
);
accepts(
  "canonical + fragment (dropped)",
  "https://www.binance.com/square/post/380847377801319#comments",
);
accepts(
  "whitespace padded",
  "  https://www.binance.com/square/post/380847377801319  ",
);
accepts(
  "standard port 443 (normalized away by URL parser)",
  "https://www.binance.com:443/square/post/380847377801319",
);

console.log("spoofed domains:");
rejects(
  "subdomain of evil",
  "https://www.binance.com.evil.com/square/post/380847377801319",
);
rejects(
  "lookalike dash",
  "https://binance-app.com/square/post/380847377801319",
);
rejects(
  "lookalike no dot",
  "https://evilbinance.com/square/post/380847377801319",
);
rejects(
  "userinfo + fake host",
  "https://www.binance.com@evil.com/square/post/380847377801319",
);
rejects(
  "userinfo on real host",
  "https://user:pass@www.binance.com/square/post/380847377801319",
);
rejects(
  "subdomain not in allowlist",
  "https://api.binance.com/square/post/380847377801319",
);

console.log("scheme / port:");
rejects("http", "http://www.binance.com/square/post/380847377801319");
rejects(
  "weird port 8443",
  "https://www.binance.com:8443/square/post/380847377801319",
);
rejects("port 80", "https://www.binance.com:80/square/post/380847377801319");

console.log("empty / bad id:");
rejects("empty id", "https://www.binance.com/square/post/");
rejects("empty id double slash", "https://www.binance.com/square/post//");
rejects("empty cpos id", "https://app.binance.com/uni-qr/cpos/");
rejects("cpos non-numeric", "https://app.binance.com/uni-qr/cpos/123abc");
rejects("id with space", "https://www.binance.com/square/post/12 3");
rejects(
  "cpos id 20 digits (too long)",
  "https://app.binance.com/uni-qr/cpos/12345678901234567890",
);
rejects(
  "web id 20 chars (too long)",
  `https://www.binance.com/square/post/${"a".repeat(20)}`,
);

console.log("extra structure:");
rejects(
  "extra path segment",
  "https://www.binance.com/square/post/380847377801319/extra",
);
rejects(
  "wrong path",
  "https://www.binance.com/feed/post/380847377801319",
);
rejects(
  "app wrong path",
  "https://app.binance.com/uni-qr/other/380847377801319",
);
rejects(
  "app path on web host",
  "https://www.binance.com/uni-qr/cpos/380847377801319",
);
rejects(
  "web path on app host",
  "https://app.binance.com/square/post/380847377801319",
);
rejects(
  "locale too long",
  "https://www.binance.com/eng/square/post/380847377801319",
);
rejects(
  "locale fr (not in allowlist)",
  "https://www.binance.com/fr/square/post/380847377801319",
);
rejects(
  "locale tr (not in allowlist)",
  "https://www.binance.com/tr/square/post/380847377801319",
);
rejects(
  "double slash in path",
  "https://www.binance.com//square//post//380847377801319",
);
rejects(
  "double trailing slash",
  "https://www.binance.com/square/post/380847377801319//",
);

console.log("encoding / traversal tricks:");
rejects(
  "encoded slash in id",
  "https://www.binance.com/square/post/123%2F456",
);
rejects(
  "encoded traversal",
  "https://www.binance.com/square/post/..%2F123",
);
rejects(
  "dot segment",
  "https://www.binance.com/square/post/../post/380847377801319",
);
rejects(
  "backslash separators",
  "https://www.binance.com\\square\\post\\380847377801319",
);
rejects(
  "percent-encoded id",
  "https://www.binance.com/square/post/%31%32%33",
);

console.log("malformed:");
rejects("not a url", "not a url");
rejects("empty string", "");
rejects("bare path", "square/post/380847377801319");
rejects("scheme only", "https://");
rejects("newline in id", "https://www.binance.com/square/post/12\n3");

console.log(`\n${passed} checks passed.`);
