# Québec French-documents demo (ADR 0008)

End-to-end demo of the rule from [ADR 0008](../../docs/adr/0008-saleor-owned-channels-and-display-language.md):
**the shopper chooses the language they read; the market decides the language of the documents.**

A shopper browses a Québec channel **in English** (`?lang=en`). Because the channel's default locale is
`fr-ca`, Saleor stores the order as `fr-ca` — and the order confirmation email, the invoice and the invoice
email all come out **in French**.

> LOCAL DEV ONLY. Requires the Phase 2 Saleor fork (`huiliking/saleor`, branch `channel-storefront-fields`),
> which adds the channel `default_locale` and enforces it on checkouts and orders.

## What's here

| Path                      | Purpose                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invoice-app/`            | Small Python (Flask) app: on `INVOICE_REQUESTED` it reads the order back from Saleor and renders an HTML invoice in the **order's stored language**, then calls `invoiceUpdate`. Saleor 3.23 has no built-in invoice generator. |
| `docker-compose.demo.yml` | `mailpit` (catches Saleor's emails, UI at http://localhost:8025) and `invoice-app` (http://localhost:8001).                                                                                                                     |
| `email-templates/`        | French templates and subjects for Saleor's built-in **User emails** plugin (order confirmation, invoice ready).                                                                                                                 |

## Setup

1. **Services** — add the two services from `docker-compose.demo.yml` to the platform compose file (or run
   it as an extra `-f` file). Copy `invoice-app/.env.example` to `invoice-app/.env` (never commit it).
2. **Channel** (Dashboard → Configuration → Channels → create): e.g. _Channel-CAN-Quebec_, currency **CAD**,
   country **Canada**. On its **Storefront** card: visible, locales `fr-ca, en`, default locale **`fr-ca`**.
3. **Shipping / stock** — a shipping zone covering Canada with a price-based rate in the channel; a
   warehouse assigned to the channel; a product listed in the channel with a CAD price and stock.
4. **French (Canada) product translation** — Dashboard → Translations → French (Canada), or
   `productTranslate(languageCode: FR_CA)`. Without it, order lines keep the base-language name.
5. **Invoice app** (Dashboard → Extensions → add manually): permission **Manage orders**, create a token →
   `SALEOR_APP_TOKEN` in `invoice-app/.env`. Add a webhook:
   - target `http://invoice-app:8000/webhooks/invoice-requested`, async event **Invoice requested**
   - secret key (≥32 random chars) → `INVOICE_WEBHOOK_SECRET` in `invoice-app/.env`
   - subscription query:
     ```graphql
     subscription {
     	event {
     		... on InvoiceRequested {
     			invoice {
     				id
     			}
     			order {
     				id
     			}
     		}
     	}
     }
     ```
6. **French emails** — Dashboard → Configuration → Plugins → **User emails** → select the Québec channel:
   active; SMTP host `mailpit`, port `1025`, no TLS/SSL; sender name/address; paste the templates and
   subjects from `email-templates/` into _Order confirmation_ and _Invoice ready_.

## Run the demo

1. Browse `http://localhost:3000/fr-ca/<quebec-channel>/products/<slug>?lang=en` — pages are in English.
2. Check out with a Québec address (any test payment gateway).
3. Mailpit shows **"Confirmation de votre commande n° …"** in French.
4. Dashboard → the order → **Generate invoice** → the invoice app renders it in French
   (`http://localhost:8001/invoices/<number>.html`: _Facture, Jus de pomme, Total à payer 80,00 $_).
5. **Send invoice** → Mailpit shows **"Votre facture n° …"** with the download link.

## Known limitations

- Saleor's email `price` helper formats with the server language, so emails show `CA$80.00` inside French
  text (the invoice app formats `80,00 $` correctly).
- Only the confirmation and invoice templates are translated here; a real rollout translates every template
  on the channel (payment, fulfillment, refund, account emails).
- One channel = one market: this makes documents French for every customer of that channel. A rule based on
  the billing province (QC) would need new Saleor code.
- Taxes (GST/QST) are not configured in this demo.
