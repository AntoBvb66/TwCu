import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 1. Tüm dil dosyalarını içe aktar (import)
import translationTR from './locales/tr/translation.json';
import translationEN from './locales/en/translation.json';
import translationHR from './locales/hr/translation.json';
import translationCZ from './locales/cz/translation.json';
import translationDK from './locales/dk/translation.json';
import translationNL from './locales/nl/translation.json';
import translationFR from './locales/fr/translation.json';
import translationDE from './locales/de/translation.json';
import translationGR from './locales/gr/translation.json';
import translationHU from './locales/hu/translation.json';
import translationIT from './locales/it/translation.json';
import translationNO from './locales/no/translation.json';
import translationPL from './locales/pl/translation.json';
import translationBR from './locales/br/translation.json';
import translationPT from './locales/pt/translation.json';
import translationRO from './locales/ro/translation.json';
import translationRU from './locales/ru/translation.json';
import translationSK from './locales/sk/translation.json';
import translationSI from './locales/si/translation.json';
import translationES from './locales/es/translation.json';
import translationSE from './locales/se/translation.json';
import translationCH from './locales/ch/translation.json';
import translationTH from './locales/th/translation.json';
import translationUA from './locales/ua/translation.json';

// 2. Kaynakları i18next formatında tanımla
const resources = {
  tr: { translation: translationTR },
  en: { translation: translationEN },
  hr: { translation: translationHR },
  cz: { translation: translationCZ },
  dk: { translation: translationDK },
  nl: { translation: translationNL },
  fr: { translation: translationFR },
  de: { translation: translationDE },
  gr: { translation: translationGR },
  hu: { translation: translationHU },
  it: { translation: translationIT },
  no: { translation: translationNO },
  pl: { translation: translationPL },
  br: { translation: translationBR },
  pt: { translation: translationPT },
  ro: { translation: translationRO },
  ru: { translation: translationRU },
  sk: { translation: translationSK },
  si: { translation: translationSI },
  es: { translation: translationES },
  se: { translation: translationSE },
  ch: { translation: translationCH },
  th: { translation: translationTH },
  ua: { translation: translationUA }
};

// Daha önce seçilen dili Local Storage'dan al, yoksa Türkçe başla
const savedLanguage = localStorage.getItem('appLanguage') || 'tr';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage, 
    fallbackLng: 'en', // Bilinmeyen bir dil gelirse İngilizce aç
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;