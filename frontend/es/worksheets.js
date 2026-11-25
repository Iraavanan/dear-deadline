/* Built by tools/make_es_js.py from frontend/review/worksheets.js. Do not edit: change the English file or tools/es_js_text.py. */
/* The preparation worksheets collect no identifiers and run on this device. */
(function () {
  "use strict";
  const U = window.UI, h = U.h, engine = window.BenefitWorksheets;
  const config = {
    wages: ["Informé mis salarios. ¿Por qué SSI usa otra cantidad?", "Compare los talones de pago, los recibos de sus informes y los salarios brutos que aparecen en un aviso de SSI, un mes de pago a la vez."],
    medicaid: ["Si el trabajo detiene mi pago de SSI, ¿puedo conservar Medicaid?", "Prepare las preguntas que hará sobre la Sección 1619(b). La comparación con las ganancias del estado cubre Florida en 2026."],
    earnings: ["¿Falta un año en mi registro de ganancias del Seguro Social?", "Compare el W-2 final de un empleador con las ganancias gravadas del Seguro Social en su registro. Aquí puede preparar una solicitud de corrección."],
    fema: ["¿FEMA pide pruebas de que yo vivía allí?", "Use las instrucciones de su carta de FEMA para preparar una respuesta sobre la vivienda donde usted vivía en el momento del desastre."]
  };
  const options = [["unknown","No estoy seguro"],["yes","Sí"],["no","No"]];
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
    const rows = h("div",{}), add = button("Agregar otro mes de salarios", () => append({}));
    function append(r) {
      const fieldset = h("fieldset",{class:"period"});
      const index = ++append.next, suffix = "-" + index;
      fieldset.appendChild(h("legend",{text:"Mes de salarios " + index}));
      const basis = select("basis"+suffix,"¿Qué muestra el aviso del Seguro Social?",null,[["unknown","No estoy seguro, o solo una cantidad de pago de SSI"],["wages","Los salarios brutos de este mes"]],r.basis || "unknown");
      const agency = input("agency"+suffix,"Salarios brutos que usó el Seguro Social","Copie solo una cifra que esté claramente ligada a este mes de salarios.","text",r.agency);
      function toggle() { agency.hidden = basis.querySelector("select").value !== "wages"; }
      basis.addEventListener("change",toggle); toggle();
      fieldset.append(input("month"+suffix,"Mes en que se pagaron los salarios",null,"month",r.month),
        h("div",{class:"pair"},input("stubs"+suffix,"Salarios brutos en los talones de pago","Sume los pagos recibidos en este mes.","text",r.stubs),
        input("receipt"+suffix,"Salarios en el recibo de mi informe","Use el total de salarios informado, si aparece.","text",r.receipt)),
        input("reported"+suffix,"Fecha en que informé estos salarios","Opcional. Deje en blanco las otras cifras que no tenga.","date",r.reported),basis,agency,
        button("Quitar este mes",()=>{fieldset.remove();if (!rows.children.length) append({});add.disabled=false;}));
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
      ["cash","¿Fue elegible para el pago regular de SSI por lo menos un mes antes de entrar en la Sección 1619?"],
      ["prior","¿Fue elegible para Medicaid en el mes anterior a entrar en la Sección 1619?"],
      ["reason","¿Son las ganancias la razón por la que su pago de SSI se detuvo o podría detenerse?"],
      ["disability","¿Sigue siendo ciego o con incapacidad según las reglas del Seguro Social?"],
      ["other","¿Sigue cumpliendo las otras condiciones de SSI, incluidos los recursos y los otros ingresos?"],
      ["need","¿Usa Medicaid para poder trabajar, espera necesitarlo, o lo necesita por si se enferma o se lesiona?"]
    ];
    const fields = [select("benefit","¿Qué beneficio recibe?",null,[["unknown","No estoy seguro"],["ssi","SSI, solo o junto con SSDI"],["ssdi","Solo SSDI"]],s.benefit),
      h("div",{class:"pair"},select("state","¿Qué estado?",null,[["","Elija su estado"],["FL","Florida"],["other","Otro estado"]],s.state),
        select("year","¿Qué año?",null,[["2026","2026"],["other","Otro año"]],s.year)),
      input("earnings","Ganancias brutas estimadas de todo el año","Opcional. Use los salarios antes de impuestos.","text",s.earnings),
      qs.map(([k,label])=>select(k,label,null,options,s[k] || "unknown"))];
    return {nodes:fields,read:()=>Object.fromEntries(["benefit","state","year","earnings",...qs.map(x=>x[0])].map(k=>[k,value(k)]))};
  }
  function earningsFields(s,rules) {
    const fields=[select("scope","¿Qué registros está comparando?",null,[["unknown","No estoy seguro, o tengo otras ganancias"],["one","Un empleador, un W-2 o W-2c final, y ninguna otra ganancia cubierta en el año"]],s.scope),
      select("year","Año fiscal en los dos registros",null,Object.keys(rules.wage_base).reverse().map(y=>[y,y]),s.year),
      h("div",{class:"pair"},input("box3","Casilla 3 del W-2","Salarios del Seguro Social (Social Security wages)","text",s.box3),input("box7","Casilla 7 del W-2","Propinas del Seguro Social (Social Security tips). Déjela en blanco si la casilla 7 está vacía.","text",s.box7)),
      select("recordState","¿Qué muestra su registro de ganancias?",null,[["missing","No encuentro ninguna entrada registrada para este año"],["shown","Aparece una cifra, incluso un cero explícito"]],s.recordState),
      input("record","Ganancias gravadas del Seguro Social en el registro","Use la columna del Seguro Social.","text",s.record)];
    function toggle(){fields[4].hidden=fields[3].querySelector("select").value!=="shown";}
    fields[3].addEventListener("change",toggle);toggle();
    return {nodes:fields,read:()=>Object.fromEntries(["scope","year","box3","box7","recordState","record"].map(k=>[k,value(k)]))};
  }
  function femaFields(s) {
    const box=h("textarea",{id:"fema-text",class:"paste",spellcheck:"false",rows:"3"});box.value=s.text||"";
    const choices=[["unknown","No estoy seguro"],["request","Un pedido de documentos"],["decision","Una decisión de elegibilidad"],["both","Una decisión y un pedido de pruebas"]];
    const kind=select("kind","¿Qué dice la carta?", "Confirme las instrucciones sobre el tema de la ocupación de la vivienda.",choices,s.kind);
    const status=h("p",{class:"small","aria-live":"polite"});
    const hint=button("Revisar las palabras",()=>{
      const k=engine.femaHint(box.value);kind.querySelector("select").value=k;
      status.textContent=k==="unknown"?"Las palabras no son claras. Busque tanto instrucciones sobre documentos como una decisión sobre la ocupación.":"Lectura sugerida: "+choices.find(c=>c[0]===k)[1]+". Compárela con todas las páginas.";
    });
    const proof = Object.keys(engine.proofOptions).filter(k=>k!=="none").map(k=>h("label",{},h("input",{type:"checkbox",name:"proof",value:k,checked:(s.proof||[]).includes(k)})," "+engine.proofOptions[k]));
    return {nodes:[h("div",{class:"field"},U.field("fema-text","Pegue la oración sobre la vivienda (opcional)","No ponga nombres, direcciones ni números de caso. Las palabras se quedan en su dispositivo. Péguela en inglés, como está en la carta.",box)),U.row(hint),status,kind,
      h("div",{class:"pair"},input("date","Fecha de la carta de decisión","Opcional. Se usa solo si usted indica que hay una decisión.","date",s.date),input("due","Fecha de respuesta o de apelación impresa en la carta","Opcional. Cópiela exactamente.","date",s.due)),
      h("fieldset",{class:"ticks"},h("legend",{text:"¿Qué pruebas podría dar?"}),proof)],
      read:()=>({kind:value("kind"),date:value("date"),due:value("due"),proof:Array.from(document.querySelectorAll("input[name=proof]:checked"),el=>el.value)})};
  }
  function showResult(r,rules,back) {
    const table=r.rows.length?h("div",{class:"table-wrap"},h("table",{class:"plain"},h("thead",{},h("tr",{},r.columns.map(x=>h("th",{scope:"col",text:x})))),h("tbody",{},r.rows.map(row=>h("tr",{},row.map(x=>h("td",{text:x}))))))):null;
    const sources=r.sources.map(k=>rules.sources[k]);
    const asText=[r.title,"",r.summary,"",r.columns?r.columns.join(" | "):"",...r.rows.map(x=>x.join(" | ")),"",...r.questions,"",...r.bring,"",...r.notes,"",...sources.map(s=>s.title+" "+s.url)].join("\n");
    U.show(h("article",{class:"worksheet-result"},h("h1",{class:"long",text:r.title}),h("p",{class:"lead",text:r.summary}),table,list("Qué preguntar",r.questions),list("Qué llevar",r.bring),list("Plazos y próximos pasos",r.notes),
      h("details",{class:"worksheet-sources"},h("summary",{text:"Fuentes oficiales (en inglés) · revisadas el "+rules.checked_on}),h("ul",{},sources.map(s=>h("li",{},U.link(s.url,s.title)))))),
      U.row(U.go("Imprimir o guardar como PDF",()=>window.print()),button("Descargar mi hoja de trabajo",()=>U.download("benefit-worksheet.txt","text/plain",asText)),button("Cambiar mis respuestas",back),button("Volver a todas las herramientas",U.home)));
  }
  function draw(key,data,rules) {
    const builders={wages:wageFields,medicaid:medicaidFields,earnings:earningsFields,fema:femaFields};
    const fields=builders[key](data,rules), error=h("p",{class:"err",role:"alert",tabindex:"-1",hidden:true});
    const form=h("form",{on:{submit:ev=>{
      ev.preventDefault();
      try { showResult(engine[key](fields.read(),rules),rules,show); }
      catch(e){error.hidden=false;error.textContent=e.message;error.focus();}
    }}},fields.nodes,error,U.row(U.go("Crear mi hoja de trabajo",null,"submit"),button("Probar un ejemplo inventado",()=>draw(key,samples[key],rules)),button("Atrás",U.home)));
    function show(){U.show(h("h1",{class:"long",text:config[key][0]}),h("p",{class:"lead",text:config[key][1]}),
      h("p",{class:"small",text:"Sus respuestas se quedan en esta pestaña. Puede imprimir o descargar la hoja de trabajo. La traducción al español todavía no ha sido revisada por un traductor profesional."}),form);}
    show();
  }
  let cached;
  function start(key) {
    const current=location.hash;
    U.setDatebar(null);
    if (!cached) cached=fetch("/es/worksheet-rules.json").then(r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{cached=null;throw e;});
    cached.then(rules=>{if(location.hash===current)draw(key,{},rules);}).catch(()=>{if(location.hash===current)U.failed();});
  }
  window.Modules=window.Modules||{};window.Modules.worksheets={start};
})();
