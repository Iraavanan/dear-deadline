/* Run the deployed checker against the answer key, in Node or in the browser. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    const fs = require("node:fs"), path = require("node:path");
    const engine = require("./notice-evidence.js");
    const score = factory(engine);
    module.exports = score;
    if (require.main === module) {
      const args = process.argv.slice(2);
      if (args[0] === "--notice" && args[1]) {
        const txt = fs.readFileSync(args[1], "utf8");
        console.log(JSON.stringify(engine.inspect(txt, args.includes("--all-pages")), null, 2));
      } else {
        const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname,"examples.json"),"utf8"));
        const actual = score(fixtures);
        if (args[0] === "--verify") {
          const saved = JSON.parse(fs.readFileSync(path.join(__dirname,"results.json"),"utf8"));
          require("node:assert/strict").deepEqual(actual,saved);
          console.log("Reproduced " + actual.cases + " examples and " + actual.decisions + " field decisions.");
        } else console.log(JSON.stringify(actual,null,2));
      }
    }
  } else root.scoreNoticeExamples = factory(root.NoticeEvidence);
})(typeof self !== "undefined" ? self : this, function (engine) {
  "use strict";
  return function score(fixtures) {
    const result = {checker_version:engine.version,corpus_version:fixtures.version,fixture_date:fixtures.date,
      cases:fixtures.cases.length,families:fixtures.families.length,decisions:0,matched:0,abstentions:0,
      known_omissions:0,omissions_flagged:0,omissions_suggested_present:0,omissions_deferred:0,
      intact_fields:0,false_flags_intact:0,intact_fields_deferred:0,intact_examples:0,intact_examples_flagged:0,
      partial_missing_fields:0,partial_missing_deferred:0,ambiguous_suggested_present:0,rows:[]};
    for (const c of fixtures.cases) {
      const observed=engine.inspect(c.text,c.all_pages), actual={};
      let flag=false;
      for (const field of engine.fields) {
        const truth=c.expected[field].state, state=observed[field].state;
        actual[field]=state;
        result.decisions++;
        if(state===truth)result.matched++;
        if(state==="unclear")result.abstentions++;
        if (truth==="not_located") {
          result.known_omissions++;
          if(state==="not_located")result.omissions_flagged++;
          else if(state==="found")result.omissions_suggested_present++;
          else result.omissions_deferred++;
        }
        if (truth==="unclear" && state==="found")result.ambiguous_suggested_present++;
        if (c.variant==="intact") {
          result.intact_fields++;
          if(state==="not_located"){result.false_flags_intact++;flag=true;}
          if(state==="unclear")result.intact_fields_deferred++;
        }
        if (!c.all_pages && !c.expected[field].evidence.length) {
          result.partial_missing_fields++;
          if(state==="unclear")result.partial_missing_deferred++;
        }
      }
      if(c.variant==="intact"){result.intact_examples++;if(flag)result.intact_examples_flagged++;}
      result.rows.push({id:c.id,actual});
    }
    const excerpt = fixtures.official_excerpt;
    const observed = engine.inspect(excerpt.text, false);
    result.official_excerpt = {source:excerpt.source, checked:0, matched:0, actual:{}};
    for (const [field, expected] of Object.entries(excerpt.expected)) {
      result.official_excerpt.actual[field] = observed[field].state;
      result.official_excerpt.checked++;
      if (observed[field].state === expected) result.official_excerpt.matched++;
    }
    return result;
  };
});
