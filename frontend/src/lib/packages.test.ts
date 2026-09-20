import { describe, expect, it } from "vitest";
import type { PackageRecord } from "@/lib/api";
import {
  PAGE_SIZE,
  buildPageNumbers,
  exportFilename,
  filterAndSortPackages,
  getEcosystems,
  packagesToCSV,
  packagesToTSV,
  pageCount,
  pageRange,
  paginate,
} from "@/lib/packages";

function pkg(overrides: Partial<PackageRecord> = {}): PackageRecord {
  return {
    package_name: "pkg",
    ecosystem: "npm",
    version: "1.0.0",
    source_type: "lockfile",
    project_path: "/app",
    confidence: "high",
    ...overrides,
  };
}

const CSV_HEADER = "package_name,ecosystem,version,source_type,project_path,confidence";

describe("packagesToCSV", () => {
  it("names the exported columns in the header", () => {
    expect(packagesToCSV([])).toBe(CSV_HEADER);
  });

  it("writes one line per package", () => {
    const csv = packagesToCSV([pkg({ package_name: "react", version: "18.2.0" })]);
    expect(csv).toBe(`${CSV_HEADER}\nreact,npm,18.2.0,lockfile,/app,high`);
  });

  it("leaves a column empty when the package has no value for it", () => {
    const csv = packagesToCSV([pkg({ project_path: undefined })]);
    expect(csv.split("\n")[1]).toBe("pkg,npm,1.0.0,lockfile,,high");
  });

  it("escapes a value that carries the delimiter", () => {
    const csv = packagesToCSV([pkg({ project_path: "/home/me,other" })]);
    expect(csv).toContain('"/home/me,other"');
  });

  it("guards a hostile package name", () => {
    const csv = packagesToCSV([pkg({ package_name: "=1+1" })]);
    expect(csv.split("\n")[1]).toBe("'=1+1,npm,1.0.0,lockfile,/app,high");
  });
});

describe("packagesToTSV", () => {
  it("leaves out the header so a paste lands as columns", () => {
    const tsv = packagesToTSV([pkg({ package_name: "react" })]);
    expect(tsv).toBe("react\tnpm\t1.0.0\tlockfile\t/app\thigh");
  });

  it("separates packages with a newline", () => {
    const tsv = packagesToTSV([pkg({ package_name: "a" }), pkg({ package_name: "b" })]);
    expect(tsv.split("\n")).toHaveLength(2);
  });

  it("returns an empty string for no packages", () => {
    expect(packagesToTSV([])).toBe("");
  });

  it("guards a hostile package name", () => {
    const tsv = packagesToTSV([pkg({ package_name: "=1+1" })]);
    expect(tsv).toBe("'=1+1\tnpm\t1.0.0\tlockfile\t/app\thigh");
  });
});

describe("getEcosystems", () => {
  it("returns each ecosystem once, sorted", () => {
    const packages = [pkg({ ecosystem: "npm" }), pkg({ ecosystem: "pypi" }), pkg({ ecosystem: "npm" })];
    expect(getEcosystems(packages)).toEqual(["npm", "pypi"]);
  });

  it("returns nothing for an empty scan", () => {
    expect(getEcosystems([])).toEqual([]);
  });
});

describe("filterAndSortPackages", () => {
  const react = pkg({ package_name: "react", ecosystem: "npm", version: "18.2.0" });
  const reactDom = pkg({ package_name: "react-dom", ecosystem: "npm", version: "18.2.0" });
  const requests = pkg({ package_name: "requests", ecosystem: "pypi", version: "2.31.0" });
  const all = [react, reactDom, requests];

  it("matches the search term anywhere in the name, ignoring case", () => {
    const result = filterAndSortPackages(all, { search: "REACT", ecosystem: "all", sortKey: "name-asc" });
    expect(result.map((p) => p.package_name)).toEqual(["react", "react-dom"]);
  });

  it("treats a whitespace-only search as no search", () => {
    const result = filterAndSortPackages(all, { search: "   ", ecosystem: "all", sortKey: "name-asc" });
    expect(result).toHaveLength(3);
  });

  it("finds a package when the search carries a trailing space", () => {
    const result = filterAndSortPackages(all, { search: "react ", ecosystem: "all", sortKey: "name-asc" });
    expect(result.map((p) => p.package_name)).toEqual(["react", "react-dom"]);
  });

  it("filters to one ecosystem", () => {
    const result = filterAndSortPackages(all, { search: "", ecosystem: "pypi", sortKey: "name-asc" });
    expect(result.map((p) => p.package_name)).toEqual(["requests"]);
  });

  it("combines the search and the ecosystem filter", () => {
    const result = filterAndSortPackages(all, { search: "react", ecosystem: "pypi", sortKey: "name-asc" });
    expect(result).toEqual([]);
  });

  it("sorts by name in both directions", () => {
    const asc = filterAndSortPackages(all, { search: "", ecosystem: "all", sortKey: "name-asc" });
    const desc = filterAndSortPackages(all, { search: "", ecosystem: "all", sortKey: "name-desc" });
    expect(asc.map((p) => p.package_name)).toEqual(["react", "react-dom", "requests"]);
    expect(desc.map((p) => p.package_name)).toEqual(["requests", "react-dom", "react"]);
  });

  it("falls back to the name when the ecosystem matches", () => {
    const sorted = filterAndSortPackages(
      [pkg({ package_name: "zebra", ecosystem: "npm" }), pkg({ package_name: "alpha", ecosystem: "npm" })],
      { search: "", ecosystem: "all", sortKey: "ecosystem" },
    );
    expect(sorted.map((p) => p.package_name)).toEqual(["alpha", "zebra"]);
  });

  it("reads a version as a number, so 18.2.0 sorts above 2.31.0", () => {
    const sorted = filterAndSortPackages(all, { search: "", ecosystem: "all", sortKey: "version" });
    expect(sorted.map((p) => p.version)).toEqual(["2.31.0", "18.2.0", "18.2.0"]);
    expect(sorted.slice(1).map((p) => p.package_name)).toEqual(["react", "react-dom"]);
  });

  it("puts 10.0.0 above 9.0.0", () => {
    const sorted = filterAndSortPackages(
      [pkg({ package_name: "nine", version: "9.0.0" }), pkg({ package_name: "ten", version: "10.0.0" })],
      { search: "", ecosystem: "all", sortKey: "version" },
    );
    expect(sorted.map((p) => p.package_name)).toEqual(["nine", "ten"]);
  });

  it("does not reorder the caller's array", () => {
    const input = [requests, react, reactDom];
    filterAndSortPackages(input, { search: "", ecosystem: "all", sortKey: "name-asc" });
    expect(input.map((p) => p.package_name)).toEqual(["requests", "react", "react-dom"]);
  });
});

describe("pageCount", () => {
  it("never reports zero pages", () => {
    expect(pageCount(0)).toBe(1);
  });

  it("counts a full page as one page", () => {
    expect(pageCount(PAGE_SIZE)).toBe(1);
  });

  it("opens a second page on the first extra item", () => {
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
  });

  it("respects an explicit page size", () => {
    expect(pageCount(10, 5)).toBe(2);
    expect(pageCount(10, 10)).toBe(1);
  });
});

describe("pageRange", () => {
  it("reports 0 to 0 for an empty list", () => {
    expect(pageRange(0, 1)).toEqual({ start: 0, end: 0 });
  });

  it("labels the first page of a single-page scan", () => {
    expect(pageRange(41, 1)).toEqual({ start: 1, end: 41 });
  });

  it("closes the last page on the final item", () => {
    expect(pageRange(75, 2)).toEqual({ start: 51, end: 75 });
  });

  it("ends a full page on its own size", () => {
    expect(pageRange(100, 2)).toEqual({ start: 51, end: 100 });
  });

  it("respects an explicit page size", () => {
    expect(pageRange(100, 3, 10)).toEqual({ start: 21, end: 30 });
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 120 }, (_, i) => i + 1);

  it("returns the first page", () => {
    expect(paginate(items, 1)).toHaveLength(PAGE_SIZE);
    expect(paginate(items, 1)[0]).toBe(1);
  });

  it("returns a short final page", () => {
    expect(paginate(items, 3)).toEqual(items.slice(100));
  });

  it("returns nothing past the last page", () => {
    expect(paginate(items, 4)).toEqual([]);
  });
});

describe("buildPageNumbers", () => {
  it("lists every page while they fit", () => {
    expect(buildPageNumbers(1, 1)).toEqual([1]);
    expect(buildPageNumbers(7, 3)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses the tail on the first page", () => {
    expect(buildPageNumbers(8, 1)).toEqual([1, 2, "...", 8]);
  });

  it("keeps the neighbours and marks both gaps mid-list", () => {
    expect(buildPageNumbers(8, 4)).toEqual([1, "...", 3, 4, 5, "...", 8]);
  });

  it("collapses the head on the last page", () => {
    expect(buildPageNumbers(8, 8)).toEqual([1, "...", 7, 8]);
  });

  it("stays bounded on a long list", () => {
    expect(buildPageNumbers(20, 10)).toEqual([1, "...", 9, 10, 11, "...", 20]);
  });
});

describe("exportFilename", () => {
  it("names the file after the scan", () => {
    expect(exportFilename(29, "csv")).toBe("packages-29.csv");
  });

  it("falls back to latest when no scan has been committed yet", () => {
    expect(exportFilename(undefined, "json")).toBe("packages-latest.json");
  });
});
