/* Housing rent check: redo the HUD rent arithmetic from the figures on a rent notice
   or rent calculation sheet. It never fills in a missing figure. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var s;
  var FIGS = ["annual_income", "dependent_deduction", "elderly_deduction", "medical_deduction", "childcare_deduction", "other_deduction",
    "adjusted_income", "ttp", "utility_allowance", "gross_rent", "payment_standard", "your_rent", "medical_costs", "childcare_costs", "income_now", "minimum_rent"];

  function blankSheet() { return { program: "", dependents: "", elderly_disabled: false, new_lease: false }; }
  function start() {
    s = { mode: "one", sheets: { one: blankSheet(), old: blankSheet(), new: blankSheet() }, cur: "one", result: null };
    s.f = s.sheets.one;
    U.count("rent-check", "start"); U.setDatebar(null);
    var back = U.takeResume("rent");
    if (back && back.sheets && (back.cur === "one" || back.cur === "old" || back.cur === "new")) {
      ["one", "old", "new"].forEach(function (k) { if (back.sheets[k] && typeof back.sheets[k] === "object") s.sheets[k] = Object.assign(blankSheet(), back.sheets[k]); });
      s.mode = back.mode === "compare" ? "compare" : "one"; s.cur = back.cur; s.f = s.sheets[s.cur]; form(); return;
    }
    U.show(
      h("h1", { class: "long", text: "Check how your housing rent was worked out" }),
      h("p", { class: "lead", text: "For a Housing Choice Voucher (Section 8) or public housing. Copy the figures from your rent notice or rent calculation sheet." }),
      h("ul", { class: "ways" },
        U.way("Check one rent sheet", "Redo the arithmetic and look for a missing deduction.", function () { s.mode = "one"; s.cur = "one"; s.f = s.sheets.one; form(); }),
        U.way("Why did my rent change?", "Compare your old and new rent sheets and see which figure moved.", function () { s.mode = "compare"; s.cur = "old"; s.f = s.sheets.old; form(); })),
      U.row(U.quiet("Back", U.home)));
  }

  function example() {
    U.trying();
    if (s.mode === "compare") {
      s.sheets.old = { program: "voucher", dependents: "2", elderly_disabled: false, new_lease: false, annual_income: "24000", dependent_deduction: "960", utility_allowance: "120", gross_rent: "1450", payment_standard: "1400", your_rent: "506" };
      s.sheets.new = { program: "voucher", dependents: "2", elderly_disabled: false, new_lease: false, annual_income: "30000", dependent_deduction: "", utility_allowance: "100", gross_rent: "1450", payment_standard: "1350", your_rent: "734" };
      compareCheck(); return;
    }
    s.f = s.sheets.one = { program: "voucher", dependents: "2", elderly_disabled: false, annual_income: "24000", dependent_deduction: "960", elderly_deduction: "", medical_deduction: "",
      childcare_deduction: "", other_deduction: "", adjusted_income: "23040", ttp: "576", utility_allowance: "120", gross_rent: "1450", payment_standard: "1400",
      your_rent: "506", medical_costs: "", childcare_costs: "2400", income_now: "", minimum_rent: "" };
    form();
  }

  function collect() {
    FIGS.forEach(function (k) { s.f[k] = document.getElementById(k).value; });
    s.f.program = U.picked("program"); s.f.dependents = document.getElementById("dependents").value;
    s.f.elderly_disabled = document.getElementById("elderly_disabled").checked;
    s.f.new_lease = document.getElementById("new_lease").checked;
  }

  function m(id, label, hint, problems) {
    return h("div", { class: "cell" }, U.field(id, label, hint, h("input", { type: "text", inputmode: "decimal", autocomplete: "off", value: s.f[id] || "" }), problems));
  }

  function form(problems) {
    problems = problems || {};
    var f = s.f;
    U.show(
      h("h1", { class: "long", text: s.cur === "old" ? "Your old rent sheet" : (s.cur === "new" ? "Your new rent sheet" : "Check how your housing rent was worked out") }),
      s.cur !== "one" ? h("p", { class: "small", text: s.cur === "old" ? "Step 1 of 2. Copy the figures from the rent sheet before the change." : "Step 2 of 2. Copy the same figures from the new rent sheet." }) : null,
      h("p", { class: "lead", text: "If you have a Housing Choice Voucher (Section 8) or live in public housing, your rent comes from a formula. Copy the figures from your rent notice or rent calculation sheet, and see whether they add up and whether a deduction is missing. Leave a box empty if your papers do not show it. If your papers show only the total tenant payment, you can enter that instead of the income." }),
      h("p", { class: "small", text: "This check runs on your device. The figures you type are not sent anywhere." }),
      h("p", { class: "small", text: "Not covered yet: rent set by a welfare payment for housing, prorated help for families where someone is not an eligible noncitizen, and flat rents in public housing." }),
      Object.keys(problems).length ? h("div", { class: "alert", role: "alert", text: "Some figures need fixing." }) : null,
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault(); collect();
        if (s.cur === "old") { s.cur = "new"; if (!s.sheets.new.program) s.sheets.new = Object.assign({}, s.sheets.old, { your_rent: "" }); s.f = s.sheets.new; form(); return; }
        if (s.cur === "new") { compareCheck(); return; }
        check();
      } } },
        U.choice("program", "What kind of help do you have?", [["voucher", "A Housing Choice Voucher (Section 8)"], ["public_housing", "Public housing"]], f.program, problems),
        h("h2", { text: "Your household" }),
        h("div", { class: "pair" }, h("div", { class: "cell" }, U.field("dependents", "Number of dependents", "Children under 18, and adults who are full-time students or have a disability, other than the head, spouse or co-head.", h("input", { type: "text", inputmode: "numeric", autocomplete: "off", value: f.dependents || "" }), problems)), h("div", {})),
        h("label", { class: "tick", for: "elderly_disabled" }, h("input", { type: "checkbox", id: "elderly_disabled", checked: f.elderly_disabled ? "checked" : null }),
          h("span", { text: "The head, spouse or co-head is 62 or older, or has a disability" })),
        h("h2", { text: "From your rent notice or calculation sheet" }),
        h("div", { class: "pair" }, m("annual_income", "Yearly income", "Total yearly income used for your rent.", problems), m("adjusted_income", "Adjusted yearly income", "After deductions, if shown.", problems)),
        h("div", { class: "pair" }, m("dependent_deduction", "Dependent deduction", null, problems), m("elderly_deduction", "Elderly or disabled family deduction", null, problems)),
        h("div", { class: "pair" }, m("medical_deduction", "Medical expense deduction", null, problems), m("childcare_deduction", "Child care deduction", null, problems)),
        h("div", { class: "pair" }, m("other_deduction", "Any other deduction", null, problems), m("ttp", "Total tenant payment (TTP)", "A monthly figure.", problems)),
        h("div", { class: "pair" }, m("utility_allowance", "Utility allowance", "Monthly. If you pay utilities yourself.", problems), m("your_rent", "Rent you pay each month", "What the notice says you pay.", problems)),
        h("div", { class: "pair" }, m("gross_rent", "Gross rent (vouchers)", "Rent to the owner plus the utility allowance.", problems), m("payment_standard", "Payment standard (vouchers)", null, problems)),
        h("div", { class: "pair" }, m("minimum_rent", "Minimum rent, if your notice mentions one", "At most $50.", problems), h("div", {})),
        h("label", { class: "tick", for: "new_lease" }, h("input", { type: "checkbox", id: "new_lease", checked: f.new_lease ? "checked" : null }),
          h("span", { text: "This is for a new lease or a move to a new unit (vouchers)" })),
        h("h2", { text: "Your own costs and changes (optional)" }),
        h("div", { class: "pair" }, m("childcare_costs", "Child care you pay each year", "So someone can work or go to school.", problems), m("medical_costs", "Medical costs insurance does not pay, each year", "Counts only for elderly or disabled families.", problems)),
        h("div", { class: "pair" }, m("income_now", "Your yearly income now, if it has gone down", null, problems), h("div", {})),
        U.row(U.go(s.cur === "old" ? "Continue to the new sheet" : (s.cur === "new" ? "Compare the two sheets" : "Check my rent"), null, "submit"), U.quiet("Try a made-up example", example),
          U.saveProgress("rent", function () { collect(); return { mode: s.mode, cur: s.cur, sheets: s.sheets }; }),
          U.quiet("Back", function () { if (s.cur === "new") { collect(); s.cur = "old"; s.f = s.sheets.old; form(); } else start(); }))));
    U.firstProblem();
  }

  function check() {
    try { s.result = window.Engines.rent(bodyOf(s.f), window.Engines.today(), U.meta().engines); }        // on this device; nothing is sent
    catch (e) { if (e.problems) { form(e.problems); return; } U.failed(); return; }
    U.count("rent-check", "dates"); result();
  }

  function text(r) {
    var out = ["HOUSING RENT CHECK", "", r.headline, ""];
    r.steps.forEach(function (x) { out.push(x.what + ": " + U.money(x.value) + " (" + x.how + ")" + (x.stated !== null && x.stated !== undefined ? "; my papers say " + U.money(x.stated) : "")); });
    r.findings.forEach(function (f) { out.push("* " + f.text); });
    if (r.interim) out.push("", r.interim.text);
    out.push("", "LETTER TO THE HOUSING AUTHORITY", r.letter, "", r.disclaimer);
    return out.join("\r\n");
  }

  function result() {
    U.count("rent-check", "kit");
    var r = s.result;
    U.show(
      h("h1", { class: "long", text: r.headline }),
      h("div", { class: "table-wrap" }, h("table", { class: "plain" },
        h("tr", {}, ["Step", "How", "Works out to", "Your papers say"].map(function (t) { return h("th", { text: t }); })),
        r.steps.map(function (x) {
          return h("tr", {}, h("td", { text: x.what }), h("td", { class: "small", text: x.how }), h("td", { class: "num", text: U.money(x.value) }),
            h("td", { class: "num", text: x.stated === null || x.stated === undefined ? "Not entered" : U.money(x.stated) }));
        }))),
      r.rent_note ? h("p", { class: "small", text: r.rent_note }) : null,
      r.matches.length ? h("p", { text: "Your deductions match HUD's " + r.matches.join(" or ") + "." }) : null,
      r.findings.length ? h("ul", { class: "findings" }, r.findings.map(function (f) { return h("li", { text: f.text }); })) : null,
      r.interim ? [h("h2", { text: "Your income has gone down" }), h("p", { text: r.interim.text })] : null,
      h("h2", { text: "What to ask your housing authority" }),
      h("ol", {}, r.questions.map(function (q) { return h("li", { text: q }); })),
      U.draftBox("A letter you can send", r.letter, "rent-letter.txt"),
      h("h2", { text: "Rules this is based on" }),
      U.sources(r.rules),
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("Print or save as PDF", function () { window.print(); }), U.quiet("Download as text", function () { U.download("rent-check.txt", "text/plain", text(r)); }),
        U.sentButton("housing", "Rent calculation question"),
        U.quiet("Change the figures", function () { form(); })));
  }

  function bodyOf(sheet) {
    var body = { program: sheet.program, dependents: sheet.dependents, elderly_disabled: sheet.elderly_disabled, new_lease: sheet.new_lease };
    FIGS.forEach(function (k) { body[k] = sheet[k]; });
    return body;
  }

  function compareCheck() {
    try { s.result = window.Engines.compare({ old: bodyOf(s.sheets.old), new: bodyOf(s.sheets.new) }, window.Engines.today(), U.meta().engines); }
    catch (e) {
      if (!e.problems) { U.failed(); return; }
      var p = e.problems, side = Object.keys(p).some(function (k) { return k.indexOf("old_") === 0; }) ? "old" : "new", mine = {};
      Object.keys(p).forEach(function (k) { if (k.indexOf(side + "_") === 0) mine[k.slice(side.length + 1)] = p[k]; });
      s.cur = side; s.f = s.sheets[side]; form(mine); return;
    }
    U.count("rent-check", "dates"); compareResult();
  }

  function compareText(r) {
    var out = ["WHY DID MY RENT CHANGE?", "", r.headline, ""];
    r.parts.forEach(function (p) { out.push("- " + p.what + ": " + (p.amount >= 0 ? "+" : "-") + U.money(Math.abs(p.amount))); });
    out.push(""); r.why.forEach(function (w) { out.push(w); });
    out.push("", "WHAT CHANGED ON THE SHEETS"); r.moved.forEach(function (m) { out.push("- " + m.text); });
    out.push("", "QUESTIONS FOR THE HOUSING AUTHORITY"); r.questions.forEach(function (q, i) { out.push((i + 1) + ". " + q); });
    out.push("", r.disclaimer);
    return out.join("\r\n");
  }

  function compareResult() {
    U.count("rent-check", "kit");
    var r = s.result;
    var letter = ["To: [your housing authority, from your notice]", "Date: [today's date]", "Name: [your name]", "", "My rent changed and I would like to understand why. Please answer these questions:"]
      .concat(r.questions.map(function (q, i) { return (i + 1) + ". " + q; })).concat(["", "Please reply in writing.", "", "Signature: ____________________"]).join("\n");
    U.show(
      h("h1", { class: "long", text: r.headline }),
      r.parts.length ? h("div", { class: "table-wrap" }, h("table", { class: "plain" },
        h("tr", {}, h("th", { text: "What moved" }), h("th", { text: "Effect on what you pay" })),
        r.parts.map(function (p) { return h("tr", {}, h("td", { text: p.what }), h("td", { class: "num", text: (p.amount >= 0 ? "+" : "-") + U.money(Math.abs(p.amount)) })); }),
        r.change !== null ? h("tr", { class: "total" }, h("td", { text: "Change in what you pay" }), h("td", { class: "num", text: (r.change >= 0 ? "+" : "-") + U.money(Math.abs(r.change)) })) : null)) : null,
      r.why.map(function (w) { return h("p", { text: w }); }),
      h("h2", { text: "What changed on the sheets" }),
      r.moved.length ? h("ul", {}, r.moved.map(function (m) { return h("li", { text: m.text }); })) : h("p", { text: "None of the figures you entered changed." }),
      r.new.findings.length ? [h("h2", { text: "On the new sheet" }), h("ul", { class: "findings" }, r.new.findings.map(function (f) { return h("li", { text: f.text }); }))] : null,
      h("h2", { text: "What to ask your housing authority" }),
      h("ol", {}, r.questions.map(function (q) { return h("li", { text: q }); })),
      U.draftBox("A letter you can send", letter, "rent-change-letter.txt"),
      h("h2", { text: "Rules this is based on" }),
      U.sources(r.rules),
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("Print or save as PDF", function () { window.print(); }), U.quiet("Download as text", function () { U.download("rent-change.txt", "text/plain", compareText(r)); }),
        U.sentButton("housing", "Question about a rent change"), U.quiet("Change the figures", function () { s.cur = "new"; s.f = s.sheets.new; form(); })));
  }

  window.Modules = window.Modules || {};
  window.Modules.rent = { start: start, resume: true };
})();
