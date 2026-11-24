"""Spanish for helpers written once, in English.

A helper marks each sentence a reader sees with _("..."). In English _ returns the sentence unchanged. In
Spanish it returns the translation from es_glue.json, where every Spanish sentence is stored under the
English one it translates, so a reworded English sentence shows in English (and fails tests/test_es.py)
until it is translated again. Rule rows come from es_text.json in the same way. Dates and figures are
never translated: they are the same values in both languages.
"""

import contextvars
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
    out = {}
    for rid, row in found.items():
        entry = RULES.get("%s/%s/plain" % (table, rid))
        out[rid] = dict(row, plain=entry["es"]) if entry and entry["en"] == row.get("plain") else row
    return out


def long_date(d):
    return "%d de %s de %d" % (d.day, MESES[d.month - 1], d.year) if es() else "%s %d, %d" % (MONTHS[d.month - 1], d.day, d.year)


def english_date(d):
    """For letters to an agency, which stay in English in both languages."""
    return "%s %d, %d" % (MONTHS[d.month - 1], d.day, d.year)


def month_name(d):
    return "%s de %d" % (MESES[d.month - 1], d.year) if es() else "%s %d" % (MONTHS[d.month - 1], d.year)


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


def spanish(fn):
    """The same helper, answering in Spanish."""
    @functools.wraps(fn)
    def run(raw, today=None, rules_dir=None):
        token = LANG.set("es")
        try:
            return fn(raw, today=today, rules_dir=rules_dir)
        except InputError as err:
            known = set(GLUE.values())
            raise InputError({k: v if v in known else GLUE.get(v, "Revise esta respuesta.") for k, v in err.problems.items()})
        finally:
            LANG.reset(token)
    return run


def _tools():
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
