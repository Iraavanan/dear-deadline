/* My Medicare plan refused care or a drug: the first appeal date, the fast appeal, a request
   letter and a doctor's statement. Nothing is saved. */
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI) return;
  var U = window.UI, h = U.h;
  var s;
  var PLANS = [["ma", "A Medicare Advantage plan (Part C): it covers doctor and hospital care"], ["pd", "A Medicare drug plan (Part D): it covers prescriptions only"]];
  var WHAT = {
    ma: [["care", "Care, a test or equipment I have not had yet"], ["payment", "Paying for care I already had"], ["partb_drug", "A Part B drug (one given in a clinic or by a doctor)"]],
    pd: [["drug", "A prescription I have not filled yet"], ["payment", "Paying me back for a prescription I already paid for"]]
  };

  function start() {
    s = { plan: "", what: "", notice_date: "", urgent: "" };
    U.count("plan-appeal", "start"); U.setDatebar(null);
    form();
  }

  function form(problems) {
    problems = problems || {};
    U.show(
      h("h1", { class: "long", text: "My Medicare plan refused care or a drug" }),
      h("p", { class: "lead", text: "You can ask the plan to look again. Few people appeal, but most Medicare Advantage refusals that are appealed are overturned at least in part. Find your date, ask for a fast decision if you need one, and leave with a letter and a statement for your doctor." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault();
        s.plan = U.picked("plan"); s.what = U.picked("what"); s.notice_date = document.getElementById("notice_date").value; s.urgent = U.picked("urgent");
        send();
      } } },
        U.choice("plan", "What kind of plan sent the refusal?", PLANS, s.plan, problems, "Original Medicare (the red, white and blue card) has a different process: see the Medicare Summary Notice helper."),
        h("div", { id: "what-box" }, whatChoice(problems)),
        U.field("notice_date", "Date printed on the plan's notice", "Often called a \"Notice of Denial\".", h("input", { type: "date", value: s.notice_date }), problems),
        U.choice("urgent", "Could waiting weeks seriously harm your health?", [["yes", "Yes"], ["no", "No"]], s.urgent, problems, "For example, you need the drug or care to avoid getting much worse. Not used for paying back."),
        U.row(U.go("See my date", null, "submit"), U.quiet("Try a made-up refusal", example), U.quiet("Back", U.home))));
    document.getElementById("plan").addEventListener("change", function () {
      s.plan = U.picked("plan"); s.what = "";
      var box = document.getElementById("what-box"); box.textContent = ""; box.appendChild(whatChoice({}));
    });
    U.firstProblem();
  }

  function whatChoice(problems) {
    if (!s.plan) return h("p", { class: "hint", text: "Choose the plan first." });
    return U.choice("what", "What did the plan refuse?", WHAT[s.plan], s.what, problems);
  }

  function example() {
    U.trying();
    var d = new Date(); d.setDate(d.getDate() - 12);
    s = { plan: "pd", what: "drug", notice_date: d.toISOString().slice(0, 10), urgent: "yes" };
    send();
  }

  function send() {
    U.api("/api/plan-appeal", { plan: s.plan, what: s.what, notice_date: s.notice_date, urgent: s.urgent === "yes" ? true : (s.urgent === "no" ? false : null) }).then(function (res) {
      if (!res.ok) { form(res.data.problems || {}); return; }
      U.count("plan-appeal", "dates"); result(res.data);
    }).catch(U.failed);
  }

  function text(r) {
    var out = ["MEDICARE PLAN APPEAL", "", r.headline, ""];
    out.push("WHAT YOU CAN DO"); r.steps.forEach(function (st, i) { out.push((i + 1) + ". " + st); });
    out.push("", "LETTER", r.letter, "", "DOCTOR'S STATEMENT", r.doctor, "", "RULES");
    r.rules.forEach(function (x) { out.push("- " + x.plain + " " + x.source); });
    out.push("", r.disclaimer);
    return out.join("\r\n");
  }

  function result(r) {
    U.count("plan-appeal", "kit");
    U.show(
      h("h1", { class: "long", text: r.headline }),
      r.days_left >= 0 ? h("p", { class: "lead", text: r.days_left + " days from today. Count from the date on your notice, and check the deadline the notice itself gives." }) : null,
      h("h2", { text: "What you can do" }),
      h("ol", {}, r.steps.map(function (st) { return h("li", { text: st }); })),
      U.draftBox("Appeal request to the plan", r.letter, "plan-appeal.txt"),
      U.draftBox("Statement for your doctor to sign", r.doctor, "doctor-statement.txt"),
      h("h2", { text: "Rules this is based on" }), U.sources(r.rules),
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("Print this", function () { window.print(); }), U.quiet("Download as text", function () { U.download("plan-appeal.txt", "text/plain", text(r)); }),
        U.sentButton("appeal", r.plan_name + " refusal dated " + U.niceDate(s.notice_date)),
        U.quiet("Change my answers", function () { form(); })));
  }

  window.Modules = window.Modules || {};
  window.Modules.planAppeal = { start: start };
})();
