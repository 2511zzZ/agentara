---
name: pulse
description: >
  📡 Pulse — Twice-daily tech briefing for group distribution.
  Designed to be triggered by cronjob at morning and evening, or manually.
  Use this skill only when the user says "pulse" or "/pulse".
---

# 📡 Pulse

A comprehensive twice-daily tech briefing combining product launches, open-source trends, curated news, market indices, and weather forecasts. Designed for group distribution to a 4000+ person tech community. Runs at morning and evening, or manually.

## Locale

The final output should be in the user's preferred language which is `zh-CN` simplified Chinese.

## Workflow Overview

Execute the following steps in order. **Do NOT call `web_fetch`/`web_search` for sources that prefetch returned successfully** — use the prefetch JSON when building Step 4. **Step 2** is the only routine step that uses `web_search` (supplemental corporate and AI news). If a prefetch source’s `errors` entry is non-null, fall back to `web_fetch`/`web_search` for that source only.

---

### Step 1: Run Prefetch Script

```bash
cd .claude/skills/pulse && uv run scripts/prefetch.py
```

Returns a JSON blob with `producthunt`, `github_trending`, `google_news`, `podcasts`, `weather`, `stock`.

- **Use prefetch as-is** for Product Hunt, GitHub Trending, Google News inputs, Podcasts, Weather, and Stock in Step 4 when the corresponding payload has no error.
- If a slice fails, recover that slice only via `web_fetch`/`web_search` (same coverage prefetch would have provided).

---

### Step 2: Fetch & Curate News

**Podcasts** come from prefetch only — do not run a separate podcast search here.

Merge **`google_news`** from prefetch with supplemental items from the web searches below. Then apply curation rules (2c).

#### 2a: Alibaba & ByteDance Corporate News

1. `web_search` for `阿里巴巴 新闻 {YYYY-MM-DD}` or similar time-scoped query.
2. `web_search` for `字节跳动 新闻 {YYYY-MM-DD}` or similar time-scoped query.
3. Look for: earnings reports, major product launches, leadership changes, regulatory actions, acquisitions, layoffs, stock-moving events.
4. If nothing material, skip this sub-section entirely — do NOT pad with trivial news.

#### 2b: AI Industry News

1. `web_search` for `AI news today` and `AI coding tools latest` in English.
2. Look for: major model releases, notable funding rounds, regulatory developments, breakthrough research, significant product launches in the AI space.

#### 2c: Curation Rules (MUST follow)

Before finalizing the news list, apply these filters strictly:

- **Timeliness**: The event MUST have happened today or be about to happen imminently. Do not include stories from yesterday or earlier unless they broke overnight and are still developing.
- **Significance**: Would the reader want to be interrupted to learn about this? If not, skip it.
- **Deduplication**: Avoid repeating stories from prior Pulse issues. If a story is a meaningful update to a previous one, include it with a "🔄 进展更新" note.
- **Result**: Aim for **3–8 news items total** across all sub-categories (including merged Google News). Fewer is better than padding.

---

### Step 3: Final Deduplication

After Step 2, before assembling the final output:

1. Review all items that will appear in the **News** section (and across sections if the same story could appear twice) for duplicates.
2. Remove duplicate stories. If a story is a meaningful update to a developing event, keep one entry with a "🔄 进展更新" note.

---

### Step 4: Assemble Output

> **CRITICAL — OUTPUT STARTS WITH THE TITLE, NOTHING ELSE.**
> Your very first character of output MUST be `#`. No preamble, no status updates, no "数据已收集完毕", no "正在整理", no "以下是今日Pulse", no transition sentences of any kind. The Pulse title IS the start of your response.

Use the following template. All section titles and product/repo/news names MUST be hyperlinked directly — no separate "sources" section.

Language: Chinese (full-width punctuation: ，、：！？。）for prose; English for product names, repo names, and technical terms.

```markdown
# 📡 Pulse | {🌅 or 🌆} — {YYYY年M月D日}

## <font color="navy">🚀 Product Hunts</font>

- **[Product Name](https://www.producthunt.com/posts/slug)** {upvotes if available}
简短介绍与点评（简体中文）。

- **[Product Name](URL)**
...

(5-10 items)

---

## <font color="navy">🔥 GitHub Trending</font>

- **[owner/repo](https://github.com/owner/repo)** ⭐ {total stars} (+{today})
Description。{Language}。简短点评（简体中文）。

- **[owner/repo](URL)** ⭐ ...
...

(5 items)

---

## <font color="navy">📰 News</font>

- **[Headline](URL)**
1–2 sentence summary（简体中文）。

- **[Headline](URL)**
...

(3–8 items, or fewer if it's a quiet day)

---

## <font color="navy">🎙️ Podcasts</font> (If exists updates)

- **[Channel Name - Episode Title](episode_url)** — Podcast Name
shownotes 摘要（1-2 句简体中文重点总结）。

- **[Episode Title](episode_url)** — Podcast Name
...

(1-3 items)

---

## <font color="navy">💰 Stock Market</font>

> For each of the 4 indices in `prefetch.stock`, render the following block:

**{index_name} · {market}**

- 最新价：<font color='red/green'>**{price}**</font>
- 涨跌：{emoji} <font color='red/green'>**{chg:+.2f} / {pct:+.2f}%**</font>
- 最新交易日：{date}
> Color red if change is positive, green if negative.

![{index_name} 45-Day]({chart})
> `{chart}` must be the `chart` field from that index’s object in `prefetch.stock`. Include the chart for every index.

{if_anomaly}
⚠️ {abnormal_description}
- {news_link_list}
{/if_anomaly}

> Repeat for all 4 indices: 上证指数, 深证成指, 纳斯达克综合, 道琼斯工业

---

## <font color="navy">🌤️ Weather</font>

**🧱 北京**
- 今天：{emoji} {type}，{low}°C ~ {high}°C
- 明天：{emoji} {type}，{low}°C ~ {high}°C

**🏙️ 上海（徐汇）**
- 今天：{emoji} {type}，{low}°C ~ {high}°C
- 明天：{emoji} {type}，{low}°C ~ {high}°C

**🗼 广州**
- 今天：{emoji} {type}，{low}°C ~ {high}°C
- 明天：{emoji} {type}，{low}°C ~ {high}°C

**🌴 深圳**
- 今天：{emoji} {type}，{low}°C ~ {high}°C
- 明天：{emoji} {type}，{low}°C ~ {high}°C

**🌊 杭州**
- 今天：{emoji} {type}，{low}°C ~ {high}°C
- 明天：{emoji} {type}，{low}°C ~ {high}°C

**🌳 南京**
- 今天：{emoji} {type}，{low}°C ~ {high}°C
- 明天：{emoji} {type}，{low}°C ~ {high}°C

{综合六座城市天气，带雨伞、洗车等建议}

---

> ✨ 本 Pulse 由 [Agentara](https://github.com/MagicCube/agentara) 智能生成{if agentara_stars} | 已有 {agentara_stars} 颗 ⭐ {/if}
> 📡 [打造你的专属 Pulse](https://github.com/MagicCube/agentara)，别忘了 ⭐ Star

> **Footer rule**: If `prefetch.agentara_stars` is a number, show the star count after "智能生成". If it is `null`, omit the star count entirely — do NOT fallback to web search or web fetch.
```

### Formatting Rules

- **No preamble** ⚠️: Your response MUST start directly with `# 📡 Pulse | ...`. The `#` character must be literally the first character you output. Do NOT output any text before the title — no "数据已收集完毕", no "正在组装", no "以下是", no introductory sentences whatsoever. Violation of this rule is a critical formatting error.
- **Headings**: Use `#` for top-level, `##` for sections, and list for individual items. This maps well to Feishu / Word export.
- **Links**: Every product, repo, and news headline MUST be a Markdown list item with a bold clickable title: `- **[Title](URL)**`. Do not put URLs only in a footnote or separate "sources" block.
- **Weather emojis**: Use appropriate weather emojis inline with the weather type.
- **Brevity**: Each item's commentary should be 1–2 sentences max. The entire Pulse should be scannable in under 2 minutes.
- **No filler**: If a section has nothing noteworthy, include a one-liner like "今天暂无重大新闻" rather than padding.
- **Chinese punctuation**: All Chinese prose uses full-width punctuation (，。：！？、）。
- **Do NOT use citations or `` tags**: Pulse is a briefing, not a research report. Source attribution is handled by the hyperlinks in list items.
- **No duplication**: Do not include the same news item in the same day.
- **Stock section**: If market is closed (pre-market / weekend), note the last closing price and state "（已收盘）".
- **Include the stock chart images**: Use the `chart` field on each entry in `prefetch.stock` as the image path in `![]()` syntax (see template above).
- **No agent team or sub-agent/sub-task**: Do not apply any agent team or sub-agent/sub-task to perform this skill. This skill is a single agent.
