# ADR 0008: Saleor-owned channels, market locale vs display language

**Status:** Accepted — Phase 1 steps 1–5 implemented; step 6 pending; Phase 2 proposed  
**Date:** 2026-11-01  
**Deciders:** huiliking (localization audit, fork `huiliking/storefront`)  
**Amends:** [0001 Locale and channel URL routing](./0001-locale-channel-url-routing.md), [0004 Saleor translatable catalog slugs](./0004-translatable-slugs.md)  
**Implementation:** branch `channel-backend-phase1` — `c0d3fce0` (steps 1–3), `e8415066` (step 4)

## Context

ADR 0001 made locale and channel orthogonal URL segments, but left **which channels exist** and **which
locale pairs with which channel** in storefront build configuration:

- `STOREFRONT_CHANNELS` (channel allowlist), `NEXT_PUBLIC_DEFAULT_CHANNEL`, `STOREFRONT_DISCOVER_CHANNELS`
- `NEXT_PUBLIC_STOREFRONT_LOCALE_CHANNELS` (locale↔channel matrix, e.g. `en:default-channel,ja:japan`)

`.env` is copied into the image and `NEXT_PUBLIC_*` values are compiled in, and `[locale]/[channel]` pages were
prerendered from those lists. A localization audit (2026-10-31) tested the matrix against a live Saleor and found:

| #   | Finding                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | **Every channel change needs a storefront rebuild** — adding, deleting, deactivating or re-pairing a channel. On a platform serving many channels and merchants this couples every channel change to a release. Treated as a fundamental design flaw. |
| L2  | Saleor channel state is not reflected: a channel deactivated in the Dashboard stayed reachable as an empty shop (`/pl/channel-pln`, "0 produktów").                                                                                                   |
| L3  | A language shared by several channels always pulled the shopper to the first-listed channel (`getPairedChannelForLocale`), changing currency on a language switch.                                                                                    |
| CH1 | Pairs pointing to non-existent channels were accepted silently; those locales became unreachable.                                                                                                                                                     |
| CH3 | The market (channel) selector was hidden without `SALEOR_APP_TOKEN`.                                                                                                                                                                                  |
| CH5 | `STOREFRONT_CHANNELS` and the matrix were independent lists that could disagree with each other and with Saleor.                                                                                                                                      |

A second issue: the **URL locale doubled as the page language**. A shopper could not read a market's pages in
another language without changing market, and a language list tied to channels conflated translation with
business rules (currency, availability, shipping, legal document language).

## Decision

### 1. Three separate concepts

|                                                          | Owner                  | In URL                                  | Drives                                                                      | A change needs                                 |
| -------------------------------------------------------- | ---------------------- | --------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| **Market locale** — locale↔channel pair                  | **Saleor** (Dashboard) | Yes, `/{locale}/{channel}/…`            | currency, availability, shipping, URL slugs, hreflang                       | Dashboard edit, **no rebuild**                 |
| **Display language** — language pages are rendered in    | **Storefront**         | Only `?lang=` when chosen in the picker | UI strings (next-intl), Saleor content translations, number/date formatting | Storefront rebuild at will, no business impact |
| **Document language** — order / account emails, invoices | **Saleor**             | —                                       | `languageCode` stored on checkout/order and customer account                | Saleor side; compliance rules belong here      |

Order **and account** languages follow the **channel's default locale**, not the shopper's display language, so
legal requirements (e.g. Québec, French documents) are enforceable in Saleor.

### 2. Channels and pairs come from Saleor channel metadata (Phase 1, no Saleor code change)

Public metadata on each channel (Dashboard → Configuration → Channels → channel → `</>`):

| Key                        | Example    | Meaning                                                                                                                                                               |
| -------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storefront.locales`       | `fr,fr-ca` | Market locales paired with the channel. **Presence is the opt-in** — a channel without it never appears on the storefront (keeps B2B, POS, internal channels hidden). |
| `storefront.defaultLocale` | `fr`       | Locale used when entering the channel; also the document language. Defaults to the first locale.                                                                      |
| `storefront.default`       | `true`     | The channel `/` redirects to (one channel).                                                                                                                           |

- A channel is on the storefront when it is **active and lists at least one locale defined in code**.
- `/{locale}/{channel}` is valid only when that channel lists that locale; everything else is not-found. **No
  redirects** for unknown locales or legacy `/{channel}` URLs.
- Keys are trimmed; unknown `storefront.*` keys and unknown locale slugs are reported as warnings.
- Read server-side via the existing `ChannelsList` query (+ `metadata`) with `SALEOR_APP_TOKEN` from a
  **zero-permission app** (listing channels requires `AUTHENTICATED_APP`, no specific permission; channel data
  stays non-public). No `.env` fallback — a missing list fails loudly. In a future tenant layer this becomes the
  tenant token.
- Cached under the `channels` tag. Saleor `CHANNEL_CREATED / UPDATED / DELETED / STATUS_CHANGED /
METADATA_UPDATED` webhooks (separate app with only `MANAGE_CHANNELS`, HMAC secret
  `SALEOR_WEBHOOK_SECRET`) → `/api/revalidate` clears it. Backstop: `channels` cache revalidates every 15 min
  (was 1 day); expiry 1 week so the last list serves if Saleor is down.

Code: `src/lib/channels/storefront-channels.ts` (pure parser), `src/lib/channels/get-storefront-channels.ts`.

### 3. Display language resolution

`?lang=` (explicit picker choice) → browser `Accept-Language`, best match in the storefront's display languages
→ the market locale (or its base language) → storefront default. **No cookie.**

- Resolved once in `middleware.ts` (layouts cannot read query parameters) and passed to layouts and pages as the
  `x-display-language` request header (`getDisplayLanguage()` in `src/lib/display-language-server.ts`).
- The root layout sets `<html lang>` and next-intl messages from it, so client `useTranslations` / `useLocale`
  follow the display language.
- Every Saleor content query passes `channel` + `languageCode = display language`. Translations are global per
  language, not per channel; Saleor stores nothing about the shopper's display choice.
- `/api/listing` (no middleware) receives the display language as `lang=` and validates the market pair against
  Saleor.
- No `Vary: Accept-Language`: storefront HTML is per request and sent `Cache-Control: private, no-store`.

### 4. URL slugs follow the market locale (amends ADR 0004)

Content is fetched in the display language, but **URL slugs stay in the market locale** so a URL is identical for
every viewer, whatever `?lang=` or browser language. Ten GraphQL documents fetch
`marketTranslation: translation(languageCode: $marketLanguageCode) { slug }` alongside the display
`translation`; `pickTranslatedSlug` reads `marketTranslation`. The canonical-slug redirect therefore never depends
on the viewer's language, and the language picker never changes the path — only `?lang=`.

### 5. Storefront pages render per request (amends ADR 0001)

Page prerendering is dropped for `/{locale}/{channel}/…`:

- almost every page depends on the display language, so a prerendered page would hold almost nothing;
- prerendering pulled channel data into the build, contradicting "channels live in Saleor";
- the deployment is self-hosted Docker, so the per-request billing argument behind the upstream (Vercel-oriented)
  prerender design does not apply.

The **data cache stays**: `"use cache"` + tags + webhooks, so per-request rendering does not mean per-request Saleor
calls (measured: product list ~0.02–0.06 s to first byte). `cacheComponents` stays on (required by `"use cache"`).
The root `[locale]` segment keeps one **code-defined** seed (`generateStaticParams` → default locale) because Cache
Components requires a build-time value for every root param; the build reads nothing from Saleor.

### 6. Header layout and carrying `?lang=` (step 5)

Two separate controls, Amazon-style, replacing the combined footer "Language and market" picker:

- **Market selector, left** (next to the logo; `src/ui/components/market-selector.tsx`): Saleor channels
  grouped with their paired market locales (each labelled in its own language). Choosing one changes the URL
  path `/{locale}/{channel}`: same channel → locale switch (slug rewrite); other channel → keeps the path when the
  locale stays the same, else enters that market's home. Below `xl` only the currency shows, to fit the nav.
- **Language picker, right** (before account/cart; `src/ui/components/language-picker.tsx`): storefront display
  languages. Sets `?lang=` on the current URL only — never the path, channel, prices or document language. It
  does a **full page load** on purpose: layouts (`<html lang>`, next-intl messages) persist across client
  navigation, so a soft navigation would leave the chrome in the old language.
- **Mobile:** both controls sit in the mobile menu.

**Carrying `?lang=`** (the choice lives only in the URL — no cookie):

- The middleware also sets `x-display-language-explicit` when `?lang=` is valid; the root layout passes it to an
  `ExplicitDisplayLanguageProvider` context.
- `StorefrontLink` (`src/ui/atoms/storefront-link.tsx`) is a drop-in for `next/link` that appends `?lang=`;
  `LinkWithChannel`, `StorefrontHardLink` and 14 files that imported `next/link` use it.
- Programmatic navigations use `useWithDisplayLanguage()` (components) or `withCurrentDisplayLanguage()` (plain
  client helpers: auth, logout, mega menu, region navigation); server redirects (login, signup, orders, search
  form and page) use `storefrontHrefWithLanguage()`. Pure helper: `withDisplayLanguage()` in
  `src/lib/display-language-link.ts`.
- **Limitation:** `/` does not carry `?lang=`. Reading the request there turns its static 307 into a streamed
  redirect (HTTP 200); internal links never point at `/`, so the choice is not lost in practice.

## Pruned code and configuration

Status after step 5 (header). "Pending" items are scheduled for step 6 (checkout/account language, env, docs). The browse-locale cookie and `DefaultChannelSlug` moved from 4.4 to step 6 because checkout
still depends on them; the hreflang rewrite moved from step 6 into 4.4 because deleting the matrix required it.

| #   | Code / config                                                                                                                                                                                                    | Why it goes                                                                                                                                         | Status                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `generateStaticParams` in `[locale]/[channel]/layout.tsx`; Saleor-derived list in `[locale]/layout.tsx`                                                                                                          | Pages render per request; build must not read Saleor                                                                                                | **Done** — removed; `[locale]` keeps one code seed                                                                                                                                                                               |
| 2   | Middleware channel list and its three redirects (`/{locale}` → default channel, legacy `/{channel}/…`, disabled locale → default)                                                                                | Channels live in Saleor; no redirects by decision                                                                                                   | **Done** — middleware now only resolves the display language                                                                                                                                                                     |
| 3   | `.env` channel lists in the route guard, `/` redirect, `/api/revalidate` and `/api/listing`                                                                                                                      | Replaced by `getStorefrontChannels()`                                                                                                               | **Done**                                                                                                                                                                                                                         |
| 4   | Language-switch slug coupling: URL slug taken from the display translation                                                                                                                                       | Slugs follow the market locale                                                                                                                      | **Done** — `marketTranslation` in 10 queries                                                                                                                                                                                     |
| 5   | `browse-locale` cookie: `src/lib/browse-locale.ts`, `src/lib/browse-locale-server.ts`, `src/ui/components/persist-browse-locale-cookie.tsx`, cookie use in middleware, checkout, order pages, auth and home link | No cookie by decision; checkout/document language = channel default locale                                                                          | Pending (step 6) — moved from 4.4: checkout reads it until step 6 gives checkout its new language source                                                                                                                         |
| 6   | Checkout cookie/referer language resolution in `src/lib/checkout-locale.ts`                                                                                                                                      | Document language = channel default locale; display language via `?lang=` / browser                                                                 | Pending (step 6)                                                                                                                                                                                                                 |
| 7   | `src/config/locale-channel.ts` (`NEXT_PUBLIC_STOREFRONT_LOCALE_CHANNELS`), its tests, the pair check in `scripts/check-locales.mjs`                                                                              | Pairs live in Saleor                                                                                                                                | **Done** (4.4) — file and tests deleted; pair check removed from `check-locales.mjs`                                                                                                                                             |
| 8   | `src/config/channels.ts` and `src/lib/channel-slugs.ts` (`STOREFRONT_CHANNELS`, `STOREFRONT_DISCOVER_CHANNELS`, allowlist helpers); remaining users: footer, cache manifest, hreflang, region picker             | Replaced by `getStorefrontChannels()`; the discovery switch caused more confusion than convenience                                                  | **Done** (4.4) — both deleted; footer, cache manifest (`buildManifest(channels)`), hreflang and picker use Saleor channels                                                                                                       |
| 9   | `DefaultChannelSlug` in `src/app/config.ts` and the Dockerfile `NEXT_PUBLIC_DEFAULT_CHANNEL` default; users: checkout session loader, checkout root views, not-found content                                     | Default channel = `storefront.default` in Saleor                                                                                                    | Pending (step 6) — moved from 4.4: only checkout and the not-found page still use it                                                                                                                                             |
| 10  | `getPairedChannelForLocale` and the "switch market?" prompt on language change (`use-storefront-region-navigation.ts`)                                                                                           | A language change never moves the channel (fixes L3)                                                                                                | **Done** (4.4) — language switch keeps the channel; market switch enters at the target's default locale when the current locale is not paired there                                                                              |
| 11  | Dead UI `src/ui/components/locale-select.tsx` (audit A3) and `src/ui/components/channel-select.tsx`                                                                                                              | Not imported anywhere                                                                                                                               | **Done** (4.4) — both deleted                                                                                                                                                                                                    |
| 12  | Combined `storefront-region-picker.tsx`                                                                                                                                                                          | Replaced by separate market selector and language picker                                                                                            | **Done** (5) — deleted with `src/lib/market-display.ts`; header market selector + language picker replace it                                                                                                                     |
| 13  | hreflang "language-only when no matrix" branch in `src/lib/seo/hreflang.ts`                                                                                                                                      | Pairs always exist; alternates are always region-aware                                                                                              | **Done** (4.4) — pulled forward: hreflang and `og:locale:alternate` built from Saleor pairs; `buildBrowsePageMetadata` is async                                                                                                  |
| 14  | `NEXT_PUBLIC_STOREFRONT_LOCALES` / `NEXT_PUBLIC_DEFAULT_LOCALE` as a URL allowlist                                                                                                                               | Becomes a server-only display-language list (`STOREFRONT_DISPLAY_LANGUAGES`); URL locales are validated against `LOCALE_DEFINITIONS` + Saleor pairs | Pending (step 6)                                                                                                                                                                                                                 |
| 15  | Env removed after Phase 1: `STOREFRONT_CHANNELS`, `STOREFRONT_DISCOVER_CHANNELS`, `NEXT_PUBLIC_STOREFRONT_LOCALE_CHANNELS`, `NEXT_PUBLIC_DEFAULT_CHANNEL`                                                        | Channel data is Saleor's                                                                                                                            | Partly done (4.4) — `STOREFRONT_CHANNELS`, `STOREFRONT_DISCOVER_CHANNELS`, `NEXT_PUBLIC_STOREFRONT_LOCALE_CHANNELS` no longer read and removed from `.env.example`; `NEXT_PUBLIC_DEFAULT_CHANNEL` kept for checkout until step 6 |

**Kept on purpose:** the data cache + tags + webhooks; `cacheComponents`; `LOCALE_DEFINITIONS` and message bundles
(the ceiling of what the code can display); translated slugs (now keyed by market locale); `cart-channel-cookie`
(commerce state per channel, not language); upstream PPR tooling (`check:ppr-resume`, instant-navigation e2e).

## Phase 2 (proposed): proper fields in Saleor + Dashboard

Requires forking Saleor and the Dashboard; candidate for an upstream PR.

- Saleor `Channel` fields `storefrontLocales` (`[LanguageCodeEnum]`), `defaultLocale`, `isStorefrontVisible`;
  migration, GraphQL type fields, `channelCreate`/`channelUpdate` inputs, validation (default ∈ list), editing
  requires `MANAGE_CHANNELS`, included in channel webhook payloads. Channel data stays non-public (token kept).
- Dashboard: "Storefront" section on the channel page (locale multi-select, default locale, visibility toggle)
  replacing free-text metadata keys.
- Storefront: only `get-storefront-channels.ts` changes (metadata → fields), with the metadata reader kept for one
  release and a one-off copy script.
- Later: `requiredDocumentLanguage` per channel for order and account documents.

## Alternatives considered

| Alternative                                                                | Why rejected                                                                                                                                                          |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep the `.env` matrix (`NEXT_PUBLIC_STOREFRONT_LOCALE_CHANNELS`)          | L1–L3, CH1, CH5: rebuild per channel change, drifts from Saleor.                                                                                                      |
| `STOREFRONT_DISCOVER_CHANNELS` (runtime channel discovery)                 | Only replaced the channel list; the matrix and routing still needed a rebuild. A second mode added confusion. Removed.                                                |
| Show every active Saleor channel                                           | Exposes B2B/POS/internal channels and other merchants' channels — the one real job of the `.env` allowlist. Replaced by the explicit `storefront.locales` opt-in.     |
| Keep prerendering via a hidden `[lang]` route segment + middleware rewrite | Preserves static shells but moves ~34 route files, multiplies prerendered pages by the number of display languages, and keeps channel data in the build.              |
| Read `?lang=` / `Accept-Language` only in pages                            | Layouts (`<html lang>`, next-intl provider) cannot read query params → mixed-language pages.                                                                          |
| Display language in a cookie                                               | Rejected by decision: hidden state; an explicit choice lives only in the URL (`?lang=`).                                                                              |
| URL slugs follow the display language                                      | Same product gets a different URL per viewer; canonical redirect would depend on browser language.                                                                    |
| Always use Saleor's primary (untranslated) slug                            | Drops ADR 0004's translated-slug SEO feature.                                                                                                                         |
| Make channel list and names public in Saleor                               | Rejected: channel data must not be public; a zero-permission token is required (future tenant token).                                                                 |
| Tenant layer (tenant → merchants → channels → storefronts)                 | Needed for a full B2B2C multi-tenant stack (Saleor is single-tenant per instance); documented but **out of scope** — this work stays focused on internationalization. |

## Consequences

### Positive

- Adding, deleting, deactivating or re-pairing a channel is a Dashboard edit; the storefront picks it up within
  seconds via webhook (verified live 2026-10-31: `/en/channel-fr` went from not-found to an English EUR page with
  no rebuild).
- Inactive or unknown channels return not-found instead of an empty shop (CH2 fixed).
- Shoppers can read any market in any supported display language without changing currency or URL.
- Document language is decided in Saleor, where compliance can be enforced.
- The build no longer depends on Saleor; 55 prerendered entries instead of 295–1,335.

### Negative / costs

- Pages render per request: more server CPU, slower first byte than prerendered HTML (mitigated by the data cache).
- The first request after a channel change is served from the old cache entry; the second sees the change.
- Diverges from upstream Paper's prerender architecture → harder upstream merges.
- The storefront needs a zero-permission app token and a separate webhook app with `MANAGE_CHANNELS`.
- Free-text metadata keys are error-prone until Phase 2 (mitigated: key trimming + warnings).
- Search engines see one display language per URL (the market's, or the crawler's); alternate display languages are
  not indexed.

### Open

- Soft 404 (audit A6): not-found pages still return HTTP 200; check whether per-request rendering allows a real 404.
- IP geolocation as a first-entry channel suggestion (suggest only, never force — EU Geo-blocking Regulation
  2018/302; never redirect deep links).
- SEO treatment of `?lang=` URLs (self-canonical vs canonical to the URL without `?lang=`).

## References

- Audit notes and live test results: `saleor-platform/channel-locale-findings.md` (outside this repo).
- Next.js 16 docs bundled in `node_modules/next/dist/docs/`: `migrating-to-cache-components.md`
  (`generateStaticParams` must return at least one param), `next-root-params.md` (root params need a build-time
  value), `route-segment-config/instant.md`.
