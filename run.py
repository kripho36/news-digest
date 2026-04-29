"""
하루 1번 실행하는 메인 스크립트
1. 뉴스 수집 (RSS)
2. Groq AI 분석
3. docs/digest.json 저장
4. GitHub에 자동 push
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

DIGEST_PATH = Path("docs/digest.json")


def git_push():
    try:
        subprocess.run(["git", "add", "docs/digest.json"], check=True)
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        subprocess.run(["git", "commit", "-m", f"뉴스 업데이트: {now}"], check=True)
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
    print(f"      분석 완료: {digest['generated_at']}")

    print("\n[3/3] GitHub 업로드 중...")
    DIGEST_PATH.parent.mkdir(exist_ok=True)
    DIGEST_PATH.write_text(
        json.dumps(digest, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    git_push()

    print("\n완료!")
    print(f"사이트에서 확인하세요: GitHub Pages 주소")


if __name__ == "__main__":
    main()
