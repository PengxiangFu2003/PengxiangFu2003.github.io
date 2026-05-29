import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const dataPath = path.join(projectRoot, "assets", "js", "data.js");

const errors = [];
const warnings = [];

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlaceholder(value) {
  return !value || value === "#" || /^\[.*\]$/.test(String(value).trim());
}

function requireObject(value, label) {
  if (!isObject(value)) {
    addError(`${label} must be an object.`);
    return false;
  }
  return true;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    addError(`${label} must be an array.`);
    return false;
  }
  if (!value.length) {
    addWarning(`${label} is empty.`);
  }
  return true;
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    addError(`${label} must be a non-empty string.`);
  }
}

function checkLink(value, label) {
  if (typeof value !== "string") {
    addError(`${label} must be a string URL or placeholder.`);
    return;
  }

  if (isPlaceholder(value)) {
    addWarning(`${label} is still a placeholder.`);
    return;
  }

  try {
    new URL(value, "http://localhost/");
  } catch {
    addError(`${label} is not a valid URL or relative path: ${value}`);
  }
}

function loadProfileData() {
  const source = fs.readFileSync(dataPath, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: dataPath });
  return sandbox.window.profileData;
}

const data = loadProfileData();
if (!requireObject(data, "profileData")) {
  process.exit(1);
}

if (requireObject(data.personal, "personal")) {
  ["name", "englishName", "shortName", "initials", "role", "affiliation", "email", "cvUrl"].forEach((key) =>
    requireText(data.personal[key], `personal.${key}`)
  );
  ["cvUrl", "github", "googleScholar", "orcid", "researchGate", "linkedin"].forEach((key) =>
    checkLink(data.personal[key], `personal.${key}`)
  );
}

if (requireObject(data.hero, "hero")) {
  requireArray(data.hero.keywords, "hero.keywords");
  ["summary", "focusTitle", "focusText"].forEach((key) => requireText(data.hero[key], `hero.${key}`));
  requireArray(data.hero.facts, "hero.facts");
}

if (requireObject(data.about, "about")) {
  requireArray(data.about.paragraphs, "about.paragraphs");
  requireText(data.about.motto, "about.motto");
}

if (requireObject(data.snapshot, "snapshot")) {
  requireText(data.snapshot.title, "snapshot.title");
  requireText(data.snapshot.intro, "snapshot.intro");
  requireArray(data.snapshot.items, "snapshot.items");
  data.snapshot.items?.forEach((item, index) => {
    if (!requireObject(item, `snapshot.items[${index}]`)) return;
    ["label", "value", "detail"].forEach((key) => requireText(item[key], `snapshot.items[${index}].${key}`));
  });
}

["education", "interests", "publications", "honors", "news", "services"].forEach((key) =>
  requireArray(data[key], key)
);

data.publications?.forEach((publication, index) => {
  if (!requireObject(publication, `publications[${index}]`)) return;
  ["title", "authors", "venue", "year", "type", "status", "summary"].forEach((key) =>
    requireText(publication[key], `publications[${index}].${key}`)
  );
  if (!requireObject(publication.links, `publications[${index}].links`)) return;
  Object.entries(publication.links).forEach(([key, value]) => {
    checkLink(value, `publications[${index}].links.${key}`);
  });
  if (publication.bibtex && !String(publication.bibtex).trim().startsWith("@")) {
    addWarning(`publications[${index}].bibtex does not look like BibTeX.`);
  }
});

if (Array.isArray(data.publicationFilters)) {
  const allowedFilters = new Set(["all", "featured", "conference", "journal", "project", "patent", "software"]);
  data.publications?.forEach((publication) => {
    allowedFilters.add(publication.type);
    allowedFilters.add(publication.category);
    allowedFilters.add(publication.year);
  });

  data.publicationFilters.forEach((filter, index) => {
    if (!requireObject(filter, `publicationFilters[${index}]`)) return;
    requireText(filter.label, `publicationFilters[${index}].label`);
    requireText(filter.value, `publicationFilters[${index}].value`);
    if (!allowedFilters.has(filter.value)) {
      addWarning(`publicationFilters[${index}].value "${filter.value}" does not match a paper type or year.`);
    }
  });
}

if (warnings.length) {
  console.log("Warnings:");
  warnings.forEach((warning) => console.log(`- ${warning}`));
}

if (errors.length) {
  console.error("Errors:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Profile data looks structurally valid. ${warnings.length} warning(s), 0 error(s).`);
