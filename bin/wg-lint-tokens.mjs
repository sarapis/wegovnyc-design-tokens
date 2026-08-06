#!/usr/bin/env node
/**
 * wg-lint-tokens — warn when CSS bypasses the design system.
 *
 * WARN ONLY. Always exits 0 unless you pass --strict. It is a signal, not a
 * gate: a lint that can break a deploy gets disabled the first time it is
 * wrong, and this one is deliberately heuristic.
 *
 * It flags exactly two things, both of which make a value UNREACHABLE BY THE
 * BRAND VARIANT — the bug the two-tier system exists to prevent:
 *
 *   1. A colour literal in a declaration      →  use a --wg-* semantic
 *   2. A reference-tier read, var(--db-*)     →  use the --wg-* that aliases it
 *
 * What it deliberately does NOT flag, so the report stays worth reading:
 *
 *   • rgba()/hsla() with alpha. Almost always a deliberate overlay ("white at
 *     8%") with no semantic equivalent. Flagging ~25 of them forever is how a
 *     warning becomes noise and stops being read.
 *   • Hex inside a var() fallback — `var(--wg-brand, #162e51)`. The token is
 *     doing the work; the literal is a safety net. (Note the trade-off: a
 *     fallback also MASKS a stale package install. See the README.)
 *   • Anything on a line annotated `wg-lint-ok`, or in an ignored file.
 *
 * Usage:
 *   wg-lint-tokens [globDir=src] [--strict] [--ignore=a.css,b.css]
 *
 * Config (optional), .wg-lintrc.json at the repo root:
 *   { "roots": ["src"], "ignore": ["printable-doc.css"] }
 */

import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const cliIgnore = (argv.find((a) => a.startsWith('--ignore=')) || '').replace('--ignore=', '');
const cliRoot = argv.find((a) => !a.startsWith('--'));

let cfg = {};
for (const name of ['.wg-lintrc.json']) {
  if (fs.existsSync(name)) { try { cfg = JSON.parse(fs.readFileSync(name, 'utf8')); } catch { /* ignore */ } }
}
const roots = cliRoot ? [cliRoot] : (cfg.roots || ['src']);
const ignore = new Set([...(cfg.ignore || []), ...(cliIgnore ? cliIgnore.split(',') : [])].filter(Boolean));

const files = [];
const walk = (dir) => {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(full); }
    else if (e.name.endsWith('.css') && !ignore.has(e.name)) files.push(full);
  }
};
roots.forEach(walk);

// Strip comments so a hex inside prose is never reported.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const findings = [];

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const lines = stripComments(raw).split('\n');
  const rawLines = raw.split('\n');
  lines.forEach((line, i) => {
    if (/wg-lint-ok/.test(rawLines[i])) return;

    // A line may hold several declarations (`.x { color: red; gap: 2px }`), so
    // split on both block punctuation and `;` rather than assuming the
    // one-declaration-per-line formatting this codebase happens to use. An
    // earlier version matched `^prop: value` only and silently missed every
    // single-line rule — caught by the self-test, not by reading it.
    for (const segment of line.split(/[{};]/)) {
      const m = segment.match(/^\s*([a-z-]+)\s*:\s*(.+?)\s*$/);
      if (!m) continue;
      const [, prop, value] = m;
      if (prop.startsWith('--')) continue;          // token definitions are the package's job

      // 2. reference-tier reads
      for (const ref of value.match(/var\(\s*--db-[a-z0-9-]+/g) || []) {
        findings.push({ file, line: i + 1, kind: 'reference-tier read', prop, detail: ref.replace('var(', '').trim(), text: rawLines[i].trim() });
      }

      // 1. colour literals — but not the fallback slot of a var()
      const withoutFallbacks = value.replace(/var\([^)]*\)?/g, '');
      for (const hex of withoutFallbacks.match(HEX) || []) {
        findings.push({ file, line: i + 1, kind: 'colour literal', prop, detail: hex, text: rawLines[i].trim() });
      }
    }
  });
}

/* ---- Baseline -------------------------------------------------------------
   Legacy stylesheets carry literals that predate the system (wegov.nyc's
   globals.css has ~90). Reporting them on every build is how a warning becomes
   wallpaper. So known findings are recorded once and the run reports only what
   is NEW — the property that makes a warn-only lint worth reading.

   Keyed by file + kind + value, NOT by line number, so unrelated edits above a
   finding don't resurface it as new.

   Regenerate deliberately, and let the diff be reviewed:
     npx wg-lint-tokens --update-baseline
--------------------------------------------------------------------------- */
const BASELINE_FILE = '.wg-lint-baseline.json';
const key = (f) => `${f.file}|${f.kind}|${f.detail}|${f.prop}`;

if (argv.includes('--update-baseline')) {
  const keys = [...new Set(findings.map(key))].sort();
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({ note: 'Known pre-existing findings. Only NEW ones are reported. Regenerate with --update-baseline.', keys }, null, 2) + '\n');
  console.log(`wg-lint-tokens: baseline written — ${keys.length} distinct finding${keys.length === 1 ? '' : 's'} (${findings.length} occurrence${findings.length === 1 ? '' : 's'}) in ${BASELINE_FILE}`);
  process.exit(0);
}

let baseline = new Set();
if (fs.existsSync(BASELINE_FILE)) {
  try { baseline = new Set(JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).keys || []); } catch { /* ignore */ }
}
const fresh = findings.filter((f) => !baseline.has(key(f)));
const known = findings.length - fresh.length;

const label = `wg-lint-tokens: scanned ${files.length} stylesheet${files.length === 1 ? '' : 's'}`;
const knownNote = known ? ` (${known} known, baselined)` : '';

if (!fresh.length) {
  console.log(`✓ ${label} — nothing new bypassing the design system${knownNote}.`);
  process.exit(0);
}

console.log(`\n⚠ ${label} — ${fresh.length} NEW value${fresh.length === 1 ? '' : 's'} the brand variant cannot reach${knownNote}:\n`);
const byFile = fresh.reduce((acc, f) => ((acc[f.file] ||= []).push(f), acc), {});
for (const [file, list] of Object.entries(byFile)) {
  console.log(`  ${file}`);
  for (const f of list) console.log(`    ${String(f.line).padStart(5)}  ${f.kind.padEnd(20)} ${f.detail.padEnd(24)} ${f.text.slice(0, 60)}`);
  console.log('');
}
console.log('  Fix: use a --wg-* semantic. If none fits, add one to');
console.log('  @wegovnyc/design-tokens core.css and bump the dependency in EVERY consumer.');
console.log('  Intentional? Put `wg-lint-ok` in a comment on that line, with a reason.');
console.log('  Legacy sheet you are not migrating now? npx wg-lint-tokens --update-baseline\n');

process.exit(strict ? 1 : 0);
