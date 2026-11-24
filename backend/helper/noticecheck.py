"""Is my overpayment notice complete? Social Security's own rules list what every initial
overpayment notice must contain. The person says, for each part, whether their notice has it.
This sorts the answers, explains each gap with its rule, and drafts a request for a written
explanation.

It never says the money is not owed, and never says a notice is complete: only that the
person's answers show every listed part. Nothing is stored.
"""

import datetime as dt

from . import deadlines, rules
from .i18n import _, as_of as _asof, english_date as _eng, listed as _listed, long_date as _long, note as _note, rows as _rows, tr as _tr
from .validate import InputError, _parse_date, as_mapping

PROGRAMS = ("t2", "ssi", "unsure")
ANSWERS = ("yes", "no", "unsure")
NAMES = {"t2": "retirement, survivor or disability benefits", "ssi": "SSI (Supplemental Security Income)", "unsure": "Social Security benefits"}
PARTS = ("total", "months", "paid_due", "cause", "recon", "waiver", "refund", "withholding", "start", "options")



def parts_for(program, t):
    """The parts that apply: for 'not sure', every part either program requires."""
    want = ("t2", "ssi") if program == "unsure" else (program,)
    return [t[k] for k in PARTS if any(p in t[k]["applies"] for p in want)]


def clean(raw, today, t):
    body = as_mapping(raw, "program", _("The answers could not be read. Choose them again."))
    problems = {}
    program = body.get("program")
    if program not in PROGRAMS:
        problems["program"] = _("Choose the kind of benefit the notice is about.")
        program = "unsure"
    given = body.get("answers") or {}
    if not isinstance(given, dict):
        raise InputError({"answers": _("The answers could not be read. Choose them again.")})
    answers = {}
    for row in parts_for(program, t):
        a = given.get(row["id"])
        if a not in ANSWERS:
            problems[row["id"]] = _("Choose yes, no or not sure.")
        answers[row["id"]] = a
    notice_date = None
    if body.get("notice_date") not in (None, ""):
        try:
            notice_date = _parse_date(body.get("notice_date"))
            if notice_date > today or notice_date < today - dt.timedelta(days=3650):
                problems["notice_date"] = _("Check the date printed on the notice.")
        except (TypeError, ValueError):
            problems["notice_date"] = _("Enter the date as month, day and year.")
    if problems:
        raise InputError(problems)
    return {"program": program, "answers": answers, "notice_date": notice_date}


def _refs(row, program):
    want = ("t2", "ssi") if program == "unsure" else (program,)
    return ", ".join(row["refs"][p] for p in want if p in row["refs"])


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = _rows("noticecheck", today, rules_dir)
    f = clean(raw, today, t)
    program = f["program"]
    missing, unsure, present = [], [], []
    for row in parts_for(program, t):
        item = {"id": row["id"], "ask": _tr(row["ask"]), "missing": row["missing"], "rule": _refs(row, program),
                "sources": row["sources"] if program == "unsure" else [s for s in row["sources"] if (program == "t2") == ("0202" in s)]}
        {"no": missing, "unsure": unsure, "yes": present}[f["answers"][row["id"]]].append(item)

    if missing:
        headline = _("Your notice may be missing %d of the %d parts Social Security's rules require") % (len(missing), len(missing) + len(unsure) + len(present))
    elif unsure:
        headline = _("Check 1 part of your notice again") if len(unsure) == 1 else _("Check %d parts of your notice again") % len(unsure)
    else:
        headline = _("Your answers show every part the rules list")

    t2ish = program in ("t2", "unsure")
    rules_used = [t["audit"]]
    steps = []
    if missing or unsure:
        phone = _rows("kit", today, rules_dir)["contact"]["phone"]
        steps.append(_("Ask Social Security for a written explanation of the overpayment. You can call %s, visit your local office, or send the letter below. Keep a copy and note the date.") % phone)
        if t2ish:
            rules_used.append(t["explain"])
            if program == "unsure":
                steps.append(_("For retirement, survivor or disability benefits, Social Security's own procedure says it must stop collecting until it gives you the explanation. Ask them to confirm that collection is stopped."))
            else:
                steps.append(_("Social Security's own procedure says it must stop collecting until it gives you the explanation. Ask them to confirm that collection is stopped."))
            rules_used.append(t["new_notice"])
        steps.append(_("An explanation is not an appeal. If you think the overpayment is wrong, you can still ask for reconsideration (form SSA-561) within 60 days, or for a waiver (form SSA-632) at any time. The overpayment helper works out your dates."))
        rules_used.append(t["explain_deadline"])
    else:
        steps.append(_("A notice with every part can still have a wrong amount. Check the month-by-month figures, and see your dates for reconsideration and waiver."))

    letter = _letter(f, missing + unsure, t2ish, program)
    appeal_dates = []
    if f["notice_date"]:
        appeal_dates = [d for d in deadlines.compute(f["notice_date"], today, rules_dir)["items"]
                        if d["id"] in ("appeal", "appeal_latest")]
    return {
        "program": program, "program_name": _(NAMES[program]), "headline": headline,
        "missing": missing, "unsure": unsure, "present": present, "steps": steps, "appeal_dates": appeal_dates,
        "letter": letter if (missing or unsure) else None,
        "rules": _listed(rules_used),
        "rules_as_of": _asof(rules_dir),
        "disclaimer": _note(_("This compares your answers with the parts Social Security's rules say every overpayment notice must include. It does not decide whether you owe the money, and a notice with a missing part does not by itself cancel an overpayment. This is an independent tool, not a government agency, and not legal advice.")),
    }


def _letter(f, gaps, t2ish, program):
    when = _eng(f["notice_date"]) if f["notice_date"] else "[the date printed on the notice]"
    lines = ["To: Social Security Administration, [the office address on your notice]", "Date: [today's date]", "Name: [your name]",
             "Claim number: [copy it from your notice]", "",
             "Re: Request for a written explanation of an overpayment", "",
             "I received an overpayment notice dated %s about my %s. I am asking for a written explanation of the overpayment." % (when, NAMES[program]),
             "", "The notice does not clearly tell me:"]
    lines += ["- " + g["missing"] for g in gaps]
    lines += ["", "Please send me a written explanation that covers each of these."]
    if t2ish:
        lines.append("Under your procedure in POMS GN 02201.017, please stop recovery of this overpayment until I receive the explanation, and confirm this to me in writing.")
    lines += ["This request is not a waiver of my right to ask for reconsideration or a waiver.", "",
              "Phone: [your phone number]", "", "Signature: ____________________"]
    return "\n".join(lines)
