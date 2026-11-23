"""Module 2: a notice saying a person's disability has ended after a medical review.

What makes this letter different from an overpayment notice:

  * Two clocks run at once. The choice to keep benefits during the appeal must
    be RECEIVED by Social Security within 15 calendar days of the notice date.
    The appeal itself has 60 days.
  * Keeping benefits is a real choice with a cost: if the appeal is lost, the
    payments received during it must be paid back unless a waiver is granted.

So this module never recommends a choice. It lays out the choices and what
each one risks, and the person decides. It also never tells anyone not to
appeal. Letters that stop benefits for other reasons follow other rules; for
those the module says so plainly and still shows the general appeal date.
"""

import datetime as dt

from . import rules
from .deadlines import _moved, late_arrival
from .validate import InputError, _parse_date, as_mapping, arrival

LETTER_KINDS = (
    ("medical", "My disability has ended after a medical review of my condition"),
    ("unknown", "It says my disability benefits will stop, but I am not sure why"),
    ("work", "My benefits are stopping because of work or earnings"),
    ("ssi_nonmedical", "My SSI is stopping or changing because of income, resources or where I live"),
    ("appeal_denied", "It is a decision on an appeal I already filed"),
)
BENEFIT_KINDS = (
    ("ssdi", "Social Security disability (SSDI)"),
    ("ssi", "SSI (Supplemental Security Income)"),
    ("both", "Both"),
    ("unknown", "I'm not sure"),
)
ANSWERS = ("yes", "no", "unknown")
QUESTIONS = (
    {"id": "still_disabled", "text": "Do you believe your condition still keeps you from working?"},
    {"id": "could_repay", "text": "If you lost the appeal, could you manage paying back the benefits you received during it?",
     "hint": "Benefits that continue during an appeal must be paid back if the appeal is not successful, unless Social Security agrees to waive them."},
    {"id": "has_medicare", "text": "Do you have Medicare through your disability benefits?"},
    {"id": "others_on_record", "text": "Does anyone else, such as a spouse or child, get benefits on your record?"},
    {"id": "new_evidence", "text": "Do you have medical records or other evidence from after your last review?"},
)
QUESTION_IDS = tuple(q["id"] for q in QUESTIONS)
CHOICES = ("continue_all", "medicare_only", "no_continuation", "undecided")
STATEMENT_IDS = ("why_disagree", "treatment", "late_reason")
MAX_STATEMENT_CHARS = 2000
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September",
          "October", "November", "December")

OUT_OF_SCOPE = {
    "work": "This helper does not cover benefits that stop because of work or earnings. Those letters follow different rules.",
    "ssi_nonmedical": "This helper does not cover SSI that stops or changes for a reason other than your medical condition. Those letters follow different rules.",
    "appeal_denied": "This helper does not yet cover the next appeal after a decision on your first appeal. The steps and forms are different.",
}


def _long(date):
    return "%s %d, %d" % (MONTHS[date.month - 1], date.day, date.year)


def _keys(pairs):
    return tuple(k for k, _ in pairs)


def clean(raw_facts, raw_answers, raw_choice, raw_statements, today):
    facts_in = as_mapping(raw_facts, "notice_date", "Enter the date printed on the notice.")
    problems, facts = {}, {}
    try:
        facts["notice_date"] = _parse_date(facts_in.get("notice_date"))
        if facts["notice_date"] > today:
            problems["notice_date"] = "The notice date is in the future. Check the date printed on the notice."
        elif facts["notice_date"].year < 2000:
            problems["notice_date"] = "The notice date looks too old. Check the year."
    except (TypeError, ValueError):
        problems["notice_date"] = "Enter the date printed on the notice."

    facts["arrived_date"] = arrival(facts_in.get("arrived_date"), facts.get("notice_date"), today, problems)
    for field, allowed, default in (("letter_kind", _keys(LETTER_KINDS), "unknown"), ("benefit_kind", _keys(BENEFIT_KINDS), "unknown")):
        value = facts_in.get(field) or default
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

    choice = raw_choice or "undecided"
    if not isinstance(choice, str) or choice not in CHOICES:
        problems["choice"] = "Choose one of the listed options."
        choice = "undecided"

    statements_in = as_mapping(raw_statements, "statements", "Your own words could not be read. Type them again.")
    statements = {}
    for sid in STATEMENT_IDS:
        value = statements_in.get(sid)
        statements[sid] = str(value).strip()[:MAX_STATEMENT_CHARS] if value else ""

    if problems:
        raise InputError(problems)
    return facts, answers, choice, statements


def _status(deadline, today):
    left = (deadline - today).days
    return left, ("passed" if left < 0 else "today" if left == 0 else "upcoming")


def _item(key, label, date, today, row, note):
    left, status = _status(date, today)
    return {"id": key, "label": label, "date": date.isoformat(), "days_left": left, "status": status,
            "rule": row["plain"], "source": row["source"], "note": note}


def compute_dates(notice_date, today, table, with_continuation=True, arrived=None):
    appeal, mail = table["appeal"], table["mail_presumption"]
    appeal_by = notice_date + dt.timedelta(days=appeal["days"])
    items = []
    if with_continuation:
        aim, hard = table["continuation_aim"], table["continuation_received_by"]
        items.append(_item("continuation_aim", "Hand in your choice about keeping benefits by", notice_date + dt.timedelta(days=aim["days"]),
                           today, aim, "This is the date to aim for."))
        items.append(_item("continuation_received_by", "Social Security must have it no later than", notice_date + dt.timedelta(days=hard["days"]),
                           today, hard, "This is a received-by date. Hand it in or fax it; do not rely on the mail."))
    items.append(_item("appeal", "Appeal by this date", appeal_by, today, appeal,
                       "Counted from the date printed on the notice, which is the cautious reading."))
    latest, moved_note = _moved(appeal_by + dt.timedelta(days=mail["days"]), today)
    items.append(_item("appeal_latest", "Latest appeal date if the notice took 5 days to arrive", latest,
                       today, mail, "Do not aim for this date. Use it only if the earlier date has passed." + moved_note))

    extra, extra_advice = late_arrival(notice_date, arrived, today, mail, appeal["days"])
    if extra:
        items.append(extra)
    status = {i["id"]: i["status"] for i in items}
    advice = []
    if with_continuation:
        if status["continuation_received_by"] == "passed":
            advice.append("The date for keeping benefits during the appeal has passed. " + table["late_continuation"]["plain"]
                          + " You can still appeal the decision itself.")
        elif status["continuation_aim"] in ("passed", "today"):
            advice.append("The date to aim for has arrived or passed, and the final date is close. If you want benefits to continue, "
                          "take Form SSA-792 to a Social Security office or fax it now.")
        else:
            advice.append("You are inside every date. The choice about keeping benefits comes first because its window is the shortest.")
    if status["appeal_latest"] == "passed":
        advice.append("The appeal dates have passed. " + table["late_appeal"]["plain"]
                      + " Social Security can accept a late appeal if you had a good reason, so explain it when you file.")
    elif status["appeal"] == "passed":
        advice.append("The cautious appeal date has passed, but the later date may still apply. File the appeal as soon as you can.")
    if not advice:
        advice.append("You are inside the general time limit for appealing.")
    if extra_advice:
        if extra and status["appeal_latest"] == "passed":
            advice = [x for x in advice if not x.startswith("The appeal dates have passed")]
        advice.append(extra_advice)
    return {"notice_date": notice_date.isoformat(), "today": today.isoformat(), "items": items, "advice": advice}


def _choices(benefit_kind, table):
    repay = table["repayment"]["plain"]
    ssi_only = benefit_kind == "ssi"
    out = [{
        "id": "continue_all",
        "name": "Keep getting payments during the appeal" if ssi_only else "Keep getting payments and Medicare during the appeal",
        "means": "Your monthly payments keep coming while Social Security decides your appeal.",
        "risk": repay if not ssi_only else repay.replace(" You are not asked to repay Medicare received during the appeal.", ""),
        "section": "Section B of Form SSA-792, for people who receive SSI only" if ssi_only
        else "Section C of Form SSA-792 if the benefits are on your own record, or Section D if you receive them as a spouse, widow, widower or child",
    }]
    if not ssi_only:
        out.append({
            "id": "medicare_only",
            "name": "Keep Medicare only, with no monthly payments",
            "means": "Your Medicare continues during the appeal, but monthly payments stop.",
            "risk": "There are no continued payments to pay back, and you are not asked to repay Medicare received during the appeal. "
                    "You go without monthly payments while the appeal is decided.",
            "section": "The Medicare-only choice in Section C or Section D of Form SSA-792",
            "note": "This choice is for people who get Social Security disability benefits. It is not offered to people who receive SSI only."
            if benefit_kind == "unknown" else None,
        })
    out.append({
        "id": "no_continuation",
        "name": "Appeal without keeping benefits",
        "means": "You still appeal the decision, but payments stop while the appeal is decided.",
        "risk": "There are no continued payments to pay back. You go without benefits while the appeal is decided. "
                "Ask Social Security what happens to the missed payments if your appeal succeeds.",
        "section": "The do-not-continue choice on Form SSA-792",
    })
    return out


def _to_weigh(answers, benefit_kind, table):
    notes = [table["repayment"]["plain"] if benefit_kind != "ssi"
             else table["repayment"]["plain"].replace(" You are not asked to repay Medicare received during the appeal.", "")]
    if answers["could_repay"] == "no":
        notes.append("You said paying it back would be hard. That matters most for the choice to keep monthly payments."
                     + ("" if benefit_kind == "ssi" else " The Medicare-only choice keeps health coverage without building up a debt."))
    elif answers["could_repay"] == "unknown":
        notes.append("You are not sure you could pay it back. Work out roughly how many months an appeal might take and what that would add up to.")
    if answers["has_medicare"] == "yes" and benefit_kind != "ssi":
        notes.append("You have Medicare. It can continue during the appeal under either continuation choice.")
    if answers["others_on_record"] == "yes":
        notes.append("Others get benefits on your record. Form SSA-792 lets you choose for yourself only or for them too, "
                     "and a spouse or child can make their own choice in their own section.")
    if answers["still_disabled"] != "yes":
        notes.append("You can appeal before the appeal date even if you are unsure today. Appealing and keeping benefits are separate choices.")
    return notes


def _kit(facts, answers, choice, statements, dates, choices, table, rules_dir):
    appeal_form, election_form = table["appeal_form"], table["election_form"]
    kit_rows = rules.rows_as_of("kit", facts["notice_date"], rules_dir)
    contact, help_row = kit_rows["contact"], kit_rows["help"]
    blank = "[Write this in your own words]"
    status = {i["id"]: i["status"] for i in dates["items"]}
    picked = next((c for c in choices if c["id"] == choice), None)

    appeal_draft = [
        "I do not agree with the determination to stop my disability benefits, and I request reconsideration. The notice is dated %s." % _long(facts["notice_date"]),
        "My reasons: %s" % (statements["why_disagree"] or blank),
        "Treatment and doctors since my last review: %s" % (statements["treatment"] or blank),
    ]
    if status.get("appeal_latest") == "passed":
        appeal_draft.append("Why this request is late, and the date I received the notice: %s" % (statements["late_reason"] or blank))

    election = {
        "form": election_form["form"], "title": election_form["title"], "url": election_form["url"],
        "must_be_received_by": next((i["date"] for i in dates["items"] if i["id"] == "continuation_received_by"), None),
        "chosen": picked["name"] if picked else None,
        "where_on_form": picked["section"] if picked else None,
        "undecided_note": None if picked else "You have not chosen yet. All the choices are set out below. Whatever you choose, the form must reach Social Security by the date shown.",
        "warning": table["repayment"]["plain"] if choice in ("continue_all", "undecided") else None,
        "late": table["late_continuation"]["plain"] if status.get("continuation_received_by") == "passed" else None,
        "late_draft": ("Why my choice is late: %s" % (statements["late_reason"] or blank)) if status.get("continuation_received_by") == "passed" else None,
    }

    documents = ["The notice (every page)", "Names, addresses and phone numbers of every doctor, clinic or hospital that has treated you since your last review",
                 "A list of your medicines and what each is for"]
    if answers["new_evidence"] != "no":
        documents.append("Medical records, test results or letters from after your last review. " + table["evidence"]["plain"])
    if answers["others_on_record"] == "yes":
        documents.append("The names of the people who get benefits on your record, for Form SSA-792")

    return {
        "title": "Your disability-ended notice kit",
        "summary": "Two forms, two dates. The choice about keeping benefits must reach Social Security first; the appeal has longer.",
        "dates": [{"label": i["label"], "date": i["date"], "days_left": i["days_left"], "status": i["status"]} for i in dates["items"]],
        "advice": dates["advice"],
        "appeal": {
            "form": appeal_form["form"], "title": appeal_form["title"], "url": appeal_form["url"],
            "about": appeal_form["plain"], "hearing": table["no_hearing_appearance"]["plain"], "draft": appeal_draft,
        },
        "election": election,
        "choices": choices,
        "documents": documents,
        "how_to_file": [
            "Fill in the official forms. This kit is a draft to copy from, not the forms themselves.",
            "Take Form SSA-792 to a Social Security office or fax it, so it is received in time. Find an office: %s" % contact["office_locator"],
            "Hand in or send Form SSA-789 as well. You can file both together.",
            "Ask for a date-stamped copy or keep the fax confirmation. Keep copies of everything.",
        ],
        "if_you_lose": "If the appeal is not successful and you kept payments, Social Security will send an overpayment notice. "
                       "This site's overpayment helper covers that letter, including asking for a waiver.",
        "get_help": {"text": help_row["plain"] + " Some lawyers who handle disability appeals charge only if you win.",
                     "legal_aid_finder": help_row["legal_aid_finder"], "phone": contact["phone"], "tty": contact["tty"],
                     "office_locator": contact["office_locator"]},
        "disclaimer": "This kit was made by an independent tool. It is not from the Social Security Administration, it is not legal advice, "
                      "it does not choose for you, and nothing in it has been sent to Social Security.",
    }


def run(raw_facts, raw_answers=None, raw_choice=None, raw_statements=None, today=None, rules_dir=None):
    today = today or dt.date.today()
    facts, answers, choice, statements = clean(raw_facts, raw_answers, raw_choice, raw_statements, today)
    table = rules.rows_as_of("cessation", facts["notice_date"], rules_dir)
    kit_rows = rules.rows_as_of("kit", facts["notice_date"], rules_dir)
    as_of = rules.rules_checked_as_of(rules_dir)

    if facts["letter_kind"] in OUT_OF_SCOPE:
        dates = compute_dates(facts["notice_date"], today, table, with_continuation=False, arrived=facts["arrived_date"])
        return {
            "in_scope": False,
            "message": OUT_OF_SCOPE[facts["letter_kind"]],
            "what_to_do": [
                "Read the part of your letter about appealing today. Some rights last only a few days from the date on the letter.",
                "The general time limit for appealing a Social Security decision is 60 days from when you received the letter. Your dates are shown here.",
                "Call Social Security at %s (TTY %s) or visit a local office and ask what your letter's deadlines are." % (kit_rows["contact"]["phone"], kit_rows["contact"]["tty"]),
            ],
            "deadlines": dates,
            "get_help": {"text": kit_rows["help"]["plain"], "legal_aid_finder": kit_rows["help"]["legal_aid_finder"],
                         "phone": kit_rows["contact"]["phone"], "tty": kit_rows["contact"]["tty"], "office_locator": kit_rows["contact"]["office_locator"]},
            "rules_as_of": as_of,
        }

    dates = compute_dates(facts["notice_date"], today, table, arrived=facts["arrived_date"])
    choices = _choices(facts["benefit_kind"], table)
    if choice == "medicare_only" and facts["benefit_kind"] == "ssi":
        choice = "undecided"        # not offered to SSI-only recipients
    return {
        "in_scope": True,
        "caution": "These dates apply if your letter says your disability has ended after a medical review. If it gives another reason, "
                   "read its appeal section today, because other letters follow different rules." if facts["letter_kind"] == "unknown" else None,
        "deadlines": dates,
        "choices": choices,
        "to_weigh": _to_weigh(answers, facts["benefit_kind"], table),
        "choice": choice,
        "kit": _kit(facts, answers, choice, statements, dates, choices, table, rules_dir),
        "rules_as_of": as_of,
    }
