// NotificationSettings.jsx

import React, { useEffect, useState } from 'react';
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { useTranslation } from 'react-i18next'; // i18n import edildi
import './NotificationSettings.css';

const IconGains = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const IconLosses = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 7 10.5 15.5 15.5 10.5 22 17" />
    <polyline points="8 17 2 17 2 11" />
  </svg>
);

const IconBarbarian = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L5 5v6c0 5 3.5 8 7 11 3.5-3 7-6 7-11V5L12 2z" />
    <circle cx="9" cy="10" r="1" fill="currentColor" />
    <circle cx="15" cy="10" r="1" fill="currentColor" />
    <path d="M9 14c1.5 1 4.5 1 6 0" />
    <path d="M5 5c-1-1-2-1-3 0" />
    <path d="M19 5c1-1 2-1 3 0" />
  </svg>
);

const IconSelf = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 14h5a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h5" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconInternal = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const IconEye = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const IconCheckAll = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="7 13 12 18 22 8" />
    <polyline points="2 13 7 18 12 13" />
  </svg>
);

const IconChevronDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconChevronUp = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const IconMap = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6" />
    <line x1="8" y1="3" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="21" />
  </svg>
);

const initialFilters = {
  gains: false,
  losses: false,
  barbarian: false,
  selfConquer: false,
  internal: false
};

const languages = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
  { code: 'hr', label: 'Hrvatski' },
  { code: 'cz', label: 'Čeština' },
  { code: 'dk', label: 'Dansk' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'gr', label: 'Ελληνικά' },
  { code: 'hu', label: 'Magyar' },
  { code: 'it', label: 'Italiano' },
  { code: 'no', label: 'Norsk' },
  { code: 'pl', label: 'Polski' },
  { code: 'br', label: 'Português (BR)' },
  { code: 'pt', label: 'Português (PT)' },
  { code: 'ro', label: 'Română' },
  { code: 'ru', label: 'Русский' },
  { code: 'sk', label: 'Slovenčina' },
  { code: 'si', label: 'Slovenščina' },
  { code: 'es', label: 'Español' },
  { code: 'se', label: 'Svenska' },
  { code: 'ch', label: 'Schweizerdeutsch' },
  { code: 'th', label: 'ไทย' },
  { code: 'ua', label: 'Українська' }
];

const createEmptyConfig = () => ({
  uiId: Date.now() + Math.random(),
  isExpanded: true,
  profileName: '',
  globalSettings: { specialId: '', worldUrl: '', botToken: '', chatId: '', language: 'tr' },
  // Hedef Yönetimi
  entities: [],
  newName: '',
  newFilters: { ...initialFilters },

  // Kıta ve Full Takip
  selectedContinents: '',        // "1,2,15" gibi virgülle ayrılmış
  fullTracking: false,

});

const NotificationSettings = () => {
  const { t } = useTranslation('translation', { keyPrefix: 'notificationSettings' });

  // Filtre tanımlamaları çeviriye erişebilmek için bileşen içine alındı
  const filterDefinitions = {
    gains: { label: t('filters.gains'), icon: <IconGains /> },
    losses: { label: t('filters.losses'), icon: <IconLosses /> },
    barbarian: { label: t('filters.barbarian'), icon: <IconBarbarian /> },
    selfConquer: { label: t('filters.selfConquer'), icon: <IconSelf /> },
    internal: { label: t('filters.internal'), icon: <IconInternal /> }
  };

  // --- STATE YÖNETİMİ ---
  const [configs, setConfigs] = useState(() => {
    const savedConfigs = localStorage.getItem('twcu_configs_multi');
    if (savedConfigs) return JSON.parse(savedConfigs);

    const oldGlobal = localStorage.getItem('twcu_globalSettings');
    if (oldGlobal) {
      return [{
        ...createEmptyConfig(),
        profileName: t('profile.mainProfile'), // Çeviri kullanıldı
        globalSettings: JSON.parse(oldGlobal),
        entities: JSON.parse(localStorage.getItem('twcu_entities')) || [],
      }];
    }

    return [createEmptyConfig()];
  });

  const [showSecrets, setShowSecrets] = useState({});
  const [showInfoPanel, setShowInfoPanel] = useState(() => {
    const saved = localStorage.getItem('twcu_infoPanel');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => { localStorage.setItem('twcu_configs_multi', JSON.stringify(configs)); }, [configs]);
  useEffect(() => { localStorage.setItem('twcu_infoPanel', JSON.stringify(showInfoPanel)); }, [showInfoPanel]);

  // --- YARDIMCI FONKSİYONLAR ---
  const updateConfig = (cIndex, field, subField, value) => {
    setConfigs(prev => prev.map((c, i) => {
      if (i !== cIndex) return c;
      if (subField) return { ...c, [field]: { ...c[field], [subField]: value } };
      return { ...c, [field]: value };
    }));
  };

  const toggleSecret = (id) => setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleAccordion = (cIndex) => { setConfigs(prev => prev.map((c, i) => i === cIndex ? { ...c, isExpanded: !c.isExpanded } : c)); };

  const addNewProfile = () => {
    setConfigs(prev => {
      const collapsedPrev = prev.map(c => ({ ...c, isExpanded: false }));
      return [...collapsedPrev, createEmptyConfig()];
    });
  };

  const removeProfile = (cIndex) => {
    if (window.confirm(t('alerts.confirmDeleteProfile'))) {
      setConfigs(prev => prev.filter((_, i) => i !== cIndex));
    }
  };

  const generateSpecialId = (cIndex, currentId) => {
    if (currentId && currentId.length > 0) {
      alert(t('alerts.idExists'));
      return;
    }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><,-=";
    let newId = "";
    for (let i = 0; i < 66; i++) newId += chars.charAt(Math.floor(Math.random() * chars.length));
    updateConfig(cIndex, 'globalSettings', 'specialId', newId);
  };

  const getWorldName = (url) => {
    if (!url) return t('profile.unknownWorld');
    try { return new URL(url).hostname.split('.')[0].toUpperCase(); }
    catch { return t('profile.unknownWorld'); }
  };

  // --- ENTITY (HEDEF) İŞLEMLERİ ---
  const handleSelectAllFilters = (cIndex, currentFilters) => {
    // filterDefinitions objesindeki tüm anahtarları (gains, losses, anlikTakip vb.) alıyoruz
    const allKeys = Object.keys(filterDefinitions);

    // Şu an hepsi seçili mi diye kontrol ediyoruz
    const allSelected = allKeys.every(key => currentFilters[key] === true);

    // Yeni durumu belirliyoruz (hepsi seçiliyse hepsini false, değilse true yap)
    const newF = {};
    allKeys.forEach(key => {
      newF[key] = !allSelected;
    });

    // State'i tüm filtreleri içerecek şekilde güncelliyoruz
    updateConfig(cIndex, 'newFilters', null, newF);
  };
  const handleAddEntity = (cIndex, type, newName, currentFilters, currentEntities) => {
    if (!newName.trim()) { alert(t('alerts.emptyTargetName')); return; }

    let namesArray = newName.split(',').map(n => n.trim()).filter(n => n !== '');
    if (namesArray.length === 0) return;
    namesArray = [...new Set(namesArray)];

    const uniqueNames = namesArray.filter(name => {
      const isDuplicate = currentEntities.some(ent => ent.type === type && ent.name.toLowerCase() === name.toLowerCase());
      return !isDuplicate;
    });

    if (uniqueNames.length === 0) {
      alert(t('alerts.targetExists'));
      return;
    }

    const newEntries = uniqueNames.map((name, index) => ({
      id: Date.now() + index,
      type: type,
      name: name,
      filters: { ...currentFilters }
    }));

    updateConfig(cIndex, 'entities', null, [...newEntries, ...currentEntities]);
    updateConfig(cIndex, 'newName', null, '');
    updateConfig(cIndex, 'newFilters', null, { ...initialFilters });
  };

  const handleToggleEntityFilter = (cIndex, entityId, filterKey, currentEntities) => {
    const updated = currentEntities.map(ent =>
      ent.id === entityId ? { ...ent, filters: { ...ent.filters, [filterKey]: !ent.filters[filterKey] } } : ent
    );
    updateConfig(cIndex, 'entities', null, updated);
  };

  const handleRemoveEntity = (cIndex, entityId, currentEntities) => {
    updateConfig(cIndex, 'entities', null, currentEntities.filter(ent => ent.id !== entityId));
  };

  const validateAndAddEntity = async (cIndex, config, type) => {
    // 1. Input Boş mu Kontrolü
    const targetName = config.newName?.trim();
    if (!targetName) {
      alert(t('alerts.enterPlayerOrTribe'));
      return;
    }

    // 🔥 DÜZELTİLEN KISIM: Senin state yapına (globalSettings.worldUrl) uygun hale getirildi 🔥
    const worldUrl = config.globalSettings?.worldUrl || "https://tr1.klanlar.org";
    const cleanUrl = worldUrl.replace(/\/$/, "");

    let allyData = "";
    let playerData = "";

    const now = Date.now();
    const lastFetch = parseInt(localStorage.getItem("mg_last_fetch") || "0");
    const lastUrl = localStorage.getItem("mg_last_url");

    let cachedData = null;
    try {
      cachedData = JSON.parse(localStorage.getItem("mg_cache_data"));
    } catch (e) { }

    // 2. Veri Çekme veya Cache'den Okuma
    if (cachedData && cachedData.ally && cachedData.player && lastUrl === cleanUrl && (now - lastFetch < 3600000)) {
      allyData = cachedData.ally;
      playerData = cachedData.player;
    } else {
      try {
        const fetchWithProxy = async (targetUrl) => {
          const res = await fetch(`https://tw-proxy.halimtttt10.workers.dev/?url=${encodeURIComponent(targetUrl)}`);
          if (!res.ok) throw new Error("Ağ Hatası");
          return await res.text();
        };

        allyData = await fetchWithProxy(`${cleanUrl}/map/ally.txt`);
        playerData = await fetchWithProxy(`${cleanUrl}/map/player.txt`);

        const newData = { ...(cachedData || {}), ally: allyData, player: playerData };
        localStorage.setItem("mg_cache_data", JSON.stringify(newData));
        localStorage.setItem("mg_last_fetch", now.toString());
        localStorage.setItem("mg_last_url", cleanUrl);
      } catch (error) {
        alert(t('alerts.worldDataFetchError'));
        return;
      }
    }

    // 3. Bozuk Veri Kontrolü
    if (!playerData || !playerData.includes(',') || playerData.includes('<html')) {
      console.error("Gelen Hatalı Veri:", playerData.substring(0, 150));
      alert(t('alerts.worldDataReadError'));
      localStorage.removeItem("mg_cache_data");
      return;
    }

    // 4. Akıllı Arama Mantığı
    const searchTarget = cleanString(targetName);
    let exists = false;
    let officialName = "";

    const textToSearch = type === 'Player' ? playerData : allyData;
    const lines = textToSearch.split('\n').map(line => line.trim());

    for (let line of lines) {
      if (!line) continue;
      const cols = line.split(',');
      if (cols.length < 3) continue;

      if (type === 'Player') {
        const rawName = decodeTW(cols[1]);
        if (cleanString(rawName) === searchTarget) {
          exists = true;
          officialName = rawName;
          break;
        }
      } else {
        const rawName = decodeTW(cols[1]);
        const rawTag = decodeTW(cols[2]);
        if (cleanString(rawTag) === searchTarget || cleanString(rawName) === searchTarget) {
          exists = true;
          officialName = rawTag;
          break;
        }
      }
    }

    // 5. Sonuç Ekranı
    if (!exists) {
      alert(type === 'Player'
        ? t('alerts.playerNotFound', { name: targetName })
        : t('alerts.tribeNotFound', { name: targetName })
      );
      return;
    }

    // 6. Her Şey Başarılıysa Orijinal İsimle Ekle
    handleAddEntity(cIndex, type, officialName, config.newFilters, config.entities);
    updateConfig(cIndex, 'newName', null, '');
  };

  const handleToggleVisibility = (cIndex, entityId, currentEntities) => {
    const updatedEntities = currentEntities.map(ent =>
      ent.id === entityId ? { ...ent, isHidden: !ent.isHidden } : ent
    );
    // Senin sistemindeki state güncelleme fonksiyonu:
    updateConfig(cIndex, 'entities', null, updatedEntities);
  };

  // Klanlar verisinde '+' işareti boşluk demektir. Önce onu %20 yapıp sonra decode etmek en garantisidir.
  const decodeTW = (str) => {
    if (!str) return "";
    try {
      return decodeURIComponent(str.replace(/\+/g, '%20'));
    } catch (e) {
      return str.replace(/\+/g, ' ');
    }
  };

  // Karşılaştırma yaparken hataları (fazla boşluk, büyük/küçük harf) sıfıra indirir
  const cleanString = (str) => {
    if (!str) return "";
    return str.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
  };


  // === 2. ÖZEL HARİTA İSTATİSTİKLERİ DOĞRULAYICI ===
  const validateAndAddHighlight = async (cIndex, config) => {
    const targetName = config.newHighlightName?.trim();
    if (!targetName) {
      alert(t('alerts.enterHighlightName'));
      return;
    }

    const type = config.newHighlightType; // 'Player' veya 'Tribe'
    const worldUrl = config.globalSettings?.worldUrl || "https://tr1.klanlar.org";
    const cleanUrl = worldUrl.replace(/\/$/, "");

    // --- Veri Çekme / Cache Kontrolü (Ortak) ---
    const now = Date.now();
    const lastFetch = parseInt(localStorage.getItem("mg_last_fetch") || "0");
    const lastUrl = localStorage.getItem("mg_last_url");
    let targetData = "";
    let cachedData = null;

    try { cachedData = JSON.parse(localStorage.getItem("mg_cache_data")); } catch (e) { }

    if (cachedData && cachedData.ally && cachedData.player && lastUrl === cleanUrl && (now - lastFetch < 3600000)) {
      targetData = type === 'Player' ? cachedData.player : cachedData.ally;
    } else {
      try {
        const fetchWithProxy = async (targetUrl) => {
          const res = await fetch(`https://tw-proxy.halimtttt10.workers.dev/?url=${encodeURIComponent(targetUrl)}`);
          if (!res.ok) throw new Error("Ağ Hatası");
          return await res.text();
        };
        const allyData = await fetchWithProxy(`${cleanUrl}/map/ally.txt`);
        const playerData = await fetchWithProxy(`${cleanUrl}/map/player.txt`);

        targetData = type === 'Player' ? playerData : allyData;

        const newData = { ...(cachedData || {}), ally: allyData, player: playerData };
        localStorage.setItem("mg_cache_data", JSON.stringify(newData));
        localStorage.setItem("mg_last_fetch", now.toString());
        localStorage.setItem("mg_last_url", cleanUrl);
      } catch (error) {
        alert(t('alerts.worldDataFetchErrorShort'));
        return;
      }
    }

    // --- Arama Mantığı ---
    const searchTarget = cleanString(targetName);
    let exists = false;
    let officialName = "";
    const lines = targetData.split('\n').map(line => line.trim());

    for (let line of lines) {
      if (!line) continue;
      const cols = line.split(',');
      if (cols.length < 3) continue;

      if (type === 'Player') {
        const rawName = decodeTW(cols[1]);
        if (cleanString(rawName) === searchTarget) {
          exists = true;
          officialName = rawName;
          break;
        }
      } else {
        const rawName = decodeTW(cols[1]);
        const rawTag = decodeTW(cols[2]);
        if (cleanString(rawTag) === searchTarget || cleanString(rawName) === searchTarget) {
          exists = true;
          officialName = rawTag;
          break;
        }
      }
    }

    if (!exists) {
      alert(type === 'Player'
        ? t('alerts.playerNotFound', { name: targetName })
        : t('alerts.tribeNotFound', { name: targetName })
      );
      return;
    }

  };




  const handleAddContinent = (cIndex, config) => {
    const cont = config.newContinent?.trim();
    if (!cont) return;

    // Sadece 0 ile 99 arası geçerli bir kıta numarası mı kontrolü
    if (isNaN(cont) || parseInt(cont) < 0 || parseInt(cont) > 99) {
      alert(t('alerts.invalidContinent'));
      return;
    }

    // Mevcut virgüllü string'i diziye çevir
    const currentArray = config.selectedContinents
      ? config.selectedContinents.split(',').map(s => s.trim()).filter(s => s)
      : [];

    if (currentArray.includes(cont)) {
      alert(t('alerts.continentAlreadyAdded'));
      return;
    }

    // Yeni kıtayı ekle ve tekrar virgüllü string'e çevirerek kaydet
    currentArray.push(cont);
    updateConfig(cIndex, 'selectedContinents', null, currentArray.join(','));

    // Eklendikten sonra kutucuğu temizle
    updateConfig(cIndex, 'newContinent', null, '');
  };

  const handleRemoveContinent = (cIndex, contToRemove, config) => {
    const currentArray = config.selectedContinents
      ? config.selectedContinents.split(',').map(s => s.trim()).filter(s => s)
      : [];

    // İlgili kıtayı diziden çıkar ve tekrar string olarak kaydet
    const updatedArray = currentArray.filter(c => c !== contToRemove);
    updateConfig(cIndex, 'selectedContinents', null, updatedArray.join(','));
  };

  // --- KAYDETME İŞLEMİ (ÇOKLU) ---
  const generateConfigPayload = (config) => ({
    global_settings: {
      profile_name: config.profileName.trim(),
      special_access_id: config.globalSettings.specialId || "[EMPTY]",
      world_link: config.globalSettings.worldUrl || "[EMPTY]",
      telegram_bot_token: config.globalSettings.botToken || "[EMPTY]",
      telegram_chat_id: config.globalSettings.chatId || "[EMPTY]",
      language: config.globalSettings.language || "tr"
    },
    // Hedef bazlı filtreler
    monitored_players: config.entities.filter(e => e.type === 'Player').map(p => ({
      name: p.name,
      active_filters: Object.keys(p.filters).filter(k => p.filters[k])
    })),
    monitored_tribes: config.entities.filter(e => e.type === 'Tribe').map(t => ({
      tag: t.name,
      active_filters: Object.keys(t.filters).filter(k => t.filters[k])
    })),

    // ── Global takip ayarları ──
    continent_tracking: config.selectedContinents || '',
    full_tracking: config.fullTracking || false

  });

  const handleSave = async () => {
    let successCount = 0;
    let errorCount = 0;
    let newLicensesToAdd = [];

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const specialId = config.globalSettings.specialId?.trim();
      const profileName = config.profileName?.trim();

      if (!profileName && !specialId && config.entities.length === 0) continue;

      if (!profileName) {
        // İndeks numarasını değişken olarak gönderiyoruz
        alert(t('alerts.profileNameEmpty', { index: i + 1 }));
        return;
      }

      if (!specialId || specialId === "[EMPTY]") {
        // Profil adını değişken olarak gönderiyoruz
        alert(t('alerts.specialIdEmpty', { name: profileName }));
        return;
      }

      try {
        const payload = generateConfigPayload(config);
        const userRef = doc(db, "users", specialId);
        await setDoc(userRef, payload, { merge: true });
        successCount++;
        newLicensesToAdd.push(specialId);
      } catch (error) {
        console.error("Kayıt hatası: ", error);
        errorCount++;
      }
    }

    if (newLicensesToAdd.length > 0) {
      try {
        const licenseRef = doc(db, "admin_system", "licenses");
        // arrayUnion: Sadece diziye ekler, zaten varsa mükerrer eklemez
        await setDoc(licenseRef, {
          valid_keys: arrayUnion(...newLicensesToAdd)
        }, { merge: true });
      } catch (licenseError) {
        console.error("Lisans otomatik ekleme hatası: ", licenseError);
      }
    }

    if (successCount > 0) alert(t('alerts.saveSuccess', { count: successCount }));
    if (errorCount > 0) alert(t('alerts.saveError', { count: errorCount }));
    if (successCount === 0 && errorCount === 0) alert(t('alerts.saveNoData'));
  };

  return (
    <div className="twcu-container">
      <div className="twcu-panel">
        <div className="twcu-header-container">
          <div className="twcu-header-main">
            <h2 className="twcu-header">{t('header.title')}</h2>
            <p className="twcu-subtitle">{t('header.subtitle')}</p>
          </div>

          <button
            onClick={() => setShowInfoPanel(!showInfoPanel)}
            className="twcu-info-btn"
          >
            <IconInfo />
            <span>{showInfoPanel ? t('header.hideInfo') : t('header.showInfo')}</span>
          </button>
        </div>

        {/* --- BİLGİLENDİRME PANELİ --- */}
        {showInfoPanel && (
          <div style={{
            backgroundColor: '#262626',
            borderLeft: '4px solid #ef4444',
            padding: '16px 24px',
            marginBottom: '24px',
            borderRadius: '0 8px 8px 0',
            fontSize: '14px',
            color: '#d1d5db',
            lineHeight: '1.7',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#ffffff', fontSize: '18px', fontWeight: '600' }}>
              {t('infoPanel.title')}
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Temel Ayarlar */}
              <ul style={{ margin: 0, paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong style={{ color: '#ffffff' }}>{t('infoPanel.profileNameTitle')}</strong> <span dangerouslySetInnerHTML={{ __html: t('infoPanel.profileNameDesc') }} /></li>
                <li><strong style={{ color: '#ffffff' }}>{t('infoPanel.specialIdTitle')}</strong> <span dangerouslySetInnerHTML={{ __html: t('infoPanel.specialIdDesc') }} /></li>
                <li><strong style={{ color: '#ffffff' }}>{t('infoPanel.worldLinkTitle')}</strong> <span dangerouslySetInnerHTML={{ __html: t('infoPanel.worldLinkDesc') }} /></li>
                <li><strong style={{ color: '#ffffff' }}>{t('infoPanel.botTokenTitle')}</strong> <span dangerouslySetInnerHTML={{ __html: t('infoPanel.botTokenDesc') }} /></li>
              </ul>

              {/* Yeni Özellikler Ayırıcı */}
              <div style={{ height: '1px', backgroundColor: '#404040', margin: '4px 0' }}></div>

              {/* Takip ve Modüller */}
              <ul style={{ margin: 0, paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li><strong style={{ color: '#e6c43e' }}>{t('infoPanel.filtersInfo')}</strong>{t('infoPanel.filtersInfoDesc')}</li>
                <li><strong style={{ color: '#facc15' }}>{t('infoPanel.continentTrackingTitle')}</strong> {t('infoPanel.continentTrackingDesc')}</li>
                <li><strong style={{ color: '#fb923c' }}>{t('infoPanel.fullTrackingTitle')}</strong> <span dangerouslySetInnerHTML={{ __html: t('infoPanel.fullTrackingDesc') }} /></li>
              </ul>
            </div>

          </div>
        )}

        {/* --- AKORDEON DÖNGÜSÜ --- */}
        {configs.map((config, cIndex) => (
          <div key={config.uiId} style={{ marginBottom: '20px', border: '1px solid #444', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#1e1e1e' }}>

            <div
              style={{ padding: '15px 20px', backgroundColor: '#2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: config.isExpanded ? '1px solid #444' : 'none' }}
              onClick={() => toggleAccordion(cIndex)}
            >
              <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#ff4d4d' }}>⚙️ {config.profileName || `${t('profile.newProfile')} ${cIndex + 1}`}</span>
                <span style={{ color: '#888', fontSize: '14px' }}>({getWorldName(config.globalSettings.worldUrl)})</span>
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); removeProfile(cIndex); }}
                  style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}
                >
                  {t('profile.delete')}
                </button>
                {config.isExpanded ? <IconChevronUp /> : <IconChevronDown />}
              </div>
            </div>

            {config.isExpanded && (
              <div style={{ padding: '20px' }}>

                {/* PROFIL & GLOBAL SETTINGS */}
                <div className="section-block">
                  <h3 className="section-title">{t('settings.basicSettings')}</h3>

                  <div className="settings-grid">

                    {/* --- 1. Profile Name Field --- */}
                    <div className="form-group">
                      <label>
                        {t('settings.profileNameLabel')}
                        <span className="required-badge">{t('settings.required')}</span>
                      </label>
                      <input
                        type="text"
                        className={`twcu-input ${!config.profileName ? 'is-invalid' : ''}`}
                        placeholder={t('settings.profileNamePlaceholder')}
                        value={config.profileName}
                        onChange={(e) => updateConfig(cIndex, 'profileName', null, e.target.value)}
                      />
                      {!config.profileName && (
                        <small className="error-msg">{t('settings.fieldCannotBeEmpty')}</small>
                      )}
                    </div>

                    {/* --- 2. Special ID Field (Gizle/Göster ve Üret Butonu) --- */}
                    <div className="form-group">
                      <label>
                        {t('settings.specialIdLabel')}
                        <span className="required-badge">{t('settings.required')}</span>
                      </label>
                      <div className="flex-row-group">
                        <div className="input-wrapper">
                          <input
                            type={showSecrets[`${config.uiId}_id`] ? "text" : "password"}
                            className="twcu-input has-icon is-monospace"
                            placeholder={t('settings.specialIdPlaceholder')}
                            value={config.globalSettings.specialId}
                            onChange={(e) => updateConfig(cIndex, 'globalSettings', 'specialId', e.target.value)}
                          />
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => toggleSecret(`${config.uiId}_id`)}
                          >
                            {showSecrets[`${config.uiId}_id`] ? <IconEyeOff /> : <IconEye />}
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn-generate"
                          disabled={!!config.globalSettings.specialId}
                          onClick={() => generateSpecialId(cIndex, config.globalSettings.specialId)}
                        >
                          ⚙️ {t('settings.generateIdBtn')}
                        </button>
                      </div>
                    </div>

                    {/* --- 3. World Link Field --- */}
                    <div className="form-group">
                      <label>{t('settings.worldLinkLabel')}</label>
                      <input
                        type="url"
                        className="twcu-input"
                        placeholder={t('settings.worldLinkPlaceholder')}
                        value={config.globalSettings.worldUrl}
                        onChange={(e) => updateConfig(cIndex, 'globalSettings', 'worldUrl', e.target.value)}
                      />
                    </div>

                    {/* --- DİL SEÇİMİ (24 DİL) --- */}
                    <div className="form-group">
                      <label>{t('settings.languageLabel') || "Rapor Dili"}</label>
                      <select
                        className="twcu-input"
                        value={config.globalSettings.language || 'tr'}
                        onChange={(e) => updateConfig(cIndex, 'globalSettings', 'language', e.target.value)}
                        style={{ cursor: 'pointer' }}
                      >
                        {languages.map(lang => (
                          <option key={lang.code} value={lang.code}>
                            {lang.label} ({lang.code.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* --- 4. Bot Token Field (Gizle/Göster Var) --- */}
                    <div className="form-group">
                      <label>{t('settings.botTokenLabel')}</label>
                      <div className="input-wrapper">
                        <input
                          type={showSecrets[`${config.uiId}_bot`] ? "text" : "password"}
                          className="twcu-input has-icon"
                          placeholder={t('settings.botTokenPlaceholder')}
                          value={config.globalSettings.botToken}
                          onChange={(e) => updateConfig(cIndex, 'globalSettings', 'botToken', e.target.value)}
                        />
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => toggleSecret(`${config.uiId}_bot`)}
                        >
                          {showSecrets[`${config.uiId}_bot`] ? <IconEyeOff /> : <IconEye />}
                        </button>
                      </div>
                    </div>

                    {/* --- 5. Chat ID Field (Gizle/Göster Var) --- */}
                    <div className="form-group">
                      <label>{t('settings.chatIdLabel')}</label>
                      <div className="input-wrapper">
                        <input
                          type={showSecrets[`${config.uiId}_chat`] ? "text" : "password"}
                          className="twcu-input has-icon"
                          placeholder={t('settings.chatIdPlaceholder')}
                          value={config.globalSettings.chatId}
                          onChange={(e) => updateConfig(cIndex, 'globalSettings', 'chatId', e.target.value)}
                        />
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => toggleSecret(`${config.uiId}_chat`)}
                        >
                          {showSecrets[`${config.uiId}_chat`] ? <IconEyeOff /> : <IconEye />}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                {/* ADD NEW TARGET */}
                <div className="section-block target-section">
                  <h3 className="section-title">{t('targets.addNewTarget')}</h3>

                  <div className="form-group target-input-group">
                    <label className="input-label">{t('targets.inputLabel')}</label>
                    <input
                      type="text"
                      className="twcu-input modern-input"
                      placeholder={t('targets.inputPlaceholder')}
                      value={config.newName}
                      onChange={(e) => updateConfig(cIndex, 'newName', null, e.target.value)}
                    />
                  </div>

                  <div className="filter-selection-area">
                    <label className="input-label">{t('targets.selectFilters')}</label>
                    <div className="modern-filter-grid">
                      {Object.keys(filterDefinitions).map(key => {
                        const isActive = config.newFilters[key] || false;

                        return (
                          <div
                            key={`new-${key}`}
                            className={`modern-toggle-chip ${isActive ? 'active' : ''}`}
                            onClick={() => updateConfig(cIndex, 'newFilters', key, !isActive)}
                          >
                            <div className="chip-icon">{filterDefinitions[key].icon}</div>
                            <span className="chip-label">{filterDefinitions[key].label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="filter-actions">
                      {(() => {
                        const allKeys = Object.keys(filterDefinitions);
                        const isAllSelected = allKeys.every(key => config.newFilters[key] === true);

                        return (
                          <button
                            className={`btn-action-outline ${isAllSelected ? 'active-all' : ''}`}
                            onClick={() => handleSelectAllFilters(cIndex, config.newFilters)}
                          >
                            <IconCheckAll className="icon-sm" />
                            <span>{isAllSelected ? t('targets.clearAll') : t('targets.selectAll')}</span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="action-buttons-grid">
                    <button
                      className="btn btn-primary btn-player"
                      onClick={() => validateAndAddEntity(cIndex, config, 'Player')}
                    >
                      <span className="btn-icon">👤</span> {t('targets.addAsPlayer')}
                    </button>

                    <button
                      className="btn btn-primary btn-tribe"
                      onClick={() => validateAndAddEntity(cIndex, config, 'Tribe')}
                    >
                      <span className="btn-icon">🛡️</span> {t('targets.addAsTribe')}
                    </button>
                  </div>
                </div>

                {/* MANAGE NOTIFICATIONS */}
                <div className="section-block manage-section">
                  <h3 className="section-title">{t('targets.manageTargets')}</h3>
                  <div className="entities-container">
                    {config.entities.length === 0 ? (
                      <div className="empty-state">
                        <span className="empty-icon">📭</span>
                        <p>{t('targets.emptyState')}</p>
                      </div>
                    ) : (
                      config.entities.map(ent => (
                        <div className={`entity-card ${ent.isHidden ? 'is-hidden' : ''}`} key={ent.id}>

                          <div className="entity-actions-top-right">
                            <button
                              className={`btn-icon-visibility ${ent.isHidden ? 'hidden-active' : ''}`}
                              onClick={() => handleToggleVisibility(cIndex, ent.id, config.entities)}
                              title={ent.isHidden ? t('common.show') : t('common.hide')}
                            >
                              {ent.isHidden ? '👁️‍🗨️' : '👁️'}
                            </button>

                            <button
                              className="btn-icon-danger"
                              onClick={() => {
                                const isConfirmed = window.confirm(t('targets.deleteConfirm'));
                                if (isConfirmed) {
                                  handleRemoveEntity(cIndex, ent.id, config.entities);
                                }
                              }}
                              title={t('common.delete')}
                            >
                              <IconTrash />
                            </button>
                          </div>

                          <div className="entity-header">
                            <span className={`type-badge ${ent.type === 'Player' ? 'badge-player' : 'badge-tribe'}`}>
                              {ent.type === 'Player' ? t('targets.playerBadge') : t('targets.tribeBadge')}
                            </span>
                            <h4 className="entity-name" style={{ color: ent.isHidden ? '#888' : 'inherit' }}>
                              {ent.name}
                            </h4>
                          </div>

                          {!ent.isHidden && (
                            <div className="entity-filters-scroll">
                              {Object.keys(filterDefinitions).map(key => {
                                const isActive = ent.filters[key] || false;
                                return (
                                  <div
                                    key={`${ent.id}-${key}`}
                                    className={`mini-chip ${isActive ? 'active' : ''}`}
                                    onClick={() => handleToggleEntityFilter(cIndex, ent.id, key, config.entities)}
                                    title={filterDefinitions[key].label}
                                  >
                                    <div className="chip-icon">{filterDefinitions[key].icon}</div>
                                    <span className="chip-label-mini">{filterDefinitions[key].label}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* === YENİ: FULL TAKİP & KITA TAKİBİ BİRLEŞİK BLOK === */}
                <div className="section-block" style={{ border: '1px solid #ff4d4d', backgroundColor: 'rgba(255, 77, 77, 0.05)' }}>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px' }}>

                    {/* ================= SOL TARAF: FULL TAKİP ================= */}
                    <div style={{ flex: '1 1 300px', borderRight: '1px dashed rgba(255, 77, 77, 0.3)', paddingRight: '20px' }}>
                      <h3 className="section-title" style={{ color: '#ff4d4d', marginBottom: '8px' }}>
                        {t('fullTracking.title')}
                      </h3>
                      <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '0 0 16px 0' }}>
                        {t('fullTracking.description')}
                      </p>

                      <label className="modern-toggle">
                        <input
                          type="checkbox"
                          checked={config.fullTracking}
                          onChange={(e) => updateConfig(cIndex, 'fullTracking', null, e.target.checked)}
                        />
                        <div className="toggle-slider" style={{ backgroundColor: config.fullTracking ? '#ff4d4d' : '' }}></div>
                        <span className="toggle-label" style={{ color: config.fullTracking ? '#ff4d4d' : '#e2e8f0', fontWeight: config.fullTracking ? 'bold' : 'normal' }}>
                          {config.fullTracking ? t('fullTracking.active') : t('fullTracking.inactive')}
                        </span>
                      </label>
                    </div>

                    {/* ================= SAĞ TARAF: KITA TAKİBİ ================= */}
                    <div style={{ flex: '1 1 300px' }}>
                      <h3 className="section-title" style={{ color: '#ff4d4d', marginBottom: '8px' }}>
                        {t('continentTracking.title')}
                      </h3>
                      <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '0 0 16px 0' }}>
                        {t('continentTracking.description')}
                      </p>

                      {/* Kıta Ekleme Inputu ve Butonu */}
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <input
                          type="number"
                          className="twcu-input"
                          placeholder={t('continentTracking.placeholder')}
                          value={config.newContinent || ''}
                          onChange={(e) => updateConfig(cIndex, 'newContinent', null, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddContinent(cIndex, config); }}
                          style={{ width: '60%' }}
                          min="0"
                          max="99"
                        />
                        <button
                          className="btn"
                          onClick={() => handleAddContinent(cIndex, config)}
                          style={{ background: '#ff4d4d', color: '#fff' }}
                        >
                          {t('common.add')}
                        </button>
                      </div>

                      {/* Eklenen Kıtaların Listelendiği Alan (Pill Tasarımı) */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {config.selectedContinents && config.selectedContinents.split(',').map((cont, idx) => {
                          const c = cont.trim();
                          if (!c) return null;

                          return (
                            <div key={idx} className="war-pair-pill" style={{ padding: '6px 12px', fontSize: '13.5px', border: '1px solid #ff4d4d' }}>
                              {t('continentTracking.continentPrefix')} <strong>{c}</strong>
                              <button
                                onClick={() => handleRemoveContinent(cIndex, c, config)}
                                className="btn-icon-danger"
                                style={{ marginLeft: '4px' }}
                                title={t('common.delete')}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}

                        {(!config.selectedContinents || config.selectedContinents.trim() === "") && (
                          <span style={{ fontSize: '13px', color: '#555', fontStyle: 'italic' }}>{t('continentTracking.noContinentAdded')}</span>
                        )}
                      </div>

                    </div>

                  </div>
                </div>

              </div>
            )}
          </div>
        ))}

        {/* --- GİZLİ (HAYALET) YENİ PROFIL EKLEME ALANI --- */}
        <div
          style={{
            marginBottom: '20px',
            border: '1px dashed #444',
            borderRadius: '10px',
            backgroundColor: '#1a1a1a',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '15px',
            opacity: 0.7,
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          onClick={addNewProfile}
        >
          <span style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px' }}>
            <IconPlus /> {t('profile.createNewProfile')}
          </span>
        </div>

        {/* KAYDET BUTONU */}
        <button className="btn btn-save" onClick={handleSave} style={{ width: '100%', fontSize: '18px', padding: '15px' }}>
          💾 {t('settings.saveAllConfigs')}
        </button>

      </div>
    </div>
  );
};

export default NotificationSettings;