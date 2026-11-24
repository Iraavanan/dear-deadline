"""Four Social Security helpers for changes in someone's life:

- died:      someone who got Social Security or SSI died. Payments to return, the $255 payment, who to tell.
- reinstate: benefits stopped after going back to work. The 60-month window for expedited reinstatement.
- ssihelp:   SSI went down because of help with housing (in-kind support and maintenance).
- changed:   my payment amount changed. Each part of the change, set against the year's figures.

Each one compares what the person enters with dated, sourced rules and says "may", never
"you qualify". Nothing is stored.
"""

import datetime as dt

from . import rules
from .fixes import _date, _done, _long, _money, _pick
from .i18n import _, month_name as _month_name, rows as _rows
from .ssamore import _fmt
from .validate import InputError, as_mapping

MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")



def _add_months(d, n):
    m = d.year * 12 + d.month - 1 + n
    return dt.date(m // 12, m % 12 + 1, 1)


def _month(v, field, p, today, back=120, ahead=2, message="Choose the month."):
    try:
        y, m = (int(x) for x in str(v).split("-")[:2])
        d = dt.date(y, m, 1)
        first = today.replace(day=1)
        if d < _add_months(first, -back) or d > _add_months(first, ahead):
            p[field] = _("Check the month.")
        return d
    except (TypeError, ValueError):
        p[field] = message
        return None


def _yes(body, field):
    return body.get(field) in (True, "yes", "true")


# ---------------------------------------------------------------- someone died

def died(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = _rows("death", today, rules_dir)
    body = as_mapping(raw, "died_on", _("The details could not be read. Enter them again."))
    p = {}
    day = _date(body.get("died_on"), "died_on", p, today, 3650, message=_("Enter the date of death."))
    benefit = _pick(body, "benefit", ("ss", "ssi", "both"), p, _("Choose what the person was getting."))
    who = _pick(body, "relationship", ("spouse_with", "spouse_apart", "child", "other"), p, _("Choose how you are related."))
    if p:
        raise InputError(p)
    month = day.replace(day=1)
    after = _add_months(month, 1)
    used = [t["report"]]
    payments = []
    if benefit in ("ss", "both"):
        payments.append({"name": _("Social Security"), "keep": _("The payment that arrived in %s was for %s, a month the person lived through.") % (_month_name(month), _month_name(_add_months(month, -1))),
                         "return": _("Return the payment that arrives in %s (it is for %s) and any later ones.") % (_month_name(after), _month_name(month))})
        used += [t["return_ss"], t["arrears"]]
    if benefit in ("ssi", "both"):
        payments.append({"name": "SSI", "keep": _("SSI for %s, paid at the start of that month, does not have to be returned.") % _month_name(month),
                         "return": _("Return SSI paid for %s and any later month.") % _month_name(after)})
        used.append(t["return_ssi"])
    used.append(t["bank"])

    try:
        lump_by = day.replace(year=day.year + t["lump"]["years"])
    except ValueError:                                   # February 29
        lump_by = dt.date(day.year + t["lump"]["years"], 2, 28)
    lump = {"spouse_with": "may", "spouse_apart": "may_if_benefits", "child": "may_if_no_spouse", "other": "no"}[who]
    lump_text = {
        "may": _("As a spouse who lived in the same home, you may be able to get the one-time $255 payment."),
        "may_if_benefits": _("As a spouse who lived apart, you may be able to get the $255 payment if you can get benefits on this person's record."),
        "may_if_no_spouse": _("If there is no spouse who can get it, a child who can get benefits on this person's record may be able to get the $255 payment."),
        "no": _("The $255 payment goes only to a spouse or to children who can get benefits on the record."),
    }[lump]
    used += [t["lump"], t["lump_order"]]
    steps = [_("Give the person's Social Security number to the funeral home, which usually reports the death. If no funeral home is involved, call 1-800-772-1213."),
             _("Tell the bank about the death and ask it to send back any payment for %s or later. Do not cash a paper check for those months; return it to Social Security.") % _month_name(month)]
    if lump != "no":
        steps.append(_("Apply for the $255 payment by %s by calling 1-800-772-1213. If you already get benefits on this person's record, it may be paid without applying.") % _long(lump_by))
    if who != "other":
        steps.append(t["survivors"]["plain"] + _(" Ask about this when you call; you may get the higher of your own benefit or the survivors benefit."))
        used.append(t["survivors"])
    headline = _("What to do about %s payments after a death in %s") % (_("Social Security and SSI") if benefit == "both" else _("Social Security") if benefit == "ss" else "SSI", _month_name(month))
    return _done({"benefit": benefit, "relationship": who, "headline": headline, "payments": payments, "lump": lump, "lump_text": lump_text,
                  "lump_by": lump_by.isoformat() if lump != "no" else None, "lump_by_long": _long(lump_by) if lump != "no" else None, "steps": steps},
                 used, rules_dir, _("This lists the usual rules. Social Security decides what is owed and who can get the $255 payment."))


# ---------------------------------------------------------------- benefits stopped because of work

def reinstate(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = _rows("reinstate", today, rules_dir)
    body = as_mapping(raw, "ended", _("The details could not be read. Enter them again."))
    p = {}
    program = _pick(body, "program", ("ss", "ssi"), p, _("Choose Social Security disability or SSI."))
    ended = _month(body.get("ended"), "ended", p, today, back=180, ahead=0, message=_("Choose the month your benefits ended."))
    condition = _pick(body, "condition", ("same", "different", "unsure"), p, _("Choose an answer."))
    earnings = _money(body.get("earnings"), "earnings", p, required=False, top=1_000_000)
    blind = _yes(body, "blind")
    if p:
        raise InputError(p)
    sga = t["sga"]["blind" if blind else "amount"]
    last = _add_months(ended, t["window"]["months"] - 1)
    this_month = today.replace(day=1)
    left = (last.year - this_month.year) * 12 + last.month - this_month.month
    over = earnings is not None and earnings > sga
    used = [t["who"], t["window"], t["sga"]]
    steps = []
    if left < 0:
        headline = _("The 60 months ended in %s") % _month_name(last)
        steps += [_("Expedited reinstatement is only for requests made within 60 months. You can file a new application instead."), t["late"]["plain"]]
        used.append(t["late"])
    else:
        headline = _("You may be able to ask to restart your benefits until the end of %s") % _month_name(last)
        if over:
            headline = _("Your earnings are above $%s a month, the %d limit") % (_fmt(sga), today.year)
            steps.append(_("Reinstatement is for people who cannot work at that level. ") + t["same_month"]["plain"])
            used.append(t["same_month"])
        steps += [t["provisional"]["plain"], t["not_repaid"]["plain"], t["forms"]["plain"],
                  _("Call 1-800-772-1213 or visit a local office and say you want to request expedited reinstatement. Have the names of your doctors and the dates you stopped or cut back work.")]
        used += [t["provisional"], t["not_repaid"], t["forms"]]
        if condition == "different":
            steps.append(_("Reinstatement needs a condition that is the same as or related to the one you got benefits for. With a new condition, ask about a new application."))
        elif condition == "unsure":
            steps.append(_("Bring your medical records. Social Security decides whether your condition is the same as or related to the one you got benefits for."))
    return _done({"program": program, "headline": headline, "ended": ended.isoformat(), "ended_long": _month_name(ended), "last": last.isoformat(),
                  "last_long": _month_name(last), "months_left": max(left + 1, 0), "sga": sga, "earnings": earnings, "over": over, "steps": steps},
                 used, rules_dir, _("This counts the usual 60-month window. Social Security decides whether benefits can restart."))


# ---------------------------------------------------------------- SSI lowered by help with housing

def ssihelp(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    body = as_mapping(raw, "home", _("The details could not be read. Enter them again."))
    p = {}
    month = _month(body.get("month") or today.strftime("%Y-%m"), "month", p, today, back=24, ahead=2)
    who = _pick(body, "who", ("single", "couple"), p, _("Choose one person or a couple."))
    home = _pick(body, "home", ("own", "others"), p, _("Choose where you live."))
    total = _money(body.get("shelter_total"), "shelter_total", p, required=False, top=100_000)
    pays = _money(body.get("i_pay"), "i_pay", p, required=False, top=100_000)
    outside = _money(body.get("outside"), "outside", p, required=False, top=100_000)
    rent = _money(body.get("rent"), "rent", p, required=False, top=100_000)
    market = _money(body.get("market"), "market", p, required=False, top=100_000)
    family = _yes(body, "family_landlord")
    pa = _yes(body, "pa")
    people = None
    if home == "others":
        try:
            people = int(body.get("people"))
            if not 2 <= people <= 30:
                raise ValueError
        except (TypeError, ValueError):
            p["people"] = _("Enter how many people live there, counting you (2 or more).")
        if total is None:
            p["shelter_total"] = _("Enter the household's monthly rent or mortgage and utilities.")
    if p:
        raise InputError(p)
    t = _rows("ssihelp", month, rules_dir)
    fbr = t["fbr"][who]
    vtr = round(fbr / 3, 2)
    pmv = round(vtr + t["exclusion"]["amount"], 2)
    used = [t["fbr"], t["food"], t["shelter"]]
    out = {"month": month.isoformat(), "month_long": _month_name(month), "who": who, "home": home, "fbr": fbr, "vtr": vtr, "pmv": pmv}
    steps, cut = [], 0.0
    if home == "others":
        share = round(total / people, 2)
        out.update(share=share, people=people, shelter_total=total)
        pays = pays or 0.0
        out["i_pay"] = pays
        if pa:
            headline = _("Your household may count as a public assistance household")
            steps.append(t["pa"]["plain"] + _(" Tell Social Security who in the household gets SNAP or other need-based help, and ask whether help from inside the household should still be counted."))
            used.append(t["pa"])
        elif pays + 0.005 >= share:
            headline = _("You pay your share, so help from your household should not lower SSI")
            steps.append(t["share"]["plain"])
            used.append(t["share"])
        else:
            gap = round(share - pays, 2)
            cut = vtr
            out["gap"] = gap
            headline = _("SSI may be lowered by up to $%s a month. Paying $%s more toward shelter may stop that") % (_fmt(vtr), _fmt(gap))
            steps += [t["share"]["plain"], _("Your share is the household's shelter costs divided by the number of people: $%s ÷ %d = $%s a month. You pay $%s.") % (_fmt(total), people, _fmt(share), _fmt(pays)),
                      t["vtr"]["plain"]]
            used += [t["share"], t["vtr"]]
    else:
        if family and rent is not None:
            line = min(pmv, market) if market else pmv
            out.update(rent=rent, rent_line=line)
            if rent + 0.005 >= line:
                headline = _("Your rent is high enough that it should not count as help")
            else:
                headline = _("Rent below $%s a month from a parent or child may count as help") % _fmt(line)
                cut = round(max(0.0, min((market - rent) if market else pmv, pmv) - t["exclusion"]["amount"]), 2)
            steps.append(t["rental"]["plain"])
            used.append(t["rental"])
        else:
            headline = _("In your own place, help with food does not count; help with shelter costs from someone else can")
    if outside:
        extra = round(max(0.0, min(outside, pmv) - t["exclusion"]["amount"]), 2)
        out["outside"] = outside
        if home == "own" and not (family and rent is not None):
            cut = extra
            headline = _("Help of $%s a month with shelter may lower SSI by up to $%s") % (_fmt(outside), _fmt(extra))
        steps.append(_("Someone outside your household paying $%s toward your rent or utilities counts as help, up to $%s a month. The first $20 of unearned income each month is not counted, if it is not already used for other income.") % (_fmt(outside), _fmt(pmv)))
        used += [t["pmv"], t["exclusion"]]
    out["may_lower_by"] = cut
    steps += [t["food"]["plain"], t["statement"]["plain"], t["report"]["plain"], t["appeal"]["plain"]]
    used += [t["statement"], t["report"], t["appeal"]]
    out.update(headline=headline, steps=steps)
    return _done(out, used, rules_dir, _("This is an estimate from the figures you entered. Social Security decides how much help counts."))


# ---------------------------------------------------------------- my payment changed

def changed(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    body = as_mapping(raw, "kind", _("The details could not be read. Enter them again."))
    p = {}
    kind = _pick(body, "kind", ("ss", "ssi"), p, _("Choose Social Security or SSI."))
    month = _month(body.get("month") or today.strftime("%Y-%m"), "month", p, today, back=24, ahead=2, message=_("Choose the month the new amount started."))
    fig = {}
    for k in ("old_gross", "new_gross"):
        fig[k] = _money(body.get(k), k, p, top=100_000)
    for k in ("old_medicare", "new_medicare", "old_other", "new_other"):
        fig[k] = _money(body.get(k), k, p, required=False, top=100_000) or 0.0
    if p:
        raise InputError(p)
    t = _rows("changed", month, rules_dir)
    old_paid = round(fig["old_gross"] - fig["old_medicare"] - fig["old_other"], 2)
    new_paid = round(fig["new_gross"] - fig["new_medicare"] - fig["new_other"], 2)
    parts = [
        {"id": "gross", "name": _("Amount before anything is taken out"), "old": fig["old_gross"], "new": fig["new_gross"]},
        {"id": "medicare", "name": _("Medicare premium taken out"), "old": fig["old_medicare"], "new": fig["new_medicare"]},
        {"id": "other", "name": _("Other amounts taken out"), "old": fig["old_other"], "new": fig["new_other"]},
        {"id": "paid", "name": _("What you are paid"), "old": old_paid, "new": new_paid},
    ]
    for x in parts:
        x["change"] = round(x["new"] - x["old"], 2)
    used, why = [], []
    g = parts[0]["change"]
    if month.month == 1:
        pct = t["cola"]["percent"]
        expect = round(fig["old_gross"] * pct / 100, 2)
        used.append(t["cola"])
        if g > 0 and abs(g - expect) <= max(2.0, fig["old_gross"] * 0.002):
            why.append(_("The amount before deductions went up $%s, about the %s%% cost-of-living increase for %d.") % (_fmt(g), pct, month.year))
        elif g >= 0:
            why.append(_("The %d cost-of-living increase is %s%%, which on $%s is about $%s. Your amount before deductions changed by $%s, so something else may also have changed. Ask Social Security for the notice that explains it.")
                       % (month.year, pct, _fmt(fig["old_gross"]), _fmt(expect), _fmt(g), ))
        else:
            why.append(_("The amount before deductions went down even though there is a %s%% cost-of-living increase for %d. Ask Social Security for the notice that explains why.") % (pct, month.year))
    elif g < 0:
        why.append(_("The amount before deductions went down by $%s. Ask Social Security for the notice that explains why.") % _fmt(-g))
    elif g > 0:
        why.append(_("The amount before deductions went up by $%s.") % _fmt(g))
    if g < 0 and kind == "ss":
        why.append(_("One possible reason, if you work: ") + t["earnings"]["plain"])
        used.append(t["earnings"])
    if kind == "ssi" and g != 0:
        why.append(t["ssi_income"]["plain"])
        used.append(t["ssi_income"])
    m = parts[1]
    std = t["part_b"]["amount"]
    if m["change"]:
        used.append(t["part_b"])
        if m["old"] == 0:
            why.append(_("A Medicare premium of $%s is now taken out. If a state program paid it before, that help may have ended.") % _fmt(m["new"]))
        elif m["new"] == 0:
            why.append(_("The Medicare premium is no longer taken out. A state program may now pay it, or you may be billed directly."))
        elif abs(m["new"] - std) < 0.01:
            why.append(_("The Medicare premium is now $%s, the standard Part B premium for %d.") % (_fmt(std), month.year))
        elif m["new"] > std:
            why.append(_("The Medicare premium of $%s is more than the standard $%s. It may include a higher premium because of income, a late-enrollment penalty, or a Part D premium.") % (_fmt(m["new"]), _fmt(std)))
        else:
            why.append(_("The Medicare premium changed from $%s to $%s.") % (_fmt(m["old"]), _fmt(m["new"])))
    o = parts[2]["change"]
    if o > 0:
        why.append(_("Other deductions went up by $%s. This can be repayment of an overpayment, a debt such as a federal student loan, or federal tax withholding.") % _fmt(o))
        why.append(t["tax"]["plain"])
        used.append(t["tax"])
    elif o < 0:
        why.append(_("Other deductions went down by $%s.") % _fmt(-o))
    if not why:
        why.append(_("The figures you entered are the same. Check the amounts on your notice and bank statement."))
    steps = [t["history"]["plain"], t["appeal"]["plain"], _("Call 1-800-772-1213 and ask for the notice that explains the change if you do not have it.")]
    used += [t["history"], t["appeal"]]
    pc = parts[3]["change"]
    headline = (_("Your payment went up $%s") % _fmt(pc)) if pc > 0 else (_("Your payment went down $%s") % _fmt(-pc)) if pc < 0 else _("Your payment did not change")
    links = []
    if m["new"] > std or (m["old"] == 0 and m["new"] > 0):
        links.append("medicare-irmaa" if m["new"] > std else "medicare-costs")
    if o > 0:
        links += ["withholding", "benefit-offset"]
    if kind == "ssi":
        links.append("ssi-help")
    return _done({"kind": kind, "month": month.isoformat(), "month_long": _month_name(month), "headline": headline, "parts": parts, "why": why, "steps": steps, "links": links},
                 used, rules_dir, _("This splits the change using the figures you entered and the published amounts for %d. Your notice from Social Security gives the reasons.") % month.year)
