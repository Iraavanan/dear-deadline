/* Four helpers for what comes after a letter, all run on this device:

   - permission:  can a family member or helper talk to the agency for me?
   - hearingPrep: my hearing is scheduled; which papers answer what the agency said?
   - decision:    I won my hearing; why is my benefit still the same? (SNAP or Medicaid)
   - medicaidEnd: my Medicaid is ending; what about each person in my household? (Florida first)

   Each function takes the person's answers, today's date and the rule rows from /api/meta, and
   returns a result or throws {problems}. Nothing typed here is sent to the site. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NextSteps = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function day(iso) { var p = iso.split("-").map(Number); return Date.UTC(p[0], p[1] - 1, p[2]) / 864e5; }
  function iso(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
  function say(s) { var p = s.split("-").map(Number); return MONTHS[p[1] - 1] + " " + p[2] + ", " + p[0]; }
  function okDate(v) {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    var p = v.split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
  }
  function src(r) { return { plain: r.plain, source: r.source }; }
  function txt(v, n) { return String(v || "").trim().slice(0, n); }
  var INDEPENDENT = " This is an independent tool, not a government agency, and not legal advice.";

  /* ---------- Permission for a helper ---------- */
  var PROGRAMS = { ssa: "Social Security or SSI", medicare: "Medicare (1-800-MEDICARE)", fl_snap: "Florida SNAP (food assistance)", fl_medicaid: "Florida Medicaid" };
  function permission(raw, today, t) {
    var p = {}, progs = (raw && Array.isArray(raw.programs) ? raw.programs : []).filter(function (x) { return PROGRAMS[x]; });
    if (!progs.length) p.programs = "Choose at least one program.";
    var role = raw && raw.role;
    if (["prepare", "talk", "act"].indexOf(role) < 0) p.role = "Choose what the helper will do.";
    if (Object.keys(p).length) throw { problems: p };
    var helper = txt(raw.helper, 60) || "my helper", used = [t.prepare], rows = [];
    progs.forEach(function (k) {
      var r;
      if (role === "prepare") { rows.push({ program: PROGRAMS[k], form: "No form needed", does: "Helping you read, fill in, copy and send papers, and sitting with you on a call while you speak.", signs: "Nobody" }); return; }
      if (k === "ssa") {
        r = role === "act" ? t.ssa_rep : t.ssa_release;
        rows.push({ program: PROGRAMS[k], form: r.form, form_url: r.form_url, does: r.plain, signs: "You, with your own handwritten signature" + (role === "act" ? ", and " + helper + " as the representative" : "") + ". A legal guardian can sign for the adult they are guardian for." });
        used.push(r, t.ssa_sign);
      } else if (k === "medicare") {
        r = t.medicare; rows.push({ program: PROGRAMS[k], form: r.form, form_url: r.form_url, does: r.plain + (role === "act" ? " For a Medicare appeal, the appeal notice says how to name a representative." : ""), signs: "You, the person with Medicare" });
        used.push(r);
      } else if (k === "fl_snap") {
        r = t.fl_rep; rows.push({ program: PROGRAMS[k], form: r.form, form_url: r.source, does: r.plain, signs: "You, as the head of the household, and " + helper });
        used.push(r);
      } else {
        r = t.fl_disclose; rows.push({ program: PROGRAMS[k], form: r.form, form_url: r.source, does: r.plain, signs: "You, the person with Medicaid" });
        used.push(r);
      }
    });
    var card = ["HELPER NOTE", "", "Name: [your name]", "My helper: " + helper + ", phone [their phone]", ""].concat(rows.map(function (r) { return "- " + r.program + ": " + r.form; }))
      .concat(["", "If an agency asks, I am on the call and agree that " + helper + " may speak with you for me today.", "", "Signature: ____________________   Date: ________"]).join("\n");
    return { headline: role === "prepare" ? "No form is needed for that kind of help" : "The form for each program, and who signs it", rows: rows, card: card,
      rules: used.filter(function (r, i, a) { return r && a.indexOf(r) === i; }).map(src),
      disclaimer: "Agencies decide what they accept. Check the form's own instructions before you send it." + INDEPENDENT };
  }

  /* ---------- Hearing evidence outline ---------- */
  function hearingPrep(raw, today, t) {
    var p = {}, program = raw && raw.program;
    if (["snap", "medicaid"].indexOf(program) < 0) p.program = "Choose SNAP or Medicaid.";
    var date = raw && raw.hearing_date;
    if (date && !okDate(date)) p.hearing_date = "Check the hearing date.";
    var points = (raw && Array.isArray(raw.points) ? raw.points : []).map(function (x) {
      return { says: txt(x && x.says, 300), page: txt(x && x.page, 40), mine: txt(x && x.mine, 300), ask: txt(x && x.ask, 300) };
    }).filter(function (x) { return x.says; }).slice(0, 12);
    if (!points.length) p["points.0.says"] = "Write at least one thing the agency says.";
    if (Object.keys(p).length) throw { problems: p };
    var left = date ? day(date) - day(today) : null, gaps = [];
    points.forEach(function (x, i) {
      if (!x.mine) gaps.push("Point " + (i + 1) + " has no evidence of yours yet.");
      if (!x.page) gaps.push("Point " + (i + 1) + " has no page from the case file. Ask for the file if you have not seen it.");
    });
    var out = ["HEARING OUTLINE", "", "Program: " + (program === "snap" ? "SNAP" : "Medicaid") + (date ? "   Hearing: " + say(date) : ""), "Case number: [from your notice]", "",
      "What I am asking for: [one sentence, for example: restore my benefits from the date they stopped]", ""];
    points.forEach(function (x, i) {
      out.push((i + 1) + ". The agency says: " + x.says + (x.page ? " (case file, " + x.page + ")" : ""));
      out.push("   My answer and evidence: " + (x.mine || "[add]"));
      if (x.ask) out.push("   Question to ask: " + x.ask);
      out.push("");
    });
    out.push("Witnesses: [names, or none]", "Documents I sent ahead: [list, with the date sent]", "", "At the end: ask when the decision will come, and how you will get it.");
    var r = program === "snap" ? [t.snap_file, t.snap_rights] : [t.medicaid_rights];
    return { headline: left === null ? "Your hearing outline" : (left < 0 ? "The hearing date has passed" : left + " days until your hearing"), outline: out.join("\n"), gaps: gaps,
      steps: ["Ask the agency for a copy of your case file and the documents it will use, if you do not have them yet.", "Send copies of your evidence to the hearing office before the hearing, if the notice says how, and keep the originals.",
        "Keep this outline in front of you on the call. Speak to one point at a time."],
      rules: r.map(src), disclaimer: "This organises what you write. It does not judge your case." + INDEPENDENT };
  }

  /* ---------- After a hearing decision ---------- */
  function decision(raw, today, t, fl) {
    var p = {}, program = raw && raw.program, order = raw && raw.order, since = raw && raw.since;
    if (["snap", "medicaid"].indexOf(program) < 0) p.program = "Choose SNAP or Medicaid.";
    if (["increase", "redo", "other"].indexOf(order) < 0) p.order = "Choose what the decision orders.";
    if (["nothing", "new_notice", "part"].indexOf(since) < 0) p.since = "Choose what has happened since.";
    if (!okDate(raw && raw.received)) p.received = "Enter the date you got the decision.";
    else if (raw.received > today) p.received = "Check the date.";
    if (Object.keys(p).length) throw { problems: p };
    var words = txt(raw.words, 600), got = raw.received, steps = [], used = [], due = null, late = false;
    if (program === "snap" && order === "increase") {
      due = iso(day(got) + t.snap_increase.days);
      late = day(today) > day(due);
      used.push(t.snap_increase, t.snap_lost);
      steps.push(late ? "More than 10 days have passed since " + say(got) + ". Check your EBT account history for a supplement. If it is not there, contact the state now and send the letter below." :
        "Watch your EBT account until " + say(due) + ". The state may use your normal payment date instead, if that is within 60 days of your hearing request.");
    } else if (program === "medicaid" && order === "increase") {
      used.push(t.medicaid_fix);
      steps.push("The agency must act promptly and pay back to the date of the wrong action. Check that coverage shows as active again, and that bills from that time are being paid.");
    } else if (order === "redo") {
      used.push(program === "snap" ? t.snap_time : t.medicaid_time);
      steps.push("A decision that sends the case back means the agency must look again and send you a new notice. Watch for it. When it comes, check it against what the hearing decision says, and note its own appeal date.");
    } else {
      steps.push("Read the part of the decision that says what the agency must do. Copy that sentence into the box below so it goes into your letter.");
    }
    if (since === "new_notice") steps.push("Put the new notice beside the hearing decision. Check that it does what the decision ordered, for the right months and the right people.");
    if (since === "part") steps.push("Write down what changed and what did not, with dates. Ask for the rest in writing, quoting the decision.");
    if (since === "nothing" || since === "part") steps.push(fl ? "In Florida, contact your DCF office or the call center, and if nothing happens, the Appeal Hearings Section that issued the decision." : "Contact the office that handles your case, and if nothing happens, the hearing office that issued the decision.");
    var letter = ["To: [your " + (program === "snap" ? "SNAP" : "Medicaid") + " office]" + (fl ? ", copy to the Appeal Hearings Section" : ""), "Date: [today's date]", "Name: [your name]", "Case number: [from the decision]", "",
      "Re: Carrying out the hearing decision I received on " + say(got), "",
      "The hearing decision says:", words ? "\"" + words + "\"" : "[copy the sentence that says what the agency must do]", "",
      since === "nothing" ? "As of today, nothing has changed on my case." : (since === "part" ? "Only part of this has been done: [what changed, and what has not]." : "I received a new notice dated [date]. It does not match the decision because [reason]."),
      "Please carry out the decision and send me a written notice showing what was done, for which months." + (program === "snap" && order === "increase" ? " Federal rules require an increase to reach my EBT account within 10 days of the state receiving the decision (7 CFR 273.15(c)(1))." : ""),
      "", "Phone: [your phone]", "", "Signature: ____________________"].join("\n");
    var contact = fl && t.fl_contact ? { plain: t.fl_contact.plain, source: t.fl_contact.source } : null;
    return { headline: due ? (late ? "The 10 days ended on " + say(due) : "Watch for the increase by " + say(due)) : "Check that the decision is carried out",
      due: due, late: late, steps: steps, letter: letter, contact: contact, rules: used.map(src),
      disclaimer: "This works from the date and the words you entered. The decision itself says what must be done." + INDEPENDENT };
  }

  /* ---------- Medicaid ending: one line per person ---------- */
  var GROUPS = { adult: "Adult under 65", child: "Child under 19", pregnant: "Pregnant", aged_disabled: "65 or older, blind or disabled" };
  function medicaidEnd(raw, today, t) {
    var p = {}, members = [];
    (raw && Array.isArray(raw.members) ? raw.members : []).slice(0, 10).forEach(function (m, i) {
      if (!m || !txt(m.name, 40)) return;
      if (!GROUPS[m.group]) p["members." + i + ".group"] = "Choose a group.";
      if (!okDate(m.ends)) p["members." + i + ".ends"] = "Enter the date coverage ends or ended.";
      if (["paperwork", "income", "age", "other"].indexOf(m.reason) < 0) p["members." + i + ".reason"] = "Choose the reason on the notice.";
      if (m.next_start && !okDate(m.next_start)) p["members." + i + ".next_start"] = "Check this date.";
      members.push({ name: txt(m.name, 40), group: m.group, ends: m.ends, reason: m.reason, next: ["none", "applied", "approved"].indexOf(m.next) >= 0 ? m.next : "none", next_start: m.next_start || "" });
    });
    if (!members.length) p["members.0.name"] = "Add at least one person.";
    var size = Number(raw && raw.household) || 0, income = raw && raw.income !== "" && raw.income !== undefined ? Number(String(raw.income).replace(/[$,]/g, "")) : null;
    if (income !== null && (isNaN(income) || income < 0)) p.income = "Enter yearly income in dollars, or leave it empty.";
    if (Object.keys(p).length) throw { problems: p };
    var fpl = size ? t.fpl.base + t.fpl.per * (size - 1) : null, below = fpl !== null && income !== null ? income < fpl : null, T = day(today), used = [];
    var lines = members.map(function (m) {
      var E = day(m.ends), out = { name: m.name, group: GROUPS[m.group], ends: m.ends, ends_long: say(m.ends), actions: [], dates: [] };
      if (m.reason === "paperwork") { out.actions.push("Send the renewal or missing papers within 90 days after coverage ends to have it looked at again without a new application."); out.dates.push(["Last day to send papers", iso(E + 90)]); out.link = ["#paperwork", "Papers after coverage ended"]; }
      if (m.reason !== "paperwork") out.actions.push("If you think the decision is wrong, you can ask for a hearing. The hearing helper gives the date.");
      if (m.next === "approved" && m.next_start) {
        var gap = day(m.next_start) - E - 1;
        out.actions.push(gap > 0 ? "New coverage starts " + say(m.next_start) + ", which leaves " + gap + " day" + (gap === 1 ? "" : "s") + " uncovered. Ask whether it can start sooner." : "New coverage starts " + say(m.next_start) + ", with no gap.");
      } else if (m.group === "child") {
        out.actions.push("Apply for Florida KidCare now if no one has contacted you, and keep proof that you applied. Do not wait for coverage to end."); used.push(t.kids); out.apply = t.kids.apply;
      } else if (m.group === "adult" || m.group === "pregnant") {
        out.dates.push(["HealthCare.gov window opens", iso(E - t.marketplace.before)], ["HealthCare.gov window closes", iso(E + t.marketplace.after)]);
        if (below === true) { out.actions.push("Your income is below the poverty level. In Florida that usually means no Marketplace savings for adults, so check every other route first: ask DCF whether another Medicaid group applies, and look for community health centers."); used.push(t.gap, t.fl_not_expanded, t.fpl); }
        else out.actions.push(m.next === "applied" ? "You applied. Pick a plan and pay the first premium so coverage can start." : "Apply on HealthCare.gov inside the window below. Coverage starts once the first premium is paid.");
        used.push(t.marketplace);
        if (m.group === "pregnant") out.actions.push("Pregnant? Tell DCF. Pregnancy can make someone eligible for Medicaid even when other adults are not.");
      } else {
        out.actions.push("Ask DCF whether another Medicaid group for people who are 65 or older, blind or disabled applies, and whether Medicare Savings Programs can help.");
        out.link = out.link || ["#medicare-costs", "Medicare Savings Programs"];
      }
      out.dates = out.dates.map(function (d) { return { label: d[0], date: d[1], date_long: say(d[1]), days_left: day(d[1]) - T }; });
      out.urgent = E - T <= 14;
      return out;
    });
    return { headline: lines.length === 1 ? "Next steps for " + lines[0].name : "Next steps for " + lines.length + " people", lines: lines, below: below, fpl: fpl,
      rules: used.filter(function (r, i, a) { return a.indexOf(r) === i; }).map(src),
      disclaimer: "Florida's rules first; other states differ. DCF, Florida KidCare and HealthCare.gov decide." + INDEPENDENT };
  }

  return { permission: permission, hearingPrep: hearingPrep, decision: decision, medicaidEnd: medicaidEnd, PROGRAMS: PROGRAMS, GROUPS: GROUPS };
});

(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI) return;
  var U = window.UI, h = U.h, N = window.NextSteps;
  function E() { return U.meta().engines || {}; }
  function today() { return window.Engines.today(); }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function steps(list) { return h("ol", {}, list.map(function (x) { return h("li", { text: x }); })); }
  function tail(r, file, body) {
    return [h("h2", { text: "Rules this is based on" }), U.sources(r.rules), h("p", { class: "small", text: r.disclaimer }),
      U.row(U.go("Print this", function () { window.print(); }), U.quiet("Download as text", function () { U.download(file, "text/plain", body); }), U.quiet("Back", U.home))];
  }
  function attempt(fn, again) { try { return fn(); } catch (e) { if (!e.problems) throw e; again(e.problems); return null; } }

  /* Permission */
  function permStart() { U.count("helper-permission", "start"); U.setDatebar(null); permForm({}, {}); }
  function permForm(s, p) {
    U.show(h("h1", { class: "long", text: "Can someone talk to the agency for me?" }),
      h("p", { class: "lead", text: "A family member or friend can help with papers and calls. For the agency to talk with them without you, or for them to act for you, each program has its own form, and you sign it." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault();
        var s2 = { programs: U.ticked("programs"), role: U.picked("role"), helper: val("helper") };
        var r = attempt(function () { return N.permission(s2, today(), E().permission); }, function (pp) { permForm(s2, pp); });
        if (r) { U.count("helper-permission", "kit"); permResult(r); } } } },
        U.ticks("programs", "Which programs?", Object.keys(N.PROGRAMS).map(function (k) { return [k, N.PROGRAMS[k]]; }), s.programs || [], p),
        U.choice("role", "What will your helper do?", [["prepare", "Help me read, fill in and send papers, and sit with me on calls"], ["talk", "Talk with the agency and get information without me on the line"], ["act", "Act for me: file, appeal and get decisions sent to them"]], s.role, p),
        U.field("helper", "Your helper's first name", "Optional. It goes on the note.", h("input", { type: "text", value: s.helper || "", maxlength: "60" }), p),
        U.row(U.go("Show me the forms", null, "submit"), U.quiet("Back", U.home))));
    U.firstProblem();
  }
  function permResult(r) {
    U.show(h("h1", { class: "long", text: r.headline }),
      h("table", { class: "plain" }, h("tr", {}, ["Program", "Form", "What it allows", "Who signs"].map(function (x) { return h("th", { text: x }); })),
        r.rows.map(function (x) { return h("tr", {}, h("td", { text: x.program }), h("td", {}, x.form_url ? U.link(x.form_url, x.form) : x.form), h("td", { text: x.does }), h("td", { text: x.signs })); })),
      U.draftBox("A note to keep with your papers", r.card, "helper-note.txt"),
      tail(r, "helper-permission.txt", r.rows.map(function (x) { return x.program + ": " + x.form + "\n  " + x.does + "\n  Signs: " + x.signs; }).join("\r\n") + "\r\n\r\n" + r.card));
  }

  /* Hearing outline */
  function prepStart() { U.count("hearing-prep", "start"); U.setDatebar(null); prepForm({ points: [{}, {}] }, {}); }
  function prepCollect(s) {
    s.program = U.picked("program"); s.hearing_date = val("hearing_date");
    s.points = s.points.map(function (_, i) { return { says: val("p" + i + "_says"), page: val("p" + i + "_page"), mine: val("p" + i + "_mine"), ask: val("p" + i + "_ask") }; });
  }
  function prepForm(s, p) {
    var pp = {}; Object.keys(p).forEach(function (k) { var m = /^points\.(\d+)\.(\w+)$/.exec(k); pp[m ? "p" + m[1] + "_" + m[2] : k] = p[k]; });
    U.show(h("h1", { class: "long", text: "Get ready for my hearing" }),
      h("p", { class: "lead", text: "Put each thing the agency says beside the page it comes from, your own evidence, and one question. You get a one-page outline to keep in front of you, on the phone or in the room. It stays on this device." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); prepCollect(s);
        var r = attempt(function () { return N.hearingPrep(s, today(), E().hearingnext); }, function (q) { prepForm(s, q); });
        if (r) { U.count("hearing-prep", "kit"); prepResult(r, s); } } } },
        U.choice("program", "Which program?", [["snap", "SNAP (food assistance)"], ["medicaid", "Medicaid"]], s.program, pp),
        U.field("hearing_date", "Hearing date", "Optional.", h("input", { type: "date", value: s.hearing_date || "" }), pp),
        s.points.map(function (x, i) {
          var k = "p" + i + "_";
          return h("fieldset", { class: "month" }, h("legend", { text: "Point " + (i + 1) }),
            U.field(k + "says", "What the agency says", "Copy it from the notice or the case file.", h("textarea", { rows: "2", maxlength: "300", text: x.says || "" }), pp),
            U.field(k + "page", "Where it is in the case file", "Optional. Like \"page 12\".", h("input", { type: "text", maxlength: "40", value: x.page || "" }), pp),
            U.field(k + "mine", "Your answer and your evidence", "Like \"pay stub of Oct 9 shows $612, not $812\".", h("textarea", { rows: "2", maxlength: "300", text: x.mine || "" }), pp),
            U.field(k + "ask", "One question to ask", "Optional.", h("input", { type: "text", maxlength: "300", value: x.ask || "" }), pp));
        }),
        U.row(U.quiet("Add another point", function () { prepCollect(s); s.points.push({}); prepForm(s, {}); })),
        U.row(U.go("Make my outline", null, "submit"), U.quiet("Back", U.home))));
    U.firstProblem();
  }
  function prepResult(r, s) {
    U.show(h("h1", { class: "long", text: r.headline }),
      r.gaps.length ? h("div", { class: "alert", role: "status" }, h("ul", {}, r.gaps.map(function (g) { return h("li", { text: g }); }))) : null,
      U.draftBox("Your one-page outline", r.outline, "hearing-outline.txt"),
      h("h2", { text: "Before the hearing" }), steps(r.steps),
      h("p", {}, h("a", { href: "#benefit-hearing", text: "Haven't asked for the hearing yet? Work out the date" })),
      U.row(U.quiet("Change my points", function () { prepForm(s, {}); })),
      tail(r, "hearing-outline.txt", r.outline));
  }

  /* Decision follow-up */
  function decStart() { U.count("hearing-decision", "start"); U.setDatebar(null); decForm({ state: "FL" }, {}); }
  function decForm(s, p) {
    U.show(h("h1", { class: "long", text: "I won my hearing, but nothing changed" }),
      h("p", { class: "lead", text: "A hearing decision tells the agency what to do. Put that sentence beside what has happened since, see the date it should have happened by, and send a letter asking for it to be carried out." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault();
        var s2 = { program: U.picked("program"), state: U.picked("state"), order: U.picked("order"), since: U.picked("since"), received: val("received"), words: val("words") };
        var r = attempt(function () { return N.decision(s2, today(), Object.assign({}, E().hearingnext, { fl_contact: (E().hearing || {}).fl_contact }), s2.state === "FL"); }, function (q) { decForm(s2, q); });
        if (r) { U.count("hearing-decision", "kit"); decResult(r, s2); } } } },
        U.choice("program", "Which program?", [["snap", "SNAP (food assistance)"], ["medicaid", "Medicaid"]], s.program, p),
        U.choice("state", "Which state?", [["FL", "Florida"], ["other", "Another state"]], s.state, p),
        U.field("received", "Date you got the decision", null, h("input", { type: "date", value: s.received || "" }), p),
        U.choice("order", "What does the decision order?", [["increase", "Give back or raise my benefits, or restore my coverage"], ["redo", "The agency must look at my case again"], ["other", "Something else, or I'm not sure"]], s.order, p),
        U.field("words", "The sentence that says what the agency must do", "Optional, but it makes the letter stronger. Copy it word for word.", h("textarea", { rows: "3", maxlength: "600", text: s.words || "" }), p),
        U.choice("since", "What has happened since?", [["nothing", "Nothing has changed"], ["part", "Some of it was done"], ["new_notice", "I got a new notice"]], s.since, p),
        U.row(U.go("Show me what to do", null, "submit"), U.quiet("Back", U.home))));
    U.firstProblem();
  }
  function decResult(r, s) {
    U.show(h("h1", { class: "long", text: r.headline }), steps(r.steps),
      r.contact ? h("p", { class: "small" }, r.contact.plain + " ", U.link(r.contact.source, "Source")) : null,
      U.draftBox("Letter asking for the decision to be carried out", r.letter, "carry-out-decision.txt"),
      U.row(U.sentButton("hearing", "Letter about carrying out a hearing decision", "mail"), U.quiet("Change my answers", function () { decForm(s, {}); })),
      tail(r, "hearing-decision.txt", r.steps.join("\r\n") + "\r\n\r\n" + r.letter));
  }

  /* Medicaid ending */
  function endStart() { U.count("medicaid-ending", "start"); U.setDatebar(null); endForm({ members: [{}, {}] }, {}); }
  function endCollect(s) {
    s.household = val("household"); s.income = val("income");
    s.members = s.members.map(function (_, i) { var k = "m" + i + "_"; return { name: val(k + "name"), group: val(k + "group"), ends: val(k + "ends"), reason: val(k + "reason"), next: val(k + "next"), next_start: val(k + "next_start") }; });
  }
  function sel(list, v) { return h("select", {}, [h("option", { value: "", text: "Choose" })].concat(list.map(function (o) { return h("option", { value: o[0], text: o[1], selected: o[0] === v ? "selected" : null }); }))); }
  function endForm(s, p) {
    var pp = {}; Object.keys(p).forEach(function (k) { var m = /^members\.(\d+)\.(\w+)$/.exec(k); pp[m ? "m" + m[1] + "_" + m[2] : k] = p[k]; });
    U.show(h("h1", { class: "long", text: "My Medicaid is ending. What about each of us?" }),
      h("p", { class: "lead", text: "One notice can end coverage for some people in a home and not others, and the next step differs for a child, an adult and someone who is pregnant. Give each person a line. Florida first." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); endCollect(s);
        var r = attempt(function () { return N.medicaidEnd(s, today(), E().medicaidend); }, function (q) { endForm(s, q); });
        if (r) { U.count("medicaid-ending", "kit"); endResult(r, s); } } } },
        s.members.map(function (m, i) {
          var k = "m" + i + "_";
          return h("fieldset", { class: "month" }, h("legend", { text: "Person " + (i + 1) }),
            U.field(k + "name", "First name or nickname", "Leave empty to skip.", h("input", { type: "text", maxlength: "40", value: m.name || "" }), pp),
            U.field(k + "group", "Group", null, sel(Object.keys(N.GROUPS).map(function (g) { return [g, N.GROUPS[g]]; }), m.group), pp),
            U.field(k + "ends", "Date coverage ends or ended", null, h("input", { type: "date", value: m.ends || "" }), pp),
            U.field(k + "reason", "Why, according to the notice", null, sel([["paperwork", "Papers not received"], ["income", "Income too high"], ["age", "Aged out, or pregnancy coverage ended"], ["other", "Other or not sure"]], m.reason), pp),
            U.field(k + "next", "Other coverage", null, sel([["none", "None yet"], ["applied", "Applied, waiting"], ["approved", "Approved"]], m.next), pp),
            U.field(k + "next_start", "If approved: start date", "Optional.", h("input", { type: "date", value: m.next_start || "" }), pp));
        }),
        U.row(U.quiet("Add another person", function () { endCollect(s); s.members.push({}); endForm(s, {}); })),
        U.field("household", "People in your household", "Optional, with income: checks the poverty level.", h("input", { type: "number", min: "1", max: "15", value: s.household || "" }), pp),
        U.field("income", "Household income for the year", "Optional.", h("input", { type: "text", inputmode: "decimal", value: s.income || "" }), pp),
        U.row(U.go("Show next steps", null, "submit"), U.quiet("Back", U.home))));
    U.firstProblem();
  }
  function endResult(r, s) {
    U.show(h("h1", { class: "long", text: r.headline }),
      h("ul", { class: "matches" }, r.lines.map(function (l) {
        return h("li", { class: "match" + (l.urgent ? " urgent" : "") },
          h("p", {}, h("b", { text: l.name + " " }), h("span", { class: "tag", text: l.group + ", coverage ends " + l.ends_long })),
          steps(l.actions),
          l.dates.length ? h("ul", { class: "small" }, l.dates.map(function (d) { return h("li", { text: d.label + ": " + d.date_long + " (" + (d.days_left < 0 ? Math.abs(d.days_left) + " days ago" : d.days_left + " days from today") + ")" }); })) : null,
          l.apply ? h("p", {}, U.link(l.apply, "Florida KidCare")) : null,
          l.link ? h("p", {}, h("a", { href: l.link[0], text: l.link[1] })) : null);
      })),
      U.row(U.quiet("Change my answers", function () { endForm(s, {}); })),
      tail(r, "medicaid-ending.txt", r.lines.map(function (l) { return l.name + " (" + l.group + ", ends " + l.ends_long + ")\r\n" + l.actions.map(function (a) { return "- " + a; }).join("\r\n") + "\r\n" + l.dates.map(function (d) { return "  " + d.label + ": " + d.date_long; }).join("\r\n"); }).join("\r\n\r\n")));
  }

  window.Modules = window.Modules || {};
  window.Modules.nextSteps = { permission: permStart, hearingPrep: prepStart, decision: decStart, medicaidEnd: endStart };
})();
