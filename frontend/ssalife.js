/* Four Social Security helpers for changes in someone's life: a death, benefits that stopped
   after going back to work, SSI lowered by help with housing, and a payment amount that changed.
   Nothing is saved. */
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI || !window.Modules || !window.Modules.fixes) return;
  var U = window.UI, h = U.h, K = window.Modules.fixes.kit;
  var flow = K.flow, tail = K.tail, plain = K.plain, input = K.input, val = K.val, steps = K.steps, money = K.money;
  var YN = [["no", "No"], ["yes", "Yes"]];
  var NAMES = { "medicare-irmaa": "My Medicare premium is higher because of my income", "medicare-costs": "Could a program pay my Medicare costs?",
    "withholding": "They're taking too much from my check", "benefit-offset": "Part of my benefit is taken for a debt", "ssi-help": "My SSI went down because of help I get" };
  function table(rows) { return h("table", { class: "plain" }, rows.filter(Boolean).map(function (x) { return h("tr", {}, h("th", { scope: "row", text: x[0] }), h("td", { class: "num", text: x[1] })); })); }
  function thisMonth() { return new Date().toISOString().slice(0, 7); }

  var died = flow({
    module: "after-death", api: "/api/after-death", button: "Show me what to do",
    title: "Someone who got benefits died",
    lead: "When someone who got Social Security or SSI dies, some payments have to be sent back, and family members may be able to get a one-time payment or monthly survivors benefits. See which months matter and what to do first.",
    draw: function (s, p) {
      return [U.field("died_on", "Date of death", null, input("date", s.died_on), p),
        U.choice("benefit", "What was the person getting?", [["ss", "Social Security (retirement, survivor or disability)"], ["ssi", "SSI"], ["both", "Both"]], s.benefit, p),
        U.choice("relationship", "How were you related?", [["spouse_with", "Spouse, living in the same home"], ["spouse_apart", "Spouse, living apart"], ["child", "Child"], ["other", "Other family member or friend"]], s.relationship, p)];
    },
    read: function () { return { died_on: val("died_on"), benefit: U.picked("benefit"), relationship: U.picked("relationship") }; },
    example: function () { var d = new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10); return { died_on: d, benefit: "ss", relationship: "spouse_with" }; },
    show: function (r, s, back) {
      U.count("after-death", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        r.payments.map(function (x) { return [h("h2", { text: x.name }), h("ul", {}, h("li", { text: x.keep }), h("li", {}, h("b", { text: x.return })))]; }),
        h("h2", { text: "The one-time $255 payment" }), h("p", { text: r.lump_text + (r.lump_by_long ? " Apply by " + r.lump_by_long + "." : "") }),
        h("h2", { text: "What to do" }), steps(r.steps),
        tail(r, "after-a-death.txt", function (r) { return plain(r, [["PAYMENTS", r.payments.map(function (x) { return x.name + ": " + x.keep + " " + x.return; })], ["$255 PAYMENT", r.lump_text], ["WHAT TO DO", r.steps]]); },
          [U.quiet("Plan my call", function () { location.hash = "ssa-call"; }), U.quiet("Change my answers", back)]));
    }
  });

  var restart = flow({
    module: "work-restart", api: "/api/reinstate", button: "Check my window",
    title: "My benefits stopped after I went back to work",
    lead: "If your disability benefits ended because you were earning too much, and you can no longer work at that level, you can ask to restart them without a new application, for up to 5 years. This is called expedited reinstatement.",
    draw: function (s, p) {
      return [U.choice("program", "Which benefit stopped?", [["ss", "Social Security disability (SSDI)"], ["ssi", "SSI"]], s.program, p),
        U.field("ended", "Month the benefits ended because of work", "It is on the letter that said your benefits would stop.", input("month", s.ended), p),
        U.choice("condition", "Is your condition now the same as, or related to, the one you got benefits for?", [["same", "Yes"], ["different", "No, it's a different condition"], ["unsure", "I'm not sure"]], s.condition, p),
        U.field("earnings", "What you earn now each month, before taxes", "Optional. Enter 0 if you stopped working.", input("money", s.earnings), p),
        U.choice("blind", "Did you get benefits because of blindness?", YN, s.blind || "no", p)];
    },
    read: function () { return { program: U.picked("program"), ended: val("ended"), condition: U.picked("condition"), earnings: val("earnings"), blind: U.picked("blind") }; },
    example: function () { var d = new Date(); d.setMonth(d.getMonth() - 30); return { program: "ss", ended: d.toISOString().slice(0, 7), condition: "same", earnings: "0", blind: "no" }; },
    show: function (r, s, back) {
      U.count("work-restart", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        table([["Benefits ended", r.ended_long], ["Last month to ask", r.last_long], ["Months left, counting this one", String(r.months_left)],
          ["Monthly earnings limit this year", money(r.sga)], r.earnings !== null ? ["What you earn", money(r.earnings)] : null]),
        h("h2", { text: "What you can do" }), steps(r.steps),
        h("p", {}, U.link("https://www.ssa.gov/redbook/eng/exr.htm", "Expedited reinstatement at ssa.gov"), " · ", h("a", { href: "#work-check", text: "I work while getting benefits" })),
        tail(r, "restart-benefits.txt", function (r) { return plain(r, [["DATES", "Benefits ended " + r.ended_long + "; last month to ask " + r.last_long], ["WHAT YOU CAN DO", r.steps]]); },
          [U.sentButton("other", "Request for expedited reinstatement", "in person"), U.quiet("Change my answers", back)]));
    }
  });

  var ssihelp = flow({
    module: "ssi-help", api: "/api/ssi-help", button: "Work it out",
    title: "My SSI went down because of help I get",
    lead: "Help with rent, a mortgage or utilities can lower SSI. Food no longer counts. See how much the help may count, and whether paying your share or a change in rent could stop the reduction.",
    draw: function (s, p) {
      return [U.choice("who", "Who gets SSI?", [["single", "One person"], ["couple", "A married couple"]], s.who || "single", p),
        U.choice("home", "Where do you live?", [["others", "In a home I share with other people (not just my spouse and children)"], ["own", "In my own place, alone or with my spouse and children"]], s.home, p),
        h("fieldset", { class: "ticks" }, h("legend", { text: "If you share a home" }),
          U.field("people", "How many people live there, counting you", null, input("text", s.people, { inputmode: "numeric", maxlength: "2" }), p),
          U.field("shelter_total", "The household's monthly rent or mortgage plus utilities", "Electric, gas, water, heating fuel. Not phone or cable.", input("money", s.shelter_total), p),
          U.field("i_pay", "What you pay toward those each month", null, input("money", s.i_pay), p),
          U.choice("pa", "Does anyone else there get SNAP, TANF, SSI or other need-based help?", YN, s.pa || "no", p)),
        h("fieldset", { class: "ticks" }, h("legend", { text: "If you live in your own place" }),
          U.choice("family_landlord", "Do you rent from your parent or your child?", YN, s.family_landlord || "no", p),
          U.field("rent", "Rent you pay them each month", "Optional.", input("money", s.rent), p),
          U.field("market", "Rent a stranger would pay for the same place", "Optional, if you know it.", input("money", s.market), p)),
        U.field("outside", "Money someone outside your home pays toward your rent or utilities each month", "Optional.", input("money", s.outside), p),
        U.field("month", "Month", null, input("month", s.month || thisMonth()), p)];
    },
    read: function () {
      return { who: U.picked("who"), home: U.picked("home"), people: val("people"), shelter_total: val("shelter_total"), i_pay: val("i_pay"), pa: U.picked("pa"),
        family_landlord: U.picked("family_landlord"), rent: val("rent"), market: val("market"), outside: val("outside"), month: val("month") };
    },
    example: function () { return { who: "single", home: "others", people: "4", shelter_total: "1600", i_pay: "250", pa: "no", family_landlord: "no", month: thisMonth() }; },
    show: function (r, s, back) {
      U.count("ssi-help", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        table([["Federal SSI amount, " + r.month_long, money(r.fbr)], r.share !== undefined ? ["Your share of shelter costs", money(r.share)] : null,
          r.share !== undefined ? ["What you pay", money(r.i_pay)] : null, ["One-third reduction", money(r.vtr)], ["Most that help can count (presumed maximum value)", money(r.pmv)],
          ["May lower SSI by up to", money(r.may_lower_by)]]),
        h("h2", { text: "What you can do" }), steps(r.steps),
        h("p", {}, h("a", { href: "#ssi-limit", text: "Am I under SSI's $2,000 limit?" }), " · ", h("a", { href: "#report-change", text: "Something in my life changed" })),
        tail(r, "ssi-help-with-housing.txt", function (r) { return plain(r, [["FIGURES", "Federal amount " + money(r.fbr) + "; may lower SSI by up to " + money(r.may_lower_by)], ["WHAT YOU CAN DO", r.steps]]); },
          [U.quiet("Change my answers", back)]));
    }
  });

  var changed = flow({
    module: "amount-changed", api: "/api/amount-changed", button: "Explain the change",
    title: "My benefit amount changed",
    lead: "Enter the old and new amounts from your notices or bank statements. See which part changed: the cost-of-living increase, the Medicare premium, or something taken out.",
    draw: function (s, p) {
      return [U.choice("kind", "Which benefit?", [["ss", "Social Security (retirement, survivor or disability)"], ["ssi", "SSI"]], s.kind, p),
        U.field("month", "Month the new amount started", null, input("month", s.month || thisMonth()), p),
        h("fieldset", { class: "ticks" }, h("legend", { text: "Before the change" }), h("div", { class: "money-grid" },
          U.field("old_gross", "Amount before anything is taken out", null, input("money", s.old_gross), p),
          U.field("old_medicare", "Medicare premium taken out", "Optional.", input("money", s.old_medicare), p),
          U.field("old_other", "Anything else taken out", "Optional. Tax, repayments, debts.", input("money", s.old_other), p))),
        h("fieldset", { class: "ticks" }, h("legend", { text: "After the change" }), h("div", { class: "money-grid" },
          U.field("new_gross", "Amount before anything is taken out", null, input("money", s.new_gross), p),
          U.field("new_medicare", "Medicare premium taken out", "Optional.", input("money", s.new_medicare), p),
          U.field("new_other", "Anything else taken out", "Optional.", input("money", s.new_other), p)))];
    },
    read: function () { var o = { kind: U.picked("kind"), month: val("month") }; ["old_gross", "old_medicare", "old_other", "new_gross", "new_medicare", "new_other"].forEach(function (k) { o[k] = val(k); }); return o; },
    example: function () { var y = new Date().getFullYear() + (new Date().getMonth() >= 10 ? 1 : 0); return { kind: "ss", month: y + "-01", old_gross: "1800", old_medicare: "202.90", old_other: "0", new_gross: "1864", new_medicare: "209.40", new_other: "60" }; },
    show: function (r, s, back) {
      U.count("amount-changed", "kit");
      U.show(h("h1", { class: "long", text: r.headline }),
        h("table", { class: "plain" }, h("tr", {}, ["", "Before", "After", "Change"].map(function (x) { return h("th", { text: x }); })),
          r.parts.map(function (x) { return h("tr", {}, h("th", { scope: "row", text: x.name }), h("td", { class: "num", text: money(x.old) }), h("td", { class: "num", text: money(x.new) }), h("td", { class: "num", text: x.change ? (x.change < 0 ? "−" : "+") + money(Math.abs(x.change)) : money(0) })); })),
        h("h2", { text: "What changed" }), h("ul", {}, r.why.map(function (w) { return h("li", { text: w }); })),
        h("h2", { text: "What you can do" }), steps(r.steps),
        r.links.length ? h("p", {}, r.links.map(function (l, i) { return [i ? " · " : "", h("a", { href: "#" + l, text: NAMES[l] || l })]; })) : null,
        tail(r, "amount-changed.txt", function (r) { return plain(r, [["PARTS", r.parts.map(function (x) { return x.name + ": " + money(x.old) + " -> " + money(x.new); })], ["WHAT CHANGED", r.why], ["WHAT YOU CAN DO", r.steps]]); },
          [U.quiet("Change my figures", back)]));
    }
  });

  window.Modules.ssalife = { died: died, restart: restart, ssihelp: ssihelp, changed: changed };
})();
