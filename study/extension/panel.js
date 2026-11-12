const el = id => document.getElementById(id);
const PREFIX = "writing:";
let page, note, view = "current", serial = 0, editVersion = 0;
let activeId, pageKey = "";
const inFlight = new Set();

function showStatus(text) { el("message").textContent = text; }
function nav(mode) {
  view = mode;
  for (const id of ["current","library"]) el(id).setAttribute("aria-pressed", String(id === mode));
  el("collection").hidden = mode !== "library";
}
function wordCount() {
  const draft = el("draft").value;
  el("words").textContent = (draft.trim().match(/\S+/g) || []).length + " words";
  el("review").disabled = !draft.trim() || !el("excerpt").value.trim() || inFlight.has(page?.url);
}
async function send(data) {
  const result = await chrome.runtime.sendMessage(data);
  if (!result?.ok) throw new Error(result?.error || "요청을 처리하지 못했습니다.");
  return result.data;
}
function add(parent, tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  parent.append(node);
  return node;
}
function feedback() {
  const root = el("feedback");
  root.replaceChildren();
  const item = note?.reviews?.[Number(el("version").value)];
  if (!item) return;
  const details = document.createElement("details");
  add(details,"summary","첨삭을 받은 내 원문");
  add(details,"blockquote",item.draft);
  root.append(details);
  const f = item.feedback;
  add(root,"h3","잘한 점"); add(root,"p",f.strength);
  add(root,"h3","단어와 표현");
  if (!f.edits.length) add(root,"p","이번 글에는 개별 표현 수정 제안이 없습니다.");
  for (const e of f.edits) {
    const row = document.createElement("div"); row.className = "correction";
    add(row,"strong",e.kind); add(row,"p",e.original + " → " + e.replacement); add(row,"p",e.why); root.append(row);
  }
  add(root,"h3","내용 점검");
  if (!f.gaps.length) add(root,"p","제공된 본문에서 추가로 짚을 핵심 내용은 제시되지 않았습니다.");
  for (const gap of f.gaps) { add(root,"p",gap.point); add(root,"blockquote",gap.evidence); }
  add(root,"h3","다음 수정에서"); add(root,"p",f.next);
}
function history() {
  const versions = note?.reviews || [];
  el("history").hidden = !versions.length;
  el("version").replaceChildren();
  for (let i = versions.length - 1; i >= 0; i--) {
    const option = add(el("version"),"option",(i + 1) + "차 · " + new Date(versions[i].at).toLocaleString("ko-KR"));
    option.value = String(i);
  }
  feedback();
}
function draw(article, entry, live) {
  page = article; note = entry;
  el("editor").hidden = false; el("collection").hidden = true;
  el("title").textContent = article.title;
  el("sourceLink").href = article.url;
  el("selectionHelp").hidden = !live;
  el("draft").value = entry?.draft || "";
  el("excerpt").value = article.source || "";
  el("reference").open = !article.source;
  el("excerptInfo").textContent = article.truncated ? "긴 기사입니다. 앞부분 16,000자를 가져왔습니다. 첨삭할 부분을 바꿀 수 있습니다."
    : article.source ? "가져온 본문을 확인하고 필요한 부분을 수정할 수 있습니다."
    : "첨삭할 영어 본문을 붙여 넣거나 원문에서 확장을 다시 여세요.";
  el("saved").textContent = entry ? "노트에 저장됨" : "";
  wordCount(); history();
}

async function current(force = false) {
  const ticket = ++serial;
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  if (ticket !== serial) return;
  activeId = tab?.id; nav("current");
  try {
    if (!tab?.id) throw new Error();
    await chrome.scripting.executeScript({ target:{ tabId:tab.id }, files:["article.js"] });
    const article = await chrome.tabs.sendMessage(tab.id,{ type:"read-article" });
    if (ticket !== serial) return;
    if (!force && pageKey === article.url && !el("editor").hidden) return;
    const saved = (await chrome.storage.local.get(PREFIX + article.url))[PREFIX + article.url];
    if (ticket !== serial) return;
    pageKey = article.url; showStatus(""); draw(article,saved,true);
  } catch {
    if (ticket !== serial) return;
    page = null; pageKey = ""; el("editor").hidden = true;
    showStatus("영어 기사 탭에서 Chrome 도구 모음의 ‘뉴스 영어 노트’를 눌러 주세요.");
  }
}
async function library() {
  const ticket = ++serial;
  nav("library"); page = null; pageKey = ""; el("editor").hidden = true;
  showStatus("");
  const records = Object.entries(await chrome.storage.local.get(null))
    .filter(([k]) => k.startsWith(PREFIX)).map(([,n])=>n).sort((a,b)=>b.updated-a.updated);
  if (ticket !== serial) return;
  el("records").replaceChildren();
  if (!records.length) showStatus("저장한 글이 아직 없습니다. 기사에서 영어 요약을 쓰면 여기에 모입니다.");
  for (const row of records) {
    const li = document.createElement("li"), button = add(li,"button",row.title + " · 첨삭 " + row.reviews.length + "회");
    button.onclick = async () => {
      const visit = ++serial;
      const entry = (await chrome.storage.local.get(PREFIX+row.url))[PREFIX+row.url];
      if (visit !== serial || !entry) return;
      view = "saved"; draw(entry,entry,false); showStatus("");
    };
    el("records").append(li);
  }
}
el("draft").addEventListener("input", async () => {
  if (!page) return;
  const article = {url:page.url,title:page.title}, version = ++editVersion;
  wordCount(); el("saved").textContent = "저장 중…";
  try {
    await send({type:"draft",article,draft:el("draft").value});
    if (page?.url === article.url && version === editVersion) el("saved").textContent = "자동 저장됨";
  } catch (e) { if (page?.url === article.url) el("saved").textContent = e.message; }
});
el("review").onclick = async () => {
  if (!page || inFlight.has(page.url)) return;
  const article = { url:page.url, title:page.title.slice(0,500) }, draft = el("draft").value.trim(), source = el("excerpt").value.trim();
  if (!/[a-z]/i.test(draft) || source.length < 25) { showStatus("영어로 쓴 요약과 비교할 기사 본문을 입력해 주세요."); return; }
  inFlight.add(article.url); wordCount(); showStatus("작성본을 저장하고 기사와 대조하는 중입니다…");
  try {
    await send({type:"review",article,draft,source});
    const saved = (await chrome.storage.local.get(PREFIX+article.url))[PREFIX+article.url];
    if (page?.url === article.url) { note=saved; history(); showStatus("첨삭을 저장했습니다. 의견을 참고해 직접 고쳐 보세요."); }
  } catch(e) { if (page?.url === article.url) showStatus(e.message); }
  finally { inFlight.delete(article.url); wordCount(); }
};
el("excerpt").oninput = wordCount;
el("current").onclick = () => current(true);
el("library").onclick = library;
el("version").onchange = feedback;
chrome.tabs.onActivated.addListener(() => { if (view === "current") current(); });
chrome.tabs.onUpdated.addListener((id,info) => { if (view === "current" && id===activeId && info.status==="complete") current(); });
chrome.runtime.onMessage.addListener(msg => { if(msg.type==="article-activated") current(); });
current();
