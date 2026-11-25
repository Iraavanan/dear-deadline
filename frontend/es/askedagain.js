/* Built by tools/make_es_js.py from frontend/askedagain.js. Do not edit: change the English file or tools/es_js_text.py. */
/* "I already sent this proof. Why are they asking again?"

   The person lists what the new notice asks for and what they already sent. This matches the
   two on this device (nothing is sent to the site) by kind of document, person and dates, and
   says for each item what is still open and the question to ask. A receipt never counts as
   the agency accepting a document: every item keeps its due date until the agency confirms.

   check(input, todayISO, rules) returns the result, or throws {problems}. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AskedAgain = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var KINDS = [["pay_stub", "Talones de pago"], ["employer", "Carta o formulario de un empleador"], ["ss_letter", "Carta de beneficios del Seguro Social"], ["bank", "Estado de cuenta del banco"],
    ["rent", "Prueba del alquiler o de los gastos de vivienda"], ["utility", "Factura de servicios públicos"], ["id", "Prueba de identidad"], ["childcare", "Gastos de cuidado de niños"], ["medical", "Facturas médicas"], ["other", "Otra cosa"]];
  var RECEIPTS = [["lists", "Sí, mi recibo menciona este documento"], ["not_listed", "Tengo un recibo, pero no menciona este documento"], ["none", "No tengo recibo"]];
  var MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var COVERED = ["sent_listed", "sent_unconfirmed"];

  function kindName(k) { var f = KINDS.filter(function (x) { return x[0] === k; })[0]; return f ? f[1] : "Otra cosa"; }
  function day(iso) { var p = iso.split("-").map(Number); return Date.UTC(p[0], p[1] - 1, p[2]) / 864e5; }
  function iso(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
  function say(s) { var p = s.split("-").map(Number); return p[2] + " de " + MONTHS[p[1] - 1] + " de " + p[0]; }
  function okDate(v) {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    var p = v.split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
  }
  function person(v) { var w = String(v || "").trim().toLowerCase(); return w === "" || w === "me" || w === "myself" || w === "self" || w === "i" || w === "yo" || w === "mí" || w === "mi" || w === "para mí" ? "me" : w; }
  function sameKind(a, b) { return a.kind === b.kind && (a.kind !== "other" || String(a.label || "").trim().toLowerCase() === String(b.label || "").trim().toLowerCase()); }
  function what(it) { return it.kind === "other" && it.label ? it.label.trim() : kindName(it.kind); }
  function whose(it) { return person(it.who) === "me" ? "" : " de " + String(it.who).trim(); }
  function span(it) { return it.from && it.to ? (it.from === it.to ? " con fecha del " + say(it.from) : " del " + say(it.from) + " al " + say(it.to)) : ""; }

  function clean(raw, today) {
    var p = {}, f = { requested: [], sent: [] };
    if (!raw || typeof raw !== "object") throw { problems: { requested: "No se pudieron leer los datos. Escríbalos otra vez." } };
    f.program = raw.program === "medicaid" ? "medicaid" : "snap";
    f.state = raw.state === "FL" ? "FL" : "other";
    if (!okDate(raw.due)) p.due = "Escriba la fecha límite impresa en el aviso nuevo.";
    else f.due = raw.due;
    f.notice_date = okDate(raw.notice_date) ? raw.notice_date : null;
    function item(it, key, i, sent) {
      if (!it || typeof it !== "object" || !KINDS.some(function (k) { return k[0] === it.kind; })) { p[key + "." + i + ".kind"] = "Elija qué tipo de documento es."; return null; }
      var o = { kind: it.kind, who: String(it.who || "").trim().slice(0, 60), label: String(it.label || "").trim().slice(0, 80), from: "", to: "" };
      if (it.kind === "other" && !o.label) p[key + "." + i + ".label"] = "Diga qué documento es.";
      var fr = it.from || "", to = it.to || "";
      if (fr && !okDate(fr)) p[key + "." + i + ".from"] = "Revise esta fecha.";
      if (to && !okDate(to)) p[key + "." + i + ".to"] = "Revise esta fecha.";
      if (okDate(fr) && !to) to = fr;
      if (okDate(to) && !fr) fr = to;
      if (okDate(fr) && okDate(to)) { if (fr > to) p[key + "." + i + ".to"] = "La fecha final es anterior a la fecha inicial."; o.from = fr; o.to = to; }
      if (sent) {
        o.receipt = RECEIPTS.some(function (r) { return r[0] === it.receipt; }) ? it.receipt : "none";
        o.sent = okDate(it.sent) ? it.sent : "";
        o.how = String(it.how || "").slice(0, 20);
      }
      return o;
    }
    (Array.isArray(raw.requested) ? raw.requested : []).slice(0, 15).forEach(function (it, i) { var o = item(it, "requested", i, false); if (o) f.requested.push(o); });
    (Array.isArray(raw.sent) ? raw.sent : []).slice(0, 30).forEach(function (it, i) { var o = item(it, "sent", i, true); if (o) f.sent.push(o); });
    if (!f.requested.length && !p["requested.0.kind"]) p.requested = "Agregue por lo menos una cosa que pide el aviso nuevo.";
    if (Object.keys(p).length) throw { problems: p };
    return f;
  }

  /* Days of the request's period not covered by the sent periods: a list of [from, to]. */
  function gaps(req, periods) {
    var a = day(req.from), b = day(req.to), cur = a, out = [];
    periods.map(function (s) { return [day(s.from), day(s.to)]; }).sort(function (x, y) { return x[0] - y[0]; }).forEach(function (s) {
      if (s[1] < cur || s[0] > b) return;
      if (s[0] > cur) out.push([cur, Math.min(s[0] - 1, b)]);
      cur = Math.max(cur, s[1] + 1);
    });
    if (cur <= b) out.push([cur, b]);
    return out.map(function (g) { return [iso(g[0]), iso(g[1])]; });
  }

  function matchOne(req, sent) {
    var kind = sent.filter(function (s) { return sameKind(s, req); });
    var mine = kind.filter(function (s) { return person(s.who) === person(req.who); });
    if (!kind.length) return { status: "not_sent", used: [] };
    if (!mine.length) return { status: "wrong_person", used: kind };
    if (!req.from) return { status: mine.every(function (s) { return s.receipt === "lists"; }) ? "sent_listed" : "sent_unconfirmed", used: mine, no_period: true };
    var dated = mine.filter(function (s) { return s.from; });
    var overlap = dated.filter(function (s) { return s.to >= req.from && s.from <= req.to; });
    var g = gaps(req, overlap);
    if (!g.length) {
      var needed = overlap.filter(function (s) { return true; });
      return { status: needed.every(function (s) { return s.receipt === "lists"; }) ? "sent_listed" : "sent_unconfirmed", used: needed };
    }
    if (dated.length < mine.length) return { status: "period_unknown", used: mine, gaps: g };
    if (!overlap.length) return { status: "wrong_period", used: dated };
    return { status: "partly_sent", used: overlap, gaps: g };
  }

  function check(raw, today, rules) {
    var f = clean(raw, today), t = rules || {};
    var left = day(f.due) - day(today), dueText = say(f.due);
    var items = f.requested.map(function (req) {
      var m = matchOne(req, f.sent), name = what(req) + whose(req) + span(req), sentOn = m.used.filter(function (s) { return s.sent; }).map(function (s) { return say(s.sent); });
      var r = { requested: name, kind: req.kind, status: m.status, gaps: m.gaps || [], action: "", question: "", help: [] };
      var when = sentOn.length ? " el " + sentOn.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(" y el ") : "";
      var lo = name.charAt(0).toLowerCase() + name.slice(1), asks = req.from ? "del " + say(req.from) + " al " + say(req.to) : "";
      if (m.status === "sent_listed") {
        r.label = "Enviado, y su recibo lo menciona";
        r.action = "Su recibo muestra que llegó. No muestra que la agencia lo haya revisado o aceptado. Llame o escriba a la agencia antes del " + dueText + " y haga la pregunta de abajo.";
        r.question = "Envié " + lo + when + ", y mi recibo lo menciona. ¿Ya lo revisaron? ¿Tiene algún problema, como una página que no se puede leer, y hace falta algo más antes del " + dueText + "?";
      } else if (m.status === "sent_unconfirmed") {
        r.label = "Enviado, pero sin confirmar";
        r.action = "Usted lo envió, pero nada muestra que la agencia lo haya recibido todo. Pregunte antes del " + dueText + ". Si todavía tiene una copia, lo más seguro es enviarla otra vez con una nota de presentación.";
        r.question = "Envié " + lo + when + ". ¿Pueden decirme si lo recibieron, y si hace falta algo más antes del " + dueText + "?";
      } else if (m.status === "partly_sent") {
        r.label = "Solo se envió una parte del período";
        r.action = "El aviso pide " + asks + ". En lo que usted envió falta " + m.gaps.map(function (g) { return g[0] === g[1] ? "el " + say(g[0]) : "del " + say(g[0]) + " al " + say(g[1]); }).join(" y ") + ". Envíe esa parte a más tardar el " + dueText + ".";
        r.question = "Envié una parte de esto" + when + ". ¿Pueden confirmar qué fechas necesitan todavía para esto: " + what(req).toLowerCase() + whose(req) + "?";
      } else if (m.status === "period_unknown") {
        r.label = "Enviado, pero las fechas no están claras";
        r.action = "Usted anotó que envió esto sin sus fechas. Revise su copia: el aviso pide " + asks + ". Si su copia no lo cubre todo, envíe el resto a más tardar el " + dueText + ".";
        r.question = "Envié " + what(req).toLowerCase() + whose(req) + when + ". ¿Qué fechas recibieron, y cuáles necesitan todavía?";
      } else if (m.status === "wrong_period") {
        r.label = "Lo que envió cubre otras fechas";
        r.action = "Usted envió esto para otras fechas. El aviso pide " + asks + ". Envíe ese período a más tardar el " + dueText + ".";
        r.question = "Ustedes pidieron " + lo + ". Yo envié un período diferente" + when + ". ¿El período del aviso es el que necesitan?";
      } else if (m.status === "wrong_person") {
        r.label = "Enviado para otra persona, no para esta";
        r.action = "Lo que usted envió era de " + m.used.map(function (s) { return person(s.who) === "me" ? "usted" : String(s.who).trim(); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(" y de ") + ". El aviso lo pide" + (person(req.who) === "me" ? " de usted" : " de " + String(req.who).trim()) + ". Envíe eso a más tardar el " + dueText + ".";
        r.question = "Ustedes pidieron " + lo + ". ¿De quién se necesita, y de qué fechas?";
      } else {
        r.label = "Todavía no enviado";
        r.action = "Envíelo a más tardar el " + dueText + ". Si no puede conseguirlo a tiempo, llame antes de esa fecha y pida más tiempo o ayuda para conseguirlo.";
        r.question = "Estoy consiguiendo " + lo + ". Si no puedo conseguirlo antes del " + dueText + ", ¿pueden ayudarme a conseguirlo o darme más tiempo?";
      }
      if (m.no_period && COVERED.indexOf(m.status) >= 0) r.question += " ¿Qué fechas debe cubrir?";
      if (COVERED.indexOf(m.status) < 0 || m.status === "sent_unconfirmed") {
        if (req.kind === "pay_stub" || req.kind === "employer") r.help.push(f.state === "FL" ? "fl_employer" : "help");
        if (req.kind === "ss_letter") r.help.push("ssa_letter");
        if (r.help.indexOf("help") < 0) r.help.push("help");
      }
      r.help = r.help.filter(function (k) { return t[k]; }).map(function (k) { return { plain: t[k].plain, source: t[k].source }; });
      return r;
    });
    var open = items.filter(function (i) { return COVERED.indexOf(i.status) < 0; }).length;
    var headline = left < 0 ? "La fecha límite, " + dueText + ", ya pasó" : (open ? (open === 1 ? "Falta por enviar " : "Faltan por enviar ") + open + " de " + items.length + (items.length === 1 ? " documento" : " documentos") + ", y hay que confirmar cada uno a más tardar el " + dueText
      : "Todo se envió. Confirme con la agencia a más tardar el " + dueText);
    var notes = [];
    if (f.program === "snap" && f.notice_date && day(f.due) - day(f.notice_date) < 10 && t.ten_days) notes.push({ plain: "Su aviso da menos de 10 días. " + t.ten_days.plain + " Pida más tiempo.", source: t.ten_days.source });
    ["receipt", "notice", "unchanged", "help"].forEach(function (k) { if (t[k]) notes.push({ plain: t[k].plain, source: t[k].source }); });
    var log = items.map(function (i) { return "- " + i.requested + ": " + i.label.toLowerCase(); });
    return {
      headline: headline, due: f.due, due_long: dueText, days_left: left, deadline_passed: left < 0, items: items, open: open,
      call: ["Hola, mi nombre es [su nombre]. Mi número de caso es [el del aviso].", "Recibí un aviso con fecha del " + (f.notice_date ? say(f.notice_date) : "[fecha]") + " que pide pruebas a más tardar el " + dueText + "."]
        .concat(items.map(function (i) { return i.question; })).concat(["¿Pueden anotar en mi caso que llamé hoy, y decirme su nombre?"]).join("\n"),
      cover: ["PROOF SENT AGAIN, OR FOR THE FIRST TIME", "", "Name: [your name]", "Case number: [from the notice]", "Notice dated: " + (f.notice_date ? say(f.notice_date) : "[date]") + ", due " + dueText, "",
        "Enclosed:"].concat(items.filter(function (i) { return i.status !== "sent_listed"; }).map(function (i) { return "- " + i.requested; }))
        .concat(["", "Already sent earlier (please check your file):"]).concat(f.sent.map(function (s) { return "- " + what(s) + whose(s) + span(s) + (s.sent ? ", sent " + say(s.sent) : ""); }))
        .concat(["", "Please contact me if anything else is needed. Phone: [your phone]"]).join("\n"),
      summary: log.join("\n"), notes: notes, on_device: true,
      disclaimer: "Esto compara lo que pide el aviso con lo que usted dice que envió. No puede ver el expediente de la agencia, y un recibo no significa que un documento fue aceptado. Solo la agencia decide. Esta herramienta es independiente. No es una agencia del gobierno y no da consejos legales. La traducción al español todavía no ha sido revisada por un traductor profesional."
    };
  }

  /* The simple way most checklists work: anything of the same kind sent counts as done. Kept to compare against. */
  function naive(raw) {
    return (raw.requested || []).map(function (req) { return (raw.sent || []).some(function (s) { return s.kind === req.kind; }) ? "done" : "not_sent"; });
  }

  return { check: check, naive: naive, KINDS: KINDS, RECEIPTS: RECEIPTS, COVERED: COVERED };
});

(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI) return;
  var U = window.UI, h = U.h, A = window.AskedAgain;
  var s;
  function blankReq() { return { kind: "", who: "", from: "", to: "", label: "" }; }
  function blankSent() { return { kind: "", who: "", from: "", to: "", label: "", sent: "", receipt: "" }; }
  function opt(list, v, none) { return h("select", {}, (none ? [h("option", { value: "", text: none })] : []).concat(list.map(function (o) { return h("option", { value: o[0], text: o[1], selected: o[0] === v ? "selected" : null }); }))); }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }

  function start(prefill) {
    s = { program: "snap", state: "FL", notice_date: "", due: "", requested: [blankReq()], sent: [blankSent()] };
    var c = window.__case;
    if (c && c.entries && c.entries.length) {
      var rs = c.entries.filter(function (e) { return e.what === "renewal" || e.what === "hours"; });
      if (rs.length) s.sent = rs.map(function (e) { return { kind: "other", label: e.about || "Papeles de renovación", who: "", from: "", to: "", sent: e.sent, receipt: e.proof ? "not_listed" : "none" }; });
    }
    U.count("asked-again", "start"); U.setDatebar(null);
    form();
  }

  function collect() {
    s.program = U.picked("program") || "snap"; s.state = U.picked("state") || "FL";
    s.notice_date = val("notice_date"); s.due = val("due");
    s.requested = s.requested.map(function (_, i) { return { kind: val("r" + i + "_kind"), who: val("r" + i + "_who"), from: val("r" + i + "_from"), to: val("r" + i + "_to"), label: val("r" + i + "_label") }; });
    s.sent = s.sent.map(function (_, i) { return { kind: val("s" + i + "_kind"), who: val("s" + i + "_who"), from: val("s" + i + "_from"), to: val("s" + i + "_to"), label: val("s" + i + "_label"), sent: val("s" + i + "_sent"), receipt: val("s" + i + "_receipt") }; });
  }

  function byId(problems) {
    var out = {};
    Object.keys(problems).forEach(function (k) {
      var m = /^(requested|sent)\.(\d+)\.(\w+)$/.exec(k);
      if (m) out[(m[1] === "requested" ? "r" : "s") + m[2] + "_" + m[3]] = problems[k]; else out[k] = problems[k];
    });
    return out;
  }

  function block(prefix, it, i, sent, p) {
    var k = prefix + i + "_";
    return h("fieldset", { class: "month" }, h("legend", { text: (sent ? "Enviado: documento " : "Pedido: documento ") + (i + 1) }),
      U.field(k + "kind", "Qué tipo de documento", null, opt(A.KINDS, it.kind, "Elija"), p),
      U.field(k + "label", "Si es otra cosa: ¿qué es?", "Como \"contrato de alquiler\" o \"carta de la escuela\".", h("input", { type: "text", value: it.label, maxlength: "80" }), p),
      U.field(k + "who", "De quién es", "Déjelo vacío si es de usted, o escriba un nombre.", h("input", { type: "text", value: it.who, maxlength: "60", autocomplete: "off" }), p),
      h("div", { class: "pair" },
        h("div", { class: "cell" }, U.field(k + "from", sent ? "Cubre desde" : "Fechas que piden: desde", "Opcional.", h("input", { type: "date", value: it.from }), p)),
        h("div", { class: "cell" }, U.field(k + "hasta", "hasta", "Para un solo talón, la misma fecha.", h("input", { type: "date", value: it.to }), p))),
      sent ? [U.field(k + "sent", "Fecha en que lo envió", "Opcional.", h("input", { type: "date", value: it.sent }), p),
        U.field(k + "receipt", "¿Un recibo o una confirmación menciona este documento?", null, opt(A.RECEIPTS, it.receipt, "Elija"), p)] : null,
      h("button", { class: "copy", type: "button", text: "Quitar", on: { click: function () { collect(); (sent ? s.sent : s.requested).splice(i, 1); if (!s.requested.length) s.requested.push(blankReq()); form(); } } }));
  }

  function form(problems) {
    var p = byId(problems || {});
    U.show(
      h("h1", { class: "long", text: "Me pidieron otra vez pruebas que ya envié" }),
      h("p", { class: "lead", text: "Un recibo muestra que algo llegó. No muestra que un trabajador lo aceptó, así que la fecha límite sigue contando. Anote lo que pide el aviso nuevo y lo que usted envió. Esta página los compara, persona por persona y fecha por fecha, y le da la pregunta que debe hacer. Todo se queda en este dispositivo." }),
      Object.keys(p).length ? h("div", { class: "alert", role: "alert", text: "Hay respuestas que corregir." }) : null,
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); collect(); run(); } } },
        U.choice("program", "¿Qué programa lo pidió?", [["snap", "SNAP (asistencia de alimentos)"], ["medicaid", "Medicaid"]], s.program, p),
        U.choice("state", "¿Qué estado?", [["FL", "Florida"], ["other", "Otro estado"]], s.state, p),
        U.field("notice_date", "Fecha del aviso nuevo", "Opcional.", h("input", { type: "date", value: s.notice_date }), p),
        U.field("due", "Fecha límite del aviso nuevo", null, h("input", { type: "date", value: s.due }), p),
        h("h2", { text: "Lo que pide el aviso nuevo" }),
        p.requested ? h("p", { class: "err", role: "alert", text: p.requested }) : null,
        s.requested.map(function (it, i) { return block("r", it, i, false, p); }),
        U.row(U.quiet("Agregar otra cosa que piden", function () { collect(); s.requested.push(blankReq()); form(); })),
        h("h2", { text: "Lo que usted ya envió" }),
        s.sent.map(function (it, i) { return block("s", it, i, true, p); }),
        U.row(U.quiet("Agregar otra cosa que envió", function () { collect(); s.sent.push(blankSent()); form(); })),
        U.row(U.go("Compararlos", null, "submit"), U.quiet("Probar un ejemplo inventado", example), U.quiet("Atrás", U.home))));
    U.firstProblem();
  }

  function example() {
    U.trying();
    var t = new Date(), y = t.getFullYear(), m = t.getMonth(), pad = function (n) { return String(n).padStart(2, "0"); };
    var lm = new Date(y, m - 1, 1), ly = lm.getFullYear(), lmm = pad(lm.getMonth() + 1), last = new Date(ly, lm.getMonth() + 1, 0).getDate();
    var plus = function (n) { var d = new Date(Date.now() + n * 864e5); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
    s = { program: "snap", state: "FL", notice_date: plus(-2), due: plus(11),
      requested: [{ kind: "pay_stub", who: "", from: ly + "-" + lmm + "-01", to: ly + "-" + lmm + "-" + pad(last), label: "" }, { kind: "rent", who: "", from: "", to: "", label: "" }],
      sent: [{ kind: "pay_stub", who: "", from: ly + "-" + lmm + "-01", to: ly + "-" + lmm + "-14", label: "", sent: plus(-12), receipt: "lists" },
        { kind: "rent", who: "", from: "", to: "", label: "", sent: plus(-12), receipt: "not_listed" }] };
    run();
  }

  function run() {
    var r;
    try { r = A.check(s, window.Engines.today(), (U.meta().engines || {}).askedagain); r.cover = window.AskedAgainEn.check(s, window.Engines.today(), {}).cover; }
    catch (e) { if (!e.problems) throw e; form(e.problems); return; }
    U.count("asked-again", "dates"); U.count("asked-again", "kit"); result(r);
  }

  function text(r) {
    return ["ME PIDIERON PRUEBAS OTRA VEZ", "", r.headline, ""].concat(r.items.map(function (i) { return "* " + i.requested + "\n  " + i.label + ". " + i.action + "\n  Pregunte: " + i.question; }))
      .concat(["", "QUÉ DECIR EN LA LLAMADA", r.call, "", "NOTA DE PRESENTACIÓN (EN INGLÉS, PARA LA AGENCIA)", r.cover, ""]).concat(r.notes.map(function (n) { return "- " + n.plain + " " + n.source; })).concat(["", r.disclaimer]).join("\r\n");
  }

  function result(r) {
    U.show(
      h("h1", { class: "long", text: r.headline }),
      h("p", { class: "lead" + (r.deadline_passed ? " late" : ""), text: r.deadline_passed ? "Llame hoy a la agencia y pregunte si todavía puede enviarlo. Si su caso se cerró, la herramienta de papeles muestra el plazo para enviar los documentos sin empezar de nuevo." : r.days_left + " días restantes. Mantenga esta fecha hasta que la agencia le diga, por escrito o en una llamada que usted anote, que no hace falta nada más." }),
      r.deadline_passed ? h("p", {}, h("a", { href: "#paperwork", text: "Perdí beneficios por papeles" })) : null,
      h("ul", { class: "matches" }, r.items.map(function (i) {
        return h("li", { class: "match " + i.status },
          h("p", {}, h("b", { text: i.requested }), h("span", { class: "tag", text: i.label })),
          h("p", { text: i.action }),
          h("p", { class: "ask" }, h("b", { text: "Pregunte: " }), i.question),
          i.help.length ? h("ul", { class: "small sources" }, i.help.map(function (x) { return h("li", {}, x.plain + " ", U.link(x.source, "Fuente")); })) : null);
      })),
      U.draftBox("Qué decir en la llamada", r.call, "asked-again-call.txt"),
      U.draftBox("Nota de presentación para enviar con sus pruebas (en inglés, para la agencia)", r.cover, "asked-again-cover.txt"),
      h("h2", { text: "Reglas en las que se basa esto" }), U.sources(r.notes),
      h("p", { class: "small", text: r.disclaimer }),
      U.row(U.go("Imprimir esto", function () { window.print(); }), U.quiet("Descargar como texto", function () { U.download("asked-again.txt", "text/plain", text(r)); }),
        U.sentButton("renewal", "Pruebas enviadas otra vez para el aviso con fecha límite del " + r.due_long, "online"), U.quiet("Cambiar mis respuestas", function () { form(); })));
  }

  window.Modules = window.Modules || {};
  window.Modules.askedAgain = { start: start };
})();
