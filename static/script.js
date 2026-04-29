const CATEGORY_ORDER = ["korea", "us_politics", "world", "finance", "tech"];
const CATEGORY_ICONS = {
  korea: "🇰🇷",
  us_politics: "🇺🇸",
  world: "🌍",
  finance: "💹",
  tech: "💻",
};

let pollInterval = null;

async function fetchDigest() {
  const res = await fetch("/api/digest");
  return res.json();
}

async function triggerRefresh() {
  const btn = document.getElementById("refresh-btn");
  btn.disabled = true;
  showToast("🔄 뉴스 수집 및 AI 분석을 시작합니다 (1~2분 소요)...");
  setBadge("loading", "분석 중...");

  await fetch("/api/refresh", { method: "POST" });

  // Poll until done
  clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    const status = await fetch("/api/status").then(r => r.json());
    if (!status.is_loading) {
      clearInterval(pollInterval);
      btn.disabled = false;
      setBadge("done", "업데이트 완료");
      showToast("✅ 뉴스가 업데이트되었습니다!");
      loadAndRender();
    }
  }, 5000);
}

function setBadge(type, text) {
  const badge = document.getElementById("status-badge");
  badge.className = `badge badge-${type}`;
  badge.textContent = text;
}

function showToast(msg, duration = 4000) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), duration);
}

function renderStars(starStr) {
  return starStr.split("").map(ch =>
    ch === "★"
      ? `<span>★</span>`
      : `<span class="star-off">☆</span>`
  ).join("");
}

function renderNews(data) {
  // Meta bar
  document.getElementById("generated-at").textContent = "⏱ " + data.generated_at;
  document.getElementById("weekday-label").textContent = "📅 " + data.weekday;
  document.getElementById("meta-bar").classList.remove("hidden");

  // Keywords
  const kwSection = document.getElementById("keywords-section");
  if (data.key_keywords && data.key_keywords.length) {
    kwSection.innerHTML = data.key_keywords.map(k =>
      `<span class="keyword-tag">${k}</span>`
    ).join("");
    kwSection.classList.remove("hidden");
  }

  // Categories
  const grid = document.getElementById("categories-grid");
  grid.innerHTML = "";

  for (const cat of CATEGORY_ORDER) {
    const items = data.categories[cat] || [];
    if (!items.length) continue;

    const section = document.createElement("section");
    section.className = `category-section cat-${cat}`;

    const catName = items[0]?.category_ko || cat;
    const icon = CATEGORY_ICONS[cat] || "📌";

    section.innerHTML = `
      <div class="category-header">
        <div class="category-dot"></div>
        <span class="category-title">${icon} ${catName}</span>
        <span class="category-count">${items.length}건</span>
      </div>
      <ul class="news-list">
        ${items.map((item, i) => `
          <a class="news-item" href="${item.url}" target="_blank" rel="noopener noreferrer">
            <div class="news-rank">#${i + 1}</div>
            <div class="news-body">
              <div class="news-title">${item.title_ko}</div>
              <div class="news-meta">
                <span class="news-stars">${renderStars(item.stars)}</span>
                <span class="news-source">${item.source}</span>
                <span class="news-time">${item.published}</span>
              </div>
              ${item.summary_ko ? `<div class="news-summary">${item.summary_ko}</div>` : ""}
            </div>
          </a>
        `).join("")}
      </ul>
    `;
    grid.appendChild(section);
  }

  // Daily summary
  if (data.daily_summary) {
    document.getElementById("summary-text").textContent = data.daily_summary;
    document.getElementById("summary-section").classList.remove("hidden");
  }
}

async function loadAndRender() {
  document.getElementById("loading-screen").classList.remove("hidden");
  document.getElementById("empty-screen").classList.add("hidden");
  document.getElementById("digest-root").classList.add("hidden");

  try {
    const result = await fetchDigest();

    document.getElementById("loading-screen").classList.add("hidden");

    if (result.status === "empty" || !result.data) {
      document.getElementById("empty-screen").classList.remove("hidden");
      setBadge("idle", "데이터 없음");
      return;
    }

    const data = result.data;
    renderNews(data);

    document.getElementById("digest-root").classList.remove("hidden");

    if (result.is_loading) {
      setBadge("loading", "업데이트 중...");
    } else {
      setBadge("done", "최신 데이터");
    }
  } catch (err) {
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("empty-screen").classList.remove("hidden");
    setBadge("error", "오류");
    showToast("❌ 데이터를 불러오지 못했습니다.");
  }
}

// Initial load
loadAndRender();

// Auto-check loading status
setInterval(async () => {
  const status = await fetch("/api/status").then(r => r.json()).catch(() => null);
  if (!status) return;
  if (status.is_loading) {
    setBadge("loading", "업데이트 중...");
  }
}, 10000);
