/* Works out which letter a piece of text most looks like, from the catalogue in rules/letters.json.

   Runs in the browser; the text is not sent anywhere. Each letter has a few
   telling phrases. A phrase from the letter's own title counts for more than a
   phrase that only tends to appear in it. The result is a suggestion: the
   person always confirms which letter they have. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LetterFind = factory();
})(this, function () {
  "use strict";

  // [strong phrases (3 points each)], [supporting phrases (1 point each)]
  var CUES = {
    "overpayment": [[/overpayment/i, /overpaid/i, /paid you (\$[\d,.]+ )?more/i, /received (\$[\d,.]+ )?more than you should have/i], [/more .{0,40}than you (were|are) due/i, /pay (this|us|it) back/i, /waive/i, /refund/i, /we will withhold/i]],
    "disability-ended": [[/no longer disabled/i, /disability (has )?ended/i, /disability cessation/i, /no longer meet the disability rules/i, /disability benefits will (end|stop)/i], [/health has improved/i, /medical review/i, /condition (got|is) better/i, /continue your (payments|benefits)/i, /able to work/i, /continuing disability review/i, /payments will stop/i]],
    "decision-denied": [[/disapproved claim/i, /notice of reconsideration/i, /notice of decision/i, /appeals council/i, /not disabled under our rules/i], [/unfavorable/i, /denied your (claim|request)/i, /first decision was correct/i, /administrative law judge/i, /you do not qualify/i]],
    "award": [[/notice of award/i, /you are entitled to/i], [/we (have )?approved/i, /your first (payment|check)/i, /monthly benefit(s)? (will be|of)/i, /back payment/i, /past[- ]due benefits/i]],
    "ssi-planned-action": [[/notice of planned action/i, /planned action/i], [/supplemental security income/i, /\bSSI\b/, /we (plan|are going) to (lower|reduce|stop|change)/i, /beginning (with )?(the month of )?\w+ \d{4}/i]],
    "ssi-redetermination": [[/redetermination/i, /ssa-?820[23]/i], [/review (of )?your (ssi|supplemental security income)/i, /income,? resources/i, /living arrangements?/i, /we will call you on/i]],
    "disability-update": [[/disability update report/i, /ssa-?455/i], [/continuing disability review/i, /within the last 2 years/i, /has your doctor told you/i, /better,? same,? or worse/i]],
    "payee-report": [[/representative payee report/i, /ssa-?62(3|30|34)/i], [/representative payee/i, /how (you|the benefits were) (used|spent)/i, /conserved funds/i, /report period/i]],
    "irmaa": [[/income-related monthly adjustment/i, /\bIRMAA\b/], [/modified adjusted gross income/i, /higher .{0,30}premium/i, /tax return/i, /life-changing event/i, /part b/i]],
    "extra-help": [[/extra help/i, /low[- ]income subsidy/i], [/prescription drug (plan )?costs/i, /part d/i, /medicare/i]],
    "msn": [[/medicare summary notice/i, /this is not a bill/i], [/claims? for part [ab]/i, /medicare (paid|approved)/i, /maximum you may be billed/i, /service(s)? provided/i]],
    "ma-denial": [[/notice of denial of medical coverage/i, /denial of medical coverage or payment/i], [/medicare advantage/i, /health plan/i, /reconsideration/i, /(denied|not approve)/i]],
    "partd-denial": [[/denial of medicare (part d )?prescription drug coverage/i, /coverage determination/i], [/drug plan/i, /part d/i, /prescri(ption|ber)/i, /formulary/i, /redetermination/i]],
    "nomnc": [[/notice of medicare non-?coverage/i], [/services? will end/i, /skilled nursing/i, /home health/i, /hospice/i, /quality improvement organization|\bQIO\b/i]],
    "hospital-im": [[/important message from medicare/i], [/rights as a hospital/i, /discharge/i, /inpatient/i, /quality improvement organization|\bQIO\b/i]],
    "premium-bill": [[/medicare premium bill/i, /cms-?500/i, /delinquent bill/i], [/payment in full due/i, /premium/i, /amount due/i, /easy pay/i]],
    "cola": [[/cost[- ]of[- ]living adjustment/i, /\bCOLA\b/], [/new (monthly )?(benefit )?amount/i, /beginning (in )?january/i, /medicare (part b )?premium/i]],
    "ssa-1099": [[/SSA-?1099/i, /benefit statement/i], [/box 5/i, /net benefits/i, /tax return/i]],
    "work-report": [[/work activity report/i, /SSA-?821/i], [/tell us about your work/i, /employer/i, /pay stubs?/i, /work expenses/i]],
    "medical-exam": [[/consultative exam/i, /special exam(ination)?/i, /exam(ination)? appointment/i], [/state agency|disability determination services/i, /travel/i, /confirm (that )?you will attend/i, /interpreter/i]],
    "hearing-notice": [[/notice of hearing/i], [/administrative law judge/i, /75 days/i, /5 business days/i, /ways to (attend|appear)/i, /time and place/i]],
    "show-cause": [[/request to show cause/i, /failure to appear/i], [/did not (appear|attend)/i, /dismiss/i, /hearing/i]],
    "age-18": [[/age[- ]18/i, /adult (disability )?rules/i, /turn(ed)? 18/i], [/supplemental security income|\bSSI\b/i, /redetermination/i, /section 301/i]],
    "part-d-lep": [[/late enrollment penalty/i, /\bLEP\b/], [/creditable (prescription )?drug coverage/i, /63 (or more )?days/i, /reconsideration request form/i, /part d/i]],
    "anoc": [[/annual notice of change/i, /\bANOC\b/], [/open enrollment/i, /october 15/i, /december 7/i, /january 1/i]],
    "abn": [[/advance beneficiary notice/i, /\bABN\b/], [/option 1/i, /option 3/i, /choose one option/i, /medicare (may|probably) not pay/i]]
  };

  /* Returns [{id, score}], best first, leaving out letters with nothing found. */
  function rank(text) {
    text = String(text || "");
    var out = [];
    Object.keys(CUES).forEach(function (id) {
      var score = 0;
      CUES[id][0].forEach(function (re) { if (re.test(text)) score += 3; });
      CUES[id][1].forEach(function (re) { if (re.test(text)) score += 1; });
      if (score >= 3) out.push({ id: id, score: score });
    });
    return out.sort(function (a, b) { return b.score - a.score; });
  }

  return { rank: rank, IDS: Object.keys(CUES) };
});
