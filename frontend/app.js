/* Dear Deadline: screens.
   Everything the person types stays in this page's memory. Nothing is written
   to cookies or browser storage, and closing the tab forgets it all. */
(function () {
  "use strict";

  var state;
  var screen = document.getElementById("screen");
  var datebar = document.getElementById("datebar");
  var STEPS = ["Your notice", "Your dates", "A few questions", "Your options"];
  // The page and the helper behind it are released together. If the helper
  // answering is older than this page, say so plainly instead of failing later.
  var NEEDS_VERSION = "0.15.0";
  var stale = false;

  function reset() {
    state = { meta: state ? state.meta : null, facts: {}, answers: {}, statements: {}, budget: {}, result: null, sample: null, read: {}, otherDates: [], picture: null, photoLines: {}, q: 0 };
  }
  reset();

  // ---------- small helpers ----------

  function append(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(el, c); }); return; }
    el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }

  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k];
      else if (k === "style") el.style.cssText = attrs[k];
      else if (k === "on") Object.keys(attrs.on).forEach(function (ev) { el.addEventListener(ev, attrs.on[ev]); });
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) el.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  // Replace an element's contents. Goes through h() so nested lists are flattened.
  function fill(el, children) {
    var holder = h("div", {}, children);
    el.replaceChildren.apply(el, Array.prototype.slice.call(holder.childNodes));
  }

  /* A screen's "Back" button becomes a "Go back" link at the top of the card, where people look for it first. */
  function goBackOnTop() {
    var buttons = screen.querySelectorAll("button.quiet"), back = null;
    for (var i = 0; i < buttons.length; i++) if (buttons[i].textContent === "Back") { back = buttons[i]; break; }
    if (!back) return;
    var row = back.parentNode;
    back.className = "back"; back.textContent = "Go back";
    screen.insertBefore(back, screen.firstChild);
    if (row && row.classList.contains("row") && !row.children.length) row.remove();
  }

  /* At the end of a result: the helpers people most often need next. Only on result screens,
     which are the ones with a "Print this" button, so forms stay short. */
  var NAMES = {
    "overpayment": "I was paid too much", "check-amount": "Check how they got the amount", "notice-check": "Is my overpayment notice complete?",
    "withholding": "They're taking too much from my check", "disability-ended": "My disability has ended", "decision-appeal": "My claim was denied",
    "disability-wait": "My disability case is taking too long", "ssa-call": "I can't reach Social Security", "locked-out": "I'm locked out of my account",
    "find-letter": "Another Social Security letter", "medicare-letter": "A Medicare notice, bill or denial", "medicare-bill": "Does my bill match my Medicare notice?",
    "medicare-costs": "Could a program pay my Medicare costs?", "plan-appeal": "My Medicare plan refused care or a drug", "renewal": "Check my renewal",
    "asked-again": "They asked again for proof", "benefit-hearing": "SNAP or Medicaid denied, cut or stopped", "hearing-prep": "Get ready for my hearing",
    "hearing-decision": "I won my hearing, but nothing changed", "paperwork": "Lost Medicaid or SNAP over paperwork", "medicaid-ending": "My Medicaid is ending",
    "work-rules": "The 80-hour rules", "missed-interview": "I missed my SNAP interview", "stolen-snap": "My SNAP benefits were stolen",
    "work-check": "I work while getting benefits", "ssi-limit": "Am I under SSI's $2,000 limit?", "report-change": "Something in my life changed",
    "filed": "Keep a record of what I sent", "is-it-real": "Is this message real?", "helper-permission": "Can someone talk to the agency for me?",
    "helper-board": "I help several people", "earnings-record": "Is a year missing from my earnings record?", "fema-proof": "FEMA is asking for proof that I lived there",
    "late-appeal": "I missed my appeal deadline", "payment-missing": "My payment didn't arrive", "benefit-offset": "Part of my benefit is taken for a debt",
    "medicare-irmaa": "My Medicare premium is higher because of income", "after-death": "Someone who got benefits died",
    "work-restart": "My benefits stopped after I went back to work", "ssi-help": "My SSI went down because of help I get", "amount-changed": "My benefit amount changed",
    "snap-overpayment": "The state says I was paid too much SNAP", "va-debt": "I got a VA debt letter", "disability-review": "Social Security sent me a disability review form",
    "ra-overpayment": "Florida says I was overpaid unemployment", "voucher-ending": "My housing voucher is being ended", "estate-recovery": "Medicaid wants repayment from an estate",
    "partb-late": "I missed signing up for Medicare Part B", "fairness-act": "I have a public pension. Did my Social Security change?",
    "benefit-math": "Check how my retirement benefit was worked out"
  };
  var RELATED = {
    "overpayment": ["withholding", "check-amount", "notice-check"], "check-amount": ["overpayment", "notice-check"], "notice-check": ["overpayment", "check-amount"],
    "withholding": ["overpayment", "ssa-call"], "disability-ended": ["decision-appeal", "disability-wait"], "decision-appeal": ["disability-wait", "helper-permission"],
    "disability-wait": ["ssa-call", "helper-permission"], "ssa-call": ["filed", "locked-out"], "locked-out": ["ssa-call", "is-it-real"], "find-letter": ["ssa-call", "filed"],
    "medicare-letter": ["plan-appeal", "medicare-bill", "medicare-costs"], "medicare-bill": ["medicare-costs", "medicare-letter"], "medicare-costs": ["medicare-bill", "plan-appeal"],
    "plan-appeal": ["helper-permission", "filed"], "renewal": ["asked-again", "paperwork"], "asked-again": ["paperwork", "filed"],
    "benefit-hearing": ["hearing-prep", "hearing-decision"], "hearing-prep": ["hearing-decision", "helper-permission"], "hearing-decision": ["filed", "benefit-hearing"],
    "paperwork": ["renewal", "benefit-hearing", "medicaid-ending"], "medicaid-ending": ["paperwork", "benefit-hearing"], "work-rules": ["renewal", "benefit-hearing"],
    "missed-interview": ["renewal", "benefit-hearing"], "stolen-snap": ["is-it-real", "filed"], "rent-check": ["filed"], "utility-shutoff": ["filed"],
    "work-check": ["report-change", "ssi-limit"], "ssi-limit": ["report-change", "overpayment"], "report-change": ["work-check", "filed"], "filed": ["asked-again", "ssa-call"],
    "is-it-real": ["stolen-snap", "locked-out"], "helper-permission": ["helper-board"], "helper-board": ["helper-permission"],
    "late-appeal": ["decision-appeal", "filed"], "payment-missing": ["ssa-call", "locked-out"], "benefit-offset": ["withholding", "ssa-call"],
    "medicare-irmaa": ["medicare-costs", "filed"], "after-death": ["ssa-call", "filed"], "work-restart": ["work-check", "ssa-call"],
    "ssi-help": ["report-change", "ssi-limit"], "amount-changed": ["withholding", "medicare-irmaa"],
    "snap-overpayment": ["benefit-hearing", "hearing-prep", "filed"], "va-debt": ["benefit-offset", "filed"], "disability-review": ["disability-ended", "ssa-call"],
    "ra-overpayment": ["filed", "benefit-offset"], "voucher-ending": ["rent-check", "hearing-prep"], "estate-recovery": ["after-death", "filed"],
    "partb-late": ["medicare-costs", "medicare-irmaa"], "fairness-act": ["amount-changed", "ssa-call"],
    "benefit-math": ["earnings-record", "amount-changed"]
  };
  function related() {
    var where = (location.hash || "").replace(/^#/, "").split("/")[0], list = RELATED[where === "letter" ? "medicare-letter" : where];
    if (!list) return;
    var printing = Array.prototype.some.call(screen.querySelectorAll("button"), function (b) { return b.textContent === "Print this"; });
    if (!printing) return;
    screen.appendChild(h("nav", { class: "related", "aria-label": "Often needed next" }, h("p", { text: "Often needed next" }),
      h("ul", {}, list.map(function (k) { return h("li", {}, h("a", { href: "#" + k, text: NAMES[k] })); }),
        BOARD_FOR[where] && window.Modules && window.Modules.community ? h("li", { class: "community-link" }, h("a", { href: "#community/" + BOARD_FOR[where], text: "Talk with others about this" })) : null,
        h("li", {}, h("a", { href: "/", text: "All helpers", on: { click: function (ev) { ev.preventDefault(); location.hash = ""; } } })))));
  }

  /* The thin line under the card: how far through the whole helper this screen is. */
  function overall() {
    var box = document.getElementById("overall"), bar = screen.querySelector(".progress");
    if (!box) return;
    if (!bar) { box.hidden = true; return; }
    var pct = bar.getAttribute("data-pct");
    document.getElementById("overall-fill").style.setProperty("--pct", pct + "%");
    document.getElementById("overall-text").textContent = pct + "% complete";
    box.hidden = false;
  }

  function show() {
    document.body.classList.remove("landing");            // only the home page is wide
    fill(screen, Array.prototype.slice.call(arguments));
    goBackOnTop(); overall(); related();
    screen.classList.remove("in"); void screen.offsetWidth; screen.classList.add("in");   // restart the settle-in
    document.getElementById("main").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  /* One anonymous tally mark per part and stage, at most once per page load. No details are sent. */
  var counted = {}, example = false;
  /* A made-up example has been opened: until the next start, marks are tallied apart. */
  function trying() { example = true; }
  function count(part, stage, late) {
    if (stage === "start") example = false;
    var key = part + "." + stage + (example ? ".sample" : "");
    if (counted[key] || !state.meta || !state.meta.counting) return;
    counted[key] = true;
    try { fetch("/api/count", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: part, event: stage, late: late === true, sample: example }) }).catch(function () {}); } catch (e) { /* counting never gets in the way */ }
  }
  /* One case file for this visit: letters with their dates, and what was sent. It lives in the page
     until the person saves it as a file; this site keeps nothing. */
  window.__case = window.__case || { entries: [], letters: [] };
  /* "Add to my timeline": keeps this letter's dates beside every other letter's; a later letter never replaces them. */
  function timelineButton(title, noticeDate, dates) {
    var btn = quiet("Add these dates to my timeline", function () {
      var keep = dates.filter(function (d) { return d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || ""); }).map(function (d) { return { label: String(d.label || "").slice(0, 160), date: d.date }; });
      window.__case.letters.push({ title: String(title).slice(0, 160), notice_date: noticeDate || "", dates: keep, added: new Date().toISOString().slice(0, 10) });
      btn.textContent = "Added. See my timeline"; btn.onclick = function () { location.hash = "filed"; };
    });
    return btn;
  }
  /* Save unfinished work as a file, and open it again later. Only the module's own answers are saved. */
  var PROGRESS = "benefits-letter-helper-progress";
  function saveProgress(module, data) {
    return quiet("Save my progress as a file", function () {
      window.UI.download("my-progress-" + module + ".json", "application/json", JSON.stringify({ kind: PROGRESS, version: 1, module: module, saved: new Date().toISOString().slice(0, 10), data: typeof data === "function" ? data() : data }, null, 1));
    });
  }
  function openProgress(file, status) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      var d; try { d = JSON.parse(String(fr.result)); } catch (e) { d = null; }
      var to = { bill: "medicare-bill", rent: "rent-check", renewal: "renewal", workrules: "work-rules" };
      if (!d || d.kind !== PROGRESS || !to[d.module] || !window.Modules[d.module] || !window.Modules[d.module].resume) { status.textContent = "That file is not saved work from this site."; return; }
      window.__resume = { module: d.module, data: d.data }; location.hash = to[d.module];
    };
    fr.readAsText(file);
  }
  /* A module's start() calls this first: if saved work is waiting for it, it is handed over. */
  /* Saved work is only ever text, numbers, yes/no and lists of those; anything else is dropped. */
  function plain(v, depth) {
    depth = depth || 0;
    if (depth > 4) return null;
    if (typeof v === "string") return v.slice(0, 500);
    if (typeof v === "number" || typeof v === "boolean" || v === null) return v;
    if (Array.isArray(v)) return v.slice(0, 50).map(function (x) { return plain(x, depth + 1); });
    if (typeof v === "object") { var o = {}; Object.keys(v).slice(0, 60).forEach(function (k) { if (/^[a-z_0-9]{1,40}$/.test(k)) o[k] = plain(v[k], depth + 1); }); return o; }
    return null;
  }
  function takeResume(module) { var r = window.__resume; if (r && r.module === module) { window.__resume = null; return plain(r.data); } return null; }

  /* "I sent this": opens the record of what was sent with this kit's details filled in. */
  function sentButton(what, about, how) {
    return quiet("I sent this: add it to my record", function () { window.__record = { what: what, about: about || "", how: how || "mail" }; location.hash = "filed"; });
  }
  function isLate(result) { return result.deadlines.items.some(function (i) { return i.id === "appeal" && i.status === "passed"; }); }

  function api(path, body) {
    var opts = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {};
    return fetch(path, opts).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    });
  }

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function niceDate(iso) {
    var p = iso.split("-");
    return MONTHS[Number(p[1]) - 1] + " " + Number(p[2]) + ", " + p[0];
  }
  function daysText(item) {
    if (item.status === "today") return "Today";
    if (item.status === "passed") return "Passed " + Math.abs(item.days_left) + (item.days_left === -1 ? " day ago" : " days ago");
    return item.days_left + (item.days_left === 1 ? " day left" : " days left");
  }
  function money(n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function link(url, text) { return h("a", { href: url, target: "_blank", rel: "noopener noreferrer", text: text || url }); }
  function go(text, fn, type) { return h("button", { class: "go", type: type || "button", text: text, on: fn ? { click: fn } : {} }); }
  function quiet(text, fn) { return h("button", { class: "quiet", type: "button", text: text, on: { click: fn } }); }
  function row() { return h("div", { class: "row" }, Array.prototype.slice.call(arguments)); }

  function progress(step, detail, steps) {
    steps = steps || STEPS;
    // Share of the whole helper done: the last section is 100%, and questions count part-way through theirs.
    var part = /(\d+) of (\d+)/.exec(detail || ""), within = part ? (Number(part[1]) - 1) / Number(part[2]) : 0;
    var pct = step >= steps.length - 1 ? 100 : Math.max(5, Math.round((step + within) / (steps.length - 1) * 100));
    return h("div", { class: "progress", "data-pct": String(Math.min(pct, 100)) },
      h("ol", { "aria-hidden": "true" }, steps.map(function (_, i) {
        return h("li", { class: i < step ? "done" : (i === step ? "now" : null), text: steps[i] });
      })),
      h("span", { text: "Section " + (step + 1) + " of " + steps.length + ": " + steps[step] + (detail ? ", " + detail : "") }),
      // On wide screens the steps are named under the bar, so only the detail is shown in words.
      detail ? h("em", { "aria-hidden": "true", text: detail.charAt(0).toUpperCase() + detail.slice(1) }) : null);
  }

  function failed() {
    show(h("div", { class: "alert", role: "alert", text: "The page could not reach the helper, so nothing was worked out. Check your connection, then start again." }),
      row(go("Start again", start)));
  }

  function download(name, type, text) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = h("a", { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* The yellow bar that keeps the dates in view. parts: [[words before, deadline item], ...]; nothing hides it. */
  function setDatebar(parts) {
    if (!parts || !parts.length) { datebar.hidden = true; return; }
    fill(datebar, parts.map(function (p) {
      return h("span", {}, p[0] + " ", h("b", { text: niceDate(p[1].date) }), " (" + daysText(p[1]).toLowerCase() + ")");
    }));
    datebar.hidden = false;
  }

  function updateDatebar() {
    if (!state.result) { setDatebar(null); return; }
    var items = state.result.deadlines.items;
    setDatebar([["Hold off collection by", items[0]], ["Appeal by", items[1]]]);
  }

  /* The timeline runs from the notice date to day 65. `day` is how many days
     have passed since the notice; null draws the empty illustration.
     `marks` are the two dates that matter, as [day number, what it is for]. */
  function timeline(day, marks) {
    marks = marks || [[30, "holds off collection"], [60, "is the appeal date"]];
    var pct = function (d) { return Math.max(0, Math.min(100, d / 65 * 100)) + "%"; };
    var words = marks.map(function (m) { return "day " + m[0] + " " + m[1]; }).join(", ");
    return h("div", { class: "tl" + (day === null ? "" : " live"), role: "img", "aria-label": day === null
        ? "Timeline: " + words + "."
        : "Timeline: today is day " + day + " after the notice. On it, " + words + "." },
      h("div", { class: "tl-track" },
        day !== null ? h("div", { class: "tl-fill" + (day > 60 ? " late" : ""), style: "width:" + pct(day) }) : null,
        marks.map(function (m, i) {
          return h("div", { class: "tl-mark" + (i === marks.length - 1 ? " end" : ""), style: "left:" + pct(m[0]) }, h("span", { text: "Day " + m[0] }));
        }),
        day !== null ? h("div", { class: "tl-today", style: "left:" + (day > 65 ? "100%" : pct(Math.max(day, 3))), text: day > 65 ? "Today, day " + day : "Today" }) : null),
      // Early on, the Today marker sits where the "Notice date" label would be, so the label gives way.
      h("div", { class: "tl-ends" }, h("span", { text: day !== null && day < 12 ? "\u00a0" : "Notice date" }), h("span", { text: "Day 65" })));
  }

  // ---------- start ----------

  /* `due` is how long the letter gives, shown in marker; `plain` shows it without the marker. */
  function way(title, text, fn, due, plain, keys) {
    return h("li", { "data-keys": ((keys || "") + " " + title + " " + text).toLowerCase() }, h("button", { class: "way", type: "button", on: { click: fn } },
      h("b", { text: title }), h("span", { text: text }), due ? h("small", { class: plain ? "none" : null, text: due }) : null, h("i", { "aria-hidden": "true", text: "›" })));
  }

  /* Home, in two parts. First, what this site does and how it helps, with one arrow down.
     Then every way in, laid out across the page in three groups. Only what is built is offered. */
  function home() {
    reset(); updateDatebar();
    if (location.hash) history.replaceState(null, "", location.pathname);
    var go = function (where) { return function () { location.hash = where; }; };
    show(
      h("section", { class: "hero", "aria-labelledby": "hero-title" },
        h("div", { class: "hero-text" },
          h("h1", { id: "hero-title", text: "Understand your benefits letter or bill before its deadline passes." }),
          h("p", { class: "hero-lead", text: "Benefit letters often give you only 10, 30 or 60 days to act. This site works out your dates, checks the figures, explains what you can ask for, and gives you a ready-to-send kit." }),
          h("ol", { class: "hero-steps" },
            h("li", {}, h("b", { text: "Find your dates" }), h("span", { text: "Worked out from the date on your letter, with weekends and holidays counted." })),
            h("li", {}, h("b", { text: "See your options" }), h("span", { text: "What you can ask for, which form it uses, and which request may fit you." })),
            h("li", {}, h("b", { text: "Leave with a kit" }), h("span", { text: "A filled-in draft, a checklist of what to include, and dates for your calendar." }))),
          h("p", { class: "hero-trust", text: "Free and independent. No sign-up, no Social Security number, no answers saved." }),
          h("form", { class: "hero-find", role: "search", on: { submit: function (ev) {
              ev.preventDefault();
              var q = document.getElementById("hero-q").value, box = document.getElementById("finder");
              box.value = q; box.dispatchEvent(new Event("input"));
              document.getElementById("help-with").scrollIntoView({ block: "start" }); box.focus({ preventScroll: true });
            } } },
            h("label", { for: "hero-q", text: "Know what your letter is about? Search the helpers" }),
            h("div", { class: "hero-find-row" },
              h("input", { id: "hero-q", type: "search", autocomplete: "off", placeholder: "Overpayment, pay stubs, EBT card…" }),
              h("button", { class: "go", type: "submit", text: "Search" })))),
        heroLetter(),
        h("div", { class: "hero-down" },
          h("button", { class: "down", type: "button", on: { click: toHelp } },
            h("span", { class: "down-circle", "aria-hidden": "true" }),
            h("span", { text: "See what it can help with" })))),
      h("section", { class: "help", "aria-labelledby": "help-with" },
        h("h2", { id: "help-with", tabindex: "-1", text: "What do you need help with?" }),
        h("p", { class: "help-lead", text: "Search with a word from your letter, or pick the card that matches your situation. Where a letter gives you a set time to act, the time is marked on its card." }),
        finder(),
        h("div", { class: "bands" },
          band("ssa", "I have a letter from Social Security", [
              way("It says I was paid too much", "An overpayment notice asking for money back.", go("overpayment"), "30 and 60 days", null, "overpayment overpaid owe repay money back waiver reconsideration"),
              way("It says my disability has ended", "After a medical review of your condition. Part of this one has a short window.", go("disability-ended"), "15 and 60 days", null, "cessation cdr medical review ssdi stopped"),
              way("It says my claim was denied, or I disagree with a decision", "See your appeal date and which step of appeal comes next.", go("decision-appeal"), "60 days", null, "denial denied appeal reconsideration hearing ssi ssdi"),
              way("They're taking too much from my check", "Ask for a lower overpayment repayment rate: a budget, the amounts that matter and a letter.", go("withholding"), null, null, "withholding withheld ssa-634 lower rate repayment budget 50%"),
              way("I don't understand how they got the amount", "Check the month-by-month figures on an overpayment notice and see what to ask.", go("check-amount"), null, null, "figures total months amount math"),
              way("Another Social Security letter", "A review form, an award letter, an SSI notice and more. Find yours and see what to do.", go("find-letter"), null, null, "award cola review ssi notice letter other")
            ], [
              way("Is my overpayment notice complete?", "Check it against what Social Security's rules say every notice must tell you, and ask for an explanation.", go("notice-check"), null, null, "overpayment notice missing explanation pom"),
              way("My disability case is taking too long", "See if Social Security may handle it first, and get a request and a note for your member of Congress.", go("disability-wait"), null, null, "wait backlog slow dire need critical congress hearing delay"),
              way("I can't reach anyone at Social Security", "When to call, what to have ready, what to say, and a log of each try.", go("ssa-call"), null, null, "phone call hold wait 800 callback appointment"),
              way("I'm locked out of my Social Security account", "Login.gov or ID.me: other ways to prove who you are, and what you can do without the account.", go("locked-out"), null, null, "login.gov id.me my social security account password verify identity locked"),
              way("Is a year missing from my earnings record?", "Compare a W-2 with the earnings on your Social Security statement and prepare a correction request.", go("earnings-record"), null, null, "earnings record statement w-2 w2 missing year wages ssa-7008 correction"),
              way("I missed my appeal deadline", "The 60 days have passed. Ask Social Security to accept a late appeal, with a statement of good cause.", go("late-appeal"), null, null, "late appeal missed deadline good cause 60 days extension"),
              way("My payment didn't arrive", "When your Social Security or SSI payment was due, and the day you can report it missing.", go("payment-missing"), null, null, "missing payment check deposit late not received schedule wednesday direct express"),
              way("Part of my benefit is taken for a debt", "Student loans, taxes, child support and other debts: what can be taken, and the federal limit.", go("benefit-offset"), null, null, "garnish garnishment offset treasury student loan debt taken levy bank frozen"),
              way("My Medicare premium is higher because of my income", "See your 2026 income tier and whether form SSA-44 could lower it after retirement or another life change.", go("medicare-irmaa"), null, null, "irmaa income related premium ssa-44 magi high income part b part d surcharge medicare"),
              way("My benefit amount changed", "Compare the old and new amounts: the cost-of-living increase, the Medicare premium, or something taken out.", go("amount-changed"), null, null, "amount changed lower less more cola increase payment different went down"),
              way("My SSI went down because of help I get", "Help with rent or utilities can lower SSI. See your share and what may stop the reduction.", go("ssi-help"), null, null, "ssi ism in-kind support maintenance one-third reduction rent living with family pmv vtr"),
              way("My benefits stopped after I went back to work", "Ask to restart disability benefits within 5 years, without a new application.", go("work-restart"), null, null, "expedited reinstatement exr restart ssdi ssi stopped work earnings sga ssa-371"),
              way("Someone who got benefits died", "Which payments to send back, the $255 payment, survivors benefits and who to tell.", go("after-death"), null, null, "death died passed away spouse widow funeral lump sum 255 survivor return payment"),
              way("Check how my retirement benefit was worked out", "For a retirement benefit that started in 2026: enter your earnings and see each step of the calculation beside your award letter.", go("benefit-math"), null, null, "retirement benefit calculation math check award letter pia aime earnings record amount wrong how much worked out"),
              way("Social Security sent me a disability review form", "The short or long review form: what to send, what to keep, and what happens if it is not returned.", go("disability-review"), null, null, "cdr continuing disability review ssa-455 ssa-454 update report medical review form"),
              way("I have a public pension. Did my Social Security change?", "The 2025 law that ended two reductions for teachers, public workers and their spouses: what to check.", go("fairness-act"), null, null, "fairness act wep gpo windfall elimination government pension offset teacher police firefighter retroactive back pay")
            ]),
          h("div", { class: "band band-med", "data-band": "med" },
            h("p", { class: "group", text: "I have a letter about Medicare" }),
            h("div", { class: "med-row" },
              h("ul", { class: "ways" },
                way("A Medicare notice, bill or denial", "A claims summary, a premium bill, a plan's refusal to cover care, or care that is ending.", go("medicare-letter"), null, null, "msn summary notice premium irmaa hospital discharge"),
                way("Does my doctor's bill match my Medicare notice?", "Compare the bill with your Medicare Summary Notice and get the question to ask the billing office.", go("medicare-bill"), null, null, "doctor bill billing qmb balance"),
                way("Could a program pay my Medicare costs?", "Compare your income and savings with the limits for Medicare Savings Programs and Extra Help.", go("medicare-costs"), null, null, "qmb slmb qi extra help part b premium savings program"),
                way("My Medicare plan refused care or a drug", "Advantage or drug plan: the date to appeal, a fast appeal, a letter and a statement for your doctor.", go("plan-appeal"), "65 days", null, "advantage part d drug prescription denied prior authorization appeal"),
                way("I missed signing up for Medicare Part B", "The late penalty for the years you went without, the special sign-up periods, and your next chance.", go("partb-late"), null, null, "part b late enrollment penalty general enrollment special enrollment period cms-40b cms-l564 employer coverage 65")),
              h("div", { class: "med-quick" },
                h("p", { text: "Or go straight to a common one:" }),
                h("ul", {}, MEDICARE_QUICK.map(function (q) {
                  return h("li", {}, h("button", { type: "button", class: "quick", on: { click: go("letter/" + q[0]) }, text: q[1] }));
                }))))),
          band("state", "SNAP, Medicaid, housing and other programs", [
              way("Check my renewal before I send it", "Medicaid or SNAP: dates, what is missing, each page, and a cover sheet.", go("renewal"), null, null, "renewal recertification review form documents proof pay stubs"),
              way("They asked again for proof I already sent", "Match what the new notice asks for with what you sent, person by person and date by date, and get the question to ask.", go("asked-again"), null, null, "proof pay stubs documents again already sent verification receipt upload"),
              way("My SNAP or Medicaid was denied, cut or stopped", "The date to ask for a hearing, the earlier date to keep benefits while you wait, and a request.", go("benefit-hearing"), "30 to 90 days", null, "denied cut stopped hearing appeal fair hearing reduced"),
              way("I lost Medicaid or SNAP over paperwork", "The window to send the papers and get your case looked at again without starting over.", go("paperwork"), "30 or 90 days", null, "lost closed procedural reconsideration paperwork terminated"),
              way("My Medicaid is ending. What about each of us?", "A line for each person: KidCare for children, HealthCare.gov dates for adults, and the gap to watch in Florida.", go("medicaid-ending"), null, null, "medicaid ending kidcare chip marketplace healthcare.gov children coverage"),
              way("Keep SNAP or Medicaid under the 80-hour rules", "See which ways out may apply, which months count, and get a proof packet.", go("work-rules"), "80 hours a month", null, "work requirement abawd 80 hours exemption")
            ], [
              way("I missed my SNAP interview", "See the date to reschedule by and the words to use on the call.", go("missed-interview"), "30 days", null, "interview missed reschedule"),
              way("Get ready for my hearing", "Put what the agency says beside your evidence and one question, in a one-page outline.", go("hearing-prep"), null, null, "hearing evidence case file outline witness prepare"),
              way("I won my hearing, but nothing changed", "The date it should have happened by, and a letter asking for the decision to be carried out.", go("hearing-decision"), null, null, "hearing decision won compliance not carried out restore"),
              way("My SNAP benefits were stolen", "Stop more theft today, lock the card, and a statement for the police report.", go("stolen-snap"), null, null, "ebt card stolen skimming theft fraud lock"),
              way("Check how my housing rent was worked out", "Voucher or public housing: redo the rent formula, find missing deductions, or see why your rent changed.", go("rent-check"), null, null, "rent housing section 8 voucher hud public housing"),
              way("My electricity or gas may be shut off", "Florida: who to call today, what to ask, crisis help with the bill, and what to bring.", go("utility-shutoff"), null, null, "electric gas utility shutoff disconnect bill liheap"),
              way("FEMA is asking for proof that I lived there", "After a disaster: what the letter may be asking for, which papers can show you lived in the home, and your response date.", go("fema-proof"), null, null, "fema disaster hurricane flood occupancy proof residence home lived"),
              way("The state says I was paid too much SNAP", "The date to ask for a hearing, what can be taken each month, and words for your request.", go("snap-overpayment"), "90 days", null, "snap overpayment claim overissuance owe repay food stamps demand letter ebt recoup"),
              way("My housing voucher is being ended", "Section 8: the informal hearing, your right to see the file, and a request to hand in.", go("voucher-ending"), "Date on the notice", null, "voucher section 8 termination terminated informal hearing housing authority pha hcv"),
              way("Medicaid wants repayment from an estate", "After a death: who the state cannot collect from, and how to ask for a hardship waiver.", go("estate-recovery"), null, null, "medicaid estate recovery merp claim probate died nursing home heir hardship waiver"),
              way("I got a VA debt letter", "A benefit overpayment: the dates to dispute it, ask for a waiver or set up a plan.", go("va-debt"), "30 days", null, "va veterans debt management center overpayment waiver 5655 dispute compensation pension gi bill education"),
              way("Florida says I was overpaid unemployment", "Reemployment assistance: the appeal date and what Florida's law says about repaying.", go("ra-overpayment"), "20 days", null, "unemployment reemployment assistance overpayment florida floridacommerce deo appeal fraud repay")
            ]),
          band("none", "No letter, or not sure", [
              way("I work while getting benefits", "Check whether your pay could lead to an overpayment, before a letter comes.", go("work-check"), null, null, "work earnings job ssdi ssi income pay stubs paycheck"),
              way("I already sent something and I'm waiting", "Keep a record of what you sent, and get questions for your next call.", go("filed"), null, null, "record log sent waiting proof"),
              way("I'm not sure a letter, call or message is real", "Social Security, Medicare, SNAP, Medicaid or housing: check it against the agencies' own warning signs.", go("is-it-real"), null, null, "scam fraud text call real fake")
            ], [
              way("Am I under SSI's $2,000 limit?", "What may count on the 1st of each month, and what the rules let you leave out.", go("ssi-limit"), null, null, "ssi resources savings bank 2000 able account"),
              way("Something in my life changed", "See what to report to Social Security and by when, and get the words to report it.", go("report-change"), null, null, "report change move address married income"),
              way("Can someone talk to the agency for me?", "The form for each program, who signs it, and what a helper can do without one.", go("helper-permission"), null, null, "family helper representative authorize permission caregiver daughter son"),
              way("I help several people with their paperwork", "A deadline board with nicknames only. Saved as a file on your device, never on this site.", go("helper-board"), null, null, "caseworker volunteer board deadlines several people"),
              way("Practise a first WIC grocery trip", "Two short puzzles with a made-up balance, using Florida WIC's size rules.", go("wic-practice"), null, null, "wic grocery practice")
            ])),
        h("p", { class: "help-community community-link" }, "Want to hear from people in the same situation? ", h("a", { href: "#community", text: "Talk with others" })),
        h("div", { class: "resume" },
          h("label", { for: "progressfile" }, "Open work you saved earlier", h("span", { class: "hint", text: "A progress file or a record you saved from this site. It is opened on this device." })),
          h("input", { id: "progressfile", type: "file", accept: ".json,application/json", on: { change: function (ev) {
            var f = ev.target.files && ev.target.files[0], st = document.getElementById("progress-status");
            if (!f) return;
            var fr = new FileReader();
            fr.onload = function () { var d; try { d = JSON.parse(String(fr.result)); } catch (e) { d = null; }
              if (d && d.kind === "benefits-letter-helper-record") { window.__openRecord = d; location.hash = "filed"; return; }
              if (d && d.kind === "benefits-letter-helper-board") { window.__openBoard = d; location.hash = "helper-board"; return; }
              openProgress(f, st); };
            fr.readAsText(f);
          } } }),
          h("p", { id: "progress-status", class: "status", role: "status" })),
        h("p", { class: "small" }, "Your letter is not uploaded anywhere. ", h("a", { href: "/about", text: "About this tool, privacy and testing" }))));
    document.body.classList.add("landing");
  }

  /* Common Medicare letters, linked straight from the home page. Each id is a letter in the catalogue. */
  var MEDICARE_QUICK = [
    ["msn", "Medicare Summary Notice (a list of claims)"],
    ["irmaa", "Higher premium because of income"],
    ["ma-denial", "Medicare Advantage plan refused care"],
    ["partd-denial", "Drug plan refused a prescription"],
    ["nomnc", "Nursing, home health or hospice care is ending"],
    ["hospital-im", "Being discharged from hospital too soon"],
    ["premium-bill", "A bill for a Medicare premium"],
    ["part-d-lep", "Late enrollment penalty for drug coverage"]];

  /* The arrow: bring the cards into view and put keyboard focus on their heading. */
  /* A group of helpers: the most used first, the rest behind one button. */
  function band(id, title, shown, more) {
    var list = h("ul", { class: "ways", id: "ways-" + id }, shown, more.map(function (li) { li.classList.add("extra"); return li; }));
    var btn = more.length ? h("button", { class: "more", type: "button", "aria-expanded": "false", "aria-controls": "ways-" + id,
      text: "Show " + more.length + " more", on: { click: function (ev) {
        var box = ev.currentTarget.closest(".band"), open = !box.classList.contains("open");
        box.classList.toggle("open", open); ev.currentTarget.setAttribute("aria-expanded", String(open));
        ev.currentTarget.textContent = open ? "Show fewer" : "Show " + more.length + " more";
        if (open) { var first = box.querySelector(".extra .way"); if (first) first.focus(); }
      } } }) : null;
    return h("div", { class: "band band-" + id, "data-band": id }, h("p", { class: "group", text: title }), list, btn);
  }

  /* Search the helpers by the words on a letter. Runs on this device; nothing is sent. */
  function finder() {
    var status = h("p", { class: "finder-status", role: "status", "aria-live": "polite" });
    function run(q) {
      var words = q.toLowerCase().split(/[^a-z0-9$.%-]+/).filter(function (w) { return w.length > 1; });
      var root = document.querySelector(".help");
      root.classList.toggle("searching", words.length > 0);
      var n = 0;
      root.querySelectorAll(".ways li[data-keys]").forEach(function (li) {
        var keys = li.getAttribute("data-keys"), hit = words.length && words.every(function (w) { return keys.indexOf(w) >= 0; });
        li.classList.toggle("hit", !!hit); if (hit) n += 1;
      });
      root.querySelectorAll(".band").forEach(function (b) { b.classList.toggle("nohit", words.length > 0 && !b.querySelector("li.hit")); });
      status.textContent = !words.length ? "" : (n ? n + " helper" + (n === 1 ? "" : "s") + " match" + (n === 1 ? "es" : "") + "." :
        "No helper matches those words. Try one word from the letter's title, or open \"Another Social Security letter\" or \"A Medicare notice, bill or denial\".");
    }
    var input = h("input", { id: "finder", type: "search", autocomplete: "off", spellcheck: "false", placeholder: "For example: pay stubs, EBT card, hearing, overpayment",
      on: { input: function (ev) { run(ev.target.value); }, keydown: function (ev) { if (ev.key === "Escape") { ev.target.value = ""; run(""); } } } });
    return h("div", { class: "finder" },
      h("label", { for: "finder" }, "Search the helpers", h("span", { class: "hint", text: "Type a word or two from your letter. The search runs on this device." })),
      input, status);
  }

  function toHelp() {
    var target = document.getElementById("help-with");
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    target.focus({ preventScroll: true });
  }

  /* A made-up overpayment notice and the dates this site works out from it.
     The dates are the ones the deadline engine gives for a notice dated April 2, 2026. */
  function heroLetter() {
    var lines = function (widths) { return widths.map(function (w) { return h("span", { class: "ln", style: "width:" + w + "%" }); }); };
    return h("figure", { class: "hero-art" },
      h("div", { class: "paper", "aria-hidden": "true" },
        h("span", { class: "paper-tag", text: "Made-up example" }),
        h("b", { class: "paper-title", text: "Notice of overpayment" }),
        lines([62, 40]),
        h("p", { class: "paper-date" }, "Date: ", h("mark", { text: "April 2, 2026" })),
        lines([96, 70]),
        h("p", { class: "paper-amt", text: "You were paid $3,140 more than you should have been." }),
        lines([92, 84, 55])),
      h("div", { class: "found" },
        h("p", { class: "found-title", text: "What this site works out" }),
        h("p", { class: "found-for", text: "For the made-up notice dated April 2, 2026:" }),
        h("dl", {},
          h("div", {}, h("dt", { text: "May 2, 2026" }), h("dd", { text: "Ask by this date to hold off collection" })),
          h("div", {}, h("dt", { text: "June 1, 2026" }), h("dd", { text: "Appeal by this date" })),
          h("div", {}, h("dt", { text: "June 8, 2026" }), h("dd", { text: "Latest appeal date. Day 65 is a Saturday, so it moves to Monday." })))),
      h("figcaption", { class: "small", text: "Example: an overpayment notice dated April 2, 2026, and the dates worked out from it." }));
  }

  function otherLetter() {
    show(
      h("h1", { class: "long", text: "This site does not cover that letter yet" }),
      h("p", { class: "lead", text: "It has full helpers for three Social Security letters, and a shorter page for other common Social Security and Medicare letters. It also has a check for people who work while getting benefits, a builder for reporting a change, and a check for scam messages." }),
      h("h2", { text: "What applies to most Social Security letters" }),
      h("ul", {},
        h("li", { text: "Read the part of your letter about appealing today. Some rights last only a few days from the date on the letter." }),
        h("li", { text: "The general time limit for appealing a Social Security decision is 60 days from when you received the letter." }),
        h("li", {}, "Social Security: 1-800-772-1213 (TTY 1-800-325-0778). ", link("https://www.ssa.gov/locator/", "Find a local office")),
        h("li", {}, "Legal aid offices help with Social Security letters, usually at no cost if your income is low. ", link("https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help", "Find legal aid"))),
      row(quiet("Back", home)));
  }

  function route() {
    if (!state.meta || stale) return;                     // not loaded yet, or the program behind the page is out of date
    var where = location.hash.replace("#", "");
    if ((where === "community" || where.indexOf("community/") === 0) && window.Modules && window.Modules.community) window.Modules.community.start(where.split("/")[1]);
    else if (where === "overpayment") start();
    else if (where === "disability-ended" && window.Modules && window.Modules.cessation) window.Modules.cessation.start();
    else if (where === "work-check" && window.Modules && window.Modules.work) window.Modules.work.start();
    else if (where === "decision-appeal" && window.Modules && window.Modules.denial) window.Modules.denial.start();
    else if (where === "report-change" && window.Modules && window.Modules.report) window.Modules.report.start();
    else if (where === "is-it-real" && window.Modules && window.Modules.scam) window.Modules.scam.start();
    else if (where === "find-letter" && window.Modules && window.Modules.letters) window.Modules.letters.start("ssa");
    else if (where === "check-amount" && window.Modules && window.Modules.amount) window.Modules.amount.start();
    else if (where === "filed" && window.Modules && window.Modules.log) window.Modules.log.start();
    else if (where === "medicare-letter" && window.Modules && window.Modules.letters) window.Modules.letters.start("medicare");
    else if (where === "medicare-bill" && window.Modules && window.Modules.bill) window.Modules.bill.start();
    else if (where === "work-rules" && window.Modules && window.Modules.workrules) window.Modules.workrules.start();
    else if (where === "missed-interview" && window.Modules && window.Modules.workrules) window.Modules.workrules.interview();
    else if (where === "renewal" && window.Modules && window.Modules.renewal) window.Modules.renewal.start();
    else if (where === "rent-check" && window.Modules && window.Modules.rent) window.Modules.rent.start();
    else if (where === "benefit-hearing" && window.Modules && window.Modules.hearing) window.Modules.hearing.start();
    else if (where === "utility-shutoff" && window.Modules && window.Modules.utility) window.Modules.utility.start();
    else if (where === "notice-check" && window.Modules && window.Modules.noticeCheck) window.Modules.noticeCheck.start();
    else if (where === "ssi-limit" && window.Modules && window.Modules.ssiLimit) window.Modules.ssiLimit.start();
    else if (where === "plan-appeal" && window.Modules && window.Modules.planAppeal) window.Modules.planAppeal.start();
    else if (where === "disability-wait" && window.Modules && window.Modules.disWait) window.Modules.disWait.start();
    else if (NEXT[where] && window.Modules && window.Modules.nextSteps) window.Modules.nextSteps[NEXT[where]]();
    else if (where === "asked-again" && window.Modules && window.Modules.askedAgain) window.Modules.askedAgain.start();
    else if (FIXES[where] && window.Modules && window.Modules.fixes) window.Modules.fixes[FIXES[where]].start();
    else if (SSAMORE[where] && window.Modules && window.Modules.ssamore) window.Modules.ssamore[SSAMORE[where]].start();
    else if (SSALIFE[where] && window.Modules && window.Modules.ssalife) window.Modules.ssalife[SSALIFE[where]].start();
    else if (MOREHELP[where] && window.Modules && window.Modules.morehelp) window.Modules.morehelp[MOREHELP[where]].start();
    else if (where === "benefit-math" && window.Modules && window.Modules.benefitmath) window.Modules.benefitmath.start();
    else if (where === "wic-practice" && window.Modules && window.Modules.wic) window.Modules.wic.start();
    else if (where === "helper-board" && window.Modules && window.Modules.board) window.Modules.board.start();
    else if (where === "ssi-wages" && window.Modules && window.Modules.worksheets) window.Modules.worksheets.start("wages");
    else if (where === "ssi-medicaid" && window.Modules && window.Modules.worksheets) window.Modules.worksheets.start("medicaid");
    else if (where === "earnings-record" && window.Modules && window.Modules.worksheets) window.Modules.worksheets.start("earnings");
    else if (where === "fema-proof" && window.Modules && window.Modules.worksheets) window.Modules.worksheets.start("fema");
    else if (where.indexOf("letter/") === 0 && window.Modules && window.Modules.letters) window.Modules.letters.startAt(where.slice(7));
    else home();
  }
  window.addEventListener("hashchange", route);
  var NEXT = { "helper-permission": "permission", "hearing-prep": "hearingPrep", "hearing-decision": "decision", "medicaid-ending": "medicaidEnd" };
  var FIXES = { "medicare-costs": "costs", "stolen-snap": "stolen", "locked-out": "locked", "ssa-call": "calls", "withholding": "withhold", "paperwork": "paperwork" };
  var SSAMORE = { "late-appeal": "late", "payment-missing": "payday", "benefit-offset": "offset", "medicare-irmaa": "irmaa" };
  // Which community board goes with each helper ("Talk with others about this").
  var BOARD_FOR = {
    "overpayment": "overpayment", "check-amount": "overpayment", "notice-check": "overpayment", "withholding": "overpayment",
    "decision-appeal": "appeals", "late-appeal": "appeals", "disability-ended": "disability", "disability-wait": "disability", "work-restart": "disability", "work-check": "disability",
    "payment-missing": "payments", "amount-changed": "payments", "benefit-offset": "payments", "earnings-record": "payments",
    "ssi-limit": "ssi", "ssi-help": "ssi", "report-change": "ssi", "ssa-call": "reaching-ssa", "locked-out": "reaching-ssa", "find-letter": "reaching-ssa", "is-it-real": "reaching-ssa",
    "medicare-letter": "medicare", "medicare-bill": "medicare", "medicare-costs": "medicare", "plan-appeal": "medicare", "medicare-irmaa": "medicare",
    "missed-interview": "snap", "stolen-snap": "snap", "work-rules": "snap", "renewal": "medicaid", "medicaid-ending": "medicaid", "paperwork": "medicaid", "asked-again": "medicaid",
    "rent-check": "housing", "utility-shutoff": "housing", "benefit-hearing": "hearings", "hearing-prep": "hearings", "hearing-decision": "hearings",
    "after-death": "after-death", "helper-permission": "helping", "helper-board": "helping", "fema-proof": "disaster",
    "snap-overpayment": "snap", "voucher-ending": "housing", "estate-recovery": "after-death", "disability-review": "disability", "partb-late": "medicare", "fairness-act": "payments", "benefit-math": "payments"
  };
  var SSALIFE = { "after-death": "died", "work-restart": "restart", "ssi-help": "ssihelp", "amount-changed": "changed" };
  var MOREHELP = { "snap-overpayment": "snap", "va-debt": "va", "disability-review": "review", "ra-overpayment": "ra", "voucher-ending": "voucher", "estate-recovery": "estate",
    "partb-late": "partb", "fairness-act": "fairness" };

  function start() {
    count("overpayment", "start");
    reset(); updateDatebar();
    show(
      h("h1", {}, "Two dates on your overpayment notice decide what you can still do."),
      h("p", { class: "lead", text: "Ask within 30 days and Social Security holds off collecting. Appeal within 60. Find your dates, see which request may fit, and leave with a kit you can file today." }),
      timeline(null),
      h("ul", { class: "ways" },
        way("Upload or paste my notice", "A PDF, a photo or the text. It is opened on your device, and identity numbers are blacked out.", noticeScreen),
        way("Type in the details myself", "You only need the date printed on the notice to begin.", function () { factsForm(); }),
        way("Try a made-up notice first", "See how it works. Nothing about you is needed.", sampleList)),
      row(quiet("How did they get this amount?", function () { location.hash = "check-amount"; }), quiet("I have a different letter", home)));
  }

  function sampleList() {
    api("/api/samples").then(function (res) {
      show(
        h("h1", { text: "Pick a made-up notice" }),
        h("p", { class: "lead", text: "Four situations. The people, amounts and dates are invented." }),
        h("ul", { class: "ways" }, res.data.map(function (s) { return way(s.title, s.story, function () { useSample(s); }); })),
        row(quiet("Back", start)));
    }).catch(failed);
  }

  function useSample(s) {
    trying();
    state.sample = s;
    state.facts = Object.assign({}, s.facts);
    state.answers = Object.assign({}, s.answers);
    state.statements = Object.assign({}, s.statements);
    factsForm();
  }

  // ---------- upload or paste, read on the device ----------

  var FILE_PROBLEMS = {
    too_big: "That file is larger than 20 MB, which is too large to be a notice. Choose a smaller file, or type the details.",
    too_long: "That PDF has more than 30 pages. Save just the pages of the notice, or type the details.",
    locked: "That PDF is protected by a password, so it cannot be opened here. Open it yourself and copy the text, or type the details.",
    not_pdf: "That file could not be opened as a PDF. It may be damaged. Paste the text or type the details instead.",
    no_reader: "The PDF reader could not start in this browser. Paste the text or type the details instead.",
    bad_picture: "That picture could not be shown in this browser. Some phone photos (HEIC) need converting to JPEG first. You can also type the details.",
    bad_text: "That file could not be read. Paste the text instead.",
    unknown_kind: "That kind of file cannot be opened here. Choose a PDF, a photo or a text file."
  };

  function showPicture(nodes, note) {
    state.picture = { nodes: nodes, note: note };
    state.read = {}; state.otherDates = []; state.photoLines = {};
    factsForm();
  }

  function noticeScreen() {
    var box = h("textarea", { id: "pasted", class: "paste", spellcheck: "false" });
    var status = h("p", { class: "status", role: "status" });
    var out = h("div", {});
    var wrongLetter = false;
    function problem(code) { status.textContent = ""; fill(out, [h("p", { class: "err", role: "alert", text: FILE_PROBLEMS[code] || FILE_PROBLEMS.unknown_kind })]); }

    function readIt(pages) {
      if (!box.value.trim()) { fill(out, [h("p", { class: "err", role: "alert", text: "Choose a file, or paste or type the words from your notice first." })]); box.focus(); return; }
      var red = window.NoticeReader.redact(box.value);
      var found = window.NoticeReader.extract(box.value);
      box.value = red.text;   // the original, with its numbers, is gone from the page
      state.picture = null;
      state.read = {}; state.photoLines = {};
      state.otherDates = found.other_dates || [];
      delete found.other_dates;
      Object.keys(found).forEach(function (k) { state.facts[k] = found[k]; state.read[k] = "Read from your text. Check it."; });
      wrongLetter = window.NoticeReader.kind(red.text) === "cessation";
      status.textContent = pages ? "Read " + pages + (pages === 1 ? " page" : " pages") + " on this device. Nothing was uploaded." : "";
      results(red, found);
    }

    function results(red, found) {
      var names = { notice_date: "Notice date", overpaid_amount: "Amount", period: "Months covered", benefit_type: "Benefit type" };
      var list = Object.keys(found).map(function (k) {
        var v = k === "notice_date" ? niceDate(found[k]) : (k === "overpaid_amount" ? money(found[k]) : String(found[k]));
        return h("div", {}, h("dt", { text: names[k] }), h("dd", { text: v }));
      });
      var ai = state.meta.ai_reader || {};
      var missing = !found.notice_date || found.overpaid_amount === undefined;
      fill(out, [
        h("h2", { text: red.count ? red.count + (red.count === 1 ? " number was" : " numbers were") + " blacked out" : "No identity numbers were found" }),
        h("p", { text: red.count ? "The box above now shows your text with those numbers covered. Check that none is still visible; if one is, delete it." : "If your text has a Social Security or claim number in it, delete it from the box above." }),
        list.length ? [h("p", { text: "This is what was read. You will check each one on the next screen." }), h("dl", { class: "facts" }, list)]
          : h("p", { text: "No date or amount could be read from that text. You can type them on the next screen." }),
        h("p", { class: "small", text: "Your notice stays on this device. Only the details you confirm next are sent to work out your dates." }),
        wrongLetter ? h("div", { class: "alert", role: "alert" }, "This reads like a letter saying your disability has ended, not an overpayment notice. That letter has a 15-day window. ",
          h("a", { href: "#disability-ended", text: "Use the disability-ended helper instead" })) : null,
        ai.available && missing ? aiOffer(ai) : null,
        row(go("Check these details", function () { factsForm(); }))]);
      out.querySelector("h2").scrollIntoView({ block: "start" });
    }

    /* Optional and off unless the site's operator has set up an AI service.
       Nothing is sent until the person presses the button. */
    function aiOffer(ai) {
      var note = h("p", { class: "status", role: "status" });
      var btn = quiet("Send the blacked-out text to the AI reader", function () {
        btn.disabled = true; note.textContent = "Asking the AI reader…";
        api("/api/read", { text: box.value }).then(function (res) {
          if (!res.ok) { note.textContent = res.data.error || "The AI reader could not help. Type the details on the next screen."; btn.disabled = false; return; }
          var got = res.data.found || {}, n = 0;
          Object.keys(got).forEach(function (k) { if (state.facts[k] === undefined || state.facts[k] === "") { state.facts[k] = got[k]; state.read[k] = "Read by the AI reader. Check it."; n += 1; } });
          note.textContent = n ? "The AI reader filled in " + n + (n === 1 ? " detail" : " details") + ". Check each one on the next screen." : "The AI reader found nothing more. Type the details on the next screen.";
        }).catch(function () { note.textContent = "The AI reader could not be reached. Type the details on the next screen."; btn.disabled = false; });
      });
      return h("div", { class: "opt" },
        h("h3", { text: "Some details could not be read" }),
        h("p", { text: "You can type them yourself on the next screen. Or you can ask an AI service to try: the text in the box above, with numbers blacked out, would be sent to " + ai.provider + ". Nothing is sent unless you press the button." }),
        btn, note);
    }

    function openFile(file) {
      if (!file) return;
      var name = (file.name || "").toLowerCase(), type = file.type || "";
      fill(out, []);
      if (type === "text/plain" || /\.txt$/.test(name)) {
        if (file.size > 200000) { problem("too_big"); return; }
        var fr = new FileReader();
        fr.onload = function () { box.value = String(fr.result); readIt(); };
        fr.onerror = function () { problem("bad_text"); };
        fr.readAsText(file);
      } else if (type === "application/pdf" || /\.pdf$/.test(name)) {
        status.textContent = "Reading your PDF on this device…";
        window.PdfText.open(file).then(function (res) {
          if (res.kind === "text") { box.value = res.text; readIt(res.pages); }
          else showPicture(res.pictures, "This PDF is a picture of the notice.");
        }).catch(function (e) { problem(e && e.code); });
      } else if (/^image\//.test(type) || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/.test(name)) {
        if (file.size > window.PdfText.MAX_BYTES) { problem("too_big"); return; }
        var url = URL.createObjectURL(file);
        var img = h("img", { alt: "Your notice" });
        img.onload = function () { showPicture([img], "This is your photo."); };
        img.onerror = function () { URL.revokeObjectURL(url); problem("bad_picture"); };
        img.src = url;
      } else problem("unknown_kind");
    }

    show(
      progress(0),
      h("h1", { class: "long", text: "Upload or paste your notice" }),
      h("p", { class: "lead", text: "It is opened on this device and is not uploaded. Numbers that look like a Social Security or claim number are blacked out before anything is read." }),
      h("label", { for: "noticefile" }, "Choose a PDF, a photo or a text file", h("span", { class: "hint", text: "A PDF with words in it is read for you. A photo or scan is shown beside the form for you to copy from." })),
      h("input", { id: "noticefile", type: "file", accept: ".pdf,.txt,application/pdf,text/plain,image/*", on: { change: function (ev) { openFile(ev.target.files && ev.target.files[0]); } } }),
      status,
      h("label", { for: "pasted" }, "Or paste the words here", h("span", { class: "hint", text: "Copy them from an email or a PDF, or type the first page." })),
      box,
      row(go("Black out numbers and read it", function () { readIt(); }), quiet("Back", start)),
      out);
  }

  // ---------- enter and confirm the facts ----------

  function field(id, label, hint, control, problems, wasRead) {
    control.id = id;
    var bad = problems && problems[id];
    if (bad) control.setAttribute("aria-invalid", "true");
    return [
      h("label", { for: id }, label, wasRead ? h("span", { class: "read", text: wasRead === true ? "Read from your text. Check it." : wasRead }) : null,
        hint ? h("span", { class: "hint", text: hint }) : null),
      control,
      wasRead && state.photoLines && state.photoLines[id] ? photoLine(state.photoLines[id]) : null,
      bad ? h("p", { class: "err", role: "alert", text: problems[id] }) : null];
  }

  /* The line of the photo a detail was read from, with the part used marked. */
  function photoLine(hit) {
    var at = hit.line.toLowerCase().indexOf(hit.match.toLowerCase());
    return h("p", { class: "photo-line" }, "From the photo: ", at < 0 ? hit.line : [hit.line.slice(0, at), h("mark", { text: hit.line.slice(at, at + hit.match.length) }), hit.line.slice(at + hit.match.length)]);
  }

  /* A photo or scanned page, shown from the device's own memory. It is never sent. */
  function viewer() {
    var pane = h("div", { class: "viewer-pane", tabindex: "0", role: "group", "aria-label": "Your notice, shown on this device" }, state.picture.nodes);
    var zoom = 1;
    function set(step) { zoom = Math.max(1, Math.min(4, zoom + step)); pane.setAttribute("data-zoom", String(zoom)); }
    var said = h("p", { class: "status", role: "status" });
    var nodes = state.picture.nodes;
    function turnIt() {
      var c = window.PhotoRead.turn(nodes[0]);
      state.picture.nodes = nodes = [c]; fill(pane, [c]); said.textContent = "Turned. Turn again until the words read across.";
    }
    function readIt() {
      said.textContent = "Reading the words on this device. This can take a minute…";
      nodes.reduce(function (p, n) {
        return p.then(function (all) { return window.PhotoRead.read(n).then(function (res) { return { text: all.text + res.text + "\n", lines: all.lines.concat(res.lines) }; }); });
      }, Promise.resolve({ text: "", lines: [] })).then(function (res) {
        var red = window.NoticeReader.redact(res.text), found = window.NoticeReader.extract(red.text);
        var lines = window.NoticeReader.redact(res.lines.join("\n")).text.split("\n");
        delete found.other_dates;
        state.read = {}; state.photoLines = {};
        Object.keys(found).forEach(function (k) {
          state.facts[k] = found[k]; state.read[k] = "Read from your photo. Check it against the line below.";
          var hit = window.PhotoRead.lineFor(lines, found[k]); if (hit) state.photoLines[k] = hit;
        });
        state.picture.note = Object.keys(found).length ? "Some details were read from your photo." : "No details could be read from this photo.";
        factsForm();
      }).catch(function () {
        said.textContent = "Photos cannot be read automatically on this copy of the tool. Type what you see into the boxes below.";
      });
    }
    var pictures = !!window.PhotoRead && nodes.length > 0 && nodes.every(function (n) { return n.tagName === "IMG" || n.tagName === "CANVAS"; });
    var canRead = pictures && !!(state.meta.photo_reader || window.Tesseract);
    return h("div", { class: "viewer" },
      h("p", {}, h("b", { text: state.picture.note }), " It is shown here from this device and is not uploaded. Type what you see into the boxes below" + (canRead ? ", or let this device read it" : "") + ". Leave out any Social Security or claim number."),
      pane,
      row(quiet("Make it bigger", function () { set(1); }), quiet("Make it smaller", function () { set(-1); }),
        pictures && nodes.length === 1 ? quiet("Turn the photo", turnIt) : null, canRead ? go("Read the words on this device", readIt) : null),
      said);
  }

  function factsForm(problems) {
    var f = state.facts, r = state.read;
    var now = new Date();
    var maxDate = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
    var names = { retirement: "Retirement", disability: "Disability", survivor: "Survivor", ssi: "SSI (Supplemental Security Income)", unknown: "I'm not sure" };
    var benefit = h("select", {}, state.meta.benefit_types.map(function (b) {
      return h("option", { value: b, text: names[b], selected: (f.benefit_type || "unknown") === b ? "selected" : null });
    }));
    var ids = ["notice_date", "arrived_date", "overpaid_amount", "period", "reason", "benefit_type", "stated_withholding"];
    var form = h("form", { novalidate: "novalidate", on: { submit: function (ev) {
      ev.preventDefault();
      ids.forEach(function (id) { state.facts[id] = document.getElementById(id).value; });
      loadDates();
    } } },
      field("notice_date", "Date printed on the notice",
        r.notice_date && state.otherDates && state.otherDates.length
          ? "Your text has more than one date. Make sure this is the one printed at the top of the notice, not a deadline."
          : "Usually at the top of the first page.",
        h("input", { type: "date", value: f.notice_date || "", max: maxDate, required: "required" }), problems, r.notice_date),
      field("arrived_date", "If it came late: the day the notice arrived", "Optional. Only if it arrived more than 5 days after the date printed on it. Keep the envelope.",
        h("input", { type: "date", value: f.arrived_date || "", max: maxDate }), problems),
      field("overpaid_amount", "Amount Social Security says was overpaid", "Leave blank if you cannot find it.",
        h("input", { type: "text", inputmode: "decimal", value: f.overpaid_amount || "", autocomplete: "off" }), problems, r.overpaid_amount),
      field("period", "Months the notice covers", "For example: January 2026 to June 2026.",
        h("input", { type: "text", value: f.period || "", autocomplete: "off" }), problems, r.period),
      field("reason", "Reason the notice gives", "Copy the sentence that explains why.",
        h("input", { type: "text", value: f.reason || "", autocomplete: "off" }), problems),
      field("benefit_type", "Type of benefit", null, benefit, problems, r.benefit_type),
      field("stated_withholding", "What the notice says will be taken or must be repaid", "For example: $400 from each monthly payment.",
        h("input", { type: "text", value: f.stated_withholding || "", autocomplete: "off" }), problems),
      row(go("These details are right", null, "submit"), quiet("Back", start)));
    show(
      progress(0),
      h("h1", { text: state.sample ? "Check what the notice says" : (state.picture ? "Copy the details from your notice" : "What does your notice say?") }),
      h("p", { class: "lead", text: "Nothing is worked out until you confirm these details. Leave out any Social Security or claim number." }),
      state.sample ? h("div", { class: "letter", text: state.sample.notice_text }) : null,
      state.picture ? viewer() : null,
      problems ? h("div", { class: "alert", role: "alert", text: "Some details need fixing before your dates can be worked out." }) : null,
      form);
    if (problems) { var first = document.querySelector("[aria-invalid=true]"); if (first) first.focus(); }
  }

  function evaluate() {
    return api("/api/evaluate", { facts: state.facts, answers: state.answers, statements: state.statements, budget: state.budget });
  }

  function loadDates() {
    evaluate().then(function (res) {
      if (!res.ok) { factsForm(res.data.problems || {}); return; }
      state.result = res.data; updateDatebar(); datesScreen();
    }).catch(failed);
  }

  // ---------- dates ----------

  function calendarFile() {
    var d = state.result.deadlines;
    var stamp = d.today.replace(/-/g, "") + "T000000Z";
    function event(item, title) {
      var day = item.date.replace(/-/g, "");
      var next = new Date(Date.parse(item.date + "T00:00:00Z") + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
      return ["BEGIN:VEVENT", "UID:" + item.id + "-" + day + "@dear-deadline", "DTSTAMP:" + stamp,
        "DTSTART;VALUE=DATE:" + day, "DTEND;VALUE=DATE:" + next, "SUMMARY:" + title,
        "DESCRIPTION:Counted from the notice dated " + niceDate(d.notice_date).replace(",", "\\,") + ". Made by an independent tool\\, not by Social Security.",
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + title, "TRIGGER:-P7D", "END:VALARM",
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + title, "TRIGGER:-P1D", "END:VALARM", "END:VEVENT"].join("\r\n");
    }
    var body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dear Deadline//EN",
      event(d.items[0], "Last day to ask Social Security to hold off collection"),
      event(d.items[1], "Appeal the overpayment notice by today to be safe (early date)"),
      event(d.items[2], "Latest day to appeal the overpayment notice\\, if it took 5 days to arrive"), "END:VCALENDAR"].join("\r\n");
    download("overpayment-notice-dates.ics", "text/calendar", body);
  }

  function datesScreen() {
    count("overpayment", "dates", isLate(state.result));
    var d = state.result.deadlines, w = state.result.withholding;
    var day = 30 - d.items[0].days_left;
    show(
      progress(1),
      h("h1", {}, "Your dates"),
      h("p", { class: "lead", text: "Counted from the notice date of " + niceDate(d.notice_date) + ". If you stop here, write these down." }),
      timeline(day),
      h("ul", { class: "dates" }, d.items.map(function (i, n) {
        return h("li", { class: n >= 2 ? "aside" : null },
          h("div", {},
            h("p", { class: "when" }, h("span", { class: n < 2 && i.status !== "passed" ? "hl" : null, text: niceDate(i.date) })),
            h("p", { class: "left " + i.status, text: daysText(i) })),
          h("div", {},
            h("h3", { text: i.label }),
            h("p", { class: "small" }, i.rule + " " + i.note + " ", link(i.source, "Source"))));
      })),
      d.advice.map(function (a) { return h("p", { text: a }); }),
      row(quiet("Add these dates to my calendar", calendarFile)),
      h("h2", { text: "How much can be taken each month" }),
      w.stated_on_notice ? h("p", { text: "Your notice says: " + w.stated_on_notice + "." }) : null,
      h("p", {}, h("b", { text: w.action || "Follow the amount on your notice." })),
      w.sources_disagree ? h("p", { class: "small", text: "Why we do not quote a rate: Social Security's own pages give different defaults." }) : null,
      h("ul", { class: "small" }, w.notes.map(function (n) { return h("li", {}, n.text + " ", link(n.source, "Source")); })),
      row(go("Answer a few questions", function () { state.q = 0; question(); }), quiet("Change notice details", function () { factsForm(); })));
  }

  // ---------- questions ----------

  function question() {
    var qs = state.meta.questions;
    if (state.q >= qs.length) { ownWords(); return; }
    var q = qs[state.q], current = state.answers[q.id];
    function answer(value, text) {
      return h("button", { class: "answer", type: "button", "data-answer": value, "aria-pressed": current === value ? "true" : "false",
        on: { click: function () { state.answers[q.id] = value; state.q += 1; question(); } }, text: text });
    }
    show(
      progress(2, "question " + (state.q + 1) + " of " + qs.length),
      h("h1", { class: "long", text: q.text }),
      q.hint ? h("p", { class: "lead", text: q.hint }) : null,
      h("div", { class: "answers" }, answer("yes", "Yes"), answer("no", "No"), answer("unknown", "I don't know")),
      row(quiet("Back", function () { if (state.q === 0) datesScreen(); else { state.q -= 1; question(); } })));
  }

  function ownWords() {
    var a = state.answers;
    var asks = [["what_happened", "What happened, in your own words?", "A few sentences is enough. This goes into your draft exactly as you write it."]];
    if (a.amount_wrong === "yes") asks.push(["why_wrong", "Why do you think the amount is wrong?", null]);
    var money_matters = a.cannot_afford === "yes" || a.unfair_other === "yes" || a.rate_too_high === "yes";
    if (money_matters) asks.push(["hardship", "Why would paying it back, or paying this fast, be hard or unfair?", "For example what your income has to cover each month."]);
    var form = h("form", { on: { submit: function (ev) {
      ev.preventDefault();
      asks.forEach(function (x) { state.statements[x[0]] = document.getElementById(x[0]).value; });
      if (a.cannot_afford === "yes" || a.rate_too_high === "yes") budgetScreen(); else finish();
    } } },
      asks.map(function (x) { return field(x[0], x[1], x[2], h("textarea", { maxlength: "2000" }, state.statements[x[0]] || "")); }),
      row(go("Continue", null, "submit"), quiet("Back", function () { state.q = state.meta.questions.length - 1; question(); })));
    show(progress(2, "your own words"),
      h("h1", { class: "long", text: "Add your own words, if you want to" }),
      h("p", { class: "lead", text: "Every box is optional. Leave out any Social Security number." }),
      form);
  }

  function budgetScreen(problems) {
    var fields = state.meta.budget_fields;
    if (!fields || !fields.length) { finish(); return; }   // no worksheet available: go straight to the options
    var sum = h("div", { class: "sum", "aria-live": "polite" });
    function num(id) { var v = parseFloat(String(document.getElementById("budget_" + id).value).replace(/[$,]/g, "")); return isNaN(v) ? 0 : v; }
    function tally() {
      var income = num("income"), out = 0;
      fields.slice(1).forEach(function (f) { out += num(f.id); });
      var left = income - out;
      sum.replaceChildren(h("span", { text: left < 0 ? "Short each month" : "Left each month" }), h("span", { text: money(Math.abs(left)) }));
    }
    var form = h("form", { novalidate: "novalidate", on: { input: tally, submit: function (ev) {
      ev.preventDefault();
      fields.forEach(function (f) { state.budget[f.id] = document.getElementById("budget_" + f.id).value; });
      finish(budgetScreen);
    } } },
      fields.map(function (f, i) {
        var id = "budget_" + f.id, bad = problems && problems[id];
        return [h("div", { class: "money" + (i === 0 ? " first" : "") },
          h("label", { for: id, text: f.label }),
          h("input", { id: id, type: "text", inputmode: "decimal", autocomplete: "off", placeholder: "0", value: state.budget[f.id] || "", "aria-invalid": bad ? "true" : null })),
          bad ? h("p", { class: "err", role: "alert", text: f.label + ": " + problems[id] }) : null];
      }),
      sum,
      row(go("Use these figures", null, "submit"), quiet("Skip this", function () { state.budget = {}; finish(); })));
    show(progress(2, "monthly budget"),
      h("h1", { class: "long", text: "What comes in and goes out each month?" }),
      h("p", { class: "lead", text: "Rough figures are fine. The total goes into your draft, and the waiver and lower-rate forms ask for the same numbers." }),
      form);
    tally();
  }

  function finish(retry) {
    evaluate().then(function (res) {
      if (!res.ok) { if (retry && res.data.problems) retry(res.data.problems); else failed(); return; }
      state.result = res.data; updateDatebar(); options();
    }).catch(failed);
  }

  // ---------- options ----------

  var FLAG = { may_fit: "May fit", need_more_info: "Need more information", not_indicated: "Your answers do not point here" };

  function options() {
    var ev = state.result.evaluation;
    var title = ev.headline === "cannot_determine" ? "We can't tell which request fits"
      : (ev.fits.length > 1 ? "More than one request may fit" : "One request may fit");
    var ordered = ev.options.slice().sort(function (a, b) { return (a.status === "may_fit" ? 0 : 1) - (b.status === "may_fit" ? 0 : 1); });
    show(
      progress(3),
      h("h1", { class: "long", text: title }),
      h("p", { class: "lead", text: ev.summary + " Social Security makes the decision; this shows what your answers point to, and why." }),
      ordered.map(function (o) {
        return h("div", { class: "opt" + (o.status === "may_fit" ? " fit" : "") },
          h("p", { class: "flag " + o.status, text: FLAG[o.status] }),
          h("h3", {}, o.name, h("span", { class: "form", text: "Form " + o.form })),
          h("p", { text: o.reason }),
          h("p", { class: "small" }, "Use it when: " + o.when + " Time limit: " + o.time_limit + " ", link(o.source, "Source")));
      }),
      h("p", { class: "small", text: state.result.math_check.text }),
      row(go("Get my kit", kit), quiet("Change my answers", function () { state.q = 0; question(); })));
  }

  // ---------- kit ----------

  function kitText(k) {
    var out = [k.title.toUpperCase(), "", k.act_today.summary, "", "YOUR DATES"];
    k.act_today.dates.forEach(function (d) { out.push("- " + d.label + ": " + niceDate(d.date) + " (" + daysText(d) + ")"); });
    k.act_today.advice.forEach(function (a) { out.push(a); });
    k.requests.forEach(function (r) {
      out.push("", r.name.toUpperCase() + " (Form " + r.form + ", " + r.official_name + ")", r.why, "Official form: " + r.form_url);
      if (r.online_url) out.push("Online: " + r.online_url);
      out.push("Time limit: " + r.time_limit);
      if (r.draft.length) { out.push("", "Draft to copy onto the form:"); r.draft.forEach(function (l) { out.push("  " + l); }); }
      out.push("", "Documents to gather:"); r.documents.forEach(function (d) { out.push("- " + d); });
    });
    if (k.ask_for_record.show) { out.push("", "ASK FOR THE PAYMENT RECORD", k.ask_for_record.script); k.ask_for_record.steps.forEach(function (s, i) { out.push((i + 1) + ". " + s); }); }
    out.push("", "HOW TO FILE"); k.how_to_file.forEach(function (s, i) { out.push((i + 1) + ". " + s); });
    out.push("", "FACTS TO REVIEW"); k.facts_to_review.forEach(function (f) { out.push("- " + f.label + ": " + f.value); });
    out.push("", "GET HELP", k.get_help.text + " " + k.get_help.legal_aid_finder, "Social Security: " + k.get_help.phone + " (TTY " + k.get_help.tty + ")", "", k.disclaimer);
    return out.join("\r\n");
  }

  function kit() {
    count("overpayment", "kit");
    var k = state.result.kit;
    var said = h("p", { class: "status", role: "status" });
    function copyDraft(lines) {
      return h("button", { class: "copy", type: "button", text: "Copy this draft", on: { click: function (ev) {
        var btn = ev.currentTarget, text = lines.join("\n\n");
        var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy this draft"; }, 2500); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { btn.textContent = "Select the text and copy it by hand"; });
        else btn.textContent = "Select the text and copy it by hand";
      } } });
    }
    show(
      h("h1", { text: k.title }),
      h("p", { class: "lead", text: k.act_today.summary }),
      row(go("Print or save as PDF", function () { window.print(); }),
        quiet("Download as text", function () { download("overpayment-notice-kit.txt", "text/plain", kitText(k)); }),
        quiet("Add dates to my calendar", calendarFile),
        sentButton("appeal", "Overpayment notice dated " + niceDate(state.facts.notice_date)),
        timelineButton("Overpayment notice", state.facts.notice_date, k.act_today.dates)),
      h("h2", { text: "Your dates" }),
      h("ul", {}, k.act_today.dates.map(function (d, n) { return h("li", {}, d.label + ": ", h("b", { class: d.status === "passed" || n > 1 ? null : "hl", text: niceDate(d.date) }), " (" + daysText(d).toLowerCase() + ")"); })),
      k.act_today.advice.map(function (a) { return h("p", { text: a }); }),
      k.requests.map(function (r) {
        return [
          h("h2", {}, r.name + ", Form " + r.form),
          h("p", { text: r.why }),
          h("p", {}, "Official form (" + r.official_name + "): ", link(r.form_url), r.online_url ? [". Online: ", link(r.online_url)] : null),
          h("p", { class: "small", text: "Time limit: " + r.time_limit + (r.phone_note ? " " + r.phone_note : "") }),
          r.draft.length ? [h("h3", { text: "Draft to copy onto the form" }), h("div", { class: "draft" }, r.draft.map(function (l) { return h("p", { text: l }); })), copyDraft(r.draft)] : null,
          h("h3", { text: "Documents to gather" }),
          h("ul", {}, r.documents.map(function (doc) { return h("li", { text: doc }); }))];
      }),
      k.budget ? [
        h("h2", { text: "Your monthly budget" }),
        h("dl", { class: "facts" },
          h("div", {}, h("dt", { text: "Income" }), h("dd", { text: money(k.budget.income) })),
          k.budget.lines.map(function (l) { return h("div", {}, h("dt", { text: l.label }), h("dd", { text: money(l.amount) })); }),
          h("div", {}, h("dt", { text: k.budget.left < 0 ? "Short each month" : "Left each month" }), h("dd", {}, h("b", { text: money(Math.abs(k.budget.left)) }))))] : null,
      k.ask_for_record.show ? [
        h("h2", { text: "Ask Social Security for the payment record" }),
        h("p", { text: k.ask_for_record.why }),
        h("div", { class: "draft" }, h("p", { text: k.ask_for_record.script })),
        h("ol", {}, k.ask_for_record.steps.map(function (s) { return h("li", { text: s }); }))] : null,
      h("h2", { text: "How to file" }),
      h("ol", {}, k.how_to_file.map(function (s) { return h("li", { text: s }); })),
      h("h2", { text: "Facts to review before you file" }),
      h("dl", { class: "facts" }, k.facts_to_review.map(function (f) { return h("div", {}, h("dt", { text: f.label }), h("dd", { text: f.value })); })),
      h("h2", { text: "Get help" }),
      h("p", {}, k.get_help.text + " ", link(k.get_help.legal_aid_finder, "Find free legal aid")),
      h("p", {}, "Social Security: " + k.get_help.phone + " (TTY " + k.get_help.tty + "). ", link(k.get_help.office_locator, "Find a local office")),
      h("p", { class: "small", text: k.disclaimer + " Rules checked as of " + state.result.rules_as_of + "." }),
      row(go("I know what to do next", function () { said.textContent = "Good. Print or download this page before you close it; it is not saved anywhere."; }),
        quiet("Start over", start)),
      said);
  }

  // ---------- boot ----------

  api("/api/meta").then(function (res) {
    state.meta = res.data;
    document.getElementById("rules-date").textContent = res.data.rules_as_of;
    if (res.data.version !== NEEDS_VERSION) {
      stale = true;                                       // from here on, changing the address must not open a helper
      show(h("h1", { class: "long", text: "The helper needs restarting" }),
        h("div", { class: "alert", role: "alert", text: "This page was updated, but the program behind it is still the older one, so some steps would fail." }),
        h("p", { text: "If you run it on your own computer: press Ctrl+C in the Terminal window, start it again with python backend/app.py, then reload this page." }),
        h("p", { class: "small", text: "Page expects version " + NEEDS_VERSION + "; the program reports " + (res.data.version || "an older version") + "." }));
      return;
    }
    route();
  }).catch(failed);

  /* Shared building blocks for the other letter modules. */
  /* Shared form pieces for the newer helpers. */
  function choice(name, legend, options, value, problems, hint) {
    var bad = problems && problems[name];
    return h("fieldset", { class: "ticks choice", id: name, "aria-invalid": bad ? "true" : null, tabindex: bad ? "-1" : null },
      h("legend", { text: legend }), hint ? h("p", { class: "hint", text: hint }) : null,
      options.map(function (o) {
        var id = name + "_" + o[0];
        return h("label", { class: "tick", for: id }, h("input", { type: "radio", name: name, id: id, value: o[0], checked: value === o[0] ? "checked" : null }), h("span", { text: o[1] }));
      }),
      bad ? h("p", { class: "err", role: "alert", text: problems[name] }) : null);
  }
  function picked(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; }
  function ticks(name, legend, options, chosen, problems, hint) {
    var bad = problems && problems[name];
    return h("fieldset", { class: "ticks", id: name, "aria-invalid": bad ? "true" : null, tabindex: bad ? "-1" : null },
      h("legend", { text: legend }), hint ? h("p", { class: "hint", text: hint }) : null,
      options.map(function (o) {
        var id = name + "_" + o[0];
        return h("label", { class: "tick", for: id }, h("input", { type: "checkbox", id: id, value: o[0], checked: (chosen || []).indexOf(o[0]) >= 0 ? "checked" : null }), h("span", { text: o[1] }));
      }),
      bad ? h("p", { class: "err", role: "alert", text: problems[name] }) : null);
  }
  function ticked(name) { return Array.prototype.map.call(document.querySelectorAll('#' + name + ' input[type=checkbox]:checked'), function (el) { return el.value; }); }
  function draftBox(title, text, file) {
    return h("div", { class: "draft" }, h("h3", { text: title }), h("pre", { class: "draft-text", text: text }),
      h("button", { class: "copy", type: "button", text: "Copy this text", on: { click: function (ev) {
        var btn = ev.currentTarget;
        try { navigator.clipboard.writeText(text).then(function () { btn.textContent = "Copied"; }); } catch (e) { btn.textContent = "Select the text and copy it"; }
      } } }), " ",
      file ? h("button", { class: "copy", type: "button", text: "Download it", on: { click: function () { download(file, "text/plain", text); } } }) : null);
  }
  function sources(list) {
    return h("ul", { class: "small sources" }, list.map(function (r) { return h("li", {}, r.plain + " ", link(r.source, "Source")); }));
  }
  function firstProblem() { var bad = document.querySelector("[aria-invalid=true]"); if (bad) bad.focus(); }

  window.UI = {
    trying: trying, sentButton: sentButton, timelineButton: timelineButton, saveProgress: saveProgress, takeResume: takeResume, choice: choice, picked: picked, ticks: ticks, ticked: ticked, draftBox: draftBox, sources: sources, firstProblem: firstProblem, money: money,
    h: h, fill: fill, show: show, api: api, niceDate: niceDate, daysText: daysText, link: link, go: go, quiet: quiet, row: row,
    progress: progress, failed: failed, download: download, timeline: timeline, field: field, way: way, count: count, isLate: isLate, otherLetter: otherLetter, setDatebar: setDatebar,
    home: home, meta: function () { return state.meta; }
  };
})();
