import { describe, expect, it } from "vitest";
import type { FindingRecord } from "@/lib/api";
import { bySeverity, severitiesPresent, severityLabel, severityRank } from "@/lib/severity";

function finding(overrides: Partial<FindingRecord> = {}): FindingRecord {
  return {
    package_name: "example",
    version: "1.0.0",
    ecosystem: "npm",
    severity: "high",
    catalog_id: "advisory-2026-0042",
    catalog_name: "example (compromised release)",
    evidence: "exact name+version match",
    ...overrides,
  };
}

describe("severityLabel", () => {
  it("uppercases a known severity", () => {
    expect(severityLabel("critical")).toBe("CRITICAL");
    expect(severityLabel("low")).toBe("LOW");
  });

  it("accepts any casing from a catalog", () => {
    expect(severityLabel("HiGh")).toBe("HIGH");
  });

  it("shows an unknown severity as written rather than hiding it", () => {
    expect(severityLabel("unrated")).toBe("UNRATED");
  });
});

describe("severityRank", () => {
  it("ranks the known severities from most to least urgent", () => {
    expect(severityRank("critical")).toBe(0);
    expect(severityRank("high")).toBe(1);
    expect(severityRank("medium")).toBe(2);
    expect(severityRank("low")).toBe(3);
    expect(severityRank("info")).toBe(4);
  });

  it("ranks an unlisted catalog value last", () => {
    expect(severityRank("unrated")).toBe(99);
    expect(severityRank("unrated")).toBeGreaterThan(severityRank("info"));
  });
});

describe("bySeverity", () => {
  it("sorts the most urgent finding first", () => {
    const sorted = [finding({ severity: "low" }), finding({ severity: "critical" })].sort(bySeverity);
    expect(sorted.map((f) => f.severity)).toEqual(["critical", "low"]);
  });
});

describe("severitiesPresent", () => {
  it("returns each severity once, in rank order", () => {
    const findings = [
      finding({ severity: "low" }),
      finding({ severity: "critical" }),
      finding({ severity: "low" }),
      finding({ severity: "medium" }),
    ];
    expect(severitiesPresent(findings)).toEqual(["critical", "medium", "low"]);
  });

  it("keeps an unknown severity behind the known ones", () => {
    expect(severitiesPresent([finding({ severity: "unrated" }), finding({ severity: "info" })])).toEqual([
      "info",
      "unrated",
    ]);
  });

  it("reports nothing for a scan with no findings", () => {
    expect(severitiesPresent([])).toEqual([]);
  });
});
