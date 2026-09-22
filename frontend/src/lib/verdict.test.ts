import { describe, expect, it } from "vitest";
import type { ScanRecord } from "@/lib/api";
import { scanVerdict } from "@/lib/verdict";

function scan(overrides: Partial<ScanRecord> = {}): ScanRecord {
  return {
    id: 43,
    timestamp: "2026-09-22T05:00:00.000Z",
    profile: "project",
    status: "completed",
    summary: {
      total_packages: 544,
      ecosystems_found: 2,
      findings_count: 0,
      ecosystem_counts: { npm: 544 },
    },
    ...overrides,
  };
}

function withFindings(findingsCount: number): ScanRecord {
  return scan({
    summary: {
      total_packages: 544,
      ecosystems_found: 2,
      findings_count: findingsCount,
      ecosystem_counts: { npm: 544 },
    },
  });
}

describe("scanVerdict", () => {
  it("reads a finished scan with no matches as clean", () => {
    expect(scanVerdict(scan())).toEqual({ matched: 0, clean: true, label: "No catalogue matches" });
  });

  it("counts a single match in the singular", () => {
    const verdict = scanVerdict(withFindings(1));
    expect(verdict?.clean).toBe(false);
    expect(verdict?.label).toBe("1 catalogue match");
  });

  it("counts several matches in the plural", () => {
    expect(scanVerdict(withFindings(7))?.label).toBe("7 catalogue matches");
  });

  it("gives no verdict while the scan is still running", () => {
    expect(scanVerdict(scan({ status: "running" }))).toBeNull();
  });

  it("gives no verdict for a failed scan", () => {
    expect(scanVerdict(scan({ status: "failed" }))).toBeNull();
  });

  it("gives no verdict for a finished scan that recorded no summary", () => {
    expect(scanVerdict(scan({ summary: undefined }))).toBeNull();
  });

  it("gives no verdict without a scan", () => {
    expect(scanVerdict(null)).toBeNull();
  });

  // A scan that hit the time limit is not clean even with zero matches, and
  // the verdict carries a partial-results note. A full scan reads clean.
  const cases: { name: string; findings: number; timedOut: boolean; label: string; clean: boolean; note?: string }[] = [
    { name: "truncated with no matches", findings: 0, timedOut: true, label: "Scan stopped at the time limit", clean: false, note: "Results are partial. The scan did not finish walking the tree." },
    { name: "truncated with matches", findings: 2, timedOut: true, label: "2 catalogue matches", clean: false, note: "Results are partial. The scan did not finish walking the tree." },
    { name: "full scan with no matches", findings: 0, timedOut: false, label: "No catalogue matches", clean: true },
  ];

  for (const c of cases) {
    it(`reads ${c.name}`, () => {
      const summary = scan({
        summary: {
          total_packages: 300,
          ecosystems_found: 1,
          findings_count: c.findings,
          ecosystem_counts: { npm: 300 },
          timed_out: c.timedOut,
          duration_ms: c.timedOut ? 50 : 1,
          files_considered: c.timedOut ? 6000 : 8000,
        },
      });
      const result = scanVerdict(summary);
      expect(result?.clean).toBe(c.clean);
      expect(result?.label).toBe(c.label);
      expect(result?.note).toBe(c.note);
    });
  }
});
