"""Read the state's Section 3 local aid spreadsheets (Chapter 70 and unrestricted aid).

Each year's enacted budget lists, for every city, town and regional school district, its
Chapter 70 school aid and its Unrestricted General Government Aid. The budget site publishes
the list as sect3.xlsx. This module reads those files with the standard library only.
"""

from __future__ import annotations

import csv
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from config import TOWN_POPULATION_PATH, TOWN_POPULATION_YEAR, TOWN_STUDENTS_PATH, local_aid_path

_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_SMALL_WORDS = {"OF", "THE", "BY", "AND"}
# The education department names districts more fully than the budget does ("Tri-County Regional
# Vocational Technical" vs "TRI COUNTY"); dropping these words lines the two up.
_DISTRICT_NOISE = {"REGIONAL", "REG", "VOCATIONAL", "TECHNICAL", "AGRICULTURAL", "SCHOOL", "DISTRICT", "AND"}
_DISTRICT_ALIASES = {"MARTHA S VINEYARD": "MARTHAS VINEYARD", "PIONEER VALLEY": "PIONEER",
                     "SOUTHERN WORCESTER COUNTY": "SOUTHERN WORCESTER",
                     "SPENCER E BROOKFIELD": "SPENCER EAST BROOKFIELD", "UP ISLAND": "UPISLAND"}
_TOWN_ALIASES = {"MANCHESTER BY THE SEA": "MANCHESTER"}  # the budget uses the town's old name
_MEMBER = "Resident/Member"


def _sheet_rows(path: Path) -> list[list[str]]:
    """First worksheet as rows of [A, B, C] text."""
    with zipfile.ZipFile(path) as z:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(f"{_NS}si"):
                shared.append("".join(t.text or "" for t in si.iter(f"{_NS}t")))
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = []
    for r in sheet.iter(f"{_NS}row"):
        cells = {"A": "", "B": "", "C": ""}
        for c in r.findall(f"{_NS}c"):
            col = re.match(r"[A-Z]+", c.get("r", "")).group()  # type: ignore[union-attr]
            if col not in cells:
                continue
            v = c.find(f"{_NS}v")
            if v is None:
                cells[col] = "".join(t.text or "" for t in c.iter(f"{_NS}t"))
            else:
                cells[col] = shared[int(v.text)] if c.get("t") == "s" else (v.text or "")
        rows.append([cells["A"], cells["B"], cells["C"]])
    return rows


def _amount(text: str) -> int | None:
    """"$16,458,771 " -> 16458771; blank or non-numeric -> None."""
    cleaned = re.sub(r'[$,"\s]', "", text)
    if not cleaned:
        return None
    try:
        return int(round(float(cleaned)))
    except ValueError:
        return None


def place_key(name: str) -> str:
    """Stable key for a place across years: upper case, punctuation and extra spaces dropped."""
    return re.sub(r"\s+", " ", re.sub(r"[^A-Za-z ]", " ", name)).strip().upper()


def display_name(key: str) -> str:
    """"MANCHESTER BY THE SEA" -> "Manchester by the Sea"."""
    words = key.split(" ")
    return " ".join(w.lower() if i and w in _SMALL_WORDS else w.capitalize() for i, w in enumerate(words))


def read_year(year: int) -> dict[str, Any] | None:
    """One year's list: {"places": {key: {"kind", "ch70", "ugga"}}, "stated": {...}}; None if not pulled."""
    path = local_aid_path(year)
    if not path.exists():
        return None
    places: dict[str, dict[str, Any]] = {}
    stated: dict[str, dict[str, int]] = {}
    kind = "town"
    for name, b, c in _sheet_rows(path):
        key = place_key(name)
        if not key:
            continue
        if key.startswith("REGIONAL SCHOOL DISTRICT"):
            kind = "district"
            continue
        ch70, ugga = _amount(b), _amount(c)
        if ch70 is None and ugga is None:
            continue  # title and header rows
        row = {"ch70": ch70 or 0, "ugga": ugga or 0}
        if key.startswith("TOTAL"):
            stated[key] = row
            continue
        if key in places:
            raise ValueError(f"FY{year} local aid: {name!r} is listed twice")
        places[key] = {"kind": kind, **row}
    return {"places": places, "stated": stated}


def district_key(name: str) -> str:
    """The budget's key for a district as the education department names it."""
    key = " ".join(w for w in place_key(name).split(" ") if w not in _DISTRICT_NOISE)
    return _DISTRICT_ALIASES.get(key, key)


def read_population() -> dict[str, dict[str, Any]]:
    """Each city and town's residents and county: {"ACTON": {"residents": 24021, "county": "Middlesex"}}."""
    if not TOWN_POPULATION_PATH.exists():
        return {}
    with TOWN_POPULATION_PATH.open(encoding="latin-1", newline="") as f:
        rows = list(csv.DictReader(f))
    counties = {r["COUNTY"]: r["NAME"].removesuffix(" County") for r in rows if r["SUMLEV"] == "050"}
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        if row["SUMLEV"] != "061":  # one row per city or town
            continue
        name = re.sub(r"( Town)? (city|town)$", "", row["NAME"])
        key = place_key(name)
        out[_TOWN_ALIASES.get(key, key)] = {"residents": int(row[f"POPESTIMATE{TOWN_POPULATION_YEAR}"]),
                                "county": counties[row["COUNTY"]]}
    return out


def read_students() -> dict[str, Any] | None:
    """Public school students by home town and by district attended; None if not pulled.

    {"schoolYear", "byTown": {town: n}, "byDistrict": {district: n},
     "members": {district: {town: n}}}: members counts only students enrolled as residents of
    a member town, which is what ties a town to its regional districts.
    """
    if not TOWN_STUDENTS_PATH.exists():
        return None
    raw = json.loads(TOWN_STUDENTS_PATH.read_text())
    by_town: dict[str, int] = {}
    by_district: dict[str, int] = {}
    members: dict[str, dict[str, int]] = {}
    for row in raw["rows"]:
        n = int(row["enr_cnt"])
        town, dist = place_key(row["town_name"]), district_key(row["dist_name"])
        by_town[town] = by_town.get(town, 0) + n
        by_district[dist] = by_district.get(dist, 0) + n
        if row["enr_reason"] == _MEMBER:
            members.setdefault(dist, {})[town] = members.get(dist, {}).get(town, 0) + n
    return {"schoolYear": raw["schoolYear"], "byTown": by_town, "byDistrict": by_district, "members": members}


def build_towns(years: list[int]) -> dict[str, Any] | None:
    """towns.json contents for every year with a readable list, or None when there is none."""
    by_year = {y: d for y in years if (d := read_year(y))}
    if not by_year:
        return None
    keys = sorted({k for d in by_year.values() for k in d["places"]})
    places = []
    for key in keys:
        kinds = {d["places"][key]["kind"] for d in by_year.values() if key in d["places"]}
        aid = {str(y): {"ch70": d["places"][key]["ch70"], "ugga": d["places"][key]["ugga"]}
               for y, d in by_year.items() if key in d["places"]}
        places.append({"id": key, "name": display_name(key),
                       "kind": "district" if kinds == {"district"} else "town", "aid": aid})
    totals = {}
    for y, d in by_year.items():
        towns = [p for p in d["places"].values() if p["kind"] == "town"]
        dists = [p for p in d["places"].values() if p["kind"] == "district"]
        totals[str(y)] = {"towns": len(towns), "districts": len(dists),
                          "ch70": sum(p["ch70"] for p in d["places"].values()),
                          "ugga": sum(p["ugga"] for p in d["places"].values()),
                          "townCh70": sum(p["ch70"] for p in towns),
                          "districtCh70": sum(p["ch70"] for p in dists)}
    out: dict[str, Any] = {"years": sorted(by_year), "totals": totals, "places": places}
    add_people(out)
    return out


def add_people(towns: dict[str, Any]) -> None:
    """Add residents, students and town-to-district membership to each place, where known."""
    residents, students = read_population(), read_students()
    kinds = {p["id"]: p["kind"] for p in towns["places"]}
    if residents:
        towns["residentsYear"] = TOWN_POPULATION_YEAR
    if students:
        towns["schoolYear"] = students["schoolYear"]
    for p in towns["places"]:
        key = p["id"]
        if p["kind"] == "town":
            if key in residents:
                p.update(residents[key])
            if students and key in students["byTown"]:
                p["students"] = students["byTown"][key]
                dists = [{"id": d, "students": m[key]} for d, m in students["members"].items()
                         if kinds.get(d) == "district" and key in m]
                if dists:
                    p["districts"] = sorted(dists, key=lambda d: (-d["students"], d["id"]))
        elif students and key in students["byDistrict"]:
            p["students"] = students["byDistrict"][key]
            mem = [{"id": t, "students": n} for t, n in students["members"].get(key, {}).items()
                   if kinds.get(t) == "town"]
            if mem:
                p["members"] = sorted(mem, key=lambda t: (-t["students"], t["id"]))
