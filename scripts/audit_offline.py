"""Scan frontend runtime files for remote internet dependencies."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

FORBIDDEN = [
    re.compile(r"fonts\.googleapis", re.I),
    re.compile(r"fonts\.gstatic", re.I),
    re.compile(r"api\.binance", re.I),
    re.compile(r"data\.binance", re.I),
    re.compile(r"stream\.binance", re.I),
    re.compile(r"cdn\.jsdelivr", re.I),
    re.compile(r"unpkg\.com", re.I),
    re.compile(r"cdnjs\.cloudflare", re.I),
]
HTTP_URL = re.compile(r"https?://[^\s\"'`>]+", re.I)
PROTOCOL_RELATIVE = re.compile(r"[\'\"`(=]//(?!/)[^\s\"'`>]+")
LOCAL_HTTP = re.compile(r"^https?://(?:127\.0\.0\.1|localhost)(?::\d+)?(?:/|$)", re.I)
XMLNS = re.compile(r"^https?://www\.w3\.org/\d{4}/(?:svg|xlink)$", re.I)
VENDOR_DIST_URL = re.compile(
    r"^https?://(?:www\.)?(?:apache\.org|w3\.org|fileformat\.info|"
    r"bugs\.chromium\.org|developer\.apple\.com|www\.tradingview\.com|"
    r"reactjs\.org|react\.dev)\b",
    re.I,
)
TEXT_SUFFIXES = {".html", ".js", ".jsx", ".ts", ".tsx", ".css", ".json", ".svg", ".mjs", ".cjs"}


def iter_files(frontend: Path, relatives: tuple[str, ...]) -> list[Path]:
    files: list[Path] = []
    for relative in relatives:
        path = frontend / relative
        if path.is_file():
            files.append(path)
        elif path.is_dir():
            files.extend(child for child in path.rglob("*") if child.is_file())
    return files


def scan(frontend: Path, files: list[Path], *, allow_vendor_urls: bool) -> list[str]:
    violations: list[str] = []
    for path in files:
        if path.suffix.lower() not in TEXT_SUFFIXES and path.name != "index.html":
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        rel = path.relative_to(frontend.parent)
        for pattern in FORBIDDEN:
            if pattern.search(text):
                violations.append(f"{rel}: forbidden token {pattern.pattern}")
        if not allow_vendor_urls and re.search(r"tradingview", text, re.I):
            violations.append(f"{rel}: tradingview token in application source")
        for match in HTTP_URL.finditer(text):
            url = match.group(0)
            if LOCAL_HTTP.match(url) or XMLNS.match(url):
                continue
            if allow_vendor_urls and VENDOR_DIST_URL.match(url):
                continue
            violations.append(f"{rel}: remote URL {url}")
        for match in PROTOCOL_RELATIVE.finditer(text):
            violations.append(f"{rel}: protocol-relative URL {match.group(0)}")
    return violations


def audit(frontend: Path) -> list[str]:
    source_files = iter_files(frontend, ("src", "index.html", "public"))
    dist_files = iter_files(frontend, ("dist",))
    chart_source = frontend / "src" / "components" / "chart" / "TradingChart.tsx"
    violations: list[str] = []
    if not chart_source.exists() or "attributionLogo: false" not in chart_source.read_text(encoding="utf-8"):
        violations.append("chart source must disable layout.attributionLogo")
    violations.extend(scan(frontend, source_files, allow_vendor_urls=False))
    violations.extend(scan(frontend, dist_files, allow_vendor_urls=True))
    return violations


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline runtime asset audit")
    parser.add_argument(
        "--frontend",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "frontend",
    )
    args = parser.parse_args()
    if not args.frontend.exists():
        print(f"frontend not found: {args.frontend}", file=sys.stderr)
        return 2
    violations = audit(args.frontend)
    if violations:
        print("Offline audit failed:")
        for line in violations:
            print(f"  {line}")
        return 1
    print("Offline audit passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
