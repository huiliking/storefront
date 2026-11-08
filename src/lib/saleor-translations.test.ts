import { describe, expect, it } from "vitest";
import { pickTranslatedName, pickTranslatedSlug, withTranslatedProductFields } from "./saleor-translations";

describe("pickTranslatedName", () => {
	it("prefers translation over default name", () => {
		expect(
			pickTranslatedName({
				name: "Hoodie",
				translation: { name: "Bluza" },
			}),
		).toBe("Bluza");
	});

	it("falls back to default name", () => {
		expect(
			pickTranslatedName({
				name: "Hoodie",
				translation: null,
			}),
		).toBe("Hoodie");
	});
});

describe("pickTranslatedSlug", () => {
	it("prefers the market-locale translated slug for URLs", () => {
		expect(
			pickTranslatedSlug({
				slug: "hoodie",
				marketTranslation: { slug: "bluza" },
			}),
		).toBe("bluza");
	});

	it("falls back to primary slug when translation slug is empty", () => {
		expect(
			pickTranslatedSlug({
				slug: "hoodie",
				marketTranslation: { slug: "" },
			}),
		).toBe("hoodie");
	});
});

describe("withTranslatedProductFields", () => {
	it("merges product and category translations without overwriting primary slug", () => {
		const product = withTranslatedProductFields({
			name: "Hoodie",
			slug: "hoodie",
			translation: { name: "Bluza" },
			marketTranslation: { slug: "bluza" },
			category: {
				name: "Apparel",
				slug: "apparel",
				translation: { name: "Odzież" },
				marketTranslation: { slug: "odziez" },
			},
			variants: [{ name: "M", translation: { name: "Średni" } }],
		});

		expect(product.name).toBe("Bluza");
		expect(product.slug).toBe("hoodie");
		expect(pickTranslatedSlug(product)).toBe("bluza");
		expect(product.category?.name).toBe("Odzież");
		expect(product.variants?.[0]?.name).toBe("Średni");
	});
});
