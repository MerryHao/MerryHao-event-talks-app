# BigQuery Release Notes Explorer & Tweet Composer 🚀

A sleek, responsive, dark-mode glassmorphic dashboard built to monitor Google Cloud BigQuery Release Notes, filter through updates, and instantly draft and share tweets about individual releases.

---

## 🛠️ Technology Stack
* **Backend**: Python 3.10+, Flask (routing and caching), `feedparser` (XML parsing), `requests` (HTTP client).
* **Frontend**: Plain Vanilla HTML5, Vanilla CSS3 (responsive flexbox/grid layout and glassmorphism), Vanilla JavaScript.
* **Icons & Fonts**: FontAwesome 6, Google Font *Outfit*.

---

## ✨ Features

1. **Robust XML Parser Backend**: Fetches the official BigQuery Atom release feed (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`) and caches entries in memory for 5 minutes.
2. **Client-Side DOM Parsing**: Splits daily compound release announcements into separate, clean, individually selectable updates.
3. **Smart Tweet Composer**:
   - Automatically drafts text with category-specific emojis (🚀 Features, ⚠️ Issues, 🚫 Deprecations, 🔄 Changes).
   - Correctly calculates character budgets accounting for Twitter's **23-character t.co wrap standard** for external URLs.
   - Truncates descriptions if they exceed the 280-character limit.
   - Interactive SVG progress ring that changes color (teal ➔ yellow ➔ red) as character limits are approached.
4. **Interactive Filters & Search**: Search updates by keywords, and filter cards dynamically using category badges.
5. **Polished UI**: Glassmorphic panels, neon glow highlights, hover interactions, and pulsing status dots.

---

## 🚀 Getting Started

### 1. Set Up Environment
Ensure you have Python 3 installed. Navigate to the project root and create/activate the virtual environment:
```bash
# Create virtual environment
python3 -m venv .venv

# Activate on macOS/Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt # or manually: pip install flask requests feedparser
```

### 2. Run the Server
Launch the Flask development server:
```bash
python app.py
```

### 3. Open the App
Navigate to:
👉 **[http://localhost:5001](http://localhost:5001)**

---

## 📂 Project Structure
* `app.py`: Flask backend, API endpoints, and caching middleware.
* `templates/index.html`: Main interface HTML layout.
* `static/css/style.css`: Stylesheet implementing dark-mode styling, grid layout, animations, and typography.
* `static/js/app.js`: State manager, RSS Parser, filter engine, and character progress circle.
* `.gitignore`: Git configuration to keep your repository clean of cache/virtual env files.
