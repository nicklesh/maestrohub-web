"""
Script to:
1. Rename "tutor" to "coach" in English translations
2. Create Russian (ru_RU.json) translations
3. Sync all keys from en_US.json to all locale files
"""
import json
import os
import re

LOCALES_DIR = "/app/frontend/src/i18n/locales"

# Translation mappings for each language
TRANSLATIONS = {
    "ru_RU": {
        "branding": {
            "app_name": "Maestro Habitat",
            "tagline": "Найдите идеального коуча для вашего ребенка"
        },
        "navigation": {
            "home": "Главная",
            "search": "Поиск",
            "bookings": "Бронирования",
            "profile": "Профиль",
            "settings": "Настройки",
            "dashboard": "Панель",
            "calendar": "Календарь",
            "inbox": "Входящие",
            "notifications": "Уведомления",
            "reviews": "Отзывы",
            "kids": "Мои дети",
            "reminders": "Напоминания",
            "students": "Студенты",
            "packages": "Пакеты",
            "referrals": "Рефералы",
            "reports": "Отчеты",
            "billing": "Биллинг",
            "faq": "ЧаВо",
            "support": "Поддержка"
        },
        "common": {
            "loading": "Загрузка...",
            "error": "Ошибка",
            "success": "Успех",
            "warning": "Предупреждение",
            "info": "Информация",
            "submit": "Отправить",
            "cancel": "Отмена",
            "save": "Сохранить",
            "delete": "Удалить",
            "edit": "Редактировать",
            "view": "Просмотр",
            "back": "Назад",
            "next": "Далее",
            "close": "Закрыть",
            "done": "Готово",
            "continue": "Продолжить",
            "confirm": "Подтвердить",
            "search": "Поиск",
            "filter": "Фильтр",
            "sort": "Сортировка",
            "all": "Все",
            "none": "Нет",
            "yes": "Да",
            "no": "Нет",
            "ok": "ОК",
            "or": "или",
            "and": "и",
            "with": "с",
            "pending": "Ожидает",
            "sent": "Отправлено",
            "accepted": "Принято",
            "expired": "Истекло",
            "completed": "Завершено",
            "cancelled": "Отменено",
            "new": "Новый"
        },
        "auth": {
            "login": "Вход",
            "logout": "Выход",
            "register": "Регистрация",
            "email": "Электронная почта",
            "password": "Пароль",
            "forgot_password": "Забыли пароль?",
            "remember_me": "Запомнить меня"
        },
        "time": {
            "today": "Сегодня",
            "tomorrow": "Завтра",
            "yesterday": "Вчера",
            "minutes": "минуты",
            "hours": "часы",
            "days": "дни",
            "one_day": "1 день",
            "n_days": "{{count}} дней"
        },
        "levels": {
            "elementary": "Начальный (K-5)",
            "middle_school": "Средняя школа (6-8)",
            "high_school": "Старшая школа (9-12)",
            "college": "Колледж",
            "adult": "Взрослый",
            "beginner": "Начинающий",
            "intermediate": "Средний",
            "advanced": "Продвинутый",
            "professional": "Профессиональный"
        },
        "modality": {
            "online": "Онлайн",
            "in_person": "Лично",
            "hybrid": "Гибридный"
        },
        "countries": {
            "united_states": "Соединенные Штаты",
            "india": "Индия"
        }
    }
}

def load_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def rename_tutor_to_coach(data):
    """Recursively rename 'tutor' to 'coach' in string values"""
    if isinstance(data, dict):
        return {k: rename_tutor_to_coach(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [rename_tutor_to_coach(item) for item in data]
    elif isinstance(data, str):
        # Replace various forms of tutor with coach
        result = data
        result = re.sub(r'\bTutor\b', 'Coach', result)
        result = re.sub(r'\btutor\b', 'coach', result)
        result = re.sub(r'\bTUTOR\b', 'COACH', result)
        result = re.sub(r'\bTutors\b', 'Coaches', result)
        result = re.sub(r'\btutors\b', 'coaches', result)
        return result
    return data

def main():
    # Load English as the base
    en_path = os.path.join(LOCALES_DIR, "en_US.json")
    en_data = load_json(en_path)
    
    # Step 1: Rename tutor to coach in English
    print("Step 1: Renaming 'tutor' to 'coach' in en_US.json...")
    en_data = rename_tutor_to_coach(en_data)
    save_json(en_path, en_data)
    print("  ✓ English updated")
    
    # Step 2: Update Hindi with tutor->coach rename
    hi_path = os.path.join(LOCALES_DIR, "hi_IN.json")
    hi_data = load_json(hi_path)
    # Note: Hindi translations should keep their Hindi words, but English words in Hindi file should be renamed
    hi_data = rename_tutor_to_coach(hi_data)
    save_json(hi_path, hi_data)
    print("  ✓ Hindi updated")
    
    # Step 3: Create Russian translations
    print("\nStep 2: Creating ru_RU.json...")
    ru_data = en_data.copy()  # Start with English as base
    # Apply Russian translations where available
    for section, translations in TRANSLATIONS.get("ru_RU", {}).items():
        if section in ru_data:
            if isinstance(ru_data[section], dict):
                ru_data[section].update(translations)
            else:
                ru_data[section] = translations
    
    ru_path = os.path.join(LOCALES_DIR, "ru_RU.json")
    save_json(ru_path, ru_data)
    print("  ✓ Russian created")
    
    # Step 4: Sync keys to all other locale files
    print("\nStep 3: Syncing keys to all locale files...")
    locale_files = [f for f in os.listdir(LOCALES_DIR) if f.endswith('.json') and f not in ['en_US.json', 'hi_IN.json', 'ru_RU.json']]
    
    for locale_file in sorted(locale_files):
        filepath = os.path.join(LOCALES_DIR, locale_file)
        locale_data = load_json(filepath)
        
        # Merge: keep existing translations, add missing keys from English
        def merge_deep(base, target):
            """Merge base into target, keeping target values where they exist"""
            result = target.copy()
            for key, value in base.items():
                if key not in result:
                    result[key] = value
                elif isinstance(value, dict) and isinstance(result.get(key), dict):
                    result[key] = merge_deep(value, result[key])
            return result
        
        merged = merge_deep(en_data, locale_data)
        # Also apply tutor->coach rename
        merged = rename_tutor_to_coach(merged)
        save_json(filepath, merged)
        print(f"  ✓ {locale_file} synced")
    
    print("\n✨ All locale files updated successfully!")

if __name__ == "__main__":
    main()
