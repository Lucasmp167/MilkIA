#!/usr/bin/env node
/* Gera um único arquivo HTML autocontido (CSS e JS embutidos) a partir de index.html.
 * Uso: node tools/bundle.js [saída]   (padrão: dist/milkiq.html)
 * Serve para compartilhar o app como um arquivo só ou publicá-lo como artifact. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
function bundle(htmlPath) {
  const dir = path.dirname(htmlPath);
  const rd = f => fs.readFileSync(path.join(dir, f), "utf8");
  return fs.readFileSync(htmlPath, "utf8")
    .replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, f) => `<style>\n${rd(f)}</style>`)
    .replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>\n${rd(f).replace(/<\/script/gi, "<\\/script")}</script>`);
}
module.exports = { bundle };
if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(ROOT, "dist", "milkiq.html"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bundle(path.join(ROOT, "index.html")));
  console.log("Gerado:", path.relative(process.cwd(), out), fs.statSync(out).size, "bytes");
}
