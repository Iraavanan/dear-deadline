/* Benefit math check: re-works a retired worker's first monthly benefit from the earnings record and
   sets it beside the amount on the award letter. Offered only inside the range the reference program
   has been tested on; outside it no figure is shown. Nothing is saved. */
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI || !window.Modules || !window.Modules.fixes) return;
  var U = window.UI, h = U.h, K = window.Modules.fixes.kit;
  var flow = K.flow, tail = K.tail, plain = K.plain, input = K.input, val = K.val, steps = K.steps;
  var YN = [["no", "No"], ["yes", "Yes"]];
  var NAMES = { "earnings-record": "Is a year missing from my earnings record?", "amount-changed": "My benefit amount changed", "ssa-call": "I can't reach anyone at Social Security", "decision-appeal": "My claim was denied, or I disagree with a decision" };

  function sample() {
    var lines = [], pay = 18500;
    for (var y = 1986; y <= 2025; y++) { lines.push(y + "  " + Math.round(pay)); pay *= 1.035; }
    return lines.join("\n");
  }

  var math = flow({
    module: "benefit-math", api: "/api/benefit-math", button: "Work it out",
    title: "Check how my retirement benefit was worked out",
    lead: "Enter the earnings from your Social Security Statement and see the benefit the rules give, step by step, beside the amount on your award letter. This works only for a retirement benefit that started in 2026.",
    draw: function (s, p) {
      return [U.field("birth", "Your date of birth", null, input("date", s.birth), p),
        U.field("start", "Month your retirement benefit started", "It is on your award letter. This check covers January to November 2026.", input("month", s.start), p),
        U.choice("kind", "Which benefit is it?", [["own", "My own retirement benefit, from my own work"], ["other", "A benefit as a husband, wife, widow, widower or child"]], s.kind, p),
        U.choice("disability", "Have you ever had Social Security disability benefits?", YN, s.disability || "no", p),
        U.choice("military", "Were you on active military duty before 2002?", YN, s.military || "no", p),
        U.field("earnings", "Your earnings, one year on each line", "Type the year, then the amount, from the earnings record on your Social Security Statement. For example: 1998 31,250. Use the column for Social Security, not Medicare.",
          h("textarea", { rows: "12", spellcheck: "false" }, s.earnings || ""), p),
        U.field("stated", "Monthly amount on your award letter", "Optional. The amount before Medicare premiums or anything else is taken out.", input("money", s.stated), p)];
    },
    read: function () { return { birth: val("birth"), start: val("start"), kind: U.picked("kind"), disability: U.picked("disability"), military: U.picked("military"), earnings: val("earnings"), stated: val("stated") }; },
    example: function () { return { birth: "1964-01-02", start: "2026-01", kind: "own", disability: "no", military: "no", earnings: sample(), stated: "" }; },
    show: function (r, s, back) {
      U.count("benefit-math", "kit");
      var links = h("p", {}, r.links.map(function (l, i) { return [i ? " · " : "", h("a", { href: "#" + l, text: NAMES[l] || l })]; }));
      if (!r.checked) {
        U.show(h("h1", { class: "long", text: r.headline }), h("p", { class: "lead", text: r.reason }),
          h("h2", { text: "What you can do instead" }), steps(r.steps), links,
          tail(r, "benefit-check.txt", function (r) { return plain(r, [["WHY", r.reason], ["WHAT YOU CAN DO", r.steps]]); }, [U.quiet("Change my answers", back)]));
        return;
      }
      U.show(h("h1", { class: "long", text: r.headline }),
        r.stated !== null ? h("table", { class: "plain" },
          h("tr", {}, h("th", { scope: "row", text: "On your letter" }), h("td", { class: "num", text: K.money(r.stated) })),
          h("tr", {}, h("th", { scope: "row", text: "From these earnings" }), h("td", { class: "num", text: K.money(r.benefit) })),
          h("tr", {}, h("th", { scope: "row", text: "Difference" }), h("td", { class: "num", text: K.money(Math.abs(r.difference)) + (r.difference > 0 ? " more on the letter" : r.difference < 0 ? " less on the letter" : "") }))) : null,
        h("h2", { text: "The working, step by step" }),
        h("table", { class: "plain" }, r.work.map(function (w) { return h("tr", {}, h("th", { scope: "row", text: w.label }), h("td", { class: "num", text: w.value })); })),
        h("p", { class: "small", text: "Years counted: " + r.years_used.join(", ") + "." }),
        r.notes.length ? h("ul", { class: "small" }, r.notes.map(function (n) { return h("li", { text: n }); })) : null,
        h("h2", { text: "What you can do" }), steps(r.steps), links,
        tail(r, "benefit-check.txt", function (r) { return plain(r, [["THE WORKING", r.work.map(function (w) { return w.label + ": " + w.value; })], ["YEARS COUNTED", r.years_used.join(", ")], ["NOTES", r.notes], ["WHAT YOU CAN DO", r.steps]]); },
          [U.quiet("Change my figures", back)]));
    }
  });

  window.Modules.benefitmath = { start: math.start };
})();
