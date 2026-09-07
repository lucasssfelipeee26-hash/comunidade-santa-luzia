"use strict";

const fs = require("node:fs");
const path = require("node:path");

if (process.env.SANTA_LUZIA_MOTION_BETA !== "1") process.exit(0);

const file = path.join(process.cwd(), "android-web", "motion", "android-original-ui-beta10.js");
let source = fs.readFileSync(file, "utf8");

if (source.includes("prewarm massivo desligado")) {
  console.log("[beta21-prewarm-compat] prewarm já removido do caminho crítico.");
  process.exit(0);
}

if (source.includes("beta21IdleInitialWarm")) {
  const pattern = /  function beta21IdleInitialWarm\(\) \{[\s\S]*?\n  beta21IdleInitialWarm\(\);/;
  if (!pattern.test(source)) throw new Error("Bloco beta21IdleInitialWarm não reconhecido.");
  source = source.replace(pattern, "  setTimeout(() => void warm(false), 3500);");
}

if (!source.includes('window.addEventListener("online", () => void warm(true));') ||
    !source.includes("setTimeout(() => void warm(false), 3500);")) {
  throw new Error("Assinatura intermediária de prewarm não ficou compatível com patch-beta21-navigation-runtime.");
}

fs.writeFileSync(file, source);
console.log("[beta21-prewarm-compat] warmup normalizado; patch de navegação poderá removê-lo do caminho crítico.");
