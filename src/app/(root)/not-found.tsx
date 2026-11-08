import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { getDefaultLocaleSlug, getDefaultTimeZone } from "@/config/locale";
import { NotFoundContent } from "@/ui/components/not-found-content";

/**
 * `(root)` has no `[locale]` segment and no next-intl provider, so supply the default
 * locale's messages here — `NotFoundContent` reads its copy via `useTranslations`.
 */
export default async function RootNotFound() {
	const locale = getDefaultLocaleSlug();
	const messages = await getMessages({ locale });

	return (
		<NextIntlClientProvider locale={locale} messages={messages} timeZone={getDefaultTimeZone()}>
			<NotFoundContent />
		</NextIntlClientProvider>
	);
}
