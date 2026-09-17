# Derived Aggregation Cache (Phase 2-C)

`market.db` remains the immutable source of truth. The cache is a local,
rebuildable SQLite file used only to avoid repeating Phase 2-B aggregation.

## Location

`tradingapp/data/cache/aggregate_cache.db`

Override with `AGGREGATE_CACHE_PATH`. The file is gitignored.

## Versions

- `CACHE_SCHEMA_VERSION` = `1`
- `AGGREGATION_POLICY_VERSION` = `utc-calendar-v1`

Master fingerprint (no full-file SHA-256):

- file size
- mtime (integer seconds)
- 1m candle count
- first `open_time`
- last `open_time`

A cache is `READY` only after a complete build and integrity validation.
`MISSING`, `INVALID`, `STALE`, and `BUILDING` caches are not queried. The API
falls back to on-demand aggregation.

## CLI

From `tradingapp/backend`:

```text
python -m app.cache status
python -m app.cache build
python -m app.cache validate
python -m app.cache rebuild
python -m app.cache benchmark
```

Deleting the cache file is safe. `build` recreates it from Master 1m rows
using `reduce_bucket_rows` (the same core as live aggregation).

## Replay cutoff

Cached HTF candles are used only when the bucket has fully ended at or before
`cutoff`. The bucket that contains `cutoff` is aggregated on demand from 1m
rows with `open_time <= cutoff`.

## Primary loading overlay

- Delay: **200 ms**. Faster requests do not show the overlay (anti-flicker).
- Minimum visible time after it appears: **180 ms**.
