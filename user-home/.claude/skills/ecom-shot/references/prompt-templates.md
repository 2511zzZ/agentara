# Prompt Templates Reference

Scene-specific templates and photography parameters for Nano Banana Pro e-commerce product photography.

## Resolution Map

| Aspect Ratio | 2K Resolution | Notes |
|---|---|---|
| 1:1 | 2048 × 2048 | Amazon, Taobao, Shopify main image |
| 4:3 | 2048 × 1536 | Horizontal product display |
| 3:4 | 1536 × 2048 | Xiaohongshu, vertical display |
| 16:9 | 2048 × 1152 | Banner, hero section |

## Scene Templates

### White Background Hero Shot (纯白底主图)

Best for: Amazon main image, Taobao/Tmall main image, Shopify product page.

**Template:**

```
Using the provided reference image as the product source, create an ultra-realistic studio product photograph of {SUBJECT_DESCRIPTION}. The product must be isolated on a pure white seamless background (RGB 255, 255, 255).

The product is positioned at a {ANGLE} angle, centered in the frame, filling approximately 85-90% of the composition. Shot with an {FOCAL_LENGTH} prime lens at {APERTURE}, ISO 100, achieving razor-sharp focus across the entire product with a {DEPTH_OF_FIELD} depth of field.

Lighting: {LIGHTING_SETUP}. The lighting produces a gentle, natural contact shadow directly beneath the product for grounding, with no harsh shadows or distracting reflections.

The product's original colors, textures, materials, and all distinguishing design details from the reference image are preserved with absolute fidelity. Every surface — {MATERIAL_DETAILS} — is rendered with photorealistic accuracy.

No text, no watermarks, no logos overlays, no props, no human hands, no packaging unless the packaging IS the product. Clean, professional, e-commerce ready.

{ASPECT_RATIO} aspect ratio, {RESOLUTION} resolution.
```

**Lighting presets by product type:**

- **Hard/reflective surfaces** (watches, jewelry, electronics): "High-key three-point lighting with a large overhead softbox as key light at 45 degrees, a fill card on the opposite side reducing shadows to a 2:1 ratio, and a subtle rim light from behind to define edges and separate the product from the background"
- **Soft/fabric products** (clothing, bags, pillows): "Diffused light tent setup with even, wrap-around illumination from large softboxes on both sides, eliminating harsh shadows while preserving fabric texture and weave detail"
- **Glossy/transparent** (bottles, glass, cosmetics): "Dual strip softbox setup flanking the product to create elegant edge highlights, with a white bounce card underneath for clean fill, carefully controlling specular highlights"
- **Matte/organic** (food, wood, ceramic): "Soft overhead diffused lighting with a slight directional key from the upper left at 30 degrees, creating subtle dimensional shadows that reveal surface texture"

**Camera presets by product type:**

- **Small/detailed** (jewelry, watches, small electronics): 100mm macro, f/11, emphasize fine detail
- **Medium** (bottles, shoes, gadgets): 85mm, f/8, balanced sharpness
- **Large/clothing** (folded garments, bags): 50mm, f/8, wider perspective
- **Default**: 85mm prime, f/8

**Angle presets:**

- **Watches/jewelry**: Straight-on front face or 3/4 angle showing the dial
- **Shoes/sneakers**: 3/4 angle showing both the side profile and toe
- **Electronics**: 3/4 angle showing the main interface/screen
- **Bottles/cosmetics**: Straight-on or slight 15-degree angle
- **Clothing (folded)**: Top-down flat lay or 30-degree angled view
- **Default**: Slightly elevated 3/4 view

---

### Lifestyle Shot (生活场景图)

Best for: Secondary listing images, social media, brand storytelling.

**Template:**

```
Using the provided reference image as the product source, create a photorealistic lifestyle photograph featuring {SUBJECT_DESCRIPTION} in a {SCENE_SETTING}.

The {PRODUCT} is the clear hero of the image, positioned {PLACEMENT} with complementary props that enhance but never compete with the product: {PROPS_DESCRIPTION}. The scene tells a story of {LIFESTYLE_NARRATIVE}.

Shot on a {FOCAL_LENGTH} lens at {APERTURE} creating a {DEPTH_OF_FIELD} — the product is in tack-sharp focus while the background falls into a pleasing, creamy bokeh. {LIGHTING_DESCRIPTION}.

The color palette is {COLOR_MOOD}, with {COLOR_TEMPERATURE} color temperature. The product's authentic appearance from the reference — colors, materials, design details — is preserved perfectly within this new context.

No text, no watermarks, no artificial-looking placement. The product should feel naturally integrated into the scene, as if photographed in situ by a professional lifestyle photographer.

{ASPECT_RATIO} aspect ratio, {RESOLUTION} resolution.
```

**Scene suggestions by product type:**

- **Watches**: On a leather-bound journal on a dark wood desk, morning light streaming through a window
- **Electronics/gadgets**: Clean minimalist desk setup, warm task lighting, modern workspace
- **Cosmetics/skincare**: Marble vanity surface with soft morning light, fresh flowers nearby
- **Food/beverage**: Rustic wooden table, natural window light, complementary ingredients scattered artfully
- **Shoes/sneakers**: Urban sidewalk or park path, golden hour lighting
- **Home goods**: Styled living room vignette with plants and natural textures
- **Bags/accessories**: Coffee shop table or travel-inspired flat lay

**Lighting for lifestyle:**
- Primary: Natural window light (specify direction: left, right, behind)
- Style: "Warm, natural daylight streaming from the left side, creating soft directional shadows"
- Backup: "Soft ambient interior lighting with warm color temperature (3200K)"

---

### Creative Atmosphere (创意氛围图)

Best for: Brand campaigns, social media key visuals, premium product launches.

**Template:**

```
Using the provided reference image as the product source, create a dramatic, visually striking commercial photograph of {SUBJECT_DESCRIPTION} that conveys {BRAND_MOOD}.

The product is {COMPOSITION_DESCRIPTION}. The environment is {ENVIRONMENT_DESCRIPTION}, creating an immersive atmosphere that elevates the product to aspirational status.

Cinematic lighting: {DRAMATIC_LIGHTING}. The interplay of light and shadow creates depth, mystery, and visual intrigue while keeping the product fully visible and recognizable.

Shot with a {FOCAL_LENGTH} lens at {APERTURE}, {SPECIAL_EFFECTS}. Color grade: {COLOR_GRADE}. The overall mood is {MOOD_KEYWORDS}.

The product from the reference image is rendered with complete accuracy — every design detail, material finish, and color is faithfully preserved, even within this stylized context.

No text overlays, no watermarks. The image should feel like a high-end magazine advertisement or a luxury brand campaign visual.

{ASPECT_RATIO} aspect ratio, {RESOLUTION} resolution.
```

**Mood presets:**

- **Luxury/Premium**: "Dark, moody atmosphere with selective lighting. Deep blacks, gold/warm accent tones. Shot with a 85mm at f/2.8, with dramatic chiaroscuro lighting — a single focused spotlight from above creating a pool of light on the product against a dark gradient background."
- **Tech/Futuristic**: "Clean, futuristic environment with cool blue-white ambient glow. The product sits on a reflective dark surface with subtle neon edge lighting. Geometric light patterns in the background. Cool color grade with teal and silver tones."
- **Natural/Organic**: "Earthy, warm atmosphere surrounded by natural elements — stone, moss, warm wood, water droplets. Soft golden light filtering through as if in a forest clearing. Rich, warm color palette with greens and ambers."
- **Minimalist/Editorial**: "Ultra-clean composition with bold negative space. Single bold color background. Hard, graphic shadows from sharp directional light. High contrast, editorial fashion-photography style."
- **Playful/Pop**: "Vibrant, saturated colors with dynamic composition. Bold colored background with geometric shapes or paint splashes. High-key lighting with punchy contrast. Energetic, youthful, eye-catching."

---

## Product Description Templates

When describing the subject, be precise about:

1. **What it is**: "A round-dial mechanical wristwatch with a stainless steel case and brown leather strap"
2. **Material/finish**: "brushed stainless steel with a polished bezel, sapphire crystal glass"
3. **Color**: "deep navy blue dial with silver hour markers and luminous hands"
4. **Size context**: "medium-sized, approximately 40mm case diameter" (helps AI understand scale)
5. **Key features**: "visible crown at 3 o'clock, date window at 6 o'clock, exhibition caseback"

Bad: "a watch"
Good: "A classic round-dial automatic mechanical wristwatch with a 40mm brushed stainless steel case, deep navy blue sunburst dial featuring applied silver hour markers and dauphine hands, paired with a hand-stitched saddle brown leather strap"

## Iteration Guidance

After the first generation, suggest these multi-turn edits to the user:

- **Lighting adjustment**: "Make the key light more dramatic with deeper shadows on the left side"
- **Background tweak**: "Change the background to a slightly warm off-white"
- **Angle change**: "Rotate the product 15 degrees to show more of the side profile"
- **Detail enhancement**: "Increase the visibility of the texture on the leather strap"
- **Color correction**: "Make the metal tones cooler and more silver, less warm"

These conversational edits leverage Nano Banana Pro's strength in multi-turn refinement — don't regenerate from scratch when 80% of the image is already right.
