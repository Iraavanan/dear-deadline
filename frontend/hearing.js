/* SNAP or Medicaid denied, cut or stopped: the dates to ask for a hearing and to keep
   benefits while waiting, both sides of keeping them, and a hearing request. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var s;

  function start() {
    s = { program: "", action: "", state: "FL", notice_date: "", effective_date: "", plan: false };
    U.count("benefit-hearing", "start"); U.setDatebar(null);
    form();
  }

  function form(problems) {
    problems = problems || {};
    U.show(
      h("h1", { class: "long", text: "SNAP or Medicaid denied, cut or stopped?" }),
      h("p", { class: "lead", text: "You can ask for a fair hearing. If your benefits are being cut or stopped, there is usually an earlier date to ask by if you want to keep them the same while you wait." }),
      Object.keys(problems).length ? h("div", { class: "alert", role: "alert", text: "Some answers need fixing." }) : null,
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); collect(); check(); } } },
        U.choice("program", "Which program is the notice about?", [["snap", "SNAP (food assistance)"], ["medicaid", "Medicaid"]], s.program, problems),
        U.choice("action", "What does the notice say?", [["denied", "My application was denied"], ["reduced", "My benefits will go down"], ["stopped", "My benefits or coverage will stop"]], s.action, problems),
        U.choice("state", "Which state?", [["FL", "Florida"], ["CA", "California (Medicaid only)"], ["MI", "Michigan (Medicaid only)"], ["NY", "New York (Medicaid only)"], ["OH", "Ohio (Medicaid only)"], ["PA", "Pennsylvania (Medicaid only)"], ["other", "Another state"]], s.state, problems, "For SNAP outside Florida, the federal 90-day rule is shown."),
        U.field("notice_date", "Date printed on the notice", null, h("input", { type: "date", value: s.notice_date }), problems),
        U.field("effective_date", "Date the change takes effect", "Optional. Often called the effective date. It is on the notice when benefits are cut or stopped.", h("input", { type: "date", value: s.effective_date }), problems),
        h("label", { class: "tick", for: "plan" }, h("input", { type: "checkbox", id: "plan", checked: s.plan ? "checked" : null }), h("span", { text: "It is from my Medicaid health plan, about a service it will not cover" })),
        U.row(U.go("Show my dates", null, "submit"), U.quiet("Try a made-up example", example), U.quiet("Back", U.home))));
    U.firstProblem();
  }

  function collect() {
    s.program = U.picked("program"); s.action = U.picked("action"); s.state = U.picked("state");
    s.notice_date = document.getElementById("notice_date").value; s.effective_date = document.getElementById("effective_date").value;
    s.plan = document.getElementById("plan").checked;
  }

  function example() {
    U.trying();
    var iso = function (n) { var d = new Date(Date.now() + n * 864e5); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    s = { program: "snap", action: "stopped", state: "FL", notice_date: iso(-4), effective_date: iso(12), plan: false };
    check();
  }

  function check() {
    U.api("/api/hearing", s).then(function (res) {
      if (!res.ok) { form(res.data.problems || {}); return; }
      U.count("benefit-hearing", "dates"); result(res.data);
    }).catch(U.failed);
  }

  function result(r) {
    U.count("benefit-hearing", "kit");
    var first = r.dates.filter(function (d) { return d.status !== "passed"; })[0];
    U.setDatebar(first ? [["Ask by", first]] : null);
    U.show(
      h("h1", { class: "long", text: r.headline }),
      r.dates.length ? h("ul", { class: "dates" }, r.dates.map(function (d, n) {
        return h("li", { class: n === 0 ? null : "aside" },
          h("div", {}, h("p", { class: "when" }, h("span", { class: n === 0 && d.status !== "passed" ? "hl" : null, text: U.niceDate(d.date) })), h("p", { class: "left " + d.status, text: U.daysText(d) })),
          h("div", {}, h("h3", { text: d.label }), h("p", { class: "small" }, d.note + " ", d.sources.map(function (x) { return U.link(x.source, "Source"); }))));
      })) : null,
      r.notes.map(function (n) { return h("p", { class: "lead", text: n }); }),
      r.choice ? [h("h2", { text: r.choice.title }), h("div", { class: "pair" }, h("div", { class: "opt" }, h("h3", { text: "If you keep them" }), h("p", { text: r.choice.keep })),
        h("div", { class: "opt" }, h("h3", { text: "The risk" }), h("p", { text: r.choice.risk })))] : null,
      U.draftBox("Your hearing request", r.letter, "hearing-request.txt"),
      r.contact ? [h("h2", { text: "Where to send it" }), h("p", {}, r.contact.plain + " ", U.link(r.contact.source, "Source"))] : h("p", { text: "Send it to the hearing office or address printed on your notice, and keep proof of sending." }),
      r.rules.length ? [h("h2", { text: "Rules this is based on" }), U.sources(r.rules)] : null,
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("Print or save as PDF", function () { window.print(); }), U.sentButton("hearing", (s.program === "snap" ? "SNAP" : "Medicaid") + " notice dated " + U.niceDate(s.notice_date)),
        U.timelineButton((s.program === "snap" ? "SNAP" : "Medicaid") + " notice", s.notice_date, r.dates),
        U.quiet("Change my answers", function () { form(); })));
  }

  window.Modules = window.Modules || {};
  window.Modules.hearing = { start: start };
})();
