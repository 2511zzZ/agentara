---
name: ecom-shot
description: >
  Generate Nano Banana Pro (Gemini 3 Pro Image) prompts for e-commerce product photography.
  Given a user-uploaded product photo, this skill identifies the main subject, asks the user
  to choose a scene type, then outputs a professional, ready-to-paste English prompt optimized
  for Nano Banana Pro's image-to-image capabilities.
  Use this skill whenever the user uploads a product image and wants to generate an e-commerce
  photo, product shot, commercial image, or marketing visual using Nano Banana Pro / Gemini.
  Trigger phrases include: "ecom shot", "电商图", "产品图", "商品图", "product photo",
  "e-commerce image", "make a product shot", "generate a Nano Banana prompt for this product",
  "帮我做一张电商主图", "白底图", "商拍", "产品摄影", "hero shot", "packshot",
  or any request involving turning a casual product photo into a professional commercial image.
  Also trigger when the user mentions Nano Banana / Gemini image generation with a product photo.
---

# Ecom Shot 📸

Generate studio-quality Nano Banana Pro prompts that turn casual product snapshots into professional e-commerce imagery.

## How It Works

This skill acts as a **Creative Director**: it analyzes the uploaded product image, identifies the subject, and crafts a detailed photography-grade prompt that Nano Banana Pro can execute with a reference image. The output is a ready-to-paste English text prompt — the user takes it to Gemini App, Google AI Studio, or any Nano Banana Pro endpoint.

## Workflow

### Step 1: Validate Input

1. Confirm the user has uploaded at least one image. If not, ask them to upload the product photo they want to transform.
2. Carefully examine the uploaded image(s). Pay attention to:
   - What is the **main product/subject**? (e.g., a mechanical watch, a ceramic mug, a pair of sneakers)
   - What is the product's **material, color, texture, key visual features**?
   - What is the **current context**? (e.g., on a messy desk, held in hand, in packaging)
   - Are there any **brand markings, logos, or distinctive design details** worth preserving?

### Step 2: Confirm Subject & Gather Preferences

Use `ask_user_input_v0` to collect the user's preferences in one go:

**Question 1 — Subject Confirmation** (single_select):
Present what you identified as the main subject and ask the user to confirm or correct.
- Options: your identified subject description, or "其他（我来描述）"

**Question 2 — Scene Type** (single_select):
- 纯白底主图（White Background Hero Shot）
- 生活场景图（Lifestyle Shot）
- 创意氛围图（Creative Atmosphere）
- 自定义场景（Let me describe）

**Question 3 — Aspect Ratio** (single_select):
- 1:1（默认，适合淘宝/Amazon）
- 4:3（横版展示）
- 3:4（竖版/小红书）
- 16:9（Banner/横幅）

### Step 3: Generate the Prompt

Read the reference file at `references/prompt-templates.md` for scene-specific templates and photography parameters, then compose the final prompt.

#### Prompt Composition Principles

Nano Banana Pro is a "Thinking" model built on Gemini 3 Pro. It understands intent, physics, and composition. The key principles:

1. **Think like a Creative Director, not tag soup.** Write in natural, descriptive English sentences — not comma-separated keyword lists. Nano Banana Pro's text encoder is an LLM that reasons about the prompt before generating.

2. **6-element structure** — Every prompt should include:
   - **Subject**: Precise description of the product with material, color, and distinguishing features
   - **Composition**: Camera angle, framing, how the product fills the frame (~85-90%)
   - **Camera & Lens**: Focal length (e.g., 85mm), aperture (e.g., f/8), ISO
   - **Lighting**: Specific setup (softbox, key light angle, fill ratio, rim light)
   - **Style**: The overall aesthetic (commercial product photography, editorial, etc.)
   - **Technical specs**: Resolution and aspect ratio

3. **Reference image directive** — Always start with a clear instruction to use the uploaded image as reference: "Using the provided reference image as the product source, ..."

4. **Negative instructions** — Include what to exclude: no text, no watermarks, no hands, no distracting elements.

5. **Resolution & Aspect Ratio** — Specify the exact output: "Generate at 2K resolution (2048×2048 for 1:1)" or the appropriate dimensions for the chosen ratio.

#### Output Format

Present the prompt in a clean code block that the user can copy directly:

```
📸 Ecom Shot — {Product Name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Scene: {scene type}
Aspect Ratio: {ratio}
Resolution: 2K

--- Prompt (copy below) ---

{the generated prompt text}

--- End Prompt ---
```

After the prompt, add a brief "💡 Tips" section with 1-2 actionable suggestions:
- How to iterate if the result isn't perfect (e.g., "If the lighting feels flat, try adding: 'with dramatic side lighting creating deep shadows'")
- Whether multi-turn editing could help (e.g., "After generating, you can ask Gemini to 'make the background slightly warmer'")

### Step 4: Iterate if Needed

If the user wants to adjust the prompt:
- For small tweaks: modify inline and re-output
- For a different scene type: go back to Step 2
- For additional variants: generate multiple prompts (e.g., white background + lifestyle pair)

## Key Rules

- **Prompts are ALWAYS in English** — Nano Banana Pro performs best with English prompts, even for Chinese-market e-commerce images
- **Analyze the actual image carefully** — Don't guess the product. Look at material, color, shape, brand details
- **Be specific about camera parameters** — Use real photography terminology (focal length, f-stop, lighting rigs)
- **Default to 1:1 at 2K** unless the user specifies otherwise
- **No text in the generated image** — E-commerce hero shots should be text-free; add text overlays separately
- **Preserve product identity** — The prompt must instruct Nano Banana to maintain the exact appearance of the product from the reference image
- Conversation and explanations should use the user's preferred language (check memory), but the prompt itself is always English
- Use Chinese full-width punctuation for Chinese conversation content
