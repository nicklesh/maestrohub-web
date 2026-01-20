#!/usr/bin/env python3
"""
Comprehensive i18n Fix Script
- Fixes Hindi master file issues
- Re-translates ALL non-English/Hindi locale files completely
- Uses Hindi as master source
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
ENGLISH_FILE = "en_US.json"

# Language mapping
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

# Keys that should NOT be translated
DO_NOT_TRANSLATE_KEYS = {
    "app_name", "company_name", "support_email", "admin_email",
    "gmat", "ielts", "toefl", "sat", "act", "gre",
}


def load_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def flatten_json(data, parent_key='', sep='.'):
    items = []
    for k, v in data.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_json(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def unflatten_json(data, sep='.'):
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
    if not isinstance(value, str):
        return False
    if not value.strip():
        return False
    
    # Check if key should not be translated
    key_parts = key.split('.')
    if key_parts[-1] in DO_NOT_TRANSLATE_KEYS:
        return False
    
    # Skip URLs, emails
    if value.startswith('http') or ('@' in value and '.' in value.split('@')[-1]):
        return False
    
    # Skip pure numbers or symbols
    if value.replace('.', '').replace(',', '').replace(' ', '').replace('%', '').replace('$', '').isdigit():
        return False
    
    return True


async def translate_batch(texts_to_translate, target_language, api_key):
    """Translate a batch of texts"""
    if not texts_to_translate:
        return {}
    
    chat = LlmChat(
        api_key=api_key,
        session_id=f"fix-{target_language}-{hash(str(list(texts_to_translate.keys())[:5]))}",
        system_message=f"""You are a professional translator. Translate the given Hindi text to {target_language}.

CRITICAL RULES:
1. Return ONLY a valid JSON object with the translations
2. Keep the exact same JSON keys - only translate the VALUES
3. Keep ALL placeholders like {{count}}, {{name}}, {{email}}, {{hours}}, {{percent}}, etc. EXACTLY as they appear
4. Keep proper names (Sarah, John, etc.) unchanged
5. For numbers in text, translate them to {target_language} numerals if that's the convention
6. DO NOT translate: SAT, ACT, GRE, GMAT, IELTS, TOEFL, USD, INR, email addresses, URLs
7. Ensure natural, fluent translations appropriate for a mobile app
8. Keep UI labels concise
9. Return ONLY the JSON - no markdown, no explanation"""
    ).with_model("openai", "gpt-4.1-mini")
    
    request_data = json.dumps(texts_to_translate, ensure_ascii=False)
    
    user_message = UserMessage(
        text=f"Translate these Hindi texts to {target_language}. Return ONLY valid JSON:\n\n{request_data}"
    )
    
    try:
        response = await chat.send_message(user_message)
        
        # Clean response
        response_text = response.strip()
        if response_text.startswith("```"):
            lines = response_text.split('\n')
            start = 1 if lines[0].startswith("```") else 0
            end = len(lines)
            for i in range(len(lines) - 1, -1, -1):
                if lines[i].strip() == "```":
                    end = i
                    break
            response_text = '\n'.join(lines[start:end])
        
        translated = json.loads(response_text)
        return translated
    except json.JSONDecodeError as e:
        print(f"    ⚠️ JSON parse error: {e}")
        return {}
    except Exception as e:
        print(f"    ⚠️ Translation error: {e}")
        return {}


async def translate_locale_completely(locale_code, target_language, master_flat, api_key):
    """Completely translate a locale file"""
    locale_file = os.path.join(LOCALES_DIR, f"{locale_code}.json")
    
    print(f"\n{'='*60}")
    print(f"📝 Translating {locale_code} ({target_language})")
    print(f"{'='*60}")
    
    # Collect ALL strings that need translation
    texts_to_translate = {}
    for key, hindi_value in master_flat.items():
        if should_translate(key, hindi_value):
            texts_to_translate[key] = hindi_value
    
    print(f"  Total strings to translate: {len(texts_to_translate)}")
    
    if not texts_to_translate:
        print(f"  ⚠️ No strings to translate!")
        return
    
    # Start with a fresh copy (Hindi values)
    result_flat = dict(master_flat)
    
    # Translate in batches
    batch_size = 40
    keys = list(texts_to_translate.keys())
    total_translated = 0
    
    for i in range(0, len(keys), batch_size):
        batch_keys = keys[i:i+batch_size]
        batch_data = {k: texts_to_translate[k] for k in batch_keys}
        
        batch_num = i // batch_size + 1
        total_batches = (len(keys) + batch_size - 1) // batch_size
        print(f"  Batch {batch_num}/{total_batches} ({len(batch_data)} strings)...")
        
        translated = await translate_batch(batch_data, target_language, api_key)
        
        for key, translated_value in translated.items():
            if key in batch_data and translated_value:
                result_flat[key] = translated_value
                total_translated += 1
        
        # Small delay
        await asyncio.sleep(0.3)
    
    # Unflatten and save
    result = unflatten_json(result_flat)
    save_json(locale_file, result)
    
    print(f"  ✅ Translated {total_translated} strings, saved to {locale_code}.json")


async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        print("❌ EMERGENT_LLM_KEY not found!")
        return
    
    print("🌍 Starting comprehensive i18n fix")
    print(f"📂 Locales directory: {LOCALES_DIR}")
    
    # Load master Hindi file
    master_file = os.path.join(LOCALES_DIR, MASTER_FILE)
    master_data = load_json(master_file)
    master_flat = flatten_json(master_data)
    print(f"📖 Loaded {len(master_flat)} keys from Hindi master")
    
    # Priority languages first (Telugu which had errors)
    priority_locales = ["te_IN"]
    other_locales = [k for k in LANGUAGE_MAP.keys() if k not in priority_locales]
    
    # Translate priority first
    for locale_code in priority_locales:
        target_language = LANGUAGE_MAP[locale_code]
        try:
            await translate_locale_completely(locale_code, target_language, master_flat, api_key)
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    # Then translate all others
    for locale_code in other_locales:
        target_language = LANGUAGE_MAP[locale_code]
        try:
            await translate_locale_completely(locale_code, target_language, master_flat, api_key)
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    print("\n" + "="*60)
    print("🎉 Translation complete!")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
