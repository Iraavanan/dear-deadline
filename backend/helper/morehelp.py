"""Eight helpers for letters from other programs and for two Medicare and Social Security questions:

- snapclaim: the state says a household was paid too much SNAP.
- vadebt:    a first debt letter from the VA about a benefit overpayment.
- cdr:       Social Security sent a disability review form.
- raover:    Florida reemployment assistance (unemployment) says benefits were overpaid.
- voucher:   a housing authority is ending voucher (Section 8) help.
- estate:    Medicaid wants repayment from the estate of someone who died.
- partb:     signing up for Medicare Part B late.
- fairness:  a public pension and the Social Security Fairness Act.

Each one sets what the person enters against dated, sourced rules and says "may", never
"you qualify". Where a rule gives no number of days, no date is invented: the date on the
letter is the one shown. Nothing is stored.
"""

import datetime as dt
import math

from . import rules
from .fixes import _date, _money, _pick
from .i18n import _, english_date as _eng, finish as _done, long_date as _long, month_name as _month_name, rows as _rows
from .ssalife import _add_months, _month, _yes
from .ssamore import _fmt
from .validate import InputError, as_mapping

UNREADABLE = "The details could not be read. Enter them again."


def _when(label, day, today, note=None):
    left = (day - today).days
    return {"label": label, "date": day.isoformat(), "date_long": _long(day), "days_left": left, "passed": left < 0, "note": note}


def _plus_years(day, years):
    try:
        return day.replace(year=day.year + years)
    except ValueError:                                   # February 29
        return dt.date(day.year + years, 2, 28)


def _printed(body, field, p, today, after=None):
    """A date printed on a letter. It may be in the future; it is never worked out here."""
    v = body.get(field)
    if v in (None, ""):
        return None
    try:
        d = dt.date.fromisoformat(str(v)[:10])
    except ValueError:
        p[field] = "Enter the date as month, day and year."
        return None
    if d < today - dt.timedelta(days=730) or d > today + dt.timedelta(days=730) or (after and d < after):
        p[field] = "Check the date."
    return d


# ---------------------------------------------------------------- SNAP overpayment claim

def snapclaim(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = _rows("snapclaim", today, rules_dir)
    body = as_mapping(raw, "notice_date", UNREADABLE)
    p = {}
    notice = _date(body.get("notice_date"), "notice_date", p, today, 3 * 365, message="Enter the date on the letter.")
    kind = _pick(body, "kind", ("mistake", "agency", "ipv", "unsure"), p, "Choose what the letter says, or \"I'm not sure\".")
    amount = _money(body.get("amount"), "amount", p, required=False, top=1_000_000)
    allotment = _money(body.get("allotment"), "allotment", p, required=False, top=20_000)
    if p:
        raise InputError(p)
    dates = [_when("Pay, or make a payment arrangement, by the date on your letter. Under the federal rule that is no later than", notice + dt.timedelta(days=t["due"]["days"]), today),
             _when("Ask for a fair hearing by", notice + dt.timedelta(days=t["hearing"]["days"]), today, "90 days, counted from the date on the letter. If your letter gives a different date, use the letter's.")]
    used = [t["types"], t["hearing"], t["due"], t["inspect"]]
    rate = None
    if allotment:
        def take(r):
            return round(max(r["dollars"], allotment * r["percent"] / 100), 2)
        which = {"mistake": [t["reduce_mistake"]], "agency": [t["reduce_mistake"]], "ipv": [t["reduce_ipv"]], "unsure": [t["reduce_mistake"], t["reduce_ipv"]]}[kind]
        rate = [{"claim": "intentional violation" if r["id"] == "reduce_ipv" else "household or agency mistake", "monthly": take(r),
                 "months": int(math.ceil(amount / take(r))) if amount else None} for r in which]
        used += which
    steps = ["Ask the office on the letter, in writing, for the records and the month-by-month working behind the amount. " + t["inspect"]["plain"],
             "If you think the amount or the reason is wrong, ask for a fair hearing by %s. Ask in writing and keep a copy with the date." % dates[1]["date_long"],
             t["file"]["plain"],
             "If the amount is right but you cannot pay it at once, ask for a repayment agreement before the due date. " + t["agreement"]["plain"],
             "If you could not pay it off within three years, say so and ask the state to lower the claim. " + t["compromise"]["plain"],
             t["delinquent"]["plain"] + " " + t["offset"]["plain"]]
    used += [t["file"], t["agreement"], t["compromise"], t["delinquent"], t["offset"], t["lookback"], t["decision"]]
    if kind == "agency":
        steps.insert(1, "An agency mistake is still a claim under the federal rules, even though the mistake was not yours. Say in your request that the error was the agency's, and ask whether the claim can be lowered.")
    if kind == "ipv":
        steps.insert(1, "A claim for an intentional program violation is serious. Before you sign or agree to anything, try to speak with a legal aid office.")
    words = ("I am writing about the SNAP overpayment letter dated %s. I ask for a fair hearing about this claim. Please send me the records and the month-by-month calculation used to work out the amount%s. "
             "Please also tell me how to ask for a repayment agreement and for the claim to be lowered if I cannot pay it within three years."
             % (_eng(notice), (" of $%s" % _fmt(amount)) if amount else ""))
    headline = "You have until %s to ask for a hearing on the SNAP overpayment" % dates[1]["date_long"] if not dates[1]["passed"] else "The 90 days to ask for a hearing ended on %s" % dates[1]["date_long"]
    if dates[1]["passed"]:
        steps.insert(0, "The 90 days have passed, counting from the date you entered. You can still ask for the records, a repayment agreement and a lower claim, and ask the office whether a late hearing request can be accepted.")
    return _done({"kind": kind, "headline": headline, "dates": dates, "amount": amount, "allotment": allotment, "rate": rate, "steps": steps, "words": words},
                 used, rules_dir, "These dates come from the federal SNAP rules and the date you entered. Your state's letter gives the dates that apply to you.")


# ---------------------------------------------------------------- VA debt letter

def vadebt(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = _rows("vadebt", today, rules_dir)
    body = as_mapping(raw, "letter_date", UNREADABLE)
    p = {}
    got = _date(body.get("letter_date"), "letter_date", p, today, 3 * 365, message=_("Enter the date you got the first debt letter."))
    kind = _pick(body, "kind", ("comp", "education"), p, _("Choose the kind of benefit."))
    view = _pick(body, "view", ("wrong", "cant_pay", "can_pay_slowly", "unsure"), p, _("Choose the answer that fits best."))
    amount = _money(body.get("amount"), "amount", p, required=False, top=10_000_000)
    paid = _yes(body, "gets_benefits")
    if p:
        raise InputError(p)
    stop_days = t["waiver_stop"][kind]
    dates = [_when(_("Dispute the debt in writing by"), got + dt.timedelta(days=t["dispute"]["days"]), today, _("Disputing within 30 days avoids collection actions while VA looks at it.")),
             _when(_("Ask for a waiver by this date to stop collection while VA decides"), got + dt.timedelta(days=stop_days), today,
                   _("%d days for %s.") % (stop_days, _("an education debt") if kind == "education" else _("a disability compensation or pension debt"))),
             _when(_("Last day VA can consider a waiver request"), _plus_years(got, t["waiver_limit"]["years"]), today, _("One year from when you got the first debt letter."))]
    used = [t["dispute"], t["waiver"], t["waiver_stop"], t["waiver_limit"]]
    steps = []
    if view in ("wrong", "unsure"):
        steps.append(_("If you think the debt or the amount is wrong: ") + t["dispute"]["plain"] + " " + t["underlying"]["plain"])
        used.append(t["underlying"])
    if view in ("cant_pay", "unsure"):
        steps.append(_("If you cannot afford to repay: ") + t["waiver"]["plain"] + " " + t["waiver_limit"]["plain"])
        steps.append(t["compromise"]["plain"])
        used.append(t["compromise"])
    if view in ("can_pay_slowly", "unsure", "cant_pay"):
        steps.append(t["plan"]["plain"])
        used.append(t["plan"])
    if paid:
        steps.append(t["withhold"]["plain"])
        used.append(t["withhold"])
    steps += [t["treasury"]["plain"], t["helper"]["plain"], t["contact"]["plain"], t["appeal"]["plain"]]
    used += [t["treasury"], t["helper"], t["contact"], t["appeal"]]
    live = [d for d in dates if not d["passed"]]
    headline = (_("The next date on your VA debt letter is %s") % live[0]["date_long"]) if live else _("The one-year waiver window ended on %s") % dates[2]["date_long"]
    if not live:
        steps.insert(0, _("The waiver window has passed, counting from the date you entered. You can still ask for a repayment plan or make a compromise offer, and dispute a debt you think is wrong."))
    words = ("I am writing about the debt letter I received on %s%s. %s Please stop collection while you review this, and send me the records showing how the amount was worked out."
             % (_eng(got), (" for $%s" % _fmt(amount)) if amount else "",
                "I dispute this debt because: [say why the debt or the amount is wrong]." if view == "wrong" else
                "I ask for a waiver of this debt. I enclose VA Form 5655. I should not have to repay it because: [say why, and how repaying would affect you]." if view == "cant_pay" else
                "I ask for a repayment plan of $[amount] a month." if view == "can_pay_slowly" else
                "I dispute this debt because: [say why], and if it stands I ask for a waiver and enclose VA Form 5655."))
    return _done({"kind": kind, "view": view, "headline": headline, "dates": dates, "amount": amount, "steps": steps, "words": words},
                 used, rules_dir, _("These dates are counted from the date you entered. VA's letter and its decision give the dates that apply to you."))


# ---------------------------------------------------------------- disability review form

def cdr(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = _rows("cdr", today, rules_dir)
    body = as_mapping(raw, "form", UNREADABLE)
    p = {}
    form = _pick(body, "form", ("455", "454", "unsure"), p, _("Choose the form you got, or \"I'm not sure\"."))
    program = _pick(body, "program", ("ss", "ssi", "both"), p, _("Choose the benefit."))
    status = _pick(body, "status", ("have_it", "sent", "missed", "stopped"), p, _("Choose where things stand."))
    due = _printed(body, "due", p, today)
    payee = _yes(body, "payee")
    if p:
        raise InputError(p)
    used = [t["what"], t["often"], t["forms"]]
    dates = [_when(_("Return the form by the date printed on your letter"), due, today)] if due else []
    steps = []
    if status == "have_it":
        steps.append(_("Send the form back by the date printed on the letter or the form. Social Security's public pages give no single number of days, so no date is worked out here.") if not due
                     else _("Send the form back by %s, the date you entered from your letter.") % _long(due))
        steps.append(_("List every doctor, clinic and hospital you have seen, with dates, and any work, training or school. Answer every question."))
        if form != "455" and not payee:
            steps.append(t["online"]["plain"])
            used.append(t["online"])
        steps.append(_("Keep a copy of every page and proof of the day you sent it, such as a certified mail receipt or the online confirmation."))
    elif status == "sent":
        steps.append(_("Keep your copy and your proof of sending. If Social Security writes again asking for the same form, call 1-800-772-1213 or your local office, say when and how you sent it, and offer to send it again."))
    elif status == "missed":
        steps.append(_("Send the form now, even though it is late, and call 1-800-772-1213 or your local office to say it is on its way. Ask them to note your call."))
        steps += [t["ftc"]["plain"], t["suspend"]["plain"]]
        used += [t["ftc"], t["suspend"]]
    else:
        steps.append(_("If payments stopped because the form was not returned: ") + t["restore"]["plain"] + _(" Send the form and call 1-800-772-1213 or your local office at once."))
        steps.append(t["suspend"]["plain"])
        steps.append(_("If payments stopped because Social Security decided your disability has ended, that letter has short appeal dates. Use the helper \"It says my disability has ended\"."))
        used += [t["restore"], t["suspend"], t["stop"]]
    if program in ("ssi", "both"):
        steps.append(t["also"]["plain"])
        used.append(t["also"])
    steps.append(t["what"]["plain"])
    headline = {"have_it": _("Return the review form by the date on your letter, and keep proof"), "sent": _("You sent it. Keep your proof and watch for a second request"),
                "missed": _("Send the form now and call Social Security"), "stopped": _("Payments that stopped over a missing form can be restarted")}[status]
    return _done({"form": form, "program": program, "status": status, "headline": headline, "dates": dates, "steps": steps, "often": t["often"]["plain"],
                  "links": ["disability-ended"] if status == "stopped" else ["ssa-call"]},
                 used, rules_dir, _("This explains the usual review process. Social Security's letter gives the date and the forms that apply to you."))


# ---------------------------------------------------------------- Florida unemployment overpayment

def raover(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = _rows("raover", today, rules_dir)
    body = as_mapping(raw, "mailed", UNREADABLE)
    p = {}
    mailed = _date(body.get("mailed"), "mailed", p, today, 8 * 365, message=_("Enter the mailing date on the determination."))
    fraud = _pick(body, "fraud", ("no", "yes", "unsure"), p, _("Choose what the determination says."))
    cause = _pick(body, "cause", ("employer_late", "agency", "mine", "unsure"), p, _("Choose the reason that fits best."))
    amount = _money(body.get("amount"), "amount", p, required=False, top=1_000_000)
    if p:
        raise InputError(p)
    by = _when(_("Appeal by"), mailed + dt.timedelta(days=t["appeal"]["days"]), today, _("20 days, counted from the mailing date you entered. Do not wait for the last day."))
    used = [t["appeal"], t["interest"], t["limit"]]
    steps = []
    if by["passed"]:
        steps.append(_("The 20 days have passed, counting from the date you entered. You can still file an appeal and explain why it is late; an appeals referee decides whether to accept it."))
    else:
        steps.append(_("If you disagree with the overpayment or the amount, appeal by %s, in the way the determination describes. Keep the confirmation.") % by["date_long"])
    penalty = None
    if fraud in ("yes", "unsure"):
        used.append(t["fraud"])
        if amount:
            penalty = round(amount * t["fraud"]["percent"] / 100, 2)
        steps.append(t["fraud"]["plain"] + (_(" On $%s that is $%s.") % (_fmt(amount), _fmt(penalty)) if amount else "") + _(" A fraud finding has other consequences too. Try to speak with a legal aid office before the appeal date."))
    if fraud in ("no", "unsure"):
        steps.append(t["nonfraud"]["plain"])
        used.append(t["nonfraud"])
        if cause == "employer_late":
            steps.append(t["employer"]["plain"] + _(" If this is what happened, say so in your appeal."))
            used.append(t["employer"])
        if cause in ("agency", "employer_late", "unsure"):
            steps.append(t["no_fault"]["plain"] + _(" If the overpayment was not your fault, say so in writing and explain what repaying would do to you."))
            used.append(t["no_fault"])
    steps += [t["interest"]["plain"], t["limit"]["plain"],
              _("If you agree with the amount and can repay, the determination explains how. Ask about monthly payments if you cannot pay it all at once.")]
    headline = (_("You have until %s to appeal the overpayment determination") % by["date_long"]) if not by["passed"] else _("The 20 days to appeal ended on %s") % by["date_long"]
    return _done({"fraud": fraud, "cause": cause, "headline": headline, "dates": [by], "amount": amount, "penalty": penalty, "steps": steps},
                 used, rules_dir, _("This covers Florida reemployment assistance only. The date is counted from the mailing date you entered; your determination gives the date that applies to you."))


# ---------------------------------------------------------------- voucher ending

REASONS = {"income": "income or household information the housing authority says was not reported", "absence": "being away from the home",
           "lease": "a lease violation or eviction", "criminal": "criminal or drug-related activity", "obligations": "another family obligation under the program", "other": "another reason"}


def voucher(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = _rows("voucher", today, rules_dir)
    body = as_mapping(raw, "notice_date", UNREADABLE)
    p = {}
    notice = _date(body.get("notice_date"), "notice_date", p, today, 2 * 365, message=_("Enter the date on the notice."))
    reason = _pick(body, "reason", tuple(REASONS), p, _("Choose the reason the notice gives."))
    deadline = _printed(body, "deadline", p, today, after=notice)
    asked = _yes(body, "asked")
    disability = _yes(body, "disability")
    if p:
        raise InputError(p)
    used = [t["hearing"], t["before"], t["notice"], t["deadline"]]
    dates = [_when(_("Ask for the informal hearing by the date on your notice"), deadline, today)] if deadline else []
    steps = []
    if asked:
        steps.append(_("You have asked for the hearing. Keep proof of the day you asked, and ask in writing for the date, time and place if you have not been told."))
    elif deadline and (deadline - today).days < 0:
        steps.append(_("The date on your notice has passed. Ask for the hearing in writing today anyway, explain why you are late, and try to speak with a legal aid office at once."))
    elif deadline:
        steps.append(_("Ask for the informal hearing in writing by %s. Hand it in and get a date-stamped copy, or send it in a way that proves the date.") % _long(deadline))
    else:
        steps.append(_("Find the deadline on your notice and ask for the informal hearing in writing before it. ") + t["deadline"]["plain"] + _(" Deadlines are often short, so ask today if you can."))
    steps += [_("Ask in writing to see and copy your file before the hearing. ") + t["documents"]["plain"],
              t["before"]["plain"] + _(" Keep paying your share of the rent."),
              t["representative"]["plain"] + _(" A legal aid office may help for free."),
              t["evidence"]["plain"] + _(" Bring papers and people who can speak to the reason given: ") + _(REASONS[reason]) + ".",
              t["officer"]["plain"], t["decision"]["plain"]]
    used += [t["documents"], t["representative"], t["evidence"], t["officer"], t["decision"]]
    if disability:
        steps.append(_("If a disability is connected to what happened, you can ask the housing authority in writing for a reasonable accommodation, such as more time or another chance. Ask before or at the hearing."))
    missing = _("If your notice does not give the reasons, the right to a hearing and a deadline, say so in your request. ") + t["notice"]["plain"]
    words = ("I am writing about the notice dated %s that says my Housing Choice Voucher assistance will end. I ask for an informal hearing. "
             "Please send me the date, time and place. Before the hearing, please let me see and copy my file and every document you will rely on. "
             "Please keep my assistance in place until the hearing is decided.%s") % (_eng(notice), " I also ask for a reasonable accommodation because of a disability: [say what you need]." if disability else "")
    headline = (_("Ask for the informal hearing by %s") % _long(deadline)) if deadline and not asked and (deadline - today).days >= 0 else \
        _("Your hearing request is in. Get ready for it") if asked else _("Ask for the informal hearing by the date on your notice")
    return _done({"reason": reason, "headline": headline, "dates": dates, "steps": steps, "missing": missing, "words": words},
                 used, rules_dir, _("This lists the federal hearing rules for vouchers. Your housing authority's notice and its plan set the deadline and the details."))


# ---------------------------------------------------------------- Medicaid estate recovery

def estate(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = _rows("estate", today, rules_dir)
    body = as_mapping(raw, "state", UNREADABLE)
    p = {}
    state = _pick(body, "state", ("FL", "other"), p, _("Choose the state."))
    age = _pick(body, "age55", ("yes", "no", "unsure"), p, _("Choose an answer."))
    if p:
        raise InputError(p)
    fl = state == "FL"
    spouse, minor, disabled = _yes(body, "spouse"), _yes(body, "child_under_21"), _yes(body, "disabled_child")
    lives, needs, carer, home = _yes(body, "heir_in_home"), _yes(body, "heir_needs"), _yes(body, "caregiver"), _yes(body, "home")
    used = [t["who"], t["survivors"], t["hardship"]]
    steps, reasons, letter = [], [], []
    if spouse:
        reasons.append(_("a spouse"))
        letter.append("a spouse")
    if minor:
        reasons.append(_("a child under 21"))
        letter.append("a child under 21")
    if disabled:
        reasons.append(_("a blind or disabled child"))
        letter.append("a blind or disabled child")
    if reasons:
        headline = _("The claim may not be collected, because the person is survived by ") + _(" and ").join(reasons)
        steps.append((t["fl_survivors"]["plain"] if fl else t["survivors"]["plain"]) + _(" Write to the address on the letter, say who survives the person, and send proof such as a marriage or birth certificate."))
        if fl:
            used.append(t["fl_survivors"])
    elif fl and age == "no":
        headline = _("Medicaid paid before age 55 does not create this debt in Florida")
        steps.append(t["fl_debt"]["plain"] + _(" Write to the address on the letter with the person's date of birth and ask for the claim to be withdrawn or corrected."))
        used.append(t["fl_debt"])
    else:
        headline = _("The claim may stand, but you can ask for it to be waived for hardship")
        steps.append(t["who"]["plain"] + _(" Ask for an itemized list of what Medicaid paid and the dates, and check that it covers only care at age 55 or older."))
    hardship = []
    if fl:
        if lives:
            hardship.append(_("An heir lives in the home, lived there at the death and for the 12 months before, and owns no other home."))
        if needs:
            hardship.append(_("An heir would be left without food, clothing, shelter or medical care."))
        if carer:
            hardship.append(_("A brother, sister, son or daughter lived with the person for at least a year and gave full-time care that delayed a nursing home."))
        steps.append(t["fl_hardship"]["plain"] + (_(" From your answers, these may count: ") + " ".join(hardship) if hardship else " " + t["fl_factors"]["plain"]))
        used += [t["fl_hardship"], t["fl_factors"], t["fl_claim"]]
        if home:
            steps.append(t["fl_exempt"]["plain"] + _(" Whether a home is protected homestead is decided in the probate case, so ask a probate lawyer or legal aid office about it."))
            used.append(t["fl_exempt"])
        steps.append(t["fl_claim"]["plain"] + _(" If there is a probate case, tell the personal representative about the letter."))
    else:
        steps.append(t["hardship"]["plain"] + _(" The letter, or the state Medicaid agency, should say how to ask and by when. Ask in writing and keep a copy."))
        steps.append(_("Rules on which property counts differ by state. Ask the state Medicaid agency or a legal aid office what counts as the estate in your state."))
    steps.append(_("Answer the letter in writing by any date it gives, and keep copies. Do not ignore it, even if you think no money is owed."))
    words = ("I am writing about the Medicaid estate recovery letter about [name], who died on [date]. %s Please send me an itemized list of the Medicaid payments in the claim, with dates."
             % ("The claim should not be enforced because [name] is survived by %s. Proof is enclosed." % " and ".join(letter) if reasons else
                "I ask that recovery be waived because it would cause hardship: [say how]."))
    return _done({"state": state, "headline": headline, "blocked_by": reasons, "hardship": hardship, "steps": steps, "words": words},
                 used, rules_dir, _("This lists the federal rule%s. The state Medicaid agency, and the probate court where there is a case, decide what is owed.") % (_(" and Florida's law") if fl else ""))


# ---------------------------------------------------------------- Medicare Part B, late

SEPS = ("employer", "medicaid", "misinformed", "disaster", "released", "none")


def partb(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    body = as_mapping(raw, "years", UNREADABLE)
    p = {}
    try:
        years = int(str(body.get("years")).strip())
        if not 0 <= years <= 40:
            raise ValueError
    except (TypeError, ValueError):
        years = None
        p["years"] = _("Enter the number of full years, from 0 to 40.")
    why = _pick(body, "why", SEPS, p, _("Choose the answer that fits best."))
    ended = _month(body.get("ended"), "ended", p, today, back=240, ahead=12, message=_("Choose the month.")) if body.get("ended") else None
    if p:
        raise InputError(p)
    t = _rows("partb", today, rules_dir)
    std = t["premium"]["amount"]
    pct = t["penalty"]["percent"] * years
    extra = round(std * pct / 100, 2)
    total = round(round((std + extra) * 10) / 10, 2)            # Medicare rounds the monthly premium to the nearest 10 cents
    used = [t["penalty"], t["premium"], t["no_penalty"]]
    first = today.replace(day=1)
    gep_year = today.year if today <= dt.date(today.year, 3, 31) else today.year + 1
    gep = {"opens": dt.date(gep_year, 1, 1).isoformat(), "closes": dt.date(gep_year, 3, 31).isoformat(), "opens_long": _long(dt.date(gep_year, 1, 1)), "closes_long": _long(dt.date(gep_year, 3, 31)),
           "open_now": dt.date(gep_year, 1, 1) <= today}
    steps, sep = [], None
    if why == "employer":
        used += [t["employer"], t["forms"]]
        if ended:
            last = _add_months(ended, t["employer"]["months"])
            left = (last.year - first.year) * 12 + last.month - first.month
            sep = {"ended_long": _month_name(ended), "last_long": _month_name(last), "open": left >= 0}
            steps.append((_("Your Special Enrollment Period runs to the end of %s. Sign up before then. ") % _month_name(last) + t["forms"]["plain"])
                         if left >= 0 else _("The 8 months after %s ended in %s. Unless another special period fits, the next chance is the General Enrollment Period.") % (_month_name(ended), _month_name(last)))
        else:
            steps.append(_("Sign up within 8 months of the job or its coverage ending, whichever comes first. ") + t["forms"]["plain"])
        steps.append(t["employer"]["plain"])
    elif why != "none":
        steps.append(t[why]["plain"] + _(" Call Social Security at 1-800-772-1213, say which situation applies and ask to sign up under a Special Enrollment Period."))
        steps.append(t["forms"]["plain"])
        used += [t[why], t["forms"]]
    if why == "none" or (sep and not sep["open"]):
        steps.append(t["general"]["plain"] + (_(" It is open now, until %s.") % gep["closes_long"] if gep["open_now"] else _(" The next one opens on %s.") % gep["opens_long"]))
        used.append(t["general"])
    steps.append(_("If your income is low, a Medicare Savings Program may pay the Part B premium, and enrolling in one generally removes the penalty. Check with the helper \"Could a program pay my Medicare costs?\"."))
    if years:
        steps.append(_("If you are charged a penalty you think is wrong, for example because you had coverage from a current job, ask Social Security in writing to review it, and send proof of that coverage."))
    used.append(t["exceptional"])
    steps.append(t["exceptional"]["plain"])
    headline = (_("With no special enrollment period, the penalty would be %d%%: about $%s a month instead of $%s") % (pct, _fmt(total), _fmt(std))) if years and why == "none" else \
        (_("You may be able to sign up now without a penalty") if why != "none" and not (sep and not sep["open"]) else
         _("Less than a full year without Part B means no penalty, but you still need a sign-up period") if not years else
         (_("The penalty for 1 full year would be %d%%: about $%s a month instead of $%s") % (pct, _fmt(total), _fmt(std)) if years == 1 else
          _("The penalty for %d full years would be %d%%: about $%s a month instead of $%s") % (years, pct, _fmt(total), _fmt(std))))
    return _done({"years": years, "why": why, "headline": headline, "percent": pct, "standard": std, "extra": extra, "total": total, "year": today.year, "general": gep, "special": sep, "steps": steps,
                  "links": ["medicare-costs"]},
                 used, rules_dir, _("The figures use the %d standard premium and the years you entered. Social Security decides the penalty and whether a special enrollment period applies.") % today.year)


# ---------------------------------------------------------------- Social Security Fairness Act

def fairness(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = _rows("fairness", today, rules_dir)
    body = as_mapping(raw, "situation", UNREADABLE)
    p = {}
    situation = _pick(body, "situation", ("reduced", "never_applied", "unsure"), p, _("Choose the answer that fits best."))
    kind = _pick(body, "kind", ("own", "spouse", "survivor"), p, _("Choose the kind of benefit."))
    if p:
        raise InputError(p)
    increase, backpay = _yes(body, "got_increase"), _yes(body, "got_backpay")
    used = [t["what"], t["from"]]
    steps = []
    if situation == "never_applied":
        headline = _("You may need to apply: the reductions ended, but benefits do not start by themselves")
        steps += [t["apply"]["plain"], t["how"]["plain"] + (_(" For survivors benefits, call 1-800-772-1213.") if kind == "survivor" else ""),
                  t["retro"]["plain"] + _(" Applying sooner can mean more months are paid.")]
        used += [t["apply"], t["how"], t["retro"]]
    else:
        if increase and backpay:
            headline = _("You have had both the new monthly amount and the back pay")
            steps.append(_("Check the two against your notices. ") + t["backpay"]["plain"] + _(" If the amounts do not match the notice, call Social Security and ask how they were worked out."))
        elif increase:
            headline = _("You have the new monthly amount. Back pay comes as a separate one-time payment")
            steps.append(t["backpay"]["plain"] + " " + t["notice"]["plain"] + _(" If it has not arrived, check the bank details Social Security has, then call."))
        elif backpay:
            headline = _("You have had back pay. Check that the monthly amount went up as well")
            steps.append(t["monthly"]["plain"] + _(" If your monthly amount is the same as before, call Social Security."))
        else:
            headline = _("Most people affected were paid in 2025. If you got nothing, check your details and call")
            steps.append(t["monthly"]["plain"] + " " + t["backpay"]["plain"])
            steps.append(_("If you were getting a reduced benefit and have had neither the increase nor the back pay, call Social Security and ask whether the Fairness Act adjustment was made on your record."))
        used += [t["backpay"], t["notice"], t["monthly"]]
        if situation == "unsure":
            steps.append(_("If you get a pension from work where you did not pay Social Security tax, as in some state, local and federal government jobs, and your benefit was lowered or stopped because of it, this law may apply to you."))
    steps += [t["account"]["plain"], t["medicare"]["plain"], t["scam"]["plain"], t["phone"]["plain"]]
    used += [t["account"], t["medicare"], t["scam"], t["phone"]]
    return _done({"situation": situation, "kind": kind, "headline": headline, "steps": steps, "facts": [t["what"]["plain"], t["from"]["plain"]],
                  "links": ["amount-changed", "ssa-call"]},
                 used, rules_dir, _("This repeats what Social Security has published about the Act. Social Security works out each person's amounts."))
