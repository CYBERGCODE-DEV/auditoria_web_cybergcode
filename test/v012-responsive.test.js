import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/css/app.css", import.meta.url), "utf8");
const js = fs.readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8");
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("V0.12.0 añade selector móvil, tablas adaptativas y nodos orbitales animados", () => {
  assert.equal(pkg.version, "0.12.0");
  assert.match(html, /id="dashboardTabSelect"/);
  assert.match(html, /<svg viewBox="0 0 24 24" fill="none">/);
  assert.match(css, /dashboard-nav-mobile\{[^}]*display:none/);
  assert.match(css, /@media\(max-width:56rem\)/);
  assert.match(css, /\.audit-table td::before\{[^}]*content:attr\(data-label\)/);
  assert.match(css, /@keyframes orbitShine/);
  assert.match(js, /syncResponsiveTableLabels/);
  assert.match(js, /dashboardTabSelect/);
});
