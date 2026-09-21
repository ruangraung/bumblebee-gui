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
});
