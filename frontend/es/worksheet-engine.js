/* Built by tools/make_es_js.py from frontend/review/worksheet-engine.js. Do not edit: change the English file or tools/es_js_text.py. */
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
    if (!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) throw Error("Escriba " + label + " como una cantidad no negativa con hasta dos decimales.");
    const pieces = raw.replace(/[$,]/g, "").split(".");
    const total = Number(pieces[0]) * 100 + Number((pieces[1] || "").padEnd(2, "0"));
    if (!Number.isSafeInteger(total) || total > 99999999999) throw Error("Revise el tamaño de " + label + ".");
    return total;
  }
  function day(value) {
    if (!value) return null;
    if (!/^(19|20)\d\d-\d\d-\d\d$/.test(value)) throw Error("Revise la fecha de la carta.");
    const parsed = new Date(value + "T12:00:00Z");
    if (isNaN(parsed) || parsed.toISOString().slice(0, 10) !== value) throw Error("Revise la fecha de la carta.");
    return parsed;
  }
  const dateLabel = dt => dt.toLocaleDateString("es-US", {timeZone: "UTC", month: "long", year: "numeric", day: "numeric"});
  const monthLabel = dt => dt.toLocaleDateString("es-US", {timeZone: "UTC", month: "long", year: "numeric"});
  function result(title, sources) { return {title, summary: "", rows: [], questions: [], bring: [], notes: [], sources}; }

  function wages(input, rules) {
    const out = result("Mi hoja de trabajo para revisar los salarios de SSI", ["ssi_wages", "ssi_report"]);
    const used = new Set(), disputed = [], incomplete = [];
    for (const row of input.rows) {
      if (!row.month && ![row.stubs, row.receipt, row.agency, row.reported].some(x => String(x || "").trim())) continue;
      if (!/^(19|20)\d\d-(0[1-9]|1[0-2])$/.test(row.month || "")) throw Error("Elija un mes de salarios para cada fila que use.");
      if (used.has(row.month)) throw Error("Use una fila por mes de salarios. Sume los cheques de pago recibidos en el mismo mes.");
      used.add(row.month);
      const stub = cents(row.stubs,"el sueldo bruto de sus talones de pago");
      const reported = cents(row.receipt,"los salarios del recibo de su informe");
      const agency = row.basis === "wages" ? cents(row.agency,"los salarios brutos que usó el Seguro Social") : null;
      const received = day(row.reported);
      const m = day(row.month + "-01"), name = monthLabel(m);
      const payment = new Date(m);
      payment.setUTCMonth(payment.getUTCMonth() + rules.ssi_usual_lag_months);
      const values = [stub, reported, agency].filter(x => x !== null);
      let status;
      if (values.length === 0) status = "No se escribieron cantidades de salarios para comparar";
      else if (new Set(values).size > 1) status = "Las cantidades son diferentes";
      else if (agency === null) status = "Hay que confirmar la cifra de salarios del Seguro Social";
      else if (values.length < 2) status = "Hace falta otro registro de salarios";
      else status = "Las cantidades de salarios escritas coinciden";
      const display = val => val === null ? "Desconocido" : dollars(val);
      out.rows.push([name, display(stub), display(reported) + (received ? " · " + dateLabel(received) : ""), display(agency), status, monthLabel(payment)]);
      if (status === "Las cantidades son diferentes") disputed.push(name);
      else if (status !== "Las cantidades de salarios escritas coinciden") incomplete.push(name);
    }
    if (!used.size) throw Error("Agregue por lo menos un mes de salarios.");
    out.columns = ["Mes de salarios", "Talones de pago", "Salarios informados", "Salarios brutos según el Seguro Social", "Qué revisar", "Mes usual del pago de SSI"];
    out.summary = "Revise el sueldo bruto según el mes en que se recibió. Un pago de beneficios o el ingreso contable es una cifra diferente.";
    if (disputed.length) out.questions.push("Por favor aclaren las cifras diferentes de " + disputed.join(", ") + ". ¿Qué salarios brutos y qué fechas de pago usó el Seguro Social?");
    if (incomplete.length) out.questions.push("¿Puede el Seguro Social dar un desglose de los salarios de " + incomplete.join(", ") + " e indicar el mes de pago afectado?");
    out.notes.push("La última columna muestra el retraso usual de dos meses. Confirme con el Seguro Social el mes de presupuesto real, sobre todo cuando SSI empieza o se reanuda.");
    out.bring = ["Talones de pago con las fechas de pago de cada mes que aparece.", "Los recibos de sus informes de salarios y las páginas que muestran las cifras de salarios del Seguro Social.", "Guarde una copia de la hoja de trabajo y pida un desglose por escrito. Respete cualquier plazo de apelación que tenga su aviso."];
    return out;
  }

  function medicaid(input, rules) {
    const out = result("Mis preguntas sobre trabajar y conservar Medicaid", ["ssi_medicaid", "ssi_threshold", "individual_threshold"]);
    const conditions = [
      ["cash", "¿Tuve por lo menos un mes de elegibilidad para el pago regular de SSI antes de la Sección 1619?"],
      ["prior", "¿Fui elegible para Medicaid en el mes anterior a entrar en la Sección 1619?"],
      ["reason", "¿Son las ganancias lo que detuvo o puede detener mi pago de SSI?"],
      ["disability", "¿El Seguro Social me considera ciego o todavía con incapacidad según sus reglas?"],
      ["other", "¿Sigo cumpliendo las otras condiciones de SSI, incluidos los recursos y los otros ingresos?"],
      ["need", "¿Mi situación cumple el requisito de uso de Medicaid para trabajar?"]
    ];
    const amount = cents(input.earnings, "las ganancias brutas del año");
    const standard = input.state === "FL" ? rules.florida_1619b[input.year] : undefined;
    out.summary = "La Sección 1619(b) puede permitir que Medicaid continúe cuando las ganancias detienen el pago de SSI. Pida al Seguro Social que confirme su situación antes de hacer un cambio basado en esta hoja de trabajo.";
    if (input.benefit !== "ssi") {
      out.summary = "Primero confirme si usted recibe SSI. La Sección 1619(b) es una protección de SSI para quienes trabajan. Si recibe solo SSDI, pregunte por las reglas de trabajo de Medicare que le corresponden.";
      out.questions.push("¿Qué beneficio por incapacidad y qué cobertura de salud aparecen en mi registro?");
    } else {
      conditions.forEach(([key, q]) => {
        if (input[key] !== "yes") out.questions.push(q);
      });
      if (standard) {
        out.rows.push(["Florida • " + input.year, dollars(standard * 100), amount === null ? "No se escribió" : dollars(amount)]);
        out.columns = ["Estado y año", "Límite anual estándar", "Ganancias brutas anuales esperadas"];
        if (amount === null) out.questions.push("¿Qué ganancias brutas anuales debo comparar con la cifra de Florida?");
        else if (amount > standard * 100) out.questions.push("Mi cálculo pasa de la cifra del estado. ¿Puede el Seguro Social calcular un límite individual con mis costos de Medicaid, mis gastos de trabajo o el cuidado de asistentes pagado con fondos públicos?");
        else out.questions.push("Mi cálculo es igual o menor que la cifra del estado. ¿Cumplo las otras condiciones para que la cobertura continúe?");
      } else out.questions.push("¿Qué límite de estado y año corresponde a mi situación, y podría corresponder un límite individual?");
    }
    out.notes = ["El límite del estado es una parte de la decisión. Pregunte al Seguro Social por un límite individual si los costos médicos o los gastos de trabajo son altos.", "Para la prueba de uso de Medicaid, dígale al Seguro Social qué atención usó en los últimos 12 meses, qué atención espera en los próximos 12 meses, o por qué no podría pagar una atención inesperada."];
    out.bring = ["Los avisos de SSI y de Medicaid, más su sueldo bruto estimado del año.", "Las cantidades de los gastos de trabajo que correspondan, de los servicios de Medicaid y del cuidado de asistentes. Guarde los registros en su dispositivo."];
    return out;
  }

  function earnings(input, rules, today) {
    const out = result("Mi hoja de trabajo para corregir las ganancias del Seguro Social", ["wages_record", "wages_boxes", "wages_cap", "wages_form"]);
    const cap = rules.wage_base[input.year];
    if (!cap) throw Error("Elija un año que la hoja de trabajo cubra.");
    if (input.scope !== "one") {
      out.summary = "Su registro del Seguro Social suma las ganancias cubiertas de todo el año. Una comparación con un solo W-2 no puede resolver este año.";
      out.questions = ["¿Puede el Seguro Social ayudarme a aclarar todos los empleadores, los W-2 corregidos o las ganancias por cuenta propia de " + input.year + "?"];
    } else {
      const box3 = cents(input.box3,"Casilla 3 del W-2"), tips = cents(input.box7,"Casilla 7 del W-2") || 0;
      const record = input.recordState === "shown" ? cents(input.record,"las ganancias gravadas del Seguro Social") : null;
      if (box3 === null) throw Error("Escriba la casilla 3 del W-2, incluso cero si de verdad muestra cero.");
      if (input.recordState === "shown" && record === null) throw Error("Escriba la cantidad que aparece, o elija que no aparece ninguna entrada.");
      const expected = box3 + tips;
      if (expected > cap * 100 || (record !== null && record > cap * 100)) throw Error("Una cifra pasa de la base salarial del Seguro Social de ese año. Revise el año y las casillas 3 y 7, y use la columna de ganancias gravadas del Seguro Social de su registro.");
      const checkInAugust = new Date(Date.UTC(Number(input.year) + 1, 7, 1));
      const currentDate = today || new Date();
      const early = currentDate.getTime() < checkInAugust.getTime();
      out.columns = ["Año", "Casillas 3 + 7 del W-2", "Registro del Seguro Social", "Diferencia (W-2 menos registro)"];
      out.rows.push([input.year, dollars(expected), record === null ? "No se dio ninguna entrada registrada" : dollars(record), record === null ? "Desconocido" : dollars(expected-record)]);
      if (record === null && expected === 0) {
        out.summary = "Este W-2 muestra cero salarios y propinas cubiertos. No da ninguna cantidad positiva para comparar con el año sin registrar.";
        out.questions.push("Si creo que estos salarios debieron estar cubiertos, ¿qué registros debo revisar con mi empleador o con el Seguro Social?");
      } else if (record !== null && record === expected) out.summary = "Las dos cifras que escribió coinciden para " + input.year + ".";
      else {
        out.summary = early ? "Es posible que este año todavía se esté registrando. El Seguro Social sugiere revisar el registro del año anterior en agosto." : "Vale la pena revisar el registro de este año con el Seguro Social.";
        out.questions.push("Por favor revisen mis ganancias cubiertas de " + input.year + ". Mi W-2 muestra " + dollars(expected) + " y mi registro del Seguro Social " + (record === null ? "no tiene ninguna entrada que yo pueda encontrar." : "muestra " + dollars(record) + ".") + " ¿Qué pruebas necesitan para revisarlo?");
      }
    }
    out.bring = ["El W-2 o W-2c y una copia de la entrada del registro de ganancias de ese año.", "Si no tiene un W-2, pregunte al Seguro Social por los talones de pago, una declaración de impuestos, los datos del empleador y las fechas en que trabajó."];
    out.notes = ["Use la vía oficial de corrección del Seguro Social o el formulario SSA-7008. El Seguro Social aplica plazos y excepciones. Si la diferencia es antigua, preséntela pronto.", "Esta hoja de trabajo compara las ganancias informadas. No calcula un cambio en un pago de jubilación."];
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
    lease: "Una copia de un contrato de alquiler que muestre dónde vivía.",
    utility: "Una factura de servicios públicos que le identifique a usted y la dirección dañada.",
    employer: "Una declaración de un empleador que confirme la residencia y las fechas que importan.",
    official: "Una declaración escrita de un funcionario público o escolar autorizado que confirme que usted vivía allí.",
    none: "Pregunte a FEMA qué otros documentos de ocupación puede aceptar para su situación de vivienda."
  };
  function fema(input, rules) {
    const out = result("Mi lista para responder a FEMA sobre la ocupación de la vivienda", ["fema_proof","fema_appeal","fema_account"]);
    const decision = input.kind === "decision" || input.kind === "both";
    const request = input.kind === "request" || input.kind === "both";
    if (decision && request) out.summary = "Su carta da una decisión y pide pruebas. Prepare las pruebas y siga las instrucciones de apelación si no está de acuerdo.";
    else if (decision) out.summary = "Usted indicó una decisión que quizás quiera que FEMA revise. Use las instrucciones de apelación de su carta de decisión.";
    else if (request) out.summary = "Usted indicó un pedido de pruebas de ocupación. Envíe los documentos pedidos a más tardar en la fecha y de la manera que indica la carta.";
    else out.summary = "Confirme si esto es un pedido de pruebas, una decisión o las dos cosas. Tenga a la vista cualquier plazo impreso en la carta mientras lo revisa.";
    const printed = day(input.due);
    const dated = decision ? day(input.date) : null;
    if (printed) out.notes.push("Fecha límite o de respuesta que usted copió de su carta: " + dateLabel(printed) + ".");
    if (dated) {
      dated.setUTCDate(dated.getUTCDate() + rules.fema_appeal_days);
      out.notes.push("El plazo usual de FEMA para apelar es de 60 días desde la carta de decisión. Eso da el " + dateLabel(dated) + " según la fecha que escribió. Compárelo con las instrucciones y actúe pronto si las fechas son diferentes o ya pasaron.");
    } else if (decision) out.notes.push("El plazo usual de FEMA para apelar es de 60 días desde la fecha de la carta de decisión. Revise esa fecha hoy.");
    out.questions = [request ? "¿Cuáles de mis documentos demostrarán que yo ocupaba la vivienda dañada como mi residencia principal en el momento del desastre?" : "¿Esta carta requiere una apelación, documentos o las dos cosas, y qué plazo se aplica?"];
    out.bring = (input.proof || []).filter(k => proofOptions[k]).map(k => proofOptions[k]);
    if (!out.bring.length) out.bring.push(proofOptions.none);
    out.notes.push("Revise los nombres, la dirección dañada y las fechas de las pruebas. Guarde los originales y una copia de lo que presente. Use su cuenta de DisasterAssistance.gov, un centro de recuperación por desastre o la dirección de la carta. Agregue los números de caso que se requieran solo en la copia que envíe a FEMA.");
    return out;
  }
  return {wages, medicaid, earnings, fema, femaHint, proofOptions};
});
