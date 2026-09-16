/* ============================================================
   St. Paul's English High School — Ask St. Paul's chat widget
   Talks to /api/chat.js (Vercel serverless function). Self-
   contained: injects its own markup, no HTML changes needed
   beyond loading this script.
   ============================================================ */
(function () {
  "use strict";

  var MODE_LABELS = {
    knowledge: "From the school's knowledge base",
    knowledge_fallback: "From the school's knowledge base",
    web_search: "From a live web search",
    deep_research: "From deeper multi-step research",
    unavailable: "Assistant not yet configured",
    error: "Something went wrong"
  };

  var SUGGESTIONS = [
    "When is PaulMUN XII?",
    "How do I contact the school?",
    "Tell me about admissions"
  ];

  var history = [];

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function build() {
    var root = el("div", "chatbot");
    root.id = "chatbot";

    var fab = el("button", "chatbot__fab");
    fab.setAttribute("aria-label", "Open chat assistant");
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4 8.5 8.5 0 0 1-3.8-.9L3 20l1.1-5.6a8.4 8.4 0 1 1 16.9-2.9Z"/></svg>';

    var panel = el("div", "chatbot__panel");

    var head = el("div", "chatbot__head");
    head.innerHTML = '<div><strong>Ask St. Paul&rsquo;s</strong><span>Answers from the school&rsquo;s own info</span></div>';
    var closeBtn = el("button", "chatbot__close", "&times;");
    closeBtn.setAttribute("aria-label", "Close chat");
    head.appendChild(closeBtn);

    var body = el("div", "chatbot__body");
    body.id = "chatbotBody";
    addBotMessage(body, "Hi! I can help with questions about St. Paul&rsquo;s &mdash; admissions, PaulMUN, contact info and more. What would you like to know?", null, []);

    var suggestions = el("div", "chatbot__suggestions");
    SUGGESTIONS.forEach(function (s) {
      var b = el("button", "", s);
      b.type = "button";
      b.addEventListener("click", function () { sendMessage(s, body); });
      suggestions.appendChild(b);
    });

    var form = el("form", "chatbot__form");
    var input = el("input", "chatbot__input");
    input.type = "text";
    input.placeholder = "Type your question…";
    input.setAttribute("aria-label", "Your question");
    var sendBtn = el("button", "chatbot__send");
    sendBtn.type = "submit";
    sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16M13 5l7 7-7 7"/></svg>';
    form.appendChild(input);
    form.appendChild(sendBtn);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = input.value.trim();
      if (!val) return;
      input.value = "";
      sendMessage(val, body);
    });

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(suggestions);
    panel.appendChild(form);

    root.appendChild(fab);
    root.appendChild(panel);
    document.body.appendChild(root);

    fab.addEventListener("click", function () {
      root.classList.add("is-open");
      setTimeout(function () { input.focus(); }, 100);
    });
    closeBtn.addEventListener("click", function () {
      root.classList.remove("is-open");
    });
  }

  function addUserMessage(body, text) {
    var m = el("div", "chatbot__msg chatbot__msg--user");
    m.textContent = text;
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
  }

  function addBotMessage(body, html, mode, sources) {
    var m = el("div", "chatbot__msg chatbot__msg--bot");
    m.innerHTML = html;
    if (mode && MODE_LABELS[mode]) {
      m.appendChild(el("span", "chatbot__mode", MODE_LABELS[mode]));
    }
    if (sources && sources.length) {
      var s = el("div", "chatbot__sources");
      sources.forEach(function (src) {
        var a = el("a", "");
        a.href = src.url; a.target = "_blank"; a.rel = "noopener";
        a.textContent = src.title || src.url;
        s.appendChild(a);
      });
      m.appendChild(s);
    }
    body.appendChild(m);
    body.scrollTop = body.scrollHeight;
  }

  function addTyping(body) {
    var t = el("div", "chatbot__typing");
    t.id = "chatbotTyping";
    t.innerHTML = "<span></span><span></span><span></span>";
    body.appendChild(t);
    body.scrollTop = body.scrollHeight;
    return t;
  }

  function escapeHtml(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function sendMessage(text, body) {
    addUserMessage(body, text);
    var typing = addTyping(body);

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: history })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        typing.remove();
        var reply = data.reply || "Sorry, I couldn't get an answer just now.";
        addBotMessage(body, escapeHtml(reply).replace(/\n/g, "<br>"), data.mode, data.sources);
        history.push({ role: "user", content: text });
        history.push({ role: "assistant", content: reply });
      })
      .catch(function () {
        typing.remove();
        addBotMessage(body, "I couldn&rsquo;t reach the assistant just now &mdash; please try again, or contact the school office at info@stpauls.edu.pk.", "error", []);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
