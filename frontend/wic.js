/* Practise a first WIC grocery trip: two short puzzles with an invented balance, using
   Florida WIC's size rules. Nothing about the person is needed and nothing is sent. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var SCENES = [
    { id: "cereal", title: "Your cereal balance is 36 oz. Your usual 36 oz box is sold out.", balance: 36, rule: "cereal",
      items: [["Bran flakes, 12 oz", 12, true], ["Oat circles, 18 oz", 18, true], ["Corn flakes, 24 oz", 24, true], ["Wheat squares, 14 oz", 14, true], ["Granola bites, 8 oz", 8, false, "Too small: WIC cereal must be 9 oz or more."], ["Multigrain cereal, 20.3 oz", 20.3, true]],
      goal: "Pick boxes that add up to 36 oz or less. Try to use as much of the 36 oz as you can." },
    { id: "bread", title: "Your whole grain balance is 16 oz. You want bread.", balance: 16, rule: "whole_grain",
      items: [["100% whole wheat bread, 16 oz", 16, true], ["100% whole wheat bread, 20 oz", 20, true], ["Whole wheat rolls, 8 oz", 8, false, "Too small: WIC whole grains must be 12 to 42 oz."], ["White bread, 16 oz", 16, false, "Not a whole grain, so not WIC whole grains."]],
      goal: "Pick what you can buy with a 16 oz balance." }
  ];
  var s;

  function start() { s = { n: 0, picked: [] }; U.count("wic-practice", "start"); U.trying(); U.setDatebar(null); scene(); }

  function scene(msg) {
    var sc = SCENES[s.n], rule = U.meta().wic[sc.rule];
    var used = s.picked.reduce(function (a, i) { return a + sc.items[i][1]; }, 0);
    U.show(
      h("p", { class: "small", text: "Practice " + (s.n + 1) + " of " + SCENES.length + ". The balance and the products are made up." }),
      h("h1", { class: "long", text: sc.title }),
      h("p", { class: "lead", text: sc.goal }),
      h("p", { class: "status", role: "status", text: "Used " + round(used) + " oz of " + sc.balance + " oz. Left: " + round(sc.balance - used) + " oz." }),
      msg ? h("div", { class: msg.bad ? "alert" : "lead", role: "alert", text: msg.text }) : null,
      h("ul", { class: "ways" }, sc.items.map(function (it, i) {
        var on = s.picked.indexOf(i) >= 0;
        return h("li", {}, h("button", { class: "way", type: "button", "aria-pressed": on ? "true" : "false", on: { click: function () { pick(i); } } },
          h("b", { text: (on ? "In your cart: " : "") + it[0] }), h("span", { text: on ? "Tap to put it back." : "Tap to put it in your cart." })));
      })),
      U.row(U.go("Check my cart", done), U.quiet("Start this one again", function () { s.picked = []; scene(); }), U.quiet("Leave the practice", U.home)),
      h("p", { class: "small" }, rule.plain + " ", U.link(rule.source, "Source")));
  }

  function round(v) { return Math.round(v * 10) / 10; }

  function pick(i) {
    var sc = SCENES[s.n], at = s.picked.indexOf(i);
    if (at >= 0) { s.picked.splice(at, 1); scene(); return; }
    var it = sc.items[i];
    if (!it[2]) { scene({ bad: true, text: it[0] + ": " + it[3] }); return; }
    var used = s.picked.reduce(function (a, j) { return a + sc.items[j][1]; }, 0);
    if (used + it[1] > sc.balance) { scene({ bad: true, text: it[0] + " would go over your balance by " + round(used + it[1] - sc.balance) + " oz. At the register, WIC would not cover it." }); return; }
    s.picked.push(i); scene();
  }

  function done() {
    var sc = SCENES[s.n], used = s.picked.reduce(function (a, i) { return a + sc.items[i][1]; }, 0), left = round(sc.balance - used);
    var best = bestFit(sc);
    var text = left === 0 ? "You used all " + sc.balance + " oz. Nothing is wasted." :
      "You have " + left + " oz left." + (best > used ? " The closest you could get was " + round(best) + " oz. Ounces you do not use by the end of the month are lost." : " That is as close as these products allow.");
    U.count("wic-practice", s.n === SCENES.length - 1 ? "kit" : "dates");
    U.show(
      h("h1", { class: "long", text: left === 0 ? "Well done" : "Your cart" }),
      h("p", { class: "lead", text: text }),
      h("p", {}, U.meta().wic.family.plain + " ", U.link(U.meta().wic.family.source, "Source")),
      h("p", {}, U.meta().wic.check.plain + " ", U.link(U.meta().wic.check.source, "Source")),
      U.row(s.n < SCENES.length - 1 ? U.go("Next practice", function () { s.n += 1; s.picked = []; scene(); }) : U.go("Finish", U.home),
        U.quiet("Try this one again", function () { s.picked = []; scene(); })));
  }

  function bestFit(sc) {
    var ok = sc.items.filter(function (it) { return it[2]; }).map(function (it) { return it[1]; }), best = 0;
    (function walk(i, sum) { if (sum > sc.balance + 1e-9) return; if (sum > best) best = sum; for (var j = i; j < ok.length; j++) walk(j + 1, sum + ok[j]); })(0, 0);
    return best;
  }

  window.Modules = window.Modules || {};
  window.Modules.wic = { start: start, bestFit: bestFit, SCENES: SCENES };
})();
