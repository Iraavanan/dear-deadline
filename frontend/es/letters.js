/* Built by tools/make_es_js.py from frontend/letters.js. Do not edit: change the English file or tools/es_js_text.py. */
/* Letter finder: other Social Security letters, and letters about Medicare.

   Shows what a letter is, whether a deadline applies and the first thing to do.
   Three letters hand over to their own full helper. A pasted letter is matched
   on the device and never sent; only the letter chosen and one date are. */
(function () {
  "use strict";

  var U = window.UI, h = U.h;
  var s;
  function meta() { return U.meta().letters; }
  function byId(id) { return meta().list.filter(function (l) { return l.id === id; })[0]; }
  function label(group) { return meta().groups.filter(function (g) { return g.id === group; })[0].label; }

  function start(group) {
    s = { group: group === "medicare" ? "medicare" : "ssa", letter: null, date: "", result: null, said: {} };
    U.count("find-letter", "start"); U.setDatebar(null);
    finder();
  }

  function row(l) {
    return U.way(l.title, l.cue, function () { open(l.id); }, l.chip, !l.has_dates && !l.helper);
  }

  function finder() {
    var other = s.group === "ssa" ? "medicare" : "ssa";
    var list = h("ul", { class: "ways", id: "letter-list" }), none = h("p", { class: "small", role: "status" });
    var mine = meta().list.filter(function (l) { return l.group === s.group; });
    function draw(words) {
      var q = words.trim().toLowerCase();
      var shown = mine.filter(function (l) { return !q || (l.title + " " + l.cue).toLowerCase().indexOf(q) >= 0; });
      U.fill(list, shown.map(row));
      none.textContent = shown.length ? "" : "Nada en la lista tiene esas palabras. Borre la casilla para ver todas las cartas, o pegue su carta abajo.";
    }
    var box = h("input", { id: "letter-words", type: "search", autocomplete: "off", on: { input: function () { draw(box.value); } } });
    U.show(
      h("h1", { text: s.group === "medicare" ? "¿Qué carta de Medicare tiene?" : "¿Qué carta del Seguro Social tiene?" }),
      h("p", { class: "lead", text: "Elija la que corresponda. Cada página dice qué es la carta, si hay un plazo y lo primero que debe hacer." }),
      h("label", { for: "letter-words" }, "Escriba una palabra de su carta para acortar la lista", h("span", { class: "hint", text: "Por ejemplo: revisión, prima, negación. La lista está en español; su carta puede usar la palabra en inglés." })),
      box, none, list,
      U.row(U.quiet("Pegar o abrir mi carta para que la busquen por mí", pasteScreen),
        U.quiet(other === "medicare" ? "Mostrar las cartas de Medicare" : "Mostrar las cartas del Seguro Social", function () { s.group = other; finder(); }),
        U.quiet("Mi carta no está en esta lista", U.otherLetter),
        U.quiet("Atrás", U.home)));
    draw("");
  }

  function pasteScreen() {
    var box = h("textarea", { id: "pasted", class: "paste", spellcheck: "false" });
    var status = h("p", { class: "status", role: "status" }), out = h("div", {});
    function say(text) { status.textContent = ""; U.fill(out, [h("p", { class: "err", role: "alert", text: text })]); }
    function findIt(pages) {
      if (!box.value.trim()) { say("Primero elija un archivo, o pegue o escriba las palabras de su carta."); box.focus(); return; }
      var red = window.NoticeReader.redact(box.value), found = window.NoticeReader.extract(box.value);
      box.value = red.text;
      var matches = window.LetterFind.rank(red.text).slice(0, 3).map(function (m) { return byId(m.id); }).filter(Boolean);
      s.date = found.notice_date || "";
      status.textContent = pages ? "Lectura de " + pages + (pages === 1 ? " página" : " páginas") + " en este dispositivo. No se subió nada." : "";
      U.fill(out, [
        h("h2", { text: matches.length ? "A lo que más se parece" : "No se pudo reconocer esta carta" }),
        matches.length ? h("ul", { class: "ways" }, matches.map(row))
          : h("p", { text: "Nada en el texto coincidió con una carta de la lista. Elija de la lista, o vea lo que se aplica a la mayoría de las cartas." }),
        h("p", { class: "small", text: (red.count ? red.count + (red.count === 1 ? " número de identidad se tachó" : " números de identidad se tacharon") + ". " : "") + "La coincidencia es una sugerencia hecha en este dispositivo. Compárela con su carta. Su carta no se envía a ningún lugar." }),
        U.row(U.quiet("Elegir de la lista", finder), U.quiet("Mi carta no está en esta lista", U.otherLetter))]);
      out.querySelector("h2").scrollIntoView({ block: "start" });
    }
    function openFile(file) {
      if (!file) return;
      var name = (file.name || "").toLowerCase(), type = file.type || "";
      U.fill(out, []);
      if (type === "text/plain" || /\.txt$/.test(name)) {
        var fr = new FileReader();
        fr.onload = function () { box.value = String(fr.result); findIt(); };
        fr.onerror = function () { say("No se pudo leer ese archivo. Pegue el texto."); };
        fr.readAsText(file);
      } else if (type === "application/pdf" || /\.pdf$/.test(name)) {
        status.textContent = "Leyendo su PDF en este dispositivo…";
        window.PdfText.open(file).then(function (res) {
          if (res.kind === "text") { box.value = res.text; findIt(res.pages); }
          else say("Ese PDF es una imagen de la carta, así que sus palabras todavía no se pueden leer automáticamente. Elija su carta de la lista.");
        }).catch(function () { say("Ese PDF no se pudo abrir aquí. Elija su carta de la lista."); });
      } else say("Las fotos y otros archivos todavía no se pueden leer aquí. Elija su carta de la lista.");
    }
    U.show(
      h("h1", { text: "Pegue o abra su carta" }),
      h("p", { class: "lead", text: "Se abre en este dispositivo y no se sube. Se lee solo para saber qué carta es y encontrar la fecha que tiene. Pegue la carta en inglés, tal como le llegó." }),
      h("label", { for: "letterfile" }, "Elija un archivo PDF o de texto"),
      h("input", { id: "letterfile", type: "file", accept: ".pdf,.txt,application/pdf,text/plain", on: { change: function (ev) { openFile(ev.target.files && ev.target.files[0]); } } }),
      status,
      h("label", { for: "pasted" }, "O pegue las palabras aquí"), box,
      U.row(U.go("Buscar mi carta", function () { findIt(); }), U.quiet("Atrás", finder)),
      out);
  }

  function open(id) {
    U.api("/api/letter", { letter: id }).then(function (res) {
      if (!res.ok) { U.failed(); return; }
      s.letter = id; s.result = res.data; s.said = {}; U.count("find-letter", "kit");
      page();
    }).catch(U.failed);
  }

  function dateList(items) {
    return h("ul", { class: "dates" }, items.map(function (i, n) {
      return h("li", { class: n === 0 ? null : "aside" },
        h("div", {}, h("p", { class: "when" }, h("span", { class: n === 0 && i.status !== "passed" ? "hl" : null, text: U.niceDate(i.date) })), h("p", { class: "left " + i.status, text: U.daysText(i) })),
        h("div", {}, h("h3", { text: i.label }), h("p", { class: "small" }, i.rule + " " + i.note + " ", U.link(i.source, "Fuente"))));
    }));
  }

  function pageText(r) {
    var l = r.letter, out = [l.title.toUpperCase(), "", l.plain];
    if (r.dates) { out.push("", "SUS FECHAS"); r.dates.items.forEach(function (d) { out.push("- " + d.label + ": " + U.niceDate(d.date) + " (" + U.daysText(d) + ")"); }); out.push(r.dates.advice); }
    out.push("", "QUÉ HACER"); l.do.forEach(function (x, i) { out.push((i + 1) + ". " + x); });
    (l.forms || []).forEach(function (f) { out.push(f.name + ": " + f.url); });
    if (r.kit) {
      out.push("", r.kit.title.toUpperCase()); r.kit.draft.forEach(function (x) { out.push(x); });
      out.push("", r.kit.kind === "call" ? "TENGA A MANO" : "ENVÍE CON ELLA"); r.kit.include.forEach(function (x) { out.push("- " + x); });
      out.push("", "CÓMO"); r.kit.how.forEach(function (x, i) { out.push((i + 1) + ". " + x); });
      out.push("", "MI REGISTRO"); r.kit.record.forEach(function (x) { out.push(x + ": ______________________________"); });
    }
    out.push("", l.contact, "Fuente: " + l.source, "", "Hecho por una herramienta independiente. No viene de la Administración del Seguro Social ni de Medicare, y no es un consejo legal.");
    return out.join("\r\n");
  }

  function page(problems) {
    var r = s.result, l = r.letter, d = r.dates;
    if (d) U.setDatebar([[d.items[0].label + ":", d.items[0]]]); else U.setDatebar(null);
    var form = null;
    if (l.has_dates && !l.helper) {
      form = h("form", { novalidate: "novalidate", on: { submit: function (ev) {
        ev.preventDefault();
        s.date = document.getElementById("letter_date").value;
        U.api("/api/letter", { letter: s.letter, date: s.date }).then(function (res) {
          if (!res.ok) { s.result.dates = null; page(res.data.problems || {}); return; }
          if (!res.data.dates) { s.result.dates = null; page({ date: "Primero escriba la fecha." }); return; }
          s.result = res.data; U.count("find-letter", "dates", res.data.dates.items[res.data.dates.items.length - 1].status === "passed");
          page();
        }).catch(U.failed);
      } } },
        U.field("letter_date", l.date.label, l.date.hint || null, h("input", { type: "date", value: s.date, required: "required" }), problems ? { letter_date: problems.date } : null),
        U.row(U.go(d ? "Calcular las fechas otra vez" : "Mostrar mis fechas", null, "submit")));
    }
    var kf = l.kit_form, kit = r.kit, kitForm = null, kitOut = null;
    if (kf) {
      var late = d && d.items[d.items.length - 1].status === "passed";
      var asks = [["kit_about", kf.about_label, "about"], ["kit_why", kf.kind === "call" ? "Por qué cree que es demasiado pronto, con sus propias palabras" : kf.why_label, "why"]];
      if (late && kf.kind !== "call") asks.push(["kit_late", "Por qué llega tarde", "late"]);
      kitForm = h("form", { on: { submit: function (ev) {
        ev.preventDefault();
        asks.forEach(function (a) { s.said[a[2]] = document.getElementById(a[0]).value; });
        var body = { letter: s.letter, kit: true, statements: s.said };
        if (d) body.date = s.date;
        U.api("/api/letter", body).then(function (res) {
          if (!res.ok) { U.failed(); return; }
          s.result = res.data; page();
          var top = document.getElementById("kit-top"); if (top) top.scrollIntoView({ block: "start" });
        }).catch(U.failed);
      } } },
        asks.map(function (a) { return U.field(a[0], a[1], "Opcional. Se usa exactamente como usted lo escriba. No ponga ningún número de Medicare, de Seguro Social ni de miembro.", h("textarea", { maxlength: "2000" }, s.said[a[2]] || "")); }),
        U.row(U.go(kit ? "Prepararlo otra vez" : (kf.kind === "call" ? "Preparar qué decir en la llamada" : "Preparar mi solicitud"), null, "submit")));
      if (kit) {
        var copy = h("button", { class: "copy", type: "button", text: "Copiar esto", on: { click: function () {
          var done = function () { copy.textContent = "Copiado"; setTimeout(function () { copy.textContent = "Copiar esto"; }, 2500); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(kit.draft.join("\n")).then(done, function () { copy.textContent = "Seleccione el texto y cópielo a mano"; });
          else copy.textContent = "Seleccione el texto y cópielo a mano";
        } } });
        kitOut = [h("h2", { id: "kit-top", text: kit.title }),
          kit.draft_lang === "en" ? h("p", { class: "small", text: "La solicitud está en inglés porque va dirigida a la agencia. Lo que usted escribió se copia tal como lo escribió: si puede, escríbalo en inglés o pida a alguien que le ayude a traducirlo." }) : null,
          h("div", { class: "draft" }, kit.draft.map(function (x) { return h("p", { text: x }); })), copy,
          h("h3", { text: kit.kind === "call" ? "Tenga a mano" : "Envíe con ella" }), h("ul", {}, kit.include.map(function (x) { return h("li", { text: x }); })),
          h("h3", { text: kit.kind === "call" ? "Cómo llamar" : "Cómo enviarla" }), h("ol", {}, kit.how.map(function (x) { return h("li", { text: x }); })),
          h("h3", { text: "Mi registro" }), h("dl", { class: "record" }, kit.record.map(function (x) { return h("div", {}, h("dt", { text: x }), h("dd", {})); })),
          h("p", { class: "small", text: kit.record_note + " " + kit.disclaimer })];
      }
    }
    var urgent = l.urgent ? h("section", { class: "urgent", "aria-labelledby": "urgent-title" },
      h("h2", { id: "urgent-title", text: "Haga esto ahora" }),
      h("p", { class: "urgent-by", text: l.urgent.by + "." }),
      h("p", {}, "Llame a ", h("b", { text: l.urgent.call }), "."),
      h("h3", { text: "Qué decir" }),
      h("ol", { class: "urgent-script" }, l.urgent.script.map(function (x) { return h("li", { text: x }); })),
      h("p", { class: "small", text: "Si no encuentra el número, llame al 1-800-MEDICARE (1-800-633-4227) y pregunte por la organización de revisión de su área." })) : null;
    U.show(
      h("p", { class: "small", text: "Carta: " + label(l.group) }),
      h("h1", { text: l.title }),
      urgent,
      h("p", { class: "lead", text: l.plain }),
      l.helper ? U.row(U.go("Abrir la herramienta para esta carta", function () { location.hash = l.helper; })) : null,
      l.id === "msn" ? h("p", {}, h("a", { href: "#medicare-bill", text: "¿También recibió una factura del médico? Compárela con este aviso" })) : null,
      form ? [h("h2", { text: d ? "Sus fechas" : "Vea sus fechas" }), d ? [dateList(d.items), h("p", { text: d.advice }), U.row(U.timelineButton(l.title, s.date, d.items))] : null, form] : null,
      !l.has_dates && !l.helper ? [h("h2", { text: "¿Hay un plazo?" }), h("p", { text: "La página oficial no da un número fijo de días para esta carta, así que aquí no se calcula ninguno. Siga la fecha impresa en su carta, y actúe bastante antes." })] : null,
      h("h2", { text: "Qué hacer" }),
      h("ol", {}, l.do.map(function (x) { return h("li", { text: x }); })),
      l.see ? h("p", {}, h("a", { href: "#" + l.see, text: l.see_label || "Abrir la herramienta de apelación" })) : null,
      l.forms ? h("ul", {}, l.forms.map(function (f) { return h("li", {}, U.link(f.url, f.name)); })) : null,
      h("h2", { text: "A quién llamar" }),
      h("p", { text: l.contact }),
      kitOut,
      kitForm ? [h("h2", { text: kit ? "Cambiar sus palabras" : (kf.kind === "call" ? "Prepárese para la llamada" : "Escriba su solicitud") }),
        kit ? null : h("p", { text: kf.kind === "call" ? "Agregue unas palabras y reciba una página para leer cuando llame, con un lugar para anotar lo que le dijeron." : "Agregue unas palabras y reciba una solicitud que puede firmar y enviar, con una lista de lo que debe enviar con ella y un registro para guardar. La solicitud sale en inglés, porque va dirigida a la agencia." }),
        kitForm] : null,
      h("p", { class: "small" }, "Esta página sigue la fuente oficial para esta carta. ", U.link(l.source, "Leer la fuente (en inglés)"), ". Es información, no un consejo legal, y no viene de la Administración del Seguro Social ni de Medicare. La traducción al español todavía no ha sido revisada por un traductor profesional. Reglas revisadas al " + r.rules_as_of + "."),
      U.row(U.quiet("Imprimir esta página", function () { window.print(); }), U.quiet("Descargar como texto", function () { U.download("letter-" + l.id + ".txt", "text/plain", pageText(r)); }),
        kit ? U.sentButton(l.group === "medicare" ? "medicare" : "form", l.title + (s.date ? " (carta con fecha del " + U.niceDate(s.date) + ")" : ""), kit.kind === "call" ? "phone" : "mail") : null,
        U.quiet("Atrás", finder)));
    if (problems) { var bad = document.querySelector("[aria-invalid=true]"); if (bad) bad.focus(); }
  }

  window.Modules = window.Modules || {};
  /* Straight to one letter, from a quick link on the home page. Its Back goes to that group's list. */
  function startAt(id) {
    var l = byId(id);
    if (!l) { start("ssa"); return; }
    start(l.group); open(id);
  }

  window.Modules.letters = { start: start, startAt: startAt };
})();
