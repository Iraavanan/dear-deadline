/* Module 4: a letter with a decision the person disagrees with, such as a denied claim.

   It shows the appeal date and which step of appeal comes next. Appeals go in
   a fixed order, so the next step depends only on which decision the letter
   is. It says nothing about how an appeal might turn out. Nothing is stored. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var STEPS = ["Your letter", "Your date", "A few questions", "Your next step"];
  var MARKS = [[60, "is the appeal date"]];   // the track itself ends at day 65, the latest date if the letter took 5 days to arrive
  var s;

  function reset() { s = { facts: {}, answers: {}, statements: {}, result: null, read: {}, otherDates: [], q: 0 }; }
  function meta() { return U.meta().denial; }
  function evaluate() { return U.api("/api/denial", { facts: s.facts, answers: s.answers, statements: s.statements }); }
  function datebar() { if (s.result && !s.result.redirect) U.setDatebar([["Appeal by", s.result.deadlines.items[0]]]); else U.setDatebar(null); }
  function select(options, current) { return h("select", {}, options.map(function (o) { return h("option", { value: o.id, text: o.label, selected: current === o.id ? "selected" : null }); })); }

  function start() {
    U.count("decision-appeal", "start");
    reset(); U.setDatebar(null);
    U.show(
      h("h1", {}, "A decision you disagree with can be appealed, in a set order."),
      h("p", { class: "lead", text: "You generally have 60 days from when you got the letter. See your date, which step comes next, and what to send." }),
      U.timeline(null, MARKS),
      h("ul", { class: "ways" },
        U.way("Type in the date on my letter", "The date is all you need to see your deadline.", function () { factsForm(); }),
        U.way("Paste or open my letter", "A PDF or the text. It is read on your device to find the date.", letterScreen)),
      U.row(U.quiet("I have a different letter", U.home)));
  }

  function letterScreen() {
    var box = h("textarea", { id: "pasted", class: "paste", spellcheck: "false" });
    var status = h("p", { class: "status", role: "status" }), out = h("div", {});
    function say(text) { status.textContent = ""; U.fill(out, [h("p", { class: "err", role: "alert", text: text })]); }
    function readIt(pages) {
      if (!box.value.trim()) { say("Choose a file, or paste or type the words from your letter first."); box.focus(); return; }
      var red = window.NoticeReader.redact(box.value), found = window.NoticeReader.extract(box.value), kind = window.NoticeReader.kind(red.text);
      box.value = red.text;
      s.read = {}; s.otherDates = found.other_dates || [];
      if (found.notice_date) { s.facts.notice_date = found.notice_date; s.read.notice_date = "Read from your text. Check it."; }
      status.textContent = pages ? "Read " + pages + (pages === 1 ? " page" : " pages") + " on this device. Nothing was uploaded." : "";
      U.fill(out, [
        h("h2", { text: red.count ? red.count + (red.count === 1 ? " number was" : " numbers were") + " blacked out" : "No identity numbers were found" }),
        found.notice_date ? h("p", {}, "Date found: ", h("b", { text: U.niceDate(found.notice_date) }), ". You will check it on the next screen.")
          : h("p", { text: "No date could be read from that text. You can type it on the next screen." }),
        kind === "overpayment" ? h("div", { class: "alert", role: "alert" }, "This reads like an overpayment notice, which has an extra 30-day date. ", h("a", { href: "#overpayment", text: "Use the overpayment helper instead" })) : null,
        kind === "cessation" ? h("div", { class: "alert", role: "alert" }, "This reads like a letter saying your disability has ended, which has a 15-day window. ", h("a", { href: "#disability-ended", text: "Use the disability-ended helper instead" })) : null,
        h("p", { class: "small", text: "Your letter stays on this device. Only the details you confirm next are sent to work out your date." }),
        U.row(U.go("Check these details", function () { factsForm(); }))]);
      out.querySelector("h2").scrollIntoView({ block: "start" });
    }
    function openFile(file) {
      if (!file) return;
      var name = (file.name || "").toLowerCase(), type = file.type || "";
      U.fill(out, []);
      if (type === "text/plain" || /\.txt$/.test(name)) {
        var fr = new FileReader();
        fr.onload = function () { box.value = String(fr.result); readIt(); };
        fr.onerror = function () { say("That file could not be read. Paste the text instead."); };
        fr.readAsText(file);
      } else if (type === "application/pdf" || /\.pdf$/.test(name)) {
        status.textContent = "Reading your PDF on this device…";
        window.PdfText.open(file).then(function (res) {
          if (res.kind === "text") { box.value = res.text; readIt(res.pages); }
          else say("That PDF is a picture of the letter, so its words cannot be read automatically yet. Type the date from the letter instead.");
        }).catch(function () { say("That PDF could not be opened here. Type the date from the letter instead."); });
      } else say("Photos and other files cannot be read here yet. Type the date from the letter instead.");
    }
    U.show(U.progress(0, null, STEPS),
      h("h1", { class: "long", text: "Paste or open your letter" }),
      h("p", { class: "lead", text: "It is opened on this device and is not uploaded. It is read only to find the date on it." }),
      h("label", { for: "letterfile" }, "Choose a PDF or text file"),
      h("input", { id: "letterfile", type: "file", accept: ".pdf,.txt,application/pdf,text/plain", on: { change: function (ev) { openFile(ev.target.files && ev.target.files[0]); } } }),
      status,
      h("label", { for: "pasted" }, "Or paste the words here"), box,
      U.row(U.go("Black out numbers and read it", function () { readIt(); }), U.quiet("Back", start)),
      out);
  }

  function factsForm(problems) {
    var now = new Date(), maxDate = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    var form = h("form", { novalidate: "novalidate", on: { submit: function (ev) {
      ev.preventDefault();
      ["notice_date", "arrived_date", "about", "stage"].forEach(function (id) { s.facts[id] = document.getElementById(id).value; });
      evaluate().then(function (res) {
        if (!res.ok) { factsForm(res.data.problems || {}); return; }
        s.result = res.data; datebar();
        if (res.data.redirect) otherHelper(); else dateScreen();
      }).catch(U.failed);
    } } },
      U.field("notice_date", "Date printed on the letter",
        s.read.notice_date && s.otherDates.length ? "Your text has more than one date. Make sure this is the one printed at the top of the letter." : "Usually at the top of the first page.",
        h("input", { type: "date", value: s.facts.notice_date || "", max: maxDate, required: "required" }), problems, s.read.notice_date),
      U.field("arrived_date", "If it came late: the day the letter arrived", "Optional. Only if it arrived more than 5 days after the date printed on it. Keep the envelope.",
        h("input", { type: "date", value: s.facts.arrived_date || "", max: maxDate }), problems),
      U.field("about", "What is the decision about?", null, select(meta().about, s.facts.about || "unknown"), problems),
      U.field("stage", "Which decision is this letter?", "Appeals go in a set order, so this decides your next step.", select(meta().stages, s.facts.stage || "initial"), problems),
      U.row(U.go("These details are right", null, "submit"), U.quiet("Back", start)));
    U.show(U.progress(0, null, STEPS),
      h("h1", { text: "What does your letter say?" }),
      h("p", { class: "lead", text: "Nothing is worked out until you confirm these details. Leave out any Social Security or claim number." }),
      problems ? h("div", { class: "alert", role: "alert", text: "Some details need fixing before your date can be worked out." }) : null,
      form);
    if (problems) { var first = document.querySelector("[aria-invalid=true]"); if (first) first.focus(); }
  }

  function dateList(items) {
    return h("ul", { class: "dates" }, items.map(function (i, n) {
      return h("li", { class: n === 0 ? null : "aside" },
        h("div", {}, h("p", { class: "when" }, h("span", { class: n === 0 && i.status !== "passed" ? "hl" : null, text: U.niceDate(i.date) })), h("p", { class: "left " + i.status, text: U.daysText(i) })),
        h("div", {}, h("h3", { text: i.label }), h("p", { class: "small" }, i.rule + " " + i.note + " ", U.link(i.source, "Source"))));
    }));
  }

  function otherHelper() {
    var r = s.result;
    U.show(
      h("h1", { class: "long", text: "That letter has its own helper" }),
      h("div", { class: "alert", role: "alert" }, r.message + " ", h("a", { href: "#" + r.redirect, text: "Open that helper" })),
      h("p", { text: "The general appeal date for your letter is below, but the other helper shows the shorter date too." }),
      dateList(r.deadlines.items),
      U.row(U.quiet("Change what I entered", function () { factsForm(); })));
  }

  function calendarFile() {
    var d = s.result.deadlines, stamp = d.today.replace(/-/g, "") + "T000000Z";
    function event(item, title) {
      var day = item.date.replace(/-/g, "");
      var next = new Date(Date.parse(item.date + "T00:00:00Z") + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
      return ["BEGIN:VEVENT", "UID:" + item.id + "-" + day + "@dear-deadline", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + day, "DTEND;VALUE=DATE:" + next,
        "SUMMARY:" + title, "DESCRIPTION:Counted from the letter dated " + U.niceDate(d.notice_date).replace(",", "\\,") + ". Made by an independent tool\\, not by Social Security.",
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + title, "TRIGGER:-P7D", "END:VALARM", "END:VEVENT"].join("\r\n");
    }
    U.download("appeal-date.ics", "text/calendar", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dear Deadline//EN",
      event(d.items[0], "Appeal the Social Security decision by today to be safe (early date)"),
      event(d.items[1], "Latest day to appeal the Social Security decision\\, if the letter took 5 days to arrive"), "END:VCALENDAR"].join("\r\n"));
  }

  function dateScreen() {
    U.count("decision-appeal", "dates", U.isLate(s.result));
    var d = s.result.deadlines, day = 60 - d.items[0].days_left;
    U.show(U.progress(1, null, STEPS),
      h("h1", {}, "Your appeal date"),
      h("p", { class: "lead", text: "Counted from the letter's date of " + U.niceDate(d.notice_date) + ". If you stop here, write it down." }),
      U.timeline(day, MARKS),
      dateList(d.items),
      d.advice.map(function (a) { return h("p", { text: a }); }),
      U.row(U.quiet("Add this date to my calendar", calendarFile)),
      U.row(U.go("Answer a few questions", function () { s.q = 0; question(); }), U.quiet("Change letter details", function () { factsForm(); })));
  }

  function question() {
    var qs = meta().questions;
    if (s.q >= qs.length) { ownWords(); return; }
    var q = qs[s.q], current = s.answers[q.id];
    function answer(value, text) {
      return h("button", { class: "answer", type: "button", "data-answer": value, "aria-pressed": current === value ? "true" : "false", on: { click: function () { s.answers[q.id] = value; s.q += 1; question(); } }, text: text });
    }
    U.show(U.progress(2, "question " + (s.q + 1) + " of " + qs.length, STEPS),
      h("h1", { class: "long", text: q.text }),
      h("div", { class: "answers" }, answer("yes", "Yes"), answer("no", "No"), answer("unknown", "I don't know")),
      U.row(U.quiet("Back", function () { if (s.q === 0) dateScreen(); else { s.q -= 1; question(); } })));
  }

  function ownWords() {
    var late = s.result.deadlines.items[1].status === "passed";
    var asks = [["why_disagree", "Why do you disagree with the decision?", "Be as specific as you can. This goes into your draft exactly as you write it."],
      ["evidence", "What evidence will you send?", "For example records, letters or pay stubs Social Security has not seen."]];
    if (late) asks.push(["late_reason", "Why is this late?", "The date has passed. Social Security may give more time for a good reason, asked for in writing."]);
    var form = h("form", { on: { submit: function (ev) {
      ev.preventDefault();
      asks.forEach(function (x) { s.statements[x[0]] = document.getElementById(x[0]).value; });
      evaluate().then(function (res) { if (!res.ok) { U.failed(); return; } s.result = res.data; datebar(); kit(); }).catch(U.failed);
    } } },
      asks.map(function (x) { return U.field(x[0], x[1], x[2], h("textarea", { maxlength: "2000" }, s.statements[x[0]] || "")); }),
      U.row(U.go("See my next step", null, "submit"), U.quiet("Back", function () { s.q = meta().questions.length - 1; question(); })));
    U.show(U.progress(2, "your own words", STEPS),
      h("h1", { class: "long", text: "Add your own words, if you want to" }),
      h("p", { class: "lead", text: "Every box is optional. Leave out any Social Security number." }),
      form);
  }

  function levelBlock(l, mine) {
    return h("div", { class: "opt" + (mine ? " fit" : "") },
      mine ? h("p", { class: "flag may_fit", text: "Your next step" }) : null,
      h("h3", {}, l.name, l.form ? h("span", { class: "form", text: "Form " + l.form }) : null),
      h("p", { text: l.about }),
      h("p", {}, U.link(l.online, "Start this step on Social Security's website"), " ", h("span", { class: "small" }, U.link(l.source, "Source"))));
  }

  function kitText(k) {
    var out = [k.title.toUpperCase(), "", k.summary, "", "YOUR DATE"];
    k.dates.forEach(function (d) { out.push("- " + d.label + ": " + U.niceDate(d.date) + " (" + U.daysText(d) + ")"); });
    k.advice.forEach(function (a) { out.push(a); });
    if (k.next) out.push("", "YOUR NEXT STEP: " + k.next.name.toUpperCase() + (k.next.form ? " (Form " + k.next.form + ")" : ""), k.next.about, k.next.online);
    k.levels.forEach(function (l) { out.push("", l.order + ". " + l.name + (l.form ? " (Form " + l.form + ")" : ""), l.about, l.online); });
    if (k.court_note) out.push("", k.court_note);
    if (k.draft) { out.push("", "Draft to copy:"); k.draft.forEach(function (l) { out.push("  " + l); }); }
    if (k.how.length) { out.push("", "HOW TO ASK"); k.how.forEach(function (x, i) { out.push((i + 1) + ". " + x); }); }
    out.push("", "DOCUMENTS TO GATHER"); k.documents.forEach(function (d) { out.push("- " + d); });
    out.push("", k.representative, "", "GET HELP", k.get_help.text + " " + k.get_help.legal_aid_finder, "Social Security: " + k.get_help.phone + " (TTY " + k.get_help.tty + ")", "", k.disclaimer);
    return out.join("\r\n");
  }

  function kit() {
    U.count("decision-appeal", "kit");
    var r = s.result, k = r.kit, said = h("p", { class: "status", role: "status" });
    var copy = h("button", { class: "copy", type: "button", text: "Copy this draft", on: { click: function () {
      var done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy this draft"; }, 2500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(k.draft.join("\n\n")).then(done, function () { copy.textContent = "Select the text and copy it by hand"; });
      else copy.textContent = "Select the text and copy it by hand";
    } } });
    U.show(U.progress(3, null, STEPS),
      h("h1", { text: k.title }),
      h("p", { class: "lead", text: k.summary }),
      U.row(U.go("Print or save as PDF", function () { window.print(); }), U.quiet("Download as text", function () { U.download("appeal-kit.txt", "text/plain", kitText(k)); }), U.quiet("Add the date to my calendar", calendarFile),
        U.sentButton("appeal", "Decision dated " + U.niceDate(s.facts.notice_date)),
        U.timelineButton("Decision to appeal", s.facts.notice_date, k.dates)),
      h("h2", { text: "Your date" }),
      h("ul", {}, k.dates.map(function (d, n) { return h("li", {}, d.label + ": ", h("b", { class: n === 0 && d.status !== "passed" ? "hl" : null, text: U.niceDate(d.date) }), " (" + U.daysText(d).toLowerCase() + ")"); })),
      k.advice.map(function (a) { return h("p", { text: a }); }),
      h("h2", { text: k.next ? "Your next step" : "The steps of appeal, in order" }),
      k.next ? levelBlock(k.next, true) : k.levels.map(function (l) { return levelBlock(l, false); }),
      k.court_note ? h("div", { class: "alert", role: "note", text: k.court_note }) : null,
      r.notes.length ? [h("h2", { text: "Keep in mind" }), h("ul", {}, r.notes.map(function (n) { return h("li", { text: n }); }))] : null,
      k.draft ? [h("h2", { text: "Draft to copy into your request" }), h("div", { class: "draft" }, k.draft.map(function (l) { return h("p", { text: l }); })), copy] : null,
      k.how.length ? [h("h2", { text: "How to ask" }), h("ol", {}, k.how.map(function (x) { return h("li", { text: x }); }))] : null,
      h("h2", { text: "Documents to gather" }),
      h("ul", {}, k.documents.map(function (d) { return h("li", { text: d }); })),
      h("h2", { text: "Get help" }),
      r.notes.some(function (n) { return n.indexOf(k.representative) === 0; }) ? null : h("p", { text: k.representative }),
      h("p", {}, k.get_help.text + " ", U.link(k.get_help.legal_aid_finder, "Find legal aid")),
      h("p", {}, "Social Security: " + k.get_help.phone + " (TTY " + k.get_help.tty + "). ", U.link(k.get_help.office_locator, "Find a local office")),
      h("p", { class: "small", text: k.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("I know what to do next", function () { said.textContent = "Good. Print or download this page before you close it; it is not saved anywhere."; }), U.quiet("Start over", start)),
      said);
  }

  window.Modules = window.Modules || {};
  window.Modules.denial = { start: start };
})();
