// One-off smoke probe — writes 2 versions of a fake anchor PNG through the
// real storage path so we can inspect the sidecar files on disk. Safe to
// re-run; it uses a dedicated entity_id so it doesn't clobber real data.
// Run: node scripts/smoke-sidecar.mjs
import "dotenv/config";
import { saveImage, listVersions } from "../dist/lib/storage.js";

const entity_id = "smoke_sidecar";
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const v1 = await saveImage("anchor", PNG_HEADER, {
  entity_id,
  prompt: "Cinematic film location photograph. Victorian library, dark mahogany shelves.",
  model: "nano-banana/edit",
  source_tool: "smoke",
});

await new Promise(r => setTimeout(r, 20));

const v2 = await saveImage("anchor", Buffer.concat([PNG_HEADER, Buffer.from([0x01])]), {
  entity_id,
  prompt: "Edit — add coal smoke haze and low gas-lamp warmth.",
  model: "nano-banana/edit",
  source_tool: "smoke",
});

const versions = await listVersions("anchor", entity_id);
console.log(JSON.stringify({ v1_id: v1.image_id, v2_id: v2.image_id, versions_count: versions.length, newest_prompt: versions[0].prompt, oldest_prompt: versions[versions.length - 1].prompt }, null, 2));
