# International storefront

How Paper serves **multiple languages and markets** from one deployment. Start here before adding a locale, wiring copy, or debugging “wrong language” bugs.

**ADRs:** [0001 Locale + channel routing](./adr/0001-locale-channel-url-routing.md) · [0002 CMS vs code-owned strings](./adr/0002-cms-copy-vs-code-owned-ui-strings.md) · [0004 Translatable catalog slugs](./adr/0004-translatable-slugs.md)

**Skills:** [`ui-locale-routing`](../skills/saleor-paper-storefront/rules/ui-locale-routing.md) · [`ui-i18n`](../skills/saleor-paper-storefront/rules/ui-i18n.md) · [`seo-metadata`](../skills/saleor-paper-storefront/rules/seo-metadata.md) · [`data-storefront-content`](../skills/saleor-paper-storefront/rules/data-storefront-content.md)

---

## Three string systems (do not mix them up)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  URL: /{locale}/{channel}/products/{slug}                               │
│       e.g. /en/us/products/hoodie  ·  /pl/pl/products/bluza             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Saleor catalog translations (GraphQL languageCode)                    │
│     Product names, attributes, menus, categories                        │
│     Optional translated URL slugs (ADR 0004) — pickTranslatedSlug()     │
│     → pickTranslatedName(), translation { } fields                      │
│                                                                         │
│  2. Storefront content layer (CMS / Saleor Models)                      │
│     Editorial copy merchants reword per shop                            │
│     → getStorefrontContent(channel, localeSlug)                         │
│     → announcement bar, homepage sections, cart trust, checkout copy   │
│                                                                         │
│  3. next-intl messages (code-owned functional UI)                       │
│     Buttons, labels, a11y, validation, order status chrome              │
│     → messages/{locale}.json + useTranslations / getTranslations      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Decision rule (ADR 0002):** _Would a merchant reword this per shop for brand voice?_ → CMS (2). Otherwise → `messages/*.json` (3). Product/category **names** always come from Saleor (1). Catalog **URL handles** may also be translated in Saleor (1) when merchants set translation slugs.

**Channel policies** (`freeShippingThreshold`, `returnsWindowDays`) are structured **facts** in the content layer—not strings in any of the three buckets. Copy references them via `{freeShippingThreshold}` tokens.

---

## URL model

Browse: `/{locale}/{channel}/{path}`

| Segment   | Role                                      | Examples                                 |
| --------- | ----------------------------------------- | ---------------------------------------- |
| `locale`  | Language, `html lang`, Intl, GraphQL lang | `en`, `pl`, `de`, `fr`, `fi`, `nb`, `ko` |
| `channel` | Saleor market — currency, stock, shipping | `us`, `uk`, `pl`                         |

```
/en/us/products/hoodie     English UI, US market (USD)
/pl/pl/products/bluza      Polish UI, Poland (PLN) — translated product slug when set in Saleor
/en/uk/products/hoodie     English UI, UK market (GBP) — same language, different channel
```

Checkout stays at `/checkout` — the storefront's checkout link carries the market locale (`?locale=`) and an explicit display language (`?lang=`); the channel comes from the checkout. No cookies (ADR 0008).

**Header controls** (ADR 0008): the **market selector** (left) lists Saleor channels with their paired market locales and changes `/{locale}/{channel}` (currency, availability, document language follow). The **language picker** (right) sets only the display language (`?lang=`) — page text and translated content — and never changes the path or prices. Locale↔channel pairs live in Saleor channel metadata (`storefront.locales`): unpaired combinations are not-found and hreflang alternates are the Saleor pairs (region-aware keys, e.g. `fr-CA`).

**Structural path segments** (`/products/`, `/categories/`, …) stay English in code — only Saleor entity slugs are translatable. There are no locale/channel redirects: legacy `/{channel}/…` URLs and unpaired locales are not-found.

### Translated catalog slugs (optional)

Saleor (3.21+) can store a per-language `translation.slug` for products, categories, collections, and pages. Paper:

1. Resolves URLs with `slugLanguageCode`, then falls back to the primary slug
2. **308**s non-canonical handles to the locale’s canonical slug
3. Builds links, menus, and **hreflang** with `pickTranslatedSlug` / `buildLocaleSlugMap`
4. Remaps the handle on language switch (or drops to `/products` / home if identity is not ready yet)

Primary `entity.slug` remains cache/webhook identity. Details: [ADR 0004](./adr/0004-translatable-slugs.md).

Merchants who never set translation slugs keep shared handles across locales (previous behavior).

---

## Supported locales (code)

Defined in `src/config/locale.ts` (`LOCALE_DEFINITIONS`):

| Slug | Saleor `LanguageCodeEnum` | Notes                        |
| ---- | ------------------------- | ---------------------------- |
| `en` | `EN`                      | Default                      |
| `pl` | `PL`                      |                              |
| `de` | `DE`                      |                              |
| `fr` | `FR`                      |                              |
| `fi` | `FI`                      |                              |
| `nb` | `NB`                      | Bokmål — slug `nb`, not `no` |
| `ja` | `JA`                      |                              |
| `ko` | `KO`                      |                              |

Enable display languages per deployment with `NEXT_PUBLIC_STOREFRONT_DISPLAY_LANGUAGES` (comma-separated; translation only — markets come from Saleor). Each needs `messages/{slug}.json`.

**Saleor Dashboard** stores translations under **base** language codes (`/translations/PL/…`), not regional variants like `PL_PL`.

---

## next-intl namespaces (storefront surface)

| Namespace         | Surfaces                                                    |
| ----------------- | ----------------------------------------------------------- |
| `cart`            | Cart drawer + cart page functional chrome                   |
| `productsListing` | PLP breadcrumbs                                             |
| `common`          | Shared UI (`pagination`, etc.)                              |
| `pdp`             | Add to bag, variant labels, badges                          |
| `plp`             | Filters, sort, quick add                                    |
| `search`          | Search page, bar, sort, empty state                         |
| `nav`             | Header, cart button, user menu, region picker, breadcrumbs  |
| `account`         | Login, signup, account shell, orders, settings, addresses   |
| `checkout`        | Steps, summary, shipping/payment CTAs, errors, confirmation |

**Patterns:** Browse — server `getTranslations({ locale: await getDisplayLanguage(), namespace })` (the **display language**, not the URL locale); client under `NextIntlClientProvider` in `(storefront)/[locale]/layout.tsx`, whose locale is the display language. **Checkout** — same provider pattern via `CheckoutIntlProvider`; display language from the middleware (`?lang=` → browser → `?locale=`). Types from `messages/en.json` via `src/i18n/types.d.ts`.

Editorial checkout copy (empty session, trust, marketing opt-in) stays in storefront content (`useCheckoutContent`).

---

## Environment variables

```env
# Display languages (must match LOCALE_DEFINITIONS + messages/*.json) — translation only
NEXT_PUBLIC_DEFAULT_LOCALE=en                      # last-resort display language
NEXT_PUBLIC_STOREFRONT_DISPLAY_LANGUAGES=en,pl,de,fr,fi,nb,ja,ko

# Channels (markets) and locale↔channel pairs: NOT here — Saleor channel metadata
# (storefront.locales / storefront.defaultLocale / storefront.default), read with:
SALEOR_APP_TOKEN=...                               # zero-permission app is enough

# Merchant copy provider (default: saleor — Saleor Models)
CONTENT_PROVIDER=saleor
# CONTENT_PROVIDER=code          # code defaults only (escape hatch)
```

Configurator ops: [`config/saleor/README.md`](../config/saleor/README.md).

---

## Caching & SEO

- **Cache keys** include `localeSlug` — separate cached GraphQL payload per language, same TTL.
- **Cache tags** stay slug-scoped (`product:{slug}`); webhooks fan out paths across locales via `buildPathsForAllLocales()`.
- **Storefront content** tag: `storefront-content:{channel}:{locale}` (BCP 47).
- **Canonical + hreflang** on browse pages — `buildBrowsePageMetadata()`; catalog detail pages pass `pathSuffixByLocale` so each language’s alternate uses its own handle. hreflang keys are language-only unless `LOCALE_CHANNELS` is set (then `bcp47`, e.g. `ja-JP`).
- **`x-default`** = `NEXT_PUBLIC_DEFAULT_LOCALE` (+ paired/default channel). No separate SEO env.
- **`og:locale`** from the URL locale (`LOCALE_DEFINITIONS.ogLocale`); descriptions via `resolveSeoDescription()`.
- **`<html lang>`** set server-side from URL locale (`htmlLang`, language-only).
- **Audit caveat:** browser DevTools may show doubled head tags after hydration (Next streaming metadata); bot/curl HTML is authoritative for crawlers.

Details: [`data-caching.md`](../skills/saleor-paper-storefront/rules/data-caching.md) § Locale · [`seo-metadata.md`](../skills/saleor-paper-storefront/rules/seo-metadata.md).

---

## Add a new language (checklist)

1. **`src/config/locale.ts`** — add slug to `LOCALE_DEFINITIONS` (bcp47, graphqlLanguageCode, htmlLang).
2. **`messages/{slug}.json`** — copy structure from `en.json`; translate all keys.
3. **`NEXT_PUBLIC_STOREFRONT_DISPLAY_LANGUAGES`** — include the new slug. To also use it as a **market** locale, add it to a channel's `storefront.locales` metadata in the Dashboard (no rebuild).
4. **Saleor Dashboard** — translate products, categories, menus, attributes for that language; optionally set **translated URL slugs** (Translations → slug) for SEO handles.
5. **For Saleor Models translations (default provider):** add `config/saleor/fixtures/translations/{slug}.yaml` and run `pnpm configurator:storefront-content:translations`.
6. **If adding a locale to `LOCALE_DEFINITIONS`:** also add `slugXX` aliases in `src/graphql/LocaleSlugTranslations.graphql` (keep in sync with `graphqlLanguageCode`).
7. **Verify:** `?lang=` page text and product name translation, market URL + translated slug, cart/checkout handoff (`?locale=` / `?lang=`), hreflang alternates, market selector and language picker.

---

## Backlog (known gaps)

| Item                                 | Notes                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout contact/auth/address/Stripe | Done — server-action fallbacks + gateway alerts remain                                                                                                                                                                                                                                                     |
| `not-found` / global error pages     | English                                                                                                                                                                                                                                                                                                    |
| PLP price filter labels              | Hardcoded USD ranges                                                                                                                                                                                                                                                                                       |
| GraphQL error `message` pass-through | Some account/auth API errors stay API language                                                                                                                                                                                                                                                             |
| `TRANSLATION_*` cache invalidation   | Primarily saleor-paper-app (ADR 0004 phase 3)                                                                                                                                                                                                                                                              |
| Localized `/products/` path segments | Not planned — structural segments stay English; entity slugs optional                                                                                                                                                                                                                                      |
| `sitemap.ts` / `robots.ts`           | **Not shipped on purpose for naive dumps.** URL cardinality ≈ catalog × locales × channels; Google ≤50k URLs/file. When implementing: Next `generateSitemaps` index + cursor-paginated chunks, respect `LOCALE_CHANNELS`, cache hard — see `seo-metadata.md` § Sitemap & robots. Prefer `robots.ts` first. |
| Hardcoded a11y strings               | Gallery / logo / dismiss / Size prefix / market-switch confirm still EN in places                                                                                                                                                                                                                          |

---

## Related docs

| Topic                         | Location                                                       |
| ----------------------------- | -------------------------------------------------------------- |
| Fork upgrade (locale routing) | `skills/.../migrations/atomic/2026-06-locale-channel-routing/` |
| Saleor Models + fixtures      | `config/saleor/README.md`                                      |
| Architecture pillars          | `skills/.../rules/paper-architecture.md`                       |
