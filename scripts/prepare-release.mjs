#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const README_INSTALL_RE = /(pi install git:[^\n]*?@v)(\d+\.\d+\.\d+)/g;

export function parseVersion(version) {
  const match = VERSION_RE.exec(version ?? "");
  if (!match) {
    throw new Error(`version must match X.Y.Z, got ${JSON.stringify(version)}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function bumpVersion(currentVersion, bump) {
  const version = parseVersion(currentVersion);
  switch (bump) {
    case "major":
      return `${version.major + 1}.0.0`;
    case "minor":
      return `${version.major}.${version.minor + 1}.0`;
    case "patch":
      return `${version.major}.${version.minor}.${version.patch + 1}`;
    default:
      throw new Error(`bump must be one of major, minor, patch; got ${JSON.stringify(bump)}`);
  }
}

export function updatePackageJson(packageJsonText, nextVersion) {
  parseVersion(nextVersion);
  const pkg = JSON.parse(packageJsonText);
  if (typeof pkg.version !== "string") {
    throw new Error("package.json version must be a string");
  }
  const versionFieldRe = /^(\s*"version"\s*:\s*")[^"]*(")/m;
  if (!versionFieldRe.test(packageJsonText)) {
    throw new Error('package.json is missing a top-level "version" field to update');
  }
  return packageJsonText.replace(versionFieldRe, `$1${nextVersion}$2`);
}

export function updateReadmeInstallVersion(readmeText, nextVersion) {
  parseVersion(nextVersion);
  let replacements = 0;
  const updated = readmeText.replace(README_INSTALL_RE, (_match, prefix) => {
    replacements += 1;
    return `${prefix}${nextVersion}`;
  });
  if (replacements === 0) {
    throw new Error("README.md has no canonical `pi install git:...@vX.Y.Z` line to update");
  }
  return updated;
}

export function buildChangelogEntry(nextVersion, date) {
  parseVersion(nextVersion);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`date must match YYYY-MM-DD, got ${JSON.stringify(date)}`);
  }
  return `## [${nextVersion}] - ${date}\n\n### Changed\n\n- _Describe release changes before merging._\n\n---\n\n`;
}

export function insertChangelogEntry(changelogText, nextVersion, date) {
  const header = `## [${nextVersion}]`;
  if (changelogText.split("\n").some((line) => line.startsWith(header))) {
    throw new Error(`CHANGELOG.md already contains ${header}`);
  }

  const firstReleaseHeader = changelogText.search(/^## \[/m);
  if (firstReleaseHeader === -1) {
    throw new Error("CHANGELOG.md has no existing release header (`## [...]`) to insert before");
  }

  return `${changelogText.slice(0, firstReleaseHeader)}${buildChangelogEntry(nextVersion, date)}${changelogText.slice(firstReleaseHeader)}`;
}

export function prepareRelease({ root, version, bump, date }) {
  const packagePath = path.join(root, "package.json");
  const readmePath = path.join(root, "README.md");
  const changelogPath = path.join(root, "CHANGELOG.md");

  const packageJsonText = readFileSync(packagePath, "utf8");
  const pkg = JSON.parse(packageJsonText);
  const currentVersion = pkg.version;
  const nextVersion = version || bumpVersion(currentVersion, bump || "patch");
  parseVersion(nextVersion);

  if (nextVersion === currentVersion) {
    throw new Error(`next version ${nextVersion} must differ from current version`);
  }

  const releaseDate = date || new Date().toISOString().slice(0, 10);

  const updatedPackageJson = updatePackageJson(packageJsonText, nextVersion);
  const updatedReadme = updateReadmeInstallVersion(readFileSync(readmePath, "utf8"), nextVersion);
  const updatedChangelog = insertChangelogEntry(readFileSync(changelogPath, "utf8"), nextVersion, releaseDate);

  writeFileSync(packagePath, updatedPackageJson);
  writeFileSync(readmePath, updatedReadme);
  writeFileSync(changelogPath, updatedChangelog);

  return { currentVersion, nextVersion, releaseDate };
}

function parseArgs(argv) {
  const args = { root: process.cwd(), bump: "patch" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--root":
        args.root = next;
        i += 1;
        break;
      case "--version":
        args.version = next;
        i += 1;
        break;
      case "--bump":
        args.bump = next;
        i += 1;
        break;
      case "--date":
        args.date = next;
        i += 1;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

function usage() {
  return `Usage: node scripts/prepare-release.mjs [--bump patch|minor|major] [--version X.Y.Z] [--date YYYY-MM-DD]\n\nUpdates package.json, README.md, and CHANGELOG.md for a release PR.\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  const result = prepareRelease(args);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(1);
  });
}
