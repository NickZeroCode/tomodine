import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import i18n from "@/i18n";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

describe("OrderStatusBadge", () => {
  it("renders the translated status label", async () => {
    await i18n.changeLanguage("en");
    render(<OrderStatusBadge status="PREPARING" />);
    expect(screen.getByText("Preparing")).toBeInTheDocument();
  });

  it("renders Bangla label when language is bn", async () => {
    await i18n.changeLanguage("bn");
    render(<OrderStatusBadge status="PREPARING" />);
    expect(screen.getByText("প্রস্তুত হচ্ছে")).toBeInTheDocument();
    await i18n.changeLanguage("en");
  });
});

describe("LanguageSwitcher", () => {
  it("switches the active language", async () => {
    await i18n.changeLanguage("en");
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "বাংলা" }));
    expect(i18n.language).toBe("bn");
    expect(document.documentElement.lang).toBe("bn");
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(i18n.language).toBe("en");
  });
});
