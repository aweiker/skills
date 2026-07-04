#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

export function buildPlaceholderChangelogEntry(nextVersion, date) {
  parseVersion(nextVersion);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`date must match YYYY-MM-DD, got ${JSON.stringify(date)}`);
  }
  return `## [${nextVersion}] - ${date}\n\n### Changed\n\n- _Describe release changes before merging._\n\n---\n\n`;
}

// Backward-compatible name for tests/callers that still use the old helper.
export const buildChangelogEntry = buildPlaceholderChangelogEntry;

function releaseRange(root, gitCommand) {
  let lastTag = "";
  try {
    lastTag = execFileSync(gitCommand, ["describe", "--tags", "--abbrev=0"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    lastTag = "";
  }
  return lastTag ? `${lastTag}..HEAD` : "HEAD";
}

function parseGitLogRecords(output, fields) {
  return output
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const parts = record.split("\x00");
      const parsed = {};
      fields.forEach((field, index) => {
        parsed[field] = parts[index] ?? "";
      });
      return parsed;
    });
}

function pullRequestNumbersByCommit({ root, gitCommand, range }) {
  const output = execFileSync(gitCommand, ["log", "--merges", "--format=%H%x00%s%x1e", range], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const byCommit = new Map();
  for (const merge of parseGitLogRecords(output, ["hash", "subject"])) {
    const match = /^Merge pull request #(\d+)\b/.exec(merge.subject);
    if (!match) {
      continue;
    }
    let introduced = "";
    try {
      introduced = execFileSync(gitCommand, ["rev-list", "--reverse", `${merge.hash}^1..${merge.hash}^2`], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      continue;
    }
    for (const hash of introduced.split("\n").map((line) => line.trim()).filter(Boolean)) {
      byCommit.set(hash, Number(match[1]));
    }
  }
  return byCommit;
}

export function collectReleaseCommits({ root, gitCommand = "git" }) {
  const range = releaseRange(root, gitCommand);
  const prNumbers = pullRequestNumbersByCommit({ root, gitCommand, range });
  const output = execFileSync(gitCommand, ["log", "--reverse", "--format=%H%x00%P%x00%B%x1e", range], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return parseGitLogRecords(output, ["hash", "parents", "message"])
    .filter((commit) => commit.parents.trim().split(/\s+/).filter(Boolean).length <= 1)
    .map((commit) => ({
      id: commit.hash,
      message: commit.message.trim(),
      prNumber: prNumbers.get(commit.hash) ?? null,
    }))
    .filter((commit) => commit.message);
}

// Backward-compatible helper for callers/tests that only need message text.
export function collectReleaseCommitSubjects({ root, gitCommand = "git" }) {
  return collectReleaseCommits({ root, gitCommand }).map((commit) => commit.message.split("\n", 1)[0]);
}

function makeScratchGitRepo(gitCommand) {
  const scratch = mkdtempSync(path.join(tmpdir(), "skills-release-cliff-"));
  execFileSync(gitCommand, ["init", "-q"], { cwd: scratch, stdio: "ignore" });
  execFileSync(gitCommand, ["config", "user.email", "release@example.invalid"], { cwd: scratch, stdio: "ignore" });
  execFileSync(gitCommand, ["config", "user.name", "Release Automation"], { cwd: scratch, stdio: "ignore" });
  writeFileSync(path.join(scratch, ".baseline"), "baseline\n");
  execFileSync(gitCommand, ["add", ".baseline"], { cwd: scratch, stdio: "ignore" });
  execFileSync(gitCommand, ["commit", "-q", "-m", "chore: baseline"], { cwd: scratch, stdio: "ignore" });
  execFileSync(gitCommand, ["tag", "v0.0.0"], { cwd: scratch, stdio: "ignore" });
  return scratch;
}

function augmentContext(context, commits, nextVersion, date) {
  const releaseTimestamp = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
  const byMessage = new Map();
  for (const commit of commits) {
    if (!byMessage.has(commit.message)) {
      byMessage.set(commit.message, []);
    }
    byMessage.get(commit.message).push(commit);
  }

  for (const release of context) {
    release.version = `v${nextVersion}`;
    release.timestamp = releaseTimestamp;
    for (const parsed of release.commits ?? []) {
      const candidates = byMessage.get(parsed.raw_message) ?? [];
      const original = candidates.shift();
      if (!original) {
        continue;
      }
      parsed.id = original.id;
      if (original.prNumber !== null) {
        parsed.github = parsed.github || {};
        parsed.github.pr_number = original.prNumber;
        parsed.remote = {
          username: parsed.remote?.username ?? null,
          pr_title: parsed.remote?.pr_title ?? null,
          pr_number: original.prNumber,
          pr_labels: parsed.remote?.pr_labels ?? [],
          is_first_time: parsed.remote?.is_first_time ?? false,
        };
      }
    }
  }
  return context;
}

function normalizeRenderedEntry(output, nextVersion, date) {
  const entry = output.trim().replace(/^## \[(?:v?\d+\.\d+\.\d+|unreleased)\] - \d{4}-\d{2}-\d{2}/m, `## [${nextVersion}] - ${date}`);
  if (!entry) {
    throw new Error(`git-cliff produced an empty changelog entry for v${nextVersion}`);
  }
  if (!entry.includes(`## [${nextVersion}] - ${date}`)) {
    throw new Error(`generated changelog entry does not contain ## [${nextVersion}] - ${date}`);
  }
  return `${entry}\n\n`;
}

export function buildGitCliffChangelogEntry({
  root,
  nextVersion,
  date,
  gitCliffCommand = "git-cliff",
  gitCommand = "git",
  commits,
}) {
  parseVersion(nextVersion);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`date must match YYYY-MM-DD, got ${JSON.stringify(date)}`);
  }
  const releaseCommits = commits || collectReleaseCommits({ root, gitCommand });
  const scratch = makeScratchGitRepo(gitCommand);
  try {
    const contextArgs = ["--config", path.join(root, "cliff.toml"), "--unreleased", "--tag", `v${nextVersion}`, "--context", "--workdir", scratch];
    const commitsForCliff = releaseCommits.length > 0 ? releaseCommits : [{ id: "", message: `chore: release v${nextVersion}`, prNumber: null }];
    for (const commit of commitsForCliff) {
      contextArgs.push("--with-commit", commit.message);
    }

    let contextOutput;
    try {
      contextOutput = execFileSync(gitCliffCommand, contextArgs, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      const stderr = err?.stderr ? String(err.stderr).trim() : "";
      throw new Error(`git-cliff failed while building changelog context for v${nextVersion}${stderr ? `: ${stderr}` : ""}`);
    }

    const context = augmentContext(JSON.parse(contextOutput), commitsForCliff, nextVersion, date);
    const contextPath = path.join(scratch, "context.json");
    writeFileSync(contextPath, `${JSON.stringify(context)}\n`);

    let output;
    try {
      output = execFileSync(gitCliffCommand, ["--config", path.join(root, "cliff.toml"), "--from-context", contextPath], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      const stderr = err?.stderr ? String(err.stderr).trim() : "";
      throw new Error(`git-cliff failed while rendering changelog for v${nextVersion}${stderr ? `: ${stderr}` : ""}`);
    }

    return normalizeRenderedEntry(output, nextVersion, date);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

export function buildReleaseChangelogEntry({
  root,
  nextVersion,
  date,
  changelogMode = "git-cliff",
  gitCliffCommand = "git-cliff",
  gitCommand = "git",
  commitSubjects,
}) {
  if (changelogMode === "placeholder") {
    return buildPlaceholderChangelogEntry(nextVersion, date);
  }
  if (changelogMode === "git-cliff") {
    const commits = commitSubjects?.map((subject) => ({ id: "", message: subject, prNumber: null }));
    return buildGitCliffChangelogEntry({ root, nextVersion, date, gitCliffCommand, gitCommand, commits });
  }
  throw new Error(`changelog mode must be git-cliff or placeholder, got ${JSON.stringify(changelogMode)}`);
}

export function insertChangelogEntry(changelogText, nextVersion, date, entry = buildPlaceholderChangelogEntry(nextVersion, date)) {
  const header = `## [${nextVersion}]`;
  if (changelogText.split("\n").some((line) => line.startsWith(header))) {
    throw new Error(`CHANGELOG.md already contains ${header}`);
  }
  if (!entry.includes(header)) {
    throw new Error(`generated changelog entry does not contain ${header}`);
  }

  const firstReleaseHeader = changelogText.search(/^## \[/m);
  if (firstReleaseHeader === -1) {
    throw new Error("CHANGELOG.md has no existing release header (`## [...]`) to insert before");
  }

  return `${changelogText.slice(0, firstReleaseHeader)}${entry}${changelogText.slice(firstReleaseHeader)}`;
}

export function prepareRelease({ root, version, bump, date, changelogMode, gitCliffCommand, gitCommand, commitSubjects }) {
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
  const changelogEntry = buildReleaseChangelogEntry({
    root,
    nextVersion,
    date: releaseDate,
    changelogMode,
    gitCliffCommand,
    gitCommand,
    commitSubjects,
  });

  const updatedPackageJson = updatePackageJson(packageJsonText, nextVersion);
  const updatedReadme = updateReadmeInstallVersion(readFileSync(readmePath, "utf8"), nextVersion);
  const updatedChangelog = insertChangelogEntry(readFileSync(changelogPath, "utf8"), nextVersion, releaseDate, changelogEntry);

  writeFileSync(packagePath, updatedPackageJson);
  writeFileSync(readmePath, updatedReadme);
  writeFileSync(changelogPath, updatedChangelog);

  return { currentVersion, nextVersion, releaseDate, changelogMode: changelogMode || "git-cliff" };
}

function parseArgs(argv) {
  const args = { root: process.cwd(), bump: "patch", changelogMode: "git-cliff" };
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
      case "--changelog-mode":
        args.changelogMode = next;
        i += 1;
        break;
      case "--git-cliff-command":
        args.gitCliffCommand = next;
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
  return `Usage: node scripts/prepare-release.mjs [--bump patch|minor|major] [--version X.Y.Z] [--date YYYY-MM-DD] [--changelog-mode git-cliff|placeholder]\n\nUpdates package.json, README.md, and CHANGELOG.md for a release PR. The default changelog mode uses git-cliff.\n`;
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
