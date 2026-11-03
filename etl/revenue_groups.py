"""Group CTHRU revenue rows into the seven revenue sources shown in the Flow view.

Rules (docs/DATA_CONTRACT.md), applied in order:

    Income tax             revenue_class_name == "TAXES INCOME"
    Sales & use tax        revenue_class_name == "TAXES SALES AND USE"
    Corporate tax          revenue_class_name in TAXES BUSINESS CORP / TAXES BANKS / TAXES -INSURANCE
    Other taxes            revenue_category_name == "TAXES" and none of the above
    Federal reimbursements revenue_category_name == "FEDERAL GRANTS AND REIMBURSE"
    Fees & departmental    revenue_category_name in DEPARTMENTAL / ASSESSMENTS / CHARGEBACK REVENUES
    Transfers & other      everything else
"""

from __future__ import annotations

import pandas as pd

# (id, label) in display order
GROUPS: tuple[tuple[str, str], ...] = (
    ("income", "Income tax"),
    ("sales", "Sales & use tax"),
    ("corporate", "Corporate tax"),
    ("othertax", "Other taxes"),
    ("federal", "Federal reimbursements"),
    ("fees", "Fees & departmental"),
    ("transfers", "Transfers & other"),
)
LABELS: dict[str, str] = dict(GROUPS)

CORPORATE_CLASSES: frozenset[str] = frozenset({"TAXES BUSINESS CORP", "TAXES BANKS", "TAXES -INSURANCE"})
FEES_CATEGORIES: frozenset[str] = frozenset({"DEPARTMENTAL", "ASSESSMENTS", "CHARGEBACK REVENUES"})


def _norm(value: object) -> str:
    """Upper-case and strip a label; NaN becomes an empty string."""
    return "" if value is None or (isinstance(value, float) and pd.isna(value)) else str(value).strip().upper()


def classify(category: object, klass: object) -> str:
    """Return the revenue group id for one row's category and class names."""
    cat, cls = _norm(category), _norm(klass)
    if cls == "TAXES INCOME":
        return "income"
    if cls == "TAXES SALES AND USE":
        return "sales"
    if cls in CORPORATE_CLASSES:
        return "corporate"
    if cat == "TAXES":
        return "othertax"
    if cat == "FEDERAL GRANTS AND REIMBURSE":
        return "federal"
    if cat in FEES_CATEGORIES:
        return "fees"
    return "transfers"


def group_revenue(df: pd.DataFrame) -> pd.Series:
    """Sum ``revenue_collected`` by group id, in display order (missing groups = 0)."""
    groups = [classify(c, k) for c, k in zip(df["revenue_category_name"], df["revenue_class_name"])]
    totals = pd.to_numeric(df["revenue_collected"], errors="coerce").fillna(0).groupby(groups).sum()
    return totals.reindex([g for g, _ in GROUPS], fill_value=0.0)


def class_table(df: pd.DataFrame) -> pd.DataFrame:
    """Distinct (category, class) pairs with their assigned group, for METHODOLOGY."""
    pairs = df[["revenue_category_name", "revenue_class_name"]].drop_duplicates()
    pairs = pairs.assign(group=[LABELS[classify(c, k)] for c, k in
                                zip(pairs["revenue_category_name"], pairs["revenue_class_name"])])
    return pairs.sort_values(["group", "revenue_category_name", "revenue_class_name"]).reset_index(drop=True)
