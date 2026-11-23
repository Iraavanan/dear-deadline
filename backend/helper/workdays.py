"""Weekends and federal holidays, for deadlines that move to the next workday.

Social Security's rule: when the last day of a period falls on a Saturday,
Sunday or federal holiday, the period runs to the next full workday. This
covers the eleven federal holidays set by law, on the day they are observed.
It cannot know about one-off closures declared by executive order.
"""

import datetime as dt


def _nth(year, month, weekday, n):
    """The nth given weekday of a month (Monday is 0). n = -1 means the last one."""
    if n > 0:
        first = dt.date(year, month, 1)
        return first + dt.timedelta(days=(weekday - first.weekday()) % 7 + 7 * (n - 1))
    last = (dt.date(year + (month == 12), month % 12 + 1, 1)) - dt.timedelta(days=1)
    return last - dt.timedelta(days=(last.weekday() - weekday) % 7)


def _observed(day):
    if day.weekday() == 5:
        return day - dt.timedelta(days=1)       # Saturday holiday: federal offices close on Friday
    if day.weekday() == 6:
        return day + dt.timedelta(days=1)       # Sunday holiday: closed on Monday
    return day


def federal_holidays(year):
    """Name by date, for the days federal offices are closed in a year (including New Year's Day observed on December 31)."""
    days = {
        dt.date(year, 1, 1): "New Year's Day", _nth(year, 1, 0, 3): "Martin Luther King Jr. Day", _nth(year, 2, 0, 3): "Washington's Birthday",
        _nth(year, 5, 0, -1): "Memorial Day", dt.date(year, 6, 19): "Juneteenth", dt.date(year, 7, 4): "Independence Day",
        _nth(year, 9, 0, 1): "Labor Day", _nth(year, 10, 0, 2): "Columbus Day", dt.date(year, 11, 11): "Veterans Day",
        _nth(year, 11, 3, 4): "Thanksgiving Day", dt.date(year, 12, 25): "Christmas Day", dt.date(year + 1, 1, 1): "New Year's Day",
    }
    return {_observed(d): name for d, name in days.items() if _observed(d).year == year}


def why_closed(day):
    """None on a workday; otherwise 'a Saturday', 'a Sunday' or the holiday's name."""
    if day.weekday() >= 5:
        return "a Saturday" if day.weekday() == 5 else "a Sunday"
    name = federal_holidays(day.year).get(day)
    return "a federal holiday (%s)" % name if name else None


def roll_forward(day):
    """The same day if it is a workday, otherwise the next workday. Returns (date, reason the first date did not count or None)."""
    reason, moved = why_closed(day), day
    while why_closed(moved):
        moved += dt.timedelta(days=1)
    return moved, reason
