import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next'; // YENİ: Çeviri motoru eklendi
import storage from '../utils/storage';
import './ClanOpPlanner.css'; 

const formatToLocalISO = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - offset)).toISOString().slice(0, 19);
};

const formatCustomStr = (dateObj) => {
    return dateObj.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit' });
};

// Birim İkonları
const unitIcons = {
    spear: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_spear.webp',
    sword: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_sword.webp',
    archer: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_archer.webp',
    spy: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_spy.webp',
    heavy: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_heavy.webp',
    catapult: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_catapult.webp',
    knight: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_knight.webp'
};

const defaultUnitSpeeds = { spear: 18, sword: 22, archer: 18, spy: 9, heavy: 11, catapult: 30, knight: 10 };

const FastSupport = () => {
    const { t } = useTranslation();

    // 1. TEMEL AYARLAR
    const [worldUrl, setWorldUrl] = useState(() => storage.get("fs_world_url", "https://ptc1.tribalwars.com.pt/"));
    const [clanTag, setClanTag] = useState(() => storage.get("fs_clan_tag", ""));
    const [targetInput, setTargetInput] = useState(() => storage.get("fs_target", ""));
    const [selectedUnit, setSelectedUnit] = useState(() => storage.get("fs_unit", "sword"));
    const [selectedDateTime, setSelectedDateTime] = useState(() => storage.get("fs_datetime", formatToLocalISO(new Date())));
    const [selectedPlayer, setSelectedPlayer] = useState("");
    const [status, setStatus] = useState("");
    const [worldClans, setWorldClans] = useState([]);

    // 2. VERİTABANI
    const [clanPlayers, setClanPlayers] = useState(() => storage.get("fs_cache_players", {})); 
    const [clanVillages, setClanVillages] = useState(() => storage.get("fs_cache_cVils", [])); 
    const [allVillages, setAllVillages] = useState(() => storage.get("fs_cache_allVils", [])); // YENİ: ID tespiti için tüm köyleri önbelleğe aldık

    const canvasRef = useRef(null);

    useEffect(() => {
        storage.set("fs_world_url", worldUrl); storage.set("fs_clan_tag", clanTag);
        storage.set("fs_target", targetInput); storage.set("fs_unit", selectedUnit);
        storage.set("fs_datetime", selectedDateTime);
    }, [worldUrl, clanTag, targetInput, selectedUnit, selectedDateTime]);

    const fetchWithProxy = async (targetUrl) => {
        const res = await fetch(`https://tw-proxy.halimtttt10.workers.dev/?url=${encodeURIComponent(targetUrl)}`);
        if (!res.ok) throw new Error("Veri çekilemedi.");
        return await res.text();
    };

    const loadWorldClans = async () => {
        if (!worldUrl || worldUrl.length < 10) return;
        try {
            const cleanUrl = worldUrl.replace(/\/$/, "");
            const allyData = await fetchWithProxy(`${cleanUrl}/map/ally.txt`);
            const clans = [];
            allyData.split("\n").forEach(line => {
                const p = line.split(",");
                if (p.length >= 3) {
                    clans.push({
                        id: p[0],
                        name: decodeURIComponent(p[1]).replace(/\+/g, ' '),
                        tag: decodeURIComponent(p[2]).replace(/\+/g, ' ')
                    });
                }
            });
            setWorldClans(clans);
        } catch (err) {
            console.log("Klan listesi arka planda çekilemedi.");
        }
    };

    useEffect(() => {
        if (worldUrl) loadWorldClans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleFetchClan = async () => {
        if (!clanTag) return alert(t('fastSupport.alerts.enterClanTag'));
        setStatus(t('fastSupport.step1.status.scanning'));
        
        try {
            const cleanUrl = worldUrl.replace(/\/$/, "");
            const allyData = await fetchWithProxy(`${cleanUrl}/map/ally.txt`);
            let clanId = null;
            const searchTag = clanTag.toLocaleLowerCase('tr-TR').replace(/\+/g, ' ');
            
            allyData.split("\n").forEach(line => {
                const p = line.split(",");
                if (p.length >= 3 && decodeURIComponent(p[2]).replace(/\+/g, ' ').toLocaleLowerCase('tr-TR') === searchTag) clanId = parseInt(p[0]);
            });
            if (!clanId) return setStatus(t('fastSupport.step1.status.notFound'));

            const playerData = await fetchWithProxy(`${cleanUrl}/map/player.txt`);
            const cPlayers = {};
            playerData.split("\n").forEach(line => {
                const p = line.split(",");
                if (p.length >= 3 && parseInt(p[2]) === clanId) {
                    cPlayers[parseInt(p[0])] = decodeURIComponent(p[1]).replace(/\+/g, ' ');
                }
            });
            setClanPlayers(cPlayers); storage.set("fs_cache_players", cPlayers);

            fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=ops").catch(() => {});
            
            const villageData = await fetchWithProxy(`${cleanUrl}/map/village.txt`);
            const cVils = [];
            const allVils = []; // YENİ: ID tespiti için tüm köyleri haritaya ekliyoruz

            villageData.split("\n").forEach(line => {
                const p = line.split(",");
                if (p.length >= 6) {
                    const vilId = parseInt(p[0]);
                    const coord = `${p[2]}|${p[3]}`;
                    
                    // Tüm köyleri listeye ekle (Sadece id ve coord yeterli)
                    allVils.push({ id: vilId, coord: coord });

                    const pid = parseInt(p[4]);
                    if (cPlayers[pid]) {
                        cVils.push({
                            id: vilId, coord: coord, x: parseInt(p[2]), y: parseInt(p[3]),
                            pid: pid, points: parseInt(p[5]), playerName: cPlayers[pid]
                        });
                    }
                }
            });
            
            setAllVillages(allVils); storage.set("fs_cache_allVils", allVils); // YENİ
            setClanVillages(cVils); storage.set("fs_cache_cVils", cVils);
            setStatus(t('fastSupport.step1.status.success').replace('{{count}}', cVils.length));
        } catch (err) {
            setStatus(t('fastSupport.step1.status.error').replace('{{msg}}', err.message));
        }
    };

    const parsedTarget = useMemo(() => {
        if (!targetInput) return null;
        const match = targetInput.match(/(\d{3})[|,\s](\d{3})/);
        if (match) {
            const coord = `${match[1]}|${match[2]}`;
            // YENİ: Koordinatla uyuşan köyün ID'sini tüm köyler arasından buluyoruz
            const vil = allVillages.find(v => v.coord === coord);
            return { 
                coord, 
                x: parseInt(match[1]), 
                y: parseInt(match[2]), 
                id: vil ? vil.id : null // YENİ: ID eklendi
            };
        }
        return null;
    }, [targetInput, allVillages]);

    const calculateDistance = (x1, y1, x2, y2) => Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
    const formatTravelTime = (minutes) => {
        const hrs = Math.floor(minutes / 60); const mins = Math.floor(minutes % 60); const secs = Math.round((minutes * 60) % 60);
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const availableSupports = useMemo(() => {
        if (!parsedTarget || clanVillages.length === 0) return [];
        const targetMs = new Date(selectedDateTime).getTime();
        const nowMs = new Date().getTime(); 
        const speed = defaultUnitSpeeds[selectedUnit];
        let validVillages = [];

        clanVillages.forEach(vil => {
            if (selectedPlayer && vil.playerName !== selectedPlayer) return;
            const dist = calculateDistance(vil.x, vil.y, parsedTarget.x, parsedTarget.y);
            if (dist === 0) return; 
            
            const travelMs = dist * speed * 60 * 1000;
            const departureMs = targetMs - travelMs;

            if (departureMs > nowMs) {
                validVillages.push({
                    ...vil, dist: dist.toFixed(1), travelTime: formatTravelTime(dist * speed),
                    departureStr: formatCustomStr(new Date(departureMs)), departureMs: departureMs
                });
            }
        });
        return validVillages.sort((a, b) => a.departureMs - b.departureMs);
    }, [parsedTarget, clanVillages, selectedDateTime, selectedUnit, selectedPlayer]);

    const generatedBBCode = useMemo(() => {
        if (availableSupports.length === 0 || !parsedTarget) return "";
        let bbcode = `[b]${t('fastSupport.bbcode.target')}[/b] ${parsedTarget.coord}\n[b]${t('fastSupport.bbcode.arrivalTime')}[/b] [color=#ff0000]${formatCustomStr(new Date(selectedDateTime))}[/color]\n[b]${t('fastSupport.bbcode.unitSpeed')}[/b] ${t(`fastSupport.units.${selectedUnit}`)}\n\n`;
        bbcode += `[table]\n[**]${t('fastSupport.columns.player')}[||]${t('fastSupport.columns.source')}[||]${t('fastSupport.columns.distance')}[||]${t('fastSupport.columns.time')}[||]${t('fastSupport.columns.departure')}[||]${t('fastSupport.bbcode.sendSupport')}[/**]\n`;
        
        availableSupports.forEach(s => {
            // YENİ: ID varsa doğrudan target=ID (OpPlanner mantığı), veri çekilmediyse veya bulunamadıysa target_coord=%7C mantığı.
            let aLink;
            if (parsedTarget.id) {
                aLink = `[url=${worldUrl.replace(/\/$/, '')}/game.php?village=${s.id}&screen=place&target=${parsedTarget.id}]${t('fastSupport.bbcode.supportLink')}[/url]`;
            } else {
                const encodedTarget = `${parsedTarget.x}%7C${parsedTarget.y}`;
                aLink = `[url=${worldUrl.replace(/\/$/, '')}/game.php?village=${s.id}&screen=place&target_coord=${encodedTarget}]${t('fastSupport.bbcode.supportLink')}[/url]`;
            }
            
            bbcode += `[*] [b]${s.playerName}[/b] [|] ${s.coord} [|] ${s.dist} [|] ${s.travelTime} [|] [b][color=#2b542c]${s.departureStr}[/color][/b] [|] [b]${aLink}[/b]\n`;
        });
        bbcode += `[/table]`; return bbcode;
    }, [availableSupports, parsedTarget, selectedDateTime, selectedUnit, worldUrl, t]);

    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d");
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width; canvas.height = rect.height || 350;
        ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!parsedTarget && availableSupports.length === 0) return;

        const allPoints = [];
        if (parsedTarget) allPoints.push(parsedTarget);
        availableSupports.forEach(v => allPoints.push(v));
        if (allPoints.length === 0) return;

        let minX = 999, minY = 999, maxX = 0, maxY = 0;
        allPoints.forEach(v => { if(v.x < minX) minX = v.x; if(v.x > maxX) maxX = v.x; if(v.y < minY) minY = v.y; if(v.y > maxY) maxY = v.y; });
        minX -= 10; minY -= 10; maxX += 10; maxY += 10;
        const scale = Math.min(canvas.width / (maxX - minX), canvas.height / (maxY - minY));

        if (parsedTarget) {
            const tx = (parsedTarget.x - minX) * scale; const ty = (parsedTarget.y - minY) * scale;
            availableSupports.forEach(s => {
                const sx = (s.x - minX) * scale; const sy = (s.y - minY) * scale;
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty);
                ctx.strokeStyle = 'rgba(91, 192, 222, 0.4)'; ctx.lineWidth = 1; ctx.stroke();
            });
            ctx.beginPath(); ctx.arc(tx, ty, 8, 0, 2 * Math.PI);
            ctx.fillStyle = "#5bc0de"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = "#5bc0de"; ctx.font = "bold 12px Arial"; ctx.fillText(t('fastSupport.results.mapTarget'), tx + 12, ty + 4);
        }
        availableSupports.forEach(v => {
            const vx = (v.x - minX) * scale; const vy = (v.y - minY) * scale;
            ctx.beginPath(); ctx.arc(vx, vy, 4, 0, 2 * Math.PI);
            ctx.fillStyle = "#f0c042"; ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
        });
    }, [parsedTarget, availableSupports, t]);

    return (
        <div className="cop-container">
            <h1 className="cop-header">{t('fastSupport.title')}</h1>
            
            <div className="cop-grid">
                <div className="cop-box">
                    <h3>{t('fastSupport.step1.title')}</h3>
                    <div style={{display: 'flex', gap: '10px'}}>
                        <input 
                            type="text" 
                            className="cop-input" 
                            placeholder={t('fastSupport.step1.worldUrl')} 
                            value={worldUrl} 
                            onChange={e => setWorldUrl(e.target.value)} 
                            onBlur={loadWorldClans} 
                        />
                        
                        <input 
                            type="text" 
                            className="cop-input" 
                            placeholder={t('fastSupport.step1.clanTag')} 
                            value={clanTag} 
                            onChange={e => setClanTag(e.target.value)} 
                            list="world-clans-list"
                        />
                        <datalist id="world-clans-list">
                            {worldClans.map(c => (
                                <option key={c.id} value={c.tag}>{c.name}</option>
                            ))}
                        </datalist>
                    </div>
                    <button className="cop-btn" style={{width: '100%'}} onClick={handleFetchClan}>{t('fastSupport.step1.updateBtn')}</button>
                    <div style={{fontSize: '12px', marginTop: '10px', color: '#5cb85c'}}>{status}</div>
                </div>

                <div className="cop-box">
                    <h3 style={{color: '#5bc0de'}}>{t('fastSupport.step2.title')}</h3>
                    <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                        <div style={{flex: 1}}>
                            <label style={{fontSize: '12px', color: '#aaa', fontWeight: 'bold'}}>{t('fastSupport.step2.targetCoord')}</label>
                            <input type="text" className="cop-input" placeholder={t('fastSupport.step2.targetPlaceholder')} value={targetInput} onChange={e => setTargetInput(e.target.value)} />
                        </div>
                        <div style={{flex: 1}}>
                            <label style={{fontSize: '12px', color: '#aaa', fontWeight: 'bold'}}>{t('fastSupport.step2.arrivalTime')}</label>
                            <input type="datetime-local" step="1" className="cop-input" value={selectedDateTime} onChange={e => setSelectedDateTime(e.target.value)} />
                        </div>
                    </div>
                    
                    <div style={{marginTop: '10px'}}>
                        <label style={{fontSize: '12px', color: '#aaa', fontWeight: 'bold', display: 'block', marginBottom: '5px'}}>{t('fastSupport.step2.slowestUnit')}</label>
                        <div style={{display: 'flex', gap: '10px', background: '#111', padding: '10px', borderRadius: '4px', border: '1px solid #814c11', flexWrap: 'wrap'}}>
                            {Object.keys(unitIcons).map(u => (
                                <label key={u} style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: selectedUnit === u ? '#f0c042' : '#aaa', fontWeight: selectedUnit === u ? 'bold' : 'normal'}}>
                                    <input type="radio" name="unitSpeed" value={u} checked={selectedUnit === u} onChange={() => setSelectedUnit(u)} />
                                    <img src={unitIcons[u]} alt={u} style={{width: '16px'}} /> {t(`fastSupport.units.${u}`)}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {parsedTarget && clanVillages.length > 0 && (
                <div className="cop-grid" style={{marginTop: '15px'}}>
                    <div className="cop-box" style={{marginBottom: 0}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                            <h3 style={{margin: 0, color: '#5cb85c'}}>{t('fastSupport.results.title').replace('{{count}}', availableSupports.length)}</h3>
                            <select style={{padding: '5px', background: '#111', color: '#f0c042', border: '1px solid #814c11', borderRadius: '3px'}} value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)}>
                                <option value="">{t('fastSupport.results.allClan')}</option>
                                {Object.values(clanPlayers).sort().map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>

                        <div style={{maxHeight: '400px', overflowY: 'auto', background: '#1a1a1a', border: '1px solid #603000', borderRadius: '4px'}}>
                            {availableSupports.length === 0 ? (
                                <div style={{padding: '20px', textAlign: 'center', color: '#d9534f', fontWeight: 'bold'}}>{t('fastSupport.results.noVillages')}</div>
                            ) : (
                                <table className="cop-table">
                                    <thead>
                                        <tr>
                                            <th>{t('fastSupport.columns.player')}</th>
                                            <th>{t('fastSupport.columns.source')}</th>
                                            <th>{t('fastSupport.columns.time')}</th>
                                            <th>{t('fastSupport.columns.departure')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {availableSupports.map(s => (
                                            <tr key={s.id}>
                                                <td><span className="cop-player-badge">{s.playerName}</span></td>
                                                <td><b>{s.coord}</b></td>
                                                <td>{s.travelTime}</td>
                                                <td style={{color: '#5cb85c', fontWeight: 'bold'}}>{s.departureStr}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                        <div className="cop-map-container" style={{margin: 0, height: '250px'}}>
                            <canvas ref={canvasRef} style={{display: 'block'}}></canvas>
                        </div>
                        
                        <div className="cop-box" style={{flex: 1, marginBottom: 0}}>
                            <h3 style={{color: '#f0c042'}}>{t('fastSupport.bbcode.title')}</h3>
                            <textarea className="cop-textarea" style={{height: '140px', fontSize: '11px', background: '#0a0a0a'}} value={generatedBBCode} readOnly />
                            <button className="cop-btn" style={{width: '100%', marginTop: '5px'}} onClick={() => { navigator.clipboard.writeText(generatedBBCode); alert(t('fastSupport.alerts.copied')); }}>{t('fastSupport.bbcode.copyAll')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FastSupport;