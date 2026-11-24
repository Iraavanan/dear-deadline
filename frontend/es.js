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
      fetch("/api/es/" + cfg.api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) })
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
