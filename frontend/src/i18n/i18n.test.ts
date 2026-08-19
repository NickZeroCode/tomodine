import { describe, expect, it } from "vitest";
import i18n from "@/i18n";

describe("i18n", () => {
  it("resolves English strings", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("orders.new")).toBe("New");
    expect(i18n.t("cart.placeOrder")).toBe("Place order");
  });

  it("resolves Bangla strings", async () => {
    await i18n.changeLanguage("bn");
    expect(i18n.t("orders.new")).toBe("নতুন");
    expect(i18n.t("cart.placeOrder")).toBe("অর্ডার করুন");
  });

  it("has matching key coverage in both locales", () => {
    const en = i18n.getResourceBundle("en", "translation");
    const bn = i18n.getResourceBundle("bn", "translation");

    function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
      return Object.entries(obj).flatMap(([key, value]) =>
        typeof value === "object" && value !== null
          ? flatten(value as Record<string, unknown>, `${prefix}${key}.`)
          : [`${prefix}${key}`]
      );
    }

    const enKeys = flatten(en).sort();
    const bnKeys = flatten(bn).sort();
    expect(bnKeys).toEqual(enKeys);
  });
});
