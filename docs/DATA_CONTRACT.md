# Data contract: `/data` JSON consumed by `/src`

All dollar values are plain numbers (USD, not cents). All IDs are stable strings.
Fiscal years as `"fy2027"` keys / `2027` numbers. FY runs Jul 1 – Jun 30.

## Sources (confirmed 2026-11-03 against cthru.data.socrata.com)
- Spending: `kv7m-35wn` "Budget_Actual_With_Other_Spending_Authorizationv3_Gen2". Rows = one per
  fiscal_year × fund × appropriation account. FY2005–FY2027, updated daily. Fields used:
  `fiscal_year, fund_number, fund_name, cabinet_secretariat_name, department_code, department_name,
  appropriation_account_number, appropriation_account_name, original_enacted_budget,
  supplemental_budget_appropriations, total_enacted_budget_appropriation,
  other_statutorily_authorized_spending, total_available_for_spending, total_expenses,
  appropriation_class_name`.
  Definitions: enacted = `total_enacted_budget_appropriation` (GAA + supplementals);
  gaa = `original_enacted_budget`; actual = `total_expenses`.
  Note: total_expenses can exceed enacted because of `other_statutorily_authorized_spending`
  (e.g. Medicaid, Intragovernmental). Keep it; explain in Methodology.
- Revenue: `kcy7-ivxi` "Commonwealth Revenue Collections". Rows = transaction-period level.
  FY2021–FY2027. Filter `fund_category_name = 'Budgeted Funds'`. Fields: `fiscal_year,
  revenue_category_name, revenue_class_name, revenue_source_name, department_name, revenue_collected`.
- Capital: `pegc-naaa` "Comptroller of the Commonwealth Spending" (one row per payment). Filter
  `appropriation_type like '(2CN)%'` (capital appropriations), summed by
  `budget_fiscal_year, cabinet_secretariat, department_code` in the SoQL query, so
  `etl/raw/capital_fy{YYYY}.csv` holds about 80 rows a year. Capital is paid from its own funds
  (General Capital Projects, Highway Capital Projects, Federal Highway Construction), so it never
  overlaps the spending dataset. It is shown beside the charts, never added to their totals.
- Official line-item pages (linked, not used for numbers): `budget.digital.mass.gov/summary/fy{YY}/sitemap-0.xml`
  lists one page per enacted line item, `…/summary/fy{YY}/enacted/{area}/{department}/{account}/`. `pull.py`
  saves the account-to-page map as `etl/raw/official_fy{YYYY}.json`; accounts with no page (trusts,
  supplemental-only items) get no link.
- Local aid by community: `sect3.xlsx`, linked from `budget.digital.mass.gov/summary/fy{YY}/downloads/`
  (Section 3 of the enacted budget). `pull.py` saves it as `etl/raw/localaid_fy{YYYY}.xlsx`; `etl/local_aid.py`
  reads it. FY2024's file is an old-format .xls and is skipped. Output `data/towns.json`:
  `{ years, totals: { "2027": { towns, districts, ch70, ugga, townCh70, districtCh70 } },
  places: [{ id: "ACTON BOXBOROUGH", name, kind: "town" | "district", aid: { "2027": { ch70, ugga } } }] }`.
- Population (per-resident figures only): Census Vintage 2025 state estimates, hard-coded in
  `etl/config.py` (`POPULATION`). `meta.population = { source, byYear: { "2026": { residents, estimate } } }`;
  a fiscal year uses July 1 at its start, or the latest estimate when that is not out yet.
- Reference (not scraped for numbers): massbudget.org Budget Browser category tree.
- Totals sanity (FY2026, from the API on 2026-11-03): enacted $62.22B, spent $69.80B,
  budgeted-fund revenue $73.17B. FY2027: enacted $62.58B, spent so far $22.81B.

## Revenue grouping (`etl/revenue_groups.py`)
```
Income tax            : revenue_class_name == "TAXES INCOME"
Sales & use tax       : "TAXES SALES AND USE"
Corporate tax         : "TAXES BUSINESS CORP", "TAXES BANKS", "TAXES -INSURANCE"
Other taxes           : revenue_category_name == "TAXES" and not above
Federal reimbursements: revenue_category_name == "FEDERAL GRANTS AND REIMBURSE"
Fees & departmental   : revenue_category_name in ("DEPARTMENTAL", "ASSESSMENTS", "CHARGEBACK REVENUES")
Transfers & other     : everything else
```

## Files
### `data/meta.json`
```json
{
  "generated": "2026-11-03T21:14:00Z",
  "years": [2024, 2025, 2026, 2027],
  "partial": { "2027": { "through": "2026-11-03", "label": "in progress" } },
  "sources": {
    "spending": { "id": "kv7m-35wn", "name": "...", "url": "https://cthru.data.socrata.com/...", "pulled": "2026-11-03" },
    "revenue":  { "id": "kcy7-ivxi", "name": "...", "url": "...", "pulled": "2026-11-03" }
  },
  "totals": { "2027": { "enacted": 0, "gaa": 0, "actual": 0, "revenue": 0 }, ... }
}
```
### `data/fy{YYYY}/tree.json`
```ts
type Node = {
  id: string;            // "sec:EHS" | "dept:EHS/DMH" | "prog:40000500"
  name: string;          // human name
  raw?: string;          // original CTHRU name (programs/depts), for traceability
  code?: string;         // department_code or appropriation_account_number
  enacted: number; gaa: number; actual: number;
  conservation?: true;   // set on EEA secretariat, DCR + DFG departments and their descendants
  other?: true;          // synthetic "Other …" bucket
  official?: string;     // programs: page on budget.digital.mass.gov (wording, amount at each budget stage)
  children?: Node[];
}
// root: { id:"root", name:"Massachusetts state budget", enacted, gaa, actual, children: Node[] /* secretariats */ }
```
### `data/fy{YYYY}/flows.json`
```ts
{
  nodes: { id: string; name: string; kind: "revenue"|"secretariat"|"program"; value: number;
           conservation?: true; parent?: string }[],
  links: { source: string; target: string; value: number; proportional?: true }[],
  // revenue→secretariat links are proportional: each secretariat's actual × (revenue group / total revenue)
  // secretariat→program links are real: top N programs per secretariat by actual, rest to "prog:other:{sec}"
  revenueTotal: number, spendingTotal: number, measure: "actual" | "enacted"  // build both: flows.json (actual) and flows_enacted.json
}
```
### `data/diff/fy{A}_fy{B}.json`
```ts
{ a: 2026, b: 2027, rows: { id, name, path: string /* "Sec › Dept" */, secId: string, deptId: string, code?, accounts?,
    enactedA, enactedB, actualA, actualB, dEnacted, dActual, pctEnacted: number|null, pctActual: number|null,
    conservation?: true }[] }
// one row per program node (incl. Other buckets). Programs present in only one year get 0 for the missing year.
```
### `data/fy{YYYY}/rows.json` (optional, for "source" links)
Map `prog id → { account, fund, socrataQuery }` so the UI can link to the exact rows.
Simpler: the UI builds the link itself:
`https://cthru.data.socrata.com/resource/kv7m-35wn.json?fiscal_year=2026&appropriation_account_number=40000500`
and for the human page: `https://cthru.data.socrata.com/d/kv7m-35wn`.

## `make check`
For each year: sum of secretariat.actual == meta.totals[year].actual within 0.5%, same for enacted;
every program's actual ≤ parent; flows: Σ revenue links == revenueTotal, Σ program links == spendingTotal.

## Changes

Recorded by the ETL on 2026-11-03 while implementing `etl/build.py`. All are additive or
clarifications except item 1.

1. **Flows balance (deviation).** Revenue→secretariat links are proportional shares of each
   secretariat's value, so **Σ revenue links == `spendingTotal`**, not `revenueTotal` (this is
   what keeps every secretariat node balanced in == out). Each revenue node's `value` is the
   amount actually collected for that group, so **Σ revenue node values == `revenueTotal`**.
   d3-sankey sizes revenue nodes by their links; show `node.value` in the tooltip as "collected".
   Links are integer-rounded with largest-remainder so all sums are exact. `make check` asserts
   this version.
2. **Flows program selection.** The right column is the top 40 *named* programs statewide by the
   file's measure (not top N per secretariat). Everything else in a secretariat goes to
   `prog:other:{SEC}` (`other: true`, name "Other {Secretariat}"). Program nodes carry `parent`
   (secretariat id); program ids match `tree.json` (`prog:{account}`).
3. **IDs.** Secretariat keys are short stable codes from `etl/names.py` (`sec:EHS`, `sec:ANF`,
   `sec:STW` = "Statewide obligations", `sec:EEA`, `sec:DOT`, ...). Departments are
   `dept:{SEC}/{department_code}` (e.g. `dept:EEA/DCR`). Revenue nodes are `rev:income`,
   `rev:sales`, `rev:corporate`, `rev:othertax`, `rev:federal`, `rev:fees`, `rev:transfers`
   (also listed in `meta.revenueGroups` in display order).
4. **Tree "Other" buckets** are per department: `prog:other:{SEC}/{DEPT}`, name
   "Other {Department}", `other: true`, plus `accounts` (number of line items summed in). Diff
   rows for these buckets carry the same `accounts` (from the later year when both exist).
   Secretariat nodes also carry `raw` and `code` (the key). Accounts with $0 enacted and $0 spent
   in a year are omitted from that year's tree.
5. **One home per account.** CTHRU records some accounts under several departments (e.g. Chapter
   70, 7061-0008, is appropriated to DESE but paid under DOR). All rows of an account are rolled up
   under one home department: the `mapping.csv` department if mapped, else the department with the
   most enacted dollars across FY2024–27. Totals are unchanged; see METHODOLOGY.
6. **Measures with no value.** A secretariat whose value for a measure is ≤ 0 is left out of that
   flows file (e.g. Transportation in FY2027 `flows_enacted.json`, where CTHRU shows $0 enacted).
7. **meta.json additions:** `partial["2027"].revenueThrough` (last month-end covered by revenue
   periods), `sources.*.api`, `sources.*.rowsUpdatedAt`, `sources.revenue.filter`,
   `coverage[year]` (`mappedAccounts`, `otherAccounts`, `otherBuckets`, `mappedShareActual`,
   `mappedShareEnacted`), and `revenueGroups`. `partial.through` is the spending dataset's
   `rowsUpdatedAt` date.
8. **Diff files** are written for every pair of loaded years (a < b). Rows are sorted by
   `|dActual|` descending; `path` uses " › " between secretariat and department names; `pct*` is
   `null` when the A value is 0.
9. **meta.json `capital`** (optional): `capital[year] = { total, bySec: { "sec:EEA": n }, byDept:
   { "dept:EEA/DCR": n } }`, whole dollars of capital payments, largest first; areas with none
   are absent. A department sits under the secretariat it has in the spending data. Plus
   `sources.capital` (same shape as the other sources, with `filter`). For a year in progress the
   figure is payments so far.
10. **Formatting.** JSON is written compact (no indentation) to keep files small; largest file is
   about 120 KB.
