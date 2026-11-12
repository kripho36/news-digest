(() => {
  if (globalThis.newsDigestWritingLoaded) return;
  globalThis.newsDigestWritingLoaded = true;
  const excluded = "aside, nav, footer, form, [role=navigation], [role=complementary], [contenteditable]:not([contenteditable=false]), input, textarea, [hidden], [aria-hidden=true]";
  const visible = el => el.getClientRects().length && getComputedStyle(el).visibility === "visible";
  const root = () => {
    const heading = document.querySelector("h1");
    return heading?.closest("article") || document.querySelector("article, [itemprop=articleBody]") ||
      document.querySelector("main, [role=main]") || document.body;
  };
  function article() {
    const container = root();
    const seen = new Set();
    const paragraphs = [...container.querySelectorAll("p")].filter(el => !el.closest(excluded) && visible(el))
      .map(el => el.innerText.trim()).filter(text => {
        if (text.length < 25 || seen.has(text)) return false;
        seen.add(text);
        return true;
      });
    const url = new URL(location.href);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|at_campaign$|at_medium$|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    }
    const full = paragraphs.join("\n\n");
    return { title: document.querySelector("h1")?.innerText.trim() || document.title,
      url: url.href, source: full.slice(0, 16000), truncated: full.length > 16000 };
  }
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (msg.type === "read-article") reply(article());
  });

  const cache = new Map();
  let popup, generation = 0;
  function close() { generation++; popup?.remove(); popup = undefined; }
  async function translate(event) {
    if (!event.isTrusted) return;
    const selection = getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return close();
    const term = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const element = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (!element || !root().contains(element) || element.closest(excluded) || !/[A-Za-z]/.test(term)) return close();
    close();
    const turn = generation;
    const box = range.getBoundingClientRect();
    popup = document.createElement("div");
    popup.style.cssText = "all:initial;position:fixed;z-index:2147483647;display:block";
    const shadow = popup.attachShadow({ mode: "closed" });
    const card = document.createElement("div");
    card.setAttribute("role", "status");
    card.style.cssText = "box-sizing:border-box;background:#fffdf8;color:#183b2c;border:1px solid #91a99a;border-radius:10px;box-shadow:0 5px 22px #0002;padding:12px 15px;font:15px/1.55 system-ui,sans-serif;max-height:38vh;overflow:auto;overflow-wrap:anywhere;white-space:pre-wrap";
    const width = Math.min(345, innerWidth - 20);
    popup.style.width = width + "px";
    popup.style.left = Math.max(10, Math.min(box.left, innerWidth - width - 10)) + "px";
    const place = () => { if (popup && turn === generation) popup.style.top =
      Math.max(8, Math.min(box.bottom + 8, innerHeight - popup.offsetHeight - 8)) + "px"; };
    card.textContent = term.length > 700 ? "한 번에 700자까지 선택해 주세요." : "한국어 뜻을 확인하는 중…";
    shadow.append(card);
    document.documentElement.append(popup);
    place();
    if (term.length > 700) return;
    const paragraph = element.closest("p, li, blockquote, h1, h2, h3");
    const text = paragraph?.innerText || term;
    const index = Math.max(0, text.indexOf(term));
    const context = text.slice(Math.max(0, index - 180), index + term.length + 180);
    const key = term + "\n" + context;
    try {
      if (!cache.has(key)) {
        const answer = await chrome.runtime.sendMessage({ type:"translate", selection:term, context });
        if (!answer?.ok) throw new Error(answer?.error || "번역에 실패했습니다.");
        if (cache.size >= 60) cache.delete(cache.keys().next().value);
        cache.set(key, answer.data.meaning);
      }
      if (turn === generation) card.textContent = cache.get(key);
    } catch (error) { if (turn === generation) card.textContent = error.message; }
    place();
  }
  document.addEventListener("pointerup", translate);
  document.addEventListener("keyup", e => {
    if (e.key === "Escape") close();
    else if (e.key === "Shift") translate(e);
  });
  document.addEventListener("scroll", close, { capture:true, passive:true });
})();
