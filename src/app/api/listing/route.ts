import { NextRequest } from "next/server";
import { getStorefrontChannels } from "@/lib/channels/get-storefront-channels";
import { isMarketPair } from "@/lib/channels/storefront-channels";
import { DISPLAY_LANGUAGE_PARAM, matchDisplayLanguage } from "@/lib/display-language";
import { getStorefrontLocaleSlugs } from "@/config/locale";
import { listingViewFromSearchParams, type ListingSurface } from "@/lib/catalog/listing-query";
import { loadListingView } from "@/lib/listing/load";

const SURFACES = new Set<ListingSurface>(["all", "category", "collection", "search"]);

function parseSurface(value: string | null): ListingSurface | null {
	if (value && SURFACES.has(value as ListingSurface)) return value as ListingSurface;
	return null;
}

/**
 * Filtered / sorted / paginated listing JSON.
 *
 * Canonical (empty-query) HTML is rendered by the listing pages and must not
 * await `searchParams`. This route is the hole for every other view, including
 * search. It is `private, no-store` so filter permutations are not cached at the edge.
 */
export async function GET(request: NextRequest) {
	const url = request.nextUrl;
	const surface = parseSurface(url.searchParams.get("surface"));
	const locale = url.searchParams.get("locale") ?? "";
	const channel = url.searchParams.get("channel") ?? "";
	const slug = url.searchParams.get("slug") ?? undefined;

	if (!surface) {
		return Response.json({ error: "Invalid surface" }, { status: 400 });
	}
	// `locale` is the market locale from the page URL; it must be paired with the channel in Saleor.
	if (!isMarketPair(await getStorefrontChannels(), locale, channel)) {
		return Response.json({ error: "Invalid locale or channel" }, { status: 400 });
	}
	// Display language comes as `lang` (the middleware does not run on `/api`); default: market locale.
	const displayLanguage =
		matchDisplayLanguage(url.searchParams.get(DISPLAY_LANGUAGE_PARAM), getStorefrontLocaleSlugs()) ??
		matchDisplayLanguage(locale, getStorefrontLocaleSlugs()) ??
		undefined;
	if (surface !== "all" && surface !== "search" && !slug) {
		return Response.json({ error: "Missing slug" }, { status: 400 });
	}

	const payload = await loadListingView({
		surface,
		locale,
		displayLanguage,
		channel,
		slug,
		view: listingViewFromSearchParams(url.searchParams),
	});

	if (!payload) {
		return Response.json({ error: "Not found" }, { status: 404 });
	}

	return Response.json(payload, {
		headers: { "Cache-Control": "private, no-store" },
	});
}
