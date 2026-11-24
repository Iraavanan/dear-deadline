"""Housing rent check: is my rent worked out the way HUD's rules say?

The person copies the figures from their rent notice or rent calculation sheet
(the housing authority's worksheet), and a few facts about the household. The
tool redoes the arithmetic, says which year's deduction amounts the figures
match, names deductions that look missing, and lists what to ask.

It never fills in a missing figure, never gives a rent it cannot check, and never
says the housing authority is wrong: it says what does not add up.
"""

import datetime as dt

from . import rules
from .amount import _amount, money
from .i18n import _, as_of as _asof, listed as _listed, note as _note, rows as _rows
from .validate import InputError, as_mapping

PROGRAMS = ("voucher", "public_housing")
FIGURES = ("annual_income", "dependent_deduction", "elderly_deduction", "medical_deduction", "childcare_deduction",
           "other_deduction", "adjusted_income", "ttp", "utility_allowance", "gross_rent", "payment_standard", "your_rent",
           "medical_costs", "childcare_costs", "income_now", "minimum_rent")


def clean(raw):
    body = as_mapping(raw, "program", _("The figures could not be read. Enter them again."))
    problems, f = {}, {}
    f["program"] = body.get("program")
    if f["program"] not in PROGRAMS:
        problems["program"] = _("Choose voucher or public housing.")
    for k in FIGURES:
        f[k] = _amount(body.get(k), k, problems)
    dep = body.get("dependents")
    try:
        f["dependents"] = int(dep) if dep not in (None, "") else 0
        if not 0 <= f["dependents"] <= 20:
            raise ValueError
    except (TypeError, ValueError):
        problems["dependents"] = _("Enter how many dependents, like 2.")
        f["dependents"] = 0
    f["elderly_disabled"] = body.get("elderly_disabled") is True
    f["new_lease"] = body.get("new_lease") is True
    if f["annual_income"] is None and f["ttp"] is None and "annual_income" not in problems:
        problems["annual_income"] = _("Enter the yearly income on your rent notice or worksheet, or the total tenant payment if that is all it shows.")
    if f["minimum_rent"] is not None and f["minimum_rent"] > 50:
        problems["minimum_rent"] = _("A minimum rent can be at most $50.")
    if problems:
        raise InputError(problems)
    return f


def _deps(n):
    return _("1 dependent") if n == 1 else _("%d dependents") % n


def _round(v):
    return float(int(v + 0.5)) if v >= 0 else -float(int(-v + 0.5))


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    f = clean(raw)
    t = _rows("rent", today, rules_dir)
    sets = t["amounts"]["sets"]
    findings, questions, matches = [], [], []
    inc = f["annual_income"]

    # Which year's amounts do the stated deductions match?
    for s in sets:
        ok = True
        if f["dependents"] and f["dependent_deduction"] is not None:
            ok &= abs(f["dependent_deduction"] - s["dependent"] * f["dependents"]) < 0.005
        if f["elderly_disabled"] and f["elderly_deduction"] not in (None, 0):
            ok &= abs(f["elderly_deduction"] - s["elderly"]) < 0.005
        if ok and ((f["dependents"] and f["dependent_deduction"] is not None) or (f["elderly_disabled"] and f["elderly_deduction"] not in (None, 0))):
            matches.append(_(s["name"]))
    if f["dependents"] and not f["dependent_deduction"]:
        findings.append({"kind": "missing_deduction", "text": _("You have %s, but no dependent deduction is shown. Each dependent should bring a deduction (for 2026 reviews, $%s each under the new amounts, or $480 under the older ones).") % (
            _deps(f["dependents"]), next(s["dependent"] for s in sets if s["id"] == "2026"))})
        questions.append(_("My household has %s. Why is there no dependent deduction on my rent calculation?") % _deps(f["dependents"]))
    elif f["dependents"] and f["dependent_deduction"] is not None and not any(abs(f["dependent_deduction"] - s["dependent"] * f["dependents"]) < 0.005 for s in sets):
        findings.append({"kind": "odd_deduction", "text": _("The dependent deduction of %s does not match %s at any of HUD's published amounts (%s each).") % (
            money(f["dependent_deduction"]), _deps(f["dependents"]), ", ".join("$%d" % a for a in sorted({s["dependent"] for s in sets})))})
        questions.append(_("How was my dependent deduction of %s worked out, and for how many dependents?") % money(f["dependent_deduction"]))
    if f["elderly_disabled"] and not f["elderly_deduction"]:
        findings.append({"kind": "missing_deduction", "text": _("You said the head, spouse or co-head is 62 or older or has a disability, but no elderly or disabled family deduction is shown.")})
        questions.append(_("The head, spouse or co-head of my household is 62 or older or has a disability. Why is there no elderly or disabled family deduction?"))
    if f["medical_costs"] and not f["medical_deduction"] and inc is not None:
        if f["elderly_disabled"]:
            above = round(f["medical_costs"] - 0.10 * inc, 2)
            if above > 0:
                findings.append({"kind": "medical", "text": _("Your unreimbursed medical costs of %s are %s above 10%% of your yearly income, but no medical deduction is shown.") % (money(f["medical_costs"]), money(above))})
                questions.append(_("I have %s a year in medical costs that insurance does not pay. Can these be deducted? Here are the receipts.") % money(f["medical_costs"]))
            else:
                findings.append({"kind": "medical_low", "text": _("Your medical costs are not above 10%% of your yearly income (%s), so under the new rules they may not bring a deduction. Under the older 3%% rule, or if you are phasing in, they may.") % money(0.10 * inc)})
        else:
            findings.append({"kind": "medical_rule", "text": _("Only elderly or disabled families can deduct medical costs, so none is expected for your household.")})
    if f["childcare_costs"] and not f["childcare_deduction"]:
        findings.append({"kind": "childcare", "text": _("You pay %s a year for child care, but no child care deduction is shown. Child care that lets someone in the household work or go to school can be deducted.") % money(f["childcare_costs"])})
        questions.append(_("I pay %s a year for child care so I can work or go to school. Can it be deducted? Here is proof.") % money(f["childcare_costs"]))

    # Arithmetic. Without the income, the stated total tenant payment is taken as given.
    steps, figures = [], {}
    if inc is None:
        return _from_ttp(f, t, findings, questions, matches, rules_dir)
    deds = [f[k] or 0 for k in ("dependent_deduction", "elderly_deduction", "medical_deduction", "childcare_deduction", "other_deduction")]
    adjusted = round(inc - sum(deds), 2)
    figures["adjusted"] = max(adjusted, 0)
    steps.append({"what": _("Adjusted yearly income"), "how": _("%s income minus %s of deductions") % (money(inc), money(sum(deds))), "value": figures["adjusted"],
                  "stated": f["adjusted_income"]})
    if f["adjusted_income"] is not None and abs(f["adjusted_income"] - figures["adjusted"]) >= 1:
        findings.append({"kind": "adjusted", "text": _("Income minus the deductions on your sheet comes to %s, but the sheet shows adjusted income of %s.") % (money(figures["adjusted"]), money(f["adjusted_income"]))})
        questions.append(_("My income minus the deductions comes to %s, but my sheet shows adjusted income of %s. What makes up the difference?") % (money(figures["adjusted"]), money(f["adjusted_income"])))
    thirty, ten = round(0.30 * figures["adjusted"] / 12, 2), round(0.10 * inc / 12, 2)
    candidates = [(_("30% of adjusted monthly income"), thirty), (_("10% of monthly income"), ten)]
    if f["minimum_rent"]:
        candidates.append((_("the minimum rent"), f["minimum_rent"]))
    name, top = max(candidates, key=lambda c: c[1])
    figures["ttp"] = _round(top)
    steps.append({"what": _("Total tenant payment"), "how": _("the highest of %s, rounded to the dollar: %s") % (", ".join("%s (%s)" % (n, money(v)) for n, v in candidates), name),
                  "value": figures["ttp"], "stated": f["ttp"]})
    if f["ttp"] is not None and abs(f["ttp"] - figures["ttp"]) >= 1:
        findings.append({"kind": "ttp", "text": _("From the figures on your sheet, the total tenant payment comes to %s, but the sheet shows %s.") % (money(figures["ttp"]), money(f["ttp"]))})
        questions.append(_("From the figures on my sheet, my total tenant payment comes to %s, but the sheet shows %s. Can you explain the difference?") % (money(figures["ttp"]), money(f["ttp"])))

    ttp = f["ttp"] if f["ttp"] is not None else figures["ttp"]
    rent, rent_note, extra = _rent_steps(f, t, ttp, steps, findings, questions, figures["adjusted"])
    interim = None
    if f["income_now"] is not None and f["income_now"] < inc:
        new_adjusted = max(round(f["income_now"] - sum(deds), 2), 0)
        drop = figures["adjusted"] - new_adjusted
        pct = (drop / figures["adjusted"] * 100) if figures["adjusted"] else 0
        interim = {"new_adjusted": new_adjusted, "drop": round(drop, 2), "percent": round(pct, 1),
                   "text": _("With yearly income of %s now, your adjusted income would be about %s, a drop of %s%%. %s") % (
                       money(f["income_now"]), money(new_adjusted), round(pct, 1),
                       _("That is 10% or more, so you can ask for an interim review and the housing authority should not turn it down for being too small.") if pct >= 10 else
                       _("That is less than 10%, so the housing authority may decline an interim review unless it has set a lower threshold. You can still ask."))}
        questions.append(_("My income has gone down to %s a year. I am asking for an interim review of my rent. What proof do you need?") % money(f["income_now"]))

    return _finish(f, t, steps, figures, rent, rent_note, matches, findings, questions, interim, rules_dir, extra)


def _rent_steps(f, t, ttp, steps, findings, questions, adjusted):
    """What the family pays, from the total tenant payment. Returns (rent to owner or rent, a note, extra figures)."""
    ua, extra, rent, note = f["utility_allowance"], {}, None, None
    if f["program"] == "voucher":
        if f["gross_rent"] is None or f["payment_standard"] is None:
            note = _("To check what you pay the owner, enter the rent plus utility allowance (gross rent) and the payment standard from your notice.")
        else:
            hap = round(max(min(f["payment_standard"], f["gross_rent"]) - ttp, 0), 2)
            share = round(f["gross_rent"] - hap, 2)
            extra["hap"], extra["family_share"] = hap, share
            over = max(0.0, round(f["gross_rent"] - f["payment_standard"], 2))
            steps.append({"what": _("Housing assistance payment"), "how": _("the lower of the payment standard (%s) and the gross rent (%s), minus your total tenant payment %s") % (
                money(f["payment_standard"]), money(f["gross_rent"]), money(ttp)), "value": hap, "stated": None})
            steps.append({"what": _("Your share"), "how": _("gross rent %s minus the housing assistance payment %s") % (money(f["gross_rent"]), money(hap)), "value": share, "stated": None})
            rent = round(share - (ua or 0), 2)
            steps.append({"what": _("What you pay the owner"), "how": _("your share minus the utility allowance of %s") % money(ua or 0), "value": max(rent, 0), "stated": f["your_rent"]})
            if over:
                findings.append({"kind": "over_standard", "text": _("Your gross rent is %s above the payment standard, so you pay that much more than your total tenant payment.") % money(over)})
            if f["new_lease"] and adjusted is not None and share > round(0.40 * adjusted / 12, 2) + 0.005:
                findings.append({"kind": "burden", "text": _("For a new lease, your share (%s) may not be more than 40%% of your adjusted monthly income (%s). The housing authority should not approve this unit at this rent.") % (
                    money(share), money(0.40 * adjusted / 12))})
                questions.append(_("For this new lease my share would be %s, more than 40%% of my adjusted monthly income. Can the rent be lowered, or can I look for another unit?") % money(share))
    else:
        if ua is None:
            note = _("If you pay utilities yourself, enter the utility allowance to check your rent.")
        rent = round(ttp - (ua or 0), 2)
        steps.append({"what": _("Your rent"), "how": _("total tenant payment %s minus the utility allowance of %s") % (money(ttp), money(ua or 0)), "value": max(rent, 0), "stated": f["your_rent"]})
    if rent is not None and rent < 0:
        extra["reimbursement"] = round(-rent, 2)
        findings.append({"kind": "reimbursement", "text": _("The utility allowance is more than %s, so you pay nothing to %s and the housing authority may pay you or the utility the difference of %s.") % (
            _("your share") if f["program"] == "voucher" else _("your total tenant payment"), _("the owner") if f["program"] == "voucher" else _("the housing authority"), money(-rent))})
    if rent is not None and f["your_rent"] is not None and abs(f["your_rent"] - max(rent, 0)) >= 1:
        findings.append({"kind": "rent", "text": _("From these figures your rent comes to %s, but your notice says %s.") % (money(max(rent, 0)), money(f["your_rent"]))})
        questions.append(_("From the figures on my notice, my rent comes to %s, but the notice says %s. Can you explain the difference?") % (money(max(rent, 0)), money(f["your_rent"])))
    return (max(rent, 0) if rent is not None else None), note, extra


def _from_ttp(f, t, findings, questions, matches, rules_dir):
    steps = [{"what": _("Total tenant payment"), "how": _("as shown on your notice (no income entered, so it is taken as given)"), "value": f["ttp"], "stated": f["ttp"]}]
    rent, note, extra = _rent_steps(f, t, f["ttp"], steps, findings, questions, None)
    return _finish(f, t, steps, {"ttp": f["ttp"]}, rent, note, matches, findings, questions, None, rules_dir, extra)


def _finish(f, t, steps, figures, rent, rent_note, matches, findings, questions, interim, rules_dir, extra):
    if any(x["kind"] in ("adjusted", "ttp", "rent") for x in findings):
        headline = _("Your rent does not add up from these figures")
    elif any(x["kind"] in ("missing_deduction", "odd_deduction", "medical", "childcare") for x in findings):
        headline = _("A deduction may be missing")
    elif interim and interim["percent"] >= 10:
        headline = _("You can ask for your rent to be reviewed")
    else:
        headline = _("Your rent adds up from these figures")
    if not questions:
        questions.append(_("Please send me the rent calculation sheet for my last review, so I can check it."))
    return {
        "headline": headline, "program": f["program"], "steps": steps, "figures": dict(figures, **extra), "rent": rent, "rent_note": rent_note,
        "matches": matches, "findings": findings, "questions": questions, "interim": interim,
        "letter": _letter(f, questions, interim),
        "rules": _listed(t[k] for k in ("ttp", "deductions", "amounts", "medical_phase", "voucher" if f["program"] == "voucher" else "public_housing", "minimum_rent", "interim")),
        "rules_as_of": _asof(rules_dir),
        "disclaimer": _note(_("This is arithmetic on the figures you entered. It was made by an independent tool, not by HUD or your housing authority, and it is not legal advice. Only the housing authority can change your rent.")),
    }


def _letter(f, questions, interim):
    lines = ["To: [your housing authority, from your notice]", "Date: [today's date]", "Name: [your name]", "Address: [your address]", "",
             "I am writing about the rent calculation for my %s." % ("Housing Choice Voucher" if f["program"] == "voucher" else "public housing unit"), ""]
    if interim:
        lines += ["My income has gone down. I am asking for an interim review of my rent.", ""]
    lines.append("Please answer these questions:")
    lines += ["%d. %s" % (i, q) for i, q in enumerate(questions, start=1)]
    lines += ["", "Please send me a copy of my rent calculation sheet and reply in writing.", "", "Signature: ____________________"]
    return "\n".join(lines)


LABELS = (("annual_income", "Yearly income used"), ("dependent_deduction", "Dependent deduction"), ("elderly_deduction", "Elderly or disabled family deduction"),
          ("medical_deduction", "Medical expense deduction"), ("childcare_deduction", "Child care deduction"), ("other_deduction", "Other deduction"),
          ("utility_allowance", "Utility allowance"), ("gross_rent", "Gross rent (rent plus utility allowance)"), ("payment_standard", "Payment standard"),
          ("your_rent", "Rent you pay"))


def compare(raw, today=None, rules_dir=None):
    """Why did my rent change? Both sheets are worked through, and the change in rent is split
    into what moved: the total tenant payment, the amount over the payment standard, and the utility allowance."""
    body = as_mapping(raw, "old", _("The figures could not be read. Enter them again."))
    old_in, new_in = body.get("old"), body.get("new")
    if not isinstance(old_in, dict) or not isinstance(new_in, dict):
        raise InputError({"old": _("Enter the figures from both rent sheets.")})
    problems = {}
    try:
        a = run(old_in, today, rules_dir)
    except InputError as e:
        problems.update({"old_" + k: v for k, v in e.problems.items()})
    try:
        b = run(new_in, today, rules_dir)
    except InputError as e:
        problems.update({"new_" + k: v for k, v in e.problems.items()})
    if problems:
        raise InputError(problems)
    fa, fb = clean(old_in), clean(new_in)
    moved, kinds = [], []
    for k, label in LABELS:
        label = _(label)
        x, y = fa[k], fb[k]
        if x is None and y is None:
            continue
        if x is None or y is None:
            kinds.append(k)
            moved.append({"what": label, "old": x, "new": y, "text": _("%s: shown on only one sheet (%s before, %s now).") % (label, _m(x), _m(y))})
        elif abs(x - y) >= 0.005:
            kinds.append(k)
            moved.append({"what": label, "old": x, "new": y, "text": (_("%s went up from %s to %s.") if y > x else _("%s went down from %s to %s.")) % (label, money(x), money(y))})
    if fa["dependents"] != fb["dependents"]:
        kinds.append("dependents")
        moved.append({"what": _("Dependents"), "old": fa["dependents"], "new": fb["dependents"], "text": _("Dependents changed from %d to %d.") % (fa["dependents"], fb["dependents"])})

    parts, why = [], []
    ttp_a = a["figures"].get("ttp"); ttp_b = b["figures"].get("ttp")
    if a["rent"] is None or b["rent"] is None or ttp_a is None or ttp_b is None:
        change, headline = None, _("The rent change cannot be split up from these figures")
        why.append(_("To see why your rent changed, both sheets need the total tenant payment (or the income), and for a voucher the gross rent and payment standard."))
    else:
        change = round(b["rent"] - a["rent"], 2)
        headline = (_("Your rent went up by %s") if change > 0 else _("Your rent went down by %s")) % money(abs(change)) if abs(change) >= 0.005 else _("Your rent did not change")
        d_ttp = round(ttp_b - ttp_a, 2)
        if abs(d_ttp) >= 0.005:
            parts.append({"what": _("Total tenant payment"), "amount": d_ttp})
            why.append((_("Your total tenant payment went up by %s%s.") if d_ttp > 0 else _("Your total tenant payment went down by %s%s.")) % (money(abs(d_ttp)),
                       _(" because the income used changed") if fa["annual_income"] != fb["annual_income"] and fa["annual_income"] is not None and fb["annual_income"] is not None else ""))
        if a["program"] == "voucher" and b["program"] == "voucher":
            over_a = max(0.0, (fa["gross_rent"] or 0) - (fa["payment_standard"] or 0)); over_b = max(0.0, (fb["gross_rent"] or 0) - (fb["payment_standard"] or 0))
            d_over = round(over_b - over_a, 2)
            if abs(d_over) >= 0.005:
                parts.append({"what": _("Amount the gross rent is over the payment standard"), "amount": d_over})
                why.append((_("The amount your gross rent is above the payment standard went up by %s. That comes from the owner's rent, the utility allowance or the payment standard, not your income.") if d_over > 0 else
                            _("The amount your gross rent is above the payment standard went down by %s. That comes from the owner's rent, the utility allowance or the payment standard, not your income.")) % money(abs(d_over)))
        d_ua = round((fb["utility_allowance"] or 0) - (fa["utility_allowance"] or 0), 2)
        if abs(d_ua) >= 0.005:
            parts.append({"what": _("Utility allowance"), "amount": round(-d_ua, 2)})
            why.append((_("The utility allowance went up by %s, which lowers what you pay by the same amount.") if d_ua > 0 else _("The utility allowance went down by %s, which raises what you pay by the same amount.")) % money(abs(d_ua)))
        rest = round(change - sum(p["amount"] for p in parts), 2)
        if abs(rest) >= 1:                                # e.g. a zero floor or a reimbursement on one sheet
            parts.append({"what": _("Other (for example a utility reimbursement)"), "amount": rest})
    questions = [_("Please send me the rent calculation sheets for my last two reviews, so I can see what changed.")]
    for m, kind in zip(moved, kinds):
        if kind == "annual_income" and m["old"] is not None and m["new"] is not None:
            questions.append(_("My yearly income used changed from %s to %s. What information was this based on? Please send me a copy.") % (money(m["old"]), money(m["new"])))
        if kind == "dependents":
            questions.append(_("My dependents changed from %s to %s. What information was this based on? Please send me a copy.") % (m["old"], m["new"]))
        if "deduction" in kind and m["new"] in (None, 0) and m["old"]:
            questions.append(_("My %s was %s before and is now gone. Why was it removed?") % (m["what"].lower(), money(m["old"])))
    for q in b["questions"]:
        if q not in questions and q != _("Please send me the rent calculation sheet for my last review, so I can check it."):
            questions.append(q)
    return {"headline": headline, "change": change, "parts": parts, "why": why, "moved": moved, "old": a, "new": b, "questions": questions,
            "rules_as_of": a["rules_as_of"], "rules": b["rules"],
            "disclaimer": _note(_("This compares the figures you entered from two rent sheets. It was made by an independent tool, not by HUD or your housing authority. Only the housing authority can change your rent."))}


def _m(v):
    return _("not shown") if v is None else money(v)
