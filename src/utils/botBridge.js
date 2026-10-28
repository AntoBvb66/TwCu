// TwCu <-> Br Bot aktarimi.
//
// Br Bot'un Insaatci modulu (ana bina ekrani) kuyrugu "model" olarak saklar:
//   { name, buildings: [[oyunAnahtari, hedefSeviye], ...] }
// Seviyeler mutlaktir ("ana bina 5'e kadar") ve oyunun bina anahtarlari kullanilir
// (main, smith, snob, stone, storage, hide, garage, place, church_f...). Planlayici
// ise her adimi tek seviye olan bir kuyruk tutar: ['hq', 'hq', 'wood', ...].
//
// Iki taraf arasinda tasinan kod: "TWCU1." + base64url(JSON). JSON alanlari:
//   n:  sablon adi
//   q:  model [[oyunAnahtari, seviye], ...]; bos koyden itibaren, mutlak
//   lv: koyun su anki bina seviyeleri {oyunAnahtari: seviye}      (Br Bot gonderir)
//   ws: dunya hizi                                                (Br Bot gonderir)
//   pr: koyun saatlik uretimi [odun, kil, demir]                   (Br Bot gonderir)
//   vn, vc: koy adi ve koordinati; u: koyun ana bina sayfasi (geri gonderme adresi)
// Kod kopyala-yapistir ile ya da adres cubugunda tasinir:
//   TwCu   <- Br Bot: .../TwCu/#/building-planner?bot=TWCU1.xxx
//   Br Bot <- TwCu:   https://<dunya>/game.php?village=1&screen=main#twcu=TWCU1.xxx

import { db } from './twBuildingData';

export const BOT_CODE_PREFIX = 'TWCU1.';

// Planlayici anahtari -> oyunun (ve Br Bot'un) bina anahtari.
export const GAME_KEYS = {
    hq: 'main', barracks: 'barracks', stable: 'stable', workshop: 'garage',
    church: 'church', first_church: 'church_f', watchtower: 'watchtower',
    academy: 'snob', smithy: 'smith', rally: 'place', statue: 'statue', market: 'market',
    wood: 'wood', clay: 'stone', iron: 'iron', farm: 'farm', ware: 'storage',
    hiding: 'hide', wall: 'wall'
};

const FROM_GAME_KEYS = {};
for (const key in GAME_KEYS) FROM_GAME_KEYS[GAME_KEYS[key]] = key;

// --- base64url (UTF-8) --------------------------------------------------------

function toBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
    let b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

// --- Kuyruk <-> model -----------------------------------------------------------

/**
 * Bos koyden itibaren tek seviyelik adimlari Br Bot modeline cevirir. Ayni binanin
 * ardisik adimlari tek satirda birlesir: ['wood','wood','clay'] -> [['wood',2],['stone',1]].
 */
export function stepsToBotModel(steps) {
    const levels = {};
    const model = [];
    for (const key of steps) {
        if (!db[key] || !GAME_KEYS[key]) continue;
        levels[key] = (levels[key] || 0) + 1;
        const last = model[model.length - 1];
        if (last && last[0] === GAME_KEYS[key]) last[1] = levels[key];
        else model.push([GAME_KEYS[key], levels[key]]);
    }
    return model;
}

/**
 * Br Bot modelini bos koyden itibaren tek seviyelik adimlara acar. Model mutlak
 * oldugu icin zaten gecilmis bir seviyeyi isteyen satir adim uretmez; bilinmeyen
 * bina ya da tavani asan seviye atlanip sayilir.
 */
export function botModelToSteps(model) {
    const levels = {};
    const steps = [];
    let skipped = 0;
    for (const entry of Array.isArray(model) ? model : []) {
        if (!Array.isArray(entry)) { skipped++; continue; }
        const key = FROM_GAME_KEYS[entry[0]];
        const target = parseInt(entry[1], 10);
        if (!key || !db[key] || !(target > 0)) { skipped++; continue; }
        if (target > db[key].max) skipped += target - db[key].max;
        const capped = Math.min(target, db[key].max);
        for (let lvl = (levels[key] || 0) + 1; lvl <= capped; lvl++) steps.push(key);
        levels[key] = Math.max(levels[key] || 0, capped);
    }
    return { steps, skipped };
}

/**
 * Mutlak (bos koyden) adimlardan, baslangic seviyelerinin zaten kapsadigi kismi
 * ayiklar; geriye planlayicinin kuyrugu kalir.
 */
export function stripStartLevels(steps, startLevels) {
    const seen = {};
    return steps.filter(key => {
        seen[key] = (seen[key] || 0) + 1;
        return seen[key] > (startLevels[key] || 0);
    });
}

// Oyun anahtarli seviye tablosunu planlayici anahtarlarina cevirir.
function levelsFromGame(lv) {
    if (!lv || typeof lv !== 'object') return null;
    const out = {};
    let found = 0;
    for (const key in db) {
        const val = parseInt(lv[GAME_KEYS[key]], 10);
        out[key] = isFinite(val) ? Math.max(0, Math.min(db[key].max, val)) : 0;
        if (isFinite(val)) found++;
    }
    return found ? out : null;
}

// --- Kod --------------------------------------------------------------------------

/**
 * Br Bot'a gidecek kodu uretir.
 * @param {object} p
 * @param {string}   p.name   sablon adi
 * @param {string[]} p.steps  bos koyden itibaren tek seviyelik adimlar
 */
export function buildBotCode({ name, steps }) {
    const payload = { v: 1, n: (name || '').slice(0, 60), q: stepsToBotModel(steps) };
    return BOT_CODE_PREFIX + toBase64Url(JSON.stringify(payload));
}

function decodeCode(text) {
    const m = /TWCU1\.([A-Za-z0-9_-]+)/.exec(text);
    if (!m) return null;
    try {
        const data = JSON.parse(fromBase64Url(m[1]));
        return data && typeof data === 'object' ? data : null;
    } catch (err) {
        return null;
    }
}

/**
 * Yapistirilan metni cozer. Taninan bicimler:
 *   - TWCU1 kodu (tek basina ya da bir adresin icinde)
 *   - Br Bot model dosyasi (construction_models.json): tek model ya da model listesi
 *
 * @returns {null | {
 *   name: string, steps: string[], skipped: number,
 *   villageLevels: object|null, worldSpeed: number|null, prodPerHour: number[]|null,
 *   villageName: string, villageCoord: string, returnUrl: string,
 *   models: Array<{name: string, steps: string[], skipped: number}>
 * }}
 */
export function parseBotInput(text) {
    if (typeof text !== 'string' || !text.trim()) return null;
    const raw = text.trim();

    const data = decodeCode(raw);
    if (data) {
        const { steps, skipped } = botModelToSteps(data.q);
        const ws = parseFloat(data.ws);
        const pr = Array.isArray(data.pr) && data.pr.length === 3 && data.pr.every(x => isFinite(+x) && +x > 0)
            ? data.pr.map(Number) : null;
        // Geri gonderme adresi yalnizca bir oyun sayfasi olabilir.
        const url = typeof data.u === 'string' && /^https:\/\/[^/\s]+\/game\.php\?[^\s#]*$/.test(data.u) ? data.u : '';
        const model = { name: String(data.n || ''), steps, skipped };
        return {
            ...model,
            villageLevels: levelsFromGame(data.lv),
            worldSpeed: ws > 0 && ws < 1000 ? ws : null,
            prodPerHour: pr,
            villageName: String(data.vn || ''),
            villageCoord: String(data.vc || ''),
            returnUrl: url,
            models: [model]
        };
    }

    if (raw[0] !== '{' && raw[0] !== '[') return null;
    let json;
    try { json = JSON.parse(raw); } catch (err) { return null; }
    const list = (Array.isArray(json) ? json : [json])
        .filter(m => m && Array.isArray(m.buildings))
        .map(m => ({ name: String(m.name || ''), ...botModelToSteps(m.buildings) }))
        .filter(m => m.steps.length > 0);
    if (!list.length) return null;
    return {
        ...list[0],
        villageLevels: null, worldSpeed: null, prodPerHour: null,
        villageName: '', villageCoord: '', returnUrl: '',
        models: list
    };
}

/**
 * Koyun saatlik uretiminden hammadde uretim faktorunu tahmin eder:
 * uretim = 30 * 1.163118^(seviye-1) * dunyaHizi * faktor (seviye 0'da 5).
 * Premium uretim bonusu ya da bonus koy tahmini sisirir; en dusuk deger alinir.
 */
export function estimateMineSpeed(prodPerHour, levels, worldSpeed) {
    if (!prodPerHour || !levels || !(worldSpeed > 0)) return null;
    const keys = ['wood', 'clay', 'iron'];
    let best = null;
    keys.forEach((key, k) => {
        const lvl = levels[key] || 0;
        const base = lvl === 0 ? 5 : 30 * Math.pow(1.163118, lvl - 1);
        const factor = prodPerHour[k] / (base * worldSpeed);
        if (isFinite(factor) && factor > 0 && (best === null || factor < best)) best = factor;
    });
    if (best === null || best < 0.1 || best > 50) return null;
    return Math.round(best * 100) / 100;
}

/** TwCu'dan Br Bot'a donus adresi: koyun ana bina sayfasi + kod. */
export function botReturnLink(returnUrl, code) {
    return returnUrl ? returnUrl + '#twcu=' + code : '';
}
