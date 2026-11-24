"""Spanish for helpers written once, in English.

A helper marks each sentence a reader sees with _("..."). In English _ returns the sentence unchanged. In
Spanish it returns the translation from es_glue.json, where every Spanish sentence is stored under the
English one it translates, so a reworded English sentence shows in English (and fails tests/test_es.py)
until it is translated again. Rule rows come from es_text.json in the same way. Dates and figures are
never translated: they are the same values in both languages.
"""

import contextvars
import copy
import datetime as dt
import functools
import json
from pathlib import Path

from . import rules
from .validate import InputError

HERE = Path(__file__).parent
LANG = contextvars.ContextVar("helper_lang", default="en")
GLUE = json.loads((HERE / "es_glue.json").read_text(encoding="utf-8"))
RULES = json.loads((HERE / "es_text.json").read_text(encoding="utf-8"))
SPANISH = {v["es"] for v in RULES.values()}
BY_EN = {v["en"]: v["es"] for v in RULES.values()}
DIAS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre")
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
AVISO = (" Esta herramienta es independiente. No es una agencia del gobierno y no da consejos legales. La traducción al español todavía no ha sido "
         "revisada por un traductor profesional: si algo no está claro, use la fecha y las instrucciones impresas en su carta.")
INDEPENDENT = " This is an independent tool, not a government agency, and not legal advice."


def es():
    return LANG.get() == "es"


def _(sentence):
    return GLUE.get(sentence, sentence) if es() else sentence


def rows(table, on, rules_dir=None):
    """rules.rows_as_of, with each row's sentence in Spanish when the helper is running in Spanish."""
    found = rules.rows_as_of(table, on, rules_dir)
    if not es():
        return found
    return {rid: dict(row, plain=BY_EN[row["plain"]]) if row.get("plain") in BY_EN else row for rid, row in found.items()}


def long_date(d):
    return "%d de %s de %d" % (d.day, MESES[d.month - 1], d.year) if es() else "%s %d, %d" % (MONTHS[d.month - 1], d.day, d.year)


def english_date(d):
    """For letters to an agency, which stay in English in both languages."""
    return "%s %d, %d" % (MONTHS[d.month - 1], d.day, d.year)


def weekday(d):
    return (DIAS if es() else DAYS)[d.weekday()]


def month_name(d):
    return "%s de %d" % (MESES[d.month - 1], d.year) if es() else "%s %d" % (MONTHS[d.month - 1], d.year)


NO_REVISADA = (" La traducción al español todavía no ha sido revisada por un traductor profesional: si algo no está claro, use la fecha y las instrucciones "
               "impresas en su carta.")


def tr(text):
    """A sentence taken from a rule row, in Spanish when there is a translation for exactly that sentence."""
    return BY_EN.get(text, text) if es() else text


def listed(used):
    """The rules behind an answer, for helpers that list them without removing repeats."""
    return [dict({"plain": r["plain"], "source": r["source"]}, **({"lang": "en"} if es() and r["plain"] not in SPANISH else {})) for r in used]


def as_of(rules_dir=None):
    day = rules.rules_checked_as_of(rules_dir)
    return long_date(dt.date.fromisoformat(day)) if es() else day


def note(text):
    """A helper's closing note. In Spanish it also says the translation has not been reviewed."""
    return text + NO_REVISADA if es() else text


def finish(out, used, rules_dir, disclaimer):
    """The same ending as fixes._done, in the language the helper is running in."""
    seen, listed = set(), []
    for r in used:
        key = (r["id"], r["source"])
        if key not in seen:
            seen.add(key)
            listed.append(dict({"plain": r["plain"], "source": r["source"]}, **({"lang": "en"} if es() and r["plain"] not in SPANISH else {})))
    out["rules"] = listed
    day = rules.rules_checked_as_of(rules_dir)
    out["rules_as_of"] = long_date(dt.date.fromisoformat(day)) if es() else day
    out["disclaimer"] = disclaimer + (AVISO if es() else INDEPENDENT)
    return out


def _restore(sp, en, keys):
    """Copy the named keys, at any depth, from the English answer into the Spanish one."""
    if isinstance(sp, dict) and isinstance(en, dict):
        for k in sp:
            if k in keys and k in en:
                sp[k] = en[k]
            elif k in en:
                _restore(sp[k], en[k], keys)
    elif isinstance(sp, list) and isinstance(en, list) and len(sp) == len(en):
        for a, b in zip(sp, en):
            _restore(a, b, keys)


def spanish(fn, english=()):
    """The same helper, answering in Spanish. Keys named in `english` hold papers for an agency: they are taken from the English answer."""
    @functools.wraps(fn)
    def run(raw, today=None, rules_dir=None):
        token = LANG.set("es")
        try:
            out = fn(copy.deepcopy(raw), today=today, rules_dir=rules_dir)
            if english:
                again = LANG.set("en")
                try:
                    _restore(out, fn(copy.deepcopy(raw), today=today, rules_dir=rules_dir), english)
                finally:
                    LANG.reset(again)
            return out
        except InputError as err:
            raise InputError({k: GLUE.get(v, v) for k, v in err.problems.items()})
        finally:
            LANG.reset(token)
    return run


def _tools():
    from . import fixes, morehelp, ssalife, ssamore
    more = {"medicare-costs": fixes.msp, "stolen-snap": fixes.stolen, "locked-out": fixes.lockout, "ssa-call": fixes.ssacall, "withholding": fixes.withhold, "paperwork": fixes.procedural,
            "late-appeal": ssamore.latefiling, "payment-missing": ssamore.payday, "offset": ssamore.offset, "irmaa": ssamore.irmaa,
            "after-death": ssalife.died, "reinstate": ssalife.reinstate, "ssi-help": ssalife.ssihelp, "amount-changed": ssalife.changed}
    from . import diswait, noticecheck, planappeal, ssilimit, utility
    more.update({"ssi-limit": ssilimit.run, "plan-appeal": planappeal.run, "disability-wait": diswait.run, "utility": utility.run, "notice-check": noticecheck.run})
    from . import reporting
    more["report-change"] = reporting.run
    from . import renewal
    more["renewal"] = renewal.run
    from . import rent
    special = {"rent-check": spanish(rent.run, english=("letter",)), "rent-change": spanish(rent.compare, english=("letter",))}
    from . import workrules
    special.update({"work-rules": spanish(workrules.run, english=("letter",)), "missed-interview": spanish(workrules.interview)})
    from . import work
    special["work-check"] = spanish(lambda raw, today=None, rules_dir=None: work.run(raw, rules_dir=rules_dir))
    return dict({k: spanish(v) for k, v in more.items()}, **dict(special, **_first()))


def _first():
    from . import morehelp
    return {"va-debt": spanish(morehelp.vadebt), "disability-review": spanish(morehelp.cdr), "ra-overpayment": spanish(morehelp.raover),
            "voucher-ending": spanish(morehelp.voucher), "estate-recovery": spanish(morehelp.estate), "partb-late": spanish(morehelp.partb),
            "fairness-act": spanish(morehelp.fairness)}


class _Lazy(dict):
    """Filled on first use, because the helpers import this module."""
    def get(self, key, default=None):
        if not self:
            self.update(_tools())
        return dict.get(self, key, default)


TOOLS = _Lazy()
