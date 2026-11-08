import { isLocaleSlug, type LocaleSlug } from "@/config/locale";

/**
 * Storefront market configuration, owned by Saleor (Dashboard → Channels → Metadata).
 *
 * A channel appears on the storefront only when it is active AND lists at least one market
 * locale. That opt-in keeps B2B, POS and internal channels off the storefront.
 */
export const CHANNEL_METADATA_KEYS = {
	/** Comma-separated market locale slugs paired with the channel, e.g. `fr-ca,en-ca`. */
	locales: "storefront.locales",
	/** Locale used when entering the channel; also the order `languageCode`. Defaults to the first locale. */
	defaultLocale: "storefront.defaultLocale",
	/** `true` on the channel that `/` redirects to. */
	isDefault: "storefront.default",
} as const;

export type StorefrontChannel = {
	id: string;
	slug: string;
	name: string;
	currencyCode: string;
	defaultCountry: string | null;
	/** Market locales paired with this channel, in Dashboard order. Never empty. */
	locales: LocaleSlug[];
	defaultLocale: LocaleSlug;
	isDefault: boolean;
};

export type ChannelConfigIssue = {
	channel: string;
	message: string;
};

type ChannelInput = {
	id: string;
	slug: string;
	name: string;
	isActive?: boolean | null;
	currencyCode: string;
	defaultCountry?: { code: string } | null;
	metadata?: ReadonlyArray<{ key: string; value: string }> | null;
	/** Saleor channel fields (ADR 0008, Phase 2). Preferred over metadata when set. */
	storefrontLocales?: ReadonlyArray<string> | null;
	defaultLocale?: string | null;
	isStorefrontVisible?: boolean | null;
};

/** Phase 2 fields are "set" once any of them carries a value; otherwise metadata (Phase 1) applies. */
function hasStorefrontFields(channel: ChannelInput): boolean {
	return (
		(channel.storefrontLocales?.length ?? 0) > 0 || !!channel.isStorefrontVisible || !!channel.defaultLocale
	);
}

const KNOWN_KEYS: readonly string[] = Object.values(CHANNEL_METADATA_KEYS);
const KEY_PREFIX = "storefront.";

/** Keys are typed by hand in the Dashboard — tolerate stray spaces around them. */
function readMetadata(channel: ChannelInput, key: string): string | undefined {
	return channel.metadata?.find((item) => item.key.trim() === key)?.value?.trim();
}

/** `storefront.*` keys that are not ours — usually typos (`storefront.locale`, wrong case). */
function findUnknownStorefrontKeys(channel: ChannelInput): string[] {
	return (channel.metadata ?? [])
		.map((item) => item.key.trim())
		.filter((key) => key.startsWith(KEY_PREFIX) && !KNOWN_KEYS.includes(key));
}

function parseLocaleList(raw: string | undefined): { locales: LocaleSlug[]; unknown: string[] } {
	const locales: LocaleSlug[] = [];
	const unknown: string[] = [];

	for (const part of (raw ?? "").split(",")) {
		const slug = part.trim().toLowerCase();
		if (!slug) continue;
		if (!isLocaleSlug(slug)) {
			unknown.push(slug);
			continue;
		}
		if (!locales.includes(slug)) locales.push(slug);
	}

	return { locales, unknown };
}

/**
 * Pure: Saleor channel list → storefront channels, plus config issues worth surfacing
 * (unknown locale slugs, invalid default locale, several default channels).
 */
export function parseStorefrontChannels(channels: ReadonlyArray<ChannelInput> | null | undefined): {
	channels: StorefrontChannel[];
	issues: ChannelConfigIssue[];
} {
	const result: StorefrontChannel[] = [];
	const issues: ChannelConfigIssue[] = [];

	for (const channel of channels ?? []) {
		if (channel.isActive === false) continue;

		for (const key of findUnknownStorefrontKeys(channel)) {
			issues.push({
				channel: channel.slug,
				message: `unknown metadata key "${key}" (expected one of ${KNOWN_KEYS.join(", ")})`,
			});
		}

		// Phase 2: Saleor channel fields win; metadata is the fallback for one release (ADR 0008).
		const fromFields = hasStorefrontFields(channel);
		if (fromFields && !channel.isStorefrontVisible) continue;
		const localesLabel = fromFields ? "storefrontLocales" : CHANNEL_METADATA_KEYS.locales;
		const defaultLabel = fromFields ? "defaultLocale" : CHANNEL_METADATA_KEYS.defaultLocale;

		const { locales, unknown } = parseLocaleList(
			fromFields
				? (channel.storefrontLocales ?? []).join(",")
				: readMetadata(channel, CHANNEL_METADATA_KEYS.locales),
		);
		for (const slug of unknown) {
			issues.push({
				channel: channel.slug,
				message: `unknown locale "${slug}" in ${localesLabel}`,
			});
		}
		if (locales.length === 0) continue;

		const requestedDefault = (
			fromFields
				? (channel.defaultLocale ?? undefined)
				: readMetadata(channel, CHANNEL_METADATA_KEYS.defaultLocale)
		)?.toLowerCase();
		let defaultLocale = locales[0];
		if (requestedDefault) {
			const match = locales.find((slug) => slug === requestedDefault);
			if (match) defaultLocale = match;
			else
				issues.push({
					channel: channel.slug,
					message: `${defaultLabel} "${requestedDefault}" is not in ${localesLabel}; using "${defaultLocale}"`,
				});
		}

		result.push({
			id: channel.id,
			slug: channel.slug,
			name: channel.name,
			currencyCode: channel.currencyCode,
			defaultCountry: channel.defaultCountry?.code ?? null,
			locales,
			defaultLocale,
			isDefault: readMetadata(channel, CHANNEL_METADATA_KEYS.isDefault)?.toLowerCase() === "true",
		});
	}

	const defaults = result.filter((channel) => channel.isDefault);
	if (defaults.length > 1) {
		issues.push({
			channel: defaults.map((channel) => channel.slug).join(", "),
			message: `${CHANNEL_METADATA_KEYS.isDefault} is set on several channels; using "${defaults[0].slug}"`,
		});
	}

	return { channels: result, issues };
}

/** The channel `/` redirects to: the one marked default, else the first storefront channel. */
export function getDefaultStorefrontChannel(
	channels: readonly StorefrontChannel[],
): StorefrontChannel | null {
	return channels.find((channel) => channel.isDefault) ?? channels[0] ?? null;
}

export function findStorefrontChannel(
	channels: readonly StorefrontChannel[],
	slug: string,
): StorefrontChannel | null {
	return channels.find((channel) => channel.slug === slug) ?? null;
}

/** A `/{locale}/{channel}` URL is valid only when the channel is on the storefront and lists the locale. */
export function isMarketPair(
	channels: readonly StorefrontChannel[],
	locale: string,
	channel: string,
): boolean {
	return findStorefrontChannel(channels, channel)?.locales.some((slug) => slug === locale) ?? false;
}
