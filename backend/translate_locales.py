#!/usr/bin/env python3
"""
Script to add proper translations to all locale files.
This script updates all non-English locale files with translations
for notification content and other strings.
"""

import json
import os

LOCALES_DIR = "/app/frontend/src/i18n/locales"

# Translations for each language
TRANSLATIONS = {
    "hi_IN": {
        "notifications": {
            "system_update": "सिस्टम अपडेट",
            "platform_improvements": "प्लेटफ़ॉर्म सुधार सफलतापूर्वक लागू किए गए"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "सत्र में शामिल हों",
                "waiting_room_note": "कोच आपको प्रतीक्षा कक्ष से प्रवेश देंगे"
            }
        }
    },
    "ru_RU": {
        "notifications": {
            "title": "Уведомления",
            "all": "Все",
            "unread": "Непрочитанные",
            "mark_all_read": "Отметить все как прочитанные",
            "clear_all": "Очистить все",
            "no_notifications": "Нет уведомлений",
            "settings": "Настройки уведомлений",
            "no_notifications_desc": "Здесь будут обновления о ваших занятиях и платежах",
            "just_now": "Только что",
            "hours_ago": "{{count}} ч назад",
            "days_ago": "{{count}} д назад",
            "mark_as_read": "Отметить как прочитанное",
            "system_update": "Системное обновление",
            "platform_improvements": "Улучшения платформы успешно внедрены"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "Присоединиться к занятию",
                "waiting_room_note": "Преподаватель впустит вас из комнаты ожидания"
            }
        }
    },
    "bn_IN": {
        "notifications": {
            "title": "বিজ্ঞপ্তি",
            "all": "সব",
            "unread": "অপঠিত",
            "mark_all_read": "সব পঠিত হিসাবে চিহ্নিত করুন",
            "clear_all": "সব মুছুন",
            "no_notifications": "কোন বিজ্ঞপ্তি নেই",
            "settings": "বিজ্ঞপ্তি সেটিংস",
            "no_notifications_desc": "এখানে আপনার সেশন এবং পেমেন্ট সম্পর্কে আপডেট দেখতে পাবেন",
            "just_now": "এইমাত্র",
            "hours_ago": "{{count}} ঘন্টা আগে",
            "days_ago": "{{count}} দিন আগে",
            "mark_as_read": "পঠিত হিসাবে চিহ্নিত করুন",
            "system_update": "সিস্টেম আপডেট",
            "platform_improvements": "প্ল্যাটফর্ম উন্নতি সফলভাবে স্থাপন করা হয়েছে"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "সেশনে যোগ দিন",
                "waiting_room_note": "কোচ আপনাকে প্রতীক্ষা কক্ষ থেকে প্রবেশ করাবেন"
            }
        }
    },
    "ur_PK": {
        "notifications": {
            "title": "اطلاعات",
            "all": "سب",
            "unread": "نہیں پڑھا",
            "mark_all_read": "سب پڑھا ہوا نشان زد کریں",
            "clear_all": "سب صاف کریں",
            "no_notifications": "کوئی اطلاع نہیں",
            "settings": "اطلاع کی ترتیبات",
            "no_notifications_desc": "یہاں آپ کے سیشنز اور ادائیگیوں کے بارے میں اپ ڈیٹس دیکھیں گے",
            "just_now": "ابھی",
            "hours_ago": "{{count}} گھنٹے پہلے",
            "days_ago": "{{count}} دن پہلے",
            "mark_as_read": "پڑھا ہوا نشان زد کریں",
            "system_update": "سسٹم اپ ڈیٹ",
            "platform_improvements": "پلیٹ فارم کی بہتری کامیابی سے لگائی گئی"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "سیشن میں شامل ہوں",
                "waiting_room_note": "کوچ آپ کو انتظار کے کمرے سے داخل کریں گے"
            }
        }
    },
    "pt_BR": {
        "notifications": {
            "title": "Notificações",
            "all": "Todas",
            "unread": "Não lidas",
            "mark_all_read": "Marcar todas como lidas",
            "clear_all": "Limpar tudo",
            "no_notifications": "Sem notificações",
            "settings": "Configurações de notificação",
            "no_notifications_desc": "Você verá atualizações sobre suas sessões e pagamentos aqui",
            "just_now": "Agora mesmo",
            "hours_ago": "{{count}}h atrás",
            "days_ago": "{{count}}d atrás",
            "mark_as_read": "Marcar como lida",
            "system_update": "Atualização do Sistema",
            "platform_improvements": "Melhorias na plataforma implantadas com sucesso"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "Entrar na Sessão",
                "waiting_room_note": "O professor irá admiti-lo da sala de espera"
            }
        }
    },
    "es_ES": {
        "notifications": {
            "title": "Notificaciones",
            "all": "Todas",
            "unread": "No leídas",
            "mark_all_read": "Marcar todas como leídas",
            "clear_all": "Borrar todo",
            "no_notifications": "Sin notificaciones",
            "settings": "Configuración de notificaciones",
            "no_notifications_desc": "Aquí verás actualizaciones sobre tus sesiones y pagos",
            "just_now": "Ahora mismo",
            "hours_ago": "hace {{count}}h",
            "days_ago": "hace {{count}}d",
            "mark_as_read": "Marcar como leída",
            "system_update": "Actualización del Sistema",
            "platform_improvements": "Mejoras de la plataforma implementadas con éxito"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "Unirse a la Sesión",
                "waiting_room_note": "El profesor te admitirá desde la sala de espera"
            }
        }
    },
    "fr_FR": {
        "notifications": {
            "title": "Notifications",
            "all": "Toutes",
            "unread": "Non lues",
            "mark_all_read": "Tout marquer comme lu",
            "clear_all": "Tout effacer",
            "no_notifications": "Aucune notification",
            "settings": "Paramètres de notification",
            "no_notifications_desc": "Vous verrez ici les mises à jour de vos sessions et paiements",
            "just_now": "À l'instant",
            "hours_ago": "il y a {{count}}h",
            "days_ago": "il y a {{count}}j",
            "mark_as_read": "Marquer comme lu",
            "system_update": "Mise à jour système",
            "platform_improvements": "Améliorations de la plateforme déployées avec succès"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "Rejoindre la Session",
                "waiting_room_note": "Le professeur vous admettra depuis la salle d'attente"
            }
        }
    },
    "de_DE": {
        "notifications": {
            "title": "Benachrichtigungen",
            "all": "Alle",
            "unread": "Ungelesen",
            "mark_all_read": "Alle als gelesen markieren",
            "clear_all": "Alle löschen",
            "no_notifications": "Keine Benachrichtigungen",
            "settings": "Benachrichtigungseinstellungen",
            "no_notifications_desc": "Hier sehen Sie Updates zu Ihren Sitzungen und Zahlungen",
            "just_now": "Gerade eben",
            "hours_ago": "vor {{count}} Std.",
            "days_ago": "vor {{count}} Tagen",
            "mark_as_read": "Als gelesen markieren",
            "system_update": "Systemaktualisierung",
            "platform_improvements": "Plattformverbesserungen erfolgreich implementiert"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "Sitzung beitreten",
                "waiting_room_note": "Der Lehrer wird Sie aus dem Warteraum einlassen"
            }
        }
    },
    "ar_SA": {
        "notifications": {
            "title": "الإشعارات",
            "all": "الكل",
            "unread": "غير مقروءة",
            "mark_all_read": "تحديد الكل كمقروء",
            "clear_all": "مسح الكل",
            "no_notifications": "لا توجد إشعارات",
            "settings": "إعدادات الإشعارات",
            "no_notifications_desc": "ستظهر هنا التحديثات حول جلساتك ومدفوعاتك",
            "just_now": "الآن",
            "hours_ago": "قبل {{count}} ساعة",
            "days_ago": "قبل {{count}} يوم",
            "mark_as_read": "تحديد كمقروء",
            "system_update": "تحديث النظام",
            "platform_improvements": "تم نشر تحسينات المنصة بنجاح"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "انضم إلى الجلسة",
                "waiting_room_note": "سيقوم المدرب بقبولك من غرفة الانتظار"
            }
        }
    },
    "zh_CN": {
        "notifications": {
            "title": "通知",
            "all": "全部",
            "unread": "未读",
            "mark_all_read": "全部标记为已读",
            "clear_all": "清除全部",
            "no_notifications": "没有通知",
            "settings": "通知设置",
            "no_notifications_desc": "您将在此处看到有关课程和付款的更新",
            "just_now": "刚刚",
            "hours_ago": "{{count}}小时前",
            "days_ago": "{{count}}天前",
            "mark_as_read": "标记为已读",
            "system_update": "系统更新",
            "platform_improvements": "平台改进已成功部署"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "加入课程",
                "waiting_room_note": "老师将从等候室允许您进入"
            }
        }
    },
    "zh_SG": {
        "notifications": {
            "title": "通知",
            "all": "全部",
            "unread": "未读",
            "mark_all_read": "全部标记为已读",
            "clear_all": "清除全部",
            "no_notifications": "没有通知",
            "settings": "通知设置",
            "no_notifications_desc": "您将在此处看到有关课程和付款的更新",
            "just_now": "刚刚",
            "hours_ago": "{{count}}小时前",
            "days_ago": "{{count}}天前",
            "mark_as_read": "标记为已读",
            "system_update": "系统更新",
            "platform_improvements": "平台改进已成功部署"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "加入课程",
                "waiting_room_note": "老师将从等候室允许您进入"
            }
        }
    },
    "ja_JP": {
        "notifications": {
            "title": "通知",
            "all": "すべて",
            "unread": "未読",
            "mark_all_read": "すべて既読にする",
            "clear_all": "すべてクリア",
            "no_notifications": "通知はありません",
            "settings": "通知設定",
            "no_notifications_desc": "セッションと支払いに関する更新がここに表示されます",
            "just_now": "たった今",
            "hours_ago": "{{count}}時間前",
            "days_ago": "{{count}}日前",
            "mark_as_read": "既読にする",
            "system_update": "システムアップデート",
            "platform_improvements": "プラットフォームの改善が正常にデプロイされました"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "セッションに参加",
                "waiting_room_note": "講師が待機室からあなたを入室させます"
            }
        }
    },
    "ko_KR": {
        "notifications": {
            "title": "알림",
            "all": "전체",
            "unread": "읽지 않음",
            "mark_all_read": "모두 읽음으로 표시",
            "clear_all": "모두 지우기",
            "no_notifications": "알림 없음",
            "settings": "알림 설정",
            "no_notifications_desc": "여기에서 세션 및 결제에 대한 업데이트를 확인할 수 있습니다",
            "just_now": "방금",
            "hours_ago": "{{count}}시간 전",
            "days_ago": "{{count}}일 전",
            "mark_as_read": "읽음으로 표시",
            "system_update": "시스템 업데이트",
            "platform_improvements": "플랫폼 개선 사항이 성공적으로 배포되었습니다"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "세션 참가",
                "waiting_room_note": "선생님이 대기실에서 입장을 승인합니다"
            }
        }
    },
    "he_IL": {
        "notifications": {
            "title": "התראות",
            "all": "הכל",
            "unread": "לא נקראו",
            "mark_all_read": "סמן הכל כנקרא",
            "clear_all": "נקה הכל",
            "no_notifications": "אין התראות",
            "settings": "הגדרות התראות",
            "no_notifications_desc": "כאן תראה עדכונים על השיעורים והתשלומים שלך",
            "just_now": "עכשיו",
            "hours_ago": "לפני {{count}} שעות",
            "days_ago": "לפני {{count}} ימים",
            "mark_as_read": "סמן כנקרא",
            "system_update": "עדכון מערכת",
            "platform_improvements": "שיפורי הפלטפורמה נפרסו בהצלחה"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "הצטרף לשיעור",
                "waiting_room_note": "המורה יאשר את כניסתך מחדר ההמתנה"
            }
        }
    },
    "te_IN": {
        "notifications": {
            "title": "నోటిఫికేషన్లు",
            "all": "అన్ని",
            "unread": "చదవని",
            "mark_all_read": "అన్ని చదివినట్లు గుర్తించు",
            "clear_all": "అన్ని క్లియర్ చేయి",
            "no_notifications": "నోటిఫికేషన్లు లేవు",
            "settings": "నోటిఫికేషన్ సెట్టింగ్స్",
            "no_notifications_desc": "మీ సెషన్లు మరియు చెల్లింపుల గురించి అప్‌డేట్‌లు ఇక్కడ చూస్తారు",
            "just_now": "ఇప్పుడే",
            "hours_ago": "{{count}} గంటల క్రితం",
            "days_ago": "{{count}} రోజుల క్రితం",
            "mark_as_read": "చదివినట్లు గుర్తించు",
            "system_update": "సిస్టమ్ అప్‌డేట్",
            "platform_improvements": "ప్లాట్‌ఫామ్ మెరుగుదలలు విజయవంతంగా అమలు చేయబడ్డాయి"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "సెషన్‌లో చేరండి",
                "waiting_room_note": "కోచ్ మిమ్మల్ని వెయిటింగ్ రూమ్ నుండి అనుమతిస్తారు"
            }
        }
    },
    "ta_IN": {
        "notifications": {
            "title": "அறிவிப்புகள்",
            "all": "அனைத்தும்",
            "unread": "படிக்கப்படாதவை",
            "mark_all_read": "அனைத்தையும் படித்ததாக குறி",
            "clear_all": "அனைத்தையும் அழி",
            "no_notifications": "அறிவிப்புகள் இல்லை",
            "settings": "அறிவிப்பு அமைப்புகள்",
            "no_notifications_desc": "உங்கள் அமர்வுகள் மற்றும் கட்டணங்கள் பற்றிய புதுப்பிப்புகளை இங்கே காணலாம்",
            "just_now": "இப்போது",
            "hours_ago": "{{count}} மணி நேரம் முன்பு",
            "days_ago": "{{count}} நாட்களுக்கு முன்பு",
            "mark_as_read": "படித்ததாக குறி",
            "system_update": "கணினி புதுப்பிப்பு",
            "platform_improvements": "தளம் மேம்படுத்தல்கள் வெற்றிகரமாக பயன்படுத்தப்பட்டது"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "அமர்வில் சேரவும்",
                "waiting_room_note": "பயிற்சியாளர் உங்களை காத்திருப்பு அறையிலிருந்து அனுமதிப்பார்"
            }
        }
    },
    "mr_IN": {
        "notifications": {
            "title": "सूचना",
            "all": "सर्व",
            "unread": "न वाचलेले",
            "mark_all_read": "सर्व वाचलेले म्हणून चिन्हांकित करा",
            "clear_all": "सर्व साफ करा",
            "no_notifications": "कोणतीही सूचना नाही",
            "settings": "सूचना सेटिंग्ज",
            "no_notifications_desc": "तुमच्या सत्रे आणि पेमेंटबद्दल अपडेट्स येथे दिसतील",
            "just_now": "आत्ताच",
            "hours_ago": "{{count}} तासांपूर्वी",
            "days_ago": "{{count}} दिवसांपूर्वी",
            "mark_as_read": "वाचलेले म्हणून चिन्हांकित करा",
            "system_update": "सिस्टम अपडेट",
            "platform_improvements": "प्लॅटफॉर्म सुधारणा यशस्वीरित्या लागू केल्या"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "सत्रात सामील व्हा",
                "waiting_room_note": "कोच तुम्हाला प्रतीक्षा खोलीतून प्रवेश देईल"
            }
        }
    },
    "gu_IN": {
        "notifications": {
            "title": "સૂચનાઓ",
            "all": "બધા",
            "unread": "વાંચ્યું નથી",
            "mark_all_read": "બધાને વાંચેલ તરીકે ચિહ્નિત કરો",
            "clear_all": "બધું સાફ કરો",
            "no_notifications": "કોઈ સૂચનાઓ નથી",
            "settings": "સૂચના સેટિંગ્સ",
            "no_notifications_desc": "તમારા સત્રો અને ચૂકવણીઓ વિશેના અપડેટ્સ અહીં જોશો",
            "just_now": "હમણાં જ",
            "hours_ago": "{{count}} કલાક પહેલાં",
            "days_ago": "{{count}} દિવસ પહેલાં",
            "mark_as_read": "વાંચેલ તરીકે ચિહ્નિત કરો",
            "system_update": "સિસ્ટમ અપડેટ",
            "platform_improvements": "પ્લેટફોર્મ સુધારાઓ સફળતાપૂર્વક લાગુ કરવામાં આવ્યા"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "સત્રમાં જોડાઓ",
                "waiting_room_note": "કોચ તમને વેઇટિંગ રૂમમાંથી પ્રવેશ આપશે"
            }
        }
    },
    "pa_IN": {
        "notifications": {
            "title": "ਸੂਚਨਾਵਾਂ",
            "all": "ਸਭ",
            "unread": "ਨਹੀਂ ਪੜ੍ਹੀਆਂ",
            "mark_all_read": "ਸਭ ਨੂੰ ਪੜ੍ਹਿਆ ਵਜੋਂ ਚਿੰਨ੍ਹਿਤ ਕਰੋ",
            "clear_all": "ਸਭ ਸਾਫ਼ ਕਰੋ",
            "no_notifications": "ਕੋਈ ਸੂਚਨਾ ਨਹੀਂ",
            "settings": "ਸੂਚਨਾ ਸੈਟਿੰਗਾਂ",
            "no_notifications_desc": "ਤੁਹਾਡੇ ਸੈਸ਼ਨਾਂ ਅਤੇ ਭੁਗਤਾਨਾਂ ਬਾਰੇ ਅੱਪਡੇਟ ਇੱਥੇ ਦਿਖਾਈ ਦੇਣਗੇ",
            "just_now": "ਹੁਣੇ",
            "hours_ago": "{{count}} ਘੰਟੇ ਪਹਿਲਾਂ",
            "days_ago": "{{count}} ਦਿਨ ਪਹਿਲਾਂ",
            "mark_as_read": "ਪੜ੍ਹਿਆ ਵਜੋਂ ਚਿੰਨ੍ਹਿਤ ਕਰੋ",
            "system_update": "ਸਿਸਟਮ ਅੱਪਡੇਟ",
            "platform_improvements": "ਪਲੇਟਫਾਰਮ ਸੁਧਾਰ ਸਫਲਤਾਪੂਰਵਕ ਲਾਗੂ ਕੀਤੇ ਗਏ"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "ਸੈਸ਼ਨ ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਵੋ",
                "waiting_room_note": "ਕੋਚ ਤੁਹਾਨੂੰ ਵੇਟਿੰਗ ਰੂਮ ਤੋਂ ਦਾਖ਼ਲ ਕਰੇਗਾ"
            }
        }
    },
    "kn_IN": {
        "notifications": {
            "title": "ಅಧಿಸೂಚನೆಗಳು",
            "all": "ಎಲ್ಲಾ",
            "unread": "ಓದಿಲ್ಲ",
            "mark_all_read": "ಎಲ್ಲವನ್ನೂ ಓದಿದ ಎಂದು ಗುರುತಿಸಿ",
            "clear_all": "ಎಲ್ಲವನ್ನೂ ತೆರವುಗೊಳಿಸಿ",
            "no_notifications": "ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ",
            "settings": "ಅಧಿಸೂಚನೆ ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
            "no_notifications_desc": "ನಿಮ್ಮ ಸೆಷನ್‌ಗಳು ಮತ್ತು ಪಾವತಿಗಳ ಬಗ್ಗೆ ನವೀಕರಣಗಳನ್ನು ಇಲ್ಲಿ ನೋಡುತ್ತೀರಿ",
            "just_now": "ಈಗಷ್ಟೇ",
            "hours_ago": "{{count}} ಗಂಟೆಗಳ ಹಿಂದೆ",
            "days_ago": "{{count}} ದಿನಗಳ ಹಿಂದೆ",
            "mark_as_read": "ಓದಿದ ಎಂದು ಗುರುತಿಸಿ",
            "system_update": "ಸಿಸ್ಟಮ್ ನವೀಕರಣ",
            "platform_improvements": "ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಸುಧಾರಣೆಗಳು ಯಶಸ್ವಿಯಾಗಿ ನಿಯೋಜಿಸಲಾಗಿದೆ"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "ಸೆಷನ್‌ಗೆ ಸೇರಿ",
                "waiting_room_note": "ಕೋಚ್ ನಿಮ್ಮನ್ನು ನಿರೀಕ್ಷಣಾ ಕೊಠಡಿಯಿಂದ ಸೇರಿಸುತ್ತಾರೆ"
            }
        }
    },
    "ml_IN": {
        "notifications": {
            "title": "അറിയിപ്പുകൾ",
            "all": "എല്ലാം",
            "unread": "വായിക്കാത്തവ",
            "mark_all_read": "എല്ലാം വായിച്ചതായി അടയാളപ്പെടുത്തുക",
            "clear_all": "എല്ലാം മായ്ക്കുക",
            "no_notifications": "അറിയിപ്പുകളില്ല",
            "settings": "അറിയിപ്പ് ക്രമീകരണങ്ങൾ",
            "no_notifications_desc": "നിങ്ങളുടെ സെഷനുകളെയും പേയ്‌മെന്റുകളെയും കുറിച്ചുള്ള അപ്‌ഡേറ്റുകൾ ഇവിടെ കാണാം",
            "just_now": "ഇപ്പോൾ",
            "hours_ago": "{{count}} മണിക്കൂർ മുമ്പ്",
            "days_ago": "{{count}} ദിവസം മുമ്പ്",
            "mark_as_read": "വായിച്ചതായി അടയാളപ്പെടുത്തുക",
            "system_update": "സിസ്റ്റം അപ്‌ഡേറ്റ്",
            "platform_improvements": "പ്ലാറ്റ്‌ഫോം മെച്ചപ്പെടുത്തലുകൾ വിജയകരമായി വിന്യസിച്ചു"
        },
        "pages": {
            "booking_detail": {
                "join_meeting": "സെഷനിൽ ചേരുക",
                "waiting_room_note": "കോച്ച് നിങ്ങളെ വെയിറ്റിംഗ് റൂമിൽ നിന്ന് പ്രവേശിപ്പിക്കും"
            }
        }
    }
}

def deep_update(base_dict, update_dict):
    """Recursively update nested dictionaries"""
    for key, value in update_dict.items():
        if isinstance(value, dict) and key in base_dict and isinstance(base_dict[key], dict):
            deep_update(base_dict[key], value)
        else:
            base_dict[key] = value

def update_locale_file(locale_code, translations):
    """Update a specific locale file with translations"""
    file_path = os.path.join(LOCALES_DIR, f"{locale_code}.json")
    
    if not os.path.exists(file_path):
        print(f"Warning: {file_path} does not exist")
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Deep merge the translations
    deep_update(data, translations)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Updated {locale_code}.json")

def main():
    print("Starting locale translation update...")
    
    for locale_code, translations in TRANSLATIONS.items():
        update_locale_file(locale_code, translations)
    
    print("\nDone! All locale files have been updated with translations.")

if __name__ == "__main__":
    main()
