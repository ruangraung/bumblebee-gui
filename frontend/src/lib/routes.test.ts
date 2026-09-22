import { describe, expect, it } from "vitest";
import { ROUTES, crumbFor, suggestRoute } from "@/lib/routes";

describe("crumbFor", () => {
  it("names the page in the header", () => {
    expect(crumbFor("/")).toBe("dashboard");
    expect(crumbFor("/settings")).toBe("settings");
  });

  it("names a detail route after its list route", () => {
    expect(crumbFor("/results/45")).toBe("results");
    expect(crumbFor("/findings/45")).toBe("findings");
  });

  it("says not found for an address that is not a page", () => {
    expect(crumbFor("/dashboard")).toBe("not found");
    expect(crumbFor("/nope/deeper")).toBe("not found");
  });
});

describe("suggestRoute", () => {
  it("names the page whose label was typed as a path", () => {
    expect(suggestRoute("/dashboard")).toEqual(ROUTES[0]);
    expect(suggestRoute("/dashboard/")).toEqual(ROUTES[0]);
    expect(suggestRoute("/Results")).toEqual(ROUTES[2]);
  });

  it("stays quiet for the root and for an address matching no label", () => {
    expect(suggestRoute("/")).toBeNull();
    expect(suggestRoute("/nope")).toBeNull();
  });
});
