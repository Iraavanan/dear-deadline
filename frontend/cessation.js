/* Module 2: a letter saying a person's disability has ended after a medical review.

   Two clocks run on this letter: the choice about keeping benefits during the
   appeal must be received within 15 days of the notice date, and the appeal
   has 60 days. This module shows both, lays out the choices without picking
   one, and builds a kit for Forms SSA-789 and SSA-792.

   Like the rest of the site, nothing typed here is stored. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var STEPS = ["Your letter", "Your dates", "A few questions", "Your choice"];
  var MARKS = [[15, "is when your choice about keeping benefits must be received"], [60, "is the appeal date"]];
  var s;

  function reset() { s = { facts: {}, answers: {}, statements: {}, choice: "undecided", result: null, sample: null, read: {}, otherDates: [], q: 0 }; }
  function meta() { return U.meta().cessation; }
  function byId(id) { return s.result.deadlines.items.filter(function (i) { return i.id === id; })[0]; }
  function evaluate() { return U.api("/api/cessation", { facts: s.facts, answers: s.answers, choice: s.choice, statements: s.statements }); }

  function datebar() {
    if (!s.result || !s.result.in_scope) { U.setDatebar(null); return; }
    U.setDatebar([["Keep-benefits choice must be received by", byId("continuation_received_by")], ["Appeal by", byId("appeal")]]);
  }

  // ---------- start ----------

  function start() {
    U.count("disability-ended", "start");
    reset(); U.setDatebar(null);
    U.show(
      h("h1", {}, "A letter saying your disability has ended starts two clocks."),
      h("p", { class: "lead", text: "To keep benefits coming while you appeal, Social Security must receive your choice within 15 days of the date on the letter. The appeal itself has 60 days." }),
      U.timeline(null, MARKS),
      h("ul", { class: "ways" },
        U.way("Type in the date on my letter", "The date is all you need to see your deadlines.", function () { factsForm(); }),
        U.way("Paste or open my letter", "A PDF or the text. It is read on your device to find the date.", letterScreen),
        U.way("Try a made-up letter first", "See how it works. Nothing about you is needed.", sampleList)),
      U.row(U.quiet("I have a different letter", U.home)));
  }

  function sampleList() {
    U.api("/api/samples?module=cessation").then(function (res) {
      U.show(
        h("h1", { text: "Pick a made-up letter" }),
        h("p", { class: "lead", text: "Two situations. The people and dates are invented." }),
        h("ul", { class: "ways" }, res.data.map(function (x) {
          return U.way(x.title, x.story, function () {
            s.sample = x; s.facts = Object.assign({}, x.facts); s.answers = Object.assign({}, x.answers); s.statements = Object.assign({}, x.statements);
            factsForm();
          });
        })),
        U.row(U.quiet("Back", start)));
    }).catch(U.failed);
  }

  // ---------- paste or open the letter, read on the device ----------

  function letterScreen() {
    var box = h("textarea", { id: "pasted", class: "paste", spellcheck: "false" });
    var status = h("p", { class: "status", role: "status" });
    var out = h("div", {});
    function say(text) { status.textContent = ""; U.fill(out, [h("p", { class: "err", role: "alert", text: text })]); }

    function readIt(pages) {
      if (!box.value.trim()) { say("Choose a file, or paste or type the words from your letter first."); box.focus(); return; }
      var red = window.NoticeReader.redact(box.value);
      var found = window.NoticeReader.extract(box.value);
      var kind = window.NoticeReader.kind(red.text);
      box.value = red.text;
      s.read = {}; s.otherDates = found.other_dates || [];
      if (found.notice_date) { s.facts.notice_date = found.notice_date; s.read.notice_date = "Read from your text. Check it."; }
      if (kind === "cessation") { s.facts.letter_kind = "medical"; s.read.letter_kind = "Guessed from your text. Check it."; }
      status.textContent = pages ? "Read " + pages + (pages === 1 ? " page" : " pages") + " on this device. Nothing was uploaded." : "";
      U.fill(out, [
        h("h2", { text: red.count ? red.count + (red.count === 1 ? " number was" : " numbers were") + " blacked out" : "No identity numbers were found" }),
        found.notice_date ? h("p", {}, "Date found: ", h("b", { text: U.niceDate(found.notice_date) }), ". You will check it on the next screen.")
          : h("p", { text: "No date could be read from that text. You can type it on the next screen." }),
        kind === "overpayment" ? h("div", { class: "alert", role: "alert" }, "This reads like an overpayment notice, not a letter saying your disability has ended. ",
          h("a", { href: "#overpayment", text: "Use the overpayment helper instead" })) : null,
        h("p", { class: "small", text: "Your letter stays on this device. Only the details you confirm next are sent to work out your dates." }),
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

    U.show(
      U.progress(0, null, STEPS),
      h("h1", { class: "long", text: "Paste or open your letter" }),
      h("p", { class: "lead", text: "It is opened on this device and is not uploaded. It is read only to find the date on it." }),
      h("label", { for: "letterfile" }, "Choose a PDF or text file"),
      h("input", { id: "letterfile", type: "file", accept: ".pdf,.txt,application/pdf,text/plain", on: { change: function (ev) { openFile(ev.target.files && ev.target.files[0]); } } }),
      status,
      h("label", { for: "pasted" }, "Or paste the words here"),
      box,
      U.row(U.go("Black out numbers and read it", function () { readIt(); }), U.quiet("Back", start)),
      out);
  }

  // ---------- the letter's details ----------

  function select(options, current) {
    return h("select", {}, options.map(function (o) { return h("option", { value: o.id, text: o.label, selected: current === o.id ? "selected" : null }); }));
  }

  function factsForm(problems) {
    var now = new Date();
    var maxDate = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    var form = h("form", { novalidate: "novalidate", on: { submit: function (ev) {
      ev.preventDefault();
      ["notice_date", "arrived_date", "letter_kind", "benefit_kind"].forEach(function (id) { s.facts[id] = document.getElementById(id).value; });
      evaluate().then(function (res) {
        if (!res.ok) { factsForm(res.data.problems || {}); return; }
        s.result = res.data; datebar();
        if (res.data.in_scope) datesScreen(); else notCovered();
      }).catch(U.failed);
    } } },
      U.field("notice_date", "Date printed on the letter",
        s.read.notice_date && s.otherDates.length ? "Your text has more than one date. Make sure this is the one printed at the top of the letter, not a deadline." : "Usually at the top of the first page.",
        h("input", { type: "date", value: s.facts.notice_date || "", max: maxDate, required: "required" }), problems, s.read.notice_date),
      U.field("arrived_date", "If it came late: the day the letter arrived", "Optional. Only if it arrived more than 5 days after the date printed on it. Keep the envelope.",
        h("input", { type: "date", value: s.facts.arrived_date || "", max: maxDate }), problems),
      U.field("letter_kind", "What does the letter say?", "Different letters follow different rules.",
        select(meta().letter_kinds, s.facts.letter_kind || "medical"), problems, s.read.letter_kind),
      U.field("benefit_kind", "Which benefit is ending?", null, select(meta().benefit_kinds, s.facts.benefit_kind || "unknown"), problems),
      U.row(U.go("These details are right", null, "submit"), U.quiet("Back", start)));
    U.show(
      U.progress(0, null, STEPS),
      h("h1", { text: s.sample ? "Check what the letter says" : "What does your letter say?" }),
      h("p", { class: "lead", text: "Nothing is worked out until you confirm these details. Leave out any Social Security or claim number." }),
      s.sample ? h("div", { class: "letter", text: s.sample.notice_text }) : null,
      problems ? h("div", { class: "alert", role: "alert", text: "Some details need fixing before your dates can be worked out." }) : null,
      form);
    if (problems) { var first = document.querySelector("[aria-invalid=true]"); if (first) first.focus(); }
  }

  function dateList(items, loud) {
    return h("ul", { class: "dates" }, items.map(function (i) {
      var strong = loud.indexOf(i.id) !== -1;
      return h("li", { class: strong ? null : "aside" },
        h("div", {},
          h("p", { class: "when" }, h("span", { class: strong && i.status !== "passed" ? "hl" : null, text: U.niceDate(i.date) })),
          h("p", { class: "left " + i.status, text: U.daysText(i) })),
        h("div", {}, h("h3", { text: i.label }), h("p", { class: "small" }, i.rule + " " + i.note + " ", U.link(i.source, "Source"))));
    }));
  }

  function notCovered() {
    var r = s.result;
    U.show(
      h("h1", { class: "long", text: "This helper does not cover that letter" }),
      h("div", { class: "alert", role: "alert", text: r.message }),
      h("h2", { text: "What to do today" }),
      h("ul", {}, r.what_to_do.map(function (t) { return h("li", { text: t }); })),
      dateList(r.deadlines.items, ["appeal"]),
      h("p", {}, r.get_help.text + " ", U.link(r.get_help.legal_aid_finder, "Find legal aid")),
      U.row(U.quiet("Change what I entered", function () { factsForm(); }), U.quiet("I have a different letter", U.home)));
  }

  // ---------- dates ----------

  function calendarFile() {
    var d = s.result.deadlines, stamp = d.today.replace(/-/g, "") + "T000000Z";
    function event(item, title) {
      var day = item.date.replace(/-/g, "");
      var next = new Date(Date.parse(item.date + "T00:00:00Z") + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
      return ["BEGIN:VEVENT", "UID:" + item.id + "-" + day + "@dear-deadline", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + day, "DTEND;VALUE=DATE:" + next,
        "SUMMARY:" + title, "DESCRIPTION:Counted from the letter dated " + U.niceDate(d.notice_date).replace(",", "\\,") + ". Made by an independent tool\\, not by Social Security.",
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + title, "TRIGGER:-P2D", "END:VALARM", "END:VEVENT"].join("\r\n");
    }
    U.download("disability-ended-letter-dates.ics", "text/calendar", ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dear Deadline//EN",
      event(byId("continuation_aim"), "Hand in Form SSA-792 (choice about keeping benefits during appeal)"),
      event(byId("continuation_received_by"), "Last day Social Security can receive Form SSA-792"),
      event(byId("appeal"), "Appeal the disability-ended decision by today to be safe (early date\\, Form SSA-789)"),
      event(byId("appeal_latest"), "Latest day to appeal the disability-ended decision\\, if the letter took 5 days to arrive"), "END:VCALENDAR"].join("\r\n"));
  }

  function datesScreen() {
    U.count("disability-ended", "dates", U.isLate(s.result));
    var r = s.result, d = r.deadlines, day = 15 - byId("continuation_received_by").days_left;
    U.show(
      U.progress(1, null, STEPS),
      h("h1", {}, "Your dates"),
      h("p", { class: "lead", text: "Counted from the letter's date of " + U.niceDate(d.notice_date) + ". If you stop here, write these down." }),
      r.caution ? h("div", { class: "alert", role: "alert", text: r.caution }) : null,
      U.timeline(day, MARKS),
      dateList(d.items, ["continuation_received_by", "appeal"]),
      d.advice.map(function (a) { return h("p", { text: a }); }),
      U.row(U.quiet("Add these dates to my calendar", calendarFile)),
      U.row(U.go("Answer a few questions", function () { s.q = 0; question(); }), U.quiet("Change letter details", function () { factsForm(); })));
  }

  // ---------- questions ----------

  function question() {
    var qs = meta().questions;
    if (s.q >= qs.length) { choiceScreen(); return; }
    var q = qs[s.q], current = s.answers[q.id];
    function answer(value, text) {
      return h("button", { class: "answer", type: "button", "data-answer": value, "aria-pressed": current === value ? "true" : "false",
        on: { click: function () { s.answers[q.id] = value; s.q += 1; question(); } }, text: text });
    }
    U.show(
      U.progress(2, "question " + (s.q + 1) + " of " + qs.length, STEPS),
      h("h1", { class: "long", text: q.text }),
      q.hint ? h("p", { class: "lead", text: q.hint }) : null,
      h("div", { class: "answers" }, answer("yes", "Yes"), answer("no", "No"), answer("unknown", "I don't know")),
      U.row(U.quiet("Back", function () { if (s.q === 0) datesScreen(); else { s.q -= 1; question(); } })));
  }

  // ---------- the choice: laid out, never made for the person ----------

  function choiceScreen() {
    evaluate().then(function (res) {
      if (!res.ok) { U.failed(); return; }
      s.result = res.data; datebar();
      var r = s.result;
      function pick(id) { return function () { s.choice = id; ownWords(); }; }
      U.show(
        U.progress(3, null, STEPS),
        h("h1", { class: "long", text: "Your choice about keeping benefits during the appeal" }),
        h("p", { class: "lead", text: "This is yours to decide. Each choice is set out with what it means and what it risks. Whatever you choose, Form SSA-792 must reach Social Security by " + U.niceDate(byId("continuation_received_by").date) + "." }),
        h("h2", { text: "Things to weigh" }),
        h("ul", {}, r.to_weigh.map(function (t) { return h("li", { text: t }); })),
        h("h2", { text: "The choices" }),
        r.choices.map(function (c) {
          return h("div", { class: "opt fit" },
            h("h3", { text: c.name }),
            h("p", { text: c.means }),
            h("p", {}, h("b", { text: "What it risks: " }), c.risk),
            c.note ? h("p", { class: "small", text: c.note }) : null,
            U.row(U.quiet("I choose this", pick(c.id))));
        }),
        U.row(U.go("I haven't decided yet", pick("undecided")), U.quiet("Change my answers", function () { s.q = 0; question(); })));
    }).catch(U.failed);
  }

  function ownWords() {
    var late = s.result.deadlines.items.some(function (i) { return (i.id === "continuation_received_by" || i.id === "appeal_latest") && i.status === "passed"; });
    var asks = [["why_disagree", "Why do you disagree that your disability has ended?", "Be as specific as you can. This goes into your draft exactly as you write it."],
      ["treatment", "What treatment have you had since your last review?", "Doctors, clinics, hospital stays, new medicines."]];
    if (late) asks.push(["late_reason", "Why is this late?", "A date has passed. Both forms ask for the reason, and Social Security decides whether to accept it."]);
    var form = h("form", { on: { submit: function (ev) {
      ev.preventDefault();
      asks.forEach(function (x) { s.statements[x[0]] = document.getElementById(x[0]).value; });
      evaluate().then(function (res) { if (!res.ok) { U.failed(); return; } s.result = res.data; datebar(); kit(); }).catch(U.failed);
    } } },
      asks.map(function (x) { return U.field(x[0], x[1], x[2], h("textarea", { maxlength: "2000" }, s.statements[x[0]] || "")); }),
      U.row(U.go("Get my kit", null, "submit"), U.quiet("Back", choiceScreen)));
    U.show(U.progress(3, "your own words", STEPS),
      h("h1", { class: "long", text: "Add your own words, if you want to" }),
      h("p", { class: "lead", text: "Every box is optional. Leave out any Social Security number." }),
      form);
  }

  // ---------- kit ----------

  function kitText(k) {
    var out = [k.title.toUpperCase(), "", k.summary, "", "YOUR DATES"];
    k.dates.forEach(function (d) { out.push("- " + d.label + ": " + U.niceDate(d.date) + " (" + U.daysText(d) + ")"); });
    k.advice.forEach(function (a) { out.push(a); });
    out.push("", "FORM " + k.election.form + ": " + k.election.title, k.election.url);
    if (k.election.chosen) out.push("Your choice: " + k.election.chosen, "Where on the form: " + k.election.where_on_form);
    else out.push(k.election.undecided_note);
    if (k.election.warning) out.push("Before you choose to keep payments: " + k.election.warning);
    if (k.election.late) out.push(k.election.late, k.election.late_draft);
    out.push("", "THE CHOICES");
    k.choices.forEach(function (c) { out.push("- " + c.name + ". " + c.means + " What it risks: " + c.risk); });
    out.push("", "FORM " + k.appeal.form + ": " + k.appeal.title, k.appeal.url, k.appeal.about, k.appeal.hearing, "", "Draft to copy onto the form:");
    k.appeal.draft.forEach(function (l) { out.push("  " + l); });
    out.push("", "DOCUMENTS TO GATHER"); k.documents.forEach(function (d) { out.push("- " + d); });
    out.push("", "HOW TO FILE"); k.how_to_file.forEach(function (x, i) { out.push((i + 1) + ". " + x); });
    out.push("", k.if_you_lose, "", "GET HELP", k.get_help.text + " " + k.get_help.legal_aid_finder, "Social Security: " + k.get_help.phone + " (TTY " + k.get_help.tty + ")", "", k.disclaimer);
    return out.join("\r\n");
  }

  function kit() {
    U.count("disability-ended", "kit");
    var k = s.result.kit, e = k.election, said = h("p", { class: "status", role: "status" });
    function copy(lines) {
      return h("button", { class: "copy", type: "button", text: "Copy this draft", on: { click: function (ev) {
        var btn = ev.currentTarget, done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy this draft"; }, 2500); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lines.join("\n\n")).then(done, function () { btn.textContent = "Select the text and copy it by hand"; });
        else btn.textContent = "Select the text and copy it by hand";
      } } });
    }
    U.show(
      h("h1", { text: k.title }),
      h("p", { class: "lead", text: k.summary }),
      U.row(U.go("Print or save as PDF", function () { window.print(); }),
        U.quiet("Download as text", function () { U.download("disability-ended-letter-kit.txt", "text/plain", kitText(k)); }),
        U.quiet("Add dates to my calendar", calendarFile),
        U.sentButton("appeal", "Disability-ended letter dated " + U.niceDate(s.facts.notice_date)),
        U.timelineButton("Disability-ended letter", s.facts.notice_date, k.dates)),
      h("h2", { text: "Your dates" }),
      h("ul", {}, k.dates.map(function (d) {
        var loud = (d.label.indexOf("must have it") !== -1 || d.label === "Appeal by this date") && d.status !== "passed";
        return h("li", {}, d.label + ": ", h("b", { class: loud ? "hl" : null, text: U.niceDate(d.date) }), " (" + U.daysText(d).toLowerCase() + ")");
      })),
      k.advice.map(function (a) { return h("p", { text: a }); }),
      h("h2", { text: "First: your choice about keeping benefits, Form " + e.form }),
      h("p", {}, e.title + ": ", U.link(e.url)),
      e.chosen ? [h("p", {}, "Your choice: ", h("b", { text: e.chosen }), "."), h("p", { class: "small", text: "Where on the form: " + e.where_on_form + "." })]
        : h("p", { text: e.undecided_note }),
      e.warning ? h("div", { class: "alert", role: "note" }, h("b", { text: "Before you choose to keep payments: " }), e.warning) : null,
      e.late ? [h("p", { text: e.late }), h("div", { class: "draft" }, h("p", { text: e.late_draft }))] : null,
      h("h3", { text: "The choices" }),
      h("ul", {}, k.choices.map(function (c) { return h("li", {}, h("b", { text: c.name + ". " }), c.means + " What it risks: " + c.risk); })),
      h("h2", { text: "Then: your appeal, Form " + k.appeal.form }),
      h("p", {}, k.appeal.title + ": ", U.link(k.appeal.url)),
      h("p", { text: k.appeal.about }),
      h("p", { class: "small", text: k.appeal.hearing }),
      h("h3", { text: "Draft to copy onto the form" }),
      h("div", { class: "draft" }, k.appeal.draft.map(function (l) { return h("p", { text: l }); })),
      copy(k.appeal.draft),
      h("h2", { text: "Documents to gather" }),
      h("ul", {}, k.documents.map(function (d) { return h("li", { text: d }); })),
      h("h2", { text: "How to file" }),
      h("ol", {}, k.how_to_file.map(function (x) { return h("li", { text: x }); })),
      h("p", {}, k.if_you_lose + " ", h("a", { href: "#overpayment", text: "Overpayment helper" })),
      h("h2", { text: "Get help" }),
      h("p", {}, k.get_help.text + " ", U.link(k.get_help.legal_aid_finder, "Find legal aid")),
      h("p", {}, "Social Security: " + k.get_help.phone + " (TTY " + k.get_help.tty + "). ", U.link(k.get_help.office_locator, "Find a local office")),
      h("p", { class: "small", text: k.disclaimer + " Rules checked as of " + s.result.rules_as_of + "." }),
      U.row(U.go("I know what to do next", function () { said.textContent = "Good. Print or download this page before you close it; it is not saved anywhere."; }), U.quiet("Start over", start)),
      said);
  }

  window.Modules = window.Modules || {};
  window.Modules.cessation = { start: start };
})();
