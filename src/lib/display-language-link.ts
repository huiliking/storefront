import { DISPLAY_LANGUAGE_PARAM } from "@/lib/display-language";

/**
 * Carry an explicit display-language choice (`?lang=`) onto an internal storefront URL.
 *
 * The language picker's choice lives only in the URL (no cookie — ADR 0008), so every internal
 * link, navigation and redirect must keep it. No-op when there is no explicit choice, for
 * external / protocol-relative URLs, API routes and in-page anchors. Replaces an existing `lang`.
 */
export function withDisplayLanguage(href: string, lang: string | null | undefined): string {
	if (!lang || !href.startsWith("/") || href.startsWith("//") || href.startsWith("/api/")) {
		return href;
	}

	const hashIndex = href.indexOf("#");
	const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
	const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
	const queryIndex = withoutHash.indexOf("?");
	const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
	const params = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "");

	params.set(DISPLAY_LANGUAGE_PARAM, lang);
	return `${path}?${params.toString()}${hash}`;
}

/**
 * Client-only variant for code outside React components (auth helpers, hard navigations): keeps the
 * current page's `?lang=`. No-op on the server. The middleware validates the value on arrival.
 */
export function withCurrentDisplayLanguage(href: string): string {
	if (typeof window === "undefined") return href;
	return withDisplayLanguage(href, new URLSearchParams(window.location.search).get(DISPLAY_LANGUAGE_PARAM));
}
