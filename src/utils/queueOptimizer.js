// Insaat kuyrugu optimizasyonu: verilen bir hedefe en kisa surede ulastiran sira.
//
// LLM degil, deterministik bir arama. Fizik villageSim.js'te; planlayicinin
// tablosu da ayni hesabi kullandigi icin bulunan sure tabloda birebir gorunur.
// Iki asama var:
//
// 1) Isin aramasi (beam search): her derinlikte (kuyruktaki bina sayisi) en umut
//    vadeden durumlari tutar. Skor f = gecen sure + h(kalan)
//      h = max(kalan zorunlu insa suresi, kalan hammadde ihtiyaci / anlik gelir)
//    Insaat ile hammadde toplama es zamanli oldugu icin ikisinin buyugu alt
//    sinirdir. Ocak yukseltmek anlik olarak sure kaybettirir ama geliri arttirip
//    h'yi dusurdugu icin arama ocak/depo/ciftlik yatirimini kendisi dengeler.
//
// 2) Cilalama (yerel arama): bulunan kuyrukta adimlari ileri/geri tasir, gereksiz
//    adimlari siler, yardimci seviyeler (ana bina/depo/ciftlik/ocak) ekler ve
//    toplam sureyi kisaltan her degisikligi tutar. Isin aramasinin dar
//    penceresinden kacan iyilestirmeleri yakalar (ayni ayarlarda %3-5 daha kisa).
//
// Hedefler (OPTIMIZER_PRESETS):
//   academy  -> akademi 1 (ilk soylu icin bina zinciri)
//   noble    -> akademi + ilk soylunun masrafi (1 altin para + soylu) depoda hazir
//   full     -> koydeki tum binalar maksimum
//   res      -> odun/kil/demir 30
//   military -> ocaklar 30 + asker binalari; gelirin secilen payi bastan sona
//               askere gider ve asker uretimi hic durmamali
//   feed     -> beslemeli koy: tum binalar, hammadde baska koylerden gelir
//   custom   -> kullanicinin girdigi hedef seviyeler

import { db } from './twBuildingData';
import {
    BKEYS, NB, LEVEL, WARE, FARM, HQ_MOD,
    I_HQ, I_WOOD, I_CLAY, I_IRON, I_FARM, I_WARE,
    makeSimContext, makeState, stepBuild, economy, waitFor, grow, finalRoom
} from './villageSim';

// --- HEDEFLER -------------------------------------------------------------

// Akademi 1 icin gereken bina/seviyeler. Zincirdeki tum on kosullar dahil:
// akademi -> ana bina 20, demirci 20, pazar 10
// demirci -> ana bina 5, kisla 1
// pazar   -> ana bina 3, depo 2
export const ACADEMY_GOAL = { hq: 20, smithy: 20, market: 10, barracks: 1, ware: 2, academy: 1 };

// Aramaya girmesine izin verilen binalar. Ahir/atolye/sur/kilise/kule/heykel/
// saklanma akademiye hicbir katki yapmadigi icin arama uzayindan tamamen cikarildi.
// Ocaklar, depo ve ciftlik hedefte olmasa da hedefe hizmet ettigi icin serbest.
const ACADEMY_CAPS = {
    hq: 30, smithy: 20, market: 10, barracks: 1, academy: 1,
    ware: 30, farm: 30, wood: 30, clay: 30, iron: 30
};

// Ilk soylu: akademiye ek olarak 1 altin para (28.000/30.000/25.000) basilir ve
// soylu birimi (40.000/50.000/50.000, 100 nufus) icin hammadde biriktirilir.
// Soylunun 50.000'lik kil/demir maliyeti tek seferde depoya sigmali: depo 20 sart.
// Bu yuzden ocaklar sadece akademi hedefindekinden daha degerli hale gelir.
export const NOBLE_GOAL = { ...ACADEMY_GOAL, ware: 20 };
export const NOBLE_BANK = {
    pop: 100,
    steps: [
        { w: 28000, c: 30000, i: 25000 },
        { w: 40000, c: 50000, i: 50000 }
    ]
};

// Hammadde hedefi: odun/kil/demir 30. Ocaklarin disinda sadece onlari hizlandiran
// ya da mumkun kilan binalar serbest: ana bina (insa suresi indirimi), depo
// (maliyet tavani) ve ciftlik (nufus tavani).
export const RESOURCE_GOAL = { wood: 30, clay: 30, iron: 30 };
const RESOURCE_CAPS = { hq: 30, wood: 30, clay: 30, iron: 30, farm: 30, ware: 30 };

// Tum binalar hedefinde disarida birakilanlar. Kilise ve gozetleme kulesi
// dunyaya ozel binalar; ustelik kilise 3 (12012 nufus) ile kule 20 (11600 nufus)
// birlikte ciftlik 30'un tavanini (23977) astigi icin "hepsi maksimum" koyu
// zaten kurulamaz.
const WORLD_SPECIFIC = ['first_church', 'church', 'watchtower'];

const FULL_GOAL = {};
for (const key in db) if (!WORLD_SPECIFIC.includes(key)) FULL_GOAL[key] = db[key].max;
export { FULL_GOAL };

// Asker koyu: ocaklar ve ciftlik tam, uretim binalari en ustte. Saldiri koyu
// kocbasi icin atolye, savunma koyu sur ister. Ana bina ve depo yardimci olarak
// serbest; ahir icin gereken ana bina 10 on kosul olarak kendiliginden eklenir.
export const MILITARY_GOALS = {
    off: { wood: 30, clay: 30, iron: 30, farm: 30, barracks: 25, stable: 20, workshop: 5, smithy: 20 },
    def: { wood: 30, clay: 30, iron: 30, farm: 30, barracks: 25, stable: 20, smithy: 20, wall: 20 }
};

// Asker modunda ayar yoksa kullanilacak pay (gelirin yuzdesi).
export const DEFAULT_TROOP_SHARE = 30;

// Hedefte olmasa da hedefe hizmet eden yardimci binalar: ana bina insa suresini
// kisaltir, depo maliyet tavanini, ciftlik nufus tavanini acar, ocaklar geliri
// arttirir. Ozel hedefte ve asker modunda bunlar her zaman serbesttir.
const HELPER_CAPS = { hq: 30, ware: 30, farm: 30, wood: 30, clay: 30, iron: 30 };

// Her hedefin arama uzayi farkli derinlikte oldugu icin isin genisligi de ayri.
// 300+ seviyelik derin aramalarda genislik kisik tutulmazsa tarayicida dakikalar surer.
export const OPTIMIZER_PRESETS = {
    academy:  { goal: ACADEMY_GOAL, caps: ACADEMY_CAPS, beamWidth: 300, deepBeamWidth: 900 },
    noble:    { goal: NOBLE_GOAL, caps: ACADEMY_CAPS, bank: NOBLE_BANK, beamWidth: 300, deepBeamWidth: 900 },
    full:     { goal: FULL_GOAL, caps: FULL_GOAL, beamWidth: 200, deepBeamWidth: 600 },
    res:      { goal: RESOURCE_GOAL, caps: RESOURCE_CAPS, beamWidth: 300, deepBeamWidth: 900 },
    military: { army: true, beamWidth: 200, deepBeamWidth: 600 },
    feed:     { goal: FULL_GOAL, caps: FULL_GOAL, feed: true, beamWidth: 200, deepBeamWidth: 600 },
    custom:   { beamWidth: 250, deepBeamWidth: 750 }
};

// Hedefe on kosullari ekler: ahir 20 isteyen hedefe kisla 5, demirci 5 ve ana
// bina 10 da girer. Zincirleme on kosullar da (demirci -> kisla) cozulur.
export function withPrerequisites(goal) {
    const out = { ...goal };
    let changed = true;
    while (changed) {
        changed = false;
        for (const key in out) {
            if (!db[key] || !(out[key] > 0)) continue;
            const req = db[key].req;
            for (const r in req) {
                if ((out[r] || 0) < req[r]) { out[r] = req[r]; changed = true; }
            }
        }
    }
    return out;
}

function hasFeed(feed) {
    return !!feed && ((+feed.w || 0) > 0 || (+feed.c || 0) > 0 || (+feed.i || 0) > 0);
}

// --- PLAN --------------------------------------------------------------------
// Hedef, tavanlar ve bitis kosulu tek nesnede; arama ve cilalama bunu okur.

function resolvePlan(mode, preset, opts, start, ctx) {
    let goal = opts.goal || preset.goal;
    if (!goal && preset.army) goal = MILITARY_GOALS[ctx.troops ? ctx.troops.profile : 'off'] || MILITARY_GOALS.off;
    if (!goal) return null;
    goal = withPrerequisites(goal);

    let caps = opts.caps || preset.caps;
    if (!caps) {
        caps = { ...goal };
        for (const key in HELPER_CAPS) caps[key] = Math.max(caps[key] || 0, HELPER_CAPS[key]);
    }

    const capArr = new Uint8Array(NB);
    const goalList = [];
    for (let b = 0; b < NB; b++) {
        const key = BKEYS[b];
        // Baslangic seviyesi tavandan yuksekse o bina kipirdamaz ama dusmez de.
        capArr[b] = Math.max(start.lv[b], Math.min(LEVEL[b].max, caps[key] || 0));
        const target = Math.min(LEVEL[b].max, goal[key] || 0);
        if (target > 0) goalList.push([b, target]);
    }

    const searchIdx = [];
    for (let b = 0; b < NB; b++) if (capArr[b] > start.lv[b]) searchIdx.push(b);

    // Cilalamada eklenebilecek yardimci seviyeler (tavan izin verdigi surece).
    const helperIdx = [I_WOOD, I_CLAY, I_IRON, I_WARE, I_FARM, I_HQ].filter(b => capArr[b] > start.lv[b]);

    const plan = { mode, goal, goalList, capArr, searchIdx, helperIdx, bank: preset.bank || null, army: !!preset.army };

    if (plan.bank) {
        plan.bankW = 0; plan.bankC = 0; plan.bankI = 0;
        for (const s of plan.bank.steps) { plan.bankW += s.w; plan.bankC += s.c; plan.bankI += s.i; }
    }

    return plan;
}

// Asker modunda iki kuyruk da hic durmamali: insaat kuyrugu ve asker uretimi.
// Asker uretiminin durdugu (kisla yok, ahir yetismiyor, ciftlik dolu) her saat,
// insaatin bir saat gecikmesi kadar kotu sayilir. Pay yarim kullaniliyorsa yarim
// saat. Boylece plan kisla/ahir/ciftligi gelirle birlikte buyutur.
function wastePenalty(st, plan) {
    return plan.army ? st.idle : 0;
}

function isGoal(st, plan) {
    const lv = st.lv;
    for (const [b, target] of plan.goalList) if (lv[b] < target) return false;
    return true;
}

// --- BITIS SONRASI SURE --------------------------------------------------------

const ECO_T = {};

// Ilk soylu: insaat bitince altin para, sonra soylu birimi icin hammadde birikir.
// Depo maliyeti tek seferde alamiyorsa ya da ciftlikte soyluya yer yoksa sonsuz.
function bankSeconds(st, plan, ctx) {
    const lv = st.lv;
    const cap = WARE[lv[I_WARE]];
    if (FARM[lv[I_FARM]] - st.pop < plan.bank.pop) return Infinity;
    for (const s of plan.bank.steps) if (s.w > cap || s.c > cap || s.i > cap) return Infinity;
    if (ctx.feedUnlimited) return 0;

    const eco = economy(lv, st.pop + plan.bank.pop, st.army, ctx, ECO_T);
    let w = st.w, c = st.c, i = st.i, t = 0;
    for (const s of plan.bank.steps) {
        const wait = Math.max(waitFor(w, s.w, eco.w), waitFor(c, s.c, eco.c), waitFor(i, s.i, eco.i));
        w = grow(w, eco.w, wait, cap) - s.w;
        c = grow(c, eco.c, wait, cap) - s.c;
        i = grow(i, eco.i, wait, cap) - s.i;
        t += wait;
    }
    return t;
}

// Insaat bittikten sonra hedef icin daha ne kadar beklenir (ilk soyluda birikim).
function terminalSeconds(st, plan, ctx) {
    return plan.bank ? bankSeconds(st, plan, ctx) : 0;
}

// Aramanin karsilastirdigi deger: bitis zamani + bosa giden asker payinin cezasi.
function finalScore(st, plan, ctx) {
    return st.time + terminalSeconds(st, plan, ctx) + wastePenalty(st, plan);
}

// --- KALAN IS TAHMINI ------------------------------------------------------------
// Beam siralamasi hedefe gercekten yaklastiran hamleleri one alsin diye kalan insa
// suresi ile hammadde toplama suresini birlikte olcer.

function heuristic(st, plan, ctx) {
    const lv = st.lv;
    let rest = 0, needW = 0, needC = 0, needI = 0;
    for (const [b, target] of plan.goalList) {
        const cur = lv[b];
        if (cur >= target) continue;
        const L = LEVEL[b];
        rest += L.csec[target] - L.csec[cur];
        needW += L.cw[target] - L.cw[cur];
        needC += L.cc[target] - L.cc[cur];
        needI += L.ci[target] - L.ci[cur];
    }
    rest = rest * HQ_MOD[lv[I_HQ]] / ctx.worldSpeed;

    if (plan.bank) { needW += plan.bankW; needC += plan.bankC; needI += plan.bankI; }

    if (rest === 0 && needW === 0 && needC === 0 && needI === 0) return 0;

    // Depodaki hammadde ihtiyactan dusulur; kalani mevcut gelirle toplamak gerekir.
    // Asker uretimi aciksa insaata gelirin (1 - pay) kadari kalir.
    let resTime = 0;
    if (!ctx.feedUnlimited) {
        const keep = ctx.troops ? 1 - ctx.troops.share : 1;
        const pw = (ctx.prod[lv[I_WOOD]] + ctx.feedW) * keep;
        const pc = (ctx.prod[lv[I_CLAY]] + ctx.feedC) * keep;
        const pi = (ctx.prod[lv[I_IRON]] + ctx.feedI) * keep;
        resTime = Math.max(0, (needW - st.w) / pw, (needC - st.c) / pc, (needI - st.i) / pi);
    }

    // Insaat ve toplama es zamanli: surelerin buyugu belirleyici.
    let h = Math.max(rest, resTime);

    // Asker modunda uretim su an duruyorsa (kisla yok, ahir yetismiyor, ciftlik
    // dolu) bu hal kalan sure boyunca da surecekmis gibi sayilir. Aramanin
    // kislayi/ciftligi ancak cezasi birikince degil, onceden gormesi icin.
    if (plan.army) {
        const eco = economy(lv, st.pop, st.army, ctx, ECO_H);
        const idleFrac = eco.budget > 0 ? 1 - eco.spend / eco.budget : 1;
        h += idleFrac * h;
    }
    return h;
}

const ECO_H = {};

function levelKey(lv, idx) {
    let s = '';
    for (let k = 0; k < idx.length; k++) s += String.fromCharCode(48 + lv[idx[k]]);
    return s;
}

function unwind(state) {
    const queue = [];
    for (let s = state; s && s.prev; s = s.prev) queue.push(s.move);
    return queue.reverse();
}

const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));

// --- CILALAMA (yerel arama) -------------------------------------------------------
// Kuyrugu index dizisi olarak tutar. Her adayi bastan degil, degisikligin
// basladigi yerden simule eder (onceki durumlar onbellekte). Bir aday mevcut en
// iyi degeri gectigi an kesilir: sure ve bosa giden pay hep artar, bitis sonrasi
// sure de eksi olmaz.

// work.steps: simule edilen adim sayaci (cilalama butcesi bununla olculur).
function evalSeq(at, len, from, st0, plan, ctx, bound, work) {
    let st = st0;
    for (let p = from; p < len; p++) {
        work.steps++;
        st = stepBuild(st, at(p), ctx, plan.capArr);
        if (!st || st.time + wastePenalty(st, plan) >= bound) return null;
    }
    if (!isGoal(st, plan)) return null;
    const total = finalScore(st, plan, ctx);
    return total < bound ? { st, total } : null;
}

function prefixStates(q, start, plan, ctx, from, states) {
    for (let k = from; k < q.length; k++) states[k + 1] = stepBuild(states[k], q[k], ctx, plan.capArr);
    states.length = q.length + 1;
    return states;
}

async function polish(queue, start, plan, ctx, deep, onProgress) {
    // Butce sure ile degil simule edilen adim sayisiyla olculur: ayni ayarlar her
    // cihazda ayni kuyrugu verir (normal ayarda masaustunde ~2 sn). Cok yavas
    // cihazlar icin ayrica bir sure siniri var.
    const budgetSteps = deep ? 60e6 : 20e6;
    const hardLimitMs = deep ? 60000 : 20000;
    const window = deep ? 40 : 15;
    const MIN_GAIN = 0.5;
    const t0 = Date.now();
    let lastYield = t0;
    const work = { steps: 0 };
    const withinBudget = () => work.steps < budgetSteps && Date.now() - t0 < hardLimitMs;

    let q = queue.slice();
    let states = prefixStates(q, start, plan, ctx, 0, [start]);
    let final = states[q.length];
    let best = finalScore(final, plan, ctx);
    if (!isFinite(best)) return { queue: q, total: best, state: final };

    const counts = new Uint16Array(NB);
    for (const b of q) counts[b]++;

    const pause = async (pass) => {
        const now = Date.now();
        if (now - lastYield > 40) {
            lastYield = now;
            if (onProgress) onProgress(pass, 0, 'polish');
            await nextFrame();
        }
        return withinBudget();
    };

    const accept = (newQ, from, res) => {
        q = newQ;
        states = prefixStates(q, start, plan, ctx, from, states);
        best = res.total;
        final = states[q.length];
    };

    let improved = true;
    let pass = 0;
    while (improved && withinBudget()) {
        improved = false;
        pass++;

        // 1) Tasima: i. adimi pencere icindeki baska bir siraya al.
        for (let i = 0; i < q.length; i++) {
            const n = q.length;
            const item = q[i];
            let bestRes = null, bestJ = -1;
            const lo = Math.max(0, i - window), hi = Math.min(n - 1, i + window);
            for (let j = lo; j <= hi; j++) {
                if (j === i || q[j] === item) continue;
                let at;
                if (j < i) at = p => (p < j || p > i) ? q[p] : (p === j ? item : q[p - 1]);
                else at = p => (p < i || p > j) ? q[p] : (p === j ? item : q[p + 1]);
                const from = Math.min(i, j);
                const res = evalSeq(at, n, from, states[from], plan, ctx, (bestRes ? bestRes.total : best) - MIN_GAIN, work);
                if (res) { bestRes = res; bestJ = j; }
            }
            if (bestRes) {
                const newQ = q.slice();
                newQ.splice(i, 1);
                newQ.splice(bestJ, 0, item);
                accept(newQ, Math.min(i, bestJ), bestRes);
                improved = true;
            }
            if (!(await pause(pass))) break;
        }

        // 2) Silme: hedefe katkisi olmayan adimlar (ornegin gereksiz bir depo seviyesi).
        for (let i = q.length - 1; i >= 0 && withinBudget(); i--) {
            const n = q.length;
            const res = evalSeq(p => q[p + 1], n - 1, i, states[i], plan, ctx, best - MIN_GAIN, work);
            if (res) {
                counts[q[i]]--;
                const newQ = q.slice();
                newQ.splice(i, 1);
                accept(newQ, i, res);
                improved = true;
            }
            if (!(await pause(pass))) break;
        }

        // 3) Ekleme: araya bir yardimci seviye (ocak/depo/ciftlik/ana bina) koymak
        //    sonradan kazandirdigindan fazla zaman almiyorsa tut.
        for (let j = 0; j <= q.length && withinBudget(); j++) {
            const n = q.length;
            let bestRes = null, bestH = -1;
            for (const h of plan.helperIdx) {
                if (start.lv[h] + counts[h] >= plan.capArr[h]) continue;
                if (j < n && q[j] === h) continue;
                const res = evalSeq(p => p < j ? q[p] : (p === j ? h : q[p - 1]), n + 1, j, states[j], plan, ctx,
                    (bestRes ? bestRes.total : best) - MIN_GAIN, work);
                if (res) { bestRes = res; bestH = h; }
            }
            if (bestRes) {
                counts[bestH]++;
                const newQ = q.slice();
                newQ.splice(j, 0, bestH);
                accept(newQ, j, bestRes);
                improved = true;
            }
            if (!(await pause(pass))) break;
        }
    }

    return { queue: q, total: best, state: final };
}

/**
 * Verilen hedefe en hizli ulasan insaat kuyrugunu hesaplar.
 *
 * @param {object}   opts.startLevels    mevcut bina seviyeleri
 * @param {number}   opts.worldSpeed     dunya hizi
 * @param {number}   opts.mineSpeed      hammadde uretim faktoru
 * @param {string}   [opts.mode]         OPTIMIZER_PRESETS anahtari (varsayilan 'academy')
 * @param {boolean}  [opts.deep]         genis arama (daha iyi sonuc, daha uzun sure)
 * @param {object}   [opts.feed]         baska koylerden saatlik gelen hammadde {w, c, i}
 * @param {boolean}  [opts.feedUnlimited] hammadde hic beklenmesin
 * @param {object}   [opts.troops]       asker uretimi {share: %, profile: 'off'|'def'}
 * @param {object}   [opts.goal]         hedef seviyeler (hazir mod yerine; ozel hedef)
 * @param {object}   [opts.caps]         aramaya acik binalar ve tavanlari
 * @param {number}   [opts.beamWidth]    her derinlikte tutulan durum sayisi
 * @param {number}   [opts.maxDepth]     kuyruktaki maksimum bina sayisi
 * @param {boolean}  [opts.polish]       cilalama asamasi (varsayilan acik)
 * @param {function} [onProgress]        (ilerleme, toplam, asama) => void
 *                                        asama 'search': ilerleme yuzde (toplam 100),
 *                                        asama 'polish': cilalama turu (toplam 0)
 * @returns {Promise<{queue: string[], seconds: number, buildSeconds: number,
 *          extraSeconds: number, explored: number, army: object|null,
 *          score: number, searchScore: number} | null>}
 *   seconds: hedefe toplam sure (insaat + ilk soyluda birikim), extraSeconds: birikim,
 *   army: asker uretimi aciksa kuyruk sonundaki asker ve butce kullanimi,
 *   score / searchScore: cilalamadan sonraki / onceki karsilastirma degeri.
 */
export async function optimizeQueue(opts, onProgress) {
    const mode = OPTIMIZER_PRESETS[opts.mode] ? opts.mode : 'academy';
    const preset = OPTIMIZER_PRESETS[mode];

    // Asker modu asker uretimi, besleme modu besleme olmadan anlamsiz; ayar
    // yoksa varsayilanla calisilir (arayuz bunlari zaten acik gonderir).
    const settings = {
        worldSpeed: opts.worldSpeed, mineSpeed: opts.mineSpeed,
        feed: opts.feed, feedUnlimited: !!opts.feedUnlimited, troops: opts.troops || null
    };
    if (preset.army && !(settings.troops && settings.troops.share > 0)) {
        settings.troops = { share: DEFAULT_TROOP_SHARE, profile: 'off' };
    }
    if (preset.feed && !settings.feedUnlimited && !hasFeed(settings.feed)) settings.feedUnlimited = true;

    const ctx = makeSimContext(settings);
    const start = makeState(opts.startLevels);
    const plan = resolvePlan(mode, preset, opts, start, ctx);
    if (!plan) return null;
    // Asker uretimi, en son ciftlikte hedefteki binalara (ve tavanina kadar
    // cikabilecek ana bina/ocaklara) gereken nufusu bos birakir; ciftlik askerle
    // dolup son seviyeleri kilitlemesin.
    const lvFinal = start.lv.slice();
    for (const [b, target] of plan.goalList) if (lvFinal[b] < target) lvFinal[b] = target;
    for (const b of [I_HQ, I_WOOD, I_CLAY, I_IRON, I_FARM]) lvFinal[b] = Math.max(lvFinal[b], plan.capArr[b]);
    ctx.finalRoom = finalRoom(lvFinal);

    const result = (queueIdx, final, score, explored, searchScore) => {
        const extra = terminalSeconds(final, plan, ctx);
        return {
            queue: queueIdx.map(b => BKEYS[b]),
            seconds: final.time + extra,
            buildSeconds: final.time,
            extraSeconds: extra,
            explored,
            score,
            searchScore,
            army: ctx.troops ? {
                pop: final.army,
                byFacility: [final.ab, final.as, final.aw],
                profile: ctx.troops.profile,
                budget: final.tb,
                spent: final.ts
            } : null
        };
    };

    // Ilk soyluda binalar hazir olsa bile ocak/depo yukseltmek birikimi kisaltabilir;
    // orada arama yine calisir. Diger hedeflerde yapilacak bir sey kalmamistir.
    if (isGoal(start, plan) && !plan.bank) {
        const score = finalScore(start, plan, ctx);
        if (!isFinite(score)) return null;
        return result([], start, score, 0, score);
    }

    // Isin aramasi ve cilalama genislikle hep iyilesmez: dar bir isin bazen
    // genisin budadigi bir yolu tutar. Detayli arama, normal aramanin aynisini da
    // calistirip en iyisini aldigi icin normalden hic kotu cikmaz.
    const runs = opts.beamWidth ? [{ width: opts.beamWidth, deep: !!opts.deep }]
        : [{ width: preset.beamWidth, deep: false }];
    if (!opts.beamWidth && opts.deep) runs.push({ width: preset.deepBeamWidth, deep: true });

    let explored = 0;
    let bestRun = null;
    for (let k = 0; k < runs.length; k++) {
        const found = await beamSearch(start, plan, ctx, runs[k].width, opts.maxDepth, onProgress,
            k / runs.length, 1 / runs.length);
        explored += found.explored;
        if (!found.best) continue;

        const run = { queue: unwind(found.best), state: found.best, score: found.score, searchScore: found.score };
        if (opts.polish !== false) {
            const polished = await polish(run.queue, start, plan, ctx, runs[k].deep, onProgress);
            if (polished.total < run.score) {
                run.queue = polished.queue;
                run.state = polished.state;
                run.score = polished.total;
            }
        }
        if (!bestRun || run.score < bestRun.score) bestRun = run;
    }

    if (!bestRun || !isFinite(bestRun.score)) return null;
    return result(bestRun.queue, bestRun.state, bestRun.score, explored, bestRun.searchScore);
}

// Isin aramasi. Ilerleme cubugu birden fazla aramaya bolunebilsin diye
// progressFrom/progressSpan (0-1) ile hangi dilimi doldurdugunu bilir.
async function beamSearch(start, plan, ctx, beamWidth, depthLimit, onProgress, progressFrom, progressSpan) {
    // Her adim tek seviye yukselttigi icin kuyruk en fazla "aramaya acik tum
    // seviyeler" kadar uzayabilir; derinlik sinirini tavanlardan turetiyoruz.
    let maxDepth = depthLimit;
    if (!maxDepth) {
        maxDepth = 0;
        for (const b of plan.searchIdx) maxDepth += plan.capArr[b] - start.lv[b];
    }

    let frontier = [start];
    let best = null;
    let bestTotal = Infinity;
    let explored = 0;

    if (isGoal(start, plan)) {
        best = start;
        bestTotal = finalScore(start, plan, ctx);
    }

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
        // Ayni seviye tablosuna ulasan durumlardan sadece en iyisini tutariz.
        const seen = new Map();

        for (const state of frontier) {
            for (const b of plan.searchIdx) {
                const next = stepBuild(state, b, ctx, plan.capArr);
                if (!next) continue;
                explored++;

                let f;
                if (isGoal(next, plan)) {
                    const total = finalScore(next, plan, ctx);
                    if (total < bestTotal) { best = next; bestTotal = total; }
                    // Ilk soyluda hedefteki durum da genislemeye devam eder: biraz daha
                    // ocak/depo birikimi kisaltip toplami dusurebilir. Bu durumlar kendi
                    // gercek toplamlariyla siralanir ve budanmaz; tek bir ocak bazen
                    // tek basina kazandirmaz (darbogaz baska hammaddededir) ama
                    // birkaci birlikte kazandirir.
                    if (!plan.bank) continue;
                    f = total;
                } else {
                    // Elimizde bir cozum varsa, ondan daha iyi olamayacak dallari kes.
                    f = next.time + wastePenalty(next, plan) + heuristic(next, plan, ctx);
                    if (f >= bestTotal) continue;
                }

                const key = levelKey(next.lv, plan.searchIdx);
                const rival = seen.get(key);
                if (!rival || f < rival.f) seen.set(key, { state: next, f });
            }
        }

        frontier = [...seen.values()].sort((a, b) => a.f - b.f)
            .slice(0, beamWidth)
            .map(entry => entry.state);

        // Her 5 derinlikte bir olay dongusune don, arayuz donmasin.
        if (onProgress && depth % 5 === 0) {
            onProgress(Math.round(100 * (progressFrom + progressSpan * depth / maxDepth)), 100, 'search');
            await nextFrame();
        }
    }

    return { best: isFinite(bestTotal) ? best : null, score: bestTotal, explored };
}
