"""One entry point that runs the whole Release 1 flow."""

import datetime as dt

from . import budget as budget_sheet
from . import deadlines, kit, routing, rules, validate


def run(raw_facts, raw_answers=None, raw_statements=None, today=None, rules_dir=None, raw_budget=None):
    """Validate input, then compute dates, the requests that may fit, and the kit.

    Raises validate.InputError with plain messages when the input cannot be used.
    """
    today = today or dt.date.today()
    facts = validate.clean_facts(raw_facts, today)
    answers = validate.clean_answers(raw_answers)
    statements = validate.clean_statements(raw_statements)
    budget = budget_sheet.summarise(budget_sheet.clean(raw_budget))

    dates = deadlines.compute(facts["notice_date"], today, rules_dir, arrived=facts.get("arrived_date"))
    evaluation = routing.evaluate(answers, facts["notice_date"], rules_dir)
    the_kit = kit.build(facts, answers, statements, dates, evaluation, validate.QUESTIONS, rules_dir, budget)

    withholding = rules.rows_as_of("withholding", facts["notice_date"], rules_dir)
    program = "ssi" if facts["benefit_type"] == "ssi" else "social_security_benefits"
    withholding_notes = [
        {"text": row["plain"], "source": row["source"]}
        for row in withholding.values()
        if row["program"] == program
    ]

    return {
        "deadlines": dates,
        "evaluation": evaluation,
        "kit": the_kit,
        "budget": budget,
        "withholding": {
            "stated_on_notice": facts["stated_withholding"],
            "sources_disagree": len(withholding_notes) > 1,
            "action": "Follow the amount on your notice. If it differs from what is being taken, or you cannot "
            "find it, ask Social Security or a legal aid office.",
            "notes": withholding_notes,
        },
        "math_check": {
            "available": False,
            "text": "The math check is not part of this release. To check the amount yourself, ask Social "
            "Security for the month-by-month payment record.",
        },
        "rules_as_of": rules.rules_checked_as_of(rules_dir),
    }
