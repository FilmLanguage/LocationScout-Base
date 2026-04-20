import "../src/env.js";
import { saveArtifact } from "../src/lib/storage.js";
import { mirrorArtifactToDb, isDbEnabled, closePool } from "../src/lib/db.js";

async function main() {
  console.log("isDbEnabled:", isDbEnabled());
  if (!isDbEnabled()) {
    console.error("DB vars missing — aborting.");
    process.exit(1);
  }

  const bibleId = "loc_smoke_" + Date.now();
  const payload = {
    $schema: "location-bible-v2",
    bible_id: bibleId,
    location_id: bibleId,
    location_name: "Smoke Test Apartment",
    passport: { type: "INT", era: "2026", scenes: ["SC01"], recurring: false, time_of_day: ["DAY"] },
    space_description: "A bare smoke test room.",
    atmosphere: "test",
    key_details: ["one chair"],
    negative_list: ["no windows", "no doors", "no lights"],
    approval_status: "draft",
  };

  console.log("\n[1] direct mirrorArtifactToDb...");
  const id = await mirrorArtifactToDb("bible", bibleId, payload);
  console.log("   artifact UUID:", id);

  console.log("\n[2] indirect via saveArtifact (full pipeline)...");
  const bibleId2 = "loc_smoke2_" + Date.now();
  const payload2 = { ...payload, bible_id: bibleId2, location_id: bibleId2 };
  const uri = await saveArtifact("bible", bibleId2, payload2);
  console.log("   uri:", uri);
  // Give async mirror a moment to settle
  await new Promise((r) => setTimeout(r, 2000));

  await closePool();
  console.log("\nDONE.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
