import "server-only";

import { isLocaleSlug, type LocaleSlug } from "@/config/locale";
import { getDocumentLocale } from "@/lib/channels/document-language";
import { getStorefrontChannels } from "@/lib/channels/get-storefront-channels";
import { getDefaultStorefrontChannel } from "@/lib/channels/storefront-channels";
import { getDisplayLanguage, getExplicitDisplayLanguage } from "@/lib/display-language-server";

/**
 * Languages on the locale-less checkout / order surfaces (ADR 0008) — no cookie, no referer:
 *
 * - `displayLanguage` — UI messages, Saleor content, `<html lang>`. Resolved by the middleware:
 *   `?lang=` → browser → `?locale=` → default.
 * - `explicitDisplayLanguage` — the `?lang=` choice, carried onto links back to the storefront.
 * - `marketLocale` — URL locale for links back to the storefront (`/{locale}/{channel}`): `?locale=`
 *   (set by the storefront's checkout link), else the channel's default locale.
 * - `defaultChannel` — Saleor's default storefront channel, when the checkout has none.
 */
export type CheckoutLanguages = {
	displayLanguage: LocaleSlug;
	explicitDisplayLanguage: LocaleSlug | null;
	marketLocale: LocaleSlug;
	defaultChannel: string | null;
};

export async function resolveCheckoutLanguages(
	urlLocale: string | null | undefined,
	channelSlug?: string | null,
): Promise<CheckoutLanguages> {
	const [displayLanguage, explicitDisplayLanguage, channels] = await Promise.all([
		getDisplayLanguage(),
		getExplicitDisplayLanguage(),
		getStorefrontChannels(),
	]);
	const marketLocale =
		urlLocale && isLocaleSlug(urlLocale) ? urlLocale : await getDocumentLocale(channelSlug);

	return {
		displayLanguage,
		explicitDisplayLanguage,
		marketLocale,
		defaultChannel: getDefaultStorefrontChannel(channels)?.slug ?? null,
	};
}
