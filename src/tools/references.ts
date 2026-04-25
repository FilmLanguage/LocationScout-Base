/**
 * Reference image tools — user uploads + gallery listing for ReferencePicker.
 *
 * See updates/reference-images-contract.md §4, §9.
 *
 * - upload_reference: save a user-uploaded image as "user-ref/<entity>/<ts>_<uuid>.png"
 *   with a sidecar JSON, return a ReferenceRef the UI can attach to generation calls.
 * - list_user_references: list uploads for an entity (drives the "Local uploads" tab
 *   of the gallery modal).
 * - list_location_images: aggregate anchor + isometric + setup versions under a bible
 *   (drives the "Own gallery" tab, and is consumed by ShotGen across agent boundaries).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { saveImage, listVersions } from "../lib/storage.js";
import type { ReferenceRef } from "@filmlanguage/schemas";
const AGENT_KEY = "location-scout" as const;

export function registerReferenceTools(server: McpServer) {
  server.tool(
    "upload_reference",
    "Upload a user reference image to this agent's gallery. Returns a ReferenceRef with image_id, uri, kind, source_agent. Auto-saves alongside generated images so the next gallery read surfaces it.",
    {
      kind: z.enum(["user_upload", "external"]).default("user_upload"),
      entity_id: z.string().describe("Parent entity (bible_id, setup_id) the ref belongs to"),
      base64_data: z.string().describe("Image bytes, base64-encoded (no data: prefix)"),
      content_type: z.string().default("image/png"),
      note: z.string().optional().describe("Why user uploaded this; shown in gallery"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async ({ kind, entity_id, base64_data, content_type, note }) => {
      const buf = Buffer.from(base64_data, "base64");
      const result = await saveImage(
        "user-ref",
        buf,
        {
          entity_id,
          prompt: note ?? "",
          model: "user_upload",
          source_tool: "upload_reference",
          entity_type: "user_reference",
        },
        content_type,
      );
      const ref: ReferenceRef = {
        image_id: result.image_id,
        uri: result.uri,
        kind,
        source_agent: AGENT_KEY,
        entity_id,
        ...(note ? { prompt: note } : {}),
      };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(ref) }],
      };
    },
  );

  server.tool(
    "list_user_references",
    "List user-uploaded reference images for an entity, newest first. Reads sidecar JSONs from the user-ref/ gallery.",
    {
      entity_id: z.string().describe("Parent entity id (bible_id, setup_id) to filter by"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ entity_id }) => {
      const versions = await listVersions("user-ref", entity_id);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ entity_id, refs: versions }) }],
      };
    },
  );

  server.tool(
    "list_location_images",
    "Aggregate generated location imagery for a Bible: anchor, isometric, and setup versions. Consumed by ShotGeneration's ReferencePicker across the agent boundary, and by LocationScout's own gallery modal.",
    {
      bible_id: z.string().describe("Bible/location id (e.g. loc_001)"),
      setup_ids: z.array(z.string()).optional().describe("Setup ids to include; defaults to none (anchor+isometric only)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ bible_id, setup_ids }) => {
      const [anchor, isometric] = await Promise.all([
        listVersions("anchor", bible_id),
        listVersions("isometric", bible_id),
      ]);
      const setup: Record<string, Awaited<ReturnType<typeof listVersions>>> = {};
      if (setup_ids && setup_ids.length > 0) {
        await Promise.all(
          setup_ids.map(async (sid) => {
            setup[sid] = await listVersions("setup", sid.replace(/\//g, "_"));
          }),
        );
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ bible_id, anchor, isometric, setup }),
        }],
      };
    },
  );
}
