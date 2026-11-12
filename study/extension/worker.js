const HOST = "kr.news_digest.writing";
const PREFIX = "writing:";
let writes = Promise.resolve();

chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
chrome.action.onClicked.addListener(tab => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(console.warn);
  chrome.runtime.sendMessage({ type: "article-activated", tabId: tab.id }).catch(() => {});
});

function updateNote(article, change) {
  const key = PREFIX + article.url;
  const operation = writes.then(async () => {
    const saved = (await chrome.storage.local.get(key))[key] ||
      { url: article.url, title: article.title, draft: "", reviews: [] };
    change(saved);
    saved.updated = Date.now();
    await chrome.storage.local.set({ [key]: saved });
  });
  writes = operation.catch(() => {});
  return operation;
}

async function ai(request) {
  let result;
  try {
    result = await chrome.runtime.sendNativeMessage(HOST, request);
  } catch {
    throw new Error("노트북의 AI 연결을 열지 못했습니다. 설치 안내의 Windows 연결 등록을 실행해 주세요.");
  }
  if (!result.ok) throw new Error(result.error || "AI 응답을 받지 못했습니다.");
  return result.data;
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  let job;
  if (message.type === "translate" && sender.tab && /^https?:\/\//i.test(sender.url || "")) {
    job = ai({ action: "translate", selection: message.selection, context: message.context });
  } else if (sender.url === chrome.runtime.getURL("panel.html")) {
    if (message.type === "draft") {
      job = updateNote(message.article, note => { note.draft = message.draft; });
    } else if (message.type === "review") {
      const { article, draft, source } = message;
      job = (async () => {
        await updateNote(article, note => { note.draft = draft; });
        const feedback = await ai({ action: "review", title: article.title, source, draft });
        const review = { at: Date.now(), draft, feedback };
        await updateNote(article, note => { note.reviews.push(review); });
        return review;
      })();
    }
  }
  if (!job) return;
  job.then(data => reply({ ok: true, data }))
    .catch(error => reply({ ok: false, error: error.message }));
  return true;
});
