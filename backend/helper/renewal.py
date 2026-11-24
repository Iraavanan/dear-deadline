"""What is missing from my renewal? A check before the packet goes in.

The person enters the dates printed on the renewal form or the request for proof,
each item the agency asked for, and ticks what is done. The tool lists the dates,
what is still missing, what to check on the pages, how to send it, and a cover
sheet that lists everything enclosed. Nothing is uploaded: document images stay
with the person. It never says a renewal will be approved.
"""

import datetime as dt

from . import rules
from .i18n import _, as_of as _asof, listed as _listed, long_date as _long, note as _note, rows as _rows
from .validate import InputError, _parse_date, as_mapping

PROGRAMS = ("medicaid", "snap")
STATES = ("FL", "other")
METHODS = ("online", "mail", "fax", "in_person", "unsure")
ITEM_STATUS = ("have", "get", "unsure")
CHECKS = (
    ("signed", "Every page that asks for a signature is signed and dated"),
    ("all_pages", "Every page of the form is included, even pages with nothing changed"),
    ("case_number", "Your name and case number are on each page you send"),
    ("copies", "You are sending copies and keeping the originals"),
    ("readable", "Each photo or copy is readable: all four corners, nothing cut off, not blurry"),
    ("changes", "Any change is reported: address, income, who lives with you"),
)
MAX_ITEMS = 15


def _date(body, key, problems, today, past_ok=True, future_ok=True):
    v = body.get(key)
    if v in (None, ""):
        return None
    try:
        d = _parse_date(v)
    except (TypeError, ValueError):
        problems[key] = _("Enter the date as month, day and year, or leave it empty.")
        return None
    if d.year < 2000 or d > today + dt.timedelta(days=400) or (not past_ok and d < today - dt.timedelta(days=400)):
        problems[key] = _("Check the date printed on the notice.")
    return d


def clean(raw, today):
    body = as_mapping(raw, "programs", _("The details could not be read. Enter them again."))
    problems = {}
    programs = body.get("programs")
    if not isinstance(programs, list) or not programs or any(p not in PROGRAMS for p in programs):
        problems["programs"] = _("Choose Medicaid, SNAP or both.")
        programs = []
    state = body.get("state") or "other"
    if state not in STATES:
        problems["state"] = _("Choose a state.")
    method = body.get("method") or "unsure"
    if method not in METHODS:
        problems["method"] = _("Choose how you will send it.")
    f = {"programs": programs, "state": state, "method": method}
    for key in ("form_due", "proof_due", "coverage_ends", "notice_date"):
        f[key] = _date(body, key, problems, today)
    if not f["form_due"] and not f["proof_due"] and not f["coverage_ends"] and not problems:
        problems["form_due"] = _("Enter at least one date from your notice: when the form is due, when proof is due, or when coverage ends.")
    items_in = body.get("items") or []
    if not isinstance(items_in, list) or len(items_in) > MAX_ITEMS:
        raise InputError({"items": _("Enter up to %d items.") % MAX_ITEMS})
    items = []
    for i, it in enumerate(items_in, start=1):
        if not isinstance(it, dict):
            raise InputError({"items": _("An item could not be read. Enter it again.")})
        what = str(it.get("what") or "").strip()[:200]
        if not what:
            continue
        status = it.get("status") or "unsure"
        if status not in ITEM_STATUS:
            problems["i%d_status" % i] = _("Choose one of the answers.")
        items.append({"n": i, "what": what, "who": str(it.get("who") or "").strip()[:100], "period": str(it.get("period") or "").strip()[:100], "status": status})
    f["items"] = items
    ticks = body.get("checks") or []
    if not isinstance(ticks, list):
        raise InputError({"checks": _("The ticks could not be read. Tick them again.")})
    f["checks"] = [k for k, _ in CHECKS if k in ticks]
    if problems:
        raise InputError(problems)
    return f



def _item_line(it, english=False):
    of, covering = ("for ", "covering ") if english else (_("for "), _("covering "))
    extra = ", ".join(x for x in (it["who"] and of + it["who"], it["period"] and covering + it["period"]) if x)
    return it["what"] + (" (" + extra + ")" if extra else "")


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    f = clean(raw, today)
    t = _rows("renewal", today, rules_dir)
    w = _rows("workrules", today, rules_dir)
    dates = []

    due = []

    def add(d, label, note, counts=False):
        left = (d - today).days
        if counts:
            due.append(left)
        dates.append({"date": d.isoformat(), "label": label, "note": note, "days_left": left,
                      "status": "passed" if left < 0 else ("today" if left == 0 else "upcoming")})
    if f["form_due"]:
        add(f["form_due"], _("Renewal form due"), _("The date printed on your renewal form. Aim to send it a few days early."), True)
    if f["proof_due"]:
        add(f["proof_due"], _("Proof due"), _("The date printed on the request for proof. It can be earlier than the form's date."), True)
    if f["coverage_ends"]:
        add(f["coverage_ends"], _("Coverage or benefits end"), _("If nothing is received by then, benefits can stop on this date."))
        if "medicaid" in f["programs"]:
            add(f["coverage_ends"] + dt.timedelta(days=t["medicaid_reconsider"]["days"]), _("Medicaid: last day to send the form without a new application"),
                _("Only if Medicaid ends because the form was not returned. Counted as 90 days after the end date, the federal minimum; your state may allow longer."))
    dates.sort(key=lambda x: x["date"])
    if f["form_due"] and f["proof_due"] and f["form_due"] != f["proof_due"]:
        first = min(f["form_due"], f["proof_due"])
        two = _("Your notice has two different due dates. The earlier one is %s. Treat that as the date for everything, if you can.") % _long(first)
    else:
        two = None

    missing = [_item_line(it) for it in f["items"] if it["status"] == "get"]
    unsure = [_item_line(it) for it in f["items"] if it["status"] == "unsure"]
    have = [_item_line(it) for it in f["items"] if it["status"] == "have"]
    not_done = [_(text) for k, text in CHECKS if k not in f["checks"]]

    upcoming = [x for x in due if x >= 0]
    passed = [x for x in due if x < 0]
    if passed and not upcoming:
        headline = _("A due date on your notice has passed")
    elif missing or unsure:
        headline = _("1 item still to get or check") if len(missing) + len(unsure) == 1 else _("%d items still to get or check") % (len(missing) + len(unsure))
    elif not_done:
        headline = _("Check 1 thing before you send it") if len(not_done) == 1 else _("Check %d things before you send it") % len(not_done)
    else:
        headline = _("Your packet looks ready to send")

    how = _how(f, t)
    cover = _cover(f, *([_item_line(it, True) for it in f["items"] if it["status"] == status] for status in ("have", "get", "unsure")))
    questions = []
    if unsure:
        questions += [_("What exactly do you need for: %s?") % u for u in unsure]
    if missing:
        questions.append(_("I am still getting %s. Can I send the rest now and that item later, and by what date?") % ("; ".join(missing)))
    if passed:
        questions.append(_("The due date on my notice has passed. Can I still send my papers, and is my case still open?"))
    questions.append(_("Can you confirm you have received everything, and that nothing else is needed?"))

    rule_rows = [t["why"]]
    if "medicaid" in f["programs"]:
        rule_rows += [t["medicaid_auto"], t["medicaid_form"], t["medicaid_reconsider"]]
    if "snap" in f["programs"]:
        rule_rows.append(t["snap_proof"])
    if f["state"] == "FL":
        rule_rows.append(t["fl_ways"])
    return {
        "headline": headline, "dates": dates, "two_dates": two, "missing": missing, "unsure": unsure, "have": have,
        "checks_left": not_done, "checks_done": [_(text) for k, text in CHECKS if k in f["checks"]],
        "how": how, "cover": cover, "questions": questions,
        "hearing": {"plain": w["fl_hearing"]["plain"], "source": w["fl_hearing"]["source"]} if f["state"] == "FL" else None,
        "rules": _listed(rule_rows),
        "rules_as_of": _asof(rules_dir),
        "disclaimer": _note(_("This is a checklist made from what you entered. It was made by an independent tool, not by any government agency. Only the agency decides your renewal. Nothing you enter here is sent to the agency.")),
    }


def _how(f, t):
    fl = f["state"] == "FL"
    steps = {
        "online": [_("Log in to %s and choose the renewal or the upload for your case.") % ("MyACCESS (myaccess.myflfamilies.com)" if fl else _("your state's benefits account")),
                   _("Upload each item as its own file, named for what it is."),
                   _("Save or take a screenshot of the confirmation page, with its date and any number.")],
        "mail": [_("Send copies, never originals, to the address on your notice."),
                 _("Write your name and case number on each page."),
                 _("Pay for tracking or a certificate of mailing at the post office, and keep the receipt.")],
        "fax": ([_("Put the ACCESS Florida Fax/Scanning Cover Sheet first.") if fl else _("Put a cover sheet first, with your name, case number and the number of pages.")] +
                [_("Use the fax number on your notice."), _("Keep the fax confirmation page that shows the pages went through.")]),
        "in_person": [_("Take copies to %s.") % (_("a local DCF office or an ACCESS community partner") if fl else _("your local office")),
                      _("Ask for a dated receipt that lists what you handed in.")],
        "unsure": [_("Use the way your notice lists first. If you can, send it two ways (for example upload, and mail a copy), and keep proof of both.")],
    }[f["method"]]
    if fl and f["method"] != "online":
        steps.append(_("If something goes wrong, call DCF at %s and ask how else to send it.") % t["fl_ways"]["phone"])
    elif f["method"] == "online":
        steps.append(_("If the upload fails, use another way printed on your notice the same day, and write down what went wrong."))
    return steps


def _cover(f, have, missing, unsure):
    lines = ["RENEWAL PAPERS ENCLOSED", "", "Name: [your name]", "Case number: [from your notice]", "Date sent: [date]", "",
             "Programs: " + ", ".join({"medicaid": "Medicaid", "snap": "SNAP (food assistance)"}[p] for p in f["programs"]), ""]
    if have:
        lines.append("Enclosed:")
        lines += ["- " + x for x in have]
    if missing or unsure:
        lines.append("")
        lines.append("Still to come (I will send these as soon as I have them):")
        lines += ["- " + x for x in missing + unsure]
    lines += ["", "Total pages including this one: ____", "", "Please contact me if anything else is needed. Phone: [your phone]"]
    return "\n".join(lines)
