"""Spanish versions of five helpers: step by step, with the same dates and figures as the English ones.

Nothing is worked out here. Each function calls the English helper's own code for the dates and
figures, then writes the result in Spanish from the ids and numbers that come back, never by
translating a finished English sentence. Rule text shown in Spanish comes from es_text.json, where
every Spanish sentence sits beside the English rule it translates; if the English rule has changed
since, the English is shown instead (and tests/test_es.py fails until it is translated again).

The Spanish has not yet been checked by a fluent reviewer, and every page says so. Names of official
forms and letters to an agency stay in English, because that is how they appear on the person's papers.
"""

import datetime as dt
import json
from pathlib import Path

from . import cessation as cess
from . import deadlines, denial as den, hearing as hear, morehelp, rules
from .validate import InputError, _parse_date, as_mapping

MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre")
TEXT = json.loads((Path(__file__).with_name("es_text.json")).read_text(encoding="utf-8"))
AVISO = "Esta herramienta es independiente. No es una agencia del gobierno y no da consejos legales. La traducción al español todavía no ha sido revisada por un traductor profesional: si algo no está claro, use la fecha y las instrucciones impresas en su carta."
AYUDA = {"texto": "Las oficinas de ayuda legal (legal aid) ayudan con estos casos, por lo general sin costo si sus ingresos son bajos.",
         "enlace": "https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help"}
SSA = "Seguro Social: 1-800-772-1213 (TTY 1-800-325-0778). Puede pedir un intérprete gratis."
NO_LEIDO = "No se pudieron leer los datos. Escríbalos otra vez."


def fecha(d):
    if isinstance(d, str):
        d = dt.date.fromisoformat(d)
    return "%d de %s de %d" % (d.day, MESES[d.month - 1], d.year)


def regla(tabla, rid, today, rules_dir=None, campo="plain"):
    """A rule row in Spanish, with its source. Falls back to the English text if the rule has changed since it was translated."""
    row = rules.rows_as_of(tabla, today, rules_dir)[rid]
    entry = TEXT.get("%s/%s/%s" % (tabla, rid, campo))
    actual = row.get(campo) or ""
    if entry and entry["en"] == actual:
        return {"texto": entry["es"], "fuente": row["source"], "idioma": "es"}
    return {"texto": actual, "fuente": row["source"], "idioma": "en"}


def _fecha_carta(body, campo, p, today, falta="Escriba la fecha impresa en la carta.", atras=None):
    try:
        d = _parse_date(body.get(campo))
    except (TypeError, ValueError):
        p[campo] = falta
        return None
    if d > today:
        p[campo] = "Esa fecha está en el futuro. Revise la fecha impresa en la carta."
    elif d.year < 2000 or (atras and d < today - dt.timedelta(days=atras)):
        p[campo] = "Esa fecha parece demasiado antigua. Revise el año."
    return d


def _elige(body, campo, opciones, p, falta="Elija una de las respuestas."):
    v = body.get(campo)
    if v not in opciones:
        p[campo] = falta
        return None
    return v


def _fila(item, etiqueta, nota=None):
    return {"id": item["id"], "etiqueta": etiqueta, "fecha": item["date"], "fecha_larga": fecha(item["date"]), "dias": item["days_left"], "estado": item["status"], "nota": nota}


def _hecho(out, reglas, today, rules_dir):
    vistas, lista = set(), []
    for r in reglas:
        if r and (r["texto"], r["fuente"]) not in vistas:
            vistas.add((r["texto"], r["fuente"]))
            lista.append(r)
    out.update(reglas=lista, reglas_al=fecha(rules.rules_checked_as_of(rules_dir)), aviso=AVISO, ayuda=AYUDA)
    return out


ETIQUETAS = {
    "collection_protection": ("Pida una apelación o una exención antes de esta fecha para que no le cobren mientras deciden", "30 días, contados desde la fecha impresa en la carta."),
    "appeal": ("Apele antes de esta fecha", "60 días, contados desde la fecha impresa en la carta, que es la lectura más prudente."),
    "appeal_latest": ("Última fecha para apelar si la carta tardó 5 días en llegar", "No apunte a esta fecha. Úsela solo si la fecha anterior ya pasó."),
    "continuation_aim": ("Entregue su decisión sobre seguir recibiendo beneficios antes de", "Esta es la fecha a la que debe apuntar."),
    "continuation_received_by": ("El Seguro Social debe tenerla a más tardar el", "Es una fecha de recibo. Entréguela en persona o envíela por fax; no confíe en el correo."),
}


def _fechas(items):
    return [_fila(i, *ETIQUETAS[i["id"]]) for i in items if i["id"] in ETIQUETAS]


# ---------------------------------------------------------------- pago en exceso del Seguro Social

def sobrepago(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    body = as_mapping(raw, "notice_date", NO_LEIDO)
    p = {}
    aviso = _fecha_carta(body, "notice_date", p, today)
    if p:
        raise InputError(p)
    d = deadlines.compute(aviso, today, rules_dir)
    est = {i["id"]: i["status"] for i in d["items"]}
    filas = _fechas(d["items"])
    if est["appeal_latest"] == "passed":
        titular = "Las fechas para apelar ya pasaron, pero todavía hay cosas que puede pedir"
        consejo = "Las fechas para apelar ya pasaron. El Seguro Social puede aceptar una apelación tardía si usted tuvo una buena razón: pídalo por escrito y explique la razón. Una exención (waiver) se puede pedir en cualquier momento."
    elif est["appeal"] == "passed":
        titular = "Apele cuanto antes: la fecha prudente ya pasó"
        consejo = "La fecha prudente para apelar ya pasó, pero la fecha posterior todavía puede aplicar. Presente la apelación lo antes posible."
    elif est["collection_protection"] == "passed":
        titular = "Todavía puede apelar hasta el %s" % fecha(d["items"][1]["date"])
        consejo = "La fecha para detener el cobro ya pasó, pero todavía está a tiempo de apelar. Una exención (waiver) se puede pedir en cualquier momento."
    else:
        titular = "Pida algo antes del %s para que no le cobren mientras deciden" % fecha(d["items"][0]["date"])
        consejo = "Está dentro de todos los plazos. Si actúa antes de la primera fecha, también detiene el cobro."
    R = lambda t, i, c="plain": regla(t, i, today, rules_dir, c)
    opciones = []
    for rid, nombre in (("appeal", "Apelación"), ("waiver", "Exención (waiver)"), ("lower_rate", "Pago mensual más bajo")):
        row = rules.rows_as_of("requests", today, rules_dir)[rid]
        opciones.append({"id": rid, "nombre": nombre, "oficial": row["official_name"], "formulario": row["form"], "enlace": row["form_url"],
                         "cuando": R("requests", rid, "when")["texto"], "plazo": R("requests", rid, "time_limit")["texto"],
                         "telefono": R("requests", rid, "phone_note")["texto"] if row.get("phone_note") else None})
    pasos = ["Busque en la carta la cantidad, los meses que cubre y la razón. Si no entiende cómo calcularon la cantidad, pida al Seguro Social el registro de pagos mes por mes.",
             "Elija lo que va a pedir. Puede pedir más de una cosa: por ejemplo, apelar la cantidad y también pedir una exención.",
             "Llene el formulario en inglés, o pida ayuda para llenarlo. Guarde una copia de todo lo que envíe y una prueba de la fecha en que lo envió.",
             SSA]
    return _hecho({"titular": titular, "consejo": consejo, "fechas": filas, "opciones": opciones, "pasos": pasos, "herramienta": "overpayment"},
                  [R("deadlines", "collection_protection"), R("deadlines", "appeal"), R("deadlines", "mail_presumption"), R("deadlines", "weekend")], today, rules_dir)


# ---------------------------------------------------------------- me negaron un beneficio

NIVELES = {"reconsideration": "Reconsideración", "hearing": "Audiencia con un juez de derecho administrativo", "appeals_council": "Revisión del Consejo de Apelaciones",
           "federal_court": "Demanda civil en un tribunal federal de distrito"}
ETAPAS = ("initial", "reconsideration", "hearing", "appeals_council", "unknown")
SIGUIENTE = {"initial": "reconsideration", "reconsideration": "hearing", "hearing": "appeals_council", "appeals_council": "federal_court"}


def negado(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    body = as_mapping(raw, "notice_date", NO_LEIDO)
    p = {}
    aviso = _fecha_carta(body, "notice_date", p, today)
    etapa = _elige(body, "stage", ETAPAS, p)
    medico = body.get("medical") in (True, "yes")
    if p:
        raise InputError(p)
    out = den.run({"notice_date": aviso.isoformat(), "stage": etapa, "about": "medical" if medico else "unknown"}, {}, None, today=today, rules_dir=rules_dir)
    items = out["deadlines"]["items"]
    est = {i["id"]: i["status"] for i in items}
    R = lambda i: regla("denial", i, today, rules_dir)
    niveles = []
    for lv in out["levels"]:
        niveles.append({"id": lv["id"], "orden": lv["order"], "nombre": NIVELES[lv["id"]], "formulario": lv["form"], "enlace": lv["online"],
                        "texto": R("level_" + lv["id"])["texto"], "suyo": SIGUIENTE.get(etapa) == lv["id"]})
    sig = SIGUIENTE.get(etapa)
    if est["appeal_latest"] == "passed":
        titular = "Las fechas para apelar ya pasaron"
        consejo = R("late")["texto"]
    elif est["appeal"] == "passed":
        titular = "Apele cuanto antes: la fecha prudente ya pasó"
        consejo = "La fecha prudente para apelar ya pasó, pero la fecha posterior todavía puede aplicar. Presente la apelación lo antes posible."
    else:
        titular = "Apele antes del %s" % fecha(items[0]["date"])
        consejo = "Está dentro del plazo. Puede pedir la apelación antes de la fecha aunque hoy no esté seguro de todo."
    pasos = [("Su siguiente paso es: %s." % NIVELES[sig]) if sig else "Los cuatro pasos de apelación aparecen en orden. Su carta dice cuál es el suyo.",
             R("paper")["texto"], R("representative")["texto"], SSA]
    reglas = [R("appeal"), R("mail_presumption"), R("weekend"), R("late"), R("paper"), R("representative")]
    if medico and sig == "reconsideration":
        pasos.insert(1, R("medical_extra")["texto"])
        reglas.append(R("medical_extra"))
    return _hecho({"titular": titular, "consejo": consejo, "fechas": _fechas(items), "niveles": niveles, "pasos": pasos, "herramienta": "decision-appeal"}, reglas, today, rules_dir)


# ---------------------------------------------------------------- dicen que mi incapacidad terminó

def incapacidad(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    body = as_mapping(raw, "notice_date", NO_LEIDO)
    p = {}
    aviso = _fecha_carta(body, "notice_date", p, today)
    if p:
        raise InputError(p)
    tabla = rules.rows_as_of("cessation", aviso, rules_dir)
    d = cess.compute_dates(aviso, today, tabla)
    est = {i["id"]: i["status"] for i in d["items"]}
    R = lambda i: regla("cessation", i, today, rules_dir)
    consejos = []
    if est["continuation_received_by"] == "passed":
        titular = "La fecha para seguir recibiendo beneficios ya pasó, pero todavía puede apelar"
        consejos.append("La fecha para seguir recibiendo beneficios durante la apelación ya pasó. " + R("late_continuation")["texto"] + " Todavía puede apelar la decisión.")
    elif est["continuation_aim"] in ("passed", "today"):
        titular = "Si quiere seguir recibiendo beneficios, entregue el formulario SSA-792 ahora"
        consejos.append("La fecha a la que debía apuntar ya llegó o ya pasó, y la fecha final está cerca. Si quiere que los beneficios continúen, lleve el formulario SSA-792 a una oficina del Seguro Social o envíelo por fax ahora.")
    else:
        titular = "Primero decida, antes del %s, si quiere seguir recibiendo beneficios" % fecha(d["items"][0]["date"])
        consejos.append("Está dentro de todas las fechas. La decisión sobre seguir recibiendo beneficios va primero porque su plazo es el más corto.")
    if est["appeal_latest"] == "passed":
        consejos.append("Las fechas para apelar ya pasaron. " + R("late_appeal")["texto"] + " El Seguro Social puede aceptar una apelación tardía si usted tuvo una buena razón; explíquela al presentarla.")
    elif est["appeal"] == "passed":
        consejos.append("La fecha prudente para apelar ya pasó, pero la fecha posterior todavía puede aplicar. Presente la apelación lo antes posible.")
    dos_lados = {"seguir": "Si pide a tiempo que continúen, sus beneficios siguen llegando mientras se decide la apelación. Eso le protege si la decisión fue un error.",
                 "riesgo": R("repayment")["texto"]}
    formularios = [{"formulario": tabla["election_form"]["form"], "enlace": tabla["election_form"]["url"], "texto": R("election_form")["texto"]},
                   {"formulario": tabla["appeal_form"]["form"], "enlace": tabla["appeal_form"]["url"], "texto": R("appeal_form")["texto"]}]
    pasos = ["Decida si quiere que sus beneficios continúen durante la apelación. Lea los dos lados antes de decidir: esta herramienta no le dice qué elegir.",
             "Entregue el formulario SSA-792 en persona o por fax, y pida un recibo con la fecha.", "Presente la apelación con el formulario SSA-789 antes de la fecha de apelación.",
             R("evidence")["texto"], SSA]
    return _hecho({"titular": titular, "consejos": consejos, "fechas": _fechas(d["items"]), "dos_lados": dos_lados, "formularios": formularios, "pasos": pasos, "herramienta": "disability-ended"},
                  [R("continuation_received_by"), R("continuation_aim"), R("appeal"), R("mail_presumption"), R("weekend"), R("repayment"), R("late_continuation"), R("evidence")], today, rules_dir)


# ---------------------------------------------------------------- SNAP o Medicaid negado, reducido o quitado

PROGRAMA = {"snap": "SNAP (asistencia de alimentos)", "medicaid": "Medicaid"}
ESTADOS = {"FL": "Florida", "CA": "California", "NY": "Nueva York", "PA": "Pensilvania", "OH": "Ohio", "MI": "Míchigan"}


def audiencia(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    body = as_mapping(raw, "program", NO_LEIDO)
    try:
        out = hear.run({"program": body.get("program"), "action": body.get("action"), "state": body.get("state"), "notice_date": body.get("notice_date"),
                        "effective_date": body.get("effective_date"), "plan": body.get("plan") in (True, "yes")}, today=today, rules_dir=rules_dir)
    except InputError as err:
        es = {"program": "Elija el programa.", "action": "Elija lo que dice el aviso.", "state": "Elija el estado.", "notice_date": "Escriba la fecha impresa en el aviso. Revise que no sea futura ni demasiado antigua.",
              "effective_date": "Revise esta fecha: debe ser posterior a la fecha del aviso."}
        raise InputError({k: es.get(k, "Revise esta respuesta.") for k in err.problems})
    prog, accion, estado = body["program"], body["action"], body["state"]
    plan = body.get("plan") in (True, "yes")
    efectiva = body.get("effective_date")
    pack = rules.rows_as_of("medicaid_states", today, rules_dir).get(estado) if prog == "medicaid" and not plan else None
    R = lambda i: regla("hearing", i, today, rules_dir)
    filas, reglas = [], []
    for it in out["dates"]:
        if it["id"] == "keep":
            if pack and pack["keep"]["kind"] == "after_notice":
                nota = "%d días desde la fecha del aviso, según la regla de %s. Si su aviso da otra fecha, use la del aviso." % (pack["keep"]["days"], ESTADOS[estado])
            else:
                nota = "El día antes de que el cambio entre en vigor (%s). Es más seguro pedirla antes." % fecha(efectiva)
                reglas.append(R("snap_continue" if prog == "snap" else "medicaid_continue"))
            filas.append(_fila(it, "Pida la audiencia antes de esta fecha para que sus beneficios sigan igual mientras espera", nota))
        elif it["id"] == "restore":
            filas.append(_fila(it, "Si se le pasó esa fecha: pídala antes de esta y Medicaid puede restablecer la cobertura hasta la decisión", "Diez días después de la fecha del cambio. Depende de la agencia; no está garantizado."))
            reglas.append(R("medicaid_reinstate"))
        else:
            if estado == "FL":
                nota = "90 días desde la fecha del aviso (Notice of Case Action)."
                reglas += [R("fl_deadline"), R("fl_rule")]
            elif pack:
                nota = "%d días desde la fecha del aviso, según la regla de %s." % (pack["hearing_days"], ESTADOS[estado])
            else:
                nota = "90 días contados desde la fecha del aviso, según la regla federal de SNAP. Si el aviso de su estado da otra fecha, use la del aviso."
                reglas.append(R("snap_deadline"))
            filas.append(_fila(it, "Último día para pedir una audiencia imparcial (fair hearing)", nota))
    notas = []
    mantener = accion in ("reduced", "stopped")
    if prog == "medicaid" and plan:
        notas.append(R("fl_plan_first")["texto"] if estado == "FL" else "Cuando su plan de salud de Medicaid niega un servicio, por lo general primero se apela ante el plan. La carta de decisión del plan dice cuánto tiempo tiene después para pedir una audiencia estatal: use esa fecha.")
        if estado == "FL":
            reglas.append(R("fl_plan_first"))
    if mantener and not efectiva and not (pack and pack["keep"]["kind"] == "after_notice"):
        notas.append("Su aviso debe decir la fecha en que el cambio entra en vigor. Para que sus beneficios sigan igual mientras espera la audiencia, pídala antes de esa fecha.")
    if prog == "medicaid" and estado == "other":
        notas.append("Su estado fija el plazo para una audiencia de Medicaid, y su aviso debe decirlo. Esta herramienta no lo adivina: use la fecha de su aviso.")
    pendientes = [f for f in filas if f["estado"] != "passed"]
    titular = "Use la fecha de su aviso para pedir una audiencia" if not filas else "Las fechas calculadas a partir de su aviso ya pasaron" if not pendientes \
        else "Pida una audiencia antes del %s" % fecha(min(f["fecha"] for f in pendientes))
    dos_lados = None
    if mantener:
        dos_lados = {"seguir": "Si la pide a tiempo, su %s puede seguir igual hasta la decisión de la audiencia. Eso le protege si el cambio fue un error." % PROGRAMA[prog],
                     "riesgo": R("snap_repay" if prog == "snap" else "medicaid_repay")["texto"] + " En la solicitud puede decir que no quiere que los beneficios continúen."}
        reglas.append(R("snap_repay" if prog == "snap" else "medicaid_repay"))
    if prog == "snap":
        reglas.append(R("snap_decision"))
    contacto = R("fl_contact") if estado == "FL" else ({"texto": out["contact"]["plain"], "fuente": out["contact"]["source"], "idioma": "en"} if out["contact"] else None)
    pasos = ["Pida la audiencia por escrito o por teléfono, de la manera que indica su aviso, y anote la fecha y con quién habló.",
             "Pida una copia de su expediente y de las pruebas que usó la agencia.",
             "Puede usar la carta de abajo. Está en inglés porque así la lee la agencia: complete lo que está entre corchetes [ ]."]
    return _hecho({"titular": titular, "fechas": filas, "notas": notas, "dos_lados": dos_lados, "carta": out["letter"], "contacto": contacto, "pasos": pasos, "herramienta": "benefit-hearing"},
                  reglas + ([contacto] if contacto and contacto["idioma"] == "es" else []), today, rules_dir)


# ---------------------------------------------------------------- SNAP pagado de más

def snap(raw, today=None, rules_dir=None):
    today = today or dt.date.today()
    body = as_mapping(raw, "notice_date", NO_LEIDO)
    try:
        out = morehelp.snapclaim({"notice_date": body.get("notice_date"), "kind": body.get("kind"), "amount": body.get("amount"), "allotment": body.get("allotment")}, today=today, rules_dir=rules_dir)
    except InputError as err:
        es = {"notice_date": "Escriba la fecha impresa en la carta. Revise que no sea futura ni demasiado antigua.", "kind": "Elija lo que dice la carta, o \"No estoy seguro\".",
              "amount": "Escriba la cantidad en dólares.", "allotment": "Escriba la cantidad en dólares."}
        raise InputError({k: es.get(k, "Revise esta respuesta.") for k in err.problems})
    R = lambda i: regla("snapclaim", i, today, rules_dir)
    pago, aud = out["dates"]
    filas = [{"id": "due", "etiqueta": "Pague o haga un acuerdo de pago antes de la fecha de su carta. Según la regla federal, esa fecha no es posterior al", "fecha": pago["date"], "fecha_larga": fecha(pago["date"]),
              "dias": pago["days_left"], "estado": "passed" if pago["passed"] else "upcoming", "nota": None},
             {"id": "hearing", "etiqueta": "Pida una audiencia imparcial (fair hearing) antes del", "fecha": aud["date"], "fecha_larga": fecha(aud["date"]), "dias": aud["days_left"],
              "estado": "passed" if aud["passed"] else "upcoming", "nota": "90 días, contados desde la fecha de la carta. Si su carta da otra fecha, use la de la carta."}]
    tasa = None
    if out["rate"]:
        tasa = [{"tipo": "una violación intencional del programa" if "intentional" in r["claim"] else "un error del hogar o de la agencia", "mensual": r["monthly"], "meses": r["months"]} for r in out["rate"]]
    titular = ("Tiene hasta el %s para pedir una audiencia sobre el pago de más de SNAP" % fecha(aud["date"])) if not aud["passed"] else "Los 90 días para pedir una audiencia terminaron el %s" % fecha(aud["date"])
    pasos = []
    if aud["passed"]:
        pasos.append("Los 90 días ya pasaron, contando desde la fecha que escribió. Todavía puede pedir los registros, un acuerdo de pago y que reduzcan la cantidad, y preguntar a la oficina si aceptan una solicitud de audiencia tardía.")
    pasos.append("Pida por escrito, a la oficina que aparece en la carta, los registros y el cálculo mes por mes. " + R("inspect")["texto"])
    if out["kind"] == "agency":
        pasos.append("Un error de la agencia sigue siendo un reclamo según las reglas federales, aunque el error no fue suyo. Diga en su solicitud que el error fue de la agencia y pregunte si pueden reducir la cantidad.")
    if out["kind"] == "ipv":
        pasos.append("Un reclamo por violación intencional del programa es serio. Antes de firmar o aceptar algo, trate de hablar con una oficina de ayuda legal.")
    pasos += ["Si cree que la cantidad o la razón está mal, pida una audiencia imparcial antes del %s. Pídala por escrito y guarde una copia con la fecha." % fecha(aud["date"]),
              R("file")["texto"],
              "Si la cantidad es correcta pero no puede pagarla de una vez, pida un acuerdo de pago antes de la fecha de pago. " + R("agreement")["texto"],
              "Si no podría pagarla en tres años, dígalo y pida al estado que reduzca el reclamo. " + R("compromise")["texto"],
              R("delinquent")["texto"] + " " + R("offset")["texto"]]
    reglas = [R("types"), R("hearing"), R("due"), R("inspect"), R("file"), R("agreement"), R("compromise"), R("delinquent"), R("offset"), R("decision")]
    if tasa:
        reglas += [R("reduce_mistake")] if out["kind"] in ("mistake", "agency") else [R("reduce_ipv")] if out["kind"] == "ipv" else [R("reduce_mistake"), R("reduce_ipv")]
    return _hecho({"titular": titular, "fechas": filas, "tasa": tasa, "pasos": pasos, "carta": out["words"], "herramienta": "snap-overpayment"}, reglas, today, rules_dir)
