"""Pull raw CTHRU spending and revenue rows into etl/raw/.

Usage:
    python etl/pull.py                 # FY2024-2027, skip files already cached
    python etl/pull.py --years 2027    # one year
    python etl/pull.py --force         # re-download even if cached

Writes etl/raw/{spending,revenue,capital}_fy{YYYY}.csv and records each pull in
etl/raw/manifest.json (timestamp, row count, dataset rowsUpdatedAt).
Set SOCRATA_APP_TOKEN in the environment to send an app token (optional).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests

from config import DATASETS, DEFAULT_YEARS, FIELDS, RAW_DIR, Dataset, column_name, raw_path

PAGE_SIZE = 50_000
MANIFEST = RAW_DIR / "manifest.json"


def make_session() -> requests.Session:
    """Build an HTTP session, adding X-App-Token when SOCRATA_APP_TOKEN is set."""
    session = requests.Session()
    session.headers["User-Agent"] = "open-ledger-ma-etl/1.0 (+https://openledgerma.org)"
    token = os.environ.get("SOCRATA_APP_TOKEN", "").strip()
    if token:
        session.headers["X-App-Token"] = token
    return session


def get_json(session: requests.Session, url: str, params: dict[str, str] | None = None,
             retries: int = 4) -> Any:
    """GET a URL and decode JSON, retrying transient failures with backoff."""
    for attempt in range(retries):
        try:
            resp = session.get(url, params=params, timeout=120)
            if resp.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(f"HTTP {resp.status_code}", response=resp)
            resp.raise_for_status()
            return resp.json()
        except (requests.ConnectionError, requests.Timeout, requests.HTTPError) as exc:
            if attempt == retries - 1:
                raise
            wait = 2 ** attempt
            print(f"  retry in {wait}s after: {exc}", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("unreachable")


def fetch_year(session: requests.Session, ds: Dataset, year: int) -> pd.DataFrame:
    """Download every row of one dataset for one fiscal year via SODA paging."""
    where = ds.year_where.format(year=year)
    if ds.where:
        where = f"{where} AND {ds.where}"
    fields = FIELDS[ds.key]
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        params = {
            "$select": ",".join(fields),
            "$where": where,
            "$order": ds.order,
            "$limit": str(PAGE_SIZE),
            "$offset": str(offset),
        }
        if ds.group:
            params["$group"] = ds.group
        page = get_json(session, f"{ds.resource_url}.json", params)
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    df = pd.DataFrame(rows)
    cols = [column_name(f) for f in fields]
    for col in cols:  # Socrata omits null keys; keep a stable column set
        if col not in df.columns:
            df[col] = None
    return df[cols]


def fetch_metadata(session: requests.Session, ds: Dataset) -> dict[str, Any]:
    """Return the useful bits of a dataset's view metadata."""
    meta = get_json(session, ds.metadata_url)

    def iso(ts: int | None) -> str | None:
        return datetime.fromtimestamp(ts, timezone.utc).isoformat() if ts else None

    return {
        "name": meta.get("name"),
        "rowsUpdatedAt": iso(meta.get("rowsUpdatedAt")),
        "viewLastModified": iso(meta.get("viewLastModified")),
    }


def load_manifest(path: Path = MANIFEST) -> dict[str, Any]:
    """Read the pull manifest, or return an empty one."""
    if path.exists():
        return json.loads(path.read_text())
    return {"datasets": {}, "files": {}}


def save_manifest(manifest: dict[str, Any], path: Path = MANIFEST) -> None:
    """Write the pull manifest atomically."""
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    tmp.replace(path)


def pull(years: list[int], force: bool) -> None:
    """Pull every configured dataset for the requested years."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    session = make_session()
    manifest = load_manifest()
    for ds in DATASETS:
        meta = fetch_metadata(session, ds)
        meta.update({"id": ds.id, "resource": ds.resource_url, "page": ds.page_url,
                     "filter": ds.where or None,
                     "checked": datetime.now(timezone.utc).isoformat(timespec="seconds")})
        todo = [y for y in years if force or not raw_path(ds.key, y).exists()]
        # Keep the recorded metadata when nothing is re-pulled: rowsUpdatedAt dates the
        # cached rows ("spending through"), so refreshing it alone would mislabel them.
        if todo or ds.key not in manifest["datasets"]:
            manifest["datasets"][ds.key] = meta
        for year in years:
            out = raw_path(ds.key, year)
            if year not in todo:
                print(f"skip {out.name} (cached; --force to refresh)")
                continue
            print(f"pull {ds.id} FY{year} ...", end=" ", flush=True)
            df = fetch_year(session, ds, year)
            tmp = out.with_suffix(".tmp")
            df.to_csv(tmp, index=False)
            tmp.replace(out)
            print(f"{len(df):,} rows")
            manifest["files"][out.name] = {
                "dataset": ds.id,
                "fiscal_year": year,
                "rows": int(len(df)),
                "pulled": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "rowsUpdatedAt": meta["rowsUpdatedAt"],
            }
            save_manifest(manifest)
    save_manifest(manifest)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", type=int, nargs="+", default=list(DEFAULT_YEARS),
                    help="fiscal years to pull (default: 2024 2025 2026 2027)")
    ap.add_argument("--force", action="store_true", help="re-download cached files")
    args = ap.parse_args(argv)
    pull(sorted(set(args.years)), args.force)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
