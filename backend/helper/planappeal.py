"""My Medicare plan refused care or a drug. For a Medicare Advantage plan (Part C) or a Medicare
drug plan (Part D): the date to ask for the first appeal, how long the plan has to decide, when
to ask for a fast appeal, a request letter, and a statement the doctor can sign.

It never says the plan was wrong or that the appeal will win. Nothing is stored.
"""

import datetime as dt

from . import rules
from .i18n import _, as_of as _asof, english_date as _eng, listed as _listed, long_date as _long, note as _note, rows as _rows, tr as _tr
from .validate import InputError, _parse_date, as_mapping

PLANS = ("ma", "pd")
WHAT = {"ma": ("care", "payment", "partb_drug"), "pd": ("drug", "payment")}
WHAT_NAMES = {"care": "care I have not received yet", "payment": "payment for care or a drug I already received",
              "partb_drug": "a Part B drug", "drug": "a prescription drug I have not received yet"}
FIRST_LEVEL = {"ma": "reconsideration", "pd": "redetermination"}
PLAN_NAMES = {"ma": "Medicare Advantage plan", "pd": "Medicare drug plan"}
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")



def clean(raw, today):
    body = as_mapping(raw, "plan", _("The details could not be read. Enter them again."))
    problems = {}
    plan = body.get("plan")
    if plan not in PLANS:
        problems["plan"] = _("Choose the kind of plan that sent the notice.")
        plan = "ma"
    what = body.get("what")
    if what not in WHAT[plan]:
        problems["what"] = _("Choose what the plan refused.")
    notice = None
    try:
        notice = _parse_date(body.get("notice_date"))
        if notice > today or notice < today - dt.timedelta(days=3 * 365):
            problems["notice_date"] = _("Check the date printed on the plan's notice.")
    except (TypeError, ValueError):
        problems["notice_date"] = _("Enter the date printed on the plan's notice.")
    urgent = body.get("urgent")
    if urgent not in (True, False, None):
        problems["urgent"] = _("Choose yes or no.")
    if problems:
        raise InputError(problems)
    return {"plan": plan, "what": what, "notice_date": notice, "urgent": bool(urgent) and what != "payment"}


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = _rows("planappeal", today, rules_dir)
    f = clean(raw, today)
    p = f["plan"]
    dl_row = t["ma_deadline" if p == "ma" else "pd_deadline"]
    deadline = f["notice_date"] + dt.timedelta(days=dl_row["days"])
    left = (deadline - today).days
    times = t["ma_times" if p == "ma" else "pd_times"]
    used = [dl_row, times]
    steps = []
    if left >= 0:
        headline = _("Ask the plan for a %s by %s") % (_(FIRST_LEVEL[p]), _long(deadline))
    else:
        headline = _("The %d days to appeal ended on %s, but you can still ask") % (dl_row["days"], _long(deadline))
        steps.append(_("Send the request anyway and say why it is late (for example illness, or the notice reached you late). The plan can accept a late request for a good reason."))
    if f["urgent"]:
        if p == "ma":
            used.append(t["ma_fast"])
        steps.append(_("Ask for a fast appeal, by phone or in writing. Ask your doctor to call or write to the plan saying that waiting could seriously harm your health; with that, the plan must decide within 72 hours."))
    else:
        steps.append(_("Send the request to the address or fax number on the plan's notice, or call the plan. Keep a copy and write down the date and who you spoke to."))
    steps.append(_("Ask your doctor for a short signed statement (a draft is below) and any records that show why you need it. Send them with your request."))
    steps.append(_("Ask the plan for a free copy of your case file and the rule or guideline it used to say no."))
    nxt = t["ma_next" if p == "ma" else "pd_next"]
    used.append(nxt)
    steps.append(nxt["plain"])
    used.append(t["why"])
    return {
        "plan": p, "plan_name": _(PLAN_NAMES[p]), "what": f["what"], "first_level": _(FIRST_LEVEL[p]),
        "headline": headline, "deadline": deadline.isoformat(), "deadline_long": _long(deadline),
        "days_left": left, "urgent": f["urgent"], "steps": steps,
        "letter": _letter(f, deadline), "doctor": _doctor(f),
        "rules": _listed(used),
        "rules_as_of": _asof(rules_dir),
        "disclaimer": _note(_("This works out dates from the date you entered and Medicare's published appeal rules. Check the date and instructions on your plan's notice: they come first. It does not decide whether the plan was right. This is an independent tool, not a government agency, and not legal advice.")),
    }


def _letter(f, deadline):
    p = f["plan"]
    lines = ["To: [plan name], [the appeals address or fax number on the notice]", "Date: [today's date]",
             "Name: [your name]", "Medicare plan member ID: [from your plan card]", "",
             "Re: Request for %s%s" % (FIRST_LEVEL[p], " - FAST (expedited) appeal requested" if f["urgent"] else ""), "",
             "I am asking you to reconsider your decision dated %s to deny %s: [name the service, item or drug]." % (_eng(f["notice_date"]), WHAT_NAMES[f["what"]]), ""]
    if f["urgent"]:
        lines += ["Waiting for a standard decision could seriously harm my life, health or ability to regain function. I am asking for a fast decision. My doctor supports this request.", ""]
    lines += ["Why I need it: [in your own words, and what your doctor says]", "",
              "I am including: [doctor's statement, records, the plan's notice].", "",
              "Please also send me a free copy of my case file and the coverage rule or guideline you used.", "",
              "Phone: [your phone number]", "", "Signature: ____________________"]
    return "\n".join(lines)


def _doctor(f):
    lines = ["Statement from the prescribing or treating doctor", "",
             "Patient: [name]   Plan member ID: [from the plan card]", "",
             "I am treating this patient for [condition]. I %s [the service, item or drug] because [medical reason]." % ("prescribed" if f["what"] in ("drug", "partb_drug") else "ordered"),
             "[Other treatments tried, and why they did not work or cannot be used.]"]
    if f["urgent"]:
        lines.append("Applying the standard time frame could seriously jeopardize this patient's life, health or ability to regain maximum function. I ask for an expedited decision.")
    lines += ["", "Doctor: [name, NPI, phone]   Signature: ____________________   Date: ________"]
    return "\n".join(lines)
