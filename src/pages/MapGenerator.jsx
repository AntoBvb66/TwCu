import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // YENİ: Çeviri motoru eklendi
import storage from '../utils/storage';
import './MapGenerator.css';

const getRandomColor = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

const hslToHex = (h, s, l) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
};

const decodeTW = (str) => {
    if (!str) return "";
    try {
        let decoded = decodeURIComponent(str);
        return decoded.replace(/\+/g, ' ');
    } catch (e) {
        return str.replace(/\+/g, ' ');
    }
};

const MapGenerator = () => {
    const { t } = useTranslation(); // YENİ: Çeviri kancası

    const [worldUrl, setWorldUrl] = useState(() => storage.get("mg_world_url", "https://ptc1.tribalwars.com.pt/"));
    const [status, setStatus] = useState("");
    
    const [settings, setSettings] = useState({
        zoom: 100, centerX: 500, centerY: 500, markersOnly: false, showAbandons: true,
        largerMarkers: false, bgColor: '#000000', dullBg: false, showGrid: true, showContinentNums: true
    });

    const [tribes, setTribes] = useState([]);
    const [tribeSearch, setTribeSearch] = useState("");

    const [players, setPlayers] = useState([]);
    const [playerSearchText, setPlayerSearchText] = useState("");
    const [playerSuggestions, setPlayerSuggestions] = useState([]);

    const mapData = useRef({ villages: [], playersDb: {}, tribesDb: {}, sortedPlayers: [] });
    const canvasRef = useRef(null);

    useEffect(() => { storage.set("mg_world_url", worldUrl); }, [worldUrl]);

    const fetchWithProxy = async (targetUrl) => {
        const myProxy = "https://tw-proxy.halimtttt10.workers.dev"; 
        const finalUrl = `${myProxy}/?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(finalUrl);
        if (!res.ok) throw new Error("Ağ Hatası");
        return await res.text();
    };

    const handleFetchData = async () => {
        const cleanUrl = worldUrl.replace(/\/$/, "");
        if (!cleanUrl) return alert(t('mapGenerator.status.noUrl'));

        const now = Date.now();
        const lastFetch = storage.get("mg_last_fetch", 0);
        const cachedData = storage.get("mg_cache_data", null);
        const lastFetchedUrl = storage.get("mg_last_url", "");

        if (cachedData && (lastFetchedUrl === cleanUrl) && (now - lastFetch < 3600000)) {
            setStatus(t('mapGenerator.status.cached').replace('{{time}}', new Date(lastFetch).toLocaleTimeString()));
            parseData(cachedData.ally, cachedData.player, cachedData.village);
            return;
        }

        setStatus(t('mapGenerator.status.fetching'));
        try {
            const [allyTxt, playerTxt, villageTxt] = await Promise.all([
                fetchWithProxy(`${cleanUrl}/map/ally.txt`),
                fetchWithProxy(`${cleanUrl}/map/player.txt`),
                fetchWithProxy(`${cleanUrl}/map/village.txt`)
            ]);

            storage.set("mg_last_fetch", now);
            storage.set("mg_last_url", cleanUrl);
            storage.set("mg_cache_data", { ally: allyTxt, player: playerTxt, village: villageTxt });
            
            setStatus(t('mapGenerator.status.success'));
            parseData(allyTxt, playerTxt, villageTxt);
        } catch (error) {
            setStatus(t('mapGenerator.status.error').replace('{{msg}}', error.message));
        }
    };

    const parseData = (allyTxt, playerTxt, villageTxt) => {
        const tribesDb = {};
        const parsedTribes = [];

        allyTxt.split("\n").forEach(line => {
            if (!line.trim()) return;
            const p = line.split(",");
            const id = parseInt(p[0]);
            if (!isNaN(id)) {
                const points = parseInt(p[5]) || 0;
                const tribeObj = { id, name: decodeTW(p[1]), tag: decodeTW(p[2]), points };
                tribesDb[id] = tribeObj;
                parsedTribes.push({ ...tribeObj, checked: false }); 
            }
        });

        const playersDb = {};
        const parsedPlayers = [];
        
        playerTxt.split("\n").forEach(line => {
            if (!line.trim()) return;
            const p = line.split(",");
            const id = parseInt(p[0]);
            if (!isNaN(id)) {
                const points = parseInt(p[4]) || 0; 
                const playerObj = { id, name: decodeTW(p[1]), tribeId: parseInt(p[2]), points };
                playersDb[id] = playerObj;
                parsedPlayers.push(playerObj);
            }
        });

        parsedPlayers.sort((a, b) => b.points - a.points);
        mapData.current.sortedPlayers = parsedPlayers;

        const villages = [];
        const tribeCenters = {};

        villageTxt.split("\n").forEach(line => {
            if (!line.trim()) return;
            const p = line.split(",");
            if (p.length >= 4) {
                const x = parseInt(p[2]);
                const y = parseInt(p[3]);
                const pid = parseInt(p[4]);
                villages.push({ x, y, pid });

                if (pid !== 0 && playersDb[pid]) {
                    const tid = playersDb[pid].tribeId;
                    if (tid) {
                        if (!tribeCenters[tid]) tribeCenters[tid] = { sumX: 0, sumY: 0, count: 0 };
                        tribeCenters[tid].sumX += x;
                        tribeCenters[tid].sumY += y;
                        tribeCenters[tid].count += 1;
                    }
                }
            }
        });

        parsedTribes.forEach(t => {
            let cx = 500, cy = 500; 
            if (tribeCenters[t.id] && tribeCenters[t.id].count > 0) {
                cx = tribeCenters[t.id].sumX / tribeCenters[t.id].count;
                cy = tribeCenters[t.id].sumY / tribeCenters[t.id].count;
            }
            t.angle = Math.atan2(cy - 500, cx - 500);
        });

        const angleSorted = [...parsedTribes].sort((a, b) => a.angle - b.angle);
        angleSorted.forEach((t, index) => { t.color = hslToHex((index * 137.508) % 360, 85, 55); });
        parsedTribes.sort((a, b) => b.points - a.points);
        
        setTribes(parsedTribes); 
        mapData.current.villages = villages;
        mapData.current.playersDb = playersDb;
        mapData.current.tribesDb = tribesDb;
    };

    const handlePlayerSearchText = (e) => {
        const value = e.target.value;
        setPlayerSearchText(value);

        if (value.length > 1) {
            const searchLower = value.toLocaleLowerCase('tr-TR');
            const results = mapData.current.sortedPlayers
                .filter(p => p.name.toLocaleLowerCase('tr-TR').includes(searchLower))
                .slice(0, 8); 
            setPlayerSuggestions(results);
        } else {
            setPlayerSuggestions([]);
        }
    };

    const selectPlayerSuggestion = (player) => {
        if (!players.find(p => p.id === player.id)) {
            setPlayers([{ ...player, color: getRandomColor() }, ...players]);
        }
        setPlayerSearchText("");
        setPlayerSuggestions([]);
    };

    const selectTopPlayers = (count) => {
        const top = mapData.current.sortedPlayers.slice(0, count);
        const newPlayers = top.map((p, index) => ({
            ...p,
            color: hslToHex((index * 137.508) % 360, 85, 65) 
        }));
        setPlayers(newPlayers);
    };

    const removePlayer = (id) => setPlayers(players.filter(p => p.id !== id));
    const updatePlayerColor = (id, color) => setPlayers(players.map(p => p.id === id ? { ...p, color } : p));

    const updateTribe = (id, field, value) => setTribes(tribes.map(t => t.id === id ? { ...t, [field]: value } : t));
    const removeTribe = (id) => setTribes(tribes.filter(t => t.id !== id));
    const handleSelectAllTribes = (status) => setTribes(tribes.map(t => ({ ...t, checked: status })));
    const handleSelectTop25Tribes = () => setTribes(tribes.map((t, index) => ({ ...t, checked: index < 25 })));

    const filteredTribes = tribes.filter(t => {
        const searchLower = tribeSearch.toLocaleLowerCase('tr-TR');
        return t.name.toLocaleLowerCase('tr-TR').includes(searchLower) || t.tag.toLocaleLowerCase('tr-TR').includes(searchLower);
    });

    const generateMap = () => {
        fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=maps").catch(() => {});
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const { villages, playersDb } = mapData.current;
        const { zoom, centerX, centerY, bgColor, showGrid, showContinentNums, showAbandons, largerMarkers, dullBg, markersOnly } = settings;
        
        const width = canvas.width; const height = canvas.height;
        ctx.fillStyle = bgColor; ctx.fillRect(0, 0, width, height);

        const scale = zoom / 100;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-centerX, -centerY);

        if (showGrid) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.2)"; ctx.lineWidth = 1 / scale;
            for (let i = 0; i <= 1000; i += 100) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1000); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1000, i); ctx.stroke();
            }
        }
        if (showContinentNums) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.4)"; ctx.font = `${20 / scale}px Arial`;
            for (let x = 0; x < 1000; x += 100) {
                for (let y = 0; y < 1000; y += 100) {
                    ctx.fillText(`K${Math.floor(y/100)*10 + Math.floor(x/100)}`, x + 5, y + (25 / scale));
                }
            }
        }

        const playerColors = {};
        players.forEach(p => { if(p.name) playerColors[p.name.toLocaleLowerCase('tr-TR')] = p.color; });
        
        const tribeColors = {};
        const tribeTags = {}; 
        tribes.forEach(tObj => { 
            if(tObj.checked) { tribeColors[tObj.id] = tObj.color; tribeTags[tObj.id] = tObj.tag; }
        });

        const markerSize = largerMarkers ? 3.5 / scale : 2 / scale;
        const tribeCentersMap = {};
        const playerCentersMap = {};

        villages.forEach(v => {
            let color = null;
            if (v.pid === 0) {
                if (showAbandons) color = "#aaaaaa";
            } else {
                const player = playersDb[v.pid];
                if (player) {
                    const pNameLower = player.name.toLocaleLowerCase('tr-TR');
                    
                    if (playerColors[pNameLower]) {
                        color = playerColors[pNameLower];
                        if (!playerCentersMap[pNameLower]) playerCentersMap[pNameLower] = { x: 0, y: 0, count: 0, name: player.name, color: color };
                        playerCentersMap[pNameLower].x += v.x;
                        playerCentersMap[pNameLower].y += v.y;
                        playerCentersMap[pNameLower].count += 1;
                    } 
                    else if (tribeColors[player.tribeId]) {
                        color = tribeColors[player.tribeId];
                        if (!tribeCentersMap[player.tribeId]) tribeCentersMap[player.tribeId] = { x: 0, y: 0, count: 0, tag: tribeTags[player.tribeId], color: color };
                        tribeCentersMap[player.tribeId].x += v.x;
                        tribeCentersMap[player.tribeId].y += v.y;
                        tribeCentersMap[player.tribeId].count += 1;
                    } 
                    else if (!markersOnly) {
                        color = dullBg ? "#444444" : "#880000";
                    }
                }
            }
            if (color) { ctx.fillStyle = color; ctx.fillRect(v.x, v.y, markerSize, markerSize); }
        });

        // === AKILLI ÇARPIŞMA ÖNLEYİCİ (COLLISION DETECTION) ===
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${16 / scale}px Arial`; 
        ctx.lineWidth = 4 / scale; 
        ctx.strokeStyle = "rgba(0, 0, 0, 0.9)"; 
        
        const labelsToDraw = [];
        
        Object.values(tribeCentersMap).forEach(tc => {
            labelsToDraw.push({ text: tc.tag, x: tc.x / tc.count, y: tc.y / tc.count, color: tc.color });
        });
        Object.values(playerCentersMap).forEach(pc => {
            labelsToDraw.push({ text: pc.name, x: pc.x / pc.count, y: pc.y / pc.count, color: pc.color });
        });

        const drawnBoxes = [];

        labelsToDraw.forEach(label => {
            const tWidth = ctx.measureText(label.text).width;
            const tHeight = 16 / scale; 
            
            let lx = label.x;
            let ly = label.y - (14 / scale); 
            
            let box = { x: lx - tWidth/2 - 2, y: ly - tHeight/2 - 2, w: tWidth + 4, h: tHeight + 4 };
            
            let shiftRadius = 0;
            let angle = 0;
            
            while(drawnBoxes.some(b => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y) && shiftRadius < (150/scale)) {
                shiftRadius += 4 / scale; 
                angle += 0.8; 
                
                lx = label.x + Math.cos(angle) * shiftRadius;
                ly = (label.y - (14 / scale)) + Math.sin(angle) * shiftRadius;
                box = { x: lx - tWidth/2 - 2, y: ly - tHeight/2 - 2, w: tWidth + 4, h: tHeight + 4 };
            }

            drawnBoxes.push(box); 

            ctx.strokeText(label.text, lx, ly);
            ctx.fillStyle = label.color;
            ctx.fillText(label.text, lx, ly);
        });

        ctx.restore();
        
        fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=maps").catch(()=>console.log("sayac hatasi"));
    };

    return (
        <div className="map-gen-container">
            <h1 className="map-gen-header">{t('mapGenerator.title')}</h1>
            
            <div className="mg-box" style={{display:'flex', gap:'10px', alignItems:'center'}}>
                <label>{t('mapGenerator.worldUrl')}</label>
                <input type="text" className="mg-input" value={worldUrl} onChange={e => setWorldUrl(e.target.value)} style={{width:'400px'}} />
                <button className="mg-btn" style={{width:'auto'}} onClick={handleFetchData}>{t('mapGenerator.fetchBtn')}</button>
                <span style={{fontSize:'12px', color:'#aaa'}}>{status}</span>
            </div>

            <div className="map-gen-grid">
                <div>
                    <div className="mg-box">
                        <h3>{t('mapGenerator.settings.title')}</h3>
                        <table className="mg-table">
                            <tbody>
                                <tr>
                                    <td style={{width:'55%'}}>{t('mapGenerator.settings.zoom')}</td>
                                    <td><input type="number" step="50" className="mg-input mg-input-small" value={settings.zoom} onChange={e => setSettings({...settings, zoom: e.target.value})} /> %</td>
                                </tr>
                                <tr>
                                    <td>{t('mapGenerator.settings.center')}</td>
                                    <td>
                                        <input type="number" className="mg-input mg-input-small" value={settings.centerX} onChange={e => setSettings({...settings, centerX: e.target.value})} /> | 
                                        <input type="number" className="mg-input mg-input-small" value={settings.centerY} onChange={e => setSettings({...settings, centerY: e.target.value})} />
                                    </td>
                                </tr>
                                <tr><td>{t('mapGenerator.settings.markersOnly')}</td><td><input type="checkbox" checked={settings.markersOnly} onChange={e => setSettings({...settings, markersOnly: e.target.checked})} /></td></tr>
                                <tr><td>{t('mapGenerator.settings.showAbandons')}</td><td><input type="checkbox" checked={settings.showAbandons} onChange={e => setSettings({...settings, showAbandons: e.target.checked})} /></td></tr>
                                <tr><td>{t('mapGenerator.settings.largerMarkers')}</td><td><input type="checkbox" checked={settings.largerMarkers} onChange={e => setSettings({...settings, largerMarkers: e.target.checked})} /></td></tr>
                                <tr><td>{t('mapGenerator.settings.bgColor')}</td><td><input type="color" className="mg-color" value={settings.bgColor} onChange={e => setSettings({...settings, bgColor: e.target.value})} /></td></tr>
                                <tr><td>{t('mapGenerator.settings.dullBg')}</td><td><input type="checkbox" checked={settings.dullBg} onChange={e => setSettings({...settings, dullBg: e.target.checked})} /></td></tr>
                                <tr><td>{t('mapGenerator.settings.showGrid')}</td><td><input type="checkbox" checked={settings.showGrid} onChange={e => setSettings({...settings, showGrid: e.target.checked})} /></td></tr>
                                <tr><td>{t('mapGenerator.settings.showContinentNums')}</td><td><input type="checkbox" checked={settings.showContinentNums} onChange={e => setSettings({...settings, showContinentNums: e.target.checked})} /></td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="mg-box">
                        <h3>{t('mapGenerator.players.title')}</h3>
                        
                        <div style={{position:'relative', marginBottom: '10px'}}>
                            <input 
                                type="text" className="mg-input" 
                                placeholder={t('mapGenerator.players.searchPlaceholder')} 
                                value={playerSearchText} 
                                onChange={handlePlayerSearchText} 
                                onFocus={(e) => handlePlayerSearchText(e)} 
                                onBlur={() => setTimeout(() => setPlayerSuggestions([]), 200)} 
                            />
                            {playerSuggestions.length > 0 && (
                                <ul className="autocomplete-list">
                                    {playerSuggestions.map(sug => (
                                        <li key={sug.id} onMouseDown={() => selectPlayerSuggestion(sug)}>
                                            {sug.name} <span style={{color:'#777', fontSize:'11px'}}>({sug.points.toLocaleString()} {t('mapGenerator.players.points')})</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="tribe-controls">
                            <button className="mg-btn" onClick={() => selectTopPlayers(25)}>{t('mapGenerator.players.selectTop25')}</button>
                            <button className="mg-btn" onClick={() => selectTopPlayers(50)}>{t('mapGenerator.players.selectTop50')}</button>
                            <button className="mg-btn" onClick={() => setPlayers([])} style={{gridColumn: '1 / 3'}}>{t('mapGenerator.players.clearSelection')}</button>
                        </div>

                        <div className="tribe-list" style={{marginTop:'10px'}}>
                            {players.length === 0 ? <div style={{padding:'5px', color:'#aaa', fontSize:'12px'}}>{t('mapGenerator.players.noPlayers')}</div> : null}
                            {players.map((p, index) => (
                                <div key={p.id} className="tribe-item">
                                    <span style={{color:'#777', width:'25px'}}>{index + 1}.</span>
                                    <input type="color" className="mg-color" value={p.color} onChange={e => updatePlayerColor(p.id, e.target.value)} />
                                    <span style={{flexGrow: 1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={p.name}>
                                        {p.name}
                                    </span>
                                    <button className="mg-btn-danger" onClick={() => removePlayer(p.id)}>{t('mapGenerator.players.deleteBtn')}</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mg-box">
                        <h3>{t('mapGenerator.tribes.title')}</h3>
                        
                        <input type="text" className="mg-input" placeholder={t('mapGenerator.tribes.searchPlaceholder')} value={tribeSearch} onChange={e => setTribeSearch(e.target.value)} style={{marginBottom: '10px'}} />
                        
                        <div className="tribe-controls">
                            <button className="mg-btn" onClick={() => handleSelectAllTribes(true)}>{t('mapGenerator.tribes.selectAll')}</button>
                            <button className="mg-btn" onClick={() => handleSelectAllTribes(false)}>{t('mapGenerator.tribes.clearSelection')}</button>
                            <button className="mg-btn" onClick={handleSelectTop25Tribes} style={{gridColumn: '1 / 3'}}>{t('mapGenerator.tribes.selectTop25')}</button>
                        </div>

                        <div className="tribe-list">
                            {tribes.length === 0 ? <div style={{padding:'10px', color:'#aaa'}}>{t('mapGenerator.tribes.noData')}</div> : null}
                            {filteredTribes.map((tObj, index) => (
                                <div key={tObj.id} className="tribe-item">
                                    <span style={{color:'#777', width:'25px'}}>{index + 1}.</span>
                                    <input type="checkbox" checked={tObj.checked} onChange={e => updateTribe(tObj.id, 'checked', e.target.checked)} />
                                    <input type="color" className="mg-color" value={tObj.color} onChange={e => updateTribe(tObj.id, 'color', e.target.value)} />
                                    <span className="tribe-tag">[{tObj.tag}]</span>
                                    <span style={{flexGrow: 1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={tObj.name}>{tObj.name}</span>
                                    <button className="mg-btn-danger" onClick={() => removeTribe(tObj.id)}>{t('mapGenerator.tribes.deleteBtn')}</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button className="mg-btn" onClick={generateMap} style={{height:'50px', fontSize:'16px'}}>{t('mapGenerator.generateBtn')}</button>
                </div>

                <div>
                    <div className="mg-canvas-container">
                        <canvas ref={canvasRef} width="1000" height="1000" style={{maxWidth:'100%', height:'auto', display:'block'}}></canvas>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MapGenerator;