#!/usr/bin/env python3
"""
Script to clean up incorrectly placed root-level keys and consolidate translations.
"""

import json
import os

LOCALES_DIR = "/app/frontend/src/i18n/locales"

def clean_locale_file(locale_code):
    """Remove incorrectly placed root-level keys"""
    file_path = os.path.join(LOCALES_DIR, f"{locale_code}.json")
    
    if not os.path.exists(file_path):
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    modified = False
    
    # Remove root-level notifications if it's a dict (incorrectly placed)
    if "notifications" in data and isinstance(data["notifications"], dict):
        # Check if this is NOT the proper structure (should be under "pages")
        if "pages" in data and "notifications" in data["pages"]:
            del data["notifications"]
            modified = True
            print(f"  Removed root-level 'notifications' from {locale_code}")
    
    # Remove root-level pages if it was incorrectly added
    if "pages" in data and isinstance(data["pages"], dict):
        if "booking_detail" in data.get("pages", {}) and len(data["pages"]) <= 2:
            # Might have incorrectly nested pages - need to check
            pass
    
    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  Cleaned {locale_code}.json")

def main():
    print("Cleaning up locale files...")
    
    # Get all locale files
    for filename in os.listdir(LOCALES_DIR):
        if filename.endswith('.json'):
            locale_code = filename[:-5]  # Remove .json
            clean_locale_file(locale_code)
    
    print("\nDone!")

if __name__ == "__main__":
    main()
