import {
	getDefaultLocaleSlug,
	getStorefrontLocaleSlugs,
	isLocaleSlug,
	type LocaleSlug,
} from "@/config/locale";

/**
 * Display language — the language store pages are rendered in (UI strings + Saleor translations).
 *
 * Separate from the market locale in the URL (`/{locale}/{channel}`), which follows the channel and
 * drives currency, availability and order/account document language. Resolution order:
 *   1. `?lang=` — explicit choice from the language picker
 *   2. browser `Accept-Language`, best match in the storefront's display languages
 *   3. the market locale from the URL (or its base language)
 *   4. the storefront default
 * No cookie: an explicit choice lives only in the URL.
 */

/** Query parameter set by the language picker. */
export const DISPLAY_LANGUAGE_PARAM = "lang";

/** Request header the middleware sets with the resolved display language for layouts and pages. */
export const DISPLAY_LANGUAGE_HEADER = "x-display-language";

/** Request header with the explicit `?lang=` choice (validated), absent when the language was inferred. */
export const DISPLAY_LANGUAGE_EXPLICIT_HEADER = "x-display-language-explicit";

/** Browser tags whose primary subtag differs from our slug. */
const LANGUAGE_ALIASES: Record<string, string> = { no: "nb" };

type Supported = readonly LocaleSlug[];

/** Exact slug (`fr-ca`), then base language (`fr`), honouring aliases (`no` → `nb`). */
export function matchDisplayLanguage(
	tag: string | null | undefined,
	supported: Supported,
): LocaleSlug | null {
	const normalized = tag?.trim().toLowerCase().replace(/_/g, "-");
	if (!normalized) return null;

	const exact = supported.find((slug) => slug === normalized);
	if (exact) return exact;

	const base = normalized.split("-")[0];
	const aliased = LANGUAGE_ALIASES[base] ?? base;
	return supported.find((slug) => slug === aliased) ?? null;
}

/** `Accept-Language` → tags ordered by quality (`q`), highest first; `*` and `q=0` dropped. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
	if (!header) return [];

	return header
		.split(",")
		.map((part, index) => {
			const [tag, ...params] = part.trim().split(";");
			const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
			const quality = q ? Number.parseFloat(q.slice(2)) : 1;
			return { tag: tag.trim(), quality: Number.isFinite(quality) ? quality : 0, index };
		})
		.filter((entry) => entry.tag && entry.tag !== "*" && entry.quality > 0)
		.sort((a, b) => b.quality - a.quality || a.index - b.index)
		.map((entry) => entry.tag);
}

export function resolveDisplayLanguage({
	lang,
	acceptLanguage,
	marketLocale,
	supported = getStorefrontLocaleSlugs(),
	fallback = getDefaultLocaleSlug(),
}: {
	lang?: string | null;
	acceptLanguage?: string | null;
	marketLocale?: string | null;
	supported?: Supported;
	fallback?: LocaleSlug;
}): LocaleSlug {
	const explicit = matchDisplayLanguage(lang, supported);
	if (explicit) return explicit;

	for (const tag of parseAcceptLanguage(acceptLanguage)) {
		const match = matchDisplayLanguage(tag, supported);
		if (match) return match;
	}

	return matchDisplayLanguage(marketLocale, supported) ?? fallback;
}

/** Read the middleware's header; anything missing or unexpected falls back to the default. */
export function displayLanguageFromHeader(value: string | null | undefined): LocaleSlug {
	return value && isLocaleSlug(value) ? value : getDefaultLocaleSlug();
}
