"""
하루 1번 실행하는 메인 스크립트
1. 뉴스 수집 (RSS)
2. Groq AI 분석
3. docs/digest.json (최신) + docs/history/YYYY-MM-DD.json (기록) 저장
4. GitHub 자동 push
"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from news_fetcher import fetch_all_news
from news_analyzer import analyze_all

import pytz
KST = pytz.timezone("Asia/Seoul")

DOCS_DIR = Path("docs")
HISTORY_DIR = DOCS_DIR / "history"
LATEST_PATH = DOCS_DIR / "digest.json"
DATES_PATH = DOCS_DIR / "dates.json"


def save_history(digest: dict, date_label: str):
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    path = HISTORY_DIR / f"{date_label}.json"
    path.write_text(json.dumps(digest, ensure_ascii=False, indent=2), encoding="utf-8")

    # dates.json 업데이트 (날짜 목록)
    if DATES_PATH.exists():
        dates = json.loads(DATES_PATH.read_text(encoding="utf-8"))
    else:
        dates = []

    if date_label not in dates:
        dates.insert(0, date_label)
        dates = dates[:30]  # 최근 30일만 유지

    DATES_PATH.write_text(json.dumps(dates, ensure_ascii=False), encoding="utf-8")


def git_push(date_label: str):
    try:
        subprocess.run(["git", "add", "docs/"], check=True)
        subprocess.run(["git", "commit", "-m", f"뉴스 업데이트: {date_label}"], check=True)
        subprocess.run(["git", "push"], check=True)
        print("[git] GitHub push 완료")
    except subprocess.CalledProcessError as e:
        print(f"[git] push 실패: {e}")
        sys.exit(1)


def main():
    print("=" * 50)
    print("글로벌 뉴스 다이제스트 수집 시작")
    print("=" * 50)

    print("\n[1/3] 뉴스 RSS 수집 중...")
    raw = fetch_all_news(hours=20)
    total = sum(len(v) for v in raw.values())
    print(f"      수집 완료: 총 {total}건")

    print("\n[2/3] Groq AI 분석 중...")
    digest = analyze_all(raw)
    date_label = digest["date_label"]
    print(f"      분석 완료: {digest['generated_at']}")

    print("\n[3/3] GitHub 업로드 중...")
    DOCS_DIR.mkdir(exist_ok=True)

    # 최신 데이터
    LATEST_PATH.write_text(json.dumps(digest, ensure_ascii=False, indent=2), encoding="utf-8")

    # 날짜별 기록 저장
    save_history(digest, date_label)

    git_push(date_label)

    print(f"\n완료! 사이트: https://kripho36.github.io/news-digest")


if __name__ == "__main__":
    main()
