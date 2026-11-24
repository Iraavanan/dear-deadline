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
