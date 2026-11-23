"""Report-a-change builder: what must be reported to Social Security, how soon, and the words to do it.

Late reporting is the most common cause of overpayments, so this part works
before any letter exists. It never says a change need not be reported: where
it is unsure, it says to report. Where Social Security's booklets give no
fixed number of days, it gives none either.
"""

import datetime as dt

from . import rules
from .cessation import _long, _status
from .validate import InputError, _parse_date, as_mapping

BENEFITS = (
    ("retirement", "Retirement or survivors benefits"),
    ("disability", "Social Security disability benefits (SSDI)"),
    ("ssi", "Supplemental Security Income (SSI)"),
)
STATEMENT_IDS = ("what_changed",)
MAX_STATEMENT_CHARS = 2000
MAX_CHANGES = 12


def changes_for(benefit, table):
    """The changes offered for a benefit, in table order, as [{id, label}]."""
    return [{"id": r["id"][7:], "label": r["label"]} for r in table.values() if r["id"].startswith("change_") and benefit in r["applies_to"]]


def clean(raw, today):
    body = as_mapping(raw, "benefit", "Choose the benefit you get.")
    problems, out = {}, {}
    out["benefit"] = body.get("benefit")
    if out["benefit"] not in [k for k, _ in BENEFITS]:
        problems["benefit"] = "Choose the benefit you get."
    picked = body.get("changes")
    if not isinstance(picked, list) or not picked or len(picked) > MAX_CHANGES or not all(isinstance(c, str) for c in picked):
        problems["changes"] = "Tick at least one thing that changed."
    out["changes"] = picked if isinstance(picked, list) else []
    out["change_date"] = None
    if body.get("change_date") not in (None, ""):
        try:
            out["change_date"] = _parse_date(body.get("change_date"))
            if out["change_date"] > today + dt.timedelta(days=366):
                problems["change_date"] = "That date is more than a year away. Check the year."
            elif out["change_date"].year < 2000:
                problems["change_date"] = "That date looks too old. Check the year."
        except (TypeError, ValueError):
            problems["change_date"] = "Enter the date as month, day and year, or leave it empty."
    said = body.get("statements") or {}
    out["statements"] = {}
    if not isinstance(said, dict):
        problems["statements"] = "Send your own words as text."
    else:
        for key in STATEMENT_IDS:
            value = said.get(key)
            if value in (None, ""):
                continue
            if not isinstance(value, str) or len(value) > MAX_STATEMENT_CHARS:
                problems[key] = "Keep this under %d characters." % MAX_STATEMENT_CHARS
            else:
                out["statements"][key] = value.strip()
    if problems:
        raise InputError(problems)
    return out


def _ssi_report_by(change_date, row):
    """The 10th day after the end of the month the change happened in."""
    first_of_next = (change_date.replace(day=1) + dt.timedelta(days=32)).replace(day=1)
    return first_of_next + dt.timedelta(days=row["days_after_month_end"] - 1)


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    facts = clean(raw, today)
    table = rules.rows_as_of("reporting", today, rules_dir)
    benefit, ssi = facts["benefit"], facts["benefit"] == "ssi"
    offered = {c["id"] for c in changes_for(benefit, table)}
    unknown = [c for c in facts["changes"] if c not in offered]
    if unknown:
        raise InputError({"changes": "One of the changes is not on the list for this benefit."})

    items = []
    for cid in dict.fromkeys(facts["changes"]):
        r = table["change_" + cid]
        items.append({"id": cid, "label": r["label"], "when": "as soon as possible" if ssi else r["when"], "have_ready": r["have_ready"],
                      "see": r.get("see"), "online": ("change_" + cid) in table["online"]["only_for"] and not ssi, "source": table["more"]["booklets"][benefit]})

    deadline = None
    if ssi:
        d = table["ssi_deadline"]
        deadline = {"rule": d["plain"], "source": d["source"], "date": None, "days_left": None, "status": None,
                    "penalty": table["ssi_penalty"]["plain"]}
        if facts["change_date"]:
            by = _ssi_report_by(facts["change_date"], d)
            left, status = _status(by, today)
            deadline.update({"date": by.isoformat(), "days_left": left, "status": status, "label": "Report by this date"})
    timing = (table["ssi_deadline"] if ssi else table["title2_timing"])
    notes = [table["overpaid"]["plain"]]
    if deadline and deadline["status"] == "passed":
        notes.insert(0, "The date to report has passed. Report now anyway: a late report is better than none, and it limits how much you could be overpaid.")
    if not facts["change_date"] and ssi:
        notes.insert(0, "Add the date the change happened to see the last day to report it.")

    how_row = table["how"]
    how = ["Call %s (TTY %s), %s, or go to your local Social Security office. You can also report by mail." % (how_row["phone"], how_row["tty"], how_row["hours"]),
           "Have the Beneficiary Notice Control (BNC) number from a letter about your benefits ready. It is not your Social Security number.",
           "Write down the date, how you reported, the name of the person you spoke to and any confirmation number. If you mail it, keep a copy and proof of mailing."]
    if any(i["online"] for i in items):
        how.insert(1, table["online"]["plain"])

    said = facts["statements"].get("what_changed")
    when = " on %s" % _long(facts["change_date"]) if facts["change_date"] else ""
    label = dict(BENEFITS)[benefit]
    draft = ["Date of this report: %s" % _long(today),
             "I receive %s. I am reporting the following change%s%s:" % (label, "" if len(items) == 1 else "s", " that happened" + when if when else ""),
             ] + ["- %s" % i["label"] for i in items] + [
             "Details: %s" % (said or "[Write what changed, in your own words]"),
             "Please update my record and tell me in writing whether this changes my benefit."]
    documents = []
    for i in items:
        for d in i["have_ready"]:
            if d not in documents:
                documents.append(d)

    return {
        "benefit": {"id": benefit, "label": label},
        "changes": items,
        "timing": {"rule": timing["plain"], "source": timing["source"]},
        "deadline": deadline,
        "notes": notes,
        "more": {"text": table["more"]["plain"], "url": table["more"]["booklets"][benefit]},
        "rules_as_of": rules.rules_checked_as_of(rules_dir),
        "kit": {
            "title": "Your change report",
            "summary": "Report %s to Social Security%s." % ("this change" if len(items) == 1 else "these %d changes" % len(items),
                                                           " by %s" % _long(dt.date.fromisoformat(deadline["date"])) if deadline and deadline["date"] else " promptly"),
            "draft": draft,
            "how": how,
            "have_ready": documents,
            "record": ["Date I reported", "How I reported (phone, office, mail, online)", "Name of the person I spoke to", "Confirmation or reference number", "What they told me"],
            "record_note": "Fill this in by hand when you report and keep it. If you are ever told you were paid too much, a record of when you reported can support a request to waive repayment.",
            "office_locator": how_row["office_locator"],
            "disclaimer": "This report was made by an independent tool. It is not from the Social Security Administration, it is not legal advice, and nothing in it has been sent to Social Security.",
        },
    }
