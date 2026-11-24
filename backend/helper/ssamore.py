"""Four more Social Security helpers, for the questions people ask most after a letter or a missing check:

- latefiling: I missed my appeal deadline. Asking for more time (good cause).
- payday:     my payment didn't arrive. When it was due and when to report it missing.
- offset:     part of my check is being taken for a debt. What the limits are.
- irmaa:      my Medicare premium is higher because of income. The 2026 tier and form SSA-44.

Each one compares what the person enters with dated, sourced rules and says "may", never
"you qualify". Nothing is stored.
"""

import datetime as dt

from . import rules, workdays
from .fixes import _date, _done, _long, _money, _pick
from .validate import InputError, as_mapping

LATE_REASONS = ("illness", "family", "records", "searching", "explained", "wrong_info", "no_notice", "other_agency", "limits", "unusual")


# ---------------------------------------------------------------- missed appeal deadline

def latefiling(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = rules.rows_as_of("latefiling", today, rules_dir)
    body = as_mapping(raw, "letter_date", "The details could not be read. Enter them again.")
    p = {}
    letter = _date(body.get("letter_date"), "letter_date", p, today, 3650, message="Enter the date printed on the decision letter.")
    arrived = _date(body.get("arrived"), "arrived", p, today, 3650, required=False, message="Enter the day the letter reached you, or leave it blank.")
    program = _pick(body, "program", ("ss", "ssi"), p, "Choose Social Security or SSI.")
    reasons = body.get("reasons") or []
    if not isinstance(reasons, list) or any(r not in LATE_REASONS for r in reasons):
        p["reasons"] = "Choose the reasons from the list."
        reasons = []
    story = str(body.get("story") or "").strip()
    if len(story) > 1500:
        p["story"] = "Keep this under 1,500 characters."
    if letter and arrived and arrived < letter:
        p["arrived"] = "This is before the date on the letter."
    if p:
        raise InputError(p)

    presumed = letter + dt.timedelta(days=t["mail"]["days"])
    received = arrived if arrived and arrived > presumed else presumed
    raw_deadline = received + dt.timedelta(days=t["appeal"]["days"])
    deadline, moved = workdays.roll_forward(raw_deadline)
    late_by = (today - deadline).days
    used = [t["appeal"], t["mail"], t["weekend"]]

    chosen = [{"id": r, "plain": t["reason_" + r]["plain"]} for r in LATE_REASONS if r in reasons]
    used += [t["reason_" + r] for r in reasons]
    if late_by <= 0:
        headline = "Your deadline may not have passed: %s" % _long(deadline)
        steps = ["File the appeal now. You do not need to explain good cause if it reaches Social Security by %s." % _long(deadline),
                 "Keep proof of the day you filed, such as the online confirmation number or a stamped copy."]
    else:
        headline = "The usual deadline passed %d day%s ago. You can still ask" % (late_by, "" if late_by == 1 else "s")
        steps = [t["extension"]["plain"],
                 "Send the appeal form and the statement below together. Online appeals have a place to explain why you are late.",
                 "Add copies of anything that backs up your reasons, such as a hospital discharge paper or a death notice.",
                 "Keep a copy and proof of the day you sent it."]
        used.append(t["extension"])
    steps.append(t["consider"]["plain"])
    used.append(t["consider"])
    if program == "ssi":
        used.append(t["ssi"])

    lines = ["I am asking Social Security to accept my request for an appeal of the decision dated %s." % _long(letter)]
    if late_by > 0:
        lines.append("I know the request is late. I am asking you to find good cause for the late filing under %s for these reasons:"
                     % ("20 CFR 416.1411" if program == "ssi" else "20 CFR 404.911"))
        for c in chosen:
            lines.append("- " + _first_person(c["id"]))
        if story:
            lines.append(story)
        if not chosen and not story:
            lines.append("[Write what kept you from filing on time, with dates.]")
    lines.append("I filed as soon as I could. Copies of papers that support this are attached.")
    lines += ["", "Name: ____________________", "Social Security number: (write it on the paper copy only)", "Signature and date: ____________________"]
    return _done({"program": program, "headline": headline, "deadline": deadline.isoformat(), "deadline_long": _long(deadline),
                  "moved": moved, "late": late_by > 0, "days_late": max(late_by, 0), "reasons": chosen, "steps": steps,
                  "statement": "\n".join(lines)},
                 used, rules_dir, "This counts the usual deadline and drafts a statement. Social Security decides whether there was good cause.")


FIRST_PERSON = {
    "illness": "I was seriously ill and could not contact Social Security myself or through anyone else.",
    "family": "There was a death or serious illness in my immediate family.",
    "records": "Records I needed were destroyed or damaged.",
    "searching": "I was trying hard to find information I needed for the appeal and could not find it in time.",
    "explained": "I asked Social Security to explain the decision before the deadline, and I am filing within 60 days of getting that explanation.",
    "wrong_info": "Social Security gave me wrong or incomplete information about how or when to appeal.",
    "no_notice": "I never received the decision letter.",
    "other_agency": "I sent my request on time to another government agency in good faith.",
    "limits": "A physical, mental, educational or language limitation kept me from filing on time.",
    "unusual": "Something unusual and outside my control kept me from filing on time.",
}


def _first_person(reason):
    return FIRST_PERSON[reason]


# ---------------------------------------------------------------- missing payment

def _wednesday(year, month, n):
    return workdays._nth(year, month, 2, n)


def _paid_on(day):
    """Payments due on a weekend or federal holiday are paid the business day before."""
    while workdays.why_closed(day):
        day -= dt.timedelta(days=1)
    return day


def _mail_days_after(day, n):
    """The nth mail delivery day after a date (Monday to Saturday, not federal holidays)."""
    d = day
    while n:
        d += dt.timedelta(days=1)
        if d.weekday() != 6 and d not in workdays.federal_holidays(d.year):
            n -= 1
    return d


def payday(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = rules.rows_as_of("payday", today, rules_dir)
    body = as_mapping(raw, "kind", "The details could not be read. Enter them again.")
    p = {}
    kind = _pick(body, "kind", ("ss", "ssi", "both"), p, "Choose which payment you are waiting for.")
    early = body.get("before_1997") in (True, "yes", "true")
    birth = None
    if kind == "ss" and not early:
        try:
            birth = int(body.get("birth_day"))
            if not 1 <= birth <= 31:
                raise ValueError
        except (TypeError, ValueError):
            p["birth_day"] = "Enter the day of the month you were born (1 to 31)."
    month = body.get("month") or today.strftime("%Y-%m")
    try:
        year, mon = (int(x) for x in str(month).split("-"))
        first = dt.date(year, mon, 1)
        if abs((first - today.replace(day=1)).days) > 400:
            raise ValueError
    except (TypeError, ValueError):
        p["month"] = "Choose the month of the payment."
    if p:
        raise InputError(p)

    payments, used = [], [t["ssi_first"], t["wait"]]
    if kind in ("ssi", "both"):
        payments.append(("SSI", first, t["ssi_first"]))
    if kind == "both" or (kind == "ss" and early):
        payments.append(("Social Security", dt.date(year, mon, 3), t["ss_third"]))
    elif kind == "ss":
        n = 2 if birth <= 10 else 3 if birth <= 20 else 4
        payments.append(("Social Security", _wednesday(year, mon, n), t["ss_birthday"]))
    out = []
    for name, due, row in payments:
        paid = _paid_on(due)
        report = _mail_days_after(paid, 3)
        used.append(row)
        out.append({"name": name, "due": paid.isoformat(), "due_long": "%s, %s" % (paid.strftime("%A"), _long(paid)),
                    "moved": paid != due, "report_from": report.isoformat(), "report_from_long": "%s, %s" % (report.strftime("%A"), _long(report)),
                    "can_report": today >= report})
    ready = [x for x in out if x["can_report"]]
    if ready:
        headline = "You can report the %s payment missing now" % ready[0]["name"]
    elif all(today < dt.date.fromisoformat(x["due"]) for x in out):
        headline = "The payment is not due yet"
    else:
        headline = "Wait until %s before reporting it missing" % out[0]["report_from_long"]
    steps = ["Check your bank account or Direct Express card for a deposit on the due date. Deposits sometimes show under a different name, such as \"SSA TREAS 310\" or \"SUPP SEC\".",
             t["history"]["plain"],
             "If you moved, changed banks or closed an account recently, the payment may have gone to the old address or account. Say so when you call.",
             "To report it: call Social Security at 1-800-772-1213 (TTY 1-800-325-0778) or visit a local office. Ask them to trace the payment.",
             "If you were told the payment was stopped or reduced, check for a letter. You may have the right to appeal."]
    used.append(t["history"])
    return _done({"kind": kind, "headline": headline, "payments": out, "steps": steps},
                 used, rules_dir, "Payment dates follow Social Security's published schedule. Your bank or Social Security can confirm a payment.")


# ---------------------------------------------------------------- offset or garnishment

def offset(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = rules.rows_as_of("offset", today, rules_dir)
    body = as_mapping(raw, "benefit", "The details could not be read. Enter them again.")
    p = {}
    benefit = _pick(body, "benefit", ("ss", "ssi"), p, "Choose the benefit.")
    debt = _pick(body, "debt", ("student_loan", "federal", "taxes", "child_support", "private"), p, "Choose what the debt is for.")
    amount = _money(body.get("monthly_benefit"), "monthly_benefit", p, top=20_000)
    taken = _money(body.get("taken"), "taken", p, required=False, top=20_000)
    if amount is not None and taken is not None and taken > amount:
        p["taken"] = "This is more than the monthly benefit."
    if p:
        raise InputError(p)
    top = t["top"]
    used, limit, over = [t["protected"]], None, False
    steps = []
    if benefit == "ssi":
        if debt in ("student_loan", "federal"):
            headline = "SSI should not be taken for this debt"
            steps.append(t["ssi"]["plain"])
            used.append(t["ssi"])
            over = bool(taken)
        elif debt == "private":
            headline = "Most creditors cannot take SSI"
        else:
            headline = "Check the notice: SSI is protected from most collection"
        steps.append("If money was taken from SSI, call Social Security at 1-800-772-1213 and ask why, and ask for the notice in writing.")
    elif debt in ("student_loan", "federal"):
        limit = round(max(0.0, min(amount * top["percent"] / 100, amount - top["floor"])), 2)
        over = taken is not None and taken > limit + 0.5
        used.append(top)
        if limit == 0:
            headline = "At $%s a month, nothing should be taken" % _fmt(amount)
        elif over:
            headline = "The amount taken may be more than the limit of $%s" % _fmt(limit)
        else:
            headline = "Up to $%s a month may be taken" % _fmt(limit)
        steps += [top["plain"], t["notice"]["plain"],
                  "If the amount is wrong or taking it causes hardship, contact the agency that is owed the money (named on the notice) and ask for a review or a repayment plan."]
        used.append(t["notice"])
        if debt == "student_loan":
            steps.append(t["student_status"]["plain"])
            used.append(t["student_status"])
    elif debt == "taxes":
        headline = "The IRS can take part of Social Security for unpaid federal taxes"
        steps.append("The IRS must send a notice first. Call the number on the IRS notice to ask about a payment plan or hardship status.")
    elif debt == "child_support":
        headline = "Social Security can be taken for child support or alimony"
        steps.append("Limits are set by federal and state law. Contact the child support agency named on the order to ask about the amount.")
    else:
        headline = "Most private creditors cannot take Social Security"
        steps.append("A credit card company, medical bill collector or landlord generally cannot take your Social Security, even with a court judgment.")
    if debt == "private" or benefit == "ssi":
        steps.append(t["bank"]["plain"] + " If the bank froze the account, tell the bank the money is Social Security or SSI and ask it to release the protected amount.")
        used.append(t["bank"])
    return _done({"benefit": benefit, "debt": debt, "headline": headline, "limit": limit, "monthly_benefit": amount, "taken": taken,
                  "may_be_over": over, "steps": steps},
                 used, rules_dir, "This compares your figures with the federal limits. The notice from the agency owed the money has the details for your case.")


def _fmt(x):
    return ("{:,.2f}".format(x)).replace(".00", "")


# ---------------------------------------------------------------- Medicare premium (IRMAA)

IRMAA_EVENTS = ("marriage", "divorce", "death", "work_stopped", "work_reduced", "property", "pension", "settlement")


def _tier(tiers, magi):
    for i, (upper, b, d) in enumerate(tiers):
        if upper is None or magi <= upper:
            return i, b, d
    return len(tiers) - 1, tiers[-1][1], tiers[-1][2]


def _published_years(name, field, today, rules_dir):
    """This year, plus next year once its rows are published."""
    years = [today.year]
    if any(r["id"] == field and (r["effective_from"] or "")[:4] == str(today.year + 1) for r in rules.load_table(name, rules_dir)["rows"]):
        years.append(today.year + 1)
    return years


def irmaa(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    body = as_mapping(raw, "filing", "The details could not be read. Enter them again.")
    p = {}
    years = _published_years("irmaa", "standard", today, rules_dir)
    try:
        year = int(body.get("year") or today.year)
        if year not in years:
            raise ValueError
    except (TypeError, ValueError):
        p["year"] = "Choose %s." % " or ".join(str(y) for y in years)
        year = today.year
    t = rules.rows_as_of("irmaa", dt.date(year, 1, 1), rules_dir)
    filing = _pick(body, "filing", ("single", "joint", "separate"), p, "Choose how the tax return was filed.")
    magi = _money(body.get("magi"), "magi", p, top=100_000_000)
    now = _money(body.get("new_income"), "new_income", p, required=False, top=100_000_000)
    event = body.get("event") or "none"
    if event not in IRMAA_EVENTS + ("none",):
        p["event"] = "Choose an event from the list."
    if p:
        raise InputError(p)
    tiers = t["tiers_" + filing]["tiers"]
    std = t["standard"]["amount"]
    level, b, d = _tier(tiers, magi)
    used = [t["standard"], t["based_on"], t["tiers_" + filing]]
    out = {"filing": filing, "year": year, "years": years, "tax_year": t["based_on"]["tax_year"], "standard": std, "level": level, "part_b": round(std + b, 2),
           "part_b_extra": b, "part_d_extra": d, "monthly_extra": round(b + d, 2)}
    if level == 0:
        headline = "At this income, you may pay the standard $%s Part B premium in %d" % (_fmt(std), year)
    else:
        headline = "At this income, you may pay $%s more a month for Medicare in %d" % (_fmt(b + d), year)
    steps = []
    if now is not None:
        lvl2, b2, d2 = _tier(tiers, now)
        out.update(new_level=lvl2, new_part_b=round(std + b2, 2), new_monthly_extra=round(b2 + d2, 2),
                   saving=round((b + d - b2 - d2), 2))
    if event != "none" and level > 0:
        steps += [t["events"]["plain"],
                  "Use form SSA-44 and enter the lower income you expect this year." if now is None else
                  "Use form SSA-44 and enter your expected income of $%s." % _fmt(now),
                  t["proof"]["plain"],
                  "Send it to your local Social Security office, or call 1-800-772-1213 to ask for an appointment."]
        used += [t["events"], t["proof"]]
        if now is not None and out["saving"] > 0:
            headline = "A new decision may lower this by $%s a month" % _fmt(out["saving"])
    elif level > 0:
        steps.append("If your income went down because of a life-changing event (for example retirement, a spouse's death or divorce), you can ask for a new decision with form SSA-44.")
        used.append(t["events"])
    if level > 0:
        steps.append(t["appeal"]["plain"])
        used.append(t["appeal"])
    out.update(headline=headline, steps=steps, event=event)
    return _done(out, used, rules_dir, "This compares one income figure with the %d tiers. Social Security sets the premium from IRS records." % year)
