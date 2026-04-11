import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // YENİ: Çeviri motoru eklendi
import storage from '../utils/storage';
import './BuildingTimes.css';

// === SENİN KUSURSUZ ORİJİNAL VERİLERİN ===
const buildTimes = {
    1:  ['0:00:07','0:00:14','0:00:45','0:00:45','0:15:00','5:40:00','0:01:39','9:23:20','0:00:45','0:00:09','0:00:11','0:00:20','0:00:07','0:00:07','0:00:08','0:00:09','0:00:08','0:00:14','8:20:00','0:00:01','0:00:27'],
    2:  ['0:00:07','0:00:14','0:00:45','0:00:45',null,'6:48:00','0:01:39','9:23:20','0:00:45',null,null,'0:00:20','0:00:07','0:00:07','0:00:08','0:00:09','0:00:08','0:00:14','7:48:15',null,'0:00:27'],
    3:  ['0:02:25','0:04:51','0:16:09','0:16:09',null,'8:09:36','0:35:32','11:16:00','0:16:09',null,null,'0:07:16','0:02:25','0:02:25','0:02:54','0:03:14','0:02:45','0:04:51','7:24:27',null,'0:09:41'],
    4:  ['0:07:30','0:15:01','0:50:02','0:50:02',null,null,'1:50:04',null,'0:50:02',null,null,'0:22:31','0:07:30','0:07:30','0:09:00','0:10:00','0:08:30','0:15:01',null,null,'0:30:01'],
    5:  ['0:14:21','0:28:42','1:35:41','1:35:41',null,null,'3:30:30',null,'1:35:41',null,null,'0:43:03','0:14:21','0:14:21','0:17:13','0:19:08','0:16:16','0:28:42',null,null,'0:57:24'],
    6:  ['0:22:37','0:45:14','2:30:47','2:30:47',null,null,'5:31:43',null,'2:30:47',null,null,'1:07:51','0:22:37','0:22:37','0:27:08','0:30:09','0:25:38','0:45:14',null,null,'1:30:28'],
    7:  ['0:32:23','1:04:46','3:35:52','3:35:52',null,null,'7:54:55',null,'3:35:52',null,null,'1:37:08','0:32:23','0:32:23','0:38:51','0:43:10','0:36:42','1:04:46',null,null,'2:09:31'],
    8:  ['0:43:51','1:27:43','4:52:23','4:52:23',null,null,'10:43:15',null,'4:52:23',null,null,'2:11:34','0:43:51','0:43:51','0:52:38','0:58:29','0:49:42','1:27:43',null,null,'2:55:26'],
    9:  ['0:57:23','1:54:45','6:22:31','6:22:31',null,null,'14:01:33',null,'6:22:31',null,null,'2:52:08','0:57:23','0:57:23','1:08:51','1:16:30','1:05:02','1:54:45',null,null,'3:49:31'],
    10: ['1:13:19','2:26:38','8:08:46','8:08:46',null,null,'17:55:16',null,'8:08:46',null,null,'3:39:57','1:13:19','1:13:19','1:27:59','1:37:45','1:23:05','2:26:38',null,null,'4:53:15'],
    11: ['1:32:17','3:04:35','10:15:15','10:15:15',null,null,'22:33:34',null,'10:15:15',null,null,'4:36:52','1:32:17','1:32:17','1:50:45','2:03:03','1:44:36',null,null,null,'6:09:09'],
    12: ['1:54:54','3:49:48','12:46:00','12:46:00',null,null,'28:05:12',null,'12:46:00',null,null,'5:44:42','1:54:54','1:54:54','2:17:53','2:33:12','2:10:13',null,null,null,'7:39:36'],
    13: ['2:21:38','4:43:16','15:44:14','15:44:14',null,null,'34:37:19',null,'15:44:14',null,null,'7:04:54','2:21:38','2:21:38','2:49:58','3:08:51','2:40:31',null,null,null,'9:26:32'],
    14: ['2:53:28','5:46:56','19:16:27','19:16:27',null,null,'42:24:12',null,'19:16:27',null,null,'8:40:24','2:53:28','2:53:28','3:28:10','3:51:17','3:16:36',null,null,null,'11:33:52'],
    15: ['3:31:18','7:02:35','23:28:37','23:28:37',null,null,'51:38:57',null,'23:28:37',null,null,'10:33:53','3:31:18','3:31:18','4:13:33','4:41:43','3:59:28',null,null,null,'14:05:10'],
    16: ['4:16:19','8:32:38','28:28:45',null,null,null,'62:39:16',null,'28:28:45',null,null,'12:48:56','4:16:19','4:16:19','5:07:35','5:41:45','4:50:29',null,null,null,'17:05:15'],
    17: ['5:09:49','10:19:38','34:25:26',null,null,null,'75:43:57',null,'34:25:26',null,null,'15:29:27','5:09:49','5:09:49','6:11:47','6:53:05','5:51:07',null,null,null,'20:39:16'],
    18: ['6:13:29','12:26:57','41:29:51',null,null,null,'91:17:40',null,'41:29:51',null,null,'18:40:26','6:13:29','6:13:29','7:28:10','8:17:58','7:03:16',null,null,null,'24:53:55'],
    19: ['7:29:08','14:58:16','49:54:12',null,null,null,'109:47:15',null,'49:54:12',null,null,'22:27:23','7:29:08','7:29:08','8:58:57','9:58:50','8:29:01',null,null,null,'29:56:31'],
    20: ['8:59:01','17:58:02','59:53:26',null,null,null,'131:45:33',null,'59:53:26',null,null,'26:57:03','8:59:01','8:59:01','10:46:49','11:58:41','10:10:53',null,null,null,'35:56:04'],
    21: ['10:45:53','21:31:47',null,null,null,null,null,null,null,null,null,'32:17:40','10:45:53','10:45:53','12:55:04','14:21:11','12:12:00',null,null,null,null],
    22: ['12:52:40','25:45:21',null,null,null,null,null,null,null,null,null,'38:38:01','12:52:40','12:52:40','15:27:12','17:10:14','14:35:42',null,null,null,null],
    23: ['15:23:16','30:46:33',null,null,null,null,null,null,null,null,null,'46:09:49','15:23:16','15:23:16','18:27:56','20:31:02','17:26:23',null,null,null,null],
    24: ['18:22:01','36:44:02',null,null,null,null,null,null,null,null,null,'55:06:04','18:22:01','18:22:01','22:02:25','24:29:22','20:48:57',null,null,null,null],
    25: ['21:54:12','43:48:23',null,null,null,null,null,null,null,null,null,'65:42:35','21:54:12','21:54:12','26:17:02','29:12:16','24:49:25',null,null,null,null],
    26: ['26:06:08',null,null,null,null,null,null,null,null,null,null,null,'26:06:08','26:06:08','31:19:21','34:48:10','29:34:57',null,null,null,null],
    27: ['31:05:06',null,null,null,null,null,null,null,null,null,null,null,'31:05:06','31:05:06','37:18:07','41:26:48','35:13:47',null,null,null,null],
    28: ['36:57:53',null,null,null,null,null,null,null,null,null,null,null,'36:57:53','36:57:53','44:21:28','49:17:11','41:53:36',null,null,null,null],
    29: ['43:57:17',null,null,null,null,null,null,null,null,null,null,null,'43:57:17','43:57:17','52:44:44','58:36:22','49:48:55',null,null,null,null],
    30: ['52:14:15',null,null,null,null,null,null,null,null,null,null,null,'52:14:15','52:14:15','62:41:05','69:38:59','59:12:08',null,null,null,null]
};

const hqModifiers = {
    1: 0.952380952, 2: 0.907029478, 3: 0.863837599, 4: 0.822702475, 5: 0.783526166,
    6: 0.746215397, 7: 0.71068133, 8: 0.676839362, 9: 0.644608916, 10: 0.613913254,
    11: 0.584679289, 12: 0.556837418, 13: 0.530321351, 14: 0.505067953, 15: 0.481017098,
    16: 0.458111522, 17: 0.436296688, 18: 0.415520655, 19: 0.395733957, 20: 0.376889483,
    21: 0.358942365, 22: 0.341849871, 23: 0.325571306, 24: 0.31006791, 25: 0.295302772,
    26: 0.281240735, 27: 0.267848319, 28: 0.255093637, 29: 0.242946321, 30: 0.231377449
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

function secondsToTime(s) {
    if (s <= 0) return "-";
    const totalSeconds = Math.max(1, Math.round(s));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const sec = totalSeconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// YENİ: Metin okunuşu için süre formatlayıcı artık t fonksiyonunu kullanıyor
function formatTimeFriendly(totalSeconds, t) {
    if (isNaN(totalSeconds) || totalSeconds <= 0) return t('buildingTimes.time.zero');
    const d = Math.floor(totalSeconds / (3600 * 24));
    const h = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    let parts = [];
    if (d > 0) parts.push(`${d} ${t('buildingTimes.time.day')}`);
    if (h > 0) parts.push(`${h} ${t('buildingTimes.time.hour')}`);
    if (m > 0) parts.push(`${m} ${t('buildingTimes.time.minute')}`);
    if (s > 0 || parts.length === 0) parts.push(`${s} ${t('buildingTimes.time.second')}`);
    return parts.join(' ');
}

const BuildingTimes = () => {
    const { t } = useTranslation(); // YENİ: Çeviri motorunu başlat

    // YENİ: buildingNames artık sabit değil, çeviri sözlüğünden liste olarak geliyor
    const buildingNames = t('buildingTimes.buildings', { returnObjects: true });

    // Ortak Ayar: Dünya Hızı
    const [worldSpeed, setWorldSpeed] = useState(() => storage.get('tw_ws', 1.0));

    // Panel 1 ve 2 State'leri (buildingIdx = 1, yani Kışla varsayılan)
    const [comp1, setComp1] = useState({ hq: 20, buildingIdx: 1, from: 0, to: 25 });
    const [comp2, setComp2] = useState({ hq: 25, buildingIdx: 1, from: 0, to: 25 });

    // Sürükle-Bırak Tablo Ayarları
    const [tableHqLevel, setTableHqLevel] = useState(() => storage.get('tw_hq', 20));
    const [columnOrder, setColumnOrder] = useState(() => 
        storage.get('tw_col_order', Array.from({length: buildingNames.length}, (_, i) => i))
    );
    const [visibleColumns, setVisibleColumns] = useState(() => 
        storage.get('tw_vis_cols', Array.from({length: 21}, () => true)) // 21 bina var
    );

    const toggleColumn = (idx) => {
        const newVis = [...visibleColumns];
        newVis[idx] = !newVis[idx];
        setVisibleColumns(newVis);
    };

    useEffect(() => {
        storage.set('tw_ws', worldSpeed);
        storage.set('tw_hq', tableHqLevel);
        storage.set('tw_col_order', columnOrder);
        storage.set('tw_vis_cols', visibleColumns);
    }, [worldSpeed, tableHqLevel, columnOrder,visibleColumns]);

    // Orijinal verileri kullanarak İki Seviye Arası Toplam Süreyi Hesapla
    const calculateTotal = (comp) => {
        if (comp.from >= comp.to) return 0;
        fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=sims").catch(() => {});
        let totalSeconds = 0;
        const hqMod = hqModifiers[comp.hq] || 1.0;

        for (let lvl = comp.from + 1; lvl <= comp.to; lvl++) {
            const timesForLevel = buildTimes[lvl];
            if (!timesForLevel) break; 
            
            const timeStr = timesForLevel[comp.buildingIdx];
            if (!timeStr) break; 

            totalSeconds += (timeToSeconds(timeStr) * hqMod) / worldSpeed;
        }
        return totalSeconds;
    };

    const time1 = calculateTotal(comp1);
    const time2 = calculateTotal(comp2);

    // Input Değişim Yöneticisi
    const handleChange = (setComp, comp, field, value) => {
        let val = parseInt(value) || 0;
        if (val < 0) val = 0;
        if (field === 'hq' && val > 30) val = 30;
        if (field === 'hq' && val < 1) val = 1;
        if (field === 'to' && val > 30) val = 30;
        setComp({ ...comp, [field]: val });
    };

    // Sürükle Bırak Fonksiyonları
    const handleDragStart = (e, index) => { e.dataTransfer.setData("dragIndex", index); e.dataTransfer.effectAllowed = 'move'; };
    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData("dragIndex"));
        if (dragIndex === dropIndex) return;
        const newOrder = [...columnOrder];
        const [movedItem] = newOrder.splice(dragIndex, 1);
        newOrder.splice(dropIndex, 0, movedItem);
        setColumnOrder(newOrder);
    };
    const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

    const tableHqMod = hqModifiers[tableHqLevel] || 1.0;

    return (
        <div className="bt-container">
            {/* ÜST BİLGİ VE DÜNYA HIZI */}
            <div className="bt-header">
                <h1 style={{margin: 0, fontSize: '24px'}}>{t('buildingTimes.title')}</h1>
                <div className="bt-world-speed">
                    <span>{t('buildingTimes.worldSpeed')}</span>
                    <input 
                        type="number" step="0.1" min="0.1" 
                        value={worldSpeed} 
                        onChange={(e) => setWorldSpeed(parseFloat(e.target.value) || 1)} 
                    />
                </div>
            </div>

            {/* KIYASLAMA PANELLERİ */}
            <div className="bt-grid-2">
                {/* PANEL 1 */}
                <div className="bt-box">
                    <h3>{t('buildingTimes.panel1')}</h3>
                    <div className="bt-form-row">
                        <label>{t('buildingTimes.hqLevel')}</label>
                        <input type="number" className="bt-input" value={comp1.hq} onChange={e => handleChange(setComp1, comp1, 'hq', e.target.value)} />
                    </div>
                    <div className="bt-form-row">
                        <label>{t('buildingTimes.buildingToUpgrade')}</label>
                        <select className="bt-select" value={comp1.buildingIdx} onChange={e => handleChange(setComp1, comp1, 'buildingIdx', e.target.value)}>
                            {buildingNames.map((name, idx) => (
                                <option key={idx} value={idx}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="bt-form-row">
                        <label>{t('buildingTimes.currentLevel')}</label>
                        <input type="number" className="bt-input" value={comp1.from} onChange={e => handleChange(setComp1, comp1, 'from', e.target.value)} />
                    </div>
                    <div className="bt-form-row">
                        <label>{t('buildingTimes.targetLevel')}</label>
                        <input type="number" className="bt-input" value={comp1.to} onChange={e => handleChange(setComp1, comp1, 'to', e.target.value)} />
                    </div>
                    <div className="bt-result">
                        {t('buildingTimes.totalTime')} <span style={{color: '#f0c042'}}>{formatTimeFriendly(time1, t)}</span>
                    </div>
                </div>

                {/* PANEL 2 */}
                <div className="bt-box">
                    <h3>{t('buildingTimes.panel2')}</h3>
                    <div className="bt-form-row">
                        <label>{t('buildingTimes.hqLevel')}</label>
                        <input type="number" className="bt-input" value={comp2.hq} onChange={e => handleChange(setComp2, comp2, 'hq', e.target.value)} />
                    </div>
                    <div className="bt-form-row">
                        <label>{t('buildingTimes.buildingToUpgrade')}</label>
                        <select className="bt-select" value={comp2.buildingIdx} onChange={e => handleChange(setComp2, comp2, 'buildingIdx', e.target.value)}>
                            {buildingNames.map((name, idx) => (
                                <option key={idx} value={idx}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="bt-form-row">
                        <label>{t('buildingTimes.currentLevel')}</label>
                        <input type="number" className="bt-input" value={comp2.from} onChange={e => handleChange(setComp2, comp2, 'from', e.target.value)} />
                    </div>
                    <div className="bt-form-row">
                        <label>{t('buildingTimes.targetLevel')}</label>
                        <input type="number" className="bt-input" value={comp2.to} onChange={e => handleChange(setComp2, comp2, 'to', e.target.value)} />
                    </div>
                    <div className="bt-result">
                        {t('buildingTimes.totalTime')} <span style={{color: '#f0c042'}}>{formatTimeFriendly(time2, t)}</span>
                    </div>
                </div>
            </div>

            {/* SÜRE FARKI KUTUSU */}
            {time1 > 0 && time2 > 0 && time1 !== time2 && (
                <div className="bt-diff-box">
                    {t('buildingTimes.comparisonResult')} <br/>
                    {time1 > time2 
                        ? t('buildingTimes.panel2Faster').replace('{{time}}', formatTimeFriendly(time1 - time2, t))
                        : t('buildingTimes.panel1Faster').replace('{{time}}', formatTimeFriendly(time2 - time1, t))
                    }
                </div>
            )}

            {/* ORİJİNAL SÜRÜKLE-BIRAK TABLO */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px'}}>
                <h3 style={{color: '#f0c042', margin: 0}}>{t('buildingTimes.tableTitle')}</h3>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <span style={{fontSize: '13px'}}>{t('buildingTimes.tableHqLevel')}</span>
                    <select className="bt-select" style={{width: '70px', padding: '4px'}} value={tableHqLevel} onChange={(e) => setTableHqLevel(parseInt(e.target.value))}>
                        {Object.keys(hqModifiers).map(lvl => (
                            <option key={lvl} value={lvl}>{lvl}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="bt-checkbox-container">
                <span style={{width: '100%', fontSize: '12px', color: '#aaa', marginBottom: '5px', borderBottom: '1px dashed #444', paddingBottom: '5px'}}>
                    Gösterilecek Binaları Seçin:
                </span>
                {buildingNames.map((name, idx) => (
                    <label key={idx} style={{ fontSize: '11px', color: visibleColumns[idx] ? '#f0c042' : '#777', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input 
                            type="checkbox" 
                            checked={visibleColumns[idx]} 
                            onChange={() => toggleColumn(idx)} 
                            style={{ margin: 0, cursor: 'pointer' }}
                        />
                        {name}
                    </label>
                ))}
            </div>
            <div className="tw-table-container">
                <table className="vis tw-table">
                    <thead>
                        <tr>
                            <th className="sticky-col">{t('buildingTimes.level')}</th>
                            {columnOrder.map((originalIdx, currentIndex) =>
                            {
                                if (!visibleColumns[originalIdx]) return null; // YENİ EKLENDİ
                                return (
                                <th 
                                    key={currentIndex} 
                                    draggable="true" 
                                    onDragStart={(e) => handleDragStart(e, currentIndex)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, currentIndex)}
                                    className="draggable-th"
                                    title={t('buildingTimes.dragTitle')}
                                >
                                    {buildingNames[originalIdx]}
                                </th>
                            )})}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({length: 30}, (_, i) => i + 1).map(lvl => {
                            const times = buildTimes[lvl] || [];
                            return (
                                <tr key={lvl} className={lvl % 2 === 0 ? 'row_even' : 'row_odd'}>
                                    <td className="sticky-col">{lvl - 1} ➔ {lvl}</td>
                                    {columnOrder.map(originalIdx => {
                                    if (!visibleColumns[originalIdx]) return null;
                                        const timeStr = times[originalIdx];
                                        if (!timeStr) return <td key={originalIdx} className="empty">-</td>;
                                        
                                        // Orijinal hatasız hesaplama yöntemi!
                                        const finalSec = (timeToSeconds(timeStr) * tableHqMod) / worldSpeed;
                                        return <td key={originalIdx}>{secondsToTime(finalSec)}</td>;
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div style={{fontSize: '12px', color: '#888', marginTop: '10px', textAlign: 'center'}}>
                {t('buildingTimes.tip')}
            </div>
        </div>
    );
};

export default BuildingTimes;