"""Keeping SNAP and Medicaid: the 80-hour rules, month by month, and a missed SNAP interview.

Three things, all from what the person enters, nothing stored:
- which exemptions may apply (never "you are exempt": the state decides),
- for each month entered, whether the hours or income reach the rule, and which
  SNAP months count toward the 3-month limit,
- after a missed SNAP interview, the dates the federal rules give.
A state's own notice governs its details. Florida's contacts are added when chosen, and for five
states that expanded Medicaid (CA, NY, PA, OH, MI) the Medicaid start, reporting route and hearing
time limit are added from the state's own pages.
"""

import datetime as dt

from . import rules
from .amount import _amount, _month, _say_month, money
from .validate import InputError, _parse_date, as_mapping

PROGRAMS = ("snap", "medicaid")
PACKS = ("CA", "NY", "PA", "OH", "MI")       # states that expanded Medicaid, with their own details added
STATES = ("FL",) + PACKS + ("other",)
HOURS = 80
MAX_MONTHS = 12


def _hours(value, key, problems):
    if value in (None, ""):
        return 0.0
    try:
        v = float(str(value).strip())
    except ValueError:
        problems[key] = "Enter a number of hours, like 20."
        return 0.0
    if v < 0 or v > 744:
        problems[key] = "Enter between 0 and 744 hours (the hours in a month)."
        return 0.0
    return round(v, 2)


def clean(raw, today):
    body = as_mapping(raw, "programs", "The details could not be read. Enter them again.")
    problems = {}
    programs = body.get("programs")
    if not isinstance(programs, list) or not programs or any(p not in PROGRAMS for p in programs):
        problems["programs"] = "Choose SNAP, Medicaid or both."
        programs = []
    state = body.get("state") or "other"
    if state not in STATES:
        problems["state"] = "Choose a state."
    ex = body.get("exemptions") or {}
    if not isinstance(ex, dict):
        raise InputError({"exemptions": "The answers could not be read. Choose them again."})
    months_in = body.get("months") or []
    if not isinstance(months_in, list) or len(months_in) > MAX_MONTHS:
        raise InputError({"months": "Enter up to %d months." % MAX_MONTHS})
    months, seen = [], set()
    for i, m in enumerate(months_in, start=1):
        if not isinstance(m, dict):
            raise InputError({"months": "A month could not be read. Enter it again."})
        key = "m%d_" % i
        if all(m.get(k) in (None, "", False) for k in ("month", "work", "volunteer", "program", "earnings", "school")):
            continue
        got = {"n": i}
        try:
            got["ym"] = _month(m.get("month"))
            if got["ym"] in seen:
                problems[key + "month"] = "This month is entered twice."
            seen.add(got["ym"])
            if dt.date(got["ym"][0], got["ym"][1], 1) > today:
                problems[key + "month"] = "Enter a month that has started."
        except ValueError:
            problems[key + "month"] = "Enter the month and year, like 09/2026."
        for k in ("work", "volunteer", "program"):
            got[k] = _hours(m.get(k), key + k, problems)
        got["earnings"] = _amount(m.get("earnings"), key + "earnings", problems)
        got["school"] = m.get("school") is True
        got["snap"] = m.get("snap") is True
        months.append(got)
    if problems:
        raise InputError(problems)
    months.sort(key=lambda g: g["ym"])
    return {"programs": programs, "state": state, "exemptions": {p: [k for k in (ex.get(p) or []) if isinstance(k, str)] for p in PROGRAMS}, "months": months}


def _items(row):
    return {k: text for k, text in row["items"]}


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    f = clean(raw, today)
    t = rules.rows_as_of("workrules", today, rules_dir)
    packs = rules.rows_as_of("medicaid_states", today, rules_dir)
    out = {"programs": f["programs"], "state": f["state"], "sections": []}
    income_line = t["medicaid_rule"]["income"]

    for program in f["programs"]:
        exempt_row = t[program + "_exemptions"]
        names = _items(exempt_row)
        chosen = [k for k in f["exemptions"][program] if k in names]
        sec = {"program": program, "may_apply": [names[k] for k in chosen], "months": [], "rules": [], "notes": []}
        if program == "snap":
            sec["title"] = "SNAP (food assistance)"
            sec["rules"] = [t[k] for k in ("snap_limit", "snap_work", "snap_countable", "snap_regain", "snap_removed")]
            if f["state"] == "FL":
                sec["rules"] += [t["snap_florida_waiver"], t["snap_florida"]]
            elif f["state"] in PACKS:
                sec["notes"].append({"plain": "SNAP contacts for %s are not added yet. Your state's SNAP notice says who to tell and how." % packs[f["state"]]["name"], "source": t["snap_limit"]["source"]})
        else:
            sec["title"] = "Medicaid"
            if f["state"] == "FL":
                sec["notes"].append(t["medicaid_florida"])
            else:
                if f["state"] in PACKS:
                    p = packs[f["state"]]
                    sec["title"] = "%s (%s)" % (p["program"], p["name"]) if p["program"] != "Medicaid" else "Medicaid (%s)" % p["name"]
                    sec["notes"] += [{"plain": p["start"], "source": p["source"]}, {"plain": p["report"], "source": p["source"]}]
                sec["notes"].append(packs["hold"])
            sec["rules"] = [t[k] for k in ("medicaid_rule", "medicaid_lookback", "medicaid_notice", "medicaid_hardship")]
        countable = 0
        skip = program == "medicaid" and f["state"] == "FL"    # the rule does not apply there, so months are not sorted for it
        for m in ([] if skip else f["months"]):
            if program == "snap":
                hours = m["work"] + m["volunteer"] + m["program"]
                met = hours >= HOURS
                row = {"month": _say_month(m["ym"]), "hours": hours, "met": met, "short": 0 if met else round(HOURS - hours, 2),
                       "how": "%s hours of work, volunteering and work program" % _num(hours)}
                if m["snap"] and not met and not chosen:
                    countable += 1
                    row["countable"] = True
                row["got_snap"] = m["snap"]
            else:
                hours = m["work"] + m["volunteer"] + m["program"]
                by_income = m["earnings"] is not None and m["earnings"] >= income_line
                met = hours >= HOURS or m["school"] or by_income
                how = ("at least half-time in school" if m["school"] else
                       ("monthly income of %s, at least %s" % (money(m["earnings"]), money(income_line)) if by_income and hours < HOURS else
                        "%s hours of work, community service and work program" % _num(hours)))
                row = {"month": _say_month(m["ym"]), "hours": hours, "met": met, "short": 0 if met else round(HOURS - hours, 2), "how": how}
            sec["months"].append(row)
        if program == "snap":
            sec["countable"] = countable
            if chosen:
                sec["summary"] = "You ticked an exemption that may apply. If DCF or your state agrees, your months do not count toward the limit. Tell them and send proof." if f["state"] == "FL" else \
                    "You ticked an exemption that may apply. If your state agrees, your months do not count toward the limit. Tell them and send proof."
            elif f["months"]:
                sec["summary"] = ("%d of the months you entered may count toward the 3-month limit." % countable) if countable else \
                    "None of the months you entered count toward the 3-month limit, because you met 80 hours or did not get SNAP in them."
                if countable >= 3:
                    sec["summary"] += " After 3 counted months in 3 years, SNAP can stop until you work or take part in a work program for 80 hours in 30 days in a row, or become exempt."
            else:
                sec["summary"] = "Add your months to see which may count toward the 3-month limit."
        else:
            short = [r for r in sec["months"] if not r["met"]]
            if f["state"] == "FL":
                sec["summary"] = "This rule does not apply to Florida Medicaid."
            elif chosen:
                sec["summary"] = "You ticked an exemption that may apply. Tell your state and send proof, so it can record it before your next renewal."
            elif not f["months"]:
                sec["summary"] = "Add your months to see whether each one reaches 80 hours or the income amount."
            elif short:
                sec["summary"] = "%d of the months you entered are short of 80 hours and the income amount." % len(short)
            else:
                sec["summary"] = "Every month you entered reaches 80 hours, school, or the income amount."
        out["sections"].append(sec)

    proof = ["Pay stubs, or a letter from your employer with your hours for each month",
             "For volunteering, a signed letter from the organization with the dates and hours",
             "For a work or training program, the attendance record or a letter from the program",
             "For an exemption, the paper that shows it: a doctor's note, a school enrollment letter, a child's birth certificate or school record, or a benefit letter"]
    out["proof"] = proof
    out["letter"] = _letter(f, out)
    out["hearing"] = {"plain": t["fl_hearing"]["plain"], "source": t["fl_hearing"]["source"]} if f["state"] == "FL" else None
    out["contact"] = t["snap_florida"]["phone"] if f["state"] == "FL" else None
    out["contact_name"] = "Florida DCF" if f["state"] == "FL" else None
    if f["state"] in PACKS and "medicaid" in f["programs"]:
        p = packs[f["state"]]
        out["hearing"] = {"plain": " ".join((p["hearing_plain"], p["keep_plain"], p["hearing_how"])), "source": p["hearing_source"]}
        out["contact"] = p["phone"]
        out["contact_name"] = "%s %s" % (p["name"], p["program"])
        out["state_info"] = {"name": p["name"], "program": p["program"], "info": p["info"], "portal": p["portal"]}
    out["rules_as_of"] = rules.rules_checked_as_of(rules_dir)
    out["headline"] = _headline(out)
    out["disclaimer"] = "This sorts the hours and answers you entered against the published rules. It was made by an independent tool, not by any government agency. Only the agency decides whether you meet a rule or an exemption."
    for sec in out["sections"]:
        sec["rules"] = [{"plain": r["plain"], "source": r["source"]} for r in sec["rules"]]
        sec["notes"] = [{"plain": r["plain"], "source": r["source"]} for r in sec["notes"]]
    out["state_name"] = "Florida" if f["state"] == "FL" else packs[f["state"]]["name"] if f["state"] in PACKS else None
    return out


def _num(v):
    return str(int(v)) if float(v).is_integer() else str(v)


def _headline(out):
    snap = next((s for s in out["sections"] if s["program"] == "snap"), None)
    if snap and snap["may_apply"]:
        return "An exemption may apply to you"
    if snap and snap.get("countable", 0) >= 3:
        return "Your SNAP may stop under the time limit"
    if any(not r["met"] for s in out["sections"] for r in s["months"]):
        return "Some months are short of 80 hours"
    if any(s["months"] for s in out["sections"]):
        return "Your months reach the rule"
    return "What the 80-hour rules ask of you"


def _letter(f, out):
    lines = ["To: %s" % ("Florida Department of Children and Families (ACCESS Florida)" if f["state"] == "FL" else "[the agency that sent your notice]"),
             "Date: [today's date]", "Name: [your name]", "Case number: [from your notice]", ""]
    for sec in out["sections"]:
        if sec["may_apply"]:
            lines.append("I am writing about the work rules for %s. I believe I am exempt because:" % sec["title"])
            lines += ["- " + x for x in sec["may_apply"]]
            lines.append("I have attached proof. Please record the exemption and tell me in writing if you need anything else.")
            lines.append("")
        met = [r for r in sec["months"] if r["met"]]
        if met:
            lines.append("For %s, I met the requirement in these months:" % sec["title"])
            lines += ["- %s: %s" % (r["month"], r["how"]) for r in met]
            lines.append("Proof for each month is attached.")
            lines.append("")
    lines += ["Please confirm in writing that you have received this.", "", "Signature: ____________________"]
    return "\n".join(lines)


def interview(raw, today=None, rules_dir=None):
    """A missed SNAP interview: the dates the federal rules give, from the day of applying."""
    today = today or dt.date.today()
    body = as_mapping(raw, "applied", "The dates could not be read. Enter them again.")
    problems = {}
    try:
        applied = _parse_date(body.get("applied"))
        if applied > today or applied < today - dt.timedelta(days=400):
            problems["applied"] = "Check the date you applied."
    except (TypeError, ValueError):
        problems["applied"] = "Enter the date you applied, as month, day and year."
        applied = None
    state = body.get("state") or "other"
    if state not in STATES:
        problems["state"] = "Choose a state."
    if problems:
        raise InputError(problems)
    t = rules.rows_as_of("workrules", today, rules_dir)
    day30 = applied + dt.timedelta(days=30)
    left = (day30 - today).days
    if left > 0:
        headline = "You have until %s to reschedule" % _long(day30)
        status = "open"
    elif left == 0:
        headline = "Today is day 30. Call today"
        status = "today"
    else:
        headline = "Day 30 has passed. You can apply again"
        status = "passed"
    steps = []
    if status != "passed":
        steps.append("Call the number on your missed-interview notice today and ask for a new interview time. Say when you can answer the phone.")
        steps.append("Write down the date, the time, who you spoke to, and the new interview time.")
        steps.append("Send any proof the notice asks for at the same time, so it is ready for the interview.")
    else:
        steps.append("If you got a denial notice, you can apply again. The new application starts a new 30 days.")
        steps.append("If you contacted the agency before day 30 and were not given a new interview, you can ask for a fair hearing about the denial.")
    script = ["Hello. I applied for SNAP on %s and missed my interview." % _long(applied),
              "I would like to schedule a new interview. I can take a call on [days and times].",
              "Can you tell me what proof you still need from me, and the date it is due?",
              "May I have your name, and a reference number for this call?"]
    return {"headline": headline, "status": status, "applied": applied.isoformat(), "day30": day30.isoformat(), "days_left": left,
            "steps": steps, "script": script,
            "rules": [{"plain": t[k]["plain"], "source": t[k]["source"]} for k in ("interview_missed", "interview_denial", "verification")],
            "contact": t["snap_florida"]["phone"] if state == "FL" else None,
            "hearing": {"plain": t["fl_hearing"]["plain"], "source": t["fl_hearing"]["source"]} if state == "FL" else None,
            "rules_as_of": rules.rules_checked_as_of(rules_dir),
            "disclaimer": "These dates come from federal SNAP rules. Your notice may give an earlier date: if it does, use the date on your notice. This is an independent tool, not a government agency."}


def _long(d):
    return "%s %d, %d" % (("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")[d.month - 1], d.day, d.year)
