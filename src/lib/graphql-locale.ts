import { getGraphqlLanguageCode } from "@/config/locale";
import type { LanguageCodeEnum } from "@/gql/graphql";

/** GraphQL `languageCode` (content translations) from the **display language**. */
export function graphqlLanguageCodeVariables(displayLanguage: string): { languageCode: LanguageCodeEnum } {
	return { languageCode: getGraphqlLanguageCode(displayLanguage) as LanguageCodeEnum };
}

/** GraphQL `marketLanguageCode` (URL slugs via `marketTranslation`) from the **market locale** in the URL. */
export function graphqlMarketLanguageCodeVariables(marketLocale: string): {
	marketLanguageCode: LanguageCodeEnum;
} {
	return { marketLanguageCode: getGraphqlLanguageCode(marketLocale) as LanguageCodeEnum };
}

/** Both language variables for queries that return content and links. */
export function graphqlContentAndSlugVariables(
	marketLocale: string,
	displayLanguage: string,
): { languageCode: LanguageCodeEnum; marketLanguageCode: LanguageCodeEnum } {
	return {
		...graphqlLanguageCodeVariables(displayLanguage),
		...graphqlMarketLanguageCodeVariables(marketLocale),
	};
}

/** GraphQL `slugLanguageCode` for resolving catalog entities by translated slug (market locale). */
export function graphqlSlugLanguageCodeVariables(marketLocale: string): {
	slugLanguageCode: LanguageCodeEnum;
} {
	return { slugLanguageCode: getGraphqlLanguageCode(marketLocale) as LanguageCodeEnum };
}
