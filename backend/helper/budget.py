"""Monthly budget worksheet: plain arithmetic on figures the person enters.

It reports what is left after basic expenses. It never suggests how much to
offer Social Security; that choice stays with the person.
"""

from .validate import InputError, as_mapping

EXPENSES = (
    ("housing", "Rent or mortgage"),
    ("utilities", "Utilities and phone"),
    ("food", "Food"),
    ("medical", "Medicine and medical bills"),
    ("transport", "Transport"),
    ("other", "Other basics"),
)
FIELDS = ("income",) + tuple(k for k, _ in EXPENSES)
MAX_AMOUNT = 1000000


def clean(raw):
    """Return {field: amount} or None when the worksheet was left empty."""
    raw = as_mapping(raw, "budget_income", "The budget could not be read. Enter the figures again.")
    if all(raw.get(f) in (None, "") for f in FIELDS):
        return None
    problems, out = {}, {}
    for f in FIELDS:
        value = raw.get(f)
        if isinstance(value, (list, dict, bool)):
            problems["budget_" + f] = "Enter a number, like 850."
            continue
        if value in (None, ""):
            out[f] = 0.0
            continue
        try:
            amount = round(float(str(value).replace(",", "").replace("$", "")), 2)
        except ValueError:
            problems["budget_" + f] = "Enter a number, like 850."
            continue
        if amount < 0 or amount > MAX_AMOUNT:
            problems["budget_" + f] = "Enter an amount between 0 and 1,000,000."
            continue
        out[f] = amount
    if problems:
        raise InputError(problems)
    return out


def summarise(budget):
    if budget is None:
        return None
    expenses = round(sum(budget[k] for k, _ in EXPENSES), 2)
    left = round(budget["income"] - expenses, 2)
    money = "${:,.2f}".format
    if left > 0:
        sentence = "My monthly income is %s and my basic expenses are %s, which leaves %s a month." % (
            money(budget["income"]), money(expenses), money(left))
    elif left == 0:
        sentence = "My monthly income is %s and my basic expenses are %s, which leaves nothing." % (
            money(budget["income"]), money(expenses))
    else:
        sentence = "My monthly income is %s and my basic expenses are %s, so I am already short by %s a month." % (
            money(budget["income"]), money(expenses), money(-left))
    return {
        "income": budget["income"],
        "expenses": expenses,
        "left": left,
        "lines": [{"label": label, "amount": budget[k]} for k, label in EXPENSES if budget[k]],
        "sentence": sentence,
    }
