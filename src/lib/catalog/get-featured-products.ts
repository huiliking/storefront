import "server-only";

import { ProductListByCollectionDocument, ProductOrderField, OrderDirection } from "@/gql/graphql";
import { graphqlContentAndSlugVariables } from "@/lib/graphql-locale";
import { CACHE_PROFILES, cachedQuery } from "@/lib/saleor";

/**
 * Products from a collection for the homepage featured section.
 * A Saleor failure throws so the outage is not cached as an empty grid.
 */
export async function getFeaturedProducts(
	channel: string,
	localeSlug: string,
	limit = 12,
	collectionSlug = "featured-products",
	/** Product names/labels; `localeSlug` (market) drives link slugs. */
	displayLanguage: string = localeSlug,
) {
	"use cache";

	const data = await cachedQuery(ProductListByCollectionDocument, {
		profile: CACHE_PROFILES.collections,
		tag: collectionSlug,
		variables: {
			slug: collectionSlug,
			channel,
			first: limit,
			sortBy: { field: ProductOrderField.Collection, direction: OrderDirection.Asc },
			...graphqlContentAndSlugVariables(localeSlug, displayLanguage),
		},
	});

	return data.collection?.products?.edges.map(({ node }) => node) ?? [];
}
