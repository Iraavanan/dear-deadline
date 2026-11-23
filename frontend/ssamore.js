/* Four more Social Security helpers: a missed appeal deadline, a missing payment, part of a
   check taken for a debt, and a higher Medicare premium because of income. Nothing is saved. */
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI || !window.Modules || !window.Modules.fixes) return;
  var U = window.UI, h = U.h, K = window.Modules.fixes.kit;
  var flow = K.flow, tail = K.tail, plain = K.plain, input = K.input, val = K.val, steps = K.steps, money = K.money;
  function table(rows) { return h("table", { class: "plain" }, rows.filter(Boolean).map(function (x) { return h("tr", {}, h("th", { scope: "row", text: x[0] }), h("td", { class: "num", text: x[1] })); })); }

  var REASONS = [["illness", "I was seriously ill"], ["family", "A death or serious illness in my family"], ["records", "My records were destroyed or damaged"],
    ["searching", "I was trying to find information I needed"], ["explained", "I asked Social Security to explain the decision first"],
    ["wrong_info", "Social Security told me the wrong thing about how or when to appeal"], ["no_notice", "I never got the letter"],
    ["other_agency", "I sent it on time to another agency"], ["limits", "A physical, mental, reading or language limitation"], ["unusual", "Something else outside my control"]];

  var late = flow({
    module: "late-appeal", api: "/api/late-appeal", button: "Check my deadline",
    title: "I missed my appeal deadline",
    lead: "You usually have 60 days to appeal a Social Security or SSI decision. If that time has passed, you can still ask. Social Security can accept a late appeal when there was a good reason (\"good cause\").",
    draw: function (s, p) {
      return [U.choice("program", "Which benefit is the decision about?", [["ss", "Social Security (retirement, survivor or disability)"], ["ssi", "SSI"]], s.program, p),
        U.field("letter_date", "Date printed on the decision letter", null, input("date", s.letter_date), p),
        U.field("arrived", "Day the letter reached you, if it came late", "Optional. Leave blank if it came within about 5 days.", input("date", s.arrived), p),
        U.ticks("reasons", "What kept you from appealing on time?", REASONS, s.reasons, p, "Tick any that apply. Leave all blank if you are not late yet."),
        U.field("story", "In your own words, with dates", "Optional. It goes into your statement, for example: \"I was in the hospital from March 3 to April 20.\"", h("textarea", { rows: "4", maxlength: "1500", text: s.story || "" }), p)];
    },
    read: function () { return { program: U.picked("program"), letter_date: val("letter_date"), arrived: val("arrived"), reasons: U.ticked("reasons"), story: val("story") }; },
    example: function () { var d = new Date(Date.now() - 110 * 864e5).toISOString().slice(0, 10); return { program: "ss", letter_date: d, reasons: ["illness"], story: "I was in the hospital for most of the time after the letter came." }; },
    show: function (r, s, back) {
      U.count("late-appeal", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        table([["Usual last day to appeal", r.deadline_long], r.moved ? ["Why it moved", "The 65th day fell on " + r.moved + "."] : null, r.late ? ["Days past it", String(r.days_late)] : null]),
        h("h2", { text: "What you can do" }), steps(r.steps),
        r.late ? U.draftBox("Statement of good cause", r.statement, "good-cause-statement.txt") : null,
        h("p", {}, U.link("https://www.ssa.gov/apply/appeal-decision-we-made", "How to appeal, at ssa.gov"), " · ", h("a", { href: "#decision-appeal", text: "Plan the appeal itself" })),
        tail(r, "late-appeal.txt", function (r) { return plain(r, [["WHAT YOU CAN DO", r.steps], ["STATEMENT", r.late ? r.statement : ""]]); },
          [U.sentButton("other", "Late appeal with a statement of good cause", "mail"), U.quiet("Change my answers", back)]));
    }
  });

  var payday = flow({
    module: "payment-missing", api: "/api/payment-missing", button: "Check the dates",
    title: "My payment didn't arrive",
    lead: "Payments come on set days. Social Security asks you to wait three mail delivery days after the due date before reporting one missing. See when yours was due and when you can report it.",
    draw: function (s, p) {
      return [U.choice("kind", "Which payment are you waiting for?", [["ss", "Social Security (retirement, survivor or disability)"], ["ssi", "SSI"], ["both", "I get both"]], s.kind, p),
        U.field("birth_day", "Day of the month you were born", "Only for Social Security. For example, 14 if you were born on June 14.", input("text", s.birth_day, { inputmode: "numeric", maxlength: "2" }), p),
        U.choice("before_1997", "Did you start getting Social Security before May 1997?", [["no", "No"], ["yes", "Yes"]], s.before_1997 || "no", p),
        U.field("month", "Month of the payment", null, input("month", s.month || new Date().toISOString().slice(0, 7)), p)];
    },
    read: function () { return { kind: U.picked("kind"), birth_day: val("birth_day"), before_1997: U.picked("before_1997"), month: val("month") }; },
    example: function () { return { kind: "ss", birth_day: "14", before_1997: "no", month: new Date().toISOString().slice(0, 7) }; },
    show: function (r, s, back) {
      U.count("payment-missing", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        h("table", { class: "plain" }, h("tr", {}, ["Payment", "Due", "Report it missing from"].map(function (x) { return h("th", { text: x }); })),
          r.payments.map(function (x) { return h("tr", {}, h("td", { text: x.name }), h("td", { text: x.due_long + (x.moved ? " (moved earlier for a weekend or holiday)" : "") }), h("td", { text: x.report_from_long })); })),
        h("h2", { text: "What you can do" }), steps(r.steps),
        tail(r, "payment-missing.txt", function (r) { return plain(r, [["DATES", r.payments.map(function (x) { return x.name + ": due " + x.due_long + ", report from " + x.report_from_long; })], ["WHAT YOU CAN DO", r.steps]]); },
          [U.quiet("Plan my call", function () { location.hash = "ssa-call"; }), U.quiet("Change my answers", back)]));
    }
  });

  var offset = flow({
    module: "benefit-offset", api: "/api/offset", button: "Check the limit",
    title: "Part of my benefit is being taken for a debt",
    lead: "Most creditors cannot take Social Security. Some debts can be collected from it, such as defaulted federal student loans, federal taxes and child support, and federal law limits how much. Compare what is taken with the limit.",
    draw: function (s, p) {
      return [U.choice("benefit", "Which benefit?", [["ss", "Social Security (retirement, survivor or disability)"], ["ssi", "SSI"]], s.benefit, p),
        U.choice("debt", "What is the debt for?", [["student_loan", "A federal student loan"], ["federal", "Another federal debt (not taxes)"], ["taxes", "Federal income taxes"], ["child_support", "Child support or alimony"], ["private", "A credit card, medical bill or other private debt"]], s.debt, p),
        U.field("monthly_benefit", "Your monthly benefit before anything is taken", "Before the Medicare premium and the amount taken.", input("money", s.monthly_benefit), p),
        U.field("taken", "How much is taken each month", "Optional.", input("money", s.taken), p)];
    },
    read: function () { return { benefit: U.picked("benefit"), debt: U.picked("debt"), monthly_benefit: val("monthly_benefit"), taken: val("taken") }; },
    example: function () { return { benefit: "ss", debt: "student_loan", monthly_benefit: "1180", taken: "177" }; },
    show: function (r, s, back) {
      U.count("benefit-offset", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        r.limit !== null ? table([["Monthly benefit", money(r.monthly_benefit)], ["Most that may be taken", money(r.limit)], r.taken !== null ? ["Taken now", money(r.taken)] : null,
          ["Left after the most that may be taken", money(r.monthly_benefit - r.limit)]]) : null,
        h("h2", { text: "What you can do" }), steps(r.steps),
        tail(r, "benefit-offset.txt", function (r) { return plain(r, [["LIMIT", r.limit !== null ? money(r.limit) + " a month" : ""], ["WHAT YOU CAN DO", r.steps]]); }, [U.quiet("Change my figures", back)]));
    }
  });

  var EVENTS = [["none", "None of these"], ["work_stopped", "I or my spouse stopped working"], ["work_reduced", "I or my spouse cut back on work"], ["death", "My spouse died"],
    ["divorce", "Divorce or annulment"], ["marriage", "Marriage"], ["pension", "A pension ended or was cut"], ["property", "Income-producing property was lost in a disaster"], ["settlement", "An employer settlement after closure or bankruptcy"]];

  var irmaa = flow({
    module: "medicare-irmaa", api: "/api/irmaa", button: "Check my premium",
    title: "My Medicare premium is higher because of my income",
    lead: "If your income two years ago was above a limit, you pay more for Medicare Part B and Part D (IRMAA). If your income has gone down since because of retirement or another life-changing event, you can ask for a new decision.",
    draw: function (s, p) {
      return [U.choice("filing", "How did you file your 2024 tax return?", [["single", "Single, head of household or surviving spouse"], ["joint", "Married filing jointly"], ["separate", "Married filing separately (lived with spouse)"]], s.filing, p),
        U.field("magi", "Modified adjusted gross income on that return", "Your adjusted gross income plus tax-exempt interest. The amount is on the letter about your premium.", input("money", s.magi), p),
        U.choice("event", "Has one of these happened since?", EVENTS, s.event || "none", p),
        U.field("new_income", "The income you expect this year", "Optional. Used to show what the premium could be after a new decision.", input("money", s.new_income), p)];
    },
    read: function () { return { filing: U.picked("filing"), magi: val("magi"), event: U.picked("event"), new_income: val("new_income") }; },
    example: function () { return { filing: "joint", magi: "290000", event: "work_stopped", new_income: "120000" }; },
    show: function (r, s, back) {
      U.count("medicare-irmaa", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        table([["Part B premium a month", money(r.part_b)], ["Part D extra a month", money(r.part_d_extra)], ["Extra over the standard premium", money(r.monthly_extra)],
          r.new_level !== undefined ? ["At your expected income", money(r.new_part_b) + " Part B, " + money(r.new_monthly_extra) + " extra in all"] : null]),
        h("h2", { text: "What you can do" }), steps(r.steps),
        h("p", {}, U.link("https://www.ssa.gov/forms/ssa-44.html", "Form SSA-44 at ssa.gov"), " · ", h("a", { href: "#medicare-costs", text: "Could a program pay my Medicare costs?" })),
        tail(r, "medicare-premium.txt", function (r) { return plain(r, [["PREMIUM", "Part B " + money(r.part_b) + " a month; extra " + money(r.monthly_extra)], ["WHAT YOU CAN DO", r.steps]]); },
          [U.sentButton("other", "Form SSA-44 (new Medicare premium decision)", "mail"), U.quiet("Change my figures", back)]));
    }
  });

  window.Modules.ssamore = { late: late, payday: payday, offset: offset, irmaa: irmaa };
})();
