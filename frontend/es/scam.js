/* Built by tools/make_es_js.py from frontend/scam.js. Do not edit: change the English file or tools/es_js_text.py. */
/* "Is this message real?" A check against the warning signs the agencies and the FTC
   publish, for Social Security, Medicare, SNAP, Medicaid and housing help.
   Everything happens in the browser: the message is never sent. It never says a
   message is genuine. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var s;
  var PROGRAMS = [
    ["ssa", "Seguro Social"], ["medicare", "Medicare o un plan de Medicare"], ["snap", "SNAP, asistencia de alimentos o una tarjeta EBT"],
    ["medicaid", "Medicaid"], ["housing", "Sección 8, un vale de vivienda o una lista de espera de vivienda"], ["other", "Otra agencia, o no estoy seguro"]];
  var NAME = { ssa: "el Seguro Social", medicare: "Medicare", snap: "la oficina de SNAP", medicaid: "la agencia de Medicaid", housing: "la autoridad de vivienda", other: "la agencia" };
  var DE = { ssa: "del Seguro Social", medicare: "de Medicare", snap: "de SNAP", medicaid: "de Medicaid", housing: "de la autoridad de vivienda" };
  var REAL = {
    ssa: ["#find-letter", "Una carta verdadera del Seguro Social suele iniciar un plazo. Busque su carta y vea sus fechas"],
    medicare: ["#medicare-letter", "Un aviso verdadero de Medicare puede iniciar un plazo. Busque su carta de Medicare"],
    snap: ["/es#renovacion", "Un aviso verdadero de SNAP puede tener una fecha límite. Revise su renovación o el pedido de pruebas"],
    medicaid: ["/es#renovacion", "Una renovación verdadera de Medicaid tiene una fecha límite. Revísela antes de enviarla"],
    housing: ["/es#alquiler", "Si se trata de su alquiler, revise cómo lo calcularon"],
    other: ["/es", "Vea con qué puede ayudarle este sitio"]
  };
  function meta() { return U.meta().scam; }
  function signsFor(p) { return meta().signs.filter(function (x) { return x.programs.indexOf(p) >= 0; }); }

  function start() {
    s = { program: "", text: "", ticks: {} };
    U.count("is-it-real", "start"); U.setDatebar(null);
    pick();
  }

  function pick(problems) {
    U.show(
      h("h1", { class: "long", text: "¿No está seguro de que una carta, una llamada o un mensaje sea real?" }),
      h("p", { class: "lead", text: "Compárelo con las señales de advertencia que publican las propias agencias. Lo que usted escribe se queda en este dispositivo y no se envía a ningún lugar." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault(); s.program = U.picked("program");
        if (!s.program) { pick({ program: "Elija de quién dice ser el mensaje." }); return; }
        form();
      } } },
        U.choice("program", "¿De quién dice ser?", PROGRAMS, s.program, problems),
        U.row(U.go("Continuar", null, "submit"), U.quiet("Atrás", U.home))));
    U.firstProblem();
  }

  function form() {
    var box = h("textarea", { id: "message", class: "paste", spellcheck: "false" }, s.text);
    var list = signsFor(s.program);
    var ticks = list.map(function (sign) {
      return h("label", { class: "tick", for: "tick_" + sign.id }, h("input", { type: "checkbox", id: "tick_" + sign.id, checked: s.ticks[sign.id] ? "checked" : null }), h("span", { text: sign.ask }));
    });
    U.show(
      h("h1", { class: "long", text: s.program === "other" ? "Revise el mensaje" : "Revise un mensaje que dice ser " + DE[s.program] }),
      h("p", { class: "small", text: "Lo que usted escribe se queda en este dispositivo y no se envía a ningún lugar." }),
      h("label", { for: "message" }, "Pegue o escriba las palabras del mensaje", h("span", { class: "hint", text: "Una carta, un correo electrónico o un mensaje de texto. Déjelo vacío si fue una llamada o un sitio web, y use las casillas de abajo. La revisión automática de las palabras reconoce frases en inglés: si su mensaje está en español, marque también las casillas. Las direcciones web se revisan en cualquier idioma." })),
      box,
      h("fieldset", { class: "ticks" }, h("legend", { text: "Marque todo lo que pasó" }), ticks),
      U.row(U.go("Buscar señales de advertencia", function () {
        s.text = box.value;
        list.forEach(function (sign) { s.ticks[sign.id] = document.getElementById("tick_" + sign.id).checked; });
        result();
      }), U.quiet("Atrás", function () { pick(); })));
  }

  function words(sign) {
    var own = s.program === "ssa" || !sign.other;
    return { plain: own ? sign.plain : sign.other.plain, source: own ? sign.source : sign.other.source };
  }

  function result() {
    U.count("is-it-real", "kit");
    var redacted = window.NoticeReader.redact(s.text).text, found = {}, order = [];
    window.ScamCheck.scan(redacted, s.program).forEach(function (f) { found[f.id] = { quote: f.quote }; });
    signsFor(s.program).forEach(function (sign) {
      if (found[sign.id] || s.ticks[sign.id]) order.push({ sign: sign, quote: found[sign.id] ? found[sign.id].quote : null, ticked: s.ticks[sign.id] });
    });
    var a = meta().advice, p = s.program, n = order.length, gave = s.text.trim() || Object.keys(s.ticks).some(function (k) { return s.ticks[k]; });
    var verify = p === "ssa" ? a.verify : a["verify_" + p], report = p === "ssa" ? a.report : a["report_" + p];
    var steps = [h("li", { text: a.what_to_do.plain })];
    if (p === "ssa") steps.push(h("li", {}, a.verify.plain + " Seguro Social: " + a.verify.phone + " (TTY " + a.verify.tty + "), o entre a ", U.link(a.verify.account, "su cuenta my Social Security"), "."));
    else steps.push(h("li", {}, verify.plain + " ", verify.url ? U.link(verify.url, "Buscar el contacto") : null, verify.url ? "." : null));
    steps.push(h("li", {}, report.plain + " ", report.url ? U.link(report.url, p === "ssa" ? "Denunciarlo ante el Inspector General" : (report.url === a.report.ftc ? "Denunciarlo ante la Comisión Federal de Comercio (FTC)" : "Denunciarlo")) : null, ". ",
      report.url !== a.report.ftc ? [U.link(a.report.ftc, "Denunciarlo ante la Comisión Federal de Comercio (FTC)"), " también."] : null));
    U.show(
      h("h1", { class: "long", text: n ? (n === 1 ? "Se encontró 1 señal de advertencia" : "Se encontraron " + n + " señales de advertencia") : "No se encontraron señales de advertencia en lo que usted dio" }),
      n ? h("div", { class: "alert", role: "alert", text: "Trátelo como una estafa, a menos que " + NAME[p] + " lo confirme cuando usted mismo se comunique. No pague, no haga clic y no responda." })
        : h("p", { class: "lead", text: (gave ? "" : "No escribió nada para revisar. ") + "Esto no significa que el mensaje sea real. Una estafa puede evitar todas las señales de esta lista. Compruébelo usted mismo de la manera descrita abajo antes de hacer lo que el mensaje pide." }),
      n ? [h("h2", { text: "Lo que se encontró" }),
        h("ul", { class: "signs" }, order.map(function (o) {
          var w = words(o.sign);
          return h("li", {}, h("h3", { text: w.plain }),
            o.quote ? h("p", { class: "quote", text: o.quote }) : null,
            h("p", { class: "small" }, o.quote && o.ticked ? "Encontrado en el texto, y usted lo marcó. " : o.quote ? "Encontrado en el texto. " : "Usted marcó esto. ", U.link(w.source, "Fuente")));
        }))] : null,
      n === 1 ? h("p", { class: "small", text: "Una sola señal también puede aparecer en una carta verdadera. De todos modos es una razón para comprobarlo antes de hacer nada." }) : null,
      h("h2", { text: n ? "Qué hacer ahora" : "Cómo comprobarlo usted mismo" }),
      h("ol", {}, steps),
      h("h2", { text: "Si resulta que es real" }),
      h("p", {}, h("a", { href: REAL[p][0], text: REAL[p][1] }), "."),
      h("p", { class: "small", text: "Esta revisión busca solo las señales de advertencia que publican las agencias y la Comisión Federal de Comercio (FTC). No puede decirle que un mensaje es real, y no viene de ninguna agencia del gobierno. La traducción al español todavía no ha sido revisada por un traductor profesional. Reglas revisadas al " + U.meta().rules_as_of + "." }),
      U.row(U.go("Imprimir esta página", function () { window.print(); }), U.quiet("Revisar otro mensaje", start)));
  }

  window.Modules = window.Modules || {};
  window.Modules.scam = { start: start };
})();
