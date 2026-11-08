import { describe, expect, it, vi } from "vitest";
import type { StorefrontChannel } from "@/lib/channels/storefront-channels";

// Market locale↔channel pairs come from Saleor (ADR 0008) — mock the channel list.
const channels: StorefrontChannel[] = [
	{
		id: "1",
		slug: "default-channel",
		name: "USD",
		currencyCode: "USD",
		defaultCountry: "US",
		locales: ["en"],
		defaultLocale: "en",
		isDefault: true,
	},
	{
		id: "2",
		slug: "japan",
		name: "JPY",
		currencyCode: "JPY",
		defaultCountry: "JP",
		locales: ["ja"],
		defaultLocale: "ja",
		isDefault: false,
	},
];
vi.mock("@/lib/channels/get-storefront-channels", () => ({
	getStorefrontChannels: async () => channels,
}));

import { buildBrowsePageMetadata, buildPageMetadata, resolveSeoDescription } from "./metadata";

type OgRecord = Record<string, unknown>;

describe("buildBrowsePageMetadata OpenGraph locale", () => {
	it("sets og:locale from the URL locale and lists only other Saleor market locales", async () => {
		const metadata = await buildBrowsePageMetadata({
			title: "プリムソール",
			locale: "ja",
			channel: "japan",
			pathSuffix: "/products/purimusoru",
		});

		const og = metadata.openGraph as OgRecord;
		expect(og.locale).toBe("ja_JP");
		// Locales not paired with any Saleor channel (pl, de, …) must not appear.
		expect(og.alternateLocale).toEqual(["en_US"]);
	});

	it("builds hreflang alternates from Saleor pairs", async () => {
		const metadata = await buildBrowsePageMetadata({
			title: "Hoodie",
			locale: "en",
			channel: "default-channel",
			pathSuffix: "/products/hoodie",
		});

		expect(metadata.alternates?.languages).toMatchObject({
			"en-US": "/en/default-channel/products/hoodie",
			"ja-JP": "/ja/japan/products/hoodie",
			"x-default": "/en/default-channel/products/hoodie",
		});
	});

	it("omits og:locale for unknown locale slugs", async () => {
		const metadata = await buildBrowsePageMetadata({
			title: "Page",
			locale: "zz",
			channel: "default-channel",
			pathSuffix: "/products/hoodie",
		});

		const og = metadata.openGraph as OgRecord;
		expect(og.locale).toBeUndefined();
	});

	it("omits openGraph.type for product pages (Next rejects the OG protocol `product` type)", () => {
		const metadata = buildPageMetadata({
			title: "Plimsolls",
			url: "/en/default-channel/products/plimsolls",
			ogType: "product",
		});

		const og = metadata.openGraph as OgRecord;
		expect(og.type).toBeUndefined();
	});

	it("keeps og:type website by default", () => {
		const metadata = buildPageMetadata({ title: "Page", url: "/en/default-channel" });
		expect((metadata.openGraph as OgRecord).type).toBe("website");
	});

	it("strips a smuggled openGraph.type so callers cannot trigger Next E237", () => {
		const metadata = buildPageMetadata({
			title: "Plimsolls",
			url: "/en/default-channel/products/plimsolls",
			ogType: "product",
			openGraph: { type: "product", "product:price:amount": "10" },
		});

		const og = metadata.openGraph as OgRecord;
		expect(og.type).toBeUndefined();
		expect(og["product:price:amount"]).toBe("10");
	});
});

describe("resolveSeoDescription", () => {
	it("prefers seoDescription, then Editor.js body text, then the name", () => {
		expect(
			resolveSeoDescription({
				seoDescription: " SEO copy ",
				body: JSON.stringify({ blocks: [{ type: "paragraph", data: { text: "Body" } }] }),
				fallbackName: "Name",
			}),
		).toBe("SEO copy");

		expect(
			resolveSeoDescription({
				seoDescription: null,
				body: JSON.stringify({ blocks: [{ type: "paragraph", data: { text: "Body copy" } }] }),
				fallbackName: "Name",
			}),
		).toBe("Body copy");

		expect(
			resolveSeoDescription({
				seoDescription: "  ",
				body: null,
				fallbackName: "プリムソール",
			}),
		).toBe("プリムソール");
	});
});
