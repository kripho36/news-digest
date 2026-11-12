import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@astryxdesign/core/theme";
import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";

const sections = [
  ["korea", "한국"], ["us_politics", "미국 정치"], ["world", "세계"],
  ["finance", "금융 / 경제"], ["tech", "테크 / IT"],
];
const providers = { groq: "Groq", gemini: "Gemini" };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "UTC",
});

async function readJSON(path, signal) {
  const response = await fetch(path, { cache: "no-cache", signal });
  if (!response.ok) throw new Error("발행 데이터를 불러오지 못했습니다.");
  return response.json();
}

function articleUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !/^https?:\/\//i.test(rawUrl)) return undefined;
  // BBC News uses the same article IDs on its UK and international sites.
  return rawUrl.replace(/^https?:\/\/(?:www\.)?bbc\.co\.uk(?=\/news\/articles\/)/i, "https://www.bbc.com");
}

function Article({ item, sourceOnly }) {
  const rating = Math.min(5, Math.max(0, Number(item.importance) || 0));
  const url = articleUrl(item.url);
  return (
    <li>
      <a className="story" href={url} target="_blank" rel="noopener noreferrer">
        <h3>{item.title_ko}</h3>
        <div className="byline">
          <span>{item.source}</span>
          <span>{item.published}</span>
          {!sourceOnly && rating > 0 && (
            <span className="rating" aria-label={`AI 중요도 5점 중 ${rating}점`}>
              {"★".repeat(rating)}{"☆".repeat(5 - rating)}
            </span>
          )}
        </div>
        {item.summary_ko && <p className={sourceOnly ? "excerpt" : ""}>{item.summary_ko}</p>}
      </a>
    </li>
  );
}

function Edition({ data }) {
  const [keyword, setKeyword] = useState("");
  const sourceOnly = data.analysis_status === "source_only" || data.analysis_provider === "fallback";
  const provider = providers[data.analysis_provider];
  const keywords = sourceOnly ? [] : data.key_keywords || [];
  const groups = sections.map(([id, label]) => {
    const articles = data.categories?.[id] || [];
    const matches = articles.filter(item => [item.title_ko, item.summary_ko, item.source]
      .some(value => (value || "").toLowerCase().includes(keyword.toLowerCase())));
    return { id, label, items: keyword ? matches : articles };
  }).filter(group => group.items.length);
  const sources = [...new Set(sections.flatMap(([id]) =>
    (data.categories?.[id] || []).map(item => item.source).filter(Boolean)))];

  return (
    <>
      <section className="intro" aria-labelledby="edition-title">
        <Badge variant={sourceOnly ? "neutral" : "success"} label={sourceOnly ? "원문 제공" : (provider ? `AI 브리핑 · ${provider}` : "AI 브리핑")} />
        <h2 id="edition-title">{sourceOnly ? "RSS 원문 · 최신순" : "종합 요약"}</h2>
        <p>{sourceOnly
          ? "이번 판은 AI 요약을 생성하지 못해 분야별로 가장 최근에 발행된 원문 기사를 보여드립니다."
          : data.daily_summary || "이 판의 종합 요약이 없습니다."}</p>
      </section>
      {keywords.length > 0 && <nav className="keywords" aria-label="키워드 필터">
        {keywords.map(word => <button key={word} aria-pressed={keyword === word}
          onClick={() => setKeyword(keyword === word ? "" : word)}>{word}</button>)}
      </nav>}
      {keyword && <div className="filter">‘{keyword}’ 관련 기사 <button onClick={() => setKeyword("")}>필터 해제</button></div>}
      <div className="sections">
        {groups.map(({ id, label, items }) =>
          <section key={id} aria-labelledby={`section-${id}`}>
            <Card padding={0} className="news-card">
              <div className="section-head"><h2 id={`section-${id}`}>{label}</h2><span>{items.length}건</span></div>
              <ul>{items.map((item, index) =>
                <Article key={`${item.url}-${index}`} item={item} sourceOnly={sourceOnly} />)}</ul>
            </Card>
          </section>
        )}
      </div>
      {groups.length === 0 && <p role="status">표시할 기사가 없습니다.</p>}
      {sources.length > 0 && <footer>이 판의 기사 출처 · {sources.join(" · ")}</footer>}
    </>
  );
}

function Reader() {
  const [edition, setEdition] = useState(null);
  const [dates, setDates] = useState([]);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const request = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    Promise.all([
      readJSON("digest.json", controller.signal),
      readJSON("dates.json", controller.signal).catch(() => []),
    ]).then(([latest, history]) => {
      if (controller.signal.aborted) return;
      setEdition(latest);
      setDates([...new Set([latest.date_label, ...history])].filter(d => datePattern.test(d)).sort().reverse());
    }).catch(() => {
      if (!controller.signal.aborted) setError("최신 뉴스를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.");
    });
    return () => request.current?.abort();
  }, []);

  async function selectDate(date) {
    request.current?.abort();
    setError("");
    if (date === edition.date_label) {
      setPending("");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setPending(date);
    try {
      const result = await readJSON(`history/${date}.json`, controller.signal);
      if (result.date_label !== date) throw new Error("날짜 불일치");
      if (!controller.signal.aborted) setEdition(result);
    } catch {
      if (!controller.signal.aborted) setError("선택한 날짜를 불러오지 못했습니다. 이전에 열었던 판을 표시합니다.");
    } finally {
      if (!controller.signal.aborted) setPending("");
    }
  }

  return (
    <>
      <header><div className="masthead">
        <h1>글로벌 뉴스 다이제스트</h1>
        {edition && <label className="archive">발행일
          <select value={pending || edition.date_label} onChange={e => selectDate(e.target.value)}>
            {dates.map(date => <option value={date} key={date}>{dateFormatter.format(new Date(date))}</option>)}
          </select>
        </label>}
      </div></header>
      <main>
        {error && <p className="notice" role="alert">{error}</p>}
        {pending && <p role="status">선택한 날짜를 불러오는 중입니다…</p>}
        {edition ? <>
          <p className="dateline">{edition.generated_at} 발행</p>
          <Edition key={edition.date_label} data={edition} />
        </> : !error && <p role="status">뉴스를 불러오는 중입니다…</p>}
      </main>
    </>
  );
}

createRoot(document.getElementById("app")).render(<Theme theme={neutralTheme} mode="light"><Reader /></Theme>);
