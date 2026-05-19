/**
 * Stage 4 — Reference Generation.
 * Mirrors Figma frame "Reference Generation" (node 433:26).
 *
 * Rehydration contract (Wave 0 fix, 2026-05-19):
 *   On mount, HEAD-probe the per-project artifact paths for floorplan,
 *   isometric, and anchor (via `buildArtifactUrl`, which appends
 *   `?project_id=…`). For each 200 hit we flip the corresponding card to
 *   `ready` so closing + reopening the iframe doesn't blow away images
 *   that exist on disk. Cross-project leak is prevented at the URL level
 *   (the route namespaces storage on `project_id`), not by refusing to
 *   read. New locations still start empty because nothing is at those
 *   paths yet.
 *
 * Generation chain (each step user-triggered):
 *   floorplan  → create_floorplan (Python/matplotlib, top-down)
 *   isometric  → generate_isometric_reference (FAL img2img, needs floorplan)
 *   anchor     → generate_anchor (FAL, needs isometric)
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { callTool, pollTask, type TaskStatus } from "../api/mcp";
import { usePipeline } from "../state/PipelineContext";
import { PromptCard } from "../components/PromptCard";
import { ReferencePicker, type ReferenceRef } from "../components/ReferencePicker";
import { ImageOverlay } from "../components/ImageOverlay";
import { BibleProgressPanel } from "../components/BibleProgressPanel";
import { useGallery } from "../hooks/useGallery";
import { useAssemblePrompt } from "../hooks/useAssemblePrompt";
import { useDebouncedAction } from "../hooks/useDebouncedAction";
import { useProjectContext, buildArtifactUrl } from "../hooks/useProjectContext";

type AnchorState =
  | { kind: "checking" }
  | { kind: "missing" }
  | { kind: "generating"; status: TaskStatus | null; task_id?: string }
  | { kind: "ready"; cacheBust: number }
  | { kind: "error"; message: string };

/**
 * Eager Bible state — drives the top-of-page banner.
 *
 * Contract change (v1.0.34): LocationScout no longer requires an upstream
 * agent to seed the Location Bible. If the user lands on /references and no
 * Bible exists for this location_id, this page itself calls scout_location
 * and surfaces progress. The Orchestrator may also fan out at extract time
 * (planned separately) — both layers are idempotent via sessionStorage.
 *
 * Note: scout_location auto-resolves location_brief + director_vision via
 * MCP from AGENT_1AD_URL and AGENT_DIRECTOR_URL. If those upstream agents
 * have no data for this project, the backend pipeline will fail and we
 * surface the error with a Retry button.
 */
type BibleBootState =
  | { kind: "checking" }
  | { kind: "ready" }
  | { kind: "generating"; status: TaskStatus | null; task_id: string }
  | { kind: "error"; message: string };

/**
 * sessionStorage key for the in-flight scout_location task_id, scoped per
 * locationId so re-mounts attach to the same task instead of double-firing.
 * Cleared on terminal status (ready / error).
 */
function bibleTaskKey(locationId: string) {
  return `ls.bible_task.${locationId}`;
}

/**
 * sessionStorage key for a sticky "scout_location already failed for this
 * project+location" record. Set when the eager Bible bootstrap errors out
 * (typically because 1AD has no upstream brief for this project). Until the
 * user explicitly clicks Retry, subsequent re-mounts of /references skip the
 * scout_location call and just surface the cached error — otherwise navigating
 * References → Setups → References re-fires write_bible and the user sees the
 * "location_brief required" message every time (Bug X-2, 2026-05-19).
 */
function bibleErrorKey(locationId: string) {
  return `ls.bible_error.${locationId}`;
}

/** Fire-and-forget cancel; the existing poll loop will react to status=cancelled. */
async function cancelTask(task_id: string) {
  try {
    await callTool("cancel_task", { task_id });
  } catch (e) {
    console.warn("[cancel_task]", e);
  }
}

export function ReferencesPage() {
  const { state, dispatch } = usePipeline();
  const navigate = useNavigate();
  const r = state.references;
  const { projectId, locationId: LOCATION_ID } = useProjectContext();
  const BIBLE_URI = `agent://location-scout/bible/${LOCATION_ID}`;
  const ANCHOR_URI = `agent://location-scout/anchor/${LOCATION_ID}`;
  // Backend HTTP routes resolve the storage namespace via ?project_id=… —
  // without it the route falls back to default-project and would pick up
  // another project's artifacts. Cache-bust is appended at the use site
  // because it changes per render.
  const artifactUrl = (type: "anchor" | "floorplan" | "isometric", cacheBust?: number) =>
    buildArtifactUrl(type, `${LOCATION_ID}.png`, projectId, cacheBust);
  const ANCHOR_IMG_PATH = artifactUrl("anchor");
  const FLOORPLAN_IMG_PATH = artifactUrl("floorplan");
  const ISOMETRIC_IMG_PATH = artifactUrl("isometric");

  const [bibleBoot, setBibleBoot] = useState<BibleBootState>({ kind: "checking" });
  // Bumped to force a Bible re-check + re-trigger after the user clicks Retry.
  const [bibleRetryNonce, setBibleRetryNonce] = useState(0);

  // Setup extraction — drives the "Extract Setups" button in the Setup
  // Extraction card. Replaces the dead "Manual Input?" affordance that shipped
  // in v1.0.31-v1.0.35; with no handler the user had no way to populate
  // state.setups.tiles and the /setups page rendered a TypeError.
  type ExtractState =
    | { kind: "idle" }
    | { kind: "running"; status: TaskStatus | null; task_id?: string }
    | { kind: "ready"; count: number }
    | { kind: "error"; message: string };
  const [extract, setExtract] = useState<ExtractState>({ kind: "idle" });

  const [anchor, setAnchor] = useState<AnchorState>({ kind: "missing" });
  const [floorplan, setFloorplan] = useState<AnchorState>({ kind: "missing" });
  const [isometric, setIsometric] = useState<AnchorState>({ kind: "missing" });
  const [floorplanOverlayOpen, setFloorplanOverlayOpen] = useState(false);
  const [isometricOverlayOpen, setIsometricOverlayOpen] = useState(false);
  const [anchorOverlayOpen, setAnchorOverlayOpen] = useState(false);
  // Iso prompt starts closed so the Floorplan card can lock to the closed
  // Isometric height before the user expands it.
  const [isoPromptOpen, setIsoPromptOpen] = useState(false);
  const [anchorPromptOpen, setAnchorPromptOpen] = useState(true);

  // Floorplan card pins to the height the Isometric column has while its
  // prompt panel is closed — so Floorplan stays the same regardless of
  // whether the user expands/collapses the Isometric prompt.
  const [floorplanLockedHeight, setFloorplanLockedHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (isoPromptOpen) return; // only measure in the closed state
    const el = isometricCardRef.current;
    if (!el) return;
    const measure = () => setFloorplanLockedHeight(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isoPromptOpen, isometric.kind]);

  // User-editable prompts (pre-filled from the latest sidecar entry)
  const [isometricPrompt, setIsometricPrompt] = useState("");
  const [anchorPrompt, setAnchorPrompt] = useState("");

  // Remember the text we last dropped in via ✦ Auto-fill so we can detect
  // "user edited since last auto-fill" and show a confirm before clobbering.
  const [anchorAutoFillBase, setAnchorAutoFillBase] = useState<string | null>(null);
  const [isometricAutoFillBase, setIsometricAutoFillBase] = useState<string | null>(null);

  const assemble = useAssemblePrompt();

  const handleAnchorAutoFill = async () => {
    const hasUnsavedEdits =
      anchorPrompt.trim().length > 0 &&
      anchorAutoFillBase !== null &&
      anchorPrompt !== anchorAutoFillBase;
    if (hasUnsavedEdits) {
      const ok = window.confirm(
        "Overwrite your edits with auto-filled text from the Location Bible?",
      );
      if (!ok) return;
    }
    const result = await assemble.assembleAnchor(BIBLE_URI);
    if (result) {
      setAnchorPrompt(result.prompt);
      setAnchorAutoFillBase(result.prompt);
    }
  };

  const handleIsometricAutoFill = async () => {
    const hasUnsavedEdits =
      isometricPrompt.trim().length > 0 &&
      isometricAutoFillBase !== null &&
      isometricPrompt !== isometricAutoFillBase;
    if (hasUnsavedEdits) {
      const ok = window.confirm(
        "Overwrite your edits with auto-filled text from the Location Bible?",
      );
      if (!ok) return;
    }
    const result = await assemble.assembleIsometric(
      BIBLE_URI,
      `agent://location-scout/floorplan/${LOCATION_ID}`,
    );
    if (result) {
      setIsometricPrompt(result.prompt);
      setIsometricAutoFillBase(result.prompt);
    }
  };

  // Gallery state (prior versions) for each kind.
  const anchorGallery = useGallery("anchor", LOCATION_ID);
  const isometricGallery = useGallery("isometric", LOCATION_ID);
  const [anchorSelectedId, setAnchorSelectedId] = useState<string | null>(null);
  const [isometricSelectedId, setIsometricSelectedId] = useState<string | null>(null);

  // Reference picker state — extra refs attached by the user on top of the
  // default img2img cascade (floorplan→isometric→anchor).
  //
  // Persisted to localStorage (per project+location+kind) because the backend
  // sidecar contract (prompt-gallery-contract §1, `references` field) is NOT
  // populated by generate_anchor / generate_isometric_reference today — only
  // generate_setup_images writes ref tokens. Without this client-side cache,
  // closing+reopening the iframe loses the refs the user attached, even though
  // the image they generated is preserved (Bug refs-lost, 2026-05-19). This is
  // a UI-side workaround; the proper fix is to persist `references` in the
  // anchor/isometric sidecar — tracked separately, server-side.
  const anchorRefsKey = `ls.anchor_refs.${projectId}.${LOCATION_ID}`;
  const isometricRefsKey = `ls.isometric_refs.${projectId}.${LOCATION_ID}`;
  const [anchorRefs, setAnchorRefs] = useState<ReferenceRef[]>(() => {
    try {
      const raw = localStorage.getItem(anchorRefsKey);
      return raw ? (JSON.parse(raw) as ReferenceRef[]) : [];
    } catch { return []; }
  });
  const [isometricRefs, setIsometricRefs] = useState<ReferenceRef[]>(() => {
    try {
      const raw = localStorage.getItem(isometricRefsKey);
      return raw ? (JSON.parse(raw) as ReferenceRef[]) : [];
    } catch { return []; }
  });

  // Persist refs to localStorage on change. Keep keys project+location scoped
  // so other projects' refs never leak in.
  useEffect(() => {
    try {
      if (anchorRefs.length === 0) localStorage.removeItem(anchorRefsKey);
      else localStorage.setItem(anchorRefsKey, JSON.stringify(anchorRefs));
    } catch { /* quota / private mode */ }
  }, [anchorRefs, anchorRefsKey]);
  useEffect(() => {
    try {
      if (isometricRefs.length === 0) localStorage.removeItem(isometricRefsKey);
      else localStorage.setItem(isometricRefsKey, JSON.stringify(isometricRefs));
    } catch { /* quota / private mode */ }
  }, [isometricRefs, isometricRefsKey]);

  // ─── Edit mode state (see updates/edit-mode-contract.md) ───
  const [anchorEditMode, setAnchorEditMode] = useState(false);
  const [anchorEditBaseId, setAnchorEditBaseId] = useState<string | null>(null);
  const [anchorSavedPrompt, setAnchorSavedPrompt] = useState("");
  const [isometricEditMode, setIsometricEditMode] = useState(false);
  const [isometricEditBaseId, setIsometricEditBaseId] = useState<string | null>(null);
  const [isometricSavedPrompt, setIsometricSavedPrompt] = useState("");
  const anchorCardRef = useRef<HTMLDivElement | null>(null);
  const isometricCardRef = useRef<HTMLDivElement | null>(null);

  const enterAnchorEdit = (imageId: string | null) => {
    setAnchorSavedPrompt(anchorPrompt);
    setAnchorPrompt("");
    setAnchorEditBaseId(imageId);
    setAnchorEditMode(true);
  };
  const toggleAnchorEdit = () => {
    if (!anchorEditMode) {
      const baseId = anchorSelectedId ?? anchorGallery.versions[0]?.image_id ?? null;
      enterAnchorEdit(baseId);
    } else {
      setAnchorPrompt(anchorSavedPrompt);
      setAnchorSavedPrompt("");
      setAnchorEditBaseId(null);
      setAnchorEditMode(false);
    }
  };
  const handleAnchorEditFromVersion = (imageId: string) => {
    enterAnchorEdit(imageId);
    anchorCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const enterIsometricEdit = (imageId: string | null) => {
    setIsometricSavedPrompt(isometricPrompt);
    setIsometricPrompt("");
    setIsometricEditBaseId(imageId);
    setIsometricEditMode(true);
  };
  const toggleIsometricEdit = () => {
    if (!isometricEditMode) {
      const baseId = isometricSelectedId ?? isometricGallery.versions[0]?.image_id ?? null;
      enterIsometricEdit(baseId);
    } else {
      setIsometricPrompt(isometricSavedPrompt);
      setIsometricSavedPrompt("");
      setIsometricEditBaseId(null);
      setIsometricEditMode(false);
    }
  };
  const handleIsometricEditFromVersion = (imageId: string) => {
    enterIsometricEdit(imageId);
    isometricCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Pre-fill textareas from the newest sidecar once a gallery loads, but only
  // when the user hasn't started typing (don't clobber their edits).
  useEffect(() => {
    if (!anchorPrompt && anchorGallery.versions[0]?.prompt) {
      setAnchorPrompt(anchorGallery.versions[0].prompt);
    }
    if (!anchorSelectedId && anchorGallery.versions[0]) {
      setAnchorSelectedId(anchorGallery.versions[0].image_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorGallery.versions]);

  useEffect(() => {
    if (!isometricPrompt && isometricGallery.versions[0]?.prompt) {
      setIsometricPrompt(isometricGallery.versions[0].prompt);
    }
    if (!isometricSelectedId && isometricGallery.versions[0]) {
      setIsometricSelectedId(isometricGallery.versions[0].image_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isometricGallery.versions]);

  // ─── Eager Bible bootstrap ─────────────────────────────────────────────
  // On mount (and on Retry), check if a Location Bible already exists for
  // this location_id. If yes → mark ready (no-op for the rest of the page).
  // If no → kick off scout_location and poll until terminal. Idempotent:
  // re-mounts and tab switches re-attach to the in-flight task via
  // sessionStorage rather than firing a second pipeline.
  useEffect(() => {
    let cancelled = false;
    const key = bibleTaskKey(LOCATION_ID);
    const errKey = bibleErrorKey(LOCATION_ID);

    // Centralized error-setter that ALSO stamps a sticky sessionStorage flag
    // so subsequent re-mounts surface the same error instead of re-firing the
    // pipeline. Retry clears it (see retryBibleBoot).
    const setBibleError = (message: string) => {
      try { sessionStorage.setItem(errKey, message); } catch { /* quota / private */ }
      setBibleBoot({ kind: "error", message });
    };

    const pollExistingTask = async (taskId: string) => {
      setBibleBoot({ kind: "generating", status: null, task_id: taskId });
      try {
        const final = await pollTask(
          taskId,
          (s) => {
            if (!cancelled) setBibleBoot({ kind: "generating", status: s, task_id: taskId });
          },
          2000,
          240000,
        );
        if (cancelled) return;
        sessionStorage.removeItem(key);
        if (final.status === "failed") {
          setBibleError(final.error || "Bible generation failed");
          return;
        }
        // Re-verify the artifact landed before flipping to ready — guards
        // against the rare case where the task says completed but the DB
        // write hasn't propagated.
        const verify = await callTool<Record<string, unknown> & { error?: string }>(
          "get_bible",
          { bible_id: LOCATION_ID },
        );
        if (cancelled) return;
        if (verify.data && !verify.data.error) {
          setBibleBoot({ kind: "ready" });
          sessionStorage.removeItem(errKey);
        } else {
          setBibleError("Pipeline reported success but Bible is not readable. Try again.");
        }
      } catch (err) {
        if (cancelled) return;
        sessionStorage.removeItem(key);
        setBibleError(err instanceof Error ? err.message : String(err));
      }
    };

    const run = async () => {
      // 1. Does the bible already exist? This is the rehydrate path — covers
      // the References → Setups → References remount where component state is
      // reset but the Bible artifact is intact in PG/S3 (Bug X-2).
      try {
        const res = await callTool<Record<string, unknown> & { error?: string }>(
          "get_bible",
          { bible_id: LOCATION_ID },
        );
        if (cancelled) return;
        if (res.data && !res.data.error) {
          setBibleBoot({ kind: "ready" });
          // Clear any stale task pointer + sticky error — bible is here.
          sessionStorage.removeItem(key);
          sessionStorage.removeItem(errKey);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        setBibleError(`Failed to check Bible: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      // Bible genuinely missing. If scout_location already failed once for
      // this project+location in this session (e.g. 1AD has no upstream
      // location-brief), surface the cached error instead of re-firing the
      // pipeline — Retry clears the sticky error and forces a fresh attempt.
      const stickyError = sessionStorage.getItem(errKey);
      if (stickyError) {
        if (!cancelled) setBibleBoot({ kind: "error", message: stickyError });
        return;
      }

      // 2. Bible missing. Is a scout_location task already running?
      const existing = sessionStorage.getItem(key);
      if (existing) {
        try {
          const probe = await callTool<TaskStatus & { error?: string }>(
            "get_task_status",
            { task_id: existing },
          );
          const status = probe.data?.status;
          if (status === "accepted" || status === "processing") {
            await pollExistingTask(existing);
            return;
          }
          // Otherwise the cached task is stale (completed-but-no-bible, failed,
          // or unknown) — drop it and start fresh.
          sessionStorage.removeItem(key);
        } catch {
          sessionStorage.removeItem(key);
        }
      }

      // 3. Start a fresh scout_location task. We pass project_id + the storage-
      // side location_id only — the backend auto-resolves the brief + director
      // vision via MCP from upstream agents (AGENT_1AD_URL, AGENT_DIRECTOR_URL)
      // and saves the resulting Bible under our location_id so the get_bible
      // lookup above finds it.
      //
      // We do NOT pass location_name: 1AD-side briefs use human-readable names
      // ("BAR", "MARLOWE'S OFFICE") whereas our LOCATION_ID is a slug
      // ("loc_<project_id>"); supplying the slug as a name hint guarantees the
      // matcher misses and the demo path errors. Leaving location_name unset
      // makes the backend pick the first available brief, which is correct for
      // the demo path where the user hasn't picked a specific location yet.
      setBibleBoot({ kind: "generating", status: null, task_id: "" });
      try {
        const result = await callTool<{ task_id?: string; error?: string }>(
          "scout_location",
          {
            project_id: projectId,
            location_id: LOCATION_ID,
            priority: "normal",
          },
        );
        if (cancelled) return;
        const taskId = result.data?.task_id;
        if (!taskId) {
          const errMsg =
            (typeof result.data?.error === "string" && result.data.error) ||
            "scout_location returned no task_id (upstream brief may be missing)";
          setBibleError(errMsg);
          return;
        }
        sessionStorage.setItem(key, taskId);
        await pollExistingTask(taskId);
      } catch (err) {
        if (cancelled) return;
        setBibleError(err instanceof Error ? err.message : String(err));
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LOCATION_ID, projectId, bibleRetryNonce]);

  const retryBibleBoot = () => {
    sessionStorage.removeItem(bibleTaskKey(LOCATION_ID));
    sessionStorage.removeItem(bibleErrorKey(LOCATION_ID));
    setBibleBoot({ kind: "checking" });
    setBibleRetryNonce((n) => n + 1);
  };

  const anchorPromptUsed = anchorGallery.versions[0]?.prompt ?? null;
  const isometricPromptUsed = isometricGallery.versions[0]?.prompt ?? null;

  const checkExists = async (path: string): Promise<boolean> => {
    try {
      const res = await fetch(path, { method: "HEAD", cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  };

  /** HEAD the artifact endpoint to see if an anchor already exists. */
  const checkAnchorExists = () => checkExists(ANCHOR_IMG_PATH);

  /** Fire generate_anchor and poll until terminal. Requires isometric to exist first. */
  const runGeneration = async (promptOverride?: string) => {
    // Hard gate: isometric must exist before anchor can be generated
    const isoExists = await checkExists(ISOMETRIC_IMG_PATH);
    if (!isoExists) {
      setAnchor({ kind: "error", message: "Isometric reference required. Generate floorplan + isometric first." });
      return;
    }
    setAnchor({ kind: "generating", status: null });
    try {
      const result = await callTool<{ task_id: string }>("generate_anchor", {
        bible_uri: BIBLE_URI,
        generation_params: { quality: "high" },
        ...(promptOverride?.trim() ? { prompt_override: promptOverride.trim() } : {}),
        ...(anchorRefs.length > 0 && !anchorEditMode ? { reference_images: anchorRefs } : {}),
        ...(anchorEditMode
          ? {
              edit_mode: {
                enabled: true,
                ...(anchorEditBaseId ? { base_image_id: anchorEditBaseId } : {}),
              },
            }
          : {}),
      });
      const taskId = result.data?.task_id;
      if (!taskId) {
        setAnchor({ kind: "error", message: "generate_anchor returned no task_id" });
        return;
      }
      setAnchor({ kind: "generating", status: null, task_id: taskId });
      const final = await pollTask(
        taskId,
        (s) => setAnchor({ kind: "generating", status: s, task_id: taskId }),
        1000,
        180000,
      );
      if (final.status === "failed") {
        setAnchor({ kind: "error", message: final.error || "Image generation failed" });
        return;
      }
      if ((final as any).prompt_used) setAnchorPrompt((final as any).prompt_used);
      // Confirm the image is now reachable, then flip to ready.
      const exists = await checkAnchorExists();
      if (!exists) {
        setAnchor({
          kind: "error",
          message: "Backend reported success but no image at /artifacts/anchor — check storage",
        });
        return;
      }
      setAnchor({ kind: "ready", cacheBust: Date.now() });
      // Pull the new sidecar into the gallery and auto-select it as newest.
      const refreshed = await anchorGallery.refresh();
      setAnchorSelectedId(null);
      // After a successful edit: clear the textarea and re-point the base to
      // the freshly-generated version so chained edits (v1 → v2 → v3) work.
      if (anchorEditMode) {
        setAnchorPrompt("");
        const newest = refreshed[0]?.image_id ?? null;
        if (newest) setAnchorEditBaseId(newest);
      }
    } catch (err) {
      setAnchor({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  // Rehydrate floorplan / isometric / anchor from disk on mount + when the
  // project context changes. The previous "fresh-start" rule was too broad:
  // PipelineState lives in sessionStorage (since the 2026-05-16 fix) but
  // these three card states are component-local, so closing the iframe and
  // reopening the modal lost them. The cross-project leak risk that
  // motivated the original block is already handled by `buildArtifactUrl`
  // pinning every request to `?project_id=` — a different project sees a
  // genuine 404 here, not a stale image.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [fp, iso, anc] = await Promise.all([
        checkExists(FLOORPLAN_IMG_PATH),
        checkExists(ISOMETRIC_IMG_PATH),
        checkExists(ANCHOR_IMG_PATH),
      ]);
      if (cancelled) return;
      const now = Date.now();
      if (fp) setFloorplan({ kind: "ready", cacheBust: now });
      if (iso) setIsometric({ kind: "ready", cacheBust: now });
      if (anc) setAnchor({ kind: "ready", cacheBust: now });
    })();
    return () => { cancelled = true; };
    // checkExists is a stable closure (no deps); the URLs are derived from
    // LOCATION_ID + projectId, which we list explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [LOCATION_ID, projectId]);

  const handleRegenerateAnchor = useDebouncedAction(async () => {
    runGeneration(anchorPrompt || undefined);
  });

  // ─── Floorplan: user-triggered via the Generate button ──────────
  const runFloorplan = async () => {
    setFloorplan({ kind: "generating", status: null });
    try {
      const result = await callTool<{ task_id: string }>("create_floorplan", { bible_uri: BIBLE_URI });
      const taskId = result.data?.task_id;
      if (!taskId) { setFloorplan({ kind: "error", message: "create_floorplan returned no task_id" }); return; }
      setFloorplan({ kind: "generating", status: null, task_id: taskId });
      const final = await pollTask(taskId, (s) => setFloorplan({ kind: "generating", status: s, task_id: taskId }), 1000, 60000);
      if (final.status === "failed") { setFloorplan({ kind: "error", message: final.error || "Floorplan generation failed" }); return; }
      const exists = await checkExists(FLOORPLAN_IMG_PATH);
      setFloorplan(exists ? { kind: "ready", cacheBust: Date.now() } : { kind: "error", message: "Floorplan generated but not reachable" });
    } catch (err) { setFloorplan({ kind: "error", message: err instanceof Error ? err.message : String(err) }); }
  };

  // Floorplan does not auto-generate. Mount-rehydration (above) flips it
  // to `ready` if a previously-generated PNG exists for this project_id;
  // otherwise the user clicks Generate.

  // ─── Isometric: user-triggered via the Generate button ─────────
  const runIsometric = async (promptOverride?: string) => {
    setIsometric({ kind: "generating", status: null });
    try {
      const result = await callTool<{ task_id: string }>("generate_isometric_reference", {
        floorplan_uri: `agent://location-scout/floorplan/${LOCATION_ID}`,
        bible_uri: BIBLE_URI,
        ...(promptOverride?.trim() ? { prompt_override: promptOverride.trim() } : {}),
        ...(isometricRefs.length > 0 && !isometricEditMode ? { reference_images: isometricRefs } : {}),
        ...(isometricEditMode
          ? {
              edit_mode: {
                enabled: true,
                ...(isometricEditBaseId ? { base_image_id: isometricEditBaseId } : {}),
              },
            }
          : {}),
      });
      const taskId = result.data?.task_id;
      if (!taskId) { setIsometric({ kind: "error", message: "generate_isometric returned no task_id" }); return; }
      setIsometric({ kind: "generating", status: null, task_id: taskId });
      const final = await pollTask(taskId, (s) => setIsometric({ kind: "generating", status: s, task_id: taskId }), 1500, 120000);
      if (final.status === "failed") { setIsometric({ kind: "error", message: final.error || "Isometric generation failed" }); return; }
      if ((final as any).prompt_used) setIsometricPrompt((final as any).prompt_used);
      const exists = await checkExists(ISOMETRIC_IMG_PATH);
      setIsometric(exists ? { kind: "ready", cacheBust: Date.now() } : { kind: "error", message: "Isometric generated but not reachable" });
      const refreshed = await isometricGallery.refresh();
      setIsometricSelectedId(null);
      if (isometricEditMode) {
        setIsometricPrompt("");
        const newest = refreshed[0]?.image_id ?? null;
        if (newest) setIsometricEditBaseId(newest);
      }
    } catch (err) { setIsometric({ kind: "error", message: err instanceof Error ? err.message : String(err) }); }
  };

  // Fresh-start contract: isometric stays empty until the user presses
  // Generate (no S3 auto-load on floorplan transition).

  const handleApprove = async () => {
    dispatch({ type: "APPROVE_STAGE", stage: "references" });
    try {
      const r = await callTool("approve_artifact", {
        artifact_uri: ANCHOR_URI,
        notes: "Anchor approved from References UI",
      });
      console.log("[approve_artifact anchor] →", r.data);
    } catch (err) {
      console.error("[approve_artifact anchor] failed:", err);
    }
    navigate("/setups");
  };

  /**
   * Trigger backend extract_setups. Floorplan must exist (hard gate). On
   * success we resolve each artifact URI to a SetupTile by reading the
   * /artifacts/setup/<id>.json sidecar and stamping scene + mood so the
   * Setups page tiles render with real data instead of empty pills.
   */
  const handleExtractSetups = async () => {
    if (floorplan.kind !== "ready") {
      setExtract({ kind: "error", message: "Generate the floorplan first — setups depend on it." });
      return;
    }
    setExtract({ kind: "running", status: null });
    try {
      const r = await callTool<{ task_id: string }>("extract_setups", {
        floorplan_uri: `agent://location-scout/floorplan/${LOCATION_ID}`,
        mood_state_uris: [],
        project_id: projectId,
      });
      const taskId = r.data?.task_id;
      if (!taskId) {
        setExtract({ kind: "error", message: "extract_setups returned no task_id" });
        return;
      }
      setExtract({ kind: "running", status: null, task_id: taskId });
      const final = await pollTask(
        taskId,
        (s) => setExtract({ kind: "running", status: s, task_id: taskId }),
        1500,
        180000,
      );
      if (final.status === "failed") {
        setExtract({ kind: "error", message: final.error || "Extract failed" });
        return;
      }
      const artifacts = (final as { artifacts?: Array<{ uri: string }> }).artifacts ?? [];
      if (artifacts.length === 0) {
        setExtract({ kind: "error", message: "No setups produced — the LLM returned an empty plan." });
        return;
      }
      const tiles = await Promise.all(
        artifacts.map(async (a) => {
          const sid = a.uri.split("/").pop() || "";
          try {
            const url = `/artifacts/setup/${sid}.json?project_id=${encodeURIComponent(projectId)}`;
            const resp = await fetch(url, { cache: "no-store" });
            if (!resp.ok) return { id: sid, status: "none" as const, scene: "", mood: "" };
            const data = await resp.json() as Record<string, unknown>;
            return {
              id: sid,
              status: "none" as const,
              scene: (typeof data.scene_id === "string" && data.scene_id) || (typeof data.setup_name === "string" && data.setup_name) || "",
              mood: (typeof data.mood === "string" && data.mood) || (typeof data.mood_id === "string" && data.mood_id) || "",
            };
          } catch {
            return { id: sid, status: "none" as const, scene: "", mood: "" };
          }
        }),
      );
      dispatch({ type: "SET_SETUPS_TILES", tiles });
      setExtract({ kind: "ready", count: tiles.length });
    } catch (err) {
      setExtract({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const isGenerating = anchor.kind === "generating" || anchor.kind === "checking";
  const canApprove = anchor.kind === "ready";

  /** Anchor image slot — renders different states cleanly. */
  const renderAnchorSlot = () => {
    if (anchor.kind === "ready") {
      return (
        <img
          src={`${artifactUrl("anchor", anchor.cacheBust)}`}
          alt="Anchor reference"
          style={{
            width: "100%",
            borderRadius: 8,
            display: "block",
            background: "var(--border)",
          }}
        />
      );
    }

    if (anchor.kind === "error") {
      return (
        <div
          className="placeholder-box placeholder-box--tall"
          style={{
            background: "rgba(220,60,60,0.08)",
            borderColor: "rgba(220,60,60,0.4)",
            color: "var(--red)",
            textAlign: "center",
            padding: 16,
          }}
        >
          ✗ {anchor.message}
        </div>
      );
    }

    // missing | generating
    const step =
      anchor.kind === "generating" && anchor.status?.current_step
        ? anchor.status.current_step
        : anchor.kind === "missing"
        ? "Press Generate to create the anchor"
        : "Starting image generation…";
    const progress =
      anchor.kind === "generating" && anchor.status?.progress !== undefined
        ? Math.round((anchor.status.progress ?? 0) * 100)
        : null;

    return (
      <div
        className="placeholder-box placeholder-box--tall"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 28 }} aria-hidden>
          {anchor.kind === "missing" ? "✦" : "⏳"}
        </div>
        <div style={{ fontSize: 13 }}>{step}</div>
        {progress !== null && (
          <div
            style={{
              width: "70%",
              height: 4,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "var(--accent)",
                transition: "width 200ms ease",
              }}
            />
          </div>
        )}
        {progress !== null && <div style={{ fontSize: 11, opacity: 0.7 }}>{progress}%</div>}
        {anchor.kind === "generating" && anchor.task_id && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => anchor.kind === "generating" && anchor.task_id && cancelTask(anchor.task_id)}
          >
            Cancel
          </button>
        )}
      </div>
    );
  };

  // Show the BibleProgressPanel while we're checking for the bible or actively
  // generating one. Errors render as a separate banner with Retry. Once the
  // bible is ready, neither block renders and the page behaves exactly as
  // before (existing floorplan/iso/anchor gates remain the source of truth
  // for their own enablement).
  const bibleBannerVisible =
    bibleBoot.kind === "checking" || bibleBoot.kind === "generating";

  return (
    <div className="input-page" data-figma-node="433:26">
      {bibleBannerVisible && (
        <BibleProgressPanel
          progress={
            bibleBoot.kind === "generating" && bibleBoot.status?.progress !== undefined
              ? bibleBoot.status.progress
              : 0
          }
          currentStep={
            bibleBoot.kind === "checking"
              ? "Checking for existing Location Bible…"
              : bibleBoot.status?.current_step || "Starting location scouting pipeline…"
          }
        />
      )}
      {bibleBoot.kind === "error" && (
        <div
          className="banner banner--gate"
          role="alert"
          style={{
            borderColor: "rgba(220,60,60,0.5)",
            background: "rgba(220,60,60,0.08)",
          }}
        >
          <span className="banner__icon" aria-hidden>✗</span>
          <span className="banner__title">
            Location Bible generation failed: {bibleBoot.message}
          </span>
          <span className="banner__spacer" />
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={retryBibleBoot}
          >
            Retry
          </button>
        </div>
      )}
      {floorplanOverlayOpen && floorplan.kind === "ready" && (
        <ImageOverlay
          src={`${artifactUrl("floorplan", floorplan.cacheBust)}`}
          onClose={() => setFloorplanOverlayOpen(false)}
        />
      )}
      {isometricOverlayOpen && isometric.kind === "ready" && (
        <ImageOverlay
          src={`${artifactUrl("isometric", isometric.cacheBust)}`}
          onClose={() => setIsometricOverlayOpen(false)}
        />
      )}
      {anchorOverlayOpen && anchor.kind === "ready" && (
        <ImageOverlay
          src={`${artifactUrl("anchor", anchor.cacheBust)}`}
          onClose={() => setAnchorOverlayOpen(false)}
        />
      )}

      {/* ───── Top row: Floorplan + Isometric ───── */}
      <div className="columns-2">
        <div
          className="input-page__column"
          style={floorplanLockedHeight ? { height: floorplanLockedHeight } : undefined}
        >
          <div className="section-header">
            <span className="section-header__title">Floorplan</span>
            <span className="tech-badge tech-badge--muted">PYTHON + FFmpeg</span>
          </div>
          <article className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="card__body" style={{ gap: "var(--sp-2)", flex: 1, minHeight: 0 }}>
              {floorplan.kind === "ready" ? (
                <img
                  src={`${artifactUrl("floorplan", floorplan.cacheBust)}`}
                  alt="Floorplan"
                  onClick={() => setFloorplanOverlayOpen(true)}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    display: "block",
                    cursor: "zoom-in",
                  }}
                />
              ) : floorplan.kind === "error" ? (
                <div className="placeholder-box placeholder-box--tall" style={{ borderColor: "rgba(220,60,60,0.5)" }}>
                  <span style={{ color: "var(--red)" }}>{"✗ "}{floorplan.message}</span>
                </div>
              ) : (
                <div className="placeholder-box placeholder-box--tall" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span>{floorplan.kind === "generating" ? `Generating floorplan… ${floorplan.status?.current_step ?? ""}` : "Press Generate to create the floorplan"}</span>
                  {floorplan.kind === "generating" && floorplan.task_id && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => floorplan.kind === "generating" && floorplan.task_id && cancelTask(floorplan.task_id)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
              <div className="metric-row" style={{ marginTop: "auto" }}>
                <span className="metric-row__label">{r.floorplanSize}</span>
                <span className="page-footer__spacer" />
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={floorplan.kind === "generating"}
                  onClick={() => runFloorplan()}
                >
                  {floorplan.kind === "generating"
                    ? "Generating…"
                    : floorplan.kind === "ready"
                      ? "Regenerate"
                      : "Generate"}
                </button>
              </div>
            </div>
          </article>
        </div>

        <div className="input-page__column" ref={isometricCardRef}>
          <div className="section-header">
            <span className="section-header__title">Isometric Reference</span>
            <span className="tech-badge tech-badge--muted">NANOBANANA</span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--sp-2)" }}>
              {isometric.kind === "error" && (
                <div className="placeholder-box" style={{ borderColor: "rgba(220,60,60,0.5)", color: "var(--red)", marginBottom: "var(--sp-2)" }}>
                  ✗ {isometric.message}
                </div>
              )}

              {/* Image — always visible (independent of prompt collapse) */}
              {isometric.kind === "ready" ? (
                <img
                  src={`${artifactUrl("isometric", isometric.cacheBust)}`}
                  alt="Isometric preview"
                  onClick={() => setIsometricOverlayOpen(true)}
                  style={{ width: "100%", borderRadius: 8, display: "block", background: "var(--border)", cursor: "zoom-in" }}
                />
              ) : (
                <div className="placeholder-box placeholder-box--tall" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isometric.kind === "generating"
                    ? `Generating isometric… ${isometric.status?.current_step ?? ""}`
                    : floorplan.kind === "ready"
                      ? "Press Generate to create the isometric"
                      : "Generate the floorplan first"}
                </div>
              )}

              {isometric.kind === "generating" && isometric.task_id && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => isometric.kind === "generating" && isometric.task_id && cancelTask(isometric.task_id)}
                >
                  Cancel
                </button>
              )}

              {/* Collapse toggle — controls prompt + references visibility */}
              <div style={{ display: "flex", alignItems: "center", height: 32 }}>
                <button
                  type="button"
                  onClick={() => setIsoPromptOpen((o) => !o)}
                  aria-expanded={isoPromptOpen}
                  aria-controls="isometric-prompt-body"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text)",
                    cursor: "pointer",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
                  <span aria-hidden style={{ display: "inline-block", width: 10 }}>
                    {isoPromptOpen ? "▼" : "▶"}
                  </span>
                  <span>Prompt</span>
                </button>
              </div>

              {isoPromptOpen && (
                <div id="isometric-prompt-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                  {/* Prompt textarea */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {isometricEditMode ? "What to change" : "Generation prompt"}
                      </label>
                      {!isometricEditMode && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={handleIsometricAutoFill}
                          disabled={assemble.busy || isometric.kind === "generating"}
                          style={{ fontSize: 11, padding: "2px 8px" }}
                          title="Preview the prompt that would be sent, filled from the Location Bible"
                        >
                          {assemble.busy ? "…" : "✦ Auto-fill from Bibles"}
                        </button>
                      )}
                    </div>
                    <textarea
                      value={isometricPrompt}
                      onChange={(e) => setIsometricPrompt(e.target.value)}
                      placeholder={
                        isometricEditMode
                          ? "Describe what to change… e.g. add golden-hour sunset through window"
                          : "Auto-filled after first generation — edit to customise next run"
                      }
                      rows={3}
                      disabled={isometric.kind === "generating" || floorplan.kind !== "ready"}
                      style={{
                        width: "100%",
                        resize: "vertical",
                        fontFamily: "ui-monospace, Menlo, monospace",
                        fontSize: 12,
                        lineHeight: 1.45,
                        background: "var(--bg-input, rgba(255,255,255,0.04))",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        padding: "6px 8px",
                        color: "var(--text-primary)",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* References — moved above the action buttons */}
                  <ReferencePicker
                    entity_id={LOCATION_ID}
                    bible_id={LOCATION_ID}
                    setup_ids={state.setups.tiles.map((t) => t.id)}
                    value={isometricRefs}
                    onChange={setIsometricRefs}
                    lockedAutoRefs={
                      floorplan.kind === "ready"
                        ? [
                            {
                              parentLabel: "floorplan",
                              imageUrl: `${artifactUrl("floorplan", floorplan.cacheBust)}`,
                              kind: "external",
                            },
                          ]
                        : undefined
                    }
                    autoCascadeHint={floorplan.kind !== "ready" ? ["floorplan (auto)"] : undefined}
                    label="Refs for isometric"
                    disabled={isometric.kind === "generating"}
                  />

                </div>
              )}

              {/* Edit + Regenerate — always visible (outside collapse) */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    // Entering edit mode → ensure prompt panel is open so the
                    // edit textarea is visible. Cancel keeps current state.
                    if (!isometricEditMode) setIsoPromptOpen(true);
                    toggleIsometricEdit();
                  }}
                  disabled={isometric.kind === "generating" || floorplan.kind !== "ready"}
                  title={isometricEditMode ? "Exit edit mode" : "Edit current isometric"}
                >
                  {isometricEditMode ? "Cancel" : "Edit"}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => runIsometric(isometricPrompt || undefined)}
                  disabled={
                    isometric.kind === "generating" ||
                    floorplan.kind !== "ready" ||
                    (isometricEditMode && isometricPrompt.trim().length === 0)
                  }
                  title={
                    floorplan.kind !== "ready"
                      ? "Disabled — gate not met"
                      : isometricEditMode && isometricPrompt.trim().length === 0
                        ? "Describe what to change"
                        : undefined
                  }
                >
                  {isometric.kind === "generating"
                    ? "Generating…"
                    : isometricEditMode
                      ? "Generate Edit"
                      : isometric.kind === "ready"
                        ? "Regenerate"
                        : "Generate"}
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>

      {/* ───── Bottom row: Anchor Image + Setup Extraction (swapped) ───── */}
      <div className="columns-2">
        <div className="input-page__column" ref={anchorCardRef}>
          <div className="section-header">
            <span className="section-header__title">Anchor Image</span>
            <span className="tech-badge tech-badge--muted">NANOBANANA</span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--sp-2)" }}>
              {anchor.kind === "error" && (
                <div className="placeholder-box" style={{ borderColor: "rgba(220,60,60,0.5)", color: "var(--red)", marginBottom: "var(--sp-2)" }}>
                  ✗ {anchor.message}
                </div>
              )}

              {/* 16:9 wrapper (padding-bottom trick) — reliable across flex parents */}
              <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%" }}>
                {anchor.kind === "ready" ? (
                  <img
                    src={`${artifactUrl("anchor", anchor.cacheBust)}`}
                    alt="Anchor reference"
                    onClick={() => setAnchorOverlayOpen(true)}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: 8,
                      display: "block",
                      background: "var(--border)",
                      cursor: "zoom-in",
                    }}
                  />
                ) : (
                  <div
                    className="placeholder-box"
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                  {anchor.kind === "generating" && anchor.status?.current_step && (
                    <span style={{ fontSize: 12 }}>{anchor.status.current_step}</span>
                  )}
                  {anchor.kind === "generating" && anchor.status?.progress !== undefined && (
                    <>
                      <div style={{ width: "60%", height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${Math.round((anchor.status.progress ?? 0) * 100)}%`,
                            height: "100%",
                            background: "var(--accent)",
                            transition: "width 200ms ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>
                        {Math.round((anchor.status.progress ?? 0) * 100)}%
                      </span>
                    </>
                  )}
                  {anchor.kind === "checking" && <span style={{ fontSize: 12 }}>Checking…</span>}
                  {anchor.kind === "missing" && <span style={{ fontSize: 12, opacity: 0.7 }}>No anchor yet</span>}
                  </div>
                )}
              </div>

              {anchor.kind === "generating" && anchor.task_id && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => anchor.kind === "generating" && anchor.task_id && cancelTask(anchor.task_id)}
                >
                  Cancel
                </button>
              )}

              {/* Collapse toggle */}
              <div style={{ display: "flex", alignItems: "center", height: 32 }}>
                <button
                  type="button"
                  onClick={() => setAnchorPromptOpen((o) => !o)}
                  aria-expanded={anchorPromptOpen}
                  aria-controls="anchor-prompt-body"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text)",
                    cursor: "pointer",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
                  <span aria-hidden style={{ display: "inline-block", width: 10 }}>
                    {anchorPromptOpen ? "▼" : "▶"}
                  </span>
                  <span>Prompt</span>
                </button>
              </div>

              {anchorPromptOpen && (
                <div id="anchor-prompt-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {anchorEditMode ? "What to change" : "Generation prompt"}
                      </label>
                      {!anchorEditMode && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={handleAnchorAutoFill}
                          disabled={assemble.busy || anchor.kind === "generating"}
                          style={{ fontSize: 11, padding: "2px 8px" }}
                          title="Preview the prompt that would be sent, filled from the Location Bible"
                        >
                          {assemble.busy ? "…" : "✦ Auto-fill from Bibles"}
                        </button>
                      )}
                    </div>
                    <textarea
                      value={anchorPrompt}
                      onChange={(e) => setAnchorPrompt(e.target.value)}
                      placeholder={
                        anchorEditMode
                          ? "Describe what to change… e.g. add golden-hour sunset through window"
                          : "Auto-filled after first generation — edit to customise next run"
                      }
                      rows={3}
                      disabled={anchor.kind === "generating" || isometric.kind !== "ready"}
                      style={{
                        width: "100%",
                        resize: "vertical",
                        fontFamily: "ui-monospace, Menlo, monospace",
                        fontSize: 12,
                        lineHeight: 1.45,
                        background: "var(--bg-input, rgba(255,255,255,0.04))",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        padding: "6px 8px",
                        color: "var(--text-primary)",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <ReferencePicker
                    entity_id={LOCATION_ID}
                    bible_id={LOCATION_ID}
                    setup_ids={state.setups.tiles.map((t) => t.id)}
                    value={anchorRefs}
                    onChange={setAnchorRefs}
                    // No lockedAutoRefs on the anchor card: the backend
                    // intentionally runs text-to-image for the anchor
                    // (run-019/020 D, nano-banana ISO ref issues), so
                    // showing a 🔒 ISO pill would lie to the user.
                    // runGeneration only forwards user-attached anchorRefs.
                    autoCascadeHint={isometric.kind !== "ready" ? ["isometric (auto)"] : undefined}
                    label="Refs for anchor"
                    disabled={anchor.kind === "generating" || anchor.kind === "checking"}
                  />
                </div>
              )}

              {/* Edit + Regenerate — always visible */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    if (!anchorEditMode) setAnchorPromptOpen(true);
                    toggleAnchorEdit();
                  }}
                  disabled={anchor.kind === "generating" || isometric.kind !== "ready"}
                  title={anchorEditMode ? "Exit edit mode" : "Edit current anchor"}
                >
                  {anchorEditMode ? "Cancel" : "Edit"}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleRegenerateAnchor}
                  disabled={
                    anchor.kind === "generating" ||
                    anchor.kind === "checking" ||
                    isometric.kind !== "ready" ||
                    (anchorEditMode && anchorPrompt.trim().length === 0)
                  }
                  title={
                    isometric.kind !== "ready"
                      ? "Disabled — gate not met"
                      : anchorEditMode && anchorPrompt.trim().length === 0
                        ? "Describe what to change"
                        : undefined
                  }
                >
                  {anchor.kind === "generating"
                    ? "Generating…"
                    : anchorEditMode
                      ? "Generate Edit"
                      : anchor.kind === "ready"
                        ? "Regenerate"
                        : "Generate"}
                </button>
              </div>
            </div>
          </article>
        </div>

        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Setup Extraction</span>
            <span className="tech-badge tech-badge--green">CLAUDE</span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--sp-2)" }}>
              {state.setups.tiles.length > 0 ? (
                state.setups.tiles.map((s) => (
                  <div key={s.id} className="setup-row">
                    <span className="setup-row__badge">{s.id}</span>
                    <div className="setup-row__info">
                      <span className="setup-row__line">Scene: {s.scene || "—"}</span>
                      <span className="setup-row__sub">Mood: {s.mood || "—"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="placeholder-box" style={{ fontSize: 12, opacity: 0.7, padding: 12 }}>
                  No setups extracted yet
                </div>
              )}

              {extract.kind === "running" && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  ⏳ {extract.status?.current_step ?? "Extracting setups…"}{" "}
                  {extract.status?.progress !== undefined
                    ? `· ${Math.round((extract.status.progress ?? 0) * 100)}%`
                    : ""}
                </div>
              )}
              {extract.kind === "error" && (
                <div
                  role="status"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    background: "rgba(220,60,60,0.08)",
                    border: "1px solid rgba(220,60,60,0.4)",
                    color: "var(--red)",
                  }}
                >
                  ✗ {extract.message}
                </div>
              )}
              {extract.kind === "ready" && (
                <div
                  role="status"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    background: "rgba(166,247,126,0.12)",
                    border: "1px solid rgba(166,247,126,0.4)",
                    color: "#A6F77E",
                  }}
                >
                  ✓ {extract.count} setup{extract.count === 1 ? "" : "s"} extracted —
                  open the <strong>Setups</strong> tab to review.
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleExtractSetups}
                  disabled={extract.kind === "running" || floorplan.kind !== "ready"}
                  title={
                    floorplan.kind !== "ready"
                      ? "Generate the floorplan first — setups depend on it"
                      : state.setups.tiles.length > 0
                        ? "Re-run extraction (overwrites the current setup list)"
                        : "Run extract_setups against the floorplan + Bible"
                  }
                >
                  {extract.kind === "running"
                    ? "Extracting…"
                    : state.setups.tiles.length > 0
                      ? "Re-extract Setups"
                      : "Extract Setups"}
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div className="page-footer">
        <span className="page-footer__spacer" />
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleApprove}
          disabled={!canApprove}
          title={!canApprove ? "Wait for the anchor image to finish generating" : undefined}
        >
          Approve Anchor
          <span className="btn__arrow" aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

