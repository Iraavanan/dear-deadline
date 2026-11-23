/* Browser-only preparation worksheets. Amounts are compared in cents. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BenefitWorksheets = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const dollars = cents => (cents / 100).toLocaleString("en-US", {style: "currency", currency: "USD"});
  function cents(value, label) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return null;
    if (!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) throw Error("Enter " + label + " as a nonnegative amount with up to two decimal places.");
    const pieces = raw.replace(/[$,]/g, "").split(".");
    const total = Number(pieces[0]) * 100 + Number((pieces[1] || "").padEnd(2, "0"));
    if (!Number.isSafeInteger(total) || total > 99999999999) throw Error("Check the size of " + label + ".");
    return total;
  }
  function day(value) {
    if (!value) return null;
    if (!/^(19|20)\d\d-\d\d-\d\d$/.test(value)) throw Error("Check the date on the letter.");
    const parsed = new Date(value + "T12:00:00Z");
    if (isNaN(parsed) || parsed.toISOString().slice(0, 10) !== value) throw Error("Check the date on the letter.");
    return parsed;
  }
  const dateLabel = dt => dt.toLocaleDateString("en-US", {timeZone: "UTC", month: "long", year: "numeric", day: "numeric"});
  const monthLabel = dt => dt.toLocaleDateString("en-US", {timeZone: "UTC", month: "long", year: "numeric"});
  function result(title, sources) { return {title, summary: "", rows: [], questions: [], bring: [], notes: [], sources}; }

  function wages(input, rules) {
    const out = result("My SSI wage review worksheet", ["ssi_wages", "ssi_report"]);
    const used = new Set(), disputed = [], incomplete = [];
    for (const row of input.rows) {
      if (!row.month && ![row.stubs, row.receipt, row.agency, row.reported].some(x => String(x || "").trim())) continue;
      if (!/^(19|20)\d\d-(0[1-9]|1[0-2])$/.test(row.month || "")) throw Error("Choose a wage month for each row you use.");
      if (used.has(row.month)) throw Error("Use one row per wage month. Add together paychecks received in the same month.");
      used.add(row.month);
      const stub = cents(row.stubs,"the gross pay on your stubs");
      const reported = cents(row.receipt,"the wages on your reporting receipt");
      const agency = row.basis === "wages" ? cents(row.agency,"SSA’s gross wages") : null;
      const received = day(row.reported);
      const m = day(row.month + "-01"), name = monthLabel(m);
      const payment = new Date(m);
      payment.setUTCMonth(payment.getUTCMonth() + rules.ssi_usual_lag_months);
      const values = [stub, reported, agency].filter(x => x !== null);
      let status;
      if (values.length === 0) status = "No comparable wage amounts entered";
      else if (new Set(values).size > 1) status = "Amounts differ";
      else if (agency === null) status = "SSA’s wage figure needs confirmation";
      else if (values.length < 2) status = "Another wage record is needed";
      else status = "Entered wage amounts agree";
      const display = val => val === null ? "Unknown" : dollars(val);
      out.rows.push([name, display(stub), display(reported) + (received ? " · " + dateLabel(received) : ""), display(agency), status, monthLabel(payment)]);
      if (status === "Amounts differ") disputed.push(name);
      else if (status !== "Entered wage amounts agree") incomplete.push(name);
    }
    if (!used.size) throw Error("Add at least one wage month.");
    out.columns = ["Wage month", "Pay stubs", "Reported wages", "SSA gross wages", "What to check", "Usual SSI payment month"];
    out.summary = "Check gross pay by the month it was received. A benefit payment or countable income is a different figure.";
    if (disputed.length) out.questions.push("Please reconcile the different figures for " + disputed.join(", ") + ". Which gross wages and pay dates did SSA use?");
    if (incomplete.length) out.questions.push("Can SSA provide a wage breakdown for " + incomplete.join(", ") + " and identify the payment month affected?");
    out.notes.push("The final column shows the usual two-month lag. Confirm the actual budget month with SSA, especially when SSI starts or restarts.");
    out.bring = ["Pay stubs with pay dates for each month shown.", "Wage-report receipts and the pages showing SSA’s wage figures.", "Keep a copy of the worksheet and ask for a written breakdown. Follow any separate appeal deadline on your notice."];
    return out;
  }

  function medicaid(input, rules) {
    const out = result("My questions about working and keeping Medicaid", ["ssi_medicaid", "ssi_threshold", "individual_threshold"]);
    const conditions = [
      ["cash", "Did I have at least one month of regular SSI cash eligibility before Section 1619?"],
      ["prior", "Was I eligible for Medicaid in the month before entering Section 1619?"],
      ["reason", "Are earnings what stopped or may stop my SSI cash payment?"],
      ["disability", "Does SSA consider me blind or still disabled under its rules?"],
      ["other", "Do I still meet the other SSI conditions, including resources and other income?"],
      ["need", "Does my situation meet the Medicaid-use requirement for working?"]
    ];
    const amount = cents(input.earnings, "annual gross earnings");
    const standard = input.state === "FL" ? rules.florida_1619b[input.year] : undefined;
    out.summary = "Section 1619(b) may allow Medicaid to continue when earnings stop SSI cash. Ask SSA to confirm your status before making a change based on this worksheet.";
    if (input.benefit !== "ssi") {
      out.summary = "First confirm whether you receive SSI. Section 1619(b) is an SSI work protection. If you receive SSDI alone, ask about the Medicare work rules that apply to you.";
      out.questions.push("Which disability benefit and health coverage are on my record?");
    } else {
      conditions.forEach(([key, q]) => {
        if (input[key] !== "yes") out.questions.push(q);
      });
      if (standard) {
        out.rows.push(["Florida • " + input.year, dollars(standard * 100), amount === null ? "Not entered" : dollars(amount)]);
        out.columns = ["State and year", "Standard annual threshold", "Expected annual gross earnings"];
        if (amount === null) out.questions.push("Which annual gross earnings should I compare with Florida’s figure?");
        else if (amount > standard * 100) out.questions.push("My estimate exceeds the state figure. Can SSA calculate an individual threshold using my Medicaid costs, work expenses or publicly funded attendant care?");
        else out.questions.push("My estimate is at or below the state figure. Do I meet the other conditions for continued coverage?");
      } else out.questions.push("What state and year threshold applies to my situation, and could an individualized threshold apply?");
    }
    out.notes = ["A state threshold is one part of the decision. Ask SSA about an individual threshold if medical costs or work expenses are high.", "For the Medicaid-use test, tell SSA about care used in the past 12 months, care you expect in the next 12 months, or why you could not pay for unexpected care."];
    out.bring = ["SSI and Medicaid notices, plus your estimated gross pay for the year.", "Amounts for relevant work expenses, Medicaid services and attendant care. Keep the records on your device."];
    return out;
  }

  function earnings(input, rules, today) {
    const out = result("My Social Security earnings correction worksheet", ["wages_record", "wages_boxes", "wages_cap", "wages_form"]);
    const cap = rules.wage_base[input.year];
    if (!cap) throw Error("Choose a year covered by the worksheet.");
    if (input.scope !== "one") {
      out.summary = "Your SSA record combines covered earnings for the whole year. A comparison with one W-2 cannot resolve this year.";
      out.questions = ["Can SSA help me reconcile all employers, corrected W-2s or self-employment earnings for " + input.year + "?"];
    } else {
      const box3 = cents(input.box3,"W-2 box 3"), tips = cents(input.box7,"W-2 box 7") || 0;
      const record = input.recordState === "shown" ? cents(input.record,"taxed Social Security earnings") : null;
      if (box3 === null) throw Error("Enter W-2 box 3, including zero if it actually shows zero.");
      if (input.recordState === "shown" && record === null) throw Error("Enter the amount shown, or choose that no entry appears.");
      const expected = box3 + tips;
      if (expected > cap * 100 || (record !== null && record > cap * 100)) throw Error("A figure exceeds the year’s Social Security wage base. Check the year and boxes 3 and 7, and use the taxed Social Security column on your record.");
      const checkInAugust = new Date(Date.UTC(Number(input.year) + 1, 7, 1));
      const currentDate = today || new Date();
      const early = currentDate.getTime() < checkInAugust.getTime();
      out.columns = ["Year", "W-2 boxes 3 + 7", "SSA record", "Difference (W-2 minus record)"];
      out.rows.push([input.year, dollars(expected), record === null ? "No posted entry supplied" : dollars(record), record === null ? "Unknown" : dollars(expected-record)]);
      if (record === null && expected === 0) {
        out.summary = "This W-2 lists zero covered wages and tips. It provides no positive amount to compare with the unposted year.";
        out.questions.push("If I think these wages should have been covered, which records should I check with my employer or SSA?");
      } else if (record !== null && record === expected) out.summary = "The two figures you entered agree for " + input.year + ".";
      else {
        out.summary = early ? "This year may still be posting. SSA suggests checking the previous year’s record in August." : "This year’s record is worth checking with Social Security.";
        out.questions.push("Please review my covered earnings for " + input.year + ". My W-2 shows " + dollars(expected) + " and my Social Security record " + (record === null ? "has no entry that I can find." : "shows " + dollars(record) + ".") + " What evidence do you need to review it?");
      }
    }
    out.bring = ["The W-2 or W-2c and a copy of the earnings-record entry for that year.", "If a W-2 is unavailable, ask SSA about pay slips, a tax return, employer details and dates worked."];
    out.notes = ["Use the official SSA correction route or form SSA-7008. SSA applies time limits and exceptions. Raise an older discrepancy promptly.", "This worksheet compares reported earnings. It does not calculate a change to a retirement payment."];
    return out;
  }

  function femaHint(text) {
    const s = String(text || "");
    const residence = /\b(?:occupancy|occup(?:ied|y)|liv(?:ed|e) (?:at|in)|primary (?:home|residence)|proof of (?:address|residence))\b/i.test(s);
    if (!residence) return "unknown";
    const request = /\b(?:please (?:provide|send|submit)|(?:need|request)(?:ed)? (?:more|additional|proof|documents)|must (?:provide|submit)|send (?:us )?proof)\b/i.test(s);
    const decision = /\b(?:not eligible|ineligible|denied|not approved|cannot approve|could not approve)\b/i.test(s);
    if (decision && request) return "both";
    return decision ? "decision" : request ? "request" : "unknown";
  }
  const proofOptions = {
    lease: "Copy of a lease or rental agreement showing where you lived.",
    utility: "A utility statement identifying you and the damaged address.",
    employer: "An employer statement confirming the residence and relevant dates.",
    official: "An eligible public official’s or school official’s written statement confirming occupancy.",
    none: "Ask FEMA which alternative occupancy documents it can accept for your living situation."
  };
  function fema(input, rules) {
    const out = result("My FEMA occupancy response checklist", ["fema_proof","fema_appeal","fema_account"]);
    const decision = input.kind === "decision" || input.kind === "both";
    const request = input.kind === "request" || input.kind === "both";
    if (decision && request) out.summary = "Your letter gives a decision and asks for proof. Prepare the evidence and follow the appeal instructions if you disagree.";
    else if (decision) out.summary = "You identified a decision you may want FEMA to review. Use the appeal instructions on your decision letter.";
    else if (request) out.summary = "You identified a request for occupancy proof. Send the requested documents by the date and method shown in the letter.";
    else out.summary = "Confirm whether this is an evidence request, a decision or both. Keep any deadline printed on the letter in view while you check.";
    const printed = day(input.due);
    const dated = decision ? day(input.date) : null;
    if (printed) out.notes.push("Deadline or response date you copied from your letter: " + dateLabel(printed) + ".");
    if (dated) {
      dated.setUTCDate(dated.getUTCDate() + rules.fema_appeal_days);
      out.notes.push("FEMA’s usual appeal window is 60 days from the decision letter. That gives " + dateLabel(dated) + " from the date entered. Compare this with the instructions and act promptly if the dates differ or have passed.");
    } else if (decision) out.notes.push("FEMA’s usual appeal window is 60 days from the date of the decision letter. Check that date today.");
    out.questions = [request ? "Which of my documents will establish I occupied the damaged home as my primary residence at the time of the disaster?" : "Does this letter require an appeal, documents, or both, and which deadline applies?"];
    out.bring = (input.proof || []).filter(k => proofOptions[k]).map(k => proofOptions[k]);
    if (!out.bring.length) out.bring.push(proofOptions.none);
    out.notes.push("Check names, the damaged address and the dates on the proof. Keep originals and a copy of what you submit. Use your DisasterAssistance.gov account, a disaster recovery center or the address on the letter. Add any required case identifiers only to the copy you send to FEMA.");
    return out;
  }
  return {wages, medicaid, earnings, fema, femaHint, proofOptions};
});
