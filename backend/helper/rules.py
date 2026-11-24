"""Loads the dated rule tables and picks the rows in force on a given date."""

import datetime as dt
import json
from pathlib import Path

RULES_DIR = Path(__file__).resolve().parents[2] / "rules"
TABLES = ("deadlines", "requests", "withholding", "kit", "cessation", "work", "denial", "reporting", "scam", "letters", "amount", "bill", "workrules", "renewal", "rent", "hearing", "utility", "wic", "noticecheck", "medicaid_states", "ssilimit", "planappeal", "diswait", "msp", "stolen", "lockout", "ssacall", "withhold", "procedural", "askedagain", "permission", "hearingnext", "medicaidend", "latefiling", "payday", "offset", "irmaa", "death", "reinstate", "ssihelp", "changed", "snapclaim", "vadebt", "cdr", "raover", "voucher", "estate", "partb", "fairness", "benefitmath")

REQUIRED_ROW_FIELDS = ("id", "source", "effective_from", "checked_on")


class RuleError(Exception):
    """A rule table is missing, malformed, or has no row in force."""


def load_table(name, rules_dir=None):
    path = Path(rules_dir or RULES_DIR) / (name + ".json")
    if not path.exists():
        raise RuleError("rule table not found: " + name)
    table = json.loads(path.read_text(encoding="utf-8"))
    for row in table.get("rows", []):
        for field in REQUIRED_ROW_FIELDS:
            if field not in row:
                raise RuleError("row %r in table %r lacks %r" % (row.get("id"), name, field))
    return table


def _in_force(row, on):
    start = row["effective_from"]
    return start is None or dt.date.fromisoformat(start) <= on


def rows_as_of(name, on, rules_dir=None):
    """Return {id: row} with, for each id, the newest row in force on `on`.

    A row with effective_from null has no known start date and is treated as
    always in force; a dated row for the same id replaces it from that date.
    """
    chosen = {}
    for row in load_table(name, rules_dir)["rows"]:
        if not _in_force(row, on):
            continue
        current = chosen.get(row["id"])
        if current is None or (row["effective_from"] or "") >= (current["effective_from"] or ""):
            chosen[row["id"]] = row
    return chosen


def rules_checked_as_of(rules_dir=None):
    """The oldest 'checked_on' date across all tables: the honest 'rules as of' date."""
    dates = []
    for name in TABLES:
        for row in load_table(name, rules_dir)["rows"]:
            dates.append(row["checked_on"])
    return min(dates)
