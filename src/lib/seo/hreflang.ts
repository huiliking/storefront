import { getLocaleDefinition } from "@/config/locale";
import { getDefaultStorefrontChannel, type StorefrontChannel } from "@/lib/channels/storefront-channels";
import { buildStorefrontPath } from "@/lib/storefront-path";

/** Same suffix for every locale, or a per-locale suffix map (translated catalog slugs). */
export type HreflangPathInput = string | Record<string, string>;

type LocaleChannelTarget = { locale: string; channel: string };

function resolvePathSuffix(pathInput: HreflangPathInput, locale: string, fallbackSuffix: string): string {
	if (typeof pathInput === "string") return pathInput;
	return pathInput[locale] ?? fallbackSuffix;
}

/**
 * One target per market locale paired in Saleor. When several channels list the same locale,
 * prefer the current channel, then the default channel, then the first one listed.
 */
function getHreflangTargets(
	channels: readonly StorefrontChannel[],
	currentChannel: string,
): LocaleChannelTarget[] {
	const defaultSlug = getDefaultStorefrontChannel(channels)?.slug;
	const rank = (slug: string) => (slug === currentChannel ? 0 : slug === defaultSlug ? 1 : 2);
	const ordered = [...channels].sort((a, b) => rank(a.slug) - rank(b.slug));

	const byLocale = new Map<string, LocaleChannelTarget>();
	for (const channel of ordered) {
		for (const locale of channel.locales) {
			if (!byLocale.has(locale)) byLocale.set(locale, { locale, channel: channel.slug });
		}
	}
	return [...byLocale.values()];
}

/**
 * hreflang alternates for browse URLs, from the locale↔channel pairs managed in Saleor (ADR 0008).
 *
 * Keys are region-aware BCP 47 (`fr-CA`): every alternate is a language + market URL. Alternates
 * advertise **market locales** only — display languages (`?lang=`) are not separate URLs.
 * Pass a single path suffix, or a per-locale map when catalog slugs are translated (ADR 0004).
 * `x-default` points at the default channel in its default locale.
 */
export function buildLocaleHreflangAlternates(
	channels: readonly StorefrontChannel[],
	currentChannel: string,
	pathSuffix: HreflangPathInput,
): Record<string, string> {
	const languages: Record<string, string> = {};
	const fallbackSuffix = typeof pathSuffix === "string" ? pathSuffix : (Object.values(pathSuffix)[0] ?? "");

	for (const { locale, channel } of getHreflangTargets(channels, currentChannel)) {
		const key = getLocaleDefinition(locale)?.bcp47;
		if (!key) continue;
		languages[key] = buildStorefrontPath(
			locale,
			channel,
			resolvePathSuffix(pathSuffix, locale, fallbackSuffix),
		);
	}

	const defaultChannel = getDefaultStorefrontChannel(channels);
	if (defaultChannel) {
		const { defaultLocale, slug } = defaultChannel;
		languages["x-default"] = buildStorefrontPath(
			defaultLocale,
			slug,
			resolvePathSuffix(pathSuffix, defaultLocale, fallbackSuffix),
		);
	}

	return languages;
}

/** Market locales advertised as `og:locale:alternate` — the same set as hreflang, minus the current one. */
export function getMarketOgAlternateLocales(
	channels: readonly StorefrontChannel[],
	currentLocale: string,
): string[] {
	const locales = new Set(channels.flatMap((channel) => channel.locales));
	locales.delete(currentLocale as never);
	return [...locales]
		.map((locale) => getLocaleDefinition(locale)?.ogLocale)
		.filter((value): value is string => Boolean(value));
}
