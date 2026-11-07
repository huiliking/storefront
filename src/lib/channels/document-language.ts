import "server-only";

import { getDefaultLocaleSlug, getGraphqlLanguageCode, type LocaleSlug } from "@/config/locale";
import type { LanguageCodeEnum } from "@/gql/graphql";
import { getStorefrontChannels } from "@/lib/channels/get-storefront-channels";
import { findStorefrontChannel } from "@/lib/channels/storefront-channels";

/**
 * Document language for a channel — the language Saleor stores on checkouts/orders and customer
 * accounts, used for order emails, invoices and account emails (ADR 0008).
 *
 * Always the channel's default market locale (`storefront.defaultLocale`), never the shopper's
 * display language, so legal requirements (e.g. Québec → French documents) are enforced per market.
 * Falls back to the storefront default when the channel is unknown.
 */
export async function getDocumentLocale(channelSlug: string | null | undefined): Promise<LocaleSlug> {
	if (channelSlug) {
		const channel = findStorefrontChannel(await getStorefrontChannels(), channelSlug);
		if (channel) return channel.defaultLocale;
	}
	return getDefaultLocaleSlug();
}

export async function getDocumentLanguageCode(
	channelSlug: string | null | undefined,
): Promise<LanguageCodeEnum> {
	return getGraphqlLanguageCode(await getDocumentLocale(channelSlug)) as LanguageCodeEnum;
}
