---
name: pulse
description: >
  📡 Pulse — Henry's twice-daily briefing.
  Designed to be triggered by cronjob at morning and evening, or manually.
  Use this skill only when the user says "pulse" or "/pulse".
---

# 📡 Pulse

A comprehensive twice-daily briefing combining product launches, open-source trends, curated news, and weather forecasts. Designed to run at morning and evening, but can also be triggered manually at any time.

## Locale

The final output should be in the user's preferred language which is `zh-CN` simplified Chinese.

## Workflow Overview

Execute the following steps in order. Use parallel `web_search` / `web_fetch` calls wherever possible to minimize latency.

---

### Step 1: Determine Date & Time Context

1. Note today's date and current time.
2. Determine if this is a **morning** (before 14:00) or **evening** (14:00+) run — this affects the emoji in the header:
   - Morning → 🌅
   - Evening → 🌆
3. Determine the day of the week — needed for Nanjing weekend weather.
4. Product Hunt launches happen Mon–Fri (Pacific Time). If today is Saturday/Sunday, use the most recent Friday's leaderboard and note this.

---

### Step 2: Fetch Product Hunt Data (AI-focused, Top 3–5)

Goal: Get the **top 3–5 AI-related products** from today's Product Hunt leaderboard.

1. `web_fetch` on the `https://www.producthunt.com/feed` (M and D are without leading zeros) URL.
2. From the leaderboard, pick the **top 3–5 products that are AI-related** (AI tools, LLM wrappers, ML infra, AI agents, AIGC, etc.). If fewer than 3 AI products exist on the leaderboard, include the top overall products to fill the gap, noting they are non-AI.
3. For each product, collect:
   - Product name
   - One-line tagline
   - Upvote count (if available)
   - Direct link to the product page: `https://www.producthunt.com/posts/{slug}`
4. Write a brief personal note (1 sentence) on why it matters or what's interesting.

---

### Step 3: Fetch GitHub Trending Data (Top 5)

Goal: Get the **top 5 repositories** from GitHub Trending (daily, default language filter).

1. `web_fetch` on `https://github.com/trending?since=daily`.
2. Extract the **top 5** repos with:
   - Full name (`owner/repo`)
   - Description
   - Primary language
   - Total stars
   - Stars gained today
3. Links: `https://github.com/{owner}/{repo}`
4. Add a brief note on relevance to the user's interests (AI agents, TypeScript, Python, LangChain, medical tech, etc.) if applicable.

---

### Step 4: Fetch & Curate News and Podcasts

This is the most editorial step. Gather news from multiple sources, then apply strict curation rules.

#### 4a: Google News — Breaking / Must-Know Stories

1. `web_fetch` on `https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
2. Scan for **major domestic and international events** that a tech professional in China should know about. Think: geopolitical shifts, major policy changes, natural disasters, significant economic events, landmark tech regulations.
3. Only include stories that are genuinely significant — skip routine political coverage and soft news.

#### 4b: Alibaba & ByteDance Corporate News

1. `web_search` for `阿里巴巴 新闻 today {YYYY-MM-DD}` or similar time-scoped query.
2. `web_search` for `字节跳动 新闻 today {YYYY-MM-DD}` or similar time-scoped query.
3. Look for: earnings reports, major product launches, leadership changes, regulatory actions, acquisitions, layoffs, stock-moving events.
4. If nothing material, skip this sub-section entirely — do NOT pad with trivial news.

#### 4c: AI Health News

1. `web_search` for `AI coding news today` and `AI healthcare latest` in English.
2. Look for: new FDA approvals for AI medical devices, major research breakthroughs (e.g., new foundation models for clinical data), notable funding rounds in digital health AI, regulatory developments.

#### 4d: Curation Rules (MUST follow)

Before finalizing the news list, apply these filters strictly:

- **Timeliness**: The event MUST have happened today or be about to happen imminently. Do not include stories from yesterday or earlier unless they broke overnight and are still developing.
- **Significance**: Would the user want to be interrupted to learn about this? If not, skip it.
- **Deduplication**: Check against the user's recent Pulse outputs (use `conversation_search` with keyword "Pulse" to find recent briefings). Do NOT include a story that appeared in a recent Pulse. If unsure, include it but note it as a developing story.
- **Result**: Aim for **3–8 news items total** across all sub-categories. Fewer is better than padding.

#### 4e: Fetch Podcasts

1. `web_fetch` the following podcasts to see if there are any updates:
   - [硅谷101](https://www.xiaoyuzhoufm.com/podcast/5e5c52c9418a84a04625e6cc)
   - [罗永浩的十字路口](https://www.xiaoyuzhoufm.com/podcast/68981df29e7bcd326eb91d88)
   - [十字路口 Crossing](https://www.xiaoyuzhoufm.com/podcast/60502e253c92d4f62c2a9577)
   - [晚点聊](https://www.xiaoyuzhoufm.com/podcast/61933ace1b4320461e91fd55)
   - [锦供参考](https://www.xiaoyuzhoufm.com/podcast/69a6aba3de6dd3793a39e06b)
   - [elsewhere别处发生](https://www.xiaoyuzhoufm.com/podcast/68ff657d9c745a6e69da8fcf)

2. Only select the podcasts which updated in the last 48 hours.

---

### Step 5: Fetch Weather Data

Fetch the following 3 cities' weather.

For `CITY_ID`:
- 北京: https://wttr.in/Beijing?format=j1
- 上海: https://wttr.in/Shanghai?format=j1
- 南京: https://wttr.in/Nanjing?format=j1

#### What to report per day:
- Weather type with emoji (☀️ 晴, ⛅ 多云, 🌧️ 小雨, 🌧️🌧️ 大雨, ❄️ 小雪, 🌨️ 暴雪, 🌫️ 雾, ⛈️ 雷阵雨, etc.)
- High / Low temperature in °C

### Format
- Use list but not table.

---

### Step 6: Check for Deduplication Against Recent Pulses

Before assembling the final output:

1. Use `conversation_search` with query `Pulse` to retrieve recent Pulse briefings.
2. Compare the news items you've gathered against those recent outputs.
3. Remove any duplicate stories. If a story is a meaningful UPDATE to a previous story, include it with a note like "🔄 进展更新".

---

### Step 7: Assemble Output

Use the following template. All section titles and product/repo/news names MUST be hyperlinked directly — no separate "sources" section.

Language: Chinese (full-width punctuation: ，、：！？。）for prose; English for product names, repo names, and technical terms.

```markdown
# 📡 Pulse | {🌅 or 🌆} — {YYYY年M月D日}

## Product Hunts

- **[Product Name](https://www.producthunt.com/posts/slug)** {upvotes if available}
简短介绍与点评（简体中文）。

- **[Product Name](URL)**
...

(5-10 items)

---

## GitHub Trending

- **[owner/repo](https://github.com/owner/repo)** ⭐ {total stars} (+{today})
Description。{Language}。简短点评（简体中文）。

- **[owner/repo](URL)** ⭐ ...
...

(5 items)

---

## News

- **[Headline](URL)**
1–2 sentence summary（简体中文）。

- **[Headline](URL)**
...

(3–8 items, or fewer if it's a quiet day)

---

## Podcasts (If exists updates)

- **[Podcast Name](URL)**
简短介绍与点评（简体中文）。

- **[Podcast Name](URL)**
...

(1-3 items)
---

## Weather

**🧱 北京**
- 今天：{emoji} {type}，{low}°C ~ {high}°C
- 明天：{emoji} {type}，{low}°C ~ {high}°C

**🏙️ 上海（徐汇）**
- 今天：{emoji} {type}，{low}°C ~ {high}°C
- 明天：{emoji} {type}，{low}°C ~ {high}°C

**🌿 南京**
- 今天：{emoji} {type}，{low}°C ~ {high}°C
- 明天：{emoji} {type}，{low}°C ~ {high}°C
```

### Formatting Rules

- **Headings**: Use `#` for top-level, `##` for sections, and list for individual items. This maps well to Feishu / Word export.
- **Links**: Every product, repo, and news headline MUST be a clickable link in the `###` heading itself. Never put URLs in a footnote or "sources" block.
- **Weather emojis**: Use appropriate weather emojis inline with the weather type.
- **Brevity**: Each item's commentary should be 1–2 sentences max. The entire Pulse should be scannable in under 2 minutes.
- **No filler**: If a section has nothing noteworthy, include a one-liner like "今天暂无重大新闻" rather than padding.
- **Chinese punctuation**: All Chinese prose uses full-width punctuation (，。：！？、）。
- **Do NOT use citations or `` tags**: Pulse is a briefing, not a research report. Source attribution is handled by the hyperlinks in headings.
- **No duplication**: Do not include the same news item in the same day.
