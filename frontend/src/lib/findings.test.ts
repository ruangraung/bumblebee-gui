import { describe, expect, it } from "vitest";
import type { FindingRecord } from "@/lib/api";
import { filterAndSortFindings, findingsFilename, findingsToCSV } from "@/lib/findings";

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
