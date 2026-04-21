/**
 * ✦ Auto-fill hook — wraps the three read-only "assemble_*_prompt" MCP tools
 * that preview what generate_anchor / generate_isometric_reference /
 * generate_setup_images would send to FAL.ai.
 *
 * UI contract:
 *   1. Button always visible next to each PromptCard (never disclosed).
 *   2. Click re-runs the preview tool and overwrites the textarea.
 *   3. If the user has edited the textarea away from the last-seen auto-fill
 *      (or from the last prompt the backend used), confirm before clobber.
 *
 * The confirmation lives in the page component (where it has access to
 * `window.confirm`); this hook only performs the tool call and returns the
 * filled text.
 */

import { useCallback, useState } from "react";
import { callTool } from "../api/mcp";

interface AssembleResult {
  prompt: string;
  approved: boolean;
  sources: string[];
}

interface SetupInput {
  id: string;
  scene: string;
  mood: string;
  camera?: string;
}

export function useAssemblePrompt() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assembleAnchor = useCallback(async (bibleUri: string): Promise<AssembleResult | null> => {
    setBusy(true);
    setError(null);
    try {
      const result = await callTool<{ prompt: string; approved: boolean; sources: string[]; error?: string; message?: string }>(
        "assemble_anchor_prompt",
        { bible_uri: bibleUri },
      );
      if (!result.data || result.data.error) {
        setError(result.data?.message ?? "assemble_anchor_prompt returned no data");
        return null;
      }
      return {
        prompt: result.data.prompt,
        approved: !!result.data.approved,
        sources: result.data.sources ?? [],
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const assembleIsometric = useCallback(async (bibleUri: string, floorplanUri?: string): Promise<AssembleResult | null> => {
    setBusy(true);
    setError(null);
    try {
      const result = await callTool<{ prompt: string; approved: boolean; sources: string[]; error?: string; message?: string }>(
        "assemble_isometric_prompt",
        floorplanUri ? { bible_uri: bibleUri, floorplan_uri: floorplanUri } : { bible_uri: bibleUri },
      );
      if (!result.data || result.data.error) {
        setError(result.data?.message ?? "assemble_isometric_prompt returned no data");
        return null;
      }
      return {
        prompt: result.data.prompt,
        approved: !!result.data.approved,
        sources: result.data.sources ?? [],
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const assembleSetup = useCallback(async (bibleUri: string, setup: SetupInput): Promise<AssembleResult | null> => {
    setBusy(true);
    setError(null);
    try {
      const result = await callTool<{ prompt: string; approved: boolean; sources: string[]; error?: string; message?: string }>(
        "assemble_setup_prompt",
        { bible_uri: bibleUri, setup },
      );
      if (!result.data || result.data.error) {
        setError(result.data?.message ?? "assemble_setup_prompt returned no data");
        return null;
      }
      return {
        prompt: result.data.prompt,
        approved: !!result.data.approved,
        sources: result.data.sources ?? [],
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, assembleAnchor, assembleIsometric, assembleSetup };
}
