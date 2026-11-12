#!/usr/bin/env node
/* Gera o site publicável (PWA offline) a partir de uma cópia do app.
 * Uso: node tools/build-site.js --out site [--src .] [--env estavel|teste] [--commit SHA]
 * - copia index.html, css/, js/, ícones e manifesto;
 * - injeta <meta name="milkiq-env"> e <meta name="milkiq-sw"> (ativa o modo offline);
 * - escreve sw.js com a lista de arquivos e uma versão = hash do conteúdo;
 * - se a cópia for antiga (sem manifesto/ícones), usa os do repositório atual. */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.resolve(__dirname, "..");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };

function build({ src = ROOT, out, env = "estavel", commit = "" }) {
  src = path.resolve(src); out = path.resolve(out);
  fs.mkdirSync(out, { recursive: true });
  let html = fs.readFileSync(path.join(src, "index.html"), "utf8");
  const PWA = ['<link rel="manifest" href="manifest.webmanifest">', '<link rel="icon" href="icons/icon.svg" type="image/svg+xml">', '<link rel="apple-touch-icon" href="icons/icon-192.png">', '<meta name="theme-color" content="#0f7a55">'];
  PWA.forEach(t => { if (!html.includes(t.split(" ").slice(0, 2).join(" "))) html = html.replace("</head>", t + "\n</head>"); });
  html = html.replace(/<meta name="milkiq-(env|sw)"[^>]*>\n?/g, "").replace(/<head>/i, `<head>\n<meta name="milkiq-env" content="${env}">\n<meta name="milkiq-sw" content="sw.js">`);
  const refs = [...html.matchAll(/(?:src|href)="(?!https?:|data:|#)([^"]+)"/g)].map(m => m[1]);
  const man = ["manifest.webmanifest"].concat(JSON.parse(fs.readFileSync(fs.existsSync(path.join(src, "manifest.webmanifest")) ? path.join(src, "manifest.webmanifest") : path.join(ROOT, "manifest.webmanifest"), "utf8")).icons.map(i => i.src));
  const files = [...new Set(refs.concat(man))].sort();
  const h = crypto.createHash("sha256");
  for (const f of files) {
    const from = fs.existsSync(path.join(src, f)) ? path.join(src, f) : path.join(ROOT, f);
    if (!fs.existsSync(from)) throw Error("arquivo referenciado não existe: " + f);
    fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
    fs.copyFileSync(from, path.join(out, f)); h.update(f).update(fs.readFileSync(from));
  }
  h.update(html).update(env);
  const version = h.digest("hex").slice(0, 12);
  fs.writeFileSync(path.join(out, "index.html"), html);
  const list = ["./", "index.html"].concat(files);
  fs.writeFileSync(path.join(out, "sw.js"), fs.readFileSync(path.join(ROOT, "tools", "sw-template.js"), "utf8").replace("__VERSION__", version).replace("__ENV__", env).replace("__FILES__", JSON.stringify(list)));
  fs.writeFileSync(path.join(out, "version.json"), JSON.stringify({ app: "MilkIQ", env, version, commit, built: new Date().toISOString(), files: list.length }, null, 1));
  return { version, files: list.length };
}
module.exports = { build };
if (require.main === module) {
  const r = build({ src: arg("src", ROOT), out: arg("out", path.join(ROOT, "site")), env: arg("env", "estavel"), commit: arg("commit", "") });
  console.log(`Site gerado (${arg("env", "estavel")}): ${r.files} arquivos, versão ${r.version}`);
}
