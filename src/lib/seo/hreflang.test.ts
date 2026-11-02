import { describe, expect, it } from "vitest";
import type { LocaleSlug } from "@/config/locale";
import type { StorefrontChannel } from "@/lib/channels/storefront-channels";
import { buildLocaleHreflangAlternates, getMarketOgAlternateLocales } from "./hreflang";

function channel(
	slug: string,
	locales: LocaleSlug[],
	options: { isDefault?: boolean; defaultLocale?: LocaleSlug } = {},
): StorefrontChannel {
	return {
		id: slug,
		slug,
		name: slug,
		currencyCode: "USD",
		defaultCountry: null,
		locales,
		defaultLocale: options.defaultLocale ?? locales[0],
		isDefault: options.isDefault ?? false,
	};
}

const channels = [
	channel("default-channel", ["en", "ja"], { isDefault: true }),
	channel("channel-fr", ["fr", "fr-ca", "en"], { defaultLocale: "fr" }),
];

describe("buildLocaleHreflangAlternates", () => {
	it("emits one region-aware alternate per Saleor market locale plus x-default", () => {
		expect(buildLocaleHreflangAlternates(channels, "default-channel", "/products/hoodie")).toEqual({
			"en-US": "/en/default-channel/products/hoodie",
			"ja-JP": "/ja/default-channel/products/hoodie",
			"fr-FR": "/fr/channel-fr/products/hoodie",
			"fr-CA": "/fr-ca/channel-fr/products/hoodie",
			"x-default": "/en/default-channel/products/hoodie",
		});
	});

	it("prefers the current channel when several channels list the same locale", () => {
		const result = buildLocaleHreflangAlternates(channels, "channel-fr", "/products");
		expect(result["en-US"]).toBe("/en/channel-fr/products");
		expect(result["x-default"]).toBe("/en/default-channel/products");
	});

	it("uses per-locale path suffixes for translated catalog slugs", () => {
		const result = buildLocaleHreflangAlternates(channels, "channel-fr", {
			en: "/products/hoodie",
			fr: "/products/sweat",
		});
		expect(result["fr-FR"]).toBe("/fr/channel-fr/products/sweat");
		expect(result["fr-CA"]).toBe("/fr-ca/channel-fr/products/hoodie");
		expect(result["x-default"]).toBe("/en/default-channel/products/hoodie");
	});

	it("returns no alternates without storefront channels", () => {
		expect(buildLocaleHreflangAlternates([], "x", "/")).toEqual({});
	});
});

describe("getMarketOgAlternateLocales", () => {
	it("lists the other market locales once", () => {
		expect(getMarketOgAlternateLocales(channels, "fr").sort()).toEqual(["en_US", "fr_CA", "ja_JP"]);
	});
});
