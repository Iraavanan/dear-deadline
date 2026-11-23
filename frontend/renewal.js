/* What is missing from my renewal? A check before a Medicaid or SNAP renewal goes in.
   Document images never come here, and the check itself runs on this device: nothing typed is sent. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var s;
  var STATUS = [["have", "I have it"], ["get", "I still need to get it"], ["unsure", "I'm not sure what they want"]];

  function blankItem() { return { what: "", who: "", period: "", status: "" }; }

  function start() {
    s = { programs: [], state: "FL", method: "", form_due: "", proof_due: "", coverage_ends: "", items: [blankItem()], checks: [], result: null };
    U.count("renewal", "start"); U.setDatebar(null);
    var back = U.takeResume("renewal");
    if (back) {
      ["state", "method", "form_due", "proof_due", "coverage_ends"].forEach(function (k) { if (typeof back[k] === "string") s[k] = back[k]; });
      if (Array.isArray(back.programs)) s.programs = back.programs.filter(function (p) { return p === "snap" || p === "medicaid"; });
      if (Array.isArray(back.checks)) s.checks = back.checks.filter(function (c) { return typeof c === "string"; });
      if (Array.isArray(back.items) && back.items.length) s.items = back.items.filter(function (i) { return i && typeof i === "object"; }).slice(0, 15).map(function (i) {
        return { what: String(i.what || ""), who: String(i.who || ""), period: String(i.period || ""), status: String(i.status || "") }; });
      items(); return;
    }
    setup();
  }

  function date(id, label, hint, problems) {
    return U.field(id, label, hint, h("input", { type: "date", value: s[id] || "" }), problems);
  }

  function setup(problems) {
    problems = problems || {};
    U.show(
      h("h1", { class: "long", text: "Check your Medicaid or SNAP renewal before you send it" }),
      h("p", { class: "lead", text: "Most people who lose Medicaid at renewal lose it over paperwork, not because they stopped qualifying. Check the dates, what is still missing, and each page, then send it with a cover sheet and keep proof." }),
      Object.keys(problems).length ? h("div", { class: "alert", role: "alert", text: "Some answers need fixing." }) : null,
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault();
        s.programs = U.ticked("programs"); s.state = U.picked("state") || ""; s.method = U.picked("method") || "unsure";
        ["form_due", "proof_due", "coverage_ends"].forEach(function (k) { s[k] = document.getElementById(k).value; });
        var p = {};
        if (!s.programs.length) p.programs = "Choose Medicaid, SNAP or both.";
        if (!s.state) p.state = "Choose a state.";
        if (!s.form_due && !s.proof_due && !s.coverage_ends) p.form_due = "Enter at least one date from your notice.";
        if (Object.keys(p).length) { setup(p); return; }
        items();
      } } },
        U.ticks("programs", "What are you renewing?", [["medicaid", "Medicaid"], ["snap", "SNAP (food assistance)"]], s.programs, problems),
        U.choice("state", "Which state?", [["FL", "Florida"], ["other", "Another state"]], s.state, problems),
        h("h2", { text: "Dates printed on your papers" }),
        date("form_due", "Renewal form due", "Leave empty if you only got a request for proof.", problems),
        date("proof_due", "Proof or documents due", "From a request for more information. It can be a different date.", problems),
        date("coverage_ends", "Coverage or benefits end", "If the notice says when they stop.", problems),
        U.choice("method", "How will you send it?", [["online", "Online upload"], ["mail", "By mail"], ["fax", "By fax"], ["in_person", "In person"], ["unsure", "Not sure yet"]], s.method, problems),
        U.row(U.go("Continue", null, "submit"), U.quiet("Try a made-up example", example), U.quiet("Back", U.home))));
    U.firstProblem();
  }

  /* A made-up Florida Medicaid renewal with two due dates, one item still to get and two pages not yet checked. */
  function example() {
    U.trying();
    var iso = function (n) { var d = new Date(Date.now() + n * 864e5); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    s.programs = ["medicaid"]; s.state = "FL"; s.method = "online"; s.form_due = iso(18); s.proof_due = iso(9); s.coverage_ends = iso(39);
    s.items = [{ what: "Pay stubs", who: "me", period: "last 30 days", status: "get" }, { what: "Proof of address", who: "", period: "", status: "have" }, { what: "Childcare costs", who: "", period: "", status: "unsure" }];
    s.checks = ["signed", "copies", "readable", "changes"];
    check();
  }

  function collectItems() {
    s.items.forEach(function (it, i) {
      var k = "i" + (i + 1) + "_";
      it.what = document.getElementById(k + "what").value; it.who = document.getElementById(k + "who").value;
      it.period = document.getElementById(k + "period").value; it.status = U.picked(k + "status");
    });
  }

  function items(problems) {
    problems = problems || {};
    var blocks = s.items.map(function (it, i) {
      var k = "i" + (i + 1) + "_";
      return h("fieldset", { class: "month" }, h("legend", { text: "Item " + (i + 1) }),
        U.field(k + "what", "What they asked for", "Copy the words from the notice, like \"pay stubs\" or \"proof of address\".", h("input", { type: "text", autocomplete: "off", value: it.what }), problems),
        h("div", { class: "pair" },
          h("div", { class: "cell" }, U.field(k + "who", "For whom", "Optional. Like \"me\" or \"my son\".", h("input", { type: "text", autocomplete: "off", value: it.who }), problems)),
          h("div", { class: "cell" }, U.field(k + "period", "For what time", "Optional. Like \"last 30 days\".", h("input", { type: "text", autocomplete: "off", value: it.period }), problems))),
        U.choice(k + "status", "Do you have it?", STATUS, it.status, problems),
        s.items.length > 1 ? h("button", { class: "copy", type: "button", text: "Remove item " + (i + 1), on: { click: function () { collectItems(); s.items.splice(i, 1); items(); } } }) : null);
    });
    U.show(
      h("h1", { class: "long", text: "What does the notice ask for?" }),
      h("p", { class: "lead", text: "List each document or piece of information the notice asks for, one at a time. Match each one to the person and the time it is for." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); collectItems(); checks(); } } },
        blocks,
        s.items.length < 15 ? U.row(U.quiet("Add another item", function () { collectItems(); s.items.push(blankItem()); items(); document.getElementById("i" + s.items.length + "_what").focus(); })) : null,
        U.row(U.go("Continue", null, "submit"), U.saveProgress("renewal", function () { collectItems(); return s; }), U.quiet("Back", function () { setup(); }))));
    U.firstProblem();
  }

  function checks() {
    U.show(
      h("h1", { class: "long", text: "Check each page" }),
      h("p", { class: "lead", text: "These are the things that most often get a renewal sent back. Tick each one you have done." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); s.checks = U.ticked("checks"); check(); } } },
        U.ticks("checks", "Tick what is done", U.meta().renewal_checks, s.checks),
        U.row(U.go("See what is left", null, "submit"), U.quiet("Back", function () { items(); }))));
  }

  function check() {
    var body = { programs: s.programs, state: s.state, method: s.method, form_due: s.form_due, proof_due: s.proof_due, coverage_ends: s.coverage_ends, items: s.items, checks: s.checks };
    try { s.result = window.Engines.renewal(body, window.Engines.today(), U.meta().engines); }      // on this device; nothing is sent
    catch (e) {
      if (!e.problems) throw e;
      var p = e.problems; if (Object.keys(p).some(function (k) { return k.charAt(0) === "i" && k !== "items"; })) items(p); else setup(p); return;
    }
    U.count("renewal", "dates"); result();
  }

  function text(r) {
    var out = ["MY RENEWAL CHECK", "", r.headline, ""];
    r.dates.forEach(function (d) { out.push(d.label + ": " + U.niceDate(d.date) + " (" + U.daysText(d).toLowerCase() + ")"); });
    if (r.missing.length) { out.push("", "STILL TO GET"); r.missing.forEach(function (x) { out.push("- " + x); }); }
    if (r.unsure.length) { out.push("", "TO ASK ABOUT"); r.unsure.forEach(function (x) { out.push("- " + x); }); }
    if (r.checks_left.length) { out.push("", "STILL TO CHECK"); r.checks_left.forEach(function (x) { out.push("- " + x); }); }
    out.push("", "HOW TO SEND IT"); r.how.forEach(function (x) { out.push("- " + x); });
    out.push("", "COVER SHEET", r.cover, "", "QUESTIONS TO ASK"); r.questions.forEach(function (q, i) { out.push((i + 1) + ". " + q); });
    out.push("", r.disclaimer);
    return out.join("\r\n");
  }

  function result() {
    U.count("renewal", "kit");
    var r = s.result;
    var next = r.dates.filter(function (d) { return d.status !== "passed"; })[0];
    U.setDatebar(next ? [[next.label + ":", next]] : null);
    U.show(
      h("h1", { class: "long", text: r.headline }),
      r.two_dates ? h("div", { class: "alert", text: r.two_dates }) : null,
      h("ul", { class: "dates" }, r.dates.map(function (d, n) {
        return h("li", { class: n === 0 ? null : "aside" },
          h("div", {}, h("p", { class: "when" }, h("span", { class: n === 0 && d.status !== "passed" ? "hl" : null, text: U.niceDate(d.date) })), h("p", { class: "left " + d.status, text: U.daysText(d) })),
          h("div", {}, h("h3", { text: d.label }), h("p", { class: "small", text: d.note })));
      })),
      r.missing.length ? [h("h2", { text: "Still to get" }), h("ul", { class: "findings" }, r.missing.map(function (x) { return h("li", {}, x, ssaHelp(x)); }))] : null,
      r.unsure.length ? [h("h2", { text: "Ask what they mean" }), h("ul", { class: "findings" }, r.unsure.map(function (x) { return h("li", {}, x, ssaHelp(x)); }))] : null,
      r.checks_left.length ? [h("h2", { text: "Still to check on the pages" }), h("ul", { class: "findings" }, r.checks_left.map(function (x) { return h("li", { text: x }); }))] : null,
      h("h2", { text: "How to send it, and keep proof" }),
      h("ol", {}, r.how.map(function (x) { return h("li", { text: x }); })),
      U.draftBox("Cover sheet to put on top", r.cover, "renewal-cover-sheet.txt"),
      h("h2", { text: "Questions to ask" }),
      h("ol", {}, r.questions.map(function (q) { return h("li", { text: q }); })),
      r.hearing ? [h("h2", { text: "If your coverage or benefits end anyway" }), h("p", {}, r.hearing.plain + " ", U.link(r.hearing.source, "Source"))] : null,
      h("h2", { text: "Rules this is based on" }),
      U.sources(r.rules),
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("Print or save as PDF", function () { window.print(); }), U.quiet("Download as text", function () { U.download("renewal-check.txt", "text/plain", text(r)); }),
        U.timelineButton(s.programs.map(function (p) { return p === "snap" ? "SNAP" : "Medicaid"; }).join(" and ") + " renewal", "", r.dates),
        U.sentButton("renewal", s.programs.map(function (p) { return p === "snap" ? "SNAP" : "Medicaid"; }).join(" and ") + " renewal", s.method === "in_person" ? "office" : (s.method === "unsure" ? "mail" : s.method)),
        U.quiet("Change my answers", function () { setup(); })),
      h("p", { class: "small" }, "Already sent something and they asked for it again? ", h("a", { href: "#asked-again", text: "Match what they ask for with what you sent" })));
  }

  /* Proof of Social Security or SSI income: where to get the letter that proves it. */
  function ssaHelp(x) {
    if (!/social security|\bssa\b|\bssi\b|ssdi|benefit (verification )?letter|award letter|proof of income/i.test(x)) return null;
    var row = ((U.meta().engines || {}).askedagain || {}).ssa_letter;
    return row ? h("span", { class: "small block" }, " " + row.plain + " ", U.link(row.source, "Get the letter")) : null;
  }

  window.Modules = window.Modules || {};
  window.Modules.renewal = { start: start, resume: true };
})();
