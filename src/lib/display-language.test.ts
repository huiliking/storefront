import { describe, expect, it } from "vitest";
import type { LocaleSlug } from "@/config/locale";
import { matchDisplayLanguage, parseAcceptLanguage, resolveDisplayLanguage } from "@/lib/display-language";

const supported: LocaleSlug[] = ["en", "fr", "fr-ca", "ja", "nb"];

describe("parseAcceptLanguage", () => {
	it("orders by quality, keeps header order on ties, drops * and q=0", () => {
		expect(parseAcceptLanguage("fr-CA,fr;q=0.9,en;q=0.8,*;q=0.5,de;q=0")).toEqual(["fr-CA", "fr", "en"]);
		expect(parseAcceptLanguage("ja;q=0.5, en")).toEqual(["en", "ja"]);
	});

	it("handles empty input", () => {
		expect(parseAcceptLanguage(null)).toEqual([]);
		expect(parseAcceptLanguage("")).toEqual([]);
	});
});

describe("matchDisplayLanguage", () => {
	it("matches exact region, then base language, then aliases", () => {
		expect(matchDisplayLanguage("fr-CA", supported)).toBe("fr-ca");
		expect(matchDisplayLanguage("fr_FR", supported)).toBe("fr");
		expect(matchDisplayLanguage("en-US", supported)).toBe("en");
		expect(matchDisplayLanguage("no", supported)).toBe("nb");
		expect(matchDisplayLanguage("de", supported)).toBeNull();
	});
});

describe("resolveDisplayLanguage", () => {
	const base = { supported, fallback: "en" as LocaleSlug };

	it("prefers ?lang over the browser and market", () => {
		expect(resolveDisplayLanguage({ ...base, lang: "ja", acceptLanguage: "fr", marketLocale: "fr-ca" })).toBe(
			"ja",
		);
	});

	it("ignores an unsupported ?lang and uses the browser", () => {
		expect(resolveDisplayLanguage({ ...base, lang: "xx", acceptLanguage: "de,fr;q=0.8" })).toBe("fr");
	});

	it("falls back to the market locale, then its base language, then the default", () => {
		expect(resolveDisplayLanguage({ ...base, acceptLanguage: "de", marketLocale: "fr-ca" })).toBe("fr-ca");
		expect(resolveDisplayLanguage({ ...base, supported: ["en", "fr"], marketLocale: "fr-ca" })).toBe("fr");
		expect(resolveDisplayLanguage({ ...base, marketLocale: "pl" })).toBe("en");
	});
});
