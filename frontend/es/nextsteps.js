/* Built by tools/make_es_js.py from frontend/nextsteps.js. Do not edit: change the English file or tools/es_js_text.py. */
/* Four helpers for what comes after a letter, all run on this device:

   - permission:  can a family member or helper talk to the agency for me?
   - hearingPrep: my hearing is scheduled; which papers answer what the agency said?
   - decision:    I won my hearing; why is my benefit still the same? (SNAP or Medicaid)
   - medicaidEnd: my Medicaid is ending; what about each person in my household? (Florida first)

   Each function takes the person's answers, today's date and the rule rows from /api/meta, and
   returns a result or throws {problems}. Nothing typed here is sent to the site. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NextSteps = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function day(iso) { var p = iso.split("-").map(Number); return Date.UTC(p[0], p[1] - 1, p[2]) / 864e5; }
  function iso(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
  function say(s) { var p = s.split("-").map(Number); return p[2] + " de " + MONTHS[p[1] - 1] + " de " + p[0]; }
  function okDate(v) {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    var p = v.split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
  }
  function src(r) { return { plain: r.plain, source: r.source }; }
  function txt(v, n) { return String(v || "").trim().slice(0, n); }
  var INDEPENDENT = " Esta herramienta es independiente. No es una agencia del gobierno y no da consejos legales. La traducción al español todavía no ha sido revisada por un traductor profesional.";

  /* ---------- Permission for a helper ---------- */
  var PROGRAMS = { ssa: "Seguro Social o SSI", medicare: "Medicare (1-800-MEDICARE)", fl_snap: "SNAP de Florida (asistencia de alimentos)", fl_medicaid: "Medicaid de Florida" };
  function permission(raw, today, t) {
    var p = {}, progs = (raw && Array.isArray(raw.programs) ? raw.programs : []).filter(function (x) { return PROGRAMS[x]; });
    if (!progs.length) p.programs = "Elija por lo menos un programa.";
    var role = raw && raw.role;
    if (["prepare", "talk", "act"].indexOf(role) < 0) p.role = "Elija lo que hará la persona que le ayuda.";
    if (Object.keys(p).length) throw { problems: p };
    var helper = txt(raw.helper, 60) || "la persona que me ayuda", used = [t.prepare], rows = [];
    progs.forEach(function (k) {
      var r;
      if (role === "prepare") { rows.push({ program: PROGRAMS[k], form: "No hace falta ningún formulario", does: "Ayudarle a leer, llenar, copiar y enviar papeles, y acompañarle en una llamada mientras usted habla.", signs: "Nadie" }); return; }
      if (k === "ssa") {
        r = role === "act" ? t.ssa_rep : t.ssa_release;
        rows.push({ program: PROGRAMS[k], form: r.form, form_url: r.form_url, does: r.plain, signs: "Usted, con su propia firma a mano" + (role === "act" ? ", y " + helper + " como representante" : "") + ". Un tutor legal puede firmar por el adulto del que es tutor." });
        used.push(r, t.ssa_sign);
      } else if (k === "medicare") {
        r = t.medicare; rows.push({ program: PROGRAMS[k], form: r.form, form_url: r.form_url, does: r.plain + (role === "act" ? " Para una apelación de Medicare, el aviso de apelación dice cómo nombrar a un representante." : ""), signs: "Usted, la persona que tiene Medicare" });
        used.push(r);
      } else if (k === "fl_snap") {
        r = t.fl_rep; rows.push({ program: PROGRAMS[k], form: r.form, form_url: r.source, does: r.plain, signs: "Usted, como jefe del hogar, y " + helper });
        used.push(r);
      } else {
        r = t.fl_disclose; rows.push({ program: PROGRAMS[k], form: r.form, form_url: r.source, does: r.plain, signs: "Usted, la persona que tiene Medicaid" });
        used.push(r);
      }
    });
    var card = ["HELPER NOTE", "", "Name: [your name]", "My helper: " + helper + ", phone [their phone]", ""].concat(rows.map(function (r) { return "- " + r.program + ": " + r.form; }))
      .concat(["", "If an agency asks, I am on the call and agree that " + helper + " may speak with you for me today.", "", "Signature: ____________________   Date: ________"]).join("\n");
    return { headline: role === "prepare" ? "Para ese tipo de ayuda no hace falta ningún formulario" : "El formulario de cada programa, y quién lo firma", rows: rows, card: card,
      rules: used.filter(function (r, i, a) { return r && a.indexOf(r) === i; }).map(src),
      disclaimer: "Las agencias deciden lo que aceptan. Revise las instrucciones del propio formulario antes de enviarlo." + INDEPENDENT };
  }

  /* ---------- Hearing evidence outline ---------- */
  function hearingPrep(raw, today, t) {
    var p = {}, program = raw && raw.program;
    if (["snap", "medicaid"].indexOf(program) < 0) p.program = "Elija SNAP o Medicaid.";
    var date = raw && raw.hearing_date;
    if (date && !okDate(date)) p.hearing_date = "Revise la fecha de la audiencia.";
    var points = (raw && Array.isArray(raw.points) ? raw.points : []).map(function (x) {
      return { says: txt(x && x.says, 300), page: txt(x && x.page, 40), mine: txt(x && x.mine, 300), ask: txt(x && x.ask, 300) };
    }).filter(function (x) { return x.says; }).slice(0, 12);
    if (!points.length) p["points.0.says"] = "Escriba por lo menos una cosa que dice la agencia.";
    if (Object.keys(p).length) throw { problems: p };
    var left = date ? day(date) - day(today) : null, gaps = [];
    points.forEach(function (x, i) {
      if (!x.mine) gaps.push("Punto " + (i + 1) + ": todavía no tiene ninguna prueba suya.");
      if (!x.page) gaps.push("Punto " + (i + 1) + ": no tiene ninguna página del expediente del caso. Pida el expediente si no lo ha visto.");
    });
    var out = ["ESQUEMA PARA LA AUDIENCIA", "", "Programa: " + (program === "snap" ? "SNAP" : "Medicaid") + (date ? "   Audiencia: " + say(date) : ""), "Número de caso: [el de su aviso]", "",
      "Lo que pido: [una oración, por ejemplo: que restablezcan mis beneficios desde la fecha en que se detuvieron]", ""];
    points.forEach(function (x, i) {
      out.push((i + 1) + ". La agencia dice: " + x.says + (x.page ? " (expediente del caso, " + x.page + ")" : ""));
      out.push("   Mi respuesta y mis pruebas: " + (x.mine || "[agregar]"));
      if (x.ask) out.push("   Pregunta que voy a hacer: " + x.ask);
      out.push("");
    });
    out.push("Testigos: [nombres, o ninguno]", "Documentos que envié antes: [lista, con la fecha de envío]", "", "Al final: pregunte cuándo llegará la decisión y cómo la recibirá.");
    var r = program === "snap" ? [t.snap_file, t.snap_rights] : [t.medicaid_rights];
    return { headline: left === null ? "Su esquema para la audiencia" : (left < 0 ? "La fecha de la audiencia ya pasó" : (left === 1 ? "Falta 1 día para su audiencia" : "Faltan " + left + " días para su audiencia")), outline: out.join("\n"), gaps: gaps,
      steps: ["Pida a la agencia una copia del expediente de su caso y de los documentos que va a usar, si todavía no los tiene.", "Envíe copias de sus pruebas a la oficina de audiencias antes de la audiencia, si el aviso dice cómo, y guarde los originales.",
        "Tenga este esquema delante durante la llamada. Hable de un punto a la vez."],
      rules: r.map(src), disclaimer: "Esto organiza lo que usted escribe. No evalúa su caso." + INDEPENDENT };
  }

  /* ---------- After a hearing decision ---------- */
  function decision(raw, today, t, fl) {
    var p = {}, program = raw && raw.program, order = raw && raw.order, since = raw && raw.since;
    if (["snap", "medicaid"].indexOf(program) < 0) p.program = "Elija SNAP o Medicaid.";
    if (["increase", "redo", "other"].indexOf(order) < 0) p.order = "Elija lo que ordena la decisión.";
    if (["nothing", "new_notice", "part"].indexOf(since) < 0) p.since = "Elija lo que ha pasado desde entonces.";
    if (!okDate(raw && raw.received)) p.received = "Escriba la fecha en que recibió la decisión.";
    else if (raw.received > today) p.received = "Revise la fecha.";
    if (Object.keys(p).length) throw { problems: p };
    var words = txt(raw.words, 600), got = raw.received, steps = [], used = [], due = null, late = false;
    if (program === "snap" && order === "increase") {
      due = iso(day(got) + t.snap_increase.days);
      late = day(today) > day(due);
      used.push(t.snap_increase, t.snap_lost);
      steps.push(late ? "Han pasado más de 10 días desde el " + say(got) + ". Revise el historial de su cuenta EBT para ver si hay un pago suplementario. Si no está, comuníquese ahora con el estado y envíe la carta de abajo." :
        "Vigile su cuenta EBT hasta el " + say(due) + ". El estado puede usar en su lugar su fecha normal de pago, si esa fecha está dentro de los 60 días de su solicitud de audiencia.");
    } else if (program === "medicaid" && order === "increase") {
      used.push(t.medicaid_fix);
      steps.push("La agencia debe actuar sin demora y pagar desde la fecha de la acción equivocada. Revise que la cobertura aparezca otra vez como activa, y que se estén pagando las facturas de ese tiempo.");
    } else if (order === "redo") {
      used.push(program === "snap" ? t.snap_time : t.medicaid_time);
      steps.push("Una decisión que devuelve el caso significa que la agencia debe revisarlo otra vez y enviarle un aviso nuevo. Esté pendiente. Cuando llegue, compárelo con lo que dice la decisión de la audiencia, y anote su propia fecha para apelar.");
    } else {
      steps.push("Lea la parte de la decisión que dice lo que la agencia debe hacer. Copie esa oración en la casilla de abajo para que entre en su carta.");
    }
    if (since === "new_notice") steps.push("Ponga el aviso nuevo al lado de la decisión de la audiencia. Revise que haga lo que ordenó la decisión, para los meses correctos y las personas correctas.");
    if (since === "part") steps.push("Anote lo que cambió y lo que no, con fechas. Pida el resto por escrito, citando la decisión.");
    if (since === "nothing" || since === "part") steps.push(fl ? "En Florida, comuníquese con su oficina del DCF o con el centro de llamadas, y si no pasa nada, con la Appeal Hearings Section que emitió la decisión." : "Comuníquese con la oficina que maneja su caso, y si no pasa nada, con la oficina de audiencias que emitió la decisión.");
    var letter = ["To: [your " + (program === "snap" ? "SNAP" : "Medicaid") + " office]" + (fl ? ", copy to the Appeal Hearings Section" : ""), "Date: [today's date]", "Name: [your name]", "Case number: [from the decision]", "",
      "Re: Carrying out the hearing decision I received on " + say(got), "",
      "The hearing decision says:", words ? "\"" + words + "\"" : "[copy the sentence that says what the agency must do]", "",
      since === "nothing" ? "As of today, nothing has changed on my case." : (since === "part" ? "Only part of this has been done: [what changed, and what has not]." : "I received a new notice dated [date]. It does not match the decision because [reason]."),
      "Please carry out the decision and send me a written notice showing what was done, for which months." + (program === "snap" && order === "increase" ? " Federal rules require an increase to reach my EBT account within 10 days of the state receiving the decision (7 CFR 273.15(c)(1))." : ""),
      "", "Phone: [your phone]", "", "Signature: ____________________"].join("\n");
    var contact = fl && t.fl_contact ? { plain: t.fl_contact.plain, source: t.fl_contact.source } : null;
    return { headline: due ? (late ? "Los 10 días terminaron el " + say(due) : "Espere el aumento a más tardar el " + say(due)) : "Revise que la decisión se cumpla",
      due: due, late: late, steps: steps, letter: letter, contact: contact, rules: used.map(src),
      disclaimer: "Esto se basa en la fecha y las palabras que usted escribió. La decisión misma dice lo que se debe hacer." + INDEPENDENT };
  }

  /* ---------- Medicaid ending: one line per person ---------- */
  var GROUPS = { adult: "Adulto menor de 65 años", child: "Niño menor de 19 años", pregnant: "Embarazada", aged_disabled: "65 años o más, ciego o con incapacidad" };
  function medicaidEnd(raw, today, t) {
    var p = {}, members = [];
    (raw && Array.isArray(raw.members) ? raw.members : []).slice(0, 10).forEach(function (m, i) {
      if (!m || !txt(m.name, 40)) return;
      if (!GROUPS[m.group]) p["members." + i + ".group"] = "Elija un grupo.";
      if (!okDate(m.ends)) p["members." + i + ".ends"] = "Escriba la fecha en que la cobertura termina o terminó.";
      if (["paperwork", "income", "age", "other"].indexOf(m.reason) < 0) p["members." + i + ".reason"] = "Elija la razón que da el aviso.";
      if (m.next_start && !okDate(m.next_start)) p["members." + i + ".next_start"] = "Revise esta fecha.";
      members.push({ name: txt(m.name, 40), group: m.group, ends: m.ends, reason: m.reason, next: ["none", "applied", "approved"].indexOf(m.next) >= 0 ? m.next : "none", next_start: m.next_start || "" });
    });
    if (!members.length) p["members.0.name"] = "Agregue por lo menos una persona.";
    var size = Number(raw && raw.household) || 0, income = raw && raw.income !== "" && raw.income !== undefined ? Number(String(raw.income).replace(/[$,]/g, "")) : null;
    if (income !== null && (isNaN(income) || income < 0)) p.income = "Escriba los ingresos del año en dólares, o déjelo vacío.";
    if (Object.keys(p).length) throw { problems: p };
    var fpl = size ? t.fpl.base + t.fpl.per * (size - 1) : null, below = fpl !== null && income !== null ? income < fpl : null, T = day(today), used = [];
    var lines = members.map(function (m) {
      var E = day(m.ends), out = { name: m.name, group: GROUPS[m.group], ends: m.ends, ends_long: say(m.ends), actions: [], dates: [] };
      if (m.reason === "paperwork") { out.actions.push("Envíe la renovación o los papeles que faltan dentro de los 90 días después de que termine la cobertura, para que la revisen otra vez sin una solicitud nueva."); out.dates.push(["Último día para enviar los papeles", iso(E + 90)]); out.link = ["#paperwork", "Papeles después de que terminó la cobertura"]; }
      if (m.reason !== "paperwork") out.actions.push("Si cree que la decisión está mal, puede pedir una audiencia. La herramienta de audiencias da la fecha.");
      if (m.next === "approved" && m.next_start) {
        var gap = day(m.next_start) - E - 1;
        out.actions.push(gap > 0 ? "La nueva cobertura empieza el " + say(m.next_start) + ", lo que deja " + gap + " día" + (gap === 1 ? "" : "s") + " sin cobertura. Pregunte si puede empezar antes." : "La nueva cobertura empieza el " + say(m.next_start) + ", sin ningún día sin cobertura.");
      } else if (m.group === "child") {
        out.actions.push("Solicite Florida KidCare ahora si nadie se ha comunicado con usted, y guarde una prueba de que solicitó. No espere a que termine la cobertura."); used.push(t.kids); out.apply = t.kids.apply;
      } else if (m.group === "adult" || m.group === "pregnant") {
        out.dates.push(["Se abre el período para HealthCare.gov", iso(E - t.marketplace.before)], ["Se cierra el período para HealthCare.gov", iso(E + t.marketplace.after)]);
        if (below === true) { out.actions.push("Sus ingresos están por debajo del nivel de pobreza. En Florida eso por lo general significa que los adultos no reciben los ahorros del Mercado de Seguros (Marketplace), así que primero revise todas las demás opciones: pregunte al DCF si le corresponde otro grupo de Medicaid, y busque centros de salud comunitarios."); used.push(t.gap, t.fl_not_expanded, t.fpl); }
        else out.actions.push(m.next === "applied" ? "Usted ya solicitó. Elija un plan y pague la primera prima para que la cobertura pueda empezar." : "Solicite en HealthCare.gov dentro del período de abajo. La cobertura empieza cuando se paga la primera prima.");
        used.push(t.marketplace);
        if (m.group === "pregnant") out.actions.push("¿Está embarazada? Avise al DCF. El embarazo puede hacer que alguien sea elegible para Medicaid aunque otros adultos no lo sean.");
      } else {
        out.actions.push("Pregunte al DCF si le corresponde otro grupo de Medicaid para personas de 65 años o más, ciegas o con incapacidad, y si los Programas de Ahorros de Medicare pueden ayudar.");
        out.link = out.link || ["#medicare-costs", "Programas de Ahorros de Medicare"];
      }
      out.dates = out.dates.map(function (d) { return { label: d[0], date: d[1], date_long: say(d[1]), days_left: day(d[1]) - T }; });
      out.urgent = E - T <= 14;
      return out;
    });
    return { headline: lines.length === 1 ? "Próximos pasos para " + lines[0].name : "Próximos pasos para " + lines.length + " personas", lines: lines, below: below, fpl: fpl,
      rules: used.filter(function (r, i, a) { return a.indexOf(r) === i; }).map(src),
      disclaimer: "Primero las reglas de Florida; en otros estados son diferentes. Deciden el DCF, Florida KidCare y HealthCare.gov." + INDEPENDENT };
  }

  return { permission: permission, hearingPrep: hearingPrep, decision: decision, medicaidEnd: medicaidEnd, PROGRAMS: PROGRAMS, GROUPS: GROUPS };
});

(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI) return;
  var U = window.UI, h = U.h, N = window.NextSteps;
  function E() { return U.meta().engines || {}; }
  function today() { return window.Engines.today(); }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function steps(list) { return h("ol", {}, list.map(function (x) { return h("li", { text: x }); })); }
  function tail(r, file, body) {
    return [h("h2", { text: "Reglas en las que se basa esto" }), U.sources(r.rules), h("p", { class: "small", text: r.disclaimer }),
      U.row(U.go("Imprimir esto", function () { window.print(); }), U.quiet("Descargar como texto", function () { U.download(file, "text/plain", body); }), U.quiet("Atrás", U.home))];
  }
  function attempt(fn, again) { try { return fn(); } catch (e) { if (!e.problems) throw e; again(e.problems); return null; } }

  /* Permission */
  function permStart() { U.count("helper-permission", "start"); U.setDatebar(null); permForm({}, {}); }
  function permForm(s, p) {
    U.show(h("h1", { class: "long", text: "¿Puede alguien hablar con la agencia por mí?" }),
      h("p", { class: "lead", text: "Un familiar o un amigo puede ayudar con los papeles y las llamadas. Para que la agencia hable con esa persona sin usted, o para que esa persona actúe por usted, cada programa tiene su propio formulario, y usted lo firma." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault();
        var s2 = { programs: U.ticked("programs"), role: U.picked("role"), helper: val("helper") };
        var r = attempt(function () { return N.permission(s2, today(), E().permission); }, function (pp) { permForm(s2, pp); });
        if (r) { r.card = window.NextStepsEn.permission(s2, today(), E().permission).card; U.count("helper-permission", "kit"); permResult(r); } } } },
        U.ticks("programs", "¿Qué programas?", Object.keys(N.PROGRAMS).map(function (k) { return [k, N.PROGRAMS[k]]; }), s.programs || [], p),
        U.choice("role", "¿Qué hará la persona que le ayuda?", [["prepare", "Ayudarme a leer, llenar y enviar papeles, y acompañarme en las llamadas"], ["talk", "Hablar con la agencia y recibir información sin que yo esté en la línea"], ["act", "Actuar por mí: presentar solicitudes, apelar y recibir las decisiones"]], s.role, p),
        U.field("helper", "El nombre de la persona que le ayuda", "Opcional. Va en la nota.", h("input", { type: "text", value: s.helper || "", maxlength: "60" }), p),
        U.row(U.go("Mostrarme los formularios", null, "submit"), U.quiet("Atrás", U.home))));
    U.firstProblem();
  }
  function permResult(r) {
    U.show(h("h1", { class: "long", text: r.headline }),
      h("table", { class: "plain" }, h("tr", {}, ["Programa", "Formulario", "Lo que permite", "Quién firma"].map(function (x) { return h("th", { text: x }); })),
        r.rows.map(function (x) { return h("tr", {}, h("td", { text: x.program }), h("td", {}, x.form_url ? U.link(x.form_url, x.form) : x.form), h("td", { text: x.does }), h("td", { text: x.signs })); })),
      U.draftBox("Una nota para guardar con sus papeles (en inglés, para mostrarla a la agencia)", r.card, "helper-note.txt"),
      tail(r, "helper-permission.txt", r.rows.map(function (x) { return x.program + ": " + x.form + "\n  " + x.does + "\n  Firma: " + x.signs; }).join("\r\n") + "\r\n\r\n" + r.card));
  }

  /* Hearing outline */
  function prepStart() { U.count("hearing-prep", "start"); U.setDatebar(null); prepForm({ points: [{}, {}] }, {}); }
  function prepCollect(s) {
    s.program = U.picked("program"); s.hearing_date = val("hearing_date");
    s.points = s.points.map(function (_, i) { return { says: val("p" + i + "_says"), page: val("p" + i + "_page"), mine: val("p" + i + "_mine"), ask: val("p" + i + "_ask") }; });
  }
  function prepForm(s, p) {
    var pp = {}; Object.keys(p).forEach(function (k) { var m = /^points\.(\d+)\.(\w+)$/.exec(k); pp[m ? "p" + m[1] + "_" + m[2] : k] = p[k]; });
    U.show(h("h1", { class: "long", text: "Prepararme para mi audiencia" }),
      h("p", { class: "lead", text: "Ponga cada cosa que dice la agencia al lado de la página de donde viene, de sus propias pruebas y de una pregunta. Recibe un esquema de una página para tener delante, por teléfono o en la sala. Se queda en este dispositivo." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); prepCollect(s);
        var r = attempt(function () { return N.hearingPrep(s, today(), E().hearingnext); }, function (q) { prepForm(s, q); });
        if (r) { U.count("hearing-prep", "kit"); prepResult(r, s); } } } },
        U.choice("program", "¿Qué programa?", [["snap", "SNAP (asistencia de alimentos)"], ["medicaid", "Medicaid"]], s.program, pp),
        U.field("hearing_date", "Fecha de la audiencia", "Opcional.", h("input", { type: "date", value: s.hearing_date || "" }), pp),
        s.points.map(function (x, i) {
          var k = "p" + i + "_";
          return h("fieldset", { class: "month" }, h("legend", { text: "Punto " + (i + 1) }),
            U.field(k + "says", "Lo que dice la agencia", "Cópielo del aviso o del expediente del caso. Puede copiarlo en inglés, tal como está escrito.", h("textarea", { rows: "2", maxlength: "300", text: x.says || "" }), pp),
            U.field(k + "page", "Dónde está en el expediente del caso", "Opcional. Como \"página 12\".", h("input", { type: "text", maxlength: "40", value: x.page || "" }), pp),
            U.field(k + "mine", "Su respuesta y sus pruebas", "Como \"el talón de pago del 9 de octubre muestra $612, no $812\".", h("textarea", { rows: "2", maxlength: "300", text: x.mine || "" }), pp),
            U.field(k + "ask", "Una pregunta para hacer", "Opcional.", h("input", { type: "text", maxlength: "300", value: x.ask || "" }), pp));
        }),
        U.row(U.quiet("Agregar otro punto", function () { prepCollect(s); s.points.push({}); prepForm(s, {}); })),
        U.row(U.go("Hacer mi esquema", null, "submit"), U.quiet("Atrás", U.home))));
    U.firstProblem();
  }
  function prepResult(r, s) {
    U.show(h("h1", { class: "long", text: r.headline }),
      r.gaps.length ? h("div", { class: "alert", role: "status" }, h("ul", {}, r.gaps.map(function (g) { return h("li", { text: g }); }))) : null,
      U.draftBox("Su esquema de una página", r.outline, "hearing-outline.txt"),
      h("h2", { text: "Antes de la audiencia" }), steps(r.steps),
      h("p", {}, h("a", { href: "#benefit-hearing", text: "¿Todavía no ha pedido la audiencia? Calcule la fecha" })),
      U.row(U.quiet("Cambiar mis puntos", function () { prepForm(s, {}); })),
      tail(r, "hearing-outline.txt", r.outline));
  }

  /* Decision follow-up */
  function decStart() { U.count("hearing-decision", "start"); U.setDatebar(null); decForm({ state: "FL" }, {}); }
  function decForm(s, p) {
    U.show(h("h1", { class: "long", text: "Gané mi audiencia, pero nada cambió" }),
      h("p", { class: "lead", text: "Una decisión de audiencia le dice a la agencia lo que debe hacer. Ponga esa oración al lado de lo que ha pasado desde entonces, vea la fecha en que debió cumplirse, y envíe una carta pidiendo que se cumpla." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault();
        var s2 = { program: U.picked("program"), state: U.picked("state"), order: U.picked("order"), since: U.picked("since"), received: val("received"), words: val("words") };
        var r = attempt(function () { return N.decision(s2, today(), Object.assign({}, E().hearingnext, { fl_contact: (E().hearing || {}).fl_contact }), s2.state === "FL"); }, function (q) { decForm(s2, q); });
        if (r) { r.letter = window.NextStepsEn.decision(s2, today(), Object.assign({}, E().hearingnext, { fl_contact: (E().hearing || {}).fl_contact }), s2.state === "FL").letter; U.count("hearing-decision", "kit"); decResult(r, s2); } } } },
        U.choice("program", "¿Qué programa?", [["snap", "SNAP (asistencia de alimentos)"], ["medicaid", "Medicaid"]], s.program, p),
        U.choice("state", "¿Qué estado?", [["FL", "Florida"], ["other", "Otro estado"]], s.state, p),
        U.field("received", "Fecha en que recibió la decisión", null, h("input", { type: "date", value: s.received || "" }), p),
        U.choice("order", "¿Qué ordena la decisión?", [["increase", "Devolver o aumentar mis beneficios, o restablecer mi cobertura"], ["redo", "La agencia debe revisar mi caso otra vez"], ["other", "Otra cosa, o no estoy seguro"]], s.order, p),
        U.field("words", "La oración que dice lo que la agencia debe hacer", "Opcional, pero hace más fuerte la carta. Cópiela palabra por palabra, en inglés, como está en la decisión.", h("textarea", { rows: "3", maxlength: "600", text: s.words || "" }), p),
        U.choice("since", "¿Qué ha pasado desde entonces?", [["nothing", "Nada ha cambiado"], ["part", "Se hizo una parte"], ["new_notice", "Recibí un aviso nuevo"]], s.since, p),
        U.row(U.go("Mostrarme qué hacer", null, "submit"), U.quiet("Atrás", U.home))));
    U.firstProblem();
  }
  function decResult(r, s) {
    U.show(h("h1", { class: "long", text: r.headline }), steps(r.steps),
      r.contact ? h("p", { class: "small" }, r.contact.plain + " ", U.link(r.contact.source, "Fuente")) : null,
      U.draftBox("Carta para pedir que se cumpla la decisión (en inglés, para la agencia)", r.letter, "carry-out-decision.txt"),
      U.row(U.sentButton("hearing", "Carta sobre el cumplimiento de una decisión de audiencia", "mail"), U.quiet("Cambiar mis respuestas", function () { decForm(s, {}); })),
      tail(r, "hearing-decision.txt", r.steps.join("\r\n") + "\r\n\r\n" + r.letter));
  }

  /* Medicaid ending */
  function endStart() { U.count("medicaid-ending", "start"); U.setDatebar(null); endForm({ members: [{}, {}] }, {}); }
  function endCollect(s) {
    s.household = val("household"); s.income = val("income");
    s.members = s.members.map(function (_, i) { var k = "m" + i + "_"; return { name: val(k + "name"), group: val(k + "group"), ends: val(k + "ends"), reason: val(k + "reason"), next: val(k + "next"), next_start: val(k + "next_start") }; });
  }
  function sel(list, v) { return h("select", {}, [h("option", { value: "", text: "Elija" })].concat(list.map(function (o) { return h("option", { value: o[0], text: o[1], selected: o[0] === v ? "selected" : null }); }))); }
  function endForm(s, p) {
    var pp = {}; Object.keys(p).forEach(function (k) { var m = /^members\.(\d+)\.(\w+)$/.exec(k); pp[m ? "m" + m[1] + "_" + m[2] : k] = p[k]; });
    U.show(h("h1", { class: "long", text: "Mi Medicaid se termina. ¿Qué pasa con cada uno de nosotros?" }),
      h("p", { class: "lead", text: "Un mismo aviso puede terminar la cobertura de algunas personas de un hogar y no de otras, y el siguiente paso es diferente para un niño, un adulto y una persona embarazada. Dé una línea a cada persona. Primero Florida." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); endCollect(s);
        var r = attempt(function () { return N.medicaidEnd(s, today(), E().medicaidend); }, function (q) { endForm(s, q); });
        if (r) { U.count("medicaid-ending", "kit"); endResult(r, s); } } } },
        s.members.map(function (m, i) {
          var k = "m" + i + "_";
          return h("fieldset", { class: "month" }, h("legend", { text: "Persona " + (i + 1) }),
            U.field(k + "name", "Nombre o apodo", "Déjelo vacío para saltarlo.", h("input", { type: "text", maxlength: "40", value: m.name || "" }), pp),
            U.field(k + "group", "Grupo", null, sel(Object.keys(N.GROUPS).map(function (g) { return [g, N.GROUPS[g]]; }), m.group), pp),
            U.field(k + "ends", "Fecha en que la cobertura termina o terminó", null, h("input", { type: "date", value: m.ends || "" }), pp),
            U.field(k + "reason", "Por qué, según el aviso", null, sel([["paperwork", "No recibieron los papeles"], ["income", "Ingresos demasiado altos"], ["age", "Pasó la edad límite, o terminó la cobertura por embarazo"], ["other", "Otra razón, o no estoy seguro"]], m.reason), pp),
            U.field(k + "next", "Otra cobertura", null, sel([["none", "Ninguna todavía"], ["applied", "Solicitada, en espera"], ["approved", "Aprobada"]], m.next), pp),
            U.field(k + "next_start", "Si está aprobada: fecha de inicio", "Opcional.", h("input", { type: "date", value: m.next_start || "" }), pp));
        }),
        U.row(U.quiet("Agregar otra persona", function () { endCollect(s); s.members.push({}); endForm(s, {}); })),
        U.field("household", "Personas en su hogar", "Opcional, junto con los ingresos: compara con el nivel de pobreza.", h("input", { type: "number", min: "1", max: "15", value: s.household || "" }), pp),
        U.field("income", "Ingresos del hogar en el año", "Opcional.", h("input", { type: "text", inputmode: "decimal", value: s.income || "" }), pp),
        U.row(U.go("Mostrar los próximos pasos", null, "submit"), U.quiet("Atrás", U.home))));
    U.firstProblem();
  }
  function endResult(r, s) {
    U.show(h("h1", { class: "long", text: r.headline }),
      h("ul", { class: "matches" }, r.lines.map(function (l) {
        return h("li", { class: "match" + (l.urgent ? " urgent" : "") },
          h("p", {}, h("b", { text: l.name + " " }), h("span", { class: "tag", text: l.group + ", la cobertura termina el " + l.ends_long })),
          steps(l.actions),
          l.dates.length ? h("ul", { class: "small" }, l.dates.map(function (d) { return h("li", { text: d.label + ": " + d.date_long + " (" + (d.days_left < 0 ? "hace " + Math.abs(d.days_left) + " días" : "en " + d.days_left + " días") + ")" }); })) : null,
          l.apply ? h("p", {}, U.link(l.apply, "Florida KidCare")) : null,
          l.link ? h("p", {}, h("a", { href: l.link[0], text: l.link[1] })) : null);
      })),
      U.row(U.quiet("Cambiar mis respuestas", function () { endForm(s, {}); })),
      tail(r, "medicaid-ending.txt", r.lines.map(function (l) { return l.name + " (" + l.group + ", termina el " + l.ends_long + ")\r\n" + l.actions.map(function (a) { return "- " + a; }).join("\r\n") + "\r\n" + l.dates.map(function (d) { return "  " + d.label + ": " + d.date_long; }).join("\r\n"); }).join("\r\n\r\n")));
  }

  window.Modules = window.Modules || {};
  window.Modules.nextSteps = { permission: permStart, hearingPrep: prepStart, decision: decStart, medicaidEnd: endStart };
})();
