import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next'; // YENİ: Çeviri motoru eklendi
import storage from '../utils/storage';
import './OpPlanner.css';

// Oyunun Orijinal Birim İkonları
const unitIcons = {
    spear: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_spear.webp',
    sword: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_sword.webp',
    axe: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_axe.webp',
    spy: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_spy.webp',
    light: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_light.webp',
    heavy: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_heavy.webp',
    ram: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_ram.webp',
    catapult: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_catapult.webp',
    knight: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_knight.webp',
    snob: 'https://dstr.innogamescdn.com/asset/ff124e4b/graphic/unit/unit_snob.webp'
};

const defaultUnitSpeeds = {
    spear: 18, sword: 22, axe: 18, spy: 9, light: 10, heavy: 11, ram: 30, catapult: 30, knight: 10, snob: 35
};

const formatToLocalISO = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - offset)).toISOString().slice(0, 19);
};

const formatCustomStr = (dateObj) => {
    return dateObj.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit', second:'2-digit' });
};

const OpPlanner = () => {
    const { t } = useTranslation(); // YENİ: Çeviri kancası

    // === TEMEL AYAR STATE'LERİ ===
    const [worldUrl, setWorldUrl] = useState(() => storage.get("op_world_url", "https://ptc1.tribalwars.com.pt/"));
    const [playerName, setPlayerName] = useState(() => storage.get("op_player", ""));
    const [targetInput, setTargetInput] = useState(() => storage.get("op_targets", ""));
    const [maxSnobDist, setMaxSnobDist] = useState(() => storage.get("op_max_snob", 100));
    const [status, setStatus] = useState("");
    const [worldPlayers, setWorldPlayers] = useState([]);
    const [clickCount, setClickCount] = useState(0); 

    // === ZAMAN VE MOD STATE'LERİ ===
    const [timeMode, setTimeMode] = useState('arrival'); 
    const [selectedDateTime, setSelectedDateTime] = useState(() => formatToLocalISO(new Date()));

    // === VERİ STATE'LERİ ===
    const [villages, setVillages] = useState([]);
    const [playerVillages, setPlayerVillages] = useState([]);
    const [unitSpeeds, setUnitSpeeds] = useState(() => storage.get("op_cache_speeds", defaultUnitSpeeds));
    const [parsedTargets, setParsedTargets] = useState([]); 
    
    // Her kaynak köy için seçilen BİRİMLER (Dizi)
    const [sourceTypes, setSourceTypes] = useState({}); 
    const [planList, setPlanList] = useState([]); 

    // Eşleştirme Motoru
    const [selectedSourceCoord, setSelectedSourceCoord] = useState("");
    const [selectedTargetCoord, setSelectedTargetCoord] = useState("");
    const [selectedUnitMode, setSelectedUnitMode] = useState("");

    // BBCode Sütun Ayarları
    const [bbCols, setBbCols] = useState({
        no: true, source: true, target: true, departure: true, arrival: true, unit: true, distance: false, travelTime: false, attackLink: true
    });

    const canvasRef = useRef(null);

    useEffect(() => {
        storage.set("op_world_url", worldUrl);
        storage.set("op_player", playerName);
        storage.set("op_targets", targetInput);
        storage.set("op_max_snob", maxSnobDist);
    }, [worldUrl, playerName, targetInput, maxSnobDist]);

    // Dinamik Çevrilmiş Sütun İsimleri
    const colDisplayNames = {
        no: t('opPlanner.columns.no'), source: t('opPlanner.columns.source'), 
        target: t('opPlanner.columns.target'), departure: t('opPlanner.columns.departure'), 
        arrival: t('opPlanner.columns.arrival'), unit: t('opPlanner.columns.unit'), 
        distance: t('opPlanner.columns.distance'), travelTime: t('opPlanner.columns.travelTime'), 
        attackLink: t('opPlanner.columns.attackLink')
    };

    // === YENİ: DİNAMİK FİLTRELEME (KULLANILANLARI GİZLE) ===
    const getUnusedUnits = (coord) => {
        const types = sourceTypes[coord] || [];
        return types.filter(typeStr => !planList.some(p => p.sourceCoord === coord && p.unitType === typeStr));
    };

    const availableSourceVillages = useMemo(() => {
        return playerVillages.filter(v => getUnusedUnits(v.coord).length > 0);
    }, [playerVillages, sourceTypes, planList]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (availableSourceVillages.length > 0) {
            if (!selectedSourceCoord || !availableSourceVillages.find(v => v.coord === selectedSourceCoord)) {
                setSelectedSourceCoord(availableSourceVillages[0].coord);
            }
        } else {
            setSelectedSourceCoord("");
        }
    }, [availableSourceVillages, selectedSourceCoord]);

    useEffect(() => {
        if (selectedSourceCoord) {
            const unusedTypes = getUnusedUnits(selectedSourceCoord);
            if (unusedTypes.length > 0) {
                if (!selectedUnitMode || !unusedTypes.includes(selectedUnitMode)) {
                    setSelectedUnitMode(unusedTypes[0]);
                }
            } else {
                setSelectedUnitMode("");
            }
        } else {
            setSelectedUnitMode("");
        }
    }, [selectedSourceCoord, sourceTypes, planList, selectedUnitMode]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (parsedTargets.length > 0 && (!selectedTargetCoord || !parsedTargets.find(tObj => tObj.coord === selectedTargetCoord))) {
            setSelectedTargetCoord(parsedTargets[0].coord);
        }
    }, [parsedTargets, selectedTargetCoord]);


    // === 1. VERİ ÇEKME ===
    // === 1. ZEKİ VERİ MADENCİLİĞİ ===
    const fetchWithProxy = async (targetUrl) => {
        const res = await fetch(`https://tw-proxy.halimtttt10.workers.dev/?url=${encodeURIComponent(targetUrl)}`);
        if (!res.ok) throw new Error("Veri çekilemedi.");
        return await res.text();
    };
    const extractWorldId = (url) => {
        const match = url.match(/https?:\/\/([^.]+)\./);
        return match ? match[1] : null;
    };

    const loadWorldPlayers = async () => {
        const worldId = extractWorldId(worldUrl);
        if (!worldId || worldId.length < 3) return;

        try {
            // YENİ: Oracle yerine doğrudan Render API'mize istek atıyoruz
            const targetApiUrl = `https://twcu-bot.onrender.com/api/${worldId}/Oyuncular`;
            const res = await fetch(targetApiUrl);
            const data = await res.json();

            // GÜVENLİK: Eğer veri yoksa veya hata dönerse durdur
            if (data.hata || !data.veriler) {
                console.log("Oyuncu listesi API hatası:", data.hata);
                return;
            }

            const players = [];
            data.veriler.forEach(item => {
                players.push({
                    id: parseInt(item[0]), // TiDB Formatı: id(0)
                    name: item[1]          // TiDB Formatı: name(1)
                });
            });
            setWorldPlayers(players);
        } catch (err) {
            console.log("Oyuncu listesi API'den çekilemedi:", err);
        }
    };


    useEffect(() => {
        if (worldUrl) loadWorldPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

   const handleFetchData = async () => {
        const cleanUrl = worldUrl.replace(/\/$/, "");
        const worldId = extractWorldId(worldUrl);
        
        if (!cleanUrl || !worldId) return alert(t('opPlanner.alerts.enterWorldUrl'));
        if (!playerName) return alert(t('opPlanner.alerts.enterPlayerName'));

        const newClickCount = clickCount + 1;
        setClickCount(newClickCount);

        const now = Date.now();
        const lastFetch = storage.get("op_last_fetch", 0);
        
        if (playerVillages.length > 0 && (now - lastFetch < 3600000) && newClickCount < 13) {
            setStatus(t('opPlanner.status.cached'));
            return;
        }

        setStatus(t('opPlanner.status.fetching'));
        try {
            // 1. CONFIG ÇEKİMİ (Proxy üzerinden kalmaya devam ediyor)
            try {
                const configData = await fetchWithProxy(`${cleanUrl}/interface.php?func=get_config`);
                const distMatch = configData.match(/<max_dist>(\d+)<\/max_dist>/);
                if (distMatch && distMatch[1]) {
                    setMaxSnobDist(parseInt(distMatch[1]));
                }
            } catch (err) {
                console.log("Konfigürasyon çekilemedi, mevcut sınır kullanılacak.");
            }

            // 2. API'DEN OYUNCULARI ÇEK VE OYUNCU ID'Yİ BUL
            const playerApiUrl = `https://twcu-bot.onrender.com/api/${worldId}/Oyuncular`;
            const playerRes = await fetch(playerApiUrl);
            const playerData = await playerRes.json();
            
            // GÜVENLİK
            if (playerData.hata || !playerData.veriler) {
                throw new Error(playerData.hata || "Veritabanında oyuncu bilgisi bulunamadı.");
            }
            
            let playerId = null;
            const searchName = playerName.toLocaleLowerCase('tr-TR').trim();

            playerData.veriler.forEach(item => {
                // TiDB Oyuncu: id(0), name(1), ally_id(2)
                const currentName = (item[1] || "").toLocaleLowerCase('tr-TR').trim();
                if (currentName === searchName) {
                    playerId = parseInt(item[0]);
                }
            });

            if (!playerId) return setStatus(t('opPlanner.status.playerNotFound'));

            // 3. API'DEN KÖYLERİ ÇEK VE OYUNCUYA AİT OLANLARI FİLTRELE
            const villageApiUrl = `https://twcu-bot.onrender.com/api/${worldId}/Koyler`;
            const villageRes = await fetch(villageApiUrl);
            const villageData = await villageRes.json();
            
            // GÜVENLİK
            if (villageData.hata || !villageData.veriler) {
                throw new Error(villageData.hata || "Veritabanında köy bilgisi bulunamadı.");
            }
            
            const allVils = []; const pVils = [];

            villageData.veriler.forEach(item => {
                // TiDB Köy: id(0), name(1), x(2), y(3), player_id(4), points(5)
                const pid = parseInt(item[4]); 
                const vilObj = { 
                    id: parseInt(item[0]), 
                    x: parseInt(item[2]), 
                    y: parseInt(item[3]), 
                    pid: pid, 
                    coord: `${item[2]}|${item[3]}` 
                };
                allVils.push(vilObj);
                if (vilObj.pid === playerId) pVils.push(vilObj);
            });
            
            // 4. BİRİM HIZLARINI ÇEK (Proxy üzerinden devam ediyor)
            try {
                const unitXml = await fetchWithProxy(`${cleanUrl}/interface.php?func=get_unit_info`);
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(unitXml, "text/xml");
                const newSpeeds = {};
                Object.keys(unitIcons).forEach(unit => {
                    const node = xmlDoc.getElementsByTagName(unit)[0];
                    if (node) newSpeeds[unit] = parseFloat(node.getElementsByTagName("speed")[0].textContent);
                });
                if(Object.keys(newSpeeds).length > 0) {
                    setUnitSpeeds(newSpeeds);
                    storage.set("op_cache_speeds", newSpeeds);
                }
            } catch (e) { console.log("Birim hızları varsayılan kalacak."); }

            // 5. YENİ VERİLERİ STATE'E AT VE HAFIZAYI ŞİŞİRMEDEN KAYDET
            setVillages(allVils); 
            setPlayerVillages(pVils);
            
            // DİKKAT: QuotaExceededError almamak için büyük dizileri LocalStorage'a kaydetmiyoruz!
            // storage.set("op_cache_allVils", allVils); 
            // storage.set("op_cache_pVils", pVils);
            
            storage.set("op_last_fetch", now);
            setClickCount(0); 
            
            const initTypes = {};
            pVils.forEach(v => initTypes[v.coord] = ['ram']); 
            setSourceTypes(initTypes);

            setStatus(t('opPlanner.status.success').replace('{{count}}', pVils.length));
        } catch (error) {
            setStatus(t('opPlanner.status.error').replace('{{msg}}', error.message));
        }
    };

    const toggleUnitForVillage = (coord, unitKey) => {
        setSourceTypes(prev => {
            const currentUnits = prev[coord] || [];
            if (currentUnits.includes(unitKey)) {
                return { ...prev, [coord]: currentUnits.filter(u => u !== unitKey) };
            } else {
                return { ...prev, [coord]: [...currentUnits, unitKey] };
            }
        });
    };

    const clearQueue = () => {
        if(window.confirm(t('opPlanner.alerts.confirmClearQueue'))) {
            setPlanList([]);
        }
    };
    
    const clearAllData = () => {
        if(window.confirm(t('opPlanner.alerts.confirmClear'))) {
            setPlanList([]);
            setParsedTargets([]);
            setTargetInput("");
            setSourceTypes({});
            setPlayerVillages([]);
        }
    };

    // === 2. HEDEF KÖYLERİ AYIKLAMA ===
    useEffect(() => {
        const coords = [];
        const regex = /(\d{3})\|(\d{3})/g;
        let match;
        const uniqueCheck = new Set();
        
        while ((match = regex.exec(targetInput)) !== null) {
            const coord = `${match[1]}|${match[2]}`;
            if (!uniqueCheck.has(coord)) {
                uniqueCheck.add(coord);
                const vil = villages.find(v => v.coord === coord);
                coords.push({ coord, x: parseInt(match[1]), y: parseInt(match[2]), id: vil ? vil.id : null });
            }
        }
        setParsedTargets(coords);
    }, [targetInput, villages]);

    // === 3. MATEMATİK VE SÜRE HESAPLAMALARI ===
    const calculateDistance = (x1, y1, x2, y2) => Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));

    const formatTravelTime = (minutes) => {
        const hrs = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const secs = Math.round((minutes * 60) % 60);
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // === 4. PLANA EKLEME İŞLEMİ ===
    const addToPlan = () => {
        if (!selectedSourceCoord || !selectedTargetCoord || !selectedUnitMode) return alert(t('opPlanner.alerts.selectMatch'));

        fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=ops").catch(() => {});
        const sourceVil = playerVillages.find(v => v.coord === selectedSourceCoord);
        const targetVil = parsedTargets.find(v => v.coord === selectedTargetCoord);
        
        if(!sourceVil || !targetVil) return;

        const dist = calculateDistance(sourceVil.x, sourceVil.y, targetVil.x, targetVil.y);
        const unitType = selectedUnitMode; 
        
        if(unitType === 'snob' && dist > maxSnobDist) {
            alert(t('opPlanner.alerts.snobLimitExceeded').replace('{{dist}}', dist.toFixed(1)).replace('{{limit}}', maxSnobDist));
            return;
        }

        const travelMinutes = dist * (unitSpeeds[unitType] || 30);
        const travelMs = travelMinutes * 60 * 1000;
        
        const baseDate = new Date(selectedDateTime);
        let departureDate, arrivalDate;

        if (timeMode === 'arrival') {
            arrivalDate = new Date(baseDate);
            departureDate = new Date(baseDate.getTime() - travelMs);
        } else {
            departureDate = new Date(baseDate);
            arrivalDate = new Date(baseDate.getTime() + travelMs);
        }

        const newPlan = {
            id: Date.now() + Math.random(),
            sourceCoord: sourceVil.coord, sourceId: sourceVil.id,
            targetCoord: targetVil.coord, targetId: targetVil.id,
            unitType, dist: dist.toFixed(2),
            travelTime: formatTravelTime(travelMinutes),
            departureTime: formatCustomStr(departureDate),
            arrivalTime: formatCustomStr(arrivalDate),
            departureTimestamp: departureDate.getTime() 
        };

        setPlanList([...planList, newPlan]);
    };

    const removeFromPlan = (id) => setPlanList(planList.filter(p => p.id !== id));

    const sortedPlanList = useMemo(() => {
        return [...planList].sort((a, b) => a.departureTimestamp - b.departureTimestamp);
    }, [planList]);

    // === 5. CANLI BBCODE ŞABLON MOTORU ===
    const generatedBBCode = useMemo(() => {
        if(sortedPlanList.length === 0) return "";

        let bbcode = `[table]\n[**]`;
        if(bbCols.no) bbcode += `[b]${t('opPlanner.columns.no')}[/b][||]`;
        if(bbCols.source) bbcode += `[b]${t('opPlanner.columns.source')}[/b][||]`;
        if(bbCols.target) bbcode += `[b]${t('opPlanner.columns.target')}[/b][||]`;
        if(bbCols.departure) bbcode += `[b]${t('opPlanner.columns.departure')}[/b][||]`;
        if(bbCols.arrival) bbcode += `[b]${t('opPlanner.columns.arrival')}[/b][||]`;
        if(bbCols.unit) bbcode += `[b]${t('opPlanner.columns.unit')}[/b][||]`;
        if(bbCols.distance) bbcode += `[b]${t('opPlanner.columns.distance')}[/b][||]`;
        if(bbCols.travelTime) bbcode += `[b]${t('opPlanner.columns.travelTime')}[/b][||]`;
        if(bbCols.attackLink) bbcode += `[b]${t('opPlanner.columns.attackLink')}[/b][||]`;

        bbcode = bbcode.replace(/\[\|\|\]$/, '') + `[/**]\n`;

        sortedPlanList.forEach((p, index) => {
            let row = `[*]`;
            if(bbCols.no) row += ` ${index + 1} [|]`;
            if(bbCols.source) row += ` ${p.sourceCoord} [|]`;
            if(bbCols.target) row += ` ${p.targetCoord} [|]`;
            if(bbCols.departure) row += ` [b][color=#2b542c]${p.departureTime}[/color][/b] [|]`;
            if(bbCols.arrival) row += ` [b][color=#ff0000]${p.arrivalTime}[/color][/b] [|]`;

            const uTypeSafe = p.unitType || "";
            const uName = t(`opPlanner.units.${uTypeSafe}`, { defaultValue: uTypeSafe.toUpperCase() || t('opPlanner.bbcode.unknown') });
            const uColor = uTypeSafe === 'snob' ? '#8b0000' : (uTypeSafe === 'catapult' || uTypeSafe === 'ram') ? '#b8860b' : '#333333';
            
            if(bbCols.unit) row += ` [b][color=${uColor}]${uName}[/color][/b] [|]`;
            if(bbCols.distance) row += ` ${p.dist} [|]`;
            if(bbCols.travelTime) row += ` ${p.travelTime} [|]`;

            const aLink = `[url=${worldUrl.replace(/\/$/, '')}/game.php?village=${p.sourceId}&screen=place&target=${p.targetId}]${t('opPlanner.bbcode.attack')}[/url]`;
            if(bbCols.attackLink) row += ` [b]${aLink}[/b] [|]`;

            row = row.replace(/ \[\|\]$/, '') + `\n`;
            bbcode += row;
        });

        bbcode += `[/table]`;
        return bbcode;
    }, [sortedPlanList, bbCols, worldUrl, t]);

    // === 6. HARİTA ÇİZİMİ ===
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height || 450;

        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if(playerVillages.length === 0 && parsedTargets.length === 0) return;

        let minX = 999, minY = 999, maxX = 0, maxY = 0;
        const allPoints = [...playerVillages, ...parsedTargets];
        allPoints.forEach(v => {
            if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
        });

        const padding = 3; 
        minX -= padding; minY -= padding; maxX += padding; maxY += padding;
        const mapWidth = maxX - minX;
        const mapHeight = maxY - minY;
        const scale = Math.min(canvas.width / mapWidth, canvas.height / mapHeight);

        planList.forEach(plan => {
            const s = playerVillages.find(v => v.coord === plan.sourceCoord);
            const targetObj = parsedTargets.find(v => v.coord === plan.targetCoord);
            if(s && targetObj) {
                const sx = (s.x - minX) * scale; const sy = (s.y - minY) * scale;
                const tx = (targetObj.x - minX) * scale; const ty = (targetObj.y - minY) * scale;

                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty);
                if(plan.unitType === 'snob') ctx.strokeStyle = 'rgba(139, 0, 0, 0.8)'; 
                else if(plan.unitType === 'ram' || plan.unitType === 'catapult') ctx.strokeStyle = 'rgba(184, 134, 11, 0.7)'; 
                else if(plan.unitType === 'spy') ctx.strokeStyle = 'rgba(85, 85, 85, 0.6)'; 
                else ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';

                ctx.lineWidth = 1.5; ctx.stroke();
            }
        });

        playerVillages.forEach(v => {
            const uTypes = sourceTypes[v.coord] || [];
            if(uTypes.includes('snob')) {
                const vx = (v.x - minX) * scale; const vy = (v.y - minY) * scale;
                ctx.beginPath();
                ctx.arc(vx, vy, maxSnobDist * scale, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(139, 0, 0, 0.15)'; 
                ctx.fill();
                ctx.strokeStyle = 'rgba(139, 0, 0, 0.8)'; 
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        });

        parsedTargets.forEach(v => {
            const vx = (v.x - minX) * scale; const vy = (v.y - minY) * scale;
            ctx.beginPath(); ctx.arc(vx, vy, 5, 0, 2 * Math.PI);
            ctx.fillStyle = "#d9534f"; ctx.fill();
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = "#fff"; ctx.font = "10px Arial"; ctx.fillText(v.coord, vx + 7, vy + 3);
        });

        playerVillages.forEach(v => {
            const vx = (v.x - minX) * scale; const vy = (v.y - minY) * scale;
            ctx.beginPath(); ctx.arc(vx, vy, 4, 0, 2 * Math.PI);
            
            const uTypes = sourceTypes[v.coord] || [];
            if(uTypes.includes('snob')) ctx.fillStyle = "#8b0000";
            else if(uTypes.includes('ram') || uTypes.includes('catapult')) ctx.fillStyle = "#b8860b";
            else if(uTypes.includes('spy')) ctx.fillStyle = "#555";
            else ctx.fillStyle = "#5bc0de";

            ctx.fill();
        });

    }, [playerVillages, parsedTargets, planList, sourceTypes, maxSnobDist]);


    return (
        <div className="op-container">
            <h1 className="op-header">{t('opPlanner.title')}</h1>
            
            <div className="op-main-grid">
                {/* SOL PANEL */}
                <div>
                    <div className="op-box">
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                            <h3>{t('opPlanner.step1.title')}</h3>
                            <button className="op-btn-danger" onClick={clearAllData} style={{height: '24px'}}>{t('opPlanner.step1.clearData')}</button>
                        </div>
                        <div style={{display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap'}}>
                            <div style={{flex: 1, minWidth: '150px'}}>
                                <label style={{fontSize: '12px'}}>{t('opPlanner.step1.worldUrl')}</label>
                                <input 
                                    type="text" 
                                    className="op-input" 
                                    value={worldUrl} 
                                    onChange={e => setWorldUrl(e.target.value)} 
                                    onBlur={loadWorldPlayers} 
                                />
                            </div>
                            <div style={{flex: 1, minWidth: '150px'}}>
                                <label style={{fontSize: '12px'}}>{t('opPlanner.step1.playerName')}</label>
                                <input 
                                    type="text" 
                                    className="op-input" 
                                    value={playerName} 
                                    onChange={e => setPlayerName(e.target.value)} 
                                    list="world-players-list"
                                />
                                <datalist id="world-players-list">
                                    {worldPlayers.map(p => (
                                        <option key={p.id} value={p.name} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                        <button className="op-btn" style={{width: '100%'}} onClick={handleFetchData}>{t('opPlanner.step1.fetchBtn')}</button>
                        <div style={{fontSize: '12px', marginTop: '5px', color: '#aaa'}}>{status}</div>
                    </div>

                    {playerVillages.length > 0 && (
                        <div className="op-box" style={{maxHeight: '400px', overflowY: 'auto'}}>
                            <h3>{t('opPlanner.step2.title').replace('{{count}}', playerVillages.length)}</h3>
                            <div style={{fontSize: '11px', color: '#aaa', marginBottom: '10px'}}>{t('opPlanner.step2.info')}</div>
                            <table className="op-table" style={{background: '#fff'}}>
                                <thead>
                                    <tr><th>{t('opPlanner.step2.village')}</th><th>{t('opPlanner.step2.unitSelection')}</th></tr>
                                </thead>
                                <tbody>
                                    {playerVillages.map(v => {
                                        const activeUnits = sourceTypes[v.coord] || [];
                                        return (
                                            <tr key={v.coord}>
                                                <td style={{fontWeight: 'bold', fontSize: '14px'}}>{v.coord}</td>
                                                <td>
                                                    <div className="op-unit-list">
                                                        {Object.entries(unitIcons).map(([uKey, url]) => (
                                                            <img 
                                                                key={uKey} src={url} alt={uKey} 
                                                                title={t(`opPlanner.units.${uKey}`, {defaultValue: uKey})}
                                                                className={`op-unit-icon ${activeUnits.includes(uKey) ? 'active' : ''}`}
                                                                onClick={() => toggleUnitForVillage(v.coord, uKey)}
                                                            />
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* SAĞ PANEL */}
                <div>
                    <div className="op-box">
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '5px'}}>
                            <h3>{t('opPlanner.step3.title')}</h3>
                            <div style={{fontSize: '12px'}}>
                                {t('opPlanner.step3.maxSnobDist')} <input type="number" style={{width:'60px', padding:'2px', marginLeft: '5px'}} value={maxSnobDist} onChange={e => setMaxSnobDist(parseInt(e.target.value)||100)} />
                            </div>
                        </div>
                        <textarea 
                            className="op-textarea" rows="3" 
                            placeholder={t('opPlanner.step3.placeholder')}
                            value={targetInput} onChange={e => setTargetInput(e.target.value)}
                        />
                        <div style={{fontSize: '12px', color: '#5cb85c', fontWeight: 'bold'}}>
                            {t('opPlanner.step3.detectedTargets').replace('{{count}}', parsedTargets.length)}
                        </div>
                    </div>

                    <div className="op-map-container">
                        <canvas ref={canvasRef} style={{display: 'block'}}></canvas>
                        <div style={{position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.7)', padding: '5px', borderRadius: '4px', fontSize: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px'}}>
                            <span style={{color: '#d9534f'}}>● {t('opPlanner.step3.mapLegend.target')}</span> | 
                            <span style={{color: '#5bc0de'}}>● {t('opPlanner.step3.mapLegend.spearLight')}</span> | 
                            <span style={{color: '#b8860b'}}>● {t('opPlanner.step3.mapLegend.ramKami')}</span> | 
                            <span style={{color: '#8b0000'}}>● {t('opPlanner.step3.mapLegend.snob')}</span> | 
                            <span style={{color: '#555'}}>● {t('opPlanner.step3.mapLegend.spy')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ALT PANEL */}
            {playerVillages.length > 0 && parsedTargets.length > 0 && (
                <div className="op-box">
                    <h3>{t('opPlanner.step4.title')}</h3>
                    
                    <div className="op-time-mode">
                        <label><input type="radio" name="tmode" checked={timeMode === 'arrival'} onChange={() => setTimeMode('arrival')} /> {t('opPlanner.step4.modeArrival')}</label>
                        <label><input type="radio" name="tmode" checked={timeMode === 'departure'} onChange={() => setTimeMode('departure')} /> {t('opPlanner.step4.modeDeparture')}</label>
                        <span style={{marginLeft: 'auto', color: '#814c11'}}>{t('opPlanner.step4.dateTime')}</span>
                        <input 
                            type="datetime-local" step="1" 
                            className="op-datetime-input"
                            style={{ colorScheme: 'dark', cursor: 'pointer' }} /* YENİ: Karanlık mod takvim ikonu */
                            value={selectedDateTime}
                            onChange={e => setSelectedDateTime(e.target.value)}
                        />
                    </div>

                    <div className="op-flex-wrap">
                        <div>
                            <label style={{fontWeight: 'bold', fontSize: '12px', display: 'block'}}>{t('opPlanner.step4.sourceVillage')}</label>
                            <select value={selectedSourceCoord} onChange={e => setSelectedSourceCoord(e.target.value)} style={{padding: '6px', width: '100%', fontWeight: 'bold'}}>
                                {availableSourceVillages.length === 0 ? <option value="">{t('opPlanner.step4.allSourcesUsed')}</option> :
                                  availableSourceVillages.map(v => <option key={v.coord} value={v.coord}>{v.coord}</option>)
                                }
                            </select>
                        </div>
                        <div>
                            <label style={{fontWeight: 'bold', fontSize: '12px', display: 'block'}}>{t('opPlanner.step4.unitToSend')}</label>
                            <select value={selectedUnitMode} onChange={e => setSelectedUnitMode(e.target.value)} style={{padding: '6px', width: '100%', fontWeight: 'bold'}}>
                                {!selectedSourceCoord ? <option value="">{t('opPlanner.step4.selectSourceFirst')}</option> : 
                                 getUnusedUnits(selectedSourceCoord).length === 0 ? <option value="">{t('opPlanner.step4.noUnitsLeft')}</option> :
                                 getUnusedUnits(selectedSourceCoord).map(u => <option key={u} value={u}>{t(`opPlanner.units.${u}`, {defaultValue: u})}</option>)
                                }
                            </select>
                        </div>
                        <div>
                            <label style={{fontWeight: 'bold', fontSize: '12px', display: 'block'}}>{t('opPlanner.step4.target')}</label>
                            <select value={selectedTargetCoord} onChange={e => setSelectedTargetCoord(e.target.value)} style={{padding: '6px', width: '100%', fontWeight: 'bold'}}>
                                {parsedTargets.map(v => <option key={v.coord} value={v.coord}>{v.coord}</option>)}
                            </select>
                        </div>
                        <div style={{flex: 'none', width: '100%'}}>
                            <button className="op-btn" style={{background: '#5cb85c', color: 'white', width: '100%', padding: '10px'}} onClick={addToPlan}>{t('opPlanner.step4.calcAndAddBtn')}</button>
                        </div>
                    </div>

                    {sortedPlanList.length > 0 && (
                        <div className="op-table-wrapper" style={{marginTop: '25px'}}>
                            <div style={{padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2a1908', flexWrap: 'wrap', gap: '10px'}}>
                                <h4 style={{margin: 0, color: '#fff'}}>{t('opPlanner.queue.title').replace('{{count}}', sortedPlanList.length)}</h4>
                                <button className="op-btn-danger" onClick={clearQueue} style={{padding: '6px 12px'}}>{t('opPlanner.queue.clearQueue')}</button>
                            </div>
                            <table className="op-table">
                                <thead>
                                    <tr>
                                        <th>{t('opPlanner.columns.no')}</th>
                                        <th>{t('opPlanner.columns.source')}</th>
                                        <th>{t('opPlanner.columns.target')}</th>
                                        <th>{t('opPlanner.columns.departure')}</th>
                                        <th>{t('opPlanner.columns.arrival')}</th>
                                        <th>{t('opPlanner.columns.unit')}</th>
                                        <th>{t('opPlanner.columns.distance')}</th>
                                        <th>{t('opPlanner.columns.travelTime')}</th>
                                        <th>{t('opPlanner.columns.attackLink')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedPlanList.map((p, index) => (
                                        <tr key={p.id}>
                                            <td style={{fontWeight: 'bold'}}>{index + 1}</td>
                                            <td style={{fontWeight: 'bold'}}>{p.sourceCoord}</td>
                                            <td style={{fontWeight: 'bold', color: '#d9534f', fontSize: '14px'}}>{p.targetCoord}</td>
                                            <td style={{fontWeight: 'bold', color: '#2b542c'}}>{p.departureTime}</td>
                                            <td style={{fontWeight: 'bold', color: '#d9534f'}}>{p.arrivalTime}</td>
                                            <td style={{whiteSpace: 'nowrap'}}>
                                                {unitIcons[p.unitType] && <img src={unitIcons[p.unitType]} alt={p.unitType} style={{verticalAlign: 'middle', marginRight: '5px', width: '16px'}}/>}
                                                {t(`opPlanner.units.${p.unitType}`, {defaultValue: (p.unitType ? p.unitType.toUpperCase() : "")})}
                                            </td>
                                            <td>{p.dist}</td>
                                            <td>{p.travelTime}</td>
                                            <td><button className="op-btn-danger" onClick={() => removeFromPlan(p.id)}>{t('opPlanner.queue.delete')}</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* CANLI BBCODE ŞABLON KUTUSU */}
                            <div style={{background: '#faf5eb', padding: '15px', borderTop: '2px solid #dcb589'}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px'}}>
                                    <h4 style={{margin: 0, color: '#5a3a18'}}>{t('opPlanner.bbcode.title')}</h4>
                                    <button className="op-btn" onClick={() => { navigator.clipboard.writeText(generatedBBCode); alert(t('opPlanner.alerts.copied')); }}>{t('opPlanner.bbcode.copyAll')}</button>
                                </div>
                                <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px', fontSize: '13px'}}>
                                    <b style={{color: '#814c11'}}>{t('opPlanner.bbcode.selectCols')}</b>
                                    {Object.keys(bbCols).map(col => (
                                        <label key={col} style={{cursor: 'pointer', color: 'black', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px'}}>
                                            <input type="checkbox" checked={bbCols[col]} onChange={() => setBbCols({...bbCols, [col]: !bbCols[col]})} /> 
                                            {colDisplayNames[col]}
                                        </label>
                                    ))}
                                </div>
                                <textarea className="op-textarea" style={{height: '150px', background: '#fff', color: '#333'}} value={generatedBBCode} readOnly />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OpPlanner;