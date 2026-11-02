import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { isLocaleSlug, type LocaleSlug } from "@/config/locale";
import {
	DISPLAY_LANGUAGE_EXPLICIT_HEADER,
	DISPLAY_LANGUAGE_HEADER,
	displayLanguageFromHeader,
} from "@/lib/display-language";
import { withDisplayLanguage } from "@/lib/display-language-link";

/**
 * Display language for this request, resolved by the middleware (`?lang=` → browser → market locale).
 *
 * Use it for UI strings and Saleor `languageCode`; use the URL `[locale]` (market locale) for links,
 * translated slugs, hreflang and order/account document language. Pass it into `"use cache"` loaders
 * as an argument — they cannot read request headers themselves.
 */
export const getDisplayLanguage = cache(async (): Promise<LocaleSlug> => {
	return displayLanguageFromHeader((await headers()).get(DISPLAY_LANGUAGE_HEADER));
});

/** The explicit `?lang=` choice for this request, or null when the language was inferred. */
export const getExplicitDisplayLanguage = cache(async (): Promise<LocaleSlug | null> => {
	const value = (await headers()).get(DISPLAY_LANGUAGE_EXPLICIT_HEADER);
	return value && isLocaleSlug(value) ? value : null;
});

/** Server-side link / redirect target that keeps the explicit `?lang=` choice. */
export async function storefrontHrefWithLanguage(href: string): Promise<string> {
	return withDisplayLanguage(href, await getExplicitDisplayLanguage());
}
