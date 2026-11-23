/* Evidence suggestions for five parts of an initial Title II overpayment notice.
   Run the same function in the browser and in the downloadable benchmark. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NoticeEvidence = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const version = "1.0.0";
  const fields = ["cause", "months", "paid_due", "recon", "waiver"];
  const amounts = /\$\s*\d[\d,]*(?:\.\d{2})?/g;
  const month = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(?:19|20)\d{2}\b|\b(?:0?[1-9]|1[0-2])\/(?:19|20)\d{2}\b/i;
  const concreteCause = /\b(?:earn(?:ed|ings)|wages|worked|work resumed|pension|marri(?:ed|age)|divorc(?:e|ed)|custody|incarcerat(?:ed|ion)|returned to work|no longer (?:disabled|a student)|entitlement ended|workers.? compensation|duplicate payment|living arrangement|no longer in your care|left school|ceased attending|stopped attending)\b/i;
  const reason = /\bbecause\b|\bdue to\b|\bresult(?:ed|ing) (?:from|in)\b|\b(?:reason|caused by|this happened|rate change)\b/i;
  const payment = /\b(?:paid|received|sent|deposited)\b/i;
  const payable = /\b(?:should have|should only have|was due|were due|was payable|correct (?:monthly )?(?:amount|payment)|entitled to)\b/i;
  const acts = /\b(?:you (?:may|can|have (?:the|a) right to)|your right to|ask (?:us )?(?:for|to)|request (?:a |an |that )?|file (?:a |an )?)\b/i;
  const restates = /\b(?:no right|not entitled to (?:an? )?(?:appeal|waiver)|cannot (?:appeal|request)|does not explain|information (?:is )?missing)\b/i;
  function segments(text) {
    const entries = [];
    let page = null;
    let newPage = 1;
    // Empty-line paragraphs keep unrelated sections apart. Page numbers are reported only when supplied.
    for (const raw of String(text || "").slice(0, 250000).replace(/\r\n?/g, "\n").split(/(\f|\n[ \t]*(?:---\s*)?Page\s+\d+(?:\s+of\s+\d+)?(?:\s*---)?[ \t]*(?:\n|$))/i)) {
      if (raw === "\f") { page = ++newPage; continue; }
      const marker = raw.trim().match(/^(?:---\s*)?Page\s+(\d+)(?:\s+of\s+\d+)?(?:\s*---)?$/i);
      if (marker) { page = Number(marker[1]); newPage = page; continue; }
      for (const paragraph of raw.split(/\n\s*\n/)) {
        const lines = paragraph.trim().replace(/^Page\s+(\d+)(?:\s+of\s+\d+)?\s*\n/i, (_, n) => {
          page = Number(n); newPage = page; return "";
        }).split(/\n/).flatMap(line => line.split(/(?<=[.!?])\s+(?=[A-Z“])/)).map(x => x.trim()).filter(Boolean);
        for (let i = 0; i < lines.length; i++) {
          entries.push({text: lines[i], page});
          if (i + 1 < lines.length) entries.push({text: lines[i] + " " + lines[i + 1], page, joined: true});
        }
      }
    }
    return entries;
  }
  function namedRight(s, word) {
    return word.test(s) && acts.test(s) && !restates.test(s) && !/\bwe (?:received|denied) your\b/i.test(s);
  }
  const tests = {
    cause: s => reason.test(s) && concreteCause.test(s) && !/\b(?:if|example|for instance)\b/i.test(s) && !restates.test(s),
    months: s => month.test(s) && /\b(?:overpa\w*|too much|period|covered|deb[t]|for (?:the month of )?|from\b|through\b|to\b)/i.test(s) &&
      !/\b(?:withhold\w*|starting your (?:recovery|repayment)|appeal by|begin collecting)\b/i.test(s),
    paid_due: s => (s.match(amounts) || []).length >= 2 && payment.test(s) && payable.test(s),
    recon: s => namedRight(s, /\b(?:reconsideration|appeal|SSA-561)\b/i),
    waiver: s => namedRight(s, /\bwaiv(?:e|er)\b|not to (?:collect|recover)|SSA-632/i)
  };
  const hints = {
    cause: reason, months: month, paid_due: payable,
    recon: /\bappeal\b|reconsideration|SSA-561/i, waiver: /\bwaiv(?:e|er)\b|SSA-632/i
  };
  const questions = {
    cause: "What event changed my benefit, and on what date did it affect my payment?",
    months: "Which month or months does this overpayment cover?",
    paid_due: "For each affected period, how much did you pay me and how much do you say was due?",
    recon: "How can I request reconsideration, and which date applies to my appeal?",
    waiver: "How can I ask Social Security to waive recovery of this overpayment?"
  };
  function inspect(text, allPages) {
    const lines = segments(text);
    if (String(text || "").length > 250000) allPages = false;
    const readable = /[a-z]{2}[\s\S]*[a-z]{2}/i.test(String(text || ""));
    const result = {};
    for (const field of fields) {
      // A neighboring line can finish a wrapped sentence or a paid/payable row.
      // Prefer a self-contained line to combining unrelated sentences.
      const direct = lines.find(l => !l.joined && tests[field](l.text));
      const combined = direct || lines.find(l => l.joined && tests[field](l.text) &&
        (field === "paid_due" || !/[.!?]["']?\s/.test(l.text.replace(/\.\d\d\b/g, ""))));
      const hint = combined || lines.find(l => !l.joined && hints[field].test(l.text));
      const state = combined ? "found" : hint || !allPages || !readable ? "unclear" : "not_located";
      let question = questions[field];
      if (field === "cause" && !combined && hint && /\brate (?:changed?|change)\b/i.test(hint.text)) {
        question = "My notice refers to a rate change. What changed my rate, when did it take effect, and how did you calculate the corrected monthly amount?";
      }
      result[field] = {state, quote: hint ? hint.text.slice(0, 380) : "", page: hint ? hint.page : null, question};
    }
    return result;
  }
  return {version, fields, inspect};
});
