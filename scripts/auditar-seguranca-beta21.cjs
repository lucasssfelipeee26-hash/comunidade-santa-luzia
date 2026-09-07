"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const findings = [];
const errors = [];

function note(level, type, detail) {
  findings.push({ level, type, detail });
  if (level === "error") errors.push(`${type}: ${detail}`);
}

// Bloqueia hooks de instalação capazes de executar código antes da auditoria.
const lifecycleHooks = ["preinstall", "install", "postinstall", "prepare", "prepublish", "prepublishOnly"];
for (const hook of lifecycleHooks) {
  if (packageJson.scripts?.[hook]) note("error", "npm-lifecycle-hook", `${hook}=${packageJson.scripts[hook]}`);
}

// A Motion Beta 21 é Next.js + Capacitor. Uma configuração Expo seria regressão de stack.
const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
if (!deps.next || !deps["@capacitor/core"] || !deps["@capacitor/android"]) {
  note("error", "stack", "Next.js + Capacitor Android não está completo.");
}
if (deps.expo || fs.existsSync(path.join(root, "app.json"))) {
  note("error", "stack", "Configuração Expo inesperada na Motion Beta 21.");
}

const ignored = new Set(["node_modules", ".git", ".next", "android", "android-web", "dist"]);
const textExtensions = new Set([".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx"]);
const executableExtensions = new Set([".exe", ".scr", ".com", ".msi", ".jar", ".dll", ".so", ".dylib"]);
const obfuscationPatterns = [
  { name: "hex-obfuscated-identifier", re: /\b_0x[0-9a-f]{4,}\b/i },
  { name: "eval-atob", re: /\beval\s*\([^\n)]*\batob\s*\(/i },
  { name: "function-atob", re: /\b(?:new\s+)?Function\s*\([^\n)]*\batob\s*\(/i },
  { name: "dense-hex-escapes", re: /(?:\\x[0-9a-fA-F]{2}){8,}/ },
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replaceAll(path.sep, "/");
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (executableExtensions.has(ext)) note("warning", "binary-source", rel);
    if (!textExtensions.has(ext)) continue;
    const stat = fs.statSync(full);
    if (stat.size > 5 * 1024 * 1024) continue;
    const source = fs.readFileSync(full, "utf8");
    for (const pattern of obfuscationPatterns) {
      if (pattern.re.test(source)) note("error", "obfuscation", `${rel}: ${pattern.name}`);
    }
  }
}
walk(root);

// HTTP claro é aceito somente no canal isolado local que o usuário está testando.
const betaConfig = JSON.parse(fs.readFileSync(path.join(root, "config", "android-motion-beta.json"), "utf8"));
const stableConfig = JSON.parse(fs.readFileSync(path.join(root, "config", "android-build.json"), "utf8"));
if (betaConfig.applicationId !== "br.com.comunidadesantaluzia.motionbeta") note("error", "beta-isolation", "applicationId Motion divergente");
if (betaConfig.serverUrl !== "http://192.168.1.7:3000") note("error", "beta-local-http", `serverUrl inesperada: ${betaConfig.serverUrl}`);
if (stableConfig.versionName !== "1.0.6" || stableConfig.versionCode !== 18) note("error", "stable-isolation", "canal oficial foi alterado");

const report = {
  schema: "santa-luzia-beta21-source-security-v1",
  stack: "Next.js + Capacitor Android",
  checkedAt: new Date().toISOString(),
  findings,
  errors: errors.length,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) {
  console.error(`[beta21-security] ${errors.length} problema(s) bloqueante(s).`);
  process.exit(1);
}
console.log("[beta21-security] auditoria estática aprovada; nenhum hook de instalação ou ofuscação bloqueante detectado.");
