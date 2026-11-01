import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import type { LocaleSlug } from "@/config/locale";
import { DISPLAY_LANGUAGE_HEADER, displayLanguageFromHeader } from "@/lib/display-language";

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
