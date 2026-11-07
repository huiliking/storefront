import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { invariant } from "ts-invariant";

import { OrderConfirmationApp } from "@/checkout/order-confirmation-app";
import { fetchCheckoutUserOnServer } from "@/checkout/lib/server/fetch-checkout-user";
import { loadOrderView, type LoadedOrderView } from "@/checkout/lib/server/load-order-view";
import { loadCheckoutMessages } from "@/i18n/load-messages";
import { OrderConfirmationRouteFallback } from "@/checkout/views/order-confirmation/order-confirmation-route-fallback";
import { formatPageTitle } from "@/config/brand";
import { resolveCheckoutLanguages, type CheckoutLanguages } from "@/lib/checkout-languages";
import { storefrontHrefWithLanguage } from "@/lib/display-language-server";

/** Per-request access check — no static shell worth showing first. */
export const instant = false;
export const prefetch = "force-disabled";

export const metadata = {
	title: formatPageTitle("Order"),
	robots: { index: false, follow: false },
};

export default async function OrderViewPage(props: {
	params: Promise<{ key: string }>;
	searchParams: Promise<{ locale?: string }>;
}) {
	invariant(process.env.NEXT_PUBLIC_SALEOR_API_URL, "Missing NEXT_PUBLIC_SALEOR_API_URL env variable");

	const [{ key: rawKey }, searchParams] = await Promise.all([props.params, props.searchParams]);
	const key = decodeURIComponent(rawKey);
	const languages = await resolveCheckoutLanguages(searchParams.locale);
	const loaded = await loadOrderView(key, languages.displayLanguage);

	if (loaded === "find-by-number") {
		const findParams = new URLSearchParams({ number: key });
		if (searchParams.locale) {
			findParams.set("locale", searchParams.locale);
		}
		redirect(await storefrontHrefWithLanguage(`/order/find?${findParams.toString()}`));
	}

	if (loaded === "unavailable") {
		throw new Error("Saleor order lookup unavailable");
	}

	if (!loaded) {
		notFound();
	}

	return (
		<Suspense fallback={<OrderConfirmationRouteFallback />}>
			<OrderViewApp loaded={loaded} languages={languages} />
		</Suspense>
	);
}

async function OrderViewApp({
	loaded,
	languages,
}: {
	loaded: LoadedOrderView;
	languages: CheckoutLanguages;
}) {
	const [initialUser, messages] = await Promise.all([
		fetchCheckoutUserOnServer(),
		loadCheckoutMessages(languages.displayLanguage),
	]);

	return (
		<OrderConfirmationApp
			orderId={loaded.orderId}
			initialOrder={loaded.order}
			access={loaded.access}
			initialUser={initialUser}
			languages={languages}
			messages={messages}
		/>
	);
}
