"use client";

import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { resolveLocaleFromSlug } from "@/config/locale";
import { buildStorefrontPath } from "@/lib/storefront-path";

export function useStorefrontParams() {
	return useParams<{ locale?: string; channel?: string }>();
}

/**
 * Display language as a BCP 47 tag for `Intl` formatting. next-intl's locale is the display
 * language (root layout), not the URL market locale — formatting is a readability concern.
 */
export function useIntlLocale(): string {
	return resolveLocaleFromSlug(useLocale()).bcp47;
}

/** Build a channel-scoped browse path from current locale + channel route params. */
export function useStorefrontHref(suffix: string): string {
	const { locale, channel } = useStorefrontParams();
	if (!locale || !channel) {
		return suffix;
	}
	return buildStorefrontPath(locale, channel, suffix);
}
