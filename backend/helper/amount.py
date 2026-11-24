"""How did Social Security get this amount? A month-by-month check of an overpayment notice.

The person copies the figures from the notice: for each period, the months it
covers, what was paid each month and what should have been paid. The tool adds
them up, says which figures the notice leaves out, compares the result with the
total the notice states, and keeps anything already repaid or withheld apart
from the original overpayment. With two letters, it lists where they differ.

It never fills in a missing figure and never gives a total it cannot check.
It does not say the notice is wrong: it says what does not add up, and what to ask.
"""

import datetime as dt
import re

from . import rules
from .i18n import _, as_of as _asof, month_name as _month_name, note as _note, rows as _rows
from .validate import InputError, _parse_date, as_mapping

MAX_ROWS = 36
LETTERS = ("a", "b")
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
_ISO = re.compile(r"^\s*(\d{4})\s*-\s*(\d{1,2})\s*$")
_US = re.compile(r"^\s*(\d{1,2})\s*/\s*(\d{4})\s*$")
_WORDS = re.compile(r"^\s*([A-Za-z]+)\.?\s+(\d{4})\s*$")


def _month(text):
    """'2023-02', '02/2023', '2/2023' or 'February 2023' to (2023, 2)."""
    if not isinstance(text, str):
        raise ValueError
    m = _ISO.match(text)
    if m:
        y, mo = int(m.group(1)), int(m.group(2))
    else:
        m = _US.match(text)
        if m:
            mo, y = int(m.group(1)), int(m.group(2))
        else:
            m = _WORDS.match(text)
            if not m:
                raise ValueError
            name = m.group(1).lower()
            hits = [i for i, n in enumerate(MONTHS) if n.lower().startswith(name[:3]) and len(name) >= 3]
            if len(hits) != 1:
                raise ValueError
            mo, y = hits[0] + 1, int(m.group(2))
    if not 1 <= mo <= 12 or not 1990 <= y <= 2100:
        raise ValueError
    return y, mo


def _index(ym):
    return ym[0] * 12 + ym[1] - 1


def _from_index(i):
    return i // 12, i % 12 + 1


def _say_month(ym):
    return _month_name(dt.date(ym[0], ym[1], 1))


def _span(a, b):
    return _say_month(a) if a == b else _("%s to %s") % (_say_month(a), _say_month(b))


def money(v):
    return ("-$" if v < 0 else "$") + "{:,.2f}".format(abs(v))


def _amount(value, key, problems):
    if value in (None, ""):
        return None
    if isinstance(value, (bool, list, dict)):
        problems[key] = _("Enter an amount, like 1500.")
        return None
    try:
        v = round(float(str(value).replace(",", "").replace("$", "").strip()), 2)
    except ValueError:
        problems[key] = _("Enter an amount, like 1500.")
        return None
    if v < 0 or v > 10000000:
        problems[key] = _("Enter an amount between 0 and 10,000,000.")
        return None
    return v


def clean(raw, today):
    body = as_mapping(raw, "letters", _("The figures could not be read. Enter them again."))
    letters_in = body.get("letters")
    if not isinstance(letters_in, list) or not 1 <= len(letters_in) <= len(LETTERS):
        raise InputError({"letters": _("Enter the figures from one or two letters.")})
    problems, out = {}, []
    for li, (tag, letter) in enumerate(zip(LETTERS, letters_in)):
        if not isinstance(letter, dict):
            raise InputError({"letters": _("The figures could not be read. Enter them again.")})
        clean_letter = {"tag": tag, "date": None, "rows": []}
        if letter.get("date") not in (None, ""):
            try:
                clean_letter["date"] = _parse_date(letter.get("date"))
                if clean_letter["date"] > today or clean_letter["date"].year < 2000:
                    problems[tag + "_date"] = _("Check the date printed on the letter.")
            except (TypeError, ValueError):
                problems[tag + "_date"] = _("Enter the date as month, day and year, or leave it empty.")
        clean_letter["stated"] = _amount(letter.get("stated_total"), tag + "_total", problems)
        clean_letter["repaid"] = _amount(letter.get("repaid"), tag + "_repaid", problems)
        rows_in = letter.get("rows")
        if not isinstance(rows_in, list) or len(rows_in) > MAX_ROWS:
            raise InputError({tag + "_rows": _("Enter up to %d periods.") % MAX_ROWS})
        for ri, row in enumerate(rows_in, start=1):
            if not isinstance(row, dict):
                raise InputError({tag + "_rows": _("A period could not be read. Enter it again.")})
            key = "%s%d_" % (tag, ri)
            if all(row.get(k) in (None, "") for k in ("from", "to", "paid", "due")):
                continue                                   # an empty period is left out
            got = {"n": ri}
            for k in ("from", "to"):
                try:
                    got[k] = _month(row.get(k))
                except ValueError:
                    problems[key + k] = _("Enter the month and year, like 02/2023.") if row.get(k) not in (None, "") else (_("Enter the first month of this period.") if k == "from" else _("Enter the last month of this period."))
            if "from" in got and "to" in got and _index(got["to"]) < _index(got["from"]):
                problems[key + "to"] = _("The last month is before the first month.")
            elif "from" in got and "to" in got and _index(got["to"]) - _index(got["from"]) > 600:
                problems[key + "to"] = _("That period is more than 50 years. Check the years.")
            got["paid"] = _amount(row.get("paid"), key + "paid", problems)
            got["due"] = _amount(row.get("due"), key + "due", problems)
            clean_letter["rows"].append(got)
        if not clean_letter["rows"] and not problems:
            problems["%s1_from" % tag] = _("Enter at least one period from the notice.")
        out.append(clean_letter)
    if problems:
        raise InputError(problems)
    return out


def _check(letter):
    rows, findings, questions = [], [], []
    covered = {}
    for r in letter["rows"]:
        a, b = _index(r["from"]), _index(r["to"])
        months = b - a + 1
        period = _span(r["from"], r["to"])
        row = {"n": r["n"], "period": period, "months": months, "paid_each": r["paid"], "due_each": r["due"],
               "paid": None if r["paid"] is None else round(r["paid"] * months, 2),
               "due": None if r["due"] is None else round(r["due"] * months, 2)}
        row["difference"] = None if row["paid"] is None or row["due"] is None else round(row["paid"] - row["due"], 2)
        missing = [k for k, v in (("paid", r["paid"]), ("due", r["due"])) if v is None]
        if missing:
            findings.append({"kind": "missing", "text": _("Period %d (%s): the notice does not give %s.") % (r["n"], period, _(" or ").join({"paid": _("what was paid each month"), "due": _("what should have been paid each month")}[k] for k in missing))})
            questions.append(_("For %s, what do you say %s?") % (period, _(" and ").join({"paid": _("you paid me each month"), "due": _("you should have paid me each month")}[k] for k in missing)))
        if row["difference"] is not None and row["difference"] < 0:
            findings.append({"kind": "under", "text": _("Period %d (%s): the figures show you were paid %s less than was due. That is an underpayment, not an overpayment.") % (r["n"], period, money(-row["difference"]))})
            questions.append(_("For %s the figures show I was paid less than was due. Was that taken into account?") % period)
        for i in range(a, b + 1):
            covered.setdefault(i, []).append(r["n"])
        rows.append(row)

    overlap = sorted(i for i, ns in covered.items() if len(ns) > 1)
    for start, end in _runs(overlap):
        ns = sorted(set(n for i in range(start, end + 1) for n in covered[i]))
        span = _span(_from_index(start), _from_index(end))
        findings.append({"kind": "overlap", "text": (_("%s appears in more than one period (periods %s). A month should be counted once.") if start == end else _("%s appear in more than one period (periods %s). A month should be counted once.")) % (span[0].upper() + span[1:], _(" and ").join(str(n) for n in ns))})
        questions.append((_("%s appears in more than one period on the notice. Which figure is right?") if start == end else _("%s appear in more than one period on the notice. Which figure is right?")) % (span[0].upper() + span[1:]))
    if covered:
        lo, hi = min(covered), max(covered)
        gaps = [i for i in range(lo, hi + 1) if i not in covered]
        for start, end in _runs(gaps):
            span = _span(_from_index(start), _from_index(end))
            findings.append({"kind": "gap", "text": _("The notice shows no figures for %s. If there was no overpayment in those months, that may be right.") % span})
            questions.append(_("The notice shows nothing for %s. Was I paid the right amount in those months?") % span)

    complete = bool(rows) and all(r["difference"] is not None for r in rows)
    totals = None
    if complete:
        paid, due = round(sum(r["paid"] for r in rows), 2), round(sum(r["due"] for r in rows), 2)
        totals = {"paid": paid, "due": due, "overpaid": round(paid - due, 2)}
        if totals["overpaid"] <= 0:
            findings.append({"kind": "none", "text": _("On these figures you were not paid more than was due in total, so they do not show an overpayment.")})
            questions.append(_("On the figures in the notice, I was not paid more than was due. How was an overpayment found?"))

    stated, compare = letter["stated"], None
    if stated is not None:
        if totals is None:
            compare = {"status": "cannot_check", "text": _("The notice gives a total of %s, but not every figure needed to check it.") % money(stated)}
        elif abs(totals["overpaid"] - stated) < 0.005:
            compare = {"status": "matches", "text": _("The months add up to %s, the same as the total on the notice.") % money(stated)}
        else:
            gap = round(stated - totals["overpaid"], 2)
            compare = {"status": "differs", "text": (_("The months add up to %s, but the notice says %s. That is %s more than the months show.") if gap > 0 else
                                                    _("The months add up to %s, but the notice says %s. That is %s less than the months show.")) % (money(totals["overpaid"]), money(stated), money(abs(gap)))}
            findings.append({"kind": "total", "text": compare["text"]})
            questions.append(_("The months on the notice add up to %s, but the total is %s. What makes up the difference of %s?") % (money(totals["overpaid"]), money(stated), money(abs(gap))))

    repaid = None
    if letter["repaid"] is not None:
        repaid = {"amount": letter["repaid"], "text": _("You entered %s as already repaid or withheld. It is kept apart from the original overpayment.") % money(letter["repaid"])}
        base = totals["overpaid"] if totals else stated
        if base is not None and base > 0:
            left = round(base - letter["repaid"], 2)
            repaid["left"] = left
            repaid["text"] += (_(" The months add up to %s less %s leaves %s. Compare that with the balance on your most recent letter.") if totals else
                               _(" The notice's total of %s less %s leaves %s. Compare that with the balance on your most recent letter.")) % (money(base), money(letter["repaid"]), money(left))
            if left < 0:
                findings.append({"kind": "repaid", "text": _("What you entered as repaid or withheld is more than the overpayment.")})
                questions.append(_("I have repaid or had withheld %s, which is more than the overpayment of %s. Is a refund due?") % (money(letter["repaid"]), money(base)))
        questions.append(_("How much have you withheld or been repaid so far, and has it been taken off the balance?"))

    return {"tag": letter["tag"], "date": letter["date"].isoformat() if letter["date"] else None, "rows": rows, "complete": complete, "totals": totals,
            "stated": stated, "compare": compare, "repaid": repaid, "findings": findings, "questions": questions}


def _runs(indexes):
    runs, start, prev = [], None, None
    for i in indexes:
        if start is None:
            start = prev = i
        elif i == prev + 1:
            prev = i
        else:
            runs.append((start, prev))
            start = prev = i
    if start is not None:
        runs.append((start, prev))
    return runs


def _by_month(letter):
    out = {}
    for r in letter["rows"]:
        for i in range(_index(r["from"]), _index(r["to"]) + 1):
            out.setdefault(i, (r["paid"], r["due"]))
    return out


def _differences(first, second, a_res, b_res):
    found, questions = [], []
    a, b = _by_month(first), _by_month(second)
    for only, keep in ((_("Only the first letter includes %s."), sorted(i for i in a if i not in b)), (_("Only the second letter includes %s."), sorted(i for i in b if i not in a))):
        for start, end in _runs(keep):
            found.append(only % _span(_from_index(start), _from_index(end)))
    for pos, says, asks in ((0, _("For %s, the first letter says %s was paid each month and the second says %s."), _("For %s, one letter says %s was paid each month and another says %s. Which is right?")),
                            (1, _("For %s, the first letter says %s should have been paid each month and the second says %s."),
                             _("For %s, one letter says %s should have been paid each month and another says %s. Which is right?"))):
        diff = sorted(i for i in a if i in b and a[i][pos] is not None and b[i][pos] is not None and abs(a[i][pos] - b[i][pos]) >= 0.005)
        groups = []
        for i in diff:
            pair = (a[i][pos], b[i][pos])
            if groups and groups[-1][1] == i - 1 and groups[-1][2] == pair:
                groups[-1][1] = i
            else:
                groups.append([i, i, pair])
        for start, end, (x, y) in groups:
            span = _span(_from_index(start), _from_index(end))
            found.append(says % (span, money(x), money(y)))
            questions.append(asks % (span, money(x), money(y)))
    if a_res["stated"] is not None and b_res["stated"] is not None and abs(a_res["stated"] - b_res["stated"]) >= 0.005:
        found.append(_("The first letter states a total of %s and the second %s.") % (money(a_res["stated"]), money(b_res["stated"])))
        questions.append(_("One letter says the overpayment is %s and another says %s. Which is right, and why did it change?") % (money(a_res["stated"]), money(b_res["stated"])))
    if a_res["totals"] and b_res["totals"] and abs(a_res["totals"]["overpaid"] - b_res["totals"]["overpaid"]) >= 0.005:
        found.append(_("The months on the first letter add up to %s and on the second to %s.") % (money(a_res["totals"]["overpaid"]), money(b_res["totals"]["overpaid"])))
    if not found:
        found.append(_("The figures you entered from the two letters are the same."))
    return {"found": found, "questions": questions}


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    letters = clean(raw, today)
    table = _rows("amount", today, rules_dir)
    results = [_check(l) for l in letters]
    first = results[0]
    if first["compare"] and first["compare"]["status"] == "matches" and not any(f["kind"] != "gap" for f in first["findings"]):
        headline = _("The months add up to the total on your notice")
    elif first["compare"] and first["compare"]["status"] == "differs":
        headline = _("The months do not add up to the total on your notice")
    elif not first["complete"]:
        headline = _("Some figures are missing, so the total cannot be checked")
    elif first["findings"]:
        headline = _("Some figures need asking about")
    else:
        headline = _("Here is how the months add up")
    questions = [_("Please send me a month-by-month explanation of the overpayment: what you paid me each month, what you should have paid, and why a different amount was due.")]
    for r in results:
        for q in r["questions"]:
            if q not in questions:
                questions.append(q)
    compared = _differences(letters[0], letters[1], results[0], results[1]) if len(letters) == 2 else None
    if compared:
        questions += [q for q in compared["questions"] if q not in questions]
    return {
        "headline": headline, "letters": results, "compared": compared, "questions": questions,
        "rules": {k: {"plain": table[k]["plain"], "source": table[k]["source"]} for k in ("notice_contents", "chart", "explanation", "audit")},
        "rules_as_of": _asof(rules_dir),
        "disclaimer": _note(_("This is arithmetic on the figures you entered. It was made by an independent tool, not by the Social Security Administration, and it is not legal advice.")),
    }


def example(rules_dir=None, today=None):
    """Social Security's own worked example, as figures the form can be filled with."""
    row = _rows("amount", today or dt.date.today(), rules_dir)["chart"]
    return {"rows": [{"from": f, "to": t, "paid": p, "due": d} for f, t, p, d in row["example"]], "stated_total": row["example_overpaid"]}
