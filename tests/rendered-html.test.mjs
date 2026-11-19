import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("production HTML contains the local app entry point and no remote runtime assets", () => {
  const html = fs.readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const assetsDirectory = new URL("../dist/assets/", import.meta.url);
  const css = fs.readdirSync(assetsDirectory)
    .filter((file) => file.endsWith(".css"))
    .map((file) => fs.readFileSync(new URL(file, assetsDirectory), "utf8"))
    .join("\n");
  assert.match(html, /<title>日常事务工作台<\/title>/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /\/assets\/brand\/daily-workspace-mark\.svg/);
  assert.doesNotMatch(html, /https?:\/\/(fonts|cdn|unpkg|jsdelivr)\./i);
  assert.match(html, /\/assets\//);
  for (const file of ["chromatic-polymer-light-v1.webp", "chromatic-polymer-dark-v1.webp"]) {
    assert.equal(fs.existsSync(new URL(`../dist/assets/ambient/${file}`, import.meta.url)), true, `${file} should be bundled locally`);
    assert.match(css, new RegExp(`/assets/ambient/${file.replace(".", "\\.")}`));
  }
  for (const module of ["dashboard", "today", "media", "development", "consulting", "fitness", "diet", "entertainment", "settings"]) {
    const file = `${module}-v1.webp`;
    assert.equal(fs.existsSync(new URL(`../dist/assets/module-icons/${file}`, import.meta.url)), true, `${file} should be bundled locally`);
  }
  for (const file of ["legacy-app-icon-v1.webp", "legacy-app-icon-v1.png", "favicon-64-v1.png"]) {
    assert.equal(fs.existsSync(new URL(`../dist/assets/brand/${file}`, import.meta.url)), true, `${file} should be bundled locally`);
  }
  for (const file of ["brand/daily-workspace-mark.svg", "notebook/module-stickers.png"]) {
    assert.equal(fs.existsSync(new URL(`../dist/assets/${file}`, import.meta.url)), true, `${file} should be bundled locally`);
  }
  for (const file of ["module-emblems.png", "legacy-app-icon-v1.png", "legacy-app-icon-brand.png", "legacy-app-icon-favicon.png"]) {
    assert.equal(fs.existsSync(new URL(`../dist/assets/neo/${file}`, import.meta.url)), true, `${file} should be bundled locally`);
  }
  // 只保留 Notion 笔记风格：notebook 主题规则与内联 SVG 图标样式必须打包，
  // Neo 专属选择器与雪碧图不再进入构建产物。
  assert.match(css, /\[data-appearance[^\]]*notebook/);
  assert.match(css, /notion-module-icon/);
  assert.doesNotMatch(css, /\[data-appearance[^\]]*neo\]/);
  assert.doesNotMatch(css, /module-emblems\.png/);
});
