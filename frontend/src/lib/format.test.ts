import { describe, expect, it } from "vitest";
import { formatBDT, localized, localizedDescription } from "@/lib/format";

describe("formatBDT", () => {
  it("formats numeric amounts with the taka symbol", () => {
    const out = formatBDT(1500, "en");
    expect(out).toContain("৳");
    expect(out).toContain("1,500");
  });

  it("parses string amounts", () => {
    expect(formatBDT("350.00", "en")).toContain("350");
  });

  it("renders Bangla digits when lang is bn", () => {
    const out = formatBDT(1500, "bn");
    expect(out).toContain("৳");
    // Bangla numerals for 1500 = ১,৫০০ (comma may be rendered differently)
    expect(out).toMatch(/[০-৯]/);
  });

  it("handles invalid input gracefully", () => {
    expect(formatBDT("not-a-number", "en")).toBe("৳0");
  });
});

describe("localized", () => {
  const dish = { name_en: "Kacchi Biryani", name_bn: "কাচ্চি বিরিয়ানি" };

  it("returns English for en", () => {
    expect(localized(dish, "en")).toBe("Kacchi Biryani");
  });

  it("returns Bangla for bn", () => {
    expect(localized(dish, "bn")).toBe("কাচ্চি বিরিয়ানি");
  });

  it("falls back to the other language when a translation is missing", () => {
    expect(localized({ name_en: "Only English", name_bn: "" }, "bn")).toBe("Only English");
    expect(localized({ name_en: "", name_bn: "শুধু বাংলা" }, "en")).toBe("শুধু বাংলা");
  });
});

describe("localizedDescription", () => {
  it("applies the same fallback rules", () => {
    const obj = { description_en: "Desc", description_bn: "" };
    expect(localizedDescription(obj, "bn")).toBe("Desc");
  });
});
