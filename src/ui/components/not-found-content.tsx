"use client";

import Link from "next/link";
import { Search, Home } from "lucide-react";
import { useTranslations } from "next-intl";
import { DefaultChannelSlug } from "@/app/config";
import { isStorefrontLocaleSlug } from "@/config/locale";
import { useStorefrontParams } from "@/hooks/use-storefront-href";
import { buildStorefrontPath } from "@/lib/storefront-path";
import { buttonClassName } from "@/ui/components/ui/button";

/**
 * Shared 404 UI for per-root-group `not-found.tsx` boundaries.
 * Copy comes from `common.notFound` (next-intl), so it follows the page locale.
 */
export function NotFoundContent() {
	const t = useTranslations("common.notFound");
	const { locale } = useStorefrontParams();
	// The URL that 404'd may carry a bogus channel, so link via the default channel; keep the
	// locale only when it is served. Otherwise `/` lets middleware pick the defaults.
	const productsHref =
		locale && DefaultChannelSlug && isStorefrontLocaleSlug(locale)
			? buildStorefrontPath(locale, DefaultChannelSlug, "/products")
			: "/";

	return (
		<div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
			<div className="mx-auto max-w-md text-center">
				<span className="mb-4 inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
					404
				</span>

				<h1 className="mb-2 text-balance text-h1 text-foreground">{t("title")}</h1>

				<p className="mb-8 text-muted-foreground">{t("description")}</p>

				<div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Link href="/" className={buttonClassName({ asLink: true })}>
						<Home className="h-4 w-4" />
						{t("goHome")}
					</Link>

					<Link href={productsHref} className={buttonClassName({ asLink: true, variant: "outline-solid" })}>
						<Search className="h-4 w-4" />
						{t("browseProducts")}
					</Link>
				</div>
			</div>
		</div>
	);
}
