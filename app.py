import json
import os
import threading
from datetime import datetime
from pathlib import Path

import pytz
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template

load_dotenv()

from news_fetcher import fetch_all_news
from news_analyzer import analyze_all

app = Flask(__name__)
KST = pytz.timezone("Asia/Seoul")
CACHE_FILE = Path("cache/digest.json")
CACHE_FILE.parent.mkdir(exist_ok=True)

_digest_cache: dict = {}
_is_loading: bool = False
_load_lock = threading.Lock()


def load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_cache(data: dict):
    CACHE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def refresh_digest():
    global _digest_cache, _is_loading
    with _load_lock:
        _is_loading = True
    try:
        print("[refresh] 뉴스 수집 시작...")
        raw = fetch_all_news(hours=20)
        print("[refresh] OpenAI 분석 시작...")
        digest = analyze_all(raw)
        digest["raw_counts"] = {cat: len(arts) for cat, arts in raw.items()}
        save_cache(digest)
        _digest_cache = digest
        print(f"[refresh] 완료: {digest['generated_at']}")
    except Exception as e:
        print(f"[refresh] 오류: {e}")
    finally:
        with _load_lock:
            _is_loading = False


def get_digest() -> dict:
    global _digest_cache
    if not _digest_cache:
        _digest_cache = load_cache()
    return _digest_cache


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/digest")
def api_digest():
    data = get_digest()
    if not data:
        return jsonify({"status": "empty", "message": "아직 뉴스 데이터가 없습니다. /api/refresh 를 호출해주세요."})
    return jsonify({"status": "ok", "data": data, "is_loading": _is_loading})


@app.route("/api/refresh", methods=["POST", "GET"])
def api_refresh():
    if _is_loading:
        return jsonify({"status": "loading", "message": "이미 업데이트 중입니다."})

    thread = threading.Thread(target=refresh_digest, daemon=True)
    thread.start()
    return jsonify({"status": "started", "message": "뉴스 수집 및 분석을 시작했습니다. 1~2분 후 /api/digest 에서 확인하세요."})


@app.route("/api/status")
def api_status():
    data = get_digest()
    return jsonify({
        "status": "ok",
        "is_loading": _is_loading,
        "last_updated": data.get("generated_at", "없음"),
        "has_data": bool(data),
    })


if __name__ == "__main__":
    # 시작 시 캐시 로드
    _digest_cache = load_cache()
    if not _digest_cache:
        print("[startup] 캐시 없음 - 자동으로 첫 번째 뉴스 수집을 시작합니다...")
        thread = threading.Thread(target=refresh_digest, daemon=True)
        thread.start()
    else:
        print(f"[startup] 캐시 로드됨: {_digest_cache.get('generated_at', '?')}")

    app.run(debug=False, host="0.0.0.0", port=5000)
