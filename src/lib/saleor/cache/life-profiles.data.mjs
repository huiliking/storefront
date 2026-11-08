/** @typedef {{ stale: number; revalidate: number; expire: number }} CacheLifeTier */

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Custom cacheLife profiles for Paper — single source for next.config.js and TypeScript.
 * @type {Record<"catalog" | "menus" | "channels" | "listingTtl", CacheLifeTier>}
 */
export const paperCacheLifeProfiles = {
	// Webhook invalidation (PRODUCT_*, CATEGORY_*, COLLECTION_*) is the primary freshness
	// mechanism for catalog data, so `revalidate` is only the backstop for a webhook that
	// was never configured or was dropped. Regeneration is request-triggered: a cold
	// entry costs nothing. A hot entry with a 1-minute backstop can approach ~1440
	// regenerations/day; an hour keeps the safety net without paying for it on every
	// request.
	catalog: {
		stale: 5 * MINUTE,
		revalidate: 1 * HOUR,
		expire: 1 * DAY,
	},
	menus: {
		stale: 5 * MINUTE,
		revalidate: 1 * HOUR,
		expire: 1 * DAY,
	},
	// Channels and locale↔channel pairs are managed in Saleor (channel metadata) and drive
	// routing. CHANNEL_* webhooks are the primary freshness mechanism; the 15-minute backstop
	// bounds how long a dropped webhook can leave a Dashboard change unseen. `expire` stays
	// long so the last known list keeps serving if Saleor is unreachable.
	channels: {
		stale: 5 * MINUTE,
		revalidate: 15 * MINUTE,
		expire: 1 * WEEK,
	},
	// External search indexes are not busted by Saleor webhooks. A short TTL is the
	// whole freshness story until an indexer calls /api/revalidate itself.
	listingTtl: {
		stale: 1 * MINUTE,
		revalidate: 2 * MINUTE,
		expire: 10 * MINUTE,
	},
};
