import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next'; // YENİ: Çeviri motoru eklendi
import storage from '../utils/storage';
import './ProductionData.css';

const resIcons = {
    wood: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/holz.png',
    clay: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/lehm.png',
    iron: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/eisen.png',
    storage: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/storage.png',
    farm: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/buildings/farm.png'
};

// --- KLANLAR MATEMATİĞİ (FORMÜLLER) ---
const calculateBaseProd = (level, speed) => {
    if (level === 0) return 5 * speed;
    return 30 * Math.pow(1.163118, level - 1) * speed;
};

const getStorageCapacity = (level) => {
    if (level === 0) return 1000;
    return Math.round(1000 * Math.pow(1.2294934, level - 1));
};

const getFarmCapacity = (level) => {
    if (level === 0) return 240;
    return Math.round(240 * Math.pow(1.172103, level - 1));
};

const ProductionData = () => {
    const { t } = useTranslation(); // YENİ: Çeviri kancası
    fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=sims").catch(() => {});

    const [worldSpeed, setWorldSpeed] = useState(() => storage.get("prod_worldSpeed", 1));
    const [mineSpeed, setMineSpeed] = useState(() => storage.get("prod_mineSpeed", 1));
    const [showTable, setShowTable] = useState(() => storage.get("prod_showTable", true));

    // Köy başlatma fonksiyonunu "Köy" veya "Village" kelimelerine uygun hale getirmek için dışarı aldık
    const initializeVillages = () => {
        const saved = storage.get("prod_villages", []);
        if (saved.length > 0) return saved;
        return [{ id: Date.now(), name: `${t('productionData.villageNamePrefix')} 1`, wood: 30, clay: 30, iron: 30, bonusType: 'none', bonusRate: 0 }];
    };

    const [villages, setVillages] = useState(initializeVillages);

    // Eğer dil değişirse ve köyler varsayılan durumdaysa, ilk köyün adını da güncelle
    useEffect(() => {
        if(villages.length === 1 && (villages[0].name === "Köy 1" || villages[0].name === "Village 1")) {
            setVillages([{ ...villages[0], name: `${t('productionData.villageNamePrefix')} 1` }]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t]);


    useEffect(() => {
        storage.set("prod_worldSpeed", worldSpeed);
        storage.set("prod_mineSpeed", mineSpeed);
        storage.set("prod_villages", villages);
        storage.set("prod_showTable", showTable);
    }, [worldSpeed, mineSpeed, villages, showTable]);

    // Üretim Hesaplama Fonksiyonu (Bonus Dahil)
    const getFinalProd = (level, speed, type, bonusType, bonusRate) => {
        let base = calculateBaseProd(level, speed);
        if (bonusType === 'all' || bonusType === type) {
            base = base * (1 + (bonusRate / 100));
        }
        return Math.round(base);
    };

    const totals = useMemo(() => {
        let totalWood = 0, totalClay = 0, totalIron = 0;
        const overallSpeed = worldSpeed * mineSpeed;

        villages.forEach(v => {
            totalWood += getFinalProd(v.wood, overallSpeed, 'wood', v.bonusType, v.bonusRate);
            totalClay += getFinalProd(v.clay, overallSpeed, 'clay', v.bonusType, v.bonusRate);
            totalIron += getFinalProd(v.iron, overallSpeed, 'iron', v.bonusType, v.bonusRate);
        });

        return {
            hourly: { wood: totalWood, clay: totalClay, iron: totalIron },
            daily: { wood: totalWood * 24, clay: totalClay * 24, iron: totalIron * 24 }
        };
    }, [villages, worldSpeed, mineSpeed]);

    const addVillage = () => {
        setVillages([...villages, { 
            id: Date.now(), 
            name: `${t('productionData.villageNamePrefix')} ${villages.length + 1}`, 
            wood: 30, clay: 30, iron: 30, 
            bonusType: 'none', 
            bonusRate: 0 
        }]);
    };

    const removeVillage = (id) => setVillages(villages.filter(v => v.id !== id));

    const updateVillage = (id, field, value) => {
        setVillages(villages.map(v => 
            v.id === id ? { ...v, [field]: field === 'name' || field === 'bonusType' ? value : parseInt(value) } : v
        ));
    };

    const clearAll = () => {
        if(window.confirm(t('productionData.clearConfirm'))) {
            setVillages([{ id: Date.now(), name: `${t('productionData.villageNamePrefix')} 1`, wood: 30, clay: 30, iron: 30, bonusType: 'none', bonusRate: 0 }]);
        }
    };

    const levels = Array.from({ length: 31 }, (_, i) => i); 
    const overallSpeed = worldSpeed * mineSpeed;

    return (
        <div className="prod-container">
            <h1 className="prod-header">{t('productionData.title')}</h1>
            
            <div className="prod-settings">
                <label>{t('productionData.worldSpeed')} <input type="number" step="0.1" className="prod-input" value={worldSpeed} onChange={e => setWorldSpeed(parseFloat(e.target.value) || 1)} /></label>
                <label>{t('productionData.mineSpeed')} <input type="number" step="0.1" className="prod-input" value={mineSpeed} onChange={e => setMineSpeed(parseFloat(e.target.value) || 1)} /></label>
                <div style={{marginLeft: 'auto', fontWeight: 'bold', color: '#f0c042'}}>{t('productionData.totalFactor').replace('{{speed}}', overallSpeed.toFixed(2))}</div>
            </div>

            <div className="prod-totals-board">
                <h2>{t('productionData.empireProdTitle').replace('{{count}}', villages.length)}</h2>
                <div className="prod-totals-grid">
                    <div className="prod-total-card">
                        <h4>{t('productionData.hourlyProd')}</h4>
                        <div className="prod-res-row text-wood"><span><img src={resIcons.wood} className="prod-res-icon" alt="W" /> {t('productionData.resources.wood')}</span><span>{totals.hourly.wood.toLocaleString()}</span></div>
                        <div className="prod-res-row text-clay"><span><img src={resIcons.clay} className="prod-res-icon" alt="C" /> {t('productionData.resources.clay')}</span><span>{totals.hourly.clay.toLocaleString()}</span></div>
                        <div className="prod-res-row text-iron"><span><img src={resIcons.iron} className="prod-res-icon" alt="I" /> {t('productionData.resources.iron')}</span><span>{totals.hourly.iron.toLocaleString()}</span></div>
                    </div>
                    <div className="prod-total-card">
                        <h4>{t('productionData.dailyProd')}</h4>
                        <div className="prod-res-row text-wood"><span><img src={resIcons.wood} className="prod-res-icon" alt="W" /> {t('productionData.resources.wood')}</span><span>{totals.daily.wood.toLocaleString()}</span></div>
                        <div className="prod-res-row text-clay"><span><img src={resIcons.clay} className="prod-res-icon" alt="C" /> {t('productionData.resources.clay')}</span><span>{totals.daily.clay.toLocaleString()}</span></div>
                        <div className="prod-res-row text-iron"><span><img src={resIcons.iron} className="prod-res-icon" alt="I" /> {t('productionData.resources.iron')}</span><span>{totals.daily.iron.toLocaleString()}</span></div>
                    </div>
                </div>
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
                <h3 style={{color: '#f0c042', margin: 0}}>{t('productionData.villageManagement')}</h3>
                <div>
                    <button className="prod-btn-clear" onClick={clearAll} style={{marginRight: '10px'}}>{t('productionData.resetBtn')}</button>
                    <button className="prod-btn" onClick={addVillage}>{t('productionData.newVillageBtn')}</button>
                </div>
            </div>

            <div className="prod-village-list">
                {villages.map((vil, index) => {
                    const wVal = getFinalProd(vil.wood, overallSpeed, 'wood', vil.bonusType, vil.bonusRate);
                    const cVal = getFinalProd(vil.clay, overallSpeed, 'clay', vil.bonusType, vil.bonusRate);
                    const iVal = getFinalProd(vil.iron, overallSpeed, 'iron', vil.bonusType, vil.bonusRate);

                    return (
                        <div key={vil.id} className="prod-village-row">
                            <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                                <div className="prod-village-name">
                                    <input type="text" value={vil.name} onChange={(e) => updateVillage(vil.id, 'name', e.target.value)} />
                                </div>
                                {/* BONUS SEÇİM PANELİ */}
                                <div className="prod-bonus-container">
                                    <span className="prod-bonus-label">{t('productionData.bonus.label')}</span>
                                    <select className="prod-bonus-select" value={vil.bonusType} onChange={e => updateVillage(vil.id, 'bonusType', e.target.value)}>
                                        <option value="none">{t('productionData.bonus.none')}</option>
                                        <option value="all">{t('productionData.bonus.all')}</option>
                                        <option value="wood">{t('productionData.bonus.wood')}</option>
                                        <option value="clay">{t('productionData.bonus.clay')}</option>
                                        <option value="iron">{t('productionData.bonus.iron')}</option>
                                    </select>
                                    <select className="prod-bonus-select" value={vil.bonusRate} onChange={e => updateVillage(vil.id, 'bonusRate', e.target.value)}>
                                        <option value="0">%0</option>
                                        <option value="30">%30</option>
                                        <option value="100">%100</option>
                                    </select>
                                </div>
                            </div>

                            <div className="prod-mines-container">
                                <div className="prod-mine-group">
                                    <img src={resIcons.wood} className="prod-res-icon" alt="W" />
                                    <select className="prod-select" value={vil.wood} onChange={e => updateVillage(vil.id, 'wood', e.target.value)}>
                                        {levels.map(l => <option key={l} value={l}>{t('productionData.lvl')} {l}</option>)}
                                    </select>
                                    <span className="prod-mine-output text-wood">+{wVal.toLocaleString()}</span>
                                </div>
                                <div className="prod-mine-group">
                                    <img src={resIcons.clay} className="prod-res-icon" alt="C" />
                                    <select className="prod-select" value={vil.clay} onChange={e => updateVillage(vil.id, 'clay', e.target.value)}>
                                        {levels.map(l => <option key={l} value={l}>{t('productionData.lvl')} {l}</option>)}
                                    </select>
                                    <span className="prod-mine-output text-clay">+{cVal.toLocaleString()}</span>
                                </div>
                                <div className="prod-mine-group">
                                    <img src={resIcons.iron} className="prod-res-icon" alt="I" />
                                    <select className="prod-select" value={vil.iron} onChange={e => updateVillage(vil.id, 'iron', e.target.value)}>
                                        {levels.map(l => <option key={l} value={l}>{t('productionData.lvl')} {l}</option>)}
                                    </select>
                                    <span className="prod-mine-output text-iron">+{iVal.toLocaleString()}</span>
                                </div>
                            </div>

                            <button className="prod-btn-del" onClick={() => removeVillage(vil.id)}>✖</button>
                        </div>
                    );
                })}
            </div>

            {/* REFERANS TABLOSU */}
            <div className="prod-table-wrapper">
                <div className="prod-table-header">
                    <h3>{t('productionData.referenceTable.title')}</h3>
                    <button className="prod-btn" style={{padding: '5px 10px', fontSize: '12px'}} onClick={() => setShowTable(!showTable)}>
                        {showTable ? t('productionData.referenceTable.hide') : t('productionData.referenceTable.show')}
                    </button>
                </div>
                {showTable && (
                    <div style={{maxHeight: '400px', overflowY: 'auto'}}>
                        <table className="prod-table">
                            <thead>
                                <tr>
                                    <th>{t('productionData.referenceTable.cols.level')}</th>
                                    <th>{t('productionData.referenceTable.cols.hourly').replace('{{speed}}', overallSpeed.toFixed(2))}</th>
                                    <th>{t('productionData.referenceTable.cols.storage')}</th>
                                    <th>{t('productionData.referenceTable.cols.farm')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {levels.slice(1).map(l => (
                                    <tr key={l}>
                                        <td><span className="prod-lvl-badge">{l}</span></td>
                                        <td style={{color: '#5cb85c', fontWeight: 'bold'}}>{Math.round(calculateBaseProd(l, overallSpeed)).toLocaleString()} {t('productionData.referenceTable.perHour')}</td>
                                        <td style={{color: '#f0ad4e'}}>{getStorageCapacity(l).toLocaleString()}</td>
                                        <td style={{color: '#dcb589'}}>{getFarmCapacity(l).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductionData;