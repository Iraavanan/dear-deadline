/* "I already sent this proof. Why are they asking again?"

   The person lists what the new notice asks for and what they already sent. This matches the
   two on this device (nothing is sent to the site) by kind of document, person and dates, and
   says for each item what is still open and the question to ask. A receipt never counts as
   the agency accepting a document: every item keeps its due date until the agency confirms.

   check(input, todayISO, rules) returns the result, or throws {problems}. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AskedAgain = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var KINDS = [["pay_stub", "Pay stubs"], ["employer", "Letter or form from an employer"], ["ss_letter", "Social Security benefit letter"], ["bank", "Bank statement"],
    ["rent", "Proof of rent or housing costs"], ["utility", "Utility bill"], ["id", "Proof of identity"], ["childcare", "Childcare costs"], ["medical", "Medical bills"], ["other", "Something else"]];
  var RECEIPTS = [["lists", "Yes, my receipt lists this item"], ["not_listed", "I have a receipt, but it does not list this item"], ["none", "I have no receipt"]];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var COVERED = ["sent_listed", "sent_unconfirmed"];

  function kindName(k) { var f = KINDS.filter(function (x) { return x[0] === k; })[0]; return f ? f[1] : "Something else"; }
  function day(iso) { var p = iso.split("-").map(Number); return Date.UTC(p[0], p[1] - 1, p[2]) / 864e5; }
  function iso(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
  function say(s) { var p = s.split("-").map(Number); return MONTHS[p[1] - 1] + " " + p[2] + ", " + p[0]; }
  function okDate(v) {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    var p = v.split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
  }
  function person(v) { var w = String(v || "").trim().toLowerCase(); return w === "" || w === "me" || w === "myself" || w === "self" || w === "i" ? "me" : w; }
  function sameKind(a, b) { return a.kind === b.kind && (a.kind !== "other" || String(a.label || "").trim().toLowerCase() === String(b.label || "").trim().toLowerCase()); }
  function what(it) { return it.kind === "other" && it.label ? it.label.trim() : kindName(it.kind); }
  function whose(it) { return person(it.who) === "me" ? "" : " for " + String(it.who).trim(); }
  function span(it) { return it.from && it.to ? (it.from === it.to ? " dated " + say(it.from) : " covering " + say(it.from) + " to " + say(it.to)) : ""; }

  function clean(raw, today) {
    var p = {}, f = { requested: [], sent: [] };
    if (!raw || typeof raw !== "object") throw { problems: { requested: "The details could not be read. Enter them again." } };
    f.program = raw.program === "medicaid" ? "medicaid" : "snap";
    f.state = raw.state === "FL" ? "FL" : "other";
    if (!okDate(raw.due)) p.due = "Enter the due date printed on the new notice.";
    else f.due = raw.due;
    f.notice_date = okDate(raw.notice_date) ? raw.notice_date : null;
    function item(it, key, i, sent) {
      if (!it || typeof it !== "object" || !KINDS.some(function (k) { return k[0] === it.kind; })) { p[key + "." + i + ".kind"] = "Choose what kind of document it is."; return null; }
      var o = { kind: it.kind, who: String(it.who || "").trim().slice(0, 60), label: String(it.label || "").trim().slice(0, 80), from: "", to: "" };
      if (it.kind === "other" && !o.label) p[key + "." + i + ".label"] = "Say what the document is.";
      var fr = it.from || "", to = it.to || "";
      if (fr && !okDate(fr)) p[key + "." + i + ".from"] = "Check this date.";
      if (to && !okDate(to)) p[key + "." + i + ".to"] = "Check this date.";
      if (okDate(fr) && !to) to = fr;
      if (okDate(to) && !fr) fr = to;
      if (okDate(fr) && okDate(to)) { if (fr > to) p[key + "." + i + ".to"] = "The end date is before the start date."; o.from = fr; o.to = to; }
      if (sent) {
        o.receipt = RECEIPTS.some(function (r) { return r[0] === it.receipt; }) ? it.receipt : "none";
        o.sent = okDate(it.sent) ? it.sent : "";
        o.how = String(it.how || "").slice(0, 20);
      }
      return o;
    }
    (Array.isArray(raw.requested) ? raw.requested : []).slice(0, 15).forEach(function (it, i) { var o = item(it, "requested", i, false); if (o) f.requested.push(o); });
    (Array.isArray(raw.sent) ? raw.sent : []).slice(0, 30).forEach(function (it, i) { var o = item(it, "sent", i, true); if (o) f.sent.push(o); });
    if (!f.requested.length && !p["requested.0.kind"]) p.requested = "Add at least one thing the new notice asks for.";
    if (Object.keys(p).length) throw { problems: p };
    return f;
  }

  /* Days of the request's period not covered by the sent periods: a list of [from, to]. */
  function gaps(req, periods) {
    var a = day(req.from), b = day(req.to), cur = a, out = [];
    periods.map(function (s) { return [day(s.from), day(s.to)]; }).sort(function (x, y) { return x[0] - y[0]; }).forEach(function (s) {
      if (s[1] < cur || s[0] > b) return;
      if (s[0] > cur) out.push([cur, Math.min(s[0] - 1, b)]);
      cur = Math.max(cur, s[1] + 1);
    });
    if (cur <= b) out.push([cur, b]);
    return out.map(function (g) { return [iso(g[0]), iso(g[1])]; });
  }

  function matchOne(req, sent) {
    var kind = sent.filter(function (s) { return sameKind(s, req); });
    var mine = kind.filter(function (s) { return person(s.who) === person(req.who); });
    if (!kind.length) return { status: "not_sent", used: [] };
    if (!mine.length) return { status: "wrong_person", used: kind };
    if (!req.from) return { status: mine.every(function (s) { return s.receipt === "lists"; }) ? "sent_listed" : "sent_unconfirmed", used: mine, no_period: true };
    var dated = mine.filter(function (s) { return s.from; });
    var overlap = dated.filter(function (s) { return s.to >= req.from && s.from <= req.to; });
    var g = gaps(req, overlap);
    if (!g.length) {
      var needed = overlap.filter(function (s) { return true; });
      return { status: needed.every(function (s) { return s.receipt === "lists"; }) ? "sent_listed" : "sent_unconfirmed", used: needed };
    }
    if (dated.length < mine.length) return { status: "period_unknown", used: mine, gaps: g };
    if (!overlap.length) return { status: "wrong_period", used: dated };
    return { status: "partly_sent", used: overlap, gaps: g };
  }

  function check(raw, today, rules) {
    var f = clean(raw, today), t = rules || {};
    var left = day(f.due) - day(today), dueText = say(f.due);
    var items = f.requested.map(function (req) {
      var m = matchOne(req, f.sent), name = what(req) + whose(req) + span(req), sentOn = m.used.filter(function (s) { return s.sent; }).map(function (s) { return say(s.sent); });
      var r = { requested: name, kind: req.kind, status: m.status, gaps: m.gaps || [], action: "", question: "", help: [] };
      var when = sentOn.length ? " on " + sentOn.filter(function (v, i, a) { return a.indexOf(v) === i; }).join(" and ") : "";
      if (m.status === "sent_listed") {
        r.label = "Sent, and your receipt lists it";
        r.action = "Your receipt shows it arrived. It does not show the agency reviewed or accepted it. Call or message them before " + dueText + " and ask the question below.";
        r.question = "I sent " + name.charAt(0).toLowerCase() + name.slice(1) + when + ", and my receipt lists it. Has it been reviewed? Is anything wrong with it, such as a page that cannot be read, and is anything else needed before " + dueText + "?";
      } else if (m.status === "sent_unconfirmed") {
        r.label = "Sent, but not confirmed";
        r.action = "You sent it, but nothing shows the agency received all of it. Ask before " + dueText + ". If you still have a copy, sending it again with a cover note is the safest step.";
        r.question = "I sent " + name.charAt(0).toLowerCase() + name.slice(1) + when + ". Can you tell me whether you received it, and whether anything else is needed before " + dueText + "?";
      } else if (m.status === "partly_sent") {
        r.label = "Only part of the period was sent";
        r.action = "The notice asks for " + say(req.from) + " to " + say(req.to) + ". What you sent leaves out " + m.gaps.map(function (g) { return g[0] === g[1] ? say(g[0]) : say(g[0]) + " to " + say(g[1]); }).join(" and ") + ". Send that part by " + dueText + ".";
        r.question = "I sent part of this" + when + ". Could you confirm the dates you still need for " + what(req).toLowerCase() + whose(req) + "?";
      } else if (m.status === "period_unknown") {
        r.label = "Sent, but the dates are unclear";
        r.action = "You noted sending this without its dates. Check your copy: the notice asks for " + say(req.from) + " to " + say(req.to) + ". If your copy does not cover all of it, send the rest by " + dueText + ".";
        r.question = "I sent " + what(req).toLowerCase() + whose(req) + when + ". Which dates did you receive, and which do you still need?";
      } else if (m.status === "wrong_period") {
        r.label = "What you sent covers different dates";
        r.action = "You sent this for other dates. The notice asks for " + say(req.from) + " to " + say(req.to) + ". Send that period by " + dueText + ".";
        r.question = "You asked for " + name.charAt(0).toLowerCase() + name.slice(1) + ". I sent a different period" + when + ". Is the period on the notice the one you need?";
      } else if (m.status === "wrong_person") {
        r.label = "Sent for someone else, not this person";
        r.action = "What you sent was for " + m.used.map(function (s) { return person(s.who) === "me" ? "you" : String(s.who).trim(); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(" and ") + ". The notice asks for it" + (person(req.who) === "me" ? " for you" : " for " + String(req.who).trim()) + ". Send that by " + dueText + ".";
        r.question = "You asked for " + name.charAt(0).toLowerCase() + name.slice(1) + ". Whose is needed, and for what dates?";
      } else {
        r.label = "Not sent yet";
        r.action = "Send it by " + dueText + ". If you cannot get it in time, call before that date and ask for more time or for help getting it.";
        r.question = "I am getting " + name.charAt(0).toLowerCase() + name.slice(1) + ". If I cannot get it by " + dueText + ", can you help me get it or give me more time?";
      }
      if (m.no_period && COVERED.indexOf(m.status) >= 0) r.question += " Which dates should it cover?";
      if (COVERED.indexOf(m.status) < 0 || m.status === "sent_unconfirmed") {
        if (req.kind === "pay_stub" || req.kind === "employer") r.help.push(f.state === "FL" ? "fl_employer" : "help");
        if (req.kind === "ss_letter") r.help.push("ssa_letter");
        if (r.help.indexOf("help") < 0) r.help.push("help");
      }
      r.help = r.help.filter(function (k) { return t[k]; }).map(function (k) { return { plain: t[k].plain, source: t[k].source }; });
      return r;
    });
    var open = items.filter(function (i) { return COVERED.indexOf(i.status) < 0; }).length;
    var headline = left < 0 ? "The due date, " + dueText + ", has passed" : (open ? open + " of " + items.length + " item" + (items.length === 1 ? "" : "s") + " still to send, and every item to confirm by " + dueText
      : "Everything was sent. Confirm with the agency by " + dueText);
    var notes = [];
    if (f.program === "snap" && f.notice_date && day(f.due) - day(f.notice_date) < 10 && t.ten_days) notes.push({ plain: "Your notice gives fewer than 10 days. " + t.ten_days.plain + " Ask for more time.", source: t.ten_days.source });
    ["receipt", "notice", "unchanged", "help"].forEach(function (k) { if (t[k]) notes.push({ plain: t[k].plain, source: t[k].source }); });
    var log = items.map(function (i) { return "- " + i.requested + ": " + i.label.toLowerCase(); });
    return {
      headline: headline, due: f.due, due_long: dueText, days_left: left, deadline_passed: left < 0, items: items, open: open,
      call: ["Hello, my name is [your name]. My case number is [from the notice].", "I got a notice dated " + (f.notice_date ? say(f.notice_date) : "[date]") + " asking for proof by " + dueText + "."]
        .concat(items.map(function (i) { return i.question; })).concat(["Can you note on my case that I called today, and tell me your name?"]).join("\n"),
      cover: ["PROOF SENT AGAIN, OR FOR THE FIRST TIME", "", "Name: [your name]", "Case number: [from the notice]", "Notice dated: " + (f.notice_date ? say(f.notice_date) : "[date]") + ", due " + dueText, "",
        "Enclosed:"].concat(items.filter(function (i) { return i.status !== "sent_listed"; }).map(function (i) { return "- " + i.requested; }))
        .concat(["", "Already sent earlier (please check your file):"]).concat(f.sent.map(function (s) { return "- " + what(s) + whose(s) + span(s) + (s.sent ? ", sent " + say(s.sent) : ""); }))
        .concat(["", "Please contact me if anything else is needed. Phone: [your phone]"]).join("\n"),
      summary: log.join("\n"), notes: notes, on_device: true,
      disclaimer: "This compares what the notice asks for with what you say you sent. It cannot see the agency's file, and a receipt does not mean a document was accepted. Only the agency decides. This is an independent tool, not a government agency, and not legal advice."
    };
  }

  /* The simple way most checklists work: anything of the same kind sent counts as done. Kept to compare against. */
  function naive(raw) {
    return (raw.requested || []).map(function (req) { return (raw.sent || []).some(function (s) { return s.kind === req.kind; }) ? "done" : "not_sent"; });
  }

  return { check: check, naive: naive, KINDS: KINDS, RECEIPTS: RECEIPTS, COVERED: COVERED };
});

(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI) return;
  var U = window.UI, h = U.h, A = window.AskedAgain;
  var s;
  function blankReq() { return { kind: "", who: "", from: "", to: "", label: "" }; }
  function blankSent() { return { kind: "", who: "", from: "", to: "", label: "", sent: "", receipt: "" }; }
  function opt(list, v, none) { return h("select", {}, (none ? [h("option", { value: "", text: none })] : []).concat(list.map(function (o) { return h("option", { value: o[0], text: o[1], selected: o[0] === v ? "selected" : null }); }))); }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }

  function start(prefill) {
    s = { program: "snap", state: "FL", notice_date: "", due: "", requested: [blankReq()], sent: [blankSent()] };
    var c = window.__case;
    if (c && c.entries && c.entries.length) {
      var rs = c.entries.filter(function (e) { return e.what === "renewal" || e.what === "hours"; });
      if (rs.length) s.sent = rs.map(function (e) { return { kind: "other", label: e.about || "Renewal papers", who: "", from: "", to: "", sent: e.sent, receipt: e.proof ? "not_listed" : "none" }; });
    }
    U.count("asked-again", "start"); U.setDatebar(null);
    form();
  }

  function collect() {
    s.program = U.picked("program") || "snap"; s.state = U.picked("state") || "FL";
    s.notice_date = val("notice_date"); s.due = val("due");
    s.requested = s.requested.map(function (_, i) { return { kind: val("r" + i + "_kind"), who: val("r" + i + "_who"), from: val("r" + i + "_from"), to: val("r" + i + "_to"), label: val("r" + i + "_label") }; });
    s.sent = s.sent.map(function (_, i) { return { kind: val("s" + i + "_kind"), who: val("s" + i + "_who"), from: val("s" + i + "_from"), to: val("s" + i + "_to"), label: val("s" + i + "_label"), sent: val("s" + i + "_sent"), receipt: val("s" + i + "_receipt") }; });
  }

  function byId(problems) {
    var out = {};
    Object.keys(problems).forEach(function (k) {
      var m = /^(requested|sent)\.(\d+)\.(\w+)$/.exec(k);
      if (m) out[(m[1] === "requested" ? "r" : "s") + m[2] + "_" + m[3]] = problems[k]; else out[k] = problems[k];
    });
    return out;
  }

  function block(prefix, it, i, sent, p) {
    var k = prefix + i + "_";
    return h("fieldset", { class: "month" }, h("legend", { text: (sent ? "Sent item " : "Asked for: item ") + (i + 1) }),
      U.field(k + "kind", "What kind of document", null, opt(A.KINDS, it.kind, "Choose"), p),
      U.field(k + "label", "If something else: what is it?", "Like \"lease\" or \"school letter\".", h("input", { type: "text", value: it.label, maxlength: "80" }), p),
      U.field(k + "who", "For whom", "Leave empty for yourself, or a first name.", h("input", { type: "text", value: it.who, maxlength: "60", autocomplete: "off" }), p),
      h("div", { class: "pair" },
        h("div", { class: "cell" }, U.field(k + "from", sent ? "It covers from" : "Dates asked for: from", "Optional.", h("input", { type: "date", value: it.from }), p)),
        h("div", { class: "cell" }, U.field(k + "to", "to", "For one stub, the same date.", h("input", { type: "date", value: it.to }), p))),
      sent ? [U.field(k + "sent", "Date you sent it", "Optional.", h("input", { type: "date", value: it.sent }), p),
        U.field(k + "receipt", "Does a receipt or confirmation list this item?", null, opt(A.RECEIPTS, it.receipt, "Choose"), p)] : null,
      h("button", { class: "copy", type: "button", text: "Remove", on: { click: function () { collect(); (sent ? s.sent : s.requested).splice(i, 1); if (!s.requested.length) s.requested.push(blankReq()); form(); } } }));
  }

  function form(problems) {
    var p = byId(problems || {});
    U.show(
      h("h1", { class: "long", text: "They asked again for proof I already sent" }),
      h("p", { class: "lead", text: "A receipt shows something arrived. It does not show a worker accepted it, so the due date still counts. List what the new notice asks for and what you sent. This page matches them, person by person and date by date, and gives you the question to ask. It all stays on this device." }),
      Object.keys(p).length ? h("div", { class: "alert", role: "alert", text: "Some answers need fixing." }) : null,
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); collect(); run(); } } },
        U.choice("program", "Which program asked?", [["snap", "SNAP (food assistance)"], ["medicaid", "Medicaid"]], s.program, p),
        U.choice("state", "Which state?", [["FL", "Florida"], ["other", "Another state"]], s.state, p),
        U.field("notice_date", "Date on the new notice", "Optional.", h("input", { type: "date", value: s.notice_date }), p),
        U.field("due", "Due date on the new notice", null, h("input", { type: "date", value: s.due }), p),
        h("h2", { text: "What the new notice asks for" }),
        p.requested ? h("p", { class: "err", role: "alert", text: p.requested }) : null,
        s.requested.map(function (it, i) { return block("r", it, i, false, p); }),
        U.row(U.quiet("Add another thing they ask for", function () { collect(); s.requested.push(blankReq()); form(); })),
        h("h2", { text: "What you already sent" }),
        s.sent.map(function (it, i) { return block("s", it, i, true, p); }),
        U.row(U.quiet("Add another thing you sent", function () { collect(); s.sent.push(blankSent()); form(); })),
        U.row(U.go("Match them", null, "submit"), U.quiet("Try a made-up example", example), U.quiet("Back", U.home))));
    U.firstProblem();
  }

  function example() {
    U.trying();
    var t = new Date(), y = t.getFullYear(), m = t.getMonth(), pad = function (n) { return String(n).padStart(2, "0"); };
    var lm = new Date(y, m - 1, 1), ly = lm.getFullYear(), lmm = pad(lm.getMonth() + 1), last = new Date(ly, lm.getMonth() + 1, 0).getDate();
    var plus = function (n) { var d = new Date(Date.now() + n * 864e5); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
    s = { program: "snap", state: "FL", notice_date: plus(-2), due: plus(11),
      requested: [{ kind: "pay_stub", who: "", from: ly + "-" + lmm + "-01", to: ly + "-" + lmm + "-" + pad(last), label: "" }, { kind: "rent", who: "", from: "", to: "", label: "" }],
      sent: [{ kind: "pay_stub", who: "", from: ly + "-" + lmm + "-01", to: ly + "-" + lmm + "-14", label: "", sent: plus(-12), receipt: "lists" },
        { kind: "rent", who: "", from: "", to: "", label: "", sent: plus(-12), receipt: "not_listed" }] };
    run();
  }

  function run() {
    var r;
    try { r = A.check(s, window.Engines.today(), (U.meta().engines || {}).askedagain); }
    catch (e) { if (!e.problems) throw e; form(e.problems); return; }
    U.count("asked-again", "dates"); U.count("asked-again", "kit"); result(r);
  }

  function text(r) {
    return ["THEY ASKED AGAIN FOR PROOF", "", r.headline, ""].concat(r.items.map(function (i) { return "* " + i.requested + "\n  " + i.label + ". " + i.action + "\n  Ask: " + i.question; }))
      .concat(["", "WHAT TO SAY ON THE CALL", r.call, "", "COVER NOTE", r.cover, ""]).concat(r.notes.map(function (n) { return "- " + n.plain + " " + n.source; })).concat(["", r.disclaimer]).join("\r\n");
  }

  function result(r) {
    U.show(
      h("h1", { class: "long", text: r.headline }),
      h("p", { class: "lead" + (r.deadline_passed ? " late" : ""), text: r.deadline_passed ? "Call the agency today and ask whether you can still send it. If your case closed, the paperwork helper shows the window to send papers without starting over." : r.days_left + " days left. Keep this date until the agency tells you, in writing or on a call you note down, that nothing else is needed." }),
      r.deadline_passed ? h("p", {}, h("a", { href: "#paperwork", text: "I lost benefits over paperwork" })) : null,
      h("ul", { class: "matches" }, r.items.map(function (i) {
        return h("li", { class: "match " + i.status },
          h("p", {}, h("b", { text: i.requested }), h("span", { class: "tag", text: i.label })),
          h("p", { text: i.action }),
          h("p", { class: "ask" }, h("b", { text: "Ask: " }), i.question),
          i.help.length ? h("ul", { class: "small sources" }, i.help.map(function (x) { return h("li", {}, x.plain + " ", U.link(x.source, "Source")); })) : null);
      })),
      U.draftBox("What to say on the call", r.call, "asked-again-call.txt"),
      U.draftBox("Cover note to send with your proof", r.cover, "asked-again-cover.txt"),
      h("h2", { text: "Rules this is based on" }), U.sources(r.notes),
      h("p", { class: "small", text: r.disclaimer }),
      U.row(U.go("Print this", function () { window.print(); }), U.quiet("Download as text", function () { U.download("asked-again.txt", "text/plain", text(r)); }),
        U.sentButton("renewal", "Proof sent again for the notice due " + r.due_long, "online"), U.quiet("Change my answers", function () { form(); })));
  }

  window.Modules = window.Modules || {};
  window.Modules.askedAgain = { start: start };
})();
