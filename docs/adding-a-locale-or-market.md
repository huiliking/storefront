# Adding a locale or a market

Paper separates two things that are easy to conflate:

| Concept                         | What it controls                                                     | Where it lives                                    | Example                     |
| ------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------- | --------------------------- |
| **Locale** (language variant)   | Text and formatting: translations, `<html lang>`, date/number format | Storefront config + Saleor **translations**       | `fr-ca` → Canadian French   |
| **Market** (Saleor **channel**) | Commerce: currency, prices, tax, shipping, stock                     | Saleor **channels** + channel metadata (ADR 0008) | `channel-cad` → Canada, CAD |

A locale never changes the price or currency; a channel never changes the language.
The URL `/{locale}/{channel}/…` carries a **market locale** paired with the channel in Saleor
(`storefront.locales` channel metadata). Page text follows a separate **display language**
(`?lang=` → browser → market locale) — see ADR 0008.

---

## A. Adding a locale

Example: Canadian French next to existing `fr`.

1. **Confirm the Saleor code exists.** Find it in `LanguageCodeEnum` (`schema.graphql` or
   `src/gql/graphql.ts`), e.g. `FR_CA`. Saleor stores base and regional codes as separate
   translation buckets — `FR` and `FR_CA` hold different text.

2. **Add the definition** to `LOCALE_DEFINITIONS` in `src/config/locale.ts`:

   ```ts
   "fr-ca": {
     bcp47: "fr-CA",              // Intl formatting, hreflang
     graphqlLanguageCode: "FR_CA", // exact Saleor enum value — underscore, not hyphen
     htmlLang: "fr-CA",
     ogLocale: "fr_CA",           // Open Graph uses underscore
   },
   ```

   - Slug: lowercase, hyphenated (`fr-ca`).
   - `graphqlLanguageCode`: use the **regional** code whenever another variant of the same
     language exists or the copy differs. Two slugs mapped to the same code fetch the same
     text and silently ignore the regional translation.
   - Adding a second variant of a language that already ships? Check which bucket existing
     translations are stored under before changing the existing entry (e.g. `fr` → `FR`).

3. **Add UI strings:** `messages/fr-ca.json` (start from `fr.json`; adjust regional wording).

4. **Add translated-URL aliases:** in `src/graphql/LocaleSlugTranslations.graphql`, add
   `slugFR_CA: translation(languageCode: FR_CA) { slug }` to **all four** fragments
   (Product, Category, Collection, Page), then run `pnpm generate`. The alias suffix must
   equal `graphqlLanguageCode` — `src/lib/catalog/locale-slugs.ts` builds the key from it.
   Missing aliases don't error; hreflang and language-switch links for that locale just fall
   back to the primary slug.

5. **Enable it as a display language:** add the slug to `NEXT_PUBLIC_STOREFRONT_DISPLAY_LANGUAGES`
   in `.env` (entries not defined in step 2 are dropped with a check-locales error). To use it as
   a **market** locale in URLs, add it to a channel's `storefront.locales` metadata in the
   Dashboard — no rebuild for that part.

6. **Rebuild** the storefront (code, message bundle and `NEXT_PUBLIC_*` list are build-time).

7. **Translate the data in Saleor** (Dashboard → Translations → choose the language), for every
   entity type the shop uses — products, variants, categories, collections, menus, attributes,
   pages / storefront content Models. Fill **all** fields, not only the name:
   name, description, slug, SEO title, SEO description. A missing SEO title falls back to the
   base-language SEO title, not to the translated name.

8. **Refresh the storefront cache.** Saleor webhooks invalidate catalog cache entries. Without
   webhooks, already-cached pages show old data for up to the `catalog` `revalidate` window
   (1 hour, `src/lib/saleor/cache/life-profiles.data.mjs`) or until the storefront restarts.

9. **Verify** on `/{new-locale}/{channel}/products/{slug}`:
   - name, description, title and meta description in the new language;
   - URL switches to the translated slug;
   - `<html lang>` matches `htmlLang`;
   - the header language picker lists the language; `?lang={new-locale}` switches page text;
   - hreflang contains the new locale with its translated slug;
   - existing locales still show their own text (regression check).

---

## B. Adding a market (channel)

Example: Canada, priced in CAD.

1. **Create the channel in Saleor** (Dashboard → Configuration → Channels). Currency is fixed at
   creation — selling in another currency always means another channel. Set the default country,
   warehouses, shipping zones and tax configuration.

2. **List products in the channel** with a price for each variant, and publish them.

3. **Expose it in the storefront:** on the channel, add public metadata `storefront.locales`
   (e.g. `fr-ca,en-ca`) and optionally `storefront.defaultLocale` (also the order/account email
   language). Channels without `storefront.locales` stay hidden.

4. **No rebuild:** the `CHANNEL_METADATA_UPDATED` webhook clears the storefront's channel cache
   (see `ui-channels.md`); without the webhook, the 15-minute backstop applies.

5. **Verify:** the header market selector lists the channel and its locales, prices render in the
   channel currency, and switching markets with a cart shows the cart-reset confirmation.

---

## Combining both

A Canadian launch usually needs **both**: locale `fr-ca` (and maybe `en-ca`) for the language,
and a CAD channel for the prices. Pair them in Saleor with `storefront.locales = fr-ca,en-ca` on the
CAD channel (and `storefront.defaultLocale = fr-ca` if order emails must be French, e.g. Québec).
