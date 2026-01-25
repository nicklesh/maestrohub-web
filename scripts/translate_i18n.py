#!/usr/bin/env python3
"""
Batch translation script for i18n files using OpenAI
"""
import json
import os
import asyncio
from openai import AsyncOpenAI

# Configuration - Use environment variable for API key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
LOCALES_DIR = "/app/frontend/src/i18n/locales"

# Language mapping
LANGUAGE_NAMES = {
    "ar_SA": "Arabic",
    "bn_IN": "Bengali",
    "de_DE": "German",
    "es_ES": "Spanish",
    "fr_FR": "French",
    "gu_IN": "Gujarati",
    "he_IL": "Hebrew",
    "hi_IN": "Hindi",
    "ja_JP": "Japanese",
    "kn_IN": "Kannada",
    "ko_KR": "Korean",
    "ml_IN": "Malayalam",
    "mr_IN": "Marathi",
    "pa_IN": "Punjabi",
    "pt_BR": "Portuguese (Brazilian)",
    "ru_RU": "Russian",
    "ta_IN": "Tamil",
    "te_IN": "Telugu",
    "ur_PK": "Urdu",
    "zh_CN": "Chinese (Simplified)",
    "zh_SG": "Chinese (Simplified, Singapore)",
}

# Keys to skip (brand names, emails, etc that should stay in English)
SKIP_PATTERNS = [
    "branding.app_name",
    "branding.company_name",
    "branding.support_email",
    "branding.admin_email",
    "categories.gmat",
    "categories.sat",
    "categories.gre",
    "categories.toefl",
    "categories.ielts",
]

def find_untranslated(en_data, locale_data, path=''):
    """Find keys where locale value matches English"""
    matches = []
    
    if isinstance(en_data, dict) and isinstance(locale_data, dict):
        for key in en_data:
            new_path = f"{path}.{key}" if path else key
            if key in locale_data:
                if isinstance(en_data[key], dict):
                    matches.extend(find_untranslated(en_data[key], locale_data[key], new_path))
                elif isinstance(en_data[key], str) and isinstance(locale_data[key], str):
                    if en_data[key] == locale_data[key] and len(en_data[key]) > 2:
                        # Skip brand names and common abbreviations
                        should_skip = any(new_path.startswith(skip) for skip in SKIP_PATTERNS)
                        if not should_skip:
                            matches.append((new_path, en_data[key]))
    return matches

def set_value_by_path(obj, path, value):
    """Set value in nested dict by dot path"""
    parts = path.split('.')
    current = obj
    for part in parts[:-1]:
        if part not in current:
            current[part] = {}
        current = current[part]
    current[parts[-1]] = value

async def translate_batch(texts, target_language, client):
    """Translate a batch of texts using OpenAI"""
    if not texts:
        return []
    
    # Create prompt for batch translation
    texts_list = "\n".join([f"{i+1}. {t}" for i, t in enumerate(texts)])
    
    prompt = f"""Translate the following English UI texts to {target_language}. 
Keep the same numbering. Only output the translations, one per line.
Keep technical terms, brand names, and placeholders like {{variable}} unchanged.
Keep translations concise and natural for a mobile app UI.

{texts_list}"""

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a professional translator. Translate UI text accurately and concisely."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )
    
    result = response.choices[0].message.content
    
    # Parse response
    lines = result.strip().split('\n')
    translations = []
    for line in lines:
        # Remove numbering like "1. " or "1) "
        cleaned = line.strip()
        if cleaned and cleaned[0].isdigit():
            # Find where the text starts after number
            for i, c in enumerate(cleaned):
                if c in '. )' and i < 5:
                    cleaned = cleaned[i+1:].strip()
                    break
        translations.append(cleaned)
    
    return translations

async def translate_locale(locale_code, en_data, client):
    """Translate all untranslated strings for a locale"""
    locale_file = os.path.join(LOCALES_DIR, f"{locale_code}.json")
    
    if not os.path.exists(locale_file):
        print(f"  Skipping {locale_code} - file not found")
        return
    
    with open(locale_file, 'r', encoding='utf-8') as f:
        locale_data = json.load(f)
    
    # Find untranslated
    untranslated = find_untranslated(en_data, locale_data)
    
    if not untranslated:
        print(f"  {locale_code}: No translations needed")
        return
    
    language_name = LANGUAGE_NAMES.get(locale_code, locale_code)
    print(f"  {locale_code}: Translating {len(untranslated)} strings to {language_name}...")
    
    # Batch translations (50 at a time)
    batch_size = 50
    for i in range(0, len(untranslated), batch_size):
        batch = untranslated[i:i+batch_size]
        texts = [text for _, text in batch]
        paths = [path for path, _ in batch]
        
        try:
            translations = await translate_batch(texts, language_name, client)
            
            # Update locale data
            for j, (path, translation) in enumerate(zip(paths, translations)):
                if translation and len(translation) > 0:
                    set_value_by_path(locale_data, path, translation)
            
            print(f"    Batch {i//batch_size + 1}/{(len(untranslated) + batch_size - 1)//batch_size} done")
            
        except Exception as e:
            print(f"    Error in batch: {e}")
            continue
    
    # Save updated locale
    with open(locale_file, 'w', encoding='utf-8') as f:
        json.dump(locale_data, f, ensure_ascii=False, indent=2)
    
    print(f"  {locale_code}: Saved translations")

async def main():
    # Check for API key
    if not OPENAI_API_KEY:
        print("❌ OPENAI_API_KEY not found in environment!")
        print("Please set OPENAI_API_KEY in /app/backend/.env")
        return
    
    # Load English as reference
    en_file = os.path.join(LOCALES_DIR, "en_US.json")
    with open(en_file, 'r', encoding='utf-8') as f:
        en_data = json.load(f)
    
    # Initialize OpenAI client
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    
    # Initialize chat with Gemini (faster for batch translations)
    chat = LlmChat(
        api_key=API_KEY,
        session_id="i18n-translation",
        system_message="You are a professional translator. Translate UI text accurately and concisely."
    ).with_model("gemini", "gemini-2.5-flash")
    
    print("Starting i18n translation...")
    
    # Process each locale
    for locale_code in LANGUAGE_NAMES.keys():
        await translate_locale(locale_code, en_data, chat)
    
    print("\nTranslation complete!")

if __name__ == "__main__":
    asyncio.run(main())
