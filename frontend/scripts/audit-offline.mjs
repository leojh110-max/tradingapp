/**
 * Fail the build/test if frontend runtime files pull remote internet resources.
 * localhost / 127.0.0.1 are allowed.
 *
 * Dist bundles may contain vendor license/comment URLs from lightweight-charts.
 * Those strings are not fetched at runtime. The TradingView attribution logo is
 * disabled in application source (layout.attributionLogo = false).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_TARGETS = ["src", "index.html", "public"];
const DIST_TARGETS = ["dist"];
const TEXT_EXT = new Set([
  ".html",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".json",
  ".svg",
  ".mjs",
  ".cjs",
]);

const FORBIDDEN = [
  /fonts\.googleapis/i,
  /fonts\.gstatic/i,
  /api\.binance/i,
  /data\.binance/i,
  /stream\.binance/i,
  /cdn\.jsdelivr/i,
  /unpkg\.com/i,
  /cdnjs\.cloudflare/i,
];

const HTTP_URL = /https?:\/\/[^\s"'`>]+/gi;
const PROTOCOL_RELATIVE = /(?:['"`(=])\/\/(?!\/)[^\s"'`>]+/g;
const LOCAL = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i;
const XMLNS = /^https?:\/\/www\.w3\.org\/\d{4}\/(?:svg|xlink)$/i;
const VENDOR_DIST_URL = /^https?:\/\/(?:www\.)?(?:apache\.org|w3\.org|fileformat\.info|bugs\.chromium\.org|developer\.apple\.com|www\.tradingview\.com|reactjs\.org|react\.dev)\b/i;

function walk(start) {
  const files = [];
  const stack = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    let stats;
    try {
      stats = statSync(current);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      for (const entry of readdirSync(current)) {
        if (entry === "node_modules") {
          continue;
        }
        stack.push(join(current, entry));
      }
    } else if (stats.isFile()) {
      files.push(current);
    }
  }
  return files;
}

function collect(targets) {
  const files = [];
  for (const target of targets) {
    const abs = join(ROOT, target);
    try {
      const stats = statSync(abs);
      if (stats.isDirectory()) {
        files.push(...walk(abs));
      } else if (stats.isFile()) {
        files.push(abs);
      }
    } catch {
      // Optional paths such as dist/ may not exist yet.
    }
  }
  return files;
}

function scan(files, { allowVendorUrls }) {
  const violations = [];
  for (const file of files) {
    if (!TEXT_EXT.has(extname(file).toLowerCase()) && !file.endsWith("index.html")) {
      continue;
    }
    const text = readFileSync(file, "utf8");
    const rel = relative(ROOT, file);
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) {
        violations.push(`${rel}: forbidden token ${pattern}`);
      }
    }
    if (!allowVendorUrls && /tradingview/i.test(text)) {
      violations.push(`${rel}: tradingview token in application source`);
    }
    for (const match of text.matchAll(HTTP_URL)) {
      const url = match[0];
      if (LOCAL.test(url) || XMLNS.test(url)) {
        continue;
      }
      if (allowVendorUrls && VENDOR_DIST_URL.test(url)) {
        continue;
      }
      violations.push(`${rel}: remote URL ${url}`);
    }
    for (const match of text.matchAll(PROTOCOL_RELATIVE)) {
      violations.push(`${rel}: protocol-relative URL ${match[0]}`);
    }
  }
  return violations;
}

const sourceFiles = collect(SOURCE_TARGETS);
if (sourceFiles.length === 0) {
  console.error("Offline audit failed: no frontend source files found.");
  process.exit(1);
}

const sourceText = sourceFiles
  .filter((file) => file.endsWith("TradingChart.tsx"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
if (!sourceText.includes("attributionLogo: false")) {
  console.error("Offline audit failed: chart source must disable layout.attributionLogo.");
  process.exit(1);
}

const violations = [
  ...scan(sourceFiles, { allowVendorUrls: false }),
  ...scan(collect(DIST_TARGETS), { allowVendorUrls: true }),
];

if (violations.length > 0) {
  console.error("Offline audit failed:");
  for (const line of violations) {
    console.error(`  ${line}`);
  }
  process.exit(1);
}

console.log(`Offline audit passed (${sourceFiles.length} source files scanned).`);
