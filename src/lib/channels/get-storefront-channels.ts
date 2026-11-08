import "server-only";

import { cache } from "react";
import { getCachedChannelsList } from "@/lib/channels/get-channels-data";
import { parseStorefrontChannels, type StorefrontChannel } from "@/lib/channels/storefront-channels";

/**
 * Storefront channels from Saleor — the only source of channel / market-locale data.
 *
 * Requires `SALEOR_APP_TOKEN` (a zero-permission app is enough: listing channels needs
 * `AUTHENTICATED_APP`, no specific permission). There is deliberately no `.env` fallback:
 * a missing token or unreadable channel list fails loudly instead of serving a different list.
 *
 * Cached under the `channels` tag; Saleor `CHANNEL_*` webhooks clear it via `/api/revalidate`.
 */
export const getStorefrontChannels = cache(async (): Promise<StorefrontChannel[]> => {
	// `getCachedChannelsList` returns null without a token (token access stays in the data layer).
	const data = await getCachedChannelsList();
	if (!data?.channels) {
		throw new Error(
			"[Channels] No channel list from Saleor. Channels are managed in Saleor: set SALEOR_APP_TOKEN to a valid app token.",
		);
	}

	const { channels, issues } = parseStorefrontChannels(data.channels);
	for (const issue of issues) {
		console.warn(`[Channels] ${issue.channel}: ${issue.message}`);
	}

	return channels;
});
