"use client";

import { Check, ChevronDown, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { withDisplayLanguage } from "@/lib/display-language-link";
import type { LocaleSelectOption } from "@/lib/locale-display";
import { cn } from "@/lib/utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/ui/components/ui/dropdown-menu";

/**
 * Language picker (header, right) — ADR 0008.
 *
 * Sets only the display language (`?lang=`): page text and translated catalog content. Never
 * changes the URL path, channel, currency or document language. Full page load on purpose:
 * layouts (`<html lang>`, UI messages) persist across client navigation.
 */
export function LanguagePicker({
	languages,
	className,
}: {
	languages: LocaleSelectOption[];
	className?: string;
}) {
	const t = useTranslations("nav.regionPicker");
	const current = useLocale();

	if (languages.length <= 1) return null;

	const currentLabel = languages.find((item) => item.slug === current)?.label ?? current;

	function choose(slug: string) {
		if (slug === current) return;
		const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		window.location.assign(withDisplayLanguage(here, slug));
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={cn(
					"group inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-sm text-foreground transition-colors hover:bg-secondary/60",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					className,
				)}
				aria-label={`${t("languageTitle")}: ${currentLabel}`}
			>
				<Languages className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
				<span className="text-xs font-semibold uppercase">{current}</span>
				<ChevronDown
					className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
					aria-hidden
				/>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end" sideOffset={8} collisionPadding={16} className="w-56 rounded-xl p-2">
				<DropdownMenuLabel className="px-2 pb-1">
					<span className="block text-xs font-semibold uppercase tracking-wider text-foreground">
						{t("languageTitle")}
					</span>
					<span className="block text-[11px] font-normal text-muted-foreground">
						{t("languageDescription")}
					</span>
				</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={current} onValueChange={choose}>
					{languages.map((item) => (
						<DropdownMenuRadioItem
							key={item.slug}
							value={item.slug}
							lang={item.slug}
							className="my-0.5 rounded-lg py-2 pl-3 pr-3 data-[state=checked]:bg-accent/60 [&>span:first-child]:hidden"
						>
							<span className="min-w-0 flex-1 truncate">{item.label}</span>
							<span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
								{item.slug === current ? <Check className="h-4 w-4" /> : null}
							</span>
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
