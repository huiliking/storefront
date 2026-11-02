import { Suspense } from "react";
import Link from "@/ui/atoms/storefront-link";
import { getFooterMenuItems } from "@/lib/menus/get-menu-data";
import { getStorefrontContent } from "@/lib/content/server";
import { FooterMenuColumns } from "./footer-menu-columns";
import { CopyrightText } from "./copyright-text";
import { FooterAttribution } from "./footer-attribution";
import { FooterPhotoCredits } from "./footer-photo-credits";
import { brandConfig } from "@/config/brand";
import { Logo } from "./shared/logo";

import { buildStorefrontPath } from "@/lib/storefront-path";
import { getDisplayLanguage } from "@/lib/display-language-server";

export async function Footer({ locale, channel }: { locale: string; channel: string }) {
	const displayLanguage = await getDisplayLanguage();
	const [menuItems, content] = await Promise.all([
		getFooterMenuItems(channel, locale, displayLanguage),
		getStorefrontContent(channel, displayLanguage),
	]);

	const footerMenuItems = menuItems ?? [];

	return (
		<footer className="bg-foreground text-background">
			{/* Extra bottom padding on mobile to account for sticky add-to-cart bar */}
			<div className="container-content pb-24 pt-12 sm:pb-12 lg:py-16">
				<div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
					{/* Brand */}
					<div className="col-span-2 md:col-span-1">
						<Link href={buildStorefrontPath(locale, channel)} className="mb-4 inline-block">
							<Logo className="h-7 w-auto" inverted />
						</Link>
						<p className="mt-4 max-w-xs text-sm leading-relaxed text-inverse-subtle">{brandConfig.tagline}</p>
					</div>

					<FooterMenuColumns items={footerMenuItems} />
				</div>

				{/* Market selector (left) and language picker (right) live in the header — ADR 0008. */}

				{/* Bottom bar */}
				<div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-inverse pt-8 sm:flex-row">
					<div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
						<p className="text-xs text-inverse-muted">
							{/* The year is read at request time; the shell keeps the line's height. */}
							<Suspense fallback={"\u00a0"}>
								<CopyrightText />
							</Suspense>
						</p>
						<FooterAttribution />
						<FooterPhotoCredits credits={content.surfaces.homepage.photoCredits} />
					</div>
					<div className="flex items-center gap-6">
						<Link
							href="/privacy"
							prefetch={false}
							className="text-xs text-inverse-muted transition-colors hover:text-inverse-subtle"
						>
							Privacy Policy
						</Link>
						<Link
							href="/terms"
							prefetch={false}
							className="text-xs text-inverse-muted transition-colors hover:text-inverse-subtle"
						>
							Terms of Service
						</Link>
					</div>
				</div>
			</div>
		</footer>
	);
}
