#!/usr/bin/env node
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  bumpVersion,
  buildChangelogEntry,
  insertChangelogEntry,
  prepareRelease,
  updatePackageJson,
  updateReadmeInstallVersion,
} from "../../scripts/prepare-release.mjs";

let PASS = 0;
let FAIL = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
  PASS += 1;
}

function fail(label, message = "") {
  console.log(`  ✗ ${label}${message ? " — " + message : ""}`);
  FAIL += 1;
}

function assertEqual(label, expected, actual) {
  if (expected === actual) {
    ok(label);
  } else {
    fail(label, `expected=${JSON.stringify(expected)} got=${JSON.stringify(actual)}`);
  }
}

function assertIncludes(label, haystack, needle) {
  if (haystack.includes(needle)) {
    ok(label);
  } else {
    fail(label, `expected ${JSON.stringify(needle)} in ${JSON.stringify(haystack)}`);
  }
}

function assertThrows(label, fn, needle) {
  try {
    fn();
    fail(label, "expected error");
  } catch (err) {
    if (!needle || String(err.message).includes(needle)) {
      ok(label);
    } else {
      fail(label, `expected error containing ${JSON.stringify(needle)}, got ${JSON.stringify(err.message)}`);
    }
  }
}

function makeFixtureRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "skills-release-test-"));
  mkdirSync(path.join(root, "skills"));
  mkdirSync(path.join(root, "extensions"));
  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "fixture", version: "1.2.3", pi: { skills: ["./skills"], extensions: ["./extensions"] } }, null, 2)}\n`
  );
  writeFileSync(
    path.join(root, "README.md"),
    "# Fixture\n\n```bash\npi install git:git@github.com:aweiker/skills.git@v1.2.3\n```\n"
  );
  writeFileSync(
    path.join(root, "CHANGELOG.md"),
    "# Changelog\n\nAll notable changes.\n\n## [1.2.3] - 2026-01-01\n\n### Changed\n\n- Previous.\n"
  );
  return root;
}

console.log("\n=== release version helpers ===");
assertEqual("patch bump", "1.2.4", bumpVersion("1.2.3", "patch"));
assertEqual("minor bump resets patch", "1.3.0", bumpVersion("1.2.3", "minor"));
assertEqual("major bump resets minor and patch", "2.0.0", bumpVersion("1.2.3", "major"));
assertThrows("invalid version rejected", () => bumpVersion("1.2", "patch"), "X.Y.Z");
assertThrows("invalid bump rejected", () => bumpVersion("1.2.3", "banana"), "major, minor, patch");

console.log("\n=== release file update helpers ===");
const updatedPackage = updatePackageJson('{"version":"1.2.3","name":"fixture"}\n', "1.2.4");
assertEqual("package version updated", "1.2.4", JSON.parse(updatedPackage).version);

const updatedReadme = updateReadmeInstallVersion(
  "pi install git:git@github.com:aweiker/skills.git@v1.2.3\n",
  "1.2.4"
);
assertIncludes("README install tag updated", updatedReadme, "@v1.2.4");
assertThrows("README without install line rejected", () => updateReadmeInstallVersion("no install", "1.2.4"), "no canonical");

const changelogEntry = buildChangelogEntry("1.2.4", "2026-07-03");
assertIncludes("changelog entry contains version", changelogEntry, "## [1.2.4] - 2026-07-03");
assertIncludes("changelog entry includes editable placeholder", changelogEntry, "Describe release changes");
const changelog = "# Changelog\n\nIntro.\n\n## [1.2.3] - 2026-01-01\n";
const updatedChangelog = insertChangelogEntry(changelog, "1.2.4", "2026-07-03");
assertIncludes("changelog entry inserted before previous release", updatedChangelog, "## [1.2.4] - 2026-07-03\n\n### Changed");
assertThrows("duplicate changelog release rejected", () => insertChangelogEntry(updatedChangelog, "1.2.4", "2026-07-03"), "already contains");

console.log("\n=== prepareRelease integration ===");
const root = makeFixtureRoot();
try {
  const result = prepareRelease({ root, bump: "patch", date: "2026-07-03" });
  assertEqual("prepareRelease reports previous version", "1.2.3", result.currentVersion);
  assertEqual("prepareRelease reports next version", "1.2.4", result.nextVersion);
  assertEqual("package.json updated on disk", "1.2.4", JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version);
  assertIncludes("README updated on disk", readFileSync(path.join(root, "README.md"), "utf8"), "@v1.2.4");
  assertIncludes("CHANGELOG updated on disk", readFileSync(path.join(root, "CHANGELOG.md"), "utf8"), "## [1.2.4] - 2026-07-03");
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (FAIL > 0) {
  console.log(`\n${FAIL} failure(s), ${PASS} pass(es).`);
  process.exit(1);
}

console.log(`\nAll ${PASS} release automation checks passed.`);
