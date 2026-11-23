/* Module 3: "Will my job cause an overpayment?"

   A check to run before a letter arrives. The person enters what they earn or
   expect to earn; the server compares it with the published limits for the
   year and returns what Social Security would do, plus the words for
   reporting the change. Nothing typed here is stored. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var STEPS = ["Your benefit", "Your figures", "What it means", "Report it"];
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var s;

  function reset() { s = { form: {}, result: null }; }
  function money(n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function select(id, options, current) {
    return h("select", { id: id }, options.map(function (o) { return h("option", { value: String(o[0]), text: o[1], selected: String(current) === String(o[0]) ? "selected" : null }); }));
  }
  function send(retry) {
    U.api("/api/work", s.form).then(function (res) {
      if (!res.ok) { if (res.data.problems) retry(res.data.problems); else U.failed(); return; }
      s.result = res.data;
      if (!res.data.covered) notCovered(); else result();
    }).catch(U.failed);
  }

  // ---------- start ----------

  function start() {
    U.count("work-check", "start");
    reset(); U.setDatebar(null);
    U.show(
      h("h1", {}, "Check whether your job could lead to an overpayment."),
      h("p", { class: "lead", text: "Compare what you earn with this year's limits before Social Security does, and leave with the words for reporting it. Most overpayments begin with a change that was not reported in time." }),
      h("ul", { class: "ways" },
        U.way("I get retirement, spouse or survivor benefits", "And I have not reached full retirement age, or I reach it this year.", function () { s.form = { track: "retirement" }; retirementForm(); }),
        U.way("I get Social Security disability benefits", "SSDI. Checks trial work months and the substantial-work level.", function () { s.form = { track: "disability" }; disabilityForm(); }),
        U.way("I get SSI", "Supplemental Security Income follows different rules.", function () { s.form = { track: "ssi" }; send(function () { U.failed(); }); }),
        U.way("Try an example first", "Two made-up situations, one from Social Security's own booklet.", examples)),
      U.row(U.quiet("I have a letter instead", U.home)));
  }

  function examples() {
    U.api("/api/samples?module=work").then(function (res) {
      U.show(
        h("h1", { text: "Pick an example" }),
        h("p", { class: "lead", text: "The people and figures are invented. You can change any figure before running it." }),
        h("ul", { class: "ways" }, res.data.map(function (x) {
          return U.way(x.title, x.story, function () { s.form = JSON.parse(JSON.stringify(x.form)); if (x.form.track === "retirement") retirementForm(); else disabilityForm(); });
        })),
        U.row(U.quiet("Back", start)));
    }).catch(U.failed);
  }

  function notCovered() {
    var r = s.result;
    U.show(
      h("h1", { class: "long", text: "Working while receiving SSI" }),
      h("p", {class:"lead",text:"SSI has its own wage-reporting and Medicaid rules. Choose the question you have."}),
      h("p", {text:r.reporting_rule || r.message.replace(/^This check does not cover SSI yet\.\s*/, "")}),
      h("ul", {class:"ways"},
        U.way("Could my Medicaid continue if earnings stop my SSI check?", "Prepare questions for SSA. Includes Florida’s 2026 earnings threshold.",function(){location.hash="ssi-medicaid";}),
        U.way("Did SSA use the wages I reported?", "Compare pay stubs, reporting receipts and wage amounts on the notice.",function(){location.hash="ssi-wages";})),
      h("p", { text: r.help }),
      h("p", {}, "Social Security: " + r.phone + " (TTY " + r.tty + "). ", U.link(r.legal_aid_finder, "Find legal aid")),
      U.row(U.quiet("Back", start)));
  }

  // ---------- retirement, spouse or survivor benefits ----------

  function retirementForm(problems) {
    var f = s.form, years = U.meta().work.years.slice().reverse();
    var form = h("form", { novalidate: "novalidate", on: { submit: function (ev) {
      ev.preventDefault();
      ["year", "fra", "first_year", "earnings", "monthly_benefit"].forEach(function (id) { s.form[id] = document.getElementById(id).value; });
      send(retirementForm);
    } } },
      U.field("year", "Which year?", null, select("year", years.map(function (y) { return [y, String(y)]; }), f.year || years[0]), problems),
      U.field("fra", "When do you reach full retirement age?", "It is 67 if you were born on January 2, 1960 or later, and a little earlier if you were born before that. It is on your award letter.",
        select("fra", [["after", "After this year"], ["this_year", "During this year"], ["already", "I have already reached it"], ["unknown", "I'm not sure"]], f.fra || "after"), problems),
      U.field("earnings", "What you expect to earn in that year", "Wages before tax, or net earnings if you are self-employed. If you reach full retirement age this year, count only the months before the month you reach it. Leave out pensions and investment income.",
        h("input", { type: "text", inputmode: "decimal", autocomplete: "off", value: f.earnings === undefined ? "" : f.earnings }), problems),
      U.field("monthly_benefit", "Your monthly benefit (optional)", "Lets the check show how many monthly payments would be held.",
        h("input", { type: "text", inputmode: "decimal", autocomplete: "off", value: f.monthly_benefit === undefined ? "" : f.monthly_benefit }), problems),
      U.field("first_year", "Is this your first year getting benefits?", null,
        select("first_year", [["no", "No"], ["yes", "Yes"], ["unknown", "I'm not sure"]], f.first_year || "unknown"), problems),
      U.row(U.go("Check my earnings", null, "submit"), U.quiet("Back", start)));
    U.show(U.progress(1, null, STEPS),
      h("h1", { class: "long", text: "What do you expect to earn?" }),
      h("p", { class: "lead", text: "A rough figure is fine. No name, and no Social Security number." }),
      problems ? h("div", { class: "alert", role: "alert", text: "Some details need fixing before this can be worked out." }) : null,
      form);
    if (problems) { var first = document.querySelector("[aria-invalid=true]"); if (first) first.focus(); }
  }

  // ---------- disability benefits ----------

  function monthOptions() {
    var out = [["", "Choose a month"]];
    U.meta().work.years.forEach(function (y) {
      MONTH_NAMES.forEach(function (name, i) { out.push([y + "-" + String(i + 1).padStart(2, "0"), name + " " + y]); });
    });
    return out;
  }

  function disabilityForm(problems) {
    var f = s.form;
    var rows = (f.months && f.months.length ? f.months : [{}, {}, {}]).map(function (m) { return { month: m.month || "", earnings: m.earnings === undefined ? "" : m.earnings }; });
    var list = h("div", { id: "months" });
    function draw() {
      U.fill(list, rows.map(function (r, i) {
        var month = select("month_" + i, monthOptions(), r.month), pay = h("input", { id: "pay_" + i, type: "text", inputmode: "decimal", autocomplete: "off", placeholder: "0", value: r.earnings });
        month.setAttribute("aria-label", "Month " + (i + 1)); pay.setAttribute("aria-label", "Pay before tax in month " + (i + 1));
        month.addEventListener("change", function () { r.month = month.value; });
        pay.addEventListener("input", function () { r.earnings = pay.value; });
        return h("div", { class: "money" + (i === 0 ? " first" : "") }, month, pay);
      }));
    }
    draw();
    var form = h("form", { novalidate: "novalidate", on: { submit: function (ev) {
      ev.preventDefault();
      ["blind", "self_employed", "prior_trial_months"].forEach(function (id) { s.form[id] = document.getElementById(id).value; });
      s.form.months = rows.filter(function (r) { return r.month; }).map(function (r) { return { month: r.month, earnings: r.earnings === "" ? 0 : r.earnings }; });
      send(disabilityForm);
    } } },
      h("label", { id: "months-label" }, "Your pay before tax, month by month", h("span", { class: "hint", text: "Add the months you worked or expect to work. Leave a row blank to skip it." })),
      list,
      problems && problems.months ? h("p", { class: "err", role: "alert", text: problems.months }) : null,
      U.row(U.quiet("Add another month", function () { if (rows.length < U.meta().work.max_months) { rows.push({ month: "", earnings: "" }); draw(); } })),
      U.field("prior_trial_months", "Trial work months you had already used before these months", "A trial work month is one where you earned over the trial amount. You get 9 within 5 years.",
        select("prior_trial_months", [["unknown", "I'm not sure"]].concat([0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return [n, String(n)]; })).concat([[9, "All 9 (my trial work period is over)"]]), f.prior_trial_months === undefined ? "unknown" : f.prior_trial_months), problems),
      U.field("blind", "Are your benefits based on blindness?", "The substantial-work level is higher for people who are blind.",
        select("blind", [["no", "No"], ["yes", "Yes"], ["unknown", "I'm not sure"]], f.blind || "no"), problems),
      U.field("self_employed", "Are you self-employed?", null, select("self_employed", [["no", "No"], ["yes", "Yes"], ["unknown", "I'm not sure"]], f.self_employed || "no"), problems),
      U.row(U.go("Check my months", null, "submit"), U.quiet("Back", start)));
    U.show(U.progress(1, null, STEPS),
      h("h1", { class: "long", text: "What have you earned, month by month?" }),
      h("p", { class: "lead", text: "Rough figures are fine. No employer name, and no Social Security number." }),
      problems ? h("div", { class: "alert", role: "alert", text: "Some details need fixing before this can be worked out." }) : null,
      form);
  }

  // ---------- what it means ----------

  function facts(pairs) {
    return h("dl", { class: "facts" }, pairs.filter(function (p) { return p[1] !== null && p[1] !== undefined; }).map(function (p) { return h("div", {}, h("dt", { text: p[0] }), h("dd", { text: p[1] })); }));
  }

  function result() {
    U.count("work-check", "dates");
    var r = s.result, isR = r.track === "retirement";
    U.show(
      U.progress(2, null, STEPS),
      h("h1", { class: "long", text: r.headline }),
      h("p", { class: "lead", text: r.detail }),
      isR ? (r.limit === undefined ? null : facts([
        [r.year + " limit", money(r.limit)],
        ["What you entered", money(r.earnings) + " (" + r.counts + ")"],
        ["Over the limit by", money(r.over_by)],
        ["Benefits Social Security would withhold", "About " + money(r.would_withhold)],
        ["Monthly payments held", r.months_held === undefined ? null : String(r.months_held)],
        ["Paid back the next year", r.paid_back_next_year === undefined ? null : money(r.paid_back_next_year)]]))
        : [r.status === "needs_info"
            ? [h("h2", { text: "What to find out first" }), h("ul", {}, r.verify.map(function (v) { return h("li", { text: v }); })),
               h("h2", { text: "The two ends of the range" }), h("ul", {}, r.scenarios.map(function (x) { return h("li", {}, h("b", { text: x.label + ": " }), x.text); })),
               h("h2", { text: "The months you entered" })]
            : h("p", {}, "Trial work months used: ", h("b", { text: r.trial_months_used + " of " + r.trial_months_total }), r.trial_period_ended ? ". Your trial work period ended in " + r.trial_period_ended + "." : "."),
          h("ul", { class: "dates" }, r.rows.map(function (m) {
            return h("li", {},
              h("div", {}, h("p", { class: "when" }, h("span", { class: m.payment === "not_due" ? null : (m.kind === "trial" || m.kind === "grace" ? "hl" : null), text: m.label })),
                h("p", { class: "left " + (m.payment === "not_due" ? "passed" : ""), text: money(m.earnings) + (m.payment === "not_due" ? ", payment not due" : "") })),
              h("div", {}, h("p", { text: m.text }), h("p", { class: "small", text: "Trial amount " + money(m.trial_level) + ", substantial-work level " + money(m.substantial_level) + "." })));
          }))],
      h("h2", { text: "How the rule works" }),
      h("ul", {}, r.notes.map(function (n) { return h("li", { text: n }); })),
      h("p", { class: "small" }, r.rule + " ", U.link(r.source, "Source")),
      h("h2", { text: "Keep in mind" }),
      h("ul", {}, r.cautions.map(function (c) { return h("li", { text: c }); })),
      U.row(U.go("Get the words for reporting it", kit), U.quiet("Change my figures", function () { if (isR) retirementForm(); else disabilityForm(); })));
  }

  // ---------- report it ----------

  function kitText(k) {
    var out = [k.title.toUpperCase(), "", k.why, "", "WHAT TO SAY", k.script, "", "HOW"];
    k.how.forEach(function (x, i) { out.push((i + 1) + ". " + x); });
    out.push("", "HAVE READY"); k.documents.forEach(function (d) { out.push("- " + d); });
    if (k.table) { out.push("", k.table.title.toUpperCase()); k.table.rows.forEach(function (r) { out.push("- " + r.label + ": " + r.value); }); }
    k.more.forEach(function (m) { out.push("", m); });
    out.push("", k.if_letter, "", k.disclaimer);
    return out.join("\r\n");
  }

  function kit() {
    U.count("work-check", "kit");
    var k = s.result.kit, said = h("p", { class: "status", role: "status" });
    var copy = h("button", { class: "copy", type: "button", text: "Copy these words", on: { click: function () {
      var done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy these words"; }, 2500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(k.script).then(done, function () { copy.textContent = "Select the text and copy it by hand"; });
      else copy.textContent = "Select the text and copy it by hand";
    } } });
    U.show(
      U.progress(3, null, STEPS),
      h("h1", { text: k.title }),
      h("p", { class: "lead", text: k.why }),
      U.row(U.go("Print or save as PDF", function () { window.print(); }), U.quiet("Download as text", function () { U.download("report-my-work-kit.txt", "text/plain", kitText(k)); })),
      h("h2", { text: "What to say" }),
      h("div", { class: "draft" }, h("p", { text: k.script })),
      copy,
      h("h2", { text: "How to report it" }),
      h("ol", {}, k.how.map(function (x) { return h("li", { text: x }); })),
      h("h2", { text: "Have ready" }),
      h("ul", {}, k.documents.map(function (d) { return h("li", { text: d }); })),
      k.table ? [h("h2", { text: k.table.title }), facts(k.table.rows.map(function (r) { return [r.label, r.value]; }))] : null,
      k.more.map(function (m) { return h("p", { text: m }); }),
      h("p", {}, k.if_letter + " ", h("a", { href: "#overpayment", text: "Overpayment helper" })),
      h("p", { class: "small", text: k.disclaimer + " Rules checked as of " + s.result.rules_as_of + "." }),
      U.row(U.go("I know what to do next", function () { said.textContent = "Good. Print or download this page before you close it; it is not saved anywhere."; }), U.quiet("Start over", start)),
      said);
  }

  window.Modules = window.Modules || {};
  window.Modules.work = { start: start };
})();
