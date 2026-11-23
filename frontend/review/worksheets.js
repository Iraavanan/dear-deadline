/* The preparation worksheets collect no identifiers and run on this device. */
(function () {
  "use strict";
  const U = window.UI, h = U.h, engine = window.BenefitWorksheets;
  const config = {
    wages: ["I reported wages. Why is SSI using a different amount?", "Compare pay stubs, reporting receipts and the gross wages listed on an SSI notice, one pay month at a time."],
    medicaid: ["If work stops my SSI check, can I keep Medicaid?", "Prepare the questions to ask about Section 1619(b). The state earnings comparison covers Florida in 2026."],
    earnings: ["Is a year missing from my Social Security earnings record?", "Compare one employer’s final W-2 with the taxed Social Security earnings on your record. You can prepare a correction request here."],
    fema: ["Is FEMA asking for proof that I lived there?", "Use the instructions on your FEMA letter to prepare a response about the home where you lived at the time of the disaster."]
  };
  const options = [["unknown","I’m not sure"],["yes","Yes"],["no","No"]];
  function input(id, label, hint, type, value) {
    return h("div", {class:"field"}, U.field(id,label,hint,h("input",{type:type || "text", value:value || "", autocomplete:"off", inputmode:type === "text" ? "decimal" : null})));
  }
  function select(id, label, hint, choices, initial) {
    const el = h("select", {}, choices.map(([v,l]) => h("option",{value:v,selected:v === initial,text:l})));
    return h("div",{class:"field"}, U.field(id,label,hint,el));
  }
  const value = id => document.getElementById(id).value;
  const list = (title, entries) => entries.length ? h("section",{},h("h2",{text:title}),h("ul",{},entries.map(t=>h("li",{text:t})))) : null;
  const button = (label, fn) => h("button",{type:"button",class:"quiet",text:label,on:{click:fn}});
  const samples = {
    wages:{rows:[{month:"2026-02",stubs:"850",receipt:"850",reported:"2026-03-03",agency:"1050",basis:"wages"}]},
    medicaid:{benefit:"ssi",state:"FL",year:"2026",earnings:"45000",cash:"yes",prior:"yes",reason:"yes",disability:"yes",other:"unknown",need:"yes"},
    earnings:{scope:"one",year:"2023",box3:"36000",box7:"600",recordState:"shown",record:"30600"},
    fema:{kind:"request",text:"Please provide proof that you occupied the damaged home as your primary residence.",proof:["lease"]}
  };
  function wageFields(s) {
    const rows = h("div",{}), add = button("Add another wage month", () => append({}));
    function append(r) {
      const fieldset = h("fieldset",{class:"period"});
      const index = ++append.next, suffix = "-" + index;
      fieldset.appendChild(h("legend",{text:"Wage month " + index}));
      const basis = select("basis"+suffix,"What does the SSA notice show?",null,[["unknown","Unsure or only an SSI payment amount"],["wages","Gross wages for this wage month"]],r.basis || "unknown");
      const agency = input("agency"+suffix,"Gross wages SSA used","Copy only a figure explicitly tied to this wage month.","text",r.agency);
      function toggle() { agency.hidden = basis.querySelector("select").value !== "wages"; }
      basis.addEventListener("change",toggle); toggle();
      fieldset.append(input("month"+suffix,"Month the wages were paid",null,"month",r.month),
        h("div",{class:"pair"},input("stubs"+suffix,"Gross wages on pay stubs","Add pay received in this month.","text",r.stubs),
        input("receipt"+suffix,"Wages on my reporting receipt","Use the reported wage total if shown.","text",r.receipt)),
        input("reported"+suffix,"Date I reported these wages","Optional. Leave other missing figures blank.","date",r.reported),basis,agency,
        button("Remove this month",()=>{fieldset.remove();if (!rows.children.length) append({});add.disabled=false;}));
      rows.appendChild(fieldset); add.disabled = rows.children.length >= 6;
      fieldset.dataset.index=String(index);
    }
    append.next=0; (s.rows || [{}]).forEach(append);
    return {nodes:[rows,U.row(add)],read:()=>({rows:Array.from(rows.children, fs=>{
      const row={}; for (const k of ["month","stubs","receipt","reported","basis","agency"]) row[k]=value(k+"-"+fs.dataset.index);return row;
    })})};
  }
  function medicaidFields(s) {
    const qs = [
      ["cash","Were you eligible for regular SSI cash for at least one month before entering Section 1619?"],
      ["prior","Were you eligible for Medicaid in the month before entering Section 1619?"],
      ["reason","Are earnings the reason your SSI cash has stopped or might stop?"],
      ["disability","Are you still blind or disabled under SSA’s rules?"],
      ["other","Do you still meet the other SSI conditions, including resources and other income?"],
      ["need","Do you use Medicaid for work, expect to need it, or need it in case you get sick or injured?"]
    ];
    const fields = [select("benefit","Which benefit do you receive?",null,[["unknown","I’m not sure"],["ssi","SSI, alone or together with SSDI"],["ssdi","SSDI only"]],s.benefit),
      h("div",{class:"pair"},select("state","Which state?",null,[["","Choose your state"],["FL","Florida"],["other","Another state"]],s.state),
        select("year","Which year?",null,[["2026","2026"],["other","Another year"]],s.year)),
      input("earnings","Estimated gross earnings for the whole year","Optional. Use wages before taxes.","text",s.earnings),
      qs.map(([k,label])=>select(k,label,null,options,s[k] || "unknown"))];
    return {nodes:fields,read:()=>Object.fromEntries(["benefit","state","year","earnings",...qs.map(x=>x[0])].map(k=>[k,value(k)]))};
  }
  function earningsFields(s,rules) {
    const fields=[select("scope","Which records are you comparing?",null,[["unknown","I’m not sure or have other earnings"],["one","One employer, one final W-2 or W-2c, and no other covered earnings for the year"]],s.scope),
      select("year","Tax year on both records",null,Object.keys(rules.wage_base).reverse().map(y=>[y,y]),s.year),
      h("div",{class:"pair"},input("box3","W-2 box 3","Social Security wages","text",s.box3),input("box7","W-2 box 7","Social Security tips. Leave blank if box 7 is empty.","text",s.box7)),
      select("recordState","What does your earnings record show?",null,[["missing","I can’t find a posted entry for this year"],["shown","A figure is shown, including an explicit zero"]],s.recordState),
      input("record","Taxed Social Security earnings on the record","Use the Social Security column.","text",s.record)];
    function toggle(){fields[4].hidden=fields[3].querySelector("select").value!=="shown";}
    fields[3].addEventListener("change",toggle);toggle();
    return {nodes:fields,read:()=>Object.fromEntries(["scope","year","box3","box7","recordState","record"].map(k=>[k,value(k)]))};
  }
  function femaFields(s) {
    const box=h("textarea",{id:"fema-text",class:"paste",spellcheck:"false",rows:"3"});box.value=s.text||"";
    const choices=[["unknown","I’m unsure"],["request","A request for documents"],["decision","An eligibility decision"],["both","A decision and a request for evidence"]];
    const kind=select("kind","What does the letter say?", "Confirm the instructions for the occupancy issue.",choices,s.kind);
    const status=h("p",{class:"small","aria-live":"polite"});
    const hint=button("Check the wording",()=>{
      const k=engine.femaHint(box.value);kind.querySelector("select").value=k;
      status.textContent=k==="unknown"?"The wording is unclear. Look for both document instructions and a decision about occupancy.":"Suggested reading: "+choices.find(c=>c[0]===k)[1]+". Check this against all pages.";
    });
    const proof = Object.keys(engine.proofOptions).filter(k=>k!=="none").map(k=>h("label",{},h("input",{type:"checkbox",name:"proof",value:k,checked:(s.proof||[]).includes(k)})," "+engine.proofOptions[k]));
    return {nodes:[h("div",{class:"field"},U.field("fema-text","Paste the sentence about the home (optional)","Leave out names, addresses and case numbers. The wording stays on your device.",box)),U.row(hint),status,kind,
      h("div",{class:"pair"},input("date","Date on the decision letter","Optional. Used only if you identify a decision.","date",s.date),input("due","Response or appeal date printed in the letter","Optional. Copy it exactly.","date",s.due)),
      h("fieldset",{class:"ticks"},h("legend",{text:"Which proof could you provide?"}),proof)],
      read:()=>({kind:value("kind"),date:value("date"),due:value("due"),proof:Array.from(document.querySelectorAll("input[name=proof]:checked"),el=>el.value)})};
  }
  function showResult(r,rules,back) {
    const table=r.rows.length?h("div",{class:"table-wrap"},h("table",{class:"plain"},h("thead",{},h("tr",{},r.columns.map(x=>h("th",{scope:"col",text:x})))),h("tbody",{},r.rows.map(row=>h("tr",{},row.map(x=>h("td",{text:x}))))))):null;
    const sources=r.sources.map(k=>rules.sources[k]);
    const asText=[r.title,"",r.summary,"",r.columns?r.columns.join(" | "):"",...r.rows.map(x=>x.join(" | ")),"",...r.questions,"",...r.bring,"",...r.notes,"",...sources.map(s=>s.title+" "+s.url)].join("\n");
    U.show(h("article",{class:"worksheet-result"},h("h1",{class:"long",text:r.title}),h("p",{class:"lead",text:r.summary}),table,list("What to ask",r.questions),list("What to bring",r.bring),list("Timing and next steps",r.notes),
      h("details",{class:"worksheet-sources"},h("summary",{text:"Official sources · checked "+rules.checked_on}),h("ul",{},sources.map(s=>h("li",{},U.link(s.url,s.title)))))),
      U.row(U.go("Print or save as PDF",()=>window.print()),button("Download my worksheet",()=>U.download("benefit-worksheet.txt","text/plain",asText)),button("Edit my answers",back),button("Back to all tools",U.home)));
  }
  function draw(key,data,rules) {
    const builders={wages:wageFields,medicaid:medicaidFields,earnings:earningsFields,fema:femaFields};
    const fields=builders[key](data,rules), error=h("p",{class:"err",role:"alert",tabindex:"-1",hidden:true});
    const form=h("form",{on:{submit:ev=>{
      ev.preventDefault();
      try { showResult(engine[key](fields.read(),rules),rules,show); }
      catch(e){error.hidden=false;error.textContent=e.message;error.focus();}
    }}},fields.nodes,error,U.row(U.go("Create my worksheet",null,"submit"),button("Try a made-up example",()=>draw(key,samples[key],rules)),button("Back",U.home)));
    function show(){U.show(h("h1",{class:"long",text:config[key][0]}),h("p",{class:"lead",text:config[key][1]}),
      h("p",{class:"small",text:"Your answers stay in this tab. You can print or download the worksheet."}),form);}
    show();
  }
  let cached;
  function start(key) {
    const current=location.hash;
    U.setDatebar(null);
    if (!cached) cached=fetch("/review/worksheet-rules.json").then(r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{cached=null;throw e;});
    cached.then(rules=>{if(location.hash===current)draw(key,{},rules);}).catch(()=>{if(location.hash===current)U.failed();});
  }
  window.Modules=window.Modules||{};window.Modules.worksheets={start};
})();
