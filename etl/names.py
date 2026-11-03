"""Human-readable names for CTHRU secretariats and departments.

CTHRU names are upper-case, abbreviated, and sometimes misspelled
("ADMINSTRATION"). This module turns them into short Title Case labels and
gives every secretariat a stable short key used in node IDs
(``sec:EHS``, ``dept:EHS/DMH``).

Secretariats are matched on a normalized form of the raw name (upper case,
single spaces, straight apostrophes), so case and spacing drift between
years does not create new nodes. Departments are keyed by ``department_code``.
"""

from __future__ import annotations

import re

# normalized raw secretariat name -> (stable key, human name)
SECRETARIATS: dict[str, tuple[str, str]] = {
    "EXECUTIVE OFFICE OF HEALTH & HUMAN SERVICES": ("EHS", "Health & Human Services"),
    "EXECUTIVE OFFICE FOR ADMINSTRATION & FINANCE": ("ANF", "Administration & Finance"),
    "EXECUTIVE OFFICE FOR ADMINISTRATION & FINANCE": ("ANF", "Administration & Finance"),
    "CTR/FAD ACCOUNTING ENTITIES": ("STW", "Statewide obligations"),
    "TREASURER & RECEIVER GENERAL": ("TRE", "Treasurer"),
    "ENVIRONMENTAL AFFAIRS": ("EEA", "Energy & Environmental Affairs"),
    "MASSACHUSETTS DEPARTMENT OF TRANSPORTATION": ("DOT", "Transportation"),
    # One FY2027 row (Aeronautics, $0) sits under the executive office name.
    "EXECUTIVE OFFICE OF TRANSPORTATION": ("DOT", "Transportation"),
    "EXECUTIVE OFFICE OF EDUCATION": ("EDU", "Education"),
    "EXECUTIVE OFFICE OF HOUSING AND LIVABLE COMMUNITIES": ("HLC", "Housing & Livable Communities"),
    "EXECUTIVE OFFICE OF ECONOMIC DEVELOPMENT": ("EED", "Economic Development"),
    "EXECUTIVE OFFICE OF LABOR AND WORKFORCE DEVELOPMENT": ("LWD", "Labor & Workforce Development"),
    "EXECUTIVE OFFICE OF PUBLIC SAFETY & HOMELAND SECURITY": ("EPS", "Public Safety & Security"),
    "EXECUTIVE OFFICE OF TECHNOLOGY SERVICES AND SECURITY": ("TSS", "Technology Services & Security"),
    "EXECUTIVE OFFICE OF VETERANS' SERVICES": ("VET", "Veterans' Services"),
    "JUDICIARY": ("JUD", "Judiciary"),
    "SHERIFF DEPARTMENTS": ("SHF", "Sheriffs"),
    "DISTRICT ATTORNEY": ("DAS", "District Attorneys"),
    "ATTORNEY GENERAL": ("AGO", "Attorney General"),
    "SECRETARY OF STATE": ("SEC", "Secretary of the Commonwealth"),
    "STATE AUDITOR": ("AUD", "State Auditor"),
    "INSPECTOR GENERAL": ("IGO", "Inspector General"),
    "OFFICE OF COMPTROLLER": ("OSC", "Comptroller"),
    "GOVERNOR": ("GOV", "Governor's Office"),
    "GOVERNOR'S COUNCIL": ("GCN", "Governor's Council"),
    "LEGISLATURE": ("LEG", "Legislature"),
    "BOARD OF LIBRARY COMMISSIONERS": ("BLC", "Library Commissioners"),
    "CAMPAIGN & POLITICAL FINANCE": ("CPF", "Campaign & Political Finance"),
    "CANNABIS CONTROL COMMISSION": ("CNB", "Cannabis Control Commission"),
    "MA GAMING COMMISSION": ("MGC", "Gaming Commission"),
    "ETHICS COMMISSION": ("ETH", "Ethics Commission"),
    "COMMISSION AGAINST DISCRIMINATION": ("CAD", "Commission Against Discrimination"),
    "COMMISSION FOR THE PROTECTION OF PERSONS WITH DISABILITIES": ("DPC", "Disabled Persons Protection"),
    "COMMISSION ON STATUS OF WOMEN": ("CSW", "Status of Women Commission"),
    "COMMISSION ON THE SOCIAL STATUS OF BLACK MEN AND BOYS": ("SBM", "Black Men & Boys Commission"),
    "COMMISSION ON THE STATUS OF AFRICAN AMERICANS": ("SAA", "African Americans Commission"),
    "COMMISSION ON THE STATUS OF LATINOS AND LATINAS": ("SLL", "Latinos & Latinas Commission"),
    "COMMISSION ON THE STATUS OF PERSONS WITH DISABILITIES": ("SPD", "Persons with Disabilities Commission"),
    "DEVELOPMENTAL DISABILITIES COUNCIL": ("DDC", "Developmental Disabilities Council"),
    "MASSACHUSETTS PEACE OFFICER STANDARDS AND TRAINING": ("PST", "Peace Officer Standards & Training"),
    "OFFICE OF THE CHILD ADVOCATE": ("OCA", "Child Advocate"),
    "OFFICE OF THE VETERAN ADVOCATE": ("OVA", "Veteran Advocate"),
    "THE CENTER FOR HEALTH INFORMATION & ANALYSIS": ("HCF", "Health Information & Analysis"),
}

# department_code -> human name, where generic title-casing is not good enough.
DEPARTMENTS: dict[str, str] = {
    # Health & Human Services
    "EHS": "EOHHS & MassHealth",
    "DMR": "Department of Developmental Services",
    "DSS": "Department of Children & Families",
    "WEL": "Department of Transitional Assistance",
    "ELD": "Executive Office of Elder Affairs",
    "MCB": "Commission for the Blind",
    "MCD": "Commission for the Deaf & Hard of Hearing",
    "MRC": "Mass Rehabilitation Commission",
    "ORI": "Office for Refugees & Immigrants",
    # Administration & Finance
    "ANF": "Executive Office for Administration & Finance",
    "DCP": "Capital Asset Management & Maintenance",
    "GIC": "Group Insurance Commission",
    "HRD": "Human Resources Division",
    "LIB": "State Library",
    "OHA": "Office on Disability",
    "OSD": "Operational Services Division",
    "TRB": "Teachers' Retirement Board",
    "SDO": "Supplier Diversity Office",
    "BSB": "Bureau of State Buildings",
    "ALA": "Administrative Law Appeals",
    # Statewide / Treasurer
    "CTR": "Statewide accounts (Comptroller)",
    "TRE": "Office of the State Treasurer",
    "LOT": "State Lottery Commission",
    "ART": "Mass Cultural Council",
    # Energy & Environment
    "AGR": "Department of Agricultural Resources",
    "DCR": "Department of Conservation & Recreation",
    "DPU": "Department of Public Utilities",
    "ENE": "Department of Energy Resources",
    "ENV": "Executive Office of Energy & Environmental Affairs",
    "EQE": "Department of Environmental Protection",
    "FWE": "Department of Fish & Game",
    "SRB": "State Reclamation Board",
    # Education
    "DOE": "Elementary & Secondary Education",
    "EEC": "Early Education & Care",
    "RGT": "Department of Higher Education",
    "EDU": "Executive Office of Education",
    "UMS": "University of Massachusetts",
    "MCA": "MassArt",
    "NAC": "Mass College of Liberal Arts",
    "MMA": "Mass Maritime Academy",
    "STC": "Springfield Technical Community College",
    "MWC": "Mount Wachusett Community College",
    "MBC": "MassBay Community College",
    # Housing, economic development, labor
    "OCD": "Housing & Livable Communities",
    "EED": "Executive Office of Economic Development",
    "MMP": "Mass Marketing Partnership",
    "REG": "Division of Occupational Licensure",
    "SCA": "Consumer Affairs & Business Regulation",
    "SEA": "Department of Business & Technology",
    "TAC": "Department of Telecommunications & Cable",
    "EOL": "Executive Office of Labor & Workforce Development",
    "LRC": "Labor Relations Commission",
    # Public safety
    "CDA": "Emergency Management Agency",
    "CHS": "Criminal Justice Information Services",
    "CJT": "Municipal Police Training Committee",
    "CME": "Chief Medical Examiner",
    "DOC": "Department of Correction",
    "EPS": "Executive Office of Public Safety & Security",
    "MIL": "Military Division (National Guard)",
    "POL": "State Police",
    "SOR": "Sex Offender Registry Board",
    # Technology, transportation, veterans
    "ITD": "Executive Office of Technology Services & Security",
    "DOT": "MassDOT",
    "MAC": "Aeronautics Commission",
    "CHE": "Veterans' Home at Chelsea",
    "HLY": "Veterans' Home at Holyoke",
    "VET": "Executive Office of Veterans' Services",
    # Judiciary
    "TRC": "Trial Court",
    "SJC": "Supreme Judicial Court",
    "APC": "Appeals Court",
    "CPC": "Public Counsel Services",
    "MHL": "Mental Health Legal Advisors",
    "BBE": "Board of Bar Examiners",
    "CJC": "Commission on Judicial Conduct",
    # Legislature
    "HOU": "House of Representatives",
    "SEN": "Senate",
    "LEG": "Joint Legislative Expenses",
    # District attorneys
    "DAA": "District Attorneys Association",
    "MID": "Middle (Worcester) District Attorney",
    "NOR": "Northern (Middlesex) District Attorney",
    "WES": "Hampden District Attorney",
    "CPI": "Cape & Islands District Attorney",
    # Sheriffs
    "SDA": "Sheriffs' Association",
    "BSD": "Bristol Sheriff",
    "HSD": "Hampshire Sheriff",
    "NSD": "Nantucket Sheriff",
    "SDB": "Berkshire Sheriff",
    "SDC": "Barnstable Sheriff",
    "SDD": "Dukes Sheriff",
    "SDE": "Essex Sheriff",
    "SDF": "Franklin Sheriff",
    "SDH": "Hampden Sheriff",
    "SDM": "Middlesex Sheriff",
    "SDN": "Norfolk Sheriff",
    "SDP": "Plymouth Sheriff",
    "SDS": "Suffolk Sheriff",
    "SDW": "Worcester Sheriff",
    # Independents
    "AGO": "Attorney General's Office",
    "VWA": "Victim & Witness Assistance Board",
    "SEC": "Secretary of the Commonwealth",
    "SAO": "State Auditor's Office",
    "IGO": "Inspector General",
    "OSC": "Office of the Comptroller",
    "GOV": "Governor's Office",
    "GCN": "Governor's Council",
    "HCF": "Center for Health Information & Analysis",
    "DAC": "Disabled Persons Protection Commission",
    "PST": "Peace Officer Standards & Training",
    "ETH": "State Ethics Commission",
    "CNB": "Cannabis Control Commission",
    "MGC": "Gaming Commission",
    "BLC": "Board of Library Commissioners",
    "CPF": "Campaign & Political Finance",
    "CAD": "Commission Against Discrimination",
    "CSW": "Commission on the Status of Women",
}

_SMALL_WORDS = {"a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"}
_KEEP_UPPER = {"MA", "DA", "UMASS", "MBTA", "RTA", "RTAS", "IT", "ISF", "MCAS", "HIV", "AIDS", "DCF",
               "DDS", "DMH", "DPH", "DTA", "DYS", "EEC", "GIC", "TANF", "SNAP", "WIC", "ACA", "II", "III"}


def normalize(raw: str | None) -> str:
    """Upper-case, collapse whitespace, and straighten apostrophes/backticks."""
    s = (raw or "").replace("`", "'").replace("’", "'")
    return re.sub(r"\s+", " ", s).strip().upper()


def title_case(raw: str | None) -> str:
    """Title-case an upper-case CTHRU label, keeping small words and acronyms sensible."""
    words = re.sub(r"\s+", " ", (raw or "").strip()).split(" ")
    out: list[str] = []
    for i, word in enumerate(words):
        bare = re.sub(r"[^A-Za-z]", "", word).upper()
        if bare in _KEEP_UPPER:
            out.append(word.upper())
        elif i > 0 and word.lower() in _SMALL_WORDS:
            out.append(word.lower())
        else:
            out.append("-".join(p[:1].upper() + p[1:].lower() for p in word.split("-")))
    text = " ".join(out).replace(" and ", " & ")
    return text


def secretariat(raw: str | None) -> tuple[str, str]:
    """Return (key, human name) for a raw CTHRU secretariat name.

    Unknown names fall back to an upper-case slug key and a title-cased name,
    so a new secretariat appearing in the data never breaks the build.
    """
    norm = normalize(raw)
    if norm in SECRETARIATS:
        return SECRETARIATS[norm]
    slug = re.sub(r"[^A-Z0-9]+", "", norm)[:8] or "UNK"
    return slug, title_case(norm)


def department(code: str | None, raw: str | None) -> str:
    """Return a human department name from its code, falling back to the raw name."""
    if code and code in DEPARTMENTS:
        return DEPARTMENTS[code]
    name = title_case(raw)
    return name or (code or "Unknown department")


def unknown_secretariats(raw_names: list[str]) -> list[str]:
    """List raw secretariat names that have no explicit entry (for build warnings)."""
    return sorted({n for n in raw_names if normalize(n) not in SECRETARIATS})
