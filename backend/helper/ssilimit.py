"""SSI $2,000 tracker. The person enters, for each month, what they had in accounts and cash on
the 1st, and any money that the rules let them leave out (a federal tax refund, past-due
benefits, a burial fund). This works out, month by month, what may count toward the limit.

It never says someone is or is not eligible: only what their own figures show against the
limit, with the rule for each step. Nothing is stored.
"""

import datetime as dt

from . import rules
from .validate import InputError, as_mapping

HOUSEHOLDS = ("single", "couple")
SET_ASIDE = ("tax_refund", "retro", "burial")
NAMES = {"tax_refund": "federal tax refund", "retro": "past-due benefits", "burial": "burial fund"}
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")


def _month(value):
    if not isinstance(value, str) or len(value) != 7 or value[4] != "-":
        raise ValueError
    y, m = int(value[:4]), int(value[5:])
    if not 1 <= m <= 12:
        raise ValueError
    return y, m


def _add(ym, n):
    y, m = ym
    k = y * 12 + (m - 1) + n
    return k // 12, k % 12 + 1


def _name(ym):
    return "%s 1, %d" % (MONTHS[ym[1] - 1], ym[0])


def _money(v):
    if isinstance(v, bool) or not isinstance(v, (int, float, str)):
        raise ValueError
    x = float(str(v).replace(",", "").replace("$", "").strip())
    if x < 0 or x > 10_000_000:
        raise ValueError
    return round(x, 2)


def clean(raw, today):
    body = as_mapping(raw, "household", "The details could not be read. Enter them again.")
    problems = {}
    household = body.get("household")
    if household not in HOUSEHOLDS:
        problems["household"] = "Choose whether this is for one person or a married couple."
    months = []
    given = body.get("months") or []
    if not isinstance(given, list) or not given:
        problems["months"] = "Enter at least one month."
        given = []
    if len(given) > 24:
        problems["months"] = "Enter up to 24 months."
        given = given[:24]
    latest = (today.year, today.month)
    for i, m in enumerate(given):
        try:
            ym = _month((m or {}).get("month"))
            if ym > _add(latest, 1):
                raise ValueError
        except (ValueError, TypeError, AttributeError):
            problems["months.%d.month" % i] = "Choose the month."
            continue
        try:
            months.append((ym, _money(m.get("on_the_1st"))))
        except (ValueError, TypeError):
            problems["months.%d.on_the_1st" % i] = "Enter what you had on the 1st, in dollars."
    items = []
    for i, it in enumerate(body.get("set_aside") or []):
        if not isinstance(it, dict) or it.get("kind") not in SET_ASIDE:
            problems["set_aside.%d.kind" % i] = "Choose what kind of money this is."
            continue
        try:
            amt = _money(it.get("amount"))
        except (ValueError, TypeError):
            problems["set_aside.%d.amount" % i] = "Enter the amount in dollars."
            continue
        try:
            got = _month(it.get("month"))
        except (ValueError, TypeError):
            problems["set_aside.%d.month" % i] = "Choose the month you got it or set it aside."
            continue
        items.append({"kind": it["kind"], "amount": amt, "month": got})
    if len({ym for ym, _ in months}) != len(months):
        problems["months"] = "Each month should be entered once."
    if problems:
        raise InputError(problems)
    return {"household": household, "months": sorted(months), "set_aside": items}


def _left_out(ym, items, t):
    """What the rules let this person leave out on the 1st of month ym, item by item."""
    out = []
    for it in items:
        if it["kind"] == "burial":
            if ym > it["month"]:
                out.append((it, min(it["amount"], t["burial"]["cap"])))
        else:
            span = t["tax_refund"]["months"] if it["kind"] == "tax_refund" else t["retro"]["months"]
            # Received in month R: income in R, left out of resources for the next `span` months.
            if it["month"] < ym <= _add(it["month"], span):
                out.append((it, it["amount"]))
    return out


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = rules.rows_as_of("ssilimit", today, rules_dir)
    rep = rules.rows_as_of("reporting", today, rules_dir)
    f = clean(raw, today)
    limit = t["limit"]["single" if f["household"] == "single" else "couple"]
    rows, over = [], []
    for ym, had in f["months"]:
        parts = _left_out(ym, f["set_aside"], t)
        left = round(min(had, sum(a for _, a in parts)), 2)
        counts = round(had - left, 2)
        r = {"month": "%d-%02d" % ym, "first_of_month": _name(ym), "on_the_1st": had,
             "left_out": left, "left_out_items": [{"what": NAMES[it["kind"]], "amount": a} for it, a in parts],
             "may_count": counts, "limit": limit, "room": round(limit - counts, 2),
             "over_by": round(max(0, counts - limit), 2)}
        r["status"] = "over" if counts > limit else ("close" if limit - counts < 200 else "under")
        if r["status"] == "over" and r["over_by"] <= t["tolerance"]["amount"]:
            r["small"] = True
        rows.append(r)
        if r["status"] == "over":
            over.append(r)

    used = [t["limit"], t["first_moment"]]
    kinds = {it["kind"] for it in f["set_aside"]}
    if "tax_refund" in kinds:
        used.append(t["tax_refund"])
    if "retro" in kinds:
        used.append(t["retro"])
    if "burial" in kinds:
        used.append(t["burial"])
    used.append(t["able"])
    steps = []
    if over:
        headline = "Your figures may be over the limit on the 1st of %d month%s" % (len(over), "" if len(over) == 1 else "s")
        steps.append("Tell Social Security about the change. " + rep["ssi_deadline"]["plain"])
        used.append(rep["ssi_deadline"])
        if any(r.get("small") for r in over):
            steps.append("In a month where you were over by $%d or less, an overpayment caused only by that may be waived if it was not your fault. Ask about the $%d tolerance." % (t["tolerance"]["amount"], t["tolerance"]["amount"]))
            used.append(t["tolerance"])
        used.append(t["suspension"])
        steps.append(t["suspension"]["plain"])
    else:
        close = [r for r in rows if r["status"] == "close"]
        headline = ("Your figures are under the limit, but close in %d month%s" % (len(close), "" if len(close) == 1 else "s")) if close else "Your figures are under the limit on the 1st of every month you entered"
    steps.append("Money spent before the 1st on things for yourself (rent, bills, food, clothes, things for your home, paying down a debt) is no longer there to count. Keep receipts.")
    steps.append("An ABLE account (if your disability began before age 46) or a burial fund can hold money that does not count, within the limits shown below.")
    steps.append(t["transfer"]["plain"])
    used.append(t["transfer"])
    used.append(t["leading_cause"])
    return {
        "household": f["household"], "limit": limit, "headline": headline, "months": rows,
        "months_over": len(over), "steps": steps,
        "rules": [{"plain": r["plain"], "source": r["source"]} for r in used],
        "rules_as_of": rules.rules_checked_as_of(rules_dir),
        "disclaimer": "This works out what may count from the figures you entered. Social Security decides what counts, and other things you own (a second car, property, some life insurance) can count too. It does not decide your eligibility. This is an independent tool, not a government agency, and not legal advice.",
    }
