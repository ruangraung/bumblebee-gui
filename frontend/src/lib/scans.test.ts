import { describe, expect, it, vi } from "vitest";
import type { FindingRecord, PackageRecord, ScanRecord } from "@/lib/api";
import {
  comparedLine,
  findingsToFetch,
  isInProgress,
  noMatchMessage,
  partialNote,
  packagesToFetch,
  resolveActiveScan,
  resolveFindingsScan,
  scanDateLabel,
  scanPackages,
  scanSummaryLine,
} from "@/lib/scans";

function scan(overrides: Partial<ScanRecord> = {}): ScanRecord {
  return {
    id: 1,
    timestamp: "2026-09-20T16:00:00.000Z",
    profile: "baseline",
    status: "completed",
    ...overrides,
  };
}

function summary(overrides: Partial<NonNullable<ScanRecord["summary"]>> = {}) {
  return {
    total_packages: 41,
    ecosystems_found: 1,
    findings_count: 0,
    ecosystem_counts: { pypi: 41 },
    ...overrides,
  };
}

describe("isInProgress", () => {
  it("counts running and pending as in progress", () => {
    expect(isInProgress("running")).toBe(true);
    expect(isInProgress("pending")).toBe(true);
  });

  it("counts a finished scan as not in progress", () => {
    expect(isInProgress("completed")).toBe(false);
    expect(isInProgress("failed")).toBe(false);
    expect(isInProgress(undefined)).toBe(false);
  });
});

describe("resolveActiveScan", () => {
  const newest = scan({ id: 34, status: "completed" });
  const older = scan({ id: 30, status: "completed" });
  const running = scan({ id: 33, status: "running" });

  it("uses the scan named in the URL", () => {
    expect(resolveActiveScan([newest, older, running], "30")).toBe(older);
  });

  it("returns nothing when the URL names a scan that is not in the list", () => {
    expect(resolveActiveScan([newest, older], "999")).toBeNull();
  });

  it("prefers the most recent completed scan", () => {
    expect(resolveActiveScan([running, older, newest])).toBe(older);
  });

  it("falls back to the most recent scan when none has completed", () => {
    expect(resolveActiveScan([running])).toBe(running);
  });

  it("returns nothing for an empty list", () => {
    expect(resolveActiveScan([])).toBeNull();
  });
});

describe("scanPackages", () => {
  const packages = [{ package_name: "react", ecosystem: "npm", version: "18.2.0" }] as PackageRecord[];

  it("returns the cached packages for the scan", () => {
    expect(scanPackages({ 34: packages }, scan({ id: 34 }))).toBe(packages);
  });

  it("returns nothing before the results have been fetched", () => {
    expect(scanPackages({}, scan({ id: 34 }))).toEqual([]);
  });

  it("returns nothing when there is no scan", () => {
    expect(scanPackages({ 34: packages }, null)).toEqual([]);
  });
});

describe("packagesToFetch", () => {
  it("asks for a completed scan whose results are missing", () => {
    expect(packagesToFetch({}, scan({ id: 34 }))).toBe(34);
  });

  it("does not ask twice", () => {
    expect(packagesToFetch({ 34: [] }, scan({ id: 34 }))).toBeNull();
  });

  it("does not ask for a scan that has not completed", () => {
    expect(packagesToFetch({}, scan({ id: 33, status: "running" }))).toBeNull();
  });

  it("does not ask without a scan", () => {
    expect(packagesToFetch({}, null)).toBeNull();
  });
});

describe("scanSummaryLine", () => {
  it("prompts when no scan is selected", () => {
    expect(scanSummaryLine(null, 0)).toBe("No scan selected. Run a scan first.");
  });

  it("reports the finished scan's own total", () => {
    const line = scanSummaryLine(scan({ summary: summary({ total_packages: 41 }) }), 0);
    expect(line).toBe("2026-09-20 · baseline · 41 packages");
  });

  it("falls back to the loaded package count without a summary", () => {
    expect(scanSummaryLine(scan(), 7)).toBe("2026-09-20 · baseline · 7 packages");
  });

  it("reports the status while the scan is still going", () => {
    expect(scanSummaryLine(scan({ status: "running" }), 12)).toBe("2026-09-20 · baseline · running");
  });
});

describe("scanDateLabel", () => {
  it("reads n/a when the scan has no timestamp", () => {
    expect(scanDateLabel(undefined)).toBe("n/a");
    expect(scanDateLabel("")).toBe("n/a");
  });

  it("reads n/a for a timestamp it cannot parse", () => {
    expect(scanDateLabel("not a date")).toBe("n/a");
  });

  it("labels the scan with the reader's own day, not the UTC day", () => {
    // 18:01 UTC is already the twenty-first in Jakarta (UTC+7). vi.stubEnv is
    // used rather than touching process.env directly, because the frontend
    // build type-checks these files without Node's globals.
    vi.stubEnv("TZ", "Asia/Jakarta");
    expect(scanDateLabel("2026-09-20T18:01:10.000Z")).toBe("2026-09-21");
    vi.unstubAllEnvs();
  });
});

describe("noMatchMessage", () => {
  it("says the scan found nothing when no filter is active", () => {
    expect(noMatchMessage({ search: "", ecosystem: "all" })).toBe("No packages found in this scan.");
  });

  it("says the filters excluded everything", () => {
    expect(noMatchMessage({ search: "react", ecosystem: "all" })).toBe("No packages match your filters.");
    expect(noMatchMessage({ search: "", ecosystem: "pypi" })).toBe("No packages match your filters.");
  });
});

describe("resolveFindingsScan", () => {
  const withFindings = scan({ id: 31, summary: summary({ findings_count: 3 }) });
  const clean = scan({ id: 34, summary: summary({ findings_count: 0 }) });

  it("honours the scan named in the URL, findings or not", () => {
    expect(resolveFindingsScan([clean, withFindings], "34")).toBe(clean);
  });

  it("prefers a completed scan that has findings", () => {
    expect(resolveFindingsScan([clean, withFindings])).toBe(withFindings);
  });

  it("falls back to the results page rule when no scan has findings", () => {
    expect(resolveFindingsScan([clean])).toBe(clean);
  });
});

describe("findingsToFetch", () => {
  const findings = [{ package_name: "x", version: "1", ecosystem: "npm" }] as FindingRecord[];

  it("asks for a completed scan whose findings are missing", () => {
    expect(findingsToFetch({}, scan({ id: 31 }))).toBe(31);
  });

  it("does not ask twice", () => {
    expect(findingsToFetch({ 31: findings }, scan({ id: 31 }))).toBeNull();
  });

  it("does not ask for a scan that has not completed", () => {
    expect(findingsToFetch({}, scan({ id: 33, status: "running" }))).toBeNull();
  });

  it("does not ask without a scan", () => {
    expect(findingsToFetch({}, null)).toBeNull();
  });
});

describe("comparedLine", () => {
  it("counts what was examined", () => {
    expect(comparedLine(scan({ summary: summary({ total_packages: 780 }) }))).toBe("780 packages examined.");
  });

  it("reads a single package in the singular", () => {
    expect(comparedLine(scan({ summary: summary({ total_packages: 1 }) }))).toBe("1 package examined.");
  });

  it("says so when the scan recorded no count", () => {
    expect(comparedLine(scan())).toBe("This scan recorded no package count.");
    expect(comparedLine(null)).toBe("This scan recorded no package count.");
  });
});

describe("partialNote", () => {
  it("says nothing for a scan that finished", () => {
    expect(partialNote(scan({ summary: summary() }))).toBeNull();
    expect(partialNote(scan())).toBeNull();
    expect(partialNote(null)).toBeNull();
  });

  it("says the results are partial for a scan that stopped at its time limit", () => {
    const stopped = scan({ summary: summary({ timed_out: true, duration_ms: 53, files_considered: 6455 }) });
    expect(partialNote(stopped)).toBe("Results are partial. The scan did not finish walking the tree.");
  });
});
