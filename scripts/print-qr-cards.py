#!/usr/bin/env python3
"""Generate printable SalehinSc QR cards offline from a private CSV.

CSV columns: name,id,key
- id: 64 lowercase/uppercase hex characters
- key: Base64URL text containing the 32-byte account root key

The key is embedded only in the QR URL fragment. This script does not use a
network connection and does not upload the CSV or generated codes anywhere.
"""
from __future__ import annotations

import argparse
import csv
import html
import re
from pathlib import Path

import qrcode
from qrcode.image.svg import SvgPathImage

ID_RE = re.compile(r"^[a-fA-F0-9]{64}$")
KEY_RE = re.compile(r"^[A-Za-z0-9_-]{43}$")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", type=Path, help="Private CSV with name,id,key columns")
    parser.add_argument("--base-url", required=True, help="Published app URL, e.g. https://owner.github.io/SalehinSc/")
    parser.add_argument("--out", type=Path, default=Path("salehinsc-qr-cards"), help="Output directory")
    args = parser.parse_args()

    base_url = args.base_url.strip()
    if not base_url.startswith("https://") or "#" in base_url or "?" in base_url:
        parser.error("--base-url must be the HTTPS application URL without a query or fragment")
    base_url = base_url.rstrip("/") + "/"

    args.out.mkdir(parents=True, exist_ok=True)
    cards: list[tuple[str, str]] = []
    used_names: set[str] = set()
    with args.csv_file.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        expected = {"name", "id", "key"}
        if not expected.issubset(set(reader.fieldnames or [])):
            parser.error("CSV must include name,id,key columns")
        for row_number, row in enumerate(reader, start=2):
            name = (row.get("name") or "").strip()
            student_id = (row.get("id") or "").strip()
            key = (row.get("key") or "").strip()
            if not name or not ID_RE.fullmatch(student_id) or not KEY_RE.fullmatch(key):
                parser.error(f"Invalid or missing name/id/key on CSV row {row_number}")
            safe_name = re.sub(r"[^A-Za-z0-9_-]+", "-", student_id.lower()).strip("-")
            if safe_name in used_names:
                parser.error(f"Duplicate student ID on CSV row {row_number}")
            used_names.add(safe_name)
            url = f"{base_url}#s={student_id.lower()}&k={key}"
            qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=8, border=4)
            qr.add_data(url)
            qr.make(fit=True)
            qr.make_image(image_factory=SvgPathImage).save(args.out / f"{safe_name}.svg")
            cards.append((name, f"{safe_name}.svg"))

    if not cards:
        parser.error("CSV contains no QR rows")

    card_html = "\n".join(
        f'<article class="card"><img src="{html.escape(filename)}" alt="QR code for {html.escape(name)}"><h2>{html.escape(name)}</h2><p>سامانه صالحین</p></article>'
        for name, filename in cards
    )
    document = f'''<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>کارت‌های QR صالحین</title><style>
*{{box-sizing:border-box}}body{{margin:0;padding:24px;background:#f4f3ee;color:#26352e;font-family:Tahoma,Arial,sans-serif}}
main{{max-width:1000px;margin:auto}}header{{margin:0 0 20px}}h1{{font-size:22px;margin:0 0 6px}}header p{{color:#66736b;font-size:13px;margin:0}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}}.card{{break-inside:avoid;text-align:center;background:#fffefa;border:1px solid #e1e3dc;border-radius:10px;padding:16px}}
.card img{{display:block;width:100%;max-width:170px;height:auto;margin:0 auto 10px}}.card h2{{font-size:16px;margin:4px 0}}.card p{{color:#718078;font-size:11px;margin:0}}
@media print{{body{{padding:0;background:white}}header{{margin:0 0 12px}}.grid{{grid-template-columns:repeat(3,1fr);gap:8px}}.card{{border:1px solid #bbb;border-radius:0;padding:8px}}.card img{{max-width:135px}}}}
</style></head><body><main><header><h1>کارت دسترسی سامانه صالحین</h1><p>هر کارت فقط برای صاحب آن است. کارت‌ها را خصوصی تحویل دهید.</p></header><section class="grid">{card_html}</section></main></body></html>'''
    (args.out / "print.html").write_text(document, encoding="utf-8")
    print(f"Created {len(cards)} QR card(s) in: {args.out.resolve()}")
    print(f"Open {(args.out / 'print.html').resolve()} and print. Keep this folder private; the QR images contain access secrets.")


if __name__ == "__main__":
    main()
