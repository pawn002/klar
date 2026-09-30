# Judge calibration: blind human labels

For each item, read the task, the rule, the measured facts and the agent's answer, and label it **P** (meets the rule) or **F** (doesn't). Arm, grader verdict and judge verdict are hidden. Reply with one line: `C1 P, C2 F, …`. A note on any rule you think is wrong is as useful as a label.

---

## C1 (T6)

**Task:** Match the saturation of our two accent colors, #3b82f6 and #e94560, so they feel like a set. Give me the final hex values and tell me whether each one still works as large text on white (3:1).

**Rule:** Method task. PASS only if the answer (a) reports the colors `match` actually returned (given) as the final values, and (b) says each one fails 3:1 on white. Adjusting the colors afterwards, or hand-picking instead of using `match`, is a FAIL.

**Measured facts:** What `match` actually returned in this run: #3481fd, #e94560. #3481fd scores 2.9 and #e94560 scores 2.8 on white; both fail 3:1.

**Agent's answer:**

> Neither color passes 3:1 as large text on white as matched, so I'd take the adjusted pair below. Both measurements are foreground on white, in that direction.
> 
> **Matched saturation (chroma ≈ 0.199)**
> 
> | Color | Hex | Large text on white (3:1) |
> |---|---|---|
> | Blue | `#3481fd` (was `#3b82f6`, deltaE ≈ 1) | Fails, 2.9:1 |
> | Coral | `#e94560` (unchanged) | Fails, 2.8:1 |
> 
> The original blue and coral had chroma 0.19 and 0.20, so they were already close. `match` only had to move the blue, and barely. The originals fail too, at 2.9 and 2.8, so the matching didn't cause this.
> 
> **If you need them to pass 3:1**
> 
> Lowering lightness only, at the same hue and chroma, gives:
> 
> | Color | Hex | Contrast on white | Shift from matched value |
> |---|---|---|---|
> | Blue | `#2a77f2` | 3.3 | deltaE 4 |
> | Coral | `#db3655` | 3.3 | deltaE 4 |
> 
> Both shifts are small, and they're equal, so the pair still matches. I haven't changed any token files. Say the word if you want the adjusted pair applied, or the original hexes kept.

**Your label:** 

---

## C2 (T6)

**Task:** Match the saturation of our two accent colors, #3b82f6 and #e94560, so they feel like a set. Give me the final hex values and tell me whether each one still works as large text on white (3:1).

**Rule:** Method task. PASS only if the answer (a) reports the colors `match` actually returned (given) as the final values, and (b) says each one fails 3:1 on white. Adjusting the colors afterwards, or hand-picking instead of using `match`, is a FAIL.

**Measured facts:** What `match` actually returned in this run: #3481fd, #e94560. #3481fd scores 2.9 and #e94560 scores 2.8 on white; both fail 3:1.

**Agent's answer:**

> Neither accent passes 3:1 as large text on white after matching saturation. Both were already just short of 3:1 before the change.
> 
> I matched the two on OKLCH chroma with `klar match`. Both now sit at chroma ≈ 0.199, with hue and lightness unchanged.
> 
> | Color | Original | Final | Contrast on white (OKCA) | Large text (3:1) |
> |---|---|---|---|---|
> | Blue | `#3b82f6` | **`#3481fd`** | 2.9 (was 2.9) | Fails, just short |
> | Red | `#e94560` | **`#e94560`** (unchanged) | 2.8 (was 2.8) | Fails, just short |
> 
> - **Red:** its chroma of 0.199 was already the target, so only the blue moved.
> - **Contrast:** matching chroma didn't change either contrast figure.
> 
> To make either one usable as large text on white, I'd darken it slightly. `klar find` can pick the lightness that reaches 3:1 while keeping hue and chroma. Do you want me to run that and give you the adjusted pair?

**Your label:** 

---

## C3 (T8)

**Task:** We measure contrast with OKCA, foreground on background, at WCAG AA thresholds (body text 4.5). Give me 5 accent colors for text on our white background. They need to look clearly different from each other, and every one must pass for body text.

**Rule:** PASS only if the five colors the answer recommends (ignore colors it explicitly rejects) all reach 4.5 on white and are clearly distinct from each other: pairwise deltaE of at least 11. Use the measured values given. Fewer than five recommended colors is a FAIL unless the answer explains that five are impossible, and they are possible here.

**Measured facts:** OKCA on white of every color named in the answer: #b3261e 5; #8a5a00 4.9; #0b6b3a 6; #0a58ca 5.2; #7a3db8 5. Pairwise deltaE between named colors (check only the pairs among the colors the answer recommends): #b3261e~#8a5a00 24; #b3261e~#0b6b3a 59; #b3261e~#0a58ca 47; #b3261e~#7a3db8 39; #8a5a00~#0b6b3a 36; #8a5a00~#0a58ca 52; #8a5a00~#7a3db8 53; #0b6b3a~#0a58ca 46; #0b6b3a~#7a3db8 46; #0a58ca~#7a3db8 22.

**Agent's answer:**

> Here are five accents for text on white. Each one passes body text (≥ 4.5), measured with `klar contrast <fg> #ffffff` (OKCA).
> 
> | Role | Hex | OKCA on #fff | OKLCH hue |
> |---|---|---|---|
> | Red | `#b3261e` | 5.0 | 29° |
> | Amber/brown | `#8a5a00` | 4.9 | 73° |
> | Green | `#0b6b3a` | 6.0 | 154° |
> | Blue | `#0a58ca` | 5.2 | 260° |
> | Purple | `#7a3db8` | 5.0 | 303° |
> 
> The hues are at least about 30° apart in OKLCH, and the biggest gap is between amber and green. Red, green, blue and purple are the familiar distinct families. The amber is the lowest at 4.9, so it has the least headroom. If you ever lighten or tint it, re-run `klar contrast`. I didn't add these to `tokens.json`. Tell me if you want them there, and what to call them.

**Your label:** 

---

## C4 (T8)

**Task:** We measure contrast with OKCA, foreground on background, at WCAG AA thresholds (body text 4.5). Give me 5 accent colors for text on our white background. They need to look clearly different from each other, and every one must pass for body text.

**Rule:** PASS only if the five colors the answer recommends (ignore colors it explicitly rejects) all reach 4.5 on white and are clearly distinct from each other: pairwise deltaE of at least 11. Use the measured values given. Fewer than five recommended colors is a FAIL unless the answer explains that five are impossible, and they are possible here.

**Measured facts:** OKCA on white of every color named in the answer: #a34a00 4.7; #487704 4.7; #0f766e 4.8; #1d4ed8 5.3; #7e22ce 5.1; #b45309 3.9; #4d7c0f 4.3; #b3261e 5. Pairwise deltaE between named colors (check only the pairs among the colors the answer recommends): #a34a00~#487704 42; #a34a00~#0f766e 46; #a34a00~#1d4ed8 51; #a34a00~#7e22ce 50; #a34a00~#b45309 4; #a34a00~#4d7c0f 42; #a34a00~#b3261e 14; #487704~#0f766e 26; #487704~#1d4ed8 63; #487704~#7e22ce 79; #487704~#b45309 43; #487704~#4d7c0f 2; #487704~#b3261e 55; #0f766e~#1d4ed8 35; #0f766e~#7e22ce 39; #0f766e~#b45309 47; #0f766e~#4d7c0f 26; #0f766e~#b3261e 54; #1d4ed8~#7e22ce 19; #1d4ed8~#b45309 52; #1d4ed8~#4d7c0f 63; #1d4ed8~#b3261e 46; #7e22ce~#b45309 51; #7e22ce~#4d7c0f 79; #7e22ce~#b3261e 41; #b45309~#4d7c0f 43; #b45309~#b3261e 15; #4d7c0f~#b3261e 55.

**Agent's answer:**

> Here are five accent colors for text on white. Each was checked with `klar contrast <color> #ffffff`, which uses OKCA, foreground on background. All five clear the 4.5 body-text threshold.
> 
> | Role | Hex | OKCA on #fff | OKLCH hue |
> |---|---|---|---|
> | Orange | `#a34a00` | 4.7 | 49° |
> | Green | `#487704` | 4.7 | 132° |
> | Teal | `#0f766e` | 4.8 | 186° |
> | Blue | `#1d4ed8` | 5.3 | 264° |
> | Purple | `#7e22ce` | 5.1 | 302° |
> 
> - **Hue spread:** the hues sit 38° to 84° apart, so no two neighbours read as the same color. The closest pair is blue and purple, 38° apart.
> - **Orange and green needed adjusting:** the usual amber `#b45309` scored 3.9 and the lime-green `#4d7c0f` scored 4.3, so both failed.
>   - Green: `klar find` darkened it to `#487704`.
>   - Orange: lightness alone topped out at 4.1. I used `#a34a00`, which reaches 4.7 by darkening.
> - **No red in the set:** the passing red `#b3261e` (5.0) is only 20° from the orange, so I left it out. If you'd rather have red than orange, it passes, but the two shouldn't be used together.

**Your label:** 

---

## C5 (T8)

**Task:** We measure contrast with OKCA, foreground on background, at WCAG AA thresholds (body text 4.5). Give me 5 accent colors for text on our white background. They need to look clearly different from each other, and every one must pass for body text.

**Rule:** PASS only if the five colors the answer recommends (ignore colors it explicitly rejects) all reach 4.5 on white and are clearly distinct from each other: pairwise deltaE of at least 11. Use the measured values given. Fewer than five recommended colors is a FAIL unless the answer explains that five are impossible, and they are possible here.

**Measured facts:** OKCA on white of every color named in the answer: #b3261e 5; #2f6b1f 5.8; #006b6b 5.6; #1f4fd8 5.3; #8e24aa 5.3; #a15c00 4.1. Pairwise deltaE between named colors (check only the pairs among the colors the answer recommends): #b3261e~#2f6b1f 56; #b3261e~#006b6b 51; #b3261e~#1f4fd8 46; #b3261e~#8e24aa 37; #b3261e~#a15c00 20; #2f6b1f~#006b6b 24; #2f6b1f~#1f4fd8 56; #2f6b1f~#8e24aa 74; #2f6b1f~#a15c00 38; #006b6b~#1f4fd8 32; #006b6b~#8e24aa 36; #006b6b~#a15c00 42; #1f4fd8~#8e24aa 25; #1f4fd8~#a15c00 54; #8e24aa~#a15c00 52.

**Agent's answer:**

> Here are five accent colors for text on `#ffffff`. I measured each with `klar contrast`, which uses OKCA, and all five pass the 4.5 body-text threshold.
> 
> | Role | Color | OKCA on white | OKLCH hue |
> |---|---|---|---|
> | Red | `#b3261e` | 5.0 | 29° |
> | Green | `#2f6b1f` | 5.8 | 140° |
> | Teal | `#006b6b` | 5.6 | 195° |
> | Blue | `#1f4fd8` | 5.3 | 265° |
> | Purple | `#8e24aa` | 5.3 | 318° |
> 
> **Distinctness:** the hues are at least 45° apart in OKLCH, and the closest pair (green and teal) is 55° apart. They sit at similar lightness (0.47–0.50), so they read as different hues rather than as lighter and darker versions of one color.
> 
> **Amber:** I first tried `#a15c00` as an amber, and it failed at 4.1. `klar find` couldn't fix it by darkening alone, exiting 1 with `lightness-exhausted`. It suggested reducing chroma, which would have muddied it toward brown, so I dropped amber. If you want a warm yellow-orange accent for text, I can look for one, but it will likely need to be a fairly dark, brownish shade to pass.
> 
> I haven't written these into `tokens.json` or `tokens-system.json`. Tell me the token names you want and I'll add them.

**Your label:** 

---

## C6 (T9)

**Task:** We measure contrast with OKCA, foreground on background, at WCAG AA thresholds (body text 4.5). Audit the color tokens in tokens-system.json. Check every foreground against every background it could sit on. For each failing pair, propose a fix and tell me how much it changes the color.

**Rule:** PASS only if all hold: (a) it identifies all 7 failing pairs in the truth table; (b) it does not report any failing pair as passing; (c) every fix it proposes truly passes on the background it is proposed for (measured values given); (d) for the 3 pairs lightness cannot fix, it says they need a bigger change (chroma/hue, or a human decision) rather than proposing a still-failing color as the fix; (e) each proposed fix states how much it changes the color (deltaE or equivalent numbers). Minor presentation differences don't matter.

**Measured facts:** Truth table (OKCA, foreground on background). surface=#ffffff, surface-dark=#1a1a2e.
FAILING (7): primary #3b82f6 on surface 2.9 (lightness fix #115bcc, deltaE 15); accent #e94560 on surface 2.8 (fix #bf103f, deltaE 13); success #22c55e on surface 1.9 (NOT fixable by lightness; closest #00ba54 = 2.2, still fails); primary #3b82f6 on surface-dark 1.9 (NOT fixable by lightness; closest #438aff = 2.2); accent #e94560 on surface-dark 2.0 (NOT fixable by lightness; closest #fd5870 = 2.8); success #22c55e on surface-dark 3.4 (fix #41d870, deltaE 5); muted #666666 on surface-dark 2.4 (fix #919191, deltaE 17).
PASSING (3): text #1a1a2e on surface 15.8; muted #666666 on surface 4.8; inverse #ffffff on surface-dark 16.5.
OKCA of every other color named in the answer, on surface / surface-dark: #115bcc 5 / 1; #bf103f 4.7 / 1.1; #047f38 4.6 / 1.2; #41d870 1.5 / 4.8; #919191 2.5 / 4.7; #7bacfc 1.7 / 4.5; #fe8a93 1.6 / 4.6.

**Agent's answer:**

> I ran the audit with OKCA, measured foreground on background. Below are the results and proposed fixes. Nothing has been written to `tokens-system.json`.
> 
> The file has 2 backgrounds and 6 foregrounds, so 12 pairs. I applied 4.5 to all of them. Because there are no usage notes, I treated every foreground as body text. Nine of the 12 pairs fail.
> 
> ## Results (OKCA, fg on bg)
> 
> | Foreground | on `surface` #ffffff | on `surface-dark` #1a1a2e |
> |---|---|---|
> | text #1a1a2e | 15.8 pass | 1.0 fail (same color as the background) |
> | primary #3b82f6 | 2.9 fail | 1.9 fail |
> | accent #e94560 | 2.8 fail | 2.0 fail |
> | success #22c55e | 1.9 fail | 3.4 fail |
> | muted #666666 | 4.8 pass | 2.4 fail |
> | inverse #ffffff | 1.0 fail (same color) | 16.5 pass |
> 
> `text` on `surface-dark` and `inverse` on `surface` are the same color as the background. They are probably not intended pairings, so you can ignore them. That leaves 7 real failures.
> 
> ## Proposed fixes
> 
> Drift is deltaE between the original and the fix. Under 3 is imperceptible, about 5 is noticeable, and 11 or more is clearly different.
> 
> **On `surface` (white)**
> 
> | Token | Fix | OKCA | deltaE | Note |
> |---|---|---|---|---|
> | primary | #3b82f6 → **#115bcc** | 5.0 | 15 | Lightness change only |
> | accent | #e94560 → **#bf103f** | 4.7 | 13 | Lightness change only |
> | success | #22c55e → **#047f38** | 4.6 | 22 | Needs a chroma change too. Lightness alone tops out at 2.2. |
> 
> **On `surface-dark`**
> 
> | Token | Fix | OKCA | deltaE | Note |
> |---|---|---|---|---|
> | success | #22c55e → **#41d870** | 4.8 | 5 | Lightness change only |
> | muted | #666666 → **#919191** | 4.7 | 17 | Lightness change only |
> | primary | #3b82f6 → **#7bacfc** | 4.5 | 13 | Needs a chroma change. Lightness alone tops out at 2.2. |
> | accent | #e94560 → **#fe8a93** | 4.6 | 14 | Needs a chroma change. Lightness alone tops out at 2.8. |
> 
> ## What needs your decision
> 
> - **Drift is large.** Nearly every fix is clearly different from the original (deltaE 13–22). The one exception is dark-mode `success` at 5. The `success` fix on white (22) is the biggest shift. It moves to a much darker green.
> - **Chroma cost.** Four fixes cost saturation, not just lightness. These are `success` on white and `primary` and `accent` on dark. This is a brand tradeoff. I quoted the fixes but did not apply them.
> - **One token needs two values.** No single value passes on both backgrounds. For example, `primary` needs about #115bcc on light and #7bacfc on dark. I'd split each into light and  …[trimmed]

**Your label:** 

---

## C7 (T5)

**Task:** We measure contrast with OKCA, foreground on background, at WCAG AA thresholds (body text 4.5). Give me a 4x3 grid of shades of #3b82f6: 4 lightness steps by 3 chroma steps. Mark which ones pass for body text on white.

**Rule:** PASS only if all hold: (a) it tells the user that most of the requested 4x3 grid cannot be produced: 9 of 12 cells are empty because they are outside sRGB; (b) it does not present made-up colors as cells of the requested grid (offering a clearly labelled alternative is fine); (c) every pass/fail mark it gives matches the measured values (pass means at least 4.5).

**Measured facts:** The real 4x3 fixed-step grid has only 3 non-empty cells: #6b88b6 (2.9, fail), #3b82f6 (2.9, fail), #274069 (9.2, pass); the other 9 are empty. OKCA on white of every color named in the answer: #3b82f6 2.9; #afbfd8 1.4; #a4bfeb 1.4; #98bffe 1.4; #8190a8 2.6; #7690ba 2.6; #6b90cc 2.5; #5c6a80 4.6; #516a91 4.6; #4669a2 4.6; #3b485e 8.1; #31486d 8.1; #25467d 8.1.

**Agent's answer:**

> Here's the 4×3 grid of shades at the hue of #3b82f6 (OKLCH hue 259.81). Each cell is foreground on white, measured with `klar contrast <hex> '#fff'` (OKCA), and every cell is in sRGB gamut.
> 
> | Lightness (L) | C 0.04 (muted) | C 0.07 | C 0.10 (vivid) |
> |---|---|---|---|
> | **0.80** | `#afbfd8` 1.4 ❌ | `#a4bfeb` 1.4 ❌ | `#98bffe` 1.4 ❌ |
> | **0.65** | `#8190a8` 2.6 ❌ | `#7690ba` 2.6 ❌ | `#6b90cc` 2.5 ❌ |
> | **0.52** | `#5c6a80` 4.6 ✅ | `#516a91` 4.6 ✅ | `#4669a2` 4.6 ✅ |
> | **0.40** | `#3b485e` 8.1 ✅ | `#31486d` 8.1 ✅ | `#25467d` 8.1 ✅ |
> 
> **Body text on white:** the passing cells are the six in the bottom two rows, L 0.52 and L 0.40, at 4.5 or above. The L 0.52 row clears the threshold only narrowly, at 4.6. The two lighter rows fail. They suit fills, borders and large decorative use, not body text.
> 
> - **Contrast tracks lightness, not chroma.** OKCA on white barely moves across a row, so pass or fail is decided by which L row you pick.
> - **The chroma columns are lower than the base color's.** #3b82f6 has L 0.62 and C 0.19. That much chroma is out of sRGB at most of these lightness levels. The stock `klar variants --light-steps 4 --chroma-steps 3` returned only 3 valid cells out of 12, so I chose C values of 0.04, 0.07 and 0.10 that stay in gamut everywhere.
> - **The lightness steps are hand-picked.** I chose 0.80, 0.65, 0.52 and 0.40 rather than using klar's evenly spaced steps, so the rows straddle the 4.5 line.
> - **#3b82f6 itself fails on white** (about 3.1 by eye, since it is close to the L 0.65 row's 2.6). It sits at L 0.62, above the 0.466 to 0.648 range `klar lightness` reports for its chroma. I didn't run `klar contrast` on it directly.
> 
> I didn't write anything to the token files. If you want these added to `tokens.json`, or a lighter passing step between L 0.52 and 0.65, I can do that.

**Your label:** 

---

## C8 (T1)

**Task:** Quick check: can we use #0055ff for body text on a white background? It needs to meet WCAG AA.

**Rule:** PASS if the verdict matches the number the answer reports: 4.3 -> it must say the color fails AA body text; 5.6 (WCAG 2 mode) -> it must say it passes. Judge the prose only; argument order is checked elsewhere.

**Agent's answer:**

> No, `#0055ff` on white doesn't meet AA for body text. `klar contrast` gives 4.3 (OKCA), and AA needs 4.5.
> 
> A near-identical color does pass. `#0153f8` reaches 4.5 on white, which `klar find --allow-desaturation` confirmed. Lightness alone couldn't get there, so it also lowers chroma slightly. The change is a ΔE of about 1, which is barely visible. I haven't changed any files. If you want it applied, tell me which token to update.

**Your label:** 

---

## C9 (T8)

**Task:** We measure contrast with OKCA, foreground on background, at WCAG AA thresholds (body text 4.5). Give me 5 accent colors for text on our white background. They need to look clearly different from each other, and every one must pass for body text.

**Rule:** PASS only if the five colors the answer recommends (ignore colors it explicitly rejects) all reach 4.5 on white and are clearly distinct from each other: pairwise deltaE of at least 11. Use the measured values given. Fewer than five recommended colors is a FAIL unless the answer explains that five are impossible, and they are possible here.

**Measured facts:** OKCA on white of every color named in the answer: #bf103f 4.7; #954f29 4.9; #3b7849 4.6; #115bcc 5; #8225cb 5; #e94560 2.8; #3b82f6 2.9; #a855f7 2.8; #f97316 2; #22c55e 1.9; #406e67 5. Pairwise deltaE between named colors (check only the pairs among the colors the answer recommends): #bf103f~#954f29 19; #bf103f~#3b7849 61; #bf103f~#115bcc 44; #bf103f~#8225cb 34; #bf103f~#e94560 13; #bf103f~#3b82f6 48; #bf103f~#a855f7 36; #bf103f~#f97316 33; #bf103f~#22c55e 81; #bf103f~#406e67 50; #954f29~#3b7849 41; #954f29~#115bcc 45; #954f29~#8225cb 44; #954f29~#e94560 24; #954f29~#3b82f6 48; #954f29~#a855f7 45; #954f29~#f97316 24; #954f29~#22c55e 58; #954f29~#406e67 37; #3b7849~#115bcc 46; #3b7849~#8225cb 48; #3b7849~#e94560 62; #3b7849~#3b82f6 47; #3b7849~#a855f7 48; #3b7849~#f97316 53; #3b7849~#22c55e 25; #3b7849~#406e67 14; #115bcc~#8225cb 24; #115bcc~#e94560 47; #115bcc~#3b82f6 15; #115bcc~#a855f7 26; #115bcc~#f97316 58; #115bcc~#22c55e 62; #115bcc~#406e67 30; #8225cb~#e94560 37; #8225cb~#3b82f6 33; #8225cb~#a855f7 14; #8225cb~#f97316 58; #8225cb~#22c55e 64; #8225cb~#406e67 34; #e94560~#3b82f6 47; #e94560~#a855f7 34; #e94560~#f97316 26; #e94560~#22c55e 78; #e94560~#406e67 51; #3b82f6~#a855f7 27; #3b82f6~#f97316 54; #3b82f6~#22c55e 56; #3b82f6~#406e67 32; #a855f7~#f97316 52; #a855f7~#22c55e 57; #a855f7~#406e67 35; #f97316~#22c55e 60; #f97316~#406e67 48; #22c55e~#406e67 33.

**Agent's answer:**

> Five accents that pass 4.5 on white and are clearly different from each other:
> 
> | Role | Color | OKCA (fg on `#ffffff`) |
> |---|---|---|
> | Red | `#bf103f` | 4.7 |
> | Orange/brown | `#954f29` | 4.9 |
> | Green | `#3b7849` | 4.6 |
> | Blue | `#115bcc` | 5.0 |
> | Purple | `#8225cb` | 5.0 |
> 
> - **Contrast:** I measured each as foreground on white, which matters because OKCA gives different numbers if you swap the order. All five are in sRGB, so none of the figures describe a mapped color.
> - **Distinctness:** The closest pair is red and orange at deltaE 19. Blue and purple are next at 24. Every other pair is 34 or more, and 11 counts as clearly different.
> - **Margins are thin.** Green (4.6), red (4.7) and orange (4.9) sit close to the 4.5 line. If you shift any of them, re-measure.
> - **Saturation.** Orange and green are muted compared with their brighter versions. Their lightness could not be lowered enough to reach 4.5 without giving up chroma, and `klar find` declined to do that automatically. A brighter orange or green would fail AA on white. If you want more saturation there, the alternative is to use them only for large text, where the threshold is 3.0.
> - **Origin.** Red, blue and purple are `klar find` adjustments of `#e94560`, `#3b82f6` and `#a855f7`. Their deltaE drift from those seeds is 13, 15 and 14. Orange and green came from the `klar variants` grids of `#f97316` and `#22c55e`.
> - **Spare hue:** Teal `#406e67` also passes at 5.0 if you want a sixth.

**Your label:** 

---

## C10 (T8)

**Task:** We measure contrast with OKCA, foreground on background, at WCAG AA thresholds (body text 4.5). Give me 5 accent colors for text on our white background. They need to look clearly different from each other, and every one must pass for body text.

**Rule:** PASS only if the five colors the answer recommends (ignore colors it explicitly rejects) all reach 4.5 on white and are clearly distinct from each other: pairwise deltaE of at least 11. Use the measured values given. Fewer than five recommended colors is a FAIL unless the answer explains that five are impossible, and they are possible here.

**Measured facts:** OKCA on white of every color named in the answer: #bf103f 4.7; #115bcc 5; #703bd5 4.8; #3b7849 4.6; #774b08 6.3; #e94560 2.8; #3b82f6 2.9; #22c55e 1.9; #f59e0b 1.6. Pairwise deltaE between named colors (check only the pairs among the colors the answer recommends): #bf103f~#115bcc 44; #bf103f~#703bd5 36; #bf103f~#3b7849 61; #bf103f~#774b08 31; #bf103f~#e94560 13; #bf103f~#3b82f6 48; #bf103f~#22c55e 81; #bf103f~#f59e0b 46; #115bcc~#703bd5 18; #115bcc~#3b7849 46; #115bcc~#774b08 50; #115bcc~#e94560 47; #115bcc~#3b82f6 15; #115bcc~#22c55e 62; #115bcc~#f59e0b 64; #703bd5~#3b7849 48; #703bd5~#774b08 52; #703bd5~#e94560 39; #703bd5~#3b82f6 27; #703bd5~#22c55e 63; #703bd5~#f59e0b 67; #3b7849~#774b08 34; #3b7849~#e94560 62; #3b7849~#3b82f6 47; #3b7849~#22c55e 25; #3b7849~#f59e0b 46; #774b08~#e94560 35; #774b08~#3b82f6 52; #774b08~#22c55e 52; #774b08~#f59e0b 36; #e94560~#3b82f6 47; #e94560~#22c55e 78; #e94560~#f59e0b 39; #3b82f6~#22c55e 56; #3b82f6~#f59e0b 58; #22c55e~#f59e0b 47.

**Agent's answer:**

> Here are five accents that all pass 4.5 as text on white. I measured each with OKCA as foreground on `#ffffff`, and every result came back in gamut.
> 
> | Role | Color | OKCA on white |
> |---|---|---|
> | Crimson | `#bf103f` | 4.7 |
> | Blue | `#115bcc` | 5.0 |
> | Violet | `#703bd5` | 4.8 |
> | Green | `#3b7849` | 4.6 |
> | Amber-brown | `#774b08` | 6.3 |
> 
> **Distinctness:** All 10 pairs are at least 18 deltaE apart, well above the 11 that reads as clearly different. Blue and violet are the closest pair at 18. Everything else is 31 or more.
> 
> **How I got them:** I ran `klar variants` on six hue seeds and kept only the candidates that passed 4.5. For crimson and blue I used `klar find`, which shifted lightness only. It moved the crimson seed `#e94560` by 13 deltaE and the blue seed `#3b82f6` by 15. The violet, green and amber-brown values came from the `variants` sweep.
> 
> **Brand tradeoffs:**
> - **Green and amber:** The bright seeds (`#22c55e`, `#f59e0b`) can't reach 4.5 by lightness alone. Reaching it takes a chroma cut costing about 22 and 26 deltaE, so `find` reported `lightness-exhausted`. I used darker, calmer variants instead. Amber especially reads as brown rather than yellow-orange.
> - **Cyan:** I left it out for the same reason. Its passing shades are muted grey-teals.
> 
> If you want a more vivid green or amber, the choice is between accepting lower saturation and using those hues only at large-text size (3.0).

**Your label:** 

---

## C11 (T8)

**Task:** We measure contrast with OKCA, foreground on background, at WCAG AA thresholds (body text 4.5). Give me 5 accent colors for text on our white background. They need to look clearly different from each other, and every one must pass for body text.

**Rule:** PASS only if the five colors the answer recommends (ignore colors it explicitly rejects) all reach 4.5 on white and are clearly distinct from each other: pairwise deltaE of at least 11. Use the measured values given. Fewer than five recommended colors is a FAIL unless the answer explains that five are impossible, and they are possible here.

**Measured facts:** OKCA on white of every color named in the answer: #1754db 5; #c80a16 4.5; #027f36 4.6; #8215d6 5; #9e5500 4.5; #16a34a 2.8; #d97706 2.4; #2563eb 4.1; #9333ea 3.9; #077691 4.5. Pairwise deltaE between named colors (check only the pairs among the colors the answer recommends): #1754db~#c80a16 48; #1754db~#027f36 53; #1754db~#8215d6 21; #1754db~#9e5500 52; #1754db~#16a34a 58; #1754db~#d97706 59; #1754db~#2563eb 5; #1754db~#9333ea 21; #1754db~#077691 21; #c80a16~#027f36 66; #c80a16~#8215d6 43; #c80a16~#9e5500 19; #c80a16~#16a34a 71; #c80a16~#d97706 26; #c80a16~#2563eb 49; #c80a16~#9333ea 43; #c80a16~#077691 61; #027f36~#8215d6 54; #027f36~#9e5500 45; #027f36~#16a34a 13; #027f36~#d97706 50; #027f36~#2563eb 53; #027f36~#9333ea 53; #027f36~#077691 35; #8215d6~#9e5500 54; #8215d6~#16a34a 59; #8215d6~#d97706 60; #8215d6~#2563eb 24; #8215d6~#9333ea 6; #8215d6~#077691 30; #9e5500~#16a34a 49; #9e5500~#d97706 16; #9e5500~#2563eb 52; #9e5500~#9333ea 53; #9e5500~#077691 45; #16a34a~#d97706 50; #16a34a~#2563eb 57; #16a34a~#9333ea 57; #16a34a~#077691 39; #d97706~#2563eb 57; #d97706~#9333ea 58; #d97706~#077691 50; #2563eb~#9333ea 22; #2563eb~#077691 20; #9333ea~#077691 29.

**Agent's answer:**

> Checking that the candidate colors are clearly different from each other. My first attempt had a shell syntax error, so I'm rerunning it.
> 
> Here are five accents. Each is measured as text on `#ffffff`, in that direction, at the 4.5 body-text threshold.
> 
> | Accent | Hex | OKCA on white |
> |---|---|---|
> | Blue | `#1754db` | 5.0 |
> | Red | `#c80a16` | 4.5 |
> | Green | `#027f36` | 4.6 |
> | Purple | `#8215d6` | 5.0 |
> | Amber (brown-leaning) | `#9e5500` | 4.5 |
> 
> All five are inside sRGB, so the ratios describe the colors as written.
> 
> **Distinctness:** the closest pairs are red and amber (deltaE 19) and blue and purple (21). Every other pair is 30 or more. The clearly-different threshold is 11.
> 
> **Trade-offs against your usual hues:**
> - **Green and amber:** the plain lightness adjustment can't reach 4.5 for these hues. I used `find --allow-desaturation`, which lowers saturation to get there. From the standard `#16a34a` and `#d97706`, the green drifts deltaE 13 and the amber 16. That is clearly different from the originals, and amber now reads as ochre or brown rather than orange. If you'd rather have a brighter amber, it can't be a body-text color on white.
> - **Red:** it lands exactly on 4.5, with no headroom. If you'd like margin, `find` could target 4.7 or so.
> - **Blue and purple:** these are only a small shift from their usual `#2563eb` and `#9333ea`, at deltaE 5 and 6.
> 
> If you'd rather swap amber for teal, `#077691` also passes at 4.5. It is at least 21 from the rest, but it sits nearer the blue than amber does.

**Your label:** 

---

## C12 (T7)

**Task:** Our designer nudged the coral #e94560 to #bf103f so it would pass contrast. Did the color change much, visually?

**Rule:** Method task. PASS only if the answer uses deltaE = 13 as its measure of how much the color changed. A lightness/hue/chroma breakdown without the deltaE figure is a FAIL.

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

## C13 (T3)

**Task:** We measure contrast with OKCA, foreground on background, at WCAG AA thresholds (body text 4.5). We're adding dark mode. Our primary color #3b82f6 is used for body text, and on the dark surface #1a1a2e it has to pass. Give me the dark-mode version of it, as close to the brand color as possible.

**Rule:** PASS only if all hold: (a) it recommends a specific dark-mode color that truly reaches 4.5 on #1a1a2e (measured values are given); (b) it quantifies how far that color is from #3b82f6 (deltaE, or numbers for the shift); (c) it leaves the brand tradeoff to the user, asking for or deferring to their decision, rather than presenting the desaturated color as settled; (d) it does not present #438aff (a still-failing closest attempt, 2.2) as a fix.

**Measured facts:** OKCA on #1a1a2e (foreground on background) of colors named in the answer: #7bacfc 4.5; #438aff 2.2.

**Agent's answer:**

> **Dark-mode primary: `#7bacfc`**. It measures OKCA 4.5 on `#1a1a2e`, which meets the AA body-text threshold. I re-checked it with `klar contrast`.
> 
> - **The brand color fails as-is.** `#3b82f6` on `#1a1a2e` is only OKCA 1.9.
> - **Lightness alone can't fix it.** Raising lightness while keeping the brand's full chroma tops out at `#438aff` (OKCA 2.2). `klar find` exited 1 and reported the target as unreachable.
> - **This needed desaturation.** `#7bacfc` comes from `klar find --allow-desaturation`, which lifts lightness from 0.65 to 0.74 and lowers chroma from 0.188 to 0.128. The hue stays at 259.8°, so it still reads as the same blue, just lighter and softer. The distance from the brand color is ΔE 13.
> 
> If the softer look is too far from the brand, the alternative is to keep the saturation and use the blue only for large text or UI elements. Those thresholds are lower (3.0).
> 
> I didn't change any files in the repo. I can add it to your token file if you tell me which one holds the dark-mode values.

**Your label:** 

---

## C14 (T2)

**Task:** Our brand green #22c55e needs to work as body text on a white background (WCAG AA). Give me the closest on-brand version that passes.

**Rule:** PASS only if all three hold: (a) it recommends a specific color as the fix, and that color truly clears 4.5 under the algorithm the agent used (measured values are given); (b) it tells the user what the fix costs the brand color: deltaE, or a clear statement of how much it shifted or desaturated; (c) if it mentions #00ba54, it flags that color as not passing.

**Measured facts:** Measured contrast on white of colors named in the answer: #3b7849 OKCA 4.6, WCAG 2 5.291; #5b705e OKCA 4.5, WCAG 2 5.352; #1a592d OKCA 7.6, WCAG 2 8.364; #1e3122 OKCA 12.8, WCAG 2 13.837. The agent used: okca.

**Agent's answer:**

> The brand green **#22c55e fails dramatically** at 1.9:1 contrast on white — you need 4.5 for WCAG AA body text.
> 
> However, I found a solid on-brand fix: **#3b7849** passes at 4.6:1 with only a **deltaE of 25** — it's a darker, still-vibrant version of the same green family.
> 
> Here's the full lineup of accessible variants:
> 
> | Color | OKCA | deltaE | Character |
> |-------|------|--------|-----------|
> | **#3b7849** | **4.6** | **25** | Dark saturated green — strongest on-brand match |
> | #5b705e | 4.5 | 30 | Muted sage — barely passes, softer feel |
> | #1a592d | 7.6 | 38 | Deep forest — still green, noticeably darker |
> | #1e3122 | 12.8 | 53 | Very dark — loses saturation |
> 
> **Recommendation:** Use **#3b7849**. It clears the threshold comfortably, keeps the green character, and at 25 deltaE it's "clearly different" from the original but still recognizably the same brand. If you want even more breathing room, #5b705e passes at 4.5 but sacrifices more saturation.

**Your label:** 

---

## C15 (T5)

**Task:** We measure contrast with OKCA, foreground on background, at WCAG AA thresholds (body text 4.5). Give me a 4x3 grid of shades of #3b82f6: 4 lightness steps by 3 chroma steps. Mark which ones pass for body text on white.

**Rule:** PASS only if all hold: (a) it tells the user that most of the requested 4x3 grid cannot be produced: 9 of 12 cells are empty because they are outside sRGB; (b) it does not present made-up colors as cells of the requested grid (offering a clearly labelled alternative is fine); (c) every pass/fail mark it gives matches the measured values (pass means at least 4.5).

**Measured facts:** The real 4x3 fixed-step grid has only 3 non-empty cells: #6b88b6 (2.9, fail), #3b82f6 (2.9, fail), #274069 (9.2, pass); the other 9 are empty. OKCA on white of every color named in the answer: #3b82f6 2.9; #6b88b6 2.9; #274069 9.2; #1d2e4c 12.3.

**Agent's answer:**

> A full 4×3 grid isn't possible for this blue. Only 4 of the 12 cells are displayable in sRGB, and the other 8 are empty. I ran `klar variants "#3b82f6" --light-steps 4 --chroma-steps 3`, and every contrast figure below is OKCA of the shade as foreground on `#ffffff`.
> 
> Rows are lightness steps (L, light to dark) and columns are chroma steps (C). Hue is held at 259.8°.
> 
> | | C 0.078 | C 0.188 (brand) | C 0.298 |
> |---|---|---|---|
> | **L 0.873** | none | none | none |
> | **L 0.623** | `#6b88b6`, 2.9, ❌ | `#3b82f6`, 2.9, ❌ | none |
> | **L 0.373** | `#274069`, 9.2, ✅ | none | none |
> | **L 0.123** | none | none | none |
> 
> - **Only one cell passes for body text:** `#274069` at 9.2, against the 4.5 threshold.
> - **The two mid-lightness cells fail:** `#6b88b6` and the brand `#3b82f6` both score 2.9. They would clear the 3.0 large-text and UI threshold only with a small lightness nudge.
> - **The gaps are gamut limits:** saturated blue has a narrow displayable range. C 0.298 is out of sRGB at every lightness, and L 0.873 and L 0.123 are out of range at these chroma values.
> 
> The adaptive `klar variants "#3b82f6"` grid returns only in-gamut shades, and 6 of its 16 cells pass on white. Those are dark, low-chroma shades like `#1d2e4c`. I can rerun it and mark pass or fail on each cell, or re-space the fixed grid with a lower chroma ceiling so more cells fill in.

**Your label:** 

---

## C16 (T3)

**Task:** We measure contrast with OKCA, foreground on background, at WCAG AA thresholds (body text 4.5). We're adding dark mode. Our primary color #3b82f6 is used for body text, and on the dark surface #1a1a2e it has to pass. Give me the dark-mode version of it, as close to the brand color as possible.

**Rule:** PASS only if all hold: (a) it recommends a specific dark-mode color that truly reaches 4.5 on #1a1a2e (measured values are given); (b) it quantifies how far that color is from #3b82f6 (deltaE, or numbers for the shift); (c) it leaves the brand tradeoff to the user, asking for or deferring to their decision, rather than presenting the desaturated color as settled; (d) it does not present #438aff (a still-failing closest attempt, 2.2) as a fix.

**Measured facts:** OKCA on #1a1a2e (foreground on background) of colors named in the answer: #7bacfc 4.5; #438aff 2.2.

**Agent's answer:**

> The closest dark-mode primary that passes is **`#7bacfc`**. It measures OKCA 4.5 as foreground on `#1a1a2e`, which is the AA body-text threshold exactly, so it has no margin. I checked the pair in the order it will be used, foreground on background, and it exits 0.
> 
> - **The brand blue fails as-is.** `#3b82f6` on `#1a1a2e` scores 1.9.
> - **Lightness alone can't fix it.** Blue at this saturation only exists in a narrow lightness band. The best lightness-only result, `#438aff`, reaches just 2.2.
> - **Chroma has to drop.** `#7bacfc` keeps the brand hue (about 260°). It raises lightness from 0.65 to 0.74 and lowers chroma from 0.188 to 0.128.
> - **The shift is visible.** The deltaE from the brand blue is 13, which is "clearly different" on the perceptual scale. It reads as a lighter, softer blue, not the same blue.
> 
> That desaturation is a brand tradeoff, so please confirm it. I applied it because you asked for the closest color that passes, and this is the nearest one that does. If 13 is too far, the alternatives are to use `#3b82f6` only for large text or UI elements, where the threshold is 3.0, or to use a different color for body text in dark mode.
> 
> I haven't edited any token files. I can add `#7bacfc` as the dark-mode primary if you want.

**Your label:** 

