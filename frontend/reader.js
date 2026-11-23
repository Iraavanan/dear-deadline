/* Notice reader, Release 1: runs entirely on the person's device.

   redact(text)  blacks out Social Security numbers and claim numbers.
   extract(text) finds the notice date, the amount and the months by pattern.

   Nothing in this file talks to a server. The pasted text never leaves the
   page; only the details the person confirms are sent on. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NoticeReader = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var BLOCK = "█████████";
  var FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  // Full month names and their usual short forms (Jan, Jan., Sept.).
  var MONTH_RE = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?";
  function monthNumber(word) {
    var key = word.slice(0, 3).toLowerCase();
    for (var i = 0; i < 12; i++) if (FULL[i].slice(0, 3).toLowerCase() === key) return i + 1;
    return 0;
  }

  // 123-45-6789 written with hyphens, dashes, dots, spaces or nothing between
  // the groups, optionally followed by a claim suffix such as A, HA or C1.
  var SEP = "\\s*[-–—.]?\\s*";
  var SSN = new RegExp("\\b\\d{3}" + SEP + "\\d{2}" + SEP + "\\d{4}(?:[-\\s]?[A-Z][A-Z0-9]?)?\\b", "g");
  // Partly masked numbers (XXX-XX-6789, ***-**-6789): the last four digits still identify.
  var MASKED = /(^|[^A-Za-z0-9])[Xx*•#]{3}\s*[-–—.]?\s*[Xx*•#]{2}\s*[-–—.]?\s*\d{4}\b/g;
  var BNC = /\bBNC\s*#?\s*:?\s*[A-Z0-9]{6,}\b/gi;
  var LABELLED = /\b(claim\s*(?:number|no\.?|#)|social\s*security\s*(?:number|no\.?|#)|SSN)\s*:?\s*[A-Z0-9][A-Z0-9-]{5,}/gi;

  function redact(text) {
    var count = 0;
    var out = String(text === null || text === undefined ? "" : text)
      .replace(LABELLED, function (m, label) { count += 1; return label + ": " + BLOCK; })
      .replace(BNC, function () { count += 1; return "BNC#: " + BLOCK; })
      .replace(MASKED, function (m, before) { count += 1; return before + BLOCK; })
      .replace(SSN, function () { count += 1; return BLOCK; });
    return { text: out, count: count };
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  // A real calendar date or nothing: February 30 is refused rather than guessed.
  function iso(year, month, day) {
    year = Number(year); month = Number(month); day = Number(day);
    if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1990 && year <= 2100)) return null;
    var d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
    return year + "-" + pad(month) + "-" + pad(day);
  }

  // Every real date in the text, in the order it appears.
  function allDates(text) {
    var tries = [
      [new RegExp("\\b(" + MONTH_RE + ")\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b", "gi"), function (m) { return iso(m[3], monthNumber(m[1]), m[2]); }],
      [new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(" + MONTH_RE + "),?\\s+(\\d{4})\\b", "gi"), function (m) { return iso(m[3], monthNumber(m[2]), m[1]); }],
      [/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/g, function (m) { return iso(m[3], m[1], m[2]); }],
      [/\b(\d{4})-(\d{2})-(\d{2})\b/g, function (m) { return iso(m[1], m[2], m[3]); }]
    ];
    var found = [];
    tries.forEach(function (t) {
      var m;
      while ((m = t[0].exec(text))) {
        var date = t[1](m);
        if (date) found.push({ date: date, at: m.index, labelled: /(?:(?:^|\b)(?:notice |letter |statement )?date[d]?\s*[:.]?|\bdate of (?:this )?(?:notice|letter)\s*:|\b(?:prepared|issued|mailed)\s*:)\s*$/i.test(text.slice(Math.max(0, m.index - 24), m.index)) });
      }
    });
    found.sort(function (x, y) { return x.at - y.at; });
    return found;
  }

  // The notice date is the one labelled "Date:" if there is one. Otherwise only a date that sits on
  // a line by itself near the top, the way a letter is dated, counts. A date inside a sentence
  // ("Your benefits were stopped on March 9") is an event, not the notice date, so nothing is
  // guessed: the person types the date instead.
  function findDate(text) {
    var found = allDates(text);
    if (!found.length) return null;
    for (var i = 0; i < found.length; i++) if (found[i].labelled) return found[i].date;
    for (var j = 0; j < found.length; j++) {
      var f = found[j], start = text.lastIndexOf("\n", f.at - 1) + 1, end = text.indexOf("\n", f.at);
      var line = text.slice(start, end < 0 ? text.length : end).trim();
      var rest = line.split(/\s[|·•—–]\s/).pop().trim().replace(/^[A-Za-z .,'-]{0,30},\s*/, "");   // "SSA | Mar. 30, 2026" or "Baltimore, MD, November 2, 2026"
      var alone = /^(?:[A-Z][a-z]+day,?\s+)?[A-Za-z0-9 ,\/.-]{6,24}$/.test(rest) && !/[a-z]{3,}\s+(?:on|by|until|before|after|since|from|through)\b/i.test(line);
      if (alone && text.slice(0, start).split("\n").length <= 8) return f.date;
    }
    return null;
  }

  // The overpaid amount is the dollar figure closest to the words that describe
  // the overpayment. Figures described as monthly (the benefit, the amount
  // withheld) are passed over unless nothing else is there.
  function findAmount(text) {
    var money = /(?:\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?)|(?:\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?\s+dollars\b)/gi;
    var near = /(overpa\w*|paid you|too much|more .{0,30}than you (?:were due|should have)|more than you should have)/gi;
    var monthly = /(each month|a month|per month|monthly|every month)/i;
    var cues = [], k, m, all = [];
    while ((k = near.exec(text))) cues.push(k.index + k[0].length / 2);
    while ((m = money.exec(text))) {
      var whole = m[1] || m[3], cents = m[1] ? m[2] : m[4];
      var around = text.slice(Math.max(0, m.index - 28), m.index + m[0].length + 14);
      all.push({ value: Number(whole.replace(/,/g, "") + (cents ? "." + cents : "")), middle: m.index + m[0].length / 2, monthly: monthly.test(around) });
    }
    // Only a figure near words about being overpaid, and not described as monthly, is taken.
    // If there is none, nothing is guessed: a monthly payment is not the overpaid amount.
    var pool = all.filter(function (c) { return !c.monthly; });
    var best = null, bestGap = Infinity;
    pool.forEach(function (c) {
      cues.forEach(function (cue) { var gap = Math.abs(cue - c.middle); if (gap < bestGap) { bestGap = gap; best = c; } });
    });
    return best && bestGap <= 160 ? best.value : null;
  }

  function findPeriod(text) {
    var one = "(" + MONTH_RE + ")\\s+(\\d{4})";
    var m = new RegExp("\\b" + one + "\\s*(?:through|to|thru|until|and|-|–|—)\\s*" + one + "\\b", "i").exec(text);
    if (!m) return null;
    return FULL[monthNumber(m[1]) - 1] + " " + m[2] + " to " + FULL[monthNumber(m[3]) - 1] + " " + m[4];
  }

  function findBenefit(text) {
    if (/supplemental security income|\bSSI\b/i.test(text)) return "ssi";
    if (/disability/i.test(text)) return "disability";
    if (/survivor|widow/i.test(text)) return "survivor";
    if (/retirement/i.test(text)) return "retirement";
    return null;
  }

  /* Returns only what was found. Every value still has to be confirmed by the person. */
  function extract(text) {
    if (typeof text !== "string") return {};
    var clean = redact(text).text;
    var found = {};
    var date = findDate(clean); if (date) found.notice_date = date;
    var others = allDates(clean).map(function (d) { return d.date; }).filter(function (d, i, list) { return d !== date && list.indexOf(d) === i; });
    if (others.length) found.other_dates = others;   // a prompt to double-check, never used as a fact
    var amount = findAmount(clean); if (amount !== null) found.overpaid_amount = amount;
    var period = findPeriod(clean); if (period) found.period = period;
    var benefit = findBenefit(clean); if (benefit) found.benefit_type = benefit;
    return found;
  }

  /* Which letter is this? Returns "cessation", "overpayment" or null when it cannot tell.
     Used only to point the person to the right helper; they can always override it. */
  function kind(text) {
    if (typeof text !== "string") return null;
    var cessation = /(disability cessation|no longer disabled|no longer (?:have|has) a disability|disability has ended|health has improved|medical improvement|no longer meet the disability|continuing disability review)/i.test(text);
    var overpaid = /(overpa(?:id|yment)|paid you .{0,60}more|more .{0,40}than you (?:were due|should have))/i.test(text);
    if (cessation && !overpaid) return "cessation";
    if (overpaid && !cessation) return "overpayment";
    return null;
  }

  return { redact: redact, extract: extract, kind: kind, BLOCK: BLOCK };
});
