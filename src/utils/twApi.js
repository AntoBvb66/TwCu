// src/utils/twApi.js
// ---------------------------------------------------------------------------
// TÜM SAYFALAR İÇİN TEK VERİ KATMANI
//
// Proje boyunca 3 farklı veri sistemi birikmişti:
//   1) twcu-bot.onrender.com  -> ÖLÜ (404 döndürüyor)
//   2) tw-proxy .../?url=...  -> ham map dosyalarını kazıyan eski yöntem
//   3) chamber-that-smock.ngrok-free.dev/api -> ÇALIŞAN sistem
//
// NotificationSettings sayfasındaki (3) numaralı sistem doğru kabul edilip
// buraya taşındı. Artık her sayfa aynı fonksiyonları, aynı önbelleği ve aynı
// hata yönetimini kullanıyor.
// ---------------------------------------------------------------------------

import storage from './storage';

export const API_BASE = 'https://chamber-that-smock.ngrok-free.dev/api';
export const PROXY_BASE = 'https://tw-proxy.halimtttt10.workers.dev';

/** Dünya verisi bu süre boyunca tazedir (1 saat). */
export const CACHE_TTL = 60 * 60 * 1000;

/** API'nin desteklediği tablolar (bkz. twcu_reports.py -> izin_verilenler). */
export const TABLES = { ALLY: 'Klanlar', PLAYER: 'Oyuncular', VILLAGE: 'Koyler' };

const NGROK_HEADERS = { 'ngrok-skip-browser-warning': 'true' };

// localStorage anahtarları (eski mg_* / tw_* anahtarlarının yerine geçer)
const LS_SMALL = 'twcu_world_cache_v2'; // sadece klan + oyuncu (küçük)
const LS_META = 'twcu_world_meta_v2';   // { [worldId]: { fetchedAt } }

// Köy tablosu 2 MB'ı aşabildiği için localStorage kotasını patlatmasın diye
// sadece bellekte tutulur. Sayfalar arası gezinmede korunur, yenilemede gider.
const memoryCache = new Map();   // worldId -> { ally, player, village, fetchedAt }
const inFlight = new Map();      // worldId|tablo -> Promise (aynı isteği 2 kez atmayı önler)

// ---------------------------------------------------------------------------
// KÜÇÜK YARDIMCILAR
// ---------------------------------------------------------------------------

/** "https://tr101.klanlar.org/" -> "https://tr101.klanlar.org" */
export const cleanWorldUrl = (url) => (url || '').trim().replace(/\/+$/, '');

/** "https://tr101.klanlar.org" -> "tr101" */
export const extractWorldId = (url) => {
    const match = cleanWorldUrl(url).match(/^https?:\/\/([^./]+)\./i);
    return match ? match[1] : null;
};

/**
 * Klanlar verisinde '+' işareti boşluk demektir. Önce onu %20 yapıp sonra
 * decode etmek en garantisidir. Zaten çözülmüş metinlerde patlamaz.
 */
export const decodeTW = (str) => {
    if (!str) return '';
    try {
        return decodeURIComponent(String(str).replace(/\+/g, '%20'));
    } catch {
        return String(str).replace(/\+/g, ' ');
    }
};

/** Karşılaştırmada fazla boşluk / büyük-küçük harf farkını sıfırlar. */
export const cleanString = (str) => {
    if (!str) return '';
    return String(str).replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
};

/** İstatistik sayaçlarını artırır; başarısız olursa sessizce yutar. */
export const bumpStat = (stat) => {
    try {
        fetch(`${PROXY_BASE}/?stat=${encodeURIComponent(stat)}`).catch(() => {});
    } catch {
        /* istatistik kritik değil */
    }
};

/** Sayfa altındaki genel istatistikleri getirir. */
export const fetchStats = async () => {
    const res = await fetch(`${PROXY_BASE}/?stat=get_all`);
    if (!res.ok) throw new Error('Stats alınamadı');
    return res.json();
};

/** CORS proxy üzerinden ham metin çeker (oyun içi config dosyaları için). */
export const fetchWithProxy = async (targetUrl) => {
    const res = await fetch(`${PROXY_BASE}/?url=${encodeURIComponent(targetUrl)}`);
    if (!res.ok) throw new Error('Veri çekilemedi.');
    return res.text();
};

// ---------------------------------------------------------------------------
// API ERİŞİMİ
// ---------------------------------------------------------------------------

/**
 * Tek bir tabloyu çeker. Dönen değer her zaman satır dizisidir.
 * Aynı anda aynı tablo için ikinci istek atılmaz (in-flight paylaşımı).
 */
export const fetchWorldTable = async (worldId, table) => {
    const key = `${worldId}|${table}`;
    if (inFlight.has(key)) return inFlight.get(key);

    const request = (async () => {
        const res = await fetch(`${API_BASE}/${worldId}/${table}`, { headers: NGROK_HEADERS });
        if (!res.ok) throw new Error(`Sunucu ${res.status} döndü (${table})`);

        const json = await res.json();
        if (json.hata) throw new Error(json.hata);
        if (!Array.isArray(json.veriler)) throw new Error(`Veri bulunamadı (${table})`);
        return json.veriler;
    })();

    inFlight.set(key, request);
    try {
        return await request;
    } finally {
        inFlight.delete(key);
    }
};

const readPersistedSmall = (worldId) => {
    const all = storage.get(LS_SMALL, {});
    const meta = storage.get(LS_META, {});
    const entry = all?.[worldId];
    const fetchedAt = meta?.[worldId]?.fetchedAt || 0;
    if (!entry || !entry.ally || !entry.player) return null;
    return { ...entry, fetchedAt };
};

const persistSmall = (worldId, { ally, player }, fetchedAt) => {
    // Aynı anda tek dünyayı saklamak yeterli; localStorage kotası şişmesin.
    storage.set(LS_SMALL, { [worldId]: { ally, player } });
    storage.set(LS_META, { [worldId]: { fetchedAt } });
};

const isFresh = (fetchedAt) => fetchedAt > 0 && Date.now() - fetchedAt < CACHE_TTL;

/**
 * Bir dünyanın verisini getirir.
 *
 * @param {string} worldUrlOrId  "https://tr101.klanlar.org" ya da "tr101"
 * @param {object} opts
 * @param {boolean} opts.villages  Köy tablosu da gerekli mi (2 MB, yavaş)
 * @param {boolean} opts.force     Önbelleği yok say
 * @returns {Promise<{ally: any[], player: any[], village: any[]|null, fetchedAt: number, fromCache: boolean}>}
 */
export const fetchWorldData = async (worldUrlOrId, opts = {}) => {
    const { villages = false, force = false } = opts;

    const worldId = worldUrlOrId?.startsWith('http')
        ? extractWorldId(worldUrlOrId)
        : (worldUrlOrId || '').trim();

    if (!worldId) throw new Error('INVALID_WORLD_URL');

    // 1) Bellekte taze veri var mı?
    if (!force) {
        const mem = memoryCache.get(worldId);
        if (mem && isFresh(mem.fetchedAt) && (!villages || mem.village)) {
            return { ...mem, fromCache: true };
        }

        // 2) Köy gerekmiyorsa localStorage'daki küçük veri yeter
        if (!villages) {
            const persisted = readPersistedSmall(worldId);
            if (persisted && isFresh(persisted.fetchedAt)) {
                const entry = { ...persisted, village: null };
                memoryCache.set(worldId, entry);
                return { ...entry, fromCache: true };
            }
        }
    }

    // 3) Ağdan çek
    const wanted = [
        fetchWorldTable(worldId, TABLES.ALLY),
        fetchWorldTable(worldId, TABLES.PLAYER),
        villages ? fetchWorldTable(worldId, TABLES.VILLAGE) : Promise.resolve(null),
    ];

    const [ally, player, village] = await Promise.all(wanted);

    if (!ally.length && !player.length) {
        throw new Error('WORLD_EMPTY');
    }

    const fetchedAt = Date.now();
    const previous = memoryCache.get(worldId);
    const entry = {
        ally,
        player,
        village: village ?? previous?.village ?? null,
        fetchedAt,
    };

    memoryCache.set(worldId, entry);
    persistSmall(worldId, entry, fetchedAt);

    return { ...entry, fromCache: false };
};

/** Önbelleği elle temizler (kullanıcı "yenile" dediğinde). */
export const clearWorldCache = (worldUrlOrId) => {
    if (!worldUrlOrId) {
        memoryCache.clear();
        storage.set(LS_SMALL, {});
        storage.set(LS_META, {});
        return;
    }
    const worldId = worldUrlOrId.startsWith('http') ? extractWorldId(worldUrlOrId) : worldUrlOrId;
    memoryCache.delete(worldId);
};

/** Önbellekteki verinin ne zaman çekildiğini döndürür (yoksa 0). */
export const getCacheTime = (worldUrlOrId) => {
    const worldId = worldUrlOrId?.startsWith('http') ? extractWorldId(worldUrlOrId) : worldUrlOrId;
    const mem = memoryCache.get(worldId);
    if (mem?.fetchedAt) return mem.fetchedAt;
    return readPersistedSmall(worldId)?.fetchedAt || 0;
};

// ---------------------------------------------------------------------------
// DÜNYA AYARLARI (hız çarpanları, akademi mesafesi)
// ---------------------------------------------------------------------------

const configCache = new Map();

/**
 * interface.php?func=get_config çıktısından hız çarpanlarını okur.
 * Çekilemezse varsayılan (1x) değerlerle döner — çağıran taraf patlamaz.
 */
export const fetchWorldConfig = async (worldUrl) => {
    const cleanUrl = cleanWorldUrl(worldUrl);
    if (!cleanUrl) return { speed: 1, unitSpeed: 1, multiplier: 1, maxSnobDist: null, ok: false };

    if (configCache.has(cleanUrl)) return configCache.get(cleanUrl);

    let result = { speed: 1, unitSpeed: 1, multiplier: 1, maxSnobDist: null, ok: false };
    try {
        const xml = await fetchWithProxy(`${cleanUrl}/interface.php?func=get_config`);

        const speed = parseFloat(xml.match(/<speed>([\d.]+)<\/speed>/)?.[1]) || 1;
        const unitSpeed = parseFloat(xml.match(/<unit_speed>([\d.]+)<\/unit_speed>/)?.[1]) || 1;
        const maxDist = parseInt(xml.match(/<max_dist>(\d+)<\/max_dist>/)?.[1], 10);

        result = {
            speed,
            unitSpeed,
            multiplier: speed * unitSpeed,
            maxSnobDist: Number.isNaN(maxDist) ? null : maxDist,
            ok: true,
        };
        configCache.set(cleanUrl, result);
    } catch {
        // Config kritik değil; varsayılanla devam.
    }
    return result;
};

// ---------------------------------------------------------------------------
// SATIR AYRIŞTIRICILARI
// API satır düzeni: Klanlar[id, name, tag, uyeler, koyler, puan, allPuan, sira]
//                   Oyuncular[id, name, ally_id, koyler, puan, sira]
//                   Koyler[id, name, x, y, player_id, puan, bonus]
// ---------------------------------------------------------------------------

export const parseAllies = (rows = []) => {
    const byId = {};
    for (const r of rows) {
        const id = parseInt(r[0], 10);
        if (Number.isNaN(id)) continue;
        byId[id] = { id, name: decodeTW(r[1]), tag: decodeTW(r[2]) };
    }
    return byId;
};

export const parsePlayers = (rows = [], allies = {}) => {
    const byId = {};
    for (const r of rows) {
        const id = parseInt(r[0], 10);
        if (Number.isNaN(id)) continue;
        const allyId = parseInt(r[2], 10) || 0;
        byId[id] = {
            id,
            name: decodeTW(r[1]),
            allyId,
            allyTag: allies[allyId] ? allies[allyId].tag : '—',
        };
    }
    return byId;
};

export const parseVillages = (rows = []) => {
    const list = [];
    for (const r of rows) {
        const id = parseInt(r[0], 10);
        const x = parseInt(r[2], 10);
        const y = parseInt(r[3], 10);
        const pid = parseInt(r[4], 10);
        if (Number.isNaN(id) || Number.isNaN(x) || Number.isNaN(y)) continue;
        list.push({
            id,
            name: decodeTW(r[1]),
            x,
            y,
            coord: `${x}|${y}`,
            pid: Number.isNaN(pid) ? 0 : pid,
            points: parseInt(r[5], 10) || 0,
        });
    }
    return list;
};

/** Klan etiketine (veya adına) göre klan ID'si bulur. */
export const findAllyByTag = (allyRows = [], search) => {
    const needle = cleanString(search);
    if (!needle) return null;
    for (const r of allyRows) {
        const name = decodeTW(r[1]);
        const tag = decodeTW(r[2] || '');
        if (cleanString(tag) === needle || cleanString(name) === needle) {
            return { id: parseInt(r[0], 10), name, tag };
        }
    }
    return null;
};

/** Oyuncu adına göre oyuncu bulur. */
export const findPlayerByName = (playerRows = [], search) => {
    const needle = cleanString(search);
    if (!needle) return null;
    for (const r of playerRows) {
        const name = decodeTW(r[1]);
        if (cleanString(name) === needle) {
            return { id: parseInt(r[0], 10), name, allyId: parseInt(r[2], 10) || 0 };
        }
    }
    return null;
};
