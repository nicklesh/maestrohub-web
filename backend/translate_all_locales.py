#!/usr/bin/env python3
"""
Comprehensive i18n Translation Script
Uses Hindi (hi_IN.json) as the master source and translates to all other locales.
"""
import os
import json
import asyncio
from dotenv import load_dotenv

load_dotenv()

from emergentintegrations.llm.chat import LlmChat, UserMessage

# Configuration
LOCALES_DIR = "/app/frontend/src/i18n/locales"
MASTER_FILE = "hi_IN.json"
ENGLISH_FILE = "en_US.json"  # Don't touch this

# Language mapping for translation
LANGUAGE_MAP = {
    "ar_SA": "Arabic",
    "bn_IN": "Bengali",
    "de_DE": "German",
    "es_ES": "Spanish",
    "fr_FR": "French",
    "gu_IN": "Gujarati",
    "he_IL": "Hebrew",
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
    "zh_SG": "Chinese (Singapore/Simplified)",
}

# Strings that should NOT be translated (keep as-is)
DO_NOT_TRANSLATE = {
    "app_name", "company_name", "support_email", "admin_email",
    "SAT", "ACT", "GRE", "GMAT", "IELTS", "TOEFL",
    "USD", "INR", "EUR", "GBP",
    "1099",
}


def load_json(filepath):
    """Load JSON file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(filepath, data):
    """Save JSON file with proper formatting"""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def flatten_json(data, parent_key='', sep='.'):
    """Flatten nested JSON into dot-notation keys"""
    items = []
    for k, v in data.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_json(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def unflatten_json(data, sep='.'):
    """Convert dot-notation keys back to nested JSON"""
    result = {}
    for key, value in data.items():
        parts = key.split(sep)
        d = result
        for part in parts[:-1]:
            if part not in d:
                d[part] = {}
            d = d[part]
        d[parts[-1]] = value
    return result


def should_translate(key, value):
    """Check if a value should be translated"""
    # Skip if not a string
    if not isinstance(value, str):
        return False
    
    # Skip empty strings
    if not value.strip():
        return False
    
    # Skip if key name is in do-not-translate list
    key_parts = key.split('.')
    if key_parts[-1] in DO_NOT_TRANSLATE:
        return False
    
    # Skip URLs, emails
    if value.startswith('http') or '@' in value and '.' in value:
        return False
    
    # Skip if value is just a number or symbol
    if value.replace('.', '').replace(',', '').replace(' ', '').isdigit():
        return False
    
    return True


async def translate_batch(texts_to_translate, target_language, api_key):
    """Translate a batch of texts"""
    if not texts_to_translate:
        return {}
    
    chat = LlmChat(
        api_key=api_key,
        session_id=f"translate-{target_language}-{hash(str(texts_to_translate)[:100])}",
        system_message=f"""You are a professional translator. Translate the given Hindi text to {target_language}.
        
Rules:
1. Return ONLY the JSON object with translations, no explanations
2. Keep the same JSON keys, only translate the values
3. Keep any placeholders like {{count}}, {{name}}, {{email}}, etc. exactly as they are
4. Keep proper nouns, brand names, technical terms as appropriate for the target language
5. Ensure natural, fluent translations appropriate for a mobile app UI
6. For UI elements (buttons, labels), keep translations concise
7. Do NOT translate: email addresses, URLs, SAT, ACT, GRE, GMAT, IELTS, TOEFL, USD, INR, 1099"""
    ).with_model("openai", "gpt-4.1-mini")
    
    # Create batch request
    request_data = json.dumps(texts_to_translate, ensure_ascii=False)
    
    user_message = UserMessage(
        text=f"Translate these Hindi texts to {target_language}. Return ONLY valid JSON with the same keys:\n\n{request_data}"
    )
    
    try:
        response = await chat.send_message(user_message)
        
        # Clean response - remove markdown code blocks if present
        response_text = response.strip()
        if response_text.startswith("```"):
            # Remove markdown code blocks
            lines = response_text.split('\n')
            # Find start and end of code block
            start = 0
            end = len(lines)
            for i, line in enumerate(lines):
                if line.startswith("```") and i == 0:
                    start = 1
                elif line.startswith("```"):
                    end = i
                    break
            response_text = '\n'.join(lines[start:end])
        
        # Parse JSON response
        translated = json.loads(response_text)
        return translated
    except json.JSONDecodeError as e:
        print(f"  ⚠️  JSON parse error: {e}")
        print(f"  Response was: {response[:200]}...")
        return {}
    except Exception as e:
        print(f"  ⚠️  Translation error: {e}")
        return {}


async def translate_locale(locale_code, target_language, master_flat, api_key):
    """Translate a single locale file"""
    locale_file = os.path.join(LOCALES_DIR, f"{locale_code}.json")
    
    print(f"\n{'='*60}")
    print(f"📝 Translating to {target_language} ({locale_code})")
    print(f"{'='*60}")
    
    # Load existing locale if it exists
    if os.path.exists(locale_file):
        existing_data = load_json(locale_file)
        existing_flat = flatten_json(existing_data)
    else:
        existing_flat = {}
    
    # Find all strings that need translation
    texts_to_translate = {}
    for key, hindi_value in master_flat.items():
        if should_translate(key, hindi_value):
            # Check if existing translation looks like it needs updating
            existing_value = existing_flat.get(key, "")
            
            # Translate if:
            # 1. Key doesn't exist in existing file
            # 2. Existing value is same as English (not translated)
            # 3. Existing value is empty
            needs_translation = (
                not existing_value or
                existing_value == hindi_value or  # Same as Hindi means not translated
                # Check if it looks like English (ASCII-only for non-latin scripts)
                (locale_code not in ['de_DE', 'fr_FR', 'es_ES', 'pt_BR'] and existing_value.isascii() and len(existing_value) > 3)
            )
            
            if needs_translation:
                texts_to_translate[key] = hindi_value
    
    print(f"  Found {len(texts_to_translate)} strings to translate")
    
    if not texts_to_translate:
        print(f"  ✅ {locale_code} is already fully translated!")
        return
    
    # Translate in batches of 50
    batch_size = 50
    keys = list(texts_to_translate.keys())
    total_translated = 0
    
    for i in range(0, len(keys), batch_size):
        batch_keys = keys[i:i+batch_size]
        batch_data = {k: texts_to_translate[k] for k in batch_keys}
        
        print(f"  Translating batch {i//batch_size + 1}/{(len(keys) + batch_size - 1)//batch_size} ({len(batch_data)} strings)...")
        
        translated = await translate_batch(batch_data, target_language, api_key)
        
        # Update existing flat data with translations
        for key, translated_value in translated.items():
            if key in batch_data and translated_value:
                existing_flat[key] = translated_value
                total_translated += 1
        
        # Small delay to avoid rate limiting
        await asyncio.sleep(0.5)
    
    # Also copy over any keys from master that don't need translation
    for key, value in master_flat.items():
        if key not in existing_flat:
            existing_flat[key] = value
    
    # Unflatten and save
    result = unflatten_json(existing_flat)
    save_json(locale_file, result)
    
    print(f"  ✅ Translated {total_translated} strings, saved to {locale_code}.json")


async def main():
    """Main translation function"""
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("❌ EMERGENT_LLM_KEY not found in environment!")
        return
    
    print("🌍 Starting comprehensive i18n translation")
    print(f"📂 Locales directory: {LOCALES_DIR}")
    
    # Load master Hindi file
    master_file = os.path.join(LOCALES_DIR, MASTER_FILE)
    if not os.path.exists(master_file):
        print(f"❌ Master file not found: {master_file}")
        return
    
    master_data = load_json(master_file)
    master_flat = flatten_json(master_data)
    print(f"📖 Loaded {len(master_flat)} translation keys from Hindi master")
    
    # Translate each locale
    for locale_code, language_name in LANGUAGE_MAP.items():
        try:
            await translate_locale(locale_code, language_name, master_flat, api_key)
        except Exception as e:
            print(f"  ❌ Error translating {locale_code}: {e}")
            continue
    
    print("\n" + "="*60)
    print("🎉 Translation complete!")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
