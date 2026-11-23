/* My electricity or gas may be shut off (Florida): a call sheet for today. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var s;

  function start() {
    s = { kind: "", notice_date: "", shutoff_date: "", medical: false, off: false, older: false, dispute: false };
    U.count("utility", "start"); U.setDatebar(null);
    form();
  }

  function tick(id, text) { return h("label", { class: "tick", for: id }, h("input", { type: "checkbox", id: id, checked: s[id] ? "checked" : null }), h("span", { text: text })); }

  function form(problems) {
    problems = problems || {};
    U.show(
      h("h1", { class: "long", text: "My electricity or gas may be shut off" }),
      h("p", { class: "lead", text: "Florida only. Turn your notice into a list of calls to make today: your utility, crisis help with the bill, and who to tell if something is wrong." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); collect(); check(); } } },
        U.choice("kind", "Who is your utility?", [["regulated", "A company such as FPL, Duke Energy, Tampa Electric or a gas company"], ["city_coop", "A city utility (such as OUC) or a cooperative"], ["unsure", "I'm not sure"]], s.kind, problems),
        U.field("notice_date", "Date on the shutoff notice", "Optional.", h("input", { type: "date", value: s.notice_date }), problems),
        U.field("shutoff_date", "Shutoff date on the notice", "Optional.", h("input", { type: "date", value: s.shutoff_date }), problems),
        h("fieldset", { class: "ticks" }, h("legend", { text: "Tick any that apply" }),
          tick("off", "My service is already off"), tick("medical", "Someone here needs electricity for medical reasons"),
          tick("older", "Someone here is 60 or older"), tick("dispute", "I think the bill is wrong")),
        U.row(U.go("Make my call sheet", null, "submit"), U.quiet("Try a made-up example", example), U.quiet("Back", U.home))));
    U.firstProblem();
  }

  function collect() {
    s.kind = U.picked("kind") || "unsure";
    ["notice_date", "shutoff_date"].forEach(function (k) { s[k] = document.getElementById(k).value; });
    ["off", "medical", "older", "dispute"].forEach(function (k) { s[k] = document.getElementById(k).checked; });
  }

  function example() {
    U.trying();
    var iso = function (n) { var d = new Date(Date.now() + n * 864e5); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    s = { kind: "regulated", notice_date: iso(-2), shutoff_date: iso(6), medical: true, off: false, older: false, dispute: false };
    check();
  }

  function check() {
    U.api("/api/utility", s).then(function (res) {
      if (!res.ok) { form(res.data.problems || {}); return; }
      U.count("utility", "dates"); result(res.data);
    }).catch(U.failed);
  }

  function text(r) {
    var out = ["MY CALL SHEET: UTILITY SHUTOFF", "", r.headline, ""];
    r.findings.forEach(function (f) { out.push("* " + f.text); });
    r.steps.forEach(function (st, i) { out.push("", (i + 1) + ". CALL " + st.who); st.ask.forEach(function (q) { out.push("   - " + q); }); out.push("   They said: ____________________"); });
    out.push("", "BRING"); r.bring.forEach(function (b) { out.push("- " + b); });
    out.push("", "WRITE DOWN"); r.record.forEach(function (b) { out.push("- " + b + ": ________"); });
    out.push("", r.disclaimer);
    return out.join("\r\n");
  }

  function result(r) {
    U.count("utility", "kit");
    U.show(
      h("h1", { class: "long", text: r.headline }),
      r.findings.length ? h("ul", { class: "findings" }, r.findings.map(function (f) { return h("li", { text: f.text }); })) : null,
      h("h2", { text: "Calls to make today" }),
      h("ol", { class: "calls" }, r.steps.map(function (st) {
        return h("li", {}, h("h3", { text: st.who }), h("ul", {}, st.ask.map(function (q) { return h("li", { text: q }); })),
          h("p", { class: "small", text: "Write down what they say, who you spoke to, and any reference number." }));
      })),
      h("h2", { text: "Have these ready" }), h("ul", {}, r.bring.map(function (b) { return h("li", { text: b }); })),
      h("h2", { text: "Rules this is based on" }), U.sources(r.rules),
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("Print the call sheet", function () { window.print(); }), U.quiet("Download as text", function () { U.download("utility-call-sheet.txt", "text/plain", text(r)); }),
        U.sentButton("other", "Utility shutoff notice", "phone"), U.quiet("Change my answers", function () { form(); })));
  }

  window.Modules = window.Modules || {};
  window.Modules.utility = { start: start };
})();
