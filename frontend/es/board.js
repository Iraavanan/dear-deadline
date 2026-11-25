/* Built by tools/make_es_js.py from frontend/board.js. Do not edit: change the English file or tools/es_js_text.py. */
/* A deadline board for someone helping several people: nicknames, what is due and when.
   It lives only in this page and in a file the helper saves; this site keeps nothing. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var KIND = "benefits-letter-helper-board";
  var s = { rows: [] };

  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function left(iso) { return Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(today() + "T00:00:00Z")) / 864e5); }

  function start() {
    U.count("helper-board", "start"); U.setDatebar(null);
    if (window.__openBoard) { var d = window.__openBoard; window.__openBoard = null; if (Array.isArray(d.rows)) s.rows = d.rows.map(clean).filter(Boolean).slice(0, 500); }
    view();
  }

  function clean(r) {
    if (!r || typeof r !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(r.due || "")) return null;
    var str = function (v, n) { return typeof v === "string" ? v.slice(0, n) : ""; };
    return { who: str(r.who, 40), what: str(r.what, 200), due: r.due, done: r.done === true, next: str(r.next, 200) };
  }

  function view(problems) {
    problems = problems || {};
    var rows = s.rows.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) { return !x.r.done; }).sort(function (a, b) { return a.r.due < b.r.due ? -1 : 1; });
    var week = rows.filter(function (x) { return left(x.r.due) <= 7; });
    var status = h("p", { class: "status", role: "status" });
    U.show(
      h("h1", { class: "long", text: "Fechas límite de las personas a quienes ayuda" }),
      h("p", { class: "lead", text: "Para un voluntario, un navegador o un familiar que ayuda a varias personas. Use un apodo o iniciales, nunca un nombre completo ni ningún número. Esta página no guarda nada: guarde el tablero como un archivo y ábralo otra vez la próxima vez. En una computadora compartida, guárdelo en su propio dispositivo y cierre la pestaña." }),
      week.length ? h("div", { class: "alert", text: (week.length === 1 ? "1 fecha límite está dentro de 7 días o ya pasó." : week.length + " fechas límite están dentro de 7 días o ya pasaron.") }) : null,
      rows.length ? h("div", { class: "table-wrap" }, h("table", { class: "plain" },
        h("tr", {}, ["Vence", "Quién", "Qué", "Siguiente paso", ""].map(function (t) { return h("th", { text: t }); })),
        rows.map(function (x) {
          var n = left(x.r.due);
          return h("tr", {}, h("td", { class: "num" }, U.niceDate(x.r.due), h("br"), h("span", { class: "small", text: n < 0 ? "venció hace " + (-n) + " días" : (n === 0 ? "hoy" : "quedan " + n + " días") })),
            h("td", { text: x.r.who }), h("td", { text: x.r.what }), h("td", { text: x.r.next }),
            h("td", {}, h("button", { class: "copy", type: "button", text: "Hecho", on: { click: function () { x.r.done = true; view(); } } }), " ",
              h("button", { class: "copy", type: "button", text: "Quitar", on: { click: function () { s.rows.splice(x.i, 1); view(); } } })));
        }))) : h("p", { text: "Todavía no hay nada en el tablero." }),
      h("h2", { text: "Agregar una fecha límite" }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault();
        var r = { who: document.getElementById("b_who").value.trim(), what: document.getElementById("b_what").value.trim(), due: document.getElementById("b_due").value, next: document.getElementById("b_next").value.trim() };
        var bad = {};
        if (!r.who) bad.b_who = "Escriba un apodo o iniciales.";
        if (/\d{3}[-\s]?\d{2}[-\s]?\d{4}/.test(r.who + " " + r.what + " " + r.next)) bad.b_what = "No ponga números de Seguro Social, de caso ni de tarjeta.";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.due)) bad.b_due = "Escriba la fecha límite.";
        if (Object.keys(bad).length) { view(bad); return; }
        s.rows.push(clean(r)); U.count("helper-board", "dates"); view();
      } } },
        h("div", { class: "pair" }, h("div", { class: "cell" }, U.field("b_who", "Quién", "Solo un apodo o iniciales.", h("input", { type: "text", maxlength: "40", autocomplete: "off" }), problems)),
          h("div", { class: "cell" }, U.field("b_due", "Fecha límite", null, h("input", { type: "date" }), problems))),
        U.field("b_what", "Qué vence", "Por ejemplo: formulario de renovación de Medicaid, o entrevista de SNAP.", h("input", { type: "text", maxlength: "200", autocomplete: "off" }), problems),
        U.field("b_next", "Siguiente paso", "Opcional. Por ejemplo: llevar los talones de pago el martes.", h("input", { type: "text", maxlength: "200", autocomplete: "off" }), problems),
        U.row(U.go("Agregar al tablero", null, "submit"))),
      h("h2", { text: "Guardar o abrir un tablero" }),
      U.row(U.quiet("Guardar el tablero como archivo", function () { U.count("helper-board", "kit"); U.download("deadline-board.json", "application/json", JSON.stringify({ kind: KIND, version: 1, saved: today(), rows: s.rows }, null, 1)); }),
        U.quiet("Imprimir la lista de esta semana", function () { window.print(); }), U.quiet("Borrar el tablero", function () { s.rows = []; view(); }), U.quiet("Atrás", U.home)),
      h("label", { for: "boardfile" }, "Abrir un tablero guardado", h("span", { class: "hint", text: "El archivo se queda en este dispositivo." })),
      h("input", { id: "boardfile", type: "file", accept: ".json,application/json", on: { change: function (ev) {
        var f = ev.target.files && ev.target.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function () { var d; try { d = JSON.parse(String(fr.result)); } catch (e) { d = null; }
          if (!d || d.kind !== KIND || !Array.isArray(d.rows)) { status.textContent = "Ese archivo no es un tablero guardado desde este sitio."; return; }
          s.rows = d.rows.map(clean).filter(Boolean).slice(0, 500); view(); };
        fr.readAsText(f);
      } } }),
      status);
    U.firstProblem();
  }

  window.Modules = window.Modules || {};
  window.Modules.board = { start: start };
})();
