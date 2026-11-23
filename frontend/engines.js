/* The Medicare bill check, the housing rent check and the renewal check, run on this device.

   A line-for-line port of backend/helper/bill.py and backend/helper/rent.py, so the figures a
   person types for these two checks never leave the browser. tests/engines.test.js runs both
   versions on the same cases and requires the same answers. The rule tables come from
   /api/meta, so the wording and sources are the same as the server's.

   run(raw, todayISO, tables) returns the result, or throws {problems: {field: message}}. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Engines = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Rounds the exact binary value, as Python's round() does, rather than nudging halves upward.
  // An exact tie (like 574.125) goes to the even digit, as in Python; everything else is plain rounding.
  function pyround(x, n) {
    var t = Math.abs(x).toFixed(20), dot = t.indexOf("."), tail = t.slice(dot + 1 + n);
    var v;
    if (/^50*$/.test(tail)) {
      var down = Number(t.slice(0, dot + 1 + n)), last = Number(t.charAt(dot + n)), step = Math.pow(10, -n);
      v = last % 2 === 0 ? down : Number((down + step).toFixed(n));
    } else v = Number(Math.abs(x).toFixed(n));
    v = x < 0 ? -v : v;
    return v === 0 ? 0 : v;
  }
  function r2(x) { return pyround(x, 2); }
  function r1(x) { return pyround(x, 1); }
  function money(v) { return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pct1(v) { var s = String(r1(v)); return s.indexOf(".") < 0 ? s + ".0" : s; }      // Python prints 12.0, not 12
  function fail(problems) { var e = new Error("input"); e.problems = problems; throw e; }
  function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function asMapping(raw, field, message) {
    if (raw === null || raw === undefined || raw === "" || (Array.isArray(raw) && !raw.length)) return {};
    if (!isObj(raw)) { var p = {}; p[field] = message; fail(p); }
    return raw;
  }
  function amount(value, key, problems) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "boolean" || typeof value === "object") { problems[key] = "Enter an amount, like 1500."; return null; }
    var text = String(value).replace(/,/g, "").replace(/\$/g, "").trim();
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) { problems[key] = "Enter an amount, like 1500."; return null; }
    var v = r2(parseFloat(text));
    if (v < 0 || v > 10000000) { problems[key] = "Enter an amount between 0 and 10,000,000."; return null; }
    return v;
  }
  function parseDate(v) {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) throw new Error("date");
    var p = v.trim().split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    if (d.getUTCMonth() !== p[1] - 1 || d.getUTCDate() !== p[2]) throw new Error("date");
    return v.trim();
  }
  function say(iso) { var p = iso.split("-").map(Number); return MONTHS[p[1] - 1] + " " + p[2] + ", " + p[0]; }
  function plural(n) { return n === 1 ? "" : "s"; }

  // ---------------- Medicare bill ----------------

  var CHOICES = { on_msn: ["yes", "no", "unsure"], approved: ["yes", "no", "unsure"], qmb: ["yes", "no", "unsure"],
    other_insurance: ["none", "medigap", "medicaid", "employer", "unsure"], waiting: ["yes", "no", "unsure"] };

  function billClean(raw, today) {
    var body = asMapping(raw, "bill", "The details could not be read. Enter them again."), problems = {}, f = {};
    Object.keys(CHOICES).forEach(function (k) {
      var v = body[k]; if (v === null || v === undefined || v === "") v = "unsure";
      if (CHOICES[k].indexOf(v) < 0) problems[k] = "Choose one of the answers.";
      f[k] = v;
    });
    ["bill_service_date", "msn_service_date"].forEach(function (k) {
      var v = body[k]; f[k] = null;
      if (v === null || v === undefined || v === "") return;
      var d; try { d = parseDate(v); } catch (e) { problems[k] = "Enter the date as month, day and year, or leave it empty."; return; }
      if (d > today || Number(d.slice(0, 4)) < 2000) problems[k] = "Check the date of the service.";
      f[k] = d;
    });
    if (!f.bill_service_date && !problems.bill_service_date) problems.bill_service_date = "Enter the date of the service on the bill.";
    f.balance = amount(body.balance, "balance", problems);
    if (f.balance === null && !problems.balance) problems.balance = "Enter the amount the bill asks you to pay now. Enter 0 if it asks for nothing.";
    f.paid = amount(body.paid, "paid", problems);
    f.maximum = amount(body.maximum, "maximum", problems);
    if (f.on_msn === "yes" && !f.msn_service_date && !problems.msn_service_date) problems.msn_service_date = "Enter the date of the service on the notice.";
    if (Object.keys(problems).length) fail(problems);
    return f;
  }

  function bill(raw, today, tables) {
    var f = billClean(raw, today), t = tables.bill, findings = [], questions = [], steps = [];
    var owed = f.balance + (f.paid || 0), status = "compare", comparison = null;
    if (f.on_msn !== "yes") {
      status = "not_on_notice";
      findings.push({ kind: "not_on_notice", text: f.on_msn === "no" ? "This service is not on a Medicare Summary Notice you have." : "You are not sure this service is on your Medicare Summary Notice." });
      steps.push(t.msn_timing.plain);
      questions.push("Have you sent this claim to Medicare? On what date, and what did Medicare decide?");
      questions.push("Can you hold this bill until Medicare and any other insurance have processed the claim?");
    } else {
      if (f.msn_service_date && f.bill_service_date !== f.msn_service_date) {
        status = "dates_differ";
        findings.push({ kind: "dates", text: "The bill is for a service on " + say(f.bill_service_date) + ", but the line you are comparing on the notice is for " + say(f.msn_service_date) + ". They may be different visits. Find the line on the notice with the same date and provider." });
        questions.push("Which date of service is this bill for, and which line of my Medicare Summary Notice does it match?");
      }
      if (f.approved === "no") {
        if (status === "compare") status = "denied";
        findings.push({ kind: "denied", text: "The notice says Medicare did not approve this service. The bill may be for the whole charge." });
        steps.push(t.msn_compare.plain); steps.push(t.appeal.plain);
        questions.push("Medicare did not approve this service. Did you send the right codes and information, and will you send the claim again?");
        questions.push("Did I sign a notice before the service saying Medicare might not pay (an Advance Beneficiary Notice)? Please send me a copy.");
      }
      if (f.qmb === "yes") {
        if (status === "compare" || status === "denied") status = "qmb";
        findings.push({ kind: "qmb", text: "You said your notice shows you are in the QMB program. " + t.qmb.plain.split(". Since")[0] + "." });
        steps.push(t.qmb_tip.plain);
        if (owed > 0) questions.push("My Medicare Summary Notice shows I am in the Qualified Medicare Beneficiary program. Please take the Medicare deductible and coinsurance off this bill and bill the state Medicaid program instead.");
      }
      if (f.maximum === null) {
        findings.push({ kind: "missing", text: "You did not enter the most the notice says you may be billed, so the bill cannot be compared with it. On the notice it is in the column \"Maximum You May Be Billed\" for this service." });
      } else if (status !== "dates_differ") {
        var gap = r2(owed - f.maximum);
        comparison = { maximum: f.maximum, balance: f.balance, paid: f.paid, asked: r2(owed), gap: gap };
        if (gap > 0.005) {
          comparison.status = "higher";
          findings.push({ kind: "higher", text: "The bill asks for " + money(owed) + " in all" + (f.paid ? " (" + money(f.balance) + " now and " + money(f.paid) + " already paid)" : "") + ", which is " + money(gap) + " more than the " + money(f.maximum) + " the notice says you may be billed for this service." });
          questions.push("My Medicare Summary Notice says the most I may be billed for the service on " + say(f.bill_service_date) + " is " + money(f.maximum) + ". Your bill asks for " + money(owed) + ". Can you explain the difference of " + money(gap) + ", or correct the bill?");
          if (f.paid) questions.push("If I have paid more than I owe for this service, when will you refund " + money(Math.min(gap, f.paid)) + "?");
        } else if (gap < -0.005) {
          comparison.status = "lower";
          findings.push({ kind: "lower", text: "The bill asks for " + money(owed) + " in all, " + money(-gap) + " less than the most the notice allows. Other insurance may have paid part of it, or the provider took a payment off." });
        } else {
          comparison.status = "same";
          findings.push({ kind: "same", text: "The bill asks for " + money(owed) + " in all, the same as the most the notice says you may be billed." });
        }
      }
      var other = { medigap: "your Medicare Supplement (Medigap) policy", medicaid: "Medicaid", employer: "your employer or retiree plan" }[f.other_insurance];
      if (other && owed > 0) {
        if (f.waiting === "yes") findings.push({ kind: "waiting", text: "The bill says it is waiting for other insurance. The amount may change once " + other + " has paid." });
        else questions.push("I also have " + other.replace("your ", "my ") + ". Have you sent this claim to them? Please do before billing me.");
      } else if (f.waiting === "yes") {
        findings.push({ kind: "waiting", text: "The bill says it is waiting for other insurance. The amount may change once that insurance has paid." });
      }
    }
    var headline = { not_on_notice: "This bill cannot be checked against Medicare yet", dates_differ: "The bill and the notice may be for different visits",
      denied: "Medicare did not approve this service", qmb: "You may be protected from this bill" }[status];
    if (!headline) headline = comparison === null ? "Enter the most you may be billed to compare"
      : { higher: "The bill asks for more than your notice allows", lower: "The bill asks for less than your notice allows", same: "The bill matches your notice" }[comparison.status];
    if (status === "qmb" && comparison && comparison.status === "higher") headline = "You may be protected from this bill";
    if (!questions.length) questions.push("Can you confirm this bill is final, and that Medicare and any other insurance have paid their part?");
    var script = ["Hello. I am calling about a bill for a service on " + say(f.bill_service_date) + ".", "I am comparing it with my Medicare Summary Notice."]
      .concat(questions.map(function (q) { return "- " + q; })).concat(["Can you put any correction in writing, and hold the bill while it is checked?", "May I have your name, and a reference number for this call?"]);
    var rulesOut = {}; Object.keys(t).forEach(function (k) { rulesOut[k] = { plain: t[k].plain, source: t[k].source }; });
    return { headline: headline, status: status, comparison: comparison, findings: findings, steps: steps, questions: questions, script: script, rules: rulesOut,
      rules_as_of: tables.rules_as_of, on_device: true,
      disclaimer: "This compares the figures you entered. It was made by an independent tool, not by Medicare or your provider, and it is not legal advice. Only the provider can correct a bill." };
  }

  // ---------------- housing rent ----------------

  var FIGURES = ["annual_income", "dependent_deduction", "elderly_deduction", "medical_deduction", "childcare_deduction", "other_deduction", "adjusted_income", "ttp",
    "utility_allowance", "gross_rent", "payment_standard", "your_rent", "medical_costs", "childcare_costs", "income_now", "minimum_rent"];

  function rentClean(raw) {
    var body = asMapping(raw, "program", "The figures could not be read. Enter them again."), problems = {}, f = {};
    f.program = body.program;
    if (f.program !== "voucher" && f.program !== "public_housing") problems.program = "Choose voucher or public housing.";
    FIGURES.forEach(function (k) { f[k] = amount(body[k], k, problems); });
    var dep = body.dependents;
    if (dep === null || dep === undefined || dep === "") f.dependents = 0;
    else if (typeof dep === "number" ? Number.isInteger(dep) : /^\s*[+-]?\d+\s*$/.test(String(dep))) {
      f.dependents = parseInt(dep, 10);
      if (f.dependents < 0 || f.dependents > 20) { problems.dependents = "Enter how many dependents, like 2."; f.dependents = 0; }
    } else { problems.dependents = "Enter how many dependents, like 2."; f.dependents = 0; }
    f.elderly_disabled = body.elderly_disabled === true;
    f.new_lease = body.new_lease === true;
    if (f.annual_income === null && f.ttp === null && !problems.annual_income) problems.annual_income = "Enter the yearly income on your rent notice or worksheet, or the total tenant payment if that is all it shows.";
    if (f.minimum_rent !== null && f.minimum_rent > 50) problems.minimum_rent = "A minimum rent can be at most $50.";
    if (Object.keys(problems).length) fail(problems);
    return f;
  }

  function roundDollar(v) { return v >= 0 ? Math.floor(v + 0.5) : -Math.floor(-v + 0.5); }

  function rentSteps(f, ttp, steps, findings, questions, adjusted) {
    var ua = f.utility_allowance, extra = {}, rent = null, note = null;
    if (f.program === "voucher") {
      if (f.gross_rent === null || f.payment_standard === null) {
        note = "To check what you pay the owner, enter the rent plus utility allowance (gross rent) and the payment standard from your notice.";
      } else {
        var hap = r2(Math.max(Math.min(f.payment_standard, f.gross_rent) - ttp, 0)), share = r2(f.gross_rent - hap);
        extra.hap = hap; extra.family_share = share;
        var over = Math.max(0, r2(f.gross_rent - f.payment_standard));
        steps.push({ what: "Housing assistance payment", how: "the lower of the payment standard (" + money(f.payment_standard) + ") and the gross rent (" + money(f.gross_rent) + "), minus your total tenant payment " + money(ttp), value: hap, stated: null });
        steps.push({ what: "Your share", how: "gross rent " + money(f.gross_rent) + " minus the housing assistance payment " + money(hap), value: share, stated: null });
        rent = r2(share - (ua || 0));
        steps.push({ what: "What you pay the owner", how: "your share minus the utility allowance of " + money(ua || 0), value: Math.max(rent, 0), stated: f.your_rent });
        if (over) findings.push({ kind: "over_standard", text: "Your gross rent is " + money(over) + " above the payment standard, so you pay that much more than your total tenant payment." });
        if (f.new_lease && adjusted !== null && share > r2(0.40 * adjusted / 12) + 0.005) {
          findings.push({ kind: "burden", text: "For a new lease, your share (" + money(share) + ") may not be more than 40% of your adjusted monthly income (" + money(0.40 * adjusted / 12) + "). The housing authority should not approve this unit at this rent." });
          questions.push("For this new lease my share would be " + money(share) + ", more than 40% of my adjusted monthly income. Can the rent be lowered, or can I look for another unit?");
        }
      }
    } else {
      if (ua === null) note = "If you pay utilities yourself, enter the utility allowance to check your rent.";
      rent = r2(ttp - (ua || 0));
      steps.push({ what: "Your rent", how: "total tenant payment " + money(ttp) + " minus the utility allowance of " + money(ua || 0), value: Math.max(rent, 0), stated: f.your_rent });
    }
    if (rent !== null && rent < 0) {
      extra.reimbursement = r2(-rent);
      findings.push({ kind: "reimbursement", text: "The utility allowance is more than " + (f.program === "voucher" ? "your share" : "your total tenant payment") + ", so you pay nothing to " + (f.program === "voucher" ? "the owner" : "the housing authority") + " and the housing authority may pay you or the utility the difference of " + money(-rent) + "." });
    }
    if (rent !== null && f.your_rent !== null && Math.abs(f.your_rent - Math.max(rent, 0)) >= 1) {
      findings.push({ kind: "rent", text: "From these figures your rent comes to " + money(Math.max(rent, 0)) + ", but your notice says " + money(f.your_rent) + "." });
      questions.push("From the figures on my notice, my rent comes to " + money(Math.max(rent, 0)) + ", but the notice says " + money(f.your_rent) + ". Can you explain the difference?");
    }
    return [rent !== null ? Math.max(rent, 0) : null, note, extra];
  }

  function letter(f, questions, interim) {
    var lines = ["To: [your housing authority, from your notice]", "Date: [today's date]", "Name: [your name]", "Address: [your address]", "",
      "I am writing about the rent calculation for my " + (f.program === "voucher" ? "Housing Choice Voucher" : "public housing unit") + ".", ""];
    if (interim) lines.push("My income has gone down. I am asking for an interim review of my rent.", "");
    lines.push("Please answer these questions:");
    questions.forEach(function (q, i) { lines.push((i + 1) + ". " + q); });
    lines.push("", "Please send me a copy of my rent calculation sheet and reply in writing.", "", "Signature: ____________________");
    return lines.join("\n");
  }

  function finish(f, t, steps, figures, rent, note, matches, findings, questions, interim, tables, extra) {
    var kinds = findings.map(function (x) { return x.kind; }), any = function (list) { return kinds.some(function (k) { return list.indexOf(k) >= 0; }); };
    var headline = any(["adjusted", "ttp", "rent"]) ? "Your rent does not add up from these figures"
      : any(["missing_deduction", "odd_deduction", "medical", "childcare"]) ? "A deduction may be missing"
      : (interim && interim.percent >= 10) ? "You can ask for your rent to be reviewed" : "Your rent adds up from these figures";
    if (!questions.length) questions.push("Please send me the rent calculation sheet for my last review, so I can check it.");
    var fig = {}; Object.keys(figures).forEach(function (k) { fig[k] = figures[k]; }); Object.keys(extra).forEach(function (k) { fig[k] = extra[k]; });
    return { headline: headline, program: f.program, steps: steps, figures: fig, rent: rent, rent_note: note, matches: matches, findings: findings,
      questions: questions, interim: interim, letter: letter(f, questions, interim), on_device: true,
      rules: ["ttp", "deductions", "amounts", "medical_phase", f.program === "voucher" ? "voucher" : "public_housing", "minimum_rent", "interim"].map(function (k) { return { plain: t[k].plain, source: t[k].source }; }),
      rules_as_of: tables.rules_as_of,
      disclaimer: "This is arithmetic on the figures you entered. It was made by an independent tool, not by HUD or your housing authority, and it is not legal advice. Only the housing authority can change your rent." };
  }

  function rent(raw, today, tables) {
    var f = rentClean(raw), t = tables.rent, sets = t.amounts.sets, findings = [], questions = [], matches = [], inc = f.annual_income;
    var near = function (a, b) { return Math.abs(a - b) < 0.005; };
    sets.forEach(function (st) {
      var ok = true;
      if (f.dependents && f.dependent_deduction !== null) ok = ok && near(f.dependent_deduction, st.dependent * f.dependents);
      if (f.elderly_disabled && f.elderly_deduction) ok = ok && near(f.elderly_deduction, st.elderly);
      if (ok && ((f.dependents && f.dependent_deduction !== null) || (f.elderly_disabled && f.elderly_deduction))) matches.push(st.name);
    });
    if (f.dependents && !f.dependent_deduction) {
      var d26 = sets.filter(function (st) { return st.id === "2026"; })[0].dependent;
      findings.push({ kind: "missing_deduction", text: "You have " + f.dependents + " dependent" + plural(f.dependents) + ", but no dependent deduction is shown. Each dependent should bring a deduction (for 2026 reviews, $" + d26 + " each under the new amounts, or $480 under the older ones)." });
      questions.push("My household has " + f.dependents + " dependent" + plural(f.dependents) + ". Why is there no dependent deduction on my rent calculation?");
    } else if (f.dependents && f.dependent_deduction !== null && !sets.some(function (st) { return near(f.dependent_deduction, st.dependent * f.dependents); })) {
      var amts = sets.map(function (st) { return st.dependent; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
      findings.push({ kind: "odd_deduction", text: "The dependent deduction of " + money(f.dependent_deduction) + " does not match " + f.dependents + " dependent" + plural(f.dependents) + " at any of HUD's published amounts (" + amts.map(function (a) { return "$" + a; }).join(", ") + " each)." });
      questions.push("How was my dependent deduction of " + money(f.dependent_deduction) + " worked out, and for how many dependents?");
    }
    if (f.elderly_disabled && !f.elderly_deduction) {
      findings.push({ kind: "missing_deduction", text: "You said the head, spouse or co-head is 62 or older or has a disability, but no elderly or disabled family deduction is shown." });
      questions.push("The head, spouse or co-head of my household is 62 or older or has a disability. Why is there no elderly or disabled family deduction?");
    }
    if (f.medical_costs && !f.medical_deduction && inc !== null) {
      if (f.elderly_disabled) {
        var above = r2(f.medical_costs - 0.10 * inc);
        if (above > 0) {
          findings.push({ kind: "medical", text: "Your unreimbursed medical costs of " + money(f.medical_costs) + " are " + money(above) + " above 10% of your yearly income, but no medical deduction is shown." });
          questions.push("I have " + money(f.medical_costs) + " a year in medical costs that insurance does not pay. Can these be deducted? Here are the receipts.");
        } else {
          findings.push({ kind: "medical_low", text: "Your medical costs are not above 10% of your yearly income (" + money(0.10 * inc) + "), so under the new rules they may not bring a deduction. Under the older 3% rule, or if you are phasing in, they may." });
        }
      } else {
        findings.push({ kind: "medical_rule", text: "Only elderly or disabled families can deduct medical costs, so none is expected for your household." });
      }
    }
    if (f.childcare_costs && !f.childcare_deduction) {
      findings.push({ kind: "childcare", text: "You pay " + money(f.childcare_costs) + " a year for child care, but no child care deduction is shown. Child care that lets someone in the household work or go to school can be deducted." });
      questions.push("I pay " + money(f.childcare_costs) + " a year for child care so I can work or go to school. Can it be deducted? Here is proof.");
    }
    var steps = [], figures = {}, out;
    if (inc === null) {
      steps.push({ what: "Total tenant payment", how: "as shown on your notice (no income entered, so it is taken as given)", value: f.ttp, stated: f.ttp });
      out = rentSteps(f, f.ttp, steps, findings, questions, null);
      return finish(f, t, steps, { ttp: f.ttp }, out[0], out[1], matches, findings, questions, null, tables, out[2]);
    }
    var deds = ["dependent_deduction", "elderly_deduction", "medical_deduction", "childcare_deduction", "other_deduction"].reduce(function (a, k) { return a + (f[k] || 0); }, 0);
    figures.adjusted = Math.max(r2(inc - deds), 0);
    steps.push({ what: "Adjusted yearly income", how: money(inc) + " income minus " + money(deds) + " of deductions", value: figures.adjusted, stated: f.adjusted_income });
    if (f.adjusted_income !== null && Math.abs(f.adjusted_income - figures.adjusted) >= 1) {
      findings.push({ kind: "adjusted", text: "Income minus the deductions on your sheet comes to " + money(figures.adjusted) + ", but the sheet shows adjusted income of " + money(f.adjusted_income) + "." });
      questions.push("My income minus the deductions comes to " + money(figures.adjusted) + ", but my sheet shows adjusted income of " + money(f.adjusted_income) + ". What makes up the difference?");
    }
    var cands = [["30% of adjusted monthly income", r2(0.30 * figures.adjusted / 12)], ["10% of monthly income", r2(0.10 * inc / 12)]];
    if (f.minimum_rent) cands.push(["the minimum rent", f.minimum_rent]);
    var top = cands[0]; cands.forEach(function (c) { if (c[1] > top[1]) top = c; });
    figures.ttp = roundDollar(top[1]);
    steps.push({ what: "Total tenant payment", how: "the highest of " + cands.map(function (c) { return c[0] + " (" + money(c[1]) + ")"; }).join(", ") + ", rounded to the dollar: " + top[0], value: figures.ttp, stated: f.ttp });
    if (f.ttp !== null && Math.abs(f.ttp - figures.ttp) >= 1) {
      findings.push({ kind: "ttp", text: "From the figures on your sheet, the total tenant payment comes to " + money(figures.ttp) + ", but the sheet shows " + money(f.ttp) + "." });
      questions.push("From the figures on my sheet, my total tenant payment comes to " + money(figures.ttp) + ", but the sheet shows " + money(f.ttp) + ". Can you explain the difference?");
    }
    var ttp = f.ttp !== null ? f.ttp : figures.ttp;
    out = rentSteps(f, ttp, steps, findings, questions, figures.adjusted);
    var interim = null;
    if (f.income_now !== null && f.income_now < inc) {
      var na = Math.max(r2(f.income_now - deds), 0), drop = figures.adjusted - na, pct = figures.adjusted ? drop / figures.adjusted * 100 : 0;
      interim = { new_adjusted: na, drop: r2(drop), percent: r1(pct),
        text: "With yearly income of " + money(f.income_now) + " now, your adjusted income would be about " + money(na) + ", a drop of " + pct1(pct) + "%. " +
          (pct >= 10 ? "That is 10% or more, so you can ask for an interim review and the housing authority should not turn it down for being too small."
            : "That is less than 10%, so the housing authority may decline an interim review unless it has set a lower threshold. You can still ask.") };
      questions.push("My income has gone down to " + money(f.income_now) + " a year. I am asking for an interim review of my rent. What proof do you need?");
    }
    return finish(f, t, steps, figures, out[0], out[1], matches, findings, questions, interim, tables, out[2]);
  }

  var LABELS = [["annual_income", "Yearly income used"], ["dependent_deduction", "Dependent deduction"], ["elderly_deduction", "Elderly or disabled family deduction"],
    ["medical_deduction", "Medical expense deduction"], ["childcare_deduction", "Child care deduction"], ["other_deduction", "Other deduction"],
    ["utility_allowance", "Utility allowance"], ["gross_rent", "Gross rent (rent plus utility allowance)"], ["payment_standard", "Payment standard"], ["your_rent", "Rent you pay"]];

  function compare(raw, today, tables) {
    var body = asMapping(raw, "old", "The figures could not be read. Enter them again.");
    if (!isObj(body.old) || !isObj(body.new)) fail({ old: "Enter the figures from both rent sheets." });
    var problems = {}, a = null, b = null;
    try { a = rent(body.old, today, tables); } catch (e) { if (!e.problems) throw e; Object.keys(e.problems).forEach(function (k) { problems["old_" + k] = e.problems[k]; }); }
    try { b = rent(body.new, today, tables); } catch (e) { if (!e.problems) throw e; Object.keys(e.problems).forEach(function (k) { problems["new_" + k] = e.problems[k]; }); }
    if (Object.keys(problems).length) fail(problems);
    delete a.on_device; delete b.on_device;
    var fa = rentClean(body.old), fb = rentClean(body.new), moved = [];
    var m = function (v) { return v === null ? "not shown" : money(v); };
    LABELS.forEach(function (l) {
      var x = fa[l[0]], y = fb[l[0]];
      if (x === null && y === null) return;
      if (x === null || y === null) moved.push({ what: l[1], old: x, new: y, text: l[1] + ": shown on only one sheet (" + m(x) + " before, " + m(y) + " now)." });
      else if (Math.abs(x - y) >= 0.005) moved.push({ what: l[1], old: x, new: y, text: l[1] + " went " + (y > x ? "up" : "down") + " from " + money(x) + " to " + money(y) + "." });
    });
    if (fa.dependents !== fb.dependents) moved.push({ what: "Dependents", old: fa.dependents, new: fb.dependents, text: "Dependents changed from " + fa.dependents + " to " + fb.dependents + "." });
    var parts = [], why = [], change, headline, ta = a.figures.ttp, tb = b.figures.ttp;
    if (a.rent === null || b.rent === null || ta === undefined || tb === undefined || ta === null || tb === null) {
      change = null; headline = "The rent change cannot be split up from these figures";
      why.push("To see why your rent changed, both sheets need the total tenant payment (or the income), and for a voucher the gross rent and payment standard.");
    } else {
      change = r2(b.rent - a.rent);
      headline = Math.abs(change) >= 0.005 ? "Your rent went " + (change > 0 ? "up" : "down") + " by " + money(Math.abs(change)) : "Your rent did not change";
      var dt = r2(tb - ta);
      if (Math.abs(dt) >= 0.005) {
        parts.push({ what: "Total tenant payment", amount: dt });
        why.push("Your total tenant payment went " + (dt > 0 ? "up" : "down") + " by " + money(Math.abs(dt)) + (fa.annual_income !== fb.annual_income && fa.annual_income !== null && fb.annual_income !== null ? " because the income used changed" : "") + ".");
      }
      if (a.program === "voucher" && b.program === "voucher") {
        var oa = Math.max(0, (fa.gross_rent || 0) - (fa.payment_standard || 0)), ob = Math.max(0, (fb.gross_rent || 0) - (fb.payment_standard || 0)), dov = r2(ob - oa);
        if (Math.abs(dov) >= 0.005) {
          parts.push({ what: "Amount the gross rent is over the payment standard", amount: dov });
          why.push("The amount your gross rent is above the payment standard went " + (dov > 0 ? "up" : "down") + " by " + money(Math.abs(dov)) + ". That comes from the owner's rent, the utility allowance or the payment standard, not your income.");
        }
      }
      var du = r2((fb.utility_allowance || 0) - (fa.utility_allowance || 0));
      if (Math.abs(du) >= 0.005) {
        parts.push({ what: "Utility allowance", amount: r2(-du) });
        why.push("The utility allowance went " + (du > 0 ? "up" : "down") + " by " + money(Math.abs(du)) + ", which " + (du > 0 ? "lowers" : "raises") + " what you pay by the same amount.");
      }
      var rest = r2(change - parts.reduce(function (s, p) { return s + p.amount; }, 0));
      if (Math.abs(rest) >= 1) parts.push({ what: "Other (for example a utility reimbursement)", amount: rest });
    }
    var questions = ["Please send me the rent calculation sheets for my last two reviews, so I can see what changed."];
    moved.forEach(function (mv) {
      if ((mv.what === "Yearly income used" || mv.what === "Dependents") && mv.old !== null && mv.new !== null) {
        var dep = mv.what === "Dependents";
        questions.push("My " + mv.what.toLowerCase() + " changed from " + (dep ? mv.old : money(mv.old)) + " to " + (dep ? mv.new : money(mv.new)) + ". What information was this based on? Please send me a copy.");
      }
      if (mv.what.toLowerCase().indexOf("deduction") >= 0 && (mv.new === null || mv.new === 0) && mv.old) questions.push("My " + mv.what.toLowerCase() + " was " + money(mv.old) + " before and is now gone. Why was it removed?");
    });
    b.questions.forEach(function (q) { if (questions.indexOf(q) < 0 && q.indexOf("Please send me the rent calculation sheet") !== 0) questions.push(q); });
    return { headline: headline, change: change, parts: parts, why: why, moved: moved, old: a, new: b, questions: questions, rules_as_of: a.rules_as_of, rules: b.rules, on_device: true,
      disclaimer: "This compares the figures you entered from two rent sheets. It was made by an independent tool, not by HUD or your housing authority. Only the housing authority can change your rent." };
  }


  /* ---------- Renewal check: a port of backend/helper/renewal.py ---------- */
  var R_PROGRAMS = ["medicaid", "snap"], R_STATES = ["FL", "other"], R_METHODS = ["online", "mail", "fax", "in_person", "unsure"], R_STATUS = ["have", "get", "unsure"];
  var R_CHECKS = [
    ["signed", "Every page that asks for a signature is signed and dated"],
    ["all_pages", "Every page of the form is included, even pages with nothing changed"],
    ["case_number", "Your name and case number are on each page you send"],
    ["copies", "You are sending copies and keeping the originals"],
    ["readable", "Each photo or copy is readable: all four corners, nothing cut off, not blurry"],
    ["changes", "Any change is reported: address, income, who lives with you"]];
  function dayNum(iso) { var p = iso.split("-").map(Number); return Date.UTC(p[0], p[1] - 1, p[2]) / 864e5; }
  function isoOf(n) { var d = new Date(n * 864e5); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
  function pyTruthy(v) { return !(v === null || v === undefined || v === "" || v === 0 || v === false); }
  function pyStr(v) { return pyTruthy(v) ? String(v === true ? "True" : v) : ""; }
  function rDate(body, key, problems, today) {
    var v = body[key];
    if (v === null || v === undefined || v === "") return null;
    var d;
    try { d = parseDate(v); } catch (e) { problems[key] = "Enter the date as month, day and year, or leave it empty."; return null; }
    if (Number(d.slice(0, 4)) < 2000 || dayNum(d) > dayNum(today) + 400) problems[key] = "Check the date printed on the notice.";
    return d;
  }
  function renewalClean(raw, today) {
    var body = asMapping(raw, "programs", "The details could not be read. Enter them again."), problems = {};
    var programs = body.programs;
    if (!Array.isArray(programs) || !programs.length || programs.some(function (p) { return R_PROGRAMS.indexOf(p) < 0; })) { problems.programs = "Choose Medicaid, SNAP or both."; programs = []; }
    var state = pyTruthy(body.state) ? body.state : "other";
    if (R_STATES.indexOf(state) < 0) problems.state = "Choose a state.";
    var method = pyTruthy(body.method) ? body.method : "unsure";
    if (R_METHODS.indexOf(method) < 0) problems.method = "Choose how you will send it.";
    var f = { programs: programs, state: state, method: method };
    ["form_due", "proof_due", "coverage_ends", "notice_date"].forEach(function (k) { f[k] = rDate(body, k, problems, today); });
    if (!f.form_due && !f.proof_due && !f.coverage_ends && !Object.keys(problems).length)
      problems.form_due = "Enter at least one date from your notice: when the form is due, when proof is due, or when coverage ends.";
    var itemsIn = pyTruthy(body.items) ? body.items : [];
    if (!Array.isArray(itemsIn) || itemsIn.length > 15) fail({ items: "Enter up to 15 items." });
    var items = [];
    itemsIn.forEach(function (it, i) {
      if (!isObj(it)) fail({ items: "An item could not be read. Enter it again." });
      var what = pyStr(it.what).trim().slice(0, 200);
      if (!what) return;
      var status = pyTruthy(it.status) ? it.status : "unsure";
      if (R_STATUS.indexOf(status) < 0) problems["i" + (i + 1) + "_status"] = "Choose one of the answers.";
      items.push({ n: i + 1, what: what, who: pyStr(it.who).trim().slice(0, 100), period: pyStr(it.period).trim().slice(0, 100), status: status });
    });
    f.items = items;
    var ticks = pyTruthy(body.checks) ? body.checks : [];
    if (!Array.isArray(ticks)) fail({ checks: "The ticks could not be read. Tick them again." });
    f.checks = R_CHECKS.map(function (c) { return c[0]; }).filter(function (k) { return ticks.indexOf(k) >= 0; });
    if (Object.keys(problems).length) fail(problems);
    return f;
  }
  function itemLine(it) {
    var extra = [it.who ? "for " + it.who : "", it.period ? "covering " + it.period : ""].filter(Boolean).join(", ");
    return it.what + (extra ? " (" + extra + ")" : "");
  }
  function renewal(raw, today, tables) {
    var f = renewalClean(raw, today), t = tables.renewal, w = tables.workrules, dates = [], T = dayNum(today);
    function add(d, label, note) {
      var left = dayNum(d) - T;
      dates.push({ date: d, label: label, note: note, days_left: left, status: left < 0 ? "passed" : (left === 0 ? "today" : "upcoming") });
    }
    if (f.form_due) add(f.form_due, "Renewal form due", "The date printed on your renewal form. Aim to send it a few days early.");
    if (f.proof_due) add(f.proof_due, "Proof due", "The date printed on the request for proof. It can be earlier than the form's date.");
    if (f.coverage_ends) {
      add(f.coverage_ends, "Coverage or benefits end", "If nothing is received by then, benefits can stop on this date.");
      if (f.programs.indexOf("medicaid") >= 0) add(isoOf(dayNum(f.coverage_ends) + t.medicaid_reconsider.days), "Medicaid: last day to send the form without a new application",
        "Only if Medicaid ends because the form was not returned. Counted as 90 days after the end date, the federal minimum; your state may allow longer.");
    }
    dates = dates.map(function (d, i) { return [d, i]; }).sort(function (a, b) { return a[0].date < b[0].date ? -1 : a[0].date > b[0].date ? 1 : a[1] - b[1]; }).map(function (x) { return x[0]; });
    var two = null;
    if (f.form_due && f.proof_due && f.form_due !== f.proof_due) two = "Your notice has two different due dates. The earlier one is " + say(f.form_due < f.proof_due ? f.form_due : f.proof_due) + ". Treat that as the date for everything, if you can.";
    var by = function (st) { return f.items.filter(function (it) { return it.status === st; }).map(itemLine); };
    var missing = by("get"), unsure = by("unsure"), have = by("have");
    var notDone = R_CHECKS.filter(function (c) { return f.checks.indexOf(c[0]) < 0; }).map(function (c) { return c[1]; });
    var due = function (d) { return d.label === "Renewal form due" || d.label === "Proof due"; };
    var upcoming = dates.filter(function (d) { return d.status !== "passed" && due(d); }), passed = dates.filter(function (d) { return d.status === "passed" && due(d); });
    var headline, n = missing.length + unsure.length;
    if (passed.length && !upcoming.length) headline = "A due date on your notice has passed";
    else if (n) headline = n + " item" + (n === 1 ? "" : "s") + " still to get or check";
    else if (notDone.length) headline = "Check " + notDone.length + " thing" + (notDone.length === 1 ? "" : "s") + " before you send it";
    else headline = "Your packet looks ready to send";
    var questions = [];
    unsure.forEach(function (u) { questions.push("What exactly do you need for: " + u + "?"); });
    if (missing.length) questions.push("I am still getting " + missing.join("; ") + ". Can I send the rest now and that item later, and by what date?");
    if (passed.length) questions.push("The due date on my notice has passed. Can I still send my papers, and is my case still open?");
    questions.push("Can you confirm you have received everything, and that nothing else is needed?");
    var rows = [t.why];
    if (f.programs.indexOf("medicaid") >= 0) rows.push(t.medicaid_auto, t.medicaid_form, t.medicaid_reconsider);
    if (f.programs.indexOf("snap") >= 0) rows.push(t.snap_proof);
    if (f.state === "FL") rows.push(t.fl_ways);
    return {
      headline: headline, dates: dates, two_dates: two, missing: missing, unsure: unsure, have: have,
      checks_left: notDone, checks_done: R_CHECKS.filter(function (c) { return f.checks.indexOf(c[0]) >= 0; }).map(function (c) { return c[1]; }),
      how: renewalHow(f, t), cover: renewalCover(f, have, missing, unsure), questions: questions,
      hearing: f.state === "FL" ? { plain: w.fl_hearing.plain, source: w.fl_hearing.source } : null,
      rules: rows.map(function (r) { return { plain: r.plain, source: r.source }; }), rules_as_of: tables.rules_as_of, on_device: true,
      disclaimer: "This is a checklist made from what you entered. It was made by an independent tool, not by any government agency. Only the agency decides your renewal. Nothing you enter here is sent to the agency."
    };
  }
  function renewalHow(f, t) {
    var fl = f.state === "FL", steps = {
      online: ["Log in to " + (fl ? "MyACCESS (myaccess.myflfamilies.com)" : "your state's benefits account") + " and choose the renewal or the upload for your case.",
        "Upload each item as its own file, named for what it is.", "Save or take a screenshot of the confirmation page, with its date and any number."],
      mail: ["Send copies, never originals, to the address on your notice.", "Write your name and case number on each page.",
        "Pay for tracking or a certificate of mailing at the post office, and keep the receipt."],
      fax: [fl ? "Put the ACCESS Florida Fax/Scanning Cover Sheet first." : "Put a cover sheet first, with your name, case number and the number of pages.",
        "Use the fax number on your notice.", "Keep the fax confirmation page that shows the pages went through."],
      in_person: ["Take copies to " + (fl ? "a local DCF office or an ACCESS community partner" : "your local office") + ".", "Ask for a dated receipt that lists what you handed in."],
      unsure: ["Use the way your notice lists first. If you can, send it two ways (for example upload, and mail a copy), and keep proof of both."]
    }[f.method];
    if (fl && f.method !== "online") steps.push("If something goes wrong, call DCF at " + t.fl_ways.phone + " and ask how else to send it.");
    else if (f.method === "online") steps.push("If the upload fails, use another way printed on your notice the same day, and write down what went wrong.");
    return steps;
  }
  function renewalCover(f, have, missing, unsure) {
    var names = { medicaid: "Medicaid", snap: "SNAP (food assistance)" };
    var lines = ["RENEWAL PAPERS ENCLOSED", "", "Name: [your name]", "Case number: [from your notice]", "Date sent: [date]", "",
      "Programs: " + f.programs.map(function (p) { return names[p]; }).join(", "), ""];
    if (have.length) { lines.push("Enclosed:"); have.forEach(function (x) { lines.push("- " + x); }); }
    if (missing.length || unsure.length) { lines.push(""); lines.push("Still to come (I will send these as soon as I have them):"); missing.concat(unsure).forEach(function (x) { lines.push("- " + x); }); }
    lines.push("", "Total pages including this one: ____", "", "Please contact me if anything else is needed. Phone: [your phone]");
    return lines.join("\n");
  }

  /* Today's date on this device, as YYYY-MM-DD. */
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  return { bill: bill, rent: rent, compare: compare, renewal: renewal, today: today };
});
