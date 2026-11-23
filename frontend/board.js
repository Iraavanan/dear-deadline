/* A deadline board for someone helping several people: nicknames, what is due and when.
   It lives only in this page and in a file the helper saves; this site keeps nothing. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var KIND = "benefits-letter-helper-board";
  var s = { rows: [] };

  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function left(iso) { return Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(today() + "T00:00:00Z")) / 864e5); }

  function start() {
    U.count("helper-board", "start"); U.setDatebar(null);
    if (window.__openBoard) { var d = window.__openBoard; window.__openBoard = null; if (Array.isArray(d.rows)) s.rows = d.rows.map(clean).filter(Boolean).slice(0, 500); }
    view();
  }

  function clean(r) {
    if (!r || typeof r !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(r.due || "")) return null;
    var str = function (v, n) { return typeof v === "string" ? v.slice(0, n) : ""; };
    return { who: str(r.who, 40), what: str(r.what, 200), due: r.due, done: r.done === true, next: str(r.next, 200) };
  }

  function view(problems) {
    problems = problems || {};
    var rows = s.rows.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) { return !x.r.done; }).sort(function (a, b) { return a.r.due < b.r.due ? -1 : 1; });
    var week = rows.filter(function (x) { return left(x.r.due) <= 7; });
    var status = h("p", { class: "status", role: "status" });
    U.show(
      h("h1", { class: "long", text: "Deadlines for the people you help" }),
      h("p", { class: "lead", text: "For a volunteer, navigator or family member helping several people. Use a nickname or initials, never a full name or any number. This page keeps nothing: save the board as a file and open it again next time. On a shared computer, save it to your own device and close the tab." }),
      week.length ? h("div", { class: "alert", text: week.length + (week.length === 1 ? " deadline is" : " deadlines are") + " within 7 days or already passed." }) : null,
      rows.length ? h("div", { class: "table-wrap" }, h("table", { class: "plain" },
        h("tr", {}, ["Due", "Who", "What", "Next step", ""].map(function (t) { return h("th", { text: t }); })),
        rows.map(function (x) {
          var n = left(x.r.due);
          return h("tr", {}, h("td", { class: "num" }, U.niceDate(x.r.due), h("br"), h("span", { class: "small", text: n < 0 ? "passed " + (-n) + " days ago" : (n === 0 ? "today" : n + " days left") })),
            h("td", { text: x.r.who }), h("td", { text: x.r.what }), h("td", { text: x.r.next }),
            h("td", {}, h("button", { class: "copy", type: "button", text: "Done", on: { click: function () { x.r.done = true; view(); } } }), " ",
              h("button", { class: "copy", type: "button", text: "Remove", on: { click: function () { s.rows.splice(x.i, 1); view(); } } })));
        }))) : h("p", { text: "Nothing on the board yet." }),
      h("h2", { text: "Add a deadline" }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault();
        var r = { who: document.getElementById("b_who").value.trim(), what: document.getElementById("b_what").value.trim(), due: document.getElementById("b_due").value, next: document.getElementById("b_next").value.trim() };
        var bad = {};
        if (!r.who) bad.b_who = "Enter a nickname or initials.";
        if (/\d{3}[-\s]?\d{2}[-\s]?\d{4}/.test(r.who + " " + r.what + " " + r.next)) bad.b_what = "Leave out Social Security, case and card numbers.";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.due)) bad.b_due = "Enter the due date.";
        if (Object.keys(bad).length) { view(bad); return; }
        s.rows.push(clean(r)); U.count("helper-board", "dates"); view();
      } } },
        h("div", { class: "pair" }, h("div", { class: "cell" }, U.field("b_who", "Who", "A nickname or initials only.", h("input", { type: "text", maxlength: "40", autocomplete: "off" }), problems)),
          h("div", { class: "cell" }, U.field("b_due", "Due date", null, h("input", { type: "date" }), problems))),
        U.field("b_what", "What is due", "For example: Medicaid renewal form, or SNAP interview.", h("input", { type: "text", maxlength: "200", autocomplete: "off" }), problems),
        U.field("b_next", "Next step", "Optional. For example: bring pay stubs Tuesday.", h("input", { type: "text", maxlength: "200", autocomplete: "off" }), problems),
        U.row(U.go("Add to the board", null, "submit"))),
      h("h2", { text: "Save or open a board" }),
      U.row(U.quiet("Save the board as a file", function () { U.count("helper-board", "kit"); U.download("deadline-board.json", "application/json", JSON.stringify({ kind: KIND, version: 1, saved: today(), rows: s.rows }, null, 1)); }),
        U.quiet("Print this week's list", function () { window.print(); }), U.quiet("Clear the board", function () { s.rows = []; view(); }), U.quiet("Back", U.home)),
      h("label", { for: "boardfile" }, "Open a saved board", h("span", { class: "hint", text: "The file stays on this device." })),
      h("input", { id: "boardfile", type: "file", accept: ".json,application/json", on: { change: function (ev) {
        var f = ev.target.files && ev.target.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function () { var d; try { d = JSON.parse(String(fr.result)); } catch (e) { d = null; }
          if (!d || d.kind !== KIND || !Array.isArray(d.rows)) { status.textContent = "That file is not a board saved from this site."; return; }
          s.rows = d.rows.map(clean).filter(Boolean).slice(0, 500); view(); };
        fr.readAsText(f);
      } } }),
      status);
    U.firstProblem();
  }

  window.Modules = window.Modules || {};
  window.Modules.board = { start: start };
})();
