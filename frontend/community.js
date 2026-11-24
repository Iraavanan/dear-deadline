/* Community boards: short anonymous posts, one board per topic the site covers. Posts are shown
   as plain text. The server screens out personal details, links and contact requests, hides a
   post after three reports, and deletes posts after a year. */
(function () {
  "use strict";
  if (typeof window === "undefined" || !window.UI) return;
  var U = window.UI, h = U.h;
  var topics = null, limits = { min: 20, max: 1500, keep_days: 365 };

  var RULES = [
    "Do not share your name, Social Security number, claim or case number, address, phone number, email or photos.",
    "Never pay or give details to anyone who contacts you about a post. This site will never ask you for money or personal details.",
    "Posts are from other visitors. They are not checked by Dear Deadline and are not legal advice. Confirm anything important with the agency on your letter.",
    "Posts are anonymous and are deleted after a year. Three reports hide a post."
  ];

  function loadTopics() {
    if (topics) return Promise.resolve(topics);
    return fetch("/api/board").then(function (r) {
      if (!r.ok) throw new Error("off");
      return r.json();
    }).then(function (d) { topics = d.topics; limits = d; return topics; });
  }

  function off() {
    U.show(h("h1", { text: "Community" }), h("p", { text: "The community boards are not available right now." }),
      h("p", {}, h("a", { href: "#", text: "Go to the helpers" })));
  }

  function warning() {
    return h("div", { class: "board-warning", role: "note" },
      h("p", {}, h("b", { text: "Community posts are not checked by Dear Deadline." }), " They come from other visitors and may be wrong. Always confirm with Social Security or the agency on your letter."));
  }

  function rules() { return h("ul", { class: "board-rules" }, RULES.map(function (r) { return h("li", { text: r }); })); }

  function index() {
    loadTopics().then(function (list) {
      U.count("community", "kit");
      U.show(h("h1", { class: "long", text: "Talk with others in the same situation" }),
        h("p", { class: "lead", text: "Read what others went through, ask a question or share what helped. Posts are anonymous." }),
        warning(), rules(),
        h("h2", { text: "Choose a topic" }),
        h("ul", { class: "ways" }, list.map(function (t) {
          return h("li", {}, h("a", { class: "way", href: "#community/" + t.id }, h("b", { text: t.name }), h("span", { text: t.about }), h("i", { "aria-hidden": "true" })));
        })));
    }).catch(off);
  }

  function paragraphs(text) {
    return text.split(/\n+/).map(function (p) { return h("p", { text: p }); });
  }

  function reportButton(id) {
    var box = h("span", { class: "board-report" });
    var btn = h("button", { type: "button", class: "linkish", text: "Report", on: { click: function () {
      box.replaceChildren(h("span", { text: "Report this post? " }),
        h("button", { type: "button", class: "linkish", text: "Yes, report it", on: { click: function () {
          U.api("/api/board/report/" + id, {}).then(function () { box.replaceChildren(h("span", { text: "Reported. Thank you." })); });
        } } }),
        h("button", { type: "button", class: "linkish", text: "Cancel", on: { click: function () { box.replaceChildren(btn); } } }));
    } } });
    box.appendChild(btn);
    return box;
  }

  function form(topic, replyTo, done) {
    var n = replyTo ? "r" + replyTo : "new";
    var msg = h("p", { class: "board-msg", role: "alert" });
    var text = h("textarea", { id: "post-" + n, rows: replyTo ? "3" : "5", maxlength: String(limits.max), "aria-describedby": "post-" + n + "-hint" });
    var tick = h("input", { type: "checkbox", id: "nodetails-" + n });
    var trap = h("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off", "aria-hidden": "true", class: "board-trap" });
    var send = h("button", { class: "go", type: "submit", text: replyTo ? "Post reply" : "Post" });
    return h("form", { class: "board-form", on: { submit: function (ev) {
      ev.preventDefault();
      msg.textContent = "";
      send.disabled = true;
      U.api("/api/board/" + topic, { body: text.value, no_details: tick.checked, reply_to: replyTo || null, website: trap.value }).then(function (res) {
        send.disabled = false;
        if (!res.ok) {
          var p = (res.data && res.data.problems) || {};
          msg.textContent = p.body || p.no_details || p.topic || "The post could not be saved. Try again.";
          (p.no_details && !p.body ? tick : text).focus();
          return;
        }
        done();
      }).catch(function () { send.disabled = false; msg.textContent = "The post could not be sent. Check your connection and try again."; });
    } } },
      h("label", { for: "post-" + n }, replyTo ? "Your reply" : "Your post",
        h("span", { class: "hint", id: "post-" + n + "-hint", text: "Between " + limits.min + " and " + limits.max.toLocaleString("en-US") + " characters. No names, numbers, addresses, links or contact details." })),
      text,
      h("label", { class: "tick", for: "nodetails-" + n }, tick, " My post has no personal details: no names, ID or case numbers, addresses, phone numbers, emails or photos."),
      trap, msg, send);
  }

  function post(p, topic, isReply, reload) {
    var replyBox = h("div", { class: "board-replyform" });
    var bits = [h("p", { class: "board-meta" }, h("span", { text: "Posted " + U.niceDate(p.day) }), " · ", reportButton(p.id))].concat(paragraphs(p.body));
    if (!isReply) {
      bits.push(h("ul", { class: "board-replies" }, p.replies.map(function (r) { return h("li", {}, post(r, topic, true, reload)); })));
      bits.push(h("button", { type: "button", class: "linkish", text: "Reply", on: { click: function () {
        if (!replyBox.firstChild) { replyBox.appendChild(form(topic, p.id, reload)); replyBox.querySelector("textarea").focus(); }
      } } }), replyBox);
    }
    return h(isReply ? "div" : "article", { class: isReply ? "board-reply" : "board-post", id: "post-" + p.id }, bits);
  }

  function board(topic) {
    loadTopics().then(function (list) {
      var t = list.filter(function (x) { return x.id === topic; })[0];
      if (!t) { index(); return; }
      return fetch("/api/board/" + topic).then(function (r) { return r.json(); }).then(function (d) {
        U.count("community", "kit");
        var reload = function () { board(topic); };
        U.show(h("p", { class: "crumbs" }, h("a", { href: "#community", text: "Community" }), " › " + t.name),
          h("h1", { class: "long", text: t.name + ": talk with others" }),
          h("p", { text: t.about + "." }),
          warning(),
          h("details", { class: "board-rules-box" }, h("summary", { text: "Rules for posting" }), rules()),
          h("h2", { text: "Start a conversation" }),
          form(topic, null, reload),
          h("h2", { text: d.threads.length ? "Conversations" : "No conversations yet" }),
          d.threads.length ? d.threads.map(function (p) { return post(p, topic, false, reload); }) : h("p", { text: "Be the first to share what happened or ask a question." }));
      });
    }).catch(off);
  }

  // When the board is switched off, hide every link to it.
  fetch("/api/board").then(function (r) { if (!r.ok) document.documentElement.classList.add("no-community"); })
    .catch(function () {});

  window.Modules = window.Modules || {};
  window.Modules.community = { start: function (topic) { if (topic) board(topic); else index(); } };
})();
