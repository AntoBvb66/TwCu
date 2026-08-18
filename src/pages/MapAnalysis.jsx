import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import storage from '../utils/storage';
import {
    fetchWorldData,
    extractWorldId,
    cleanWorldUrl,
    decodeTW,
    bumpStat,
    getCacheTime,
} from '../utils/twApi';
import './MapAnalysis.css';

const calculateContinent = (x, y) => Math.floor(y / 100) * 10 + Math.floor(x / 100);

/** Manuel yapıştırılan CSV metnini API'nin satır formatına çevirir. */
const textToRows = (txt) =>
    (txt || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(','));


const MapAnalysis = () => {
    const { t } = useTranslation();

    const [worldUrl, setWorldUrl] = useState(() => storage.get("lastWorldUrl", "https://ptc1.tribalwars.com.pt/"));
    const [status, setStatus] = useState({ type: 'empty', msg: t('mapAnalysis.status.waiting') });
    
    const [allyTxt, setAllyTxt] = useState('');
    const [playerTxt, setPlayerTxt] = useState('');
    const [villageTxt, setVillageTxt] = useState('');

    // YENİ: Işınlanmaları geçmişe dönük saklamak için state
    const [teleports, setTeleports] = useState(() => storage.get("tw_all_teleports_history", []));
    
    const [continentData, setContinentData] = useState({});
    const [timeDiffMsg, setTimeDiffMsg] = useState('');
    const [isMapVisible, setIsMapVisible] = useState(false);

    const rawData = useRef({ players: {}, allies: {}, villages: {}, isLoaded: false });
    const canvasRef = useRef(null);

    const [clickCount, setClickCount] = useState(0);
    const [bypassMode, setBypassMode] = useState(() => storage.get("tw_secret_bypass", false));

    const handleSecretClick = () => {
        setClickCount(prev => prev + 1);
        if (clickCount + 1 >= 13) {
            const newMode = !bypassMode;
            setBypassMode(newMode);
            storage.set("tw_secret_bypass", newMode);
            setClickCount(0); 
            alert(newMode ? t('mapAnalysis.bypassAlertOn') : t('mapAnalysis.bypassAlertOff'));
        }
    };

    useEffect(() => { storage.set("lastWorldUrl", worldUrl); }, [worldUrl]);
    
    // Teleportlar güncellendiğinde storage'a kaydet (Geçmişi Unutmamak İçin)
    useEffect(() => { storage.set("tw_all_teleports_history", teleports); }, [teleports]);

    useEffect(() => {
        if(status.type === 'empty') {
            setStatus({ type: 'empty', msg: t('mapAnalysis.status.waiting') });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t]);

    const handleAutoFetch = async () => {
        bumpStat('maps');
        const cleanUrl = cleanWorldUrl(worldUrl);
        if (!cleanUrl) return alert(t('mapAnalysis.enterWorldUrl'));

        const worldId = extractWorldId(cleanUrl);
        if (!worldId) return alert(t('common.invalidWorldUrl'));

        setStatus({ type: 'loading', msg: t('mapAnalysis.status.downloading') });

        try {
            // Merkezî veri katmanı: önbellek, ngrok başlığı ve hata yönetimi tek yerde.
            const { ally, player, village, fetchedAt, fromCache } = await fetchWorldData(cleanUrl, {
                villages: true,
                force: bypassMode,
            });

            if (!village || village.length === 0) {
                throw new Error(t('common.worldEmpty'));
            }

            storage.set('tw_last_fetch_time', fetchedAt);

            // Manuel metin kutuları geriye dönük çalışsın diye satırları CSV'ye yansıtıyoruz.
            setAllyTxt(ally.map((r) => r.join(',')).join('\n'));
            setPlayerTxt(player.map((r) => r.join(',')).join('\n'));
            setVillageTxt(village.map((r) => r.join(',')).join('\n'));

            if (fromCache) {
                setStatus({
                    type: 'ready',
                    msg: t('mapAnalysis.status.cached').replace(
                        '{{time}}',
                        new Date(fetchedAt).toLocaleTimeString()
                    ),
                });
            } else {
                setStatus({ type: 'loading', msg: t('mapAnalysis.status.analyzing') });
            }

            // Ağır işi bir sonraki kareye bırak ki arayüz donmasın.
            setTimeout(() => processRows(ally, player, village, fromCache), 0);
        } catch (error) {
            setStatus({ type: 'empty', msg: t('mapAnalysis.status.errorShort') });
            const msg =
                error.message === 'INVALID_WORLD_URL' ? t('common.invalidWorldUrl')
                : error.message === 'WORLD_EMPTY' ? t('common.worldEmpty')
                : error.message;
            alert(t('mapAnalysis.fetchError').replace('{{error}}', msg));
        }
    };

    /** Manuel yapıştırılan metni işler (satırlara çevirip aynı motora verir). */
    const processData = (aTxt = allyTxt, pTxt = playerTxt, vTxt = villageTxt, isFromCache = false) => {
        if (!vTxt.trim()) return setStatus({ type: 'empty', msg: t('mapAnalysis.status.empty') });
        return processRows(textToRows(aTxt), textToRows(pTxt), textToRows(vTxt), isFromCache);
    };

    const processRows = (allyRows = [], playerRows = [], villageRows = [], isFromCache = false) => {
        if (!villageRows.length) return setStatus({ type: 'empty', msg: t('mapAnalysis.status.empty') });

        const ALLIES = {}, PLAYERS = {};
        const now = Date.now();
        const lastActualFetch = getCacheTime(worldUrl) || storage.get("tw_last_fetch_time", now);

        let timeMsg = isFromCache 
            ? t('mapAnalysis.timeMsg.cached').replace('{{time}}', new Date(lastActualFetch).toLocaleTimeString())
            : t('mapAnalysis.timeMsg.new');
        
        if (!isFromCache && storage.get("tw_villages_db", null)) {
            const diffMs = now - storage.get("tw_previous_fetch_time", lastActualFetch);
            const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            timeMsg = t('mapAnalysis.timeMsg.diff').replace('{{hours}}', diffHrs).replace('{{mins}}', diffMins);
            storage.set("tw_previous_fetch_time", now); 
        }
        setTimeDiffMsg(timeMsg);

        allyRows.forEach(parts => {
            const id = parseInt(parts[0]);
            if (!isNaN(id)) ALLIES[id] = { id, name: decodeTW(parts[1]), tag: decodeTW(parts[2]) };
        });

        playerRows.forEach(parts => {
            const id = parseInt(parts[0]);
            const allyId = parseInt(parts[2]) || 0;
            if (!isNaN(id)) PLAYERS[id] = { id, name: decodeTW(parts[1]), allyId, allyTag: ALLIES[allyId] ? ALLIES[allyId].tag : "—" };
        });

        const newVillages = {}, contData = {};
        let newFoundTeleports = [];
        const oldVillages = storage.get("tw_villages_db", {});

        villageRows.forEach(p => {
            if (p.length < 4) return;
            const id = p[0], name = decodeTW(p[1]), x = parseInt(p[2]), y = parseInt(p[3]), pid = parseInt(p[4]);
            if (isNaN(x) || isNaN(y) || isNaN(pid)) return;

            const cont = calculateContinent(x, y);
            const player = PLAYERS[pid] || { name: t('mapAnalysis.barbarian'), allyTag: "—", allyId: 0 };

            newVillages[id] = { id, name, x, y, playerId: pid, playerName: player.name, continent: cont };

            if (!contData[cont]) contData[cont] = { players: new Set(), barbars: 0, tribes: {} };
            pid === 0 ? contData[cont].barbars++ : contData[cont].players.add(pid);
            const tag = player.allyId ? player.allyTag : t('mapAnalysis.analysis.noTribe');
            contData[cont].tribes[tag] = (contData[cont].tribes[tag] || 0) + 1;

            // IŞINLANMA TESPİTİ
            if (!isFromCache) {
                const old = oldVillages[id];
                if (old && (old.x !== x || old.y !== y)) {
                    const oldC = calculateContinent(old.x, old.y);
                    newFoundTeleports.push({ 
                        id: Date.now() + Math.random(), // Benzersiz ID
                        date: new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' }), // Tespit Tarihi ve Saati
                        player: player.name, tag: player.allyTag, 
                        oldX: old.x, oldY: old.y, newX: x, newY: y, oldC, newC: cont 
                    });
                }
            }
        });

        if (!isFromCache) {
            const toStore = {};
            Object.keys(newVillages).forEach(id => toStore[id] = { x: newVillages[id].x, y: newVillages[id].y });
            storage.set("tw_villages_db", toStore);
            
            // Eğer yeni ışınlanan bulunduysa, ESKİ ışınlananların ÜSTÜNE Ekle (Geçmişi koru)
            if (newFoundTeleports.length > 0) {
                setTeleports(prevTeleports => {
                    const updatedHistory = [...newFoundTeleports, ...prevTeleports];
                    return updatedHistory;
                });
            }
        } 

        rawData.current = { players: PLAYERS, allies: ALLIES, villages: newVillages, isLoaded: true };
        setContinentData(contData);
        setStatus({ type: 'ready', msg: t('mapAnalysis.status.success').replace('{{villages}}', Object.keys(newVillages).length).replace('{{players}}', Object.keys(PLAYERS).length) });
    };

    const drawMap = (teleportList) => {
        setIsMapVisible(true);
        setTimeout(() => {
            const canvas = canvasRef.current;
            if(!canvas) return;
            const ctx = canvas.getContext("2d");
            
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = "#e0e0e0";
            ctx.lineWidth = 1;
            for(let i = 0; i <= 1000; i += 100) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1000); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1000, i); ctx.stroke();
                if (i < 1000) {
                    ctx.fillStyle = "#eeeeee"; ctx.font = "20px Arial";
                    ctx.fillText(`K${Math.floor(i/100)}`, i + 5, 25);
                    ctx.fillText(`K${Math.floor(i/100)*10}`, 5, i + 25);
                }
            }

            teleportList.forEach(t => {
                ctx.strokeStyle = "rgba(0, 0, 0, 0.4)"; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
                ctx.beginPath(); ctx.moveTo(t.oldX, t.oldY); ctx.lineTo(t.newX, t.newY); ctx.stroke(); ctx.setLineDash([]);

                ctx.fillStyle = "gray"; ctx.beginPath(); ctx.arc(t.oldX, t.oldY, 6, 0, Math.PI * 2); ctx.fill();
                ctx.strokeText(`${t.oldX}|${t.oldY}`, t.oldX + 8, t.oldY - 5);

                ctx.fillStyle = "red"; ctx.beginPath(); ctx.arc(t.newX, t.newY, 8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = "black"; ctx.font = "bold 12px Arial";
                ctx.fillText(`${t.newX}|${t.newY}`, t.newX + 10, t.newY + 10);
                
                if (teleportList.length === 1) ctx.fillText(t.player, t.newX + 10, t.newY - 10);
            });
            canvas.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleClearData = () => {
        if(window.confirm(t('mapAnalysis.clearConfirm'))) {
            storage.remove("tw_villages_db"); storage.remove("tw_last_fetch_time"); 
            storage.remove("tw_cache_data"); storage.remove("tw_all_teleports_history");
            setTeleports([]); setContinentData({}); setTimeDiffMsg('');
            setAllyTxt(''); setPlayerTxt(''); setVillageTxt('');
            rawData.current = { players: {}, allies: {}, villages: {}, isLoaded: false };
            setStatus({ type: 'empty', msg: t('mapAnalysis.status.cleared') });
        }
    };

    // Teleportları Kıtaya (K) Göre Grupla
    const groupedTeleports = teleports.reduce((acc, t) => {
        if (!acc[t.newC]) acc[t.newC] = [];
        acc[t.newC].push(t);
        return acc;
    }, {});

    return (
        <div className="map-analysis-container">
            <h1 onClick={handleSecretClick} style={{cursor: 'pointer', userSelect: 'none'}}>
                {t('mapAnalysis.title')} 
                {bypassMode && <span style={{fontSize:'14px', color:'red', marginLeft:'10px'}}>{t('mapAnalysis.bypassActive')}</span>}
            </h1>
            
            <div className={`ma-status status-${status.type}`}>{status.msg}</div>

            <div className="ma-grid">
                <div>
                    <h3>{t('mapAnalysis.sections.autoFetch')}</h3>
                    <div className="ma-box">
                        <label style={{fontSize: '12px', color: 'var(--text-2)'}}>{t('mapAnalysis.sections.worldUrlLabel')}</label>
                        <input type="text" className="ma-input" value={worldUrl} onChange={e => setWorldUrl(e.target.value)} />
                        <button className="ma-btn ma-btn-primary" onClick={handleAutoFetch}>{t('mapAnalysis.sections.downloadBtn')}</button>
                    </div>
                </div>

                <div>
                    <h3>{t('mapAnalysis.sections.manual')}</h3>
                    <div className="ma-box">
                        <textarea className="ma-textarea" placeholder="ally.txt..." value={allyTxt} onChange={e => setAllyTxt(e.target.value)} />
                        <textarea className="ma-textarea" placeholder="player.txt..." value={playerTxt} onChange={e => setPlayerTxt(e.target.value)} />
                        <textarea className="ma-textarea" placeholder="village.txt..." value={villageTxt} onChange={e => setVillageTxt(e.target.value)} />
                        <button className="ma-btn" onClick={() => processData(allyTxt, playerTxt, villageTxt, false)}>{t('mapAnalysis.sections.processManualBtn')}</button>
                    </div>
                </div>
            </div>

            <div style={{textAlign: 'right', marginTop: '10px'}}>
                <button className="ma-btn ma-btn-danger" style={{width: 'auto'}} onClick={handleClearData}>{t('mapAnalysis.sections.clearStorageBtn')}</button>
            </div>

            {rawData.current.isLoaded && (
                <div style={{marginTop: '30px'}}>
                    
                    {/* === GEÇMİŞİ UNUTMAYAN IŞINLANMA LİSTESİ === */}
                    <h3>{t('mapAnalysis.teleports.title').replace('{{count}}', teleports.length)}</h3>
                    <div className="ma-box">
                        <div className="teleport-time">⏳ {timeDiffMsg}</div>
                        <p style={{fontSize: '11px', color: 'var(--text-2)', marginTop: '-5px', marginBottom: '15px'}}>
        {t('mapAnalysis.teleports.info')}
    </p>
                        
                        {teleports.length > 0 ? (
                            <>
                                <button className="ma-btn ma-btn-primary" onClick={() => drawMap(teleports)}>{t('mapAnalysis.teleports.showAllBtn')}</button>
                                
                                {Object.keys(groupedTeleports).sort((a,b)=>a-b).map(c => (
                                    <div key={c} style={{marginTop: '15px'}}>
                                        <h4 style={{color: 'var(--gold)', margin:'5px 0', borderBottom: '1px dashed var(--line)'}}>
                                            {t('mapAnalysis.teleports.continentTitle').replace('{{cont}}', c).replace('{{count}}', groupedTeleports[c].length)}
                                        </h4>
                                        <ul className="teleport-list">
                                            {groupedTeleports[c].map((tObj) => (
                                                <li key={tObj.id} className="teleport-item">
                                                    <div>
                                                        <b>{tObj.player}</b> <span style={{color: 'var(--gold)'}}>[{tObj.tag}]</span> 
                                                        <span style={{fontSize: '10px', color: 'var(--text-3)', marginLeft: '10px'}}>
        {t('mapAnalysis.teleports.datePrefix')} {tObj.date}
    </span><br/>
                                                        
                                                        <span style={{color: 'var(--text-2)', fontSize:'11px'}}>{t('mapAnalysis.teleports.old')} ({tObj.oldX}|{tObj.oldY}) K{tObj.oldC}</span> ➔ <b style={{color: 'var(--danger)'}}>{t('mapAnalysis.teleports.new')} ({tObj.newX}|{tObj.newY})</b>
                                                    </div>
                                                    <button className="ma-btn" style={{width:'auto', padding:'4px 8px', fontSize:'11px'}} onClick={() => drawMap([tObj])}>{t('mapAnalysis.teleports.showBtn')}</button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <p style={{color: 'var(--text-2)'}}>{t('mapAnalysis.teleports.none')}</p>
                        )}
                    </div>

                    {/* === OYUNCU BAŞINA BARBAR KATSAYISI === */}
                    <h3>{t('mapAnalysis.analysis.title')}</h3>
                    <div className="ma-grid">
                        {Object.keys(continentData).sort((a,b)=>a-b).map(c => {
                            const pCount = continentData[c].players.size || 1; // 0'a bölme hatasını önlemek için
                            const bCount = continentData[c].barbars;
                            const farmRatio = (bCount / pCount).toFixed(1); // Oyuncu başına barbar
                            
                            const tribes = Object.entries(continentData[c].tribes).sort((a,b)=>b[1]-a[1]).slice(0, 5);
                            return (
                                <div key={c} className="ma-box" style={{margin:0}}>
                                    <h3 style={{margin:0, border:'none'}}>K{c}</h3>
                                    <div style={{fontSize:'13px', color: 'var(--text-2)', marginBottom:'10px', paddingBottom: '10px', borderBottom: '1px solid var(--line)'}}>
                                        <b>{t('mapAnalysis.analysis.player')}:</b> <span style={{color: 'var(--text)'}}>{continentData[c].players.size}</span> | <b>{t('mapAnalysis.analysis.barbarian')}:</b> <span style={{color: 'var(--text)'}}>{bCount}</span>
                                        <br/>
                                        <span style={{color: farmRatio > 20 ? 'var(--success)' : 'var(--danger)', fontSize: '11px'}}>
        {t('mapAnalysis.analysis.farmRatio')} <b>{farmRatio}</b>
    </span>
                                    </div>
                                    <ul style={{margin:0, paddingLeft:'20px'}}>
                                        {tribes.map(([tribeTag, count]) => <li key={tribeTag} style={{fontSize: '13px'}}><b style={{color: 'var(--gold)'}}>{tribeTag}</b>: {count} {t('mapAnalysis.analysis.villages')}</li>)}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {isMapVisible && (
                <div style={{marginTop: '30px', textAlign: 'center', background: 'var(--ink-850)', padding: '10px', borderRadius: '8px', border: '2px solid var(--line)'}}>
                    <h3 style={{color: 'var(--text-2)', borderBottom: '1px solid var(--line-2)', margin: '0 0 10px 0'}}>{t('mapAnalysis.map.title')}</h3>
                    <p style={{color: 'var(--text-3)', fontSize: '12px', marginBottom: '10px'}}>
                        <b>{t('mapAnalysis.map.gray')}</b> {t('mapAnalysis.map.oldPos')} &nbsp;|&nbsp; <b style={{color:'red'}}>{t('mapAnalysis.map.red')}</b> {t('mapAnalysis.map.newPos')}
                    </p>
                    <canvas ref={canvasRef} width="1000" height="1000" style={{border: '1px solid var(--line-2)', width: '100%', maxWidth: '600px'}}></canvas>
                    <button className="ma-btn ma-btn-danger" style={{marginTop: '10px'}} onClick={() => setIsMapVisible(false)}>{t('mapAnalysis.map.closeBtn')}</button>
                </div>
            )}
        </div>
    );
};

export default MapAnalysis;