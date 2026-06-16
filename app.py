import time
import requests
import feedparser
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_DURATION = 300  # 5 minutes cache
feed_cache = {
    "data": None,
    "last_fetched": 0
}

def fetch_feed(force=False):
    now = time.time()
    # Check if cache is still valid
    if not force and feed_cache["data"] and (now - feed_cache["last_fetched"] < CACHE_DURATION):
        return feed_cache["data"], True
    
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        feed = feedparser.parse(response.content)
        
        entries = []
        for entry in feed.entries:
            entries.append({
                "title": entry.get("title", "Unknown Date"),
                "link": entry.get("link", ""),
                "updated": entry.get("updated", ""),
                "id": entry.get("id", ""),
                "summary": entry.get("summary", "")
            })
        
        feed_cache["data"] = entries
        feed_cache["last_fetched"] = now
        return entries, False
    except Exception as e:
        # Fallback to cache if request fails but we have cached data
        if feed_cache["data"]:
            return feed_cache["data"], True
        raise e

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/releases")
def get_releases():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    try:
        entries, from_cache = fetch_feed(force=force_refresh)
        return jsonify({
            "success": True,
            "entries": entries,
            "cached": from_cache,
            "last_fetched": feed_cache["last_fetched"]
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
