"""Benefit math check: re-work a retired worker's first monthly Social Security benefit from the earnings record.

The arithmetic is done by ssa_ref.py, the reference program from "How Accurate Are Open-Source Social
Security Calculators?" (Thapa, 2026; data and code at https://doi.org/10.5281/zenodo.24375957). It was
written from the Social Security Act and the regulations, and it agrees with the Social Security
Administration's Detailed Calculator (version 2026.2) on all 1,231 test workers; tests/test_benefitmath.py
runs every one of them.

The check is offered only inside the range those workers cover: a worker's own retirement benefit that
starts between January and November 2026, at or before full retirement age. Outside it, or when an answer
shows the case is of another kind, no figure is given and the person is told how to ask Social Security
for the calculation. Nothing is stored.
"""

import datetime as dt
import re

from . import rules, ssa_ref
from .fixes import _done, _money, _pick
from .ssalife import _month_name, _yes
from .ssamore import _fmt
from .i18n import _, rows as _rows
from .validate import InputError, as_mapping

START_FROM, START_TO = (2026, 1), (2026, 11)             # the months the 1,231 test workers started benefits
MIN_YEARS = 10                                           # fewer years of earnings usually means too few work credits
_P = None


def _params():
    global _P
    if _P is None:
        _P = ssa_ref.load_params()
    return _P


def _earnings(body, p, last_year):
    """Earnings by year, from a mapping or from pasted lines such as '1998 31,250'."""
    raw = body.get("earnings")
    out = {}
    if isinstance(raw, dict):
        pairs = list(raw.items())
    else:
        pairs = []
        for line in str(raw or "").splitlines():
            m = re.match(r"^\s*((?:19|20)\d\d)\D+?\$?\s*([\d,]+(?:\.\d{1,2})?)\s*$", line)
            if m:
                pairs.append((m.group(1), m.group(2)))
            elif line.strip():
                p["earnings"] = _("Each line needs a year and an amount, such as: 1998 31,250. This line could not be read: ") + line.strip()[:40]
                return {}
    for y, v in pairs:
        try:
            year, amount = int(str(y).strip()), float(str(v).replace(",", "").replace("$", "").strip())
        except (TypeError, ValueError):
            p["earnings"] = _("Each line needs a year and an amount, such as: 1998 31,250.")
            return {}
        if not 1951 <= year <= last_year or amount < 0 or amount > 10_000_000:
            p["earnings"] = _("Check %s: years run from 1951 to %d, and amounts cannot be negative.") % (year, last_year)
            return {}
        if year in out:
            p["earnings"] = _("The year %d appears twice.") % year
            return {}
        out[year] = round(amount, 2)
    if not out and "earnings" not in p:
        p["earnings"] = _("Enter your earnings, one year on each line, from your Social Security Statement.")
    return out


def _ask(reason, t, rules_dir):
    steps = [_("Ask Social Security how your benefit was worked out. Call 1-800-772-1213 or visit a local office and ask for the earnings used, the average indexed monthly earnings and the primary insurance amount."),
             t["official"]["plain"],
             _("Compare the earnings on your Social Security Statement with your own records. A missing or wrong year changes the benefit. The helper \"Is a year missing from my earnings record?\" can help."),
             _("If you think the amount is wrong, you generally have 60 days from getting the notice to ask for reconsideration.")]
    return _done({"checked": False, "headline": _("This check cannot work out your benefit"), "reason": reason, "steps": steps, "links": ["earnings-record", "ssa-call", "decision-appeal"]},
                 [t["scope"], t["official"]], rules_dir, _("No figure is given because your case is outside what this check has been tested on."))


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = dict(_rows("benefitmath", today, rules_dir))
    t["history"] = _rows("changed", today, rules_dir)["history"]
    body = as_mapping(raw, "birth", _("The details could not be read. Enter them again."))
    p = {}
    try:
        birth = dt.date.fromisoformat(str(body.get("birth"))[:10])
        if not dt.date(1900, 1, 1) <= birth <= today:
            raise ValueError
    except ValueError:
        birth = None
        p["birth"] = _("Enter your date of birth as month, day and year.")
    try:
        sy, sm = (int(x) for x in str(body.get("start")).split("-")[:2])
        dt.date(sy, sm, 1)
    except (TypeError, ValueError):
        sy = sm = None
        p["start"] = _("Choose the month your retirement benefit started.")
    own = _pick(body, "kind", ("own", "other"), p, _("Choose the kind of benefit."))
    stated = _money(body.get("stated"), "stated", p, required=False, top=20_000)
    earnings = _earnings(body, p, today.year)
    if p:
        raise InputError(p)

    # ---- outside what has been tested: say so, give no figure
    if own != "own":
        return _ask(_("It covers a worker's own retirement benefit, not a benefit as a husband, wife, widow, widower or child."), t, rules_dir)
    if _yes(body, "disability"):
        return _ask(_("It does not cover people who have had Social Security disability benefits, because those years are counted differently."), t, rules_dir)
    if _yes(body, "military"):
        return _ask(_("It does not cover active military service before 2002, which can add extra wage credits."), t, rules_dir)
    if not START_FROM <= (sy, sm) <= START_TO:
        return _ask(_("It has been tested only on retirement benefits that started between January and November 2026. Yours started in %s.") % _month_name(dt.date(sy, sm, 1)), t, rules_dir)
    P = _params()
    if ssa_ref.fra_months(birth, P) is None:
        return _ask(_("It covers people who reach full retirement age in 2026 or later."), t, rules_dir)
    later = sorted(y for y in earnings if y >= sy)
    earnings = {y: v for y, v in earnings.items() if y < sy}
    paid = [y for y, v in earnings.items() if v > 0]
    if len(paid) < MIN_YEARS:
        return _ask((_("You entered 1 year with earnings. With fewer than %d, a worker usually does not have the 40 work credits a retirement benefit needs, and this check assumes they do.") % MIN_YEARS if len(paid) == 1 else
                     _("You entered %d years with earnings. With fewer than %d, a worker usually does not have the 40 work credits a retirement benefit needs, and this check assumes they do.") % (len(paid), MIN_YEARS)), t, rules_dir)
    try:
        r = ssa_ref.compute(birth, {y: ("%.2f" % v) for y, v in earnings.items()}, (sy, sm), P)
    except ValueError as err:
        why = _("It covers benefits that start at or before full retirement age. Yours started later, which adds delayed retirement credits.") if "after full retirement age" in str(err) \
            else _("The month you entered is before the first month you were 62 for the whole month, so a retirement benefit could not start then. Check the birth date and the starting month.")
        return _ask(why, t, rules_dir)
    except KeyError:
        return _ask(_("One of the years you entered is outside the yearly figures this check holds."), t, rules_dir)

    benefit, pia = r["benefit"], float(r["pia"])
    capped = sorted(y for y, v in earnings.items() if y in P["base"] and v > float(P["base"][y]))
    work = [
        {"label": _("Year you reached 62 (the law counts the day before your birthday)"), "value": str(r["eligibility_year"])},
        {"label": _("Earnings before %d are raised in line with average wages up to %d") % (r["index_year"], r["index_year"]), "value": _("indexed to %d") % r["index_year"]},
        {"label": _("Highest years counted"), "value": _("%d years") % r["computation_years"]},
        {"label": _("Average indexed monthly earnings"), "value": "$%s" % _fmt(r["aime"])},
        {"label": _("Primary insurance amount at 62"), "value": "$%s" % _fmt(float(r["pia_at_eligibility"]))},
        {"label": (_("After the cost-of-living increases of ") + ", ".join(str(y) for y in r["colas_applied"])) if r["colas_applied"] else _("No cost-of-living increase applies yet"), "value": "$%s" % _fmt(pia)},
        {"label": _("Months before full retirement age"), "value": str(r["reduction_months"])},
        {"label": _("Monthly benefit, rounded down to the dollar"), "value": "$%s" % _fmt(benefit)},
    ]
    notes = []
    if capped:
        notes.append(_("Earnings above the yearly limit that counts for Social Security were cut to that limit in %s.") % ", ".join(str(y) for y in capped))
    if later:
        notes.append(_("Earnings in %s are not counted in the first benefit, which uses the years before the benefit starts. Social Security adds later earnings in a recalculation.") % ", ".join(str(y) for y in later))
    unused = sorted(set(paid) - set(r["years_used"]))
    if unused:
        notes.append(_("Not counted, because other years were higher: %s.") % ", ".join(str(y) for y in unused))
    if len(paid) < r["computation_years"]:
        notes.append(_("You entered %d years with earnings and %d years are counted, so the rest count as zero.") % (len(paid), r["computation_years"]))
    steps, diff = [], None
    if stated is None:
        headline = _("From these earnings, the first monthly benefit works out to $%s") % _fmt(benefit)
        steps.append(_("Compare this with the monthly amount on your award letter, before Medicare premiums or anything else is taken out."))
    else:
        diff = round(stated - benefit, 2)
        if abs(diff) < 0.005:
            headline = _("The amount on your letter matches: $%s a month") % _fmt(benefit)
            steps.append(_("From the earnings you entered, the rules give the same monthly benefit as your letter."))
        else:
            headline = _("Your letter says $%s. From these earnings the rules give $%s") % (_fmt(stated), _fmt(benefit))
            steps += [_("A difference does not by itself mean Social Security made a mistake. First check that you entered the amount before deductions: a Medicare premium, tax withholding or a repayment lowers what is paid, not the benefit."),
                      _("Check each year against your Social Security Statement. Social Security may hold different earnings for a year than you entered."),
                      _("Ask Social Security for the figures it used: the earnings for each year, the average indexed monthly earnings and the primary insurance amount. Compare them with the working below."),
                      _("If the figures still differ and you think the benefit is wrong, you generally have 60 days from getting the award notice to ask for reconsideration.")]
    steps.append(t["history"]["plain"])
    return _done({"checked": True, "headline": headline, "benefit": benefit, "stated": stated, "difference": diff, "work": work, "years_used": r["years_used"], "notes": notes, "steps": steps,
                  "links": ["earnings-record", "amount-changed"] if diff else ["earnings-record"]},
                 [t["engine"], t["scope"], t["official"], t["history"]], rules_dir,
                 _("This re-works the first monthly benefit from the earnings you entered. Social Security's own records decide what you are paid."))
