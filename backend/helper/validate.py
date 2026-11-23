"""Checks what the person entered before anything is calculated."""

import datetime as dt
import re

BENEFIT_TYPES = ("retirement", "disability", "survivor", "ssi", "unknown")
ANSWERS = ("yes", "no", "unknown")

QUESTIONS = (
    {
        "id": "amount_wrong",
        "text": "Do you think the amount is wrong, or that you were not overpaid at all?",
    },
    {
        "id": "not_at_fault",
        "text": "Do you believe the overpayment was not your fault?",
        "hint": "For example, you reported a change on time, or you could not have known the payment was wrong.",
    },
    {
        "id": "reported_change",
        "text": "Did you tell Social Security about the change that led to this?",
        "hint": "For example a new job, a change in pay, or a change in who lives with you.",
    },
    {
        "id": "cannot_afford",
        "text": "Would paying this back leave you unable to cover basics like food, housing or medicine?",
    },
    {
        "id": "unfair_other",
        "text": "Is there another reason paying it back would be unfair?",
        "hint": "For example, you made a big decision or gave something up because you relied on the payments.",
    },
    {
        "id": "rate_too_high",
        "text": "Is the amount being taken each month more than you can manage?",
    },
)
QUESTION_IDS = tuple(q["id"] for q in QUESTIONS)

STATEMENT_IDS = ("what_happened", "why_wrong", "hardship")
MAX_STATEMENT_CHARS = 2000


class InputError(Exception):
    """The input cannot be used. `problems` maps field name to a plain message."""

    def __init__(self, problems):
        super().__init__("; ".join("%s: %s" % kv for kv in sorted(problems.items())))
        self.problems = problems


def _parse_date(value):
    """Accept a date object or exactly YYYY-MM-DD. Anything else is an error."""
    if isinstance(value, dt.date):
        return value
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value.strip()):
        raise ValueError("not a YYYY-MM-DD date")
    return dt.date.fromisoformat(value.strip())


def as_mapping(raw, field, message):
    """Missing input becomes an empty mapping; any other non-mapping is refused."""
    if raw is None or raw == "" or raw == []:
        return {}
    if not isinstance(raw, dict):
        raise InputError({field: message})
    return raw


def clean_facts(raw, today):
    """Return validated notice facts. Only the notice date is required."""
    raw = as_mapping(raw, "notice_date", "Enter the date printed on the notice.")
    problems = {}
    facts = {}

    try:
        facts["notice_date"] = _parse_date(raw.get("notice_date"))
        if facts["notice_date"] > today:
            problems["notice_date"] = "The notice date is in the future. Check the date printed on the notice."
        elif facts["notice_date"].year < 2000:
            problems["notice_date"] = "The notice date looks too old. Check the year."
    except (TypeError, ValueError):
        problems["notice_date"] = "Enter the date printed on the notice."

    amount = raw.get("overpaid_amount")
    if isinstance(amount, (list, dict, bool)):
        problems["overpaid_amount"] = "Enter the amount as a number, like 4200."
        facts["overpaid_amount"] = None
    elif amount in (None, ""):
        facts["overpaid_amount"] = None
    else:
        try:
            facts["overpaid_amount"] = round(float(str(amount).replace(",", "").replace("$", "")), 2)
            if facts["overpaid_amount"] <= 0:
                problems["overpaid_amount"] = "The amount must be more than zero."
        except (TypeError, ValueError):
            problems["overpaid_amount"] = "Enter the amount as a number, like 4200."

    benefit = raw.get("benefit_type") or "unknown"
    if not isinstance(benefit, str) or benefit not in BENEFIT_TYPES:
        problems["benefit_type"] = "Choose one of the listed benefit types."
    facts["benefit_type"] = benefit

    facts["arrived_date"] = arrival(raw.get("arrived_date"), facts.get("notice_date"), today, problems)

    for field in ("period", "reason", "stated_withholding"):
        value = raw.get(field)
        facts[field] = str(value).strip()[:300] if value not in (None, "") else None

    if problems:
        raise InputError(problems)
    return facts


def clean_answers(raw):
    """Return every question id mapped to yes / no / unknown. Missing means unknown."""
    raw = as_mapping(raw, "answers", "The answers could not be read. Answer the questions again.")
    problems = {}
    answers = {}
    for qid in QUESTION_IDS:
        value = raw.get(qid, "unknown") or "unknown"
        if not isinstance(value, str) or value not in ANSWERS:
            problems[qid] = "Answer yes, no, or I don't know."
        answers[qid] = value
    if problems:
        raise InputError(problems)
    return answers


def clean_statements(raw):
    """The person's own words, used only inside the kit draft. Never interpreted."""
    raw = as_mapping(raw, "statements", "Your own words could not be read. Type them again.")
    out = {}
    for sid in STATEMENT_IDS:
        value = raw.get(sid)
        out[sid] = str(value).strip()[:MAX_STATEMENT_CHARS] if value else ""
    return out


def arrival(raw_value, notice_date, today, problems, key="arrived_date"):
    """The day the letter actually arrived, when the person gives one. Optional."""
    if raw_value in (None, ""):
        return None
    try:
        day = _parse_date(raw_value)
    except (TypeError, ValueError):
        problems[key] = "Enter the day it arrived as month, day and year, or leave it empty."
        return None
    if isinstance(notice_date, dt.date) and day < notice_date:
        problems[key] = "It cannot have arrived before the date printed on it. Check both dates."
    elif day > today:
        problems[key] = "That day is in the future. Enter the day the letter arrived."
    return day
