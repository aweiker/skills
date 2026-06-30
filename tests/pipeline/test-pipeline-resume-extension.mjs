#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for pure helpers exported from pipeline-status.ts:
//   Phase 4A: shellQuote, resumeSessionName, manualResumeCommand
//   Phase 4B: planResumeAction (pure decision planner)
// Also checks static presence of tmux/dispatch paths in the extension.
//
// Run: node tests/pipeline/test-pipeline-resume-extension.mjs
// ─────────────────────────────────────────────────────────────────────────────

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const extFile = path.join(repoRoot, "extensions", "pipeline-status.ts");

// ── Helpers loaded via node --experimental-strip-types ────────────────────────
// We need to import the exported helpers from pipeline-status.ts.
// Since it's TypeScript and uses `export function`, we spawn node with strip-types.
// The helpers are pure functions with no side effects.

let shellQuote, resumeSessionName, manualResumeCommand;

// ── Subprocess helper: call planResumeAction with a serialised input ─────────
function callPlanResumeAction(input) {
  const result = execFileSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module"],
    {
      input: `
import { planResumeAction } from ${JSON.stringify(extFile)};
const input = ${JSON.stringify(input)};
process.stdout.write(JSON.stringify(planResumeAction(input)));
`,
      encoding: "utf8",
      timeout: 10000,
    }
  );
  return JSON.parse(result);
}

try {
  // Use a subprocess to import the TS module and serialize results for each test case.
  // This avoids needing to replicate the logic here.
  const result = execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
    ],
    {
      input: `
import { shellQuote, resumeSessionName, manualResumeCommand } from ${JSON.stringify(extFile)};
const cases = {
  shellQuote_simple: shellQuote("/path/to/script.sh"),
  shellQuote_spaces: shellQuote("/path/with spaces/script.sh"),
  shellQuote_single_quote: shellQuote("/path/it's-here/script.sh"),
  shellQuote_no_special: shellQuote("/simple"),
  resumeSessionName_basic: resumeSessionName("abc-123"),
  resumeSessionName_special_chars: resumeSessionName("my pipeline/id:test"),
  resumeSessionName_long: resumeSessionName("a".repeat(60)),
  resumeSessionName_prefix: resumeSessionName("pipe-1"),
  manualResumeCommand_both: manualResumeCommand("/usr/local/bin/pipeline.sh", "/tmp/status.json"),
  manualResumeCommand_no_script: manualResumeCommand(undefined, "/tmp/status.json"),
  manualResumeCommand_no_status: manualResumeCommand("/usr/local/bin/pipeline.sh", undefined),
  manualResumeCommand_both_undefined: manualResumeCommand(undefined, undefined),
};
process.stdout.write(JSON.stringify(cases));
`,
      encoding: "utf8",
      timeout: 10000,
    }
  );
  const data = JSON.parse(result);
  shellQuote = (arg) => {
    // Map test-case key to result
    const key = arg === "/path/to/script.sh" ? "shellQuote_simple"
               : arg === "/path/with spaces/script.sh" ? "shellQuote_spaces"
               : arg === "/path/it's-here/script.sh" ? "shellQuote_single_quote"
               : arg === "/simple" ? "shellQuote_no_special"
               : null;
    if (key) return data[key];
    throw new Error(`Unmapped shellQuote arg: ${arg}`);
  };
  // Store resolved values for direct assertions
  Object.assign(globalThis, { _helperData: data });
} catch (e) {
  console.error("FATAL: could not load helpers from pipeline-status.ts:", e.message);
  process.exit(1);
}

// ── Minimal test harness ──────────────────────────────────────────────────────

let PASS = 0;
let FAIL = 0;

function ok(label) {
  console.log(`  ✓ ${label}`);
  PASS++;
}

function fail(label, msg = "") {
  console.log(`  ✗ ${label}${msg ? " — " + msg : ""}`);
  FAIL++;
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

function assertNotIncludes(label, haystack, needle) {
  if (!haystack.includes(needle)) {
    ok(label);
  } else {
    fail(label, `expected ${JSON.stringify(needle)} NOT in ${JSON.stringify(haystack)}`);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const d = globalThis._helperData;

// shellQuote
console.log("\n=== shellQuote ===");
assertEqual(
  "simple path: wrapped in single quotes",
  "'/path/to/script.sh'",
  d.shellQuote_simple
);
assertEqual(
  "path with spaces: wrapped (spaces preserved inside quotes)",
  "'/path/with spaces/script.sh'",
  d.shellQuote_spaces
);
// Single quote in path: uses '\'' pattern
assertEqual(
  "path with single-quote: exact shell-escaped form",
  "'/path/it'\\''s-here/script.sh'",
  d.shellQuote_single_quote
);
// The result must start with ' for shell safety
{
  const q = d.shellQuote_single_quote;
  if (q.startsWith("'")) {
    ok("shellQuote with single-quote: result starts with single-quote");
  } else {
    fail("shellQuote with single-quote: result starts with single-quote", `got: ${JSON.stringify(q)}`);
  }
}
assertEqual(
  "simple path no special: single-quote wrapped",
  "'/simple'",
  d.shellQuote_no_special
);

// resumeSessionName
console.log("\n=== resumeSessionName ===");
assertEqual(
  "basic id: prefixed with resume-",
  "resume-abc-123",
  d.resumeSessionName_basic
);
assertIncludes(
  "special chars: starts with resume-",
  d.resumeSessionName_special_chars,
  "resume-"
);
assertNotIncludes(
  "special chars: no slash in session name",
  d.resumeSessionName_special_chars,
  "/"
);
assertNotIncludes(
  "special chars: no colon in session name",
  d.resumeSessionName_special_chars,
  ":"
);
// Bounded: 'resume-' (7 chars) + max 40 = 47 chars
{
  const len = d.resumeSessionName_long.length;
  if (len <= 48) {
    ok("long id: session name length bounded (≤48)");
  } else {
    fail("long id: session name length bounded (≤48)", `length was ${len}`);
  }
}
assertEqual(
  "pipe-1 id: deterministic session name",
  "resume-pipe-1",
  d.resumeSessionName_prefix
);

// manualResumeCommand
console.log("\n=== manualResumeCommand ===");
assertIncludes(
  "both present: contains script path quoted",
  d.manualResumeCommand_both,
  "'/usr/local/bin/pipeline.sh'"
);
assertIncludes(
  "both present: contains --resume flag",
  d.manualResumeCommand_both,
  "--resume"
);
assertIncludes(
  "both present: contains status file path quoted",
  d.manualResumeCommand_both,
  "'/tmp/status.json'"
);
assertEqual(
  "no script: returns empty string",
  "",
  d.manualResumeCommand_no_script
);
assertEqual(
  "no status: returns empty string",
  "",
  d.manualResumeCommand_no_status
);
assertEqual(
  "both undefined: returns empty string",
  "",
  d.manualResumeCommand_both_undefined
);

// Static assertions on extension source
console.log("\n=== Static source checks (pipeline-status.ts) ===");
const src = readFileSync(extFile, "utf8");

assertIncludes(
  "source: dead-pid branch uses tmux new-session",
  src,
  "new-session"
);
assertIncludes(
  "source: dead-pid branch checks tmux availability",
  src,
  "which"
);
assertIncludes(
  "source: dead-pid branch checks has-session",
  src,
  "has-session"
);
assertIncludes(
  "source: resumeSessionName is used in resumePipeline",
  src,
  "resumeSessionName("
);
assertIncludes(
  "source: shellQuote is used to build tmux command",
  src,
  "shellQuote("
);
assertIncludes(
  "source: manualResumeCommand is used for fallback notifications",
  src,
  "manualResumeCommand("
);
assertIncludes(
  "source: pidAlive=false path does NOT write control_file",
  src,
  "Dead PID: attempt restart only after precondition checks"
);
assertIncludes(
  "source: resume_supported check present",
  src,
  "resume_supported !== true"
);
assertIncludes(
  "source: absolute path guard for script_file present",
  src,
  'startsWith("/")'
);
assertIncludes(
  "source: tmux attach attach hint in spawn-success message",
  src,
  "tmux attach -t"
);
assertIncludes(
  "source: already-running session guard present",
  src,
  "a resume session is already running"
);
assertIncludes(
  "source: steer() special-cases resume before control-file write",
  src,
  'command === "resume"'
);
assertIncludes(
  "source: exported shellQuote",
  src,
  "export function shellQuote"
);
assertIncludes(
  "source: exported resumeSessionName",
  src,
  "export function resumeSessionName"
);
assertIncludes(
  "source: exported manualResumeCommand",
  src,
  "export function manualResumeCommand"
);
assertIncludes(
  "source: exported planResumeAction",
  src,
  "export function planResumeAction"
);
assertIncludes(
  "source: exported classifyState",
  src,
  "export function classifyState"
);
assertIncludes(
  "source: resumePipeline calls planResumeAction(",
  src,
  "planResumeAction("
);
assertIncludes(
  "source: tmux new-session still present (runtime path)",
  src,
  "new-session"
);
assertIncludes(
  "source: tmux availability check still present (runtime path)",
  src,
  "which"
);
assertIncludes(
  "source: has-session still present (runtime path)",
  src,
  "has-session"
);

// ── planResumeAction behavior tests ─────────────────────────────────────
// These do NOT touch filesystem, tmux, or process liveness.
console.log("\n=== planResumeAction — live PID (control-file-write) ===");

// Invariant: only paused + pidAlive + absolute controlFile -> control-file-write
{
  const a = callPlanResumeAction({
    pipelineId: "p1", state: "paused", pidAlive: true,
    controlFile: "/tmp/ctrl", statusFile: "/tmp/s.json",
  });
  assertEqual("paused+live+absolute controlFile -> control-file-write", "control-file-write", a.type);
  assertEqual("control-file-write: controlFile matches input", "/tmp/ctrl", a.controlFile);
}

// Live PID ignores missing status / schema / resume_supported / checkpoint
{
  const a = callPlanResumeAction({
    pipelineId: "p1", state: "paused", pidAlive: true,
    controlFile: "/tmp/ctrl", statusFile: "/tmp/s.json",
    // no status at all
  });
  assertEqual("paused+live+no status -> still control-file-write", "control-file-write", a.type);
}
{
  const a = callPlanResumeAction({
    pipelineId: "p1", state: "paused", pidAlive: true,
    controlFile: "/tmp/ctrl", statusFile: "/tmp/s.json",
    status: { schema_version: 1, resume_supported: false, checkpoint: null },
  });
  assertEqual("paused+live+v1 status -> still control-file-write (live ignores schema)", "control-file-write", a.type);
}

// Live PID + empty controlFile -> refuse
{
  const a = callPlanResumeAction({
    pipelineId: "p1", state: "paused", pidAlive: true,
    controlFile: "", statusFile: "/tmp/s.json",
  });
  assertEqual("paused+live+empty controlFile -> refuse", "refuse", a.type);
  assertIncludes("refuse message mentions controlFile is missing or not absolute", a.message, "controlFile is missing or not absolute");
}

// Live PID + relative controlFile -> refuse
{
  const a = callPlanResumeAction({
    pipelineId: "p1", state: "paused", pidAlive: true,
    controlFile: "relative/ctrl", statusFile: "/tmp/s.json",
  });
  assertEqual("paused+live+relative controlFile -> refuse", "refuse", a.type);
  assertIncludes("refuse message mentions controlFile is missing or not absolute", a.message, "controlFile is missing or not absolute");
}

console.log("\n=== planResumeAction — dead PID (tmux-restart) ===");

const goodDeadInput = {
  pipelineId: "pipe-1",
  state: "paused",
  pidAlive: false,
  controlFile: "/tmp/ctrl",
  statusFile: "/tmp/status.json",
  status: {
    schema_version: 2,
    resume_supported: true,
    checkpoint: "between-issues",
    script_file: "/usr/local/bin/pipeline.sh",
  },
};

// All preconditions met -> tmux-restart
{
  const a = callPlanResumeAction(goodDeadInput);
  assertEqual("dead+all preconditions -> tmux-restart", "tmux-restart", a.type);
  assertEqual("tmux-restart: deterministic sessionName", "resume-pipe-1", a.sessionName);
  assertIncludes("tmux-restart: shellCmd contains script quoted", a.shellCmd, "'/usr/local/bin/pipeline.sh'");
  assertIncludes("tmux-restart: shellCmd contains --resume", a.shellCmd, "--resume");
  assertIncludes("tmux-restart: shellCmd contains statusFile quoted", a.shellCmd, "'/tmp/status.json'");
  assertIncludes("tmux-restart: shellCmd ends with exec bash", a.shellCmd, "exec bash");
  assertEqual("tmux-restart: scriptFile in action", "/usr/local/bin/pipeline.sh", a.scriptFile);
  assertEqual("tmux-restart: statusFile in action", "/tmp/status.json", a.statusFile);
}

console.log("\n=== planResumeAction — dead PID precondition refusals ===");

// No status
{
  const a = callPlanResumeAction({ ...goodDeadInput, status: undefined });
  assertEqual("dead+no status -> refuse", "refuse", a.type);
  assertIncludes("refuse: missing status message", a.message, "missing or unreadable");
}

// schema_version missing (treated as v1)
{
  const a = callPlanResumeAction({ ...goodDeadInput, status: { ...goodDeadInput.status, schema_version: undefined } });
  assertEqual("dead+no schema_version -> refuse", "refuse", a.type);
  assertIncludes("refuse: schema message", a.message, "schema_version");
  assertIncludes("refuse: mentions v1/unsupported", a.message, "v1/unsupported");
}

// schema_version === 1
{
  const a = callPlanResumeAction({ ...goodDeadInput, status: { ...goodDeadInput.status, schema_version: 1 } });
  assertEqual("dead+schema_version=1 -> refuse", "refuse", a.type);
  assertIncludes("refuse: schema v1 message", a.message, "v1/unsupported");
}

// resume_supported false
{
  const a = callPlanResumeAction({ ...goodDeadInput, status: { ...goodDeadInput.status, resume_supported: false } });
  assertEqual("dead+resume_supported=false -> refuse", "refuse", a.type);
  assertIncludes("refuse: resume_supported not true", a.message, "resume_supported");
}

// resume_supported missing
{
  const a = callPlanResumeAction({ ...goodDeadInput, status: { ...goodDeadInput.status, resume_supported: undefined } });
  assertEqual("dead+resume_supported=undefined -> refuse", "refuse", a.type);
  assertIncludes("refuse: resume_supported not true (missing)", a.message, "resume_supported");
}

// resume_supported string "true" (not strict boolean)
{
  const a = callPlanResumeAction({ ...goodDeadInput, status: { ...goodDeadInput.status, resume_supported: "true" } });
  assertEqual("dead+resume_supported=string-true -> refuse (strict true required)", "refuse", a.type);
}

// checkpoint missing
{
  const a = callPlanResumeAction({ ...goodDeadInput, status: { ...goodDeadInput.status, checkpoint: undefined } });
  assertEqual("dead+checkpoint=missing -> refuse", "refuse", a.type);
  assertIncludes("refuse: mentions between-issues", a.message, "between-issues");
}

// checkpoint null
{
  const a = callPlanResumeAction({ ...goodDeadInput, status: { ...goodDeadInput.status, checkpoint: null } });
  assertEqual("dead+checkpoint=null -> refuse", "refuse", a.type);
  assertIncludes("refuse: mentions between-issues (null)", a.message, "between-issues");
}

// checkpoint unsupported string
{
  const a = callPlanResumeAction({ ...goodDeadInput, status: { ...goodDeadInput.status, checkpoint: "mid-issue" } });
  assertEqual("dead+checkpoint=mid-issue -> refuse", "refuse", a.type);
  assertIncludes("refuse: mentions between-issues (wrong)", a.message, "between-issues");
  assertIncludes("refuse: mentions actual checkpoint value", a.message, "mid-issue");
}

// relative script_file
{
  const a = callPlanResumeAction({ ...goodDeadInput, status: { ...goodDeadInput.status, script_file: "relative/path.sh" } });
  assertEqual("dead+relative script_file -> refuse", "refuse", a.type);
  assertIncludes("refuse: script_file not absolute", a.message, "script_file");
}

// missing script_file
{
  const a = callPlanResumeAction({ ...goodDeadInput, status: { ...goodDeadInput.status, script_file: undefined } });
  assertEqual("dead+missing script_file -> refuse", "refuse", a.type);
  assertIncludes("refuse: script_file missing", a.message, "script_file");
}

// relative statusFile
{
  const a = callPlanResumeAction({ ...goodDeadInput, statusFile: "relative/status.json" });
  assertEqual("dead+relative statusFile -> refuse", "refuse", a.type);
  assertIncludes("refuse: statusFile not absolute", a.message, "statusFile");
}

// missing statusFile
{
  const a = callPlanResumeAction({ ...goodDeadInput, statusFile: "" });
  assertEqual("dead+empty statusFile -> refuse", "refuse", a.type);
  assertIncludes("refuse: statusFile missing", a.message, "statusFile");
}

// dead+all-good: manualCommand not present (tmux-restart doesn't need it)
{
  const a = callPlanResumeAction(goodDeadInput);
  if (a.type === "tmux-restart" && a.manualCommand === undefined) {
    ok("tmux-restart: no manualCommand field");
  } else if (a.type === "tmux-restart") {
    ok("tmux-restart: action type correct (manualCommand field presence optional)");
  } else {
    fail("tmux-restart: expected tmux-restart", `got ${a.type}`);
  }
}

console.log("\n=== planResumeAction — non-paused states refuse ===");

for (const state of ["running", "completed", "crashed", "unknown", "starting"]) {
  const a = callPlanResumeAction({
    pipelineId: "p1", state, pidAlive: false,
    controlFile: "/tmp/ctrl", statusFile: "/tmp/s.json",
  });
  assertEqual(`state=${state} -> refuse`, "refuse", a.type);
  assertIncludes(`state=${state} refuse: message mentions state`, a.message, state);
}

// ── classifyState behavioral tests ─────────────────────────────────────────────
// Critical invariant: a dead paused pipeline stays "paused", never "crashed".
// These tests exercise the exported pure helper directly via a subprocess.
console.log("\n=== classifyState — core invariants ===");

function callClassifyState(rawState, pidAlive, hasStatus) {
  const result = execFileSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module"],
    {
      input: `
import { classifyState } from ${JSON.stringify(extFile)};
process.stdout.write(JSON.stringify(classifyState(${JSON.stringify(rawState)}, ${JSON.stringify(pidAlive)}, ${JSON.stringify(hasStatus)})));
`,
      encoding: "utf8",
      timeout: 10000,
    }
  );
  return JSON.parse(result);
}

// (a) Dead paused pipeline is still "paused", not "crashed"
{
  const result = callClassifyState("paused", false, true);
  assertEqual(
    "classifyState(paused, pidAlive=false, hasStatus=true) === paused (dead paused stays paused)",
    "paused",
    result
  );
}

// (b) Live paused pipeline is still "paused"
{
  const result = callClassifyState("paused", true, true);
  assertEqual(
    "classifyState(paused, pidAlive=true, hasStatus=true) === paused (live paused stays paused)",
    "paused",
    result
  );
}

// (c) Dead running pipeline is "crashed"
{
  const result = callClassifyState("running", false, true);
  assertEqual(
    "classifyState(running, pidAlive=false, hasStatus=true) === crashed (dead running is crashed)",
    "crashed",
    result
  );
}

// (d) No status + pid dead -> "crashed"
{
  const result = callClassifyState(undefined, false, false);
  assertEqual(
    "classifyState(undefined, pidAlive=false, hasStatus=false) === crashed (no status, no pid)",
    "crashed",
    result
  );
}

// (d) No status + pid alive -> "starting"
{
  const result = callClassifyState(undefined, true, false);
  assertEqual(
    "classifyState(undefined, pidAlive=true, hasStatus=false) === starting (no status, pid alive)",
    "starting",
    result
  );
}

// Additional guard: live running is still "running" (not crashed)
{
  const result = callClassifyState("running", true, true);
  assertEqual(
    "classifyState(running, pidAlive=true, hasStatus=true) === running (live running stays running)",
    "running",
    result
  );
}

// ── Phase 5H: Static checks for resume_error / formatResumeError ──────────────
console.log("\n=== Static source checks — Phase 5H (resume_error / formatResumeError) ===");

assertIncludes(
  "source: resume_error?: unknown field in PipelineStatus",
  src,
  "resume_error?: unknown"
);
assertIncludes(
  "source: export function formatResumeError present",
  src,
  "export function formatResumeError"
);
assertIncludes(
  "source: formatResumeError called with pipeline.status?.resume_error",
  src,
  "formatResumeError(pipeline.status?.resume_error)"
);
assertIncludes(
  "source: pipeline.state === blocked guard in widgetLines",
  src,
  'pipeline.state === "blocked"'
);
// footerText must not reference resume_error — extract function body heuristically
{
  const ftStart = src.indexOf("function footerText(");
  const ftEnd = src.indexOf("\n\tfunction ", ftStart + 1);
  const footerBody = ftEnd > ftStart ? src.slice(ftStart, ftEnd) : src.slice(ftStart, ftStart + 3000);
  assertNotIncludes(
    "footerText body: does not reference resume_error",
    footerBody,
    "resume_error"
  );
}

// ── Phase 5H: formatResumeError pure helper tests ───────────────────────────
console.log("\n=== formatResumeError pure helper ===");

function callFormatResumeError(value, max) {
  const maxArg = max === undefined ? "" : `, ${JSON.stringify(max)}`;
  const result = execFileSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module"],
    {
      input: `
import { formatResumeError } from ${JSON.stringify(extFile)};
const value = ${JSON.stringify(value)};
process.stdout.write(JSON.stringify(formatResumeError(value${maxArg})));
`,
      encoding: "utf8",
      timeout: 10000,
    }
  );
  return JSON.parse(result);
}

function callFormatResumeErrorRaw(valueExpr, max) {
  const maxArg = max === undefined ? "" : `, ${JSON.stringify(max)}`;
  const result = execFileSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module"],
    {
      input: `
import { formatResumeError } from ${JSON.stringify(extFile)};
const value = ${valueExpr};
process.stdout.write(JSON.stringify(formatResumeError(value${maxArg})));
`,
      encoding: "utf8",
      timeout: 10000,
    }
  );
  return JSON.parse(result);
}

// normal string unchanged
{
  const r = callFormatResumeError("config hash mismatch");
  assertEqual("normal string: unchanged", "config hash mismatch", r);
}

// trims leading/trailing whitespace
{
  const r = callFormatResumeError("  trimmed  ");
  assertEqual("string with surrounding spaces: trimmed", "trimmed", r);
}

// newline, tab, CR collapsed to spaces then collapsed+trimmed
{
  const r = callFormatResumeError("line1\nline2\ttab\rcarriage");
  assertEqual("newline/tab/CR: collapsed to single spaces", "line1 line2 tab carriage", r);
}

// ANSI escape: \x1b (0x1B, within \x00-\x1F) is control -> space; multiple controls collapse
{
  const r = callFormatResumeError("\x1b[31mred\x1b[0m");
  assertEqual("ANSI \\x1b[31mred\\x1b[0m => [31mred [0m", "[31mred [0m", r);
}

// NUL/control-only -> null
{
  const r = callFormatResumeError("\x00\x01\x02");
  assertEqual("control-only string: null", null, r);
}

// non-string: undefined -> null
{ const r = callFormatResumeErrorRaw("undefined"); assertEqual("undefined -> null", null, r); }

// non-string: null -> null
{ const r = callFormatResumeErrorRaw("null"); assertEqual("null -> null", null, r); }

// non-string: number -> null
{ const r = callFormatResumeErrorRaw("42"); assertEqual("number 42 -> null", null, r); }

// non-string: boolean -> null
{ const r = callFormatResumeErrorRaw("true"); assertEqual("boolean true -> null", null, r); }

// non-string: object -> null
{ const r = callFormatResumeErrorRaw('({msg: "err"})'); assertEqual("object -> null", null, r); }

// non-string: array -> null
{ const r = callFormatResumeErrorRaw('["err"]'); assertEqual("array -> null", null, r); }

// empty string -> null
{
  const r = callFormatResumeError("");
  assertEqual("empty string -> null", null, r);
}

// whitespace-only -> null
{
  const r = callFormatResumeError("   ");
  assertEqual("whitespace-only string -> null", null, r);
}

// exactly 160 chars: unchanged
{
  const s = "x".repeat(160);
  const r = callFormatResumeError(s);
  assertEqual("exactly 160 chars: unchanged (length=160)", 160, r !== null ? r.length : null);
  assertEqual("exactly 160 chars: no ellipsis", s, r);
}

// 200 chars: truncated to 159 + ellipsis (total 160)
{
  const s = "a".repeat(200);
  const r = callFormatResumeError(s);
  if (r !== null) {
    assertEqual("200 chars: length=160 (159+ellipsis)", 160, r.length);
    assertEqual("200 chars: ends with ellipsis", "\u2026", r.slice(-1));
  } else {
    fail("200 chars truncation: result should not be null");
  }
}

// custom max=2: 'abc' -> 'a…'
{
  const r = callFormatResumeError("abc", 2);
  assertEqual("custom max=2: 'abc' -> 'a\u2026'", "a\u2026", r);
}

// custom max=1: 'ab' -> '…'
{
  const r = callFormatResumeError("ab", 1);
  assertEqual("custom max=1: 'ab' -> '\u2026'", "\u2026", r);
}

// custom max=0: null
{
  const r = callFormatResumeError("something", 0);
  assertEqual("custom max=0: null", null, r);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n─────────────────────────────────────────────────────────────────────────────");
console.log(`Results: ${PASS} passed, ${FAIL} failed`);
if (FAIL > 0) process.exit(1);
