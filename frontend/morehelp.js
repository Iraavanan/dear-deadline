/* Eight helpers for letters from other programs and two Medicare and Social Security questions:
   a SNAP overpayment, a VA debt letter, a disability review form, a Florida unemployment
   overpayment, a voucher that is ending, Medicaid estate recovery, signing up late for
   Medicare Part B, and the Social Security Fairness Act. Nothing is saved. */
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI || !window.Modules || !window.Modules.fixes) return;
  var U = window.UI, h = U.h, K = window.Modules.fixes.kit;
  var flow = K.flow, tail = K.tail, plain = K.plain, input = K.input, val = K.val, steps = K.steps, money = K.money;
  var YN = [["no", "No"], ["yes", "Yes"]];
  var NAMES = { "disability-ended": "It says my disability has ended", "ssa-call": "I can't reach anyone at Social Security", "medicare-costs": "Could a program pay my Medicare costs?",
    "amount-changed": "My benefit amount changed" };

  function daysAgo(n) { return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }
  function daysAhead(n) { return new Date(Date.now() + n * 864e5).toISOString().slice(0, 10); }
  function left(d) { return d.passed ? "passed " + (-d.days_left) + " day" + (d.days_left === -1 ? "" : "s") + " ago" : d.days_left === 0 ? "today" : d.days_left + " day" + (d.days_left === 1 ? "" : "s") + " left"; }
  function dates(list) {
    if (!list || !list.length) return null;
    return h("table", { class: "plain" }, list.map(function (d) {
      return h("tr", {}, h("th", { scope: "row" }, d.label, d.note ? [h("br"), h("span", { class: "small", text: d.note })] : null),
        h("td", {}, h("b", { text: d.date_long }), h("br"), h("span", { class: "small", text: left(d) })));
    }));
  }
  function datesText(list) { return (list || []).map(function (d) { return d.label + ": " + d.date_long + " (" + left(d) + ")"; }); }
  function links(list) { return list && list.length ? h("p", {}, list.map(function (l, i) { return [i ? " · " : "", h("a", { href: "#" + l, text: NAMES[l] || l })]; })) : null; }

  var snap = flow({
    module: "snap-overpayment", api: "/api/snap-overpayment", button: "Show my dates",
    title: "The state says I was paid too much SNAP",
    lead: "A letter saying you got more SNAP than you should have is called a claim. You can ask how the amount was worked out, ask for a hearing, and ask to repay a little at a time. See the dates from the federal rules.",
    draw: function (s, p) {
      return [U.field("notice_date", "Date on the letter", null, input("date", s.notice_date), p),
        U.choice("kind", "What does the letter say caused it?", [["mistake", "A mistake by my household"], ["agency", "A mistake by the agency"], ["ipv", "An intentional program violation (fraud)"], ["unsure", "I'm not sure"]], s.kind, p),
        U.field("amount", "Amount the letter says you owe", "Optional.", input("money", s.amount), p),
        U.field("allotment", "Your monthly SNAP amount now", "Optional. Leave empty if you no longer get SNAP.", input("money", s.allotment), p)];
    },
    read: function () { return { notice_date: val("notice_date"), kind: U.picked("kind"), amount: val("amount"), allotment: val("allotment") }; },
    example: function () { return { notice_date: daysAgo(12), kind: "mistake", amount: "840", allotment: "298" }; },
    show: function (r, s, back) {
      U.count("snap-overpayment", "kit");
      U.show(h("h1", { class: "long", text: r.headline }), dates(r.dates),
        r.rate ? [h("h2", { text: "What can be taken from your SNAP each month" }), h("ul", {}, r.rate.map(function (x) {
          return h("li", { text: "For a " + x.claim + ": " + money(x.monthly) + " a month" + (x.months ? ", which would repay it in about " + x.months + " months" : "") + "." });
        }))] : null,
        h("h2", { text: "What you can do" }), steps(r.steps),
        U.draftBox("Words for your request", r.words, "snap-overpayment-request.txt"),
        h("p", {}, h("a", { href: "#benefit-hearing", text: "SNAP or Medicaid denied, cut or stopped" }), " · ", h("a", { href: "#hearing-prep", text: "Get ready for my hearing" })),
        tail(r, "snap-overpayment.txt", function (r) { return plain(r, [["DATES", datesText(r.dates)], ["WHAT YOU CAN DO", r.steps], ["WORDS FOR YOUR REQUEST", r.words]]); },
          [U.sentButton("appeal", "SNAP overpayment letter", "mail"), U.quiet("Change my answers", back)]));
    }
  });

  var va = flow({
    module: "va-debt", api: "/api/va-debt", button: "Show my dates",
    title: "I got a VA debt letter",
    lead: "A letter from the VA Debt Management Center says you were paid too much in disability compensation, pension or education benefits. What you can ask for depends on how soon you answer. See the three dates that matter.",
    draw: function (s, p) {
      return [U.field("letter_date", "Date you got the first debt letter", "If you are not sure, use the date printed on it.", input("date", s.letter_date), p),
        U.choice("kind", "Which benefit is the debt for?", [["comp", "Disability compensation or pension"], ["education", "Education benefits (such as the GI Bill)"]], s.kind, p),
        U.choice("view", "Which fits best?", [["wrong", "I think the debt or the amount is wrong"], ["cant_pay", "The debt may be right, but I can't afford to repay it"], ["can_pay_slowly", "I can repay it, but need smaller payments"], ["unsure", "I'm not sure"]], s.view, p),
        U.field("amount", "Amount of the debt", "Optional.", input("money", s.amount), p),
        U.choice("gets_benefits", "Do you get a monthly VA benefit payment now?", YN, s.gets_benefits || "no", p)];
    },
    read: function () { return { letter_date: val("letter_date"), kind: U.picked("kind"), view: U.picked("view"), amount: val("amount"), gets_benefits: U.picked("gets_benefits") }; },
    example: function () { return { letter_date: daysAgo(9), kind: "comp", view: "cant_pay", amount: "4200", gets_benefits: "yes" }; },
    show: function (r, s, back) {
      U.count("va-debt", "kit");
      U.show(h("h1", { class: "long", text: r.headline }), dates(r.dates),
        h("h2", { text: "What you can do" }), steps(r.steps),
        U.draftBox("Words for your letter", r.words, "va-debt-letter.txt"),
        h("p", {}, U.link("https://www.va.gov/manage-va-debt/", "Manage your VA debt at va.gov")),
        tail(r, "va-debt.txt", function (r) { return plain(r, [["DATES", datesText(r.dates)], ["WHAT YOU CAN DO", r.steps], ["WORDS FOR YOUR LETTER", r.words]]); },
          [U.sentButton("other", "Answer to VA debt letter", "mail"), U.quiet("Change my answers", back)]));
    }
  });

  var review = flow({
    module: "disability-review", api: "/api/disability-review", button: "Show me what to do",
    title: "Social Security sent me a disability review form",
    lead: "Social Security checks from time to time that people still have a disability. It sends a short form (SSA-455) or a long one (SSA-454). Benefits usually continue, but not sending the form back can stop them.",
    draw: function (s, p) {
      return [U.choice("form", "Which form did you get?", [["455", "SSA-455, Disability Update Report (short)"], ["454", "SSA-454, Continuing Disability Review Report (long)"], ["unsure", "I'm not sure"]], s.form, p),
        U.choice("program", "Which benefit do you get?", [["ss", "Social Security disability (SSDI)"], ["ssi", "SSI"], ["both", "Both"]], s.program, p),
        U.choice("status", "Where do things stand?", [["have_it", "I have the form and haven't sent it yet"], ["sent", "I sent it back"], ["missed", "I missed the date, or lost the form"], ["stopped", "My payments have stopped"]], s.status, p),
        U.field("due", "Date the letter says to return it by", "Optional. Only enter a date printed on your letter.", input("date", s.due), p),
        U.choice("payee", "Does someone else get your payments for you (a representative payee)?", YN, s.payee || "no", p)];
    },
    read: function () { return { form: U.picked("form"), program: U.picked("program"), status: U.picked("status"), due: val("due"), payee: U.picked("payee") }; },
    example: function () { return { form: "454", program: "ss", status: "have_it", due: daysAhead(12), payee: "no" }; },
    show: function (r, s, back) {
      U.count("disability-review", "kit");
      U.show(h("h1", { class: "long", text: r.headline }), dates(r.dates),
        h("h2", { text: "What you can do" }), steps(r.steps),
        h("h2", { text: "How often reviews happen" }), h("p", { text: r.often }),
        links(r.links),
        tail(r, "disability-review.txt", function (r) { return plain(r, [["DATES", datesText(r.dates)], ["WHAT YOU CAN DO", r.steps], ["HOW OFTEN", r.often]]); },
          [U.sentButton("other", "Disability review form", "mail"), U.quiet("Change my answers", back)]));
    }
  });

  var ra = flow({
    module: "ra-overpayment", api: "/api/ra-overpayment", button: "Show my appeal date",
    title: "Florida says I was overpaid unemployment",
    lead: "A determination from Florida's reemployment assistance program says you were paid benefits you should not have got. You have 20 days to appeal. See the date, and what Florida's law says about repaying.",
    draw: function (s, p) {
      return [U.field("mailed", "Mailing date on the determination", null, input("date", s.mailed), p),
        U.choice("fraud", "Does it say fraud?", [["no", "No"], ["yes", "Yes"], ["unsure", "I'm not sure"]], s.fraud, p),
        U.choice("cause", "Which fits best?", [["employer_late", "My employer answered late, and the decision changed"], ["agency", "The agency made a mistake"], ["mine", "I made a mistake when I claimed"], ["unsure", "I'm not sure"]], s.cause, p),
        U.field("amount", "Amount it says you were overpaid", "Optional.", input("money", s.amount), p)];
    },
    read: function () { return { mailed: val("mailed"), fraud: U.picked("fraud"), cause: U.picked("cause"), amount: val("amount") }; },
    example: function () { return { mailed: daysAgo(6), fraud: "no", cause: "employer_late", amount: "2750" }; },
    show: function (r, s, back) {
      U.count("ra-overpayment", "kit");
      U.show(h("h1", { class: "long", text: r.headline }), dates(r.dates),
        r.penalty ? h("p", {}, "If fraud is found, the 15% penalty on " + money(r.amount) + " would be ", h("b", { text: money(r.penalty) }), ".") : null,
        h("h2", { text: "What you can do" }), steps(r.steps),
        tail(r, "unemployment-overpayment.txt", function (r) { return plain(r, [["DATES", datesText(r.dates)], ["WHAT YOU CAN DO", r.steps]]); },
          [U.sentButton("appeal", "Reemployment assistance overpayment determination", "online"), U.quiet("Change my answers", back)]));
    }
  });

  var voucher = flow({
    module: "voucher-ending", api: "/api/voucher-ending", button: "Show my rights",
    title: "My housing voucher is being ended",
    lead: "A housing authority that wants to end your Housing Choice Voucher (Section 8) must tell you why in writing and offer an informal hearing first. The deadline to ask is on the notice, and it is often short.",
    draw: function (s, p) {
      return [U.field("notice_date", "Date on the notice", null, input("date", s.notice_date), p),
        U.field("deadline", "Deadline on the notice to ask for a hearing", "Optional. Only enter a date printed on your notice.", input("date", s.deadline), p),
        U.choice("reason", "What reason does the notice give?", [["income", "Income or household details not reported"], ["absence", "Being away from the home too long"], ["lease", "A lease violation or eviction"], ["criminal", "Criminal or drug-related activity"], ["obligations", "Not doing something the program requires"], ["other", "Something else"]], s.reason, p),
        U.choice("asked", "Have you already asked for the hearing?", YN, s.asked || "no", p),
        U.choice("disability", "Is a disability connected to what happened?", YN, s.disability || "no", p)];
    },
    read: function () { return { notice_date: val("notice_date"), deadline: val("deadline"), reason: U.picked("reason"), asked: U.picked("asked"), disability: U.picked("disability") }; },
    example: function () { return { notice_date: daysAgo(4), deadline: daysAhead(6), reason: "income", asked: "no", disability: "no" }; },
    show: function (r, s, back) {
      U.count("voucher-ending", "kit");
      U.show(h("h1", { class: "long", text: r.headline }), dates(r.dates),
        h("h2", { text: "What you can do" }), steps(r.steps),
        h("p", { class: "small", text: r.missing }),
        U.draftBox("Words for your hearing request", r.words, "voucher-hearing-request.txt"),
        h("p", {}, h("a", { href: "#rent-check", text: "Check how my housing rent was worked out" }), " · ", h("a", { href: "#hearing-prep", text: "Get ready for my hearing" })),
        tail(r, "voucher-ending.txt", function (r) { return plain(r, [["DATES", datesText(r.dates)], ["WHAT YOU CAN DO", r.steps], ["WORDS FOR YOUR REQUEST", r.words]]); },
          [U.sentButton("appeal", "Request for informal hearing on voucher termination", "office"), U.quiet("Change my answers", back)]));
    }
  });

  var estate = flow({
    module: "estate-recovery", api: "/api/estate-recovery", button: "Check the rules",
    title: "Medicaid wants repayment from an estate",
    lead: "After someone who got Medicaid dies, the state may ask the estate to repay some of what Medicaid spent. There are people it cannot collect from, and a hardship waiver. See which rules may apply.",
    draw: function (s, p) {
      return [U.choice("state", "Which state paid the Medicaid?", [["FL", "Florida"], ["other", "Another state"]], s.state || "FL", p),
        U.choice("age55", "Was the person 55 or older when Medicaid paid for the care?", [["yes", "Yes"], ["no", "No, younger"], ["unsure", "I'm not sure"]], s.age55, p),
        h("fieldset", { class: "ticks" }, h("legend", { text: "Is the person survived by" }),
          U.choice("spouse", "A husband or wife?", YN, s.spouse || "no", p),
          U.choice("child_under_21", "A child under 21?", YN, s.child_under_21 || "no", p),
          U.choice("disabled_child", "A child of any age who is blind or disabled?", YN, s.disabled_child || "no", p)),
        h("fieldset", { class: "ticks" }, h("legend", { text: "About the heirs and the home" }),
          U.choice("home", "Did the person own a home?", YN, s.home || "no", p),
          U.choice("heir_in_home", "Does an heir live in that home, for at least the last 12 months, and own no other home?", YN, s.heir_in_home || "no", p),
          U.choice("heir_needs", "Would paying leave an heir without food, clothing, shelter or medical care?", YN, s.heir_needs || "no", p),
          U.choice("caregiver", "Did a brother, sister, son or daughter live with the person for a year or more and give full-time care?", YN, s.caregiver || "no", p))];
    },
    read: function () {
      var o = { state: U.picked("state"), age55: U.picked("age55") };
      ["spouse", "child_under_21", "disabled_child", "home", "heir_in_home", "heir_needs", "caregiver"].forEach(function (k) { o[k] = U.picked(k); });
      return o;
    },
    example: function () { return { state: "FL", age55: "yes", spouse: "no", child_under_21: "no", disabled_child: "no", home: "yes", heir_in_home: "yes", heir_needs: "no", caregiver: "yes" }; },
    show: function (r, s, back) {
      U.count("estate-recovery", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        h("h2", { text: "What you can do" }), steps(r.steps),
        U.draftBox("Words for your letter", r.words, "estate-recovery-letter.txt"),
        h("p", {}, h("a", { href: "#after-death", text: "Someone who got benefits died" })),
        tail(r, "medicaid-estate-recovery.txt", function (r) { return plain(r, [["WHAT YOU CAN DO", r.steps], ["WORDS FOR YOUR LETTER", r.words]]); },
          [U.sentButton("other", "Answer to Medicaid estate recovery letter", "mail"), U.quiet("Change my answers", back)]));
    }
  });

  var partb = flow({
    module: "partb-late", api: "/api/partb-late", button: "Work it out",
    title: "I missed signing up for Medicare Part B",
    lead: "Signing up late for Part B can add a penalty to the premium for as long as you have it, unless a special enrollment period fits. See the penalty for the years you went without, and your next chance to sign up.",
    draw: function (s, p) {
      return [U.field("years", "Full years you could have had Part B but did not", "Count only complete 12-month periods. Do not count time covered by a health plan from your own or your spouse's current job.", input("text", s.years, { inputmode: "numeric", maxlength: "2" }), p),
        U.choice("why", "Does one of these fit?", [["employer", "I had health coverage from my own or my spouse's current job"], ["medicaid", "I had Medicaid and lost it"], ["misinformed", "A health plan or employer gave me wrong information"],
          ["disaster", "A declared disaster or emergency got in the way"], ["released", "I was released from incarceration"], ["none", "None of these"]], s.why, p),
        U.field("ended", "If it was a job: the month the job or its coverage ended, whichever came first", "Optional.", input("month", s.ended), p)];
    },
    read: function () { return { years: val("years"), why: U.picked("why"), ended: val("ended") }; },
    example: function () { return { years: "2", why: "none", ended: "" }; },
    show: function (r, s, back) {
      U.count("partb-late", "kit");
      var rows = [["Standard Part B premium, " + r.year, money(r.standard) + " a month"], ["Full years without Part B", String(r.years)], ["Penalty, if no special enrollment period applies", r.percent + "%, about " + money(r.extra) + " a month"],
        ["Premium with that penalty", "about " + money(r.total) + " a month"], ["General Enrollment Period", r.general.opens_long + " to " + r.general.closes_long]];
      if (r.special) rows.push(["Special Enrollment Period after the job", "to the end of " + r.special.last_long + (r.special.open ? "" : " (passed)")]);
      U.show(h("h1", { class: "long", text: r.headline }),
        h("table", { class: "plain" }, rows.map(function (x) { return h("tr", {}, h("th", { scope: "row", text: x[0] }), h("td", { class: "num", text: x[1] })); })),
        h("h2", { text: "What you can do" }), steps(r.steps),
        links(r.links),
        tail(r, "medicare-part-b-late.txt", function (r) { return plain(r, [["FIGURES", rows.map(function (x) { return x[0] + ": " + x[1]; })], ["WHAT YOU CAN DO", r.steps]]); },
          [U.quiet("Change my answers", back)]));
    }
  });

  var fairness = flow({
    module: "fairness-act", api: "/api/fairness-act", button: "Show me what to check",
    title: "I have a public pension. Did my Social Security change?",
    lead: "Until 2024, a pension from work that did not pay into Social Security could lower your own benefit or wipe out a spouse's or survivor's benefit. A 2025 law ended both reductions. See what should have happened and what to check.",
    draw: function (s, p) {
      return [U.choice("situation", "Which fits best?", [["reduced", "My Social Security was lowered or stopped because of my pension"], ["never_applied", "I never applied, because I was told I would get little or nothing"], ["unsure", "I'm not sure whether this applies to me"]], s.situation, p),
        U.choice("kind", "Which benefit is it?", [["own", "My own retirement or disability benefit"], ["spouse", "A benefit as a husband or wife"], ["survivor", "A benefit as a widow or widower"]], s.kind, p),
        U.choice("got_increase", "Has your monthly amount gone up since early 2025?", YN, s.got_increase || "no", p),
        U.choice("got_backpay", "Have you had a one-time back payment?", YN, s.got_backpay || "no", p)];
    },
    read: function () { return { situation: U.picked("situation"), kind: U.picked("kind"), got_increase: U.picked("got_increase"), got_backpay: U.picked("got_backpay") }; },
    example: function () { return { situation: "reduced", kind: "own", got_increase: "yes", got_backpay: "no" }; },
    show: function (r, s, back) {
      U.count("fairness-act", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        h("ul", {}, r.facts.map(function (f) { return h("li", { text: f }); })),
        h("h2", { text: "What you can do" }), steps(r.steps),
        links(r.links),
        tail(r, "social-security-fairness-act.txt", function (r) { return plain(r, [["THE LAW", r.facts], ["WHAT YOU CAN DO", r.steps]]); },
          [U.quiet("Change my answers", back)]));
    }
  });

  window.Modules.morehelp = { snap: snap, va: va, review: review, ra: ra, voucher: voucher, estate: estate, partb: partb, fairness: fairness };
})();
