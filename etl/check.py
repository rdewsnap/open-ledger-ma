"""Validate the generated /data files against docs/DATA_CONTRACT.md.

Checks, per fiscal year in data/meta.json:
  * sum of secretariat enacted/actual == meta totals, and == the raw CTHRU
    row sums in etl/raw (when present), within 0.5%
  * every node's children sum to the node; no child exceeds its parent
  * flows (actual and enacted): revenue->secretariat links sum to the
    spending total, revenue node values sum to revenueTotal, program links
    sum to spendingTotal, and each secretariat balances in == out
  * meta revenue == raw Budgeted Funds revenue, within 0.5%
  * every diff file exists and its rows add up to the two trees' totals
  * every JSON file is under 400 KB

Prints a table of year, enacted, actual, revenue. Exits 1 on any failure.
"""

from __future__ import annotations

import itertools
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

import pandas as pd

from config import DATA_DIR, raw_path

TOLERANCE = 0.005
MAX_BYTES = 400 * 1024


class Checker:
    """Collects pass/fail results so every problem is reported, not just the first."""

    def __init__(self) -> None:
        self.failures: list[str] = []
        self.passed = 0

    def ok(self, condition: bool, message: str) -> None:
        """Record one assertion."""
        if condition:
            self.passed += 1
        else:
            self.failures.append(message)

    def close(self, a: float, b: float, message: str, tol: float = TOLERANCE) -> None:
        """Assert two totals agree within a relative tolerance."""
        denom = max(abs(a), abs(b), 1.0)
        self.ok(abs(a - b) / denom <= tol, f"{message}: {a:,.0f} vs {b:,.0f}")


def load(path: Path) -> Any:
    """Read one JSON file."""
    return json.loads(path.read_text())


def raw_totals(year: int) -> dict[str, float] | None:
    """Sum enacted/actual/revenue straight from the raw CSVs, if cached."""
    sp, rv = raw_path("spending", year), raw_path("revenue", year)
    if not (sp.exists() and rv.exists()):
        return None
    s = pd.read_csv(sp, usecols=["total_enacted_budget_appropriation", "total_expenses"])
    r = pd.read_csv(rv, usecols=["revenue_collected"])
    return {"enacted": float(s["total_enacted_budget_appropriation"].fillna(0).sum()),
            "actual": float(s["total_expenses"].fillna(0).sum()),
            "revenue": float(r["revenue_collected"].fillna(0).sum())}


def check_node(c: Checker, node: dict[str, Any], label: str) -> None:
    """Recursively assert children sum to parent and no child exceeds its parent."""
    kids = node.get("children")
    if not kids:
        return
    for key in ("enacted", "gaa", "actual"):
        c.ok(sum(k[key] for k in kids) == node[key], f"{label} {node['id']}: children {key} != node")
        for k in kids:
            c.ok(k[key] <= node[key] or k[key] <= 0 or any(s[key] < 0 for s in kids),
                 f"{label} {k['id']}: {key} {k[key]:,} exceeds parent {node['id']} {node[key]:,}")
    for k in kids:
        check_node(c, k, label)


def check_flows(c: Checker, flows: dict[str, Any], label: str) -> None:
    """Assert the Sankey balances."""
    kinds = {n["id"]: n["kind"] for n in flows["nodes"]}
    c.ok(len(kinds) == len(flows["nodes"]), f"{label}: duplicate node ids")
    for l in flows["links"]:
        c.ok(l["source"] in kinds and l["target"] in kinds, f"{label}: dangling link {l}")
        c.ok(l["value"] > 0, f"{label}: non-positive link {l}")
    rev_links = sum(l["value"] for l in flows["links"] if kinds.get(l["source"]) == "revenue")
    prog_links = sum(l["value"] for l in flows["links"] if kinds.get(l["target"]) == "program")
    rev_nodes = sum(n["value"] for n in flows["nodes"] if n["kind"] == "revenue")
    sec_nodes = sum(n["value"] for n in flows["nodes"] if n["kind"] == "secretariat")
    c.ok(rev_links == flows["spendingTotal"], f"{label}: revenue links {rev_links:,} != spendingTotal")
    c.ok(prog_links == flows["spendingTotal"], f"{label}: program links {prog_links:,} != spendingTotal")
    c.ok(sec_nodes == flows["spendingTotal"], f"{label}: secretariat nodes != spendingTotal")
    c.close(rev_nodes, flows["revenueTotal"], f"{label}: revenue nodes vs revenueTotal")
    inflow: dict[str, int] = defaultdict(int)
    outflow: dict[str, int] = defaultdict(int)
    for l in flows["links"]:
        outflow[l["source"]] += l["value"]
        inflow[l["target"]] += l["value"]
    for n in flows["nodes"]:
        if n["kind"] == "secretariat":
            c.ok(inflow[n["id"]] == outflow[n["id"]] == n["value"], f"{label}: {n['id']} does not balance")
        if n["kind"] == "program":
            c.ok(inflow[n["id"]] == n["value"], f"{label}: {n['id']} inflow != value")


def main() -> int:
    """Run every check, print the totals table, and return the exit status."""
    c = Checker()
    meta = load(DATA_DIR / "meta.json")
    years: list[int] = meta["years"]
    trees: dict[int, dict[str, Any]] = {}
    rows = []
    for y in years:
        t = meta["totals"][str(y)]
        tree = load(DATA_DIR / f"fy{y}" / "tree.json")
        trees[y] = tree
        for key in ("enacted", "actual"):
            c.close(sum(s[key] for s in tree["children"]), t[key], f"FY{y} secretariat {key} vs meta")
        raw = raw_totals(y)
        if raw:
            for key in ("enacted", "actual", "revenue"):
                c.close(t[key], raw[key], f"FY{y} meta {key} vs raw CTHRU rows")
        check_node(c, tree, f"FY{y}")
        for name in ("flows.json", "flows_enacted.json"):
            flows = load(DATA_DIR / f"fy{y}" / name)
            check_flows(c, flows, f"FY{y} {name}")
            c.close(flows["revenueTotal"], t["revenue"], f"FY{y} {name} revenueTotal vs meta")
        rows.append((y, t["enacted"], t["actual"], t["revenue"], raw is not None))

    for a, b in itertools.combinations(years, 2):
        path = DATA_DIR / "diff" / f"fy{a}_fy{b}.json"
        c.ok(path.exists(), f"missing {path}")
        if path.exists():
            diff = load(path)
            c.ok(sum(r["actualA"] for r in diff["rows"]) == trees[a]["actual"], f"{path.name}: actualA sum")
            c.ok(sum(r["actualB"] for r in diff["rows"]) == trees[b]["actual"], f"{path.name}: actualB sum")
            c.ok(sum(r["enactedB"] for r in diff["rows"]) == trees[b]["enacted"], f"{path.name}: enactedB sum")

    for path in sorted(DATA_DIR.rglob("*.json")):
        c.ok(path.stat().st_size < MAX_BYTES, f"{path} is {path.stat().st_size:,} bytes (> 400 KB)")

    print(f"{'Year':<14}{'Enacted':>18}{'Actual':>18}{'Revenue':>18}")
    for y, en, ac, rv, has_raw in rows:
        label = f"FY{y}" + (" (partial)" if str(y) in meta["partial"] else "")
        print(f"{label:<14}{en:>18,}{ac:>18,}{rv:>18,}")
    print()
    if c.failures:
        print(f"FAILED: {len(c.failures)} of {len(c.failures) + c.passed} checks", file=sys.stderr)
        for f in c.failures[:50]:
            print(f"  - {f}", file=sys.stderr)
        return 1
    print(f"OK: {c.passed} checks passed (tolerance {TOLERANCE:.1%})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
