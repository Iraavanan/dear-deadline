/* Fills the testing results and the rule tables on the About page. */
(function () {
  "use strict";
  function el(tag, text, cls) { var e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
  function row(cells, head) {
    var tr = document.createElement("tr");
    cells.forEach(function (c, i) { var td = el(head ? "th" : "td", typeof c === "string" ? c : undefined, !head && i > 0 && typeof c === "string" && /^\d/.test(c) ? "num" : null); if (typeof c !== "string") td.appendChild(c); tr.appendChild(td); });
    return tr;
  }
  function table(head, rows) {
    var t = el("table", undefined, "plain");
    t.appendChild(row(head, true));
    rows.forEach(function (r) { t.appendChild(row(r)); });
    return t;
  }
  function get(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); }); }

  get("/accuracy.json").then(function (a) {
    var box = document.getElementById("accuracy");
    var names = { notice_date: "Notice date", overpaid_amount: "Overpaid amount", period: "Months covered", benefit_type: "Benefit type" };
    var rows = Object.keys(a.reading.by_field).map(function (f) { var v = a.reading.by_field[f]; return ["Reading: " + names[f], v.right + " of " + v.total]; });
    rows.push(["Identity numbers fully blacked out", a.identity_numbers.fully_blacked_out + " of " + a.identity_numbers.total]);
    rows.push(["Request result matches the answer key", a.requests.right + " of " + a.requests.total]);
    rows.push(["30-day date correct", a.dates.right + " of " + a.dates.total]);
    if (a.letter_kind) rows.push(["Told the two kinds of letter apart", a.letter_kind.right + " of " + a.letter_kind.total]);
    if (a.disability_ended) {
      var e = a.disability_ended;
      rows.push(["Disability-ended letters: date read", e.date_read + " of " + e.notices]);
      rows.push(["Disability-ended letters: 15-day and 60-day dates correct", e.dates_right + " of " + e.notices]);
      rows.push(["Disability-ended letters: identity number left visible", e.identity_numbers_left_visible + " of " + e.notices]);
    }
    box.replaceChildren(
      el("p", (a.notices + (a.disability_ended ? a.disability_ended.notices : 0)) + " invented notices, measured on " + a.measured_on + " (tool version " + a.tool_version + ")."),
      table(["What was checked", "Result"], rows),
      el("p", "First run: " + a.first_run.fields_right + " of " + a.first_run.fields_total + " details read correctly. " + a.first_run.note, "small"),
      el("p", a.caveat, "small"));
  }).catch(function () { document.getElementById("accuracy").replaceChildren(el("p", "The results could not be loaded.", "small")); });

  get("/pdf_accuracy.json").then(function (a) {
    var names = { reportlab: "ReportLab", chrome: "Chrome", libreoffice: "LibreOffice", wkhtmltopdf: "wkhtmltopdf", pdflatex: "LaTeX" };
    var rows = Object.keys(a.by_program).sort().map(function (k) { return ["PDF made with " + (names[k] || k), a.by_program[k].right + " of " + a.by_program[k].total]; });
    rows.push(["PDFs with an identity number left visible", a.identity_numbers_left_visible + " of " + a.files]);
    document.getElementById("pdf-accuracy").replaceChildren(
      el("p", "The same notices as PDF files written by five different programs, read in a browser on " + a.measured_on + "."),
      table(["PDF reading", "Details read correctly"], rows),
      el("p", "None of these PDFs came from Social Security. A real notice PDF may be built differently, and a scanned notice has no words to read.", "small"));
  }).catch(function () { /* not measured yet: say nothing */ });

  get("/api/meta").then(function (m) {
    if (m.ai_reader && m.ai_reader.available) {
      var li = document.getElementById("ai-line");
      li.replaceChildren(el("b", "An AI service is used only if you ask. "),
        document.createTextNode("When the built-in reader cannot find a detail, you may choose to send your text, with numbers blacked out, to " + m.ai_reader.provider + ". Nothing is sent unless you press that button, and you confirm anything it reads."));
    }
  }).catch(function () {});

  get("/api/rules").then(function (tables) {
    var box = document.getElementById("rules");
    box.replaceChildren();
    tables.forEach(function (t) {
      box.appendChild(el("h3", t.table.charAt(0).toUpperCase() + t.table.slice(1)));
      box.appendChild(table(["Rule", "Last checked", "Source"], t.rows.map(function (r) {
        var a = el("a", "Official source"); a.href = r.source; a.target = "_blank"; a.rel = "noopener noreferrer";
        return [r.plain || r.id, r.checked_on, a];
      })));
    });
  }).catch(function () { document.getElementById("rules").replaceChildren(el("p", "The rule tables could not be loaded.", "small")); });
})();

/* Community boards: when they are switched off, hide every link to them. */
(function () {
  if (typeof fetch !== "function" || typeof document === "undefined") return;
  fetch("/api/board").then(function (r) { if (!r.ok) document.documentElement.classList.add("no-community"); }).catch(function () {});
})();
