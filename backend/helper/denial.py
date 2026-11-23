"""Module 4: a letter with a decision the person disagrees with, such as a denied claim.

It answers two questions: by when must I appeal, and what is the next step?
Appeals go in a fixed order, so the next step depends only on which decision
the letter is. The module never says whether an appeal is worth making and
never estimates anyone's chances.
"""

import datetime as dt

from . import rules
from .deadlines import _moved, late_arrival
from .cessation import _item, _long            # same date item shape and date wording as module 2
from .validate import InputError, _parse_date, as_mapping, arrival

STAGES = (
    ("initial", "The first decision on my application or my benefits"),
    ("reconsideration", "A decision on a reconsideration I asked for"),
    ("hearing", "A decision from a judge after a hearing"),
    ("appeals_council", "A decision, or a denial of review, from the Appeals Council"),
    ("unknown", "I'm not sure"),
)
ABOUT = (
    ("medical", "Whether I am disabled"),
    ("nonmedical", "Something else, such as the amount, my income, or whether I qualify"),
    ("overpayment", "That I was paid too much"),
    ("cessation", "That my disability has ended after a review"),
    ("unknown", "I'm not sure"),
)
NEXT = {"initial": "level_reconsideration", "reconsideration": "level_hearing", "hearing": "level_appeals_council", "appeals_council": "level_federal_court"}
ANSWERS = ("yes", "no", "unknown")
QUESTIONS = (
    {"id": "disagree", "text": "Do you disagree with the decision?"},
    {"id": "new_evidence", "text": "Do you have records or other evidence Social Security has not seen?"},
    {"id": "has_help", "text": "Is someone helping you with this, such as a lawyer or advocate?"},
)
QUESTION_IDS = tuple(q["id"] for q in QUESTIONS)
STATEMENT_IDS = ("why_disagree", "evidence", "late_reason")
MAX_STATEMENT_CHARS = 2000
REDIRECT = {"overpayment": ("overpayment", "An overpayment notice has its own helper, with an extra 30-day date."),
            "cessation": ("disability-ended", "A letter saying your disability has ended has its own helper, with a 15-day window.")}


def _keys(pairs):
    return tuple(k for k, _ in pairs)


def clean(raw_facts, raw_answers, raw_statements, today):
    facts_in = as_mapping(raw_facts, "notice_date", "Enter the date printed on the letter.")
    problems, facts = {}, {}
    try:
        facts["notice_date"] = _parse_date(facts_in.get("notice_date"))
        if facts["notice_date"] > today:
            problems["notice_date"] = "The letter's date is in the future. Check the date printed on it."
        elif facts["notice_date"].year < 2000:
            problems["notice_date"] = "The letter's date looks too old. Check the year."
    except (TypeError, ValueError):
        problems["notice_date"] = "Enter the date printed on the letter."
    facts["arrived_date"] = arrival(facts_in.get("arrived_date"), facts.get("notice_date"), today, problems)
    for field, allowed in (("stage", _keys(STAGES)), ("about", _keys(ABOUT))):
        value = facts_in.get(field) or "unknown"
        if not isinstance(value, str) or value not in allowed:
            problems[field] = "Choose one of the listed options."
        facts[field] = value
    answers_in = as_mapping(raw_answers, "answers", "The answers could not be read. Answer the questions again.")
    answers = {}
    for qid in QUESTION_IDS:
        value = answers_in.get(qid, "unknown") or "unknown"
        if not isinstance(value, str) or value not in ANSWERS:
            problems[qid] = "Answer yes, no, or I don't know."
        answers[qid] = value
    statements_in = as_mapping(raw_statements, "statements", "Your own words could not be read. Type them again.")
    statements = {sid: (str(statements_in.get(sid)).strip()[:MAX_STATEMENT_CHARS] if statements_in.get(sid) else "") for sid in STATEMENT_IDS}
    if problems:
        raise InputError(problems)
    return facts, answers, statements


def _dates(notice_date, today, table, arrived=None):
    appeal_by = notice_date + dt.timedelta(days=table["appeal"]["days"])
    latest, moved_note = _moved(appeal_by + dt.timedelta(days=table["mail_presumption"]["days"]), today)
    items = [
        _item("appeal", "Appeal by this date", appeal_by, today, table["appeal"], "Counted from the date printed on the letter, which is the cautious reading."),
        _item("appeal_latest", "Latest appeal date if the letter took 5 days to arrive", latest,
              today, table["mail_presumption"], "Do not aim for this date. Use it only if the earlier date has passed." + moved_note),
    ]
    extra, extra_advice = late_arrival(notice_date, arrived, today, table["mail_presumption"], table["appeal"]["days"])
    if extra:
        items.append(extra)
    status = {i["id"]: i["status"] for i in items}
    if status["appeal_latest"] == "passed":
        advice = ["The appeal dates have passed. " + table["late"]["plain"]]
    elif status["appeal"] == "passed":
        advice = ["The cautious appeal date has passed, but the later date may still apply. Ask for the appeal as soon as you can."]
    else:
        advice = ["You are inside the time limit. " + table["weekend"]["plain"]]
    if extra_advice:
        if extra and status["appeal_latest"] == "passed":
            advice = []
        advice.append(extra_advice)
    return {"notice_date": notice_date.isoformat(), "today": today.isoformat(), "items": items, "advice": advice}


def _level(row):
    return {"id": row["id"].replace("level_", ""), "order": row["order"], "name": row["name"], "form": row["form"], "online": row["online"],
            "about": row["plain"], "source": row["source"]}


def run(raw_facts, raw_answers=None, raw_statements=None, today=None, rules_dir=None):
    today = today or dt.date.today()
    facts, answers, statements = clean(raw_facts, raw_answers, raw_statements, today)
    table = rules.rows_as_of("denial", facts["notice_date"], rules_dir)
    kit_rows = rules.rows_as_of("kit", facts["notice_date"], rules_dir)
    contact, help_row = kit_rows["contact"], kit_rows["help"]
    dates = _dates(facts["notice_date"], today, table, arrived=facts["arrived_date"])
    levels = sorted((_level(r) for k, r in table.items() if k.startswith("level_")), key=lambda x: x["order"])
    get_help = {"text": "Legal aid offices help with Social Security appeals, usually at no cost if your income is low. This tool gives information, not legal advice.", "legal_aid_finder": help_row["legal_aid_finder"], "phone": contact["phone"], "tty": contact["tty"],
                "office_locator": contact["office_locator"]}
    out = {"deadlines": dates, "levels": levels, "get_help": get_help, "rules_as_of": rules.rules_checked_as_of(rules_dir)}

    if facts["about"] in REDIRECT:
        target, why = REDIRECT[facts["about"]]
        out.update(redirect=target, message=why)
        return out

    next_id = NEXT.get(facts["stage"])
    nxt = _level(table[next_id]) if next_id else None
    notes = []
    if nxt is None:
        notes.append("You were not sure which decision this is. The four steps are listed in order; your letter says which one applies to you. The time limit is the same for each.")
    if answers["disagree"] != "yes":
        notes.append("You can ask for an appeal before the date even if you are unsure today.")
    if answers["new_evidence"] == "yes":
        notes.append("You have evidence Social Security has not seen. Send it with your request or as soon after as you can.")
    if facts["about"] == "medical" and facts["stage"] in ("initial", "unknown"):
        notes.append(table["medical_extra"]["plain"])
    if answers["has_help"] != "yes":
        notes.append(table["representative"]["plain"] + " Some lawyers who handle these appeals charge only if you win.")

    court = nxt is not None and nxt["id"] == "federal_court"
    blank = "[Write this in your own words]"
    late = dates["items"][1]["status"] == "passed"
    draft = None
    if nxt and not court:
        ask = {"reconsideration": "reconsideration", "hearing": "a hearing before an administrative law judge", "appeals_council": "review by the Appeals Council"}[nxt["id"]]
        draft = ["I disagree with the decision in the letter dated %s, and I request %s." % (_long(facts["notice_date"]), ask),
                 "My reasons: %s" % (statements["why_disagree"] or blank),
                 "Evidence I am sending or will send: %s" % (statements["evidence"] or blank)]
        if late:
            draft.append("Why this request is late: %s" % (statements["late_reason"] or blank))

    documents = ["The letter (every page)", "Any earlier decision letters on the same matter"]
    if facts["about"] in ("medical", "unknown"):
        documents += ["Names, addresses and phone numbers of the doctors, clinics and hospitals that treat you", "Medical records, test results and a list of your medicines"]
    if facts["about"] in ("nonmedical", "unknown"):
        documents.append("Papers that show the fact in dispute, such as pay stubs, bank statements, a lease, or proof of age or marriage")

    out.update(
        next=nxt,
        court=court,
        notes=notes,
        kit={
            "title": "Your appeal kit",
            "summary": None,
            "dates": [{"label": i["label"], "date": i["date"], "days_left": i["days_left"], "status": i["status"]} for i in dates["items"]],
            "advice": dates["advice"],
            "next": nxt,
            "levels": levels if nxt is None else [],
            "court_note": "This step is a court case, not a Social Security form. This helper does not cover it. Talk to a lawyer before the date." if court else None,
            "draft": draft,
            "late": table["late"]["plain"] if late else None,
            "how": [] if court else [
                "Ask online if you can: the link for your step is in this kit. " + table["paper"]["plain"],
                "Say plainly that you disagree and are asking for the next step, and give your reasons.",
                "Keep a copy of what you send and the date you sent it. If you file online, keep the confirmation.",
            ],
            "documents": documents,
            "representative": table["representative"]["plain"],
            "get_help": get_help,
            "disclaimer": "This kit was made by an independent tool. It is not from the Social Security Administration, it is not legal advice, "
                          "it says nothing about how an appeal will turn out, and nothing in it has been sent to Social Security.",
        })
    out["kit"]["summary"] = ("Your next step: %s." % nxt["name"]) if nxt else "The four steps of appeal are listed in order. Your letter says which is yours."
    return out
