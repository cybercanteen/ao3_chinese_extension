// background.js
const cache = new Map();
const CACHE_MAX = 3000;

function cacheGet(key) {
  return cache.get(key);
}

function cacheSet(key, value) {
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

async function translateWithGoogle(text, sourceLang = "auto", targetLang = "zh-CN") {
  const key = `${sourceLang}|${targetLang}|${text}`;
  const hit = cacheGet(key);
  if (hit) return hit;

  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sourceLang);
  url.searchParams.set("tl", targetLang);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error(`Translate request failed: ${res.status}`);

  const data = await res.json();
  const translated = Array.isArray(data?.[0])
    ? data[0].map(part => part?.[0] || "").join("")
    : "";

  cacheSet(key, translated);
  return translated;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "AO3_TRANSLATE_TEXT") {
        const { text, sourceLang, targetLang } = msg.payload || {};
        if (!text || typeof text !== "string") {
          throw new Error("No text to translate");
        }

        const result = await translateWithGoogle(
          text,
          sourceLang || "auto",
          targetLang || "zh-CN"
        );

        sendResponse({ ok: true, data: result });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (err) {
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();

  return true;
});