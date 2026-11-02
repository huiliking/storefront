import "server-only";

import { cache } from "react";
import { ChannelsListDocument, type ChannelsListQuery } from "@/gql/graphql";
import { CACHE_PROFILES, cachedQuery } from "@/lib/saleor";

/**
 * Saleor channel list (currency, default country, active flag, storefront metadata).
 * `getStorefrontChannels()` turns it into the storefront's channels and fails loudly when it
 * is missing (ADR 0008); `null` means no `SALEOR_APP_TOKEN`.
 */
export const getCachedChannelsList = cache(async (): Promise<ChannelsListQuery | null> => {
	// Outside `"use cache"`. A missing token must not be stored as the channel list
	// for the channels TTL (revalidate 1 day, expire 1 week).
	if (!process.env.SALEOR_APP_TOKEN) {
		return null;
	}

	return readChannelsList();
});

async function readChannelsList(): Promise<ChannelsListQuery> {
	"use cache";
	// A token without channel permissions returns `{ channels: null, errors }`. That is a
	// deployment setting, not an outage, so the fallback is cached instead of failing the build.
	return cachedQuery(ChannelsListDocument, { profile: CACHE_PROFILES.channels, allowPartialData: true });
}
