/* Built by tools/make_es_js.py from frontend/wic.js. Do not edit: change the English file or tools/es_js_text.py. */
/* Practise a first WIC grocery trip: two short puzzles with an invented balance, using
   Florida WIC's size rules. Nothing about the person is needed and nothing is sent. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var SCENES = [
    { id: "cereal", title: "Su saldo de cereal es de 36 oz. Su caja de siempre, de 36 oz, está agotada.", balance: 36, rule: "cereal",
      items: [["Hojuelas de salvado, 12 oz", 12, true], ["Aros de avena, 18 oz", 18, true], ["Hojuelas de maíz, 24 oz", 24, true], ["Cuadritos de trigo, 14 oz", 14, true], ["Bocaditos de granola, 8 oz", 8, false, "Demasiado pequeño: el cereal de WIC debe ser de 9 oz o más."], ["Cereal multigrano, 20.3 oz", 20.3, true]],
      goal: "Elija cajas que sumen 36 oz o menos. Trate de usar lo más que pueda de las 36 oz." },
    { id: "bread", title: "Su saldo de granos integrales es de 16 oz. Usted quiere pan.", balance: 16, rule: "whole_grain",
      items: [["Pan 100% de trigo integral, 16 oz", 16, true], ["Pan 100% de trigo integral, 20 oz", 20, true], ["Panecillos de trigo integral, 8 oz", 8, false, "Demasiado pequeño: los granos integrales de WIC deben ser de 12 a 42 oz."], ["Pan blanco, 16 oz", 16, false, "No es un grano integral, así que no cuenta como granos integrales de WIC."]],
      goal: "Elija lo que puede comprar con un saldo de 16 oz." }
  ];
  var s;

  function start() { s = { n: 0, picked: [] }; U.count("wic-practice", "start"); U.trying(); U.setDatebar(null); scene(); }

  function scene(msg) {
    var sc = SCENES[s.n], rule = U.meta().wic[sc.rule];
    var used = s.picked.reduce(function (a, i) { return a + sc.items[i][1]; }, 0);
    U.show(
      h("p", { class: "small", text: "Práctica " + (s.n + 1) + " de " + SCENES.length + ". El saldo y los productos son inventados." }),
      h("h1", { class: "long", text: sc.title }),
      h("p", { class: "lead", text: sc.goal }),
      h("p", { class: "status", role: "status", text: "Usó " + round(used) + " oz de " + sc.balance + " oz. Quedan: " + round(sc.balance - used) + " oz." }),
      msg ? h("div", { class: msg.bad ? "alert" : "lead", role: "alert", text: msg.text }) : null,
      h("ul", { class: "ways" }, sc.items.map(function (it, i) {
        var on = s.picked.indexOf(i) >= 0;
        return h("li", {}, h("button", { class: "way", type: "button", "aria-pressed": on ? "true" : "false", on: { click: function () { pick(i); } } },
          h("b", { text: (on ? "En su carrito: " : "") + it[0] }), h("span", { text: on ? "Toque para devolverlo." : "Toque para ponerlo en su carrito." })));
      })),
      U.row(U.go("Revisar mi carrito", done), U.quiet("Empezar esta otra vez", function () { s.picked = []; scene(); }), U.quiet("Salir de la práctica", U.home)),
      h("p", { class: "small" }, rule.plain + " ", U.link(rule.source, "Fuente")));
  }

  function round(v) { return Math.round(v * 10) / 10; }

  function pick(i) {
    var sc = SCENES[s.n], at = s.picked.indexOf(i);
    if (at >= 0) { s.picked.splice(at, 1); scene(); return; }
    var it = sc.items[i];
    if (!it[2]) { scene({ bad: true, text: it[0] + ": " + it[3] }); return; }
    var used = s.picked.reduce(function (a, j) { return a + sc.items[j][1]; }, 0);
    if (used + it[1] > sc.balance) { scene({ bad: true, text: it[0] + " se pasaría de su saldo por " + round(used + it[1] - sc.balance) + " oz. En la caja, WIC no lo cubriría." }); return; }
    s.picked.push(i); scene();
  }

  function done() {
    var sc = SCENES[s.n], used = s.picked.reduce(function (a, i) { return a + sc.items[i][1]; }, 0), left = round(sc.balance - used);
    var best = bestFit(sc);
    var text = left === 0 ? "Usó todas las " + sc.balance + " oz. No se desperdicia nada." :
      "Le quedan " + left + " oz." + (best > used ? " Lo más cerca que podía llegar era " + round(best) + " oz. Las onzas que no use antes del fin de mes se pierden." : " Eso es lo más cerca que permiten estos productos.");
    U.count("wic-practice", s.n === SCENES.length - 1 ? "kit" : "dates");
    U.show(
      h("h1", { class: "long", text: left === 0 ? "Bien hecho" : "Su carrito" }),
      h("p", { class: "lead", text: text }),
      h("p", {}, U.meta().wic.family.plain + " ", U.link(U.meta().wic.family.source, "Fuente")),
      h("p", {}, U.meta().wic.check.plain + " ", U.link(U.meta().wic.check.source, "Fuente")),
      U.row(s.n < SCENES.length - 1 ? U.go("Siguiente práctica", function () { s.n += 1; s.picked = []; scene(); }) : U.go("Terminar", U.home),
        U.quiet("Probar esta otra vez", function () { s.picked = []; scene(); })));
  }

  function bestFit(sc) {
    var ok = sc.items.filter(function (it) { return it[2]; }).map(function (it) { return it[1]; }), best = 0;
    (function walk(i, sum) { if (sum > sc.balance + 1e-9) return; if (sum > best) best = sum; for (var j = i; j < ok.length; j++) walk(j + 1, sum + ok[j]); })(0, 0);
    return best;
  }

  window.Modules = window.Modules || {};
  window.Modules.wic = { start: start, bestFit: bestFit, SCENES: SCENES };
})();
