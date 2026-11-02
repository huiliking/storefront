import { describe, expect, it } from "vitest";
import { withDisplayLanguage } from "@/lib/display-language-link";

describe("withDisplayLanguage", () => {
	it("adds ?lang to internal paths, keeping query and hash", () => {
		expect(withDisplayLanguage("/fr/channel-fr/products", "en")).toBe("/fr/channel-fr/products?lang=en");
		expect(withDisplayLanguage("/fr/channel-fr/products?sort=price#top", "ja")).toBe(
			"/fr/channel-fr/products?sort=price&lang=ja#top",
		);
	});

	it("replaces an existing lang", () => {
		expect(withDisplayLanguage("/en/default-channel?lang=fr", "de")).toBe("/en/default-channel?lang=de");
	});

	it("leaves URLs alone without an explicit choice or when not an internal page", () => {
		expect(withDisplayLanguage("/en/default-channel", null)).toBe("/en/default-channel");
		expect(withDisplayLanguage("https://example.com/x", "en")).toBe("https://example.com/x");
		expect(withDisplayLanguage("//cdn.example.com/x", "en")).toBe("//cdn.example.com/x");
		expect(withDisplayLanguage("/api/listing?surface=all", "en")).toBe("/api/listing?surface=all");
		expect(withDisplayLanguage("#reviews", "en")).toBe("#reviews");
	});
});
