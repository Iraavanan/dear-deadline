"""Deadline calculator.

Dates are counted from the date printed on the notice. That is the cautious
reading: it never gives a person more time than Social Security would. The
later date that allows for the 5-day mail presumption is shown as well, and
labelled as the latest date rather than the date to aim for.
"""

import datetime as dt

from . import rules
from .workdays import roll_forward


def _status(deadline, today):
    days_left = (deadline - today).days
    if days_left < 0:
        return days_left, "passed"
    if days_left == 0:
        return days_left, "today"
    return days_left, "upcoming"


def _entry(key, label, deadline, today, row, note):
    days_left, status = _status(deadline, today)
    return {
        "id": key,
        "label": label,
        "date": deadline.isoformat(),
        "days_left": days_left,
        "status": status,
        "rule": row["plain"],
        "source": row["source"],
        "note": note,
    }



def _moved(raw, today):
    """The latest date, moved to the next workday when it falls on a weekend or federal holiday, and the sentence that says so."""
    day, reason = roll_forward(raw)
    said = "" if not reason else " Day 65 is %s %d, %s, so the period runs to the next workday." % (raw.strftime("%B"), raw.day, reason)
    return day, said


MONTHS_LONG = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")


def _say(day):
    return "%s %d, %d" % (MONTHS_LONG[day.month - 1], day.day, day.year)


def late_arrival(notice_date, arrived, today, mail_row, appeal_days):
    """An extra date when the person says the letter came later than the 5 days Social Security assumes.

    Returns (item or None, sentence for the advice or None)."""
    if not arrived:
        return None, None
    if arrived <= notice_date + dt.timedelta(days=mail_row["days"]):
        return None, "The day it arrived (%s) is within the 5 days Social Security already assumes, so the dates above stand." % _say(arrived)
    raw = arrived + dt.timedelta(days=appeal_days)
    due, reason = roll_forward(raw)
    note = ("Counted from the day you say the letter arrived, %s. Social Security assumes 5 days unless you show otherwise, "
            "so keep the envelope and anything else that shows when it came." % _say(arrived))
    if reason:
        note += " Day %d after it arrived is %s %d, %s, so the period runs to the next workday." % (appeal_days, raw.strftime("%B"), raw.day, reason)
    left, status = _status(due, today)
    item = {"id": "appeal_if_arrived", "label": "Appeal by this date if you can show when it arrived", "date": due.isoformat(), "days_left": left,
            "status": status, "rule": mail_row["plain"], "source": mail_row["source"], "note": note}
    if status == "passed":
        return item, None
    return item, ("The dates counted from the printed date may have passed, but if you can show the letter arrived on %s, you have until %s. "
                  "Appeal now and say when it arrived." % (_say(arrived), _say(due)))


def compute(notice_date, today, rules_dir=None, arrived=None):
    """Return the dates a person needs, earliest first."""
    table = rules.rows_as_of("deadlines", notice_date, rules_dir)
    protect, appeal, mail = table["collection_protection"], table["appeal"], table["mail_presumption"]

    protect_by = notice_date + dt.timedelta(days=protect["days"])
    appeal_by = notice_date + dt.timedelta(days=appeal["days"])
    appeal_latest, moved_note = _moved(appeal_by + dt.timedelta(days=mail["days"]), today)

    items = [
        _entry(
            "collection_protection",
            "Ask by this date to hold off collection",
            protect_by,
            today,
            protect,
            "Counted from the date printed on the notice.",
        ),
        _entry(
            "appeal",
            "Appeal by this date",
            appeal_by,
            today,
            appeal,
            "Counted from the date printed on the notice, which is the cautious reading.",
        ),
        _entry(
            "appeal_latest",
            "Latest appeal date if the notice took 5 days to arrive",
            appeal_latest,
            today,
            mail,
            "Do not aim for this date. Use it only if the earlier date has passed." + moved_note,
        ),
    ]

    extra, extra_advice = late_arrival(notice_date, arrived, today, mail, appeal["days"])
    if extra:
        items.append(extra)
    passed = [i["id"] for i in items if i["status"] == "passed" and i["id"] != "appeal_if_arrived"]
    advice = []
    if "collection_protection" in passed:
        advice.append(
            "The 30-day date has passed, so collection may already have started. "
            "You can still ask for an appeal, a waiver or a lower rate."
        )
    if "appeal_latest" in passed:
        advice.append(
            "The appeal dates have passed. Social Security can accept a late appeal if you had a good "
            "reason for the delay, so explain the reason when you file. A waiver has no time limit."
        )
    elif "appeal" in passed:
        advice.append(
            "The cautious appeal date has passed, but the later date may still apply. File as soon as you can."
        )
    if not passed:
        advice.append("You are inside every deadline. Acting before the first date also holds off collection.")
    if extra_advice:
        if extra and "appeal_latest" in passed:
            advice = [x for x in advice if not x.startswith("The appeal dates have passed")]
        advice.append(extra_advice)

    return {
        "notice_date": notice_date.isoformat(),
        "today": today.isoformat(),
        "items": items,
        "advice": advice,
    }
