/* Reading a photo of a letter on this device.

   turn(img)      returns a canvas with the picture turned a quarter turn clockwise.
   load()         makes the text reader ready. It uses Tesseract, a free text-recognition
                  program, from this site's own vendor/tesseract folder. If that folder has
                  not been set up on this copy of the tool, it says so and nothing else happens.
   read(source)   returns the words found in the picture, with each line.
   lineFor(lines, value)  the line a date or amount was read from, so the person can check it.

   The picture never leaves the device: the reader runs in the browser, from local files. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PhotoRead = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var BASE = "/vendor/tesseract/";
  var ready = null;

  function turn(img) {
    var w = img.naturalWidth || img.width, hgt = img.naturalHeight || img.height;
    var c = document.createElement("canvas");
    c.width = hgt; c.height = w;
    var ctx = c.getContext("2d");
    ctx.translate(hgt, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(img, 0, 0);
    c.setAttribute("role", "img"); c.setAttribute("aria-label", "Your notice, turned");
    return c;
  }

  function load() {
    if (typeof window !== "undefined" && window.Tesseract) return Promise.resolve(window.Tesseract);
    if (ready) return ready;
    ready = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = BASE + "tesseract.min.js";
      s.onload = function () { if (window.Tesseract) resolve(window.Tesseract); else reject(new Error("missing")); };
      s.onerror = function () { ready = null; reject(new Error("missing")); };
      document.head.appendChild(s);
    });
    return ready;
  }

  function read(source) {
    return load().then(function (T) {
      return T.recognize(source, "eng", { workerPath: BASE + "worker.min.js", corePath: BASE, langPath: BASE + "lang", workerBlobURL: false, gzip: true });
    }).then(function (res) {
      var text = (res && res.data && res.data.text) || "";
      return { text: text, lines: text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean) };
    });
  }

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  /* Ways a value may be printed: 2026-11-02 as "November 2, 2026", "Nov 2, 2026" or "11/02/2026"; 4212.5 as "4,212.50". */
  function forms(value) {
    var v = String(value);
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) {
      var y = m[1], mo = Number(m[2]), d = Number(m[3]), name = MONTHS[mo - 1];
      return [name + " " + d + ", " + y, name.slice(0, 3) + " " + d + ", " + y, name.slice(0, 3) + ". " + d + ", " + y, m[2] + "/" + m[3] + "/" + y, mo + "/" + d + "/" + y, d + " " + name + " " + y];
    }
    var n = Number(v);
    if (!isNaN(n) && v !== "") return [n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), n.toFixed(2), String(n)];
    return [v];
  }

  function lineFor(lines, value) {
    var want = forms(value).map(function (f) { return f.toLowerCase(); });
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].toLowerCase();
      for (var j = 0; j < want.length; j++) if (l.indexOf(want[j]) >= 0) return { line: lines[i], match: forms(value)[j] };
    }
    return null;
  }

  return { turn: turn, load: load, read: read, lineFor: lineFor, forms: forms };
});
