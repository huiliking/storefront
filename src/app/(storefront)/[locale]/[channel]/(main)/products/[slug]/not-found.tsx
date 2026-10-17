"use client";

import Link from "next/link";
import { Search, Home, ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useStorefrontHref } from "@/hooks/use-storefront-href";
import { buttonClassName } from "@/ui/components/ui/button";

/**
 * Product not found page.
 *
 * Shown when a product slug doesn't exist or has been removed.
 * Provides helpful navigation options. Copy comes from `common.notFound` (next-intl).
 */
export default function ProductNotFound() {
	const t = useTranslations("common.notFound");
	// Inside `/{locale}/{channel}/…`, so the listing link keeps the shopper's locale and channel.
	const productsHref = useStorefrontHref("/products");

	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-16">
			<div className="mx-auto max-w-md text-center">
				{/* 404 Badge */}
				<span className="mb-4 inline-block rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
					404
				</span>

				{/* Heading */}
				<h1 className="mb-2 text-balance text-h1 text-foreground">{t("productTitle")}</h1>

				{/* Message */}
				<p className="mb-8 text-muted-foreground">{t("productDescription")}</p>

				{/* Actions */}
				<div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
					<Link href={productsHref} className={buttonClassName({ asLink: true })}>
						<Search className="h-4 w-4" />
						{t("browseProducts")}
					</Link>

					<Link href="/" className={buttonClassName({ asLink: true, variant: "outline-solid" })}>
						<Home className="h-4 w-4" />
						{t("goHome")}
					</Link>
				</div>

				{/* Back link */}
				<Link
					href="#"
					onClick={(e) => {
						e.preventDefault();
						window.history.back();
					}}
					className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="h-3 w-3" />
					{t("goBack")}
				</Link>
			</div>
		</div>
	);
}
