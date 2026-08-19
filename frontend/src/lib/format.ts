const BDT_FORMATTER_EN = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const BDT_FORMATTER_BN = new Intl.NumberFormat("bn-BD", {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format an amount (string or number) as Bangladeshi Taka in the active language. */
export function formatBDT(amount: string | number, lang: "en" | "bn" = "en"): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(value)) return "৳0";
  const formatter = lang === "bn" ? BDT_FORMATTER_BN : BDT_FORMATTER_EN;
  // Narrow symbol may render as "Tk" in some environments — normalize to ৳.
  return formatter.format(value).replace(/Tk|BDT/gi, "৳").trim();
}

/** Pick the localized name with Bangla fallback. */
export function localized(
  obj: { name_en: string; name_bn: string },
  lang: "en" | "bn"
): string {
  if (lang === "bn") return obj.name_bn || obj.name_en;
  return obj.name_en || obj.name_bn;
}

/** Same fallback rules for bilingual description fields. */
export function localizedDescription(
  obj: { description_en: string; description_bn: string },
  lang: "en" | "bn"
): string {
  if (lang === "bn") return obj.description_bn || obj.description_en;
  return obj.description_en || obj.description_bn;
}
