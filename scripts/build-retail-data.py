"""Build the website's public daily dataset from UCI's original Online Retail.xlsx.

Usage: python scripts/build-retail-data.py "path/to/Online Retail.xlsx"
Requires openpyxl for read-only source extraction. No source identifiers are exported.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import openpyxl

SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.runtime/Online Retail.xlsx')
DEST = Path(__file__).resolve().parents[1] / 'samples'
START, END = date(2011, 1, 1), date(2011, 11, 30)
NON_MERCHANDISE = {'POST', 'DOT', 'M', 'D', 'C2', 'BANK CHARGES', 'AMAZONFEE', 'CRUK'}


def build():
    workbook = openpyxl.load_workbook(SOURCE, read_only=True, data_only=True)
    records = iter(workbook.active.values)
    assert next(records) == ('InvoiceNo', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'UnitPrice', 'CustomerID', 'Country')
    daily = defaultdict(lambda: {'pence': 0, 'invoices': set(), 'customers': set(), 'lines': 0})
    country_pence = Counter()
    all_customers, all_invoices = set(), set()
    excluded = Counter()
    source_rows = eligible_rows = missing_customer_lines = 0
    for invoice, stock, description, quantity, invoice_date, price, customer, country in records:
        source_rows += 1
        if not hasattr(invoice_date, 'date') or not START <= invoice_date.date() <= END:
            excluded['outside_selected_calendar_window'] += 1
            continue
        if str(invoice).upper().startswith('C'):
            excluded['cancelled_invoice'] += 1
            continue
        if not quantity or not price or quantity <= 0 or price <= 0:
            excluded['non_positive_quantity_or_price'] += 1
            continue
        if str(stock).upper() in NON_MERCHANDISE or str(stock).lower().startswith('gift_'):
            excluded['non_merchandise_adjustment_or_voucher'] += 1
            continue
        amount = int((Decimal(str(quantity)) * Decimal(str(price)) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        day = daily[invoice_date.date()]
        day['pence'] += amount
        day['invoices'].add(str(invoice))
        day['lines'] += 1
        all_invoices.add(str(invoice))
        if customer is not None:
            day['customers'].add(str(customer))
            all_customers.add(str(customer))
        else:
            missing_customer_lines += 1
        country_pence[str(country or 'Not recorded')] += amount
        eligible_rows += 1
    workbook.close()

    rows, zero_days = [], []
    current = START
    while current <= END:
        day = daily[current]
        rows.append({'date': current.isoformat(), 'sales': day['pence'] / 100,
                     'category': 'All merchandise', 'orders': len(day['invoices']),
                     'customers': len(day['customers']), 'transactionLines': day['lines']})
        if not day['lines']:
            zero_days.append(current.isoformat())
        current += timedelta(days=1)

    total_pence = sum(item['pence'] for item in daily.values())
    assert total_pence == sum(country_pence.values())
    assert source_rows == eligible_rows + sum(excluded.values())
    assert sum(row['transactionLines'] for row in rows) == eligible_rows
    assert sum(round(row['sales'] * 100) for row in rows) == total_pence

    payload = {
        'name': 'UCI Online Retail', 'description': 'Historical merchandise sales from a UK-based online retailer',
        'currency': 'GBP', 'dateStart': START.isoformat(), 'dateEnd': END.isoformat(),
        'sourceUrl': 'https://archive.ics.uci.edu/dataset/352/online+retail',
        'downloadUrl': 'https://archive.ics.uci.edu/ml/machine-learning-databases/00352/Online%20Retail.xlsx',
        'doi': 'https://doi.org/10.24432/C5BW33', 'license': 'CC BY 4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
        'citation': 'Chen, D. (2015). Online Retail [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5BW33.',
        'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'sourceRows': source_rows, 'transactionCount': eligible_rows, 'orderCount': len(all_invoices),
        'uniqueCustomers': len(all_customers), 'missingCustomerLines': missing_customer_lines,
        'totalSales': total_pence / 100, 'totalSalesPence': total_pence,
        'categoryTotals': [{'name': name, 'sales': pence / 100} for name, pence in country_pence.most_common()],
        'countryTotals': [{'name': name, 'sales': pence / 100} for name, pence in country_pence.most_common()],
        'zeroRecordedSalesDays': zero_days, 'exclusions': dict(excluded),
        'methodology': [
            'Complete calendar months January to November 2011, inclusive. December 2011 is excluded because the source ends on December 9.',
            'Gross merchandise sales, not net revenue: positive quantity times positive unit price; cancellation invoices beginning C are excluded.',
            'Postage, carriage, manual entries, discounts, bank charges, Amazon fees, charity adjustments and gift vouchers are excluded using the documented stock-code rules.',
            'Each qualifying transaction line is rounded to integer GBP pence using half-up rounding before daily and country aggregation.',
            'Every calendar day is represented. Zero means no qualifying sales were recorded in the source on that date, not independently verified trading closure.',
            'Orders count distinct invoice numbers. Customers count distinct recorded customer IDs; missing customer IDs do not exclude valid sales.',
            'Country totals refer to customer destination country. Product categories are not supplied by the source; no product category is inferred.',
            'Forecasts derived from this historical series are retrospective model projections, not current retail sales or a live business outlook.'
        ],
        'rows': rows,
    }
    DEST.mkdir(exist_ok=True)
    serialized = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    (DEST / 'uci-retail.json').write_text(serialized + '\n', encoding='utf-8')
    (DEST / 'uci-retail.js').write_text('globalThis.ForecastIQPublicData=' + serialized + ';\n', encoding='utf-8')
    with (DEST / 'uci-retail-daily.csv').open('w', newline='', encoding='utf-8') as handle:
        writer = csv.writer(handle)
        writer.writerow(['date', 'sales', 'category'])
        writer.writerows((r['date'], f"{r['sales']:.2f}", r['category']) for r in rows)
    print(json.dumps({key: payload[key] for key in ['sourceRows', 'transactionCount', 'orderCount', 'uniqueCustomers', 'missingCustomerLines', 'totalSales', 'sourceSha256']}))
    print(f"Calendar days: {len(rows)}, days without qualifying source records: {len(zero_days)}, destination countries: {len(country_pence)}")


if __name__ == '__main__':
    build()
