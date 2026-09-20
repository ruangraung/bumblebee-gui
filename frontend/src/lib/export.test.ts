import { describe, expect, it } from "vitest";
import { buildCSV, escapeCSV } from "@/lib/export";

describe("escapeCSV", () => {
  it("leaves a value with nothing to escape alone", () => {
    expect(escapeCSV("npm")).toBe("npm");
    expect(escapeCSV("path/to/file.ts")).toBe("path/to/file.ts");
  });

  it("quotes a value containing the delimiter", () => {
    expect(escapeCSV("left,right")).toBe('"left,right"');
  });

  it("doubles a quote inside a quoted value", () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    expect(escapeCSV("two\nlines")).toBe('"two\nlines"');
  });

  it("keeps an empty value empty", () => {
    expect(escapeCSV("")).toBe("");
  });
});

describe("buildCSV", () => {
  it("writes the header first, then one line per row", () => {
    expect(buildCSV(["a", "b"], [["1", "2"], ["3", "4"]])).toBe("a,b\n1,2\n3,4");
  });

  it("renders a missing cell as an empty field", () => {
    expect(buildCSV(["a", "b"], [["1", undefined]])).toBe("a,b\n1,");
  });

  it("escapes every cell, not just the first", () => {
    expect(buildCSV(["a", "b"], [["plain", "x,y"]])).toBe('a,b\nplain,"x,y"');
  });

  it("still writes the header when there are no rows", () => {
    expect(buildCSV(["a", "b"], [])).toBe("a,b");
  });
});
