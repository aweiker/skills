#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildChangelogEntry,
  buildGitCliffChangelogEntry,
  collectReleaseCommitSubjects,
  collectReleaseCommits,
  bumpVersion,
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
  writeFileSync(path.join(root, "cliff.toml"), "# fixture git-cliff config\n");
  return root;
}

function makeFakeGitCliff(root, { contextOutput, renderOutput }) {
  const command = path.join(root, "fake-git-cliff.sh");
  const contextFile = path.join(root, "fake-git-cliff-context.json");
  const renderFile = path.join(root, "fake-git-cliff-render.md");
  const argsFile = path.join(root, "fake-git-cliff-args.txt");
  writeFileSync(contextFile, contextOutput);
  writeFileSync(renderFile, renderOutput);
  writeFileSync(
    command,
    `#!/usr/bin/env sh
printf '%s\n' "$*" >> ${JSON.stringify(argsFile)}
case " $* " in
  *" --context "*) cat ${JSON.stringify(contextFile)} ;;
  *) cat ${JSON.stringify(renderFile)} ;;
esac
`
  );
  chmodSync(command, 0o755);
  return { command, argsFile };
}

function configureGit(root) {
  execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.invalid"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: root, stdio: "ignore" });
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function commandExists(command) {
  try {
    execFileSync(command, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

console.log("\n=== release version helpers ===");
assertEqual("patch bump", "1.2.4", bumpVersion("1.2.3", "patch"));
assertEqual("minor bump resets patch", "1.3.0", bumpVersion("1.2.3", "minor"));
assertEqual("major bump resets minor and patch", "2.0.0", bumpVersion("1.2.3", "major"));
assertThrows("invalid version rejected", () => bumpVersion("1.2", "patch"), "X.Y.Z");
assertThrows("invalid bump rejected", () => bumpVersion("1.2.3", "banana"), "major, minor, patch");

console.log("\n=== release file update helpers ===");
const packageWithCustomFormatting = '{\n    "version"   :   "1.2.3",\n  "name":"fixture"\n}\n';
const updatedPackage = updatePackageJson(packageWithCustomFormatting, "1.2.4");
assertEqual("package version updated", "1.2.4", JSON.parse(updatedPackage).version);
assertEqual(
  "package update preserves surrounding formatting",
  '{\n    "version"   :   "1.2.4",\n  "name":"fixture"\n}\n',
  updatedPackage
);

const updatedReadme = updateReadmeInstallVersion(
  "pi install git:git@github.com:aweiker/skills.git@v1.2.3\n",
  "1.2.4"
);
assertIncludes("README install tag updated", updatedReadme, "@v1.2.4");
assertThrows("README without install line rejected", () => updateReadmeInstallVersion("no install", "1.2.4"), "no canonical");

const changelogEntry = buildChangelogEntry("1.2.4", "2026-07-03");
assertIncludes("placeholder changelog entry contains version", changelogEntry, "## [1.2.4] - 2026-07-03");
assertIncludes("placeholder changelog entry includes editable placeholder", changelogEntry, "Describe release changes");
const changelog = "# Changelog\n\nIntro.\n\n## [1.2.3] - 2026-01-01\n";
const updatedChangelog = insertChangelogEntry(changelog, "1.2.4", "2026-07-03");
assertIncludes("changelog entry inserted before previous release", updatedChangelog, "## [1.2.4] - 2026-07-03\n\n### Changed");
assertThrows("duplicate changelog release rejected", () => insertChangelogEntry(updatedChangelog, "1.2.4", "2026-07-03"), "already contains");
assertThrows("wrong generated changelog version rejected", () => insertChangelogEntry(changelog, "1.2.4", "2026-07-03", "## [9.9.9]\n"), "does not contain");

console.log("\n=== release commit collection ===");
const rootWithGitHistory = makeFixtureRoot();
try {
  configureGit(rootWithGitHistory);
  git(rootWithGitHistory, ["add", "."]);
  git(rootWithGitHistory, ["commit", "-q", "-m", "chore: initial"]);
  git(rootWithGitHistory, ["tag", "v1.2.3"]);
  git(rootWithGitHistory, ["checkout", "-q", "-b", "feature/breaking"]);
  writeFileSync(path.join(rootWithGitHistory, "feature.txt"), "feature\n");
  git(rootWithGitHistory, ["add", "feature.txt"]);
  git(rootWithGitHistory, ["commit", "-q", "-m", "feat: branch feature", "-m", "BREAKING CHANGE: branch API changed"]);
  const featureHash = git(rootWithGitHistory, ["rev-parse", "HEAD"]).trim();
  git(rootWithGitHistory, ["checkout", "-q", "master"]);
  git(rootWithGitHistory, ["merge", "--no-ff", "feature/breaking", "-m", "Merge pull request #42 from test/feature", "-m", "feat: branch feature"]);
  writeFileSync(path.join(rootWithGitHistory, "fix.txt"), "fix\n");
  git(rootWithGitHistory, ["add", "fix.txt"]);
  git(rootWithGitHistory, ["commit", "-q", "-m", "fix: direct fix"]);

  const commits = collectReleaseCommits({ root: rootWithGitHistory });
  assertEqual("collectReleaseCommits skips merge commits", 2, commits.length);
  assertEqual("collectReleaseCommits preserves commit id", featureHash, commits[0].id);
  assertIncludes("collectReleaseCommits preserves footer body", commits[0].message, "BREAKING CHANGE: branch API changed");
  assertEqual("collectReleaseCommits maps merge PR number to branch commit", 42, commits[0].prNumber);
  const subjects = collectReleaseCommitSubjects({ root: rootWithGitHistory });
  assertEqual("collectReleaseCommitSubjects returns first lines", "feat: branch feature|fix: direct fix", subjects.join("|"));
} finally {
  rmSync(rootWithGitHistory, { recursive: true, force: true });
}

console.log("\n=== git-cliff changelog generation ===");
const rootWithFakeCliff = makeFixtureRoot();
try {
  const { command, argsFile } = makeFakeGitCliff(rootWithFakeCliff, {
    contextOutput: `${JSON.stringify([{ version: "v1.2.4", timestamp: 0, commits: [{ raw_message: "fix: generated by git-cliff\n\nBREAKING CHANGE: generated break", message: "generated by git-cliff", github: {} }] }])}\n`,
    renderOutput: "## [1.2.4] - 2099-12-31\n\n### Fixed\n\n- Generated by git-cliff\n",
  });
  const entry = buildGitCliffChangelogEntry({
    root: rootWithFakeCliff,
    nextVersion: "1.2.4",
    date: "2026-07-03",
    gitCliffCommand: command,
    commits: [{ id: "abc123", message: "fix: generated by git-cliff\n\nBREAKING CHANGE: generated break", prNumber: 7 }],
  });
  const argsText = readFileSync(argsFile, "utf8");
  assertIncludes("git-cliff entry returned", entry, "Generated by git-cliff");
  assertIncludes("git-cliff entry honors requested date", entry, "## [1.2.4] - 2026-07-03");
  assertIncludes("git-cliff invoked with absolute config", argsText, `--config ${path.join(rootWithFakeCliff, "cliff.toml")}`);
  assertIncludes("git-cliff invoked with release tag", argsText, "--tag v1.2.4");
  assertIncludes("git-cliff context generation is bounded", argsText, "--unreleased");
  assertIncludes("git-cliff invoked with context generation", argsText, "--context");
  assertIncludes("git-cliff invoked with full commit body", argsText, "BREAKING CHANGE: generated break");
  assertIncludes("git-cliff renders from generated context", argsText, "--from-context");
} finally {
  rmSync(rootWithFakeCliff, { recursive: true, force: true });
}

const rootWithUnreleasedCliff = makeFixtureRoot();
try {
  const { command } = makeFakeGitCliff(rootWithUnreleasedCliff, {
    contextOutput: `${JSON.stringify([{ version: null, timestamp: 0, commits: [{ raw_message: "fix: generated by git-cliff", message: "generated by git-cliff", github: {} }] }])}\n`,
    renderOutput: "## [unreleased] - 2099-12-31\n\n### Fixed\n\n- Generated by git-cliff\n",
  });
  const entry = buildGitCliffChangelogEntry({
    root: rootWithUnreleasedCliff,
    nextVersion: "1.2.4",
    date: "2026-07-03",
    gitCliffCommand: command,
    commits: [{ id: "", message: "fix: generated by git-cliff", prNumber: null }],
  });
  assertIncludes("git-cliff unreleased header normalized", entry, "## [1.2.4] - 2026-07-03");
} finally {
  rmSync(rootWithUnreleasedCliff, { recursive: true, force: true });
}

if (commandExists("git-cliff")) {
  const entry = buildGitCliffChangelogEntry({
    root: process.cwd(),
    nextVersion: "1.2.4",
    date: "2026-07-03",
    commits: [{ id: "abc123", message: "feat: risky change\n\nBREAKING CHANGE: API changed", prNumber: 123 }],
  });
  assertIncludes("git-cliff renders PR number from augmented context", entry, "Risky change (#123)");
  assertIncludes("git-cliff renders breaking footer from full body", entry, "**Breaking:** API changed");
} else {
  ok("git-cliff integration skipped because git-cliff is not installed");
}

function assertPrepareReleaseUpdatesFixture(label, options, expectedVersion) {
  const root = makeFixtureRoot();
  try {
    const result = prepareRelease({ root, ...options, date: "2026-07-03", changelogMode: "placeholder" });
    assertEqual(`${label}: reports previous version`, "1.2.3", result.currentVersion);
    assertEqual(`${label}: reports next version`, expectedVersion, result.nextVersion);
    assertEqual(`${label}: package.json updated on disk`, expectedVersion, JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version);
    assertIncludes(`${label}: README updated on disk`, readFileSync(path.join(root, "README.md"), "utf8"), `@v${expectedVersion}`);
    assertIncludes(`${label}: CHANGELOG updated on disk`, readFileSync(path.join(root, "CHANGELOG.md"), "utf8"), `## [${expectedVersion}] - 2026-07-03`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log("\n=== prepareRelease integration ===");
assertPrepareReleaseUpdatesFixture("patch bump", { bump: "patch" }, "1.2.4");
assertPrepareReleaseUpdatesFixture("minor bump", { bump: "minor" }, "1.3.0");
assertPrepareReleaseUpdatesFixture("major bump", { bump: "major" }, "2.0.0");
assertPrepareReleaseUpdatesFixture("explicit version", { version: "2.5.7" }, "2.5.7");

console.log("\n=== prepareRelease integration with git-cliff ===");
const rootForGitCliffRelease = makeFixtureRoot();
try {
  const { command } = makeFakeGitCliff(rootForGitCliffRelease, {
    contextOutput: `${JSON.stringify([{ version: "v1.2.4", timestamp: 0, commits: [{ raw_message: "feat: release notes from git-cliff", message: "release notes from git-cliff", github: {} }] }])}\n`,
    renderOutput: "## [1.2.4] - 2026-07-03\n\n### Added\n\n- Release notes from git-cliff\n",
  });
  const result = prepareRelease({
    root: rootForGitCliffRelease,
    bump: "patch",
    date: "2026-07-03",
    gitCliffCommand: command,
    commitSubjects: ["feat: release notes from git-cliff"],
  });
  assertEqual("prepareRelease defaults to git-cliff mode", "git-cliff", result.changelogMode);
  assertIncludes("prepareRelease writes git-cliff changelog", readFileSync(path.join(rootForGitCliffRelease, "CHANGELOG.md"), "utf8"), "Release notes from git-cliff");
} finally {
  rmSync(rootForGitCliffRelease, { recursive: true, force: true });
}

console.log("\n=== prepareRelease failure atomicity ===");
const rootWithBadReadme = makeFixtureRoot();
try {
  const packageBefore = readFileSync(path.join(rootWithBadReadme, "package.json"), "utf8");
  writeFileSync(path.join(rootWithBadReadme, "README.md"), "# Fixture without install line\n");
  assertThrows("prepareRelease rejects invalid README", () => prepareRelease({ root: rootWithBadReadme, bump: "patch", date: "2026-07-03", changelogMode: "placeholder" }), "no canonical");
  assertEqual("prepareRelease failure leaves package.json unchanged", packageBefore, readFileSync(path.join(rootWithBadReadme, "package.json"), "utf8"));
} finally {
  rmSync(rootWithBadReadme, { recursive: true, force: true });
}

if (FAIL > 0) {
  console.log(`\n${FAIL} failure(s), ${PASS} pass(es).`);
  process.exit(1);
}

console.log(`\nAll ${PASS} release automation checks passed.`);
