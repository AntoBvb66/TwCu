import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // YENİ: Çeviri motoru eklendi
import storage from '../utils/storage';
import './CoinMinter.css';

const getClusterColor = (index, total) => {
    const hue = (index * (360 / total)) % 360;
    return `hsl(${hue}, 80%, 60%)`;
};

const CoinMinter = () => {
    const { t } = useTranslation(); // YENİ: Çeviri kancası
    fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=sims").catch(() => {});

    const [villagesInput, setVillagesInput] = useState(() => storage.get('cm_villages', ''));
    const [hubCount, setHubCount] = useState(() => storage.get('cm_hubs', 3));
    const [results, setResults] = useState(null);

    const canvasRef = useRef(null);

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

    const getDistance = (a, b) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

    const calculateHubs = () => {
        storage.set('cm_villages', villagesInput);
        storage.set('cm_hubs', hubCount);

        const villages = parseCoordinates(villagesInput);
        const k = parseInt(hubCount) || 1;

        if (villages.length === 0) return alert(t('coinMinter.alerts.noVillage'));
        if (k < 1 || k > villages.length) return alert(t('coinMinter.alerts.invalidHubCount'));

        let centers = [villages[Math.floor(Math.random() * villages.length)]];
        while (centers.length < k) {
            let maxDist = -1;
            let nextCenter = null;
            for (const v of villages) {
                if (centers.some(c => c.key === v.key)) continue;
                const minDistToCenter = Math.min(...centers.map(c => getDistance(v, c)));
                if (minDistToCenter > maxDist) {
                    maxDist = minDistToCenter;
                    nextCenter = v;
                }
            }
            centers.push(nextCenter);
        }

        let clusters = [];
        let changed = true;
        let iterations = 0;

        while (changed && iterations < 100) {
            changed = false;
            clusters = centers.map((c, i) => ({ id: i, center: c, color: getClusterColor(i, k), villages: [] }));

            for (const v of villages) {
                let bestIdx = 0;
                let minDist = Infinity;
                for (let i = 0; i < centers.length; i++) {
                    const d = getDistance(v, centers[i]);
                    if (d < minDist) { minDist = d; bestIdx = i; }
                }
                clusters[bestIdx].villages.push(v);
            }

            const newCenters = [];
            for (let i = 0; i < clusters.length; i++) {
                const clusterVils = clusters[i].villages;
                if (clusterVils.length === 0) {
                    newCenters.push(centers[i]); continue;
                }

                let bestMedoid = null;
                let minTotalDist = Infinity;

                for (const candidate of clusterVils) {
                    let totalDist = 0;
                    for (const other of clusterVils) {
                        totalDist += getDistance(candidate, other);
                    }
                    if (totalDist < minTotalDist) {
                        minTotalDist = totalDist;
                        bestMedoid = candidate;
                    }
                }
                newCenters.push(bestMedoid);
                if (bestMedoid.key !== centers[i].key) changed = true; 
            }
            centers = newCenters;
            iterations++;
        }

        clusters.sort((a, b) => b.villages.length - a.villages.length);
        
        setResults(clusters);
        drawMap(clusters, villages);

        fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=maps").catch(()=>console.log("sayac hatasi"));
    };

    const drawMap = (clusters, allVillages) => {
        const canvas = canvasRef.current;
        if (!canvas || allVillages.length === 0) return;
        const ctx = canvas.getContext("2d");

        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height || 500;

        let minX = 999, minY = 999, maxX = 0, maxY = 0;
        allVillages.forEach(v => {
            if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
        });
        
        const padding = 20;
        minX -= padding; minY -= padding; maxX += padding; maxY += padding;
        const mapWidth = maxX - minX;
        const mapHeight = maxY - minY;
        const scale = Math.min(canvas.width / mapWidth, canvas.height / mapHeight);

        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        clusters.forEach(cluster => {
            const cx = (cluster.center.x - minX) * scale;
            const cy = (cluster.center.y - minY) * scale;

            cluster.villages.forEach(v => {
                if (v.key === cluster.center.key) return; 
                const vx = (v.x - minX) * scale;
                const vy = (v.y - minY) * scale;

                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(vx, vy);
                ctx.strokeStyle = cluster.color.replace(')', ', 0.3)').replace('hsl', 'hsla'); 
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });
        });

        clusters.forEach(cluster => {
            cluster.villages.forEach(v => {
                const vx = (v.x - minX) * scale;
                const vy = (v.y - minY) * scale;

                const isCenter = v.key === cluster.center.key;

                ctx.beginPath();
                ctx.arc(vx, vy, isCenter ? 7 : 3, 0, 2 * Math.PI);
                ctx.fillStyle = isCenter ? "#fff" : cluster.color;
                ctx.fill();

                if (isCenter) {
                    ctx.beginPath();
                    ctx.arc(vx, vy, 10, 0, 2 * Math.PI);
                    ctx.strokeStyle = cluster.color;
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    ctx.fillStyle = "#fff";
                    ctx.font = "bold 11px Arial";
                    ctx.textAlign = "center";
                    ctx.fillText(v.key, vx, vy - 15);
                }
            });
        });
    };

    return (
        <div className="cm-container">
            <h1 className="cm-header">{t('coinMinter.title')}</h1>
            
            <div className="cm-grid">
                <div>
                    <div className="cm-box">
                        <h3>{t('coinMinter.dataInput')}</h3>
                        <label className="cm-label">{t('coinMinter.allVillagesCoords')}</label>
                        <textarea 
                            className="cm-textarea" rows="8" 
                            placeholder={t('coinMinter.villagesPlaceholder')} 
                            value={villagesInput} onChange={e => setVillagesInput(e.target.value)}
                        />

                        <label className="cm-label">{t('coinMinter.hubCountLabel')}</label>
                        <input 
                            type="number" className="cm-input" min="1"
                            value={hubCount} onChange={e => setHubCount(e.target.value)}
                        />

                        <button className="cm-btn" onClick={calculateHubs}>{t('coinMinter.calculateBtn')}</button>
                    </div>

                    {results && (
                        <div>
                            <h3 style={{color: '#f0c042', marginBottom: '10px'}}>{t('coinMinter.resultsTitle').replace('{{count}}', results.length)}</h3>
                            {results.map((cluster, idx) => (
                                <div key={idx} className="hub-card" style={{borderColor: cluster.color}}>
                                    <div className="hub-card-header" style={{color: cluster.color}}>
                                        <span>{t('coinMinter.hubCardHeader')} {cluster.center.key}</span>
                                        <span style={{color: '#fff', fontSize: '12px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '10px'}}>
                                            {t('coinMinter.hubCardSub').replace('{{count}}', cluster.villages.length - 1)}
                                        </span>
                                    </div>
                                    <div className="hub-card-body">
                                        <b>{t('coinMinter.hubCardBody')}</b><br/>
                                        {cluster.villages.filter(v => v.key !== cluster.center.key).map((v, i) => (
                                            <span key={i} className="hub-village">{v.key}</span>
                                        ))}
                                        {cluster.villages.length === 1 && <i style={{color: '#777'}}>{t('coinMinter.onlySelf')}</i>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <div className="cm-canvas-container">
                        <canvas ref={canvasRef} style={{width: '100%', height: '100%', display: 'block'}}></canvas>
                        
                        {results && (
                            <div style={{position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '6px', border: '1px solid #333', fontSize: '12px', textAlign: 'left'}}>
                                <b>{t('coinMinter.mapInfoTitle')}</b><br/>
                                <span style={{color: '#fff'}}>{t('coinMinter.mapInfoCenter')}</span> {t('coinMinter.mapInfoCenterDesc')}<br/>
                                <span>{t('coinMinter.mapInfoSender')}</span> {t('coinMinter.mapInfoSenderDesc')}<br/>
                                <span>{t('coinMinter.mapInfoLines')}</span> {t('coinMinter.mapInfoLinesDesc')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoinMinter;