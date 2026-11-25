/* Built by tools/make_es_js.py from frontend/scamcheck.js. Do not edit: change the English file or tools/es_js_text.py. */
/* Looks for the warning signs of a government imposter scam in a piece of text: the general
   signs, plus the signs of the program the message claims to be about.

   The signs are the ones Social Security and its Inspector General publish
   (see rules/scam.json). This runs in the browser; the text is not sent
   anywhere. It can only say that signs were or were not found. It can never
   say a message is genuine. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ScamCheck = factory();
})(this, function () {
  "use strict";

  var PATTERNS = {
    pay_method: /\b(gift ?cards?|google play|itunes|apple (gift )?cards?|steam cards?|target cards?|prepaid (debit )?cards?|green ?dot|bitcoins?|crypto ?currenc(y|ies)|crypto\b|btc\b|wire (transfer|the money|money)|western union|moneygram|gold bars?|precious metals?|cash (by|in the|through the) mail|mail(ing)? (the )?cash|send (the )?cash)/i,
    pressure: /\b(immediately|right away|right now|within (the next )?\d+ (hours?|minutes?)|act now|urgent(ly)?|final (notice|warning)|last (chance|warning)|arrest(ed)?|warrant|legal action|lawsuit|sued|police|sheriff|jail|prison|deport(ed|ation)?)\b/i,
    problem_or_prize: /((social security number|ssn|social security account|account|benefits?) (has|have|was|were|will be) (been )?(suspended|compromised|blocked|frozen|terminated|cancell?ed|flagged|linked|used)|suspicious activit(y|ies)|fraudulent activit(y|ies)|criminal activit(y|ies)|money laundering|drug trafficking|you('ve| have)? won|prize|lottery|sweepstakes|unclaimed (funds|money))/i,
    personal_info: /(?<!\b(?:not|never|n't)\s+(?:need to\s+)?)\b(verify|confirm|provide|send|update|enter|give|share|reply with) (us |me )?(your |the )?(full )?(social security number|ssn|social|identity|bank(ing)? (account|details|information|info)|account (number|details)|routing number|card number|password|pin\b|date of birth|log-?in|medicare number)/i,
    protect_money: /((safe|secure|protected|protection|government|federal) (account|wallet|locker|vault)|(transfer|move|withdraw|deposit) (all )?(of )?(your |the )?(money|funds|savings|cash) (to|into|in order to|so that)|protect your (money|funds|assets|savings))/i,
    meet_in_person: /((courier|agent|officer|driver|someone|representative) will (come|pick up|collect|meet|arrive|stop by)|pick ?up (the |your )?(cash|package|gold|cards?|money|box)|hand (it|the cash|the money|the package) (over )?to)/i,
    secrecy: /((do not|don't|never|cannot|can't) (tell|inform|discuss|talk|speak|mention)|keep (this|it|the matter|this matter|this call) (a )?(secret|confidential|private|between us)|confidential (matter|investigation|case)|(do not|don't) hang up|stay on the (line|phone))/i,
    badge: /((badge|credentials?) (number|no\.?|id|#|photo|image|picture|attached|is)|attached (badge|id|credentials?)|officer id|special agent)/i
  };
  /* Signs that belong to one program. They are looked for only when the message claims to be about it. */
  /* A word like "pay" or "share" counts only when it is not negated, as in "you do not need to pay" or "never share". */
  var NOT = "(?<!\\b(?:not|never|no|n't|nothing to)\\s+(?:need to\\s+|have to\\s+|be asked to\\s+|ask you to\\s+)?)";
  var PAYS = NOT + "\\b(?:pay|payment|fee|charge|credit card|debit card|card number|\\$\\s?\\d+)\\b";
  var OWN = {
    mc_free: { program: "medicare", re: /\bfree\b[^.!?\n]{0,40}\b(braces?|equipment|genetic|dna|tests?|testing|kits?|wheelchairs?|scooters?|glucose|monitors?|supplies|hearing aids?|gifts?)\b/i },
    mc_number: { program: "medicare", re: new RegExp(NOT + "\\b(?:give|provide|confirm|verify|send|share|reply with|tell us|read)\\b[^.!?\\n]{0,40}\\b(?:medicare (?:number|id|card number|beneficiary identifier)|mbi)\\b", "i") },
    mc_sell: { program: "medicare", re: /\b(new (medicare )?card|replace your (medicare )?card)\b[^\n]{0,60}\b(fee|pay|\$|verify|confirm)\b|\b(visit your home|come to your home|come to your house)\b/i },
    snap_pin: { program: "snap", re: new RegExp(NOT + "\\b(?:give|provide|enter|confirm|verify|send|share|reply with|tell us|read)\\b[^.!?\\n]{0,40}\\b(?:pin|card number|card no)\\b", "i") },
    snap_locked: { program: "snap", re: /\b(ebt|snap|food stamps?|benefits? card|food assistance)\b[^.!?\n]{0,60}\b(locked|deactivated|suspended|frozen|blocked|disabled|expired|on hold)\b/i },
    md_pay: { program: "medicaid", re: new RegExp("(?:" + PAYS + "[^\\n]{0,60}\\b(?:medicaid|coverage|renew|renewal|reinstate|re-?enroll)\\b|\\b(?:medicaid|coverage|renew|renewal|reinstate|re-?enroll)\\b[^\\n]{0,60}" + PAYS + ")", "i") },
    h_fee: { program: "housing", re: new RegExp("(?:\\b(?:section 8|housing choice|wait ?list|waiting list|voucher|housing lottery)\\b[^\\n]{0,80}" + PAYS + "|" + PAYS + "[^\\n]{0,80}\\b(?:section 8|wait ?list|waiting list|voucher)\\b)", "i") }
  };

  var URL = /\b((https?:\/\/|www\.)[^\s<>"')]+|[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|info|biz|xyz|top|online|site|club|co|us|io|ru|cn|link|click|live|app|support)\b[^\s<>"')]*)/ig;
  var ATTACHMENT = /\b(attachment|attached (file|document|statement|pdf|form)|download (your|the|it|here)|open the (file|document|attachment)|click (here|the link|below|on the link)|tap (here|the link))/i;

  function snippet(text, at, length) {
    var from = Math.max(0, at - 30), to = Math.min(text.length, at + length + 30);
    return (from > 0 ? "…" : "") + text.slice(from, to).replace(/\s+/g, " ").trim() + (to < text.length ? "…" : "");
  }

  function host(url) {
    var h = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[\/?#:]/)[0].toLowerCase();
    return h.replace(/\.+$/, "");
  }

  /* Every web address in the text, with whether it ends in .gov. A look-alike such as ssa-gov.com does not. */
  function links(text) {
    var out = [], seen = {}, m;
    URL.lastIndex = 0;
    while ((m = URL.exec(String(text || ""))) !== null) {
      var h = host(m[0]);
      if (!h || seen[h] || /@$/.test(String(text).slice(Math.max(0, m.index - 1), m.index))) continue;   // skip the domain of an email address
      seen[h] = true;
      out.push({ host: h, gov: /(^|\.)gov$/.test(h) });
    }
    return out;
  }

  /* Returns [{id, quote}] for each sign found. `program` adds that program's own signs:
     ssa, medicare, snap, medicaid, housing or other. Without it, only the general signs are looked for. */
  function scan(text, program) {
    text = String(text || "");
    var found = [];
    Object.keys(PATTERNS).forEach(function (id) {
      var m = PATTERNS[id].exec(text);
      if (m) found.push({ id: id, quote: snippet(text, m.index, m[0].length) });
    });
    Object.keys(OWN).forEach(function (id) {
      if (OWN[id].program !== program) return;
      var m = OWN[id].re.exec(text);
      if (m) found.push({ id: id, quote: snippet(text, m.index, m[0].length) });
    });
    var bad = links(text).filter(function (l) { return !l.gov; });
    var att = ATTACHMENT.exec(text);
    if (bad.length) found.push({ id: "link", quote: "Dirección web que no es una dirección .gov: " + bad.map(function (l) { return l.host; }).slice(0, 3).join(", ") });
    else if (att) found.push({ id: "link", quote: snippet(text, att.index, att[0].length) });
    return found;
  }

  return { scan: scan, links: links, IDS: Object.keys(PATTERNS).concat(["link"]), OWN_IDS: Object.keys(OWN) };
});
