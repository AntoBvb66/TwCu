import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import storage from '../utils/storage';
import './ScavengingPlanner.css';

const unitIcons = {
    spear: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_spear.webp',
    sword: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_sword.webp',
    axe: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_axe.webp',
    archer: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_archer.webp',
    light: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_light.webp',
    marcher: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_marcher.webp',
    heavy: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_heavy.webp'
};

const resIcons = {
    wood: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/holz.png',
    clay: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/lehm.png',
    iron: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/eisen.png',
};

const unitCarry = { spear: 25, sword: 15, axe: 10, archer: 10, light: 80, marcher: 50, heavy: 50 };

const calculateBaseProd = (level, totalSpeed) => {
    if (level === 0) return 5 * totalSpeed;
    return 30 * Math.pow(1.163118, level - 1) * totalSpeed;
};

// YENİ: Saat formatlayıcı (Maks. Tur süresini 03:45:12 formatında verir)
const formatClock = (totalSeconds) => {
    if (totalSeconds <= 0) return "-";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.ceil(totalSeconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const ScavengingPlanner = () => {
    fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=sims").catch(() => { });
    const { t } = useTranslation();

    const [worldSpeed, setWorldSpeed] = useState(() => storage.get("scav_worldSpeed", 1));
    const [mineSpeed, setMineSpeed] = useState(() => storage.get("scav_mineSpeed", 1));
    const [levels, setLevels] = useState(() => storage.get("scav_levels", { wood: 30, clay: 30, iron: 30 }));

    const [troops, setTroops] = useState(() => storage.get("scav_troops", { spear: '', sword: '', axe: '', archer: '', light: '', marcher: '', heavy: '' }));
    const [carryFlag, setCarryFlag] = useState(() => storage.get("scav_carryFlag", 0));
    const [resFlag, setResFlag] = useState(() => storage.get("scav_resFlag", 0));

    React.useEffect(() => {
        storage.set("scav_worldSpeed", worldSpeed);
        storage.set("scav_mineSpeed", mineSpeed);
        storage.set("scav_levels", levels);
        storage.set("scav_troops", troops);
        storage.set("scav_carryFlag", carryFlag);
        storage.set("scav_resFlag", resFlag);
    }, [worldSpeed, mineSpeed, levels, troops, carryFlag, resFlag]);

    const handleLevelChange = (res, val) => setLevels(prev => ({ ...prev, [res]: parseInt(val) || 0 }));
    const handleTroopChange = (unit, val) => setTroops(prev => ({ ...prev, [unit]: parseInt(val) || '' }));

    const math = useMemo(() => {
        const totalSpeed = worldSpeed * mineSpeed;
        const worldConstant = Math.pow(worldSpeed, -0.55);

        const baseW = calculateBaseProd(levels.wood, totalSpeed);
        const baseC = calculateBaseProd(levels.clay, totalSpeed);
        const baseI = calculateBaseProd(levels.iron, totalSpeed);

        const totalBaseHourly = baseW + baseC + baseI;
        const totalBaseDaily = totalBaseHourly * 24;

        const resFlagMult = 1 + ((parseFloat(resFlag) || 0) / 100);
        const totalResFlagHourly = totalBaseHourly * resFlagMult;
        const totalResFlagDaily = totalBaseDaily * resFlagMult;

        let baseCapacity = 0;
        Object.keys(unitCarry).forEach(u => {
            baseCapacity += (parseInt(troops[u]) || 0) * unitCarry[u];
        });

        const carryFlagMult = 1 + ((parseFloat(carryFlag) || 0) / 100);
        const totalCapacityWithFlag = Math.round(baseCapacity * carryFlagMult);

        const options = [
            { id: 1, factor: 0.1, weight: 7.5 },
            { id: 2, factor: 0.25, weight: 3 },
            { id: 3, factor: 0.5, weight: 1.5 },
            { id: 4, factor: 0.75, weight: 1 }
        ];

        const calcScavenge = (indices, capacity, mode) => {
            const activeOptions = indices.map(i => options[i]);
            const totalWeight = activeOptions.reduce((sum, opt) => sum + opt.weight, 0);

            let totalLoot = 0;
            let maxTime = 0;

            activeOptions.forEach(opt => {
                let assignedCap = 0;
                if (mode === 'eqTime') assignedCap = capacity * (opt.weight / totalWeight);
                else if (mode === 'eqCap') assignedCap = capacity / activeOptions.length;

                const baseTime = Math.pow(Math.pow(opt.factor * assignedCap, 2) * 100, 0.45) + 1800;
                const timeSec = baseTime * worldConstant;
                const loot = assignedCap * opt.factor;

                totalLoot += loot;
                if (timeSec > maxTime) maxTime = timeSec;
            });

            const dailyLoot = maxTime > 0 ? (totalLoot / maxTime) * 86400 : 0;
            return { dailyLoot, maxTime };
        };

        const strategyConfigs = [
            { id: 'c1234', indices: [0, 1, 2, 3], name: t('scavenging.results.options.c1234') },
            { id: 'c234', indices: [1, 2, 3], name: t('scavenging.results.options.c234') },
            { id: 'c123', indices: [0, 1, 2], name: t('scavenging.results.options.c123') },
            { id: 'c23', indices: [1, 2], name: t('scavenging.results.options.c23') },
            { id: 'c12', indices: [0, 1], name: t('scavenging.results.options.c12') }
        ];

        const modes = [
            { id: 'eqTime', name: t('scavenging.results.modes.eqTime') },
            { id: 'eqCap', name: t('scavenging.results.modes.eqCap') }
        ];

        const flags = [
            { id: 'none', name: t('scavenging.results.flags.none'), cap: baseCapacity, resDaily: totalBaseDaily, resHourly: totalBaseHourly },
            { id: 'carry', name: t('scavenging.results.flags.carry'), cap: totalCapacityWithFlag, resDaily: totalBaseDaily, resHourly: totalBaseHourly },
            { id: 'res', name: t('scavenging.results.flags.res'), cap: baseCapacity, resDaily: totalResFlagDaily, resHourly: totalResFlagHourly }
        ];

        const allStrategies = [];

        strategyConfigs.forEach(conf => {
            modes.forEach(mode => {
                flags.forEach(flag => {
                    const scavData = calcScavenge(conf.indices, flag.cap, mode.id);
                    const totalDaily = flag.resDaily + scavData.dailyLoot;

                    allStrategies.push({
                        id: `${conf.id}_${mode.id}_${flag.id}`,
                        confName: conf.name,
                        modeName: mode.name,
                        flagName: flag.name,
                        flagId: flag.id,
                        scavDaily: scavData.dailyLoot,
                        resDaily: flag.resDaily,
                        totalDaily: totalDaily,
                        maxTime: scavData.maxTime // Artık saniye cinsinden
                    });
                });
            });
        });

        allStrategies.sort((a, b) => b.totalDaily - a.totalDaily);

        const refPoints = [500, 1000, 2000, 5000, 10000, 20000, 50000];
        const referenceTable = refPoints.map(cap => {
            const rTime = calcScavenge([0, 1, 2, 3], cap, 'eqTime').dailyLoot;
            const rCap = calcScavenge([0, 1, 2, 3], cap, 'eqCap').dailyLoot;
            return { cap, eqTimeDaily: rTime, eqCapDaily: rCap };
        });

        // --- 1. ÇİZGİ GRAFİĞİ İÇİN DATA HAZIRLIĞI (Sadece Bayraksız & Eşit Süre) ---
        const chartCapacities = [100, 200, 300, 400, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 12500, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000];

        const lineColors = ['#ffc107', '#9e9e9e', '#2196f3', '#f44336', '#4caf50']; // Sarı, Gri, Mavi, Kırmızı, Yeşil

        const chartLines = strategyConfigs.map((conf, index) => {
            return {
                id: conf.id,
                name: conf.name.split(' ')[0], // Sadece "1-2-3-4" kısmını alır
                color: lineColors[index],
                points: chartCapacities.map(cap => calcScavenge(conf.indices, cap, 'eqTime').dailyLoot)
            };
        });

        const maxY = Math.max(...chartLines.flatMap(line => line.points));

        // --- 2. DİNAMİK BAŞA BAŞ (DÖNÜM) NOKTALARI ---
        const findCross = (calcA, calcB) => {
            let prevA = 0, prevB = 0;
            for (let c = 50; c <= 100000; c += 10) {
                const a = calcA(c); const b = calcB(c);
                if (a > b && prevA <= prevB) return c;
                prevA = a; prevB = b;
            }
            return null;
        };

        const be1234_vs_234 = findCross(c => calcScavenge([0, 1, 2, 3], c, 'eqTime').dailyLoot, c => calcScavenge([1, 2, 3], c, 'eqTime').dailyLoot);
        const be123_vs_23 = findCross(c => calcScavenge([0, 1, 2], c, 'eqTime').dailyLoot, c => calcScavenge([1, 2], c, 'eqTime').dailyLoot);

        return {
            worldConstant,
            baseW, baseC, baseI, totalBaseHourly, totalBaseDaily,
            totalResFlagHourly, totalResFlagDaily,
            baseCapacity, totalCapacityWithFlag,
            allStrategies, referenceTable,
            chartCapacities, chartLines, maxY, be1234_vs_234, be123_vs_23
        };
    }, [worldSpeed, mineSpeed, levels, troops, resFlag, carryFlag, t]);

    const maxChartValue = math.allStrategies.length > 0 ? math.allStrategies[0].totalDaily : 1;

    return (
        <div className="scav-container">
            <h1 className="scav-header">{t('scavenging.title')}</h1>

            <div className="scav-main-grid">

                <div className="scav-box">
                    <h3>{t('scavenging.settings.title')}</h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold' }}>{t('scavenging.settings.worldSpeed')}</label>
                            <input type="number" step="0.1" className="scav-input" value={worldSpeed} onChange={e => setWorldSpeed(parseFloat(e.target.value) || 1)} />
                        </div>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold' }}>{t('scavenging.settings.mineSpeed')}</label>
                            <input type="number" step="0.1" className="scav-input" value={mineSpeed} onChange={e => setMineSpeed(parseFloat(e.target.value) || 1)} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px' }}><img src={resIcons.wood} alt="W" style={{ width: '12px' }} /> {t('scavenging.settings.woodLevel')}</label>
                            <input type="number" className="scav-input" value={levels.wood} onChange={e => handleLevelChange('wood', e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px' }}><img src={resIcons.clay} alt="C" style={{ width: '12px' }} /> {t('scavenging.settings.clayLevel')}</label>
                            <input type="number" className="scav-input" value={levels.clay} onChange={e => handleLevelChange('clay', e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px' }}><img src={resIcons.iron} alt="I" style={{ width: '12px' }} /> {t('scavenging.settings.ironLevel')}</label>
                            <input type="number" className="scav-input" value={levels.iron} onChange={e => handleLevelChange('iron', e.target.value)} />
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '15px' }}>
                        <div style={{ padding: '10px', background: '#111', borderRadius: '4px', border: '1px solid #603000', fontSize: '13px' }}>
                            <div style={{ color: '#f0c042', marginBottom: '5px', fontWeight: 'bold' }}>{t('scavenging.settings.resHourly')}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#eaddbd', fontSize: '12px' }}>
                                <span><img src={resIcons.wood} alt="W" style={{ width: '12px' }} /> {Math.round(math.baseW / 60).toLocaleString()} {t('scavenging.production.perMin')}</span>
                                <span>{Math.round(math.baseW).toLocaleString()} {t('scavenging.production.perHour')}</span>
                                <span>{Math.round(math.baseW * 24).toLocaleString()} {t('scavenging.production.perDay')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#eaddbd', fontSize: '12px', marginTop: '3px' }}>
                                <span><img src={resIcons.clay} alt="C" style={{ width: '12px' }} /> {Math.round(math.baseC / 60).toLocaleString()} {t('scavenging.production.perMin')}</span>
                                <span>{Math.round(math.baseC).toLocaleString()} {t('scavenging.production.perHour')}</span>
                                <span>{Math.round(math.baseC * 24).toLocaleString()} {t('scavenging.production.perDay')}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#eaddbd', fontSize: '12px', marginTop: '3px' }}>
                                <span><img src={resIcons.iron} alt="I" style={{ width: '12px' }} /> {Math.round(math.baseI / 60).toLocaleString()} {t('scavenging.production.perMin')}</span>
                                <span>{Math.round(math.baseI).toLocaleString()} {t('scavenging.production.perHour')}</span>
                                <span>{Math.round(math.baseI * 24).toLocaleString()} {t('scavenging.production.perDay')}</span>
                            </div>
                            <div style={{ borderTop: '1px dashed #444', marginTop: '5px', paddingTop: '5px', display: 'flex', justifyContent: 'space-between', color: '#5cb85c' }}>
                                <b>{t('scavenging.settings.worldConstant')}</b> <span>{math.worldConstant.toFixed(10)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="scav-box">
                    <h3>{t('scavenging.troops.title')}</h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
                        {Object.keys(unitCarry).map(u => (
                            <div key={u} style={{ flex: 1, minWidth: '45px' }}>
                                <label style={{ fontSize: '12px', display: 'flex', justifyContent: 'center', marginBottom: '5px' }}>
                                    <img src={unitIcons[u]} alt={u} style={{ width: '18px' }} title={u} />
                                </label>
                                <input type="number" className="scav-input" style={{ textAlign: 'center' }} value={troops[u]} onChange={e => handleTroopChange(u, e.target.value)} />
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#f0c042' }}>{t('scavenging.troops.carryFlag')}</label>
                            <input type="number" step="1" className="scav-input" value={carryFlag} onChange={e => setCarryFlag(e.target.value)} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5cb85c' }}>{t('scavenging.troops.resFlag')}</label>
                            <input type="number" step="1" className="scav-input" value={resFlag} onChange={e => setResFlag(e.target.value)} />
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '15px' }}>
                        <div style={{ padding: '10px', background: '#1a1a1a', borderRadius: '4px', border: '1px solid #333', fontSize: '13px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', marginBottom: '5px' }}>
                                <span>{t('scavenging.troops.totalCap')}</span> <b>{math.baseCapacity.toLocaleString()}</b>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f0c042', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #444' }}>
                                <span>{t('scavenging.troops.totalCapFlag')}</span> <b>{math.totalCapacityWithFlag.toLocaleString()}</b>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', marginBottom: '5px' }}>
                                <span>{t('scavenging.troops.totalRes')}</span> <b>{Math.round(math.totalBaseHourly).toLocaleString()} {t('scavenging.production.perHour')}</b>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#5cb85c' }}>
                                <span>{t('scavenging.troops.totalResFlag')}</span> <b>{Math.round(math.totalResFlagHourly).toLocaleString()} {t('scavenging.production.perHour')}</b>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {math.baseCapacity > 0 ? (
                <div className="scav-bottom-grid">

                    <div className="scav-box" style={{ background: '#111', border: '1px solid #333' }}>
                        <h3 style={{ color: '#fff', borderBottom: '1px solid #444', paddingBottom: '10px' }}>{t('scavenging.results.chartTitle')}</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px', flexGrow: 1 }}>
                            {math.allStrategies.slice(0, 10).map((strat, index) => (
                                <div key={strat.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '25px', color: '#f0c042', fontSize: '14px', fontWeight: 'bold', textAlign: 'right' }}>#{index + 1}</div>
                                    <div style={{ flex: 1, background: '#222', height: '32px', borderRadius: '6px', position: 'relative', display: 'flex', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
                                        <div style={{ width: `${(strat.resDaily / maxChartValue) * 100}%`, background: 'linear-gradient(90deg, #1b381b, #4cae4c)', height: '100%', borderRadius: strat.scavDaily === 0 ? '6px' : '6px 0 0 6px' }}></div>
                                        <div style={{ width: `${(strat.scavDaily / maxChartValue) * 100}%`, background: 'linear-gradient(90deg, #8b6508, #f0ad4e)', height: '100%', borderLeft: '1px solid rgba(0,0,0,0.5)', borderRadius: strat.resDaily === 0 ? '6px' : '0 6px 6px 0' }}></div>

                                        <div style={{ position: 'absolute', width: '100%', height: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px', fontSize: '12px', color: '#fff', fontWeight: 'bold', textShadow: '1px 1px 2px #000' }}>
                                            <span>{strat.modeName} | {strat.confName} | {strat.flagName}</span>
                                            <span style={{ fontSize: '14px' }}>{Math.round(strat.totalDaily).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                            <span style={{ color: '#5cb85c' }}>■ Günlük Maden Üretimi</span>
                            <span style={{ color: '#f0ad4e' }}>■ Günlük Toplayıcılık Ganimeti</span>
                        </div>
                    </div>

                    <div className="scav-box" style={{ background: '#1a1a1a', border: '1px solid #333' }}>
                        <h3 style={{ color: '#f0c042' }}>{t('scavenging.results.title')}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', maxHeight: '460px', overflowY: 'auto', paddingRight: '5px' }}>
                            {math.allStrategies.map((strat, index) => (
                                <div key={strat.id} style={{ background: '#111', border: '1px solid #444', borderRadius: '6px', padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    <div style={{ width: '30px', fontSize: '18px', fontWeight: 'bold', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>#{index + 1}</div>

                                    <div style={{ flex: 2, minWidth: '140px' }}>
                                        <div style={{ color: '#eaddbd', fontWeight: 'bold', fontSize: '14px' }}>{strat.modeName}</div>
                                        <div style={{ color: '#aaa', fontSize: '12px' }}>{strat.confName}</div>
                                        <div style={{ marginTop: '4px', fontSize: '11px', display: 'inline-block', padding: '2px 6px', borderRadius: '3px', background: strat.flagId === 'carry' ? '#8b0000' : strat.flagId === 'res' ? '#2b542c' : '#444', color: '#fff' }}>
                                            {strat.flagName}
                                        </div>
                                    </div>

                                    {/* YENİ: GÜNLÜK, SAATLİK, DAKİKALIK DETAY TABLOSU */}
                                    <div style={{ flex: 3, minWidth: '220px', fontSize: '11px', borderLeft: '1px dashed #333', paddingLeft: '10px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ccc', fontSize: '11px' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ paddingBottom: '4px', color: '#f0ad4e' }}><b>{t('scavenging.results.scavenge')}:</b></td>
                                                    <td style={{ paddingBottom: '4px', textAlign: 'right' }}>{Math.round(strat.scavDaily).toLocaleString()}<span style={{ color: '#777' }}>{t('scavenging.results.dayShort')}</span></td>
                                                    <td style={{ paddingBottom: '4px', textAlign: 'right' }}>{Math.round(strat.scavDaily / 24).toLocaleString()}<span style={{ color: '#777' }}>{t('scavenging.results.hourShort')}</span></td>
                                                    <td style={{ paddingBottom: '4px', textAlign: 'right' }}>{Math.round(strat.scavDaily / 1440).toLocaleString()}<span style={{ color: '#777' }}>{t('scavenging.results.minShort')}</span></td>
                                                </tr>
                                                <tr>
                                                    <td style={{ paddingBottom: '6px', color: '#5cb85c' }}><b>{t('scavenging.results.resource')}:</b></td>
                                                    <td style={{ paddingBottom: '6px', textAlign: 'right' }}>{Math.round(strat.resDaily).toLocaleString()}<span style={{ color: '#777' }}>{t('scavenging.results.dayShort')}</span></td>
                                                    <td style={{ paddingBottom: '6px', textAlign: 'right' }}>{Math.round(strat.resDaily / 24).toLocaleString()}<span style={{ color: '#777' }}>{t('scavenging.results.hourShort')}</span></td>
                                                    <td style={{ paddingBottom: '6px', textAlign: 'right' }}>{Math.round(strat.resDaily / 1440).toLocaleString()}<span style={{ color: '#777' }}>{t('scavenging.results.minShort')}</span></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <div style={{ color: '#aaa', borderTop: '1px dashed #444', paddingTop: '4px' }}>
                                            <b>{t('scavenging.results.maxTrip')}:</b> <span style={{ color: '#fff' }}>{formatClock(strat.maxTime)}</span>
                                        </div>
                                    </div>

                                    <div style={{ flex: 1, minWidth: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', borderLeft: '1px dashed #333' }}>
                                        <span style={{ fontSize: '10px', color: '#aaa' }}>{t('scavenging.results.totalDaily')}</span>
                                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: index === 0 ? '#5cb85c' : '#fff' }}>
                                            {Math.round(strat.totalDaily).toLocaleString()}
                                        </span>
                                        <span style={{ fontSize: '10px', color: '#777', marginTop: '2px' }}>
                                            ({Math.round(strat.totalDaily / 24).toLocaleString()}{t('scavenging.results.hourShort')} | {Math.round(strat.totalDaily / 1440).toLocaleString()}{t('scavenging.results.minShort')})
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            ) : (
                <div className="scav-box" style={{ background: '#1a1a1a' }}>
                    <h3 style={{ color: '#5bc0de' }}>{t('scavenging.reference.title')}</h3>
                    <p style={{ fontSize: '11px', color: '#aaa' }}>{t('scavenging.reference.info')}</p>
                    <table className="scav-table" style={{ marginTop: '10px', background: 'transparent' }}>
                        <thead>
                            <tr>
                                <th style={{ background: '#222', color: '#fff', border: '1px solid #444' }}>{t('scavenging.reference.cap')}</th>
                                <th style={{ background: '#222', color: '#fff', border: '1px solid #444' }}>{t('scavenging.reference.eqTimeDaily')}</th>
                                <th style={{ background: '#222', color: '#fff', border: '1px solid #444' }}>{t('scavenging.reference.eqCapDaily')}</th>
                                <th style={{ background: '#222', color: '#fff', border: '1px solid #444' }}>{t('scavenging.reference.winner')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {math.referenceTable.map(row => (
                                <tr key={row.cap}>
                                    <td style={{ fontWeight: 'bold', color: '#fff', borderBottom: '1px solid #333' }}>{row.cap.toLocaleString()}</td>
                                    <td style={{ color: row.eqTimeDaily > row.eqCapDaily ? '#5cb85c' : '#ccc', fontWeight: row.eqTimeDaily > row.eqCapDaily ? 'bold' : 'normal', borderBottom: '1px solid #333' }}>
                                        {Math.round(row.eqTimeDaily).toLocaleString()}
                                    </td>
                                    <td style={{ color: row.eqCapDaily > row.eqTimeDaily ? '#5cb85c' : '#ccc', fontWeight: row.eqCapDaily > row.eqTimeDaily ? 'bold' : 'normal', borderBottom: '1px solid #333' }}>
                                        {Math.round(row.eqCapDaily).toLocaleString()}
                                    </td>
                                    <td style={{ color: '#f0c042', fontSize: '11px', borderBottom: '1px solid #333' }}>
                                        {row.eqTimeDaily > row.eqCapDaily
                                            ? `🏆 ${t('scavenging.results.modes.eqTime')}`
                                            : `🏆 ${t('scavenging.results.modes.eqCap')}`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="scav-box" style={{ background: '#111', border: '1px solid #333', marginTop: '20px', overflowX: 'auto' }}>
                <h3 style={{ color: '#fff', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                    {t('scavenging.chart.title')}
                </h3>
                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '15px' }}>
                    <span dangerouslySetInnerHTML={{ __html: t('scavenging.chart.worldConstantInfo').replace('{{constant}}', `<b style="color:#f0c042">${math.worldConstant.toFixed(10)}</b>`) }} />
                </div>

                <div style={{ minWidth: '800px', padding: '10px 10px 30px 40px', position: 'relative' }}>
                    <svg width="100%" height="350" viewBox="0 0 1000 350" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                        {/* Grid Çizgileri (Y Ekseni) */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                            const y = 350 - (350 * ratio);
                            const val = math.maxY * ratio;
                            return (
                                <g key={`grid-y-${i}`}>
                                    <line x1="0" y1={y} x2="1000" y2={y} stroke="#333" strokeDasharray="4 4" />
                                    <text x="-10" y={y + 4} fill="#aaa" fontSize="11" textAnchor="end">{Math.round(val).toLocaleString()}</text>
                                </g>
                            );
                        })}

                        {/* Grid Çizgileri (X Ekseni Kapasiteler) */}
                        {math.chartCapacities.map((cap, i) => {
                            const x = (i / (math.chartCapacities.length - 1)) * 1000;
                            return (
                                <g key={`grid-x-${i}`}>
                                    <line x1={x} y1="0" x2={x} y2="350" stroke="#222" />
                                    <text x={x} y="370" fill="#aaa" fontSize="10" textAnchor="middle" transform={`rotate(-45 ${x} 370)`}>{cap.toLocaleString()}</text>
                                </g>
                            );
                        })}

                        {/* Çizgiler (Stratejiler) */}
                        {math.chartLines.map(line => {
                            const pointsStr = line.points.map((val, i) => {
                                const x = (i / (math.chartCapacities.length - 1)) * 1000;
                                const y = 350 - ((val / math.maxY) * 350);
                                return `${x},${y}`;
                            }).join(" ");

                            return (
                                <g key={line.id}>
                                    <polyline points={pointsStr} fill="none" stroke={line.color} strokeWidth="3" strokeLinejoin="round" />
                                    {/* Noktalar */}
                                    {line.points.map((val, i) => {
                                        const x = (i / (math.chartCapacities.length - 1)) * 1000;
                                        const y = 350 - ((val / math.maxY) * 350);
                                        return <circle key={`p-${i}`} cx={x} cy={y} r="4" fill="#111" stroke={line.color} strokeWidth="2" />;
                                    })}
                                </g>
                            );
                        })}
                    </svg>
                </div>

                {/* GRAFİK LEJANT (Renk Açıklamaları) */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '30px' }}>
                    {math.chartLines.map(line => (
                        <div key={`leg-${line.id}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
                            <div style={{ width: '16px', height: '4px', background: line.color, borderRadius: '2px' }}></div>
                            {line.name} {t('scavenging.chart.unlocked')}
                        </div>
                    ))}
                </div>

                {/* BİLGİ NOTU: BAŞA BAŞ (DÖNÜM) NOKTALARI */}
                <div style={{ marginTop: '20px', background: '#1a1a1a', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #f0c042' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#f0c042' }}>{t('scavenging.chart.infoTitle')}</h4>
                    <div style={{ fontSize: '13px', color: '#eaddbd', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {math.be1234_vs_234 && (
                            <div dangerouslySetInnerHTML={{ __html: t('scavenging.chart.be1').replace('{{cap}}', `<b style="color: #ffc107">${math.be1234_vs_234.toLocaleString()}</b>`) }} />
                        )}
                        {math.be123_vs_23 && (
                            <div dangerouslySetInnerHTML={{ __html: t('scavenging.chart.be2').replace('{{cap}}', `<b style="color: #2196f3">${math.be123_vs_23.toLocaleString()}</b>`) }} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScavengingPlanner;