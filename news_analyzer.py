import json
import os
from datetime import datetime

import pytz
from groq import Groq

KST = pytz.timezone("Asia/Seoul")

CATEGORY_KO = {
    "world": "세계",
    "us_politics": "미국 정치",
    "tech": "테크 / IT",
    "finance": "금융 / 경제",
    "korea": "한국",
}

MODEL = "llama-3.3-70b-versatile"

# 모든 카테고리 + 요약을 단 1번의 API 호출로 처리
SINGLE_CALL_PROMPT = """당신은 글로벌 뉴스 에디터입니다. 아래 카테고리별 영문 뉴스를 한 번에 분석하세요.

[작업]
1. 각 카테고리에서 중요한 기사 최대 6개를 선별
2. 중요도 순 정렬 (1~5점)
3. 제목 한국어 번역, 2문장 요약
4. 전체 뉴스 종합 요약 (3~4문장) + 핵심 키워드 5개

[중요도 기준] 글로벌 파급력, 한국 관련성, 경제적 영향, 정치적 중요도

---
{all_articles}
---

아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{{
  "categories": {{
    "korea": [
      {{"title_ko": "제목", "importance": 5, "summary_ko": "요약.", "source": "출처", "url": "URL", "published": "시간"}}
    ],
    "us_politics": [],
    "world": [],
    "finance": [],
    "tech": []
  }},
  "daily_summary": "오늘의 종합 요약 3~4문장.",
  "key_keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"]
}}"""


def stars(n: int) -> str:
    n = max(1, min(5, n))
    return "★" * n + "☆" * (5 - n)


def extract_json(text: str) -> str:
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    if "{" in text:
        start = text.index("{")
        end = text.rindex("}") + 1
        return text[start:end]
    return text


def build_articles_block(raw_news: dict[str, list[dict]]) -> str:
    """모든 카테고리 기사를 하나의 텍스트 블록으로 합침"""
    blocks = []
    category_order = ["korea", "us_politics", "world", "finance", "tech"]
    for cat in category_order:
        articles = raw_news.get(cat, [])[:10]  # 카테고리당 최대 10개만
        if not articles:
            continue
        cat_ko = CATEGORY_KO.get(cat, cat)
        blocks.append(f"=== [{cat_ko}] ===")
        for i, a in enumerate(articles):
            blocks.append(
                f"[{i}] {a['title']} | {a['source']} | {a['published']}\n"
                f"    URL: {a['url']}\n"
                f"    내용: {a['summary'][:120]}"
            )
    return "\n\n".join(blocks)


def analyze_all(raw_news: dict[str, list[dict]]) -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY 환경변수가 설정되지 않았습니다.")

    client = Groq(api_key=api_key)
    now_kst = datetime.now(KST)

    print("[analyze] 전체 카테고리 단일 호출 분석 중...")
    all_articles_text = build_articles_block(raw_news)
    prompt = SINGLE_CALL_PROMPT.format(all_articles=all_articles_text)

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=6000,
    )
    raw = response.choices[0].message.content
    parsed = json.loads(extract_json(raw))
    print("[analyze] 완료")

    # 별점 및 메타 정보 추가
    categories = parsed.get("categories", {})
    for cat, items in categories.items():
        for item in items:
            item["stars"] = stars(item.get("importance", 3))
            item["category"] = cat
            item["category_ko"] = CATEGORY_KO.get(cat, cat)

    return {
        "generated_at": now_kst.strftime("%Y년 %m월 %d일 %H:%M KST"),
        "date_label": now_kst.strftime("%Y-%m-%d"),
        "weekday": ["월", "화", "수", "목", "금", "토", "일"][now_kst.weekday()] + "요일",
        "categories": categories,
        "daily_summary": parsed.get("daily_summary", ""),
        "key_keywords": parsed.get("key_keywords", []),
    }
