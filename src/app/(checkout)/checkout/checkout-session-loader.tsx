import { redirect } from "next/navigation";
import { invariant } from "ts-invariant";
import { buildCheckoutPath, buildOrderStatusPath } from "@paper/session-bridge";
import { CheckoutApp } from "@/checkout/checkout-app";
import { getStorefrontContent } from "@/lib/content/server";
import { loadCheckoutMessages } from "@/i18n/load-messages";
import type {
	ChannelDefaultCountryCode,
	CheckoutLoadState,
	ServerCheckout,
	ShippingCountries,
} from "@/checkout/lib/checkout-types";
import {
	getCheckoutSessionCheckout,
	getCheckoutSessionCountries,
	getCheckoutSessionUser,
} from "@/checkout/lib/server/get-checkout-session-data";
import * as Checkout from "@/lib/checkout";
import { isLocaleSlug } from "@/config/locale";
import { resolveCheckoutLanguages } from "@/lib/checkout-languages";
import { getDisplayLanguage, storefrontHrefWithLanguage } from "@/lib/display-language-server";

/** Server-visible checkout URL params. `step` is client-only (shallow `?step=` updates). */
export type CheckoutPageSearchParams = {
	checkout?: string;
	order?: string;
	locale?: string;
};

type CheckoutSessionLoaderProps = {
	searchParams: Promise<CheckoutPageSearchParams>;
};

/**
 * RSC entry for active checkout — loads session data from `?checkout=` only.
 * Step UI (`?step=`) is resolved client-side via `useCheckoutStepFromUrl`.
 */
export async function CheckoutSessionLoader({
	searchParams: searchParamsPromise,
}: CheckoutSessionLoaderProps) {
	const searchParams = await searchParamsPromise;
	invariant(process.env.NEXT_PUBLIC_SALEOR_API_URL, "Missing NEXT_PUBLIC_SALEOR_API_URL env variable");

	const orderId = searchParams.order ?? null;
	const checkoutIdFromUrl = searchParams.checkout ?? null;
	// Display language comes from the middleware (`?lang=` → browser → `?locale=`); the market locale
	// (`?locale=`, else the channel default) is resolved once the checkout's channel is known.
	const displayLanguage = await getDisplayLanguage();
	const urlMarketLocale =
		searchParams.locale && isLocaleSlug(searchParams.locale) ? searchParams.locale : undefined;

	if (orderId) {
		redirect(await storefrontHrefWithLanguage(buildOrderStatusPath(orderId, urlMarketLocale)));
	}

	if (!checkoutIdFromUrl) {
		const checkoutIdFromCartCookie = await Checkout.getFirstCheckoutIdFromCartCookies();
		if (checkoutIdFromCartCookie) {
			redirect(
				await storefrontHrefWithLanguage(
					buildCheckoutPath({ checkoutId: checkoutIdFromCartCookie, browseLocale: urlMarketLocale }),
				),
			);
		}
	}

	const [initialUser, checkoutResult] = await Promise.all([
		getCheckoutSessionUser(),
		checkoutIdFromUrl
			? getCheckoutSessionCheckout(checkoutIdFromUrl, displayLanguage)
			: Promise.resolve(null),
	]);

	let loadState: CheckoutLoadState = "none";
	let channelSlug: string | null = null;
	let initialCheckout: ServerCheckout | null = null;
	let shippingCountries: ShippingCountries = [];
	let channelDefaultCountryCode: ChannelDefaultCountryCode = null;

	if (!checkoutIdFromUrl) {
		loadState = "none";
	} else if (!checkoutResult) {
		loadState = "error";
	} else if (!checkoutResult.ok) {
		loadState = "error";
	} else if (!checkoutResult.checkout) {
		loadState = "not_found";
		await Checkout.clearCheckoutCookieByValue(checkoutIdFromUrl);
	} else {
		channelSlug = checkoutResult.checkout.channel.slug;
		const checkoutIdFromChannelCookie = await Checkout.getIdFromCookies(channelSlug);

		if (checkoutIdFromChannelCookie && checkoutIdFromChannelCookie !== checkoutIdFromUrl) {
			redirect(
				await storefrontHrefWithLanguage(
					buildCheckoutPath({ checkoutId: checkoutIdFromChannelCookie, browseLocale: urlMarketLocale }),
				),
			);
		}

		if (!checkoutResult.checkout.lines.length) {
			loadState = "empty";
		} else {
			loadState = "ready";
			initialCheckout = checkoutResult.checkout;
		}
	}

	if (channelSlug) {
		const channelCountries = await getCheckoutSessionCountries(channelSlug, displayLanguage);
		shippingCountries = channelCountries.countries;
		channelDefaultCountryCode = channelCountries.defaultCountryCode;
	}

	const browseChannel = channelSlug ?? (await Checkout.getChannelSlugFromCartCookies());
	const languages = await resolveCheckoutLanguages(urlMarketLocale, browseChannel);
	const contentChannel = browseChannel ?? languages.defaultChannel ?? "default-channel";
	const [checkoutContent, messages] = await Promise.all([
		getStorefrontContent(contentChannel, displayLanguage).then((content) => content.surfaces.checkout),
		loadCheckoutMessages(displayLanguage),
	]);

	return (
		<CheckoutApp
			checkoutId={checkoutIdFromUrl}
			loadState={loadState}
			initialCheckout={initialCheckout}
			initialUser={initialUser}
			shippingCountries={shippingCountries}
			channelDefaultCountryCode={channelDefaultCountryCode}
			checkoutContent={checkoutContent}
			languages={languages}
			messages={messages}
		/>
	);
}
