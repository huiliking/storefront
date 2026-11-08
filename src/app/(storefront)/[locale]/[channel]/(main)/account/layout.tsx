import { type ReactNode, Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthFormSection } from "@/ui/components/auth/auth-form-section";
import { AccountLogin } from "@/ui/components/account/account-login";
import { AccountNav } from "@/ui/components/account/account-nav";
import { AccountSkeleton } from "@/ui/components/account/account-skeleton";
import { AccountProvider } from "@/ui/components/account/account-context";
import { AccountUnavailable } from "@/ui/components/account/account-unavailable";
import { getAccountAuthState } from "./get-current-user";
import { getDisplayLanguage } from "@/lib/display-language-server";

/** Auth-gated routes — prefetching is wasteful for rarely visited account pages. */
export const prefetch = "force-disabled";

type LayoutProps = {
	children: ReactNode;
	params: Promise<{ locale: string; channel: string }>;
};

export async function generateMetadata() {
	const t = await getTranslations({ locale: await getDisplayLanguage(), namespace: "account.metadata" });
	return {
		title: t("accountTitle"),
	};
}

export default function AccountLayout({ children, params }: LayoutProps) {
	return (
		<Suspense fallback={<AccountSkeleton />}>
			<AccountShell params={params}>{children}</AccountShell>
		</Suspense>
	);
}

async function AccountShell({ children, params }: LayoutProps) {
	await params;
	const displayLanguage = await getDisplayLanguage();
	const auth = await getAccountAuthState();

	if (auth.status === "guest") {
		return (
			<AuthFormSection>
				<AccountLogin />
			</AuthFormSection>
		);
	}

	if (auth.status === "unavailable") {
		return <AccountUnavailable locale={displayLanguage} />;
	}

	return (
		<AccountProvider user={auth.user}>
			<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
				<div className="flex flex-col gap-8 md:flex-row">
					<aside className="shrink-0 md:min-h-[60vh] md:w-52">
						<AccountNav />
					</aside>
					<div className="min-w-0 flex-1">{children}</div>
				</div>
			</div>
		</AccountProvider>
	);
}
