import "server-only";

import { isLocaleSlug, type LocaleSlug } from "@/config/locale";
import { getDisplayLanguage } from "@/lib/display-language-server";
import { graphqlLanguageCodeVariables } from "@/lib/graphql-locale";
import type { LanguageCodeEnum } from "@/gql/graphql";

/**
 * Display language for cart/checkout GraphQL content (translated line names, etc.) — ADR 0008.
 * Storefront callers pass it explicitly; on `/checkout` and in server actions it comes from the
 * middleware (`?lang=` → browser → `?locale=`). No cookie, no referer.
 *
 * Not the document language: what Saleor stores on the checkout/order is set at creation from the
 * channel's default locale (`getDocumentLanguageCode`).
 */
export async function resolveCheckoutLocaleSlug(displayLanguage?: string): Promise<LocaleSlug> {
	if (displayLanguage && isLocaleSlug(displayLanguage)) {
		return displayLanguage;
	}
	return getDisplayLanguage();
}

export async function checkoutGraphqlLanguageCode(displayLanguage?: string): Promise<LanguageCodeEnum> {
	return graphqlLanguageCodeVariables(await resolveCheckoutLocaleSlug(displayLanguage)).languageCode;
}

export async function checkoutGraphqlLocaleVariables(displayLanguage?: string) {
	return graphqlLanguageCodeVariables(await resolveCheckoutLocaleSlug(displayLanguage));
}
