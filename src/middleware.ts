import { type NextRequest, NextResponse } from "next/server";
import { getStorefrontLocaleSlugs, isLocaleSlug, isStorefrontLocaleSlug } from "@/config/locale";
import { BROWSE_LOCALE_COOKIE, getBrowseLocaleCookieOptions } from "@/lib/browse-locale";
import {
	DISPLAY_LANGUAGE_EXPLICIT_HEADER,
	DISPLAY_LANGUAGE_HEADER,
	DISPLAY_LANGUAGE_PARAM,
	matchDisplayLanguage,
	resolveDisplayLanguage,
} from "@/lib/display-language";

const RESERVED_ROOT_SEGMENTS = new Set([
	"api",
	"checkout",
	"order",
	"_next",
	"favicon.ico",
	"robots.txt",
	"sitemap.xml",
]);

function withBrowseLocaleCookie(request: NextRequest, response: NextResponse, locale: string): NextResponse {
	if (!isStorefrontLocaleSlug(locale)) {
		return response;
	}

	// Skip Set-Cookie when the value is already correct — re-setting on every HTML response
	// marks responses as uncacheable at shared CDNs even when nothing changed.
	const current = request.cookies.get(BROWSE_LOCALE_COOKIE)?.value;
	if (current === locale) {
		return response;
	}

	response.cookies.set(BROWSE_LOCALE_COOKIE, locale, getBrowseLocaleCookieOptions());
	return response;
}

export function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	if (
		pathname.startsWith("/_next") ||
		pathname.startsWith("/api") ||
		pathname.includes(".") // static files
	) {
		return NextResponse.next();
	}

	const segments = pathname.split("/").filter(Boolean);
	const [first, second] = segments;

	if (first && RESERVED_ROOT_SEGMENTS.has(first)) {
		return NextResponse.next();
	}

	// Display language: layouts cannot read `?lang=`, so it is resolved once here and handed to
	// layouts and pages as a request header. No cookie, no channel list, no redirects —
	// `[channel]/layout.tsx` validates `/{locale}/{channel}` against Saleor.
	const marketLocale = first && isLocaleSlug(first) ? first : null;
	const langParam = request.nextUrl.searchParams.get(DISPLAY_LANGUAGE_PARAM);
	const displayLanguage = resolveDisplayLanguage({
		lang: langParam,
		acceptLanguage: request.headers.get("accept-language"),
		marketLocale,
	});

	const requestHeaders = new Headers(request.headers);
	requestHeaders.set(DISPLAY_LANGUAGE_HEADER, displayLanguage);
	// Explicit picker choice — links/redirects carry it on as `?lang=` (no cookie, ADR 0008).
	const explicit = matchDisplayLanguage(langParam, getStorefrontLocaleSlugs());
	if (explicit) requestHeaders.set(DISPLAY_LANGUAGE_EXPLICIT_HEADER, explicit);
	else requestHeaders.delete(DISPLAY_LANGUAGE_EXPLICIT_HEADER);
	// No `Vary: Accept-Language` needed: storefront HTML is per-request and sent as
	// `Cache-Control: private, no-store`, so no shared cache stores one browser's language.
	const response = NextResponse.next({ request: { headers: requestHeaders } });

	if (second && marketLocale) {
		return withBrowseLocaleCookie(request, response, marketLocale);
	}

	return response;
}

export const config = {
	/**
	 * Vercel bills an Edge Middleware invocation for every matched request, including the
	 * ones this function immediately no-ops on. Excluding them here means they are never
	 * invoked at all: API routes, the checkout surface, all `_next` internals, and any
	 * path ending in a file extension (public/ assets, fonts, icons — this also covers
	 * favicon.ico, robots.txt and sitemap.xml).
	 *
	 * Prefixes are anchored with `/` or `$` so they exclude `/api/…` without also
	 * excluding a channel or locale slug that merely starts with those letters.
	 *
	 * The equivalent guards at the top of `middleware()` stay as a backstop for runtimes
	 * that apply the matcher differently (self-hosted, `next start`).
	 */
	matcher: ["/((?!api/|api$|checkout/|checkout$|order/|order$|_next/|.*\\.[\\w]+$).*)"],
};
