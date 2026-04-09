# /// script
# requires-python = ">=3.10"
# dependencies = ["ddgs"]
# ///
"""
Web Search Tool - Search the web using DuckDuckGo (no API key required).
"""

import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

PULSE_SEARCH_LABELS = (
    "阿里巴巴 Today",
    "字节跳动 Today",
    "AI News Today",
    "AI Coding Today",
)


def _pulse_query_dates(now: datetime | None = None) -> tuple[str, str, str]:
    """Build date fragments for pulse queries: (zh_ymd, en_month_day_year, en_month_year)."""
    if now is None:
        now = datetime.now(ZoneInfo("Asia/Shanghai"))
    elif now.tzinfo is None:
        now = now.replace(tzinfo=ZoneInfo("Asia/Shanghai"))
    zh = f"{now.year}年{now.month}月{now.day}日"
    months = (
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    )
    en_full = f"{months[now.month - 1]} {now.day} {now.year}"
    en_month_year = f"{months[now.month - 1]} {now.year}"
    return zh, en_full, en_month_year


def _normalize_hits(raw: list[dict]) -> list[dict]:
    return [
        {
            "title": r.get("title", ""),
            "url": r.get("href", r.get("link", "")),
            "content": r.get("body", r.get("snippet", "")),
        }
        for r in raw
    ]


def fetch_pulse_searches_sync(
    max_results: int = 8,
    now: datetime | None = None,
) -> dict[str, list[dict]]:
    """
    Run the four fixed Pulse web searches (DuckDuckGo). Blocking; run in a thread pool.

    Queries (conceptually):
    - 阿里巴巴 新闻 {YYYY年M月D日}
    - 字节跳动 新闻 {YYYY年M月D日}
    - AI news {Month D YYYY}
    - AI coding tools news {Month YYYY}
    """
    zh, en_full, en_month_year = _pulse_query_dates(now)
    specs: list[tuple[str, str]] = [
        ("阿里巴巴 Today", f"阿里巴巴 新闻 {zh}"),
        ("字节跳动 Today", f"字节跳动 新闻 {zh}"),
        ("AI News Today", f"AI news {en_full}"),
        ("AI Coding Today", f"AI coding tools news {en_month_year}"),
    ]
    out: dict[str, list[dict]] = {}
    for label, query in specs:
        raw = _search_text(query, max_results=max_results)
        out[label] = _normalize_hits(raw)
    return out


def empty_pulse_searches() -> dict[str, list]:
    return {label: [] for label in PULSE_SEARCH_LABELS}


def _search_text(
    query: str,
    max_results: int = 5,
    region: str = "wt-wt",
    safesearch: str = "moderate",
) -> list[dict]:
    """
    Execute text search using DuckDuckGo.

    Args:
        query: Search keywords
        max_results: Maximum number of results
        region: Search region
        safesearch: Safe search level

    Returns:
        List of search results
    """
    try:
        from ddgs import DDGS
    except ImportError:
        logger.error("ddgs library not installed. Run: pip install ddgs")
        return []

    ddgs = DDGS(timeout=30)

    try:
        results = ddgs.text(
            query,
            region=region,
            safesearch=safesearch,
            max_results=max_results,
        )
        return list(results) if results else []

    except Exception as e:
        logger.error(f"Failed to search web: {e}")
        return []


def web_search_tool(
    query: str,
    max_results: int = 8,
) -> str:
    """Search the web for information. Use this tool to find current information, news, articles, and facts from the internet.

    Args:
        query: Search keywords describing what you want to find. Be specific for better results.
        max_results: Maximum number of results to return. Default is 5.
    """

    results = _search_text(
        query=query,
        max_results=max_results,
    )

    if not results:
        return json.dumps(
            {"error": "No results found", "query": query}, ensure_ascii=False
        )

    normalized_results = _normalize_hits(results)

    output = {
        "query": query,
        "total_results": len(normalized_results),
        "results": normalized_results,
    }

    return json.dumps(output, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--pulse":
        print(json.dumps(fetch_pulse_searches_sync(), ensure_ascii=False, indent=2))
    else:
        print(web_search_tool("AI news 2026-04-09"))
