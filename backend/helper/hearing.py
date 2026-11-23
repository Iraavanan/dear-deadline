"""SNAP or Medicaid denied, cut or stopped: the hearing date, the earlier date to keep benefits
during the hearing, and a hearing request. Florida's time limit and contacts are built in, and
for Medicaid in five states that expanded it (CA, NY, PA, OH, MI) the state's own time limits come
from its rules. For other states only the federal rules are shown, and no number of days is
invented for Medicaid.

It never says to appeal or not to appeal. Keeping benefits during a hearing has a cost if the
hearing is lost, and both sides are set out.
"""

import datetime as dt

from . import rules
from .validate import InputError, _parse_date, as_mapping

PROGRAMS = ("snap", "medicaid")
ACTIONS = ("denied", "reduced", "stopped")
PACKS = ("CA", "NY", "PA", "OH", "MI")
STATES = ("FL",) + PACKS + ("other",)
NAMES = {"snap": "SNAP (food assistance)", "medicaid": "Medicaid"}


def _long(d):
    return "%s %d, %d" % (("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")[d.month - 1], d.day, d.year)


def clean(raw, today):
    body = as_mapping(raw, "program", "The details could not be read. Enter them again.")
    problems, f = {}, {}
    for key, allowed in (("program", PROGRAMS), ("action", ACTIONS), ("state", STATES)):
        f[key] = body.get(key)
        if f[key] not in allowed:
            problems[key] = "Choose one of the answers."
    f["plan"] = body.get("plan") is True
    for key, need in (("notice_date", True), ("effective_date", False)):
        v = body.get(key)
        f[key] = None
        if v in (None, ""):
            if need:
                problems[key] = "Enter the date printed on the notice."
            continue
        try:
            f[key] = _parse_date(v)
        except (TypeError, ValueError):
            problems[key] = "Enter the date as month, day and year."
            continue
    if f["notice_date"] and (f["notice_date"] > today or f["notice_date"] < today - dt.timedelta(days=730)):
        problems["notice_date"] = "Check the date printed on the notice."
    if f["notice_date"] and f["effective_date"] and f["effective_date"] < f["notice_date"]:
        problems["effective_date"] = "This is before the date of the notice. Check both dates."
    if problems:
        raise InputError(problems)
    return f


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    f = clean(raw, today)
    t = rules.rows_as_of("hearing", today, rules_dir)
    # A health plan's refusal of a service goes to the plan first, with its own time limits: the state's
    # eligibility-hearing days do not apply, so none are worked out for it.
    pack = rules.rows_as_of("medicaid_states", today, rules_dir).get(f["state"]) if f["program"] == "medicaid" and not f["plan"] else None
    dates, rule_rows, notes = [], [], []
    if f["program"] == "medicaid" and f["plan"] and f["state"] in PACKS:
        notes.append("When your Medicaid health plan refuses a service, you usually appeal to the plan first. The plan's decision letter says how long you then have to ask for a state hearing: use that date.")

    def add(d, label, note, rows):
        left = (d - today).days
        dates.append({"date": d.isoformat(), "label": label, "note": note, "days_left": left, "status": "passed" if left < 0 else ("today" if left == 0 else "upcoming"),
                      "sources": [{"plain": r["plain"], "source": r["source"]} for r in rows]})

    keep = f["action"] in ("reduced", "stopped")
    if keep and pack and pack["keep"]["kind"] == "after_notice":
        n = pack["keep"]["days"]
        add(f["notice_date"] + dt.timedelta(days=n), "Ask for a hearing by this date to keep your benefits the same while you wait",
            "%d days from the date on the notice, under %s's rule. If your notice gives a different date, use the notice." % (n, pack["name"]),
            [{"plain": pack["keep_plain"], "source": pack["keep_source"]}])
        rule_rows.append(t["medicaid_repay"])
    elif keep:
        if f["effective_date"]:
            last = f["effective_date"] - dt.timedelta(days=1)
            add(last, "Ask for a hearing by this date to keep your benefits the same while you wait",
                "The day before the change takes effect (%s). Asking earlier is safer." % _long(f["effective_date"]),
                [t["snap_continue"]] if f["program"] == "snap" else [t["medicaid_continue"]])
            if f["program"] == "medicaid":
                add(f["effective_date"] + dt.timedelta(days=10), "If you missed that: ask by this date and Medicaid may restore coverage until the decision",
                    "Ten days after the date of action. This one is up to the agency, not guaranteed.", [t["medicaid_reinstate"]])
        else:
            notes.append("Your notice should say the date the change takes effect. To keep your benefits the same while you wait for the hearing, ask before that date.")
        rule_rows.append(t["snap_repay"] if f["program"] == "snap" else t["medicaid_repay"])

    if f["state"] == "FL":
        add(f["notice_date"] + dt.timedelta(days=t["fl_deadline"]["days"]), "Last day to ask for a fair hearing",
            "90 days from the date on the Notice of Case Action.", [t["fl_deadline"], t["fl_rule"]])
        if f["program"] == "medicaid" and f["plan"]:
            notes.append(t["fl_plan_first"]["plain"])
            rule_rows.append(t["fl_plan_first"])
    elif pack:
        add(f["notice_date"] + dt.timedelta(days=pack["hearing_days"]), "Last day to ask for a hearing",
            "%d days from the date on the notice, under %s's rule." % (pack["hearing_days"], pack["name"]),
            [{"plain": pack["hearing_plain"], "source": pack["hearing_source"]}])
        if pack["keep"]["kind"] == "before_effective" and keep:
            notes.append(pack["keep_plain"])
    elif f["program"] == "snap":
        add(f["notice_date"] + dt.timedelta(days=t["snap_deadline"]["days"]), "Last day to ask for a fair hearing (federal rule)",
            "Counted 90 days from the date on the notice. If your state's notice gives a different date, use the notice.", [t["snap_deadline"]])
    else:
        notes.append("Your state sets the time limit for a Medicaid hearing, and your notice must say it. This tool does not guess it: use the date on your notice.")
    dates.sort(key=lambda x: x["date"])
    if f["program"] == "snap":
        rule_rows.append(t["snap_decision"])

    upcoming = [d for d in dates if d["status"] != "passed"]
    if not dates:
        headline = "Use the date on your notice to ask for a hearing"
    elif not upcoming:
        headline = "The dates worked out from your notice have passed"
    else:
        headline = "Ask for a hearing by %s" % _long(dt.date.fromisoformat(upcoming[0]["date"]))

    choice = None
    if keep:
        choice = {"title": "Keeping your benefits while you wait: two sides",
                  "keep": "If you ask in time, your %s can stay the same until the hearing decision. That protects you if the change was a mistake." % NAMES[f["program"]],
                  "risk": "If the hearing decision agrees with the agency, you may have to pay back what you got while waiting. You can say on the request that you do not want benefits to continue."}

    what = {"denied": "deny my application", "reduced": "reduce my benefits", "stopped": "stop my benefits"}[f["action"]]
    to = ("Appeal Hearings Section, Florida Department of Children and Families, 2415 North Monroe Street, Suite 400-I, Tallahassee, FL 32303-4190" if f["state"] == "FL"
          else pack["hearing_to"] if pack else "[the hearing office or address printed on your notice]")
    letter = ["To: %s" % to,
              "Date: [today's date]", "Name: [your name]", "Case number: [from your notice]", "Phone: [your phone]", "",
              "I am asking for a fair hearing about the %s notice dated %s, which says you will %s." % (NAMES[f["program"]], _long(f["notice_date"]), what),
              "I disagree because: [say in your own words why the decision is wrong]"]
    if keep:
        letter.append("I ask that my benefits continue at the same level until the hearing decision. [Delete this line if you do not want them to continue.]")
    letter += ["Please send me a copy of my case file and the evidence you used.", "", "Signature: ____________________"]
    return {
        "headline": headline, "dates": dates, "notes": notes, "choice": choice, "letter": "\n".join(letter),
        "contact": ({"plain": t["fl_contact"]["plain"], "source": t["fl_contact"]["source"]} if f["state"] == "FL"
                    else {"plain": pack["hearing_how"], "source": pack["how_source"]} if pack else None),
        "rules": [{"plain": r["plain"], "source": r["source"]} for r in rule_rows],
        "rules_as_of": rules.rules_checked_as_of(rules_dir),
        "disclaimer": "These dates come from the published rules and the dates you entered. If your notice gives an earlier date, use the notice. This is an independent tool, not a government agency, and it is not legal advice. Legal aid can help with hearings, often at no cost.",
    }
