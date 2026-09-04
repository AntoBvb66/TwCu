import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // YENİ: Çeviri motoru eklendi
import { bumpStat } from '../utils/twApi';
import storage from '../utils/storage';
import './BuildingPlanner.css';

import {
    buildTimes, hqModifiers, db, icons, dictionary,
    timeToSeconds, calc, getFarmCapacity, getWareCapacity, getProduction, getTotalPop, getTotalPts,
    getBaseLevels, buildStartupQueue, buildAccountManagerCode
} from '../utils/twBuildingData';
import { optimizeToAcademy } from '../utils/academyOptimizer';

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
    
    const defaultLevels = getBaseLevels();
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

    // Akademi optimizasyonu: hesap durumu ve onay bekleyen sonuc
    const [optimizing, setOptimizing] = useState(false);
    const [optimizeProgress, setOptimizeProgress] = useState(0);
    const [optimizeResult, setOptimizeResult] = useState(null);
    const [optimizeError, setOptimizeError] = useState(null);
    const [deepSearch, setDeepSearch] = useState(false);

    useEffect(() => {
        storage.set('bp_ws', worldSpeed);
        storage.set('bp_ms', mineSpeed);
        storage.set('bp_levels', startLevels);
        storage.set('bp_queue', queue);
        storage.set('bp_cols', visibleCols);
        storage.set('bp_export_start', includeStartLevels);
        storage.set('bp_am_name', amName);
    }, [worldSpeed, mineSpeed, startLevels, queue, visibleCols, includeStartLevels, amName]);

    const handleLevelChange = (key, val) => {
        let parsed = parseInt(val) || 0;
        if (parsed < 0) parsed = 0;
        if (parsed > db[key].max) parsed = db[key].max;
        setStartLevels(prev => ({ ...prev, [key]: parsed }));
    };

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

    const simulationRows = useMemo(() => {
        let resSpeed = worldSpeed * mineSpeed;
        let simLevels = { ...startLevels };
        let res = { w: 500, c: 500, i: 400 }; 
        let currentTimeSec = 0;
        
        return queue.map((bldgId, index) => {
            let data = db[bldgId];
            let targetLvl = simLevels[bldgId] + 1;
            if(targetLvl > data.max) targetLvl = data.max;

            let reqW = calc(data.wB, data.wF, targetLvl);
            let reqC = calc(data.cB, data.cF, targetLvl);
            let reqI = calc(data.iB, data.iF, targetLvl);
            let rateW = getProduction(simLevels.wood, resSpeed) / 3600;
            let rateC = getProduction(simLevels.clay, resSpeed) / 3600;
            let rateI = getProduction(simLevels.iron, resSpeed) / 3600;
            let wareCap = getWareCapacity(simLevels.ware);

            let descArr = [];
            let isWarning = false;

            if(reqW > wareCap || reqC > wareCap || reqI > wareCap) { descArr.push(t('buildingPlanner.status.storageLimit')); isWarning = true; }
            
            let missing = [];
            for (let r in data.req) { if (simLevels[r] < data.req[r]) missing.push(`${t('buildingPlanner.buildings.' + r)}(${data.req[r]})`); }
            if(missing.length > 0) { descArr.push(`${t('buildingPlanner.status.requirement')}: ${missing.join(", ")}`); isWarning = true; }

            let storedW = Math.floor(res.w); let storedC = Math.floor(res.c); let storedI = Math.floor(res.i);

            let waitW = reqW > res.w ? (reqW - res.w) / rateW : 0;
            let waitC = reqC > res.c ? (reqC - res.c) / rateC : 0;
            let waitI = reqI > res.i ? (reqI - res.i) / rateI : 0;
            let maxWait = Math.max(0, waitW, waitC, waitI);
            
            let missingWood = reqW > storedW ? Math.ceil(reqW - storedW) : 0;
            let missingClay = reqC > storedC ? Math.ceil(reqC - storedC) : 0;
            let missingIron = reqI > storedI ? Math.ceil(reqI - storedI) : 0;
            
            if(reqW > wareCap) waitW = Infinity;
            if(reqC > wareCap) waitC = Infinity;
            if(reqI > wareCap) waitI = Infinity;

            if(maxWait > 0 && isFinite(maxWait)) {
                res.w = Math.min(wareCap, res.w + (maxWait * rateW));
                res.c = Math.min(wareCap, res.c + (maxWait * rateC));
                res.i = Math.min(wareCap, res.i + (maxWait * rateI));
                descArr.push(t('buildingPlanner.status.waitingRes'));
            }

            let futurePop = getTotalPop(simLevels) + (calc(data.pB, data.pF, targetLvl) - calc(data.pB, data.pF, simLevels[bldgId]));
            let farmLimit = getFarmCapacity(simLevels.farm);
            if(futurePop > farmLimit) { descArr.push(t('buildingPlanner.status.farmLimit')); isWarning = true; }

            let startTime = currentTimeSec + (isFinite(maxWait) ? maxWait : 0);
            if(isFinite(maxWait) && !isWarning) { res.w -= reqW; res.c -= reqC; res.i -= reqI; }

            let hqLvlForMod = simLevels.hq || 1;
            if (hqLvlForMod > 30) hqLvlForMod = 30;
            if (hqLvlForMod < 1) hqLvlForMod = 1;
            
            let hqMod = hqModifiers[hqLvlForMod] || 1.0;
            let timeStr = buildTimes[targetLvl] ? buildTimes[targetLvl][data.timeIdx] : null;
            let baseSec = timeToSeconds(timeStr);
            let buildTime = Math.round((baseSec * hqMod) / worldSpeed);

            if(!timeStr || buildTime === 0) { descArr.push(t('buildingPlanner.status.maxLevel')); isWarning = true; buildTime = 0; }

            let endTime = startTime + buildTime;

            if(isFinite(maxWait) && !isWarning) {
                res.w = Math.min(wareCap, res.w + (buildTime * rateW));
                res.c = Math.min(wareCap, res.c + (buildTime * rateC));
                res.i = Math.min(wareCap, res.i + (buildTime * rateI));
                simLevels[bldgId] = targetLvl; 
            }

            currentTimeSec = isFinite(maxWait) && !isWarning ? endTime : startTime;

            let totalPop = getTotalPop(simLevels);
            let availPop = Math.max(0, farmLimit - totalPop);
            let maxStored = Math.max(storedW, storedC, storedI);
            let availWare = Math.max(0, wareCap - maxStored);

            return {
                index, bldgId, targetLvl, maxWait, buildTime, startTime, endTime, 
                pts: getTotalPts(simLevels), reqW, reqC, reqI, waitW, waitC, waitI,
                storedW, storedC, storedI, rateW, rateC, rateI, availPop, farmLimit,
                availWare, wareCap, descArr, isWarning,
                missingWood, missingClay, missingIron
            };
        });
    }, [worldSpeed, mineSpeed, startLevels, queue, t]);

    // Mevcut baslangic seviyelerinden hedefe en hizli ulasan kuyrugu hesaplar.
    // Sonuc dogrudan uygulanmaz; kullanici onizleyip "Uygula" derse kuyruga yazilir.
    const handleOptimize = async () => {
        setOptimizing(true);
        setOptimizeError(null);
        setOptimizeResult(null);
        setOptimizeProgress(0);

        // Arayuzun "hesaplaniyor" durumunu boyayabilmesi icin bir kare bekle.
        await new Promise(resolve => setTimeout(resolve, 30));

        try {
            const result = await optimizeToAcademy(
                { startLevels, worldSpeed, mineSpeed, beamWidth: deepSearch ? 900 : 300 },
                depth => setOptimizeProgress(depth)
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

    const totalBuildTimeOnly = simulationRows.reduce((acc, row) => acc + row.buildTime, 0);
    const totalTimeWithWait = simulationRows.length > 0 ? simulationRows[simulationRows.length - 1].endTime : 0;
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
                        <button onClick={handleOpenAmCode} className="bp-btn-secondary" style={{marginRight: '15px'}}>{t('buildingPlanner.btn.amCode')}</button>
                        <button onClick={() => setQueue([])} className="bp-btn-clear">{t('buildingPlanner.btn.clear')}</button>
                    </div>
                </div>
                
                <div className="bp-optimizer">
                    <div className="bp-optimizer-head">
                        <div>
                            <div className="bp-optimizer-title">{t('buildingPlanner.optimizer.title')}</div>
                            <div className="bp-optimizer-desc">{t('buildingPlanner.optimizer.desc')}</div>
                        </div>
                        <div className="bp-optimizer-actions">
                            <label className="bp-optimizer-deep" title={t('buildingPlanner.optimizer.deepHint')}>
                                <input type="checkbox" checked={deepSearch} disabled={optimizing}
                                    onChange={e => setDeepSearch(e.target.checked)} />
                                {t('buildingPlanner.optimizer.deep')}
                            </label>
                            <button onClick={handleOptimize} disabled={optimizing} className="bp-btn-action">
                                {optimizing
                                    ? `${t('buildingPlanner.optimizer.calculating')} ${optimizeProgress}`
                                    : t('buildingPlanner.optimizer.button')}
                            </button>
                        </div>
                    </div>

                    {optimizeError && <div className="bp-optimizer-error">{optimizeError}</div>}

                    {optimizeResult && (
                        <div className="bp-optimizer-result">
                            <div className="bp-optimizer-stats">
                                <span className="bp-optimizer-time">
                                    {t('buildingPlanner.optimizer.totalTime')} {formatClock(optimizeResult.seconds, t)}
                                </span>
                                <span>{t('buildingPlanner.optimizer.stepCount').replace('{{count}}', optimizeResult.queue.length)}</span>
                            </div>

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

                {showTemplateModal && (
                    <div className="bp-template-area">
                        <h3 style={{marginTop: 0, color: 'var(--gold)'}}>
                            {templateMode === 'import' && t('buildingPlanner.modal.importTitle')}
                            {templateMode === 'export' && t('buildingPlanner.modal.exportTitle')}
                            {templateMode === 'amcode' && t('buildingPlanner.modal.amTitle')}
                        </h3>
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
                            placeholder={templateMode === 'import' ? t('buildingPlanner.modal.importPlaceholder') : ""}
                            readOnly={templateMode !== 'import'}
                        />
                        <div>
                            {templateMode === 'import' && <button onClick={handleImportSubmit} className="bp-btn-action">{t('buildingPlanner.btn.addQueue')}</button>}
                            {templateMode !== 'import' && <button onClick={() => { navigator.clipboard.writeText(templateText); alert(t('buildingPlanner.modal.copied')); }} className="bp-btn-action">{t('buildingPlanner.btn.copyBoard')}</button>}
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
