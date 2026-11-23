/* Six smaller helpers for what people say goes wrong most often: Medicare costs, stolen SNAP,
   a locked account, not reaching Social Security, too much withheld, and coverage lost over
   paperwork. Each is a short form, then a result. Nothing is saved. */
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI) return;
  var U = window.UI, h = U.h;
  var YN = [["yes", "Yes"], ["no", "No"]];
  var STATES = [["FL", "Florida"], ["CA", "California"], ["NY", "New York"], ["PA", "Pennsylvania"], ["OH", "Ohio"], ["MI", "Michigan"], ["other", "Another state"]];

  function money(v) { return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function input(type, value, extra) { var a = { type: type, value: value || "" }; if (type === "money") { a.type = "text"; a.inputmode = "decimal"; } if (extra) Object.keys(extra).forEach(function (k) { a[k] = extra[k]; }); return h("input", a); }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function select(options, value) { return h("select", {}, options.map(function (o) { return h("option", { value: o[0], text: o[1], selected: o[0] === value ? "selected" : null }); })); }
  function steps(list) { return h("ol", {}, list.map(function (st) { return h("li", { text: st }); })); }
  function tail(r, file, textFn, more) {
    return [h("h2", { text: "Rules this is based on" }), U.sources(r.rules),
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row.apply(null, [U.go("Print this", function () { window.print(); }), U.quiet("Download as text", function () { U.download(file, "text/plain", textFn(r)); })].concat(more || []))];
  }
  function plain(r, parts) {
    var out = [r.headline.toUpperCase(), ""];
    parts.forEach(function (p) { if (!p[1]) return; out.push(p[0]); out.push(Array.isArray(p[1]) ? p[1].map(function (x, i) { return (i + 1) + ". " + x; }).join("\r\n") : p[1]); out.push(""); });
    r.rules.forEach(function (x) { out.push("- " + x.plain + " " + x.source); });
    out.push("", r.disclaimer);
    return out.join("\r\n");
  }

  /* A flow: draw(values, problems) builds the form; read() returns the request body; show(result). */
  function flow(cfg) {
    var s = {};
    function form(problems) {
      problems = problems || {};
      U.show(
        h("h1", { class: "long", text: cfg.title }),
        h("p", { class: "lead", text: cfg.lead }),
        h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); s = cfg.read(); send(); } } },
          cfg.draw(s, problems),
          U.row(U.go(cfg.button, null, "submit"), cfg.example ? U.quiet(cfg.exampleText || "Try made-up details", function () { U.trying(); s = cfg.example(); send(); }) : null, U.quiet("Back", U.home))));
      U.firstProblem();
    }
    function send() {
      U.api(cfg.api, s).then(function (res) {
        if (!res.ok) { form(res.data.problems || {}); return; }
        U.count(cfg.module, "dates"); cfg.show(res.data, s, function () { form(); });
      }).catch(U.failed);
    }
    return { start: function () { s = {}; U.count(cfg.module, "start"); U.setDatebar(null); form(); } };
  }

  var costs = flow({
    module: "medicare-costs", api: "/api/medicare-costs", button: "Compare with the limits",
    title: "Could a program pay my Medicare costs?",
    lead: "Medicare Savings Programs can pay your Part B premium, and sometimes much more. Extra Help lowers drug costs. Many people who qualify never apply. Compare your figures with the 2026 limits.",
    draw: function (s, p) {
      return [U.choice("household", "Who is this for?", [["single", "One person"], ["couple", "A married couple"]], s.household, p),
        U.field("monthly_income", "Monthly income before anything is taken out", "Include Social Security before the Medicare premium, pensions and pay.", input("money", s.monthly_income), p),
        U.field("resources", "Money in bank accounts, stocks and cash", "Not your home, one car or burial plots.", input("money", s.resources), p),
        U.choice("state", "Where do you live?", [["FL", "Florida"], ["other", "Another state"]], s.state || "FL", p)];
    },
    read: function () { return { household: U.picked("household"), monthly_income: val("monthly_income"), resources: val("resources"), state: U.picked("state") }; },
    example: function () { return { household: "single", monthly_income: "1450", resources: "3200", state: "FL" }; },
    show: function (r, s, back) {
      U.count("medicare-costs", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        h("table", { class: "plain" }, h("tr", {}, ["Program", "Monthly income limit", "Resource limit", "Your figures"].map(function (x) { return h("th", { text: x }); })),
          r.programs.map(function (x) { return h("tr", {}, h("td", {}, h("b", { text: x.name }), h("br"), h("span", { class: "small", text: x.what })), h("td", { text: money(x.income_limit) }), h("td", { text: money(x.resource_limit) }), h("td", { text: x.may_fit ? "May fit" : (!x.income_ok ? "Income above" : "Resources above") })); })),
        h("h2", { text: "What you can do" }), steps(r.steps),
        tail(r, "medicare-costs.txt", function (r) { return plain(r, [["PROGRAMS", r.programs.map(function (x) { return x.name + ": " + (x.may_fit ? "may fit" : "above a limit"); })], ["WHAT YOU CAN DO", r.steps]]); }, [U.quiet("Change my figures", back)]));
    }
  });

  var stolen = flow({
    module: "stolen-snap", api: "/api/stolen-snap", button: "Show me what to do",
    title: "My SNAP benefits were stolen",
    lead: "Thieves copy EBT cards with hidden card readers, then spend the benefits, often in another state. Stop more theft today, then report it.",
    draw: function (s, p) {
      return [U.choice("state", "Where do you get SNAP?", [["FL", "Florida"], ["other", "Another state"]], s.state || "FL", p),
        U.field("noticed", "Date you noticed", "Optional. It goes into your statement.", input("date", s.noticed), p),
        U.field("amount", "About how much was taken", "Optional.", input("money", s.amount), p),
        U.field("where", "Where the purchases were made, if you know", "Optional, for example \"in stores in another state\".", input("text", s.where, { maxlength: "200" }), p)];
    },
    read: function () { return { state: U.picked("state"), noticed: val("noticed"), amount: val("amount"), where: val("where") }; },
    show: function (r, s, back) {
      U.count("stolen-snap", "kit");
      U.show(h("h1", { class: "long", text: r.headline }), steps(r.steps),
        U.draftBox("Statement for the police report", r.statement, "stolen-snap-statement.txt"),
        tail(r, "stolen-snap.txt", function (r) { return plain(r, [["WHAT TO DO", r.steps], ["STATEMENT", r.statement]]); }, [U.quiet("Change my answers", back)]));
    }
  });

  var locked = flow({
    module: "locked-out", api: "/api/locked-out", button: "Show me ways back in",
    title: "I'm locked out of my Social Security account",
    lead: "Social Security's online account now works only through Login.gov or ID.me. When the sign-in fails, there are other ways to prove who you are, and most things can still be done by phone or in person.",
    draw: function (s, p) {
      return [U.choice("provider", "Which sign-in do you use?", [["logingov", "Login.gov"], ["idme", "ID.me"], ["unsure", "I'm not sure, or neither works"]], s.provider, p),
        U.choice("problem", "What is going wrong?", [["cant_verify", "It cannot verify my identity"], ["locked", "It says my account is locked"], ["no_code", "The code never comes"], ["no_phone", "I don't have a mobile phone"], ["no_id", "My ID won't upload or is expired"]], s.problem, p)];
    },
    read: function () { return { provider: U.picked("provider"), problem: U.picked("problem") }; },
    show: function (r, s, back) {
      U.show(h("h1", { class: "long", text: r.headline }), steps(r.steps),
        h("p", {}, r.help.map(function (x, i) { return [i ? " · " : "", U.link(x.url, x.name)]; })),
        tail(r, "locked-out.txt", function (r) { return plain(r, [["WHAT YOU CAN DO", r.steps]]); }, [U.quiet("Change my answers", back)]));
    }
  });

  var calls = (function () {
    var log = [];
    return flow({
      module: "ssa-call", api: "/api/ssa-call", button: "Make my call plan",
      title: "I can't reach anyone at Social Security",
      lead: "Get a plan for the call: when to call, what to have in front of you, what to say, and a log of each try so you have a record if you need to complain or appeal.",
      draw: function (s, p) {
        return [U.choice("topic", "What is the call about?", [["letter", "A letter I got"], ["overpayment", "An overpayment"], ["payment", "A missing or wrong payment"], ["claim", "A claim or appeal I filed"], ["card", "My card or a benefit letter"], ["other", "Something else"]], s.topic, p),
          U.choice("urgent", "Are you without money for food, medicine or housing because of this?", YN, s.urgent ? "yes" : "", p)];
      },
      read: function () { return { topic: U.picked("topic"), urgent: U.picked("urgent") === "yes" }; },
      show: function (r, s, back) {
        U.count("ssa-call", "kit");
        var list = h("ul", { class: "calllog" });
        function draw() { list.replaceChildren.apply(list, log.map(function (x) { return h("li", { text: x }); })); }
        draw();
        function add() {
          var when = new Date().toLocaleString(), what = val("trywhat") || "No answer", who = val("trywho");
          log.push(when + " - " + what + (who ? " - spoke to " + who : "")); document.getElementById("trywhat").value = ""; document.getElementById("trywho").value = ""; draw();
        }
        U.show(h("h1", { class: "long", text: r.headline }),
          h("h2", { text: "When to call" }), steps(r.plan),
          h("h2", { text: "Have this in front of you" }), h("ul", {}, r.ready.map(function (x) { return h("li", { text: x }); })),
          U.draftBox("What to say", r.words, "call-words.txt"),
          h("h2", { text: "Log each try" }),
          h("p", { class: "small", text: "Kept on this page only. Download it before you leave." }),
          h("div", { class: "field" }, U.field("trywhat", "What happened", "For example: on hold 40 minutes, then cut off. Or: callback booked.", input("text", ""), {})),
          h("div", { class: "field" }, U.field("trywho", "Name or ID of the person you spoke to", "Optional.", input("text", ""), {})),
          U.row(U.go("Add to my log", add)), list,
          tail(r, "ssa-call.txt", function (r) { return plain(r, [["WHEN TO CALL", r.plan], ["HAVE READY", r.ready], ["WHAT TO SAY", r.words], ["CALL LOG", log.join("\r\n") || "(none yet)"]]); },
            [U.quiet("I already sent something: keep a record", function () { location.hash = "filed"; }), U.quiet("Change my answers", back)]));
      }
    });
  })();

  var withhold = flow({
    module: "withholding", api: "/api/withholding", button: "Work it out",
    title: "They're taking too much from my check",
    lead: "If repaying an overpayment leaves you unable to pay for necessities, you can ask Social Security to take less. Build a budget, see the amounts that matter, and get a request letter.",
    draw: function (s, p) {
      var e = s.expenses || {};
      function ex(k, label) { return h("div", { class: "field" }, U.field("e-" + k, label, null, input("money", e[k]), p["expenses." + k] ? (function () { var o = {}; o["e-" + k] = p["expenses." + k]; return o; })() : {})); }
      return [U.choice("program", "What kind of benefit is it?", [["t2", "Retirement, survivor or disability benefits"], ["ssi", "SSI"]], s.program, p),
        U.field("balance", "What you still owe", "From your latest notice.", input("money", s.balance), p),
        U.field("taken", "How much they take each month now", null, input("money", s.taken), p),
        U.field("income", "Your total monthly income", "All of it, before the withholding is taken out.", input("money", s.income), p),
        h("fieldset", { class: "ticks" }, h("legend", { text: "Your monthly expenses" }), h("p", { class: "hint", text: "Leave a box empty if it does not apply." }), h("div", { class: "money-grid" },
          ex("rent", "Rent or mortgage"), ex("utilities", "Electric, gas, water"), ex("food", "Food"), ex("medical", "Medical and medicine"), ex("transport", "Transportation"),
          ex("phone", "Phone and internet"), ex("insurance", "Insurance"), ex("debts", "Debt payments"), ex("other", "Other necessary costs"))),
        U.field("resources", "Money in bank accounts and cash", "Optional.", input("money", s.resources), p),
        U.field("ask", "What you could afford each month", "Optional. It goes into your letter.", input("money", s.ask), p),
        U.choice("extra_help", "Do you get Extra Help with Medicare drug costs?", YN, s.extra_help ? "yes" : "", p)];
    },
    read: function () {
      var e = {}; ["rent", "utilities", "food", "medical", "transport", "phone", "insurance", "debts", "other"].forEach(function (k) { e[k] = val("e-" + k); });
      return { program: U.picked("program"), balance: val("balance"), taken: val("taken"), income: val("income"), expenses: e, resources: val("resources"), ask: val("ask"), extra_help: U.picked("extra_help") === "yes" };
    },
    example: function () { return { program: "t2", balance: "6400", taken: "760", income: "1520", expenses: { rent: "950", utilities: "160", food: "280", medical: "60", phone: "45" }, resources: "240", ask: "50", extra_help: false }; },
    show: function (r, s, back) {
      U.count("withholding", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        h("table", { class: "plain" },
          [["Still owed", money(r.balance)], ["Taken each month now", money(r.taken) + (r.months_at_current_rate ? " (about " + r.months_at_current_rate + " months)" : "")],
            ["Repays in 12 months", money(r.in_12_months) + " a month"], ["Repays in 60 months", money(r.in_60_months) + " a month"],
            ["Income", money(r.income)], ["Expenses", money(r.expenses)], ["Left each month", money(r.left)]].map(function (x) { return h("tr", {}, h("th", { scope: "row", text: x[0] }), h("td", { class: "num", text: x[1] })); })),
        h("h2", { text: "What you can do" }), steps(r.steps),
        U.draftBox("Request for a lower rate", r.letter, "lower-rate-request.txt"),
        U.draftBox("Budget for form SSA-634", r.budget, "ssa-634-budget.txt"),
        h("p", {}, h("a", { href: "#overpayment", text: "Work out my appeal and waiver dates" })),
        tail(r, "lower-withholding.txt", function (r) { return plain(r, [["WHAT YOU CAN DO", r.steps], ["LETTER", r.letter], ["BUDGET", r.budget]]); },
          [U.sentButton("other", "Request for a lower overpayment recovery rate", "mail"), U.quiet("Change my figures", back)]));
    }
  });

  var paperwork = flow({
    module: "paperwork", api: "/api/paperwork", button: "See my date",
    title: "I lost Medicaid or SNAP over paperwork",
    lead: "Many people lose coverage only because a form or proof did not arrive. For a while after it ends, you can send the papers and have your case looked at again without starting over.",
    draw: function (s, p) {
      return [U.choice("program", "What ended?", [["medicaid", "Medicaid"], ["snap", "SNAP (food assistance)"]], s.program, p),
        U.choice("basis", "If Medicaid: what is it based on?", [["income", "Income (most children, parents, pregnant people, adults under 65)"], ["abd", "Age 65 or older, blindness or disability"], ["unsure", "Not sure"]], s.basis || "unsure", p),
        U.field("ended", "Date it ended", "For SNAP, the last day of your certification period. It is on your notice.", input("date", s.ended), p),
        U.field("state", "Your state", null, select(STATES, s.state || "FL"), p)];
    },
    read: function () { return { program: U.picked("program"), basis: U.picked("basis"), ended: val("ended"), state: val("state") }; },
    show: function (r, s, back) {
      U.count("paperwork", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        r.days_left >= 0 ? h("p", { class: "lead", text: r.days_left + " days from today." }) : null,
        h("h2", { text: "What you can do" }), steps(r.steps),
        r.contact ? h("p", {}, h("b", { text: r.contact.name + ": " }), r.contact.phone ? r.contact.phone + " · " : "", U.link(r.contact.portal, "Online account")) : null,
        U.draftBox("Cover note to send with your papers", r.note, "paperwork-cover-note.txt"),
        h("p", {}, h("a", { href: "#benefit-hearing", text: "Work out my hearing date" }), " · ", h("a", { href: "#renewal", text: "Check my renewal before I send it" })),
        tail(r, "lost-over-paperwork.txt", function (r) { return plain(r, [["WHAT YOU CAN DO", r.steps], ["COVER NOTE", r.note]]); },
          [U.sentButton("other", "Papers sent after " + (r.program === "medicaid" ? "Medicaid" : "SNAP") + " ended", "mail"), U.quiet("Change my answers", back)]));
    }
  });

  window.Modules = window.Modules || {};
  window.Modules.fixes = { costs: costs, stolen: stolen, locked: locked, calls: calls, withhold: withhold, paperwork: paperwork,
    kit: { flow: flow, tail: tail, plain: plain, input: input, val: val, steps: steps, money: money, select: select } };
})();
