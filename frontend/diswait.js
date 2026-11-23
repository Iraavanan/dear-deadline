/* My disability case is taking too long: Social Security's critical-case categories that may
   fit, a request to mark the case, and a note to a member of Congress's office. Nothing is saved. */
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI) return;
  var U = window.UI, h = U.h;
  var s;
  var STAGES = [["initial", "My first application"], ["recon", "Reconsideration (I asked them to look again)"], ["hearing", "Waiting for a hearing with a judge"]];
  var SITS = [["no_food", "I do not have enough money for food"], ["no_medicine", "I cannot pay for medicine or medical care I need"], ["no_utilities", "I have no heat, water or electricity, or a shutoff notice"],
    ["eviction", "I have an eviction or foreclosure notice"], ["homeless", "I have no regular place to sleep, or will lose my home within 14 days"],
    ["terminal", "A doctor says my illness is terminal"], ["va100", "The VA rated me 100% permanent and total (compensation, not pension)"],
    ["military", "I was injured or became ill on active military duty since October 1, 2001"], ["danger", "I may harm myself or someone else"]];

  function start() {
    s = { stage: "", situations: [], filed: "", ssi: "" };
    U.count("disability-wait", "start"); U.setDatebar(null);
    form();
  }

  function form(problems) {
    problems = problems || {};
    U.show(
      h("h1", { class: "long", text: "My disability case is taking too long" }),
      h("p", { class: "lead", text: "Social Security handles some cases first: when someone has no money for food, medicine or utilities, faces eviction, is homeless, or is very ill. Staff accept what you tell them. See which may fit, and get the request and a note for your member of Congress." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault();
        s.stage = U.picked("stage"); s.situations = U.ticked("situations"); s.filed = document.getElementById("filed").value; s.ssi = U.picked("ssi");
        send();
      } } },
        U.choice("stage", "Where is your case now?", STAGES, s.stage, problems),
        U.field("filed", "Date you applied or appealed", "Optional. It goes into your letters.", h("input", { type: "date", value: s.filed }), problems),
        U.ticks("situations", "Do any of these describe you now?", SITS, s.situations, problems, "Tick all that apply, or none."),
        U.choice("ssi", "Did you apply for SSI (Supplemental Security Income)?", [["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]], s.ssi, problems),
        U.row(U.go("See what I can ask for", null, "submit"), U.quiet("Try a made-up case", example), U.quiet("Back", U.home))));
    U.firstProblem();
  }

  function example() {
    U.trying();
    s = { stage: "hearing", situations: ["no_utilities", "eviction"], filed: "2025-06-02", ssi: "no" };
    send();
  }

  function send() {
    U.api("/api/disability-wait", { stage: s.stage, situations: s.situations, filed: s.filed, ssi: s.ssi === "yes" ? true : (s.ssi === "no" ? false : null) }).then(function (res) {
      if (!res.ok) { form(res.data.problems || {}); return; }
      U.count("disability-wait", "dates"); result(res.data);
    }).catch(U.failed);
  }

  function text(r) {
    var out = ["SLOW DISABILITY CASE", "", r.headline, ""];
    r.fits.forEach(function (f) { out.push("- " + f.name + ". " + f.bring); });
    out.push("", "WHAT YOU CAN DO"); r.steps.forEach(function (st, i) { out.push((i + 1) + ". " + st); });
    if (r.letter) out.push("", "REQUEST TO MARK THE CASE", r.letter);
    out.push("", "NOTE TO YOUR MEMBER OF CONGRESS", r.congress, "", "RULES");
    r.rules.forEach(function (x) { out.push("- " + x.plain + " " + x.source); });
    out.push("", r.disclaimer);
    return out.join("\r\n");
  }

  function result(r) {
    if (r.letter) U.count("disability-wait", "kit");
    U.show(
      h("h1", { class: "long", text: r.headline }),
      r.days_waiting !== null ? h("p", { class: "lead", text: "You have been waiting " + r.days_waiting + " days." }) : null,
      r.fits.length ? h("ul", { class: "gaps" }, r.fits.map(function (f) { return h("li", {}, h("b", { text: f.name + ". " }), f.bring); })) : null,
      h("h2", { text: "What you can do" }),
      h("ol", {}, r.steps.map(function (st) { return h("li", { text: st }); })),
      r.letter ? U.draftBox("Request to mark your case critical", r.letter, "critical-case-request.txt") : null,
      U.draftBox("Note to your U.S. representative's or senator's office", r.congress, "congress-casework.txt"),
      h("h2", { text: "Rules this is based on" }), U.sources(r.rules),
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("Print this", function () { window.print(); }), U.quiet("Download as text", function () { U.download("disability-wait.txt", "text/plain", text(r)); }),
        r.letter ? U.sentButton("other", "Request to mark my disability case critical", "mail") : null,
        U.quiet("Change my answers", function () { form(); })));
  }

  window.Modules = window.Modules || {};
  window.Modules.disWait = { start: start };
})();
