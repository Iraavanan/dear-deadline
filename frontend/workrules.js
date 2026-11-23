/* Keeping SNAP and Medicaid: the 80-hour rules month by month, and a missed SNAP interview.
   Everything stays on this device except the figures sent to be sorted; nothing is stored. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var s;
  var STATES = [["FL", "Florida"], ["CA", "California"], ["MI", "Michigan"], ["NY", "New York"], ["OH", "Ohio"], ["PA", "Pennsylvania"], ["other", "Another state"]];
  var KNOWN = STATES.map(function (x) { return x[0]; });
  var NAMES = { snap: "SNAP (food assistance)", medicaid: "Medicaid" };

  function blankMonth() { return { month: "", work: "", volunteer: "", program: "", earnings: "", school: false, snap: false }; }

  function start() {
    s = { programs: [], state: "FL", exemptions: { snap: [], medicaid: [] }, months: [blankMonth()], result: null };
    U.count("work-rules", "start"); U.setDatebar(null);
    var back = U.takeResume("workrules");
    if (back && Array.isArray(back.programs) && back.programs.length) {
      s.programs = back.programs.filter(function (p) { return p === "snap" || p === "medicaid"; }); s.state = KNOWN.indexOf(back.state) >= 0 ? back.state : "other";
      if (back.exemptions) ["snap", "medicaid"].forEach(function (p) { if (Array.isArray(back.exemptions[p])) s.exemptions[p] = back.exemptions[p].filter(function (x) { return typeof x === "string"; }); });
      if (Array.isArray(back.months) && back.months.length) s.months = back.months.slice(0, 12).map(function (m) {
        return { month: String(m.month || ""), work: String(m.work || ""), volunteer: String(m.volunteer || ""), program: String(m.program || ""), earnings: String(m.earnings || ""), school: m.school === true, snap: m.snap === true }; });
      months(); return;
    }
    setup();
  }

  function setup(problems) {
    problems = problems || {};
    U.show(
      h("h1", { class: "long", text: "Keep SNAP or Medicaid under the 80-hour rules" }),
      h("p", { class: "lead", text: "Many adults now have to show 80 hours a month of work, volunteering, training or school to keep SNAP, and from 2027 Medicaid in many states. See which ways out may apply to you, which months count, and leave with a proof packet." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault(); s.programs = U.ticked("programs"); s.state = U.picked("state") || "";
        var p = {};
        if (!s.programs.length) p.programs = "Choose SNAP, Medicaid or both.";
        if (!s.state) p.state = "Choose a state.";
        if (Object.keys(p).length) { setup(p); return; }
        exemptions();
      } } },
        U.ticks("programs", "Which do you get or want to keep?", [["snap", "SNAP (food assistance)"], ["medicaid", "Medicaid"]], s.programs, problems),
        U.choice("state", "Which state do you live in?", STATES, s.state, problems, "Florida's SNAP and Medicaid details are added. For California, Michigan, New York, Ohio and Pennsylvania, Medicaid's start dates, reporting and hearing rules are added. For another state, the federal rules are shown."),
        U.row(U.go("Continue", null, "submit"), U.quiet("Try a made-up example", example), U.quiet("Back", U.home))));
    U.firstProblem();
  }

  /* A made-up Floridian on SNAP: one month short, one met by work and volunteering, two short. */
  function example() {
    U.trying();
    var d = new Date(), ym = function (back) { var x = new Date(d.getFullYear(), d.getMonth() - back, 1); return String(x.getMonth() + 1).padStart(2, "0") + "/" + x.getFullYear(); };
    s.programs = ["snap"]; s.state = "FL"; s.exemptions = { snap: [], medicaid: [] };
    s.months = [{ month: ym(4), work: "10", volunteer: "", program: "", earnings: "", school: false, snap: true },
      { month: ym(3), work: "60", volunteer: "", program: "", earnings: "", school: false, snap: true },
      { month: ym(2), work: "50", volunteer: "30", program: "", earnings: "", school: false, snap: true },
      { month: ym(1), work: "20", volunteer: "", program: "12", earnings: "", school: false, snap: true }];
    check();
  }

  function exemptions() {
    var items = U.meta().workrules;
    U.show(
      h("h1", { class: "long", text: "Do any of these fit you?" }),
      h("p", { class: "lead", text: "Tick anything that may fit. If one does, the 80 hours may not apply to you. The agency decides, so you will still need to tell them and send proof." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault(); s.programs.forEach(function (p) { s.exemptions[p] = U.ticked("ex_" + p); }); months();
      } } },
        s.programs.map(function (p) { return U.ticks("ex_" + p, "For " + NAMES[p], items[p], s.exemptions[p]); }),
        U.row(U.go("Continue", null, "submit"), U.quiet("Back", function () { setup(); }))));
  }

  function collectMonths() {
    s.months.forEach(function (m, i) {
      var k = "m" + (i + 1) + "_";
      ["month", "work", "volunteer", "program"].forEach(function (f) { m[f] = document.getElementById(k + f).value; });
      var e = document.getElementById(k + "earnings"); m.earnings = e ? e.value : "";
      var sc = document.getElementById(k + "school"); m.school = sc ? sc.checked : false;
      var sn = document.getElementById(k + "snap"); m.snap = sn ? sn.checked : false;
    });
  }

  function num(id, label, value, problems, mode) {
    return h("div", { class: "cell" }, U.field(id, label, null, h("input", { type: "text", inputmode: mode || "numeric", autocomplete: "off", value: value || "" }), problems));
  }

  function months(problems) {
    problems = problems || {};
    var med = s.programs.indexOf("medicaid") >= 0, snap = s.programs.indexOf("snap") >= 0;
    var blocks = s.months.map(function (m, i) {
      var k = "m" + (i + 1) + "_";
      return h("fieldset", { class: "month" }, h("legend", { text: "Month " + (i + 1) }),
        U.field(k + "month", "Month and year", "Like 09/2026", h("input", { type: "text", inputmode: "numeric", autocomplete: "off", value: m.month }), problems),
        h("div", { class: "pair" }, num(k + "work", "Hours of paid work", m.work, problems), num(k + "volunteer", "Hours volunteering", m.volunteer, problems)),
        h("div", { class: "pair" }, num(k + "program", "Hours in a work or training program", m.program, problems),
          med ? num(k + "earnings", "Earnings that month, if any", m.earnings, problems, "decimal") : h("div", {})),
        med ? h("label", { class: "tick", for: k + "school" }, h("input", { type: "checkbox", id: k + "school", checked: m.school ? "checked" : null }), h("span", { text: "I was in school at least half-time" })) : null,
        snap ? h("label", { class: "tick", for: k + "snap" }, h("input", { type: "checkbox", id: k + "snap", checked: m.snap ? "checked" : null }), h("span", { text: "I got SNAP this month" })) : null,
        s.months.length > 1 ? h("button", { class: "copy", type: "button", text: "Remove month " + (i + 1), on: { click: function () { collectMonths(); s.months.splice(i, 1); months(); } } }) : null);
    });
    U.show(
      h("h1", { class: "long", text: "Your hours, month by month" }),
      h("p", { class: "lead", text: "Enter the months you want to check, from your pay stubs, timesheets or volunteer records. Leave a box empty for none. You can skip this and just get the exemption letter." }),
      Object.keys(problems).length ? h("div", { class: "alert", role: "alert", text: "Some months need fixing." }) : null,
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); collectMonths(); check(); } } },
        blocks,
        s.months.length < 12 ? U.row(U.quiet("Add another month", function () { collectMonths(); s.months.push(blankMonth()); months(); document.getElementById("m" + s.months.length + "_month").focus(); })) : null,
        U.row(U.go("Check my months", null, "submit"), U.saveProgress("workrules", function () { collectMonths(); return s; }), U.quiet("Back", exemptions))));
    U.firstProblem();
  }

  function check() {
    var body = { programs: s.programs, state: s.state, exemptions: s.exemptions, months: s.months };
    U.api("/api/workrules", body).then(function (res) {
      if (!res.ok) { var p = res.data.problems || {}; if (p.programs || p.state) setup(p); else months(p); return; }
      s.result = res.data; U.count("work-rules", "dates"); result();
    }).catch(U.failed);
  }

  function monthTable(sec) {
    var snap = sec.program === "snap";
    var head = h("tr", {}, ["Month", "Hours", "80-hour rule"].concat(snap ? ["Counts toward 3?"] : []).map(function (t) { return h("th", { text: t }); }));
    var body = sec.months.map(function (r) {
      return h("tr", {}, h("td", { text: r.month }), h("td", { class: "num", text: String(r.hours) }),
        h("td", {}, r.met ? h("span", { class: "status-ok", text: "Met" }) : h("span", { class: "status-short", text: "Short by " + r.short + " hours" }), h("br"), h("span", { class: "small", text: r.how })),
        snap ? h("td", { text: r.countable ? "May count" : (r.got_snap ? "No" : "No SNAP that month") }) : null);
    });
    return h("div", { class: "table-wrap" }, h("table", { class: "plain" }, head, body));
  }

  function text(r) {
    var out = ["KEEPING SNAP AND MEDICAID: MY 80-HOUR RECORD", "", r.headline];
    r.sections.forEach(function (sec) {
      out.push("", sec.title.toUpperCase(), sec.summary);
      if (sec.may_apply.length) { out.push("Exemptions that may apply:"); sec.may_apply.forEach(function (x) { out.push("- " + x); }); }
      sec.months.forEach(function (m) { out.push("- " + m.month + ": " + m.how + (m.met ? " (met)" : " (short by " + m.short + " hours)") + (m.countable ? ", may count toward the 3-month limit" : "")); });
    });
    out.push("", "PROOF TO GATHER"); r.proof.forEach(function (p) { out.push("- " + p); });
    out.push("", "LETTER", r.letter, "", r.disclaimer);
    return out.join("\r\n");
  }

  function result() {
    U.count("work-rules", "kit");
    var r = s.result;
    U.show(
      h("h1", { class: "long", text: r.headline }),
      r.sections.map(function (sec) {
        return [h("h2", { text: sec.title }), h("p", {}, h("b", { text: sec.summary })),
          sec.notes.map(function (n) { return h("p", { class: "lead" }, n.plain + " ", U.link(n.source, "Source")); }),
          sec.may_apply.length ? [h("p", { text: "Ways out that may apply to you:" }), h("ul", {}, sec.may_apply.map(function (x) { return h("li", { text: x }); }))] : null,
          sec.months.length ? monthTable(sec) : null];
      }),
      h("h2", { text: "Proof to gather" }),
      h("ul", {}, r.proof.map(function (p) { return h("li", { text: p }); })),
      U.draftBox("A letter to send with your proof", r.letter, "work-rules-letter.txt"),
      r.contact ? h("p", {}, (r.contact_name || "Florida DCF") + ": ", h("b", { text: r.contact }), ". Ask them to record your hours or exemption, and write down who you spoke to.") : null,
      r.state_info ? h("p", {}, "Your state's own page: ", h("a", { href: r.state_info.info, target: "_blank", rel: "noopener noreferrer", text: r.state_info.program + " work rules (" + r.state_info.name + ")" })) : null,
      r.hearing ? [h("h2", { text: "If your benefits are cut or stopped" }), h("p", {}, r.hearing.plain + " ", U.link(r.hearing.source, "Source"))] : null,
      h("h2", { text: "Rules this is based on" }),
      r.sections.map(function (sec) { return U.sources(sec.rules); }),
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("Print or save as PDF", function () { window.print(); }), U.quiet("Download my record", function () { U.download("80-hour-record.txt", "text/plain", text(r)); }),
        U.sentButton("hours", "Proof of work hours or an exemption"),
        U.quiet("Change my months", function () { months(); })));
  }

  // ----- missed SNAP interview -----

  function interview(problems, values) {
    if (!problems) { U.count("missed-interview", "start"); U.setDatebar(null); }
    problems = problems || {}; values = values || { applied: "", state: "FL" };
    U.show(
      h("h1", { class: "long", text: "I missed my SNAP interview. What can I do today?" }),
      h("p", { class: "lead", text: "Missing the interview does not end your application straight away. The federal rules give you until 30 days after you applied to reschedule." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault();
        var v = { applied: document.getElementById("applied").value, state: U.picked("state") || "other" };
        U.api("/api/interview", v).then(function (res) {
          if (!res.ok) { interview(res.data.problems || {}, v); return; }
          U.count("missed-interview", "dates"); interviewResult(res.data);
        }).catch(U.failed);
      } } },
        U.field("applied", "The date you applied", "On your application receipt, or the notice about the interview.", h("input", { type: "date", value: values.applied }), problems),
        U.choice("state", "Which state did you apply in?", STATES, values.state, problems),
        U.row(U.go("Show my dates", null, "submit"), U.quiet("Try a made-up example", function () {
          U.trying(); var d = new Date(Date.now() - 17 * 864e5);
          document.getElementById("applied").value = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
          document.getElementById("state_FL").checked = true;
        }), U.quiet("Back", U.home))));
    U.firstProblem();
  }

  function interviewResult(r) {
    U.count("missed-interview", "kit");
    var item = { date: r.day30, days_left: r.days_left, status: r.status === "passed" ? "passed" : (r.status === "today" ? "today" : "upcoming") };
    U.setDatebar([["Reschedule by", item]]);
    U.show(
      h("h1", { class: "long", text: r.headline }),
      h("ul", { class: "dates" }, h("li", {},
        h("div", {}, h("p", { class: "when" }, h("span", { class: r.status === "passed" ? null : "hl", text: U.niceDate(r.day30) })), h("p", { class: "left " + item.status, text: U.daysText(item) })),
        h("div", {}, h("h3", { text: "Day 30 after you applied (" + U.niceDate(r.applied) + ")" }), h("p", { class: "small", text: "Contact the agency before this date to get a second interview. If your notice gives an earlier date, use that." })))),
      h("h2", { text: "What to do" }),
      h("ol", {}, r.steps.map(function (x) { return h("li", { text: x }); })),
      r.contact ? h("p", {}, "Florida DCF: ", h("b", { text: r.contact }), ", or use your MyACCESS account.") : null,
      U.draftBox("Words for the call", r.script.join("\n"), "snap-interview-call.txt"),
      r.hearing ? [h("h2", { text: "If your application is denied" }), h("p", {}, r.hearing.plain + " ", U.link(r.hearing.source, "Source"))] : null,
      h("h2", { text: "Rules this is based on" }),
      U.sources(r.rules),
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("Print or save as PDF", function () { window.print(); }), U.sentButton("other", "SNAP interview rescheduled (applied " + U.niceDate(r.applied) + ")", "phone"), U.quiet("Back", U.home)));
  }

  window.Modules = window.Modules || {};
  window.Modules.workrules = { start: start, resume: true, interview: function () { interview(); } };
})();
