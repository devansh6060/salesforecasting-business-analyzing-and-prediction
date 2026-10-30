# UCI Online Retail sales data

The default public dataset is a derived daily sales series from **Chen, D. (2015), Online Retail**, UCI Machine Learning Repository. The original workbook contains 541,909 transaction lines from a UK-based online retailer. The original data covers December 2010 to December 9, 2011.

- Dataset and attribution: https://archive.ics.uci.edu/dataset/352/online+retail
- DOI: https://doi.org/10.24432/C5BW33
- License: [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
- Original workbook: https://archive.ics.uci.edu/ml/machine-learning-databases/00352/Online%20Retail.xlsx
- Original workbook SHA-256: `43465a06f2ccf7c8b5bd2892bc7defb52f97487934fe93b16ae4c3936424676d`

These are historical observations in **GBP**, not current sales or Indian rupees. The company is not named in the source. No organization name, product category, margin, target or channel split is invented.

## Transformation

The website uses the complete calendar months **January 1 to November 30, 2011**, a continuous 334-day series. December 2011 is omitted because its coverage ends on December 9. December 2010 is outside this selected eleven-month analysis window.

Qualifying merchandise lines have positive quantity and positive unit price. Invoices whose number begins with `C` are cancellations and are excluded. Stock codes `POST`, `DOT`, `M`, `D`, `C2`, `BANK CHARGES`, `AMAZONFEE`, `CRUK`, and codes starting with `gift_` are excluded as shipping, adjustments, fees, charity or voucher records. All other positive-priced product lines remain included, whether or not a customer ID was recorded.

For each line, quantity multiplied by unit price is rounded to GBP pence using decimal half-up rounding. Integer pence are summed by invoice date and destination country. This is **gross merchandise sales before returns**, rather than accounting net revenue. Each output row has `category: "All merchandise"` because product categories are not supplied. Country totals describe the customer's destination, not a product category.

Every date in the analysis window has a row. The 57 dates without qualifying records are represented as zero. This means no qualifying sales were recorded in the supplied workbook. It does not independently establish that the retailer was closed or that the original data was complete on those dates. This distinction is also recorded in the JSON metadata.

Order counts are distinct qualifying invoice numbers. Customer counts use distinct recorded customer IDs. Sales from missing customer IDs are retained. Daily customer counts must not be summed to obtain period-wide unique customers. No customer or invoice identifiers are included in the derived files.

## Reconciliation

| Measure | Selected period |
| --- | ---: |
| Calendar days | 334 |
| Qualifying transaction lines | 461,418 |
| Distinct qualifying invoices | 17,410 |
| Distinct identified customers | 4,168 |
| Qualifying lines with no customer ID | 108,376 |
| Gross merchandise sales | GBP 8,889,133.13 |
| Destination countries | 37 |

Daily totals and country totals both reconcile to **888,913,313 pence**. Retained lines plus the mutually exclusive exclusion counters reconcile to all 541,909 original rows. The `.json` and `.js` payloads are identical. The CSV contains the same calendar dates and daily sales, with the minimal fields accepted by the website's upload validator.

## Rebuild

Download the original workbook, then run:

```text
python scripts/build-retail-data.py "path/to/Online Retail.xlsx"
```

The extraction uses `openpyxl` in read-only mode. The builder writes the compact JSON/JavaScript payloads and upload-ready CSV, checks row and penny reconciliation, and prints summary counts. Only aggregates are delivered to the website. The raw workbook is kept outside the published data folder.

Any forecast shown after November 30, 2011 is a model estimate based on these observations. It is not an observed transaction or a live business forecast.
