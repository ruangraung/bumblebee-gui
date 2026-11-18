#!/usr/bin/env node
/**
 * npm audit gate with an expiring exception list.
 *
 * `npm audit --audit-level=high` cannot express "this one advisory is known,
 * accepted and under review". This reads the same report and fails on any high
 * or critical advisory the exception file does not name, fails closed when the
 * report itself is unreadable, and fails once an exception's date has passed.
 *
 * Exit codes: 0 clean, 1 unexpected advisory, 2 report unusable, 3 exception expired.
 */

import { readFile } from "node:fs/promises";

const SEVERITIES = new Set(["high", "critical"]);

function ghsaId(via) {
  const url = typeof via?.url === "string" ? via.url : "";
  const match = url.match(/GHSA-[0-9a-z-]+/i);
  return match ? match[0].toUpperCase() : "";
}

function todayIso(now) {
  return now.toISOString().slice(0, 10);
}

export function evaluate({ report, exceptions, now = new Date() }) {
  const fail = (code, message) => ({
    ok: false,
    exitCode: code,
    failures: [message],
    warnings: [],
  });

  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return fail(2, "audit report is not an object; the gate cannot judge it");
  }
  if (report.error) {
    const detail = report.error.summary || report.error.code || "unknown error";
    return fail(2, `npm audit could not produce a report: ${detail}`);
  }
  if (!report.vulnerabilities || typeof report.vulnerabilities !== "object") {
    return fail(2, "audit report has no vulnerabilities map; the gate cannot judge it");
  }

  const today = todayIso(now);
  const active = new Map();
  const warnings = [];
  for (const entry of exceptions ?? []) {
    if (!entry?.id || !Array.isArray(entry.packages) || !entry.expires) {
      return fail(2, "exception entries need id, packages and expires");
    }
    if (entry.expires < today) {
      return fail(
        3,
        `exception for ${entry.id} lapsed on ${entry.expires}; re-check the advisory and remove or renew it`,
      );
    }
    active.set(entry.id.toUpperCase(), entry);
  }

  const vulnerabilities = report.vulnerabilities;
  const excused = new Map();
  const isExcused = (name) => {
    if (excused.has(name)) return excused.get(name);
    const vuln = vulnerabilities[name];
    if (!vuln || !SEVERITIES.has(vuln.severity)) {
      excused.set(name, true);
      return true;
    }
    const vias = Array.isArray(vuln.via) ? vuln.via : [];
    const direct = vias.filter((via) => via && typeof via === "object");
    let verdict;
    if (direct.length > 0) {
      verdict = direct.every((via) => {
        const id = ghsaId(via);
        const entry = active.get(id);
        return Boolean(entry) && entry.packages.includes(name);
      });
    } else {
      const parents = vias.filter((via) => typeof via === "string");
      verdict = parents.length > 0 && parents.every((parent) => isExcused(parent));
    }
    excused.set(name, verdict);
    return verdict;
  };

  const failures = [];
  for (const [name, vuln] of Object.entries(vulnerabilities)) {
    if (!SEVERITIES.has(vuln?.severity)) continue;
    if (isExcused(name)) continue;
    const ids = (vuln.via ?? [])
      .map((via) => ghsaId(via))
      .filter(Boolean)
      .join(", ");
    failures.push(`${name} ${vuln.severity}${ids ? ` (${ids})` : ""}`);
  }

  for (const [id, entry] of active) {
    const used = Object.values(vulnerabilities).some((vuln) =>
      (vuln.via ?? []).some((via) => ghsaId(via) === id),
    );
    if (!used) {
      warnings.push(`${id} is listed in the exceptions but no longer reported; remove the entry`);
    }
  }

  return { ok: failures.length === 0, exitCode: failures.length === 0 ? 0 : 1, failures, warnings };
}

function selfTest() {
  const exceptionally = {
    id: "GHSA-fc5q-39xc-vjpf",
    packages: ["picomatch", "fdir", "tinyglobby", "vite", "vitest"],
    expires: "2026-12-16",
  };
  const now = new Date("2026-11-18T00:00:00Z");
  const disputed = {
    vulnerabilities: {
      picomatch: {
        severity: "high",
        via: [{ url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf" }],
      },
      fdir: { severity: "high", via: ["picomatch"] },
      tinyglobby: { severity: "high", via: ["fdir", "picomatch"] },
      vite: { severity: "high", via: ["picomatch", "tinyglobby"] },
      vitest: { severity: "high", via: ["vite", "tinyglobby"] },
    },
    metadata: { vulnerabilities: { high: 5 } },
  };

  const cases = [
    ["error report fails closed", { report: { error: { summary: "network down" } }, exceptions: [] }, 2],
    ["missing map fails closed", { report: { metadata: {} }, exceptions: [] }, 2],
    ["clean report passes", { report: { vulnerabilities: {}, metadata: {} }, exceptions: [] }, 0],
    ["disputed advisory excused", { report: disputed, exceptions: [exceptionally] }, 0],
    [
      "unlisted advisory fails",
      {
        report: {
          vulnerabilities: {
            ...disputed.vulnerabilities,
            lodash: {
              severity: "high",
              via: [{ url: "https://github.com/advisories/GHSA-0000-1111-2222" }],
            },
          },
        },
        exceptions: [exceptionally],
      },
      1,
    ],
    [
      "derived chain keeps an unrelated high advisory failing",
      {
        report: {
          vulnerabilities: {
            picomatch: disputed.vulnerabilities.picomatch,
            "unpatched-thing": {
              severity: "high",
              via: [{ url: "https://github.com/advisories/GHSA-9999-8888-7777" }],
            },
            vite: { severity: "high", via: ["picomatch", "unpatched-thing"] },
          },
        },
        exceptions: [exceptionally],
      },
      1,
    ],
    ["below threshold passes", {
      report: {
        vulnerabilities: {
          minimist: { severity: "moderate", via: [{ url: "https://github.com/advisories/GHSA-2222-3333-4444" }] },
        },
      },
      exceptions: [],
    }, 0],
    [
      "expired exception fails",
      { report: disputed, exceptions: [{ ...exceptionally, expires: "2026-11-17" }] },
      3,
    ],
  ];

  let failed = 0;
  for (const [label, input, expected] of cases) {
    const result = evaluate({ ...input, now });
    const ok = result.exitCode === expected;
    if (!ok) failed += 1;
    console.log(`${ok ? "ok  " : "FAIL"} ${label} (expected ${expected}, got ${result.exitCode})`);
  }
  if (failed > 0) {
    console.error(`${failed} self-test case(s) failed`);
    process.exit(1);
  }
}

async function main() {
  const [, , target] = process.argv;
  if (target === "--self-test") {
    selfTest();
    return;
  }
  if (!target) {
    console.error("usage: audit-gate.mjs <npm-audit-report.json> | --self-test");
    process.exit(2);
  }

  const exceptionsPath = new URL("../audit-exceptions.json", import.meta.url);
  let exceptions = [];
  try {
    exceptions = (JSON.parse(await readFile(exceptionsPath, "utf8")).exceptions ?? []);
  } catch (error) {
    console.error(`cannot read ${exceptionsPath.pathname}: ${error.message}`);
    process.exit(2);
  }

  let report;
  try {
    report = JSON.parse(await readFile(target, "utf8"));
  } catch (error) {
    console.error(`cannot read the audit report: ${error.message}`);
    process.exit(2);
  }

  const result = evaluate({ report, exceptions });
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  if (!result.ok) {
    for (const failure of result.failures) console.error(`vulnerable: ${failure}`);
    console.error(`see frontend/audit-exceptions.json for the accepted advisories`);
    process.exit(result.exitCode);
  }
  console.log("audit gate: no unaccepted high or critical advisories");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
