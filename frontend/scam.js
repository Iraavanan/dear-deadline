/* "Is this message real?" A check against the warning signs the agencies and the FTC
   publish, for Social Security, Medicare, SNAP, Medicaid and housing help.
   Everything happens in the browser: the message is never sent. It never says a
   message is genuine. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var s;
  var PROGRAMS = [
    ["ssa", "Social Security"], ["medicare", "Medicare or a Medicare plan"], ["snap", "SNAP, food assistance or an EBT card"],
    ["medicaid", "Medicaid"], ["housing", "Section 8, a housing voucher or a housing waiting list"], ["other", "Another agency, or I'm not sure"]];
  var NAME = { ssa: "Social Security", medicare: "Medicare", snap: "SNAP", medicaid: "Medicaid", housing: "the housing authority", other: "the agency" };
  var REAL = {
    ssa: ["/", "A real letter from Social Security often starts a deadline. See the dates for your letter"],
    medicare: ["#medicare-letter", "A real Medicare notice may start a deadline. Find your Medicare letter"],
    snap: ["#renewal", "A real SNAP notice may have a due date. Check your renewal or request for proof"],
    medicaid: ["#renewal", "A real Medicaid renewal has a due date. Check it before you send it"],
    housing: ["#rent-check", "If it is about your rent, check how your rent was worked out"],
    other: ["/", "See what this site can help with"]
  };
  function meta() { return U.meta().scam; }
  function signsFor(p) { return meta().signs.filter(function (x) { return x.programs.indexOf(p) >= 0; }); }

  function start() {
    s = { program: "", text: "", ticks: {} };
    U.count("is-it-real", "start"); U.setDatebar(null);
    pick();
  }

  function pick(problems) {
    U.show(
      h("h1", { class: "long", text: "Not sure a letter, call or message is real?" }),
      h("p", { class: "lead", text: "Check it against the warning signs the agencies themselves publish. What you type stays on this device and is not sent anywhere." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault(); s.program = U.picked("program");
        if (!s.program) { pick({ program: "Choose who the message says it is from." }); return; }
        form();
      } } },
        U.choice("program", "Who does it say it is from?", PROGRAMS, s.program, problems),
        U.row(U.go("Continue", null, "submit"), U.quiet("Back", U.home))));
    U.firstProblem();
  }

  function form() {
    var box = h("textarea", { id: "message", class: "paste", spellcheck: "false" }, s.text);
    var list = signsFor(s.program);
    var ticks = list.map(function (sign) {
      return h("label", { class: "tick", for: "tick_" + sign.id }, h("input", { type: "checkbox", id: "tick_" + sign.id, checked: s.ticks[sign.id] ? "checked" : null }), h("span", { text: sign.ask }));
    });
    U.show(
      h("h1", { class: "long", text: s.program === "other" ? "Check the message" : "Check a message that says it is from " + NAME[s.program] }),
      h("p", { class: "small", text: "What you type stays on this device and is not sent anywhere." }),
      h("label", { for: "message" }, "Paste or type the words of the message", h("span", { class: "hint", text: "A letter, email or text. Leave this empty for a phone call or a website, and use the boxes below." })),
      box,
      h("fieldset", { class: "ticks" }, h("legend", { text: "Tick anything that happened" }), ticks),
      U.row(U.go("Check for warning signs", function () {
        s.text = box.value;
        list.forEach(function (sign) { s.ticks[sign.id] = document.getElementById("tick_" + sign.id).checked; });
        result();
      }), U.quiet("Back", function () { pick(); })));
  }

  function words(sign) {
    var own = s.program === "ssa" || !sign.other;
    return { plain: own ? sign.plain : sign.other.plain, source: own ? sign.source : sign.other.source };
  }

  function result() {
    U.count("is-it-real", "kit");
    var redacted = window.NoticeReader.redact(s.text).text, found = {}, order = [];
    window.ScamCheck.scan(redacted, s.program).forEach(function (f) { found[f.id] = { quote: f.quote }; });
    signsFor(s.program).forEach(function (sign) {
      if (found[sign.id] || s.ticks[sign.id]) order.push({ sign: sign, quote: found[sign.id] ? found[sign.id].quote : null, ticked: s.ticks[sign.id] });
    });
    var a = meta().advice, p = s.program, n = order.length, gave = s.text.trim() || Object.keys(s.ticks).some(function (k) { return s.ticks[k]; });
    var verify = p === "ssa" ? a.verify : a["verify_" + p], report = p === "ssa" ? a.report : a["report_" + p];
    var steps = [h("li", { text: a.what_to_do.plain })];
    if (p === "ssa") steps.push(h("li", {}, a.verify.plain + " Social Security: " + a.verify.phone + " (TTY " + a.verify.tty + "), or sign in at ", U.link(a.verify.account, "your my Social Security account"), "."));
    else steps.push(h("li", {}, verify.plain + " ", verify.url ? U.link(verify.url, "Find the contact") : null, verify.url ? "." : null));
    steps.push(h("li", {}, report.plain + " ", report.url ? U.link(report.url, p === "ssa" ? "Report it to the Inspector General" : (report.url === a.report.ftc ? "Report it to the Federal Trade Commission" : "Report it")) : null, ". ",
      report.url !== a.report.ftc ? [U.link(a.report.ftc, "Report it to the Federal Trade Commission"), " too."] : null));
    U.show(
      h("h1", { class: "long", text: n ? n + (n === 1 ? " warning sign found" : " warning signs found") : "No warning signs were found in what you gave" }),
      n ? h("div", { class: "alert", role: "alert", text: "Treat this as a scam unless " + NAME[p] + " confirms it when you contact them yourself. Do not pay, click or reply." })
        : h("p", { class: "lead", text: (gave ? "" : "You did not enter anything to check. ") + "This does not mean the message is real. A scam can avoid every sign listed here. Check it yourself in the way described below before you act on it." }),
      n ? [h("h2", { text: "What was found" }),
        h("ul", { class: "signs" }, order.map(function (o) {
          var w = words(o.sign);
          return h("li", {}, h("h3", { text: w.plain }),
            o.quote ? h("p", { class: "quote", text: o.quote }) : null,
            h("p", { class: "small" }, o.quote && o.ticked ? "Found in the text, and you ticked it. " : o.quote ? "Found in the text. " : "You ticked this. ", U.link(w.source, "Source")));
        }))] : null,
      n === 1 ? h("p", { class: "small", text: "One sign on its own can also appear in a real letter. It is still a reason to check before you do anything." }) : null,
      h("h2", { text: n ? "What to do now" : "How to check it yourself" }),
      h("ol", {}, steps),
      h("h2", { text: "If it turns out to be real" }),
      h("p", {}, h("a", { href: REAL[p][0], text: REAL[p][1] }), "."),
      h("p", { class: "small", text: "This check looks only for the warning signs that the agencies and the Federal Trade Commission publish. It cannot tell you that a message is real, and it is not from any government agency. Rules checked as of " + U.meta().rules_as_of + "." }),
      U.row(U.go("Print this page", function () { window.print(); }), U.quiet("Check another message", start)));
  }

  window.Modules = window.Modules || {};
  window.Modules.scam = { start: start };
})();
