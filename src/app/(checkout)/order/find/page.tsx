import { Suspense } from "react";

import { loadCheckoutMessages } from "@/i18n/load-messages";
import { isOrderNumberLookupAvailable } from "@/checkout/lib/server/fetch-order-by-number";
import { CheckoutBrowseProvider } from "@/checkout/providers/checkout-browse";
import { CheckoutIntlProvider } from "@/checkout/providers/checkout-intl";
import { OrderConfirmationPageShell } from "@/checkout/views/order-confirmation/order-confirmation-page-shell";
import { OrderFindForm } from "@/checkout/views/order-confirmation/order-find-form";
import { OrderConfirmationRouteFallback } from "@/checkout/views/order-confirmation/order-confirmation-route-fallback";
import { formatPageTitle } from "@/config/brand";
import { FindOrderCopy } from "./find-order-copy";
import { resolveCheckoutLanguages } from "@/lib/checkout-languages";

export const instant = false;
export const prefetch = "force-disabled";

export const metadata = {
	title: formatPageTitle("Find order"),
	robots: { index: false, follow: false },
};

export default function FindOrderPage(props: {
	searchParams: Promise<{ locale?: string; number?: string }>;
}) {
	return (
		<Suspense fallback={<OrderConfirmationRouteFallback />}>
			<FindOrderContent searchParams={props.searchParams} />
		</Suspense>
	);
}

async function FindOrderContent({
	searchParams: searchParamsPromise,
}: {
	searchParams: Promise<{ locale?: string; number?: string }>;
}) {
	const searchParams = await searchParamsPromise;
	const languages = await resolveCheckoutLanguages(searchParams.locale);
	const messages = await loadCheckoutMessages(languages.displayLanguage);

	return (
		<CheckoutIntlProvider locale={languages.displayLanguage} messages={messages}>
			<CheckoutBrowseProvider languages={languages}>
				<OrderConfirmationPageShell>
					<main className="mx-auto max-w-md px-4 py-12">
						<div className="rounded-lg border border-border bg-card p-6">
							<FindOrderCopy />
							<div className="mt-6">
								<OrderFindForm
									initialNumber={searchParams.number}
									lookupAvailable={isOrderNumberLookupAvailable()}
								/>
							</div>
						</div>
					</main>
				</OrderConfirmationPageShell>
			</CheckoutBrowseProvider>
		</CheckoutIntlProvider>
	);
}
