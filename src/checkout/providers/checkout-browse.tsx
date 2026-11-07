"use client";

import { createContext, type ReactNode, use, useEffect } from "react";
import { getDefaultLocaleSlug, getLocaleDefinition, type LocaleSlug } from "@/config/locale";
import type { CheckoutLanguages } from "@/lib/checkout-languages";
import { ExplicitDisplayLanguageProvider } from "@/ui/atoms/display-language-context";

const CheckoutBrowseContext = createContext<CheckoutLanguages | null>(null);

type CheckoutBrowseProviderProps = {
	languages: CheckoutLanguages;
	children: ReactNode;
};

/**
 * Checkout / order languages from RSC (ADR 0008 — no cookie): market locale for links back to the
 * storefront, display language for `<html lang>`, explicit `?lang=` carried onto those links.
 */
export function CheckoutBrowseProvider({ languages, children }: CheckoutBrowseProviderProps) {
	useEffect(() => {
		// The checkout root layout is static (default `lang`); sync to the display language.
		const htmlLang = getLocaleDefinition(languages.displayLanguage)?.htmlLang;
		if (htmlLang) {
			document.documentElement.lang = htmlLang;
		}
	}, [languages.displayLanguage]);

	return (
		<CheckoutBrowseContext value={languages}>
			<ExplicitDisplayLanguageProvider value={languages.explicitDisplayLanguage}>
				{children}
			</ExplicitDisplayLanguageProvider>
		</CheckoutBrowseContext>
	);
}

/** Market locale for links back to the storefront (`/{locale}/{channel}`). */
export function useCheckoutBrowseLocale(): LocaleSlug {
	return use(CheckoutBrowseContext)?.marketLocale ?? getDefaultLocaleSlug();
}

/** Saleor's default storefront channel — for links when the checkout has no channel. */
export function useCheckoutDefaultChannel(): string | null {
	return use(CheckoutBrowseContext)?.defaultChannel ?? null;
}
