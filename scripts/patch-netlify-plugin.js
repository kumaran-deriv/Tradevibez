/**
 * Patches @netlify/plugin-nextjs to use cp+rm instead of rename on Windows.
 *
 * Windows blocks fs.rename() when any process holds a file handle on the
 * directory (VS Code file watcher, Windows Search indexer, etc.).
 * This replaces rename() calls with cp()+rm() in the static content
 * publishing step.
 *
 * Run automatically via npm postinstall, or manually: node scripts/patch-netlify-plugin.js
 */

const fs = require("fs");
const path = require("path");

const TARGET = path.join(
  __dirname,
  "..",
  "node_modules",
  "@netlify",
  "plugin-nextjs",
  "dist",
  "build",
  "content",
  "static.js"
);

if (!fs.existsSync(TARGET)) {
  console.log("⏭  @netlify/plugin-nextjs not installed, skipping patch");
  process.exit(0);
}

let code = fs.readFileSync(TARGET, "utf8");

// Already patched?
if (code.includes("cp+rm instead of rename")) {
  console.log("✔  Netlify plugin already patched");
  process.exit(0);
}

// Patch publishStaticDir
code = code.replace(
  /await rename\(ctx\.publishDir, ctx\.tempPublishDir\);\s*\n\s*await rename\(ctx\.staticDir, ctx\.publishDir\);/,
  `// Use cp+rm instead of rename to avoid EPERM on Windows
    await cp(ctx.publishDir, ctx.tempPublishDir, { recursive: true });
    await rm(ctx.publishDir, { recursive: true, force: true });
    await cp(ctx.staticDir, ctx.publishDir, { recursive: true });
    await rm(ctx.staticDir, { recursive: true, force: true });`
);

// Patch unpublishStaticDir
code = code.replace(
  /await rename\(ctx\.publishDir, ctx\.staticDir\);\s*\n\s*await rename\(ctx\.tempPublishDir, ctx\.publishDir\);/,
  `await cp(ctx.publishDir, ctx.staticDir, { recursive: true });
      await rm(ctx.publishDir, { recursive: true, force: true });
      await cp(ctx.tempPublishDir, ctx.publishDir, { recursive: true });
      await rm(ctx.tempPublishDir, { recursive: true, force: true });`
);

fs.writeFileSync(TARGET, code, "utf8");
console.log("✔  Patched @netlify/plugin-nextjs (rename → cp+rm for Windows)");
