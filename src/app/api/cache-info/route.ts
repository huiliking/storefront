import { NextRequest } from "next/server";
import { buildManifest } from "@/lib/saleor";
import { getStorefrontChannels } from "@/lib/channels/get-storefront-channels";
import { extractBearerToken, verifySecret } from "@/lib/api-auth";

/**
 * Cache introspection endpoint.
 *
 * Returns a machine-readable manifest of cache profiles so the
 * saleor-paper-app (Dashboard) can discover what the storefront
 * caches and build its invalidation UI accordingly.
 *
 * Protected by REVALIDATE_SECRET via Authorization header.
 *
 * @example
 * curl -H "Authorization: Bearer <token>" https://store.com/api/cache-info
 */
export async function GET(request: NextRequest) {
	const token = extractBearerToken(request);
	if (!verifySecret(token)) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const channels = (await getStorefrontChannels()).map((channel) => channel.slug);
	return Response.json(buildManifest(channels), {
		headers: {
			"Cache-Control": "private, no-store",
		},
	});
}
