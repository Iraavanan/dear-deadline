"""Letter catalogue: common letters about Social Security and Medicare.

For each letter: what it is, whether a deadline applies, and the first thing to
do. Four letters have their own full helper; the rest get a page here, with
dates worked out where the official source gives a number of days. Where the
source gives none, the page says to follow the date printed on the letter.
It never says a letter can be ignored and never judges how an appeal would go.
"""

import datetime as dt

from . import rules
from .cessation import _item, _long
from .deadlines import _moved
from .workdays import why_closed


def _workdays_before(day, n):
    """The date n business days before a day, skipping weekends and federal holidays."""
    while n > 0:
        day -= dt.timedelta(days=1)
        if not why_closed(day):
            n -= 1
    return day
from .validate import InputError, _parse_date, as_mapping

GROUPS = (("ssa", "Social Security"), ("medicare", "Medicare"))
SSA_SITES = ("https://www.ssa.gov/", "https://secure.ssa.gov/")
PUBLIC = ("id", "group", "title", "cue", "plain", "do", "source", "helper", "see", "see_label", "chip", "forms", "contact", "date", "urgent")


def catalogue(today=None, rules_dir=None):
    """Every letter, in table order, with what the finder needs to list it."""
    table = rules.rows_as_of("letters", today or dt.date.today(), rules_dir)
    return [{"id": r["id"], "group": r["group"], "title": r["title"], "cue": r["cue"], "chip": r.get("chip"), "helper": r.get("helper"),
             "has_dates": bool(r.get("clocks")), "has_kit": bool(r.get("kit"))} for r in table.values()]


RECORD = ["Date I sent it or called", "How (mail, fax, phone, online, in person)", "Name of the person I dealt with", "Confirmation or reference number", "What they told me"]
WHY_LABEL = "Why you disagree, in your own words"
MAX_CHARS = 2000


def _said(body):
    said = body.get("statements") or {}
    if not isinstance(said, dict):
        raise InputError({"statements": "Send your own words as text."})
    out, problems = {}, {}
    for key in ("about", "why", "late"):
        value = said.get(key)
        if value in (None, ""):
            continue
        if not isinstance(value, str) or len(value) > MAX_CHARS:
            problems[key] = "Keep this under %d characters." % MAX_CHARS
        else:
            out[key] = value.strip()
    if problems:
        raise InputError(problems)
    return out


def _kit(row, day, late, said, today):
    """The request in the person's own words, what to send with it, how to send it, and a record to fill in by hand."""
    k, medicare = row["kit"], row["group"] == "medicare"
    about = said.get("about") or "[Write this in your own words]"
    why = said.get("why") or "[Write your reasons in your own words]"
    if k["kind"] == "call":
        draft = [k["script"], "My services are due to end on %s." % _long(day) if day and row["id"] == "nomnc" else ("The hospital plans to discharge me on %s." % _long(day) if day else "[Say the date printed on your notice.]"),
                 "What this is about: %s" % about, "Why I think it is too soon: %s" % why]
    else:
        draft = ["Date: %s" % _long(today), "To: " + k["to"][0].upper() + k["to"][1:],
                 "I am asking for %s of the decision in the %s%s." % (k["ask"], "notice" if medicare else "letter", " dated %s" % _long(day) if day else ""),
                 "What this is about: %s" % about, "Why I disagree: %s" % why]
        if late:
            draft.append("Why this request is late: %s" % (said.get("late") or "[Write the reason in your own words]"))
        draft += ["My name and %s: [write these by hand on the copy you send]" % ("Medicare number" if medicare else "the number shown on my letter"), "Signature: ____________________"]
    return {"kind": k["kind"], "title": "What to say on the call" if k["kind"] == "call" else "Your request", "draft": draft, "include": k["include"], "how": k["how"], "record": RECORD,
            "record_note": "Fill this in by hand and keep it with a copy of what you sent. If anyone later says nothing was received, this is your record.",
            "disclaimer": "This was made by an independent tool. It is not from the Social Security Administration or Medicare, it is not legal advice, and nothing in it has been sent to anyone."}


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    body = as_mapping(raw, "letter", "Choose a letter from the list.")
    table = rules.rows_as_of("letters", today, rules_dir)
    row = table.get(body.get("letter")) if isinstance(body.get("letter"), str) else None
    if row is None:
        raise InputError({"letter": "Choose a letter from the list."})
    out = {"letter": {k: row[k] for k in PUBLIC if k in row}, "dates": None, "rules_as_of": rules.rules_checked_as_of(rules_dir)}
    out["letter"]["has_dates"] = bool(row.get("clocks"))
    out["letter"]["kit_form"] = {"kind": row["kit"]["kind"], "about_label": row["kit"]["about_label"], "why_label": WHY_LABEL} if row.get("kit") else None
    wants_kit = body.get("kit") is True
    if wants_kit and not row.get("kit"):
        raise InputError({"kit": "This letter has no request to build."})
    said = _said(body) if wants_kit else {}
    given = body.get("date")
    if given in (None, ""):
        if wants_kit:
            out["kit"] = _kit(row, None, False, said, today)
        return out
    if not row.get("clocks"):
        raise InputError({"date": "This letter has no date to work out. Follow the date printed on it."})
    try:
        day = _parse_date(given)
    except (TypeError, ValueError):
        raise InputError({"date": "Enter the date as month, day and year."})
    if row["date"]["future"]:
        ahead = row["date"].get("max_ahead", 120)
        if (day - today).days > ahead or (today - day).days > 120:
            raise InputError({"date": "That date is %s from today. Check it." % ("more than four months away" if ahead <= 120 else "too far")})
    elif day > today:
        raise InputError({"date": "That date is in the future. Enter the date printed on the letter."})
    elif day.year < 2000:
        raise InputError({"date": "That date looks too old. Check the year."})
    items = []
    for c in row["clocks"]:
        due, extra = day + dt.timedelta(days=c["days"]), ""
        if c.get("workdays"):
            due = _workdays_before(day, -c["workdays"])
        if c["id"] == "appeal_latest" and row["source"].startswith(SSA_SITES):      # Social Security's rule; not applied to Medicare, where it has not been checked
            due, extra = _moved(due, today)
        items.append(_item(c["id"], c["label"], due, today, {"plain": c["rule"], "source": c.get("source", row["source"])}, c["note"] + extra))
    first, last = items[0], items[-1]
    if last["status"] == "passed":
        advice = "This date has passed. Ask anyway, straight away, and explain why you are late. More time is sometimes given for a good reason."
    elif first["status"] == "passed":
        advice = "The first date has passed, but a later one may still apply. Act as soon as you can."
    else:
        advice = "You are inside the time limit. If your letter prints a different last day, use the date on your letter."
    out["dates"] = {"from": day.isoformat(), "today": today.isoformat(), "items": items, "advice": advice}
    if wants_kit:
        out["kit"] = _kit(row, day, last["status"] == "passed", said, today)
    return out
