"""Builds the take-away kit from confirmed facts, answers and rule tables.

The kit is assembled from templates. The person's own words are placed in the
draft unchanged; nothing here rewrites or interprets them.
"""

from . import rules, routing

ANSWER_WORDS = {"yes": "Yes", "no": "No", "unknown": "I don't know"}

RECORD_SCRIPT = (
    "I received an overpayment notice dated {notice_date}. Please send me the month-by-month record "
    "of what I was paid and what you say I should have been paid, and explain how the overpayment "
    "amount was calculated."
)


MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September",
          "October", "November", "December")


def _long_date(date):
    return "%s %d, %d" % (MONTHS[date.month - 1], date.day, date.year)


def _money(value):
    return "${:,.2f}".format(value) if value is not None else "not entered"


def _facts_section(facts, answers, questions):
    lines = [
        {"label": "Notice date", "value": _long_date(facts["notice_date"]), "from": "notice"},
        {"label": "Amount Social Security says was overpaid", "value": _money(facts["overpaid_amount"]), "from": "notice"},
        {"label": "Months covered", "value": facts["period"] or "not entered", "from": "notice"},
        {"label": "Reason given", "value": facts["reason"] or "not entered", "from": "notice"},
        {"label": "Benefit type", "value": facts["benefit_type"], "from": "notice"},
        {"label": "Repayment or withholding stated", "value": facts["stated_withholding"] or "not entered", "from": "notice"},
    ]
    for q in questions:
        lines.append({"label": q["text"], "value": ANSWER_WORDS[answers[q["id"]]], "from": "your answer"})
    return lines


def _draft(rid, facts, answers, statements, budget=None):
    """Draft wording in the order the official form asks. Blank lines mark what to fill in."""
    date = _long_date(facts["notice_date"])
    amount = _money(facts["overpaid_amount"])
    blank = "[Write this in your own words]"
    if rid == "appeal":
        return [
            "I am asking for reconsideration of the overpayment notice dated %s (amount stated: %s)." % (date, amount),
            "I disagree because: %s" % (statements["why_wrong"] or blank),
            "What happened: %s" % (statements["what_happened"] or blank),
        ]
    if rid == "waiver":
        reported = {
            "yes": "I told Social Security about the change.",
            "no": "I did not report the change because: " + blank,
            "unknown": "Whether and when I reported the change: " + blank,
        }[answers["reported_change"]]
        return [
            "I am asking Social Security to waive recovery of the overpayment in the notice dated %s (amount stated: %s)." % (date, amount),
            "The overpayment was not my fault. What happened: %s" % (statements["what_happened"] or blank),
            reported,
            "Why paying it back would cause hardship or be unfair: %s" % (statements["hardship"] or blank),
        ] + ([budget["sentence"]] if budget else [])
    return [
        "I am asking to repay the overpayment in the notice dated %s at a lower monthly amount." % date,
        "Amount currently being taken or requested: %s" % (facts["stated_withholding"] or blank),
        "Why I cannot afford that amount: %s" % (statements["hardship"] or blank),
    ] + ([budget["sentence"]] if budget else []) + [
        "Amount I can pay each month: [You choose this figure%s]"
        % (" with your income and bills in mind" if budget else " after listing your income and bills"),
    ]


def build(facts, answers, statements, deadlines, evaluation, questions, rules_dir=None, budget=None):
    table = rules.rows_as_of("kit", facts["notice_date"], rules_dir)
    contact, documents, help_row = table["contact"], table["documents"], table["help"]

    # Requests that may fit get a draft. If none does, every request is listed
    # without a draft, so the person still leaves with the forms and the dates.
    chosen = evaluation["fits"] or list(routing.ORDER)
    with_drafts = bool(evaluation["fits"])

    requests = []
    for option in evaluation["options"]:
        if option["id"] not in chosen:
            continue
        requests.append(
            {
                "id": option["id"],
                "name": option["name"],
                "form": option["form"],
                "official_name": option["official_name"],
                "form_url": option["form_url"],
                "online_url": option["online_url"],
                "time_limit": option["time_limit"],
                "phone_note": option["phone_note"],
                "why": option["reason"],
                "draft": _draft(option["id"], facts, answers, statements, budget) if with_drafts else [],
                "documents": documents[option["id"]],
            }
        )

    need_record = answers["amount_wrong"] == "unknown" or facts["overpaid_amount"] is None or not facts["period"]

    return {
        "title": "Your overpayment notice kit",
        "act_today": {
            "summary": evaluation["summary"],
            "dates": [
                {"label": i["label"], "date": i["date"], "days_left": i["days_left"], "status": i["status"]}
                for i in deadlines["items"]
            ],
            "advice": deadlines["advice"],
        },
        "requests": requests,
        "facts_to_review": _facts_section(facts, answers, questions),
        "budget": budget,
        "ask_for_record": {
            "show": need_record,
            "why": "The notice details are incomplete or you are not sure the amount is right.",
            "script": RECORD_SCRIPT.format(notice_date=_long_date(facts["notice_date"])),
            "steps": [
                "Call %s (TTY %s) or visit a local office." % (contact["phone"], contact["tty"]),
                "Read or hand over the request below, and ask for it in writing.",
                "Write down the date, the name of the person you spoke to, and what they said.",
                "Do not wait for the record if a deadline is close. You can file first and add details later.",
            ],
        },
        "how_to_file": [
            "Fill in the official form. This kit is a draft to copy from, not the form itself.",
            "Send or bring it to a local Social Security office: %s" % contact["office_locator"],
            "Keep a copy of everything you send, with the date you sent it.",
            "If you mail it, use a method that gives proof of mailing.",
        ],
        "get_help": {
            "text": help_row["plain"],
            "legal_aid_finder": help_row["legal_aid_finder"],
            "phone": contact["phone"],
            "tty": contact["tty"],
            "office_locator": contact["office_locator"],
        },
        "disclaimer": (
            "This kit was made by an independent tool. It is not from the Social Security Administration, "
            "it is not legal advice, and nothing in it has been sent to Social Security."
        ),
    }
