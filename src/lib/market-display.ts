/** A storefront market (Saleor channel) for selectors — built from `getStorefrontChannels()`. */
export type ChannelSelectOption = {
	id: string;
	name: string;
	slug: string;
	currencyCode: string;
	/** Market locales paired with the channel in Saleor. */
	locales: string[];
	/** Locale used when switching into this market from a locale it does not list. */
	defaultLocale: string;
};

export type MarketSelectOption = ChannelSelectOption & {
	/** Saleor channel name, or currency code when name is missing */
	displayLabel: string;
	/** Shown beside the label when a channel name is available */
	currencyHint?: string;
};

export function enrichMarketOptions(channels: ChannelSelectOption[]): MarketSelectOption[] {
	return channels.map((channel) => {
		const name = channel.name.trim();

		return {
			...channel,
			displayLabel: name || channel.currencyCode,
			currencyHint: name ? channel.currencyCode : undefined,
		};
	});
}

/** Narrow currency symbol for compact trigger labels. */
export function getCurrencySymbol(currencyCode: string, localeBcp47: string): string {
	try {
		const parts = new Intl.NumberFormat(localeBcp47, {
			style: "currency",
			currency: currencyCode,
			currencyDisplay: "narrowSymbol",
		}).formatToParts(0);
		return parts.find((part) => part.type === "currency")?.value ?? currencyCode;
	} catch {
		return currencyCode;
	}
}
