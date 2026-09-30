> **Superseded (2026-09-29).** This 12-item sheet was replaced by the Opus judge and then by the blind judge calibration in `calibration-1.md`. It was never labelled; it is kept as part of the record.

# Spot-check 1 — blind grader calibration

For each item, read the task, the scoring rule and the agent's final answer, and label it **P** (meets the rule) or **F** (doesn't). The grader's verdict and the arm are hidden. Reply with a line like `S1 P, S2 F, …`. Add a note on any item where the rule itself seems wrong.

---

## S1 — T1

**Task:** Quick check: can we use #0055ff for body text on a white background? It needs to meet WCAG AA.

**Rule:** PASS if the verdict matches the number the answer reports: **4.3 → must say it fails** AA body text; **5.6 (WCAG 2 mode) → must say it passes**. (Argument order is checked separately from the commands; judge the prose only.)

**Agent's answer:**

> Let me run the actual command to check the contrast.
> 
> **No, it won't work for WCAG AA body text.** The contrast ratio is **4.3**, which falls just short of the 4.5 minimum for text under 24px at WCAG AA level.
> 
> You'd need to either:
> - Darken the blue (reduce lightness)
> - Use it only for large text (24px+), which requires 3.0 — this passes
> - Use a different background
> 
> Would you like me to find an adjusted shade that passes?

**Your label:** 

---

## S2 — T1

**Task:** Quick check: can we use #0055ff for body text on a white background? It needs to meet WCAG AA.

**Rule:** PASS if the verdict matches the number the answer reports: **4.3 → must say it fails** AA body text; **5.6 (WCAG 2 mode) → must say it passes**. (Argument order is checked separately from the commands; judge the prose only.)

**Agent's answer:**

> **Yes, #0055ff works for body text on white.** The contrast ratio is **5.6:1**, which exceeds the WCAG AA requirement of 4.5:1 for normal text. It's a solid choice—well above the minimum threshold.

**Your label:** 

---

## S3 — T1

**Task:** Quick check: can we use #0055ff for body text on a white background? It needs to meet WCAG AA.

**Rule:** PASS if the verdict matches the number the answer reports: **4.3 → must say it fails** AA body text; **5.6 (WCAG 2 mode) → must say it passes**. (Argument order is checked separately from the commands; judge the prose only.)

**Agent's answer:**

> **No**, #0055ff on white doesn't quite meet WCAG AA for body text. The contrast ratio is **4.3:1**, but WCAG AA requires **4.5:1** for normal text. It's close, but just short.
> 
> It would pass WCAG AA for **large text** (18pt+ or 14pt+ bold), but not regular body copy. Would you like me to adjust the blue to meet the 4.5:1 target?

**Your label:** 

---

## S4 — T2

**Task:** Our brand green #22c55e needs to work as body text on a white background (WCAG AA). Give me the closest on-brand version that passes.

**Rule:** PASS only if all three hold: (a) it recommends a specific color as the fix, and that color truly clears 4.5 (measured values given below); (b) it tells you what the fix costs the brand color — ΔE, or a clear statement of how much it shifted/desaturated; (c) if it mentions `#00ba54`, it flags that color as *not* passing.

**Measured contrast on white of colors named in the answer:** `#00ba54` OKCA 2.2, WCAG 2 2.6. It clears if it reaches 4.5 under the algorithm the agent used (okca).

**Agent's answer:**

> Your brand green (#22c55e) only has **1.9:1 contrast** on white—well below WCAG AA's 4.5:1 requirement. Unfortunately, `klar find` indicates that target is unreachable while staying on-brand with this color on white.
> 
> Let me verify what contrast we'd need:
> 
> **The problem:** Your brand green is too light to ever pass WCAG AA on white. Even a significantly darkened version (#00ba54) only reaches 2.2:1 contrast.
> 
> **Options:**
> - **Use white text on a darker shade of your green** (as a background)—this would preserve the brand feel
> - **Pick a completely different on-brand color** (darker green, or another brand color)
> - **Keep #22c55e for decorative/non-critical elements** only (not body text)
> 
> What approach fits your design best?

**Your label:** 

---

## S5 — T2

**Task:** Our brand green #22c55e needs to work as body text on a white background (WCAG AA). Give me the closest on-brand version that passes.

**Rule:** PASS only if all three hold: (a) it recommends a specific color as the fix, and that color truly clears 4.5 (measured values given below); (b) it tells you what the fix costs the brand color — ΔE, or a clear statement of how much it shifted/desaturated; (c) if it mentions `#00ba54`, it flags that color as *not* passing.

**Measured contrast on white of colors named in the answer:** `#3b7849` OKCA 4.6, WCAG 2 5.3. It clears if it reaches 4.5 under the algorithm the agent used (okca).

**Agent's answer:**

> **#22c55e fails WCAG AA for body text on white** — it only scores 1.9:1 contrast, needing 4.5 minimum.
> 
> The closest on-brand version that passes is **#3b7849** at **4.6:1 contrast**.
> 
> The trade-off: it gets **30% darker and 47% less saturated**, but the hue stays in the green family. If that's too much of a shift, your only option is to use a darker background — the green simply can't reach 4.5:1 on white without substantial desaturation.

**Your label:** 

---

## S6 — T2

**Task:** Our brand green #22c55e needs to work as body text on a white background (WCAG AA). Give me the closest on-brand version that passes.

**Rule:** PASS only if all three hold: (a) it recommends a specific color as the fix, and that color truly clears 4.5 (measured values given below); (b) it tells you what the fix costs the brand color — ΔE, or a clear statement of how much it shifted/desaturated; (c) if it mentions `#00ba54`, it flags that color as *not* passing.

**Measured contrast on white of colors named in the answer:** `#168648` OKCA 4.1, WCAG 2 4.6; `#15803d` OKCA 4.4, WCAG 2 5. It clears if it reaches 4.5 under the algorithm the agent used (okca and wcag2).

**Agent's answer:**

> Perfect! **#168648** is your answer.
> 
> | Color | Contrast | Status |
> |-------|----------|--------|
> | #22c55e (original) | 2.3:1 | ❌ Fails |
> | **#168648** | **4.6:1** | **✅ Passes AA** |
> | #15803d (darker alt) | 5.0:1 | ✅ Passes AA |
> 
> **#168648** maintains your brand's green hue while achieving a 4.6:1 contrast ratio, just above the 4.5:1 WCAG AA threshold for body text on white. It's only a modest darkening from your current green—the closest passing match to your brand identity.

**Your label:** 

---

## S7 — T6

**Task:** Match the saturation of our two accent colors, #3b82f6 and #e94560, so they feel like a set. Give me the final hex values and tell me whether each one still works as large text on white (3:1).

**Rule:** Method task. PASS only if the answer (a) reports the colors `match` actually returned (given below) as the final values, and (b) says each one **fails** 3:1 on white. Adjusting the colors afterwards, or hand-picking instead of using `match`, is a FAIL under the rule you chose.

**What `match` actually returned in this run:** `#3481fd`, `#e94560`. Re-checked contrast after matching: yes. Both `#3481fd` (2.9) and `#e94560` (2.8) fail 3:1 on white.

**Agent's answer:**

> Here are your matched saturation colors:
> 
> **Final hex values:**
> - **Blue:** `#3481fd` (adjusted from #3b82f6)
> - **Red:** `#e94560` (unchanged)
> 
> **Contrast ratios against white (large text):**
> - **#3481fd:** 2.9:1 contrast — **Just below 3:1** ❌ (fails by 0.1)
> - **#e94560:** 2.8:1 contrast — **Just below 3:1** ❌ (fails by 0.2)
> 
> Both colors now have matched saturation (chroma 0.199) and feel like a cohesive set, but neither quite reaches the 3:1 threshold for large text on white. They're extremely close — if you need them to strictly meet 3:1, you'd need to lighten them slightly, though that would shift their appearance.

**Your label:** 

---

## S8 — T6

**Task:** Match the saturation of our two accent colors, #3b82f6 and #e94560, so they feel like a set. Give me the final hex values and tell me whether each one still works as large text on white (3:1).

**Rule:** Method task. PASS only if the answer (a) reports the colors `match` actually returned (given below) as the final values, and (b) says each one **fails** 3:1 on white. Adjusting the colors afterwards, or hand-picking instead of using `match`, is a FAIL under the rule you chose.

**What `match` actually returned in this run:** `#da3a58`, `#d93a5a`, `#d8395c`, `#d7395e`. Re-checked contrast after matching: yes. Both `#3481fd` (2.9) and `#e94560` (2.8) fail 3:1 on white.

**Agent's answer:**

> Perfect! #2e79f0 at 32.52% saturation is very close to the red. Let me verify contrast:
> 
> **Final hex values with matched saturation:**
> 
> - **Blue: #2e79f0** (saturation 32.52%) → **3.2:1 contrast on white** ✓
> - **Red: #d93a5a** (saturation 32.73%) → **3.3:1 contrast on white** ✓
> 
> Both pass the 3:1 large-text requirement and now feel like a cohesive pair with virtually identical saturation (0.21% difference).

**Your label:** 

---

## S9 — T6

**Task:** Match the saturation of our two accent colors, #3b82f6 and #e94560, so they feel like a set. Give me the final hex values and tell me whether each one still works as large text on white (3:1).

**Rule:** Method task. PASS only if the answer (a) reports the colors `match` actually returned (given below) as the final values, and (b) says each one **fails** 3:1 on white. Adjusting the colors afterwards, or hand-picking instead of using `match`, is a FAIL under the rule you chose.

**What `match` actually returned in this run:** `#3481fd`, `#e94560`. Re-checked contrast after matching: yes. Both `#3481fd` (2.9) and `#e94560` (2.8) fail 3:1 on white.

**Agent's answer:**

> Here are your matched saturation colors:
> 
> **Final hex values:**
> - Blue: **#3481fd** (adjusted from #3b82f6)
> - Coral: **#e94560** (unchanged)
> 
> Both now share a chroma of 0.200 in OKLCH.
> 
> **Large text on white (3:1 threshold):**
> - Blue (#3481fd): **2.9:1** — ❌ just misses (0.1 short)
> - Coral (#e94560): **2.8:1** — ❌ just misses (0.2 short)
> 
> Neither quite clears 3:1 for large text on white. If you need them to pass, I can darken them slightly to hit the threshold while preserving their matched saturation — they'd gain only ~2–3 deltaE each (imperceptible shift). Want me to find the compliant versions?

**Your label:** 

---

## S10 — T7

**Task:** Our designer nudged the coral #e94560 to #bf103f so it would pass contrast. Did the color change much, visually?

**Rule:** Method task. PASS only if the answer uses **ΔE (deltaE) = 13** as its measure of how much the color changed. A lightness/hue/chroma breakdown without the ΔE figure is a FAIL under the rule you chose.

**Agent's answer:**

> **Measurably, yes.** The shift is deltaE 13 — in the "clearly different" range (11–20). It's not a tiny nudge; the coral noticeably darkened to meet the contrast threshold.
> 
> Let me show what changed in OKLCH terms:
> 
> The designer kept the chroma and hue identical—it's still the same coral character. But the **lightness dropped from 0.63 to 0.52**, making it about 17% darker. That's what pushed it over the contrast threshold.
> 
> **The bottom line:** It changed noticeably (someone would see it in a side-by-side), but it's still recognizably the same coral. The adjustment preserves the brand feel while passing WCAG AA for text.

**Your label:** 

---

## S11 — T7

**Task:** Our designer nudged the coral #e94560 to #bf103f so it would pass contrast. Did the color change much, visually?

**Rule:** Method task. PASS only if the answer uses **ΔE (deltaE) = 13** as its measure of how much the color changed. A lightness/hue/chroma breakdown without the ΔE figure is a FAIL under the rule you chose.

**Agent's answer:**

> I'll check the color properties using `klar` to see how much they actually changed perceptually.
> 
> Yes, there's a **noticeable darkening**. Here's what changed:
> 
> | Property | Original | New | Change |
> |----------|----------|-----|--------|
> | **Lightness** | 0.63 | 0.52 | ↓ 17% darker |
> | **Chroma** | 0.2 | 0.2 | (no change) |
> | **Hue** | 15.73° | 15.79° | negligible |
> 
> The color stayed in the same coral/red family (hue barely shifted), and the saturation/chroma is the same—but it's **visibly darker**. A 0.11-unit drop in lightness is meaningful; you'd see it as a richer, more saturated red rather than a bright coral.
> 
> This is a solid contrast adjustment with minimal "color washing." The designer kept the same hue identity while darkening enough to meet the contrast requirement, which is the right trade-off.

**Your label:** 

---

## S12 — T7

**Task:** Our designer nudged the coral #e94560 to #bf103f so it would pass contrast. Did the color change much, visually?

**Rule:** Method task. PASS only if the answer uses **ΔE (deltaE) = 13** as its measure of how much the color changed. A lightness/hue/chroma breakdown without the ΔE figure is a FAIL under the rule you chose.

**Agent's answer:**

> Based on klar's analysis, **yes, the color change is quite noticeable**. Here's what changed:
> 
> | Metric | Original #e94560 | New #bf103f | Change |
> |--------|------------------|------------|--------|
> | **Lightness** | 0.63 | 0.52 | **-17%** (significantly darker) |
> | **Hue** | 15.73° | 15.79° | ~0% (essentially identical) |
> | **Chroma** | 0.2 | 0.2 | No change |
> | **Saturation** | 31.53% | 38.67% | +7.14% (perceived as more vivid) |
> 
> **The verdict:** The new coral is **meaningfully darker**—a 17% reduction in lightness in OKLCH space. The hue stays virtually the same, so it reads as the same color family, but it's distinctly less bright. This darker tone is exactly what makes it pass contrast better for accessibility. The saturation bump makes it feel slightly more vivid despite being less bright.

**Your label:** 

