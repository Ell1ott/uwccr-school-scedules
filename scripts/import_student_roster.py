#!/usr/bin/env python3
"""Inspect and import preferred names and countries from a student roster."""

import argparse
from pathlib import Path

from openpyxl import load_workbook


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("xlsx", type=Path)
    args = parser.parse_args()
    workbook = load_workbook(args.xlsx, read_only=True, data_only=True)
    try:
        for sheet in workbook:
            print(f"Sheet: {sheet.title} ({sheet.max_row} rows, {sheet.max_column} columns)")
            for row in sheet.iter_rows(values_only=True):
                print(row)
    finally:
        workbook.close()


if __name__ == "__main__":
    main()
