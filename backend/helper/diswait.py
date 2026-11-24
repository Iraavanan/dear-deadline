"""My disability case is taking too long. From the stage the case is at and the person's
situation, this lists the 'critical case' categories that may fit (Social Security's own
words), drafts a request to mark the case, and drafts a note to a member of Congress's office.

It never says a case will be sped up or approved. Nothing is stored.
"""

import datetime as dt

from . import rules
from .i18n import _, as_of as _asof, english_date as _eng, listed as _listed, long_date as _long, note as _note, rows as _rows, tr as _tr
from .validate import InputError, _parse_date, as_mapping

STAGES = ("initial", "recon", "hearing")
STAGE_NAMES = {"initial": "first application", "recon": "reconsideration", "hearing": "hearing"}
FILED = {"initial": "application", "recon": "request for reconsideration", "hearing": "request for a hearing"}
WHERE = {"initial": "[your local Social Security office address, or the DDS address on your letters]",
         "recon": "[your local Social Security office address, or the DDS address on your letters]",
         "hearing": "[the hearing office address or fax number on your hearing letters]"}
SITUATIONS = ("terminal", "va100", "military", "homeless", "no_food", "no_medicine", "no_utilities", "eviction", "danger")
NEEDS = {"no_food": "I do not have enough money for food.",
         "no_medicine": "I cannot pay for medicine or medical care I need.",
         "no_utilities": "I have no heat, water or electricity, or a shutoff notice.",
         "eviction": "I have an eviction or foreclosure notice."}
FITS = {"TERI": "Terminal illness", "VPAT": "Veteran rated 100% permanent and total", "MC/WW": "Military casualty or wounded warrior", "Homeless": "Homeless", "Dire need": "Dire need"}
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")



def clean(raw, today):
    body = as_mapping(raw, "stage", _("The details could not be read. Enter them again."))
    problems = {}
    stage = body.get("stage")
    if stage not in STAGES:
        problems["stage"] = _("Choose where your case is now.")
    sits = body.get("situations") or []
    if not isinstance(sits, list) or any(s not in SITUATIONS for s in sits):
        problems["situations"] = _("Choose from the list.")
        sits = []
    filed = None
    if body.get("filed") not in (None, ""):
        try:
            filed = _parse_date(body.get("filed"))
            if filed > today or filed < today - dt.timedelta(days=10 * 365):
                problems["filed"] = _("Check the date you filed or appealed.")
        except (TypeError, ValueError):
            problems["filed"] = _("Enter the date as month, day and year.")
    ssi = body.get("ssi")
    if ssi not in (True, False, None):
        problems["ssi"] = _("Choose yes, no or not sure.")
    if problems:
        raise InputError(problems)
    return {"stage": stage, "situations": [s for s in SITUATIONS if s in sits], "filed": filed, "ssi": ssi}


def run(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    t = _rows("diswait", today, rules_dir)
    f = clean(raw, today)
    s = set(f["situations"])
    fits = []
    if "terminal" in s:
        fits.append({"id": "TERI", "name": _(FITS["TERI"]), "bring": _("A doctor's letter or records about the illness.")})
    if "va100" in s:
        fits.append({"id": "VPAT", "name": _(FITS["VPAT"]), "bring": t["vapt"]["plain"]})
    if "military" in s:
        fits.append({"id": "MC/WW", "name": _(FITS["MC/WW"]), "bring": _("Proof the illness or injury happened on active duty on or after October 1, 2001.")})
    if "homeless" in s:
        fits.append({"id": "Homeless", "name": _(FITS["Homeless"]), "bring": t["homeless"]["plain"]})
    needs = [NEEDS[k] for k in ("no_food", "no_medicine", "no_utilities", "eviction") if k in s]
    if needs:
        fits.append({"id": "Dire need", "name": _(FITS["Dire need"]), "bring": _("Copies of any shutoff, eviction or past-due notices, if you have them. You do not need them to ask.")})
    used = [t["critical"]]
    steps = []
    if "danger" in s:
        steps.append(_("If you are thinking of harming yourself or someone else, call or text 988 now (Suicide and Crisis Lifeline). Tell Social Security too: this is one of its critical-case categories."))
    if fits:
        headline = _("Your case may fit 1 of Social Security's critical-case category") if len(fits) == 1 else _("Your case may fit %d of Social Security's critical-case categories") % len(fits)
        used.append(t["dire_need"] if needs else t["how"])
        if f["stage"] == "hearing":
            steps.append(_("Send the request below to the hearing office (fax is usually fastest) and call to confirm it arrived. Ask them to mark the case critical."))
        else:
            used.append(t["fo_dire_need"])
            steps.append(_("Call or visit your local Social Security office, or call the DDS examiner named on your letters. Ask them to mark the case critical. Then send the request below so it is on file."))
        used.append(t["how"])
    else:
        headline = _("Ways to ask about a slow disability case")
        steps.append(_("If your situation changes (no money for food, medicine or utilities, an eviction notice, losing your home, or a terminal diagnosis), you can ask Social Security to mark the case critical at any time."))
        used.append(t["critical"])
    if f["stage"] == "initial" and f["ssi"] is not False:
        used.append(t["ssi_advance"])
        steps.append(_("If you applied for SSI, ask the office whether presumptive disability or an emergency advance payment could apply to you."))
    steps.append(_("Send new medical records as you get them, and keep a list of what you sent and when."))
    used.append(t["congress"])
    steps.append(t["congress"]["plain"] + _(" Use the note below."))
    used.append(t["find_rep"])
    used.append(t["waits"])
    waited = None
    if f["filed"]:
        waited = (today - f["filed"]).days
    return {
        "stage": f["stage"], "stage_name": _(STAGE_NAMES[f["stage"]]), "headline": headline, "fits": fits,
        "days_waiting": waited, "steps": steps,
        "letter": _letter(f, fits, needs) if fits else None, "congress": _congress(f),
        "rules": _listed(_unique(used)),
        "rules_as_of": _asof(rules_dir),
        "disclaimer": _note(_("This shows which of Social Security's critical-case categories your answers may fit. Social Security decides whether to mark a case, and marking it does not decide the claim. This is an independent tool, not a government agency, and not legal advice.")),
    }


def _unique(rows):
    seen, out = set(), []
    for r in rows:
        if r["id"] not in seen:
            seen.add(r["id"])
            out.append(r)
    return out


def _letter(f, fits, needs):
    filed = _eng(f["filed"]) if f["filed"] else "[date]"
    lines = ["To: " + WHERE[f["stage"]], "Date: [today's date]", "Name: [your name]",
             "Claim number: [from your letters]", "",
             "Re: Request to mark my disability %s as a critical case" % STAGE_NAMES[f["stage"]], "",
             "My disability %s was filed on %s and is still waiting. I am asking you to mark my case critical and handle it first, because:" % (FILED[f["stage"]], filed), ""]
    for x in fits:
        if x["id"] == "Dire need":
            lines.append("- Dire need:")
            lines += ["    " + n for n in needs]
        else:
            lines.append("- %s. [Add one line about your situation.]" % FITS[x["id"]])
    lines += ["", "I have attached: [any notices or records].", "",
              "Phone: [your phone number]", "", "Signature: ____________________"]
    return "\n".join(lines)


def _congress(f):
    filed = _eng(f["filed"]) if f["filed"] else "[date]"
    return "\n".join([
        "To: The office of [your U.S. representative or senator], caseworker for Social Security", "Date: [today's date]", "",
        "Re: Request for help with a delayed Social Security disability case", "",
        "My name is [your name] and I live at [your address]. My disability %s was filed on %s and has not been decided." % (FILED[f["stage"]], filed),
        "[One or two lines about why the wait is causing hardship.]", "",
        "Could your office ask Social Security about the status of my case? I will sign your office's privacy release form.", "",
        "Phone: [your phone number]   Email: [your email]", "", "Signature: ____________________"])
