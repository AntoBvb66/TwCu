import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next'; // YENİ: Çeviri motoru
import './UnitCalculator.css';

// === EXCEL'DEKİ O KÜSURATLI BİNA SEVİYE ÇARPANLARI (1'den 25'e) ===
const buildFactor = [
    0, // 0. seviye (kullanılmaz)
    62.89308176, 59.333096, 55.97461887, 52.80624422, 49.81721152, 
    46.99736936, 44.33714091, 41.82749142, 39.45989757, 37.22631846, 
    35.11916836, 33.13129091, 31.25593482, 29.48673096, 27.81767072, 
    26.24308558, 24.75762791, 23.35625274, 22.0342007, 20.78698179, 
    19.61036018, 18.50033979, 17.45315075, 16.46523656, 15.53324203
];

// BİRİM VERİTABANI
const unitsDB = [
    { id: 'spear', w: 50, c: 30, i: 10, p: 1, baseTime: 1020, facility: 'barracks' },
    { id: 'sword', w: 30, c: 30, i: 70, p: 1, baseTime: 1500, facility: 'barracks' },
    { id: 'axe', w: 60, c: 30, i: 40, p: 1, baseTime: 1320, facility: 'barracks' },
    { id: 'archer', w: 100, c: 30, i: 60, p: 1, baseTime: 1800, facility: 'barracks' },
    
    { id: 'spy', w: 50, c: 50, i: 20, p: 2, baseTime: 900, facility: 'stable' },
    { id: 'lc', w: 125, c: 100, i: 250, p: 4, baseTime: 1800, facility: 'stable' },
    { id: 'ma', w: 250, c: 100, i: 150, p: 5, baseTime: 2700, facility: 'stable' },
    { id: 'hc', w: 200, c: 150, i: 600, p: 6, baseTime: 3600, facility: 'stable' },
    
    { id: 'ram', w: 300, c: 200, i: 200, p: 5, baseTime: 4800, facility: 'workshop' },
    { id: 'cat', w: 320, c: 400, i: 100, p: 8, baseTime: 7200, facility: 'workshop' }
];

// İSMİ DÜZELTİLEN FONKSİYON: formatClock (Artık t objesi alıyor)
const formatClock = (totalSeconds, t) => {
    if (totalSeconds <= 0) return t('unitCalculator.time.none');
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.ceil(totalSeconds % 60);
    
    let parts = [];
    if (d > 0) parts.push(`${d}${t('unitCalculator.time.day')}`);
    if (h > 0 || d > 0) parts.push(`${String(h).padStart(2, '0')}${t('unitCalculator.time.hour')}`);
    parts.push(`${String(m).padStart(2, '0')}${t('unitCalculator.time.minute')}`);
    parts.push(`${String(s).padStart(2, '0')}${t('unitCalculator.time.second')}`);
    return parts.join(' ');
};

const UnitCalculator = () => {
    const { t } = useTranslation(); // YENİ: Çeviri kancası
fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=sims").catch(() => {});
    // --- STATE'LER ---
    const [worldSpeed, setWorldSpeed] = useState(1);
    
    const [levels, setLevels] = useState({
        barracks: 25, stable: 20, workshop: 15
    });

    const [bonuses, setBonuses] = useState({
        barracksBonus: 0, stableBonus: 0, workshopBonus: 0,
        massRecruit: 0, flagRecruit: 0, costReduction: 0
    });

    // Her birim için girilen miktar
    const [counts, setCounts] = useState(
        unitsDB.reduce((acc, unit) => ({ ...acc, [unit.id]: '' }), {})
    );

    // İnput Değişimleri
    const handleCountChange = (id, val) => {
        let parsed = parseInt(val) || '';
        if (parsed < 0) parsed = '';
        setCounts(prev => ({ ...prev, [id]: parsed }));
    };

    const handleLevelChange = (key, val) => {
        let parsed = parseInt(val) || 1;
        if (key === 'barracks' && parsed > 25) parsed = 25;
        if (key === 'stable' && parsed > 20) parsed = 20;
        if (key === 'workshop' && parsed > 15) parsed = 15;
        if (parsed < 1) parsed = 1;
        setLevels(prev => ({ ...prev, [key]: parsed }));
    };

    const handleBonusChange = (key, val) => {
        let parsed = parseFloat(val) || 0;
        if (parsed < 0) parsed = 0;
        setBonuses(prev => ({ ...prev, [key]: parsed }));
    };

    // --- HESAPLAMALAR (Excel Formüllerinin Birebir Aktarımı) ---
    const calculations = useMemo(() => {
        let totalW = 0, totalC = 0, totalI = 0, totalPop = 0;
        let timeBarracks = 0, timeStable = 0, timeWorkshop = 0;

        // Maliyet Düşümü Çarpanı (Örn: %10 indirim = 0.9)
        const costMult = 1 - (bonuses.costReduction / 100);

        // Hız Bonusları Çarpanları (Excel: =1+0,01*(BinaBonus+Toplu+Bayrak))
        const speedMultBarracks = 1 + ((bonuses.barracksBonus + bonuses.massRecruit + bonuses.flagRecruit) / 100);
        const speedMultStable = 1 + ((bonuses.stableBonus + bonuses.massRecruit + bonuses.flagRecruit) / 100);
        const speedMultWorkshop = 1 + ((bonuses.workshopBonus + bonuses.massRecruit + bonuses.flagRecruit) / 100);

        const rows = unitsDB.map(u => {
            const count = counts[u.id] === '' ? 0 : counts[u.id];

            // 1. Maliyet Hesaplaması (Bonus Uygulanmış)
            const reqW = Math.round(u.w * count * costMult);
            const reqC = Math.round(u.c * count * costMult);
            const reqI = Math.round(u.i * count * costMult);
            const reqPop = u.p * count;

            totalW += reqW; totalC += reqC; totalI += reqI; totalPop += reqPop;

            // 2. Süre Hesaplaması
            let facilityLevel = levels[u.facility];
            let levelModifier = buildFactor[facilityLevel];
            
            let speedMult = 1;
            if (u.facility === 'barracks') speedMult = speedMultBarracks;
            if (u.facility === 'stable') speedMult = speedMultStable;
            if (u.facility === 'workshop') speedMult = speedMultWorkshop;

            let totalSeconds = 0;
            if (count > 0) {
                totalSeconds = count * ((u.baseTime / 100) / worldSpeed) * levelModifier / speedMult;
                
                // Bina toplam kuyruk sürelerine ekle
                if (u.facility === 'barracks') timeBarracks += totalSeconds;
                if (u.facility === 'stable') timeStable += totalSeconds;
                if (u.facility === 'workshop') timeWorkshop += totalSeconds;
            }

            return { ...u, count, reqW, reqC, reqI, reqPop, totalSeconds };
        });

        return { rows, totalW, totalC, totalI, totalPop, timeBarracks, timeStable, timeWorkshop };
    }, [worldSpeed, levels, bonuses, counts]);

    return (
        <div className="uc-container">
            <h1 className="uc-header">{t('unitCalculator.title')}</h1>

            {/* AYARLAR PANELİ */}
            <div className="uc-panel">
                <div className="uc-grid-3">
                    <div className="uc-settings-group">
                        <h4>{t('unitCalculator.settings.basic')}</h4>
                        <div className="uc-input-row">{t('unitCalculator.settings.worldSpeed')} <input type="number" value={worldSpeed} step="0.1" onChange={e => setWorldSpeed(parseFloat(e.target.value) || 1)} /></div>
                        <div className="uc-input-row">{t('unitCalculator.settings.barracksLevel')} <input type="number" value={levels.barracks} onChange={e => handleLevelChange('barracks', e.target.value)} /></div>
                        <div className="uc-input-row">{t('unitCalculator.settings.stableLevel')} <input type="number" value={levels.stable} onChange={e => handleLevelChange('stable', e.target.value)} /></div>
                        <div className="uc-input-row">{t('unitCalculator.settings.workshopLevel')} <input type="number" value={levels.workshop} onChange={e => handleLevelChange('workshop', e.target.value)} /></div>
                    </div>

                    <div className="uc-settings-group">
                        <h4>{t('unitCalculator.settings.speedBonus')}</h4>
                        <div className="uc-input-row">{t('unitCalculator.settings.barracksBonus')} <input type="number" value={bonuses.barracksBonus} onChange={e => handleBonusChange('barracksBonus', e.target.value)} /></div>
                        <div className="uc-input-row">{t('unitCalculator.settings.stableBonus')} <input type="number" value={bonuses.stableBonus} onChange={e => handleBonusChange('stableBonus', e.target.value)} /></div>
                        <div className="uc-input-row">{t('unitCalculator.settings.workshopBonus')} <input type="number" value={bonuses.workshopBonus} onChange={e => handleBonusChange('workshopBonus', e.target.value)} /></div>
                        <div className="uc-input-row">{t('unitCalculator.settings.flagRecruit')} <input type="number" value={bonuses.flagRecruit} onChange={e => handleBonusChange('flagRecruit', e.target.value)} /></div>
                    </div>

                    <div className="uc-settings-group">
                        <h4>{t('unitCalculator.settings.costBonus')}</h4>
                        <div className="uc-input-row">{t('unitCalculator.settings.massRecruit')} <input type="number" value={bonuses.massRecruit} onChange={e => handleBonusChange('massRecruit', e.target.value)} /></div>
                        <div className="uc-input-row">{t('unitCalculator.settings.costReduction')} <input type="number" value={bonuses.costReduction} onChange={e => handleBonusChange('costReduction', e.target.value)} /></div>
                        
                        <div style={{marginTop: '15px', textAlign: 'center'}}>
                            <button 
                                onClick={() => setCounts(unitsDB.reduce((acc, u) => ({ ...acc, [u.id]: '' }), {}))}
                                style={{background: '#d9534f', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}
                            >
                                {t('unitCalculator.settings.resetBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* BİRİM GİRİŞ TABLOSU */}
            <div className="uc-table-wrapper">
                <table className="uc-table">
                    <thead>
                        <tr>
                            <th>{t('unitCalculator.table.unit')}</th>
                            <th>{t('unitCalculator.table.count')}</th>
                            <th><span className="uc-wood">{t('unitCalculator.table.wood')}</span></th>
                            <th><span className="uc-clay">{t('unitCalculator.table.clay')}</span></th>
                            <th><span className="uc-iron">{t('unitCalculator.table.iron')}</span></th>
                            <th><span className="uc-pop">{t('unitCalculator.table.pop')}</span></th>
                            <th>{t('unitCalculator.table.time')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {calculations.rows.map(row => (
                            <tr key={row.id}>
                                <td style={{fontWeight: 'bold', color: '#5a3a18', textAlign: 'left'}}>{t(`unitCalculator.units.${row.id}`)}</td>
                                <td>
                                    <input 
                                        type="number" 
                                        className="uc-unit-input" 
                                        placeholder="0"
                                        value={counts[row.id]} 
                                        onChange={e => handleCountChange(row.id, e.target.value)} 
                                    />
                                </td>
                                <td className="uc-wood">{row.reqW.toLocaleString()}</td>
                                <td className="uc-clay">{row.reqC.toLocaleString()}</td>
                                <td className="uc-iron">{row.reqI.toLocaleString()}</td>
                                <td className="uc-pop">{row.reqPop.toLocaleString()}</td>
                                <td className="uc-time">{formatClock(row.totalSeconds, t)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* GENEL TOPLAM BİLGİ KUTUSU */}
            <div className="uc-summary-box">
                <div>
                    <h3 style={{marginTop: 0, borderBottom: '1px solid #603000', paddingBottom: '5px', color: '#f0c042'}}>{t('unitCalculator.summary.costTitle')}</h3>
                    <div className="uc-summary-item">{t('unitCalculator.summary.woodReq')} <span>{calculations.totalW.toLocaleString()}</span></div>
                    <div className="uc-summary-item">{t('unitCalculator.summary.clayReq')} <span>{calculations.totalC.toLocaleString()}</span></div>
                    <div className="uc-summary-item">{t('unitCalculator.summary.ironReq')} <span>{calculations.totalI.toLocaleString()}</span></div>
                    <div className="uc-summary-item">{t('unitCalculator.summary.totalPop')} <span>{calculations.totalPop.toLocaleString()}</span></div>
                </div>

                <div className="uc-queue-times">
                    <h3 style={{marginTop: 0, borderBottom: '1px dashed #603000', paddingBottom: '5px', color: '#fff'}}>{t('unitCalculator.summary.queueTitle')}</h3>
                    <div className="uc-summary-item" style={{color: '#ccc'}}>{t('unitCalculator.summary.barracksTotal')} <span style={{color: '#d9534f'}}>{formatClock(calculations.timeBarracks, t)}</span></div>
                    <div className="uc-summary-item" style={{color: '#ccc'}}>{t('unitCalculator.summary.stableTotal')} <span style={{color: '#d9534f'}}>{formatClock(calculations.timeStable, t)}</span></div>
                    <div className="uc-summary-item" style={{color: '#ccc'}}>{t('unitCalculator.summary.workshopTotal')} <span style={{color: '#d9534f'}}>{formatClock(calculations.timeWorkshop, t)}</span></div>
                </div>
            </div>

        </div>
    );
};

export default UnitCalculator;