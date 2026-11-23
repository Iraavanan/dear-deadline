/* Does this doctor's bill match my Medicare Summary Notice? (Original Medicare.)
   The person copies a few figures from each paper. Nothing about them is needed:
   no name, no Medicare number, no account number. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var s;
  var YNU = [["yes", "Yes"], ["no", "No"], ["unsure", "I'm not sure"]];

  function start() {
    s = { f: { on_msn: "", approved: "", qmb: "", other_insurance: "", waiting: "" }, result: null };
    U.count("medicare-bill", "start"); U.setDatebar(null);
    var back = U.takeResume("bill");
    if (back && back.f) { Object.keys(s.f).concat(["bill_service_date", "balance", "paid", "msn_service_date", "maximum"]).forEach(function (k) { if (typeof back.f[k] === "string") s.f[k] = back.f[k]; }); form(); return; }
    intro();
  }

  function intro() {
    U.show(
      h("h1", { class: "long", text: "Does this doctor's bill match your Medicare notice?" }),
      h("p", { class: "lead", text: "Your Medicare Summary Notice shows the most you may be billed for each service. Compare it with the bill from your doctor or supplier, and leave with the exact question to ask their billing office." }),
      h("p", { class: "small", text: "This check runs on your device. The figures you type are not sent anywhere." }),
      h("h2", { text: "Have these in front of you" }),
      h("ul", {}, h("li", { text: "The bill from the doctor, hospital or supplier" }), h("li", { text: "Your Medicare Summary Notice for the same months. It says \"This is not a bill\" at the top." })),
      h("p", { class: "small", text: "This check is for Original Medicare. If you have a Medicare Advantage plan, your plan sends an Explanation of Benefits instead, and your plan's member services can explain a bill." }),
      U.row(U.go("Start", function () { form(); }), U.quiet("Try a made-up example", example), U.quiet("Back", U.home)));
  }

  function example() {
    U.trying();
    s.f = { bill_service_date: "2026-09-10", balance: "80", paid: "", waiting: "no", on_msn: "yes", msn_service_date: "2026-09-10", approved: "yes", maximum: "48.20", qmb: "no", other_insurance: "none" };
    form();
  }

  function collect() {
    var f = s.f;
    ["bill_service_date", "balance", "paid", "msn_service_date", "maximum"].forEach(function (k) { f[k] = document.getElementById(k).value; });
    ["on_msn", "approved", "qmb", "other_insurance", "waiting"].forEach(function (k) { f[k] = U.picked(k); });
  }

  function money(id, label, hint, value, problems) {
    return U.field(id, label, hint, h("input", { type: "text", inputmode: "decimal", autocomplete: "off", value: value || "" }), problems);
  }

  function form(problems) {
    problems = problems || {};
    var f = s.f;
    U.show(
      h("h1", { class: "long", text: "Copy a few figures from each paper" }),
      Object.keys(problems).length ? h("div", { class: "alert", role: "alert", text: "Some answers need fixing before the papers can be compared." }) : null,
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); collect(); check(); } } },
        h("h2", { text: "From the bill" }),
        U.field("bill_service_date", "Date of the service", "The date you saw the doctor or got the item.", h("input", { type: "date", value: f.bill_service_date || "" }), problems),
        money("balance", "Amount the bill asks you to pay now", "Often called \"balance due\" or \"patient responsibility\". Enter 0 if it asks for nothing.", f.balance, problems),
        money("paid", "Already paid for this service, if any", "Optional. For example a payment at the visit.", f.paid, problems),
        U.choice("waiting", "Does the bill say it is waiting for other insurance?", YNU, f.waiting, problems),
        h("h2", { text: "From your Medicare Summary Notice" }),
        U.choice("on_msn", "Is this service on your Medicare Summary Notice?", YNU, f.on_msn, problems, "Look for the same provider and date. A recent visit may not be on one yet."),
        U.field("msn_service_date", "Date of the service on that line", "Leave empty if the service is not on the notice.", h("input", { type: "date", value: f.msn_service_date || "" }), problems),
        U.choice("approved", "Does the \"Service Approved?\" column say Yes for it?", YNU, f.approved, problems),
        money("maximum", "\"Maximum You May Be Billed\" for that service", "A column on the notice. Leave empty if you cannot find it.", f.maximum, problems),
        U.choice("qmb", "Does the notice say you are in the Qualified Medicare Beneficiary (QMB) program?", YNU, f.qmb, problems, "It would be on the first page, in the \"Be Informed!\" section."),
        h("h2", { text: "Other insurance" }),
        U.choice("other_insurance", "Do you have other insurance that pays after Medicare?", [["none", "No"], ["medigap", "A Medicare Supplement (Medigap) policy"], ["medicaid", "Medicaid"], ["employer", "An employer or retiree plan"], ["unsure", "I'm not sure"]], f.other_insurance, problems),
        U.row(U.go("Compare the papers", null, "submit"), U.saveProgress("bill", function () { collect(); return { f: s.f }; }), U.quiet("Back", intro))));
    U.firstProblem();
  }

  /* Runs on this device: the figures from the bill and the notice are not sent anywhere. */
  function check() {
    try { s.result = window.Engines.bill(s.f, window.Engines.today(), U.meta().engines); }
    catch (e) { if (e.problems) { form(e.problems); return; } U.failed(); return; }
    U.count("medicare-bill", "dates"); result();
  }

  function table(c) {
    var rows = [["Most the notice says you may be billed", U.money(c.maximum)], ["The bill asks you to pay now", U.money(c.balance)]];
    if (c.paid) rows.push(["Already paid", U.money(c.paid)]);
    rows.push(["Asked of you in all", U.money(c.asked)]);
    rows.push([c.gap > 0 ? "More than the notice allows" : (c.gap < 0 ? "Less than the notice allows" : "Difference"), U.money(Math.abs(c.gap))]);
    return h("div", { class: "table-wrap" }, h("table", { class: "plain" }, rows.map(function (r, i) {
      return h("tr", { class: i === rows.length - 1 ? "total" : null }, h("td", { text: r[0] }), h("td", { class: "num", text: r[1] }));
    })));
  }

  function text(r) {
    var out = ["DOES THIS BILL MATCH MY MEDICARE NOTICE?", "", r.headline, ""];
    if (r.comparison) {
      var c = r.comparison;
      out.push("Most the notice says I may be billed: " + U.money(c.maximum), "The bill asks me to pay now: " + U.money(c.balance));
      if (c.paid) out.push("Already paid: " + U.money(c.paid));
      out.push("Asked of me in all: " + U.money(c.asked), "");
    }
    r.findings.forEach(function (f) { out.push("* " + f.text); });
    out.push("", "QUESTIONS FOR THE BILLING OFFICE"); r.questions.forEach(function (q, i) { out.push((i + 1) + ". " + q); });
    out.push("", "WHAT THEY TOLD ME", "Date and time: ________  Name: ________  Reference number: ________", "Answer: ________", "", r.disclaimer);
    return out.join("\r\n");
  }

  function result() {
    U.count("medicare-bill", "kit");
    var r = s.result;
    U.show(
      h("h1", { class: "long", text: r.headline }),
      r.comparison ? table(r.comparison) : null,
      r.findings.length ? h("ul", { class: "findings" }, r.findings.map(function (f) { return h("li", { text: f.text }); })) : null,
      r.steps.length ? [h("h2", { text: "What the rules say" }), r.steps.map(function (x) { return h("p", { text: x }); })] : null,
      r.status === "denied" ? h("p", {}, h("a", { href: "#letter/msn", text: "See your appeal date and a kit for the Medicare Summary Notice" })) : null,
      h("h2", { text: "What to ask the billing office" }),
      h("ol", {}, r.questions.map(function (q) { return h("li", { text: q }); })),
      U.draftBox("Words for the call", r.script.join("\n"), "billing-call.txt"),
      h("h2", { text: "Rules this is based on" }),
      U.sources([r.rules.msn_contents, r.rules.assignment, r.rules.qmb]),
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("Print or save as PDF", function () { window.print(); }), U.quiet("Download as text", function () { U.download("bill-and-medicare-notice.txt", "text/plain", text(r)); }),
        U.sentButton("billing", "Bill for a service on " + U.niceDate(s.f.bill_service_date), "phone"),
        U.quiet("Change the answers", function () { form(); })));
  }

  window.Modules = window.Modules || {};
  window.Modules.bill = { start: start, resume: true };
})();
