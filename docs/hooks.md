# Location Scout — Verification Hooks

## Overview
Hooks are automatic verification steps. They fire BEFORE an artifact can pass through a gate. The agent cannot bypass them.

---

## Hook: post-bible-write
**Fires:** After Location Bible JSON is written
**Checks:**
1. All NOT_NULL fields are populated
2. space_description word count ≥ 400
3. negative_list has ≥ 3 entries
4. light_base_state has direction + color_temp_kelvin + shadow_hardness filled
5. key_details has 5–8 entries
6. No terms from negative_list appear in space_description or atmosphere

**On fail:** Return to agent with specific field errors. Agent must fix and resubmit.
**On pass:** Silent — no context pollution.

---

## Hook: post-research
**Fires:** After RESEARCH_PACK is created
**Checks:**
1. anachronism_list has ≥ 5 entries
2. period_facts is not empty
3. typical_elements has ≥ 3 entries

**On fail:** Research insufficient. Loop back to research step.
**On pass:** Proceed to Bible writing.

---

## Hook: era-accuracy-check
**Fires:** After Bible is written, before era-accurate gate
**Checks:**
1. Cross-reference Bible.key_details against RESEARCH_PACK.anachronism_list
2. Cross-reference Bible.space_description against RESEARCH_PACK.anachronism_list
3. Flag any detail that appears in anachronism_list

**On fail:** Return specific anachronisms found. Agent corrects Bible or deepens research.
**On pass:** Bible is era-accurate. Proceed to floorplan.

---

## Hook: post-anchor-generation
**Fires:** After anchor image is generated
**Checks:**
1. **VLM Audit** — Send generated image + Location Bible to vision model (Gemini 2.5 Pro or Claude Vision)
   - Does the image match the space description?
   - Are there anachronistic elements?
   - Are items from negative_list visible?
   - Does the lighting match light_base_state?
2. **Consistency score** (if previous anchor exists for comparison)
   - LPIPS < 0.4
   - SSIM > 0.6

**On fail (VLM finds issues):** Return specific drift description. Agent adjusts prompt and regenerates.
**On fail (metrics):** Flag inconsistency. Regenerate with higher image_ref_strength.
**On pass:** Anchor approved. Proceed to mood states.

---

## Hook: post-scene-generation
**Fires:** After any scene image is generated
**Checks:**
1. **VLM Audit** vs anchor image + Bible
2. **LPIPS** vs anchor (threshold: < 0.4)
3. **SSIM** vs anchor (threshold: > 0.6)
4. **Segmentation map diff** — major structural elements should match anchor

**On fail:** Regenerate. Max 3 retries (Ralph Wiggum Loop).
**On budget exceeded:** Escalate to human with report of what failed and why.

---

## Ralph Wiggum Loop config
```
max_retries: 3
exit_condition: vlm_audit == CLEAN AND metrics_pass == TRUE
on_budget_exceeded: escalate_to_human
context_policy: only_errors_in_context
```
On success: silent (nothing added to context).
On failure: only the error description enters context. No verbose logs.
