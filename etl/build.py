"""Build the /data JSON files described in docs/DATA_CONTRACT.md.

Inputs:  etl/raw/*.csv (from pull.py), etl/raw/manifest.json, etl/mapping.csv
Outputs: data/meta.json
         data/fy{YYYY}/tree.json, flows.json, flows_enacted.json
         data/diff/fy{A}_fy{B}.json for every pair of years A < B
         METHODOLOGY.md totals table (between the totals markers)

Usage:
    python etl/build.py [--years 2024 2025 2026 2027]

The build is deterministic for a given set of raw files: it reads only local
files, sorts every list, and rounds leaves before summing parents so that
every parent equals the sum of its children exactly.
"""

from __future__ import annotations

import argparse
import itertools
import json
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

import names
import revenue_groups
from config import (DATA_DIR, DEFAULT_YEARS, MAPPING_CSV, METHODOLOGY_MD, RAW_DIR, REVENUE, SPENDING,
                    raw_path)

MONEY = ("enacted", "gaa", "actual")
SOURCE_COLS = {
    "enacted": "total_enacted_budget_appropriation",
    "gaa": "original_enacted_budget",
    "actual": "total_expenses",
}
TOP_FLOW_PROGRAMS = 40
CONSERVATION_SECRETARIATS = frozenset({"EEA"})
CONSERVATION_DEPARTMENTS = frozenset({"DCR", "FWE"})  # codes as they appear in kv7m-35wn
TOTALS_START = "<!-- totals:start -->"
TOTALS_END = "<!-- totals:end -->"


# --------------------------------------------------------------------------- loading


def load_spending(years: list[int]) -> pd.DataFrame:
    """Load raw spending CSVs for the given years into one typed frame."""
    frames = []
    for year in years:
        path = raw_path(SPENDING.key, year)
        if not path.exists():
            raise FileNotFoundError(f"{path} missing; run `make pull` first")
        df = pd.read_csv(path, dtype=str, keep_default_na=False)
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    df["year"] = pd.to_numeric(df["fiscal_year"]).astype(int)
    for key, col in SOURCE_COLS.items():
        df[key] = pd.to_numeric(df[col].replace("", "0"), errors="coerce").fillna(0.0)
    df["account"] = df["appropriation_account_number"].str.strip().str.zfill(8)
    df["department_code"] = df["department_code"].str.strip()
    return df


def load_revenue(years: list[int]) -> pd.DataFrame:
    """Load raw revenue CSVs (already filtered to Budgeted Funds) for the given years."""
    frames = []
    for year in years:
        path = raw_path(REVENUE.key, year)
        if not path.exists():
            raise FileNotFoundError(f"{path} missing; run `make pull` first")
        frames.append(pd.read_csv(path, dtype=str, keep_default_na=False))
    df = pd.concat(frames, ignore_index=True)
    df["year"] = pd.to_numeric(df["fiscal_year"]).astype(int)
    df["revenue_collected"] = pd.to_numeric(df["revenue_collected"].replace("", "0"), errors="coerce").fillna(0.0)
    return df


def load_mapping(path: Path = MAPPING_CSV) -> pd.DataFrame:
    """Load etl/mapping.csv keyed by 8-digit account number."""
    m = pd.read_csv(path, dtype=str, keep_default_na=False)
    m["line_item"] = m["line_item"].str.strip().str.zfill(8)
    dupes = m["line_item"][m["line_item"].duplicated()]
    if not dupes.empty:
        raise ValueError(f"duplicate line_item in mapping.csv: {sorted(dupes)}")
    return m.set_index("line_item")


def load_manifest() -> dict[str, Any]:
    """Read etl/raw/manifest.json written by pull.py."""
    path = RAW_DIR / "manifest.json"
    if not path.exists():
        raise FileNotFoundError(f"{path} missing; run `make pull` first")
    return json.loads(path.read_text())


# --------------------------------------------------------------------------- structure


@dataclass(frozen=True)
class Directory:
    """Lookup tables for secretariats and departments seen in the data."""

    dept_sec: dict[str, str]  # department_code -> secretariat key
    dept_raw: dict[str, str]  # department_code -> raw department name (latest year)
    sec_raw: dict[str, str]  # secretariat key -> raw name (latest year)


def build_directory(spend: pd.DataFrame) -> Directory:
    """Resolve each department code to one secretariat and pick display names.

    Uses the latest fiscal year in which each code appears.
    """
    latest = spend.sort_values("year").drop_duplicates("department_code", keep="last")
    dept_sec: dict[str, str] = {}
    dept_raw: dict[str, str] = {}
    sec_raw: dict[str, str] = {}
    for row in latest.itertuples(index=False):
        key, _ = names.secretariat(row.cabinet_secretariat_name)
        dept_sec[row.department_code] = key
        dept_raw[row.department_code] = row.department_name
        sec_raw[key] = row.cabinet_secretariat_name
    return Directory(dept_sec, dept_raw, sec_raw)


def assign_homes(spend: pd.DataFrame, mapping: pd.DataFrame, directory: Directory) -> pd.DataFrame:
    """Give every appropriation account one home department.

    CTHRU splits some accounts across departments (e.g. Chapter 70 is
    appropriated to DESE but paid out by DOR). We roll every row of an
    account up to one home so a program appears once. The home is the
    mapping.csv department when the account is mapped; otherwise the
    department holding the most enacted dollars across all loaded years
    (ties broken by actual spending, then by code).
    """
    by = spend.groupby(["account", "department_code"])[["enacted", "actual"]].sum().reset_index()
    by = by.sort_values(["account", "enacted", "actual", "department_code"],
                        ascending=[True, False, False, True])
    homes = by.drop_duplicates("account").set_index("account")[["department_code"]]
    homes = homes.rename(columns={"department_code": "dept"})
    mapped = mapping.index.intersection(homes.index)
    homes.loc[mapped, "dept"] = mapping.loc[mapped, "department"]
    homes["sec"] = [directory.dept_sec.get(d, "UNK") for d in homes["dept"]]
    homes.loc[mapped, "sec"] = mapping.loc[mapped, "secretariat"]
    homes["mapped"] = homes.index.isin(mapping.index)
    return homes


def validate_mapping(mapping: pd.DataFrame, directory: Directory) -> list[str]:
    """Return warnings for mapping rows whose department/secretariat don't match the data."""
    warnings = []
    for acct, row in mapping.iterrows():
        dept, sec = row["department"], row["secretariat"]
        if dept not in directory.dept_sec:
            warnings.append(f"mapping {acct}: department {dept!r} not in data")
        elif directory.dept_sec[dept] != sec:
            warnings.append(f"mapping {acct}: department {dept} belongs to {directory.dept_sec[dept]}, not {sec}")
        if not row["program"].strip():
            warnings.append(f"mapping {acct}: empty program name")
    return warnings


# --------------------------------------------------------------------------- tree


def is_conservation(sec: str, dept: str | None = None) -> bool:
    """Conservation overlay rule: whole EEA secretariat, plus DCR and Fish & Game wherever they sit."""
    return sec in CONSERVATION_SECRETARIATS or (dept is not None and dept in CONSERVATION_DEPARTMENTS)


def _money(values: dict[str, float]) -> dict[str, int]:
    """Round a money dict to whole dollars."""
    return {k: int(round(values[k])) for k in MONEY}


def _sum_children(node: dict[str, Any]) -> None:
    """Set a parent's money fields to the exact sum of its (already rounded) children."""
    for k in MONEY:
        node[k] = sum(child[k] for child in node["children"])


def _sort_key(node: dict[str, Any]) -> tuple[float, str]:
    """Sort by actual desc, then enacted desc, then id for determinism."""
    return (-node["actual"], -node["enacted"], node["id"])


def build_tree(year: int, spend: pd.DataFrame, homes: pd.DataFrame, mapping: pd.DataFrame,
               directory: Directory) -> dict[str, Any]:
    """Build the Secretariat > Department > Program hierarchy for one fiscal year."""
    rows = spend[spend["year"] == year]
    acct = rows.groupby("account")[list(MONEY)].sum()
    raw_name = rows.drop_duplicates("account").set_index("account")["appropriation_account_name"]
    acct = acct.join(homes, how="left")
    acct = acct[(acct[list(MONEY)].abs() > 0.5).any(axis=1)]  # drop all-zero accounts

    secs: dict[str, dict[str, Any]] = {}
    for (sec, dept), group in acct.groupby(["sec", "dept"], sort=True):
        sec_name = names.secretariat(directory.sec_raw.get(sec, sec))[1]
        dept_name = names.department(dept, directory.dept_raw.get(dept))
        cons = is_conservation(sec, dept)
        sec_node = secs.setdefault(sec, {
            "id": f"sec:{sec}", "name": sec_name, "raw": directory.sec_raw.get(sec, sec), "code": sec,
            **({"conservation": True} if is_conservation(sec) else {}), "children": []})
        dept_node: dict[str, Any] = {
            "id": f"dept:{sec}/{dept}", "name": dept_name, "raw": directory.dept_raw.get(dept, dept),
            "code": dept, **({"conservation": True} if cons else {}), "children": []}
        mapped = group[group["mapped"]]
        for account, vals in mapped.iterrows():
            dept_node["children"].append({
                "id": f"prog:{account}", "name": mapping.at[account, "program"],
                "raw": str(raw_name.get(account, "")).strip(), "code": account,
                **_money(vals), **({"conservation": True} if cons else {})})
        other = group[~group["mapped"]]
        if not other.empty:
            dept_node["children"].append({
                "id": f"prog:other:{sec}/{dept}", "name": f"Other {dept_name}",
                **_money(other[list(MONEY)].sum()), "accounts": int(len(other)),
                **({"conservation": True} if cons else {}), "other": True})
        dept_node["children"].sort(key=_sort_key)
        _sum_children(dept_node)
        sec_node["children"].append(dept_node)

    children = []
    for sec_node in secs.values():
        sec_node["children"].sort(key=_sort_key)
        _sum_children(sec_node)
        children.append(sec_node)
    children.sort(key=_sort_key)
    root = {"id": "root", "name": "Massachusetts state budget", "children": children}
    _sum_children(root)
    return {k: root[k] for k in ("id", "name", *MONEY, "children")}


def iter_programs(tree: dict[str, Any]):
    """Yield (secretariat, department, program) node triples from a tree."""
    for sec in tree["children"]:
        for dept in sec["children"]:
            for prog in dept["children"]:
                yield sec, dept, prog


# --------------------------------------------------------------------------- flows


def allocate(total: int, weights: list[float]) -> list[int]:
    """Split an integer total proportionally to weights (largest remainder; sums exactly)."""
    wsum = sum(weights)
    if total == 0 or wsum <= 0:
        return [0] * len(weights)
    raw = [total * w / wsum for w in weights]
    floors = [int(x // 1) for x in raw]
    remainder = total - sum(floors)
    order = sorted(range(len(raw)), key=lambda i: (-(raw[i] - floors[i]), i))
    for i in order[:remainder]:
        floors[i] += 1
    return floors


def build_flows(tree: dict[str, Any], revenue: pd.Series, measure: str) -> dict[str, Any]:
    """Build Sankey nodes/links: revenue groups -> secretariats -> top programs.

    Revenue->secretariat links are proportional allocations: each
    secretariat's value is split across revenue groups by each group's share
    of total collections. They sum to the spending total (not the revenue
    total) so every secretariat node balances in == out.
    """
    secs = [s for s in tree["children"] if s[measure] > 0]
    spending_total = sum(s[measure] for s in secs)
    rev = {g: int(round(v)) for g, v in revenue.items()}
    revenue_total = sum(rev.values())
    rev_ids = [g for g, _ in revenue_groups.GROUPS if rev.get(g, 0) > 0]

    nodes: list[dict[str, Any]] = []
    links: list[dict[str, Any]] = []
    for g in rev_ids:
        nodes.append({"id": f"rev:{g}", "name": revenue_groups.LABELS[g], "kind": "revenue", "value": rev[g]})
    for s in secs:
        nodes.append({"id": s["id"], "name": s["name"], "kind": "secretariat", "value": s[measure],
                      **({"conservation": True} if s.get("conservation") else {})})
        shares = allocate(s[measure], [rev[g] for g in rev_ids])
        for g, v in zip(rev_ids, shares):
            if v > 0:
                links.append({"source": f"rev:{g}", "target": s["id"], "value": v, "proportional": True})

    candidates = [(s, p) for s, _, p in iter_programs({"children": secs}) if not p.get("other") and p[measure] > 0]
    candidates.sort(key=lambda sp: (-sp[1][measure], sp[1]["id"]))
    top = candidates[:TOP_FLOW_PROGRAMS]
    top_by_sec: dict[str, list[dict[str, Any]]] = {}
    for s, p in top:
        top_by_sec.setdefault(s["id"], []).append(p)

    program_nodes: list[dict[str, Any]] = []
    for s in secs:
        shown = top_by_sec.get(s["id"], [])
        for p in shown:
            program_nodes.append({"id": p["id"], "name": p["name"], "kind": "program", "value": p[measure],
                                  "parent": s["id"], **({"conservation": True} if p.get("conservation") else {})})
            links.append({"source": s["id"], "target": p["id"], "value": p[measure]})
        rest = s[measure] - sum(p[measure] for p in shown)
        if rest > 0:
            pid = f"prog:other:{s['code']}"
            program_nodes.append({"id": pid, "name": f"Other {s['name']}", "kind": "program", "value": rest,
                                  "parent": s["id"], "other": True,
                                  **({"conservation": True} if s.get("conservation") else {})})
            links.append({"source": s["id"], "target": pid, "value": rest})
        elif rest < 0:
            raise ValueError(f"{s['id']}: top programs exceed secretariat {measure}")
    program_nodes.sort(key=lambda n: (-n["value"], n["id"]))
    nodes.extend(program_nodes)
    return {"nodes": nodes, "links": links, "revenueTotal": revenue_total,
            "spendingTotal": spending_total, "measure": measure}


# --------------------------------------------------------------------------- diff


def program_index(tree: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Map program id -> {name, path, code, enacted, actual, conservation} for a tree."""
    out = {}
    for sec, dept, prog in iter_programs(tree):
        out[prog["id"]] = {"name": prog["name"], "path": f"{sec['name']} › {dept['name']}",
                           "secId": sec["id"], "deptId": dept["id"], "code": prog.get("code"), "enacted": prog["enacted"], "actual": prog["actual"],
                           "conservation": bool(prog.get("conservation"))}
    return out


def _pct(a: int, b: int) -> float | None:
    """Percent change from a to b, one decimal; None when a is zero."""
    return None if a == 0 else round((b - a) / abs(a) * 100, 1)


def build_diff(a: int, b: int, tree_a: dict[str, Any], tree_b: dict[str, Any]) -> dict[str, Any]:
    """Per-program enacted and actual change between two fiscal years."""
    ia, ib = program_index(tree_a), program_index(tree_b)
    rows = []
    for pid in sorted(set(ia) | set(ib)):
        pa, pb = ia.get(pid), ib.get(pid)
        ref = pb or pa
        ea, eb = (pa or {}).get("enacted", 0), (pb or {}).get("enacted", 0)
        aa, ab = (pa or {}).get("actual", 0), (pb or {}).get("actual", 0)
        row = {"id": pid, "name": ref["name"], "path": ref["path"],
               "secId": ref["secId"], "deptId": ref["deptId"]}
        if ref.get("code"):
            row["code"] = ref["code"]
        row.update({"enactedA": ea, "enactedB": eb, "actualA": aa, "actualB": ab,
                    "dEnacted": eb - ea, "dActual": ab - aa,
                    "pctEnacted": _pct(ea, eb), "pctActual": _pct(aa, ab)})
        if ref["conservation"]:
            row["conservation"] = True
        rows.append(row)
    rows.sort(key=lambda r: (-abs(r["dActual"]), r["id"]))
    return {"a": a, "b": b, "rows": rows}


# --------------------------------------------------------------------------- meta + docs


def through_date(manifest: dict[str, Any], key: str) -> str:
    """Date (YYYY-MM-DD) the dataset's rows were last updated, per the manifest."""
    ts = manifest["datasets"][key].get("rowsUpdatedAt") or manifest["datasets"][key]["checked"]
    return ts[:10]


def revenue_through(revenue: pd.DataFrame, year: int) -> str | None:
    """Last calendar month-end covered by revenue periods 1-12 for a fiscal year."""
    periods = pd.to_numeric(revenue.loc[revenue["year"] == year, "fiscal_period"], errors="coerce")
    periods = periods[(periods >= 1) & (periods <= 12)]
    if periods.empty:
        return None
    p = int(periods.max())  # period 1 = July
    month, yr = (p + 6, year - 1) if p <= 6 else (p - 6, year)
    end = (pd.Timestamp(yr, month, 1) + pd.offsets.MonthEnd(0)).date()
    return end.isoformat()


def pulled_date(manifest: dict[str, Any], key: str, years: list[int]) -> str:
    """Latest pull date among the raw files of one dataset."""
    stamps = [f["pulled"] for f in manifest["files"].values()
              if f["dataset"] == manifest["datasets"][key]["id"] and f["fiscal_year"] in years]
    return max(stamps)[:10] if stamps else manifest["datasets"][key]["checked"][:10]


def fmt_b(value: float) -> str:
    """Format dollars as $X.XXB for the METHODOLOGY table."""
    return f"${value / 1e9:,.2f}B"


def totals_table(meta: dict[str, Any]) -> str:
    """Markdown table of per-year totals for METHODOLOGY.md."""
    lines = ["| Fiscal year | Budgeted (GAA + supplementals) | Original GAA | Spent | Budgeted-fund revenue collected | Programs named / accounts in Other |",
             "|---|---:|---:|---:|---:|---:|"]
    for y in meta["years"]:
        t = meta["totals"][str(y)]
        c = meta["coverage"][str(y)]
        label = f"FY{y}"
        if str(y) in meta["partial"]:
            p = meta["partial"][str(y)]
            label += f" ({p['label']}: spending through {p['through']}"
            if p.get("revenueThrough"):
                label += f", revenue through {p['revenueThrough']}"
            label += ")"
        lines.append(f"| {label} | {fmt_b(t['enacted'])} | {fmt_b(t['gaa'])} | {fmt_b(t['actual'])} | "
                     f"{fmt_b(t['revenue'])} | {c['mappedAccounts']} / {c['otherAccounts']} |")
    lines.append("")
    lines.append(f"_Generated by `etl/build.py` on {meta['generated'][:10]}. "
                 "\"Programs named\" counts appropriation accounts with a plain-English name in "
                 "`etl/mapping.csv`; the rest are summed into \"Other\" buckets._")
    return "\n".join(lines)


def update_methodology(table: str, path: Path = METHODOLOGY_MD) -> bool:
    """Replace the totals block in METHODOLOGY.md. Returns False if markers are missing."""
    if not path.exists():
        return False
    text = path.read_text()
    pattern = re.compile(re.escape(TOTALS_START) + r".*?" + re.escape(TOTALS_END), re.S)
    if not pattern.search(text):
        return False
    new = pattern.sub(lambda _: f"{TOTALS_START}\n{table}\n{TOTALS_END}", text)
    if new != text:
        path.write_text(new)
    return True


def write_json(path: Path, obj: Any) -> int:
    """Write compact JSON (one item per line for lists of dicts is not needed); return bytes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    path.write_text(text + "\n")
    return len(text) + 1


# --------------------------------------------------------------------------- main


def build(years: list[int]) -> dict[str, Any]:
    """Run the full build for the given fiscal years and return meta.json contents."""
    manifest = load_manifest()
    spend = load_spending(years)
    revenue = load_revenue(years)
    mapping = load_mapping()
    directory = build_directory(spend)

    unknown = names.unknown_secretariats(spend["cabinet_secretariat_name"].unique().tolist())
    for n in unknown:
        print(f"warning: no human name for secretariat {n!r}; using fallback", file=sys.stderr)
    for w in validate_mapping(mapping, directory):
        print(f"warning: {w}", file=sys.stderr)

    homes = assign_homes(spend, mapping, directory)
    spend_through = through_date(manifest, SPENDING.key)
    today = date.fromisoformat(spend_through)

    trees: dict[int, dict[str, Any]] = {}
    totals: dict[str, dict[str, int]] = {}
    coverage: dict[str, dict[str, Any]] = {}
    partial: dict[str, dict[str, str]] = {}
    sizes: dict[str, int] = {}
    for year in years:
        tree = build_tree(year, spend, homes, mapping, directory)
        trees[year] = tree
        rev = revenue_groups.group_revenue(revenue[revenue["year"] == year])
        totals[str(year)] = {"enacted": tree["enacted"], "gaa": tree["gaa"], "actual": tree["actual"],
                             "revenue": int(round(rev.sum()))}
        progs = [p for _, _, p in iter_programs(tree)]
        named = [p for p in progs if not p.get("other")]
        others = [p for p in progs if p.get("other")]
        coverage[str(year)] = {
            "mappedAccounts": len(named),
            "otherAccounts": sum(p["accounts"] for p in others),
            "otherBuckets": len(others),
            "mappedShareActual": round(sum(p["actual"] for p in named) / tree["actual"], 4) if tree["actual"] else 0,
            "mappedShareEnacted": round(sum(p["enacted"] for p in named) / tree["enacted"], 4) if tree["enacted"] else 0,
        }
        if date(year, 6, 30) >= today:
            partial[str(year)] = {"through": spend_through, "label": "in progress"}
            rt = revenue_through(revenue, year)
            if rt:
                partial[str(year)]["revenueThrough"] = rt
        out = DATA_DIR / f"fy{year}"
        sizes[f"fy{year}/tree.json"] = write_json(out / "tree.json", tree)
        sizes[f"fy{year}/flows.json"] = write_json(out / "flows.json", build_flows(tree, rev, "actual"))
        sizes[f"fy{year}/flows_enacted.json"] = write_json(out / "flows_enacted.json",
                                                           build_flows(tree, rev, "enacted"))

    for a, b in itertools.combinations(years, 2):
        sizes[f"diff/fy{a}_fy{b}.json"] = write_json(DATA_DIR / "diff" / f"fy{a}_fy{b}.json",
                                                     build_diff(a, b, trees[a], trees[b]))

    meta = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "years": years,
        "partial": partial,
        "sources": {
            "spending": {"id": SPENDING.id, "name": manifest["datasets"][SPENDING.key]["name"],
                         "url": SPENDING.page_url, "api": f"{SPENDING.resource_url}.json",
                         "pulled": pulled_date(manifest, SPENDING.key, years),
                         "rowsUpdatedAt": manifest["datasets"][SPENDING.key].get("rowsUpdatedAt")},
            "revenue": {"id": REVENUE.id, "name": manifest["datasets"][REVENUE.key]["name"],
                        "url": REVENUE.page_url, "api": f"{REVENUE.resource_url}.json",
                        "pulled": pulled_date(manifest, REVENUE.key, years),
                        "rowsUpdatedAt": manifest["datasets"][REVENUE.key].get("rowsUpdatedAt"),
                        "filter": REVENUE.where},
        },
        "totals": totals,
        "coverage": coverage,
        "revenueGroups": [{"id": f"rev:{g}", "name": label} for g, label in revenue_groups.GROUPS],
    }
    sizes["meta.json"] = write_json(DATA_DIR / "meta.json", meta)
    if not update_methodology(totals_table(meta)):
        print("warning: METHODOLOGY.md totals markers not found; table not updated", file=sys.stderr)

    print(f"{'file':32} {'bytes':>9}")
    for name in sorted(sizes):
        print(f"{name:32} {sizes[name]:>9,}")
    print()
    print(f"{'year':6} {'named':>6} {'in Other':>9} {'named share of spent':>21}")
    for y in years:
        c = coverage[str(y)]
        print(f"{y:<6} {c['mappedAccounts']:>6} {c['otherAccounts']:>9} {c['mappedShareActual']:>20.1%}")
    return meta


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", type=int, nargs="+", default=list(DEFAULT_YEARS))
    args = ap.parse_args(argv)
    build(sorted(set(args.years)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
