/* The small deadline calculator other sites may place on their pages. It sends the letter type and date, nothing else. */
(function () {
  "use strict";
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var HELPER = { "overpayment": "#overpayment", "disability-ended": "#disability-ended", "decision-appeal": "#decision-appeal" };
  function el(tag, text, cls) { var e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
  function nice(iso) { var p = iso.split("-"); return MONTHS[Number(p[1]) - 1] + " " + Number(p[2]) + ", " + p[0]; }
  function left(i) { return i.status === "today" ? "Today" : i.status === "passed" ? "Passed " + Math.abs(i.days_left) + (i.days_left === -1 ? " day ago" : " days ago") : i.days_left + (i.days_left === 1 ? " day left" : " days left"); }
  var form = document.getElementById("calc"), out = document.getElementById("out"), problem = document.getElementById("problem"), date = document.getElementById("notice_date");
  var now = new Date(); date.max = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  var counted = false;

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var letter = document.getElementById("letter").value;
    problem.hidden = true; date.removeAttribute("aria-invalid");
    fetch("/api/deadlines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ letter: letter, notice_date: date.value }) })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (res) {
        if (!res.ok) {
          problem.textContent = (res.data.problems && (res.data.problems.notice_date || res.data.problems.letter)) || "The dates could not be worked out.";
          problem.hidden = false; date.setAttribute("aria-invalid", "true"); out.replaceChildren(); return;
        }
        var list = el("ul", undefined, "dates");
        res.data.items.forEach(function (i, n) {
          var li = el("li", undefined, n === 0 ? null : "aside"), a = el("div"), b = el("div"), when = el("p", undefined, "when"), mark = el("span", nice(i.date), i.status !== "passed" && n < 2 ? "hl" : null);
          when.appendChild(mark); a.appendChild(when); a.appendChild(el("p", left(i), "left " + i.status));
          b.appendChild(el("h3", i.label)); b.appendChild(el("p", i.rule, "small"));
          li.appendChild(a); li.appendChild(b); list.appendChild(li);
        });
        var more = el("p"), link = el("a", "See what you can ask for, and get a page to file yourself");
        link.href = "/" + HELPER[letter]; link.target = "_blank"; link.rel = "noopener";
        more.appendChild(link);
        out.replaceChildren(list, more, el("p", "Counted from the date on the letter. Rules checked as of " + res.data.rules_as_of + ".", "small"));
        if (!counted) {
          counted = true;
          var late = res.data.items.some(function (i) { return i.id === "appeal" && i.status === "passed"; });
          fetch("/api/count", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: "embed", event: "dates", late: late }) }).catch(function () {});
        }
      })
      .catch(function () { problem.textContent = "The calculator could not reach the helper. Try again."; problem.hidden = false; });
  });
})();
