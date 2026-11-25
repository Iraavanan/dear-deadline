/* Built by tools/make_es_js.py from frontend/log.js. Do not edit: change the English file or tools/es_js_text.py. */
/* "I already sent something": a record of what was sent, when, how and what proof
   there is, with questions for the next call. Nothing is kept by this site: the
   person downloads the record and can open it here again from their own device. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var WHAT = [["appeal", "Una apelación o solicitud de reconsideración"], ["waiver", "Una solicitud de exención (waiver)"], ["rate", "Una solicitud para devolver menos cada mes"],
    ["change", "Un informe de un cambio"], ["form", "Un formulario que pidió el Seguro Social o Medicare"], ["medicare", "Una apelación o solicitud de Medicare"],
    ["billing", "Una pregunta a la oficina de cobros de un médico o proveedor"], ["renewal", "Una renovación de Medicaid o SNAP, o pruebas que pidieron"],
    ["hours", "Pruebas de horas de trabajo o de una exención"], ["hearing", "Una solicitud de audiencia imparcial"], ["housing", "Una carta a la autoridad de vivienda"], ["other", "Otra cosa"]];
  var HOW = [["mail", "Por correo"], ["fax", "Por fax"], ["phone", "Por teléfono"], ["online", "Por internet"], ["office", "En persona en una oficina"], ["other", "De otra manera"]];
  var HEARD = [["none", "Todavía no"], ["received", "Confirmaron que lo recibieron"], ["more", "Pidieron más información o pruebas"], ["decided", "Enviaron una decisión"]];
  /* After "I heard back": the next step for each answer, with where on this site it is. */
  var NEXT = {
    none: function (e) { var n = since(e.sent); return n > 30 ? ["Han pasado " + n + " días. Llame, diga el día en que lo envió y lea su prueba. Pida que confirmen que está en su expediente.", null] : ["Guarde su prueba con este registro. Si no ha tenido respuesta en 30 días, llame y pregunte.", null]; },
    received: function () { return ["Pregunte cuándo puede esperar una decisión, y anote la fecha que le den.", null]; },
    more: function (e) { return ["Envíe lo que pidieron a más tardar en la fecha de su carta, guarde una prueba del envío y agréguelo aquí como una entrada nueva. Si pidieron otra vez algo que usted ya envió, primero compare las dos cosas.", e.what === "renewal" || e.what === "hours" ? ["#asked-again", "Comparar lo que piden con lo que usted envió"] : null]; },
    decided: function (e) {
      var to = { appeal: "#decision-appeal", waiver: "#overpayment", rate: "#overpayment", medicare: "#medicare-letter", renewal: "#renewal", hours: "#work-rules", housing: "#rent-check", billing: "#medicare-bill" }[e.what];
      return ["Lea la decisión para ver su fecha y lo que dice que usted puede hacer ahora. Si no está de acuerdo, por lo general hay un plazo nuevo para apelar, contado desde la fecha de esa carta.", to ? [to, "Ver las fechas y las opciones para el siguiente paso"] : null];
    }
  };
  var KIND = "benefits-letter-helper-record", LIMIT = { about: 200, proof: 200, notes: 1000 };
  var s;

  function label(list, id) { var f = list.filter(function (x) { return x[0] === id; })[0]; return f ? f[1] : list[list.length - 1][1]; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function since(iso) { return Math.round((Date.parse(today() + "T00:00:00Z") - Date.parse(iso + "T00:00:00Z")) / 864e5); }
  function select(list, current) { return h("select", {}, list.map(function (o) { return h("option", { value: o[0], text: o[1], selected: current === o[0] ? "selected" : null }); })); }

  function start() {
    s = window.__case;                               // shared with "Add to my timeline" for this visit
    if (window.__openRecord) { loadData(window.__openRecord); window.__openRecord = null; U.count("filed-log", "start"); logView(); return; }
    U.count("filed-log", "start"); U.setDatebar(null);
    if (s.entries.length || s.letters.length) { U.count("filed-log", "start"); U.setDatebar(null); if (!window.__record) { logView(); return; } }
    if (window.__record) {                           // arrived from "I sent this" at the end of a kit
      var r = window.__record; window.__record = null;
      s.draft = { what: r.what, about: r.about, sent: today(), how: r.how, proof: "", heard: "none", heard_date: "", notes: "" };
      entryForm(null); return;
    }
    var status = h("p", { class: "status", role: "status" });
    U.show(
      h("h1", { class: "long", text: "Lleve un registro de lo que envió" }),
      h("p", { class: "lead", text: "Anote cada cosa que envió a una agencia, a una oficina de cobros o a una autoridad de vivienda, o que dijo en una llamada. Recibe un registro para guardar y preguntas para su próxima llamada. Este sitio no guarda nada: descargue su registro para conservarlo, y ábralo aquí otra vez más adelante." }),
      U.row(U.go("Agregar lo primero que envió", function () { entryForm(null); })),
      h("label", { for: "recordfile" }, "O abra un registro que guardó", h("span", { class: "hint", text: "El archivo se queda en este dispositivo." })),
      h("input", { id: "recordfile", type: "file", accept: ".json,application/json", on: { change: function (ev) { openFile(ev.target.files && ev.target.files[0], status); } } }),
      status,
      U.row(U.quiet("Atrás", U.home)));
  }

  function clean(e) {
    if (!e || typeof e !== "object" || typeof e.sent !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.sent)) return null;
    function str(v, n) { return typeof v === "string" ? v.slice(0, n) : ""; }
    function pick(list, v, d) { return list.some(function (x) { return x[0] === v; }) ? v : d; }
    return { what: pick(WHAT, e.what, "other"), about: str(e.about, LIMIT.about), sent: e.sent, how: pick(HOW, e.how, "other"), proof: str(e.proof, LIMIT.proof),
      heard: pick(HEARD, e.heard, "none"), heard_date: /^\d{4}-\d{2}-\d{2}$/.test(e.heard_date || "") ? e.heard_date : "", notes: str(e.notes, LIMIT.notes) };
  }

  function openFile(file, status) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      var data;
      try { data = JSON.parse(String(fr.result)); } catch (e) { data = null; }
      if (!data || data.kind !== KIND || !Array.isArray(data.entries)) { status.textContent = "Ese archivo no es un registro guardado desde este sitio."; return; }
      loadData(data);
      logView();
    };
    fr.onerror = function () { status.textContent = "No se pudo leer ese archivo."; };
    fr.readAsText(file);
  }

  function loadData(data) {
    s.entries = (data.entries || []).map(clean).filter(Boolean).slice(0, 200);
    s.letters = (Array.isArray(data.letters) ? data.letters : []).filter(function (l) { return l && typeof l.title === "string" && Array.isArray(l.dates); }).slice(0, 50).map(function (l) {
      return { title: l.title.slice(0, 160), notice_date: /^\d{4}-\d{2}-\d{2}$/.test(l.notice_date || "") ? l.notice_date : "", added: String(l.added || "").slice(0, 10),
        dates: l.dates.filter(function (d) { return d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || ""); }).slice(0, 20).map(function (d) { return { label: String(d.label || "").slice(0, 160), date: d.date }; }) };
    });
  }

  /* Every date in one list: each letter's own dates (never merged), what was sent, and what came back. */
  function timeline() {
    var rows = [];
    s.letters.forEach(function (l) {
      if (l.notice_date) rows.push({ date: l.notice_date, kind: "letter", text: l.title + ": fecha de la carta" });
      l.dates.forEach(function (d) { rows.push({ date: d.date, kind: "due", text: l.title + ": " + d.label }); });
    });
    s.entries.forEach(function (e) {
      rows.push({ date: e.sent, kind: "sent", text: sentence(e).replace(/^El [^,]+, /, "") });
      if (e.heard !== "none" && e.heard_date) rows.push({ date: e.heard_date, kind: "heard", text: label(HEARD, e.heard) + ": " + label(WHAT, e.what).toLowerCase() });
    });
    return rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  function nextDue() { return timeline().filter(function (r) { return r.kind === "due" && since(r.date) <= 0; })[0] || null; }

  /* A one-page plan; the caregiver copy lets the person choose what to share. */
  function planText(opts) {
    var due = nextDue(), out = ["MI PLAN DE UNA PÁGINA", "Hecho el " + U.niceDate(today()) + " con una herramienta independiente. No viene de ninguna agencia.", ""];
    out.push("PRÓXIMA ACCIÓN: " + (due ? due.text + ", a más tardar el " + U.niceDate(due.date) + " (" + (-since(due.date)) + " días desde hoy)" : "No hay ninguna fecha próxima en este registro."));
    if (opts.letters) { out.push("", "CARTAS"); s.letters.forEach(function (l) { out.push("- " + l.title + (l.notice_date ? " con fecha del " + U.niceDate(l.notice_date) : "")); l.dates.forEach(function (d) { out.push("    " + d.label + ": " + U.niceDate(d.date)); }); }); }
    if (opts.sent) { out.push("", "LO QUE SE HA ENVIADO"); s.entries.forEach(function (e) { out.push("- " + sentence(e) + (opts.proof && e.proof ? " Prueba: " + e.proof + "." : "")); }); }
    if (opts.notes) { var n = s.entries.filter(function (e) { return e.notes; }); if (n.length) { out.push("", "NOTAS"); n.forEach(function (e) { out.push("- " + e.notes); }); } }
    var qs = questions(s.entries); if (opts.questions && qs.length) { out.push("", "PARA PREGUNTAR EN LA PRÓXIMA LLAMADA"); qs.forEach(function (q, i) { out.push((i + 1) + ". " + q); }); }
    return out.join("\r\n");
  }

  function planView() {
    var opts = { letters: true, sent: true, proof: true, notes: true, questions: true };
    var box = h("pre", { class: "draft-text" });
    var redraw = function () { box.textContent = planText(opts).replace(/\r/g, ""); };
    var tick = function (k, text) { return h("label", { class: "tick", for: "plan_" + k }, h("input", { type: "checkbox", id: "plan_" + k, checked: "checked", on: { change: function (ev) { opts[k] = ev.target.checked; redraw(); } } }), h("span", { text: text })); };
    U.show(
      h("h1", { class: "long", text: "Su plan de una página" }),
      h("p", { class: "lead", text: "Arriba, la próxima acción y su fecha; después, lo que usted elija incluir. Para una copia que dará a alguien que le ayuda, desmarque lo que prefiera no compartir." }),
      h("fieldset", { class: "ticks" }, h("legend", { text: "Incluir" }), tick("letters", "Las cartas y sus fechas"), tick("sent", "Lo que se ha enviado"), tick("proof", "Números de prueba (rastreo, confirmación)"),
        tick("notes", "Mis notas"), tick("questions", "Preguntas para la próxima llamada")),
      h("div", { class: "draft" }, box),
      U.row(U.go("Imprimir", function () { window.print(); }), U.quiet("Descargar", function () { U.download("my-plan.txt", "text/plain", planText(opts)); }), U.quiet("Atrás", logView)));
    redraw();
  }

  function entryForm(index, problems) {
    problems = problems || {};
    var e = index === null ? { what: "appeal", about: "", sent: "", how: "mail", proof: "", heard: "none", heard_date: "", notes: "" } : s.entries[index];
    var f = h("form", { novalidate: "novalidate", on: { submit: function (ev) {
      ev.preventDefault();
      var got = {};
      ["what", "about", "sent", "how", "proof", "heard", "heard_date", "notes"].forEach(function (k) { got[k] = document.getElementById("rec_" + k).value.trim(); });
      var bad = {};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(got.sent)) bad.rec_sent = "Escriba el día en que lo envió o llamó.";
      else if (got.sent > today()) bad.rec_sent = "Ese día está en el futuro.";
      if (got.heard_date && got.sent && got.heard_date < got.sent) bad.rec_heard_date = "Esto es antes del día en que lo envió.";
      if (Object.keys(bad).length) { s.draft = got; entryForm(index, bad); return; }
      var clean_entry = clean(got);
      if (index === null) s.entries.push(clean_entry); else s.entries[index] = clean_entry;
      s.draft = null; logView();
    } } },
      U.field("rec_what", "¿Qué envió o pidió?", null, select(WHAT, (s.draft || e).what), problems),
      U.field("rec_about", "De qué se trataba", "Opcional. Por ejemplo: aviso de pago de más con fecha del 2 de noviembre de 2026.", h("input", { type: "text", maxlength: String(LIMIT.about), value: (s.draft || e).about }), problems),
      U.field("rec_sent", "Día en que lo envió o llamó", null, h("input", { type: "date", max: today(), value: (s.draft || e).sent }), problems),
      U.field("rec_how", "Cómo", null, select(HOW, (s.draft || e).how), problems),
      U.field("rec_proof", "Prueba que tiene", "Opcional. Un número de confirmación, la página de confirmación del fax, un recibo o un número de rastreo. No ponga ningún número de Seguro Social ni de Medicare.", h("input", { type: "text", maxlength: String(LIMIT.proof), value: (s.draft || e).proof }), problems),
      U.field("rec_heard", "¿Ya le respondieron?", null, select(HEARD, (s.draft || e).heard), problems),
      U.field("rec_heard_date", "Día en que le respondieron", "Opcional.", h("input", { type: "date", max: today(), value: (s.draft || e).heard_date }), problems),
      U.field("rec_notes", "Notas", "Opcional. Con quién habló y qué le dijeron.", h("textarea", { maxlength: String(LIMIT.notes) }, (s.draft || e).notes), problems),
      U.row(U.go(index === null ? "Agregar a mi registro" : "Guardar el cambio", null, "submit"), U.quiet("Atrás", function () { s.draft = null; if (s.entries.length) logView(); else start(); })));
    U.show(h("h1", { text: index === null ? "¿Qué envió?" : "Cambiar esta entrada" }),
      Object.keys(problems).length ? h("div", { class: "alert", role: "alert", text: "Hay algo que corregir." }) : null, f);
    var bad = document.querySelector("[aria-invalid=true]"); if (bad) bad.focus();
  }

  function sentence(e) {
    var what = label(WHAT, e.what).toLowerCase() + (e.about ? " (" + e.about + ")" : "");
    return e.how === "phone" ? "El " + U.niceDate(e.sent) + ", llamé por " + what + "." : "El " + U.niceDate(e.sent) + ", envié " + what + " " + label(HOW, e.how).toLowerCase() + ".";
  }

  function questions(list) {
    return list.filter(function (e) { return e.heard !== "decided"; }).map(function (e) {
      var q = sentence(e) + (e.proof ? " Mi prueba es: " + e.proof + "." : "");
      q += e.heard === "more" ? " Ustedes pidieron más información" + (e.heard_date ? " el " + U.niceDate(e.heard_date) : "") + ". ¿Pueden confirmar qué falta todavía y cuál es la fecha límite?" : e.heard === "received" ? " Ustedes confirmaron que lo recibieron" + (e.heard_date ? " el " + U.niceDate(e.heard_date) : "") + ". ¿Cuándo puedo esperar una decisión?" : " ¿Pueden confirmar que lo recibieron y decirme en qué estado está?";
      var n = since(e.sent);
      return q + (n > 30 ? " Han pasado " + n + " días." : "");
    });
  }

  function sorted() { return s.entries.map(function (e, i) { return { e: e, i: i }; }).sort(function (a, b) { return a.e.sent < b.e.sent ? -1 : a.e.sent > b.e.sent ? 1 : 0; }); }

  function asText() {
    var out = ["MI REGISTRO DE LO QUE ENVIÉ", "Hecho el " + U.niceDate(today()) + " con una herramienta independiente. No viene de ninguna agencia.", ""];
    sorted().forEach(function (x) {
      var e = x.e;
      out.push(sentence(e), "  Prueba: " + (e.proof || "ninguna anotada"), "  Respuesta: " + label(HEARD, e.heard) + (e.heard_date ? " (" + U.niceDate(e.heard_date) + ")" : ""));
      if (e.notes) out.push("  Notas: " + e.notes);
      out.push("");
    });
    var qs = questions(s.entries);
    if (qs.length) { out.push("PREGUNTAS PARA MI PRÓXIMA LLAMADA"); qs.forEach(function (q, i) { out.push((i + 1) + ". " + q); }); }
    return out.join("\r\n");
  }

  function logView() {
    var waiting = s.entries.filter(function (e) { return e.heard !== "decided"; });
    var asked = s.entries.some(function (e) { return (e.what === "appeal" || e.what === "waiver") && e.heard !== "decided"; });
    var qs = questions(s.entries);
    var tl = timeline(), due = nextDue();
    U.show(
      h("h1", { text: "Su registro" }),
      h("p", { class: "lead", text: "Este sitio no lo ha guardado. Descárguelo antes de cerrar esta página, y guarde con él su prueba de envío." }),
      due ? h("div", { class: "next" }, h("b", { text: "Próxima fecha: " + U.niceDate(due.date) + ". " }), due.text + ".") : null,
      tl.length ? [h("h2", { text: "Cronología" }), h("ol", { class: "timeline" }, tl.map(function (r) {
        var n = since(r.date);
        return h("li", { class: "tl-" + r.kind + (r.kind === "due" && n > 0 ? " past" : "") }, h("b", { text: U.niceDate(r.date) }), " ", r.text,
          r.kind === "due" ? h("span", { class: "small", text: n > 0 ? " (ya pasó)" : (n === 0 ? " (hoy)" : " (" + (-n) + " días restantes)") }) : null);
      })), s.letters.length ? h("p", { class: "small", text: "Cada carta conserva sus propias fechas. Una carta posterior se agrega al lado de la anterior y nunca reemplaza sus fechas." }) : null] : null,
      s.entries.length ? h("h2", { text: "Lo que envió" }) : null,
      sorted().map(function (x) {
        var e = x.e, n = since(e.sent);
        return h("div", { class: "opt" },
          h("h3", { text: label(WHAT, e.what) }),
          h("p", { text: "Enviado el " + U.niceDate(e.sent) + ", " + label(HOW, e.how).toLowerCase() + "." + (e.about ? " Sobre: " + e.about + "." : "") }),
          h("p", { class: "small", text: "Prueba: " + (e.proof || "ninguna anotada") + "." }),
          h("p", {}, h("b", { text: e.heard === "none" ? "Todavía sin respuesta. " + n + (n === 1 ? " día" : " días") + " desde que lo envió." : label(HEARD, e.heard) + (e.heard_date ? " el " + U.niceDate(e.heard_date) : "") + "." })),
          (function () { var nx = NEXT[e.heard](e); return h("p", { class: "next" }, "Siguiente paso: " + nx[0] + " ", nx[1] ? h("a", { href: nx[1][0], text: nx[1][1] }) : null); })(),
          e.heard !== "decided" ? h("p", {}, h("button", { class: "copy", type: "button", text: "Ya me respondieron", on: { click: function () { heardBack(x.i); } } })) : null,
          e.notes ? h("p", { class: "small", text: "Notas: " + e.notes }) : null,
          h("p", {}, h("button", { class: "copy", type: "button", text: "Cambiar", on: { click: function () { entryForm(x.i); } } }), " ",
            h("button", { class: "copy", type: "button", text: "Quitar", on: { click: function () { s.entries.splice(x.i, 1); if (s.entries.length || s.letters.length) logView(); else start(); } } })));
      }),
      qs.length ? [h("h2", { text: "Preguntas para su próxima llamada" }), h("ol", {}, qs.map(function (q) { return h("li", { text: q }); })),
        h("p", { class: "small", text: "En la llamada, anote la fecha, el nombre de la persona y lo que le dijeron, y después agréguelo aquí." })] : (s.entries.length ? h("p", { text: "Todo lo que está en su registro ya tiene una decisión." }) : null),
      asked ? h("p", {}, "Si pidió una apelación o una exención (waiver) dentro de los 30 días de un aviso de pago de más, el Seguro Social dice que no cobrará hasta que decida. Si el cobro empieza de todos modos, llame, diga el día en que envió su solicitud y lea su prueba. ",
        U.link("https://www.ssa.gov/manage-benefits/resolve-overpayment", "Fuente")) : null,
      U.row(U.go(s.entries.length ? "Agregar otra cosa que envió" : "Agregar algo que envió", function () { entryForm(null); }),
        U.quiet("Descargar para guardar", function () { U.count("filed-log", "kit"); U.download("my-record.txt", "text/plain", asText()); }),
        U.quiet("Guardar una copia para abrirla aquí después", function () { U.download("my-record.json", "application/json", JSON.stringify({ kind: KIND, version: 2, saved: today(), entries: s.entries, letters: s.letters }, null, 1)); }),
        U.quiet("Hacer un plan de una página", planView),
        U.quiet("Imprimir", function () { window.print(); }), U.quiet("Atrás", U.home)),
      waiting.length ? null : null);
  }

  /* "I heard back": one question, then the record shows the next step. */
  function heardBack(i) {
    var e = s.entries[i];
    U.show(
      h("h1", { class: "long", text: "¿Qué le respondieron?" }),
      h("p", { class: "lead", text: sentence(e) }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault();
        var v = U.picked("heard"); if (!v) return;
        e.heard = v; e.heard_date = document.getElementById("heard_on").value || today();
        logView();
      } } },
        U.choice("heard", "Elija una", HEARD.filter(function (x) { return x[0] !== "none"; }), e.heard === "none" ? "" : e.heard),
        U.field("heard_on", "Cuándo", null, h("input", { type: "date", max: today(), value: e.heard_date || today() })),
        U.row(U.go("Guardar", null, "submit"), U.quiet("Atrás", logView))));
  }

  window.Modules = window.Modules || {};
  window.Modules.log = { start: start };
})();
