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

describe("spreadsheet formula injection", () => {
  // A package name is attacker-controlled data, so the export must not hand a
  // spreadsheet something it will execute.
  it("marks a cell a spreadsheet would run as a formula", () => {
    expect(escapeCSV("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1");
    expect(escapeCSV("+1+1")).toBe("'+1+1");
    expect(escapeCSV("-2+3")).toBe("'-2+3");
    expect(escapeCSV("@SUM(1+1)")).toBe("'@SUM(1+1)");
  });

  it("marks a cell that would shift the row", () => {
    expect(escapeCSV("\tleading tab")).toBe("'\tleading tab");
    expect(escapeCSV("\rleading return")).toBe("'\rleading return");
  });

  it("leaves a scoped package name alone", () => {
    expect(escapeCSV("@types/node")).toBe("@types/node");
    expect(escapeCSV("@babel/core")).toBe("@babel/core");
  });

  it("guards a cell that also needs the delimiter quoting", () => {
    expect(escapeCSV("=A,B")).toBe("\"'=A,B\"");
  });

  it("guards a package name written into a built row", () => {
    expect(buildCSV(["package_name"], [["=1+1"]])).toBe("package_name\n'=1+1");
  });
});
