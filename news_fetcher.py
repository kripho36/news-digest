import feedparser
import requests
from datetime import datetime, timedelta
import pytz
from bs4 import BeautifulSoup

KST = pytz.timezone("Asia/Seoul")

RSS_SOURCES = {
    "world": [
        {"name": "Reuters World", "url": "https://feeds.reuters.com/reuters/worldNews", "lang": "en"},
        {"name": "BBC World", "url": "http://feeds.bbci.co.uk/news/world/rss.xml", "lang": "en"},
        {"name": "AP News", "url": "https://rsshub.app/apnews/topics/apf-topnews", "lang": "en"},
        {"name": "Al Jazeera", "url": "https://www.aljazeera.com/xml/rss/all.xml", "lang": "en"},
    ],
    "us_politics": [
        {"name": "Reuters Politics", "url": "https://feeds.reuters.com/reuters/politicsNews", "lang": "en"},
        {"name": "BBC US & Canada", "url": "http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml", "lang": "en"},
        {"name": "NPR Politics", "url": "https://feeds.npr.org/1014/rss.xml", "lang": "en"},
    ],
    "tech": [
        {"name": "Reuters Tech", "url": "https://feeds.reuters.com/reuters/technologyNews", "lang": "en"},
        {"name": "BBC Technology", "url": "http://feeds.bbci.co.uk/news/technology/rss.xml", "lang": "en"},
        {"name": "The Verge", "url": "https://www.theverge.com/rss/index.xml", "lang": "en"},
        {"name": "TechCrunch", "url": "https://techcrunch.com/feed/", "lang": "en"},
        {"name": "Wired", "url": "https://www.wired.com/feed/rss", "lang": "en"},
    ],
    "finance": [
        {"name": "Reuters Finance", "url": "https://feeds.reuters.com/reuters/businessNews", "lang": "en"},
        {"name": "BBC Business", "url": "http://feeds.bbci.co.uk/news/business/rss.xml", "lang": "en"},
        {"name": "Bloomberg Markets", "url": "https://feeds.bloomberg.com/markets/news.rss", "lang": "en"},
        {"name": "Financial Times", "url": "https://www.ft.com/rss/home", "lang": "en"},
    ],
    "korea": [
        {"name": "Yonhap English", "url": "https://en.yna.co.kr/RSS/news.xml", "lang": "en"},
        {"name": "Korea Herald", "url": "http://www.koreaherald.com/rss/herald.xml", "lang": "en"},
        {"name": "Korea JoongAng Daily", "url": "https://koreajoongangdaily.joins.com/rss/feed.xml", "lang": "en"},
    ],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def parse_feed_date(entry) -> datetime | None:
    for attr in ("published_parsed", "updated_parsed"):
        t = getattr(entry, attr, None)
        if t:
            try:
                import time
                return datetime.fromtimestamp(time.mktime(t), tz=pytz.utc)
            except Exception:
                pass
    return None


def fetch_feed(source: dict, cutoff: datetime) -> list[dict]:
    try:
        feed = feedparser.parse(source["url"], request_headers=HEADERS)
    except Exception:
        return []

    articles = []
    for entry in feed.entries:
        pub_date = parse_feed_date(entry)
        if pub_date and pub_date < cutoff:
            continue

        summary = getattr(entry, "summary", "") or getattr(entry, "description", "") or ""
        if summary:
            summary = BeautifulSoup(summary, "lxml").get_text(separator=" ", strip=True)[:500]

        articles.append({
            "title": getattr(entry, "title", "").strip(),
            "url": getattr(entry, "link", ""),
            "source": source["name"],
            "published": pub_date.astimezone(KST).strftime("%Y-%m-%d %H:%M KST") if pub_date else "N/A",
            "published_dt": pub_date,
            "summary": summary,
        })

    return articles


def fetch_all_news(hours: int = 20) -> dict[str, list[dict]]:
    cutoff = datetime.now(tz=pytz.utc) - timedelta(hours=hours)
    result: dict[str, list[dict]] = {}

    for category, sources in RSS_SOURCES.items():
        articles = []
        for source in sources:
            articles.extend(fetch_feed(source, cutoff))

        seen_titles: set[str] = set()
        unique: list[dict] = []
        for a in articles:
            key = a["title"].lower()[:60]
            if key not in seen_titles and a["title"]:
                seen_titles.add(key)
                unique.append(a)

        unique.sort(key=lambda x: x["published_dt"] or datetime.min.replace(tzinfo=pytz.utc), reverse=True)
        result[category] = unique[:30]

    return result
