"use client";

import { type ReactNode, type MouseEvent } from "react";
import { useWithDisplayLanguage } from "@/ui/atoms/display-language-context";

type StorefrontHardLinkProps = {
	href: string;
	className?: string;
	children: ReactNode;
};

/**
 * Same-root storefront navigation that must bypass the App Router cache.
 * Plain `<a href>` inside a root layout is still client-navigated by Next.js;
 * auth routes (login after logout) can restore a cached “already signed in → home”
 * payload and feel like the link does nothing.
 */
export function StorefrontHardLink({ href: rawHref, className, children }: StorefrontHardLinkProps) {
	// Keep the explicit display-language choice (`?lang=`) across the hard navigation.
	const href = useWithDisplayLanguage()(rawHref);
	return (
		<a
			href={href}
			className={className}
			onClick={(event: MouseEvent<HTMLAnchorElement>) => {
				event.preventDefault();
				window.location.assign(href);
			}}
		>
			{children}
		</a>
	);
}
