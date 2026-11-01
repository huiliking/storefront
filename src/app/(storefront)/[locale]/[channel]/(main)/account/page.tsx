import { Suspense } from "react";
import { AccountOverviewWelcome } from "@/ui/components/account/account-overview-welcome";
import { AccountOverviewDefaultAddress } from "@/ui/components/account/account-overview-default-address";
import { RecentOrdersSection } from "@/ui/components/account/recent-orders-section";
import { RecentOrdersSectionSkeleton } from "@/ui/components/account/account-skeleton";
import { getDisplayLanguage } from "@/lib/display-language-server";

export default async function AccountOverviewPage() {
	const displayLanguage = await getDisplayLanguage();

	return (
		<div className="space-y-8">
			<AccountOverviewWelcome />

			<Suspense fallback={<RecentOrdersSectionSkeleton />}>
				<RecentOrdersSection localeSlug={displayLanguage} />
			</Suspense>

			<AccountOverviewDefaultAddress />
		</div>
	);
}
