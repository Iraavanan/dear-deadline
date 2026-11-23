/* Letter finder: other Social Security letters, and letters about Medicare.

   Shows what a letter is, whether a deadline applies and the first thing to do.
   Three letters hand over to their own full helper. A pasted letter is matched
   on the device and never sent; only the letter chosen and one date are. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var s;
  function meta() { return U.meta().letters; }
  function byId(id) { return meta().list.filter(function (l) { return l.id === id; })[0]; }
  function label(group) { return meta().groups.filter(function (g) { return g.id === group; })[0].label; }

  function start(group) {
    s = { group: group === "medicare" ? "medicare" : "ssa", letter: null, date: "", result: null, said: {} };
    U.count("find-letter", "start"); U.setDatebar(null);
    finder();
  }

  function row(l) {
    return U.way(l.title, l.cue, function () { open(l.id); }, l.chip, !l.has_dates && !l.helper);
  }

  function finder() {
    var other = s.group === "ssa" ? "medicare" : "ssa";
    var list = h("ul", { class: "ways", id: "letter-list" }), none = h("p", { class: "small", role: "status" });
    var mine = meta().list.filter(function (l) { return l.group === s.group; });
    function draw(words) {
      var q = words.trim().toLowerCase();
      var shown = mine.filter(function (l) { return !q || (l.title + " " + l.cue).toLowerCase().indexOf(q) >= 0; });
      U.fill(list, shown.map(row));
      none.textContent = shown.length ? "" : "Nothing on the list has those words. Clear the box to see every letter, or paste your letter below.";
    }
    var box = h("input", { id: "letter-words", type: "search", autocomplete: "off", on: { input: function () { draw(box.value); } } });
    U.show(
      h("h1", { text: s.group === "medicare" ? "Which Medicare letter do you have?" : "Which Social Security letter do you have?" }),
      h("p", { class: "lead", text: "Pick the one that matches. Each page says what the letter is, whether a deadline applies, and the first thing to do." }),
      h("label", { for: "letter-words" }, "Type a word from your letter to narrow the list", h("span", { class: "hint", text: "For example: review, premium, denial." })),
      box, none, list,
      U.row(U.quiet("Paste or open my letter and find it for me", pasteScreen),
        U.quiet(other === "medicare" ? "Show Medicare letters" : "Show Social Security letters", function () { s.group = other; finder(); }),
        U.quiet("My letter is not on this list", U.otherLetter),
        U.quiet("Back", U.home)));
    draw("");
  }

  function pasteScreen() {
    var box = h("textarea", { id: "pasted", class: "paste", spellcheck: "false" });
    var status = h("p", { class: "status", role: "status" }), out = h("div", {});
    function say(text) { status.textContent = ""; U.fill(out, [h("p", { class: "err", role: "alert", text: text })]); }
    function findIt(pages) {
      if (!box.value.trim()) { say("Choose a file, or paste or type the words from your letter first."); box.focus(); return; }
      var red = window.NoticeReader.redact(box.value), found = window.NoticeReader.extract(box.value);
      box.value = red.text;
      var matches = window.LetterFind.rank(red.text).slice(0, 3).map(function (m) { return byId(m.id); }).filter(Boolean);
      s.date = found.notice_date || "";
      status.textContent = pages ? "Read " + pages + (pages === 1 ? " page" : " pages") + " on this device. Nothing was uploaded." : "";
      U.fill(out, [
        h("h2", { text: matches.length ? "It looks most like" : "This letter could not be matched" }),
        matches.length ? h("ul", { class: "ways" }, matches.map(row))
          : h("p", { text: "Nothing in the text matched a letter on the list. Pick from the list instead, or see what applies to most letters." }),
        h("p", { class: "small", text: (red.count ? red.count + (red.count === 1 ? " identity number was" : " identity numbers were") + " blacked out. " : "") + "The match is a suggestion made on this device. Check it against your letter. Your letter is not sent anywhere." }),
        U.row(U.quiet("Pick from the list instead", finder), U.quiet("My letter is not on this list", U.otherLetter))]);
      out.querySelector("h2").scrollIntoView({ block: "start" });
    }
    function openFile(file) {
      if (!file) return;
      var name = (file.name || "").toLowerCase(), type = file.type || "";
      U.fill(out, []);
      if (type === "text/plain" || /\.txt$/.test(name)) {
        var fr = new FileReader();
        fr.onload = function () { box.value = String(fr.result); findIt(); };
        fr.onerror = function () { say("That file could not be read. Paste the text instead."); };
        fr.readAsText(file);
      } else if (type === "application/pdf" || /\.pdf$/.test(name)) {
        status.textContent = "Reading your PDF on this device…";
        window.PdfText.open(file).then(function (res) {
          if (res.kind === "text") { box.value = res.text; findIt(res.pages); }
          else say("That PDF is a picture of the letter, so its words cannot be read automatically yet. Pick your letter from the list instead.");
        }).catch(function () { say("That PDF could not be opened here. Pick your letter from the list instead."); });
      } else say("Photos and other files cannot be read here yet. Pick your letter from the list instead.");
    }
    U.show(
      h("h1", { text: "Paste or open your letter" }),
      h("p", { class: "lead", text: "It is opened on this device and is not uploaded. It is read only to work out which letter it is and to find the date on it." }),
      h("label", { for: "letterfile" }, "Choose a PDF or text file"),
      h("input", { id: "letterfile", type: "file", accept: ".pdf,.txt,application/pdf,text/plain", on: { change: function (ev) { openFile(ev.target.files && ev.target.files[0]); } } }),
      status,
      h("label", { for: "pasted" }, "Or paste the words here"), box,
      U.row(U.go("Find my letter", function () { findIt(); }), U.quiet("Back", finder)),
      out);
  }

  function open(id) {
    U.api("/api/letter", { letter: id }).then(function (res) {
      if (!res.ok) { U.failed(); return; }
      s.letter = id; s.result = res.data; s.said = {}; U.count("find-letter", "kit");
      page();
    }).catch(U.failed);
  }

  function dateList(items) {
    return h("ul", { class: "dates" }, items.map(function (i, n) {
      return h("li", { class: n === 0 ? null : "aside" },
        h("div", {}, h("p", { class: "when" }, h("span", { class: n === 0 && i.status !== "passed" ? "hl" : null, text: U.niceDate(i.date) })), h("p", { class: "left " + i.status, text: U.daysText(i) })),
        h("div", {}, h("h3", { text: i.label }), h("p", { class: "small" }, i.rule + " " + i.note + " ", U.link(i.source, "Source"))));
    }));
  }

  function pageText(r) {
    var l = r.letter, out = [l.title.toUpperCase(), "", l.plain];
    if (r.dates) { out.push("", "YOUR DATES"); r.dates.items.forEach(function (d) { out.push("- " + d.label + ": " + U.niceDate(d.date) + " (" + U.daysText(d) + ")"); }); out.push(r.dates.advice); }
    out.push("", "WHAT TO DO"); l.do.forEach(function (x, i) { out.push((i + 1) + ". " + x); });
    (l.forms || []).forEach(function (f) { out.push(f.name + ": " + f.url); });
    if (r.kit) {
      out.push("", r.kit.title.toUpperCase()); r.kit.draft.forEach(function (x) { out.push(x); });
      out.push("", r.kit.kind === "call" ? "HAVE READY" : "SEND WITH IT"); r.kit.include.forEach(function (x) { out.push("- " + x); });
      out.push("", "HOW"); r.kit.how.forEach(function (x, i) { out.push((i + 1) + ". " + x); });
      out.push("", "MY RECORD"); r.kit.record.forEach(function (x) { out.push(x + ": ______________________________"); });
    }
    out.push("", l.contact, "Source: " + l.source, "", "Made by an independent tool. It is not from the Social Security Administration or Medicare, and it is not legal advice.");
    return out.join("\r\n");
  }

  function page(problems) {
    var r = s.result, l = r.letter, d = r.dates;
    if (d) U.setDatebar([[d.items[0].label.replace(/ (by|no later than) this (date|day)$/, "") + " by", d.items[0]]]); else U.setDatebar(null);
    var form = null;
    if (l.has_dates && !l.helper) {
      form = h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault();
        s.date = document.getElementById("letter_date").value;
        U.api("/api/letter", { letter: s.letter, date: s.date }).then(function (res) {
          if (!res.ok) { s.result.dates = null; page(res.data.problems || {}); return; }
          if (!res.data.dates) { s.result.dates = null; page({ date: "Enter the date first." }); return; }
          s.result = res.data; U.count("find-letter", "dates", res.data.dates.items[res.data.dates.items.length - 1].status === "passed");
          page();
        }).catch(U.failed);
      } } },
        U.field("letter_date", l.date.label, l.date.hint || null, h("input", { type: "date", value: s.date, required: "required" }), problems ? { letter_date: problems.date } : null),
        U.row(U.go(d ? "Work out the dates again" : "Show my dates", null, "submit")));
    }
    var kf = l.kit_form, kit = r.kit, kitForm = null, kitOut = null;
    if (kf) {
      var late = d && d.items[d.items.length - 1].status === "passed";
      var asks = [["kit_about", kf.about_label, "about"], ["kit_why", kf.kind === "call" ? "Why you think it is too soon, in your own words" : kf.why_label, "why"]];
      if (late && kf.kind !== "call") asks.push(["kit_late", "Why this is late", "late"]);
      kitForm = h("form", { on: { submit: function (ev) {
        ev.preventDefault();
        asks.forEach(function (a) { s.said[a[2]] = document.getElementById(a[0]).value; });
        var body = { letter: s.letter, kit: true, statements: s.said };
        if (d) body.date = s.date;
        U.api("/api/letter", body).then(function (res) {
          if (!res.ok) { U.failed(); return; }
          s.result = res.data; page();
          var top = document.getElementById("kit-top"); if (top) top.scrollIntoView({ block: "start" });
        }).catch(U.failed);
      } } },
        asks.map(function (a) { return U.field(a[0], a[1], "Optional. It is used exactly as you write it. Leave out any Medicare, Social Security or member number.", h("textarea", { maxlength: "2000" }, s.said[a[2]] || "")); }),
        U.row(U.go(kit ? "Build it again" : (kf.kind === "call" ? "Build what to say on the call" : "Build my request"), null, "submit")));
      if (kit) {
        var copy = h("button", { class: "copy", type: "button", text: "Copy this", on: { click: function () {
          var done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy this"; }, 2500); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(kit.draft.join("\n")).then(done, function () { copy.textContent = "Select the text and copy it by hand"; });
          else copy.textContent = "Select the text and copy it by hand";
        } } });
        kitOut = [h("h2", { id: "kit-top", text: kit.title }),
          h("div", { class: "draft" }, kit.draft.map(function (x) { return h("p", { text: x }); })), copy,
          h("h3", { text: kit.kind === "call" ? "Have ready" : "Send with it" }), h("ul", {}, kit.include.map(function (x) { return h("li", { text: x }); })),
          h("h3", { text: kit.kind === "call" ? "How to call" : "How to send it" }), h("ol", {}, kit.how.map(function (x) { return h("li", { text: x }); })),
          h("h3", { text: "My record" }), h("dl", { class: "record" }, kit.record.map(function (x) { return h("div", {}, h("dt", { text: x }), h("dd", {})); })),
          h("p", { class: "small", text: kit.record_note + " " + kit.disclaimer })];
      }
    }
    var urgent = l.urgent ? h("section", { class: "urgent", "aria-labelledby": "urgent-title" },
      h("h2", { id: "urgent-title", text: "Do this now" }),
      h("p", { class: "urgent-by", text: l.urgent.by + "." }),
      h("p", {}, "Call ", h("b", { text: l.urgent.call }), "."),
      h("h3", { text: "What to say" }),
      h("ol", { class: "urgent-script" }, l.urgent.script.map(function (x) { return h("li", { text: x }); })),
      h("p", { class: "small", text: "If you cannot find the number, call 1-800-MEDICARE (1-800-633-4227) and ask for the review organization for your area." })) : null;
    U.show(
      h("p", { class: "small", text: label(l.group) + " letter" }),
      h("h1", { text: l.title }),
      urgent,
      h("p", { class: "lead", text: l.plain }),
      l.helper ? U.row(U.go("Open the helper for this letter", function () { location.hash = l.helper; })) : null,
      l.id === "msn" ? h("p", {}, h("a", { href: "#medicare-bill", text: "Got a bill from the doctor too? Compare it with this notice" })) : null,
      form ? [h("h2", { text: d ? "Your dates" : "See your dates" }), d ? [dateList(d.items), h("p", { text: d.advice }), U.row(U.timelineButton(l.title, s.date, d.items))] : null, form] : null,
      !l.has_dates && !l.helper ? [h("h2", { text: "Is there a deadline?" }), h("p", { text: "The official page gives no fixed number of days for this letter, so none is worked out here. Follow the date printed on your letter, and act well before it." })] : null,
      h("h2", { text: "What to do" }),
      h("ol", {}, l.do.map(function (x) { return h("li", { text: x }); })),
      l.see ? h("p", {}, h("a", { href: "#" + l.see, text: l.see_label || "Open the appeal helper" })) : null,
      l.forms ? h("ul", {}, l.forms.map(function (f) { return h("li", {}, U.link(f.url, f.name)); })) : null,
      h("h2", { text: "Who to call" }),
      h("p", { text: l.contact }),
      kitOut,
      kitForm ? [h("h2", { text: kit ? "Change your words" : (kf.kind === "call" ? "Get ready for the call" : "Write your request") }),
        kit ? null : h("p", { text: kf.kind === "call" ? "Add a few words and get a page to read from when you call, with a place to record what you were told." : "Add a few words and get a request you can sign and send, with a list of what to send with it and a record to keep." }),
        kitForm] : null,
      h("p", { class: "small" }, "This page follows the official source for this letter. ", U.link(l.source, "Read the source"), ". It is information, not legal advice, and it is not from the Social Security Administration or Medicare. Rules checked as of " + r.rules_as_of + "."),
      U.row(U.quiet("Print this page", function () { window.print(); }), U.quiet("Download as text", function () { U.download("letter-" + l.id + ".txt", "text/plain", pageText(r)); }),
        kit ? U.sentButton(l.group === "medicare" ? "medicare" : "form", l.title + (s.date ? " (letter dated " + U.niceDate(s.date) + ")" : ""), kit.kind === "call" ? "phone" : "mail") : null,
        U.quiet("Back", finder)));
    if (problems) { var bad = document.querySelector("[aria-invalid=true]"); if (bad) bad.focus(); }
  }

  window.Modules = window.Modules || {};
  /* Straight to one letter, from a quick link on the home page. Its Back goes to that group's list. */
  function startAt(id) {
    var l = byId(id);
    if (!l) { start("ssa"); return; }
    start(l.group); open(id);
  }

  window.Modules.letters = { start: start, startAt: startAt };
})();
