"""Shared constants for the Open Ledger MA ETL.

Everything here is immutable configuration: dataset IDs, paths, and the
default fiscal years. No runtime state lives in this module.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

ROOT: Path = Path(__file__).resolve().parent.parent
ETL_DIR: Path = ROOT / "etl"
RAW_DIR: Path = ETL_DIR / "raw"
DATA_DIR: Path = ROOT / "data"
MAPPING_CSV: Path = ETL_DIR / "mapping.csv"
METHODOLOGY_MD: Path = ROOT / "METHODOLOGY.md"

SOCRATA_DOMAIN: str = "https://cthru.data.socrata.com"
# The state's budget site has one page per enacted line item; its sitemap lists them all.
# Its downloads page links sect3.xlsx: Chapter 70 and unrestricted aid for every city, town and district.
OFFICIAL_DOWNLOADS: str = "https://budget.digital.mass.gov/summary/fy{yy}/downloads/"
OFFICIAL_SITEMAP: str = "https://budget.digital.mass.gov/summary/fy{yy}/sitemap-0.xml"
DEFAULT_YEARS: tuple[int, ...] = (2024, 2025, 2026, 2027)

# Massachusetts resident population on July 1, from the Census Bureau's Vintage 2025 state
# estimates (NST-EST2025-ALLDATA, POPESTIMATE{year}). Used only for per-resident figures.
POPULATION_SOURCE: str = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/state/totals/NST-EST2025-ALLDATA.csv"
POPULATION: dict[int, int] = {2023: 7_073_479, 2024: 7_138_560, 2025: 7_154_084}


def population_for(fiscal_year: int) -> tuple[int, int]:
    """(residents, estimate year) for a fiscal year: July 1 at its start, else the latest estimate."""
    est = min(fiscal_year - 1, max(POPULATION))
    return POPULATION[est], est


@dataclass(frozen=True)
class Dataset:
    """A Socrata dataset we pull from CTHRU."""

    key: str  # short name used in file names: "spending" | "revenue"
    id: str  # Socrata 4x4 resource id
    name: str  # human dataset title on CTHRU
    where: str  # extra SoQL filter, ANDed with the fiscal year filter
    order: str  # stable ordering for $offset paging
    year_where: str = "fiscal_year = {year}"  # fiscal year filter template
    group: str = ""  # SoQL $group; when set, FIELDS are aggregate selects ("sum(x) as y")

    @property
    def resource_url(self) -> str:
        """SODA JSON/CSV resource endpoint (without extension)."""
        return f"{SOCRATA_DOMAIN}/resource/{self.id}"

    @property
    def page_url(self) -> str:
        """Human-facing dataset page."""
        return f"{SOCRATA_DOMAIN}/d/{self.id}"

    @property
    def metadata_url(self) -> str:
        """View metadata endpoint (rowsUpdatedAt etc.)."""
        return f"{SOCRATA_DOMAIN}/api/views/{self.id}.json"


SPENDING = Dataset(
    key="spending",
    id="kv7m-35wn",
    name="Budget_Actual_With_Other_Spending_Authorizationv3_Gen2 (CTHRU Budget-to-Actual)",
    where="",
    order=":id",
)

REVENUE = Dataset(
    key="revenue",
    id="kcy7-ivxi",
    name="Commonwealth Revenue Collections (CTHRU Revenue)",
    where="fund_category_name = 'Budgeted Funds'",
    order=":id",
)

# Payments from capital (bond-funded) appropriations, summed by department. Capital lives in
# its own funds (General/Highway Capital Projects etc.), so it never overlaps SPENDING.
CAPITAL = Dataset(
    key="capital",
    id="pegc-naaa",
    name="Comptroller of the Commonwealth Spending (CTHRU Spending), capital appropriations",
    where="appropriation_type like '(2CN)%'",
    order="department_code",
    year_where="budget_fiscal_year = '{year}'",
    group="budget_fiscal_year, cabinet_secretariat, department_code",
)

DATASETS: tuple[Dataset, ...] = (SPENDING, REVENUE, CAPITAL)

# Spending fields kept in the raw CSV (contract list plus a few useful extras).
SPENDING_FIELDS: tuple[str, ...] = (
    "fiscal_year",
    "fund_number",
    "fund_name",
    "cabinet_secretariat_name",
    "department_code",
    "department_name",
    "appropriation_account_number",
    "appropriation_account_name",
    "original_enacted_budget",
    "supplemental_budget_appropriations",
    "total_enacted_budget_appropriation",
    "other_statutorily_authorized_spending",
    "total_available_for_spending",
    "total_expenses",
    "appropriation_class_name",
)

REVENUE_FIELDS: tuple[str, ...] = (
    "fiscal_year",
    "fiscal_period",
    "fund_category_name",
    "fund_number",
    "revenue_category_name",
    "revenue_class_name",
    "revenue_source",
    "revenue_source_name",
    "cabinet_name",
    "department_code",
    "department_name",
    "revenue_collected",
)

CAPITAL_FIELDS: tuple[str, ...] = (
    "budget_fiscal_year",
    "cabinet_secretariat",
    "department_code",
    "sum(amount) as amount",
)

FIELDS: dict[str, tuple[str, ...]] = {"spending": SPENDING_FIELDS, "revenue": REVENUE_FIELDS,
                                      "capital": CAPITAL_FIELDS}


# Town-level figures for the Your town page. Residents: the Census Bureau's Vintage 2025 city and
# town estimates (July 1). Students: the state education department's October 1 count of public
# school students by the town they live in and the district they attend.
TOWN_POPULATION_YEAR: int = 2025
TOWN_POPULATION_URL: str = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/cities/totals/sub-est2025_25.csv"
TOWN_POPULATION_PATH: Path = RAW_DIR / "town_population.csv"
TOWN_STUDENTS_URL: str = "https://educationtocareer.data.mass.gov/resource/8xyg-59b2.json"
TOWN_STUDENTS_PAGE: str = "https://educationtocareer.data.mass.gov/d/8xyg-59b2"
TOWN_STUDENTS_PATH: Path = RAW_DIR / "town_students.json"


def column_name(field: str) -> str:
    """CSV column for a select expression: the alias of "sum(x) as y", else the field itself."""
    return field.rsplit(" as ", 1)[-1].strip()


def local_aid_path(year: int) -> Path:
    """Path of the cached Section 3 local aid spreadsheet for one fiscal year."""
    return RAW_DIR / f"localaid_fy{year}.xlsx"


def official_path(year: int) -> Path:
    """Path of the cached account-to-official-page map for one fiscal year."""
    return RAW_DIR / f"official_fy{year}.json"


def raw_path(dataset_key: str, year: int) -> Path:
    """Path of the cached raw CSV for one dataset and fiscal year."""
    return RAW_DIR / f"{dataset_key}_fy{year}.csv"
