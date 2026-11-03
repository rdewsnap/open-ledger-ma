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
DEFAULT_YEARS: tuple[int, ...] = (2024, 2025, 2026, 2027)


@dataclass(frozen=True)
class Dataset:
    """A Socrata dataset we pull from CTHRU."""

    key: str  # short name used in file names: "spending" | "revenue"
    id: str  # Socrata 4x4 resource id
    name: str  # human dataset title on CTHRU
    where: str  # extra SoQL filter, ANDed with the fiscal year filter
    order: str  # stable ordering for $offset paging

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

DATASETS: tuple[Dataset, ...] = (SPENDING, REVENUE)

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

FIELDS: dict[str, tuple[str, ...]] = {"spending": SPENDING_FIELDS, "revenue": REVENUE_FIELDS}


def raw_path(dataset_key: str, year: int) -> Path:
    """Path of the cached raw CSV for one dataset and fiscal year."""
    return RAW_DIR / f"{dataset_key}_fy{year}.csv"
