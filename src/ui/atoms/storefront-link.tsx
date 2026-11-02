"use client";

import Link from "next/link";
import { type ComponentProps } from "react";
import { DISPLAY_LANGUAGE_PARAM } from "@/lib/display-language";
import { useExplicitDisplayLanguage, useWithDisplayLanguage } from "@/ui/atoms/display-language-context";

/**
 * Drop-in replacement for `next/link` in the storefront: internal links keep the explicit
 * display-language choice (`?lang=`, ADR 0008). Same props as `next/link`.
 */
export default function StorefrontLink({ href, ...props }: ComponentProps<typeof Link>) {
	const withLang = useWithDisplayLanguage();
	const lang = useExplicitDisplayLanguage();

	if (typeof href === "string") {
		return <Link href={withLang(href)} {...props} />;
	}

	// UrlObject — add `lang` to its query for internal pathnames.
	if (lang && href.pathname?.startsWith("/") && !href.pathname.startsWith("/api/")) {
		const query = typeof href.query === "object" && href.query !== null ? href.query : {};
		return <Link href={{ ...href, query: { ...query, [DISPLAY_LANGUAGE_PARAM]: lang } }} {...props} />;
	}

	return <Link href={href} {...props} />;
}
