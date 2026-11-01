import "../../globals.css";
import { type ReactNode } from "react";
import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { rootMetadata } from "@/lib/seo";
import { getStorefrontChannels } from "@/lib/channels/get-storefront-channels";
import {
	getDefaultLocaleSlug,
	getDefaultTimeZone,
	isStorefrontLocaleSlug,
	resolveLocaleFromSlug,
} from "@/config/locale";
import { PersistBrowseLocaleCookie } from "@/ui/components/persist-browse-locale-cookie";
import { getRootHtmlFontProps } from "@/lib/fonts";
import { saleorMediaPreconnectOrigin } from "@/lib/images";
import { speedInsightsSampleRate } from "@/lib/speed-insights";
import { webAnalyticsEnabled } from "@/lib/analytics/web-analytics";
import { AnalyticsMount } from "@/ui/components/analytics-mount";
import { WebAnalytics } from "@/ui/components/web-analytics";

/**
 * Root defaults + `og:locale` derived from the URL locale segment. Params-only, so it
 * stays static under PPR. Browse pages that build their own OpenGraph block
 * (`buildBrowsePageMetadata`) replace this wholesale; everything else (login, account,
 * cart, …) inherits a locale-correct default instead of a hardcoded `en_US`.
 */
export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const definition = resolveLocaleFromSlug(isStorefrontLocaleSlug(locale) ? locale : getDefaultLocaleSlug());

	if (!rootMetadata.openGraph) return rootMetadata;
	return {
		...rootMetadata,
		openGraph: { ...rootMetadata.openGraph, locale: definition.ogLocale },
	};
}

/**
 * Prerender every market locale paired with a Saleor channel at build time. Pairs added later in
 * the Dashboard are not missing — they render on first visit and are then cached.
 */
export async function generateStaticParams() {
	const locales = [...new Set((await getStorefrontChannels()).flatMap((channel) => channel.locales))];
	if (locales.length === 0) {
		// Cache Components require at least one param; fail with the real cause instead.
		throw new Error(
			"[Channels] No storefront channels in Saleor. Add `storefront.locales` metadata to at least one active channel.",
		);
	}
	return locales.map((locale) => ({ locale }));
}

/**
 * Storefront root layout — renders `<html lang>` server-side from the URL locale segment.
 *
 * Invalid locale slugs fall back to the default `htmlLang` here so the not-found boundary
 * still has an HTML shell; the actual `notFound()` for invalid pairs lives in `[channel]/layout`.
 */
export default async function LocaleRootLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	const localeSlug = isStorefrontLocaleSlug(locale) ? locale : getDefaultLocaleSlug();
	const htmlLang = resolveLocaleFromSlug(localeSlug).htmlLang;

	// Code-owned UI strings (next-intl). Locale comes from the URL segment (ADR 0001/0002),
	// not next-intl routing. `setRequestLocale` seeds the request config from our param so
	// message resolution stays static (no `headers()`) — preserves PPR / Cache Components.
	setRequestLocale(localeSlug);
	const messages = await getMessages();
	const htmlProps = getRootHtmlFontProps(htmlLang);
	const mediaOrigin = saleorMediaPreconnectOrigin();

	return (
		<html {...htmlProps}>
			{/* No crossOrigin: plain <img> fetches are not CORS, and a `crossorigin`
			    preconnect would warm a connection the image load cannot reuse. */}
			{mediaOrigin && <link rel="preconnect" href={mediaOrigin} />}
			<body className="min-h-dvh font-sans">
				<NextIntlClientProvider locale={localeSlug} messages={messages} timeZone={getDefaultTimeZone()}>
					<PersistBrowseLocaleCookie locale={localeSlug} />
					{children}
					{/* Sampled — unsampled Speed Insights dominates the Vercel bill at scale. */}
					<SpeedInsights sampleRate={speedInsightsSampleRate()} />
					{/* Unsampled page views — the denominator; URLs are redacted in beforeSend. */}
					{webAnalyticsEnabled() && <WebAnalytics />}
				</NextIntlClientProvider>
				<AnalyticsMount />
			</body>
		</html>
	);
}
