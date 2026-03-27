#!/usr/bin/env python3
"""
Render article poster: inject JSON data into HTML template, screenshot to PNG.

Usage:
  python3 render.py --data poster_data.json --output poster.png --ratio 3:4
  python3 render.py --data poster_data.json --output poster.png --ratio 4:3
  python3 render.py --data poster_data.json --output poster.png --ratio 9:16
"""

import argparse
import json
import os
import sys
from pathlib import Path

RATIO_SIZES = {
    "narrow":  (1080, None),  # 窄版，高度自适应
    "medium":  (1200, None),  # 中等宽度，高度自适应
    "wide":    (1600, None),  # 宽版，高度自适应
}

def main():
    parser = argparse.ArgumentParser(description="Render article poster to PNG")
    parser.add_argument("--data", required=True, help="Path to poster_data.json")
    parser.add_argument("--output", required=True, help="Output PNG path")
    parser.add_argument("--ratio", default="medium", choices=RATIO_SIZES.keys(), help="Width preset (height auto-adjusts)")
    parser.add_argument("--template", default=None, help="Path to template.html (auto-detected)")
    args = parser.parse_args()

    # Find template
    if args.template:
        template_path = Path(args.template)
    else:
        # Look relative to this script
        script_dir = Path(__file__).parent
        template_path = script_dir / "template.html"
        if not template_path.exists():
            # Fallback: look in common skill locations
            for p in [
                Path("/mnt/skills/user/article-poster/template.html"),
                Path("/home/claude/article-poster/template.html"),
            ]:
                if p.exists():
                    template_path = p
                    break

    if not template_path.exists():
        print(f"ERROR: Template not found at {template_path}", file=sys.stderr)
        sys.exit(1)

    # Read data
    with open(args.data, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Read template
    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    # Inject JSON data
    json_str = json.dumps(data, ensure_ascii=False)
    html = html.replace("__POSTER_DATA__", json_str)

    # Fix relative path resolution: inject <base> tag so that assets like
    # logo.png resolve relative to the template directory, not the output
    # directory where the temp HTML file is written.
    base_href = template_path.parent.resolve().as_uri() + "/"
    html = html.replace("<head>", f"<head>\n<base href=\"{base_href}\">", 1)

    # Write temp HTML
    tmp_html = Path(args.output).with_suffix(".tmp.html")
    with open(tmp_html, "w", encoding="utf-8") as f:
        f.write(html)

    # Screenshot with Playwright
    width, _ = RATIO_SIZES[args.ratio]

    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": width, "height": 800})
            page.goto(f"file://{tmp_html.resolve()}", wait_until="networkidle")

            # Wait for fonts to load
            page.wait_for_timeout(1500)

            # Get actual content height
            content_height = page.evaluate("document.getElementById('poster').scrollHeight + 40")

            # Set viewport to content size
            page.set_viewport_size({"width": width, "height": content_height})
            page.wait_for_timeout(300)

            page.screenshot(path=args.output, full_page=False, type="png")
            browser.close()

        print(f"OK: {args.output} ({width}x{content_height})")

    finally:
        # Clean up temp file
        if tmp_html.exists():
            tmp_html.unlink()

if __name__ == "__main__":
    main()
