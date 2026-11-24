"""Does this doctor's bill match my Medicare Summary Notice? (Original Medicare.)

The person copies a few figures from each paper: the service date on each, the
most the notice says they may be billed for that service, what the bill asks for
now and anything already paid. The tool lines them up and says what matches,
what does not, and what to ask the billing office.

It never says a bill is wrong or that nothing is owed. It says where the papers
disagree, what the rules say, and what to ask. Nothing about the person is needed:
no name, no Medicare number, no account number.
"""

import datetime as dt

from . import rules
from .amount import _amount, money
from .i18n import _, as_of as _asof, long_date as _say, note as _note, rows as _rows
from .validate import InputError, _parse_date, as_mapping

CHOICES = {
    "on_msn": ("yes", "no", "unsure"),
    "approved": ("yes", "no", "unsure"),
    "qmb": ("yes", "no", "unsure"),
    "other_insurance": ("none", "medigap", "medicaid", "employer", "unsure"),
    "waiting": ("yes", "no", "unsure"),
}


def clean(raw, today):
    body = as_mapping(raw, "bill", _("The details could not be read. Enter them again."))
    problems, f = {}, {}
    for key, allowed in CHOICES.items():
        v = body.get(key)
        if v in (None, ""):
            v = "unsure" if key != "other_insurance" else "unsure"
        if v not in allowed:
            problems[key] = _("Choose one of the answers.")
        f[key] = v
    for key in ("bill_service_date", "msn_service_date"):
        v = body.get(key)
        f[key] = None
        if v in (None, ""):
            continue
        try:
            d = _parse_date(v)
        except (TypeError, ValueError):
            problems[key] = _("Enter the date as month, day and year, or leave it empty.")
            continue
        if d > today or d.year < 2000:
            problems[key] = _("Check the date of the service.")
        f[key] = d
    if not f["bill_service_date"] and "bill_service_date" not in problems:
        problems["bill_service_date"] = _("Enter the date of the service on the bill.")
    f["balance"] = _amount(body.get("balance"), "balance", problems)
    if f["balance"] is None and "balance" not in problems:
        problems["balance"] = _("Enter the amount the bill asks you to pay now. Enter 0 if it asks for nothing.")
    f["paid"] = _amount(body.get("paid"), "paid", problems)
    f["maximum"] = _amount(body.get("maximum"), "maximum", problems)
    if f["on_msn"] == "yes" and not f["msn_service_date"] and "msn_service_date" not in problems:
        problems["msn_service_date"] = _("Enter the date of the service on the notice.")
    if problems:
        raise InputError(problems)
    return f


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    f = clean(raw, today)
    t = _rows("bill", today, rules_dir)
    findings, questions, steps = [], [], []
    owed_now = f["balance"] + (f["paid"] or 0)            # everything the provider is asking of you for this service
    status = "compare"
    comparison = None

    if f["on_msn"] != "yes":
        status = "not_on_notice"
        findings.append({"kind": "not_on_notice", "text": _("This service is not on a Medicare Summary Notice you have.") if f["on_msn"] == "no"
                         else _("You are not sure this service is on your Medicare Summary Notice.")})
        steps.append(t["msn_timing"]["plain"])
        questions.append(_("Have you sent this claim to Medicare? On what date, and what did Medicare decide?"))
        questions.append(_("Can you hold this bill until Medicare and any other insurance have processed the claim?"))
    else:
        if f["msn_service_date"] and f["bill_service_date"] != f["msn_service_date"]:
            status = "dates_differ"
            findings.append({"kind": "dates", "text": _("The bill is for a service on %s, but the line you are comparing on the notice is for %s. They may be different visits. Find the line on the notice with the same date and provider.") % (
                _say(f["bill_service_date"]), _say(f["msn_service_date"]))})
            questions.append(_("Which date of service is this bill for, and which line of my Medicare Summary Notice does it match?"))
        if f["approved"] == "no":
            status = "denied" if status == "compare" else status
            findings.append({"kind": "denied", "text": _("The notice says Medicare did not approve this service. The bill may be for the whole charge.")})
            steps.append(t["msn_compare"]["plain"])
            steps.append(t["appeal"]["plain"])
            questions.append(_("Medicare did not approve this service. Did you send the right codes and information, and will you send the claim again?"))
            questions.append(_("Did I sign a notice before the service saying Medicare might not pay (an Advance Beneficiary Notice)? Please send me a copy."))
        if f["qmb"] == "yes":
            status = "qmb" if status in ("compare", "denied") else status
            findings.append({"kind": "qmb", "text": _("You said your notice shows you are in the QMB program. ") + t["qmb"]["plain"].split(_(". Since"))[0] + "."})
            steps.append(t["qmb_tip"]["plain"])
            if owed_now > 0:
                questions.append(_("My Medicare Summary Notice shows I am in the Qualified Medicare Beneficiary program. Please take the Medicare deductible and coinsurance off this bill and bill the state Medicaid program instead."))
        if f["maximum"] is None:
            findings.append({"kind": "missing", "text": _("You did not enter the most the notice says you may be billed, so the bill cannot be compared with it. On the notice it is in the column \"Maximum You May Be Billed\" for this service.")})
        elif status not in ("dates_differ",):
            gap = round(owed_now - f["maximum"], 2)
            comparison = {"maximum": f["maximum"], "balance": f["balance"], "paid": f["paid"], "asked": round(owed_now, 2), "gap": gap}
            if gap > 0.005:
                comparison["status"] = "higher"
                findings.append({"kind": "higher", "text": _("The bill asks for %s in all%s, which is %s more than the %s the notice says you may be billed for this service.") % (
                    money(owed_now), (_(" (%s now and %s already paid)") % (money(f["balance"]), money(f["paid"]))) if f["paid"] else "", money(gap), money(f["maximum"]))})
                questions.append(_("My Medicare Summary Notice says the most I may be billed for the service on %s is %s. Your bill asks for %s. Can you explain the difference of %s, or correct the bill?") % (
                    _say(f["bill_service_date"]), money(f["maximum"]), money(owed_now), money(gap)))
                if f["paid"]:
                    questions.append(_("If I have paid more than I owe for this service, when will you refund %s?") % money(min(gap, f["paid"])))
            elif gap < -0.005:
                comparison["status"] = "lower"
                findings.append({"kind": "lower", "text": _("The bill asks for %s in all, %s less than the most the notice allows. Other insurance may have paid part of it, or the provider took a payment off.") % (money(owed_now), money(-gap))})
            else:
                comparison["status"] = "same"
                findings.append({"kind": "same", "text": _("The bill asks for %s in all, the same as the most the notice says you may be billed.") % money(owed_now)})
        if f["other_insurance"] in ("medigap", "medicaid", "employer") and owed_now > 0:
            name = {"medigap": _("your Medicare Supplement (Medigap) policy"), "medicaid": "Medicaid", "employer": _("your employer or retiree plan")}[f["other_insurance"]]
            if f["waiting"] == "yes":
                findings.append({"kind": "waiting", "text": _("The bill says it is waiting for other insurance. The amount may change once %s has paid.") % name})
            else:
                questions.append(_("I also have %s. Have you sent this claim to them? Please do before billing me.") % name.replace(_("your "), _("my ")))
        elif f["waiting"] == "yes":
            findings.append({"kind": "waiting", "text": _("The bill says it is waiting for other insurance. The amount may change once that insurance has paid.")})

    headline = {
        "not_on_notice": _("This bill cannot be checked against Medicare yet"),
        "dates_differ": _("The bill and the notice may be for different visits"),
        "denied": _("Medicare did not approve this service"),
        "qmb": _("You may be protected from this bill"),
    }.get(status)
    if headline is None:
        if comparison is None:
            headline = _("Enter the most you may be billed to compare")
        else:
            headline = {"higher": _("The bill asks for more than your notice allows"),
                        "lower": _("The bill asks for less than your notice allows"),
                        "same": _("The bill matches your notice")}[comparison["status"]]
    if status == "qmb" and comparison and comparison["status"] == "higher":
        headline = _("You may be protected from this bill")
    if not questions:
        questions.append(_("Can you confirm this bill is final, and that Medicare and any other insurance have paid their part?"))
    script = ["Hello. I am calling about a bill for a service on %s." % _say(f["bill_service_date"]),
              "I am comparing it with my Medicare Summary Notice."] + ["- " + q for q in questions] + [
              "Can you put any correction in writing, and hold the bill while it is checked?",
              "May I have your name, and a reference number for this call?"]
    return {
        "headline": headline, "status": status, "comparison": comparison, "findings": findings, "steps": steps,
        "questions": questions, "script": script,
        "rules": {k: {"plain": v["plain"], "source": v["source"]} for k, v in t.items()},
        "rules_as_of": _asof(rules_dir),
        "disclaimer": _note(_("This compares the figures you entered. It was made by an independent tool, not by Medicare or your provider, and it is not legal advice. Only the provider can correct a bill.")),
    }
