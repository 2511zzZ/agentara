---
name: article-poster
description: Generate a beautifully designed infographic poster from an article URL or text content. Trigger when user says "article poster", "文章海报", "infographic", "信息图", "make a poster", "生成海报", "visual summary", or requests to convert an article/blog into a shareable image. NOT for generic poster design.
---

# Article Poster

Converts an article (URL or pasted text) into a beautifully designed infographic poster image.

## How It Works

1. **Read the article** — Fetch URL via `web_fetch` or use provided text
2. **Summarize into JSON** — Output a compact JSON data structure (see schema below)
3. **Render & screenshot** — Run `render.py` which injects JSON into `template.html` and screenshots to PNG

This design minimizes token cost: the HTML/CSS template is a static asset (~0 generation tokens). You only generate the JSON content.

## Step 1: Read the Article

- If given a URL: use `web_fetch` to retrieve content
- If given textual or image content: use it directly
- Read and deeply understand the article before summarizing

## Step 2: Save Poster Data as JSON

Write the poster data to `workspace/outputs/posters/poster_data.json` using the Write tool. Do NOT generate a Python script — just write the JSON file directly.

> **IMPORTANT**: Do NOT create a `gen_poster.py` or any intermediate HTML generation script. render.py handles template injection internally. Your only job is to write `poster_data.json`.

Follow this schema **exactly**:

```json
{
  "source": "ANTHROPIC ENGINEERING",
  "category": "HARNESS DESIGN",
  "title": "Harness 设计：突破 Agent 编码前沿的关键架构",
  "subtitle": "Anthropic 用一套受 GAN 启发的多智能体架构……核心不是更聪明的单 Agent，而是如何为强模型设计正确的 harness。",
  "layout": "single",
  "sections": [
    {
      "number": 1,
      "color": "brown",
      "title": "为什么简单方案会失效？",
      "cards": [
        {
          "type": "text",
          "heading": "上下文焦虑",
          "body": "上下文一满，模型就会倾向于提前结束工作……"
        },
        {
          "type": "text",
          "heading": "自我评估偏差",
          "body": "让模型评价自己的产出时……"
        }
      ]
    },
    {
      "number": 2,
      "color": "olive",
      "title": "架构核心：生成器 / 评估器分离",
      "cards": [
        {
          "type": "highlight",
          "heading": "受 GAN 启发，但不只是`多加一个 Agent`",
          "body": "Anthropic 把`创造`与`评判`彻底解耦……"
        }
      ]
    },
    {
      "number": 4,
      "color": "teal",
      "title": "全栈开发 V1：三智能体分工",
      "cards": [
        {
          "type": "tags",
          "items": [
            { "tag": "Planner", "text": "把 1-4 句需求扩展成完整产品规格……" },
            { "tag": "Generator", "text": "按 Sprint 逐步实现……" },
            { "tag": "Evaluator", "text": "通过 Playwright 测运行中的应用……" }
          ]
        }
      ]
    },
    {
      "number": 5,
      "color": "amber",
      "title": "架构演进：从复杂到精简",
      "cards": [
        {
          "type": "compare",
          "left": { "heading": "V1：重型评估架构", "body": "单个 DAW 应用约 6 小时 / $200……" },
          "right": { "heading": "V2：Claude 4.6 后减负", "body": "去掉 Sprint、把评估器后置……" }
        }
      ]
    },
    {
      "number": 6,
      "color": "sage",
      "title": "深层方法论",
      "cards": [
        {
          "type": "bullets",
          "items": [
            "**主观质量的可操作化：** 把`这设计好吗`转成`是否符合设计原则`。",
            "**结构化产物传递：** 重置上下文时，用文件而不是对话历史传状态。",
            "**持续压力测试：** 每个组件都编码了对模型能力的假设，而这些假设会随新模型迭代失效。"
          ]
        },
        {
          "type": "callout",
          "label": "关键洞察",
          "body": "评估器是否必要，不取决于`它是不是好设计`，而取决于任务是否仍处在模型能力边界之外。"
        }
      ]
    }
  ]
}
```

### JSON Schema Rules

**`layout`** (optional) — Layout mode:
- `"single"`: Single column layout (default)
- `"double"`: Two column layout (odd sections left, even sections right)

**`sections[]`** — Any number of sections based on content needs. Each section has:
- `number`: Display number (1-based)
- `color`: One of `brown`, `olive`, `terracotta`, `teal`, `amber`, `sage`, `slate`, `rose`
- `title`: Section heading (concise, < 20 chars ideal)
- `cards[]`: Array of cards. Card types:

| type | fields | description |
|------|--------|-------------|
| `text` | `heading`, `body` | Simple card with title + paragraph |
| `highlight` | `heading`, `body` | Card with colored left border accent |
| `tags` | `items[{tag, text}]` | Labeled tag + description list (like Planner/Generator/Evaluator) |
| `compare` | `left{heading,body}`, `right{heading,body}` | Side-by-side comparison boxes |
| `bullets` | `items[]` | Bullet list (supports **bold:** prefix) |
| `callout` | `label`, `body` | Highlighted callout box with label badge |

### Content Guidelines

- **Language**: Match the user's language. Default Chinese for Chinese users.
- **Conciseness**: Each `body` should be 1-3 sentences. This is a poster, not a blog.
- **Bold keywords**: Use `**keyword**` for emphasis in body text.
- **Section count**: Use as many sections as needed to cover the content effectively (typically 3-10).
- **Layout**: Choose "single" for focused content or "double" for side-by-side comparison.
- **Chinese punctuation**: Use full-width punctuation for Chinese content (，、。：！？""）.

### Width Selection

Choose width based on layout:
- **narrow** (1080px): Single column, mobile-friendly
- **medium** (1200px): Single or double column, balanced (DEFAULT)
- **wide** (1600px): Double column, desktop-optimized

Height adjusts automatically based on content.

## Step 3: Render to PNG

Run render.py with the exact flags below — do NOT guess flags, do NOT use `--input` or `--width`:

```bash
cd /Users/henry/.agentara/workspace/outputs/posters && \
python3 /Users/henry/.agentara/.claude/skills/article-poster/render.py \
  --data poster_data.json \
  --output poster.png \
  --ratio medium
```

> **Valid flags**: `--data` (JSON file path), `--output` (PNG path), `--ratio` (narrow|medium|wide).
> **Never use**: `--input`, `--width`, `--template` unless you have a specific reason.

If Playwright is not installed, present the `poster.html` generated by render.py to the user for manual screenshot.

## Token Budget

The entire generation cost is just the JSON (~300-600 tokens). The template HTML (~8KB) and render script are static assets loaded from disk — zero generation tokens. This makes the skill extremely efficient compared to generating full HTML each time.
