/* PDF reading, entirely on the person's device.

   PdfText.open(file) reads a PDF chosen by the person. If the PDF contains
   words, it returns them as text. If it is only a picture of a page (a scan),
   it returns the pages drawn as pictures so the person can read them on
   screen. The file is never sent anywhere.

   The PDF library (pdf.js, bundled in /vendor/pdfjs) is loaded only when a
   PDF is actually opened. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PdfText = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAX_BYTES = 20 * 1024 * 1024;
  var MAX_PAGES = 30;
  var MAX_PICTURES = 6;
  var BASE = "/vendor/pdfjs/";

  /* Turns one page's text pieces into lines. A piece on a new baseline starts
     a new line; a gap on the same line becomes a space. */
  function assemble(items) {
    var out = "", last = null;
    (items || []).forEach(function (it) {
      if (!it || typeof it.str !== "string" || !it.transform) return;
      var x = it.transform[4], y = it.transform[5];
      var size = it.height || Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10;
      if (last && it.str.length) {
        if (Math.abs(y - last.y) > size * 0.5) { if (out && !/\n$/.test(out)) out += "\n"; }
        else if (x - last.end > size * 0.2 && !/\s$/.test(out) && !/^\s/.test(it.str)) out += " ";
      }
      out += it.str;
      if (it.hasEOL && out && !/\n$/.test(out)) out += "\n";
      if (it.str.length) last = { y: y, end: x + (it.width || 0) };
    });
    return out;
  }

  function fail(code) { var e = new Error(code); e.code = code; return e; }

  var library = null;
  function load() {
    if (!library) {
      library = import(BASE + "pdf.min.mjs").then(function (m) {
        m.GlobalWorkerOptions.workerSrc = BASE + "pdf.worker.min.mjs";
        return m;
      });
      library.catch(function () { library = null; });
    }
    return library;
  }

  async function open(file) {
    if (file.size > MAX_BYTES) throw fail("too_big");
    var pdfjs;
    try { pdfjs = await load(); } catch (e) { throw fail("no_reader"); }

    var doc;
    try {
      doc = await pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        isEvalSupported: false,
        wasmUrl: BASE + "wasm/",
        standardFontDataUrl: BASE + "standard_fonts/"
      }).promise;
    } catch (e) {
      throw fail(e && e.name === "PasswordException" ? "locked" : "not_pdf");
    }

    try {
      if (doc.numPages > MAX_PAGES) throw fail("too_long");
      var text = "", pageTexts = [], p, page;
      for (p = 1; p <= doc.numPages; p++) {
        page = await doc.getPage(p);
        var pageText = assemble((await page.getTextContent()).items);
        pageTexts.push(pageText);
        text += pageText + "\n\n";
      }
      // Fewer than 40 letters across the file means there are no real words in it: a scan.
      if (text.replace(/\s/g, "").length >= 40) return { kind: "text", text: text.trim(), pages: doc.numPages, pageTexts: pageTexts };

      var pictures = [];
      for (p = 1; p <= Math.min(doc.numPages, MAX_PICTURES); p++) {
        page = await doc.getPage(p);
        var plain = page.getViewport({ scale: 1 });
        var view = page.getViewport({ scale: Math.min(2.5, 1400 / plain.width) });
        var canvas = document.createElement("canvas");
        canvas.width = Math.ceil(view.width); canvas.height = Math.ceil(view.height);
        await page.render({ canvas: canvas, canvasContext: canvas.getContext("2d"), viewport: view }).promise;
        pictures.push(canvas);
      }
      return { kind: "scan", pictures: pictures, pages: doc.numPages };
    } finally {
      try { doc.destroy(); } catch (e) { /* nothing to clean up */ }
    }
  }

  return { open: open, assemble: assemble, MAX_BYTES: MAX_BYTES, MAX_PAGES: MAX_PAGES };
});
