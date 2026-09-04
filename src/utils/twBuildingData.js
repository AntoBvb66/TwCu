// Tribal Wars oyun verisi ve ortak hesap fonksiyonlari.
// BuildingPlanner.jsx ve academyOptimizer.js ayni sayilari kullansin diye buraya cikarildi.

const buildTimes = {
    1:  ['0:00:07','0:00:14','0:00:45','0:00:45','0:15:00','5:40:00','0:01:39','9:23:20','0:00:45','0:00:09','0:00:11','0:00:20','0:00:07','0:00:07','0:00:08','0:00:09','0:00:08','0:00:14','8:20:00','0:00:01','0:00:27'],
    2:  ['0:00:07','0:00:14','0:00:45','0:00:45',null,'6:48:00','0:01:39','9:23:20','0:00:45',null,null,'0:00:20','0:00:07','0:00:07','0:00:08','0:00:09','0:00:08','0:00:14','8:20:00','0:00:01','0:00:27'],
    3:  ['0:02:25','0:04:51','0:16:09','0:16:09',null,'8:09:36','0:35:32','11:16:00','0:16:09',null,null,'0:07:16','0:02:25','0:02:25','0:02:54','0:03:14','0:02:45','0:04:51','8:20:00','0:00:01','0:09:41'],
    4:  ['0:07:30','0:15:01','0:50:02','0:50:02',null,null,'1:50:04',null,'0:50:02',null,null,'0:22:31','0:07:30','0:07:30','0:09:00','0:10:00','0:08:30','0:15:01','8:20:00','0:00:01','0:30:01'],
    5:  ['0:14:21','0:28:42','1:35:41','1:35:41',null,null,'3:30:30',null,'1:35:41',null,null,'0:43:03','0:14:21','0:14:21','0:17:13','0:19:08','0:16:16','0:28:42','8:20:00','0:00:01','0:57:24'],
    6:  ['0:22:37','0:45:14','2:30:47','2:30:47',null,null,'5:31:43',null,'2:30:47',null,null,'1:07:51','0:22:37','0:22:37','0:27:08','0:30:09','0:25:38','0:45:14','8:20:00','0:00:01','1:30:28'],
    7:  ['0:32:23','1:04:46','3:35:52','3:35:52',null,null,'7:54:55',null,'3:35:52',null,null,'1:37:08','0:32:23','0:32:23','0:38:51','0:43:10','0:36:42','1:04:46','8:20:00','0:00:01','2:09:31'],
    8:  ['0:43:51','1:27:43','4:52:23','4:52:23',null,null,'10:43:15',null,'4:52:23',null,null,'2:11:34','0:43:51','0:43:51','0:52:38','0:58:29','0:49:42','1:27:43','8:20:00','0:00:01','2:55:26'],
    9:  ['0:57:23','1:54:45','6:22:31','6:22:31',null,null,'14:01:33',null,'6:22:31',null,null,'2:52:08','0:57:23','0:57:23','1:08:51','1:16:30','1:05:02','1:54:45','8:20:00','0:00:01','3:49:31'],
    10: ['1:13:19','2:26:38','8:08:46','8:08:46',null,null,'17:55:16',null,'8:08:46',null,null,'3:39:57','1:13:19','1:13:19','1:27:59','1:37:45','1:23:05','2:26:38','8:20:00','0:00:01','4:53:15'],
    11: ['1:32:17','3:04:35','10:15:15','10:15:15',null,null,'22:33:34',null,'10:15:15',null,null,'4:36:52','1:32:17','1:32:17','1:50:45','2:03:03','1:44:36',null,'8:20:00','0:00:01','6:09:09'],
    12: ['1:54:54','3:49:48','12:46:00','12:46:00',null,null,'28:05:12',null,'12:46:00',null,null,'5:44:42','1:54:54','1:54:54','2:17:53','2:33:12','2:10:13',null,'8:20:00','0:00:01','7:39:36'],
    13: ['2:21:38','4:43:16','15:44:14','15:44:14',null,null,'34:37:19',null,'15:44:14',null,null,'7:04:54','2:21:38','2:21:38','2:49:58','3:08:51','2:40:31',null,'8:20:00','0:00:01','9:26:32'],
    14: ['2:53:28','5:46:56','19:16:27','19:16:27',null,null,'42:24:12',null,'19:16:27',null,null,'8:40:24','2:53:28','2:53:28','3:28:10','3:51:17','3:16:36',null,'8:20:00','0:00:01','11:33:52'],
    15: ['3:31:18','7:02:35','23:28:37','23:28:37',null,null,'51:38:57',null,'23:28:37',null,null,'10:33:53','3:31:18','3:31:18','4:13:33','4:41:43','3:59:28',null,'8:20:00','0:00:01','14:05:10'],
    16: ['4:16:19','8:32:38','28:28:45',null,null,null,'62:39:16',null,'28:28:45',null,null,'12:48:56','4:16:19','4:16:19','5:07:35','5:41:45','4:50:29',null,'8:20:00','0:00:01','17:05:15'],
    17: ['5:09:49','10:19:38','34:25:26',null,null,null,'75:43:57',null,'34:25:26',null,null,'15:29:27','5:09:49','5:09:49','6:11:47','6:53:05','5:51:07',null,'8:20:00','0:00:01','20:39:16'],
    18: ['6:13:29','12:26:57','41:29:51',null,null,null,'91:17:40',null,'41:29:51',null,null,'18:40:26','6:13:29','6:13:29','7:28:10','8:17:58','7:03:16',null,'8:20:00','0:00:01','24:53:55'],
    19: ['7:29:08','14:58:16','49:54:12',null,null,null,'109:47:15',null,'49:54:12',null,null,'22:27:23','7:29:08','7:29:08','8:58:57','9:58:50','8:29:01',null,'8:20:00','0:00:01','29:56:31'],
    20: ['8:59:01','17:58:02','59:53:26',null,null,null,'131:45:33',null,'59:53:26',null,null,'26:57:03','8:59:01','8:59:01','10:46:49','11:58:41','10:10:53',null,'8:20:00','0:00:01','35:56:04'],
    21: ['10:45:53','21:31:47',null,null,null,null,null,null,null,null,null,'32:17:40','10:45:53','10:45:53','12:55:04','14:21:11','12:12:00',null,'8:20:00','0:00:01',null],
    22: ['12:52:40','25:45:21',null,null,null,null,null,null,null,null,null,'38:38:01','12:52:40','12:52:40','15:27:12','17:10:14','14:35:42',null,'8:20:00','0:00:01',null],
    23: ['15:23:16','30:46:33',null,null,null,null,null,null,null,null,null,'46:09:49','15:23:16','15:23:16','18:27:56','20:31:02','17:26:23',null,'8:20:00','0:00:01',null],
    24: ['18:22:01','36:44:02',null,null,null,null,null,null,null,null,null,'55:06:04','18:22:01','18:22:01','22:02:25','24:29:22','20:48:57',null,'8:20:00','0:00:01',null],
    25: ['21:54:12','43:48:23',null,null,null,null,null,null,null,null,null,'65:42:35','21:54:12','21:54:12','26:17:02','29:12:16','24:49:25',null,'8:20:00','0:00:01',null],
    26: ['26:06:08',null,null,null,null,null,null,null,null,null,null,null,'26:06:08','26:06:08','31:19:21','34:48:10','29:34:57',null,'8:20:00','0:00:01',null],
    27: ['31:05:06',null,null,null,null,null,null,null,null,null,null,null,'31:05:06','31:05:06','37:18:07','41:26:48','35:13:47',null,'8:20:00','0:00:01',null],
    28: ['36:57:53',null,null,null,null,null,null,null,null,null,null,null,'36:57:53','36:57:53','44:21:28','49:17:11','41:53:36',null,'8:20:00','0:00:01',null],
    29: ['43:57:17',null,null,null,null,null,null,null,null,null,null,null,'43:57:17','43:57:17','52:44:44','58:36:22','49:48:55',null,'8:20:00','0:00:01',null],
    30: ['52:14:15',null,null,null,null,null,null,null,null,null,null,null,'52:14:15','52:14:15','62:41:05','69:38:59','59:12:08',null,'8:20:00','0:00:01',null]
};

const hqModifiers = {
    1: 0.952380952, 2: 0.907029478, 3: 0.863837599, 4: 0.822702475, 5: 0.783526166,
    6: 0.746215397, 7: 0.71068133, 8: 0.676839362, 9: 0.644608916, 10: 0.613913254,
    11: 0.584679289, 12: 0.556837418, 13: 0.530321351, 14: 0.505067953, 15: 0.481017098,
    16: 0.458111522, 17: 0.436296688, 18: 0.415520655, 19: 0.395733957, 20: 0.376889483,
    21: 0.358942365, 22: 0.341849871, 23: 0.325571306, 24: 0.31006791, 25: 0.295302772,
    26: 0.281240735, 27: 0.267848319, 28: 0.255093637, 29: 0.242946321, 30: 0.231377449
};

const db = {
    hq: { timeIdx: 0, max: 30, wB: 90, wF: 1.26, cB: 80, cF: 1.275, iB: 70, iF: 1.26, pB: 5, pF: 1.17, ptsB: 10, req: {} },
    barracks: { timeIdx: 1, max: 25, wB: 200, wF: 1.26, cB: 170, cF: 1.28, iB: 90, iF: 1.26, pB: 7, pF: 1.17, ptsB: 16, req: {hq: 3} },
    stable: { timeIdx: 2, max: 20, wB: 270, wF: 1.26, cB: 240, cF: 1.28, iB: 260, iF: 1.26, pB: 8, pF: 1.17, ptsB: 20, req: {hq: 10, barracks: 5, smithy: 5} },
    workshop: { timeIdx: 3, max: 15, wB: 300, wF: 1.26, cB: 240, cF: 1.28, iB: 260, iF: 1.26, pB: 8, pF: 1.17, ptsB: 24, req: {hq: 10, smithy: 10} },
    first_church: { timeIdx: 4, max: 1, wB: 160, wF: 1.26, cB: 200, cF: 1.28, iB: 50, iF: 1.26, pB: 5, pF: 1.55, ptsB: 10, req: {} },
    church: { timeIdx: 5, max: 3, wB: 16000, wF: 1.26, cB: 20000, cF: 1.28, iB: 5000, iF: 1.26, pB: 5000, pF: 1.55, ptsB: 10, req: {hq: 5, farm: 5} },
    watchtower: { timeIdx: 6, max: 20, wB: 12000, wF: 1.17, cB: 14000, cF: 1.17, iB: 10000, iF: 1.18, pB: 500, pF: 1.18, ptsB: 42, req: {hq: 5, farm: 5} },
    academy: { timeIdx: 7, max: 3, wB: 15000, wF: 2, cB: 25000, cF: 2, iB: 10000, iF: 2, pB: 80, pF: 1.17, ptsB: 512, req: {hq: 20, smithy: 20, market: 10} },
    smithy: { timeIdx: 8, max: 20, wB: 220, wF: 1.26, cB: 180, cF: 1.275, iB: 240, iF: 1.26, pB: 20, pF: 1.17, ptsB: 19, req: {hq: 5, barracks: 1} },
    rally: { timeIdx: 9, max: 1, wB: 10, wF: 1.26, cB: 40, cF: 1.275, iB: 30, iF: 1.26, pB: 0, pF: 1.17, ptsB: 0, req: {} },
    statue: { timeIdx: 10, max: 1, wB: 220, wF: 1.26, cB: 220, cF: 1.275, iB: 220, iF: 1.26, pB: 10, pF: 1.17, ptsB: 24, req: {} },
    market: { timeIdx: 11, max: 25, wB: 100, wF: 1.26, cB: 100, cF: 1.275, iB: 100, iF: 1.26, pB: 20, pF: 1.17, ptsB: 10, req: {hq: 3, ware: 2} },
    wood: { timeIdx: 12, max: 30, wB: 50, wF: 1.25, cB: 60, cF: 1.275, iB: 40, iF: 1.245, pB: 5, pF: 1.155, ptsB: 6, req: {} },
    clay: { timeIdx: 13, max: 30, wB: 65, wF: 1.27, cB: 50, cF: 1.265, iB: 40, iF: 1.24, pB: 10, pF: 1.14, ptsB: 6, req: {} },
    iron: { timeIdx: 14, max: 30, wB: 75, wF: 1.252, cB: 65, cF: 1.275, iB: 70, iF: 1.24, pB: 10, pF: 1.17, ptsB: 6, req: {} },
    farm: { timeIdx: 15, max: 30, wB: 45, wF: 1.3, cB: 40, cF: 1.32, iB: 30, iF: 1.29, pB: 0, pF: 1, ptsB: 5, req: {} },
    ware: { timeIdx: 16, max: 30, wB: 60, wF: 1.265, cB: 50, cF: 1.27, iB: 40, iF: 1.245, pB: 0, pF: 1.15, ptsB: 6, req: {} },
    hiding: { timeIdx: 17, max: 10, wB: 50, wF: 1.25, cB: 60, cF: 1.25, iB: 50, iF: 1.25, pB: 2, pF: 1.17, ptsB: 5, req: {} },
    wall: { timeIdx: 20, max: 20, wB: 50, wF: 1.26, cB: 100, cF: 1.275, iB: 20, iF: 1.26, pB: 5, pF: 1.17, ptsB: 8, req: {barracks: 1} }
};

const icons = {
    hq: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/main.webp',
    barracks: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/barracks.webp',
    stable: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/stable.webp',
    workshop: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/garage.webp',
    church: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/church.webp',
    first_church: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/church.webp',
    watchtower: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/watchtower.webp',
    academy: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/snob.webp',
    smithy: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/smith.webp',
    rally: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/place.webp',
    statue: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/statue.webp',
    market: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/market.webp',
    wood: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/wood.webp',
    clay: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/stone.webp',
    iron: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/iron.webp',
    farm: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/farm.webp',
    ware: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/storage.webp',
    hiding: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/hide.webp',
    wall: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/wall.webp'
};

const dictionary = {
    'ana bina': 'hq', 'headquarters': 'hq', 'edificio principal': 'hq', 'edifício principal': 'hq',
    'içtima meydanı': 'rally', 'rally point': 'rally', 'plaza de reuniones': 'rally', 'praça de reunião': 'rally',
    'çiftlik': 'farm', 'farm': 'farm', 'granja': 'farm', 'fazenda': 'farm',
    'depo': 'ware', 'warehouse': 'ware', 'almacén': 'ware', 'armazém': 'ware',
    'kil ocağı': 'clay', 'clay pit': 'clay', 'barrera de arcilla': 'clay', 'poço de argila': 'clay',
    'oduncu': 'wood', 'timber camp': 'wood', 'leñador': 'wood', 'bosque': 'wood',
    'demir madeni': 'iron', 'iron mine': 'iron', 'mina de hierro': 'iron', 'mina de ferro': 'iron',
    'kışla': 'barracks', 'barracks': 'barracks', 'cuartel': 'barracks', 'quartel': 'barracks',
    'ahır': 'stable', 'stable': 'stable', 'cuadra': 'stable', 'estábulo': 'stable',
    'atölye': 'workshop', 'workshop': 'workshop', 'taller': 'workshop', 'oficina': 'workshop',
    'ilk kilise': 'first_church', 'first church': 'first_church', 'primera iglesia': 'first_church', 'primeira igreja': 'first_church',
    'kilise': 'church', 'church': 'church', 'iglesia': 'church', 'igreja': 'church',
    'gözetleme kulesi': 'watchtower', 'watchtower': 'watchtower', 'torre de vigilancia': 'watchtower', 'torre de vigia': 'watchtower',
    'akademi': 'academy', 'academy': 'academy', 'academia': 'academy',
    'demirci': 'smithy', 'smithy': 'smithy', 'herrería': 'smithy', 'ferreiro': 'smithy',
    'heykel': 'statue', 'statue': 'statue', 'estatua': 'statue', 'estátua': 'statue',
    'pazar': 'market', 'market': 'market', 'mercado': 'market',
    'sur': 'wall', 'wall': 'wall', 'muralla': 'wall', 'muralha': 'wall'
};

function timeToSeconds(t) {
    if (!t) return 0;
    const parts = t.split(':').map(Number);
    let h = 0, m = 0, s = 0;
    if (parts.length === 3) { h = parts[0]; m = parts[1]; s = parts[2]; }
    else if (parts.length === 2) { m = parts[0]; s = parts[1]; }
    else if (parts.length === 1) { s = parts[0]; }
    return h * 3600 + m * 60 + s;
}

function calc(base, factor, level) { return level === 0 ? 0 : Math.round(base * Math.pow(factor, level - 1)); }
function getFarmCapacity(level) { return level === 0 ? 0 : Math.round(240 * Math.pow(1.172103, level - 1)); }
function getWareCapacity(level) { return level === 0 ? 1000 : Math.round(1000 * Math.pow(1.2294934, level - 1)); }
function getProduction(level, resSpeed) { return level === 0 ? 5 * resSpeed : Math.round(30 * Math.pow(1.163118, level - 1) * resSpeed); }
function getTotalPop(levels) { let t=0; for(let b in db) if(levels[b]>0) t+=calc(db[b].pB, db[b].pF, levels[b]); return t; }
function getTotalPts(levels) { let t=0; for(let b in db) if(levels[b]>0) t+=calc(db[b].ptsB, 1.2, levels[b]); return t; }

// Oyun basinda her koyde hazir gelen seviyeler; listede olmayan bina 0'dir.
const BASE_LEVELS = { hq: 1, farm: 1, ware: 1, rally: 1 };

// Bos bir koyun tam seviye tablosu.
function getBaseLevels() {
    const lv = {};
    for (const key in db) lv[key] = BASE_LEVELS[key] || 0;
    return lv;
}

// Sifirdan baslangic seviyelerine cikarken hangi binanin once yapilacagi.
// Once nufus/depo/hammadde altyapisi, sonra on kosul zincirine gore digerleri
// (kisla ana binayi, demirci kislayi, akademi de demirciyi bekler). Bu sira
// sayesinde uretilen kuyruk oyunda da adim adim uygulanabilir olur.
const STARTUP_ORDER = [
    'farm', 'ware', 'wood', 'clay', 'iron',
    'hq', 'rally', 'barracks', 'smithy', 'market',
    'statue', 'hiding', 'wall', 'stable', 'workshop',
    'first_church', 'church', 'watchtower', 'academy'
];

// db'ye sonradan bina eklenirse sirada unutulmasin diye kalanlar sona eklenir.
const STARTUP_SEQUENCE = [
    ...STARTUP_ORDER.filter(key => db[key]),
    ...Object.keys(db).filter(key => !STARTUP_ORDER.includes(key))
];

/**
 * Bos bir koyden verilen baslangic seviyelerine ulasan kuyrugu uretir.
 * Her adim tek seviyedir: ['farm','farm',...,'hq','hq',...].
 */
function buildStartupQueue(startLevels) {
    const queue = [];
    for (const key of STARTUP_SEQUENCE) {
        const base = BASE_LEVELS[key] || 0;
        let target = parseInt(startLevels ? startLevels[key] : 0, 10);
        if (!isFinite(target)) target = base;
        target = Math.min(db[key].max, Math.max(base, target));
        for (let lvl = base; lvl < target; lvl++) queue.push(key);
    }
    return queue;
}

// --- HESAP YONETICISI SABLON KODU ------------------------------------------
// Oyunun Hesap Yoneticisi > Insaat ekranindaki sablonu ice/disa aktaran
// scriptin kod bicimi. Gercek bir sablon kodu cozulerek dogrulandi:
//
//   0x7C 0x02                     -> baslik ('|' + surum 2)
//   (binaId, seviyeAdedi) x N     -> kuyruk, sirasiyla; her emir 1 seviye
//   0x00 0x00                     -> kuyruk sonu
//   U+100000 <sablon adi> U+100000 '4'
//
// Tum dizi UTF-8'e cevrilip base64'lenir.
const AM_SEPARATOR = String.fromCodePoint(0x100000);

// Bina sirasi. 0-3 ve 7-18 gercek kodla dogrulandi; 4/5/6 (kiliseler ve kule)
// buildTimes sutun sirasindan geliyor, kiliseli olmayan dunyalarda kullanilmaz.
const AM_BUILDING_IDS = {
    hq: 0, barracks: 1, stable: 2, workshop: 3,
    first_church: 4, church: 5, watchtower: 6,
    academy: 7, smithy: 8, rally: 9, statue: 10, market: 11,
    wood: 12, clay: 13, iron: 14, farm: 15, ware: 16, hiding: 17, wall: 18
};

function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

/**
 * Bina kuyrugunu Hesap Yoneticisi sablon koduna cevirir.
 * Kuyruktaki her eleman tek bir seviye yukseltmesidir.
 */
function buildAccountManagerCode(queueIds, templateName) {
    let str = String.fromCharCode(0x7C, 0x02);
    for (const id of queueIds) {
        const bid = AM_BUILDING_IDS[id];
        if (bid === undefined) continue;
        str += String.fromCharCode(bid, 0x01);
    }
    str += String.fromCharCode(0x00, 0x00);
    str += AM_SEPARATOR + (templateName || 'TW Cu') + AM_SEPARATOR + '4';
    return utf8ToBase64(str);
}

export { buildTimes, hqModifiers, db, icons, dictionary, timeToSeconds, calc, getFarmCapacity, getWareCapacity, getProduction, getTotalPop, getTotalPts, BASE_LEVELS, getBaseLevels, buildStartupQueue, AM_BUILDING_IDS, buildAccountManagerCode };
