import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const indexPath = path.join(projectRoot, "index.html");
const dataPath = path.join(projectRoot, "assets", "js", "data.js");
const cssPath = path.join(projectRoot, "assets", "css", "styles.css");
const mainPath = path.join(projectRoot, "assets", "js", "main.js");

const html = fs.readFileSync(indexPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const main = fs.readFileSync(mainPath, "utf8");
const dataSource = fs.readFileSync(dataPath, "utf8");

const errors = [];
const warnings = [];

function error(message) {
  errors.push(message);
}

function warning(message) {
  warnings.push(message);
}

function loadProfileData() {
  const sandbox = { window: {} };
  vm.runInNewContext(dataSource, sandbox, { filename: dataPath });
  return sandbox.window.profileData;
}

function unique(values) {
  return [...new Set(values)];
}

function localAssetExists(url) {
  const cleanUrl = url.split("?")[0].split("#")[0];
  if (!cleanUrl || cleanUrl.startsWith("http") || cleanUrl.startsWith("//") || cleanUrl === "#") return true;
  return fs.existsSync(path.join(projectRoot, cleanUrl));
}

function extractAll(regex, source) {
  return [...source.matchAll(regex)].map((match) => match[1]);
}

const data = loadProfileData();
if (!data || typeof data !== "object") {
  error("assets/js/data.js did not expose window.profileData.");
}

const requiredSections = ["home", "about", "education", "research", "publications", "honors", "service", "news", "contact"];
const removedSections = ["compass", "workflow", "projects", "experience"];
const sectionIds = extractAll(/<section\b[^>]*\bid="([^"]+)"/g, html);
requiredSections.forEach((id) => {
  if (!sectionIds.includes(id)) error(`Missing required section #${id}.`);
});

removedSections.forEach((id) => {
  if (sectionIds.includes(id)) error(`Removed section #${id} is still present.`);
  if (html.includes(`href="#${id}"`)) error(`Navigation still links to removed section #${id}.`);
  if (html.includes(`data-${id}`)) error(`HTML still contains data-${id}.`);
});

const navHrefs = extractAll(/<a\b[^>]*href="#([^"]+)"/g, html).filter((href) => href !== "home" && href !== "main");
navHrefs.forEach((href) => {
  if (!sectionIds.includes(href)) error(`Navigation href #${href} does not match a section id.`);
});

const dataTargets = [
  "data-about",
  "data-education",
  "data-interests",
  "data-publication-filters",
  "data-publication-year",
  "data-publication-search",
  "data-publications",
  "data-unaccepted-publications",
  "data-honors",
  "data-service",
  "data-news",
  "data-contact-links",
  "data-site-canvas",
  "data-hero-canvas",
  "data-theme-toggle-mobile"
];

dataTargets.forEach((target) => {
  if (!html.includes(target)) error(`Missing expected HTML hook ${target}.`);
});

["data-projects", "data-experience", "data-workflow", "data-compass"].forEach((target) => {
  if (html.includes(target) || main.includes(target)) error(`Removed HTML hook ${target} is still referenced.`);
});

["scroll-progress", "data-scroll-progress", "setupScrollProgress"].forEach((target) => {
  if (html.includes(target) || css.includes(target) || main.includes(target)) {
    error(`Removed scroll progress line ${target} is still referenced.`);
  }
});

["renderProjects", "renderExperience", "renderWorkflow", "renderCompass"].forEach((name) => {
  if (main.includes(name)) error(`Removed renderer ${name} is still present.`);
});

["drawBackgroundGrid", "drawScanBands", "drawCircuitGrid"].forEach((name) => {
  if (main.includes(name)) error(`Removed straight-line background routine ${name} is still present.`);
});

if (css.includes("repeating-linear-gradient")) {
  error("CSS still uses repeating-linear-gradient; keep backgrounds dot/glow based instead of hard line grids.");
}

if (main.includes(".lineTo(") || main.includes(".moveTo(")) {
  error("Canvas still draws continuous straight lines; use dots, arcs, or soft glows instead.");
}

const versionedAssets = extractAll(/(?:href|src)="[^"]+\?v=([^"]+)"/g, html);
const versions = unique(versionedAssets);
if (versions.length !== 1) {
  error(`Expected exactly one shared asset version, found: ${versions.join(", ") || "none"}.`);
}

const localAssets = extractAll(/(?:href|src)="([^"]+)"/g, html).filter((url) => url.startsWith("assets/"));
localAssets.forEach((url) => {
  if (!localAssetExists(url)) error(`Referenced local asset does not exist: ${url}`);
});

if (!html.includes('data-field="initials"')) {
  error("Brand/profile initials are not bound to data-field=\"initials\".");
}

if (main.includes("prefers-color-scheme")) {
  error("Theme setup should default to light and not follow prefers-color-scheme.");
}

if (!main.includes("[data-theme-toggle], [data-theme-toggle-mobile]")) {
  error("Theme setup should keep desktop and mobile theme controls in sync.");
}

if (!main.includes("setupSiteBackdropCanvas")) {
  error("Global site backdrop canvas setup is missing.");
}

if (!css.includes(".site-backdrop-canvas")) {
  error("Global site backdrop canvas styles are missing.");
}

if (!css.includes("@media (max-width: 560px)")) {
  warning("Mobile hardening breakpoint @media (max-width: 560px) was not found.");
}

if (data?.publicationFilters && data?.publications) {
  const values = new Set(data.publicationFilters.map((filter) => filter.value));
  if (!values.has("all")) {
    error("publicationFilters should include all.");
  }
  if (!["conference", "journal", "project", "patent", "software"].some((value) => values.has(value))) {
    error("publicationFilters should include at least one output type filter.");
  }
}

if (warnings.length) {
  console.log("Warnings:");
  warnings.forEach((item) => console.log(`- ${item}`));
}

if (errors.length) {
  console.error("Errors:");
  errors.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`Page audit passed. ${warnings.length} warning(s), 0 error(s).`);
