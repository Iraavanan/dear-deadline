/* Is my overpayment notice complete? Social Security's own rules list what every initial
   overpayment notice must say. The person can paste the notice (read on this device, with
   identity numbers blacked out) to pre-fill the answers, then confirms each part. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else { root.NoticeCheck = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Words that suggest a notice covers a part. A hint only: the person confirms every answer. */
  var MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
  var CUES = {
    total: [/(?:overpaid|overpayment(?: amount)?(?: is| of| totals?)?|paid you|owe(?: us)?)[^.\n]{0,40}\$\s?[\d,]+(?:\.\d\d)?/i, /\$\s?[\d,]+(?:\.\d\d)?[^.\n]{0,30}(?:more than|too much|overpa)/i, /(?:too much|overpaid|overpayment)[^\n]{0,30}\b\d[\d,]*\.\d\d\b/i],
    months: [new RegExp(MONTH + "\\s+\\d{4}\\s+(?:through|to|thru|-|–)\\s+" + MONTH + "\\s+\\d{4}", "i"), /\b(?:0?[1-9]|1[0-2])\/\d{4}\s+(?:through|to|thru|-|–)\s+(?:0?[1-9]|1[0-2])\/\d{4}/i, new RegExp("\\bfor\\s+" + MONTH + "\\s+\\d{4}", "i"), new RegExp("between\\s+" + MONTH + "\\s+\\d{4}\\s+and\\s+" + MONTH + "\\s+\\d{4}", "i")],
    paid_due: [/should have (?:been )?(?:paid|received|gotten)/i, /what we paid/i, /(?:was|were) due\b/i, /correct (?:amount|payment)/i],
    cause: [/\bbecause\b/i, /\bdue to\b/i, /this happened/i, /the reason/i, /\bwhy\b/i],
    recon: [/reconsideration/i, /\bappeal\b/i, /SSA-561/i, /if you (?:disagree|think we are wrong)/i],
    waiver: [/\bwaive(?:r)?\b/i, /SSA-632/i, /not your fault/i, /not to (?:collect|pay)/i],
    refund: [/\brefund\b/i, /pay (?:us )?(?:back|the full)/i, /\brepay\b/i, /send (?:us )?(?:a )?(?:check|payment|the full)/i, /full amount/i],
    withholding: [/withh[oe]ld/i, /hold back/i, /\bwill (?:take|keep)\b[^.\n]{0,40}(?:payment|benefit|check)/i, /\badjust(?:ment)?\b/i, /from (?:each|your) (?:monthly )?(?:payment|benefit|check)/i],
    start: [new RegExp("(?:beginning|starting|start)\\s+(?:with|in)?\\s*(?:the\\s+)?(?:payment\\s+(?:for|in)\\s+)?" + MONTH + "\\s+\\d{4}", "i")],
    options: [/installment/i, /different (?:rate|amount)/i, /(?:smaller|lower|less) (?:amount|rate)/i, /monthly payments/i, /another (?:social security )?(?:payment|benefit)/i, /SSA-634/i]
  };

  /* For each part, the first line of the text that matches, or nothing. */
  function scan(text) {
    var lines = String(text || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var found = {};
    Object.keys(CUES).forEach(function (id) {
      for (var i = 0; i < lines.length && !found[id]; i++) {
        for (var j = 0; j < CUES[id].length; j++) if (CUES[id][j].test(lines[i])) { found[id] = lines[i].length > 200 ? lines[i].slice(0, 197) + "…" : lines[i]; break; }
      }
    });
    return found;
  }

  return { scan: scan, CUES: CUES };
});

(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI) return;
  var U = window.UI, h = U.h;
  var s;

  var PROGRAMS = [["t2", "Retirement, survivor or disability benefits (Social Security)"], ["ssi", "SSI (Supplemental Security Income)"], ["unsure", "I'm not sure"]];
  var ANS = [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]];

  function parts() { return (U.meta().notice_parts || []).filter(function (p) { return s.program === "unsure" || p.applies.indexOf(s.program) >= 0; }); }

  function start() {
    s = { program: "", notice_date: "", answers: {}, seen: {}, evidence: {}, allPages: false, read: false };
    U.count("notice-check", "start"); U.setDatebar(null);
    first();
  }

  function prefill(redacted, allPages) {
    s.read = true; s.allPages = allPages; s.answers = {}; s.evidence = {};
    s.seen = window.NoticeCheck.scan(redacted);
    Object.keys(s.seen).forEach(function (k) { s.answers[k] = "yes"; });
    if (s.program !== "t2") return;
    s.evidence = window.NoticeEvidence.inspect(redacted, allPages);
    Object.keys(s.evidence).forEach(function (k) {
      var item = s.evidence[k];
      s.seen[k] = item.quote;
      s.answers[k] = item.state === "found" ? "yes" : "unsure";
    });
  }

  function first(problems) {
    problems = problems || {};
    var box = h("textarea", { id: "noticetext", class: "paste", spellcheck: "false", "aria-describedby": "noticetext-hint" });
    var reading = false, selection = 0;
    var fileStatus = h("p", {class:"small", role:"status"});
    var file = h("input", {id:"notice-pdf",type:"file",accept:".pdf,application/pdf"});
    file.addEventListener("change", async function () {
      var ticket = ++selection, chosen = file.files[0];
      reading = false;
      if (!chosen) return;
      reading = true; box.value = ""; fileStatus.textContent = "Reading the PDF on this device…";
      document.getElementById("all-notice-pages").checked = false;
      try {
        var pdf = await window.PdfText.open(chosen);
        if (ticket !== selection) return;
        if (pdf.kind !== "text") { fileStatus.textContent = "This PDF appears to be pictures. Type or paste the relevant words, or check each part manually."; return; }
        var pages = pdf.pageTexts || [pdf.text];
        box.value = pages.map(function (txt, i) { return "Page " + (i + 1) + " of " + pdf.pages + "\n" + txt; }).join("\n\n");
        fileStatus.textContent = "Read " + pdf.pages + " page(s). Compare the text below with your original." + (pages.some(function (t) {return t.trim().length < 15;}) ? " At least one page contains very little readable text. Leave the all-pages box clear until you check it." : "");
      } catch (e) { if (ticket === selection) fileStatus.textContent = "This PDF could not be read. Paste the text or check the parts manually."; }
      finally { if (ticket === selection) reading = false; }
    });
    U.show(
      h("h1", { class: "long", text: "Is my overpayment notice complete?" }),
      h("p", { class: "lead", text: "Social Security's own rules list what every overpayment notice must tell you: how much, which months, why, and your rights. Check yours part by part. If something is missing, you get a letter asking for a written explanation." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault();
        if (reading) { fileStatus.textContent = "The PDF is still being read on this device."; return; }
        var nextProgram = U.picked("program");
        if (s.program !== nextProgram) { s.answers = {}; s.seen = {}; s.evidence = {}; s.read = false; }
        s.program = nextProgram;
        if (!s.program) { first({ program: "Choose the kind of benefit the notice is about." }); return; }
        s.notice_date = document.getElementById("notice_date").value;
        var text = box.value;
        if (text.trim()) {
          var red = window.NoticeReader ? window.NoticeReader.redact(text).text : text;
          box.value = "";
          prefill(red, document.getElementById("all-notice-pages").checked);
        }
        ask();
      } } },
        U.choice("program", "What kind of benefit is the notice about?", PROGRAMS, s.program, problems, "The notice usually says near the top. SSI notices often say \"Supplemental Security Income\"."),
        U.field("notice_date", "Date printed on the notice", "Optional. It goes into your letter.", h("input", { type: "date", value: s.notice_date }), problems),
        h("div", {class:"field"}, h("label", {for:"notice-pdf",text:"Open a text PDF on this device (optional)"}), file, fileStatus),
        h("div", { class: "field" },
          h("label", { for: "noticetext" }, "Paste the words of your notice (optional)",
            h("span", { class: "hint", id: "noticetext-hint", text: "It is read on this device and not sent. Numbers that look like a Social Security or claim number are blacked out first. It only suggests answers: you check each one." })),
          box, h("label", {}, h("input", {id: "all-notice-pages", type: "checkbox", checked: s.allPages}), " I included every page of this notice.")),
        U.row(U.go("Check my notice", null, "submit"), U.quiet("Try a made-up notice", example), U.quiet("Back", U.home))));
    U.firstProblem();
  }

  function example() {
    U.trying();
    s = { program: "t2", notice_date: "", answers: {}, seen: {}, evidence: {}, allPages: false, read: true };
    prefill("Page 1 of 2\nWe paid you $3,120.00 more than you should have been paid.\nThis is for January 2026 through June 2026.\nThe overpayment was due to a rate change.\nPage 2 of 2\nPlease refund the full amount within 30 days.\nIf you do not, we will withhold $400 from each monthly payment.", true);
    ask();
  }

  function ask(problems) {
    problems = problems || {};
    var list = parts();
    U.show(
      h("h1", { class: "long", text: "Does your notice tell you these things?" }),
      h("p", { class: "lead", text: s.read ? "Answers are filled in where words on your notice seemed to cover a part, with the line they came from. Check each one against the notice itself." : "Look at the notice, every page, and answer each one." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault();
        list.forEach(function (p) { s.answers[p.id] = U.picked(p.id); });
        send();
      } } },
        list.map(function (p, i) {
          return h("div", { class: "part" },
            U.choice(p.id, (i + 1) + ". " + p.ask, ANS, s.answers[p.id] || "", problems),
            s.seen[p.id] ? h("p", { class: "photo-line" }, s.evidence[p.id] && s.evidence[p.id].page ? "Page " + s.evidence[p.id].page + " · " : "From your notice: ", h("mark", {text: s.seen[p.id]})) : null,
            s.evidence[p.id] && s.evidence[p.id].state !== "found" ? h("p", {class: "small", text: s.evidence[p.id].state === "not_located" ? "I couldn’t locate this in the supplied text. Check the original pages and confirm below." : "I couldn’t confirm this part. Check the wording and look for another page."}) : null);
        }),
        U.row(U.go("See what is missing", null, "submit"), U.quiet("Back", function () { first(); }))));
    U.firstProblem();
  }

  function send() {
    U.api("/api/notice-check", { program: s.program, answers: s.answers, notice_date: s.notice_date }).then(function (res) {
      if (!res.ok) { if (res.data.problems && res.data.problems.notice_date) first(res.data.problems); else ask(res.data.problems || {}); return; }
      U.count("notice-check", "dates");
      if (s.notice_date && !Array.isArray(res.data.appeal_dates)) {
        // A running 0.12 server may serve the new page before it has reloaded its Python modules.
        return U.api("/api/deadlines", {letter:"overpayment", notice_date:s.notice_date}).then(function (response) {
          if (response.ok) res.data.appeal_dates = response.data.items.filter(function (d) {return d.id === "appeal" || d.id === "appeal_latest";});
          result(res.data);
        }, function () {result(res.data);});
      }
      result(res.data);
    }).catch(U.failed);
  }

  function gapList(items, cls) {
    return h("ul", { class: "gaps " + cls }, items.map(function (g) {
      return h("li", {}, h("b", { text: g.ask }), h("span", { class: "small", text: " Required by POMS " + g.rule + ". " }),
        g.sources.map(function (src) { return h("a", { href: src, target: "_blank", rel: "noopener noreferrer", class: "small", text: "Source " }); }));
    }));
  }

  function text(r) {
    var out = ["IS MY OVERPAYMENT NOTICE COMPLETE?", "", r.headline, "", appealSummary(r), ""];
    followup(r).forEach(function (question) { out.push(question); });
    if (r.missing.length) { out.push("MAY BE MISSING"); r.missing.forEach(function (g) { out.push("- " + g.ask + " (POMS " + g.rule + ")"); }); out.push(""); }
    if (r.unsure.length) { out.push("NOT SURE"); r.unsure.forEach(function (g) { out.push("- " + g.ask + " (POMS " + g.rule + ")"); }); out.push(""); }
    out.push("WHAT YOU CAN DO"); r.steps.forEach(function (st, i) { out.push((i + 1) + ". " + st); });
    if (r.letter) out.push("", "LETTER", r.letter);
    out.push("", r.disclaimer);
    return out.join("\r\n");
  }

  function followup(r) {
    return r.missing.concat(r.unsure).filter(function (part) { return s.evidence[part.id]; })
      .map(function (part) { return s.evidence[part.id].question; });
  }

  function appealSummary(r) {
    var dates = r.appeal_dates || [];
    if (dates.length < 2) return "A request for an explanation is separate from an appeal. Reconsideration is generally due within 60 days of receiving the notice. Check the appeal instructions today.";
    return "Plan to act by " + U.niceDate(dates[0].date) + " (60 days from the printed date). With SSA’s usual five-day receipt assumption, the estimated filing deadline is " + U.niceDate(dates[1].date) + ". Receipt timing can change this. If a date has passed, you can explain a late filing to SSA.";
  }

  function result(r) {
    if (r.letter) U.count("notice-check", "kit");
    var questions = followup(r);
    if (r.letter && questions.length) r.letter += "\n\nMy specific questions\n" + questions.join("\n");
    U.show(
      h("h1", { class: "long", text: r.headline }),
      h("div", {class: "alert"}, h("b", {text: "Your appeal timing"}), h("p", {text: appealSummary(r)}), h("a", {href: "#overpayment", text: "Review my deadlines and appeal options"})),
      questions.length ? h("section", {}, h("h2", {text: "Questions for Social Security"}), h("ul", {}, questions.map(function (q) {return h("li", {text:q});}))) : null,
      r.missing.length ? h("div", {}, h("h2", { text: "May be missing" }), gapList(r.missing, "missing")) : null,
      r.unsure.length ? h("div", {}, h("h2", { text: "Not sure: look again" }), gapList(r.unsure, "unsure")) : null,
      r.present.length ? h("details", {}, h("summary", { text: "On your notice (" + r.present.length + ")" }), gapList(r.present, "present")) : null,
      h("h2", { text: "What you can do" }),
      h("ol", {}, r.steps.map(function (st) { return h("li", { text: st }); })),
      r.letter ? U.draftBox("Letter asking for a written explanation", r.letter, "explanation-request.txt") : null,
      h("p", {}, h("a", { href: "#check-amount", text: "Check the amount month by month" })),
      h("h2", { text: "Rules this is based on" }), U.sources(r.rules),
      h("p", {}, h("a", {href: "/review/index.html", text: "See the annotated examples and reproduce this notice check"})),
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("Print this", function () { window.print(); }), U.quiet("Download as text", function () { U.download("notice-check.txt", "text/plain", text(r)); }),
        r.letter ? U.sentButton("other", "Request for a written explanation of an overpayment", "mail") : null,
        U.quiet("Change my answers", function () { ask(); })));
  }

  window.Modules = window.Modules || {};
  window.Modules.noticeCheck = { start: start };
})();
