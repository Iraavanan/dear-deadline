(function () {
  "use strict";
  const byId=id=>document.getElementById(id);
  const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  const names={cause:"Reason for the change",months:"Period affected",paid_due:"Paid versus due",recon:"Right to reconsideration",waiver:"Right to ask for a waiver"};
  const labels={found:"Passage found",unclear:"Needs confirmation",not_located:"Not located in supplied text"};
  function get(url) {
    const bundled=byId("offline-"+url);
    if (bundled) return Promise.resolve(JSON.parse(bundled.textContent));
    return fetch(url).then(r=>{if(!r.ok)throw new Error();return r.json();});
  }
  function table(head,rows){
    const el=node("table");el.className="plain";const tr=node("tr");head.forEach(s=>{const th=node("th",s);th.scope="col";tr.append(th);});
    const thead=node("thead");thead.append(tr);el.append(thead);const body=node("tbody");
    rows.forEach(cols=>{const row=node("tr");cols.forEach(s=>row.append(node("td",s)));body.append(row);});el.append(body);
    const wrap=node("div");wrap.className="table-wrap";wrap.append(el);return wrap;
  }
  function summary(s) {
    byId("results").replaceChildren(table(["Measure","Result"],[
      ["Removed elements flagged",s.omissions_flagged+" of "+s.known_omissions],
      ["False alarms on fields present in intact examples",s.false_flags_intact+" of "+s.intact_fields+" fields ("+s.intact_examples_flagged+" of "+s.intact_examples+" intact examples)"],
      ["Present fields deferred on intact examples",s.intact_fields_deferred+" of "+s.intact_fields],
      ["All decisions that asked for confirmation",s.abstentions+" of "+s.decisions],
      ["Missing-page fields correctly left uncertain",s.partial_missing_deferred+" of "+s.partial_missing_fields],
      ["Field decisions matching the answer key",s.matched+" of "+s.decisions]
    ]),node("p","Separately, the checker matched "+s.official_excerpt.matched+" of "+s.official_excerpt.checked+" annotated fields on the published SSA excerpt below."));
  }
  byId("custom-run").addEventListener("click",()=>{
    const words=byId("custom-text").value.trim();
    if (!words) {byId("custom-results").textContent="Add some sample wording first.";byId("custom-text").focus();return;}
    const observed=window.NoticeEvidence.inspect(words,byId("custom-full").checked);
    const rows=window.NoticeEvidence.fields.map(k=>[names[k],labels[observed[k].state],observed[k].quote||"Check the original pages"]);
    byId("custom-results").replaceChildren(table(["Element","Checker","Suggested passage"],rows));
  });
  Promise.all([get("examples.json"),get("results.json")]).then(([fixtures,saved])=>{
    summary(saved);
    byId("official").textContent=fixtures.official_excerpt.text;
    const picker=byId("case");
    fixtures.cases.forEach(c=>{const op=node("option",c.id+" · "+c.change);op.value=c.id;picker.append(op);});
    function inspect(){
      const c=fixtures.cases.find(item=>item.id===picker.value);
      const observed=window.NoticeEvidence.inspect(c.text,c.all_pages);
      const description=fixtures.families.find(f=>f.id===c.family).basis;
      const details=node("details"),sample=node("pre",c.text);sample.className="sample-text";
      details.append(node("summary","Read the supplied notice"),sample);
      const rows=window.NoticeEvidence.fields.map(k=>[names[k],labels[c.expected[k].state],labels[observed[k].state],observed[k].quote ? (observed[k].page?"Page "+observed[k].page+" · ":"")+observed[k].quote:"No passage located"]);
      byId("inspection").replaceChildren(node("p",description),details,table(["Element","Answer key","Checker","Evidence suggested"],rows));
    }
    picker.addEventListener("change",inspect);inspect();
    const button=byId("rerun");button.disabled=false;button.addEventListener("click",()=>{
      const fresh=window.scoreNoticeExamples(fixtures);summary(fresh);
      byId("rerun-status").textContent=JSON.stringify(fresh)===JSON.stringify(saved)?"Reproduced the recorded results for all "+fresh.cases+" examples on this device.":"This run differs from the saved results. Compare the displayed counts and the downloadable results.";
    });
  }).catch(()=>{byId("results").textContent="The data could not be loaded. You can still download the offline kit below.";});
})();
