import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { getStorefrontChannels } from "@/lib/channels/get-storefront-channels";
import { isMarketPair } from "@/lib/channels/storefront-channels";

/**
 * Validate the locale↔channel pair against Saleor, then render children.
 *
 * Valid only when the channel is active, opted in (`storefront.locales` metadata), and lists
 * this locale. Everything else is not-found — no redirects.
 *
 * Must wrap `{children}` so invalid routes never fetch/render before `notFound()`.
 * Must NOT use `fallback={children}` — that re-renders the browse tree as the Suspense
 * fallback while this guard awaits `params`, and instant-shell validation then treats
 * nested chrome `await params` as outside Suspense. `fallback={null}` keeps the params
 * read inside the boundary without leaking children into the fallback slot.
 */
async function ChannelRouteGuard({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ locale: string; channel: string }>;
}) {
	const { locale, channel } = await params;

	if (!isMarketPair(await getStorefrontChannels(), locale, channel)) {
		notFound();
	}

	return children;
}

export default function ChannelLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ locale: string; channel: string }>;
}) {
	return (
		<Suspense fallback={null}>
			<ChannelRouteGuard params={params}>{children}</ChannelRouteGuard>
		</Suspense>
	);
}
