"""Module 3: "Will my job cause an overpayment?"

A check a person can run before a letter arrives. It compares what they
expect to earn with the published limits for the year and shows what Social
Security would do, then gives them the words for reporting the change.

Two tracks:
  * retirement, spouse or survivor benefits before full retirement age
    (the retirement earnings test), and
  * Social Security disability benefits (trial work months, then the
    substantial-work level).

It is arithmetic on published figures, not a decision. It never says a
person is safe or need not report: Social Security decides what counts, and
the kit always tells the person to report the change.
"""

import datetime as dt
import math
import re

from . import rules
from .validate import InputError, as_mapping

TRACKS = ("retirement", "disability", "ssi")
YEARS = (2025, 2026)
FRA = ("after", "this_year", "already", "unknown")
YES_NO = ("yes", "no", "unknown")
MAX_MONTHS = 24
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September",
          "October", "November", "December")


def _money(v):
    return "${:,.0f}".format(v) if float(v).is_integer() else "${:,.2f}".format(v)


def _amount(value, field, problems, required=True, top=10000000):
    if isinstance(value, (list, dict, bool)) or value in (None, ""):
        if required or isinstance(value, (list, dict, bool)):
            problems[field] = "Enter an amount, like 2400."
        return None
    try:
        number = round(float(str(value).replace(",", "").replace("$", "")), 2)
    except ValueError:
        problems[field] = "Enter an amount, like 2400."
        return None
    if number < 0 or number > top:
        problems[field] = "Enter an amount between 0 and %s." % "{:,}".format(top)
        return None
    return number


def _pick(raw, field, allowed, default, problems):
    value = raw.get(field) or default
    if not isinstance(value, str) or value not in allowed:
        problems[field] = "Choose one of the listed options."
        return default
    return value


def _contact(rules_dir, on):
    kit = rules.rows_as_of("kit", on, rules_dir)
    return kit["contact"], kit["help"]


# ---------- retirement, spouse or survivor benefits ----------

def _retirement(raw, rules_dir):
    problems = {}
    try:
        year = int(raw.get("year") or YEARS[-1])
    except (TypeError, ValueError):
        year = None
    if year not in YEARS:
        problems["year"] = "This check covers %s." % " and ".join(str(y) for y in YEARS)
        year = YEARS[-1]
    fra = _pick(raw, "fra", FRA, "unknown", problems)
    first_year = _pick(raw, "first_year", YES_NO, "unknown", problems)
    earnings = _amount(raw.get("earnings"), "earnings", problems, required=(fra != "already"))
    benefit = _amount(raw.get("monthly_benefit"), "monthly_benefit", problems, required=False, top=100000)
    if problems:
        raise InputError(problems)

    on = dt.date(year, 12, 31)
    table = rules.rows_as_of("work", on, rules_dir)
    test = table["retirement_test"]
    contact, _ = _contact(rules_dir, on)
    notes, cautions = [], []
    result = {"track": "retirement", "year": year, "earnings": earnings, "rule": test["plain"], "source": test["source"]}

    if fra == "already":
        result.update(status="no_limit", headline="No earnings limit applies once you have reached full retirement age",
                      detail=table["retirement_no_limit"]["plain"])
    else:
        higher = fra == "this_year"
        limit, ratio = (test["higher_annual"], 3) if higher else (test["lower_annual"], 2)
        over = max(0.0, earnings - limit)
        withhold = math.floor(over / ratio)
        result.update(limit=limit, ratio=ratio, over_by=over, would_withhold=withhold,
                      counts="earnings before the month you reach full retirement age" if higher else "earnings for the whole year")
        if over > 0:
            result.update(status="over", headline="Your earnings are over the %d limit by %s" % (year, _money(over)),
                          detail="At $1 for every $%d over the limit, Social Security would withhold about %s of benefits for %d." % (ratio, _money(withhold), year))
            if benefit:
                held = math.ceil(withhold / benefit)
                result.update(monthly_benefit=benefit, months_held=held, paid_back_next_year=round(held * benefit - withhold, 2))
                notes.append("With a monthly benefit of %s, that is %d whole monthly payment%s held, starting in January. Holding whole payments takes %s more than the amount due, which is paid back the next year."
                             % (_money(benefit), held, "" if held == 1 else "s", _money(held * benefit - withhold)))
            notes.append(table["retirement_how_withheld"]["plain"])
            notes.append("If Social Security has been paying you in full on a lower estimate, the difference can come back as an overpayment notice. Reporting the new figure now is how to avoid that.")
        else:
            result.update(status="under", headline="On the figure you entered, your earnings are within the %d limit of %s" % (year, _money(limit)),
                          detail="The limit applies to %s. If your earnings turn out higher, tell Social Security then." % result["counts"])
        notes.append(table["retirement_not_lost"]["plain"])
        if fra == "unknown":
            cautions.append("You were not sure when you reach full retirement age, so this uses the lower limit, which is the cautious one. " + table["retirement_no_limit"]["plain"])
        if first_year != "no":
            cautions.append(table["retirement_first_year"]["plain"] + " For %d that monthly amount is %s." % (year, _money(test["higher_monthly"] if higher else test["lower_monthly"])))
    notes.append(table["retirement_what_counts"]["plain"])
    cautions.append("This is arithmetic on the published limits. Social Security decides what counts and what it withholds.")

    script = ("I receive Social Security benefits. I expect my earnings for %d to be about %s. Please update my earnings estimate and tell me how it changes my payments."
              % (year, _money(earnings) if earnings is not None else "[amount]"))
    result.update(notes=notes, cautions=cautions, kit=_kit(
        "Your earnings-estimate kit", table["retirement_report"]["plain"], script,
        ["Your pay stubs or, if self-employed, your net earnings so far this year", "Your best estimate of total earnings for the year", "Your benefit award letter, if you have it"],
        contact, extra=None))
    return result


# ---------- Social Security disability benefits ----------

def _add_months(ym, n):
    y, m = ym
    total = y * 12 + (m - 1) + n
    return total // 12, total % 12 + 1


def _label(ym):
    return "%s %d" % (MONTHS[ym[1] - 1], ym[0])


def _disability(raw, rules_dir):
    problems = {}
    blind = _pick(raw, "blind", YES_NO, "no", problems)
    self_employed = _pick(raw, "self_employed", YES_NO, "no", problems)
    prior = raw.get("prior_trial_months", "unknown")
    if prior in (None, ""):
        prior = "unknown"
    if prior != "unknown":
        try:
            prior = int(prior)
            if not 0 <= prior <= 9:
                raise ValueError
        except (TypeError, ValueError):
            problems["prior_trial_months"] = "Enter a number from 0 to 9, or leave it as not sure."
            prior = "unknown"

    months_in = raw.get("months")
    entries = {}
    if not isinstance(months_in, list) or not months_in:
        problems["months"] = "Add at least one month with what you earned or expect to earn."
    elif len(months_in) > MAX_MONTHS:
        problems["months"] = "Enter up to %d months." % MAX_MONTHS
    else:
        for i, item in enumerate(months_in):
            if not isinstance(item, dict) or not isinstance(item.get("month"), str) or not re.fullmatch(r"\d{4}-\d{2}", item["month"]):
                problems["months"] = "Each month needs a month and an amount."
                break
            y, m = int(item["month"][:4]), int(item["month"][5:])
            if y not in YEARS or not 1 <= m <= 12:
                problems["months"] = "This check covers months in %s." % " and ".join(str(x) for x in YEARS)
                break
            row_problems = {}
            amount = _amount(item.get("earnings"), "months", row_problems, top=1000000)
            if row_problems:
                problems["months"] = "Enter the earnings for %s as an amount, like 1500." % _label((y, m))
                break
            entries[(y, m)] = amount
    if problems:
        raise InputError(problems)

    on = dt.date(max(entries)[0], 12, 31)
    whole = rules.rows_as_of("work", on, rules_dir)
    contact, _ = _contact(rules_dir, on)
    twp_rule, epe_rule = whole["disability_twp"], whole["disability_epe"]
    cautions = ["This uses your gross pay. Social Security can count less than that, for example when you pay for things you need for work because of your disability, or when your employer gives you extra help. " + whole["disability_help"]["plain"],
                "This is arithmetic on the published figures. Social Security decides which months count and what it pays."]
    if self_employed == "yes":
        cautions.insert(0, "You are self-employed. Social Security uses different tests for self-employment, including hours worked (more than 80 hours in a month counts as a trial work month), so treat this month-by-month result as a rough guide only.")
    if prior == "unknown":
        cautions.insert(0, "You were not sure how many trial work months you have already used, so no payment result is given. "
                           "The two ends of the range are shown instead. Ask Social Security how many you have used.")

    def walk(used):
        """Month by month from a given number of trial work months already used."""
        twp_end, in_epe, epe_start_known, grace_start = None, used >= twp_rule["months"], False, None
        rows, not_due = [], []
        for ym in sorted(entries):
            earned = entries[ym]
            year_row = rules.rows_as_of("work", dt.date(ym[0], ym[1], 1), rules_dir)["disability_work"]
            level = year_row["sga_blind"] if blind == "yes" else year_row["sga"]
            row = {"month": "%04d-%02d" % ym, "label": _label(ym), "earnings": earned, "trial_level": year_row["twp"], "substantial_level": level}
            if not in_epe:
                if earned > year_row["twp"]:
                    used += 1
                    row.update(kind="trial", text="Trial work month %d of %d. Benefits are paid." % (used, twp_rule["months"]), payment="due")
                    if used >= twp_rule["months"]:
                        twp_end, in_epe, epe_start_known = ym, True, True
                else:
                    row.update(kind="below_trial", text="Under the trial work amount, so it does not use up a trial work month. Benefits are paid.", payment="due")
            else:
                past_36 = epe_start_known and (ym[0] * 12 + ym[1]) - (twp_end[0] * 12 + twp_end[1]) > epe_rule["months"]
                in_grace = grace_start is not None and (ym[0] * 12 + ym[1]) - (grace_start[0] * 12 + grace_start[1]) < epe_rule["grace"]
                if past_36:
                    row.update(kind="after_36", text="Past the 36-month period. " + whole["disability_after_epe"]["plain"], payment="ask")
                elif earned > level and grace_start is None:
                    grace_start = ym
                    row.update(kind="grace", text="First month over the substantial-work level. Benefits are still paid for this month and the next 2.", payment="due")
                elif in_grace:
                    row.update(kind="grace", text="Within the 3 months that are still paid after work first went over the level.", payment="due")
                elif earned > level:
                    row.update(kind="over", text="Over the substantial-work level of %s. A benefit payment is not due for this month." % _money(level), payment="not_due")
                    not_due.append(row["label"])
                else:
                    row.update(kind="under", text="Under the substantial-work level of %s. A benefit payment is due." % _money(level), payment="due")
            rows.append(row)
        return {"rows": rows, "not_due": not_due, "used": used, "twp_end": twp_end, "in_epe": in_epe}

    def outcome(w):
        if w["not_due"]:
            return "a benefit payment would not be due for %d month%s: %s." % (len(w["not_due"]), "" if len(w["not_due"]) == 1 else "s", ", ".join(w["not_due"]))
        if w["in_epe"]:
            return "your trial work period would be used up, and payments on these figures would still be due."
        return "you would have used %d of %d trial work months, and payments on these figures would be due." % (w["used"], twp_rule["months"])

    scenarios, verify = None, None
    if prior == "unknown":
        low, high = walk(0), walk(twp_rule["months"])
        over_trial = 0
        rows = []
        for r in low["rows"]:
            above_trial, above_level = r["earnings"] > r["trial_level"], r["earnings"] > r["substantial_level"]
            over_trial += above_trial
            text = ("Over the trial work amount of %s." % _money(r["trial_level"]) if above_trial else "Under the trial work amount of %s, so it does not use a trial work month." % _money(r["trial_level"]))
            text += (" Over the substantial-work level of %s." if above_level else " Under the substantial-work level of %s.") % _money(r["substantial_level"])
            if above_trial:
                text += " What this month means for your payment depends on the trial work months you used before."
            rows.append(dict(r, kind="over_trial" if above_trial else "below_trial", text=text, payment="ask"))
        not_due, used, twp_end = [], None, None
        status = "needs_info"
        headline = "This depends on how many trial work months you have already used"
        detail = ("%d of the months you entered %s over the trial work amount. Find out how many trial work months you used before these months, then check again with that number."
                  % (over_trial, "is" if over_trial == 1 else "are"))
        scenarios = [{"label": "If you had used none before these months", "text": "On these figures, " + outcome(low)},
                     {"label": "If your trial work period had already ended before these months", "text": "On these figures, " + outcome(high)
                      + " This assumes you are still within the 36-month period that follows it."}]
        verify = ["How many trial work months you have used in the last 60 months.",
                  "Whether your trial work period has ended, and in which month.",
                  "If it has ended, when your 36-month period started, so you know whether you are still inside it.",
                  "Earlier letters from Social Security may say this. If not, ask when you report your work."]
    else:
        w = walk(prior)
        rows, not_due, used, twp_end, in_epe = w["rows"], w["not_due"], w["used"], w["twp_end"], w["in_epe"]
        if not_due:
            status, headline = "not_due", "On these figures, a benefit payment would not be due for %d month%s" % (len(not_due), "" if len(not_due) == 1 else "s")
            detail = ("Months: %s. If you are paid for a month when a payment is not due, Social Security can ask for it back as an overpayment. "
                      "Reporting your work now is how to avoid that. %s" % (", ".join(not_due), whole["disability_hold"]["plain"]))
        elif in_epe:
            status, headline = "after_trial", "Your trial work period is used up, and payments on these figures are still due"
            detail = "From here, each month is compared with the substantial-work level. " + epe_rule["plain"]
        else:
            status, headline = "in_trial", "You have used %d of %d trial work months on these figures" % (used, twp_rule["months"])
            detail = twp_rule["plain"]

    script = "I receive Social Security disability benefits. I am reporting my work: [employer], started on [date], about [hours] hours a week, paid about [amount] a month. Please give me a receipt for this report."
    extra = {"title": "Months entered", "rows": [{"label": r["label"], "value": _money(r["earnings"]) + ". " + r["text"]} for r in rows]}
    return {
        "track": "disability", "status": status, "headline": headline, "detail": detail,
        "trial_months_used": used, "trial_months_total": twp_rule["months"],
        "trial_period_ended": _label(twp_end) if twp_end else None,
        "rows": rows, "not_due_months": not_due, "scenarios": scenarios, "verify": verify,
        "notes": [twp_rule["plain"], epe_rule["plain"]],
        "cautions": cautions,
        "rule": whole["disability_work"]["plain"], "source": whole["disability_work"]["source"],
        "kit": _kit("Your work-report kit", whole["disability_report"]["plain"], script,
                    ["Pay stubs for each month you worked", "The date you started, and any date your hours or pay changed", "Receipts for things you pay for in order to work because of your disability"],
                    contact, extra=extra, more=[whole["disability_hold"]["plain"], whole["disability_help"]["plain"]]),
    }


def _kit(title, why, script, documents, contact, extra, more=None):
    return {
        "title": title,
        "why": why,
        "script": script,
        "how": [
            "Call Social Security at %s (TTY %s), go to a local office (%s), or use your online Social Security account." % (contact["phone"], contact["tty"], contact["office_locator"]),
            "Read out or hand over the words below.",
            "Write down the date, the name of the person you spoke to, and what they said. Keep any receipt.",
        ],
        "documents": documents,
        "table": extra,
        "more": more or [],
        "if_letter": "If Social Security later sends a letter saying you were paid too much, this site's overpayment helper covers that letter.",
        "disclaimer": "This was made by an independent tool. It is not from the Social Security Administration, it is not legal or financial advice, "
                      "and nothing in it has been sent to Social Security.",
    }


def run(raw, rules_dir=None):
    raw = as_mapping(raw, "track", "Choose which benefit you get.")
    track = raw.get("track")
    if not isinstance(track, str) or track not in TRACKS:
        raise InputError({"track": "Choose which benefit you get."})
    as_of = rules.rules_checked_as_of(rules_dir)
    if track == "ssi":
        table = rules.rows_as_of("work", dt.date(YEARS[-1], 12, 31), rules_dir)
        contact, help_row = _contact(rules_dir, dt.date(YEARS[-1], 12, 31))
        return {"track": "ssi", "covered": False, "message": "This check does not cover SSI yet. " + table["ssi_report"]["plain"],
                "reporting_rule": table["ssi_report"]["plain"],
                "help": table["disability_help"]["plain"], "phone": contact["phone"], "tty": contact["tty"],
                "legal_aid_finder": help_row["legal_aid_finder"], "rules_as_of": as_of}
    result = _retirement(raw, rules_dir) if track == "retirement" else _disability(raw, rules_dir)
    result.update(covered=True, rules_as_of=as_of)
    return result
