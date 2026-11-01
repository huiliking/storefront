import "server-only";

import { MenuGetBySlugDocument, type MenuGetBySlugQuery } from "@/gql/graphql";
import { graphqlContentAndSlugVariables } from "@/lib/graphql-locale";
import {
	cachedQuery,
	FOOTER_MENU_SLUG,
	NAVBAR_MENU_SLUG,
	STOREFRONT_MENU_SLUGS,
	type StorefrontMenuSlug,
} from "@/lib/saleor";

export type MenuItem = NonNullable<NonNullable<NonNullable<MenuGetBySlugQuery["menu"]>["items"]>[number]>;

async function getCachedMenuItems(
	slug: StorefrontMenuSlug,
	channel: string,
	localeSlug: string,
	displayLanguage: string,
): Promise<MenuItem[] | null> {
	"use cache";

	const data = await cachedQuery(MenuGetBySlugDocument, {
		profile: STOREFRONT_MENU_SLUGS[slug],
		tag: { channel },
		variables: { slug, channel, ...graphqlContentAndSlugVariables(localeSlug, displayLanguage) },
	});

	return data.menu?.items ?? [];
}

/** `localeSlug` = market locale (link slugs); `displayLanguage` = item labels. */
export async function getNavbarMenuItems(
	channel: string,
	localeSlug: string,
	displayLanguage: string = localeSlug,
) {
	return getCachedMenuItems(NAVBAR_MENU_SLUG, channel, localeSlug, displayLanguage);
}

export async function getFooterMenuItems(
	channel: string,
	localeSlug: string,
	displayLanguage: string = localeSlug,
) {
	return getCachedMenuItems(FOOTER_MENU_SLUG, channel, localeSlug, displayLanguage);
}
