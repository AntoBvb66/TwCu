// Koy ekonomisi ve insaat kuyrugu simulasyonu.
//
// Planlayicinin tablosu (BuildingPlanner.jsx) ile kuyruk optimizasyonu
// (queueOptimizer.js) ayni sayilari uretsin diye hesap tek yerde: tablo "bu
// sirayi uygularsam ne olur", optimizasyon "hangi sira en hizlisi" sorusunu
// ayni fizikle cevapliyor.
//
// Model:
//   - Insaatlar oyundaki gibi tek kuyrukta sirayla yapilir. Her adimda once
//     maliyet birikene kadar beklenir, maliyet odenir, insaat suresince uretim
//     devam eder. Depo doluysa fazlasi kaybolur.
//   - Besleme: baska koylerden saatte sabit miktarda hammadde gelir. "Sinirsiz"
//     secilirse hammadde hic beklenmez; depo tavani ve ciftlik yine gecerlidir.
//   - Asker uretimi: gelirin secilen payi bastan itibaren hep askere ayrilir,
//     insaata donmez ("asker uretimi hic durmasin"). Kisla/ahir/atolye o payi
//     harcayacak hizda degilse ya da ciftlik doluysa artan kisim bosa gider;
//     bu yuzden iyi bir plan uretim binalarini ve ciftligi gelirle birlikte
//     buyutur. Askerin nufusu ciftlikte yer kaplar; her insaat kendi nufusunu
//     onceden ayirdigi icin asker siradaki binanin yerini kapmaz.

import {
    buildTimes, hqModifiers, db,
    timeToSeconds, calc, getFarmCapacity, getWareCapacity
} from './twBuildingData';

// --- Bina sirasi ve onceden hesaplanan tablolar ----------------------------
// Seviyeler bina anahtari yerine bu sira ile Uint8Array'de tutulur; arama
// milyonlarca durum urettigi icin nesne kopyalamaktan cok daha ucuz.

export const BKEYS = Object.keys(db);
export const BIDX = {};
BKEYS.forEach((key, idx) => { BIDX[key] = idx; });
export const NB = BKEYS.length;

export const I_HQ = BIDX.hq;
export const I_WOOD = BIDX.wood;
export const I_CLAY = BIDX.clay;
export const I_IRON = BIDX.iron;
export const I_FARM = BIDX.farm;
export const I_WARE = BIDX.ware;

// Her bina ve seviye icin maliyet, nufus, puan ve ham insa suresi (dunya hizi
// ve ana bina indirimi uygulanmamis), ayrica 0. seviyeden kumulatif toplamlar.
// Nufus ve puan o seviyedeki toplam degerdir, artis degil.
export const LEVEL = BKEYS.map(key => {
    const d = db[key];
    const t = {
        max: d.max,
        req: Object.keys(d.req).map(r => [BIDX[r], d.req[r]]),
        w: [0], c: [0], i: [0], pop: [0], pts: [0], sec: [0],
        cw: [0], cc: [0], ci: [0], csec: [0]
    };
    for (let lvl = 1; lvl <= d.max; lvl++) {
        const raw = buildTimes[lvl] ? buildTimes[lvl][d.timeIdx] : null;
        t.w[lvl] = calc(d.wB, d.wF, lvl);
        t.c[lvl] = calc(d.cB, d.cF, lvl);
        t.i[lvl] = calc(d.iB, d.iF, lvl);
        t.pop[lvl] = calc(d.pB, d.pF, lvl);
        t.pts[lvl] = calc(d.ptsB, 1.2, lvl);
        t.sec[lvl] = raw ? timeToSeconds(raw) : null;
        t.cw[lvl] = t.cw[lvl - 1] + t.w[lvl];
        t.cc[lvl] = t.cc[lvl - 1] + t.c[lvl];
        t.ci[lvl] = t.ci[lvl - 1] + t.i[lvl];
        t.csec[lvl] = t.csec[lvl - 1] + (t.sec[lvl] || 0);
    }
    return t;
});

export const WARE = [];
export const FARM = [];
export const HQ_MOD = [];
const PROD_RAW = [0];
for (let lvl = 0; lvl <= 30; lvl++) {
    WARE[lvl] = getWareCapacity(lvl);
    FARM[lvl] = getFarmCapacity(lvl);
    HQ_MOD[lvl] = hqModifiers[Math.min(30, Math.max(1, lvl))] || 1.0;
    if (lvl > 0) PROD_RAW[lvl] = 30 * Math.pow(1.163118, lvl - 1);
}

// getProduction ile birebir ayni sonuc (ayni islem sirasi): saatlik uretim.
function prodPerHour(level, resSpeed) {
    return level === 0 ? 5 * resSpeed : Math.round(PROD_RAW[level] * resSpeed);
}

// Bir seviyenin insa suresi. Hizli dunyalarda ucuz seviyeler saniyenin altina
// duser; oyunda oldugu gibi en az 1 saniye sayilir.
export function buildSeconds(b, target, hqLevel, worldSpeed) {
    const raw = LEVEL[b].sec[target];
    if (raw === null || raw === undefined) return null;
    return Math.max(1, Math.round((raw * HQ_MOD[hqLevel]) / worldSpeed));
}

// --- Asker uretimi ---------------------------------------------------------
// Standart dunya birlik verisi. time: ham sure; gercek sure
// time * 2/3 * 1.06^-binaSeviyesi / dunyaHizi (UnitCalculator ile ayni formul).

export const UNITS = {
    spear: { w: 50, c: 30, i: 10, pop: 1, time: 1020, facility: 'barracks', req: { barracks: 1 } },
    sword: { w: 30, c: 30, i: 70, pop: 1, time: 1500, facility: 'barracks', req: { barracks: 1, smithy: 1 } },
    axe: { w: 60, c: 30, i: 40, pop: 1, time: 1320, facility: 'barracks', req: { barracks: 1, smithy: 2 } },
    light: { w: 125, c: 100, i: 250, pop: 4, time: 1800, facility: 'stable', req: { stable: 3 } },
    heavy: { w: 200, c: 150, i: 600, pop: 6, time: 3600, facility: 'stable', req: { stable: 10, smithy: 15 } },
    ram: { w: 300, c: 200, i: 200, pop: 5, time: 4800, facility: 'workshop', req: { workshop: 1 } }
};

// Hangi uretim binasinda hangi birlikler basilir ve asker payinin ne kadari o
// binaya ayrilir (uc bina ayni anda calisir). Ayni binada birden fazla birlik
// varsa (savunmada mizrak + kilic) nufusca esit paylasilir. Oranlar tipik bir
// tam koyu verir:
//   saldiri: ~6.500 balta, ~2.800 hafif atli, ~350 kocbasi
//   savunma: nufusun ~%75'i mizrak + kilic, gerisi agir atli
export const TROOP_PROFILES = {
    off: {
        barracks: { units: ['axe'], share: 0.35 },
        stable: { units: ['light'], share: 0.55 },
        workshop: { units: ['ram'], share: 0.10 }
    },
    def: {
        barracks: { units: ['spear', 'sword'], share: 0.7 },
        stable: { units: ['heavy'], share: 0.3 }
    }
};

// Sira sabit: asker dagilimi (ab/as/aw) hep kisla, ahir, atolye.
export const TROOP_FACILITIES = ['barracks', 'stable', 'workshop'];

// Uretim binasi seviyesine gore sure carpani: 2/3 * 1.06^-seviye.
const TROOP_TIME = [];
for (let lvl = 0; lvl <= 30; lvl++) TROOP_TIME[lvl] = (2 / 3) * Math.pow(1.06, -lvl);

function reqMet(req, lv) {
    for (let k = 0; k < req.length; k++) if (lv[req[k][0]] < req[k][1]) return false;
    return true;
}

// --- Simulasyon baglami ----------------------------------------------------

/**
 * Ayarlari hizli hesap icin hazirlar.
 *
 * @param {object} settings
 * @param {number} settings.worldSpeed     dunya hizi
 * @param {number} settings.mineSpeed      hammadde uretim faktoru
 * @param {object} [settings.feed]         baska koylerden saatlik gelen hammadde {w, c, i}
 * @param {boolean} [settings.feedUnlimited] hammadde hic beklenmesin
 * @param {object} [settings.troops]       asker uretimi {share: % (0-90), profile: 'off'|'def'}
 */
export function makeSimContext(settings) {
    const worldSpeed = settings.worldSpeed > 0 ? settings.worldSpeed : 1;
    const mineSpeed = settings.mineSpeed > 0 ? settings.mineSpeed : 1;
    const resSpeed = worldSpeed * mineSpeed;

    const prod = new Float64Array(31);
    for (let lvl = 0; lvl <= 30; lvl++) prod[lvl] = prodPerHour(lvl, resSpeed) / 3600;

    const feed = settings.feed || {};
    const ctx = {
        worldSpeed, resSpeed, prod,
        feedW: Math.max(0, +feed.w || 0) / 3600,
        feedC: Math.max(0, +feed.c || 0) / 3600,
        feedI: Math.max(0, +feed.i || 0) / 3600,
        feedUnlimited: !!settings.feedUnlimited,
        // En son ciftlikte binalardan artan yer: asker bundan fazlasini kaplamaz.
        // Planlayici tablosu ve optimizasyon kendi kuyruguna gore doldurur.
        finalRoom: Infinity,
        troops: null
    };

    const tr = settings.troops;
    const profile = tr && TROOP_PROFILES[tr.profile];
    if (profile && tr.share > 0) {
        ctx.troops = {
            share: Math.min(90, tr.share) / 100,
            profile: tr.profile,
            facilities: TROOP_FACILITIES.map(key => {
                const p = profile[key] || { units: [], share: 0 };
                return {
                    key, idx: BIDX[key], share: p.share,
                    units: p.units.map(id => {
                        const u = UNITS[id];
                        return {
                            id, pop: u.pop, time: u.time,
                            rpp: (u.w + u.c + u.i) / u.pop, // nufus basina toplam maliyet
                            req: Object.keys(u.req).map(r => [BIDX[r], u.req[r]])
                        };
                    })
                };
            })
        };
    }
    return ctx;
}

// Bir uretim binasinin tam hizdaki nufus/sn hizi ve nufus basina maliyeti.
// On kosulu tutmayan birlik basilamaz; hic birlik yoksa hiz 0.
const FCAP = { pop: 0, rpp: 0 };

function facilityCapacity(fac, lv, ctx, out) {
    out.pop = 0; out.rpp = 0;
    const level = lv[fac.idx];
    if (level === 0) return out;
    let n = 0, secPerPop = 0, rpp = 0;
    for (const u of fac.units) {
        if (!reqMet(u.req, lv)) continue;
        n++;
        secPerPop += u.time * TROOP_TIME[level] / u.pop;
        rpp += u.rpp;
    }
    if (n) {
        out.pop = n * ctx.worldSpeed / secPerPop;
        out.rpp = rpp / n;
    }
    return out;
}

/**
 * Bir adim boyunca gecerli hizlar (saniyede).
 *   w/c/i:   insaata kalan gelir (ocaklar + besleme - askere ayrilan pay)
 *   popRate: basilan asker nufusu/sn, fac[0..2]: kisla/ahir/atolye payi
 *   tFull:   ciftlik dolana kadarki sure
 *   spend:   askere fiilen harcanan hammadde/sn, budget: askere ayrilan pay/sn
 *            (sinirsiz beslemede ikisi de olcusuz: budget 1, spend calisan pay)
 *
 * pop: binalarin nufusu (siradaki insaatin nufusu dahil), army: asker nufusu.
 */
export function economy(lv, pop, army, ctx, eco) {
    const pw = ctx.prod[lv[I_WOOD]] + ctx.feedW;
    const pc = ctx.prod[lv[I_CLAY]] + ctx.feedC;
    const pi = ctx.prod[lv[I_IRON]] + ctx.feedI;
    eco.gw = pw; eco.gc = pc; eco.gi = pi;
    eco.w = pw; eco.c = pc; eco.i = pi;
    eco.tFull = Infinity;
    eco.popRate = 0;
    eco.spend = 0;
    eco.budget = 0;
    if (!eco.fac) eco.fac = [0, 0, 0];
    eco.fac[0] = eco.fac[1] = eco.fac[2] = 0;

    const tr = ctx.troops;
    if (!tr) return eco;
    const s = tr.share;

    // Pay insaattan hep dusulur; uretim binalari harcayamazsa bosa gider.
    if (ctx.feedUnlimited) {
        eco.budget = 1;
    } else {
        eco.w = pw * (1 - s); eco.c = pc * (1 - s); eco.i = pi * (1 - s);
        eco.budget = s * (pw + pc + pi);
    }

    // Asker o anki ciftlige sigdigi kadar basilir (sonraki insaat icin ciftlik
    // yukseltilir), ama en son ciftlikte hedefteki tum binalara yer kalmali;
    // yoksa ciftlik askerle dolar ve son seviyeler hic yapilamaz.
    const room = Math.min(FARM[lv[I_FARM]] - pop, ctx.finalRoom) - army;
    if (room <= 0) return eco;

    // Her uretim binasi kendi payini harcar; pay yetmiyorsa tam hizin o kadarinda calisir.
    for (let f = 0; f < 3; f++) {
        const fac = tr.facilities[f];
        if (fac.share <= 0) continue;
        const cap = facilityCapacity(fac, lv, ctx, FCAP);
        if (cap.pop <= 0) continue;
        if (ctx.feedUnlimited) {
            eco.fac[f] = cap.pop;
            eco.spend += fac.share;
        } else {
            const lambda = Math.min(1, fac.share * eco.budget / (cap.pop * cap.rpp));
            eco.fac[f] = lambda * cap.pop;
            eco.spend += eco.fac[f] * cap.rpp;
        }
        eco.popRate += eco.fac[f];
    }
    if (eco.popRate > 0) eco.tFull = room / eco.popRate;
    return eco;
}

// Verilen son seviyelerde ciftligin binalardan artan yeri (askere kalan).
export function finalRoom(lvEnd) {
    let pop = 0;
    for (let b = 0; b < NB; b++) pop += LEVEL[b].pop[lvEnd[b]];
    return FARM[lvEnd[I_FARM]] - pop;
}

// Eksik miktarin birikme suresi.
export function waitFor(stock, need, rate) {
    return need > stock ? (need - stock) / rate : 0;
}

// dt saniye sonraki stok; depo tavaninda durur.
export function grow(stock, rate, dt, cap) {
    const v = stock + rate * dt;
    return v > cap ? cap : v;
}

// Asker uretimini dt saniye ilerletir: nufus, binalara dagilimi ve butce.
// idle: uretimin durdugu sure; pay yarim kullaniliyorsa sure de yarim sayilir.
function recruit(st, eco, dt) {
    if (dt <= 0) return;
    st.tb += eco.budget * dt;
    let active = 0;
    if (eco.popRate > 0) {
        active = dt < eco.tFull ? dt : eco.tFull;
        st.ab += eco.fac[0] * active;
        st.as += eco.fac[1] * active;
        st.aw += eco.fac[2] * active;
        st.army += eco.popRate * active;
        st.ts += eco.spend * active;
    }
    st.idle += eco.budget > 0 ? dt - active * (eco.spend / eco.budget) : dt;
}

// --- Durum -------------------------------------------------------------------
// lv: seviyeler (BKEYS sirasi), w/c/i: depodaki hammadde, time: gecen saniye,
// pop: binalarin nufusu, army: asker nufusu, ab/as/aw: kisla/ahir/atolyede
// basilan nufus, tb/ts: askere ayrilan ve fiilen harcanan hammadde, idle: asker
// uretiminin durdugu sure, prev/move: kuyrugu geri sarmak icin bagli liste.

export function makeState(startLevels) {
    const lv = new Uint8Array(NB);
    let pop = 0;
    for (let b = 0; b < NB; b++) {
        let lvl = parseInt(startLevels ? startLevels[BKEYS[b]] : 0, 10) || 0;
        lvl = Math.max(0, Math.min(LEVEL[b].max, lvl));
        lv[b] = lvl;
        pop += LEVEL[b].pop[lvl];
    }
    return {
        lv, w: 500, c: 500, i: 400, time: 0, pop,
        army: 0, ab: 0, as: 0, aw: 0, tb: 0, ts: 0, idle: 0,
        prev: null, move: -1, depth: 0
    };
}

const ECO = {};

/**
 * Bir binayi bir seviye yukseltip yeni durumu dondurur; mumkun degilse null.
 * caps verilirse (bina sirasinda tavanlar) tavani asan hamleler de reddedilir.
 */
export function stepBuild(st, b, ctx, caps) {
    const L = LEVEL[b];
    const lv = st.lv;
    const cur = lv[b];
    const target = cur + 1;
    if (target > L.max || (caps && target > caps[b])) return null;
    if (!reqMet(L.req, lv)) return null;

    const reqW = L.w[target], reqC = L.c[target], reqI = L.i[target];
    const cap = WARE[lv[I_WARE]];
    if (reqW > cap || reqC > cap || reqI > cap) return null;

    // Nufus tavani. Kullanici ciftligi asan seviyeler girmis olabilir; nufusu
    // arttirmayan hamleleri (ozellikle ciftligin kendisini) engellemeyiz, yoksa
    // koy kilitlenir ve hicbir kuyruk hedefe ulasamaz.
    const pop = st.pop - L.pop[cur] + L.pop[target];
    if (pop > st.pop && pop + st.army > FARM[lv[I_FARM]]) return null;

    const secs = buildSeconds(b, target, lv[I_HQ], ctx.worldSpeed);
    if (secs === null) return null;

    const eco = economy(lv, pop, st.army, ctx, ECO);
    let wait = 0, w, c, i;
    if (ctx.feedUnlimited) {
        w = cap; c = cap; i = cap;
    } else {
        wait = Math.max(waitFor(st.w, reqW, eco.w), waitFor(st.c, reqC, eco.c), waitFor(st.i, reqI, eco.i));
        // Bekleme suresince uretim isler, maliyet odenir, insaat suresince yine isler.
        w = grow(grow(st.w, eco.w, wait, cap) - reqW, eco.w, secs, cap);
        c = grow(grow(st.c, eco.c, wait, cap) - reqC, eco.c, secs, cap);
        i = grow(grow(st.i, eco.i, wait, cap) - reqI, eco.i, secs, cap);
    }

    const lv2 = lv.slice();
    lv2[b] = target;
    const next = {
        lv: lv2, w, c, i, time: st.time + wait + secs, pop,
        army: st.army, ab: st.ab, as: st.as, aw: st.aw, tb: st.tb, ts: st.ts, idle: st.idle,
        prev: st, move: b, depth: st.depth + 1
    };
    if (ctx.troops) recruit(next, eco, wait + secs);
    return next;
}

/**
 * Planlayici tablosu icin kuyrugu satir satir isletir. Kati degildir: kosulu
 * tutmayan satir uyarilir ve insa edilmez, sonraki satirlar devam eder.
 *
 * Donen her satirda: zamanlar, maliyet, bekleme, depo/uretim/nufus bilgisi ve
 * uyarilar (storage, missing [[bina, seviye]], farm, max, waiting) bulunur.
 */
export function simulateRows(queue, startLevels, ctx) {
    let st = makeState(startLevels);
    const eco = {};
    let time = 0;

    // Asker uretimi aciksa kuyruk bittiginde binalara gereken yer bos tutulur.
    if (ctx.troops) {
        const lvEnd = st.lv.slice();
        for (const id of queue) { const b = BIDX[id]; if (lvEnd[b] < LEVEL[b].max) lvEnd[b]++; }
        ctx = { ...ctx, finalRoom: finalRoom(lvEnd) };
    }

    return queue.map((bldgId, index) => {
        const b = BIDX[bldgId];
        const L = LEVEL[b];
        const lv = st.lv;
        const cur = lv[b];
        // Bina zaten maksimumdaysa satir yine cizilir ama insaat yapilmaz.
        const atMax = cur >= L.max;
        const targetLvl = atMax ? L.max : cur + 1;

        const reqW = L.w[targetLvl], reqC = L.c[targetLvl], reqI = L.i[targetLvl];
        const wareCap = WARE[lv[I_WARE]];
        const farmLimit = FARM[lv[I_FARM]];
        const futurePop = st.pop - L.pop[cur] + L.pop[targetLvl];

        const warn = { storage: false, missing: [], farm: false, max: false, waiting: false };
        if (reqW > wareCap || reqC > wareCap || reqI > wareCap) warn.storage = true;
        for (const [r, need] of L.req) if (lv[r] < need) warn.missing.push([BKEYS[r], need]);
        // Nufusu arttirmayan insaat (ciftlik, depo...) tavan asilmis olsa da yapilabilir.
        if (futurePop > st.pop && futurePop + st.army > farmLimit) warn.farm = true;

        economy(lv, futurePop, st.army, ctx, eco);
        if (ctx.feedUnlimited) { st.w = wareCap; st.c = wareCap; st.i = wareCap; }

        const storedW = Math.floor(st.w), storedC = Math.floor(st.c), storedI = Math.floor(st.i);
        let waitW = ctx.feedUnlimited ? 0 : waitFor(st.w, reqW, eco.w);
        let waitC = ctx.feedUnlimited ? 0 : waitFor(st.c, reqC, eco.c);
        let waitI = ctx.feedUnlimited ? 0 : waitFor(st.i, reqI, eco.i);
        const maxWait = Math.max(0, waitW, waitC, waitI);

        const missingWood = reqW > storedW ? Math.ceil(reqW - storedW) : 0;
        const missingClay = reqC > storedC ? Math.ceil(reqC - storedC) : 0;
        const missingIron = reqI > storedI ? Math.ceil(reqI - storedI) : 0;

        // Depoya sigmayan maliyetin bekleme suresi sonsuzdur (yalniz gosterim icin).
        if (reqW > wareCap) waitW = Infinity;
        if (reqC > wareCap) waitC = Infinity;
        if (reqI > wareCap) waitI = Infinity;

        let w = st.w, c = st.c, i = st.i;
        if (maxWait > 0 && isFinite(maxWait)) {
            w = grow(w, eco.w, maxWait, wareCap);
            c = grow(c, eco.c, maxWait, wareCap);
            i = grow(i, eco.i, maxWait, wareCap);
            warn.waiting = true;
        }

        let buildTime = buildSeconds(b, targetLvl, lv[I_HQ], ctx.worldSpeed);
        if (atMax || buildTime === null) { warn.max = true; buildTime = 0; }

        const isWarning = warn.storage || warn.missing.length > 0 || warn.farm || warn.max;
        const waitDone = isFinite(maxWait) ? maxWait : 0;
        const startTime = time + waitDone;
        const endTime = startTime + buildTime;

        const next = { ...st, w, c, i };
        let elapsed = waitDone;
        if (isFinite(maxWait) && !isWarning) {
            next.w = grow(w - reqW, eco.w, buildTime, wareCap);
            next.c = grow(c - reqC, eco.c, buildTime, wareCap);
            next.i = grow(i - reqI, eco.i, buildTime, wareCap);
            next.lv = lv.slice();
            next.lv[b] = targetLvl;
            next.pop = futurePop;
            time = endTime;
            elapsed += buildTime;
        } else {
            time = startTime;
        }
        // Asker bu satirin bekleme (ve insa edildiyse insaat) suresince basilir.
        if (ctx.troops) recruit(next, eco, elapsed);
        st = next;

        let pts = 0;
        for (let k = 0; k < NB; k++) pts += LEVEL[k].pts[st.lv[k]];

        // Depo ve ciftlik tavani satirin basindaki degerlerdir (eski tabloyla ayni).
        const maxStored = Math.max(storedW, storedC, storedI);
        return {
            index, bldgId, targetLvl, maxWait, buildTime, startTime, endTime,
            pts, reqW, reqC, reqI, waitW, waitC, waitI,
            storedW, storedC, storedI,
            // Saniyelik gelir: ocaklar + besleme (askere ayrilan pay dahil).
            rateW: eco.gw, rateC: eco.gc, rateI: eco.gi,
            availPop: Math.max(0, farmLimit - st.pop - Math.floor(st.army)),
            farmLimit,
            availWare: Math.max(0, wareCap - maxStored), wareCap,
            army: st.army, armyByFacility: [st.ab, st.as, st.aw],
            troopBudget: st.tb, troopSpent: st.ts, troopIdle: st.idle,
            warn, isWarning,
            missingWood, missingClay, missingIron
        };
    });
}
