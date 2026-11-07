---
name: ui-channels
description: Channels & multi-currency: channels and locale pairs from Saleor channel metadata (ADR 0008), the purchasability/fulfillment model, header market selector. Use when configuring channels or debugging 'product not purchasable'.
---

# Channels & Multi-Currency

Configure multi-channel and multi-currency support. This storefront supports multiple Saleor channels, each with its own currency. Understanding the underlying fulfillment model helps debug "product not purchasable" issues.

> **Source**: [Saleor Docs - Stock Overview](https://docs.saleor.io/developer/stock/overview) - Fulfillment triangle and stock allocation

## How Channels Work

```
URL: /en/uk/products/...  →  market locale "en", channel "uk" (GBP)
URL: /fr-ca/ca/products/... →  market locale "fr-ca", channel "ca" (CAD)
```

- Channels and their locale pairs are managed in Saleor (channel metadata) — see ADR 0008
- Currency comes from the channel settings in Saleor
- The market selector sits in the header, left of the nav (channel + market locale)
- Checkout inherits the channel from where the cart was created
- Blank checkout address forms use the channel’s **default country** (`channel.defaultCountry`, via `SALEOR_APP_TOKEN` / `ChannelsList`) when that country is shippable — not the first alphabetically listed country

## Saleor Commerce Model

Channels don't exist in isolation. Product purchasability depends on three connected entities:

```
        CHANNEL                 SHIPPING ZONE              WAREHOUSE
     (sales storefront)       (delivery region)         (inventory location)
            │                        │                        │
            ├────── assigned to ─────┤                        │
            │                        ├──── fulfills from ─────┤
            ├──────────── assigned to ────────────────────────┤
```

**All three connections must exist for a product to be purchasable.**

### Purchasability Checklist

When debugging why a product can't be purchased in a channel, verify all 7 conditions:

1. Product is **published** in the channel
2. Product is **available for purchase** in the channel
3. At least one variant has a **price** in the channel
4. Channel has at least one active **shipping zone**
5. That shipping zone has at least one **warehouse**
6. That warehouse has **stock** for the variant
7. That warehouse is also **assigned to the channel**

### Unreachable Stock

A warehouse assigned to a channel but **not** to any shipping zone for that channel results in "unreachable" stock -- it exists in the system but customers cannot buy it. This is the most common cause of confusing `isAvailable: false` on products that appear to have inventory.

### Why Products Differ Across Channels

The same product can be purchasable in one channel and not another because:

- **Different warehouses** are assigned to each channel
- **Different shipping zones** cover different countries per channel
- **Stock levels** vary per warehouse
- **Pricing** may only be set in certain channels

## Channels come from Saleor (ADR 0008)

There is **no `.env` channel list** and no build-time channel data. The storefront reads Saleor's channel
list at runtime (`getStorefrontChannels()`, `src/lib/channels/get-storefront-channels.ts`) and exposes a channel
only when it is **active** and lists market locales in its public metadata
(Dashboard → Configuration → Channels → channel → `</>`):

| Key                        | Example    | Meaning                                                                               |
| -------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `storefront.locales`       | `fr,fr-ca` | Market locales paired with the channel. **Opt-in**: without it the channel is hidden. |
| `storefront.defaultLocale` | `fr`       | Locale used when entering the channel; also the order/account document language.      |
| `storefront.default`       | `true`     | The channel `/` redirects to (one channel).                                           |

Keys are trimmed; unknown `storefront.*` keys and unknown locale slugs are logged as `[Channels]` warnings.

### App token (required)

```env
# .env.local (keep secret, never commit)
SALEOR_APP_TOKEN=your-app-token
```

Listing channels needs `AUTHENTICATED_APP` only — create a **zero-permission** app (Dashboard → Extensions →
Add extension → "Provide details manually"), then a token. Server-side only, never `NEXT_PUBLIC_`. Without it the
storefront fails loudly (no fallback list).

### Changes without a rebuild

Channel data is cached under the `channels` tag (15-minute backstop). Create a **separate** app with only
`MANAGE_CHANNELS` and a webhook to `/api/revalidate` for `CHANNEL_CREATED / UPDATED / DELETED / STATUS_CHANGED /
METADATA_UPDATED` with a secret key = `SALEOR_WEBHOOK_SECRET`. A Dashboard edit is then live on the next request.

### Where channels are enforced

| Location                                             | Behavior                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/app/(storefront)/[locale]/[channel]/layout.tsx` | `notFound()` unless Saleor pairs the locale with the channel            |
| `src/app/(root)/page.tsx`                            | `/` → `storefront.default` channel in its default locale                |
| `src/app/api/revalidate/route.ts`                    | `CHANNEL_*` clears the list; menu/page/product invalidation per channel |
| `src/ui/components/market-selector.tsx`              | Header market selector (channels × market locales)                      |
| `src/lib/seo/hreflang.ts`                            | hreflang alternates = Saleor pairs                                      |

See `data-caching.md` for how webhooks use the channel list during invalidation.

## Architecture

### Storefront (channel in URL)

```
src/app/[channel]/          # All routes are channel-scoped
src/app/[channel]/(main)/   # Main store pages
```

Channel is read from URL params and passed to GraphQL queries.

### Checkout (channel from checkout object)

```
src/app/checkout/           # NOT under [channel]
```

Checkout gets channel from `checkout.channel.slug` (set when cart was created).

### Market selector

```
src/ui/components/market-selector.tsx                         # Header, left: channel + market locale
src/app/(storefront)/[locale]/[channel]/(main)/browse-chrome-slots.tsx  # HeaderMarketSlot (Saleor data)
```

The display language is a separate control (`language-picker.tsx`, header right, `?lang=`) — see
`ui-locale-routing.md`.

## Key Files

| File                                                 | Purpose                                             |
| ---------------------------------------------------- | --------------------------------------------------- |
| `src/lib/channels/storefront-channels.ts`            | Metadata parser (`storefront.*` keys), pair helpers |
| `src/lib/channels/get-storefront-channels.ts`        | `getStorefrontChannels()` — cached Saleor read      |
| `src/lib/channels/document-language.ts`              | Channel default locale → order/account language     |
| `src/app/(storefront)/[locale]/[channel]/layout.tsx` | Route guard                                         |
| `src/ui/components/market-selector.tsx`              | Market selector                                     |
| `src/graphql/ChannelsList.graphql`                   | Channel list + metadata                             |

## Locale & routing

**Browse URLs:** `/{locale}/{channel}/…` where `{locale}` is the **market locale** paired with the channel in Saleor.
Page text follows the **display language** (`?lang=` → browser → market locale), set by
`NEXT_PUBLIC_STOREFRONT_DISPLAY_LANGUAGES`. No redirects for unknown pairs or legacy `/{channel}/…` URLs. See
`docs/adr/0008-saleor-owned-channels-and-display-language.md` and `ui-locale-routing.md`.

## Anti-patterns

❌ **Don't expose every Saleor channel** — Only channels with `storefront.locales` metadata appear (keeps B2B/POS channels hidden)  
❌ **Don't assume stock means purchasable** — Warehouse must be in both the channel AND a shipping zone for that channel
❌ **Don't debug availability client-side only** - Check the 7-point purchasability checklist in Saleor Dashboard first
❌ **Don't hardcode channel slugs or keep channel lists in `.env`** - Read them from `getStorefrontChannels()`
