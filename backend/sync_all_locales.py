"""
Script to:
1. Find the i18n file with the most keys
2. Sync all keys to all other locale files
3. Create Bengali (bn_IN), Urdu (ur_PK), and Portuguese (pt_BR) locale files
"""
import json
import os
from copy import deepcopy

LOCALES_DIR = "/app/frontend/src/i18n/locales"

# New language translations
NEW_LANGUAGES = {
    "bn_IN": {
        "meta": {"name": "Bengali (India)", "nativeName": "বাংলা (ভারত)", "rtl": False},
        "translations": {
            "branding": {
                "app_name": "Maestro Habitat",
                "tagline": "আপনার সন্তানের জন্য নিখুঁত কোচ খুঁজুন"
            },
            "navigation": {
                "home": "হোম",
                "search": "অনুসন্ধান",
                "bookings": "বুকিং",
                "profile": "প্রোফাইল",
                "settings": "সেটিংস",
                "dashboard": "ড্যাশবোর্ড",
                "calendar": "ক্যালেন্ডার",
                "inbox": "ইনবক্স",
                "notifications": "বিজ্ঞপ্তি",
                "reviews": "পর্যালোচনা",
                "kids": "আমার বাচ্চারা",
                "reminders": "স্মারক",
                "students": "শিক্ষার্থী",
                "referrals": "রেফারেল",
                "reports": "রিপোর্ট",
                "billing": "বিলিং",
                "faq": "জিজ্ঞাসা"
            },
            "common": {
                "loading": "লোড হচ্ছে...",
                "error": "ত্রুটি",
                "success": "সফল",
                "submit": "জমা দিন",
                "cancel": "বাতিল",
                "save": "সংরক্ষণ",
                "delete": "মুছুন",
                "edit": "সম্পাদনা",
                "back": "পিছনে",
                "next": "পরবর্তী",
                "close": "বন্ধ",
                "done": "সম্পন্ন",
                "yes": "হ্যাঁ",
                "no": "না",
                "with": "সাথে",
                "pending": "অপেক্ষারত",
                "sent": "প্রেরিত",
                "completed": "সম্পূর্ণ",
                "new": "নতুন"
            },
            "auth": {
                "login": "লগইন",
                "logout": "লগআউট",
                "register": "নিবন্ধন",
                "email": "ইমেইল",
                "password": "পাসওয়ার্ড"
            },
            "time": {
                "today": "আজ",
                "tomorrow": "আগামীকাল",
                "yesterday": "গতকাল",
                "hours": "ঘন্টা",
                "days": "দিন",
                "one_day": "১ দিন",
                "n_days": "{{count}} দিন"
            },
            "levels": {
                "beginner": "শিক্ষানবিস",
                "intermediate": "মধ্যবর্তী",
                "advanced": "উন্নত",
                "professional": "পেশাদার"
            },
            "modality": {
                "online": "অনলাইন",
                "in_person": "সশরীর",
                "hybrid": "হাইব্রিড"
            }
        }
    },
    "ur_PK": {
        "meta": {"name": "Urdu (Pakistan)", "nativeName": "اردو (پاکستان)", "rtl": True},
        "translations": {
            "branding": {
                "app_name": "Maestro Habitat",
                "tagline": "اپنے بچے کے لیے بہترین کوچ تلاش کریں"
            },
            "navigation": {
                "home": "ہوم",
                "search": "تلاش",
                "bookings": "بکنگز",
                "profile": "پروفائل",
                "settings": "ترتیبات",
                "dashboard": "ڈیش بورڈ",
                "calendar": "کیلنڈر",
                "inbox": "ان باکس",
                "notifications": "اطلاعات",
                "reviews": "جائزے",
                "kids": "میرے بچے",
                "reminders": "یاد دہانیاں",
                "students": "طلباء",
                "referrals": "حوالہ جات",
                "reports": "رپورٹس",
                "billing": "بلنگ",
                "faq": "سوالات"
            },
            "common": {
                "loading": "...لوڈ ہو رہا ہے",
                "error": "خرابی",
                "success": "کامیابی",
                "submit": "جمع کریں",
                "cancel": "منسوخ",
                "save": "محفوظ کریں",
                "delete": "حذف کریں",
                "edit": "ترمیم",
                "back": "واپس",
                "next": "اگلا",
                "close": "بند کریں",
                "done": "مکمل",
                "yes": "ہاں",
                "no": "نہیں",
                "with": "کے ساتھ",
                "pending": "زیر التواء",
                "sent": "بھیج دیا",
                "completed": "مکمل",
                "new": "نیا"
            },
            "auth": {
                "login": "لاگ ان",
                "logout": "لاگ آؤٹ",
                "register": "رجسٹر",
                "email": "ای میل",
                "password": "پاس ورڈ"
            },
            "time": {
                "today": "آج",
                "tomorrow": "کل",
                "yesterday": "گزشتہ کل",
                "hours": "گھنٹے",
                "days": "دن",
                "one_day": "1 دن",
                "n_days": "{{count}} دن"
            },
            "levels": {
                "beginner": "ابتدائی",
                "intermediate": "درمیانی",
                "advanced": "ایڈوانسڈ",
                "professional": "پیشہ ور"
            },
            "modality": {
                "online": "آن لائن",
                "in_person": "ذاتی طور پر",
                "hybrid": "ہائبرڈ"
            }
        }
    },
    "pt_BR": {
        "meta": {"name": "Portuguese (Brazil)", "nativeName": "Português (Brasil)", "rtl": False},
        "translations": {
            "branding": {
                "app_name": "Maestro Habitat",
                "tagline": "Encontre o treinador perfeito para seu filho"
            },
            "navigation": {
                "home": "Início",
                "search": "Buscar",
                "bookings": "Reservas",
                "profile": "Perfil",
                "settings": "Configurações",
                "dashboard": "Painel",
                "calendar": "Calendário",
                "inbox": "Caixa de entrada",
                "notifications": "Notificações",
                "reviews": "Avaliações",
                "kids": "Meus filhos",
                "reminders": "Lembretes",
                "students": "Alunos",
                "referrals": "Indicações",
                "reports": "Relatórios",
                "billing": "Faturamento",
                "faq": "Perguntas frequentes"
            },
            "common": {
                "loading": "Carregando...",
                "error": "Erro",
                "success": "Sucesso",
                "submit": "Enviar",
                "cancel": "Cancelar",
                "save": "Salvar",
                "delete": "Excluir",
                "edit": "Editar",
                "back": "Voltar",
                "next": "Próximo",
                "close": "Fechar",
                "done": "Concluído",
                "yes": "Sim",
                "no": "Não",
                "with": "com",
                "pending": "Pendente",
                "sent": "Enviado",
                "completed": "Concluído",
                "new": "Novo"
            },
            "auth": {
                "login": "Entrar",
                "logout": "Sair",
                "register": "Registrar",
                "email": "E-mail",
                "password": "Senha"
            },
            "time": {
                "today": "Hoje",
                "tomorrow": "Amanhã",
                "yesterday": "Ontem",
                "hours": "horas",
                "days": "dias",
                "one_day": "1 dia",
                "n_days": "{{count}} dias"
            },
            "levels": {
                "beginner": "Iniciante",
                "intermediate": "Intermediário",
                "advanced": "Avançado",
                "professional": "Profissional"
            },
            "modality": {
                "online": "Online",
                "in_person": "Presencial",
                "hybrid": "Híbrido"
            }
        }
    }
}

def load_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def count_keys(obj, prefix=""):
    """Count all keys recursively"""
    count = 0
    if isinstance(obj, dict):
        for key, value in obj.items():
            count += 1
            count += count_keys(value, f"{prefix}.{key}")
    elif isinstance(obj, list):
        for item in obj:
            count += count_keys(item, prefix)
    return count

def deep_merge(base, overlay):
    """Deep merge overlay into base, keeping base values where overlay doesn't have them"""
    result = deepcopy(base)
    for key, value in overlay.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = deepcopy(value)
    return result

def main():
    print("=" * 60)
    print("Locale Synchronization Script")
    print("=" * 60)
    
    # Step 1: Find the file with the most keys
    print("\nStep 1: Finding file with most keys...")
    locale_files = [f for f in os.listdir(LOCALES_DIR) if f.endswith('.json')]
    
    max_keys = 0
    master_file = None
    master_data = None
    
    for locale_file in locale_files:
        filepath = os.path.join(LOCALES_DIR, locale_file)
        data = load_json(filepath)
        key_count = count_keys(data)
        print(f"  {locale_file}: {key_count} keys")
        if key_count > max_keys:
            max_keys = key_count
            master_file = locale_file
            master_data = data
    
    print(f"\n  Master file: {master_file} ({max_keys} keys)")
    
    # Step 2: Create new locale files
    print("\nStep 2: Creating new locale files...")
    for locale_code, lang_info in NEW_LANGUAGES.items():
        filepath = os.path.join(LOCALES_DIR, f"{locale_code}.json")
        # Start with master data (English) and apply translations
        new_data = deepcopy(master_data)
        new_data = deep_merge(new_data, lang_info["translations"])
        save_json(filepath, new_data)
        print(f"  ✓ Created {locale_code}.json ({lang_info['meta']['name']})")
    
    # Step 3: Sync all keys from master to all other files
    print("\nStep 3: Syncing keys to all locale files...")
    
    # Reload master data
    master_filepath = os.path.join(LOCALES_DIR, master_file)
    master_data = load_json(master_filepath)
    
    for locale_file in sorted(os.listdir(LOCALES_DIR)):
        if not locale_file.endswith('.json'):
            continue
        
        filepath = os.path.join(LOCALES_DIR, locale_file)
        locale_data = load_json(filepath)
        
        # Merge master into locale (keeping locale values where they exist)
        merged = deep_merge(master_data, locale_data)
        
        save_json(filepath, merged)
        new_count = count_keys(merged)
        print(f"  ✓ {locale_file}: {new_count} keys")
    
    # Step 4: Validate all JSON files
    print("\nStep 4: Validating all JSON files...")
    all_valid = True
    for locale_file in sorted(os.listdir(LOCALES_DIR)):
        if not locale_file.endswith('.json'):
            continue
        filepath = os.path.join(LOCALES_DIR, locale_file)
        try:
            load_json(filepath)
            print(f"  ✓ {locale_file} is valid")
        except json.JSONDecodeError as e:
            print(f"  ✗ {locale_file} is INVALID: {e}")
            all_valid = False
    
    print("\n" + "=" * 60)
    if all_valid:
        print("✨ All locale files synchronized successfully!")
    else:
        print("⚠️  Some files have validation errors!")
    print("=" * 60)

if __name__ == "__main__":
    main()
