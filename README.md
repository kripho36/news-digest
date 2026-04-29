# 글로벌 뉴스 다이제스트

Reuters, BBC, AP, Bloomberg, Yonhap 등에서 뉴스를 수집하고  
Claude AI가 한국어로 분석 · 요약 · 중요도 평가를 해주는 웹 앱입니다.

## 설치 방법

### 1. Python 패키지 설치

```bash
cd news-digest
pip install -r requirements.txt
```

### 2. API 키 설정

`.env.example` 파일을 `.env`로 복사하고 API 키 입력:

```bash
copy .env.example .env
```

`.env` 파일을 열어서 본인의 Anthropic API 키 입력:
```
ANTHROPIC_API_KEY=sk-ant-여기에키입력
```

> API 키 발급: https://console.anthropic.com

### 3. 서버 실행

```bash
python app.py
```

브라우저에서 http://localhost:5000 접속

### 4. 뉴스 업데이트

- 웹 페이지의 **🔄 뉴스 업데이트** 버튼 클릭
- 또는 http://localhost:5000/api/refresh 호출
- 1~2분 소요 (RSS 수집 + Claude AI 분석)

## 기능

| 기능 | 설명 |
|------|------|
| 🇰🇷 한국 뉴스 | Yonhap, Korea Herald, JoongAng Daily |
| 🇺🇸 미국 정치 | Reuters Politics, BBC US, NPR |
| 🌍 세계 뉴스 | Reuters World, BBC World, Al Jazeera |
| 💹 금융/경제 | Reuters Business, Bloomberg, FT |
| 💻 테크/IT | TechCrunch, The Verge, Wired, BBC Tech |
| ★ 중요도 | Claude AI가 1~5점 별점으로 자동 평가 |
| 📋 요약 | 전체 뉴스 종합 요약 + 핵심 키워드 |

## API 엔드포인트

- `GET /` — 메인 페이지
- `GET /api/digest` — 현재 뉴스 데이터 (JSON)
- `GET/POST /api/refresh` — 뉴스 수집 및 분석 시작
- `GET /api/status` — 로딩 상태 확인

## 수동 실행 (스케줄 없이 CLI에서)

```bash
python -c "
from news_fetcher import fetch_all_news
from news_analyzer import analyze_all
import json
raw = fetch_all_news(hours=20)
result = analyze_all(raw)
print(json.dumps(result, ensure_ascii=False, indent=2))
"
```
