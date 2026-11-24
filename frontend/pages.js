/* Small script for the helpers and open-data pages: fills in this site's address, the counts and the test-set figures. */
(function () {
  "use strict";
  function el(tag, text, cls) { var e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
  function get(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); }); }
  function table(head, rows) {
    var t = el("table", undefined, "plain"), tr = el("tr");
    head.forEach(function (c) { tr.appendChild(el("th", c)); }); t.appendChild(tr);
    rows.forEach(function (r) { var x = el("tr"); r.forEach(function (c, i) { x.appendChild(el("td", String(c), i ? "num" : null)); }); t.appendChild(x); });
    return t;
  }
  var here = location.origin;

  var url = document.getElementById("handout-url");
  if (url) url.textContent = here.replace(/^https?:\/\//, "");
  var print = document.getElementById("print-handout");
  if (print) print.addEventListener("click", function () { document.body.classList.add("print-handout"); window.print(); });
  window.addEventListener("afterprint", function () { document.body.classList.remove("print-handout"); });

  var snippet = document.getElementById("snippet");
  if (snippet) {
    snippet.value = '<iframe src="' + here + '/embed" title="Social Security letter deadlines" width="100%" height="640" style="border:0;max-width:640px" loading="lazy"></iframe>';
    snippet.addEventListener("focus", function () { snippet.select(); });
  }

  var rulesBox = document.getElementById("rules-count");
  if (rulesBox) get("/api/rules").then(function (tables) {
    var n = tables.reduce(function (a, t) { return a + t.rows.length; }, 0);
    rulesBox.replaceChildren(el("p", n + " rules in " + tables.length + " tables, each with a source link and a last-checked date."));
  }).catch(function () { rulesBox.replaceChildren(); });

  var stats = document.getElementById("stats");
  if (stats) get("/api/stats").then(function (s) {
    if (!s.counting) { stats.replaceChildren(el("p", "Counting is switched off on this copy of the tool.")); return; }
    if (!s.since) { stats.replaceChildren(el("p", "Nothing has been counted yet.")); return; }
    var names = { "overpayment": "Overpayment notice", "disability-ended": "Disability-ended letter", "decision-appeal": "Decision to appeal", "work-check": "Work check", "report-change": "Report a change", "is-it-real": "Scam check", "find-letter": "Other letters, including Medicare", "check-amount": "Amount check", "filed-log": "Record of what was sent", "embed": "Calculator on other sites", "medicare-bill": "Medicare bill check", "work-rules": "80-hour work rules", "missed-interview": "Missed SNAP interview", "renewal": "Renewal check", "rent-check": "Housing rent check", "benefit-hearing": "SNAP or Medicaid hearing", "utility": "Utility shutoff", "wic-practice": "WIC practice trip", "helper-board": "Helpers' deadline board" };
    var rows = Object.keys(names).map(function (k) { var v = s.by_part[k]; return [names[k], v.start, v.dates, v.kit, v.late, v.sample || 0]; });
    rows.push(["All parts", s.all.start, s.all.dates, s.all.kit, s.all.late, s.all.sample || 0]);
    stats.replaceChildren(el("p", "Counted since " + s.since + ", over " + s.days_counted + (s.days_counted === 1 ? " day." : " days.")),
      table(["Part", "Opened", "Reached results", "Finished", "Arrived after the appeal date", "Finished on a made-up example (not counted as use)"], rows));
  }).catch(function () { stats.replaceChildren(el("p", "The counts could not be loaded.", "small")); });

  var golden = document.getElementById("golden");
  if (golden) get("/open/golden.json").then(function (g) {
    var rows = g.cases.map(function (c) { return [c.case, c.published, c.tool, c.match === null ? "Not covered" : (c.match ? "Matches" : "Does not match")]; });
    golden.replaceChildren(el("p", g.matched + " of " + g.checked + " published examples matched, version " + g.version + ", run on " + g.run_on + ". " + g.not_covered + " are not covered."),
      el("div", undefined, "table-wrap"));
    golden.lastChild.appendChild(table(["Example", "What the source says", "This tool", "Result"], rows));
  }).catch(function () { golden.replaceChildren(el("p", "The results could not be loaded.", "small")); });

  var bench = document.getElementById("benchmark");
  if (bench) get("/benchmark.json").then(function (b) {
    var f1 = b.first_run || { by_field: b.by_field, measured_on: b.measured_on };
    var same = JSON.stringify(f1.by_field) === JSON.stringify(b.by_field);
    var rows = Object.keys(b.by_field).map(function (f) {
      var r = [b.field_names[f] || f, f1.by_field[f] ? f1.by_field[f].right + " of " + f1.by_field[f].total : "not measured"];
      if (!same) r.push(b.by_field[f].right + " of " + b.by_field[f].total);
      return r;
    });
    bench.replaceChildren(el("p", b.letters + " invented letters of " + b.kinds + " kinds, in " + b.layouts + " layouts. This tool's built-in reader, first run on " + f1.measured_on + (same ? ", with no changes made afterwards:" : ", and the latest run on " + b.measured_on + " (version " + b.tool_version + "), after changes made by looking at the first run's misses. The first run is the fair figure:")),
      table(same ? ["What the reader had to find", "Right"] : ["What the reader had to find", "First run", "Latest run"], rows), el("p", b.caveat, "small"));
  }).catch(function () { bench.replaceChildren(el("p", "The figures could not be loaded.", "small")); });

  var aa = document.getElementById("askedagain");
  if (aa) get("/open/asked-again-results.json").then(function (d) {
    var t = d.tool, c = d.checklist;
    aa.replaceChildren(
      el("p", "First run on " + d.measured_on + ": " + d.items + " items in " + d.cases + " cases."),
      table(["Measure", "This tool", "Same-kind checklist"], [
        ["Missing items found (of " + d.missing_items + ")", t.missing_found, c.missing_found],
        ["Wrong-person or wrong-period matches (of " + d.wrong_items + ")", t.wrong_matches, c.wrong_matches],
        ["Receipts treated as acceptance (of " + d.items + ")", t.receipt_as_acceptance, c.receipt_as_acceptance]]),
      el("p", "Every item right: " + t.exact + " of " + d.items + ". The cases and the matcher were written by the same person, so a full score here mainly shows the code does what its author meant. Cases written by someone else are the real test." + (d.misses.length ? " Misses: " + d.misses.map(function (m) { return m.case + " expected " + m.expected + ", got " + m.got; }).join("; ") + "." : ""), "small"));
  }).catch(function () { aa.replaceChildren(el("p", "The results could not be loaded.", "small")); });

  var rd = document.getElementById("readability");
  if (rd) get("/open/notice-readability.json").then(function (d) {
    var o = d.overall, rows = Object.keys(d.groups).map(function (k) {
      var g = d.groups[k];
      return [g.name + " (" + g.section + ")", g.paragraphs, g.median_grade, g.above_grade_8];
    });
    rd.replaceChildren(
      el("p", "Read on " + d.read_on + ". Of " + o.paragraphs + " paragraphs, " + o.above_grade_8 + " score above grade 8 and " + o.above_grade_12 + " above grade 12. The median is grade " + o.median_grade + ". " + o.with_a_sentence_over_20_words + " have a sentence longer than 20 words."),
      table(["Paragraph group", "Paragraphs", "Median grade", "Above grade 8"], rows),
      el("p", d.method.join(" "), "small"));
  }).catch(function () { rd.replaceChildren(el("p", "The scores could not be loaded.", "small")); });

  var contact = document.getElementById("contact");
  if (contact) get("/api/meta").then(function (m) {
    if (!m.contact) return;
    var a = document.createElement("a"); a.href = "mailto:" + m.contact; a.textContent = m.contact;
    contact.replaceChildren(document.createTextNode("Write to "), a, document.createTextNode("."));
  }).catch(function () {});

  var held = document.getElementById("heldout");
  if (held) get("/heldout.json").then(function (d) {
    var out = [];
    d.results.forEach(function (r) {
      var rows = Object.keys(r.by_field).map(function (f) { return [r.field_names[f] || f, r.by_field[f].right + " of " + r.by_field[f].total]; });
      var inv = r.invented || {};
      out.push(el("h3", r.tool + (r.first_run ? " (first run)" : " (latest run)")),
        el("p", "Version " + (r.tool_version || "not stated") + ", run on " + r.measured_on + ". " + (r.how || "") + " Invented: " + (inv.notice_date || 0) + " dates and " + (inv.overpaid_amount || 0) + " amounts given where the letter states none.", "small"),
        table(["What the tool had to get right", "Right"], rows));
      if (r.note) out.splice(out.length - 1, 0, el("p", r.note, "small"));
    });
    held.replaceChildren.apply(held, out);
  }).catch(function () { held.replaceChildren(el("p", "The results could not be loaded.", "small")); });
})();

/* Community boards: when they are switched off, hide every link to them. */
(function () {
  if (typeof fetch !== "function" || typeof document === "undefined") return;
  fetch("/api/board").then(function (r) { if (!r.ok) document.documentElement.classList.add("no-community"); }).catch(function () {});
})();
