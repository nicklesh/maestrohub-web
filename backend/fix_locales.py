#!/usr/bin/env python3
"""
Script to fix locale translations by updating the correct paths.
"""

import json
import os

LOCALES_DIR = "/app/frontend/src/i18n/locales"

# Translations for each language - structure matches the JSON path
TRANSLATIONS = {
    "hi_IN": {
        "pages.notifications.system_update": "सिस्टम अपडेट",
        "pages.notifications.platform_improvements": "प्लेटफ़ॉर्म सुधार सफलतापूर्वक लागू किए गए",
        "pages.booking_detail.join_meeting": "सत्र में शामिल हों",
        "pages.booking_detail.waiting_room_note": "कोच आपको प्रतीक्षा कक्ष से प्रवेश देंगे"
    },
    "ru_RU": {
        "pages.notifications.title": "Уведомления",
        "pages.notifications.all": "Все",
        "pages.notifications.unread": "Непрочитанные",
        "pages.notifications.mark_all_read": "Отметить все как прочитанные",
        "pages.notifications.clear_all": "Очистить все",
        "pages.notifications.no_notifications": "Нет уведомлений",
        "pages.notifications.settings": "Настройки уведомлений",
        "pages.notifications.no_notifications_desc": "Здесь будут обновления о ваших занятиях и платежах",
        "pages.notifications.just_now": "Только что",
        "pages.notifications.hours_ago": "{{count}} ч назад",
        "pages.notifications.days_ago": "{{count}} д назад",
        "pages.notifications.mark_as_read": "Отметить как прочитанное",
        "pages.notifications.system_update": "Системное обновление",
        "pages.notifications.platform_improvements": "Улучшения платформы успешно внедрены",
        "pages.booking_detail.join_meeting": "Присоединиться к занятию",
        "pages.booking_detail.waiting_room_note": "Преподаватель впустит вас из комнаты ожидания"
    },
    "bn_IN": {
        "pages.notifications.title": "বিজ্ঞপ্তি",
        "pages.notifications.all": "সব",
        "pages.notifications.unread": "অপঠিত",
        "pages.notifications.mark_all_read": "সব পঠিত হিসাবে চিহ্নিত করুন",
        "pages.notifications.clear_all": "সব মুছুন",
        "pages.notifications.no_notifications": "কোন বিজ্ঞপ্তি নেই",
        "pages.notifications.settings": "বিজ্ঞপ্তি সেটিংস",
        "pages.notifications.no_notifications_desc": "এখানে আপনার সেশন এবং পেমেন্ট সম্পর্কে আপডেট দেখতে পাবেন",
        "pages.notifications.just_now": "এইমাত্র",
        "pages.notifications.hours_ago": "{{count}} ঘন্টা আগে",
        "pages.notifications.days_ago": "{{count}} দিন আগে",
        "pages.notifications.mark_as_read": "পঠিত হিসাবে চিহ্নিত করুন",
        "pages.notifications.system_update": "সিস্টেম আপডেট",
        "pages.notifications.platform_improvements": "প্ল্যাটফর্ম উন্নতি সফলভাবে স্থাপন করা হয়েছে",
        "pages.booking_detail.join_meeting": "সেশনে যোগ দিন",
        "pages.booking_detail.waiting_room_note": "কোচ আপনাকে প্রতীক্ষা কক্ষ থেকে প্রবেশ করাবেন"
    },
    "ur_PK": {
        "pages.notifications.title": "اطلاعات",
        "pages.notifications.all": "سب",
        "pages.notifications.unread": "نہیں پڑھا",
        "pages.notifications.mark_all_read": "سب پڑھا ہوا نشان زد کریں",
        "pages.notifications.clear_all": "سب صاف کریں",
        "pages.notifications.no_notifications": "کوئی اطلاع نہیں",
        "pages.notifications.settings": "اطلاع کی ترتیبات",
        "pages.notifications.no_notifications_desc": "یہاں آپ کے سیشنز اور ادائیگیوں کے بارے میں اپ ڈیٹس دیکھیں گے",
        "pages.notifications.just_now": "ابھی",
        "pages.notifications.hours_ago": "{{count}} گھنٹے پہلے",
        "pages.notifications.days_ago": "{{count}} دن پہلے",
        "pages.notifications.mark_as_read": "پڑھا ہوا نشان زد کریں",
        "pages.notifications.system_update": "سسٹم اپ ڈیٹ",
        "pages.notifications.platform_improvements": "پلیٹ فارم کی بہتری کامیابی سے لگائی گئی",
        "pages.booking_detail.join_meeting": "سیشن میں شامل ہوں",
        "pages.booking_detail.waiting_room_note": "کوچ آپ کو انتظار کے کمرے سے داخل کریں گے"
    },
    "pt_BR": {
        "pages.notifications.title": "Notificações",
        "pages.notifications.all": "Todas",
        "pages.notifications.unread": "Não lidas",
        "pages.notifications.mark_all_read": "Marcar todas como lidas",
        "pages.notifications.clear_all": "Limpar tudo",
        "pages.notifications.no_notifications": "Sem notificações",
        "pages.notifications.settings": "Configurações de notificação",
        "pages.notifications.no_notifications_desc": "Você verá atualizações sobre suas sessões e pagamentos aqui",
        "pages.notifications.just_now": "Agora mesmo",
        "pages.notifications.hours_ago": "{{count}}h atrás",
        "pages.notifications.days_ago": "{{count}}d atrás",
        "pages.notifications.mark_as_read": "Marcar como lida",
        "pages.notifications.system_update": "Atualização do Sistema",
        "pages.notifications.platform_improvements": "Melhorias na plataforma implantadas com sucesso",
        "pages.booking_detail.join_meeting": "Entrar na Sessão",
        "pages.booking_detail.waiting_room_note": "O professor irá admiti-lo da sala de espera"
    },
    "es_ES": {
        "pages.notifications.title": "Notificaciones",
        "pages.notifications.all": "Todas",
        "pages.notifications.unread": "No leídas",
        "pages.notifications.mark_all_read": "Marcar todas como leídas",
        "pages.notifications.clear_all": "Borrar todo",
        "pages.notifications.no_notifications": "Sin notificaciones",
        "pages.notifications.settings": "Configuración de notificaciones",
        "pages.notifications.no_notifications_desc": "Aquí verás actualizaciones sobre tus sesiones y pagos",
        "pages.notifications.just_now": "Ahora mismo",
        "pages.notifications.hours_ago": "hace {{count}}h",
        "pages.notifications.days_ago": "hace {{count}}d",
        "pages.notifications.mark_as_read": "Marcar como leída",
        "pages.notifications.system_update": "Actualización del Sistema",
        "pages.notifications.platform_improvements": "Mejoras de la plataforma implementadas con éxito",
        "pages.booking_detail.join_meeting": "Unirse a la Sesión",
        "pages.booking_detail.waiting_room_note": "El profesor te admitirá desde la sala de espera"
    },
    "fr_FR": {
        "pages.notifications.title": "Notifications",
        "pages.notifications.all": "Toutes",
        "pages.notifications.unread": "Non lues",
        "pages.notifications.mark_all_read": "Tout marquer comme lu",
        "pages.notifications.clear_all": "Tout effacer",
        "pages.notifications.no_notifications": "Aucune notification",
        "pages.notifications.settings": "Paramètres de notification",
        "pages.notifications.no_notifications_desc": "Vous verrez ici les mises à jour de vos sessions et paiements",
        "pages.notifications.just_now": "À l'instant",
        "pages.notifications.hours_ago": "il y a {{count}}h",
        "pages.notifications.days_ago": "il y a {{count}}j",
        "pages.notifications.mark_as_read": "Marquer comme lu",
        "pages.notifications.system_update": "Mise à jour système",
        "pages.notifications.platform_improvements": "Améliorations de la plateforme déployées avec succès",
        "pages.booking_detail.join_meeting": "Rejoindre la Session",
        "pages.booking_detail.waiting_room_note": "Le professeur vous admettra depuis la salle d'attente"
    },
    "de_DE": {
        "pages.notifications.title": "Benachrichtigungen",
        "pages.notifications.all": "Alle",
        "pages.notifications.unread": "Ungelesen",
        "pages.notifications.mark_all_read": "Alle als gelesen markieren",
        "pages.notifications.clear_all": "Alle löschen",
        "pages.notifications.no_notifications": "Keine Benachrichtigungen",
        "pages.notifications.settings": "Benachrichtigungseinstellungen",
        "pages.notifications.no_notifications_desc": "Hier sehen Sie Updates zu Ihren Sitzungen und Zahlungen",
        "pages.notifications.just_now": "Gerade eben",
        "pages.notifications.hours_ago": "vor {{count}} Std.",
        "pages.notifications.days_ago": "vor {{count}} Tagen",
        "pages.notifications.mark_as_read": "Als gelesen markieren",
        "pages.notifications.system_update": "Systemaktualisierung",
        "pages.notifications.platform_improvements": "Plattformverbesserungen erfolgreich implementiert",
        "pages.booking_detail.join_meeting": "Sitzung beitreten",
        "pages.booking_detail.waiting_room_note": "Der Lehrer wird Sie aus dem Warteraum einlassen"
    },
    "ar_SA": {
        "pages.notifications.title": "الإشعارات",
        "pages.notifications.all": "الكل",
        "pages.notifications.unread": "غير مقروءة",
        "pages.notifications.mark_all_read": "تحديد الكل كمقروء",
        "pages.notifications.clear_all": "مسح الكل",
        "pages.notifications.no_notifications": "لا توجد إشعارات",
        "pages.notifications.settings": "إعدادات الإشعارات",
        "pages.notifications.no_notifications_desc": "ستظهر هنا التحديثات حول جلساتك ومدفوعاتك",
        "pages.notifications.just_now": "الآن",
        "pages.notifications.hours_ago": "قبل {{count}} ساعة",
        "pages.notifications.days_ago": "قبل {{count}} يوم",
        "pages.notifications.mark_as_read": "تحديد كمقروء",
        "pages.notifications.system_update": "تحديث النظام",
        "pages.notifications.platform_improvements": "تم نشر تحسينات المنصة بنجاح",
        "pages.booking_detail.join_meeting": "انضم إلى الجلسة",
        "pages.booking_detail.waiting_room_note": "سيقوم المدرب بقبولك من غرفة الانتظار"
    },
    "zh_CN": {
        "pages.notifications.title": "通知",
        "pages.notifications.all": "全部",
        "pages.notifications.unread": "未读",
        "pages.notifications.mark_all_read": "全部标记为已读",
        "pages.notifications.clear_all": "清除全部",
        "pages.notifications.no_notifications": "没有通知",
        "pages.notifications.settings": "通知设置",
        "pages.notifications.no_notifications_desc": "您将在此处看到有关课程和付款的更新",
        "pages.notifications.just_now": "刚刚",
        "pages.notifications.hours_ago": "{{count}}小时前",
        "pages.notifications.days_ago": "{{count}}天前",
        "pages.notifications.mark_as_read": "标记为已读",
        "pages.notifications.system_update": "系统更新",
        "pages.notifications.platform_improvements": "平台改进已成功部署",
        "pages.booking_detail.join_meeting": "加入课程",
        "pages.booking_detail.waiting_room_note": "老师将从等候室允许您进入"
    },
    "zh_SG": {
        "pages.notifications.title": "通知",
        "pages.notifications.all": "全部",
        "pages.notifications.unread": "未读",
        "pages.notifications.mark_all_read": "全部标记为已读",
        "pages.notifications.clear_all": "清除全部",
        "pages.notifications.no_notifications": "没有通知",
        "pages.notifications.settings": "通知设置",
        "pages.notifications.no_notifications_desc": "您将在此处看到有关课程和付款的更新",
        "pages.notifications.just_now": "刚刚",
        "pages.notifications.hours_ago": "{{count}}小时前",
        "pages.notifications.days_ago": "{{count}}天前",
        "pages.notifications.mark_as_read": "标记为已读",
        "pages.notifications.system_update": "系统更新",
        "pages.notifications.platform_improvements": "平台改进已成功部署",
        "pages.booking_detail.join_meeting": "加入课程",
        "pages.booking_detail.waiting_room_note": "老师将从等候室允许您进入"
    },
    "ja_JP": {
        "pages.notifications.title": "通知",
        "pages.notifications.all": "すべて",
        "pages.notifications.unread": "未読",
        "pages.notifications.mark_all_read": "すべて既読にする",
        "pages.notifications.clear_all": "すべてクリア",
        "pages.notifications.no_notifications": "通知はありません",
        "pages.notifications.settings": "通知設定",
        "pages.notifications.no_notifications_desc": "セッションと支払いに関する更新がここに表示されます",
        "pages.notifications.just_now": "たった今",
        "pages.notifications.hours_ago": "{{count}}時間前",
        "pages.notifications.days_ago": "{{count}}日前",
        "pages.notifications.mark_as_read": "既読にする",
        "pages.notifications.system_update": "システムアップデート",
        "pages.notifications.platform_improvements": "プラットフォームの改善が正常にデプロイされました",
        "pages.booking_detail.join_meeting": "セッションに参加",
        "pages.booking_detail.waiting_room_note": "講師が待機室からあなたを入室させます"
    },
    "ko_KR": {
        "pages.notifications.title": "알림",
        "pages.notifications.all": "전체",
        "pages.notifications.unread": "읽지 않음",
        "pages.notifications.mark_all_read": "모두 읽음으로 표시",
        "pages.notifications.clear_all": "모두 지우기",
        "pages.notifications.no_notifications": "알림 없음",
        "pages.notifications.settings": "알림 설정",
        "pages.notifications.no_notifications_desc": "여기에서 세션 및 결제에 대한 업데이트를 확인할 수 있습니다",
        "pages.notifications.just_now": "방금",
        "pages.notifications.hours_ago": "{{count}}시간 전",
        "pages.notifications.days_ago": "{{count}}일 전",
        "pages.notifications.mark_as_read": "읽음으로 표시",
        "pages.notifications.system_update": "시스템 업데이트",
        "pages.notifications.platform_improvements": "플랫폼 개선 사항이 성공적으로 배포되었습니다",
        "pages.booking_detail.join_meeting": "세션 참가",
        "pages.booking_detail.waiting_room_note": "선생님이 대기실에서 입장을 승인합니다"
    },
    "he_IL": {
        "pages.notifications.title": "התראות",
        "pages.notifications.all": "הכל",
        "pages.notifications.unread": "לא נקראו",
        "pages.notifications.mark_all_read": "סמן הכל כנקרא",
        "pages.notifications.clear_all": "נקה הכל",
        "pages.notifications.no_notifications": "אין התראות",
        "pages.notifications.settings": "הגדרות התראות",
        "pages.notifications.no_notifications_desc": "כאן תראה עדכונים על השיעורים והתשלומים שלך",
        "pages.notifications.just_now": "עכשיו",
        "pages.notifications.hours_ago": "לפני {{count}} שעות",
        "pages.notifications.days_ago": "לפני {{count}} ימים",
        "pages.notifications.mark_as_read": "סמן כנקרא",
        "pages.notifications.system_update": "עדכון מערכת",
        "pages.notifications.platform_improvements": "שיפורי הפלטפורמה נפרסו בהצלחה",
        "pages.booking_detail.join_meeting": "הצטרף לשיעור",
        "pages.booking_detail.waiting_room_note": "המורה יאשר את כניסתך מחדר ההמתנה"
    },
    "te_IN": {
        "pages.notifications.title": "నోటిఫికేషన్లు",
        "pages.notifications.all": "అన్ని",
        "pages.notifications.unread": "చదవని",
        "pages.notifications.mark_all_read": "అన్ని చదివినట్లు గుర్తించు",
        "pages.notifications.clear_all": "అన్ని క్లియర్ చేయి",
        "pages.notifications.no_notifications": "నోటిఫికేషన్లు లేవు",
        "pages.notifications.settings": "నోటిఫికేషన్ సెట్టింగ్స్",
        "pages.notifications.no_notifications_desc": "మీ సెషన్లు మరియు చెల్లింపుల గురించి అప్‌డేట్‌లు ఇక్కడ చూస్తారు",
        "pages.notifications.just_now": "ఇప్పుడే",
        "pages.notifications.hours_ago": "{{count}} గంటల క్రితం",
        "pages.notifications.days_ago": "{{count}} రోజుల క్రితం",
        "pages.notifications.mark_as_read": "చదివినట్లు గుర్తించు",
        "pages.notifications.system_update": "సిస్టమ్ అప్‌డేట్",
        "pages.notifications.platform_improvements": "ప్లాట్‌ఫామ్ మెరుగుదలలు విజయవంతంగా అమలు చేయబడ్డాయి",
        "pages.booking_detail.join_meeting": "సెషన్‌లో చేరండి",
        "pages.booking_detail.waiting_room_note": "కోచ్ మిమ్మల్ని వెయిటింగ్ రూమ్ నుండి అనుమతిస్తారు"
    },
    "ta_IN": {
        "pages.notifications.title": "அறிவிப்புகள்",
        "pages.notifications.all": "அனைத்தும்",
        "pages.notifications.unread": "படிக்கப்படாதவை",
        "pages.notifications.mark_all_read": "அனைத்தையும் படித்ததாக குறி",
        "pages.notifications.clear_all": "அனைத்தையும் அழி",
        "pages.notifications.no_notifications": "அறிவிப்புகள் இல்லை",
        "pages.notifications.settings": "அறிவிப்பு அமைப்புகள்",
        "pages.notifications.no_notifications_desc": "உங்கள் அமர்வுகள் மற்றும் கட்டணங்கள் பற்றிய புதுப்பிப்புகளை இங்கே காணலாம்",
        "pages.notifications.just_now": "இப்போது",
        "pages.notifications.hours_ago": "{{count}} மணி நேரம் முன்பு",
        "pages.notifications.days_ago": "{{count}} நாட்களுக்கு முன்பு",
        "pages.notifications.mark_as_read": "படித்ததாக குறி",
        "pages.notifications.system_update": "கணினி புதுப்பிப்பு",
        "pages.notifications.platform_improvements": "தளம் மேம்படுத்தல்கள் வெற்றிகரமாக பயன்படுத்தப்பட்டது",
        "pages.booking_detail.join_meeting": "அமர்வில் சேரவும்",
        "pages.booking_detail.waiting_room_note": "பயிற்சியாளர் உங்களை காத்திருப்பு அறையிலிருந்து அனுமதிப்பார்"
    },
    "mr_IN": {
        "pages.notifications.title": "सूचना",
        "pages.notifications.all": "सर्व",
        "pages.notifications.unread": "न वाचलेले",
        "pages.notifications.mark_all_read": "सर्व वाचलेले म्हणून चिन्हांकित करा",
        "pages.notifications.clear_all": "सर्व साफ करा",
        "pages.notifications.no_notifications": "कोणतीही सूचना नाही",
        "pages.notifications.settings": "सूचना सेटिंग्ज",
        "pages.notifications.no_notifications_desc": "तुमच्या सत्रे आणि पेमेंटबद्दल अपडेट्स येथे दिसतील",
        "pages.notifications.just_now": "आत्ताच",
        "pages.notifications.hours_ago": "{{count}} तासांपूर्वी",
        "pages.notifications.days_ago": "{{count}} दिवसांपूर्वी",
        "pages.notifications.mark_as_read": "वाचलेले म्हणून चिन्हांकित करा",
        "pages.notifications.system_update": "सिस्टम अपडेट",
        "pages.notifications.platform_improvements": "प्लॅटफॉर्म सुधारणा यशस्वीरित्या लागू केल्या",
        "pages.booking_detail.join_meeting": "सत्रात सामील व्हा",
        "pages.booking_detail.waiting_room_note": "कोच तुम्हाला प्रतीक्षा खोलीतून प्रवेश देईल"
    },
    "gu_IN": {
        "pages.notifications.title": "સૂચનાઓ",
        "pages.notifications.all": "બધા",
        "pages.notifications.unread": "વાંચ્યું નથી",
        "pages.notifications.mark_all_read": "બધાને વાંચેલ તરીકે ચિહ્નિત કરો",
        "pages.notifications.clear_all": "બધું સાફ કરો",
        "pages.notifications.no_notifications": "કોઈ સૂચનાઓ નથી",
        "pages.notifications.settings": "સૂચના સેટિંગ્સ",
        "pages.notifications.no_notifications_desc": "તમારા સત્રો અને ચૂકવણીઓ વિશેના અપડેટ્સ અહીં જોશો",
        "pages.notifications.just_now": "હમણાં જ",
        "pages.notifications.hours_ago": "{{count}} કલાક પહેલાં",
        "pages.notifications.days_ago": "{{count}} દિવસ પહેલાં",
        "pages.notifications.mark_as_read": "વાંચેલ તરીકે ચિહ્નિત કરો",
        "pages.notifications.system_update": "સિસ્ટમ અપડેટ",
        "pages.notifications.platform_improvements": "પ્લેટફોર્મ સુધારાઓ સફળતાપૂર્વક લાગુ કરવામાં આવ્યા",
        "pages.booking_detail.join_meeting": "સત્રમાં જોડાઓ",
        "pages.booking_detail.waiting_room_note": "કોચ તમને વેઇટિંગ રૂમમાંથી પ્રવેશ આપશે"
    },
    "pa_IN": {
        "pages.notifications.title": "ਸੂਚਨਾਵਾਂ",
        "pages.notifications.all": "ਸਭ",
        "pages.notifications.unread": "ਨਹੀਂ ਪੜ੍ਹੀਆਂ",
        "pages.notifications.mark_all_read": "ਸਭ ਨੂੰ ਪੜ੍ਹਿਆ ਵਜੋਂ ਚਿੰਨ੍ਹਿਤ ਕਰੋ",
        "pages.notifications.clear_all": "ਸਭ ਸਾਫ਼ ਕਰੋ",
        "pages.notifications.no_notifications": "ਕੋਈ ਸੂਚਨਾ ਨਹੀਂ",
        "pages.notifications.settings": "ਸੂਚਨਾ ਸੈਟਿੰਗਾਂ",
        "pages.notifications.no_notifications_desc": "ਤੁਹਾਡੇ ਸੈਸ਼ਨਾਂ ਅਤੇ ਭੁਗਤਾਨਾਂ ਬਾਰੇ ਅੱਪਡੇਟ ਇੱਥੇ ਦਿਖਾਈ ਦੇਣਗੇ",
        "pages.notifications.just_now": "ਹੁਣੇ",
        "pages.notifications.hours_ago": "{{count}} ਘੰਟੇ ਪਹਿਲਾਂ",
        "pages.notifications.days_ago": "{{count}} ਦਿਨ ਪਹਿਲਾਂ",
        "pages.notifications.mark_as_read": "ਪੜ੍ਹਿਆ ਵਜੋਂ ਚਿੰਨ੍ਹਿਤ ਕਰੋ",
        "pages.notifications.system_update": "ਸਿਸਟਮ ਅੱਪਡੇਟ",
        "pages.notifications.platform_improvements": "ਪਲੇਟਫਾਰਮ ਸੁਧਾਰ ਸਫਲਤਾਪੂਰਵਕ ਲਾਗੂ ਕੀਤੇ ਗਏ",
        "pages.booking_detail.join_meeting": "ਸੈਸ਼ਨ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ",
        "pages.booking_detail.waiting_room_note": "ਕੋਚ ਤੁਹਾਨੂੰ ਵੇਟਿੰਗ ਰੂਮ ਤੋਂ ਦਾਖ਼ਲ ਕਰੇਗਾ"
    },
    "kn_IN": {
        "pages.notifications.title": "ಅಧಿಸೂಚನೆಗಳು",
        "pages.notifications.all": "ಎಲ್ಲಾ",
        "pages.notifications.unread": "ಓದಿಲ್ಲ",
        "pages.notifications.mark_all_read": "ಎಲ್ಲವನ್ನೂ ಓದಿದ ಎಂದು ಗುರುತಿಸಿ",
        "pages.notifications.clear_all": "ಎಲ್ಲವನ್ನೂ ತೆರವುಗೊಳಿಸಿ",
        "pages.notifications.no_notifications": "ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ",
        "pages.notifications.settings": "ಅಧಿಸೂಚನೆ ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
        "pages.notifications.no_notifications_desc": "ನಿಮ್ಮ ಸೆಷನ್‌ಗಳು ಮತ್ತು ಪಾವತಿಗಳ ಬಗ್ಗೆ ನವೀಕರಣಗಳನ್ನು ಇಲ್ಲಿ ನೋಡುತ್ತೀರಿ",
        "pages.notifications.just_now": "ಈಗಷ್ಟೇ",
        "pages.notifications.hours_ago": "{{count}} ಗಂಟೆಗಳ ಹಿಂದೆ",
        "pages.notifications.days_ago": "{{count}} ದಿನಗಳ ಹಿಂದೆ",
        "pages.notifications.mark_as_read": "ಓದಿದ ಎಂದು ಗುರುತಿಸಿ",
        "pages.notifications.system_update": "ಸಿಸ್ಟಮ್ ನವೀಕರಣ",
        "pages.notifications.platform_improvements": "ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಸುಧಾರಣೆಗಳು ಯಶಸ್ವಿಯಾಗಿ ನಿಯೋಜಿಸಲಾಗಿದೆ",
        "pages.booking_detail.join_meeting": "ಸೆಷನ್‌ಗೆ ಸೇರಿ",
        "pages.booking_detail.waiting_room_note": "ಕೋಚ್ ನಿಮ್ಮನ್ನು ನಿರೀಕ್ಷಣಾ ಕೊಠಡಿಯಿಂದ ಸೇರಿಸುತ್ತಾರೆ"
    },
    "ml_IN": {
        "pages.notifications.title": "അറിയിപ്പുകൾ",
        "pages.notifications.all": "എല്ലാം",
        "pages.notifications.unread": "വായിക്കാത്തവ",
        "pages.notifications.mark_all_read": "എല്ലാം വായിച്ചതായി അടയാളപ്പെടുത്തുക",
        "pages.notifications.clear_all": "എല്ലാം മായ്ക്കുക",
        "pages.notifications.no_notifications": "അറിയിപ്പുകളില്ല",
        "pages.notifications.settings": "അറിയിപ്പ് ക്രമീകരണങ്ങൾ",
        "pages.notifications.no_notifications_desc": "നിങ്ങളുടെ സെഷനുകളെയും പേയ്‌മെന്റുകളെയും കുറിച്ചുള്ള അപ്‌ഡേറ്റുകൾ ഇവിടെ കാണാം",
        "pages.notifications.just_now": "ഇപ്പോൾ",
        "pages.notifications.hours_ago": "{{count}} മണിക്കൂർ മുമ്പ്",
        "pages.notifications.days_ago": "{{count}} ദിവസം മുമ്പ്",
        "pages.notifications.mark_as_read": "വായിച്ചതായി അടയാളപ്പെടുത്തുക",
        "pages.notifications.system_update": "സിസ്റ്റം അപ്‌ഡേറ്റ്",
        "pages.notifications.platform_improvements": "പ്ലാറ്റ്‌ഫോം മെച്ചപ്പെടുത്തലുകൾ വിജയകരമായി വിന്യസിച്ചു",
        "pages.booking_detail.join_meeting": "സെഷനിൽ ചേരുക",
        "pages.booking_detail.waiting_room_note": "കോച്ച് നിങ്ങളെ വെയിറ്റിംഗ് റൂമിൽ നിന്ന് പ്രവേശിപ്പിക്കും"
    }
}

def set_nested_value(data, key_path, value):
    """Set a value in a nested dictionary using dot-separated path"""
    keys = key_path.split('.')
    current = data
    for key in keys[:-1]:
        if key not in current:
            current[key] = {}
        current = current[key]
    current[keys[-1]] = value

def update_locale_file(locale_code, translations):
    """Update a specific locale file with translations"""
    file_path = os.path.join(LOCALES_DIR, f"{locale_code}.json")
    
    if not os.path.exists(file_path):
        print(f"Warning: {file_path} does not exist")
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Remove any incorrectly added root-level "notifications" or "pages" keys
    if "notifications" in data and isinstance(data["notifications"], dict) and "title" in data["notifications"]:
        # This is a root-level notifications object we added - remove it
        if locale_code != "en_US":  # Don't remove from English
            del data["notifications"]
    
    # Apply translations
    for key_path, value in translations.items():
        set_nested_value(data, key_path, value)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Updated {locale_code}.json")

def main():
    print("Fixing locale translations...")
    
    for locale_code, translations in TRANSLATIONS.items():
        update_locale_file(locale_code, translations)
    
    print("\nDone! All locale files have been fixed.")

if __name__ == "__main__":
    main()
