#!/usr/bin/env python3
"""Reads the Apex billing workbook and writes src/db/workbook-demo.json (the app's demo data).

Usage:  python3 scripts/build-demo-fixture.py "/path/to/2026_APEX BILLING.xlsm"
Needs:  pip install openpyxl
Run it once when the workbook changes; the JSON it writes is committed, so the app never parses the spreadsheet.
"""
import json, re, sys, datetime
import openpyxl

src = sys.argv[1]
wb = openpyxl.load_workbook(src)
wv = openpyxl.load_workbook(src, data_only=True)

def clean(s):
    return re.sub(r"\s+", " ", str(s)).strip() if s is not None else ""

def comment(c):
    if c is None or not c.comment:
        return ""
    return re.sub(r"^\s*Jeff:\s*", "", clean(c.comment.text), flags=re.I)

PEOPLE = {
    "TIME SUMMARY - JEFF": "Jeff Green",
    "TIME SUMMARY - DOUG": "Doug Green",
    "TIME SUMMARY - MOLLY": "Molly Green",
    "TIME SUMMARY - OTHERS": "Others",
}
entries = []
for sheet, person in PEOPLE.items():
    ws, wsv = wb[sheet], wv[sheet]
    for r in range(3, ws.max_row + 1):
        d, cust, hrs = wsv.cell(r, 4).value, wsv.cell(r, 5).value, wsv.cell(r, 6).value
        if not isinstance(d, datetime.datetime) or not clean(cust):
            continue  # blank placeholder days
        desc = clean(wsv.cell(r, 7).value)
        if not isinstance(hrs, (int, float)):
            if "LUMP SUM" not in desc.upper():
                continue
            hrs = 0  # the workbook logs lump-sum days as zero-hour rows
        cell = lambda col: ws.cell(r, col)
        parts_cell = clean(wsv.cell(r, 9).value)
        parts_note = comment(cell(9)) or ("" if parts_cell.upper().startswith("SEE NOTE") else parts_cell)
        internal = " | ".join(x for x in [comment(cell(4)), comment(cell(5)), comment(cell(6)), comment(cell(7))] if x)
        billable_raw = clean(wsv.cell(r, 11).value).upper()
        invoiced_raw = clean(wsv.cell(r, 12).value).upper()
        entries.append({
            "person": person,
            "date": d.date().isoformat(),
            "customer": clean(cust),
            "hours": round(float(hrs), 1),
            "description": desc,
            "lumpSum": bool(clean(wsv.cell(r, 8).value)) or "LUMP SUM" in desc.upper(),
            "hasParts": bool(parts_cell or parts_note),
            "partsNote": parts_note,
            "contractPo": clean(wsv.cell(r, 10).value),
            "billable": billable_raw != "N" and not re.search(r"\bUN-?BILLABLE\b|NOT (REALLY )?BILLABLE", (desc + " " + internal).upper()),
            "invoiced": invoiced_raw == "Y",
            "internalNote": internal,
        })

def table(sheet, first_row, cols):
    ws, wsv = wb[sheet], wv[sheet]
    out = []
    for r in range(first_row, ws.max_row + 1):
        row = {k: wsv.cell(r, c).value for k, c in cols.items()}
        if not clean(row.get("customer")):
            continue
        out.append(row)
    return out

lump = [{"customer": clean(x["customer"]), "description": clean(x["description"]), "amount": float(x["amount"] or 0), "notes": clean(x["notes"])}
        for x in table("LUMP SUM", 4, {"customer": 3, "description": 4, "amount": 5, "notes": 6})]
other = [{"customer": clean(x["customer"]), "description": clean(x["description"]), "amount": float(x["amount"] or 0), "notes": clean(x["notes"])}
         for x in table("OTHER", 3, {"customer": 3, "description": 4, "amount": 5, "notes": 6})]
held = []
wsH, wsHv = wb["HELD TIME"], wv["HELD TIME"]
for r in range(4, wsH.max_row + 1):
    d, cust, hrs = wsHv.cell(r, 4).value, wsHv.cell(r, 5).value, wsHv.cell(r, 6).value
    if isinstance(d, datetime.datetime) and clean(cust) and isinstance(hrs, (int, float)):
        held.append({"date": d.date().isoformat(), "customer": clean(cust), "hours": float(hrs),
                     "description": clean(wsHv.cell(r, 7).value), "partsNote": clean(wsHv.cell(r, 8).value),
                     "internalNote": comment(wsH.cell(r, 4))})

customers = sorted({e["customer"] for e in entries} | {x["customer"] for x in lump + other} | {h["customer"] for h in held})
fixture = {"people": list(PEOPLE.values()), "customers": customers, "entries": entries, "lumpSum": lump, "other": other, "held": held}
with open("src/db/workbook-demo.json", "w") as f:
    json.dump(fixture, f, indent=1)
print(f"{len(entries)} entries, {sum(e['hours'] for e in entries):.1f} h, {len(customers)} customers, {len(lump)} lump sum, {len(other)} other, {len(held)} held")
