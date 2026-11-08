import { redirect } from "next/navigation";
import { getStorefrontChannels } from "@/lib/channels/get-storefront-channels";
import { CHANNEL_METADATA_KEYS, getDefaultStorefrontChannel } from "@/lib/channels/storefront-channels";
import { buildStorefrontPath } from "@/lib/storefront-path";

/**
 * Root page redirects to Saleor's default storefront channel, in that channel's default locale.
 *
 * The default channel is the one with `storefront.default = true` in its metadata (Dashboard →
 * Channels → channel → metadata), else the first storefront channel. No `.env` setting.
 *
 * Deliberately does not carry `?lang=`: reading the request would turn this static 307 into a
 * streamed redirect (HTTP 200). Internal links never point at `/`, so the choice is not lost there.
 */

export default async function RootPage() {
	const channel = getDefaultStorefrontChannel(await getStorefrontChannels());

	if (channel) {
		redirect(buildStorefrontPath(channel.defaultLocale, channel.slug));
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-8">
			<div className="max-w-md text-center">
				<h1 className="mb-4 text-balance text-h1 text-foreground">No Storefront Channel</h1>
				<p className="mb-6 text-muted-foreground">
					No active Saleor channel lists market locales. In the Dashboard, open Configuration → Channels → a
					channel → metadata, and add:
				</p>
				<div className="rounded-lg bg-muted p-4 text-left">
					<code className="block text-sm text-muted-foreground">{CHANNEL_METADATA_KEYS.locales} = en</code>
					<code className="block text-sm text-muted-foreground">
						{CHANNEL_METADATA_KEYS.isDefault} = true
					</code>
				</div>
			</div>
		</div>
	);
}
