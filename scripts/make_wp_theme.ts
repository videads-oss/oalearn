import fs from "fs";
import path from "path";

async function run() {
  console.log("Fetching WordPress Theme ZIP from local server endpoint...");
  try {
    const res = await fetch("http://localhost:3000/api/download-wp-theme");
    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }
    const buffer = await res.arrayBuffer();
    const dest = path.join(process.cwd(), "officers-academy-theme.zip");
    fs.writeFileSync(dest, Buffer.from(buffer));
    console.log(`[ZIP Exporter] Success! Copied and written to: ${dest}`);
  } catch (err) {
    console.error("[ZIP Exporter] Failed to package ZIP via local server fetch:", err);
  }
}

run();
