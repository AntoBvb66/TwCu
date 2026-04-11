import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // YENİ: Çeviri motoru eklendi
import storage from '../utils/storage';
import './ChurchPlanner.css';

const ChurchPlanner = () => {
    const { t } = useTranslation(); // YENİ: Çeviri kancası

    // State'ler
    const [villagesInput, setVillagesInput] = useState(() => storage.get('cp_villages', ''));
    const [existingInput, setExistingInput] = useState(() => storage.get('cp_existing', ''));
    const [includeFirstChurch, setIncludeFirstChurch] = useState(true);
    const [results, setResults] = useState(null);

    const canvasRef = useRef(null);

    // Kordinatları Çıkarma (Her türlü metin içinden xxx|yyy formatını bulur)
    const parseCoordinates = (text) => {
        const coords = [];
        const regex = /(\d{3})\|(\d{3})/g;
        let match;
        const uniqueCheck = new Set();
        while ((match = regex.exec(text)) !== null) {
            const x = parseInt(match[1]);
            const y = parseInt(match[2]);
            const key = `${x}|${y}`;
            if (!uniqueCheck.has(key)) {
                uniqueCheck.add(key);
                coords.push({ x, y, key });
            }
        }
        return coords;
    };

    // Mevcut Kiliseleri Çıkarma (Format: 500|500 3 veya 500|500 Level 3)
    const parseExistingChurches = (text) => {
        const churches = [];
        const lines = text.trim().split('\n');
        // Örn: 500|500 3 veya 500|500 Lvl 2 veya 500|500 level3
        const regex = /(\d{3})\|(\d{3}).*?(?:level|lvl|\s)\s*([1-3])/i;
        
        for (const line of lines) {
            const match = line.match(regex);
            if (match) {
                const x = parseInt(match[1]);
                const y = parseInt(match[2]);
                const level = parseInt(match[3]);
                const radius = level === 1 ? 4 : level === 2 ? 6 : 8;
                churches.push({ x, y, level, radius, type: 'Existing', key: `${x}|${y}` });
            }
        }
        return churches;
    };

    // Mesafe Kontrolü (Orijinal Klanlar Mantığı)
    const isWithinRadius = (origin, target, radius) => {
        const dx = origin.x - target.x;
        const dy = origin.y - target.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
    };

    // === AKILLI HESAPLAMA ALGORİTMASI ===
    const calculateOptimal = () => {
        storage.set('cp_villages', villagesInput);
        storage.set('cp_existing', existingInput);

        const allVillages = parseCoordinates(villagesInput);
        const existingChurches = parseExistingChurches(existingInput);

        if (allVillages.length === 0) return alert(t('churchPlanner.alertNoVillage'));

        let uncovered = [...allVillages];
        const plannedChurches = [];

        // 1. Mevcut Kiliseleri İşle
        for (const church of existingChurches) {
            const covered = uncovered.filter(v => isWithinRadius(church, v, church.radius));
            plannedChurches.push({ ...church, coveredCount: covered.length });
            uncovered = uncovered.filter(u => !covered.some(c => c.key === u.key));
        }

        // 2. İlk Kilise (First Church - Radius 6)
        let hasFirstChurchUsed = false;
        if (includeFirstChurch && uncovered.length > 0) {
            let bestFC = null;
            let maxCovered = 0;

            for (const center of allVillages) {
                const covered = uncovered.filter(v => isWithinRadius(center, v, 6));
                if (covered.length > maxCovered) {
                    maxCovered = covered.length;
                    bestFC = { ...center, type: 'First Church', level: 1, radius: 6, coveredCount: covered.length };
                }
            }

            if (bestFC) {
                plannedChurches.push(bestFC);
                uncovered = uncovered.filter(u => !isWithinRadius(bestFC, u, 6));
                hasFirstChurchUsed = true;
            }
        }

        // 3. Normal Kiliseler (Nüfus Tasarrufu Algoritması)
        while (uncovered.length > 0) {
            let bestCenter = null;
            let bestCoveredSet = [];
            let bestRadius = 8; // Başlangıçta en büyüğü test et

            // Önce Radius 8 ile en çok köyü kapsayan merkezi bul
            for (const center of allVillages) {
                const covered = uncovered.filter(v => isWithinRadius(center, v, 8));
                if (covered.length > bestCoveredSet.length) {
                    bestCoveredSet = covered;
                    bestCenter = center;
                }
            }

            if (!bestCenter) break; // Güvenlik çıkışı

            // NÜFUS TASARRUFU: Bu merkez R=8 ile X köy kapsıyor. 
            // Peki R=6 veya R=4 de aynı X köyü kapsar mıydı? Kapsarsa seviyeyi düşür!
            const coveredBy4 = uncovered.filter(v => isWithinRadius(bestCenter, v, 4));
            const coveredBy6 = uncovered.filter(v => isWithinRadius(bestCenter, v, 6));

            if (coveredBy4.length === bestCoveredSet.length) {
                bestRadius = 4;
            } else if (coveredBy6.length === bestCoveredSet.length) {
                bestRadius = 6;
            }

            const level = bestRadius === 4 ? 1 : bestRadius === 6 ? 2 : 3;
            
            plannedChurches.push({ 
                ...bestCenter, 
                type: 'Normal Church', 
                level, 
                radius: bestRadius, 
                coveredCount: bestCoveredSet.length 
            });

            // Kapsananları listeden çıkar
            uncovered = uncovered.filter(u => !bestCoveredSet.some(c => c.key === u.key));
        }

        setResults({ churches: plannedChurches, allVillages, totalUncovered: uncovered.length });
        drawMap(plannedChurches, allVillages);
        fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=churches").catch(()=>console.log("sayac hatasi"));
    };

    // === GÖRSEL HARİTA ÇİZİMİ ===
    const drawMap = (churches, villages) => {
        fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=maps").catch(() => {});
        const canvas = canvasRef.current;
        if (!canvas || villages.length === 0) return;
        const ctx = canvas.getContext("2d");

        let minX = 999, minY = 999, maxX = 0, maxY = 0;
        villages.forEach(v => {
            if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
        });
        
        const padding = 15;
        minX -= padding; minY -= padding; maxX += padding; maxY += padding;
        
        const mapWidth = maxX - minX;
        const mapHeight = maxY - minY;
        
        const scale = Math.min(600 / mapWidth, 600 / mapHeight);

        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        churches.forEach(c => {
            const drawX = (c.x - minX) * scale;
            const drawY = (c.y - minY) * scale;
            const drawRadius = c.radius * scale;

            ctx.beginPath();
            ctx.arc(drawX, drawY, drawRadius, 0, 2 * Math.PI);
            
            if (c.type === 'First Church') {
                ctx.fillStyle = "rgba(255, 100, 100, 0.2)";
                ctx.strokeStyle = "rgba(255, 100, 100, 0.8)";
            } else if (c.type === 'Existing') {
                ctx.fillStyle = "rgba(150, 150, 150, 0.2)";
                ctx.strokeStyle = "rgba(150, 150, 150, 0.8)";
            } else {
                ctx.fillStyle = "rgba(100, 255, 100, 0.2)";
                ctx.strokeStyle = "rgba(100, 255, 100, 0.8)";
            }
            
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = "#fff";
            ctx.fillRect(drawX - 2, drawY - 2, 4, 4);
        });

        villages.forEach(v => {
            const drawX = (v.x - minX) * scale;
            const drawY = (v.y - minY) * scale;

            let isCovered = false;
            for (const c of churches) {
                if (isWithinRadius(c, v, c.radius)) { isCovered = true; break; }
            }

            ctx.beginPath();
            ctx.arc(drawX, drawY, 2, 0, 2 * Math.PI);
            ctx.fillStyle = isCovered ? "#f0c042" : "#ff0000";
            ctx.fill();
        });
    };

    return (
        <div className="cp-container">
            <h1 className="cp-header">{t('churchPlanner.title')}</h1>
            
            <div className="cp-grid">
                {/* SOL PANEL - Girdiler */}
                <div>
                    <div className="cp-box">
                        <h3>{t('churchPlanner.dataInput')}</h3>
                        <label className="cp-label">{t('churchPlanner.allVillagesCoords')}</label>
                        <textarea 
                            className="cp-textarea" rows="6" 
                            placeholder={t('churchPlanner.villagesPlaceholder')} 
                            value={villagesInput} onChange={e => setVillagesInput(e.target.value)}
                        />

                        <label className="cp-label">{t('churchPlanner.existingChurchesLabel')}</label>
                        <textarea 
                            className="cp-textarea" rows="3" 
                            placeholder={t('churchPlanner.existingChurchesPlaceholder')} 
                            value={existingInput} onChange={e => setExistingInput(e.target.value)}
                        />

                        <div style={{marginBottom: '15px'}}>
                            <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <input type="checkbox" checked={includeFirstChurch} onChange={e => setIncludeFirstChurch(e.target.checked)} />
                                {t('churchPlanner.includeFirstChurch')}
                            </label>
                        </div>

                        <button className="cp-btn" onClick={calculateOptimal}>{t('churchPlanner.calculateBtn')}</button>
                    </div>

                    {/* SONUÇ LİSTESİ */}
                    {results && (
                        <div className="cp-box">
                            <h3>{t('churchPlanner.resultsTitle').replace('{{count}}', results.churches.length)}</h3>
                            <ul className="cp-result-list">
                                {results.churches.map((c, idx) => (
                                    <li key={idx} className="cp-result-item">
                                        <span className={c.type === 'First Church' ? 'tag-first' : c.type === 'Existing' ? 'tag-exist' : 'tag-normal'}>
                                            {c.type === 'Existing' ? t('churchPlanner.existing') : (c.type === 'First Church' ? t('churchPlanner.firstChurch') : t('churchPlanner.normalChurch'))}
                                            {c.type !== 'First Church' && ` (${t('churchPlanner.lvl')} ${c.level})`}
                                        </span>
                                        <br/>
                                        📍 <b>{c.x}|{c.y}</b> — <i>{c.coveredCount} {t('churchPlanner.coversVillages')}</i>
                                    </li>
                                ))}
                            </ul>
                            {results.totalUncovered > 0 && (
                                <p style={{color: 'red', fontSize: '13px', marginTop: '10px'}}>
                                    {t('churchPlanner.warningUncovered').replace('{{count}}', results.totalUncovered)}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* SAĞ PANEL - Harita */}
                <div>
                    <div className="cp-canvas-container">
                        <div className="cp-legend">
                            <div className="legend-item"><div className="legend-color" style={{background: 'rgba(150,150,150,0.8)'}}></div> {t('churchPlanner.existing')}</div>
                            <div className="legend-item"><div className="legend-color" style={{background: 'rgba(255,100,100,0.8)'}}></div> {t('churchPlanner.firstChurch')}</div>
                            <div className="legend-item"><div className="legend-color" style={{background: 'rgba(100,255,100,0.8)'}}></div> {t('churchPlanner.normalChurch')}</div>
                            <div className="legend-item" style={{marginLeft: '10px'}}><div className="legend-color" style={{background: '#f0c042', width: '8px', height: '8px'}}></div> {t('churchPlanner.coveredVillage')}</div>
                            <div className="legend-item"><div className="legend-color" style={{background: '#ff0000', width: '8px', height: '8px'}}></div> {t('churchPlanner.uncoveredVillage')}</div>
                        </div>
                        <canvas ref={canvasRef} width="600" height="600" style={{maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto'}}></canvas>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChurchPlanner;