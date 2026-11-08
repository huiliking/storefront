import "server-only";

import { getTranslations } from "next-intl/server";
import { cache } from "react";

import { buildCheckoutGatewayMessages } from "@/checkout/lib/payment/gateway-messages";
import { getDisplayLanguage } from "@/lib/display-language-server";

/** Locale-aware checkout server-action fallbacks and gateway copy. */
export const getCheckoutServerTranslations = cache(async () => {
	const locale = await getDisplayLanguage();
	const [server, gateways] = await Promise.all([
		getTranslations({ locale, namespace: "checkout.server" }),
		getTranslations({ locale, namespace: "checkout.gateways" }),
	]);

	return {
		server,
		gatewayMessages: buildCheckoutGatewayMessages(gateways),
	};
});
