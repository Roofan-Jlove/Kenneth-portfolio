/* ============================================================
   St. Paul's English High School — assistant chatbot backend
   Vercel serverless function. 3 retrieval modes:
     1. knowledge  — answered straight from schoolKnowledge.js
     2. web_search — one live search when the question needs
                      current info the knowledge base doesn't have
     3. deep_research — multiple searches + synthesis for
                      broader / multi-part questions
   Requires two environment variables (set in Vercel → Settings →
   Environment Variables, see /api/README.md for how to get them):
     ANTHROPIC_API_KEY
     TAVILY_API_KEY   (optional — search modes degrade gracefully
                        to knowledge-only if this isn't set)
   ============================================================ */

const schoolKnowledge = require("./school-knowledge.js");

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const SCHOOL_DOMAIN = "stpauls.edu.pk";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const message = (body && body.message ? String(body.message) : "").trim();
  const history = Array.isArray(body && body.history) ? body.history.slice(-8) : [];

  if (!message) {
    return res.status(400).json({ error: "Missing 'message'." });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({
      reply: "The assistant isn't fully set up yet — the school needs to add an API key before I can answer questions. In the meantime, please contact the school office directly at info@stpauls.edu.pk or +92 21 32789143.",
      mode: "unavailable",
      sources: []
    });
  }

  try {
    const mode = pickMode(message);
    let searchContext = "";
    let sources = [];

    if (mode === "web_search" || mode === "deep_research") {
      if (process.env.TAVILY_API_KEY) {
        const queries = mode === "deep_research"
          ? [message, `${message} site:${SCHOOL_DOMAIN}`]
          : [`${message} site:${SCHOOL_DOMAIN}`];

        const results = [];
        for (const q of queries) {
          const r = await tavilySearch(q);
          if (r) results.push(...r);
        }
        if (results.length) {
          const seen = new Set();
          const deduped = results.filter(r => {
            if (seen.has(r.url)) return false;
            seen.add(r.url);
            return true;
          }).slice(0, 6);
          sources = deduped.map(r => ({ title: r.title, url: r.url }));
          searchContext = deduped
            .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}\nSource: ${r.url}`)
            .join("\n\n");
        }
      }
    }

    const systemPrompt = buildSystemPrompt(mode, searchContext);
    const reply = await callClaude(systemPrompt, history, message);

    return res.status(200).json({
      reply,
      mode: searchContext ? mode : (mode === "knowledge" ? "knowledge" : "knowledge_fallback"),
      sources
    });
  } catch (err) {
    console.error("chat.js error:", err);
    return res.status(200).json({
      reply: "Something went wrong answering that just now. Please try again, or contact the school office directly at info@stpauls.edu.pk / +92 21 32789143.",
      mode: "error",
      sources: []
    });
  }
};

function pickMode(message) {
  const m = message.toLowerCase();
  const timeSensitive = /(today|tomorrow|this week|next week|latest|currently|right now|open now|holiday|off day|is there school|closed|deadline)/;
  const complex = message.length > 140 || (m.match(/\?/g) || []).length > 1 ||
    /( and | also |compare|difference between)/.test(m);

  if (complex) return "deep_research";
  if (timeSensitive.test(m)) return "web_search";
  return "knowledge";
}

async function tavilySearch(query) {
  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: 4,
        include_answer: false
      })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data.results || []).map(r => ({
      title: r.title,
      url: r.url,
      content: (r.content || "").slice(0, 500)
    }));
  } catch (e) {
    console.error("tavilySearch error:", e);
    return null;
  }
}

function buildSystemPrompt(mode, searchContext) {
  let prompt = `You are the official assistant for St. Paul's English High School, Karachi, on the school's own website. You help students and parents with quick, accurate questions.

Ground rules:
- Only state facts you're actually given below (school knowledge base, and search results if provided). Never invent dates, numbers, names, or policies.
- If you don't have the specific answer, say so plainly and direct the person to contact the school office (info@stpauls.edu.pk, +92 21 32789143) rather than guessing.
- Keep answers short and direct — 2-4 sentences unless the question genuinely needs more.
- Be warm but efficient. This is a school assistant, not a general chatbot.

SCHOOL KNOWLEDGE BASE:
${schoolKnowledge}`;

  if (searchContext) {
    prompt += `\n\nLIVE SEARCH RESULTS (use these for anything time-sensitive or not covered above; cite naturally, don't fabricate beyond what's shown):\n${searchContext}`;
  } else if (mode !== "knowledge") {
    prompt += `\n\nNote: live search was attempted but returned nothing useful, or isn't configured. Answer only from the knowledge base above, and be upfront if you don't have the specific info requested.`;
  }

  return prompt;
}

async function callClaude(systemPrompt, history, message) {
  const messages = history
    .filter(h => h && h.role && h.content)
    .map(h => ({ role: h.role === "assistant" ? "assistant" : "user", content: String(h.content) }));
  messages.push({ role: "user", content: message });

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 500,
      system: systemPrompt,
      messages
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  const block = (data.content || []).find(c => c.type === "text");
  return block ? block.text : "I couldn't generate a response just now — please try again.";
}
