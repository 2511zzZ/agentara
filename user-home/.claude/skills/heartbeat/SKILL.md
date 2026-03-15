---
name: heartbeat
description: Proactive intelligence pulse — scans user's memory files (USER.md, SOUL.md) to identify current interests, investments, projects, and concerns, then performs targeted web searches to find noteworthy updates. Returns a concise briefing if something deserves attention, or `[SKIPPED]` if nothing warrants interruption. Use this skill when the system needs to check if there's anything worth proactively notifying the user about — like a scheduled heartbeat check, a "what's new" sweep, or when the user asks "anything I should know?", "what did I miss?", or "any updates?". Also triggers on requests like "check my interests", "scan for news", "morning briefing", or "pulse check".
---

# Heartbeat — Proactive Intelligence Pulse

You are performing a heartbeat check: scanning the user's world for things that matter to them right now, and deciding whether any of it is worth their attention.

## Philosophy

The user's time and attention are sacred. A heartbeat that cries wolf is worse than no heartbeat at all. Only surface information that is **actionable, time-sensitive, or significantly changes the user's understanding** of something they care about. When in doubt, return `[SKIPPED]`.

## Step 1: Read Memory

Read the user's memory files to build a profile of current interests and concerns:

Extract a prioritized list of **watchlist topics**. Typical categories:

| Category | Examples | Alert Threshold |
|----------|---------|-----------------|
| **Investments** | Stock positions, crypto holdings | Price moves >5% in a day, major company news (earnings, lawsuits, leadership changes), analyst upgrades/downgrades |
| **Current project** | Active codebase, architecture decisions | Major version releases of key dependencies, breaking changes, security vulnerabilities |
| **Career/Industry** | Employer news, role-relevant trends | Company announcements, industry shifts directly affecting the user's role |
| **Tech stack** | Frameworks, tools, languages used daily | New major releases, deprecation notices, critical CVEs |
| **Upcoming events** | Travel plans, deadlines | Weather alerts, schedule changes, booking reminders within 7 days |
| **Personal interests** | Photography gear, anime, content creation | Notable releases or events only (not routine content) |

## Step 2: Read News

Read the latest news from the following sources:
- [Hacker News](https://hnrss.org/newest)
- [Product Hunt](https://www.producthunt.com/feed)
- [Google News](https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans)

Find the most relevant news for the user's profile and watchlist topics.

## Step 3: Search

For each high-priority watchlist topic (aim for 3-5 topics, no more than 8), perform a focused web search. Use queries that are specific enough to surface real news, not evergreen content.

Good search patterns:
- `"BABA stock" today` — catches daily movers
- `"LangChain" release 2026` — catches recent releases
- `"ByteDance" news this week` — catches employer news
- `"Claude" OR "Anthropic" announcement` — catches AI tooling updates

Skip topics where nothing meaningful could have changed since the last check (e.g., stable personal preferences, unchanging habits).

## Step 4: Evaluate — The "Worth Interrupting" Test

For each finding, apply this filter:

1. **Is it today's news?** (not something the user already knows from memory or the previous briefing)
2. **Is it actionable or time-sensitive?** (the user should do something, or the window to act is closing)
3. **Does it meaningfully change the picture?** (not incremental noise, but a real shift)

A finding must pass at least 2 of 3 to be included.

### Examples of WORTH reporting:
- BABA drops 8% on earnings miss → actionable + time-sensitive
- LangChain 2.0 released with breaking changes → new + changes the picture
- ByteDance announces major restructuring → new + actionable + changes the picture
- Claude releases new model with relevant capabilities → new + changes the picture
- Severe weather warning for upcoming travel destination → time-sensitive + actionable

### Examples of NOT worth reporting:
- BABA moves 0.3% on a random Tuesday → noise
- A blog post about "10 tips for street photography" → not new or actionable
- Minor patch release of a dependency → incremental
- General AI industry commentary → not specific enough

## Step 5: Output

### If noteworthy findings exist:

Return a concise briefing in the user's preferred language (Chinese primary, English for tech terms). Format:

```
📡 Heartbeat | {date}

{emoji} **[{Topic}]({URL})**
{1-2 sentence summary of what happened and why it matters}
{Optional: suggested action}

{emoji} **[{Topic}]({URL})**
...

---
Sources: {URLs}
```

Keep it to 5 items max. Ruthlessly prioritize. The user should be able to read the entire briefing in under 60 seconds.

Emoji guide: 📈📉 for markets, 🔧 for tech/tools, 🏢 for career/employer, ⚠️ for alerts, 📸 for creative interests, 🗓️ for schedule/travel.

### If nothing noteworthy:

Return exactly (without "```"):

```
[SKIPPED]
```

No explanation, no "I checked and found nothing interesting." Just `[SKIPPED]`. The system calling this skill knows what that means.

## Important Notes

- This skill is designed to be called programmatically (e.g., by a scheduler, cron job, or another agent). Keep output machine-parseable: either a formatted briefing or `[SKIPPED]`. If the briefing is similar to the previous one, or nothing new/interesting/important is found, also return `[SKIPPED]`.
- Err heavily on the side of `[SKIPPED]`. A heartbeat that returns noise trains the user to ignore it.
- The search step should be fast — don't do deep research. Quick web searches only. If something looks interesting but needs deep investigation, mention it briefly and suggest the user use `deep-research` to dig in.
- Respect the user's time of day if known. Financial news matters more during market hours. Tech releases matter more during work hours.
