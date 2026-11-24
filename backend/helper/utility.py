"""My electricity or gas may be shut off (Florida): a same-day call sheet.

From the notice date and the shutoff date, it checks the 5-working-day notice rule for companies
the Public Service Commission regulates, and lists who to call today and what to ask: the utility,
the local crisis help, the elder program, and the Commission if the bill is disputed. It never says
a shutoff will or will not happen; only the utility can confirm a hold.
"""

import datetime as dt

from . import rules
from .i18n import _, as_of as _asof, english_date as _eng, listed as _listed, long_date as _long, note as _note, rows as _rows, tr as _tr
from .validate import InputError, _parse_date, as_mapping
from .workdays import why_closed

KINDS = ("regulated", "city_coop", "unsure")



def working_days_between(start, end):
    """Working days after `start` up to and including `end` (weekends and federal holidays skipped)."""
    n, d = 0, start
    while d < end:
        d += dt.timedelta(days=1)
        if d.weekday() < 5 and not why_closed(d):
            n += 1
    return n


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    body = as_mapping(raw, "kind", _("The details could not be read. Enter them again."))
    problems = {}
    kind = body.get("kind") or "unsure"
    if kind not in KINDS:
        problems["kind"] = _("Choose one of the answers.")
    dates = {}
    for key in ("notice_date", "shutoff_date"):
        v = body.get(key)
        dates[key] = None
        if v in (None, ""):
            continue
        try:
            dates[key] = _parse_date(v)
        except (TypeError, ValueError):
            problems[key] = _("Enter the date as month, day and year, or leave it empty.")
    if dates["notice_date"] and dates["shutoff_date"] and dates["shutoff_date"] < dates["notice_date"]:
        problems["shutoff_date"] = _("This is before the notice date. Check both dates.")
    if problems:
        raise InputError(problems)
    medical, off, older, dispute = (body.get(k) is True for k in ("medical", "off", "older", "dispute"))
    t = _rows("utility", today, rules_dir)
    findings, steps = [], []

    if dates["shutoff_date"]:
        left = (dates["shutoff_date"] - today).days
        when = _("today") if left == 0 else ((_("in 1 day") if left == 1 else _("in %d days") % left) if left > 0 else _("on %s, which has passed") % _long(dates["shutoff_date"]))
        headline = _("Your notice says service may be shut off %s") % when if not off else _("Your service is off")
    else:
        headline = _("Your service is off") if off else _("Call your utility today")
    if dates["notice_date"] and dates["shutoff_date"] and kind != "city_coop":
        wd = working_days_between(dates["notice_date"], dates["shutoff_date"])
        if wd < t["notice"]["working_days"]:
            findings.append({"kind": "short_notice", "text": (_("Your notice gives 1 working day before the shutoff date.") if wd == 1 else _("Your notice gives %d working days before the shutoff date.") % wd) + _(" Companies regulated by the Public Service Commission must give at least 5. Ask the utility about it, and if it is regulated, tell the Commission at 1-800-342-3552.")})

    steps.append({"who": _("Your utility (the number on your bill or notice)"), "ask": [
        _("Can you hold the shutoff while I apply for help with the bill? Until what date?"),
        _("Can I set up a payment arrangement? What would I pay now, and what later?"),
        _("What is the exact amount I need to pay to stop the shutoff, and by when?")] + (
        [_("Someone here needs electricity for medical reasons. How do I register as medically essential, and what form does the doctor sign?")] if medical else []) + (
        [_("What do I need to do to get service turned back on, and is there a reconnection fee or deposit?")] if off else [])})
    steps.append({"who": _("LIHEAP crisis help: your local community action agency (850-717-8450 or dial 211 to find it)"), "ask": [
        _("I have a shutoff notice. Can I apply for crisis help today?"), _("What do I need to bring, and how soon can you pay the utility?"),
        _("Will you call the utility to tell them I applied?")]})
    if older:
        steps.append({"who": _("Elder Helpline: 1-800-963-5337"), "ask": [_("Someone in my home is 60 or older and we have a shutoff notice. Can the elderly energy program help?")]})
    if dispute:
        steps.append({"who": _("Florida Public Service Commission: 1-800-342-3552"), "ask": [_("I dispute part of my bill and my service may be shut off. Can I file a complaint so the disputed amount is not used to shut me off?")]})
    rule_rows = [t["notice"], t["who"], t["liheap"], t["liheap_bring"]] + ([t["medical"]] if medical else []) + ([t["elder"]] if older else []) + ([t["dispute"]] if dispute else [])
    return {"headline": headline, "findings": findings, "steps": steps,
            "bring": [_("The shutoff or final notice"), _("Your most recent energy bill"), _("Photo ID"), _("Proof of income for everyone in the home, if you have it")],
            "record": [_("Who you spoke to"), _("What they said about the shutoff date"), _("Any hold or arrangement, and until when"), _("Reference number")],
            "rules": _listed(rule_rows), "rules_as_of": _asof(rules_dir),
            "disclaimer": _note(_("Florida only. Only your utility can confirm a hold on a shutoff. This is an independent tool, not a utility or government agency, and it is not legal advice."))}
