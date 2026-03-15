/**
 * EMF Converter Test Server
 *
 * Bundles the pptx EMF converter and serves a test page that compares
 * our converter output with EMFJS (from rtf.js).
 *
 * Usage:  bun scripts/test-emf-converter.ts
 * Then open: http://localhost:3891
 */

import { readFileSync } from "node:fs";
import { resolve, extname } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const CONVERTER_SRC = resolve(ROOT, "packages/emf-converter/src/index.ts");
const FIXTURES_DIR = resolve(ROOT, "scripts/fixtures");
const EMF_FILE = resolve(FIXTURES_DIR, "Picture1.emf");
const EMF_FILE_2 = resolve(FIXTURES_DIR, "image2.emf");
const HTML_FILE = resolve(ROOT, "scripts/test-emf-converter.html");

const PORT = 3891;

// ── Bundle the converter ──
console.log("Bundling emf-converter …");
const buildResult = await Bun.build({
  entrypoints: [CONVERTER_SRC],
  format: "esm",
  target: "browser",
  minify: false,
  sourcemap: "inline",
});

if (!buildResult.success) {
  console.error("Build failed:");
  for (const msg of buildResult.logs) {
    console.error(" ", msg);
  }
  process.exit(1);
}

const converterBundle = await buildResult.outputs[0].text();
console.log(`Bundle ready: ${(converterBundle.length / 1024).toFixed(1)} KB`);

// ── Read static files ──
const htmlContent = readFileSync(HTML_FILE, "utf-8");
let emfContent: Buffer | null = null;
try {
  emfContent = readFileSync(EMF_FILE) as unknown as Buffer;
  console.log(`Picture1.emf: ${emfContent.length} bytes`);
} catch {
  console.warn("Picture1.emf not found — file picker will still work");
}

let emfContent2: Buffer | null = null;
try {
  emfContent2 = readFileSync(EMF_FILE_2) as unknown as Buffer;
  console.log(`image2.emf: ${emfContent2.length} bytes`);
} catch {
  console.warn("image2.emf not found — file picker will still work");
}

// ── MIME types ──
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".emf": "application/octet-stream",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

// ── HTTP server ──
const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // Serve the HTML test page
    if (path === "/" || path === "/index.html") {
      return new Response(htmlContent, {
        headers: { "Content-Type": MIME[".html"] },
      });
    }

    // Serve the bundled converter
    if (path === "/emf-converter-bundle.js") {
      return new Response(converterBundle, {
        headers: { "Content-Type": MIME[".js"] },
      });
    }

    // Serve the test EMF file
    if (path === "/Picture1.emf") {
      if (!emfContent) {
        return new Response("EMF file not found", { status: 404 });
      }
      return new Response(emfContent, {
        headers: { "Content-Type": MIME[".emf"] },
      });
    }

    // Serve the second test EMF file (from PPTX bundle)
    if (path === "/image2.emf") {
      if (!emfContent2) {
        return new Response("image2.emf not found", { status: 404 });
      }
      return new Response(emfContent2, {
        headers: { "Content-Type": MIME[".emf"] },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`\n  EMF Converter Test Server running at:`);
console.log(`  → http://localhost:${PORT}\n`);
console.log(`  Press Ctrl+C to stop.\n`);
