/* How did Social Security get this amount? The person copies the month-by-month
   figures from an overpayment notice; the program adds them up, names what is
   missing, and lists questions to ask. It never fills in a missing figure. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var s;
  function blank() { return { date: "", rows: [{ from: "", to: "", paid: "", due: "" }], stated_total: "", repaid: "" }; }
  function money(v) { return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function start() {
    s = { letters: [blank()], result: null };
    U.count("check-amount", "start"); U.setDatebar(null);
    form(0);
  }

  function collect(li) {
    var L = s.letters[li], tag = li === 0 ? "a" : "b";
    L.rows.forEach(function (r, i) {
      ["from", "to", "paid", "due"].forEach(function (k) { r[k] = document.getElementById(tag + (i + 1) + "_" + k).value; });
    });
    L.date = document.getElementById(tag + "_date").value;
    L.stated_total = document.getElementById(tag + "_total").value;
    L.repaid = document.getElementById(tag + "_repaid").value;
  }

  function cell(id, label, hint, value, mode, problems) {
    return h("div", { class: "cell" }, U.field(id, label, hint, h("input", { type: "text", inputmode: mode, autocomplete: "off", value: value || "" }), problems));
  }

  function form(li, problems) {
    problems = problems || {};
    var L = s.letters[li], tag = li === 0 ? "a" : "b";
    var periods = L.rows.map(function (r, i) {
      var key = tag + (i + 1) + "_";
      return h("fieldset", { class: "period" }, h("legend", { text: "Period " + (i + 1) }),
        h("div", { class: "pair" }, cell(key + "from", "First month", "Like 02/2023", r.from, "numeric", problems), cell(key + "to", "Last month", "Like 11/2023", r.to, "numeric", problems)),
        h("div", { class: "pair" }, cell(key + "paid", "Paid each month", "What Social Security paid you", r.paid, "decimal", problems),
          cell(key + "due", "Should have been paid each month", "Leave empty if the notice does not say", r.due, "decimal", problems)),
        L.rows.length > 1 ? h("button", { class: "copy", type: "button", text: "Remove period " + (i + 1), on: { click: function () { collect(li); L.rows.splice(i, 1); form(li); } } }) : null);
    });
    var f = h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); collect(li); check(); } } },
      U.field(tag + "_date", "Date printed on the notice", "Optional.", h("input", { type: "date", value: L.date }), problems),
      periods,
      L.rows.length < 36 ? U.row(U.quiet("Add another period", function () { collect(li); L.rows.push({ from: "", to: "", paid: "", due: "" }); form(li); document.getElementById(tag + L.rows.length + "_from").focus(); })) : null,
      U.field(tag + "_total", "Total overpayment the notice states", "Optional. Copy the total exactly as it is printed.", h("input", { type: "text", inputmode: "decimal", autocomplete: "off", value: L.stated_total }), problems),
      U.field(tag + "_repaid", "Already repaid or withheld, if you know", "Optional. It is kept apart from the original overpayment.", h("input", { type: "text", inputmode: "decimal", autocomplete: "off", value: L.repaid }), problems),
      U.row(U.go("Check the figures", null, "submit"),
        li === 0 ? U.quiet("Fill in Social Security's own example", example) : null,
        U.quiet("Back", function () { if (li === 1) { s.letters.pop(); if (s.result) result(); else form(0); } else U.home(); })));
    U.show(
      h("h1", { class: "long", text: li === 0 ? "How did Social Security get this amount?" : "Figures from the second letter" }),
      h("p", { class: "lead", text: li === 0 ? "An overpayment notice should show, period by period, what Social Security paid you each month and what it should have paid. Copy those figures here. Leave a box empty if the notice does not give that figure."
        : "Copy the same kind of figures from the second letter. The two will be compared side by side." }),
      Object.keys(problems).length ? h("div", { class: "alert", role: "alert", text: "Some figures need fixing before they can be checked." }) : null,
      f);
    var bad = document.querySelector("[aria-invalid=true]"); if (bad) bad.focus();
  }

  function example() {
    var ex = U.meta().amount_example;
    s.letters[0] = { date: "", rows: ex.rows.map(function (r) { return { from: r.from, to: r.to, paid: String(r.paid), due: String(r.due) }; }), stated_total: String(ex.stated_total), repaid: "" };
    form(0);
  }

  function check() {
    var body = { letters: s.letters.map(function (L) { return { date: L.date, rows: L.rows, stated_total: L.stated_total, repaid: L.repaid }; }) };
    U.api("/api/amount", body).then(function (res) {
      if (!res.ok) {
        var p = res.data.problems || {}, keys = Object.keys(p);
        form(keys.some(function (k) { return k.charAt(0) === "b"; }) && !keys.some(function (k) { return k.charAt(0) === "a"; }) ? 1 : 0, p);
        return;
      }
      s.result = res.data; U.count("check-amount", "dates"); result();
    }).catch(U.failed);
  }

  function letterBlock(L, title) {
    var head = h("tr", {}, ["Period", "Months", "Paid", "Should have been paid", "Difference"].map(function (t) { return h("th", { text: t }); }));
    var body = L.rows.map(function (r) {
      return h("tr", {}, h("td", { text: r.period }), h("td", { class: "num", text: String(r.months) }),
        h("td", { class: "num", text: r.paid === null ? "Not given" : money(r.paid) }), h("td", { class: "num", text: r.due === null ? "Not given" : money(r.due) }),
        h("td", { class: "num", text: r.difference === null ? "Cannot tell" : money(r.difference) }));
    });
    if (L.totals) body.push(h("tr", { class: "total" }, h("td", { text: "All periods" }), h("td", {}), h("td", { class: "num", text: money(L.totals.paid) }), h("td", { class: "num", text: money(L.totals.due) }), h("td", { class: "num", text: money(L.totals.overpaid) })));
    return [title ? h("h2", { text: title }) : h("h2", { text: "The months on the notice" }),
      h("div", { class: "table-wrap" }, h("table", { class: "plain" }, head, body)),
      L.compare ? h("p", {}, h("b", { text: L.compare.text })) : null,
      L.findings.length ? h("ul", { class: "findings" }, L.findings.map(function (f) { return h("li", { text: f.text }); })) : null,
      L.repaid ? h("p", { text: L.repaid.text }) : null];
  }

  function text(r) {
    var out = ["HOW DID SOCIAL SECURITY GET THIS AMOUNT?", "", r.headline];
    r.letters.forEach(function (L, i) {
      out.push("", r.letters.length > 1 ? (i === 0 ? "FIRST LETTER" : "SECOND LETTER") : "THE MONTHS ON THE NOTICE");
      L.rows.forEach(function (x) { out.push("- " + x.period + " (" + x.months + " months): paid " + (x.paid === null ? "not given" : money(x.paid)) + ", should have been paid " + (x.due === null ? "not given" : money(x.due)) + ", difference " + (x.difference === null ? "cannot tell" : money(x.difference))); });
      if (L.totals) out.push("All periods: paid " + money(L.totals.paid) + ", should have been paid " + money(L.totals.due) + ", overpaid " + money(L.totals.overpaid));
      if (L.compare) out.push(L.compare.text);
      L.findings.forEach(function (f) { out.push("* " + f.text); });
      if (L.repaid) out.push(L.repaid.text);
    });
    if (r.compared) { out.push("", "WHAT DIFFERS BETWEEN THE TWO LETTERS"); r.compared.found.forEach(function (x) { out.push("- " + x); }); }
    out.push("", "QUESTIONS TO ASK SOCIAL SECURITY"); r.questions.forEach(function (q, i) { out.push((i + 1) + ". " + q); });
    out.push("", "You can still appeal, ask for a waiver, or ask to pay back less each month.", "", r.disclaimer);
    return out.join("\r\n");
  }

  function result() {
    U.count("check-amount", "kit");
    var r = s.result;
    U.show(
      h("h1", { class: "long", text: r.headline }),
      h("p", { class: "lead", text: r.rules.notice_contents.plain }),
      r.letters.map(function (L, i) { return letterBlock(L, r.letters.length > 1 ? (i === 0 ? "First letter" : "Second letter") : null); }),
      r.compared ? [h("h2", { text: "What differs between the two letters" }), h("ul", { class: "findings" }, r.compared.found.map(function (x) { return h("li", { text: x }); }))] : null,
      h("h2", { text: "Questions to ask Social Security" }),
      h("ol", {}, r.questions.map(function (q) { return h("li", { text: q }); })),
      h("p", { class: "small" }, r.rules.explanation.plain + " ", U.link(r.rules.explanation.source, "Source")),
      h("h2", { text: "Your options still apply" }),
      h("p", { text: "Whatever the figures show, you can still appeal, ask for a waiver if the overpayment was not your fault, or ask to pay back less each month. Each has its own time limit." }),
      h("p", {}, h("a", { href: "#overpayment", text: "See your dates and what you can ask for" })),
      h("p", { class: "small" }, r.rules.audit.plain + " ", U.link(r.rules.audit.source, "Source"), ". " + r.disclaimer + " Rules checked as of " + r.rules_as_of + "."),
      U.row(U.go("Print or save as PDF", function () { window.print(); }), U.quiet("Download as text", function () { U.download("overpayment-figures.txt", "text/plain", text(r)); }),
        s.letters.length < 2 ? U.quiet("Compare with a second letter", function () { s.letters.push(blank()); form(1); }) : null,
        U.quiet("Change the figures", function () { form(0); })));
  }

  window.Modules = window.Modules || {};
  window.Modules.amount = { start: start };
})();
