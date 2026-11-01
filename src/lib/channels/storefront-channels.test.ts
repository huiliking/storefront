import { describe, expect, it } from "vitest";
import {
	CHANNEL_METADATA_KEYS as KEYS,
	getDefaultStorefrontChannel,
	isMarketPair,
	parseStorefrontChannels,
} from "@/lib/channels/storefront-channels";

function channel(slug: string, metadata: Record<string, string>, isActive = true) {
	return {
		id: `id-${slug}`,
		slug,
		name: slug.toUpperCase(),
		isActive,
		currencyCode: "USD",
		defaultCountry: { code: "US" },
		metadata: Object.entries(metadata).map(([key, value]) => ({ key, value })),
	};
}

describe("parseStorefrontChannels", () => {
	it("keeps active channels that list market locales", () => {
		const { channels, issues } = parseStorefrontChannels([
			channel("channel-fr", { [KEYS.locales]: "fr, FR-CA ,fr", [KEYS.defaultLocale]: "fr-ca" }),
		]);

		expect(issues).toEqual([]);
		expect(channels).toEqual([
			{
				id: "id-channel-fr",
				slug: "channel-fr",
				name: "CHANNEL-FR",
				currencyCode: "USD",
				defaultCountry: "US",
				locales: ["fr", "fr-ca"],
				defaultLocale: "fr-ca",
				isDefault: false,
			},
		]);
	});

	it("hides inactive channels and channels without locales (opt-in)", () => {
		const { channels } = parseStorefrontChannels([
			channel("channel-pln", { [KEYS.locales]: "pl" }, false),
			channel("b2b", {}),
			channel("pos", { [KEYS.locales]: " , " }),
		]);
		expect(channels).toEqual([]);
	});

	it("drops unknown locale slugs and reports them", () => {
		const { channels, issues } = parseStorefrontChannels([channel("x", { [KEYS.locales]: "en,xx" })]);
		expect(channels[0]?.locales).toEqual(["en"]);
		expect(issues).toEqual([{ channel: "x", message: expect.stringContaining('unknown locale "xx"') }]);
	});

	it("falls back to the first locale when the default is not listed", () => {
		const { channels, issues } = parseStorefrontChannels([
			channel("x", { [KEYS.locales]: "en,ja", [KEYS.defaultLocale]: "de" }),
		]);
		expect(channels[0]?.defaultLocale).toBe("en");
		expect(issues).toHaveLength(1);
	});

	it("reports several default channels and uses the first", () => {
		const { channels, issues } = parseStorefrontChannels([
			channel("a", { [KEYS.locales]: "en", [KEYS.isDefault]: "true" }),
			channel("b", { [KEYS.locales]: "fr", [KEYS.isDefault]: "TRUE" }),
		]);
		expect(getDefaultStorefrontChannel(channels)?.slug).toBe("a");
		expect(issues).toHaveLength(1);
	});

	it("tolerates spaces around keys (hand-typed in the Dashboard)", () => {
		const { channels, issues } = parseStorefrontChannels([
			channel("channel-fr", { [` ${KEYS.locales}`]: "fr,fr-ca", [`${KEYS.defaultLocale} `]: "fr-ca" }),
		]);
		expect(channels[0]?.locales).toEqual(["fr", "fr-ca"]);
		expect(channels[0]?.defaultLocale).toBe("fr-ca");
		expect(issues).toEqual([]);
	});

	it("reports unknown storefront.* keys, ignores other keys", () => {
		const { issues } = parseStorefrontChannels([
			channel("x", {
				[KEYS.locales]: "en",
				"storefront.locale": "en",
				"storefront.defaultlocale": "en",
				"erp.id": "42",
			}),
		]);
		expect(issues.map((issue) => issue.message)).toEqual([
			expect.stringContaining('"storefront.locale"'),
			expect.stringContaining('"storefront.defaultlocale"'),
		]);
	});

	it("handles a missing list", () => {
		expect(parseStorefrontChannels(null)).toEqual({ channels: [], issues: [] });
	});
});

describe("getDefaultStorefrontChannel", () => {
	it("uses the first channel when none is marked default", () => {
		const { channels } = parseStorefrontChannels([
			channel("a", { [KEYS.locales]: "en" }),
			channel("b", { [KEYS.locales]: "fr" }),
		]);
		expect(getDefaultStorefrontChannel(channels)?.slug).toBe("a");
	});

	it("returns null without channels", () => {
		expect(getDefaultStorefrontChannel([])).toBeNull();
	});
});

describe("isMarketPair", () => {
	const { channels } = parseStorefrontChannels([channel("channel-fr", { [KEYS.locales]: "fr,fr-ca" })]);

	it("accepts listed pairs only", () => {
		expect(isMarketPair(channels, "fr-ca", "channel-fr")).toBe(true);
		expect(isMarketPair(channels, "en", "channel-fr")).toBe(false);
		expect(isMarketPair(channels, "fr", "unknown")).toBe(false);
	});
});
