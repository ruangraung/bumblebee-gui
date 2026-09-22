import { describe, expect, it } from "vitest";
import type { FindingRecord, ScanRecord } from "@/lib/api";
import {
  filterAndSortFindings,
  findingsEmptyKind,
  findingsFilename,
  findingsToCSV,
} from "@/lib/findings";

function finding(overrides: Partial<FindingRecord> = {}): FindingRecord {
  return {
    package_name: "lodash",
    version: "4.17.20",
    ecosystem: "npm",
    severity: "high",
    catalog_id: "cat-1",
    catalog_name: "Example catalog",
    evidence: "matches advisory",
    source_file: "/app/package-lock.json",
    ...overrides,
  };
}

const all = [finding({ package_name: "lodash" }), finding({ package_name: "requests", ecosystem: "pypi" })];

describe("filterAndSortFindings", () => {
  it("finds a package when the search carries a trailing space", () => {
    const result = filterAndSortFindings(all, { search: "lodash ", severity: "all", ecosystem: "all" });
    expect(result.map((f) => f.package_name)).toEqual(["lodash"]);
  });

  it("treats a whitespace-only search as no search", () => {
    expect(filterAndSortFindings(all, { search: "   ", severity: "all", ecosystem: "all" })).toHaveLength(2);
  });

  it("filters by ecosystem", () => {
    const result = filterAndSortFindings(all, { search: "", severity: "all", ecosystem: "pypi" });
    expect(result.map((f) => f.package_name)).toEqual(["requests"]);
  });

  it("does not reorder the caller's array", () => {
    const input = [finding({ package_name: "b" }), finding({ package_name: "a" })];
    filterAndSortFindings(input, { search: "", severity: "all", ecosystem: "all" });
    expect(input.map((f) => f.package_name)).toEqual(["b", "a"]);
  });
});

describe("findingsToCSV", () => {
  it("names the exported columns in the header", () => {
    expect(findingsToCSV([]).split(",")).toEqual([
      "package_name",
      "version",
      "ecosystem",
      "severity",
      "catalog_id",
      "catalog_name",
      "evidence",
      "source_file",
    ]);
  });

  it("guards a hostile package name", () => {
    const csv = findingsToCSV([finding({ package_name: "=1+1" })]);
    expect(csv.split("\n")[1].startsWith("'=1+1,")).toBe(true);
  });
});

describe("findingsFilename", () => {
  it("names the file after the scan", () => {
    expect(findingsFilename(31, "csv")).toBe("findings-31.csv");
  });

  it("falls back to latest before a scan is committed", () => {
    expect(findingsFilename(undefined, "json")).toBe("findings-latest.json");
  });
});

describe("findingsEmptyKind", () => {
  function scan(overrides: Partial<ScanRecord> = {}): ScanRecord {
    return {
      id: 1,
      timestamp: "2026-09-20T16:00:00.000Z",
      profile: "baseline",
      status: "completed",
      ...overrides,
    };
  }

  function finished(findingsCount: number): ScanRecord {
    return scan({
      summary: {
        total_packages: 780,
        ecosystems_found: 2,
        findings_count: findingsCount,
        ecosystem_counts: { npm: 740, pypi: 40 },
      },
    });
  }

  it("shows the table while the findings are still loading", () => {
    expect(findingsEmptyKind({ loading: true, scans: [], activeScan: null, findingsCount: 0 })).toBe(
      "none",
    );
  });

  it("prompts for a scan when none has run", () => {
    expect(findingsEmptyKind({ loading: false, scans: [], activeScan: null, findingsCount: 0 })).toBe(
      "no-scans",
    );
  });

  it("reports a running scan as running, not as a scan that matched nothing", () => {
    const running = scan({ status: "running" });
    expect(
      findingsEmptyKind({ loading: false, scans: [running], activeScan: running, findingsCount: 0 }),
    ).toBe("running");
  });

  it("keeps a failed scan out of the no-matches case", () => {
    const failed = scan({ status: "failed" });
    expect(
      findingsEmptyKind({ loading: false, scans: [failed], activeScan: failed, findingsCount: 0 }),
    ).toBe("failed");
  });

  // A truncated scan must not be reported as one that matched nothing, and a
  // truncated scan that did match something still gets the table.
  const truncated = (findingsCount: number) =>
    scan({
      summary: {
        total_packages: findingsCount > 0 ? 300 : 0,
        ecosystems_found: findingsCount > 0 ? 1 : 0,
        findings_count: findingsCount,
        ecosystem_counts: findingsCount > 0 ? { npm: 300 } : {},
        timed_out: true,
        duration_ms: findingsCount > 0 ? 50 : 1,
        files_considered: findingsCount > 0 ? 6000 : 16,
      },
    });

  const truncatedCases: { name: string; findingsCount: number; expected: string }[] = [
    { name: "stopped at the time limit with no matches", findingsCount: 0, expected: "partial" },
    { name: "stopped at the time limit but matched something", findingsCount: 2, expected: "none" },
  ];

  for (const c of truncatedCases) {
    it(`keeps a scan that ${c.name} out of the no-matches case`, () => {
      const stopped = truncated(c.findingsCount);
      expect(
        findingsEmptyKind({
          loading: false,
          scans: [stopped],
          activeScan: stopped,
          findingsCount: c.findingsCount,
        }),
      ).toBe(c.expected);
    });
  }

  it("reads an empty result from a finished scan as no matches", () => {
    const clean = finished(0);
    expect(
      findingsEmptyKind({ loading: false, scans: [clean], activeScan: clean, findingsCount: 0 }),
    ).toBe("no-findings");
  });

  it("shows the table once the scan has matches", () => {
    const matched = finished(3);
    expect(
      findingsEmptyKind({ loading: false, scans: [matched], activeScan: matched, findingsCount: 3 }),
    ).toBe("none");
  });

  it("shows the table when a selected scan is missing from the list", () => {
    expect(
      findingsEmptyKind({ loading: false, scans: [scan()], activeScan: null, findingsCount: 0 }),
    ).toBe("none");
  });
});
