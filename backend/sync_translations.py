#!/usr/bin/env python3
"""
Quick script to sync new English i18n keys to all other locale files.
This uses the Emergent LLM key to translate keys that don't exist in target locales.
"""

import json
import os
from pathlib import Path

# Mapping of locale codes to language names
LOCALE_LANGUAGES = {
    'hi_IN': 'Hindi',
    'es_ES': 'Spanish',
    'fr_FR': 'French',
    'de_DE': 'German',
    'pt_BR': 'Portuguese',
    'zh_CN': 'Chinese (Simplified)',
    'ja_JP': 'Japanese',
    'ko_KR': 'Korean',
    'ar_SA': 'Arabic',
    'ru_RU': 'Russian',
    'it_IT': 'Italian',
    'nl_NL': 'Dutch',
    'pl_PL': 'Polish',
    'tr_TR': 'Turkish',
    'vi_VN': 'Vietnamese',
    'th_TH': 'Thai',
    'id_ID': 'Indonesian',
    'ms_MY': 'Malay',
    'ta_IN': 'Tamil',
    'te_IN': 'Telugu',
    'bn_IN': 'Bengali',
    'zh_SG': 'Chinese (Singapore)',
}

LOCALES_DIR = Path('/app/frontend/src/i18n/locales')

def flatten_dict(d, parent_key='', sep='.'):
    """Flatten nested dict to dot-notation keys"""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

def unflatten_dict(d, sep='.'):
    """Convert dot-notation keys back to nested dict"""
    result = {}
    for key, value in d.items():
        parts = key.split(sep)
        current = result
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value
    return result

def find_missing_keys(en_data, target_data):
    """Find keys in English that are missing in target"""
    en_flat = flatten_dict(en_data)
    target_flat = flatten_dict(target_data)
    
    missing = {}
    for key, value in en_flat.items():
        if key not in target_flat or target_flat[key] == value:
            # Key is missing or has same value as English (not translated)
            missing[key] = value
    
    return missing

def translate_text(text, target_language):
    """Translate text using Emergent LLM"""
    try:
        from emergentintegrations.llm.chat import LlmChat
        import uuid
        
        prompt = f"""Translate the following English text to {target_language}. 
Only output the translation, nothing else.
Keep any placeholders like {{{{variable}}}} or {{variable}} unchanged.
Keep technical terms if they don't have a common translation.

Text to translate: {text}"""
        
        llm = LlmChat(
            api_key="sk-emergent-c02Bb9a237a3b6e673",
            session_id=str(uuid.uuid4()),
            system_message="You are a professional translator. Only output the translation, nothing else."
        )
        llm = llm.with_model("anthropic/claude-sonnet-4-20250514")
        response = llm.send_message(prompt)
        return response.strip()
    except Exception as e:
        print(f"Translation error: {e}")
        return text

def main():
    # Load English file
    en_file = LOCALES_DIR / 'en_US.json'
    with open(en_file, 'r', encoding='utf-8') as f:
        en_data = json.load(f)
    
    # Process each locale
    for locale_code, language in LOCALE_LANGUAGES.items():
        locale_file = LOCALES_DIR / f'{locale_code}.json'
        
        if not locale_file.exists():
            print(f"Skipping {locale_code} - file not found")
            continue
        
        print(f"\n{'='*50}")
        print(f"Processing {locale_code} ({language})...")
        
        with open(locale_file, 'r', encoding='utf-8') as f:
            target_data = json.load(f)
        
        # Find missing keys
        missing = find_missing_keys(en_data, target_data)
        
        if not missing:
            print(f"  No missing keys for {locale_code}")
            continue
        
        print(f"  Found {len(missing)} missing/untranslated keys")
        
        # Translate only admin-related keys for efficiency
        admin_keys = {k: v for k, v in missing.items() if 'admin' in k.lower()}
        
        if not admin_keys:
            print(f"  No admin keys to translate for {locale_code}")
            continue
        
        print(f"  Translating {len(admin_keys)} admin keys...")
        
        # Translate
        target_flat = flatten_dict(target_data)
        translated_count = 0
        
        for key, value in admin_keys.items():
            if isinstance(value, str) and len(value) > 2:
                translated = translate_text(value, language)
                if translated != value:
                    target_flat[key] = translated
                    translated_count += 1
                    print(f"    ✓ {key[:50]}...")
        
        # Reconstruct and save
        if translated_count > 0:
            updated_data = unflatten_dict(target_flat)
            with open(locale_file, 'w', encoding='utf-8') as f:
                json.dump(updated_data, f, ensure_ascii=False, indent=2)
            print(f"  Saved {translated_count} translations to {locale_code}")
        else:
            print(f"  No changes for {locale_code}")
    
    print("\n" + "="*50)
    print("Translation sync complete!")

if __name__ == '__main__':
    main()
