const CATEGORY_ORDER = ["korea", "us_politics", "world", "finance", "tech"];
const CATEGORY_ICONS = {
  korea: "🇰🇷",
  us_politics: "🇺🇸",
  world: "🌍",
  finance: "💹",
  tech: "💻",
};

let currentData = null;
let activeKeyword = null;

function renderStars(starStr) {
  return starStr.split("").map(ch =>
    ch === "★" ? `<span>★</span>` : `<span class="star-off">☆</span>`
  ).join("");
}

// ── 키워드 필터 ──
function setKeywordFilter(keyword) {
  activeKeyword = keyword;
  document.querySelectorAll(".keyword-tag").forEach(el => {
    el.classList.toggle("active", el.dataset.keyword === keyword);
  });

  const notice = document.getElementById("filter-notice");
  const label = document.getElementById("filter-label");
  notice.classList.remove("hidden");
  label.textContent = `"${keyword}" 관련 뉴스만 표시 중`;

  renderCategories(currentData, keyword);
}

function clearFilter() {
  activeKeyword = null;
  document.querySelectorAll(".keyword-tag").forEach(el => el.classList.remove("active"));
  document.getElementById("filter-notice").classList.add("hidden");
  renderCategories(currentData, null);
}

function itemMatchesKeyword(item, keyword) {
  const kw = keyword.toLowerCase();
  return (item.title_ko || "").toLowerCase().includes(kw) ||
         (item.summary_ko || "").toLowerCase().includes(kw) ||
         (item.source || "").toLowerCase().includes(kw);
}

// ── 카테고리 렌더링 ──
function renderCategories(data, keyword) {
  const grid = document.getElementById("categories-grid");
  grid.innerHTML = "";

  for (const cat of CATEGORY_ORDER) {
    let items = data.categories[cat] || [];
    if (keyword) items = items.filter(item => itemMatchesKeyword(item, keyword));
    if (!items.length) continue;

    const icon = CATEGORY_ICONS[cat] || "📌";
    const catName = items[0]?.category_ko || cat;

    const section = document.createElement("section");
    section.className = `category-section cat-${cat}`;
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

  if (!grid.innerHTML) {
    grid.innerHTML = `<div class="no-results">검색 결과가 없습니다.</div>`;
  }
}

// ── 날짜 네비게이션 ──
async function loadDates() {
  try {
    const res = await fetch("dates.json?t=" + Date.now());
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function renderDateNav(dates, currentDate) {
  const nav = document.getElementById("date-nav");
  if (!dates.length) return;

  nav.innerHTML = `
    <select id="date-select" onchange="loadDateDigest(this.value)">
      ${dates.map(d => `
        <option value="${d}" ${d === currentDate ? "selected" : ""}>
          ${formatDateLabel(d)}
        </option>
      `).join("")}
    </select>
  `;
}

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split("-");
  const date = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${m}/${d} (${days[date.getDay()]})`;
}

async function loadDateDigest(dateStr) {
  try {
    const res = await fetch(`history/${dateStr}.json?t=` + Date.now());
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderNews(data);
  } catch {
    alert("해당 날짜의 데이터를 불러오지 못했습니다.");
  }
}

// ── 메인 렌더링 ──
function renderNews(data) {
  currentData = data;
  activeKeyword = null;

  document.getElementById("generated-at").textContent = "⏱ " + data.generated_at;
  document.getElementById("weekday-label").textContent = "📅 " + data.weekday;

  // 키워드 태그 (클릭 필터)
  const kwSection = document.getElementById("keywords-section");
  if (data.key_keywords && data.key_keywords.length) {
    kwSection.innerHTML = data.key_keywords.map(k => `
      <span class="keyword-tag" data-keyword="${k}" onclick="setKeywordFilter('${k}')">
        ${k}
      </span>
    `).join("");
  }

  document.getElementById("filter-notice").classList.add("hidden");
  renderCategories(data, null);

  if (data.daily_summary) {
    document.getElementById("summary-text").textContent = data.daily_summary;
    document.getElementById("summary-section").classList.remove("hidden");
  }

  document.getElementById("digest-root").classList.remove("hidden");
  document.getElementById("loading-screen").classList.add("hidden");
}

// ── 초기 로딩 ──
async function load() {
  try {
    const [digestRes, dates] = await Promise.all([
      fetch("digest.json?t=" + Date.now()),
      loadDates()
    ]);

    if (!digestRes.ok) throw new Error();
    const data = await digestRes.json();

    renderDateNav(dates, data.date_label);
    renderNews(data);
  } catch {
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("error-screen").classList.remove("hidden");
  }
}

load();
