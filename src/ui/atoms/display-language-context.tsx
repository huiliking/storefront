"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { withDisplayLanguage } from "@/lib/display-language-link";

/**
 * The explicit `?lang=` choice for the current page (null when the language was inferred from the
 * browser). Set by the storefront root layout from the middleware's header.
 *
 * Stays correct across client navigation because every internal link keeps `?lang=`, and the
 * language picker changes it with a full page load (layouts persist across soft navigation).
 */
const ExplicitDisplayLanguageContext = createContext<string | null>(null);

export function ExplicitDisplayLanguageProvider({
	value,
	children,
}: {
	value: string | null;
	children: ReactNode;
}) {
	return (
		<ExplicitDisplayLanguageContext.Provider value={value}>
			{children}
		</ExplicitDisplayLanguageContext.Provider>
	);
}

export function useExplicitDisplayLanguage(): string | null {
	return useContext(ExplicitDisplayLanguageContext);
}

/** `href` → same URL carrying the explicit `?lang=` choice, if any. */
export function useWithDisplayLanguage(): (href: string) => string {
	const lang = useExplicitDisplayLanguage();
	return useCallback((href: string) => withDisplayLanguage(href, lang), [lang]);
}
