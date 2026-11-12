#!/usr/bin/env node
/* Gera os PNGs dos ícones a partir dos SVGs (usa o Chromium do Playwright). Uso: node tools/icons.js */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
const dir = path.resolve(__dirname, "..", "icons");
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  for (const [src, out, size] of [["icon.svg", "icon-192.png", 192], ["icon.svg", "icon-512.png", 512], ["maskable.svg", "maskable-512.png", 512]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${fs.readFileSync(path.join(dir, src), "utf8").replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: path.join(dir, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log("gerado", out);
  }
  await b.close();
})();
