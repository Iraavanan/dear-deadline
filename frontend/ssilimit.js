/* SSI $2,000 tracker: what may count toward the resource limit on the 1st of each month,
   from figures the person types. Nothing is saved. */
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI) return;
  var U = window.UI, h = U.h;
  var s;
  var KINDS = [["tax_refund", "Federal tax refund (including EITC or Child Tax Credit)"], ["retro", "Past-due SSI or Social Security benefits"], ["burial", "Money set aside for burial"]];
  var NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function ym(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2); }
  function label(v) { var p = v.split("-"); return NAMES[+p[1] - 1] + " 1, " + p[0]; }
  function recent() {
    var now = new Date(), out = [];
    for (var i = 5; i >= 0; i--) out.push(ym(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    return out;
  }
  function money(v) { return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function start() {
    s = { household: "", months: {}, set_aside: [{}, {}, {}] };
    U.count("ssi-limit", "start"); U.setDatebar(null);
    form();
  }

  function form(problems) {
    problems = problems || {};
    var months = recent(), byId = {};
    Object.keys(problems).forEach(function (k) {
      var m = /^months\.(\d+)\.on_the_1st$/.exec(k), a = /^set_aside\.(\d+)\.(kind|amount|month)$/.exec(k);
      if (m) byId["m-" + months[+m[1]]] = problems[k];
      else if (a) byId["sa-" + { kind: "kind", amount: "amt", month: "month" }[a[2]] + "-" + a[1]] = problems[k];
    });
    U.show(
      h("h1", { class: "long", text: "Am I under SSI's $2,000 limit?" }),
      h("p", { class: "lead", text: "SSI looks at what you have on the 1st of each month. Enter what was in your bank accounts and cash on the 1st, and any money the rules let you leave out. You see, month by month, what may count. Nothing you type is saved." }),
      h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); collect(months); send(); } } },
        U.choice("household", "Who is this for?", [["single", "One person ($2,000 limit)"], ["couple", "A married couple ($3,000 limit)"]], s.household, problems),
        h("fieldset", { class: "ticks", id: "months" },
          h("legend", { text: "Money in all your bank accounts and cash, on the 1st of the month" }),
          h("p", { class: "hint", text: "Leave a month blank to skip it. Use your bank statement or app for the balance at the start of the day on the 1st. Do not include an ABLE account." }),
          problems.months ? h("p", { class: "err", role: "alert", text: problems.months }) : null,
          h("div", { class: "money-grid" }, months.map(function (m, i) {
            return h("div", { class: "field" }, U.field("m-" + m, label(m), null, h("input", { type: "text", inputmode: "decimal", value: s.months[m] || "" }), byId));
          }))),
        h("fieldset", { class: "ticks", id: "set_aside" },
          h("legend", { text: "Money the rules may let you leave out (optional)" }),
          h("p", { class: "hint", text: "Only if it is part of the balances above. A federal tax refund is left out for 12 months after the month you got it, past-due benefits for 9 months, and a burial fund up to $1,500." }),
          s.set_aside.map(function (it, i) {
            return h("div", { class: "setaside" },
              U.field("sa-kind-" + i, "What it is", null, h("select", {}, [h("option", { value: "", text: "None" })].concat(KINDS.map(function (k) { return h("option", { value: k[0], text: k[1], selected: it.kind === k[0] ? "selected" : null }); }))), byId),
              U.field("sa-amt-" + i, "Amount", null, h("input", { type: "text", inputmode: "decimal", value: it.amount || "" }), byId),
              U.field("sa-month-" + i, "Month you got it or set it aside", "Year and month, like 2026-04.", h("input", { type: "month", value: it.month || "" }), byId));
          })),
        U.row(U.go("Work it out", null, "submit"), U.quiet("Try made-up figures", example), U.quiet("Back", U.home))));
    U.firstProblem();
  }

  function collect(months) {
    s.household = U.picked("household");
    months.forEach(function (m) { s.months[m] = document.getElementById("m-" + m).value.trim(); });
    s.set_aside = s.set_aside.map(function (_, i) {
      return { kind: document.getElementById("sa-kind-" + i).value, amount: document.getElementById("sa-amt-" + i).value.trim(), month: document.getElementById("sa-month-" + i).value.trim() };
    });
  }

  function body() {
    var months = Object.keys(s.months).filter(function (m) { return s.months[m] !== ""; }).sort().map(function (m) { return { month: m, on_the_1st: s.months[m] }; });
    return { household: s.household, months: months, set_aside: s.set_aside.filter(function (it) { return it.kind; }) };
  }

  function example() {
    U.trying();
    var m = recent();
    s = { household: "single", months: {}, set_aside: [{ kind: "tax_refund", amount: "1400", month: m[1] }, {}, {}] };
    [1650, 1820, 3150, 2310, 3600, 1700].forEach(function (v, i) { s.months[m[i]] = String(v); });
    form();
  }

  function send() {
    var b = body(), problems = {};
    if (!b.household) problems.household = "Choose whether this is for one person or a married couple.";
    if (!b.months.length) problems.months = "Enter at least one month.";
    if (Object.keys(problems).length) { form(problems); return; }
    U.api("/api/ssi-limit", b).then(function (res) {
      if (!res.ok) { form(remap(res.data.problems || {}, b)); return; }
      U.count("ssi-limit", "dates"); result(res.data);
    }).catch(U.failed);
  }

  /* Server problems name rows by their place in the request; point them at the right box. */
  function remap(p, b) {
    var out = {}, all = recent(), given = b.months.map(function (m) { return m.month; });
    Object.keys(p).forEach(function (k) {
      var m = /^months\.(\d+)\.(.*)$/.exec(k);
      if (m) out["months." + all.indexOf(given[+m[1]]) + "." + m[2]] = p[k];
      else out[k] = p[k];
    });
    var sa = s.set_aside.map(function (it, i) { return it.kind ? i : -1; }).filter(function (i) { return i >= 0; });
    Object.keys(out).forEach(function (k) { var m = /^set_aside\.(\d+)\.(.*)$/.exec(k); if (m) { out["set_aside." + sa[+m[1]] + "." + m[2]] = out[k]; if (+m[1] !== sa[+m[1]]) delete out[k]; } });
    return out;
  }

  function text(r) {
    var out = ["SSI RESOURCE LIMIT: MONTH BY MONTH", "", r.headline, "", "Limit: " + money(r.limit), ""];
    r.months.forEach(function (m) {
      out.push(m.first_of_month + ": had " + money(m.on_the_1st) + (m.left_out ? ", left out " + money(m.left_out) : "") + ", may count " + money(m.may_count) + (m.over_by ? " (over by " + money(m.over_by) + ")" : ""));
    });
    out.push("", "WHAT YOU CAN DO"); r.steps.forEach(function (st, i) { out.push((i + 1) + ". " + st); });
    out.push("", "RULES"); r.rules.forEach(function (x) { out.push("- " + x.plain + " " + x.source); });
    out.push("", r.disclaimer);
    return out.join("\r\n");
  }

  function result(r) {
    U.show(
      h("h1", { class: "long", text: r.headline }),
      h("table", { class: "months ssi" },
        h("thead", {}, h("tr", {}, ["On the 1st of", "You had", "Left out", "May count", "Against " + money(r.limit)].map(function (t) { return h("th", { scope: "col", text: t }); }))),
        h("tbody", {}, r.months.map(function (m) {
          return h("tr", { class: m.status },
            h("th", { scope: "row", text: m.first_of_month }), h("td", { text: money(m.on_the_1st) }),
            h("td", { text: m.left_out ? money(m.left_out) + " (" + m.left_out_items.map(function (x) { return x.what; }).join(", ") + ")" : "—" }),
            h("td", { text: money(m.may_count) }),
            h("td", { text: m.status === "over" ? "Over by " + money(m.over_by) + (m.small ? " (small)" : "") : (m.status === "close" ? money(m.room) + " room: close" : money(m.room) + " room") }));
        }))),
      h("h2", { text: "What you can do" }),
      h("ol", {}, r.steps.map(function (st) { return h("li", { text: st }); })),
      h("p", {}, h("a", { href: "#report-change", text: "Get the words to report a change" }), " · ", h("a", { href: "#overpayment", text: "I already got an overpayment notice" })),
      h("h2", { text: "Rules this is based on" }), U.sources(r.rules),
      h("p", { class: "small", text: r.disclaimer + " Rules checked as of " + r.rules_as_of + "." }),
      U.row(U.go("Print this", function () { window.print(); }), U.quiet("Download as text", function () { U.download("ssi-limit.txt", "text/plain", text(r)); }),
        U.quiet("Change my figures", function () { form(); })));
  }

  window.Modules = window.Modules || {};
  window.Modules.ssiLimit = { start: start };
})();
