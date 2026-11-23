"""Request rules: which of appeal, waiver and lower rate may fit the answers.

Three rules the code never breaks:
  1. It never says a request is not needed or not allowed. The weakest thing
     it says is that the answers given do not point to that request.
  2. When answers are missing or unsure, it says so and still shows every
     request, so the deadlines stay in front of the person.
  3. It says "may fit", never "you qualify". Social Security decides.
"""

from . import rules

MAY_FIT = "may_fit"
NEED_MORE = "need_more_info"
NOT_INDICATED = "not_indicated"

ORDER = ("appeal", "waiver", "lower_rate")


def _appeal(a):
    used = [("amount_wrong", a["amount_wrong"])]
    if a["amount_wrong"] == "yes":
        return MAY_FIT, "You said the amount is wrong or you were not overpaid.", used
    if a["amount_wrong"] == "unknown":
        return (
            NEED_MORE,
            "You are not sure the amount is right. You can ask Social Security for the payment record "
            "and still appeal before the deadline.",
            used,
        )
    return (
        NOT_INDICATED,
        "Your answers do not point to an appeal, because you did not dispute the amount. "
        "You can still appeal before the deadline if that changes.",
        used,
    )


def _waiver(a):
    used = [(k, a[k]) for k in ("not_at_fault", "cannot_afford", "unfair_other", "reported_change")]
    fault, afford, unfair = a["not_at_fault"], a["cannot_afford"], a["unfair_other"]
    burden = "yes" in (afford, unfair)
    if fault == "yes" and burden:
        why = "You said it was not your fault and that paying it back "
        why += "would leave you unable to cover basics." if afford == "yes" else "would be unfair."
        return MAY_FIT, why, used
    if fault == "no":
        return (
            NOT_INDICATED,
            "Your answers do not point to a waiver, because a waiver asks you to show the overpayment "
            "was not your fault. A waiver has no time limit, so you can ask later if you learn more.",
            used,
        )
    if fault == "yes" and afford == "no" and unfair == "no":
        return (
            NOT_INDICATED,
            "Your answers do not point to a waiver, because a waiver also asks you to show that paying "
            "back would cause hardship or be unfair. You can ask later if your situation changes.",
            used,
        )
    return (
        NEED_MORE,
        "A waiver needs two things: the overpayment was not your fault, and paying it back would cause "
        "hardship or be unfair. Some of those answers are missing or unsure.",
        used,
    )


def _lower_rate(a):
    used = [("rate_too_high", a["rate_too_high"])]
    if a["rate_too_high"] == "yes":
        return MAY_FIT, "You said the amount being taken each month is more than you can manage.", used
    if a["rate_too_high"] == "unknown":
        return (
            NEED_MORE,
            "You are not sure you can manage the monthly amount. Compare it with your monthly income and bills.",
            used,
        )
    return (
        NOT_INDICATED,
        "Your answers do not point to a lower rate, because you said you can manage the monthly amount. "
        "You can ask later if that changes.",
        used,
    )


_RULES = {"appeal": _appeal, "waiver": _waiver, "lower_rate": _lower_rate}


def evaluate(answers, notice_date, rules_dir=None):
    """Return every request with its status, and one headline."""
    table = rules.rows_as_of("requests", notice_date, rules_dir)
    options = []
    for rid in ORDER:
        status, reason, used = _RULES[rid](answers)
        row = table[rid]
        options.append(
            {
                "id": rid,
                "name": row["name"],
                "official_name": row["official_name"],
                "form": row["form"],
                "form_url": row["form_url"],
                "online_url": row.get("online_url"),
                "when": row["when"],
                "time_limit": row["time_limit"],
                "phone_note": row.get("phone_note"),
                "status": status,
                "reason": reason,
                "answers_used": [{"question": q, "answer": v} for q, v in used],
                "source": row["source"],
            }
        )

    fits = [o["id"] for o in options if o["status"] == MAY_FIT]
    if len(fits) == 1:
        headline = fits[0]
        name = next(o["name"] for o in options if o["id"] == headline)
        summary = "%s may fit your situation." % name
    elif len(fits) > 1:
        headline = "multiple"
        names = [o["name"].lower() for o in options if o["id"] in fits]
        summary = (
            "More than one request may fit: %s. You can make more than one request. "
            "Social Security decides each one separately." % " and ".join(names)
        )
    else:
        headline = "cannot_determine"
        summary = (
            "We cannot tell from your answers which request fits. All three are shown below with the "
            "deadlines, and free legal aid can help you choose."
        )

    return {"headline": headline, "summary": summary, "fits": fits, "options": options}
