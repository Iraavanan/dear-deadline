"""Six smaller helpers built from what people say goes wrong most often:

- msp:        could a Medicare Savings Program or Extra Help pay my Medicare costs?
- stolen:     my SNAP benefits were stolen from my EBT card
- lockout:    I'm locked out of my Social Security account
- ssacall:    I can't reach anyone at Social Security
- withhold:   they're taking too much from my check
- procedural: I lost Medicaid or SNAP over paperwork

Each one compares what the person enters with dated, sourced rules, and says "may", never
"you qualify". Nothing is stored.
"""

import datetime as dt
import math

from . import rules
from .validate import InputError, _parse_date, as_mapping

MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
INDEPENDENT = " This is an independent tool, not a government agency, and not legal advice."


def _long(d):
    return "%s %d, %d" % (MONTHS[d.month - 1], d.day, d.year)


def _money(v, field, problems, required=True, top=10_000_000):
    if v in (None, "") and not required:
        return None
    try:
        if isinstance(v, bool):
            raise ValueError
        x = float(str(v).replace(",", "").replace("$", "").strip())
        if x < 0 or x > top:
            raise ValueError
        return round(x, 2)
    except (TypeError, ValueError):
        problems[field] = "Enter an amount in dollars."
        return None


def _date(v, field, problems, today, back_days, required=True, message="Enter the date as month, day and year."):
    if v in (None, "") and not required:
        return None
    try:
        d = _parse_date(v)
        if d > today or d < today - dt.timedelta(days=back_days):
            problems[field] = "Check the date."
        return d
    except (TypeError, ValueError):
        problems[field] = message
        return None


def _pick(body, field, allowed, problems, message):
    v = body.get(field)
    if v not in allowed:
        problems[field] = message
        return None
    return v


def _rules(rows):
    seen, out = set(), []
    for r in rows:
        key = (r["id"], r["source"])
        if key not in seen:
            seen.add(key)
            out.append({"plain": r["plain"], "source": r["source"]})
    return out


def _done(out, used, rules_dir, disclaimer):
    out["rules"] = _rules(used)
    out["rules_as_of"] = rules.rules_checked_as_of(rules_dir)
    out["disclaimer"] = disclaimer + INDEPENDENT
    return out


# ---------------------------------------------------------------- Medicare costs

def msp(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = rules.rows_as_of("msp", today, rules_dir)
    body = as_mapping(raw, "household", "The details could not be read. Enter them again.")
    p = {}
    hh = _pick(body, "household", ("single", "couple"), p, "Choose whether this is for one person or a married couple.")
    income = _money(body.get("monthly_income"), "monthly_income", p)
    res = _money(body.get("resources"), "resources", p)
    state = body.get("state") or "other"
    if state not in ("FL", "other"):
        p["state"] = "Choose your state."
    if p:
        raise InputError(p)
    programs = []
    for key, name in (("qmb", "QMB (Qualified Medicare Beneficiary)"), ("slmb", "SLMB (Specified Low-Income Medicare Beneficiary)"), ("qi", "QI (Qualifying Individual)")):
        r = t[key]
        programs.append({"id": key, "name": name, "what": r["plain"].split(" 2026")[0],
                         "income_limit": r["income"][hh], "resource_limit": r["resources"][hh],
                         "income_ok": income <= r["income"][hh], "resources_ok": res <= r["resources"][hh]})
    eh = t["extra_help"]
    programs.append({"id": "extra_help", "name": "Extra Help (with Medicare drug costs)", "what": eh["plain"].split(" 2026")[0],
                     "income_limit": round(eh["income"][hh] / 12, 2), "resource_limit": eh["resources"][hh],
                     "income_ok": income * 12 <= eh["income"][hh], "resources_ok": res <= eh["resources"][hh]})
    for x in programs:
        x["may_fit"] = x["income_ok"] and x["resources_ok"]
    fits = [x for x in programs if x["may_fit"]]
    msp_fit = [x for x in fits if x["id"] != "extra_help"]
    if msp_fit:
        headline = "Your figures may fit %s" % msp_fit[0]["name"].split(" (")[0]
    elif fits:
        headline = "Your figures may fit Extra Help"
    else:
        headline = "Your figures are above the federal limits, but you may still qualify"
    steps = []
    used = [t[x["id"]] for x in programs]
    if msp_fit:
        steps.append(t["apply_msp"]["plain"])
        steps.append(t["auto"]["plain"])
        used += [t["apply_msp"], t["auto"]]
    if any(x["id"] == "extra_help" for x in fits) and not msp_fit:
        steps.append(t["apply_eh"]["plain"])
        used.append(t["apply_eh"])
    steps.append(t["higher"]["plain"] + " If you are close to a limit, apply anyway: the office decides.")
    used.append(t["higher"])
    steps.append("Use your income before anything is taken out, including the Medicare premium taken from a Social Security check. Your home, one car and burial plots do not count as resources.")
    return _done({"household": hh, "headline": headline, "programs": programs, "steps": steps, "state": state},
                 used, rules_dir, "This compares your figures with the 2026 federal limits. The state Medicaid office or Social Security decides.")


# ---------------------------------------------------------------- stolen SNAP

def stolen(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = rules.rows_as_of("stolen", today, rules_dir)
    body = as_mapping(raw, "state", "The details could not be read. Enter them again.")
    p = {}
    state = _pick(body, "state", ("FL", "other"), p, "Choose your state.")
    noticed = _date(body.get("noticed"), "noticed", p, today, 3 * 365, required=False)
    amount = _money(body.get("amount"), "amount", p, required=False, top=100_000)
    where = body.get("where") or ""
    if not isinstance(where, str) or len(where) > 200:
        p["where"] = "Keep this short."
    if p:
        raise InputError(p)
    steps, used = [], []
    if state == "FL":
        steps.append("Today: call Florida EBT Customer Service at %s to cancel the card and get a new one, or use your MyACCESS account." % t["fl_steps"]["phone"])
        steps.append("Set a new PIN when the new card comes. " + t["pin"]["plain"])
        steps.append("Freeze the card in ebtEDGE between shopping trips, and block out-of-state and online purchases if you do not use them.")
        steps.append("File a police report with your local police or sheriff. Ask for the report number. The statement below can help.")
        used += [t["fl_steps"], t["fl_lock"], t["pin"]]
    else:
        steps.append(t["other"]["plain"])
        steps.append("Cancel the card and get a new one by calling the EBT customer service number on the back of your card.")
        steps.append("File a police report and ask for the report number. The statement below can help.")
        used += [t["other"], t["pin"]]
    steps.append("Write down each wrong transaction: date, store or city, amount. Keep the report number and the date you called.")
    steps.append(t["ended"]["plain"] + " Ask your SNAP office anyway whether anything can be replaced.")
    steps.append(t["phishing"]["plain"])
    used += [t["ended"], t["phishing"]]
    statement = "\n".join([
        "Statement about stolen SNAP benefits", "",
        "Name: [your name]", "Address: [your address]", "Phone: [your phone number]", "",
        "On %s I found that SNAP food benefits were taken from my EBT card without my permission%s." % (
            _long(noticed) if noticed else "[date]", (" (about $%s)" % format(amount, ",.2f")) if amount else ""),
        "I did not make these transactions. [I did not give anyone my card or PIN.]%s" % ((" The transactions were made " + where.strip() + ".") if where.strip() else ""),
        "", "Transactions I did not make:", "- [date] [store or city] [amount]", "- [date] [store or city] [amount]", "",
        "I have cancelled the card and asked for a new one on [date].", "",
        "Signature: ____________________   Date: __________"])
    return _done({"state": state, "headline": "Stop more theft today, then report it", "steps": steps, "statement": statement},
                 used, rules_dir, "Replacing stolen benefits is not guaranteed.")


# ---------------------------------------------------------------- locked out

PROBLEMS = ("cant_verify", "locked", "no_code", "no_phone", "no_id")


def lockout(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = rules.rows_as_of("lockout", today, rules_dir)
    body = as_mapping(raw, "provider", "The details could not be read. Enter them again.")
    p = {}
    provider = _pick(body, "provider", ("logingov", "idme", "unsure"), p, "Choose the sign-in you use.")
    problem = _pick(body, "problem", PROBLEMS, p, "Choose what is going wrong.")
    if p:
        raise InputError(p)
    steps, used = [], [t["two"]]
    lg, idme = provider in ("logingov", "unsure"), provider in ("idme", "unsure")
    if problem == "locked" and lg:
        steps.append(t["lg_wait"]["plain"])
        used.append(t["lg_wait"])
    if problem in ("cant_verify", "locked", "no_id"):
        if lg:
            steps.append(t["lg_post"]["plain"])
            used.append(t["lg_post"])
        if idme:
            steps.append(t["idme_video"]["plain"] + " " + t["idme_store"]["plain"])
            used += [t["idme_video"], t["idme_store"]]
    if problem in ("no_code", "no_phone"):
        steps.append(t["no_phone"]["plain"] + " If codes stop coming, contact the help center of the sign-in you use (Login.gov or ID.me): Social Security cannot reset it.")
        used.append(t["no_phone"])
        if idme:
            steps.append(t["idme_video"]["plain"])
            used.append(t["idme_video"])
    steps.append(t["ssa_office"]["plain"])
    steps.append(t["phone"]["plain"] + " You can ask for a letter, such as a benefit letter or a tax form (SSA-1099), to be mailed to you.")
    used += [t["ssa_office"], t["phone"]]
    help_links = []
    if lg:
        help_links.append({"name": "Login.gov help", "url": "https://login.gov/help/"})
    if idme:
        help_links.append({"name": "ID.me help", "url": "https://help.id.me/"})
    return _done({"provider": provider, "problem": problem, "headline": "Ways back in, and ways around it", "steps": steps, "help": help_links},
                 used, rules_dir, "Login.gov and ID.me fix sign-in problems; Social Security handles your benefits.")


# ---------------------------------------------------------------- reaching Social Security

TOPICS = {
    "letter": ("A letter I got", ["The letter, every page", "The date printed on it", "Your claim number from the letter"]),
    "overpayment": ("An overpayment", ["The overpayment notice", "What you want: an explanation, a lower rate, an appeal or a waiver", "Copies of anything you already sent"]),
    "payment": ("A missing or wrong payment", ["The date you expected it and the amount", "Your bank name (not the account number, until they ask)", "Your last benefit letter"]),
    "claim": ("A claim or appeal I filed", ["The date you filed", "Any receipt or confirmation number", "Names of doctors or employers you listed"]),
    "card": ("My Social Security card or a benefit letter", ["Your ID, such as a driver's license or passport", "Your mailing address"]),
    "other": ("Something else", ["Any letter about it", "Dates and names from earlier calls"]),
}


def ssacall(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = rules.rows_as_of("ssacall", today, rules_dir)
    body = as_mapping(raw, "topic", "The details could not be read. Enter them again.")
    p = {}
    topic = _pick(body, "topic", tuple(TOPICS), p, "Choose what the call is about.")
    urgent = body.get("urgent") is True
    if p:
        raise InputError(p)
    name, ready = TOPICS[topic]
    ready = ["Your Social Security number (they will ask; do not give it to anyone who called you)"] + ready + ["Paper and pen, or the call log below"]
    wd = today.weekday()
    plan = []
    if wd < 5:
        plan.append("Today is %s. Call right at 8 a.m. your local time if you can." % DAYS[wd])
    else:
        plan.append("Today is %s. The line opens Monday at 8 a.m. your local time; the automated service works now." % DAYS[wd])
    plan.append(t["best"]["plain"])
    plan.append(t["callback"]["plain"])
    plan.append("If you cannot get through, call your local office instead, or ask for an appointment.")
    words = "\n".join([
        "Hello. My name is [your name]. I am calling about %s." % name.lower(),
        "[One sentence: what happened and when.]",
        "I would like to [ask what I need to do / ask you to fix it / ask for an appointment].",
        "Before we hang up, could you tell me your name or ID, and what will happen next, and by when?",
        "Could you put a note on my record about this call?"])
    if urgent:
        plan.insert(0, "If you have no money for food, medicine or housing because of this, say so at the start of the call. For a disability claim, see the slow-case helper.")
    return _done({"topic": topic, "topic_name": name, "headline": "Call plan: %s" % name.lower(), "ready": ready, "plan": plan, "words": words},
                 [t["hours"], t["best"], t["callback"], t["office"], t["waits"]], rules_dir, "Wait times change.")


# ---------------------------------------------------------------- withholding

EXPENSES = ("rent", "utilities", "food", "medical", "transport", "phone", "insurance", "debts", "other")


def withhold(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = rules.rows_as_of("withhold", today, rules_dir)
    wr = rules.rows_as_of("withholding", today, rules_dir)
    body = as_mapping(raw, "program", "The details could not be read. Enter them again.")
    p = {}
    program = _pick(body, "program", ("t2", "ssi"), p, "Choose the kind of benefit.")
    balance = _money(body.get("balance"), "balance", p, top=1_000_000)
    taken = _money(body.get("taken"), "taken", p, top=100_000)
    income = _money(body.get("income"), "income", p, top=100_000)
    resources = _money(body.get("resources"), "resources", p, required=False)
    ask = _money(body.get("ask"), "ask", p, required=False, top=100_000)
    spent = {}
    given = body.get("expenses") or {}
    if not isinstance(given, dict):
        p["expenses"] = "The expenses could not be read."
        given = {}
    for k in EXPENSES:
        v = _money(given.get(k), "expenses." + k, p, required=False, top=100_000)
        spent[k] = v or 0
    extra_help = body.get("extra_help") is True
    if balance is not None and balance <= 0:
        p["balance"] = "Enter what you still owe."
    if p:
        raise InputError(p)
    total_exp = round(sum(spent.values()), 2)
    left = round(income - total_exp, 2)
    in12 = math.ceil(balance / 12 * 100) / 100
    in60 = math.ceil(balance / 60 * 100) / 100
    months_now = math.ceil(balance / taken) if taken else None
    used = [t["lower"], t["twelve"], t["sixty"], wr["ssi_default" if program == "ssi" else "benefits_default"]]
    steps = []
    if left < 0:
        headline = "Your expenses are $%s a month more than your income" % format(-left, ",.2f")
    else:
        headline = "After expenses, $%s a month is left" % format(left, ",.2f")
    if ask is not None:
        need_form = ask < in60 and not (extra_help and ask >= t["partd"]["amount"])
        steps.append("You plan to ask for $%s a month. %s" % (format(ask, ",.2f"),
                     "That would take more than 60 months, so Social Security will ask you to fill in form SSA-634." if need_form
                     else "That repays the debt within 60 months, or you get full Extra Help, so form SSA-634 should not be needed."))
    steps.append("Call Social Security or your local office and ask for a lower rate. Say how much you can afford, and that the current amount leaves you unable to pay for necessary expenses. The letter below says the same in writing.")
    if program == "ssi":
        used.append(t["ssi"])
    if extra_help:
        used.append(t["partd"])
    if resources is not None:
        used.append(t["resources"])
    used += [t["fraud"], t["form"]]
    steps.append("If you think the overpayment is wrong or not your fault, you can also ask for reconsideration or a waiver. The overpayment helper works out those dates.")
    letter = "\n".join([
        "To: Social Security Administration, [your local office address]", "Date: [today's date]", "Name: [your name]",
        "Claim number: [from your notice]", "", "Re: Request for a lower overpayment recovery rate", "",
        "Social Security is taking $%s a month from my %s to repay an overpayment. I cannot meet my necessary living expenses at this rate." % (format(taken, ",.2f"), "SSI" if program == "ssi" else "benefits"),
        "My monthly income is $%s and my necessary expenses are $%s." % (format(income, ",.2f"), format(total_exp, ",.2f")),
        "I am asking you to lower the amount to $%s a month." % (format(ask, ",.2f") if ask is not None else "[amount]"),
        "I will fill in form SSA-634 if you need it.", "", "Phone: [your phone number]", "", "Signature: ____________________"])
    sheet = ["Monthly budget for form SSA-634", "", "Income: $%s" % format(income, ",.2f")]
    sheet += ["%s: $%s" % (k.capitalize(), format(v, ",.2f")) for k, v in spent.items() if v]
    sheet += ["Total expenses: $%s" % format(total_exp, ",.2f"), "Left each month: $%s" % format(left, ",.2f")]
    if resources is not None:
        sheet.append("Money in bank accounts and cash: $%s" % format(resources, ",.2f"))
    return _done({"program": program, "headline": headline, "balance": balance, "taken": taken, "months_at_current_rate": months_now,
                  "in_12_months": in12, "in_60_months": in60, "income": income, "expenses": total_exp, "left": left,
                  "steps": steps, "letter": letter, "budget": "\n".join(sheet)},
                 used, rules_dir, "Social Security decides the rate. These figures come from what you entered.")


# ---------------------------------------------------------------- lost over paperwork

def procedural(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = rules.rows_as_of("procedural", today, rules_dir)
    body = as_mapping(raw, "program", "The details could not be read. Enter them again.")
    p = {}
    program = _pick(body, "program", ("medicaid", "snap"), p, "Choose Medicaid or SNAP.")
    basis = body.get("basis") or "unsure"
    if program == "medicaid" and basis not in ("income", "abd", "unsure"):
        p["basis"] = "Choose what your Medicaid is based on."
    ended = _date(body.get("ended"), "ended", p, today + dt.timedelta(days=60), 2 * 365,
                  message="Enter the date coverage or benefits ended.")
    state = body.get("state") or "other"
    states = rules.rows_as_of("medicaid_states", today, rules_dir)
    if state != "FL" and state != "other" and state not in states:
        p["state"] = "Choose your state."
    if p:
        raise InputError(p)
    used, steps = [], []
    if program == "medicaid":
        row = t["medicaid_magi"]
        until = ended + dt.timedelta(days=row["days"])
        used.append(row)
        if basis != "income":
            used.append(t["medicaid_abd"])
        what = "send the renewal form or the missing papers"
    else:
        row = t["snap_late_proof"]
        until = ended + dt.timedelta(days=row["days"])
        used += [row, t["snap_late_app"]]
        what = "send the missing papers, or the renewal if you never sent it"
    left = (until - today).days
    if left >= 0:
        headline = "%s by %s to get it looked at again without starting over" % (what[0].upper() + what[1:], _long(until))
    else:
        headline = "The window to send papers ended on %s, but you can apply again today" % _long(until)
    if program == "medicaid" and basis != "income":
        steps.append(t["medicaid_abd"]["plain"])
    steps.append("Send them in a way you can prove: upload and save the confirmation, or fax and keep the fax receipt, or hand them in and ask for a dated receipt.")
    steps.append("Use the cover note below so the office knows to reopen your case, not start a new one.")
    contact = None
    if state == "FL":
        ren = rules.rows_as_of("renewal", today, rules_dir)
        steps.append(ren["fl_ways"]["plain"])
        used.append(ren["fl_ways"])
        contact = {"name": "Florida DCF (ACCESS Florida)", "portal": "https://myaccess.myflfamilies.com/"}
    elif state in states and state != "hold":
        s = states[state]
        contact = {"name": s["name"], "phone": s["phone"], "portal": s["portal"]}
    used.append(t["hearing"])
    steps.append(t["hearing"]["plain"] + " The hearing helper gives that date.")
    note = "\n".join([
        "To: [%s office address or fax]" % ("Medicaid" if program == "medicaid" else "SNAP"), "Date: [today's date]",
        "Name: [your name]", "Case number: [from your notice]", "",
        "Re: Papers sent after my %s ended on %s" % ("Medicaid" if program == "medicaid" else "SNAP", _long(ended)), "",
        "My %s ended because the office did not receive %s. I am sending them now:" % (
            "Medicaid" if program == "medicaid" else "SNAP", "my renewal or the papers it asked for"),
        "- [list each paper]", "",
        ("Please reconsider my eligibility without a new application, as 42 CFR 435.916 provides when papers come in within 90 days." if program == "medicaid"
         else "Please reopen my case, as 7 CFR 273.14(e) provides when papers come in within 30 days after the certification period ends."),
        "", "Phone: [your phone number]", "", "Signature: ____________________"])
    return _done({"program": program, "headline": headline, "until": until.isoformat(), "until_long": _long(until), "days_left": left,
                  "steps": steps, "note": note, "contact": contact},
                 used, rules_dir, "The date is counted from the end date you entered and the federal rules; your state may give longer. Check your notice.")
