import { type NextRequest, NextResponse } from "next/server";
import { getStorefrontLocaleSlugs, isLocaleSlug } from "@/config/locale";
import {
	DISPLAY_LANGUAGE_EXPLICIT_HEADER,
	DISPLAY_LANGUAGE_HEADER,
	DISPLAY_LANGUAGE_PARAM,
	matchDisplayLanguage,
	resolveDisplayLanguage,
} from "@/lib/display-language";

/** Locale-less surfaces that carry the market locale as `?locale=` (set by the storefront's links). */
const LOCALE_LESS_SURFACES = new Set(["checkout", "order"]);

const RESERVED_ROOT_SEGMENTS = new Set(["api", "_next", "favicon.ico", "robots.txt", "sitemap.xml"]);

/**
 * Display-language resolver (ADR 0008) — the middleware's only job.
 *
 * Layouts cannot read `?lang=`, so the display language is resolved once here and handed to
 * layouts, pages and server actions as request headers:
 *   `?lang=` → browser `Accept-Language` → market locale (URL segment, or `?locale=` on
 *   checkout/order) → storefront default.
 * No cookie, no channel list, no redirects — `[channel]/layout.tsx` validates `/{locale}/{channel}`
 * against Saleor.
 */
export function middleware(request: NextRequest) {
	const { pathname, searchParams } = request.nextUrl;

	if (
		pathname.startsWith("/_next") ||
		pathname.startsWith("/api") ||
		pathname.includes(".") // static files
	) {
		return NextResponse.next();
	}

	const [first] = pathname.split("/").filter(Boolean);

	if (first && RESERVED_ROOT_SEGMENTS.has(first)) {
		return NextResponse.next();
	}

	const marketCandidate = first && LOCALE_LESS_SURFACES.has(first) ? searchParams.get("locale") : first;
	const marketLocale = marketCandidate && isLocaleSlug(marketCandidate) ? marketCandidate : null;
	const langParam = searchParams.get(DISPLAY_LANGUAGE_PARAM);

	const requestHeaders = new Headers(request.headers);
	requestHeaders.set(
		DISPLAY_LANGUAGE_HEADER,
		resolveDisplayLanguage({
			lang: langParam,
			acceptLanguage: request.headers.get("accept-language"),
			marketLocale,
		}),
	);

	// Explicit picker choice — links and redirects carry it on as `?lang=`.
	const explicit = matchDisplayLanguage(langParam, getStorefrontLocaleSlugs());
	if (explicit) requestHeaders.set(DISPLAY_LANGUAGE_EXPLICIT_HEADER, explicit);
	else requestHeaders.delete(DISPLAY_LANGUAGE_EXPLICIT_HEADER);

	// No `Vary: Accept-Language` needed: storefront and checkout HTML is per request and sent as
	// `Cache-Control: private, no-store`, so no shared cache stores one browser's language.
	return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
	/**
	 * Runs on storefront pages and the checkout / order surfaces (their display language comes from
	 * here too). Excluded: API routes, `_next` internals, and any path ending in a file extension
	 * (public assets, fonts, icons, favicon.ico, robots.txt, sitemap.xml). Self-hosted, so the
	 * per-invocation billing that once excluded checkout does not apply.
	 *
	 * The guards at the top of `middleware()` stay as a backstop for runtimes that apply the
	 * matcher differently (`next start`).
	 */
	matcher: ["/((?!api/|api$|_next/|.*\\.[\\w]+$).*)"],
};
