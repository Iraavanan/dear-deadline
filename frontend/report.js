/* Report-a-change builder: what to tell Social Security, by when, and the words to do it.
   Late reporting is the most common cause of overpayments, so this part works before any letter exists. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var STEPS = ["Your benefit", "What changed", "Your report"];
  var s;
  function meta() { return U.meta().reporting; }

  function start() {
    s = { benefit: null, changes: [], change_date: "", what: "", result: null };
    U.count("report-change", "start"); U.setDatebar(null);
    U.show(
      h("h1", {}, "Report a change before it becomes an overpayment."),
      h("p", { class: "lead", text: "Most overpayments start with a change that was reported late. See what to report and by when, and leave with the words to report it. Which benefit do you get?" }),
      h("ul", { class: "ways" }, meta().benefits.map(function (b) {
        return U.way(b.label, b.id === "ssi" ? "Has a fixed last day to report: 10 days after the month ends." : "Social Security says to report promptly.", function () { s.benefit = b.id; s.changes = []; form(); });
      })),
      U.row(U.quiet("Back", U.home)));
  }

  function form(problems) {
    problems = problems || {};
    var now = new Date(), far = (now.getFullYear() + 1) + "-12-31";
    var ticks = meta().changes[s.benefit].map(function (c) {
      return h("label", { class: "tick", for: "chg_" + c.id }, h("input", { type: "checkbox", id: "chg_" + c.id, checked: s.changes.indexOf(c.id) >= 0 ? "checked" : null }), h("span", { text: c.label }));
    });
    var f = h("form", { novalidate: "novalidate", on: { submit: function (ev) {
      ev.preventDefault();
      s.changes = meta().changes[s.benefit].filter(function (c) { return document.getElementById("chg_" + c.id).checked; }).map(function (c) { return c.id; });
      s.change_date = document.getElementById("change_date").value; s.what = document.getElementById("what_changed").value;
      U.api("/api/report", { benefit: s.benefit, changes: s.changes, change_date: s.change_date, statements: { what_changed: s.what } }).then(function (res) {
        if (!res.ok) { form(res.data.problems || {}); return; }
        s.result = res.data; kit();
      }).catch(U.failed);
    } } },
      h("fieldset", { class: "ticks", "aria-describedby": problems.changes ? "chg_err" : null }, h("legend", { text: "What changed? Tick all that apply" }), ticks),
      problems.changes ? h("p", { class: "err", id: "chg_err", role: "alert", text: problems.changes }) : null,
      U.field("change_date", "Date it happened", s.benefit === "ssi" ? "Used to work out the last day to report. Leave it empty if you are not sure." : "Optional. It goes into your written report.",
        h("input", { type: "date", value: s.change_date, max: far }), problems),
      U.field("what_changed", "What changed, in your own words", "Optional. It goes into your report exactly as you write it. Leave out any Social Security or bank account number.",
        h("textarea", { maxlength: "2000" }, s.what), problems),
      U.row(U.go("Build my report", null, "submit"), U.quiet("Back", start)));
    U.show(U.progress(1, null, STEPS),
      h("h1", { class: "long", text: "What changed?" }),
      h("p", { class: "lead", text: "If you are not sure whether something counts, tick it. Reporting something that turns out not to matter costs nothing." }),
      problems.changes || problems.change_date || problems.what_changed ? h("div", { class: "alert", role: "alert", text: "Something needs fixing before your report can be built." }) : null,
      f);
    var first = document.querySelector("[aria-invalid=true]"); if (first) first.focus();
  }

  function kitText(r) {
    var k = r.kit, out = [k.title.toUpperCase(), "", k.summary, "", "WHEN TO REPORT", r.timing.rule];
    if (r.deadline && r.deadline.date) out.push("Report by: " + U.niceDate(r.deadline.date) + " (" + U.daysText(r.deadline) + ")");
    r.notes.forEach(function (n) { out.push(n); });
    out.push("", "YOUR REPORT"); k.draft.forEach(function (l) { out.push(l); });
    out.push("", "HOW TO REPORT"); k.how.forEach(function (x, i) { out.push((i + 1) + ". " + x); });
    out.push("", "HAVE READY"); k.have_ready.forEach(function (d) { out.push("- " + d); });
    out.push("", "MY RECORD OF REPORTING"); k.record.forEach(function (l) { out.push(l + ": ______________________________"); });
    out.push(k.record_note, "", r.more.text + " " + r.more.url, "", k.disclaimer);
    return out.join("\r\n");
  }

  function kit() {
    U.count("report-change", "kit");
    var r = s.result, k = r.kit, d = r.deadline;
    if (d && d.date) U.setDatebar([["Report by", d]]);
    var copy = h("button", { class: "copy", type: "button", text: "Copy this report", on: { click: function () {
      var done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy this report"; }, 2500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(k.draft.join("\n")).then(done, function () { copy.textContent = "Select the text and copy it by hand"; });
      else copy.textContent = "Select the text and copy it by hand";
    } } });
    var toWork = r.changes.some(function (c) { return c.see === "work-check"; });
    U.show(U.progress(2, null, STEPS),
      h("h1", { text: k.title }),
      h("p", { class: "lead", text: k.summary }),
      U.row(U.go("Print or save as PDF", function () { window.print(); }), U.quiet("Download as text", function () { U.download("change-report.txt", "text/plain", kitText(r)); }), U.sentButton("change", "Report of a change")),
      h("h2", { text: "When to report" }),
      d && d.date ? h("ul", { class: "dates" }, h("li", {},
        h("div", {}, h("p", { class: "when" }, h("span", { class: d.status !== "passed" ? "hl" : null, text: U.niceDate(d.date) })), h("p", { class: "left " + d.status, text: U.daysText(d) })),
        h("div", {}, h("h3", { text: d.label }), h("p", { class: "small" }, d.rule + " ", U.link(d.source, "Source")), h("p", { class: "small", text: d.penalty }))))
        : h("p", {}, r.timing.rule + " ", U.link(r.timing.source, "Source")),
      d && !d.date ? h("p", { class: "small", text: d.penalty }) : null,
      r.notes.map(function (n) { return h("p", { text: n }); }),
      h("ul", {}, r.changes.map(function (c) { return h("li", {}, h("b", { text: c.label }), ": report " + c.when + "."); })),
      toWork ? h("p", {}, "Working can change your benefit in ways this report does not show. ", h("a", { href: "#work-check", text: "Check your pay against the limits" }), ".") : null,
      toWork ? h("p", {}, h("a", {href:"#ssi-wages",text:"Already reported SSI wages? Compare your receipt with the notice."})) : null,
      h("h2", { text: "Your report" }),
      h("div", { class: "draft" }, k.draft.map(function (l) { return h("p", { text: l }); })), copy,
      h("h2", { text: "How to report" }),
      h("ol", {}, k.how.map(function (x) { return h("li", { text: x }); })),
      h("p", {}, U.link(k.office_locator, "Find a local office")),
      h("h2", { text: "Have ready" }),
      h("ul", {}, k.have_ready.map(function (x) { return h("li", { text: x }); })),
      h("h2", { text: "My record of reporting" }),
      h("dl", { class: "record" }, k.record.map(function (l) { return h("div", {}, h("dt", { text: l }), h("dd", {})); })),
      h("p", { class: "small", text: k.record_note }),
      h("h2", { text: "Other changes" }),
      h("p", {}, r.more.text + " ", U.link(r.more.url, "Read the full list")),
      h("p", { class: "small", text: k.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.quiet("Change what I ticked", function () { form(); }), U.quiet("Start over", start)));
  }

  window.Modules = window.Modules || {};
  window.Modules.report = { start: start };
})();
