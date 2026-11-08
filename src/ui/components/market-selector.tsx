"use client";

import { Check, ChevronDown, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useStorefrontRegionNavigation } from "@/hooks/use-storefront-region-navigation";
import { cn } from "@/lib/utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";

export type MarketOption = {
	slug: string;
	/** Saleor channel name (falls back to the currency code). */
	label: string;
	currencyCode: string;
	/** Market locales Saleor pairs with this channel, labelled in their own language. */
	locales: Array<{ slug: string; label: string }>;
};

/**
 * Market selector (header, left) — ADR 0008.
 *
 * A market is a Saleor channel + one of its paired market locales: it changes the URL
 * `/{locale}/{channel}`, so currency, availability, shipping and document language follow.
 * Options come from Saleor; the display language (`?lang=`) is untouched and carried along.
 */
export function MarketSelector({
	markets,
	className,
	labelClassName = "hidden xl:inline",
}: {
	markets: MarketOption[];
	className?: string;
	/** Channel name visibility; the header shows only the currency below `xl` to fit the nav. */
	labelClassName?: string;
}) {
	const t = useTranslations("nav.regionPicker");
	const { locale, channel, navigateToLocale, navigateToChannel } = useStorefrontRegionNavigation();

	const pairCount = markets.reduce((sum, market) => sum + market.locales.length, 0);
	if (pairCount <= 1) return null;

	const current = markets.find((market) => market.slug === channel);

	function choose(targetChannel: string, targetLocale: string) {
		if (targetChannel === channel) {
			if (targetLocale !== locale) navigateToLocale(targetLocale);
			return;
		}
		// Keep the path when the locale stays the same; otherwise enter the market's home page.
		navigateToChannel(targetChannel, targetLocale === locale ? undefined : targetLocale);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={cn(
					"group inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm",
					"text-foreground transition-colors hover:bg-secondary/60",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
					className,
				)}
				aria-label={t("marketTitle")}
			>
				<Store className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
				<span className={cn("max-w-40 truncate font-medium", labelClassName)}>
					{current?.label ?? channel}
				</span>
				{current ? (
					<span className="shrink-0 text-xs text-muted-foreground">{current.currencyCode}</span>
				) : null}
				<ChevronDown
					className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
					aria-hidden
				/>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="start" sideOffset={8} collisionPadding={16} className="w-72 rounded-xl p-2">
				<DropdownMenuLabel className="px-2 pb-1">
					<span className="block text-xs font-semibold uppercase tracking-wider text-foreground">
						{t("marketTitle")}
					</span>
					<span className="block text-[11px] font-normal text-muted-foreground">
						{t("marketDescription")}
					</span>
				</DropdownMenuLabel>
				{markets.map((market, index) => (
					<DropdownMenuGroup key={market.slug}>
						{index > 0 ? <DropdownMenuSeparator /> : null}
						<div className="flex items-center justify-between px-2 pb-1 pt-2 text-xs text-muted-foreground">
							<span className="font-medium">{market.label}</span>
							<span className="tabular-nums">{market.currencyCode}</span>
						</div>
						{market.locales.map((item) => {
							const selected = market.slug === channel && item.slug === locale;
							return (
								<DropdownMenuItem
									key={item.slug}
									lang={item.slug}
									onSelect={() => choose(market.slug, item.slug)}
									className={cn("rounded-lg py-2 pl-3 pr-3", selected && "bg-accent/60")}
								>
									<span className="min-w-0 flex-1 truncate">{item.label}</span>
									<span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
										{selected ? <Check className="h-4 w-4" /> : null}
									</span>
								</DropdownMenuItem>
							);
						})}
					</DropdownMenuGroup>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
