import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // YENİ: Çeviri motoru eklendi
import { useSearchParams } from 'react-router-dom';
import { bumpStat } from '../utils/twApi';
import storage from '../utils/storage';
import './BuildingPlanner.css';

import {
    db, icons, dictionary, getTotalPts,
    getBaseLevels, getDefaultStartLevels, buildStartupQueue, buildAccountManagerCode,
    parseAccountManagerCode
} from '../utils/twBuildingData';
import { optimizeQueue, DEFAULT_TROOP_SHARE } from '../utils/queueOptimizer';
import { makeSimContext, simulateRows } from '../utils/villageSim';
import {
    buildBotCode, parseBotInput, stripStartLevels, estimateMineSpeed, botReturnLink
} from '../utils/botBridge';

// Optimizasyon hedefleri. Her biri icin ceviri anahtarlari
// buildingPlanner.optimizer.mode<Ad> ve .desc<Ad> seklinde.
const OPTIMIZE_MODES = [
    { id: 'academy', key: 'Academy' },
    { id: 'noble', key: 'Noble' },
    { id: 'full', key: 'Full' },
    { id: 'res', key: 'Res' },
    { id: 'military', key: 'Military' },
    { id: 'feed', key: 'Feed' },
    { id: 'custom', key: 'Custom' }
];

// Asker profilleri: kisla/ahir/atolyede basilan nufus -> birlik sayisi.
// Savunmada kislanin nufusu mizrak ve kilic arasinda esit paylasilir.
const ARMY_UNITS = {
    off: [['axe', 0, 1], ['lc', 1, 4], ['ram', 2, 5]],
    def: [['spear', 0, 2], ['sword', 0, 2], ['hc', 1, 6]]
};

function armyText(army, profile, t) {
    if (!army) return '';
    return (ARMY_UNITS[profile] || ARMY_UNITS.off)
        .map(([unit, fac, div]) => [unit, Math.floor(army[fac] / div)])
        .filter(([, count]) => count > 0)
        .map(([unit, count]) => `${count.toLocaleString()} ${t(`unitCalculator.units.${unit}`)}`)
        .join(' · ');
}

// formatClock artık çeviri fonksiyonunu (t) alıyor
function formatClock(seconds, t) {
    if(!isFinite(seconds)) return t('buildingPlanner.status.storageFull');
    if(seconds === 0) return "00:00:00";
    let d = Math.floor(seconds / 86400);
    let h = Math.floor((seconds % 86400) / 3600);
    let m = Math.floor((seconds % 3600) / 60);
    let s = Math.floor(seconds % 60);
    let tStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return d > 0 ? `${d}${t('buildingPlanner.daysShort')} ${tStr}` : tStr;
}

const BuildingPlanner = () => {
    const { t } = useTranslation(); // YENİ: Çeviri fonksiyonu
    bumpStat("sims");
    // Tablo sütunları çeviriden dinamik olarak oluşturuluyor
    const getColumns = () => [
        t('buildingPlanner.columns.order'), t('buildingPlanner.columns.expectedWait'), t('buildingPlanner.columns.building'),
        t('buildingPlanner.columns.level'), t('buildingPlanner.columns.buildTime'), t('buildingPlanner.columns.startTime'),
        t('buildingPlanner.columns.endTime'), t('buildingPlanner.columns.points'), t('buildingPlanner.columns.cost'),
        t('buildingPlanner.columns.resWait'), t('buildingPlanner.columns.currentStorage'), t('buildingPlanner.columns.hourlyProd'),
        t('buildingPlanner.columns.pop'), t('buildingPlanner.columns.storage'), t('buildingPlanner.columns.desc'), t('buildingPlanner.columns.action')
    ];
    const columns = getColumns();

    const [worldSpeed, setWorldSpeed] = useState(() => storage.get('bp_ws', 5.0));
    const [mineSpeed, setMineSpeed] = useState(() => storage.get('bp_ms', 1.5));

    // Koy ekonomisi: baska koylerden gelen saatlik hammadde (her biri) ve
    // gelirin askere ayrilan payi. Hem tablo hem optimizasyon bunlari kullanir.
    const [feed, setFeed] = useState(() => storage.get('bp_feed', 0));
    const [feedUnlimited, setFeedUnlimited] = useState(() => storage.get('bp_feed_inf', false));
    const [troopShare, setTroopShare] = useState(() => storage.get('bp_troop_share', 0));
    const [troopProfile, setTroopProfile] = useState(() => storage.get('bp_troop_profile', 'off'));

    const defaultLevels = getDefaultStartLevels();
    const [startLevels, setStartLevels] = useState(() => storage.get('bp_levels', defaultLevels));
    
    const [queue, setQueue] = useState(() => storage.get('bp_queue', []));
    
    const [visibleCols, setVisibleCols] = useState(() => {
        const initial = {};
        for(let i=0; i<16; i++) initial[i] = true;
        return storage.get('bp_cols', initial);
    });

    const [fastAddValue, setFastAddValue] = useState("");
    const fastAddInputRef = useRef(null);

    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templateMode, setTemplateMode] = useState('import');
    const [templateText, setTemplateText] = useState('');
    // Ciktiya baslangic seviyelerine ulasan insaatlar da eklensin mi?
    const [includeStartLevels, setIncludeStartLevels] = useState(() => storage.get('bp_export_start', true));
    // Hesap Yoneticisi sablonuna verilecek isim
    const [amName, setAmName] = useState(() => storage.get('bp_am_name', 'TW Cu'));

    // Kuyruk optimizasyonu: hedef, hesap durumu ve onay bekleyen sonuc
    const [optimizeMode, setOptimizeMode] = useState(() => storage.get('bp_opt_mode', 'academy'));
    const [optimizing, setOptimizing] = useState(false);
    const [optimizeProgress, setOptimizeProgress] = useState(0);
    const [optimizeTotal, setOptimizeTotal] = useState(0);
    const [optimizePhase, setOptimizePhase] = useState('search');
    const [optimizeResult, setOptimizeResult] = useState(null);
    const [optimizeError, setOptimizeError] = useState(null);
    const [deepSearch, setDeepSearch] = useState(false);
    // Ozel hedef modunda kullanicinin girdigi hedef seviyeler.
    const [customGoal, setCustomGoal] = useState(() => storage.get('bp_custom_goal', {}));
    const activeMode = OPTIMIZE_MODES.find(m => m.id === optimizeMode) || OPTIMIZE_MODES[0];

    // Br Bot al-ver: gelen kodun onizlemesi, uygulanacak parcalar, gonderilecek
    // sablonun adi ve kod Br Bot'tan geldiyse koye geri donus adresi.
    const [botInput, setBotInput] = useState('');
    const [botPreview, setBotPreview] = useState(null);
    const [botModelIdx, setBotModelIdx] = useState(0);
    const [botApply, setBotApply] = useState({ levels: true, speed: true, mine: true, queue: true });
    const [botMsg, setBotMsg] = useState(null);
    const [botName, setBotName] = useState(() => storage.get('bp_bot_name', 'TW Cu'));
    const [botReturn, setBotReturn] = useState(() => storage.get('bp_bot_return', null));
    const [searchParams, setSearchParams] = useSearchParams();
    const botAreaRef = useRef(null);

    useEffect(() => {
        storage.set('bp_ws', worldSpeed);
        storage.set('bp_ms', mineSpeed);
        storage.set('bp_levels', startLevels);
        storage.set('bp_queue', queue);
        storage.set('bp_cols', visibleCols);
        storage.set('bp_export_start', includeStartLevels);
        storage.set('bp_am_name', amName);
        storage.set('bp_opt_mode', optimizeMode);
        storage.set('bp_feed', feed);
        storage.set('bp_feed_inf', feedUnlimited);
        storage.set('bp_troop_share', troopShare);
        storage.set('bp_troop_profile', troopProfile);
        storage.set('bp_custom_goal', customGoal);
        storage.set('bp_bot_name', botName);
        storage.set('bp_bot_return', botReturn);
    }, [worldSpeed, mineSpeed, startLevels, queue, visibleCols, includeStartLevels, amName, optimizeMode,
        feed, feedUnlimited, troopShare, troopProfile, customGoal, botName, botReturn]);

    const handleLevelChange = (key, val) => {
        let parsed = parseInt(val) || 0;
        if (parsed < 0) parsed = 0;
        if (parsed > db[key].max) parsed = db[key].max;
        setStartLevels(prev => ({ ...prev, [key]: parsed }));
    };

    // Baslangic seviyelerini yeni bir koyun seviyelerine dondurur: ana bina,
    // ciftlik, depo ve ictima meydani 1, digerleri 0.
    const resetStartLevels = () => {
        if (!window.confirm(t('buildingPlanner.levelsResetConfirm'))) return;
        setStartLevels(getDefaultStartLevels());
    };

    const handleGoalChange = (key, val) => {
        let parsed = parseInt(val) || 0;
        if (parsed < 0) parsed = 0;
        if (parsed > db[key].max) parsed = db[key].max;
        setCustomGoal(prev => ({ ...prev, [key]: parsed }));
        setOptimizeResult(null);
    };

    // Simulasyon ayarlari: tablo ve optimizasyon ayni ekonomiyle calissin.
    const econSettings = useMemo(() => ({
        feed: feed > 0 ? { w: feed, c: feed, i: feed } : null,
        feedUnlimited,
        troops: troopShare > 0 ? { share: troopShare, profile: troopProfile } : null
    }), [feed, feedUnlimited, troopShare, troopProfile]);

    const toggleColumn = (idx) => { setVisibleCols(prev => ({ ...prev, [idx]: !prev[idx] })); };
    const changeQueueItem = (index, newId) => { const newQ = [...queue]; newQ[index] = newId; setQueue(newQ); };
    const removeQueueItem = (index) => { const newQ = [...queue]; newQ.splice(index, 1); setQueue(newQ); };

    const addBuildingToQueue = (bldgId) => {
        const currentLvl = currentTargetLevels[bldgId];
        if (currentLvl < db[bldgId].max) {
            setQueue(prev => [...prev, bldgId]);
        }
    };

    const handleFastAddInput = (e) => {
        const val = e.target.value;
        setFastAddValue(val);
        // Girilen değere en yakın çevrilmiş bina ismini bulur
        const foundKey = Object.keys(db).find(k => t(`buildingPlanner.buildings.${k}`).toLowerCase() === val.toLowerCase());
        if (foundKey) {
            addBuildingToQueue(foundKey);
            setFastAddValue("");
            setTimeout(() => { if (fastAddInputRef.current) fastAddInputRef.current.focus(); }, 10);
        }
    };

    const handleFastAddKeyDown = (e) => {
        if (e.key === 'Enter') {
            const foundKey = Object.keys(db).find(k => t(`buildingPlanner.buildings.${k}`).toLowerCase() === fastAddValue.toLowerCase());
            if (foundKey) {
                addBuildingToQueue(foundKey);
                setFastAddValue("");
                setTimeout(() => { if (fastAddInputRef.current) fastAddInputRef.current.focus(); }, 10);
            }
        }
    };

    const handleDragStart = (e, index) => {
        e.dataTransfer.setData("dragIndex", index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData("dragIndex"));
        if (isNaN(dragIndex) || dragIndex === dropIndex) return;

        const newQueue = [...queue];
        const [movedItem] = newQueue.splice(dragIndex, 1);
        newQueue.splice(dropIndex, 0, movedItem);
        setQueue(newQueue);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const currentTargetLevels = useMemo(() => {
        let levels = { ...startLevels };
        queue.forEach(id => {
            if (levels[id] < db[id].max) {
                levels[id]++;
            }
        });
        return levels;
    }, [startLevels, queue]);

    // Kuyrugun satir satir simulasyonu. Hesap villageSim.js'te; optimizasyon da
    // ayni fizigi kullandigi icin bulunan sure tabloda birebir gorunur.
    const simulationRows = useMemo(() => {
        const ctx = makeSimContext({ worldSpeed, mineSpeed, ...econSettings });
        return simulateRows(queue, startLevels, ctx).map(row => {
            const descArr = [];
            if (row.warn.storage) descArr.push(t('buildingPlanner.status.storageLimit'));
            if (row.warn.missing.length > 0) {
                const missing = row.warn.missing.map(([key, lvl]) => `${t('buildingPlanner.buildings.' + key)}(${lvl})`);
                descArr.push(`${t('buildingPlanner.status.requirement')}: ${missing.join(", ")}`);
            }
            if (row.warn.waiting) descArr.push(t('buildingPlanner.status.waitingRes'));
            if (row.warn.farm) descArr.push(t('buildingPlanner.status.farmLimit'));
            if (row.warn.max) descArr.push(t('buildingPlanner.status.maxLevel'));
            return { ...row, descArr };
        });
    }, [worldSpeed, mineSpeed, econSettings, startLevels, queue, t]);

    // Secili hedef degisince onceki hesabin sonucu artik gecerli degil. Asker
    // modu asker uretimi, beslemeli koy modu besleme olmadan anlamsiz; ayar
    // kapaliysa varsayilanla acilir (ayarlar gorunur oldugu icin kullanici degistirebilir).
    const changeOptimizeMode = (mode) => {
        if (optimizing || mode === optimizeMode) return;
        setOptimizeMode(mode);
        setOptimizeResult(null);
        setOptimizeError(null);
        if (mode === 'military' && !(troopShare > 0)) setTroopShare(DEFAULT_TROOP_SHARE);
        if (mode === 'feed' && !(feed > 0) && !feedUnlimited) setFeedUnlimited(true);
    };

    // Ozel hedefte baslangic seviyelerini asan en az bir hedef olmali.
    const customGoalActive = Object.keys(db).some(key => (customGoal[key] || 0) > (startLevels[key] || 0));

    // Mevcut baslangic seviyelerinden secili hedefe en hizli ulasan kuyrugu hesaplar.
    // Sonuc dogrudan uygulanmaz; kullanici onizleyip "Uygula" derse kuyruga yazilir.
    const handleOptimize = async () => {
        if (optimizeMode === 'custom' && !customGoalActive) {
            setOptimizeError(t('buildingPlanner.optimizer.customEmpty'));
            return;
        }
        setOptimizing(true);
        setOptimizeError(null);
        setOptimizeResult(null);
        setOptimizeProgress(0);
        setOptimizeTotal(0);
        setOptimizePhase('search');

        // Arayuzun "hesaplaniyor" durumunu boyayabilmesi icin bir kare bekle.
        await new Promise(resolve => setTimeout(resolve, 30));

        try {
            const result = await optimizeQueue(
                {
                    startLevels, worldSpeed, mineSpeed, mode: optimizeMode, deep: deepSearch,
                    ...econSettings,
                    goal: optimizeMode === 'custom' ? customGoal : undefined
                },
                (progress, total, phase) => { setOptimizeProgress(progress); setOptimizeTotal(total); setOptimizePhase(phase); }
            );
            if (!result) {
                setOptimizeError(t('buildingPlanner.optimizer.noSolution'));
            } else if (result.queue.length === 0) {
                setOptimizeError(t('buildingPlanner.optimizer.alreadyDone'));
            } else {
                setOptimizeResult(result);
            }
        } catch (err) {
            setOptimizeError(t('buildingPlanner.optimizer.failed'));
        } finally {
            setOptimizing(false);
        }
    };

    const applyOptimizeResult = () => {
        if (!optimizeResult) return;
        setQueue(optimizeResult.queue);
        setOptimizeResult(null);
    };

    // Onizleme icin kuyrugu "bina x adet (hedef seviye)" seklinde ozetler.
    const optimizeSummary = useMemo(() => {
        if (!optimizeResult) return [];
        const levels = { ...startLevels };
        const counts = {};
        optimizeResult.queue.forEach(id => {
            levels[id] = (levels[id] || 0) + 1;
            counts[id] = (counts[id] || 0) + 1;
        });
        return Object.keys(counts)
            .sort((a, b) => counts[b] - counts[a])
            .map(id => ({ id, count: counts[id], from: startLevels[id] || 0, to: levels[id] }));
    }, [optimizeResult, startLevels]);

    const handleOpenImport = () => {
        setTemplateMode('import'); setTemplateText(''); setShowTemplateModal(true);
    };

    // Cikti metni. includeStart secili ise once bos bir koyden baslangic
    // seviyelerine ulasan insaatlar tek tek yazilir, ardindan kuyruk gelir.
    // Puanlar bastan beri birikimli oldugu icin iki bolum kesintisiz akar.
    const buildExportText = (includeStart) => {
        const lvlText = t('buildingPlanner.modal.levelLabel');
        const ptsText = t('buildingPlanner.modal.pointsLabel');
        const line = (bldgId, lvl, pts) =>
            `${t(`buildingPlanner.buildings.${bldgId}`)} +1 (${lvlText} ${lvl})\n-\n${pts} ${ptsText}\n\n`;

        let txt = `${t('buildingPlanner.modal.exportPrefix')}\n`;

        if (includeStart) {
            const levels = getBaseLevels();
            buildStartupQueue(startLevels).forEach(id => {
                levels[id] += 1;
                txt += line(id, levels[id], getTotalPts(levels));
            });
        }

        simulationRows.forEach(row => { txt += line(row.bldgId, row.targetLvl, row.pts); });

        return txt.trim();
    };

    const handleOpenExport = () => {
        setTemplateMode('export');
        setTemplateText(buildExportText(includeStartLevels));
        setShowTemplateModal(true);
    };

    // Kutucuk degisince metni aninda yeniden uret.
    const toggleIncludeStartLevels = (checked) => {
        setIncludeStartLevels(checked);
        setTemplateText(buildExportText(checked));
    };

    // Hesap Yoneticisi sablonundaki seviyeler mutlaktir: bir binanin N. emri
    // o binanin N. seviyesidir. Bu yuzden baslangic seviyeleri her zaman
    // basa eklenir, yoksa sablon eksik seviyede biter.
    const buildAmCode = (name) =>
        buildAccountManagerCode([...buildStartupQueue(startLevels), ...queue], name);

    const handleOpenAmCode = () => {
        setTemplateMode('amcode');
        setTemplateText(buildAmCode(amName));
        setShowTemplateModal(true);
    };

    const changeAmName = (name) => {
        setAmName(name);
        setTemplateText(buildAmCode(name));
    };

    const handleOpenAmImport = () => {
        setTemplateMode('amimport'); setTemplateText(''); setShowTemplateModal(true);
    };

    // Hesap Yoneticisi kodundaki seviyeler mutlaktir; kod her binayi 1. seviyeden
    // sayar. Planlayicinin kuyrugu ise baslangic seviyelerinin uzerine bindigi
    // icin koyde zaten hazir olan seviyeler ayiklanir, kalani kuyruk olur.
    const handleAmImportSubmit = () => {
        const parsed = parseAccountManagerCode(templateText);
        if (!parsed) { alert(t('buildingPlanner.modal.amImportError')); return; }

        const seen = {};
        const importedQueue = [];
        parsed.queue.forEach(id => {
            seen[id] = (seen[id] || 0) + 1;
            if (seen[id] > (startLevels[id] || 0)) importedQueue.push(id);
        });

        if (importedQueue.length === 0) { alert(t('buildingPlanner.modal.amImportError')); return; }

        setQueue(importedQueue);
        if (parsed.templateName) setAmName(parsed.templateName);
        setShowTemplateModal(false);

        let msg = t('buildingPlanner.modal.amImportSuccess')
            .replace('{{count}}', importedQueue.length)
            .replace('{{name}}', parsed.templateName || '-');
        if (parsed.skipped > 0) {
            msg += '\n' + t('buildingPlanner.modal.amImportSkipped').replace('{{count}}', parsed.skipped);
        }
        alert(msg);
    };

    const handleImportSubmit = () => {
        const lines = templateText.split('\n');
        const importedQueue = [];
        
        lines.forEach(line => {
            if(line.includes('+1')) {
                let rawName = line.split('+1')[0].trim().toLowerCase();
                rawName = rawName.replace(/\u00a0/g, ' '); 
                
                const internalId = dictionary[rawName];
                if(internalId && db[internalId]) {
                    importedQueue.push(internalId);
                }
            }
        });

        if(importedQueue.length > 0) {
            setQueue(importedQueue);
            setShowTemplateModal(false);
            alert(t('buildingPlanner.modal.success').replace('{{count}}', importedQueue.length));
        } else {
            alert(t('buildingPlanner.modal.error'));
        }
    };

    // --- Br Bot al-ver ---------------------------------------------------------

    // Br Bot'a gidecek kod: baslangic seviyeleri + kuyruk, bos koyden mutlak model.
    // Br Bot koyde zaten olan seviyeleri kendisi atlar.
    const botCode = useMemo(
        () => buildBotCode({ name: botName, steps: [...buildStartupQueue(startLevels), ...queue] }),
        [botName, startLevels, queue]
    );

    const handleOpenBot = () => {
        setTemplateMode('bot');
        setBotMsg(null);
        setShowTemplateModal(true);
    };

    // Yapistirilan (ya da adresten gelen) kodu cozup onizlemeye koyar.
    const previewBotInput = (text) => {
        const parsed = parseBotInput(text);
        if (!parsed) {
            setBotPreview(null);
            setBotMsg({ ok: false, text: t('buildingPlanner.bot.invalid') });
            return false;
        }
        setBotPreview(parsed);
        setBotModelIdx(0);
        setBotApply({ levels: true, speed: true, mine: true, queue: true });
        setBotMsg(null);
        return true;
    };

    const botMineGuess = botPreview
        ? estimateMineSpeed(botPreview.prodPerHour, botPreview.villageLevels, botPreview.worldSpeed)
        : null;

    const applyBotPreview = () => {
        const p = botPreview;
        if (!p) return;
        const model = p.models[botModelIdx] || p;

        let levels = startLevels;
        if (p.villageLevels && botApply.levels) {
            levels = p.villageLevels;
            setStartLevels(levels);
        }
        if (p.worldSpeed && botApply.speed) setWorldSpeed(p.worldSpeed);
        if (botMineGuess && botApply.mine) setMineSpeed(botMineGuess);
        if (botApply.queue) setQueue(stripStartLevels(model.steps, levels));
        if (model.name) setBotName(model.name);
        if (p.returnUrl) setBotReturn({ url: p.returnUrl, name: p.villageName, coord: p.villageCoord });

        setOptimizeResult(null);
        setBotPreview(null);
        setBotInput('');
        let text = t('buildingPlanner.bot.applied');
        if (model.skipped > 0) text += ' ' + t('buildingPlanner.bot.skipped').replace('{{count}}', model.skipped);
        setBotMsg({ ok: true, text });
    };

    const sendBotBack = () => {
        if (!botReturn) return;
        window.open(botReturnLink(botReturn.url, botCode), '_blank', 'noopener');
    };

    // Br Bot "TwCu'da ac" dediginde kod adresle gelir (#/building-planner?bot=...).
    // Onizleme acilir; kullanici onaylamadan hicbir sey degismez. Kod adresten
    // silinir ki sayfa yenilenince tekrar sorulmasin.
    useEffect(() => {
        const incoming = searchParams.get('bot');
        if (!incoming) return;
        setTemplateMode('bot');
        setShowTemplateModal(true);
        setBotInput(incoming);
        previewBotInput(incoming);
        const rest = new URLSearchParams(searchParams);
        rest.delete('bot');
        setSearchParams(rest, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Al-ver paneli optimizasyon kutusunun altinda acilir; ekranda gorunsun.
    useEffect(() => {
        if (showTemplateModal && templateMode === 'bot' && botAreaRef.current) {
            botAreaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [showTemplateModal, templateMode]);

    const lastRow = simulationRows.length > 0 ? simulationRows[simulationRows.length - 1] : null;
    const totalBuildTimeOnly = simulationRows.reduce((acc, row) => acc + row.buildTime, 0);
    const totalTimeWithWait = lastRow ? lastRow.endTime : 0;
    const bottlenecks = simulationRows.filter(row => row.maxWait > 0 && isFinite(row.maxWait));

    return (
        <div className="bp-container">
            <h1 className="bp-header">{t('buildingPlanner.title')}</h1>
            
            <div className="bp-panel">
                <div className="bp-settings-grid">
                    <div>{t('buildingPlanner.worldSpeed')} <input type="number" value={worldSpeed} step="0.1" min="0.1" onChange={e => setWorldSpeed(parseFloat(e.target.value) || 1)} /></div>
                    <div>{t('buildingPlanner.mineSpeed')} <input type="number" value={mineSpeed} step="0.1" min="0.1" onChange={e => setMineSpeed(parseFloat(e.target.value) || 1)} /></div>
                    
                    <div style={{marginLeft: 'auto'}}>
                        <button onClick={handleOpenImport} className="bp-btn-secondary">{t('buildingPlanner.btn.import')}</button>
                        <button onClick={handleOpenExport} className="bp-btn-secondary">{t('buildingPlanner.btn.export')}</button>
                        <button onClick={handleOpenAmImport} className="bp-btn-secondary">{t('buildingPlanner.btn.amImport')}</button>
                        <button onClick={handleOpenAmCode} className="bp-btn-secondary">{t('buildingPlanner.btn.amCode')}</button>
                        <button onClick={handleOpenBot} className="bp-btn-secondary" style={{marginRight: '15px'}}>{t('buildingPlanner.btn.bot')}</button>
                        <button onClick={() => setQueue([])} className="bp-btn-clear">{t('buildingPlanner.btn.clear')}</button>
                    </div>
                </div>

                <div className="bp-settings-grid bp-econ-grid">
                    <div title={t('buildingPlanner.econ.feedHint')}>
                        {t('buildingPlanner.econ.feed')}
                        <input type="number" value={feed} step="500" min="0" disabled={feedUnlimited}
                            onChange={e => setFeed(Math.max(0, parseInt(e.target.value) || 0))} />
                        <label className="bp-econ-check" title={t('buildingPlanner.econ.feedUnlimitedHint')}>
                            <input type="checkbox" checked={feedUnlimited} onChange={e => setFeedUnlimited(e.target.checked)} />
                            {t('buildingPlanner.econ.feedUnlimited')}
                        </label>
                    </div>
                    <div title={t('buildingPlanner.econ.troopsHint')}>
                        {t('buildingPlanner.econ.troops')}
                        <input type="number" value={troopShare} step="5" min="0" max="90"
                            onChange={e => setTroopShare(Math.min(90, Math.max(0, parseInt(e.target.value) || 0)))} />
                        <select className="bp-econ-select" value={troopProfile} disabled={!(troopShare > 0)}
                            onChange={e => setTroopProfile(e.target.value)}>
                            <option value="off">{t('buildingPlanner.econ.profileOff')}</option>
                            <option value="def">{t('buildingPlanner.econ.profileDef')}</option>
                        </select>
                    </div>
                </div>

                <div className="bp-optimizer">
                    <div className="bp-optimizer-head">
                        <div>
                            <div className="bp-optimizer-title">{t('buildingPlanner.optimizer.title')}</div>
                            <div className="bp-optimizer-modes">
                                {OPTIMIZE_MODES.map(mode => (
                                    <button key={mode.id} type="button" disabled={optimizing}
                                        className={`bp-optimizer-mode${optimizeMode === mode.id ? ' active' : ''}`}
                                        onClick={() => changeOptimizeMode(mode.id)}>
                                        {t(`buildingPlanner.optimizer.mode${mode.key}`)}
                                    </button>
                                ))}
                            </div>
                            <div className="bp-optimizer-desc">
                                {t(`buildingPlanner.optimizer.desc${activeMode.key}`).replace('{{share}}', troopShare || DEFAULT_TROOP_SHARE)}
                            </div>
                        </div>
                        <div className="bp-optimizer-actions">
                            <label className="bp-optimizer-deep" title={t('buildingPlanner.optimizer.deepHint')}>
                                <input type="checkbox" checked={deepSearch} disabled={optimizing}
                                    onChange={e => setDeepSearch(e.target.checked)} />
                                {t('buildingPlanner.optimizer.deep')}
                            </label>
                            <button onClick={handleOptimize} disabled={optimizing} className="bp-btn-action">
                                {!optimizing ? t('buildingPlanner.optimizer.button')
                                    : optimizePhase === 'polish'
                                        ? `${t('buildingPlanner.optimizer.polishing')} ${optimizeProgress}`
                                        : `${t('buildingPlanner.optimizer.calculating')} ${optimizeProgress}${optimizeTotal ? `/${optimizeTotal}` : ''}`}
                            </button>
                        </div>
                    </div>

                    {optimizeMode === 'custom' && (
                        <div className="bp-goal-editor">
                            <div className="bp-goal-head">
                                <span>{t('buildingPlanner.optimizer.customTitle')}</span>
                                <button type="button" className="bp-btn-secondary bp-btn-small" disabled={optimizing}
                                    onClick={() => { setCustomGoal({}); setOptimizeResult(null); }}>
                                    {t('buildingPlanner.optimizer.customReset')}
                                </button>
                            </div>
                            <div className="bp-building-inputs">
                                {Object.entries(db).map(([key, b]) => (
                                    <div key={key} className={`bp-input-group${(customGoal[key] || 0) > (startLevels[key] || 0) ? ' bp-goal-set' : ''}`}>
                                        <span>{t(`buildingPlanner.buildings.${key}`)}</span>
                                        <input type="number" value={customGoal[key] || 0} min="0" max={b.max} disabled={optimizing}
                                            onChange={e => handleGoalChange(key, e.target.value)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {optimizeError && <div className="bp-optimizer-error">{optimizeError}</div>}

                    {optimizeResult && (
                        <div className="bp-optimizer-result">
                            <div className="bp-optimizer-stats">
                                <span className="bp-optimizer-time">
                                    {t('buildingPlanner.optimizer.totalTime')} {formatClock(optimizeResult.seconds, t)}
                                </span>
                                <span>{t('buildingPlanner.optimizer.stepCount').replace('{{count}}', optimizeResult.queue.length)}</span>
                                {optimizeResult.extraSeconds > 0 && (
                                    <span className="bp-optimizer-split">
                                        {t('buildingPlanner.optimizer.buildTime')} {formatClock(optimizeResult.buildSeconds, t)}
                                        {' + '}{t('buildingPlanner.optimizer.bankTime')} {formatClock(optimizeResult.extraSeconds, t)}
                                    </span>
                                )}
                            </div>

                            {optimizeResult.army && optimizeResult.army.pop >= 1 && (
                                <div className="bp-optimizer-army">
                                    {t('buildingPlanner.optimizer.armyTitle')}{' '}
                                    <b>{armyText(optimizeResult.army.byFacility, optimizeResult.army.profile, t)}</b>
                                    {' '}({Math.round(optimizeResult.army.pop).toLocaleString()} {t('buildingPlanner.columns.pop')})
                                    {optimizeResult.army.budget > 0 && (
                                        <span className="bp-optimizer-army-use">
                                            {' — '}{t('buildingPlanner.optimizer.armyUse').replace('{{pct}}',
                                                Math.round(100 * optimizeResult.army.spent / optimizeResult.army.budget))}
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="bp-optimizer-chips">
                                {optimizeSummary.map(item => (
                                    <span key={item.id} className="bp-optimizer-chip">
                                        {icons[item.id] && <img src={icons[item.id]} alt="" />}
                                        {t(`buildingPlanner.buildings.${item.id}`)}
                                        <b>{item.from} → {item.to}</b>
                                    </span>
                                ))}
                            </div>

                            <div className="bp-optimizer-note">{t('buildingPlanner.optimizer.overwriteWarn')}</div>

                            <div>
                                <button onClick={applyOptimizeResult} className="bp-btn-action">
                                    {t('buildingPlanner.optimizer.apply')}
                                </button>
                                <button onClick={() => setOptimizeResult(null)} className="bp-btn-secondary">
                                    {t('buildingPlanner.optimizer.discard')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {showTemplateModal && templateMode === 'bot' && (
                    <div className="bp-template-area" ref={botAreaRef}>
                        <h3 style={{marginTop: 0, color: 'var(--gold)'}}>{t('buildingPlanner.bot.title')}</h3>
                        <div className="bp-am-hint">{t('buildingPlanner.bot.hint')}</div>

                        <div className="bp-bot-grid">
                            <div className="bp-bot-col">
                                <h4>{t('buildingPlanner.bot.importTitle')}</h4>
                                <textarea className="bp-template-textarea bp-bot-textarea" value={botInput}
                                    onChange={e => setBotInput(e.target.value)}
                                    placeholder={t('buildingPlanner.bot.importPlaceholder')} />
                                <button onClick={() => previewBotInput(botInput)} className="bp-btn-action">
                                    {t('buildingPlanner.bot.decode')}
                                </button>

                                {botPreview && (() => {
                                    const model = botPreview.models[botModelIdx] || botPreview;
                                    const baseLevels = botPreview.villageLevels && botApply.levels ? botPreview.villageLevels : startLevels;
                                    const queueCount = stripStartLevels(model.steps, baseLevels).length;
                                    const toggle = (key) => setBotApply(prev => ({ ...prev, [key]: !prev[key] }));
                                    return (
                                        <div className="bp-bot-preview">
                                            {botPreview.models.length > 1 && (
                                                <label className="bp-am-name">
                                                    {t('buildingPlanner.bot.pickModel')}
                                                    <select className="bp-econ-select" value={botModelIdx}
                                                        onChange={e => setBotModelIdx(parseInt(e.target.value) || 0)}>
                                                        {botPreview.models.map((m, i) => (
                                                            <option key={i} value={i}>{m.name || '-'} ({m.steps.length})</option>
                                                        ))}
                                                    </select>
                                                </label>
                                            )}
                                            <div className="bp-bot-title">
                                                {t('buildingPlanner.bot.preview').replace('{{name}}', model.name || '-').replace('{{count}}', model.steps.length)}
                                            </div>
                                            {botPreview.villageName && (
                                                <div className="bp-bot-village">
                                                    {t('buildingPlanner.bot.village').replace('{{name}}', botPreview.villageName).replace('{{coord}}', botPreview.villageCoord)}
                                                </div>
                                            )}
                                            {botPreview.villageLevels && (
                                                <label className="bp-export-opt">
                                                    <input type="checkbox" checked={botApply.levels} onChange={() => toggle('levels')} />
                                                    {t('buildingPlanner.bot.applyLevels')}
                                                </label>
                                            )}
                                            {botPreview.worldSpeed && (
                                                <label className="bp-export-opt">
                                                    <input type="checkbox" checked={botApply.speed} onChange={() => toggle('speed')} />
                                                    {t('buildingPlanner.bot.applySpeed').replace('{{speed}}', botPreview.worldSpeed)}
                                                </label>
                                            )}
                                            {botMineGuess && (
                                                <label className="bp-export-opt">
                                                    <input type="checkbox" checked={botApply.mine} onChange={() => toggle('mine')} />
                                                    {t('buildingPlanner.bot.applyMine').replace('{{factor}}', botMineGuess)}
                                                </label>
                                            )}
                                            <label className="bp-export-opt">
                                                <input type="checkbox" checked={botApply.queue} onChange={() => toggle('queue')} />
                                                {t('buildingPlanner.bot.applyQueue').replace('{{count}}', queueCount)}
                                            </label>
                                            <div>
                                                <button onClick={applyBotPreview} className="bp-btn-action">{t('buildingPlanner.bot.apply')}</button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="bp-bot-col">
                                <h4>{t('buildingPlanner.bot.exportTitle')}</h4>
                                <div className="bp-am-hint">{t('buildingPlanner.bot.exportHint')}</div>
                                <label className="bp-am-name">
                                    {t('buildingPlanner.bot.name')}
                                    <input type="text" value={botName} maxLength={40} onChange={e => setBotName(e.target.value)} />
                                </label>
                                <textarea className="bp-template-textarea bp-bot-textarea" value={botCode} readOnly
                                    onFocus={e => e.target.select()} />
                                <button className="bp-btn-action" onClick={() => {
                                    navigator.clipboard.writeText(botCode);
                                    setBotMsg({ ok: true, text: t('buildingPlanner.modal.copied') });
                                }}>
                                    {t('buildingPlanner.bot.copy')}
                                </button>
                                {botReturn && (
                                    <button className="bp-btn-secondary" onClick={sendBotBack} title={t('buildingPlanner.bot.sendBackHint')}>
                                        {t('buildingPlanner.bot.sendBack')}{botReturn.name ? ` — ${botReturn.name}` : ''}
                                    </button>
                                )}
                            </div>
                        </div>

                        {botMsg && <div className={`bp-bot-msg${botMsg.ok ? ' ok' : ''}`}>{botMsg.text}</div>}
                        <div>
                            <button onClick={() => setShowTemplateModal(false)} className="bp-btn-secondary" style={{background: 'var(--danger-solid)'}}>{t('buildingPlanner.btn.close')}</button>
                        </div>
                    </div>
                )}

                {showTemplateModal && templateMode !== 'bot' && (
                    <div className="bp-template-area">
                        <h3 style={{marginTop: 0, color: 'var(--gold)'}}>
                            {templateMode === 'import' && t('buildingPlanner.modal.importTitle')}
                            {templateMode === 'export' && t('buildingPlanner.modal.exportTitle')}
                            {templateMode === 'amcode' && t('buildingPlanner.modal.amTitle')}
                            {templateMode === 'amimport' && t('buildingPlanner.modal.amImportTitle')}
                        </h3>
                        {templateMode === 'amimport' && (
                            <div className="bp-am-hint">{t('buildingPlanner.modal.amImportHint')}</div>
                        )}
                        {templateMode === 'amcode' && (
                            <>
                                <div className="bp-am-hint">{t('buildingPlanner.modal.amHint')}</div>
                                <label className="bp-am-name">
                                    {t('buildingPlanner.modal.amName')}
                                    <input type="text" value={amName} maxLength={40}
                                        onChange={e => changeAmName(e.target.value)} />
                                </label>
                            </>
                        )}
                        {templateMode === 'export' && (
                            <label className="bp-export-opt" title={t('buildingPlanner.modal.includeStartHint')}>
                                <input type="checkbox" checked={includeStartLevels}
                                    onChange={e => toggleIncludeStartLevels(e.target.checked)} />
                                {t('buildingPlanner.modal.includeStart')}
                            </label>
                        )}
                        <textarea 
                            className="bp-template-textarea" 
                            value={templateText} 
                            onChange={e => setTemplateText(e.target.value)}
                            placeholder={
                                templateMode === 'import' ? t('buildingPlanner.modal.importPlaceholder')
                                : templateMode === 'amimport' ? t('buildingPlanner.modal.amImportPlaceholder')
                                : ""
                            }
                            readOnly={templateMode !== 'import' && templateMode !== 'amimport'}
                        />
                        <div>
                            {templateMode === 'import' && <button onClick={handleImportSubmit} className="bp-btn-action">{t('buildingPlanner.btn.addQueue')}</button>}
                            {templateMode === 'amimport' && <button onClick={handleAmImportSubmit} className="bp-btn-action">{t('buildingPlanner.btn.addQueue')}</button>}
                            {(templateMode === 'export' || templateMode === 'amcode') && <button onClick={() => { navigator.clipboard.writeText(templateText); alert(t('buildingPlanner.modal.copied')); }} className="bp-btn-action">{t('buildingPlanner.btn.copyBoard')}</button>}
                            <button onClick={() => setShowTemplateModal(false)} className="bp-btn-secondary" style={{background: 'var(--danger-solid)'}}>{t('buildingPlanner.btn.close')}</button>
                        </div>
                    </div>
                )}

                <details className="bp-details" style={{marginTop: '15px', background: 'transparent', border: 'none', padding: '0'}}>
                    <summary className="bp-summary" style={{fontSize: '16px', borderBottom: '1px dashed #dcb589', paddingBottom: '5px'}}>
                        {t('buildingPlanner.levelsTitle')}
                    </summary>
                    <div className="bp-building-inputs" style={{marginTop: '15px'}}>
                        {Object.entries(db).map(([key, b]) => (
                            <div key={key} className="bp-input-group">
                                <span>{t(`buildingPlanner.buildings.${key}`)}</span>
                                <input type="number" value={startLevels[key]} min="0" max={b.max} onChange={e => handleLevelChange(key, e.target.value)} />
                            </div>
                        ))}
                    </div>
                    <div className="bp-levels-actions">
                        <button type="button" className="bp-btn-secondary bp-btn-small" onClick={resetStartLevels}
                            title={t('buildingPlanner.levelsResetHint')}>
                            {t('buildingPlanner.levelsReset')}
                        </button>
                    </div>
                </details>
            </div>

            {simulationRows.length > 0 && (
                <details className="bp-details" style={{background: 'var(--surface-2)', border: '2px solid var(--line-2)', marginBottom: '15px'}}>
                    <summary className="bp-summary" style={{fontSize: '15px', borderBottom: '1px dashed #dcb589', paddingBottom: '5px', color: 'var(--danger)'}}>
                        {t('buildingPlanner.analysis.title')}
                    </summary>
                    <div style={{marginTop: '10px'}}>
                        <div style={{display: 'flex', gap: '20px', marginBottom: '15px', fontWeight: 'bold', fontSize: '14px', background: 'var(--ink-850)', padding: '10px', borderRadius: '4px', border: '1px solid var(--line-2)', flexWrap: 'wrap'}}>
                            <div style={{color: 'var(--danger)'}}>{t('buildingPlanner.analysis.withWait')} {formatClock(totalTimeWithWait, t)}</div>
                            <div style={{color: 'var(--success)'}}>{t('buildingPlanner.analysis.withoutWait')} {formatClock(totalBuildTimeOnly, t)}</div>
                        </div>

                        {troopShare > 0 && lastRow && (
                            <div className="bp-analysis-army">
                                <div>
                                    {t('buildingPlanner.analysis.army')}{' '}
                                    <b>{armyText(lastRow.armyByFacility, troopProfile, t) || '0'}</b>
                                    {' '}({Math.round(lastRow.army).toLocaleString()} {t('buildingPlanner.columns.pop')})
                                </div>
                                {lastRow.troopBudget > 0 && lastRow.troopSpent < lastRow.troopBudget * 0.95 && (
                                    <div className="bp-analysis-army-idle">
                                        {t('buildingPlanner.analysis.armyIdle').replace('{{pct}}',
                                            Math.round(100 * (1 - lastRow.troopSpent / lastRow.troopBudget)))}
                                    </div>
                                )}
                            </div>
                        )}

                        {bottlenecks.length > 0 ? (
                            <div style={{fontSize: '13px'}}>
                                <h4 style={{margin: '0 0 8px 0', color: 'var(--gold)'}}>{t('buildingPlanner.analysis.bottleneckTitle')}</h4>
                                <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                                    {bottlenecks.map(b => {
                                        const missingDetails = [];
                                        if(b.missingWood > 0) missingDetails.push(`${t('buildingPlanner.analysis.wood')}: ${b.missingWood.toLocaleString()}`);
                                        if(b.missingClay > 0) missingDetails.push(`${t('buildingPlanner.analysis.clay')}: ${b.missingClay.toLocaleString()}`);
                                        if(b.missingIron > 0) missingDetails.push(`${t('buildingPlanner.analysis.iron')}: ${b.missingIron.toLocaleString()}`);

                                        return (
                                            <li key={b.index} style={{background: 'var(--danger-bg)', padding: '8px 10px', border: '1px solid var(--danger)', marginBottom: '5px', borderRadius: '4px', color: 'var(--danger)'}}>
                                                <b>{b.index + 1}. {t('buildingPlanner.analysis.order')} ({t(`buildingPlanner.buildings.${b.bldgId}`)} {t('buildingPlanner.analysis.level')} {b.targetLvl}):</b> 
                                                <br/> {t('buildingPlanner.analysis.waitingFor')} <b>{formatClock(b.maxWait, t)}</b> {t('buildingPlanner.analysis.waitingSuffix')} 
                                                <span style={{marginLeft: '10px', fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic'}}>
                                                    ({t('buildingPlanner.analysis.missing')}: {missingDetails.join(' | ')})
                                                </span>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        ) : (
                            <div style={{fontSize: '13px', color: 'var(--success)', fontWeight: 'bold', padding: '10px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: '4px'}}>
                                {t('buildingPlanner.analysis.perfect')}
                            </div>
                        )}
                    </div>
                </details>
            )}
            
            <div className="bp-summary-vis">
                <h4>{t('buildingPlanner.summary.title')}</h4>
                <table className="bp-summary-table">
                    <thead>
                        <tr>
                            {Object.entries(icons).map(([id, url]) => (
                                <th key={id}><img src={url} alt={t(`buildingPlanner.buildings.${id}`)} title={`${t(`buildingPlanner.buildings.${id}`)} ${t('buildingPlanner.summary.add')}`} onClick={() => addBuildingToQueue(id)} /></th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            {Object.keys(icons).map(id => {
                                const level = currentTargetLevels[id];
                                const isMax = level >= db[id].max;
                                
                                return (
                                    <td key={id}>
                                        <span 
                                            className={`bp-summary-link ${isMax ? 'bp-summary-max' : ''}`} 
                                            title={isMax ? t('buildingPlanner.summary.max') : t('buildingPlanner.summary.add')}
                                            onClick={() => addBuildingToQueue(id)}
                                        >
                                            {level}
                                        </span>
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>

            <details className="bp-details">
                <summary className="bp-summary">{t('buildingPlanner.columnsToggle')}</summary>
                <div className="bp-toggles-container">
                    {columns.map((col, idx) => (
                        <label key={idx}>
                            <input type="checkbox" checked={visibleCols[idx]} onChange={() => toggleColumn(idx)} /> {col}
                        </label>
                    ))}
                </div>
            </details>

            <div className="bp-table-wrapper">
                <table className="bp-table">
                    <thead>
                        <tr>{columns.map((col, idx) => visibleCols[idx] && <th key={idx}>{col}</th>)}</tr>
                    </thead>
                    <tbody>
                        {simulationRows.map((row) => (
                            <tr 
                                key={row.index} 
                                className={`bp-draggable-row ${row.isWarning ? "bp-warning-row" : ""}`}
                                draggable="true"
                                onDragStart={(e) => handleDragStart(e, row.index)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, row.index)}
                                title={t('buildingPlanner.fastAdd.dragTitle')}
                            >
                                {visibleCols[0] && <td><span className="bp-drag-handle">☰</span> {row.index + 1}</td>}
                                {visibleCols[1] && <td className="bp-error">{formatClock(row.maxWait, t)}</td>}
                                {visibleCols[2] && (
                                    <td>
                                        <select className="bp-inline-select" value={row.bldgId} onChange={e => changeQueueItem(row.index, e.target.value)}>
                                            {Object.keys(db).map((k) => <option key={k} value={k}>{t(`buildingPlanner.buildings.${k}`)}</option>)}
                                        </select>
                                    </td>
                                )}
                                {visibleCols[3] && <td>{row.targetLvl}</td>}
                                {visibleCols[4] && <td>{formatClock(row.buildTime, t)}</td>}
                                {visibleCols[5] && <td style={{background: 'var(--surface-2)'}}>{formatClock(row.startTime, t)}</td>}
                                {visibleCols[6] && <td style={{background: 'var(--success-bg)', fontWeight:'bold'}}>{formatClock(row.endTime, t)}</td>}
                                {visibleCols[7] && <td>{row.pts}</td>}
                                {visibleCols[8] && <td><span className="bp-wood">{row.reqW}</span> / <span className="bp-clay">{row.reqC}</span> / <span className="bp-iron">{row.reqI}</span></td>}
                                {visibleCols[9] && (
                                    <td>
                                        <span className={row.waitW > 0 ? 'bp-error' : 'bp-ok'}>{formatClock(row.waitW, t)}</span> / 
                                        <span className={row.waitC > 0 ? 'bp-error' : 'bp-ok'}>{formatClock(row.waitC, t)}</span> / 
                                        <span className={row.waitI > 0 ? 'bp-error' : 'bp-ok'}>{formatClock(row.waitI, t)}</span>
                                    </td>
                                )}
                                {visibleCols[10] && <td><span className="bp-wood">{row.storedW}</span> / <span className="bp-clay">{row.storedC}</span> / <span className="bp-iron">{row.storedI}</span></td>}
                                {visibleCols[11] && <td>{Math.round(row.rateW*3600)} / {Math.round(row.rateC*3600)} / {Math.round(row.rateI*3600)}</td>}
                                {visibleCols[12] && <td><span className="bp-ok">{row.availPop}</span> / {row.farmLimit}</td>}
                                {visibleCols[13] && <td><span className="bp-ok">{row.availWare}</span> / {row.wareCap}</td>}
                                {visibleCols[14] && <td className="bp-desc">{row.descArr.join(" | ")}</td>}
                                {visibleCols[15] && <td><button className="bp-btn-del" onClick={() => removeQueueItem(row.index)}>{t('buildingPlanner.btn.delete')}</button></td>}
                            </tr>
                        ))}

                        <tr className="bp-add-row">
                            {visibleCols[0] && <td>+</td>}
                            {visibleCols[1] && <td>-</td>}
                            {visibleCols[2] && (
                                <td>
                                    <input 
                                        ref={fastAddInputRef}
                                        type="text" list="buildings-datalist" 
                                        className="bp-fast-add-input" placeholder={t('buildingPlanner.fastAdd.placeholder')} 
                                        value={fastAddValue} onChange={handleFastAddInput} onKeyDown={handleFastAddKeyDown}
                                    />
                                    <datalist id="buildings-datalist">
                                        {Object.keys(db).map((k) => <option key={k} value={t(`buildingPlanner.buildings.${k}`)} />)}
                                    </datalist>
                                </td>
                            )}
                            <td colSpan={columns.filter((_, i) => visibleCols[i] && i > 2).length} style={{textAlign: 'left', color: 'var(--gold)', fontSize: '13px'}}>
                                ⬅️ <b>{t('buildingPlanner.fastAdd.modeActive')}</b> {t('buildingPlanner.fastAdd.info')}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BuildingPlanner;
