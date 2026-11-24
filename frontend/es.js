/* Herramientas paso a paso en español. Las fechas y cantidades las calcula el mismo programa que
   usa la versión en inglés (/api/es/...). No se guarda nada. */
(function () {
  "use strict";
  var caja = document.getElementById("herramienta"), resumen = document.getElementById("resumen");
  if (!caja || !resumen) return;

  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k];
      else if (k === "on") Object.keys(attrs.on).forEach(function (ev) { el.addEventListener(ev, attrs.on[ev]); });
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) el.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) poner(el, arguments[i]);
    return el;
  }
  function poner(el, x) {
    if (x === null || x === undefined || x === false) return;
    if (Array.isArray(x)) { x.forEach(function (y) { poner(el, y); }); return; }
    el.appendChild(typeof x === "string" ? document.createTextNode(x) : x);
  }
  function mostrar() { caja.replaceChildren(); poner(caja, Array.prototype.slice.call(arguments)); caja.hidden = false; resumen.hidden = true; window.scrollTo(0, 0); var t = caja.querySelector("h1"); if (t) { t.setAttribute("tabindex", "-1"); t.focus(); } }
  function enlace(url, texto) { return h("a", { href: url, target: "_blank", rel: "noopener noreferrer", text: texto }); }
  function valor(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function elegido(nombre) { var el = document.querySelector('input[name="' + nombre + '"]:checked'); return el ? el.value : ""; }
  function campo(id, etiqueta, ayuda, tipo, v, p) {
    var c = h("input", { type: tipo === "dinero" ? "text" : tipo, id: id, value: v || "", inputmode: tipo === "dinero" ? "decimal" : null, "aria-invalid": p[id] ? "true" : null });
    return [h("label", { for: id }, etiqueta, ayuda ? h("span", { class: "hint", text: ayuda }) : null), c, p[id] ? h("p", { class: "err", role: "alert", text: p[id] }) : null];
  }
  function opciones(nombre, pregunta, lista, v, p) {
    return h("fieldset", { class: "ticks choice", id: nombre, "aria-invalid": p[nombre] ? "true" : null },
      h("legend", { text: pregunta }),
      lista.map(function (o) { var id = nombre + "_" + o[0]; return h("label", { class: "tick", for: id }, h("input", { type: "radio", name: nombre, id: id, value: o[0], checked: v === o[0] ? "checked" : null }), h("span", { text: o[1] })); }),
      p[nombre] ? h("p", { class: "err", role: "alert", text: p[nombre] }) : null);
  }
  function dinero(v) { return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function faltan(f) {
    if (f.estado === "passed" || f.dias < 0) { var n = -f.dias; return "pasó hace " + n + (n === 1 ? " día" : " días"); }
    if (f.dias === 0) return "es hoy";
    return f.dias === 1 ? "queda 1 día" : "quedan " + f.dias + " días";
  }
  function fechas(lista) {
    if (!lista || !lista.length) return null;
    return h("table", { class: "plain" }, lista.map(function (f) {
      return h("tr", {}, h("th", { scope: "row" }, f.etiqueta, f.nota ? [h("br"), h("span", { class: "small", text: f.nota })] : null),
        h("td", {}, h("b", { text: f.fecha_larga }), h("br"), h("span", { class: "small", text: faltan(f) })));
    }));
  }
  function pasos(lista) { return h("ol", {}, lista.map(function (x) { return h("li", { text: x }); })); }
  function dosLados(d) {
    if (!d) return null;
    return [h("h2", { text: "Seguir recibiendo beneficios mientras espera: los dos lados" }),
      h("ul", {}, h("li", {}, h("b", { text: "A favor: " }), d.seguir), h("li", {}, h("b", { text: "El riesgo: " }), d.riesgo))];
  }
  function carta(texto) {
    if (!texto) return null;
    return h("div", { class: "draft" }, h("h3", { text: "Carta o palabras para su solicitud (en inglés)" }),
      h("p", { class: "small", text: "Está en inglés porque así la lee la agencia. Complete lo que está entre corchetes [ ] con sus datos." }),
      h("pre", { class: "draft-text", lang: "en", text: texto }),
      h("button", { class: "copy", type: "button", text: "Copiar el texto", on: { click: function (ev) {
        var b = ev.currentTarget; try { navigator.clipboard.writeText(texto).then(function () { b.textContent = "Copiado"; }); } catch (e) { b.textContent = "Seleccione el texto y cópielo"; }
      } } }));
  }
  function cierre(r, volver) {
    return [h("h2", { text: "Ayuda gratis" }), h("p", {}, r.ayuda.texto + " ", enlace(r.ayuda.enlace, "Buscar ayuda legal")),
      h("h2", { text: "Reglas en que se basa" }),
      h("ul", { class: "small sources" }, r.reglas.map(function (x) { return h("li", { lang: x.idioma === "en" ? "en" : null }, x.texto + " ", enlace(x.fuente, "Fuente (en inglés)")); })),
      h("p", { class: "small", text: r.aviso + " Reglas revisadas el " + r.reglas_al + "." }),
      h("p", { class: "small" }, "Para preparar el formulario o la carta con más detalle, abra ", h("a", { href: "/#" + r.herramienta, text: "la herramienta completa en inglés" }), "."),
      h("div", { class: "row" }, h("button", { class: "go", type: "button", text: "Imprimir", on: { click: function () { window.print(); } } }),
        h("button", { class: "quiet", type: "button", text: "Cambiar mis respuestas", on: { click: volver } }),
        h("button", { class: "quiet", type: "button", text: "Volver al inicio", on: { click: function () { location.hash = ""; } } }))];
  }

  /* Una herramienta: dibujar(valores, problemas) hace el formulario; leer() devuelve lo que se envía; resultado(r). */
  function herramienta(cfg) {
    var s = {};
    function formulario(p) {
      p = p || {};
      mostrar(h("h1", { class: "long", text: cfg.titulo }), h("p", { class: "lead", text: cfg.entrada }),
        h("p", { class: "small", text: "Esta traducción todavía no ha sido revisada por un traductor profesional. Si algo no está claro, use la fecha y las instrucciones impresas en su carta." }),
        h("form", { novalidate: "novalidate", on: { submit: function (ev) { ev.preventDefault(); s = cfg.leer(); enviar(); } } },
          cfg.dibujar(s, p),
          h("div", { class: "row" }, h("button", { class: "go", type: "submit", text: cfg.boton }),
            h("button", { class: "quiet", type: "button", text: "Probar con un ejemplo inventado", on: { click: function () { s = cfg.ejemplo(); enviar(); } } }),
            h("button", { class: "quiet", type: "button", text: "Volver", on: { click: function () { location.hash = ""; } } }))));
      var mal = caja.querySelector("[aria-invalid=true]"); if (mal) { (mal.querySelector("input") || mal).focus(); }
    }
    function enviar() {
      var enviado = {}; Object.keys(s).forEach(function (k) { if (k.charAt(0) !== "_") enviado[k] = s[k]; });
      fetch("/api/es/" + cfg.api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(enviado) })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
        .then(function (res) { if (!res.ok) { formulario(res.d.problems || {}); return; } cfg.resultado(res.d, function () { formulario(); }); })
        .catch(function () { mostrar(h("h1", { text: "No se pudo conectar" }), h("p", { text: "Revise su conexión e inténtelo otra vez." }), h("div", { class: "row" }, h("button", { class: "go", type: "button", text: "Intentar otra vez", on: { click: function () { formulario(); } } }))); });
    }
    return function () { s = {}; formulario(); };
  }
  function hace(n) { return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); }
  function en(n) { return new Date(Date.now() + n * 864e5).toISOString().slice(0, 10); }

  /* Las herramientas de abajo usan el mismo código que las de inglés: el servidor devuelve las mismas claves, con el texto en español. */
  var SN = [["no", "No"], ["yes", "Sí"]];
  function fechasEn(lista) {
    return fechas((lista || []).map(function (d) { return { etiqueta: d.label, nota: d.note, fecha_larga: d.date_long, dias: d.days_left, estado: d.passed ? "passed" : "upcoming" }; }));
  }
  function cierreEn(r, volver, completa) {
    return [h("h2", { text: "Ayuda gratis" }),
      h("p", {}, "Las oficinas de ayuda legal (legal aid) ayudan con estos casos, por lo general sin costo si sus ingresos son bajos. ", enlace("https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help", "Buscar ayuda legal")),
      h("h2", { text: "Reglas en que se basa" }),
      h("ul", { class: "small sources" }, r.rules.map(function (x) { return h("li", { lang: x.lang === "en" ? "en" : null }, x.plain + " ", enlace(x.source, "Fuente (en inglés)")); })),
      h("p", { class: "small", text: r.disclaimer + " Reglas revisadas el " + r.rules_as_of + "." }),
      h("p", { class: "small" }, "También puede abrir ", h("a", { href: "/#" + completa, text: "esta herramienta en inglés" }), "."),
      h("div", { class: "row" }, h("button", { class: "go", type: "button", text: "Imprimir", on: { click: function () { window.print(); } } }),
        h("button", { class: "quiet", type: "button", text: "Cambiar mis respuestas", on: { click: volver } }),
        h("button", { class: "quiet", type: "button", text: "Volver al inicio", on: { click: function () { location.hash = ""; } } }))];
  }
  function tabla(filas) { return h("table", { class: "plain" }, filas.map(function (x) { return h("tr", {}, h("th", { scope: "row", text: x[0] }), h("td", { class: "num", text: x[1] })); })); }
  function grupo(titulo, cosas) { return h("fieldset", { class: "ticks" }, h("legend", { text: titulo }), cosas); }

  function marcas(nombre, pregunta, lista, v, p, ayuda) {
    v = v || [];
    return h("fieldset", { class: "ticks", id: nombre, "aria-invalid": p[nombre] ? "true" : null }, h("legend", { text: pregunta }), ayuda ? h("p", { class: "hint", text: ayuda }) : null,
      lista.map(function (o) { var id = nombre + "_" + o[0]; return h("label", { class: "tick", for: id }, h("input", { type: "checkbox", name: nombre, id: id, value: o[0], checked: v.indexOf(o[0]) >= 0 ? "checked" : null }), h("span", { text: o[1] })); }),
      p[nombre] ? h("p", { class: "err", role: "alert", text: p[nombre] }) : null);
  }
  function marcados(nombre) { return Array.prototype.map.call(document.querySelectorAll('input[name="' + nombre + '"]:checked'), function (el) { return el.value; }); }
  function texto(id, etiqueta, ayuda, v, p) {
    return [h("label", { for: id }, etiqueta, ayuda ? h("span", { class: "hint", text: ayuda }) : null), h("textarea", { id: id, rows: "4", maxlength: "1500", text: v || "" }),
      p[id] ? h("p", { class: "err", role: "alert", text: p[id] }) : null];
  }
  function borrador(titulo, nota, cuerpo, idioma) {
    if (!cuerpo) return null;
    return h("div", { class: "draft" }, h("h3", { text: titulo }), nota ? h("p", { class: "small", text: nota }) : null, h("pre", { class: "draft-text", lang: idioma || "en", text: cuerpo }),
      h("button", { class: "copy", type: "button", text: "Copiar el texto", on: { click: function (ev) {
        var b = ev.currentTarget; try { navigator.clipboard.writeText(cuerpo).then(function () { b.textContent = "Copiado"; }); } catch (e) { b.textContent = "Seleccione el texto y cópielo"; }
      } } }));
  }
  var EN_INGLES = "Está en inglés porque así lo lee la agencia. Complete lo que está entre corchetes [ ] con sus datos.";
  function mesActual() { return new Date().toISOString().slice(0, 7); }
  function quitar(lista) { return lista.filter(function (x) { return x; }); }
  var SS3 = [["ss", "Seguro Social (jubilación, sobreviviente o incapacidad)"], ["ssi", "SSI"]];

  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function fechaLarga(iso) { var x = String(iso).split("-"); return x.length === 3 ? Number(x[2]) + " de " + MESES[Number(x[1]) - 1] + " de " + x[0] : iso; }
  function seleccion(id, etiqueta, lista, v, p) {
    return [h("label", { for: id }, etiqueta), h("select", { id: id }, lista.map(function (o) { return h("option", { value: o[0], text: o[1], selected: v === o[0] ? "selected" : null }); })),
      p[id] ? h("p", { class: "err", role: "alert", text: p[id] }) : null];
  }
  function casilla(id, etiqueta, v) { return h("label", { class: "tick", for: id }, h("input", { type: "checkbox", id: id, checked: v ? "checked" : null }), h("span", { text: etiqueta })); }
  function marcada(id) { var el = document.getElementById(id); return !!(el && el.checked); }
  function ultimosMeses() {
    var hoy = new Date(), out = [];
    for (var i = 5; i >= 0; i--) { var d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); out.push(d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2)); }
    return out;
  }
  function siNo(v) { return v === "yes" ? true : (v === "no" ? false : null); }
  /* Las partes que todo aviso de pago de más debe tener. tests/test_es.py revisa que sean las mismas de rules/noticecheck.json. */
  var PARTES = [["total", "La cantidad total que le pagaron de más"], ["months", "Los meses en que ocurrió el pago de más"],
    ["paid_due", "Lo que le pagaron y lo que le debieron pagar, por cada mes (una sola oración basta cuando se trata de un solo mes o una sola cantidad)"],
    ["cause", "Por qué correspondía una cantidad diferente: qué pasó para causar el pago de más"], ["recon", "Su derecho a pedir una reconsideración si cree que el pago de más está mal, y cómo pedirla"],
    ["waiver", "Su derecho a pedir al Seguro Social que no cobre el dinero (una exención), y cómo pedirla"], ["refund", "Una solicitud de que devuelva la cantidad completa"],
    ["withholding", "Lo que le retendrán de sus pagos si no devuelve todo (para SSI: el 10% del pago, si todavía recibe SSI)"], ["start", "El mes y el año en que comenzará la retención", "ssi"],
    ["options", "Otras maneras de pagar: una cantidad retenida diferente, pagos mensuales, o el cobro de otro pago del Seguro Social"]];

  /* Los cambios que se pueden informar, y para qué beneficio (r, d, s). tests/test_es.py revisa que sean los de rules/reporting.json. */
  var CAMBIOS = [["address", "Dirección o número de teléfono", "rds"],
    ["direct_deposit", "Cuenta de banco para el depósito directo", "rd"],
    ["work", "Empezar o dejar de trabajar, o un cambio de sueldo o de horas", "ds"],
    ["earnings", "Ganancias del año que serán más altas o más bajas de lo que dijo al Seguro Social", "r"],
    ["income", "Otros ingresos, incluidos los de su cónyuge", "s"],
    ["resources", "Ahorros o cosas que usted tiene (recursos)", "s"],
    ["living", "Dónde o con quién vive, o ayuda con los gastos de vida", "s"],
    ["marriage", "Matrimonio, separación o divorcio", "rds"],
    ["name", "Cambio de nombre", "rds"],
    ["death", "Una muerte en la familia o en el hogar", "rds"],
    ["travel", "Salir de los Estados Unidos por 30 días o más", "rds"],
    ["child", "Un niño a su cargo se muda o cambia de dirección", "rd"],
    ["other_benefit", "Otro beneficio o pago empieza, cambia o termina", "ds"],
    ["pension", "Una pensión de un trabajo que no pagó impuestos del Seguro Social", "rd"],
    ["medical", "Su condición médica mejora", "ds"],
    ["institution", "Entrar o salir de un hospital, un hogar de ancianos u otra institución", "s"],
    ["school", "Asistencia a la escuela, si tiene menos de 22 años", "s"]];

  /* Lo que más hace que devuelvan una renovación. tests/test_es.py revisa que sea la lista de renewal.py. */
  var REVISIONES = [["signed", "Cada página que pide una firma está firmada y con fecha"], ["all_pages", "Están todas las páginas del formulario, incluso las que no tienen cambios"], ["case_number", "Su nombre y su número de caso están en cada página que envía"], ["copies", "Está enviando copias y se queda con los originales"], ["readable", "Cada foto o copia se puede leer: se ven las cuatro esquinas, no hay nada cortado y no está borrosa"], ["changes", "Informó cualquier cambio: dirección, ingresos, quién vive con usted"]];

  var CIFRAS = ["annual_income", "adjusted_income", "dependent_deduction", "elderly_deduction", "medical_deduction", "childcare_deduction", "other_deduction", "ttp", "utility_allowance", "your_rent", "gross_rent",
    "payment_standard", "minimum_rent", "childcare_costs", "medical_costs", "income_now"];
  /* Una hoja de alquiler. pre es "" para una sola hoja, o "old_" y "new_" cuando se comparan dos. */
  function hojaAlquiler(pre, f, p) {
    f = f || {};
    function c(k, etiqueta, ayuda) { return h("div", { class: "field" }, campo(pre + k, etiqueta, ayuda, "dinero", f[k], p)); }
    return [opciones(pre + "program", "¿Qué tipo de ayuda tiene?", [["voucher", "Un Vale de Elección de Vivienda (Sección 8)"], ["public_housing", "Vivienda pública"]], f.program, p),
      campo(pre + "dependents", "Número de dependientes", "Niños menores de 18 años, y adultos que estudian a tiempo completo o tienen una discapacidad, sin contar al jefe de familia, su cónyuge o el otro jefe de familia.", "text", f.dependents, p),
      casilla(pre + "elderly_disabled", "El jefe de familia, su cónyuge o el otro jefe de familia tiene 62 años o más, o tiene una discapacidad", f.elderly_disabled),
      grupo("De su aviso u hoja de cálculo del alquiler", [h("p", { class: "hint", text: "Deje una casilla vacía si sus papeles no lo muestran. Si solo muestran el pago total del inquilino, puede escribir eso en vez del ingreso." }),
        h("div", { class: "money-grid" }, c("annual_income", "Ingreso anual", "El ingreso anual total que se usó para su alquiler."), c("adjusted_income", "Ingreso anual ajustado", "Después de las deducciones, si aparece."),
          c("dependent_deduction", "Deducción por dependientes"), c("elderly_deduction", "Deducción para familias de personas mayores o con discapacidad"), c("medical_deduction", "Deducción por gastos médicos"),
          c("childcare_deduction", "Deducción por cuidado de niños"), c("other_deduction", "Cualquier otra deducción"), c("ttp", "Pago total del inquilino (TTP)", "Una cifra mensual."),
          c("utility_allowance", "Asignación para servicios públicos", "Mensual. Si usted paga los servicios."), c("your_rent", "Alquiler que paga cada mes", "Lo que el aviso dice que usted paga."),
          c("gross_rent", "Alquiler bruto (vales)", "El alquiler al dueño más la asignación para servicios públicos."), c("payment_standard", "Estándar de pago (vales)"),
          c("minimum_rent", "Alquiler mínimo, si su aviso menciona uno", "Como máximo $50."))]),
      casilla(pre + "new_lease", "Esto es para un contrato nuevo o una mudanza a otra unidad (vales)", f.new_lease),
      grupo("Sus propios gastos y cambios (opcional)", h("div", { class: "money-grid" }, c("childcare_costs", "Cuidado de niños que paga cada año", "Para que alguien pueda trabajar o estudiar."),
        c("medical_costs", "Gastos médicos que el seguro no paga, cada año", "Cuenta solo para familias de personas mayores o con discapacidad."), c("income_now", "Su ingreso anual ahora, si bajó")))];
  }
  function leerHoja(pre) {
    var f = { program: elegido(pre + "program"), dependents: valor(pre + "dependents"), elderly_disabled: marcada(pre + "elderly_disabled"), new_lease: marcada(pre + "new_lease") };
    CIFRAS.forEach(function (k) { f[k] = valor(pre + k); });
    return f;
  }
  function pasosAlquiler(r) {
    return h("table", { class: "plain" }, h("tr", {}, ["Paso", "Con sus cifras", "Sus papeles dicen"].map(function (x) { return h("th", { text: x }); })),
      r.steps.map(function (x) { return h("tr", {}, h("td", {}, h("b", { text: x.what }), h("br"), h("span", { class: "small", text: x.how })), h("td", { class: "num", text: dinero(x.value) }),
        h("td", { class: "num", text: x.stated === null || x.stated === undefined ? "No lo escribió" : dinero(x.stated) })); }));
  }

  var HERRAMIENTAS = {
    sobrepago: herramienta({
      api: "sobrepago", boton: "Ver mis fechas", titulo: "El Seguro Social dice que me pagó de más",
      entrada: "Una carta de pago en exceso (overpayment) le pide devolver dinero. Dos fechas deciden lo que todavía puede hacer: pedir algo dentro de 30 días detiene el cobro, y la apelación tiene 60 días.",
      dibujar: function (s, p) { return campo("notice_date", "Fecha impresa en la carta", null, "date", s.notice_date, p); },
      leer: function () { return { notice_date: valor("notice_date") }; },
      ejemplo: function () { return { notice_date: hace(12) }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.titular }), fechas(r.fechas), h("p", { text: r.consejo }),
          h("h2", { text: "Lo que puede pedir" }),
          r.opciones.map(function (o) {
            return [h("h3", { text: o.nombre }), h("p", {}, h("b", { text: "Cuándo: " }), o.cuando), h("p", {}, h("b", { text: "Plazo: " }), o.plazo),
              o.telefono ? h("p", { text: o.telefono }) : null,
              h("p", { class: "small" }, "Formulario " + o.formulario + " (", h("span", { lang: "en", text: o.oficial }), "): ", enlace(o.enlace, "abrir el formulario"))];
          }),
          h("h2", { text: "Qué hacer" }), pasos(r.pasos), cierre(r, volver));
      }
    }),
    negado: herramienta({
      api: "negado", boton: "Ver mis fechas", titulo: "El Seguro Social me negó un beneficio, o no estoy de acuerdo con una decisión",
      entrada: "Por lo general tiene 60 días para apelar. Hay cuatro pasos de apelación, en orden. Vea su fecha y cuál es su siguiente paso.",
      dibujar: function (s, p) {
        return [campo("notice_date", "Fecha impresa en la carta", null, "date", s.notice_date, p),
          opciones("stage", "¿Qué decisión es?", [["initial", "La primera decisión sobre mi solicitud o mis beneficios"], ["reconsideration", "Una decisión sobre una reconsideración que pedí"],
            ["hearing", "Una decisión de un juez después de una audiencia"], ["appeals_council", "Una decisión, o una negación de revisión, del Consejo de Apelaciones"], ["unknown", "No estoy seguro"]], s.stage, p),
          opciones("medical", "¿La decisión es sobre si usted está incapacitado?", [["no", "No, o no estoy seguro"], ["yes", "Sí"]], s.medical || "no", p)];
      },
      leer: function () { return { notice_date: valor("notice_date"), stage: elegido("stage"), medical: elegido("medical") }; },
      ejemplo: function () { return { notice_date: hace(20), stage: "initial", medical: "yes" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.titular }), fechas(r.fechas), h("p", { text: r.consejo }),
          h("h2", { text: "Los cuatro pasos de apelación" }),
          h("ol", {}, r.niveles.map(function (n) {
            return h("li", {}, h("b", { text: n.nombre + (n.suyo ? " (su siguiente paso)" : "") }), h("br"), n.texto + " ",
              n.formulario ? "Formulario " + n.formulario + ". " : "", enlace(n.enlace, "Página del Seguro Social (en inglés)"));
          })),
          h("h2", { text: "Qué hacer" }), pasos(r.pasos), cierre(r, volver));
      }
    }),
    incapacidad: herramienta({
      api: "incapacidad", boton: "Ver mis fechas", titulo: "El Seguro Social dice que mi incapacidad terminó",
      entrada: "Después de una revisión médica, una carta dice que sus beneficios por incapacidad van a terminar. Hay un plazo muy corto para pedir que sigan durante la apelación, y otro de 60 días para apelar.",
      dibujar: function (s, p) { return campo("notice_date", "Fecha impresa en la carta", null, "date", s.notice_date, p); },
      leer: function () { return { notice_date: valor("notice_date") }; },
      ejemplo: function () { return { notice_date: hace(4) }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.titular }), fechas(r.fechas), r.consejos.map(function (c) { return h("p", { text: c }); }),
          dosLados(r.dos_lados),
          h("h2", { text: "Los dos formularios" }),
          h("ul", {}, r.formularios.map(function (f) { return h("li", {}, h("b", { text: f.formulario + ": " }), f.texto + " ", enlace(f.enlace, "abrir el formulario")); })),
          h("h2", { text: "Qué hacer" }), pasos(r.pasos), cierre(r, volver));
      }
    }),
    audiencia: herramienta({
      api: "audiencia", boton: "Ver mis fechas", titulo: "Me negaron, redujeron o quitaron SNAP o Medicaid",
      entrada: "Puede pedir una audiencia imparcial (fair hearing). Si le van a reducir o quitar beneficios, pedirla antes de la fecha del cambio puede mantenerlos igual mientras espera.",
      dibujar: function (s, p) {
        return [opciones("program", "¿Qué programa?", [["snap", "SNAP (asistencia de alimentos)"], ["medicaid", "Medicaid"]], s.program, p),
          opciones("action", "¿Qué dice el aviso?", [["denied", "Negaron mi solicitud"], ["reduced", "Van a reducir mis beneficios"], ["stopped", "Van a quitar mis beneficios"]], s.action, p),
          opciones("state", "¿En qué estado?", [["FL", "Florida"], ["CA", "California"], ["NY", "Nueva York"], ["PA", "Pensilvania"], ["OH", "Ohio"], ["MI", "Míchigan"], ["other", "Otro estado"]], s.state || "FL", p),
          campo("notice_date", "Fecha impresa en el aviso", null, "date", s.notice_date, p),
          campo("effective_date", "Fecha en que el cambio entra en vigor", "Opcional. Escríbala solo si aparece en su aviso.", "date", s.effective_date, p),
          opciones("plan", "Si es Medicaid: ¿fue su plan de salud el que negó un servicio?", [["no", "No"], ["yes", "Sí"]], s.plan || "no", p)];
      },
      leer: function () { return { program: elegido("program"), action: elegido("action"), state: elegido("state"), notice_date: valor("notice_date"), effective_date: valor("effective_date"), plan: elegido("plan") }; },
      ejemplo: function () { return { program: "snap", action: "reduced", state: "FL", notice_date: hace(8), effective_date: en(9), plan: "no" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.titular }), fechas(r.fechas), r.notas.map(function (n) { return h("p", { text: n }); }),
          dosLados(r.dos_lados),
          h("h2", { text: "Qué hacer" }), pasos(r.pasos),
          r.contacto ? h("p", { lang: r.contacto.idioma === "en" ? "en" : null }, h("b", { text: "Cómo pedirla: " }), r.contacto.texto) : null,
          carta(r.carta), cierre(r, volver));
      }
    }),
    snap: herramienta({
      api: "snap", boton: "Ver mis fechas", titulo: "El estado dice que me pagó SNAP de más",
      entrada: "Una carta que dice que recibió más SNAP del que le correspondía se llama reclamo (claim). Puede pedir que le expliquen la cantidad, pedir una audiencia y pedir pagar poco a poco.",
      dibujar: function (s, p) {
        return [campo("notice_date", "Fecha impresa en la carta", null, "date", s.notice_date, p),
          opciones("kind", "¿Qué dice la carta que lo causó?", [["mistake", "Un error de mi hogar"], ["agency", "Un error de la agencia"], ["ipv", "Una violación intencional del programa (fraude)"], ["unsure", "No estoy seguro"]], s.kind, p),
          campo("amount", "Cantidad que la carta dice que debe", "Opcional.", "dinero", s.amount, p),
          campo("allotment", "Su cantidad mensual de SNAP ahora", "Opcional. Déjelo vacío si ya no recibe SNAP.", "dinero", s.allotment, p)];
      },
      leer: function () { return { notice_date: valor("notice_date"), kind: elegido("kind"), amount: valor("amount"), allotment: valor("allotment") }; },
      ejemplo: function () { return { notice_date: hace(12), kind: "mistake", amount: "840", allotment: "298" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.titular }), fechas(r.fechas),
          r.tasa ? [h("h2", { text: "Lo que pueden quitarle de su SNAP cada mes" }), h("ul", {}, r.tasa.map(function (x) {
            return h("li", { text: "Por " + x.tipo + ": " + dinero(x.mensual) + " al mes" + (x.meses ? ", lo que lo pagaría en unos " + x.meses + " meses" : "") + "." });
          }))] : null,
          h("h2", { text: "Qué hacer" }), pasos(r.pasos), carta(r.carta), cierre(r, volver));
      }
    }),
    "deuda-va": herramienta({
      api: "va-debt", boton: "Ver mis fechas", titulo: "Recibí una carta de deuda del VA",
      entrada: "Una carta del Centro de Administración de Deudas del VA (Debt Management Center) dice que le pagaron de más en compensación por incapacidad, pensión o beneficios de educación. Lo que puede pedir depende de qué tan pronto conteste. Vea las tres fechas que importan.",
      dibujar: function (s, p) {
        return [campo("letter_date", "Fecha en que recibió la primera carta de deuda", "Si no está seguro, use la fecha impresa en la carta.", "date", s.letter_date, p),
          opciones("kind", "¿De qué beneficio es la deuda?", [["comp", "Compensación por incapacidad o pensión"], ["education", "Beneficios de educación (como el GI Bill)"]], s.kind, p),
          opciones("view", "¿Qué describe mejor su caso?", [["wrong", "Creo que la deuda o la cantidad está mal"], ["cant_pay", "La deuda puede estar bien, pero no puedo pagarla"], ["can_pay_slowly", "Puedo pagarla, pero necesito pagos más pequeños"], ["unsure", "No estoy seguro"]], s.view, p),
          campo("amount", "Cantidad de la deuda", "Opcional.", "dinero", s.amount, p),
          opciones("gets_benefits", "¿Recibe ahora un pago mensual de beneficios del VA?", SN, s.gets_benefits || "no", p)];
      },
      leer: function () { return { letter_date: valor("letter_date"), kind: elegido("kind"), view: elegido("view"), amount: valor("amount"), gets_benefits: elegido("gets_benefits") }; },
      ejemplo: function () { return { letter_date: hace(9), kind: "comp", view: "cant_pay", amount: "4200", gets_benefits: "yes" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }), fechasEn(r.dates), h("h2", { text: "Qué hacer" }), pasos(r.steps), carta(r.words),
          h("p", {}, enlace("https://www.va.gov/manage-va-debt/", "Administrar su deuda del VA en va.gov (en inglés)")), cierreEn(r, volver, "va-debt"));
      }
    }),
    "revision-incapacidad": herramienta({
      api: "disability-review", boton: "Ver qué hacer", titulo: "El Seguro Social me envió un formulario de revisión de incapacidad",
      entrada: "De vez en cuando el Seguro Social revisa que las personas todavía tengan una incapacidad. Envía un formulario corto (SSA-455) o uno largo (SSA-454). Por lo general los beneficios continúan, pero no devolver el formulario puede detenerlos.",
      dibujar: function (s, p) {
        return [opciones("form", "¿Qué formulario recibió?", [["455", "SSA-455, Disability Update Report (corto)"], ["454", "SSA-454, Continuing Disability Review Report (largo)"], ["unsure", "No estoy seguro"]], s.form, p),
          opciones("program", "¿Qué beneficio recibe?", [["ss", "Seguro Social por incapacidad (SSDI)"], ["ssi", "SSI"], ["both", "Los dos"]], s.program, p),
          opciones("status", "¿En qué punto está?", [["have_it", "Tengo el formulario y todavía no lo he enviado"], ["sent", "Ya lo devolví"], ["missed", "Se me pasó la fecha, o perdí el formulario"], ["stopped", "Mis pagos se detuvieron"]], s.status, p),
          campo("due", "Fecha en que la carta dice que debe devolverlo", "Opcional. Escriba solo una fecha impresa en su carta.", "date", s.due, p),
          opciones("payee", "¿Otra persona recibe sus pagos por usted (un representante de beneficiario)?", SN, s.payee || "no", p)];
      },
      leer: function () { return { form: elegido("form"), program: elegido("program"), status: elegido("status"), due: valor("due"), payee: elegido("payee") }; },
      ejemplo: function () { return { form: "454", program: "ss", status: "have_it", due: en(12), payee: "no" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }), fechasEn(r.dates), h("h2", { text: "Qué hacer" }), pasos(r.steps),
          h("h2", { text: "Cada cuánto hay revisiones" }), h("p", { text: r.often }), cierreEn(r, volver, "disability-review"));
      }
    }),
    "desempleo-florida": herramienta({
      api: "ra-overpayment", boton: "Ver mi fecha para apelar", titulo: "Florida dice que me pagó desempleo de más",
      entrada: "Una determinación del programa de asistencia de reempleo de Florida (Reemployment Assistance) dice que le pagaron beneficios que no le correspondían. Tiene 20 días para apelar. Vea la fecha, y lo que dice la ley de Florida sobre devolver el dinero.",
      dibujar: function (s, p) {
        return [campo("mailed", "Fecha de envío que aparece en la determinación", null, "date", s.mailed, p),
          opciones("fraud", "¿Dice que hubo fraude?", [["no", "No"], ["yes", "Sí"], ["unsure", "No estoy seguro"]], s.fraud, p),
          opciones("cause", "¿Qué describe mejor su caso?", [["employer_late", "Mi empleador contestó tarde, y la decisión cambió"], ["agency", "La agencia cometió un error"], ["mine", "Yo cometí un error al reclamar"], ["unsure", "No estoy seguro"]], s.cause, p),
          campo("amount", "Cantidad que dice que le pagaron de más", "Opcional.", "dinero", s.amount, p)];
      },
      leer: function () { return { mailed: valor("mailed"), fraud: elegido("fraud"), cause: elegido("cause"), amount: valor("amount") }; },
      ejemplo: function () { return { mailed: hace(6), fraud: "no", cause: "employer_late", amount: "2750" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }), fechasEn(r.dates),
          r.penalty ? h("p", {}, "Si se decide que hubo fraude, la multa del 15% sobre " + dinero(r.amount) + " sería de ", h("b", { text: dinero(r.penalty) }), ".") : null,
          h("h2", { text: "Qué hacer" }), pasos(r.steps), cierreEn(r, volver, "ra-overpayment"));
      }
    }),
    "vale-vivienda": herramienta({
      api: "voucher-ending", boton: "Ver mis derechos", titulo: "Me van a quitar mi vale de vivienda",
      entrada: "Una autoridad de vivienda que quiere terminar su Vale de Elección de Vivienda (Housing Choice Voucher, Sección 8) debe decirle por escrito por qué y ofrecerle primero una audiencia informal. La fecha límite para pedirla está en el aviso, y muchas veces es corta.",
      dibujar: function (s, p) {
        return [campo("notice_date", "Fecha impresa en el aviso", null, "date", s.notice_date, p),
          campo("deadline", "Fecha límite del aviso para pedir una audiencia", "Opcional. Escriba solo una fecha impresa en su aviso.", "date", s.deadline, p),
          opciones("reason", "¿Qué razón da el aviso?", [["income", "Ingresos o datos del hogar que no se informaron"], ["absence", "Estar fuera de la vivienda demasiado tiempo"], ["lease", "Una violación del contrato de alquiler o un desalojo"], ["criminal", "Actividad criminal o relacionada con drogas"], ["obligations", "No hacer algo que el programa exige"], ["other", "Otra cosa"]], s.reason, p),
          opciones("asked", "¿Ya pidió la audiencia?", SN, s.asked || "no", p),
          opciones("disability", "¿Una discapacidad tiene relación con lo que pasó?", SN, s.disability || "no", p)];
      },
      leer: function () { return { notice_date: valor("notice_date"), deadline: valor("deadline"), reason: elegido("reason"), asked: elegido("asked"), disability: elegido("disability") }; },
      ejemplo: function () { return { notice_date: hace(4), deadline: en(6), reason: "income", asked: "no", disability: "no" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }), fechasEn(r.dates), h("h2", { text: "Qué hacer" }), pasos(r.steps),
          h("p", { class: "small", text: r.missing }), carta(r.words), cierreEn(r, volver, "voucher-ending"));
      }
    }),
    "sucesion-medicaid": herramienta({
      api: "estate-recovery", boton: "Ver las reglas", titulo: "Medicaid pide que la sucesión de un familiar le devuelva dinero",
      entrada: "Cuando muere una persona que recibió Medicaid, el estado puede pedir que sus bienes (la sucesión, en inglés estate) devuelvan parte de lo que Medicaid gastó. Hay personas a quienes no se les puede cobrar, y una exención por dificultades. Vea qué reglas pueden aplicarse.",
      dibujar: function (s, p) {
        return [opciones("state", "¿Qué estado pagó el Medicaid?", [["FL", "Florida"], ["other", "Otro estado"]], s.state || "FL", p),
          opciones("age55", "¿La persona tenía 55 años o más cuando Medicaid pagó la atención?", [["yes", "Sí"], ["no", "No, era más joven"], ["unsure", "No estoy seguro"]], s.age55, p),
          grupo("A la persona le sobrevive", [
            opciones("spouse", "¿Un esposo o una esposa?", SN, s.spouse || "no", p),
            opciones("child_under_21", "¿Un hijo menor de 21 años?", SN, s.child_under_21 || "no", p),
            opciones("disabled_child", "¿Un hijo de cualquier edad que es ciego o tiene una discapacidad?", SN, s.disabled_child || "no", p)]),
          grupo("Sobre los herederos y la casa", [
            opciones("home", "¿La persona era dueña de una casa?", SN, s.home || "no", p),
            opciones("heir_in_home", "¿Un heredero vive en esa casa, por lo menos desde hace 12 meses, y no es dueño de otra casa?", SN, s.heir_in_home || "no", p),
            opciones("heir_needs", "¿Pagar dejaría a un heredero sin comida, ropa, vivienda o atención médica?", SN, s.heir_needs || "no", p),
            opciones("caregiver", "¿Un hermano, una hermana, un hijo o una hija vivió con la persona un año o más y le dio cuidado de tiempo completo?", SN, s.caregiver || "no", p)])];
      },
      leer: function () {
        var o = { state: elegido("state"), age55: elegido("age55") };
        ["spouse", "child_under_21", "disabled_child", "home", "heir_in_home", "heir_needs", "caregiver"].forEach(function (k) { o[k] = elegido(k); });
        return o;
      },
      ejemplo: function () { return { state: "FL", age55: "yes", spouse: "no", child_under_21: "no", disabled_child: "no", home: "yes", heir_in_home: "yes", heir_needs: "no", caregiver: "yes" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }), h("h2", { text: "Qué hacer" }), pasos(r.steps), carta(r.words), cierreEn(r, volver, "estate-recovery"));
      }
    }),
    "parte-b": herramienta({
      api: "partb-late", boton: "Calcular", titulo: "No me inscribí a tiempo en la Parte B de Medicare",
      entrada: "Inscribirse tarde en la Parte B puede añadir una multa a la prima durante todo el tiempo que la tenga, a menos que le corresponda un período de inscripción especial. Vea la multa por los años que estuvo sin la Parte B, y su próxima oportunidad para inscribirse.",
      dibujar: function (s, p) {
        return [campo("years", "Años completos en que pudo tener la Parte B y no la tuvo", "Cuente solo períodos completos de 12 meses. No cuente el tiempo en que tuvo un plan de salud por su trabajo actual o el de su cónyuge.", "text", s.years, p),
          opciones("why", "¿Alguna de estas situaciones es la suya?", [["employer", "Tenía cobertura de salud por mi trabajo actual o el de mi cónyuge"], ["medicaid", "Tenía Medicaid y lo perdí"], ["misinformed", "Un plan de salud o un empleador me dio información incorrecta"],
            ["disaster", "Un desastre o una emergencia declarada me lo impidió"], ["released", "Salí de la cárcel o prisión"], ["none", "Ninguna de estas"]], s.why, p),
          campo("ended", "Si fue por un trabajo: el mes en que terminó el trabajo o su cobertura, lo que haya ocurrido primero", "Opcional.", "month", s.ended, p)];
      },
      leer: function () { return { years: valor("years"), why: elegido("why"), ended: valor("ended") }; },
      ejemplo: function () { return { years: "2", why: "none", ended: "" }; },
      resultado: function (r, volver) {
        var filas = [["Prima estándar de la Parte B, " + r.year, dinero(r.standard) + " al mes"], ["Años completos sin la Parte B", String(r.years)],
          ["Multa, si no se aplica un período de inscripción especial", r.percent + "%, unos " + dinero(r.extra) + " al mes"],
          ["Prima con esa multa", "unos " + dinero(r.total) + " al mes"], ["Período de Inscripción General", "del " + r.general.opens_long + " al " + r.general.closes_long]];
        if (r.special) filas.push(["Período de Inscripción Especial después del trabajo", "hasta el final de " + r.special.last_long + (r.special.open ? "" : " (ya pasó)")]);
        mostrar(h("h1", { class: "long", text: r.headline }), tabla(filas), h("h2", { text: "Qué hacer" }), pasos(r.steps), cierreEn(r, volver, "partb-late"));
      }
    }),
    "ley-equidad": herramienta({
      api: "fairness-act", boton: "Ver qué revisar", titulo: "Tengo una pensión pública. ¿Cambió mi Seguro Social?",
      entrada: "Hasta 2024, una pensión de un trabajo que no pagaba al Seguro Social podía reducir su propio beneficio o eliminar un beneficio de cónyuge o de sobreviviente. Una ley de 2025 terminó las dos reducciones. Vea qué debió pasar y qué revisar.",
      dibujar: function (s, p) {
        return [opciones("situation", "¿Qué describe mejor su caso?", [["reduced", "Mi Seguro Social fue reducido o suspendido por mi pensión"], ["never_applied", "Nunca solicité, porque me dijeron que recibiría poco o nada"], ["unsure", "No estoy seguro de si esto se aplica a mí"]], s.situation, p),
          opciones("kind", "¿Qué beneficio es?", [["own", "Mi propio beneficio de jubilación o de incapacidad"], ["spouse", "Un beneficio como esposo o esposa"], ["survivor", "Un beneficio como viudo o viuda"]], s.kind, p),
          opciones("got_increase", "¿Su cantidad mensual subió desde principios de 2025?", SN, s.got_increase || "no", p),
          opciones("got_backpay", "¿Recibió un pago retroactivo único?", SN, s.got_backpay || "no", p)];
      },
      leer: function () { return { situation: elegido("situation"), kind: elegido("kind"), got_increase: elegido("got_increase"), got_backpay: elegido("got_backpay") }; },
      ejemplo: function () { return { situation: "reduced", kind: "own", got_increase: "yes", got_backpay: "no" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }), h("ul", {}, r.facts.map(function (f) { return h("li", { text: f }); })),
          h("h2", { text: "Qué hacer" }), pasos(r.steps), cierreEn(r, volver, "fairness-act"));
      }
    }),
    "costos-medicare": herramienta({
      api: "medicare-costs", boton: "Comparar con los límites", titulo: "¿Podría un programa pagar mis costos de Medicare?",
      entrada: "Los Programas de Ahorros de Medicare pueden pagar su prima de la Parte B, y a veces mucho más. La Ayuda Adicional (Extra Help) reduce el costo de los medicamentos. Muchas personas que califican nunca solicitan. Compare sus cifras con los límites de 2026.",
      dibujar: function (s, p) {
        return [opciones("household", "¿Para quién es?", [["single", "Una persona"], ["couple", "Una pareja casada"]], s.household, p),
          campo("monthly_income", "Ingresos mensuales antes de cualquier descuento", "Incluya el Seguro Social antes de la prima de Medicare, las pensiones y el sueldo.", "dinero", s.monthly_income, p),
          campo("resources", "Dinero en cuentas de banco, acciones y efectivo", "No cuente su casa, un carro ni los lotes de cementerio.", "dinero", s.resources, p),
          opciones("state", "¿Dónde vive?", [["FL", "Florida"], ["other", "Otro estado"]], s.state || "FL", p)];
      },
      leer: function () { return { household: elegido("household"), monthly_income: valor("monthly_income"), resources: valor("resources"), state: elegido("state") }; },
      ejemplo: function () { return { household: "single", monthly_income: "1450", resources: "3200", state: "FL" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          h("table", { class: "plain" }, h("tr", {}, ["Programa", "Límite de ingresos al mes", "Límite de recursos", "Sus cifras"].map(function (x) { return h("th", { text: x }); })),
            r.programs.map(function (x) { return h("tr", {}, h("td", {}, h("b", { text: x.name }), h("br"), h("span", { class: "small", text: x.what })), h("td", { text: dinero(x.income_limit) }), h("td", { text: dinero(x.resource_limit) }),
              h("td", { text: x.may_fit ? "Podría entrar" : (!x.income_ok ? "Ingresos por encima" : "Recursos por encima") })); })),
          h("h2", { text: "Qué hacer" }), pasos(r.steps), cierreEn(r, volver, "medicare-costs"));
      }
    }),
    "snap-robado": herramienta({
      api: "stolen-snap", boton: "Ver qué hacer", titulo: "Me robaron mis beneficios de SNAP",
      entrada: "Los ladrones copian las tarjetas EBT con lectores escondidos y luego gastan los beneficios, muchas veces en otro estado. Detenga hoy más robos, y luego denúncielo.",
      dibujar: function (s, p) {
        return [opciones("state", "¿Dónde recibe SNAP?", [["FL", "Florida"], ["other", "Otro estado"]], s.state || "FL", p),
          campo("noticed", "Fecha en que se dio cuenta", "Opcional. Se pone en su declaración.", "date", s.noticed, p),
          campo("amount", "Más o menos cuánto le quitaron", "Opcional.", "dinero", s.amount, p)];
      },
      leer: function () { return { state: elegido("state"), noticed: valor("noticed"), amount: valor("amount") }; },
      ejemplo: function () { return { state: "FL", noticed: hace(2), amount: "212.50" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }), pasos(r.steps), borrador("Declaración para la denuncia policial (en inglés)", EN_INGLES, r.statement), cierreEn(r, volver, "stolen-snap"));
      }
    }),
    "cuenta-bloqueada": herramienta({
      api: "locked-out", boton: "Ver cómo volver a entrar", titulo: "No puedo entrar a mi cuenta del Seguro Social",
      entrada: "La cuenta por internet del Seguro Social ahora funciona solo con Login.gov o ID.me. Cuando no puede iniciar sesión, hay otras maneras de probar quién es usted, y casi todo se puede hacer por teléfono o en persona.",
      dibujar: function (s, p) {
        return [opciones("provider", "¿Con cuál servicio inicia sesión?", [["logingov", "Login.gov"], ["idme", "ID.me"], ["unsure", "No estoy seguro, o ninguno funciona"]], s.provider, p),
          opciones("problem", "¿Qué está fallando?", [["cant_verify", "No puede verificar mi identidad"], ["locked", "Dice que mi cuenta está bloqueada"], ["no_code", "El código nunca llega"], ["no_phone", "No tengo teléfono celular"], ["no_id", "Mi identificación no sube o está vencida"]], s.problem, p)];
      },
      leer: function () { return { provider: elegido("provider"), problem: elegido("problem") }; },
      ejemplo: function () { return { provider: "logingov", problem: "locked" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }), pasos(r.steps),
          h("p", {}, r.help.map(function (x, i) { return [i ? " · " : "", enlace(x.url, x.name + " (en inglés)")]; })), cierreEn(r, volver, "locked-out"));
      }
    }),
    "llamar-seguro-social": herramienta({
      api: "ssa-call", boton: "Preparar mi llamada", titulo: "No logro comunicarme con el Seguro Social",
      entrada: "Prepare la llamada: cuándo llamar, qué tener a mano y qué decir. Cuando llame al 1-800-772-1213 puede pedir un intérprete gratis.",
      dibujar: function (s, p) {
        return [opciones("topic", "¿De qué se trata la llamada?", [["letter", "Una carta que recibí"], ["overpayment", "Un pago de más"], ["payment", "Un pago que falta o que está mal"], ["claim", "Una solicitud o apelación que presenté"], ["card", "Mi tarjeta o una carta de beneficios"], ["other", "Otra cosa"]], s.topic, p),
          opciones("urgent", "¿Está sin dinero para comida, medicinas o vivienda por esto?", SN, s.urgent ? "yes" : "no", p)];
      },
      leer: function () { return { topic: elegido("topic"), urgent: elegido("urgent") === "yes" }; },
      ejemplo: function () { return { topic: "payment", urgent: false }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }), h("h2", { text: "Cuándo llamar" }), pasos(r.plan),
          h("h2", { text: "Tenga esto a mano" }), h("ul", {}, r.ready.map(function (x) { return h("li", { text: x }); })),
          borrador("Qué decir", "Anote la fecha y la hora de cada llamada, con quién habló y qué le dijeron.", r.words, "es"), cierreEn(r, volver, "ssa-call"));
      }
    }),
    "descuento-alto": herramienta({
      api: "withholding", boton: "Calcular", titulo: "Me están quitando demasiado de mi pago",
      entrada: "Si devolver un pago de más no le deja pagar lo necesario, puede pedir al Seguro Social que le quite menos. Haga un presupuesto, vea las cantidades que importan y obtenga una carta de solicitud.",
      dibujar: function (s, p) {
        var e = s.expenses || {};
        function g(k, etiqueta) { var q = {}; if (p["expenses." + k]) q["e-" + k] = p["expenses." + k]; return h("div", { class: "field" }, campo("e-" + k, etiqueta, null, "dinero", e[k], q)); }
        return [opciones("program", "¿Qué tipo de beneficio es?", [["t2", "Beneficios de jubilación, sobreviviente o incapacidad"], ["ssi", "SSI"]], s.program, p),
          campo("balance", "Lo que todavía debe", "Está en su aviso más reciente.", "dinero", s.balance, p),
          campo("taken", "Cuánto le quitan cada mes ahora", null, "dinero", s.taken, p),
          campo("income", "Sus ingresos mensuales totales", "Todo, antes de que le quiten el descuento.", "dinero", s.income, p),
          grupo("Sus gastos mensuales", [h("p", { class: "hint", text: "Deje una casilla vacía si no le corresponde." }), h("div", { class: "money-grid" },
            g("rent", "Alquiler o hipoteca"), g("utilities", "Luz, gas, agua"), g("food", "Comida"), g("medical", "Médicos y medicinas"), g("transport", "Transporte"),
            g("phone", "Teléfono e internet"), g("insurance", "Seguros"), g("debts", "Pagos de deudas"), g("other", "Otros gastos necesarios"))]),
          campo("resources", "Dinero en cuentas de banco y efectivo", "Opcional.", "dinero", s.resources, p),
          campo("ask", "Lo que podría pagar cada mes", "Opcional. Se pone en su carta.", "dinero", s.ask, p),
          opciones("extra_help", "¿Recibe la Ayuda Adicional (Extra Help) para los medicamentos de Medicare?", SN, s.extra_help ? "yes" : "no", p)];
      },
      leer: function () {
        var e = {}; ["rent", "utilities", "food", "medical", "transport", "phone", "insurance", "debts", "other"].forEach(function (k) { e[k] = valor("e-" + k); });
        return { program: elegido("program"), balance: valor("balance"), taken: valor("taken"), income: valor("income"), expenses: e, resources: valor("resources"), ask: valor("ask"), extra_help: elegido("extra_help") === "yes" };
      },
      ejemplo: function () { return { program: "t2", balance: "6400", taken: "760", income: "1520", expenses: { rent: "950", utilities: "160", food: "280", medical: "60", phone: "45" }, resources: "240", ask: "50", extra_help: false }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          tabla([["Todavía debe", dinero(r.balance)], ["Le quitan cada mes ahora", dinero(r.taken) + (r.months_at_current_rate ? " (unos " + r.months_at_current_rate + " meses)" : "")],
            ["Para pagar en 12 meses", dinero(r.in_12_months) + " al mes"], ["Para pagar en 60 meses", dinero(r.in_60_months) + " al mes"],
            ["Ingresos", dinero(r.income)], ["Gastos", dinero(r.expenses)], ["Queda cada mes", dinero(r.left)]]),
          h("h2", { text: "Qué hacer" }), pasos(r.steps), borrador("Solicitud de una tasa más baja (en inglés)", EN_INGLES, r.letter),
          borrador("Presupuesto para el formulario SSA-634 (en inglés)", "Las líneas siguen el formulario, que está en inglés.", r.budget), cierreEn(r, volver, "withholding"));
      }
    }),
    "papeles": herramienta({
      api: "paperwork", boton: "Ver mi fecha", titulo: "Perdí Medicaid o SNAP por papeles",
      entrada: "Muchas personas pierden la cobertura solo porque un formulario o una prueba no llegó. Durante un tiempo después de que termina, puede enviar los documentos y hacer que revisen su caso otra vez sin empezar de nuevo.",
      dibujar: function (s, p) {
        return [opciones("program", "¿Qué terminó?", [["medicaid", "Medicaid"], ["snap", "SNAP (asistencia de alimentos)"]], s.program, p),
          opciones("basis", "Si es Medicaid: ¿en qué se basa?", [["income", "Ingresos (la mayoría de los niños, padres, personas embarazadas y adultos menores de 65)"], ["abd", "65 años o más, ceguera o discapacidad"], ["unsure", "No estoy seguro"]], s.basis || "unsure", p),
          campo("ended", "Fecha en que terminó", "Para SNAP, el último día de su período de certificación. Está en su aviso.", "date", s.ended, p),
          opciones("state", "Su estado", [["FL", "Florida"], ["other", "Otro estado"]], s.state || "FL", p)];
      },
      leer: function () { return { program: elegido("program"), basis: elegido("basis"), ended: valor("ended"), state: elegido("state") }; },
      ejemplo: function () { return { program: "medicaid", basis: "income", ended: hace(20), state: "FL" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }), r.days_left >= 0 ? h("p", { class: "lead", text: (r.days_left === 1 ? "Queda 1 día" : "Quedan " + r.days_left + " días") + " desde hoy." }) : null,
          h("h2", { text: "Qué hacer" }), pasos(r.steps),
          r.contact ? h("p", {}, h("b", { text: r.contact.name + ": " }), r.contact.phone ? r.contact.phone + " · " : "", enlace(r.contact.portal, "Cuenta por internet")) : null,
          borrador("Nota para enviar con sus documentos (en inglés)", EN_INGLES, r.note), cierreEn(r, volver, "paperwork"));
      }
    }),
    "apelacion-tarde": herramienta({
      api: "late-appeal", boton: "Revisar mi plazo", titulo: "Se me pasó el plazo para apelar",
      entrada: "Por lo general tiene 60 días para apelar una decisión del Seguro Social o de SSI. Si ese tiempo ya pasó, todavía puede pedirlo. El Seguro Social puede aceptar una apelación tardía cuando hubo una buena razón (\"good cause\").",
      dibujar: function (s, p) {
        return [opciones("program", "¿De qué beneficio es la decisión?", SS3, s.program, p),
          campo("letter_date", "Fecha impresa en la carta de decisión", null, "date", s.letter_date, p),
          campo("arrived", "Día en que le llegó la carta, si llegó tarde", "Opcional. Déjelo en blanco si llegó en unos 5 días.", "date", s.arrived, p),
          marcas("reasons", "¿Qué le impidió apelar a tiempo?", [["illness", "Estuve gravemente enfermo"], ["family", "Hubo una muerte o enfermedad grave en mi familia inmediata"], ["records", "Se destruyeron o dañaron documentos que necesitaba"],
            ["searching", "Estaba buscando información que necesitaba y no la encontré a tiempo"], ["explained", "Pedí al Seguro Social que me explicara la decisión antes del plazo"],
            ["wrong_info", "El Seguro Social me dio información incorrecta o incompleta"], ["no_notice", "Nunca recibí la carta de decisión"], ["other_agency", "Envié mi solicitud a tiempo a otra agencia del gobierno"],
            ["limits", "Una limitación física, mental, educativa o de idioma me lo impidió"], ["unusual", "Pasó algo fuera de lo común que no pude evitar"]], s.reasons, p, "Marque todas las que correspondan. Déjelas en blanco si todavía no está tarde."),
          texto("story", "En sus propias palabras, con fechas", "Opcional. Se pone tal como lo escriba en su declaración, que va en inglés. Si puede, escríbalo en inglés.", s.story, p)];
      },
      leer: function () { return { program: elegido("program"), letter_date: valor("letter_date"), arrived: valor("arrived"), reasons: marcados("reasons"), story: valor("story") }; },
      ejemplo: function () { return { program: "ss", letter_date: hace(110), reasons: ["illness"], story: "I was in the hospital for most of the time after the letter came." }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          tabla(quitar([["Último día normal para apelar", r.deadline_long], r.moved ? ["Por qué se movió", "El día 65 cayó en fin de semana o feriado, y el plazo pasó al siguiente día hábil."] : null, r.late ? ["Días de retraso", String(r.days_late)] : null])),
          h("h2", { text: "Qué hacer" }), pasos(r.steps), r.late ? borrador("Declaración de buena causa (en inglés)", EN_INGLES, r.statement) : null,
          h("p", {}, enlace("https://www.ssa.gov/apply/appeal-decision-we-made", "Cómo apelar, en ssa.gov (en inglés)")), cierreEn(r, volver, "late-appeal"));
      }
    }),
    "pago-no-llego": herramienta({
      api: "payment-missing", boton: "Ver las fechas", titulo: "Mi pago no llegó",
      entrada: "Los pagos llegan en días fijos. El Seguro Social pide que espere tres días de reparto de correo después de la fecha de pago antes de informar que falta. Vea cuándo correspondía el suyo y cuándo puede informarlo.",
      dibujar: function (s, p) {
        return [opciones("kind", "¿Qué pago está esperando?", SS3.concat([["both", "Recibo los dos"]]), s.kind, p),
          campo("birth_day", "Día de nacimiento del trabajador en cuyo registro le pagan", "Solo para Seguro Social. Su propio día de nacimiento si es su propio beneficio; para un beneficio de cónyuge o de hijo, el del trabajador. Por ejemplo, 14 si nació un 14 de junio.", "text", s.birth_day, p),
          opciones("before_1997", "¿Empezó a recibir Seguro Social antes de mayo de 1997?", SN, s.before_1997 || "no", p),
          campo("month", "Mes del pago", null, "month", s.month || mesActual(), p)];
      },
      leer: function () { return { kind: elegido("kind"), birth_day: valor("birth_day"), before_1997: elegido("before_1997"), month: valor("month") }; },
      ejemplo: function () { return { kind: "ss", birth_day: "14", before_1997: "no", month: mesActual() }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          h("table", { class: "plain" }, h("tr", {}, ["Pago", "Fecha de pago", "Puede informar que falta desde"].map(function (x) { return h("th", { text: x }); })),
            r.payments.map(function (x) { return h("tr", {}, h("td", { text: x.name }), h("td", { text: x.due_long + (x.moved ? " (se adelantó por un fin de semana o feriado)" : "") }), h("td", { text: x.report_from_long })); })),
          h("h2", { text: "Qué hacer" }), pasos(r.steps), cierreEn(r, volver, "payment-missing"));
      }
    }),
    "descuento-por-deuda": herramienta({
      api: "offset", boton: "Ver el límite", titulo: "Me quitan parte de mi beneficio por una deuda",
      entrada: "La mayoría de los acreedores no pueden quitar el Seguro Social. Algunas deudas sí se pueden cobrar de él, como los préstamos estudiantiles federales en incumplimiento, los impuestos federales y la manutención de hijos, y la ley federal limita cuánto. Compare lo que le quitan con el límite.",
      dibujar: function (s, p) {
        return [opciones("benefit", "¿Qué beneficio?", SS3, s.benefit, p),
          opciones("debt", "¿De qué es la deuda?", [["student_loan", "Un préstamo estudiantil federal"], ["federal", "Otra deuda federal (no de impuestos)"], ["taxes", "Impuestos federales sobre los ingresos"], ["child_support", "Manutención de hijos o pensión alimenticia"], ["private", "Una tarjeta de crédito, una cuenta médica u otra deuda privada"]], s.debt, p),
          campo("monthly_benefit", "Su beneficio mensual después de la prima de Medicare", "No reste lo que le quitan por esta deuda ni para devolver un pago de más.", "dinero", s.monthly_benefit, p),
          campo("taken", "Cuánto le quitan cada mes", "Opcional.", "dinero", s.taken, p)];
      },
      leer: function () { return { benefit: elegido("benefit"), debt: elegido("debt"), monthly_benefit: valor("monthly_benefit"), taken: valor("taken") }; },
      ejemplo: function () { return { benefit: "ss", debt: "student_loan", monthly_benefit: "1180", taken: "177" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          r.limit !== null ? tabla(quitar([["Beneficio mensual después de la prima de Medicare", dinero(r.monthly_benefit)], ["Lo máximo que le pueden quitar", dinero(r.limit)], r.taken !== null ? ["Le quitan ahora", dinero(r.taken)] : null,
            ["Lo que queda después del máximo", dinero(r.monthly_benefit - r.limit)]])) : null,
          h("h2", { text: "Qué hacer" }), pasos(r.steps), cierreEn(r, volver, "benefit-offset"));
      }
    }),
    "prima-por-ingresos": herramienta({
      api: "irmaa", boton: "Revisar mi prima", titulo: "Mi prima de Medicare es más alta por mis ingresos",
      entrada: "Si sus ingresos de hace dos años pasaron de un límite, usted paga más por la Parte B y la Parte D de Medicare (IRMAA). Si desde entonces sus ingresos bajaron por la jubilación u otro evento que cambió su vida, puede pedir una nueva decisión.",
      dibujar: function (s, p) {
        var y = new Date().getFullYear();
        return [opciones("year", "¿De la prima de qué año habla su carta?", [[String(y), String(y)], [String(y + 1), String(y + 1) + " (cartas enviadas cerca del final de " + y + ")"]], s.year || String(y), p),
          opciones("filing", "¿Cómo presentó la declaración de impuestos de dos años antes de ese año?", [["single", "Soltero, cabeza de familia o cónyuge sobreviviente"], ["joint", "Casado, declaración conjunta"], ["separate", "Casado, declaración por separado (vivía con su cónyuge)"]], s.filing, p),
          campo("magi", "Ingreso bruto ajustado modificado de esa declaración", "Su ingreso bruto ajustado más los intereses exentos de impuestos. La cantidad está en la carta sobre su prima.", "dinero", s.magi, p),
          opciones("event", "¿Pasó algo de esto desde entonces?", [["none", "Nada de esto"], ["work_stopped", "Mi cónyuge o yo dejamos de trabajar"], ["work_reduced", "Mi cónyuge o yo redujimos el trabajo"], ["death", "Mi cónyuge murió"],
            ["divorce", "Divorcio o anulación"], ["marriage", "Matrimonio"], ["pension", "Una pensión terminó o se redujo"], ["property", "Se perdió en un desastre una propiedad que producía ingresos"], ["settlement", "Un acuerdo de pago de un empleador después de un cierre o una quiebra"]], s.event || "none", p),
          campo("new_income", "Los ingresos que espera este año", "Opcional. Sirve para mostrar cuál podría ser la prima después de una nueva decisión.", "dinero", s.new_income, p)];
      },
      leer: function () { return { year: elegido("year"), filing: elegido("filing"), magi: valor("magi"), event: elegido("event"), new_income: valor("new_income") }; },
      ejemplo: function () { return { year: String(new Date().getFullYear()), filing: "joint", magi: "290000", event: "work_stopped", new_income: "120000" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          tabla(quitar([["Año", String(r.year) + " (según su declaración de impuestos de " + r.tax_year + ")"], ["Prima de la Parte B al mes", dinero(r.part_b)], ["Cargo adicional de la Parte D al mes", dinero(r.part_d_extra)],
            ["Lo que paga de más sobre la prima estándar", dinero(r.monthly_extra)], r.new_level !== undefined ? ["Con los ingresos que espera", dinero(r.new_part_b) + " de Parte B, " + dinero(r.new_monthly_extra) + " de más en total"] : null])),
          h("h2", { text: "Qué hacer" }), pasos(r.steps), h("p", {}, enlace("https://www.ssa.gov/forms/ssa-44.html", "Formulario SSA-44 en ssa.gov (en inglés)")), cierreEn(r, volver, "medicare-irmaa"));
      }
    }),
    "despues-de-una-muerte": herramienta({
      api: "after-death", boton: "Ver qué hacer", titulo: "Murió alguien que recibía beneficios",
      entrada: "Cuando muere una persona que recibía Seguro Social o SSI, algunos pagos se tienen que devolver, y los familiares pueden recibir un pago único o beneficios mensuales de sobreviviente. Vea qué meses importan y qué hacer primero.",
      dibujar: function (s, p) {
        return [campo("died_on", "Fecha de la muerte", null, "date", s.died_on, p),
          opciones("benefit", "¿Qué recibía la persona?", SS3.concat([["both", "Los dos"]]), s.benefit, p),
          opciones("relationship", "¿Cuál era su relación?", [["spouse_with", "Cónyuge, vivía en la misma casa"], ["spouse_apart", "Cónyuge, vivía aparte"], ["child", "Hijo o hija"], ["other", "Otro familiar o un amigo"]], s.relationship, p)];
      },
      leer: function () { return { died_on: valor("died_on"), benefit: elegido("benefit"), relationship: elegido("relationship") }; },
      ejemplo: function () { return { died_on: hace(20), benefit: "ss", relationship: "spouse_with" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          r.payments.map(function (x) { return [h("h2", { text: x.name }), h("ul", {}, h("li", { text: x.keep }), h("li", {}, h("b", { text: x["return"] })))]; }),
          h("h2", { text: "El pago único de $255" }), h("p", { text: r.lump_text + (r.lump_by_long ? " Solicítelo a más tardar el " + r.lump_by_long + "." : "") }),
          h("h2", { text: "Qué hacer" }), pasos(r.steps), cierreEn(r, volver, "after-death"));
      }
    }),
    "volver-a-recibir": herramienta({
      api: "reinstate", boton: "Revisar mi plazo", titulo: "Mis beneficios se detuvieron cuando volví a trabajar",
      entrada: "Si sus beneficios por incapacidad terminaron porque ganaba demasiado, y ya no puede trabajar a ese nivel, puede pedir que se reanuden sin una solicitud nueva, hasta por 5 años. Esto se llama restablecimiento acelerado (expedited reinstatement).",
      dibujar: function (s, p) {
        return [opciones("program", "¿Qué beneficio se detuvo?", [["ss", "Seguro Social por incapacidad (SSDI)"], ["ssi", "SSI"]], s.program, p),
          campo("ended", "Mes en que terminaron los beneficios por el trabajo", "Está en la carta que dijo que sus beneficios se detendrían.", "month", s.ended, p),
          opciones("condition", "¿Su condición de ahora es la misma, o está relacionada con la condición por la que recibía beneficios?", [["same", "Sí"], ["different", "No, es una condición diferente"], ["unsure", "No estoy seguro"]], s.condition, p),
          campo("earnings", "Lo que gana ahora cada mes, antes de impuestos", "Opcional. Escriba 0 si dejó de trabajar.", "dinero", s.earnings, p),
          opciones("blind", "¿Recibía beneficios por ceguera?", SN, s.blind || "no", p)];
      },
      leer: function () { return { program: elegido("program"), ended: valor("ended"), condition: elegido("condition"), earnings: valor("earnings"), blind: elegido("blind") }; },
      ejemplo: function () { var d = new Date(); d.setMonth(d.getMonth() - 30); return { program: "ss", ended: d.toISOString().slice(0, 7), condition: "same", earnings: "0", blind: "no" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          tabla(quitar([["Los beneficios terminaron en", r.ended_long], ["Último mes para pedirlo", r.last_long], ["Meses que quedan, contando este", String(r.months_left)],
            ["Límite de ganancias al mes este año", dinero(r.sga)], r.earnings !== null ? ["Lo que usted gana", dinero(r.earnings)] : null])),
          h("h2", { text: "Qué hacer" }), pasos(r.steps), h("p", {}, enlace("https://www.ssa.gov/redbook/eng/exr.htm", "Restablecimiento acelerado en ssa.gov (en inglés)")), cierreEn(r, volver, "work-restart"));
      }
    }),
    "ssi-ayuda": herramienta({
      api: "ssi-help", boton: "Calcular", titulo: "Mi SSI bajó por la ayuda que recibo",
      entrada: "La ayuda con el alquiler, la hipoteca o los servicios públicos puede reducir el SSI. La comida ya no cuenta. Vea cuánto puede contar la ayuda, y si pagar su parte o un cambio en el alquiler podría evitar la reducción.",
      dibujar: function (s, p) {
        return [opciones("who", "¿Quién recibe SSI?", [["single", "Una persona"], ["couple", "Una pareja casada"]], s.who || "single", p),
          opciones("home", "¿Dónde vive?", [["others", "En una casa que comparto con otras personas (no solo mi cónyuge y mis hijos)"], ["own", "En mi propia vivienda, solo o con mi cónyuge y mis hijos"]], s.home, p),
          grupo("Si comparte una casa", [
            campo("people", "Cuántas personas viven allí, contándose usted", null, "text", s.people, p),
            campo("shelter_total", "El alquiler o la hipoteca mensual del hogar, más los servicios públicos", "Luz, gas, agua, combustible para calefacción. No el teléfono ni el cable.", "dinero", s.shelter_total, p),
            campo("i_pay", "Lo que usted paga de eso cada mes", null, "dinero", s.i_pay, p),
            opciones("pa", "¿Alguien más allí recibe SNAP, TANF, SSI u otra ayuda basada en la necesidad?", SN, s.pa || "no", p)]),
          grupo("Si vive en su propia vivienda", [
            opciones("family_landlord", "¿Le alquila a su padre, su madre o su hijo?", SN, s.family_landlord || "no", p),
            campo("rent", "Alquiler que les paga cada mes", "Opcional.", "dinero", s.rent, p),
            campo("market", "Alquiler que pagaría un desconocido por el mismo lugar", "Opcional, si lo sabe.", "dinero", s.market, p)]),
          campo("outside", "Dinero que alguien de fuera de su casa paga cada mes para su alquiler o sus servicios públicos", "Opcional.", "dinero", s.outside, p),
          campo("month", "Mes", null, "month", s.month || mesActual(), p)];
      },
      leer: function () {
        return { who: elegido("who"), home: elegido("home"), people: valor("people"), shelter_total: valor("shelter_total"), i_pay: valor("i_pay"), pa: elegido("pa"),
          family_landlord: elegido("family_landlord"), rent: valor("rent"), market: valor("market"), outside: valor("outside"), month: valor("month") };
      },
      ejemplo: function () { return { who: "single", home: "others", people: "4", shelter_total: "1600", i_pay: "250", pa: "no", family_landlord: "no", month: mesActual() }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          tabla(quitar([["Cantidad federal de SSI, " + r.month_long, dinero(r.fbr)], r.share !== undefined ? ["Su parte de los costos de vivienda", dinero(r.share)] : null,
            r.share !== undefined ? ["Lo que usted paga", dinero(r.i_pay)] : null, ["Reducción de un tercio", dinero(r.vtr)], ["Lo máximo que puede contar la ayuda (valor máximo presunto)", dinero(r.pmv)],
            ["Puede reducir el SSI hasta en", dinero(r.may_lower_by)]])),
          h("h2", { text: "Qué hacer" }), pasos(r.steps), cierreEn(r, volver, "ssi-help"));
      }
    }),
    "cambio-de-pago": herramienta({
      api: "amount-changed", boton: "Explicar el cambio", titulo: "La cantidad de mi beneficio cambió",
      entrada: "Escriba las cantidades de antes y de ahora, de sus avisos o de su estado de cuenta del banco. Vea qué parte cambió: el aumento por costo de vida, la prima de Medicare o algo que le descuentan.",
      dibujar: function (s, p) {
        return [opciones("kind", "¿Qué beneficio?", SS3, s.kind, p),
          campo("month", "Mes en que comenzó la nueva cantidad", null, "month", s.month || mesActual(), p),
          grupo("Antes del cambio", h("div", { class: "money-grid" },
            campo("old_gross", "Cantidad antes de cualquier descuento", null, "dinero", s.old_gross, p),
            campo("old_medicare", "Prima de Medicare descontada", "Opcional.", "dinero", s.old_medicare, p),
            campo("old_other", "Cualquier otro descuento", "Opcional. Impuestos, devoluciones, deudas.", "dinero", s.old_other, p))),
          grupo("Después del cambio", h("div", { class: "money-grid" },
            campo("new_gross", "Cantidad antes de cualquier descuento", null, "dinero", s.new_gross, p),
            campo("new_medicare", "Prima de Medicare descontada", "Opcional.", "dinero", s.new_medicare, p),
            campo("new_other", "Cualquier otro descuento", "Opcional.", "dinero", s.new_other, p)))];
      },
      leer: function () { var o = { kind: elegido("kind"), month: valor("month") }; ["old_gross", "old_medicare", "old_other", "new_gross", "new_medicare", "new_other"].forEach(function (k) { o[k] = valor(k); }); return o; },
      ejemplo: function () { var y = new Date().getFullYear() + (new Date().getMonth() >= 10 ? 1 : 0); return { kind: "ss", month: y + "-01", old_gross: "1800", old_medicare: "202.90", old_other: "0", new_gross: "1864", new_medicare: "209.40", new_other: "60" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          h("table", { class: "plain" }, h("tr", {}, ["", "Antes", "Después", "Cambio"].map(function (x) { return h("th", { text: x }); })),
            r.parts.map(function (x) { return h("tr", {}, h("th", { scope: "row", text: x.name }), h("td", { class: "num", text: dinero(x.old) }), h("td", { class: "num", text: dinero(x["new"]) }),
              h("td", { class: "num", text: x.change ? (x.change < 0 ? "−" : "+") + dinero(Math.abs(x.change)) : dinero(0) })); })),
          h("h2", { text: "Qué cambió" }), h("ul", {}, r.why.map(function (w) { return h("li", { text: w }); })),
          h("h2", { text: "Qué hacer" }), pasos(r.steps), cierreEn(r, volver, "amount-changed"));
      }
    }),
    "limite-ssi": herramienta({
      api: "ssi-limit", boton: "Calcular", titulo: "¿Estoy por debajo del límite de $2,000 de SSI?",
      entrada: "SSI mira lo que usted tiene el día 1 de cada mes. Escriba lo que había en sus cuentas de banco y en efectivo el día 1, y el dinero que las reglas le dejan no contar. Verá, mes por mes, lo que podría contar. Nada de lo que escribe se guarda.",
      dibujar: function (s, p) {
        var meses = ultimosMeses(), q = {}, dados = s._dados || [], usados = s._usados || [];
        Object.keys(p).forEach(function (k) {
          var m = /^months\.(\d+)\.on_the_1st$/.exec(k), a = /^set_aside\.(\d+)\.(kind|amount|month)$/.exec(k);
          if (m) q["m-" + dados[+m[1]]] = p[k]; else if (a) q["sa-" + a[2] + "-" + usados[+a[1]]] = p[k];
        });
        var sm = s._meses || {}, sa = s._aparte || [{}, {}, {}];
        return [opciones("household", "¿Para quién es?", [["single", "Una persona (límite de $2,000)"], ["couple", "Una pareja casada (límite de $3,000)"]], s.household, p),
          h("fieldset", { class: "ticks", id: "months", "aria-invalid": p.months ? "true" : null }, h("legend", { text: "Dinero en todas sus cuentas de banco y en efectivo, el día 1 del mes" }),
            h("p", { class: "hint", text: "Deje un mes en blanco para saltarlo. Use su estado de cuenta o la aplicación del banco para ver el saldo al comienzo del día 1. No incluya una cuenta ABLE." }),
            p.months ? h("p", { class: "err", role: "alert", text: p.months }) : null,
            h("div", { class: "money-grid" }, meses.map(function (m) { return h("div", { class: "field" }, campo("m-" + m, "1 de " + MESES[+m.slice(5) - 1] + " de " + m.slice(0, 4), null, "dinero", sm[m], q)); }))),
          grupo("Dinero que las reglas le pueden dejar no contar (opcional)", [
            h("p", { class: "hint", text: "Solo si es parte de los saldos de arriba. Un reembolso de impuestos federales no se cuenta durante 12 meses después del mes en que lo recibió, los beneficios atrasados durante 9 meses, y un fondo de entierro hasta $1,500." }),
            sa.map(function (it, i) {
              return h("div", { class: "setaside" },
                seleccion("sa-kind-" + i, "Qué es", [["", "Nada"], ["tax_refund", "Reembolso de impuestos federales (incluye EITC o el Crédito Tributario por Hijos)"], ["retro", "Beneficios atrasados de SSI o del Seguro Social"], ["burial", "Dinero apartado para el entierro"]], it.kind || "", q),
                campo("sa-amount-" + i, "Cantidad", null, "dinero", it.amount, q), campo("sa-month-" + i, "Mes en que lo recibió o lo apartó", null, "month", it.month, q));
            })])];
      },
      leer: function () {
        var meses = ultimosMeses(), sm = {}, months = [], dados = [], usados = [], set_aside = [], aparte = [];
        meses.forEach(function (m) { sm[m] = valor("m-" + m); if (sm[m] !== "") { months.push({ month: m, on_the_1st: sm[m] }); dados.push(m); } });
        [0, 1, 2].forEach(function (i) { var it = { kind: valor("sa-kind-" + i), amount: valor("sa-amount-" + i), month: valor("sa-month-" + i) }; aparte.push(it); if (it.kind) { set_aside.push(it); usados.push(i); } });
        return { household: elegido("household"), months: months, set_aside: set_aside, _meses: sm, _aparte: aparte, _dados: dados, _usados: usados };
      },
      ejemplo: function () {
        var m = ultimosMeses(), sm = {}, months = [];
        [1650, 1820, 3150, 2310, 3600, 1700].forEach(function (v, i) { sm[m[i]] = String(v); months.push({ month: m[i], on_the_1st: String(v) }); });
        var it = { kind: "tax_refund", amount: "1400", month: m[1] };
        return { household: "single", months: months, set_aside: [it], _meses: sm, _aparte: [it, {}, {}], _dados: m, _usados: [0] };
      },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          h("table", { class: "months ssi" }, h("thead", {}, h("tr", {}, ["El día", "Tenía", "No se cuenta", "Podría contar", "Contra " + dinero(r.limit)].map(function (t) { return h("th", { scope: "col", text: t }); }))),
            h("tbody", {}, r.months.map(function (m) {
              return h("tr", { class: m.status }, h("th", { scope: "row", text: m.first_of_month }), h("td", { text: dinero(m.on_the_1st) }),
                h("td", { text: m.left_out ? dinero(m.left_out) + " (" + m.left_out_items.map(function (x) { return x.what; }).join(", ") + ")" : "—" }), h("td", { text: dinero(m.may_count) }),
                h("td", { text: m.status === "over" ? "Pasa el límite por " + dinero(m.over_by) + (m.small ? " (poco)" : "") : (m.status === "close" ? "Quedan " + dinero(m.room) + ": cerca" : "Quedan " + dinero(m.room)) }));
            }))),
          h("h2", { text: "Qué hacer" }), pasos(r.steps), cierreEn(r, volver, "ssi-limit"));
      }
    }),
    "apelar-plan": herramienta({
      api: "plan-appeal", boton: "Ver mi fecha", titulo: "Mi plan de Medicare negó atención o un medicamento",
      entrada: "Puede pedir al plan que lo revise otra vez. Pocas personas apelan, pero la mayoría de las denegaciones de Medicare Advantage que se apelan se revocan al menos en parte. Encuentre su fecha, pida una decisión rápida si la necesita, y llévese una carta y una declaración para su médico.",
      dibujar: function (s, p) {
        return [opciones("plan", "¿Qué tipo de plan envió la denegación?", [["ma", "Un plan Medicare Advantage (Parte C): cubre médicos y hospital"], ["pd", "Un plan de medicamentos de Medicare (Parte D): cubre solo recetas"]], s.plan, p),
          opciones("what", "¿Qué negó el plan?", [["care", "Plan Medicare Advantage: atención, un examen o un equipo que todavía no he recibido"], ["partb_drug", "Plan Medicare Advantage: un medicamento de la Parte B (que se da en una clínica o lo da un médico)"],
            ["drug", "Plan de medicamentos: una receta que todavía no he surtido"], ["payment", "Cualquiera de los dos: pagar algo que ya recibí o que ya pagué"]], s.what, p),
          campo("notice_date", "Fecha impresa en el aviso del plan", "Muchas veces se llama \"Notice of Denial\".", "date", s.notice_date, p),
          opciones("urgent", "¿Esperar varias semanas podría dañar gravemente su salud?", [["yes", "Sí"], ["no", "No"]], s.urgent === true ? "yes" : (s.urgent === false ? "no" : ""), p)];
      },
      leer: function () { return { plan: elegido("plan"), what: elegido("what"), notice_date: valor("notice_date"), urgent: siNo(elegido("urgent")) }; },
      ejemplo: function () { return { plan: "pd", what: "drug", notice_date: hace(12), urgent: true }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          r.days_left >= 0 ? h("p", { class: "lead", text: (r.days_left === 1 ? "Queda 1 día" : "Quedan " + r.days_left + " días") + " desde hoy. Cuente desde la fecha de su aviso, y revise la fecha límite que da el aviso mismo." }) : null,
          h("h2", { text: "Qué hacer" }), pasos(r.steps), borrador("Solicitud de apelación al plan (en inglés)", EN_INGLES, r.letter),
          borrador("Declaración para que la firme su médico (en inglés)", "Está en inglés para el plan y para su médico.", r.doctor), cierreEn(r, volver, "plan-appeal"));
      }
    }),
    "caso-lento": herramienta({
      api: "disability-wait", boton: "Ver qué puedo pedir", titulo: "Mi caso de incapacidad está tardando demasiado",
      entrada: "El Seguro Social atiende primero algunos casos: cuando alguien no tiene dinero para comida, medicinas o servicios públicos, enfrenta un desalojo, no tiene vivienda o está muy enfermo. El personal acepta lo que usted les dice. Vea cuáles podrían corresponderle, y obtenga la solicitud y una nota para su representante en el Congreso.",
      dibujar: function (s, p) {
        return [opciones("stage", "¿En qué etapa está su caso?", [["initial", "Mi primera solicitud"], ["recon", "Reconsideración (pedí que lo revisaran otra vez)"], ["hearing", "Esperando una audiencia con un juez"]], s.stage, p),
          campo("filed", "Fecha en que solicitó o apeló", "Opcional. Se pone en sus cartas.", "date", s.filed, p),
          marcas("situations", "¿Alguna de estas situaciones es la suya ahora?", [["no_food", "No tengo suficiente dinero para comida"], ["no_medicine", "No puedo pagar las medicinas o la atención médica que necesito"],
            ["no_utilities", "No tengo calefacción, agua o electricidad, o tengo un aviso de corte"], ["eviction", "Tengo un aviso de desalojo o de ejecución hipotecaria"],
            ["homeless", "No tengo un lugar fijo para dormir, o voy a perder mi vivienda dentro de 14 días"], ["terminal", "Un médico dice que mi enfermedad es terminal"],
            ["va100", "El VA me calificó con 100% permanente y total (compensación, no pensión)"], ["military", "Me lesioné o me enfermé en servicio militar activo desde el 1 de octubre de 2001"],
            ["danger", "Podría hacerme daño o hacer daño a otra persona"]], s.situations, p, "Marque todas las que correspondan, o ninguna."),
          opciones("ssi", "¿Solicitó SSI (Seguridad de Ingreso Suplementario)?", [["yes", "Sí"], ["no", "No"], ["unsure", "No estoy seguro"]], s.ssi === true ? "yes" : (s.ssi === false ? "no" : (s._ssi || "")), p)];
      },
      leer: function () { var v = elegido("ssi"); return { stage: elegido("stage"), situations: marcados("situations"), filed: valor("filed"), ssi: siNo(v), _ssi: v }; },
      ejemplo: function () { return { stage: "hearing", situations: ["no_utilities", "eviction"], filed: "2025-06-02", ssi: false }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          r.days_waiting !== null ? h("p", { class: "lead", text: "Lleva " + r.days_waiting + " días esperando." }) : null,
          r.fits.length ? h("ul", { class: "gaps" }, r.fits.map(function (f) { return h("li", {}, h("b", { text: f.name + ". " }), f.bring); })) : null,
          h("h2", { text: "Qué hacer" }), pasos(r.steps), borrador("Solicitud para marcar su caso como crítico (en inglés)", EN_INGLES, r.letter),
          borrador("Nota para la oficina de su representante o senador (en inglés)", EN_INGLES, r.congress), cierreEn(r, volver, "disability-wait"));
      }
    }),
    "corte-de-luz": herramienta({
      api: "utility", boton: "Preparar mi lista de llamadas", titulo: "Me pueden cortar la luz o el gas",
      entrada: "Solo para Florida. Convierta su aviso en una lista de llamadas para hacer hoy: su compañía de servicios, la ayuda de crisis con la factura, y a quién avisar si algo está mal.",
      dibujar: function (s, p) {
        return [opciones("kind", "¿Cuál es su compañía?", [["regulated", "Una compañía como FPL, Duke Energy, Tampa Electric o una compañía de gas"], ["city_coop", "Una empresa de una ciudad (como OUC) o una cooperativa"], ["unsure", "No estoy seguro"]], s.kind || "unsure", p),
          campo("notice_date", "Fecha del aviso de corte", "Opcional.", "date", s.notice_date, p), campo("shutoff_date", "Fecha de corte que dice el aviso", "Opcional.", "date", s.shutoff_date, p),
          grupo("Marque lo que corresponda", [casilla("off", "Ya me cortaron el servicio", s.off), casilla("medical", "Alguien aquí necesita electricidad por razones médicas", s.medical),
            casilla("older", "Alguien aquí tiene 60 años o más", s.older), casilla("dispute", "Creo que la factura está mal", s.dispute)])];
      },
      leer: function () { return { kind: elegido("kind") || "unsure", notice_date: valor("notice_date"), shutoff_date: valor("shutoff_date"), off: marcada("off"), medical: marcada("medical"), older: marcada("older"), dispute: marcada("dispute") }; },
      ejemplo: function () { return { kind: "regulated", notice_date: hace(2), shutoff_date: en(6), medical: true, off: false, older: false, dispute: false }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          r.findings.length ? h("ul", { class: "findings" }, r.findings.map(function (f) { return h("li", { text: f.text }); })) : null,
          h("h2", { text: "Llamadas para hacer hoy" }),
          h("ol", { class: "calls" }, r.steps.map(function (st) { return h("li", {}, h("h3", { text: st.who }), h("ul", {}, st.ask.map(function (q) { return h("li", { text: q }); })),
            h("p", { class: "small", text: "Anote lo que le digan, con quién habló y cualquier número de referencia." })); })),
          h("h2", { text: "Tenga esto a mano" }), h("ul", {}, r.bring.map(function (b) { return h("li", { text: b }); })), cierreEn(r, volver, "utility-shutoff"));
      }
    }),
    "aviso-completo": herramienta({
      api: "notice-check", boton: "Revisar mi aviso", titulo: "¿Está completo mi aviso de pago de más?",
      entrada: "Las propias reglas del Seguro Social dicen lo que todo aviso de pago de más le debe decir: cuánto, qué meses, por qué, y sus derechos. Revise el suyo parte por parte, mirando todas las páginas. Si falta algo, obtiene una carta para pedir una explicación por escrito.",
      dibujar: function (s, p) {
        var a = s.answers || {};
        return [opciones("program", "¿De qué tipo de beneficio trata el aviso?", [["t2", "Beneficios de jubilación, sobreviviente o incapacidad"], ["ssi", "SSI (Supplemental Security Income)"], ["unsure", "No estoy seguro"]], s.program, p),
          campo("notice_date", "Fecha impresa en el aviso", "Opcional. Se pone en su carta.", "date", s.notice_date, p),
          h("h2", { text: "¿Su aviso le dice estas cosas?" }),
          PARTES.map(function (x, i) { return opciones(x[0], (i + 1) + ". " + x[1] + (x[2] ? " (solo para avisos de SSI; déjela en blanco si su aviso no es de SSI)" : ""), [["yes", "Sí"], ["no", "No"], ["unsure", "No estoy seguro"]], a[x[0]] || "", p); })];
      },
      leer: function () { var a = {}; PARTES.forEach(function (x) { var v = elegido(x[0]); if (v) a[x[0]] = v; }); return { program: elegido("program"), notice_date: valor("notice_date"), answers: a }; },
      ejemplo: function () { var a = {}; PARTES.forEach(function (x) { a[x[0]] = "yes"; }); a.cause = "no"; a.paid_due = "no"; a.waiver = "unsure"; delete a.start; return { program: "t2", notice_date: hace(15), answers: a }; },
      resultado: function (r, volver) {
        function lista(xs) { return h("ul", { class: "gaps" }, xs.map(function (g) { return h("li", {}, g.ask, h("span", { class: "small", text: " (" + g.rule + ")" })); })); }
        var f = r.appeal_dates || [];
        mostrar(h("h1", { class: "long", text: r.headline }),
          h("p", { class: "lead", text: f.length === 2 ? "Pedir una explicación es aparte de apelar. Para pedir una reconsideración, planee actuar a más tardar el " + fechaLarga(f[0].date) + " (60 días desde la fecha impresa). Si el aviso tardó 5 días en llegar, la última fecha es el " + fechaLarga(f[1].date) + "."
            : "Pedir una explicación es aparte de apelar. Por lo general la reconsideración se debe pedir dentro de los 60 días de recibir el aviso." }),
          r.missing.length ? [h("h2", { text: "Puede que falte" }), lista(r.missing)] : null, r.unsure.length ? [h("h2", { text: "No está seguro: mire otra vez" }), lista(r.unsure)] : null,
          h("h2", { text: "Qué hacer" }), pasos(r.steps), borrador("Carta para pedir una explicación por escrito (en inglés)", EN_INGLES, r.letter), cierreEn(r, volver, "notice-check"));
      }
    }),
    "informar-cambio": herramienta({
      api: "report-change", boton: "Preparar mi informe", titulo: "Algo cambió en mi vida",
      entrada: "Si recibe beneficios del Seguro Social o SSI, tiene que informar ciertos cambios. Vea para cuándo, qué tener a mano, y un informe escrito para enviar o leer por teléfono.",
      dibujar: function (s, p) {
        function filtrar() {
          var b = { retirement: "r", disability: "d", ssi: "s" }[elegido("benefit")] || "";
          Array.prototype.forEach.call(document.querySelectorAll("#changes label.tick"), function (l) {
            var c = l.querySelector("input"), ver = !b || CAMBIOS.some(function (x) { return x[0] === c.value && x[2].indexOf(b) >= 0; });
            l.hidden = !ver; if (!ver) c.checked = false;
          });
        }
        setTimeout(function () { filtrar(); var f = document.getElementById("benefit"); if (f) f.addEventListener("change", filtrar); }, 0);
        return [opciones("benefit", "¿Qué beneficio recibe?", [["retirement", "Beneficios de jubilación o de sobrevivientes"], ["disability", "Beneficios por incapacidad del Seguro Social (SSDI)"], ["ssi", "Seguridad de Ingreso Suplementario (SSI)"]], s.benefit, p),
          marcas("changes", "¿Qué cambió?", CAMBIOS, s.changes, p, "Elija primero el beneficio. Marque todo lo que cambió."),
          campo("change_date", "Fecha en que ocurrió el cambio", "Opcional. Para SSI, sirve para calcular el último día para informar.", "date", s.change_date, p),
          texto("what_changed", "En sus propias palabras, qué cambió", "Opcional. Se pone tal como lo escriba en su informe, que va en inglés. Si puede, escríbalo en inglés.", (s.statements || {}).what_changed, p)];
      },
      leer: function () { return { benefit: elegido("benefit"), changes: marcados("changes"), change_date: valor("change_date"), statements: { what_changed: valor("what_changed") } }; },
      ejemplo: function () { return { benefit: "ssi", changes: ["living", "work"], change_date: hace(12), statements: {} }; },
      resultado: function (r, volver) {
        var d = r.deadline, k = r.kit;
        mostrar(h("h1", { class: "long", text: k.summary }),
          d && d.date ? fechas([{ etiqueta: d.label, nota: d.rule, fecha_larga: fechaLarga(d.date), dias: d.days_left, estado: d.status }]) : h("p", { class: "lead", text: r.timing.rule }),
          d ? h("p", { text: d.penalty }) : null, r.notes.map(function (n) { return h("p", { text: n }); }),
          h("h2", { text: "Qué informar y qué tener a mano" }),
          h("ul", {}, r.changes.map(function (c) { return h("li", {}, h("b", { text: c.label }), " (" + c.when + ")", h("ul", {}, c.have_ready.map(function (x) { return h("li", { text: x }); }))); })),
          h("h2", { text: "Cómo informar" }), pasos(k.how), h("p", {}, enlace(k.office_locator, "Buscar su oficina local (en inglés)")),
          borrador("Su informe (en inglés)", "Está en inglés porque así lo lee el Seguro Social. Puede enviarlo por correo o leerlo por teléfono.", k.draft.join("\n")),
          h("h2", { text: "Anote cuando informe" }), h("ul", {}, k.record.map(function (x) { return h("li", { text: x + ": ________" }); })), h("p", { class: "small", text: k.record_note }),
          h("p", {}, r.more.text + " ", enlace(r.more.url, "Leer la lista (en inglés)")),
          h("p", { class: "small", text: k.disclaimer + " Reglas revisadas el " + r.rules_as_of + "." }),
          h("p", { class: "small" }, "También puede abrir ", h("a", { href: "/#report-change", text: "esta herramienta en inglés" }), "."),
          h("div", { class: "row" }, h("button", { class: "go", type: "button", text: "Imprimir", on: { click: function () { window.print(); } } }),
            h("button", { class: "quiet", type: "button", text: "Cambiar mis respuestas", on: { click: volver } }),
            h("button", { class: "quiet", type: "button", text: "Volver al inicio", on: { click: function () { location.hash = ""; } } })));
      }
    }),
    "renovacion": herramienta({
      api: "renewal", boton: "Revisar mi renovación", titulo: "Revisar mi renovación de Medicaid o SNAP antes de enviarla",
      entrada: "La mayoría de las personas que pierden Medicaid en la renovación lo pierden por papeles, no porque dejaron de calificar. Revise las fechas, lo que todavía falta y cada página; luego envíela con una hoja de portada y guarde un comprobante.",
      dibujar: function (s, p) {
        var it = s._cosas || [{}, {}, {}, {}], q = {};
        Object.keys(p).forEach(function (k) { var m = /^i(\d+)_status$/.exec(k); if (m) q["c-status-" + ((s._usadas || [])[+m[1] - 1])] = p[k]; });
        return [marcas("programs", "¿Qué está renovando?", [["medicaid", "Medicaid"], ["snap", "SNAP (asistencia de alimentos)"]], s.programs, p),
          opciones("state", "¿En qué estado?", [["FL", "Florida"], ["other", "Otro estado"]], s.state || "FL", p),
          grupo("Fechas impresas en sus papeles", [h("p", { class: "hint", text: "Escriba por lo menos una. Deje en blanco las que no aparezcan." }),
            campo("form_due", "Fecha en que vence el formulario de renovación", null, "date", s.form_due, p), campo("proof_due", "Fecha en que vencen las pruebas que le piden", null, "date", s.proof_due, p),
            campo("coverage_ends", "Fecha en que termina la cobertura o terminan los beneficios", null, "date", s.coverage_ends, p)]),
          opciones("method", "¿Cómo lo va a enviar?", [["online", "Lo subo por internet"], ["mail", "Por correo"], ["fax", "Por fax"], ["in_person", "En persona"], ["unsure", "Todavía no sé"]], s.method || "unsure", p),
          grupo("¿Qué le pide el aviso?", [h("p", { class: "hint", text: "Escriba cada documento o dato que pide el aviso, uno por uno, con las palabras del aviso (por ejemplo \"pay stubs\" o \"proof of address\"). Deje en blanco las filas que no use." }),
            p.items ? h("p", { class: "err", role: "alert", text: p.items }) : null,
            it.map(function (x, i) {
              return h("div", { class: "setaside" }, campo("c-what-" + i, "Cosa " + (i + 1) + ": qué piden", null, "text", x.what, q), campo("c-who-" + i, "Para quién", "Opcional.", "text", x.who, q),
                campo("c-period-" + i, "De qué período", "Opcional.", "text", x.period, q),
                seleccion("c-status-" + i, "¿Lo tiene?", [["have", "Sí, lo tengo"], ["get", "Todavía lo estoy consiguiendo"], ["unsure", "No estoy seguro de qué quieren decir"]], x.status || "have", q));
            })]),
          marcas("checks", "Marque lo que ya hizo", REVISIONES, s.checks, p, "Estas son las cosas que más hacen que devuelvan una renovación.")];
      },
      leer: function () {
        var cosas = [], items = [], usadas = [];
        [0, 1, 2, 3].forEach(function (i) { var x = { what: valor("c-what-" + i), who: valor("c-who-" + i), period: valor("c-period-" + i), status: valor("c-status-" + i) }; cosas.push(x); if (x.what) { items.push(x); usadas.push(i); } });
        return { programs: marcados("programs"), state: elegido("state"), form_due: valor("form_due"), proof_due: valor("proof_due"), coverage_ends: valor("coverage_ends"), method: elegido("method"), items: items, checks: marcados("checks"),
          _cosas: cosas, _usadas: usadas };
      },
      ejemplo: function () {
        var items = [{ what: "pay stubs", who: "me", period: "last 30 days", status: "have" }, { what: "proof of address", who: "", period: "", status: "get" }];
        return { programs: ["medicaid"], state: "FL", form_due: en(9), proof_due: en(4), coverage_ends: en(20), method: "fax", items: items, checks: ["signed", "copies"], _cosas: items.concat([{}, {}]), _usadas: [0, 1] };
      },
      resultado: function (r, volver) {
        function lista(titulo, xs) { return xs.length ? [h("h2", { text: titulo }), h("ul", { class: "findings" }, xs.map(function (x) { return h("li", { text: x }); }))] : null; }
        mostrar(h("h1", { class: "long", text: r.headline }),
          fechas(r.dates.map(function (d) { return { etiqueta: d.label, nota: d.note, fecha_larga: fechaLarga(d.date), dias: d.days_left, estado: d.status }; })),
          r.two_dates ? h("p", { class: "lead", text: r.two_dates }) : null,
          lista("Todavía falta conseguir", r.missing), lista("Pregunte qué quieren decir", r.unsure), lista("Todavía falta revisar en las páginas", r.checks_left),
          h("h2", { text: "Cómo enviarlo, y guardar un comprobante" }), pasos(r.how),
          borrador("Hoja de portada (en inglés)", EN_INGLES, r.cover),
          h("h2", { text: "Preguntas para hacer" }), h("ul", {}, r.questions.map(function (x) { return h("li", { text: x }); })),
          r.hearing ? [h("h2", { text: "Si de todos modos termina su cobertura o terminan sus beneficios" }), h("p", {}, r.hearing.plain + " ", enlace(r.hearing.source, "Fuente (en inglés)"))] : null,
          cierreEn(r, volver, "renewal"));
      }
    }),
    "alquiler": herramienta({
      api: "rent-check", boton: "Revisar mi alquiler", titulo: "Revisar cómo calcularon mi alquiler de vivienda",
      entrada: "Si tiene un Vale de Elección de Vivienda (Sección 8) o vive en vivienda pública, su alquiler sale de una fórmula. Copie las cifras de su aviso de alquiler o de su hoja de cálculo, y vea si cuadran y si falta alguna deducción. Todavía no cubre: alquiler fijado por un pago de asistencia pública para vivienda, ayuda prorrateada para familias con miembros sin estatus elegible, ni alquileres fijos (flat rent) en vivienda pública.",
      dibujar: function (s, p) { return hojaAlquiler("", s, p); },
      leer: function () { return leerHoja(""); },
      ejemplo: function () { return { program: "voucher", dependents: "2", elderly_disabled: false, new_lease: false, annual_income: "24500", dependent_deduction: "", ttp: "613", utility_allowance: "90", gross_rent: "1300", payment_standard: "1400", your_rent: "523", childcare_costs: "2400" }; },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }), pasosAlquiler(r), r.rent_note ? h("p", { class: "small", text: r.rent_note }) : null,
          r.matches.length ? h("p", { text: "Sus deducciones corresponden a las " + r.matches.join(" o ") + " de HUD." }) : null,
          r.findings.length ? [h("h2", { text: "Lo que encontramos" }), h("ul", { class: "findings" }, r.findings.map(function (f) { return h("li", { text: f.text }); }))] : null,
          r.interim ? [h("h2", { text: "Su ingreso bajó" }), h("p", { text: r.interim.text })] : null,
          h("h2", { text: "Qué preguntar a su autoridad de vivienda" }), h("ul", {}, r.questions.map(function (q) { return h("li", { text: q }); })),
          borrador("Carta a su autoridad de vivienda (en inglés)", "Tiene las mismas preguntas, en inglés. Complete lo que está entre corchetes [ ] con sus datos.", r.letter), cierreEn(r, volver, "rent-check"));
      }
    }),
    "cambio-de-alquiler": herramienta({
      api: "rent-change", boton: "Comparar las dos hojas", titulo: "¿Por qué cambió mi alquiler?",
      entrada: "Copie las cifras de su hoja de alquiler de antes y de la nueva. Verá qué cambió entre las dos y cuánto del cambio viene de cada cosa: el pago total del inquilino, el estándar de pago o la asignación para servicios públicos.",
      dibujar: function (s, p) { return [h("h2", { text: "Su hoja de alquiler de antes" }), hojaAlquiler("old_", s.old, p), h("h2", { text: "Su hoja de alquiler nueva" }), hojaAlquiler("new_", s["new"], p)]; },
      leer: function () { return { old: leerHoja("old_"), "new": leerHoja("new_") }; },
      ejemplo: function () {
        return { old: { program: "voucher", dependents: "2", annual_income: "24500", dependent_deduction: "960", ttp: "589", utility_allowance: "90", gross_rent: "1300", payment_standard: "1400", your_rent: "499" },
          "new": { program: "voucher", dependents: "2", annual_income: "26000", dependent_deduction: "960", ttp: "626", utility_allowance: "60", gross_rent: "1500", payment_standard: "1400", your_rent: "666" } };
      },
      resultado: function (r, volver) {
        mostrar(h("h1", { class: "long", text: r.headline }),
          r.parts.length ? tabla(r.parts.map(function (x) { return [x.what, (x.amount < 0 ? "−" : "+") + dinero(Math.abs(x.amount))]; })) : null,
          h("ul", {}, r.why.map(function (w) { return h("li", { text: w }); })),
          r.moved.length ? [h("h2", { text: "Qué cambió en las hojas" }), h("ul", {}, r.moved.map(function (m) { return h("li", { text: m.text }); }))] : null,
          r["new"].findings.length ? [h("h2", { text: "En la hoja nueva" }), h("ul", { class: "findings" }, r["new"].findings.map(function (f) { return h("li", { text: f.text }); }))] : null,
          h("h2", { text: "Qué preguntar a su autoridad de vivienda" }), h("ul", {}, r.questions.map(function (q) { return h("li", { text: q }); })),
          borrador("Carta sobre la hoja nueva (en inglés)", "Tiene las preguntas sobre la hoja nueva, en inglés. Añada las demás preguntas si las necesita.", r["new"].letter), cierreEn(r, volver, "rent-check"));
      }
    })
  };

  function ruta() {
    var donde = (location.hash || "").replace("#", "");
    if (HERRAMIENTAS[donde]) HERRAMIENTAS[donde]();
    else { caja.hidden = true; caja.replaceChildren(); resumen.hidden = false; }
  }
  window.addEventListener("hashchange", ruta);
  ruta();
})();
