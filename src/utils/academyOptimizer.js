// En hizli Akademi (ilk soylu) icin insaat kuyrugu optimizasyonu.
//
// LLM degil, deterministik bir arama: BuildingPlanner'daki simulasyonun aynisini
// adim adim isletip her adimda "hangi binayi yukseltirsem hedefe daha cabuk varirim"
// sorusunu beam search (isin aramasi) ile cevapliyor.
//
// Skor: f = gecen sure + h(kalan)
//   h = max(kalan zorunlu insa suresi, kalan hammadde ihtiyaci / anlik uretim hizi)
// Insaat ile hammadde toplama es zamanli oldugu icin ikisinin maksimumu alt sinirdir.
// Ocak yukseltmek anlik olarak sure kaybettirir ama uretim hizini arttirip h'yi
// dusurdugu icin algoritma ocak/depo/ciftlik yatirimini kendisi dengeler.

import {
    buildTimes, hqModifiers, db,
    timeToSeconds, calc, getFarmCapacity, getWareCapacity, getProduction
} from './twBuildingData';

// Akademi 1 icin gereken bina/seviyeler. Zincirdeki tum on kosullar dahil:
// akademi -> ana bina 20, demirci 20, pazar 10
// demirci -> ana bina 5, kisla 1
// pazar   -> ana bina 3, depo 2
export const ACADEMY_GOAL = { hq: 20, smithy: 20, market: 10, barracks: 1, ware: 2, academy: 1 };

// Aramaya girmesine izin verilen binalar. Ahir/atolye/sur/kilise/kule/heykel/
// saklanma akademiye hicbir katki yapmadigi icin arama uzayindan tamamen cikarildi.
// Ocaklar, depo ve ciftlik hedefte olmasa da hedefe hizmet ettigi icin serbest.
const SEARCH_CAPS = {
    hq: 30, smithy: 20, market: 10, barracks: 1, academy: 1,
    ware: 30, farm: 30, wood: 30, clay: 30, iron: 30
};
const SEARCH_KEYS = Object.keys(SEARCH_CAPS);

// --- Onceden hesaplanan kumulatif tablolar -------------------------------
// h() her durumda "su seviyeden su seviyeye kadar toplam maliyet/sure" sorar.
// Her seferinde donguyle toplamak yerine prefix toplam tablosu kuruyoruz.
const cum = {};
for (const key of SEARCH_KEYS) {
    const d = db[key];
    const time = [0], w = [0], c = [0], i = [0];
    for (let lvl = 1; lvl <= d.max; lvl++) {
        const raw = buildTimes[lvl] ? buildTimes[lvl][d.timeIdx] : null;
        time[lvl] = time[lvl - 1] + timeToSeconds(raw);
        w[lvl] = w[lvl - 1] + calc(d.wB, d.wF, lvl);
        c[lvl] = c[lvl - 1] + calc(d.cB, d.cF, lvl);
        i[lvl] = i[lvl - 1] + calc(d.iB, d.iF, lvl);
    }
    cum[key] = { time, w, c, i };
}

function hqMod(hqLevel) {
    const lvl = Math.min(30, Math.max(1, hqLevel || 1));
    return hqModifiers[lvl] || 1.0;
}

// Bir seviyenin ham insa suresi (dunya hizi ve ana bina indirimi uygulanmis).
function buildSeconds(bldgId, targetLvl, hqLevel, worldSpeed) {
    const raw = buildTimes[targetLvl] ? buildTimes[targetLvl][db[bldgId].timeIdx] : null;
    if (!raw) return null;
    return Math.round((timeToSeconds(raw) * hqMod(hqLevel)) / worldSpeed);
}

// --- Durum ---------------------------------------------------------------
// lv: seviye tablosu, w/c/i: depodaki hammadde, time: gecen saniye,
// pop: toplam nufus (her adimda bastan hesaplamamak icin tasiniyor),
// prev/move: kuyrugu geri sarmak icin bagli liste.

function makeInitialState(startLevels) {
    const lv = {};
    for (const key in db) lv[key] = startLevels[key] || 0;
    let pop = 0;
    for (const key in db) if (lv[key] > 0) pop += calc(db[key].pB, db[key].pF, lv[key]);
    return { lv, w: 500, c: 500, i: 400, time: 0, pop, prev: null, move: null, depth: 0 };
}

// Bir binayi bir seviye yukseltip yeni durumu dondurur. Mumkun degilse null.
// BuildingPlanner.jsx'teki simulationRows dongusuyle birebir ayni fizik.
function applyBuild(state, bldgId, worldSpeed, resSpeed) {
    const d = db[bldgId];
    const cur = state.lv[bldgId];
    const target = cur + 1;
    if (target > d.max || target > SEARCH_CAPS[bldgId]) return null;

    for (const r in d.req) if (state.lv[r] < d.req[r]) return null;

    const reqW = calc(d.wB, d.wF, target);
    const reqC = calc(d.cB, d.cF, target);
    const reqI = calc(d.iB, d.iF, target);

    // Depo tavani maliyeti karsilamiyorsa bu hamle hicbir zaman yapilamaz.
    const wareCap = getWareCapacity(state.lv.ware);
    if (reqW > wareCap || reqC > wareCap || reqI > wareCap) return null;

    // Nufus tavani. Kullanici ciftligi asan seviyeler girmis olabilir; boyle bir
    // durumda nufusu arttirmayan hamleleri (ozellikle ciftligin kendisini) engellemeyiz,
    // yoksa koy kilitlenir ve arama hic cozum bulamaz.
    const newPop = state.pop - calc(d.pB, d.pF, cur) + calc(d.pB, d.pF, target);
    if (newPop > getFarmCapacity(state.lv.farm) && newPop > state.pop) return null;

    const secs = buildSeconds(bldgId, target, state.lv.hq, worldSpeed);
    if (secs === null) return null;

    const rateW = getProduction(state.lv.wood, resSpeed) / 3600;
    const rateC = getProduction(state.lv.clay, resSpeed) / 3600;
    const rateI = getProduction(state.lv.iron, resSpeed) / 3600;

    const wait = Math.max(
        0,
        reqW > state.w ? (reqW - state.w) / rateW : 0,
        reqC > state.c ? (reqC - state.c) / rateC : 0,
        reqI > state.i ? (reqI - state.i) / rateI : 0
    );

    // Bekleme suresince uretim isler, depo tavaninda durur.
    let w = Math.min(wareCap, state.w + wait * rateW) - reqW;
    let c = Math.min(wareCap, state.c + wait * rateC) - reqC;
    let i = Math.min(wareCap, state.i + wait * rateI) - reqI;

    // Insaat suresince de isler.
    w = Math.min(wareCap, w + secs * rateW);
    c = Math.min(wareCap, c + secs * rateC);
    i = Math.min(wareCap, i + secs * rateI);

    const lv = { ...state.lv };
    lv[bldgId] = target;

    return {
        lv, w, c, i,
        time: state.time + wait + secs,
        pop: newPop,
        prev: state, move: bldgId, depth: state.depth + 1
    };
}

// Kalan sure icin alt sinir. Gercek sureyi asla asmaz (admissible), bu yuzden
// beam siralamasi hedefe gercekten yaklastiran hamleleri one alir.
function heuristic(state, goal, worldSpeed, resSpeed) {
    const mod = hqMod(state.lv.hq);
    let restTime = 0, needW = 0, needC = 0, needI = 0;

    for (const key in goal) {
        const cur = state.lv[key];
        const target = goal[key];
        if (cur >= target) continue;
        const t = cum[key];
        restTime += (t.time[target] - t.time[cur]) * mod / worldSpeed;
        needW += t.w[target] - t.w[cur];
        needC += t.c[target] - t.c[cur];
        needI += t.i[target] - t.i[cur];
    }
    if (restTime === 0) return 0;

    // Depodaki hammadde ihtiyactan dusulur; kalani mevcut hizla toplamak gerekir.
    // Ocaklar sonradan yukseltilebilecegi icin bu da bir alt sinirdir.
    const resTime = Math.max(
        (needW - state.w) > 0 ? (needW - state.w) / (getProduction(state.lv.wood, resSpeed) / 3600) : 0,
        (needC - state.c) > 0 ? (needC - state.c) / (getProduction(state.lv.clay, resSpeed) / 3600) : 0,
        (needI - state.i) > 0 ? (needI - state.i) / (getProduction(state.lv.iron, resSpeed) / 3600) : 0
    );

    // Insaat ve toplama es zamanli: alt sinir ikisinin buyugu.
    return Math.max(restTime, resTime);
}

function isGoal(state, goal) {
    for (const key in goal) if (state.lv[key] < goal[key]) return false;
    return true;
}

function unwind(state) {
    const queue = [];
    for (let s = state; s && s.move; s = s.prev) queue.push(s.move);
    return queue.reverse();
}

/**
 * En hizli akademi kuyrugunu hesaplar.
 *
 * @param {object}   opts.startLevels  mevcut bina seviyeleri
 * @param {number}   opts.worldSpeed   dunya hizi
 * @param {number}   opts.mineSpeed    hammadde uretim faktoru
 * @param {object}   [opts.goal]       hedef seviyeler (varsayilan ACADEMY_GOAL)
 * @param {number}   [opts.beamWidth]  her derinlikte tutulan durum sayisi
 * @param {number}   [opts.maxDepth]   kuyruktaki maksimum bina sayisi
 * @param {function} [onProgress]      (depth, bestSeconds|null) => void
 * @returns {Promise<{queue: string[], seconds: number, explored: number} | null>}
 */
export async function optimizeToAcademy(opts, onProgress) {
    const {
        startLevels, worldSpeed, mineSpeed,
        goal = ACADEMY_GOAL, beamWidth = 300, maxDepth = 220
    } = opts;

    const resSpeed = worldSpeed * mineSpeed;
    const start = makeInitialState(startLevels);

    if (isGoal(start, goal)) return { queue: [], seconds: 0, explored: 0 };

    let frontier = [start];
    let best = null;
    let explored = 0;

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
        // Ayni seviye tablosuna ulasan durumlardan sadece en iyisini tutariz.
        const seen = new Map();

        for (const state of frontier) {
            for (const bldgId of SEARCH_KEYS) {
                const next = applyBuild(state, bldgId, worldSpeed, resSpeed);
                if (!next) continue;
                explored++;

                if (isGoal(next, goal)) {
                    if (!best || next.time < best.time) best = next;
                    continue;
                }

                // Elimizde bir cozum varsa, ondan daha iyi olamayacak dallari kes.
                const f = next.time + heuristic(next, goal, worldSpeed, resSpeed);
                if (best && f >= best.time) continue;

                const key = SEARCH_KEYS.map(k => next.lv[k]).join(',');
                const rival = seen.get(key);
                if (!rival || f < rival.f) seen.set(key, { state: next, f });
            }
        }

        frontier = [...seen.values()].sort((a, b) => a.f - b.f)
            .slice(0, beamWidth)
            .map(entry => entry.state);

        // Her 5 derinlikte bir olaya dongusune don, arayuz donmasin.
        if (onProgress && depth % 5 === 0) {
            onProgress(depth, best ? best.time : null);
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    if (!best) return null;
    return { queue: unwind(best), seconds: best.time, explored };
}
