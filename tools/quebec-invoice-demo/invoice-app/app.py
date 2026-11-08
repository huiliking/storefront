"""Local invoice generator for the Québec French-documents test (ADR 0008).

Saleor fires INVOICE_REQUESTED when someone clicks "Generate invoice" on an order. This app:
  1. verifies the webhook (HMAC-SHA256, secret = the webhook's "secret key" in the Dashboard),
  2. reads the order back from Saleor with its app token (stored language, translated line names),
  3. renders an HTML invoice in the ORDER's language — not the shopper's browsing language,
  4. calls invoiceUpdate with a number + URL, which marks the invoice as succeeded in Saleor.

LOCAL DEV ONLY. Secrets come from the environment (invoice-app/.env), never from code.
"""

import hashlib
import hmac
import html
import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path

import requests
from babel.dates import format_date
from babel.numbers import format_currency
from flask import Flask, abort, request, send_from_directory

SALEOR_API_URL = os.environ.get("SALEOR_API_URL", "http://api:8000/graphql/")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8001").rstrip("/")
APP_TOKEN = os.environ.get("SALEOR_APP_TOKEN", "")
WEBHOOK_SECRET = os.environ.get("INVOICE_WEBHOOK_SECRET", "")
INVOICE_DIR = Path(os.environ.get("INVOICE_DIR", "/data/invoices"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("invoice-app")
app = Flask(__name__)

# Invoice labels per base language. Unknown languages fall back to English.
LABELS = {
    "fr": {
        "title": "Facture",
        "invoice_no": "N° de facture",
        "order_no": "Commande",
        "date": "Date",
        "bill_to": "Facturé à",
        "item": "Article",
        "qty": "Qté",
        "unit": "Prix unitaire",
        "line_total": "Total",
        "subtotal": "Sous-total",
        "shipping": "Livraison",
        "taxes": "Taxes",
        "total": "Total à payer",
        "language": "Langue du document",
        "thanks": "Merci de votre achat.",
    },
    "en": {
        "title": "Invoice",
        "invoice_no": "Invoice no.",
        "order_no": "Order",
        "date": "Date",
        "bill_to": "Bill to",
        "item": "Item",
        "qty": "Qty",
        "unit": "Unit price",
        "line_total": "Total",
        "subtotal": "Subtotal",
        "shipping": "Shipping",
        "taxes": "Taxes",
        "total": "Total due",
        "language": "Document language",
        "thanks": "Thank you for your purchase.",
    },
}

ORDER_QUERY = """
query InvoiceOrder($id: ID!) {
  order(id: $id) {
    id
    number
    created
    languageCodeEnum
    userEmail
    channel { slug name }
    billingAddress {
      firstName lastName companyName streetAddress1 streetAddress2
      city postalCode countryArea country { code country }
    }
    lines {
      productName translatedProductName variantName translatedVariantName quantity
      unitPrice { gross { amount currency } }
      totalPrice { gross { amount currency } }
    }
    subtotal { gross { amount currency } }
    shippingPrice { gross { amount currency } }
    total { gross { amount currency } tax { amount currency } }
  }
}
"""

INVOICE_UPDATE = """
mutation InvoiceUpdate($id: ID!, $number: String!, $url: String!) {
  invoiceUpdate(id: $id, input: { number: $number, url: $url }) {
    invoice { id number url status }
    errors { field message code }
  }
}
"""


def saleor(query: str, variables: dict) -> dict:
    response = requests.post(
        SALEOR_API_URL,
        json={"query": query, "variables": variables},
        headers={"Authorization": f"Bearer {APP_TOKEN}"},
        timeout=30,
    )
    response.raise_for_status()
    body = response.json()
    if body.get("errors"):
        raise RuntimeError(f"GraphQL errors: {body['errors']}")
    return body["data"]


def language_tag(language_code_enum: str) -> str:
    """Saleor enum (FR_CA) → language tag (fr-ca)."""
    return (language_code_enum or "EN").lower().replace("_", "-")


def babel_locale(tag: str) -> str:
    parts = tag.split("-")
    return parts[0] if len(parts) == 1 else f"{parts[0]}_{parts[1].upper()}"


def money(value: dict, locale: str) -> str:
    return format_currency(value["amount"], value["currency"], locale=locale)


def render_invoice(order: dict, number: str) -> str:
    tag = language_tag(order["languageCodeEnum"])
    labels = LABELS.get(tag.split("-")[0], LABELS["en"])
    locale = babel_locale(tag)
    esc = html.escape

    created = datetime.fromisoformat(order["created"].replace("Z", "+00:00"))
    address = order.get("billingAddress") or {}
    address_lines = [
        f"{address.get('firstName', '')} {address.get('lastName', '')}".strip(),
        address.get("companyName") or "",
        address.get("streetAddress1") or "",
        address.get("streetAddress2") or "",
        " ".join(p for p in [address.get("city"), address.get("countryArea"), address.get("postalCode")] if p),
        (address.get("country") or {}).get("country", ""),
    ]

    rows = []
    for line in order["lines"]:
        name = line.get("translatedProductName") or line["productName"]
        variant = line.get("translatedVariantName") or line.get("variantName") or ""
        # Unnamed variants come back as their global ID (base64 "ProductVariant:…") — not for print.
        if re.fullmatch(r"[A-Za-z0-9+/=]{16,}", variant or "") and variant.startswith("UHJvZHVjdFZhcmlhbnQ"):
            variant = ""
        label = f"{name} — {variant}" if variant and variant != name else name
        rows.append(
            f"<tr><td>{esc(label)}</td><td class=n>{line['quantity']}</td>"
            f"<td class=n>{esc(money(line['unitPrice']['gross'], locale))}</td>"
            f"<td class=n>{esc(money(line['totalPrice']['gross'], locale))}</td></tr>"
        )

    return f"""<!doctype html>
<html lang="{esc(tag)}"><head><meta charset="utf-8"><title>{esc(labels['title'])} {esc(number)}</title>
<style>
 body {{ font-family: system-ui, sans-serif; max-width: 760px; margin: 40px auto; color: #111; }}
 h1 {{ margin-bottom: 4px; }} .meta {{ color: #555; margin-bottom: 24px; }}
 table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
 th, td {{ border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }} .n {{ text-align: right; }}
 .totals td {{ border: none; }} .grand td {{ font-weight: 700; border-top: 2px solid #111; }}
 .lang {{ margin-top: 28px; font-size: 12px; color: #777; }}
</style></head><body>
<h1>{esc(labels['title'])}</h1>
<div class="meta">{esc(labels['invoice_no'])} {esc(number)} · {esc(labels['order_no'])} #{esc(order['number'])} ·
 {esc(labels['date'])} {esc(format_date(created, format='long', locale=locale))} · {esc(order['channel']['name'])}</div>
<strong>{esc(labels['bill_to'])}</strong><br>{'<br>'.join(esc(l) for l in address_lines if l)}<br>{esc(order.get('userEmail') or '')}
<table>
 <tr><th>{esc(labels['item'])}</th><th class=n>{esc(labels['qty'])}</th><th class=n>{esc(labels['unit'])}</th><th class=n>{esc(labels['line_total'])}</th></tr>
 {''.join(rows)}
</table>
<table class="totals">
 <tr><td>{esc(labels['subtotal'])}</td><td class=n>{esc(money(order['subtotal']['gross'], locale))}</td></tr>
 <tr><td>{esc(labels['shipping'])}</td><td class=n>{esc(money(order['shippingPrice']['gross'], locale))}</td></tr>
 <tr><td>{esc(labels['taxes'])}</td><td class=n>{esc(money(order['total']['tax'], locale))}</td></tr>
 <tr class="grand"><td>{esc(labels['total'])}</td><td class=n>{esc(money(order['total']['gross'], locale))}</td></tr>
</table>
<p>{esc(labels['thanks'])}</p>
<p class="lang">{esc(labels['language'])}: {esc(tag)} (order.languageCode)</p>
</body></html>"""


def verify_signature(body: bytes) -> bool:
    if not WEBHOOK_SECRET:
        log.warning("INVOICE_WEBHOOK_SECRET not set — accepting unsigned webhook (local dev only)")
        return True
    expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, request.headers.get("Saleor-Signature", ""))


@app.post("/webhooks/invoice-requested")
def invoice_requested():
    body = request.get_data()
    if not verify_signature(body):
        abort(401)

    payload = json.loads(body)
    if isinstance(payload, list):
        # Legacy payload: [{"id": <invoice>, "order": {"id": ...}, ...}]
        invoice_id = payload[0]["id"]
        order_id = payload[0]["order"]["id"]
    else:
        # Subscription payload: {"invoice": {"id"}, "order": {"id"}} (optionally under "data"/"event")
        event = payload.get("data", payload)
        event = event.get("event", event)
        invoice_id = event["invoice"]["id"]
        order_id = event["order"]["id"]

    order = saleor(ORDER_QUERY, {"id": order_id})["order"]
    if order is None:
        log.error("Order %s not readable with this app token", order_id)
        abort(422)

    # channel-ca → CA, default-channel → DEFAULT
    slug = order["channel"]["slug"].removeprefix("channel-").removesuffix("-channel")
    prefix = re.sub(r"[^A-Z0-9]", "", slug.upper())[:8] or "INV"
    number = f"{prefix}-{order['number']}"
    INVOICE_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{number}.html"
    (INVOICE_DIR / filename).write_text(render_invoice(order, number), encoding="utf-8")

    result = saleor(INVOICE_UPDATE, {"id": invoice_id, "number": number, "url": f"{PUBLIC_BASE_URL}/invoices/{filename}"})
    errors = result["invoiceUpdate"]["errors"]
    if errors:
        log.error("invoiceUpdate failed: %s", errors)
        abort(500)

    log.info("Invoice %s for order #%s rendered in %s", number, order["number"], order["languageCodeEnum"])
    return {"ok": True, "number": number}


@app.get("/invoices/<path:name>")
def get_invoice(name: str):
    return send_from_directory(INVOICE_DIR, name)


@app.get("/health")
def health():
    return {"ok": True, "token_configured": bool(APP_TOKEN), "signed_webhooks": bool(WEBHOOK_SECRET)}
