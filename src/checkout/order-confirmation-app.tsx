"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import type { CheckoutUser, ServerOrder } from "@/checkout/lib/checkout-types";
import type { OrderViewAccess } from "@/lib/order-view/sanitize";
import { CheckoutBrowseProvider } from "@/checkout/providers/checkout-browse";
import { OrderDataProvider } from "@/checkout/providers/order-data";
import { CheckoutUserProvider } from "@/checkout/providers/checkout-user";
import { OrderConfirmation, OrderConfirmationSkeleton } from "@/checkout/views/order-confirmation";
import { CheckoutCrashFallback } from "@/checkout/views/page-not-found";
import "./index.css";

import type { CheckoutMessages } from "@/i18n/load-messages";
import { CheckoutIntlProvider } from "@/checkout/providers/checkout-intl";
import type { CheckoutLanguages } from "@/lib/checkout-languages";

type OrderConfirmationAppProps = {
	orderId: string | null;
	initialOrder: ServerOrder | null;
	access: OrderViewAccess;
	initialUser: CheckoutUser | null;
	/** Display language, market locale, explicit `?lang=` (ADR 0008). */
	languages: CheckoutLanguages;
	messages: CheckoutMessages;
};

/**
 * Client shell for order confirmation — separate from active checkout (`CheckoutApp`).
 */
export function OrderConfirmationApp({
	orderId,
	initialOrder,
	access,
	initialUser,
	languages,
	messages,
}: OrderConfirmationAppProps) {
	return (
		<CheckoutIntlProvider locale={languages.displayLanguage} messages={messages}>
			<CheckoutBrowseProvider languages={languages}>
				<CheckoutUserProvider initialUser={initialUser}>
					<OrderDataProvider orderId={orderId} initialOrder={initialOrder} access={access}>
						<ErrorBoundary FallbackComponent={CheckoutCrashFallback}>
							<Suspense fallback={<OrderConfirmationSkeleton />}>
								<OrderConfirmation />
							</Suspense>
						</ErrorBoundary>
					</OrderDataProvider>
				</CheckoutUserProvider>
			</CheckoutBrowseProvider>
		</CheckoutIntlProvider>
	);
}
