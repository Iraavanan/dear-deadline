/* "I already sent something": a record of what was sent, when, how and what proof
   there is, with questions for the next call. Nothing is kept by this site: the
   person downloads the record and can open it here again from their own device. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var WHAT = [["appeal", "An appeal or request for reconsideration"], ["waiver", "A request for a waiver"], ["rate", "A request to pay back less each month"],
    ["change", "A report of a change"], ["form", "A form Social Security or Medicare asked for"], ["medicare", "A Medicare appeal or request"],
    ["billing", "A question to a doctor's or supplier's billing office"], ["renewal", "A Medicaid or SNAP renewal, or proof they asked for"],
    ["hours", "Proof of work hours or an exemption"], ["hearing", "A request for a fair hearing"], ["housing", "A letter to the housing authority"], ["other", "Something else"]];
  var HOW = [["mail", "By mail"], ["fax", "By fax"], ["phone", "By phone"], ["online", "Online"], ["office", "In person at an office"], ["other", "Another way"]];
  var HEARD = [["none", "Not yet"], ["received", "They confirmed they got it"], ["more", "They asked for more information or proof"], ["decided", "They sent a decision"]];
  /* After "I heard back": the next step for each answer, with where on this site it is. */
  var NEXT = {
    none: function (e) { var n = since(e.sent); return n > 30 ? ["It has been " + n + " days. Call, give the day you sent it, and read out your proof. Ask them to confirm it is on file.", null] : ["Keep your proof with this record. If you have not heard in 30 days, call and ask.", null]; },
    received: function () { return ["Ask when to expect a decision, and write down the date they give.", null]; },
    more: function (e) { return ["Send what they asked for by the date on their letter, keep proof of sending, and add it here as a new entry. If they asked again for something you already sent, match the two first.", e.what === "renewal" || e.what === "hours" ? ["#asked-again", "Match what they ask for with what you sent"] : null]; },
    decided: function (e) {
      var to = { appeal: "#decision-appeal", waiver: "#overpayment", rate: "#overpayment", medicare: "#medicare-letter", renewal: "#renewal", hours: "#work-rules", housing: "#rent-check", billing: "#medicare-bill" }[e.what];
      return ["Read the decision for its date and what it says you can do next. If you disagree, there is usually a new time limit to appeal, counted from the date on that letter.", to ? [to, "See the dates and options for the next step"] : null];
    }
  };
  var KIND = "benefits-letter-helper-record", LIMIT = { about: 200, proof: 200, notes: 1000 };
  var s;

  function label(list, id) { var f = list.filter(function (x) { return x[0] === id; })[0]; return f ? f[1] : list[list.length - 1][1]; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function since(iso) { return Math.round((Date.parse(today() + "T00:00:00Z") - Date.parse(iso + "T00:00:00Z")) / 864e5); }
  function select(list, current) { return h("select", {}, list.map(function (o) { return h("option", { value: o[0], text: o[1], selected: current === o[0] ? "selected" : null }); })); }

  function start() {
    s = window.__case;                               // shared with "Add to my timeline" for this visit
    if (window.__openRecord) { loadData(window.__openRecord); window.__openRecord = null; U.count("filed-log", "start"); logView(); return; }
    U.count("filed-log", "start"); U.setDatebar(null);
    if (s.entries.length || s.letters.length) { U.count("filed-log", "start"); U.setDatebar(null); if (!window.__record) { logView(); return; } }
    if (window.__record) {                           // arrived from "I sent this" at the end of a kit
      var r = window.__record; window.__record = null;
      s.draft = { what: r.what, about: r.about, sent: today(), how: r.how, proof: "", heard: "none", heard_date: "", notes: "" };
      entryForm(null); return;
    }
    var status = h("p", { class: "status", role: "status" });
    U.show(
      h("h1", { class: "long", text: "Keep a record of what you sent" }),
      h("p", { class: "lead", text: "Write down each thing you sent to an agency, a billing office or a housing authority, or said on a call. You get a record to keep and questions for your next call. This site keeps nothing: download your record to keep it, and open it here again later." }),
      U.row(U.go("Add the first thing you sent", function () { entryForm(null); })),
      h("label", { for: "recordfile" }, "Or open a record you saved", h("span", { class: "hint", text: "The file stays on this device." })),
      h("input", { id: "recordfile", type: "file", accept: ".json,application/json", on: { change: function (ev) { openFile(ev.target.files && ev.target.files[0], status); } } }),
      status,
      U.row(U.quiet("Back", U.home)));
  }

  function clean(e) {
    if (!e || typeof e !== "object" || typeof e.sent !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.sent)) return null;
    function str(v, n) { return typeof v === "string" ? v.slice(0, n) : ""; }
    function pick(list, v, d) { return list.some(function (x) { return x[0] === v; }) ? v : d; }
    return { what: pick(WHAT, e.what, "other"), about: str(e.about, LIMIT.about), sent: e.sent, how: pick(HOW, e.how, "other"), proof: str(e.proof, LIMIT.proof),
      heard: pick(HEARD, e.heard, "none"), heard_date: /^\d{4}-\d{2}-\d{2}$/.test(e.heard_date || "") ? e.heard_date : "", notes: str(e.notes, LIMIT.notes) };
  }

  function openFile(file, status) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      var data;
      try { data = JSON.parse(String(fr.result)); } catch (e) { data = null; }
      if (!data || data.kind !== KIND || !Array.isArray(data.entries)) { status.textContent = "That file is not a record saved from this site."; return; }
      loadData(data);
      logView();
    };
    fr.onerror = function () { status.textContent = "That file could not be read."; };
    fr.readAsText(file);
  }

  function loadData(data) {
    s.entries = (data.entries || []).map(clean).filter(Boolean).slice(0, 200);
    s.letters = (Array.isArray(data.letters) ? data.letters : []).filter(function (l) { return l && typeof l.title === "string" && Array.isArray(l.dates); }).slice(0, 50).map(function (l) {
      return { title: l.title.slice(0, 160), notice_date: /^\d{4}-\d{2}-\d{2}$/.test(l.notice_date || "") ? l.notice_date : "", added: String(l.added || "").slice(0, 10),
        dates: l.dates.filter(function (d) { return d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || ""); }).slice(0, 20).map(function (d) { return { label: String(d.label || "").slice(0, 160), date: d.date }; }) };
    });
  }

  /* Every date in one list: each letter's own dates (never merged), what was sent, and what came back. */
  function timeline() {
    var rows = [];
    s.letters.forEach(function (l) {
      if (l.notice_date) rows.push({ date: l.notice_date, kind: "letter", text: l.title + ": dated" });
      l.dates.forEach(function (d) { rows.push({ date: d.date, kind: "due", text: l.title + ": " + d.label }); });
    });
    s.entries.forEach(function (e) {
      rows.push({ date: e.sent, kind: "sent", text: sentence(e).replace(/^On [^,]+, /, "") });
      if (e.heard !== "none" && e.heard_date) rows.push({ date: e.heard_date, kind: "heard", text: label(HEARD, e.heard) + ": " + label(WHAT, e.what).toLowerCase() });
    });
    return rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  function nextDue() { return timeline().filter(function (r) { return r.kind === "due" && since(r.date) <= 0; })[0] || null; }

  /* A one-page plan; the caregiver copy lets the person choose what to share. */
  function planText(opts) {
    var due = nextDue(), out = ["MY ONE-PAGE PLAN", "Made " + U.niceDate(today()) + " with an independent tool. Not from any agency.", ""];
    out.push("NEXT ACTION: " + (due ? due.text + ", by " + U.niceDate(due.date) + " (" + (-since(due.date)) + " days from today)" : "No upcoming date on this record."));
    if (opts.letters) { out.push("", "LETTERS"); s.letters.forEach(function (l) { out.push("- " + l.title + (l.notice_date ? " dated " + U.niceDate(l.notice_date) : "")); l.dates.forEach(function (d) { out.push("    " + d.label + ": " + U.niceDate(d.date)); }); }); }
    if (opts.sent) { out.push("", "WHAT HAS BEEN SENT"); s.entries.forEach(function (e) { out.push("- " + sentence(e) + (opts.proof && e.proof ? " Proof: " + e.proof + "." : "")); }); }
    if (opts.notes) { var n = s.entries.filter(function (e) { return e.notes; }); if (n.length) { out.push("", "NOTES"); n.forEach(function (e) { out.push("- " + e.notes); }); } }
    var qs = questions(s.entries); if (opts.questions && qs.length) { out.push("", "TO ASK ON THE NEXT CALL"); qs.forEach(function (q, i) { out.push((i + 1) + ". " + q); }); }
    return out.join("\r\n");
  }

  function planView() {
    var opts = { letters: true, sent: true, proof: true, notes: true, questions: true };
    var box = h("pre", { class: "draft-text" });
    var redraw = function () { box.textContent = planText(opts).replace(/\r/g, ""); };
    var tick = function (k, text) { return h("label", { class: "tick", for: "plan_" + k }, h("input", { type: "checkbox", id: "plan_" + k, checked: "checked", on: { change: function (ev) { opts[k] = ev.target.checked; redraw(); } } }), h("span", { text: text })); };
    U.show(
      h("h1", { class: "long", text: "Your one-page plan" }),
      h("p", { class: "lead", text: "The next action and its date at the top, then what you choose to include. For a copy to give someone helping you, untick anything you would rather keep to yourself." }),
      h("fieldset", { class: "ticks" }, h("legend", { text: "Include" }), tick("letters", "The letters and their dates"), tick("sent", "What has been sent"), tick("proof", "Proof numbers (tracking, confirmation)"),
        tick("notes", "My notes"), tick("questions", "Questions for the next call")),
      h("div", { class: "draft" }, box),
      U.row(U.go("Print", function () { window.print(); }), U.quiet("Download", function () { U.download("my-plan.txt", "text/plain", planText(opts)); }), U.quiet("Back", logView)));
    redraw();
  }

  function entryForm(index, problems) {
    problems = problems || {};
    var e = index === null ? { what: "appeal", about: "", sent: "", how: "mail", proof: "", heard: "none", heard_date: "", notes: "" } : s.entries[index];
    var f = h("form", { novalidate: "novalidate", on: { submit: function (ev) {
      ev.preventDefault();
      var got = {};
      ["what", "about", "sent", "how", "proof", "heard", "heard_date", "notes"].forEach(function (k) { got[k] = document.getElementById("rec_" + k).value.trim(); });
      var bad = {};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(got.sent)) bad.rec_sent = "Enter the day you sent it or called.";
      else if (got.sent > today()) bad.rec_sent = "That day is in the future.";
      if (got.heard_date && got.sent && got.heard_date < got.sent) bad.rec_heard_date = "This is before the day you sent it.";
      if (Object.keys(bad).length) { s.draft = got; entryForm(index, bad); return; }
      var clean_entry = clean(got);
      if (index === null) s.entries.push(clean_entry); else s.entries[index] = clean_entry;
      s.draft = null; logView();
    } } },
      U.field("rec_what", "What did you send or ask for?", null, select(WHAT, (s.draft || e).what), problems),
      U.field("rec_about", "What it was about", "Optional. For example: overpayment notice dated November 2, 2026.", h("input", { type: "text", maxlength: String(LIMIT.about), value: (s.draft || e).about }), problems),
      U.field("rec_sent", "Day you sent it or called", null, h("input", { type: "date", max: today(), value: (s.draft || e).sent }), problems),
      U.field("rec_how", "How", null, select(HOW, (s.draft || e).how), problems),
      U.field("rec_proof", "Proof you have", "Optional. A confirmation number, fax confirmation page, receipt or tracking number. Leave out any Social Security or Medicare number.", h("input", { type: "text", maxlength: String(LIMIT.proof), value: (s.draft || e).proof }), problems),
      U.field("rec_heard", "Have you heard back?", null, select(HEARD, (s.draft || e).heard), problems),
      U.field("rec_heard_date", "Day you heard back", "Optional.", h("input", { type: "date", max: today(), value: (s.draft || e).heard_date }), problems),
      U.field("rec_notes", "Notes", "Optional. Who you spoke to, and what they said.", h("textarea", { maxlength: String(LIMIT.notes) }, (s.draft || e).notes), problems),
      U.row(U.go(index === null ? "Add to my record" : "Save the change", null, "submit"), U.quiet("Back", function () { s.draft = null; if (s.entries.length) logView(); else start(); })));
    U.show(h("h1", { text: index === null ? "What did you send?" : "Change this entry" }),
      Object.keys(problems).length ? h("div", { class: "alert", role: "alert", text: "Something needs fixing." }) : null, f);
    var bad = document.querySelector("[aria-invalid=true]"); if (bad) bad.focus();
  }

  function sentence(e) {
    var what = label(WHAT, e.what).toLowerCase() + (e.about ? " (" + e.about + ")" : "");
    return e.how === "phone" ? "On " + U.niceDate(e.sent) + ", I called about " + what + "." : "On " + U.niceDate(e.sent) + ", I sent " + what + " " + label(HOW, e.how).toLowerCase() + ".";
  }

  function questions(list) {
    return list.filter(function (e) { return e.heard !== "decided"; }).map(function (e) {
      var q = sentence(e) + (e.proof ? " My proof is: " + e.proof + "." : "");
      q += e.heard === "more" ? " You asked for more information" + (e.heard_date ? " on " + U.niceDate(e.heard_date) : "") + ". Can you confirm what is still needed and the date it is due?" : e.heard === "received" ? " You confirmed you received it" + (e.heard_date ? " on " + U.niceDate(e.heard_date) : "") + ". When can I expect a decision?" : " Can you confirm you received it, and tell me its status?";
      var n = since(e.sent);
      return q + (n > 30 ? " It has been " + n + " days." : "");
    });
  }

  function sorted() { return s.entries.map(function (e, i) { return { e: e, i: i }; }).sort(function (a, b) { return a.e.sent < b.e.sent ? -1 : a.e.sent > b.e.sent ? 1 : 0; }); }

  function asText() {
    var out = ["MY RECORD OF WHAT I SENT", "Made " + U.niceDate(today()) + " with an independent tool. Not from any agency.", ""];
    sorted().forEach(function (x) {
      var e = x.e;
      out.push(sentence(e), "  Proof: " + (e.proof || "none written down"), "  Heard back: " + label(HEARD, e.heard) + (e.heard_date ? " (" + U.niceDate(e.heard_date) + ")" : ""));
      if (e.notes) out.push("  Notes: " + e.notes);
      out.push("");
    });
    var qs = questions(s.entries);
    if (qs.length) { out.push("QUESTIONS FOR MY NEXT CALL"); qs.forEach(function (q, i) { out.push((i + 1) + ". " + q); }); }
    return out.join("\r\n");
  }

  function logView() {
    var waiting = s.entries.filter(function (e) { return e.heard !== "decided"; });
    var asked = s.entries.some(function (e) { return (e.what === "appeal" || e.what === "waiver") && e.heard !== "decided"; });
    var qs = questions(s.entries);
    var tl = timeline(), due = nextDue();
    U.show(
      h("h1", { text: "Your record" }),
      h("p", { class: "lead", text: "This site has not kept it. Download it before you close this page, and keep your proof of sending with it." }),
      due ? h("div", { class: "next" }, h("b", { text: "Next date: " + U.niceDate(due.date) + ". " }), due.text + ".") : null,
      tl.length ? [h("h2", { text: "Timeline" }), h("ol", { class: "timeline" }, tl.map(function (r) {
        var n = since(r.date);
        return h("li", { class: "tl-" + r.kind + (r.kind === "due" && n > 0 ? " past" : "") }, h("b", { text: U.niceDate(r.date) }), " ", r.text,
          r.kind === "due" ? h("span", { class: "small", text: n > 0 ? " (passed)" : (n === 0 ? " (today)" : " (" + (-n) + " days left)") }) : null);
      })), s.letters.length ? h("p", { class: "small", text: "Each letter keeps its own dates. A later letter is added beside an earlier one and never replaces its dates." }) : null] : null,
      s.entries.length ? h("h2", { text: "What you sent" }) : null,
      sorted().map(function (x) {
        var e = x.e, n = since(e.sent);
        return h("div", { class: "opt" },
          h("h3", { text: label(WHAT, e.what) }),
          h("p", { text: "Sent " + U.niceDate(e.sent) + ", " + label(HOW, e.how).toLowerCase() + "." + (e.about ? " About: " + e.about + "." : "") }),
          h("p", { class: "small", text: "Proof: " + (e.proof || "none written down") + "." }),
          h("p", {}, h("b", { text: e.heard === "none" ? "Not heard back yet. " + n + (n === 1 ? " day" : " days") + " since you sent it." : label(HEARD, e.heard) + (e.heard_date ? " on " + U.niceDate(e.heard_date) : "") + "." })),
          (function () { var nx = NEXT[e.heard](e); return h("p", { class: "next" }, "Next: " + nx[0] + " ", nx[1] ? h("a", { href: nx[1][0], text: nx[1][1] }) : null); })(),
          e.heard !== "decided" ? h("p", {}, h("button", { class: "copy", type: "button", text: "I heard back", on: { click: function () { heardBack(x.i); } } })) : null,
          e.notes ? h("p", { class: "small", text: "Notes: " + e.notes }) : null,
          h("p", {}, h("button", { class: "copy", type: "button", text: "Change", on: { click: function () { entryForm(x.i); } } }), " ",
            h("button", { class: "copy", type: "button", text: "Remove", on: { click: function () { s.entries.splice(x.i, 1); if (s.entries.length || s.letters.length) logView(); else start(); } } })));
      }),
      qs.length ? [h("h2", { text: "Questions for your next call" }), h("ol", {}, qs.map(function (q) { return h("li", { text: q }); })),
        h("p", { class: "small", text: "On the call, write down the date, the name of the person and what they said, then add it here." })] : (s.entries.length ? h("p", { text: "Everything in your record has a decision." }) : null),
      asked ? h("p", {}, "If you asked for an appeal or a waiver within 30 days of an overpayment notice, Social Security says it will not collect until it decides. If collection starts anyway, call, give the day you sent your request, and read out your proof. ",
        U.link("https://www.ssa.gov/manage-benefits/resolve-overpayment", "Source")) : null,
      U.row(U.go(s.entries.length ? "Add something else you sent" : "Add something you sent", function () { entryForm(null); }),
        U.quiet("Download to keep", function () { U.count("filed-log", "kit"); U.download("my-record.txt", "text/plain", asText()); }),
        U.quiet("Save a copy to open here later", function () { U.download("my-record.json", "application/json", JSON.stringify({ kind: KIND, version: 2, saved: today(), entries: s.entries, letters: s.letters }, null, 1)); }),
        U.quiet("Make a one-page plan", planView),
        U.quiet("Print", function () { window.print(); }), U.quiet("Back", U.home)),
      waiting.length ? null : null);
  }

  /* "I heard back": one question, then the record shows the next step. */
  function heardBack(i) {
    var e = s.entries[i];
    U.show(
      h("h1", { class: "long", text: "What did you hear back?" }),
      h("p", { class: "lead", text: sentence(e) }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault();
        var v = U.picked("heard"); if (!v) return;
        e.heard = v; e.heard_date = document.getElementById("heard_on").value || today();
        logView();
      } } },
        U.choice("heard", "Choose one", HEARD.filter(function (x) { return x[0] !== "none"; }), e.heard === "none" ? "" : e.heard),
        U.field("heard_on", "When", null, h("input", { type: "date", max: today(), value: e.heard_date || today() })),
        U.row(U.go("Save", null, "submit"), U.quiet("Back", logView))));
  }

  window.Modules = window.Modules || {};
  window.Modules.log = { start: start };
})();
