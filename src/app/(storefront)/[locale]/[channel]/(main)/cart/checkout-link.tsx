"use client";

import { buildCheckoutPath } from "@paper/session-bridge";
import { buttonClassName } from "@/ui/components/ui/button";
import { cn } from "@/lib/utils";
import { useWithDisplayLanguage } from "@/ui/atoms/display-language-context";

type Props = {
	disabled?: boolean;
	checkoutId?: string;
	className?: string;
	label?: string;
	browseLocale?: string;
};

export const CheckoutLink = ({
	disabled,
	checkoutId,
	className,
	label = "Checkout",
	browseLocale,
}: Props) => {
	// Carry the market (`?locale=`) and an explicit display-language choice (`?lang=`) into checkout.
	const withLang = useWithDisplayLanguage();
	return (
		<a
			data-testid="CheckoutLink"
			aria-disabled={disabled}
			onClick={(e) => disabled && e.preventDefault()}
			href={withLang(
				checkoutId ? buildCheckoutPath({ checkoutId, step: "contact", browseLocale }) : "/checkout",
			)}
			className={buttonClassName({
				asLink: true,
				className: cn("max-w-full sm:px-16", className),
			})}
		>
			{label}
		</a>
	);
};
