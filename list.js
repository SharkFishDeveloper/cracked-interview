import fg from "fast-glob";
import fs from "fs/promises";
import path from "path";

const ROOT = "C:/Users/shahz/Desktop/cracked";

/**
 * DIRECTORIES & FILES TO IGNORE
 */
const IGNORE_DIRS = [
  // directories
  "node_modules/**",
  ".git/**",
  ".cache/**",
  "dist/**",
  "dist-electron/**",
  ".vite/**",
  "dist-react/**",
  "obs-streamer/**",
  "transcriber-bd/**",

  // specific frontend dist folder
  "frontend/dist-react/**",

  // duplicates (fast-glob is fine with duplicates)
  "**/node_modules/**",
  "**/.git/**",
  "**/.cache/**",
  "**/dist/**",
  "**/dist-electron/**",
  "**/.vite/**",
  "**/obs-streamer/**",
  "**/transcriber-bd/**",

  // skip JS/CSS assets that are auto-generated
  "**/assets/index-*.css",
  "**/assets/index-*.js",

  // skip readme
  "**/README.md",
];

/**
 * Allowed file extensions
 */
const ALLOWED_EXT = [
  ".js", ".jsx", ".ts", ".tsx",
  ".json", ".html", ".css", ".md"
];

function isAllowedExt(file) {
  return ALLOWED_EXT.some(ext => file.endsWith(ext));
}

function limitLines(content, maxLines = 300) {
  const lines = content.split("\n");
  if (lines.length <= maxLines) return content;
  return lines.slice(0, maxLines).join("\n") + "\n\n/* ...TRUNCATED... */";
}

async function listFilesWithContent(dir) {
  console.log("🔍 Scanning files (safe mode)…");

  const paths = await fg(["**/*"], {
    cwd: dir,
    ignore: IGNORE_DIRS,
    dot: true,
    onlyFiles: true,
    unique: true,
  });

  console.log(`📄 Found ${paths.length} candidate files.`);

  const results = [];

  for (const relPath of paths) {
    if (!isAllowedExt(relPath)) continue;

    const full = path.join(dir, relPath);

    const stat = await fs.stat(full);
    if (stat.size > 1_000_000) continue; // skip huge files

    let content = "";
    try {
      content = await fs.readFile(full, "utf8");
    } catch {
      continue;
    }

    results.push({
      path: relPath,
      content: limitLines(content, 100),
    });
  }

  console.log(`✅ Loaded ${results.length} files.`);
  return results;
}

listFilesWithContent(ROOT)
  .then(files => {
    console.log("🎉 DONE");
    console.log(files);
  })
  .catch(err => console.error("❌ ERROR:", err));
