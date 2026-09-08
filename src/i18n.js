import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// ---------------------------------------------------------------------------
// DİL YÜKLEME
//
// Önceden dil dosyalarının tamamı ana pakete gömülüyordu (~1 MB). Artık
// sadece kullanılan dil indiriliyor, diğerleri ihtiyaç anında yükleniyor.
// Vite bu glob'u derleme sırasında ayrı parçalara böler.
// ---------------------------------------------------------------------------

const localeLoaders = import.meta.glob('./locales/*/translation.json');

export const SUPPORTED_LANGUAGES = [
    'tr', 'en', 'hr', 'cz', 'dk', 'nl', 'fr', 'de', 'gr', 'hu', 'it', 'no',
    'pl', 'br', 'pt', 'ro', 'ru', 'sk', 'si', 'es', 'se', 'ch', 'th', 'ua',
    'ar',
];

const loadLocale = async (lng) => {
    const loader = localeLoaders[`./locales/${lng}/translation.json`];
    if (!loader) return null;
    const mod = await loader();
    return mod.default || mod;
};

/** Sağdan sola yazılan diller. */
const RTL_LANGUAGES = ['ar'];

/** i18next kodundan HTML `lang` özniteliğinin değerini üretir. */
const htmlLang = (lng) => (lng === 'br' ? 'pt' : lng);

/** <html> üzerindeki `lang` ve `dir` özniteliklerini dile göre ayarlar. */
const applyDocumentLanguage = (lng) => {
    document.documentElement.lang = htmlLang(lng);
    document.documentElement.dir = RTL_LANGUAGES.includes(lng) ? 'rtl' : 'ltr';
};

/** Bir dili (ve gerekiyorsa yedek dili) yükleyip i18next'e ekler. */
export const ensureLanguage = async (lng) => {
    if (!SUPPORTED_LANGUAGES.includes(lng)) lng = 'en';

    if (!i18n.hasResourceBundle(lng, 'translation')) {
        const resource = await loadLocale(lng);
        if (resource) i18n.addResourceBundle(lng, 'translation', resource, true, true);
    }

    // Eksik anahtarlar İngilizceye düşsün diye yedek dil de hazır olmalı.
    if (lng !== 'en' && !i18n.hasResourceBundle('en', 'translation')) {
        const fallback = await loadLocale('en');
        if (fallback) i18n.addResourceBundle('en', 'translation', fallback, true, true);
    }

    return lng;
};

/** Dili değiştirir; gerekirse önce dosyasını indirir. */
export const changeAppLanguage = async (lng) => {
    const resolved = await ensureLanguage(lng);
    localStorage.setItem('appLanguage', resolved);
    applyDocumentLanguage(resolved);
    return i18n.changeLanguage(resolved);
};

/** Tarayıcı dilini destekliyorsak onu seç, yoksa İngilizce. */
const detectLanguage = () => {
    const saved = localStorage.getItem('appLanguage');
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;

    const browser = (navigator.language || 'en').toLowerCase();
    const primary = browser.split('-')[0];

    // Tarayıcı kodu ile bizim kodumuz farklı olan diller
    const aliases = {
        cs: 'cz', da: 'dk', el: 'gr', nb: 'no', nn: 'no', sv: 'se',
        sl: 'si', uk: 'ua', 'pt-br': 'br',
    };

    if (aliases[browser]) return aliases[browser];
    if (aliases[primary]) return aliases[primary];
    if (SUPPORTED_LANGUAGES.includes(primary)) return primary;
    return 'en';
};

const initialLanguage = detectLanguage();

applyDocumentLanguage(initialLanguage);

i18n
    .use(initReactI18next)
    .init({
        resources: {},
        lng: initialLanguage,
        fallbackLng: 'en', // Bilinmeyen bir anahtar gelirse İngilizceye düş
        supportedLngs: SUPPORTED_LANGUAGES,
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        },
    });

/**
 * Açılışta sadece seçili dil (+ gerekiyorsa İngilizce yedek) indirilir.
 * index.jsx bu söz (promise) çözülünce uygulamayı çizer; böylece ilk karede
 * çeviri yerine ham anahtar görünmez.
 */
export const i18nReady = ensureLanguage(initialLanguage).catch((err) => {
    console.error('Dil dosyası yüklenemedi:', err);
});

export default i18n;
