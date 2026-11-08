import "../../globals.css";
import { type ReactNode } from "react";
import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { rootMetadata } from "@/lib/seo";
import { getDisplayLanguage, getExplicitDisplayLanguage } from "@/lib/display-language-server";
import { ExplicitDisplayLanguageProvider } from "@/ui/atoms/display-language-context";
import {
	getDefaultLocaleSlug,
	getDefaultTimeZone,
	isStorefrontLocaleSlug,
	resolveLocaleFromSlug,
} from "@/config/locale";
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
 * Storefront pages render per request — no build-time prerendering. Almost every page depends on
 * the display language (`?lang=` / browser), and channels live in Saleor, so a build-time page set
 * would be both incomplete and stale. Saleor data stays in the tagged data cache (`"use cache"`),
 * cleared by webhooks, so per-request rendering does not mean per-request Saleor calls.
 * No `generateStaticParams` in `[channel]`, and no Saleor read at build time.
 */
export const instant = false;

/**
 * Framework requirement only: with Cache Components, every root param (`locale` — this is the
 * root layout) needs at least one build-time value or the build fails. One code-defined seed,
 * not a list of markets; all other locale/channel pairs come from Saleor at request time.
 */
export function generateStaticParams() {
	return [{ locale: getDefaultLocaleSlug() }];
}

/**
 * Storefront root layout — `<html lang>` and code-owned UI strings follow the **display language**
 * (`?lang=` → browser → market locale, resolved by the middleware), not the URL market locale.
 *
 * The URL `[locale]` stays the market locale (links, slugs, hreflang); the actual `notFound()` for
 * invalid pairs lives in `[channel]/layout`.
 */
export default async function LocaleRootLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ locale: string }>;
}) {
	// URL locale = market locale (validated in `[channel]/layout`); text follows the display language.
	await params;
	const displayLanguage = await getDisplayLanguage();
	const explicitDisplayLanguage = await getExplicitDisplayLanguage();
	const htmlLang = resolveLocaleFromSlug(displayLanguage).htmlLang;

	// next-intl gets the display language; every client `useTranslations` / `useLocale` follows it.
	setRequestLocale(displayLanguage);
	const messages = await getMessages();
	const htmlProps = getRootHtmlFontProps(htmlLang);
	const mediaOrigin = saleorMediaPreconnectOrigin();

	return (
		<html {...htmlProps}>
			{/* No crossOrigin: plain <img> fetches are not CORS, and a `crossorigin`
			    preconnect would warm a connection the image load cannot reuse. */}
			{mediaOrigin && <link rel="preconnect" href={mediaOrigin} />}
			<body className="min-h-dvh font-sans">
				<NextIntlClientProvider locale={displayLanguage} messages={messages} timeZone={getDefaultTimeZone()}>
					<ExplicitDisplayLanguageProvider value={explicitDisplayLanguage}>
						{children}
					</ExplicitDisplayLanguageProvider>
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
