import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

// URL Encoded isimleri çözmek için yardımcı fonksiyon
const decodeTWName = (str) => {
    if (!str) return "";
    try {
        return decodeURIComponent(str.replace(/\+/g, '%20'));
    } catch(e) {
        return str.replace(/\+/g, ' ');
    }
};

// --- ASKERİ ZEKÂ (FARM & GÜÇ HESAPLAMA) ---
const calculateVillageProfile = (obj, t) => {
    const farmValues = { spear: 1, sword: 1, axe: 1, spy: 2, light: 4, heavy: 6, ram: 5, catapult: 8, knight: 1, snob: 100, archer: 1, marcher: 4, militia: 1 };

    const farmSize = Object.keys(farmValues).reduce((sum, unit) => sum + (Number(obj[unit]) || 0) * farmValues[unit], 0);

    let farmCategory = t('clanTroop.profiles.quarter', { defaultValue: 'Çeyrek' });
    if (farmSize >= 15000) farmCategory = t('clanTroop.profiles.full', { defaultValue: 'Tam' });
    else if (farmSize >= 10000) farmCategory = t('clanTroop.profiles.threeQuarters', { defaultValue: '3/4' });
    else if (farmSize >= 5000) farmCategory = t('clanTroop.profiles.half', { defaultValue: 'Yarım' });

    const attackPower = (Number(obj.axe) || 0) * 1 + (Number(obj.light) || 0) * 4 + (Number(obj.ram) || 0) * 5;
    const defensePower = (Number(obj.spear) || 0) * 1 + (Number(obj.sword) || 0) * 1 + (Number(obj.heavy) || 0) * 6;

    let type = attackPower >= defensePower ? t('clanTroop.profiles.kami', { defaultValue: 'Kami' }) : t('clanTroop.profiles.sav', { defaultValue: 'Sav' });
    if (farmSize < 1500) { type = t('clanTroop.profiles.empty', { defaultValue: 'Boş' }); farmCategory = ""; }

    return { farmSize, villageType: type, profile: farmCategory ? `${farmCategory} ${type}` : type };
};

const API_BASE = "https://chamber-that-smock.ngrok-free.dev/api";

const OpPlanner = () => {
    const { t } = useTranslation();

    // === TEMEL AYAR STATE'LERİ ===
    const [worldUrl, setWorldUrl] = useState(() => storage.get("op_world_url", "https://ptc1.tribalwars.com.pt/"));
    const [playerName, setPlayerName] = useState(() => storage.get("op_player", ""));
    const [targetInput, setTargetInput] = useState(() => storage.get("op_targets", ""));
    const [maxSnobDist, setMaxSnobDist] = useState(() => storage.get("op_max_snob", 100));
    const [status, setStatus] = useState("");
    const [worldPlayers, setWorldPlayers] = useState([]);
    const [clickCount, setClickCount] = useState(0); 

    // === GİZLE / GÖSTER STATE'LERİ ===
    const [isStep1Open, setIsStep1Open] = useState(true);
    const [isStep2Open, setIsStep2Open] = useState(true);
    const [isStep3Open, setIsStep3Open] = useState(true);
    const [isStep4Open, setIsStep4Open] = useState(true);

    // === ZAMAN VE MOD STATE'LERİ ===
    const [timeMode, setTimeMode] = useState('arrival'); 
    const [selectedDateTime, setSelectedDateTime] = useState(() => formatToLocalISO(new Date()));

    // === VERİ STATE'LERİ ===
    const [villages, setVillages] = useState([]);
    const [playerVillages, setPlayerVillages] = useState([]);
    const [unitSpeeds, setUnitSpeeds] = useState(() => storage.get("op_cache_speeds", defaultUnitSpeeds));
    const [parsedTargets, setParsedTargets] = useState([]); 
    
    // === YENİ: ASKER VERİSİ GİRİŞİ ===
    const [troopInput, setTroopInput] = useState(() => storage.get("op_troopInput", ""));
    const [parsedTroops, setParsedTroops] = useState(() => storage.get("op_parsedTroops", {}));
    const activeUnits = ['spear', 'sword', 'axe', 'spy', 'light', 'heavy', 'ram', 'catapult', 'knight', 'snob'];

    // Her kaynak köy için seçilen BİRİMLER (Dizi)
    const [sourceTypes, setSourceTypes] = useState({}); 
    const [planList, setPlanList] = useState([]); 

    // Eşleştirme Motoru (Select Box)
    const [selectedSourceCoord, setSelectedSourceCoord] = useState("");
    const [selectedTargetCoord, setSelectedTargetCoord] = useState("");
    const [selectedUnitMode, setSelectedUnitMode] = useState("");

    // Manuel Plan Ekleme State'leri (Yeni)
    const [manualSource, setManualSource] = useState("");
    const [manualUnit, setManualUnit] = useState("ram");
    const [manualTarget, setManualTarget] = useState("");

    const [bbCols, setBbCols] = useState({
        no: true, source: true, target: true, departure: true, arrival: true, unit: true, distance: false, travelTime: false, attackLink: true
    });

    const canvasRef = useRef(null);

    useEffect(() => {
        storage.set("op_world_url", worldUrl);
        storage.set("op_player", playerName);
        storage.set("op_targets", targetInput);
        storage.set("op_max_snob", maxSnobDist);
        storage.set("op_troopInput", troopInput);
        storage.set("op_parsedTroops", parsedTroops);
    }, [worldUrl, playerName, targetInput, maxSnobDist, troopInput, parsedTroops]);

    const colDisplayNames = {
        no: t('opPlanner.columns.no'), source: t('opPlanner.columns.source'), 
        target: t('opPlanner.columns.target'), departure: t('opPlanner.columns.departure'), 
        arrival: t('opPlanner.columns.arrival'), unit: t('opPlanner.columns.unit'), 
        distance: t('opPlanner.columns.distance'), travelTime: t('opPlanner.columns.travelTime'), 
        attackLink: t('opPlanner.columns.attackLink')
    };

    const getUnusedUnits = (coord) => {
        const types = sourceTypes[coord] || [];
        return types.filter(typeStr => !planList.some(p => p.sourceCoord === coord && p.unitType === typeStr));
    };

    const availableSourceVillages = useMemo(() => {
        return playerVillages.filter(v => getUnusedUnits(v.coord).length > 0);
    }, [playerVillages, sourceTypes, planList]); 

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
    }, [selectedSourceCoord, sourceTypes, planList, selectedUnitMode]); 

    useEffect(() => {
        if (parsedTargets.length > 0 && (!selectedTargetCoord || !parsedTargets.find(tObj => tObj.coord === selectedTargetCoord))) {
            setSelectedTargetCoord(parsedTargets[0].coord);
        }
    }, [parsedTargets, selectedTargetCoord]);


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
            const targetApiUrl = `${API_BASE}/${worldId}/Oyuncular`;
            const res = await fetch(targetApiUrl, { headers: { "ngrok-skip-browser-warning": "true" } });
            const data = await res.json();

            if (data.hata || !data.veriler) return;

            const players = [];
            data.veriler.forEach(item => {
                players.push({
                    id: parseInt(item[0]), 
                    name: item[1]          
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
            try {
                const configData = await fetchWithProxy(`${cleanUrl}/interface.php?func=get_config`);
                const distMatch = configData.match(/<max_dist>(\d+)<\/max_dist>/);
                if (distMatch && distMatch[1]) {
                    setMaxSnobDist(parseInt(distMatch[1]));
                }
            } catch (err) {
                console.log("Konfigürasyon çekilemedi, mevcut sınır kullanılacak.");
            }

            const playerApiUrl = `${API_BASE}/${worldId}/Oyuncular`;
            const playerRes = await fetch(playerApiUrl, { headers: { "ngrok-skip-browser-warning": "true" } });
            const playerData = await playerRes.json();
            
            if (playerData.hata || !playerData.veriler) {
                throw new Error(playerData.hata || "Veritabanında oyuncu bilgisi bulunamadı.");
            }
            
            let playerId = null;
            const searchName = playerName.toLocaleLowerCase('tr-TR').trim();

            playerData.veriler.forEach(item => {
                const currentName = (item[1] || "").toLocaleLowerCase('tr-TR').trim();
                if (currentName === searchName) {
                    playerId = parseInt(item[0]);
                }
            });

            if (!playerId) return setStatus(t('opPlanner.status.playerNotFound'));

            const villageApiUrl = `${API_BASE}/${worldId}/Koyler`;
            const villageRes = await fetch(villageApiUrl, { headers: { "ngrok-skip-browser-warning": "true" } });
            const villageData = await villageRes.json();
            
            if (villageData.hata || !villageData.veriler) {
                throw new Error(villageData.hata || "Veritabanında köy bilgisi bulunamadı.");
            }
            
            const allVils = []; const pVils = [];

            villageData.veriler.forEach(item => {
                const pid = parseInt(item[4]); 
                const vilObj = { 
                    id: parseInt(item[0]), 
                    name: decodeTWName(item[1]), // YENİ: Köy adını şifreden çöz
                    x: parseInt(item[2]), 
                    y: parseInt(item[3]), 
                    pid: pid, 
                    coord: `${item[2]}|${item[3]}` 
                };
                allVils.push(vilObj);
                if (vilObj.pid === playerId) pVils.push(vilObj);
            });
            
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

            setVillages(allVils); 
            setPlayerVillages(pVils);
            storage.set("op_last_fetch", now);
            setClickCount(0); 
            
            const initTypes = {};
            pVils.forEach(v => initTypes[v.coord] = ['ram']); 
            setSourceTypes(initTypes);
            setStatus(t('opPlanner.status.success').replace('{{count}}', pVils.length));

            setIsStep1Open(false);
            setIsStep2Open(true);
            setIsStep3Open(true);
            setIsStep4Open(true);

        } catch (error) {
            setStatus(t('opPlanner.status.error').replace('{{msg}}', error.message));
        }
    };

    // === 2.1. ASKERİ İSTİHBARAT ÇÖZÜCÜSÜ (PARSER) ===
    useEffect(() => {
        if (!troopInput) return setParsedTroops({});

        const lines = troopInput.split('\n');
        const results = {};

        lines.forEach(line => {
            const coordMatch = line.match(/(\d{3}\|\d{3})/);
            if (!coordMatch) return;
            const coord = coordMatch[1];

            let numbers = [];

            if (line.includes(',')) {
                const parts = line.substring(line.indexOf(',') + 1).split(',');
                numbers = parts.map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
            } else {
                let remainder = line.substring(line.indexOf(coord) + 7);
                remainder = remainder.replace(/^[)\]\s]*(K\d{2})?\s*/, '');

                const parts = remainder.trim().split(/[\s\t]+/);

                if (parts.length > 0 && (parts[0].includes('.') || parts.length > activeUnits.length)) {
                    parts.shift(); 
                }

                numbers = parts.map(n => parseInt(n.replace(/\./g, ''), 10)).filter(n => !isNaN(n));
                if (numbers.length > activeUnits.length) {
                    numbers = numbers.slice(0, activeUnits.length);
                }
            }

            if (numbers.length > 0) {
                const unitObj = {};
                activeUnits.forEach((u, i) => { unitObj[u] = numbers[i] || 0; });
                const profile = calculateVillageProfile(unitObj, t);
                results[coord] = { coord, units: unitObj, ...profile };
            }
        });

        setParsedTroops(results);
    }, [troopInput, activeUnits, t]);


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

    const applyQuickRole = (coord, role) => {
        let unitsToSelect = [];
        if (role === 'kami') unitsToSelect = ['ram'];
        if (role === 'fake') unitsToSelect = ['ram']; 
        if (role === 'mis') unitsToSelect = ['snob'];

        setSourceTypes(prev => ({
            ...prev,
            [coord]: unitsToSelect
        }));
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
            setTroopInput("");
            setParsedTroops({});
            setIsStep1Open(true);
        }
    };

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
                // YENİ: village adı da çekiliyor
                coords.push({ coord, x: parseInt(match[1]), y: parseInt(match[2]), id: vil ? vil.id : null, name: vil ? vil.name : "" });
            }
        }
        setParsedTargets(coords);
    }, [targetInput, villages]);

    const calculateDistance = (x1, y1, x2, y2) => Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));

    const formatTravelTime = (minutes) => {
        const hrs = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const secs = Math.round((minutes * 60) % 60);
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    // SELECT BOX ÜZERİNDEN EKLEME
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
            sourceCoord: sourceVil.coord, sourceId: sourceVil.id, sourceName: sourceVil.name || "",
            targetCoord: targetVil.coord, targetId: targetVil.id, targetName: targetVil.name || "",
            unitType, dist: dist.toFixed(2),
            travelTime: formatTravelTime(travelMinutes),
            departureTime: formatCustomStr(departureDate),
            arrivalTime: formatCustomStr(arrivalDate),
            departureTimestamp: departureDate.getTime() 
        };

        setPlanList([...planList, newPlan]);
    };

    // MANUEL YAZARAK EKLEME (YENİ)
    const handleAddManualPlan = () => {
        const cleanSrc = manualSource.trim();
        const cleanTgt = manualTarget.trim();
        const regex = /^\d{3}\|\d{3}$/;

        if (!regex.test(cleanSrc) || !regex.test(cleanTgt)) {
            return alert("Lütfen geçerli kaynak ve hedef koordinatları girin (Örn: 500|500)");
        }

        const sourceObj = playerVillages.find(v => v.coord === cleanSrc) || {
            coord: cleanSrc,
            x: parseInt(cleanSrc.split('|')[0]),
            y: parseInt(cleanSrc.split('|')[1]),
            id: null,
            name: ""
        };

        const targetObj = parsedTargets.find(v => v.coord === cleanTgt) || {
            coord: cleanTgt,
            x: parseInt(cleanTgt.split('|')[0]),
            y: parseInt(cleanTgt.split('|')[1]),
            id: null,
            name: ""
        };

        const dist = calculateDistance(sourceObj.x, sourceObj.y, targetObj.x, targetObj.y);
        const travelMinutes = dist * (unitSpeeds[manualUnit] || 30);
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
            sourceCoord: sourceObj.coord, sourceId: sourceObj.id, sourceName: sourceObj.name || "",
            targetCoord: targetObj.coord, targetId: targetObj.id, targetName: targetObj.name || "",
            unitType: manualUnit, dist: dist.toFixed(2),
            travelTime: formatTravelTime(travelMinutes),
            departureTime: formatCustomStr(departureDate),
            arrivalTime: formatCustomStr(arrivalDate),
            departureTimestamp: departureDate.getTime() 
        };

        setPlanList([...planList, newPlan]);
        setManualSource("");
        setManualTarget("");
    };

    const removeFromPlan = (id) => setPlanList(planList.filter(p => p.id !== id));

    const sortedPlanList = useMemo(() => {
        return [...planList].sort((a, b) => a.departureTimestamp - b.departureTimestamp);
    }, [planList]);

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
            
            const sourceNameStr = p.sourceName ? ` (${p.sourceName})` : "";
            const targetNameStr = p.targetName ? ` (${p.targetName})` : "";

            if(bbCols.no) row += ` ${index + 1} [|]`;
            if(bbCols.source) row += ` ${p.sourceCoord}${sourceNameStr} [|]`;
            if(bbCols.target) row += ` ${p.targetCoord}${targetNameStr} [|]`;
            if(bbCols.departure) row += ` [b][color=#2b542c]${p.departureTime}[/color][/b] [|]`;
            if(bbCols.arrival) row += ` [b][color=#ff0000]${p.arrivalTime}[/color][/b] [|]`;

            const uTypeSafe = p.unitType || "";
            const uName = t(`opPlanner.units.${uTypeSafe}`, { defaultValue: uTypeSafe.toUpperCase() || t('opPlanner.bbcode.unknown') });
            const uColor = uTypeSafe === 'snob' ? '#8b0000' : (uTypeSafe === 'catapult' || uTypeSafe === 'ram') ? '#b8860b' : '#333333';
            
            if(bbCols.unit) row += ` [b][color=${uColor}]${uName}[/color][/b] [|]`;
            if(bbCols.distance) row += ` ${p.dist} [|]`;
            if(bbCols.travelTime) row += ` ${p.travelTime} [|]`;

            let aLink = "-";
            if (p.sourceId && p.targetId) aLink = `[url=${worldUrl.replace(/\/$/, '')}/game.php?village=${p.sourceId}&screen=place&target=${p.targetId}]${t('opPlanner.bbcode.attack')}[/url]`;
            if(bbCols.attackLink) row += ` [b]${aLink}[/b] [|]`;

            row = row.replace(/ \[\|\]$/, '') + `\n`;
            bbcode += row;
        });

        bbcode += `[/table]`;
        return bbcode;
    }, [sortedPlanList, bbCols, worldUrl, t]);

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
                    {/* ADIM 1 */}
                    <div className="op-box">
                        <div 
                            style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'}} 
                            onClick={() => setIsStep1Open(!isStep1Open)}
                        >
                            <h3>{t('opPlanner.step1.title')} {isStep1Open ? '▲' : '▼'}</h3>
                            <button className="op-btn-danger" onClick={(e) => { e.stopPropagation(); clearAllData(); }} style={{height: '24px'}}>
                                {t('opPlanner.step1.clearData')}
                            </button>
                        </div>
                        
                        {isStep1Open && (
                            <div style={{ marginTop: '15px' }}>
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
                        )}
                    </div>

                    {/* YENİ: ASKER VERİSİ GİRİŞİ (İSTİHBARAT) */}
                    {playerVillages.length > 0 && (
                        <div className="op-box">
                            <h3 style={{ margin: '0 0 10px 0', color: '#f0c042', fontSize: '14px' }}>🛡️ Asker Verisi Gir (Toplu Bakış Askerler)</h3>
                            <textarea
                                className="op-textarea" rows="3"
                                placeholder="Buraya oyun içindeki asker sayılarını yapıştırırsan, köy kartlarında köylerin gücünü (Kami, Sav vb.) görebilirsin."
                                value={troopInput} onChange={e => setTroopInput(e.target.value)}
                            />
                        </div>
                    )}

                    {/* ADIM 2 - MOBİL UYUMLU KART TASARIMI */}
                    {playerVillages.length > 0 && (
                        <div className="op-box" style={{maxHeight: isStep2Open ? '500px' : 'auto', overflowY: isStep2Open ? 'auto' : 'visible'}}>
                            <div 
                                style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'}}
                                onClick={() => setIsStep2Open(!isStep2Open)}
                            >
                                <h3>{t('opPlanner.step2.title').replace('{{count}}', playerVillages.length)} {isStep2Open ? '▲' : '▼'}</h3>
                            </div>
                            
                            {isStep2Open && (
                                <div style={{ marginTop: '10px' }}>
                                    <div style={{fontSize: '11px', color: '#aaa', marginBottom: '15px'}}>{t('opPlanner.step2.info')}</div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {playerVillages.map(v => {
                                            const activeUnits = sourceTypes[v.coord] || [];
                                            const troopData = parsedTroops[v.coord]; // YENİ: Köyün asker verisi

                                            return (
                                                <div key={v.coord} style={{
                                                    background: '#1e1e1e', 
                                                    border: '1px solid #333', 
                                                    borderRadius: '8px', 
                                                    padding: '12px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '10px'
                                                }}>
                                                    {/* Köy Bilgisi */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                                                        <div>
                                                            <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#fff' }}>{v.coord}</span>
                                                            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>{v.name}</div>
                                                            
                                                            {/* YENİ: ASKER BİLGİSİ ROZETLERİ */}
                                                            {troopData && (
                                                                <div style={{ fontSize: '11px', color: '#eaddbd', marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                    <span style={{ background: troopData.profile.includes('Kami') ? '#8b0000' : '#2b542c', color: 'white', padding: '2px 5px', borderRadius: '3px', fontWeight: 'bold' }}>
                                                                        [{troopData.profile}]
                                                                    </span>
                                                                    {troopData.units.axe > 0 && <span title="Balta"><img src={unitIcons.axe} style={{ width: '12px', verticalAlign: 'middle' }} alt="" /> {troopData.units.axe}</span>}
                                                                    {troopData.units.light > 0 && <span title="Hafif"><img src={unitIcons.light} style={{ width: '12px', verticalAlign: 'middle' }} alt="" /> {troopData.units.light}</span>}
                                                                    {troopData.units.ram > 0 && <span title="Şah"><img src={unitIcons.ram} style={{ width: '12px', verticalAlign: 'middle' }} alt="" /> {troopData.units.ram}</span>}
                                                                    {troopData.units.snob > 0 && <span title="Mis"><img src={unitIcons.snob} style={{ width: '12px', verticalAlign: 'middle' }} alt="" /> {troopData.units.snob}</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Hızlı Seçim Butonları */}
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            <button 
                                                                onClick={() => applyQuickRole(v.coord, 'kami')}
                                                                style={{ background: '#b8860b', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                                                KAMI
                                                            </button>
                                                            <button 
                                                                onClick={() => applyQuickRole(v.coord, 'fake')}
                                                                style={{ background: '#555', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                                                FAKE
                                                            </button>
                                                            <button 
                                                                onClick={() => applyQuickRole(v.coord, 'mis')}
                                                                style={{ background: '#8b0000', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                                                MİS
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Birim İkonları */}
                                                    <div className="op-unit-list" style={{ justifyContent: 'center' }}>
                                                        {Object.entries(unitIcons).map(([uKey, url]) => (
                                                            <img 
                                                                key={uKey} src={url} alt={uKey} 
                                                                title={t(`opPlanner.units.${uKey}`, {defaultValue: uKey})}
                                                                className={`op-unit-icon ${activeUnits.includes(uKey) ? 'active' : ''}`}
                                                                onClick={() => toggleUnitForVillage(v.coord, uKey)}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* SAĞ PANEL */}
                <div>
                    {/* ADIM 3 */}
                    <div className="op-box">
                        <div 
                            style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: '5px'}}
                            onClick={() => setIsStep3Open(!isStep3Open)}
                        >
                            <h3>{t('opPlanner.step3.title')} {isStep3Open ? '▲' : '▼'}</h3>
                            <div style={{fontSize: '12px'}} onClick={(e) => e.stopPropagation()}>
                                {t('opPlanner.step3.maxSnobDist')} 
                                <input type="number" style={{width:'60px', padding:'2px', marginLeft: '5px'}} value={maxSnobDist} onChange={e => setMaxSnobDist(parseInt(e.target.value)||100)} />
                            </div>
                        </div>
                        
                        {isStep3Open && (
                            <div style={{ marginTop: '10px' }}>
                                <textarea 
                                    className="op-textarea" rows="3" 
                                    placeholder={t('opPlanner.step3.placeholder')}
                                    value={targetInput} onChange={e => setTargetInput(e.target.value)}
                                />
                                <div style={{fontSize: '12px', color: '#5cb85c', fontWeight: 'bold', marginBottom: '10px'}}>
                                    {t('opPlanner.step3.detectedTargets').replace('{{count}}', parsedTargets.length)}
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
                        )}
                    </div>
                </div>
            </div>

            {/* ALT PANEL (ADIM 4) */}
            {playerVillages.length > 0 && parsedTargets.length > 0 && (
                <div className="op-box">
                    <div 
                        style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'}}
                        onClick={() => setIsStep4Open(!isStep4Open)}
                    >
                        <h3>{t('opPlanner.step4.title')} {isStep4Open ? '▲' : '▼'}</h3>
                    </div>
                    
                    {isStep4Open && (
                        <div style={{ marginTop: '15px' }}>
                            <div className="op-time-mode">
                                <label><input type="radio" name="tmode" checked={timeMode === 'arrival'} onChange={() => setTimeMode('arrival')} /> {t('opPlanner.step4.modeArrival')}</label>
                                <label><input type="radio" name="tmode" checked={timeMode === 'departure'} onChange={() => setTimeMode('departure')} /> {t('opPlanner.step4.modeDeparture')}</label>
                                <span style={{marginLeft: 'auto', color: '#814c11'}}>{t('opPlanner.step4.dateTime')}</span>
                                <input 
                                    type="datetime-local" step="1" 
                                    className="op-datetime-input"
                                    style={{ colorScheme: 'dark', cursor: 'pointer' }} 
                                    value={selectedDateTime}
                                    onChange={e => setSelectedDateTime(e.target.value)}
                                />
                            </div>

                            {/* YENİ MANUEL EKLEME BÖLÜMÜ (DOĞRUDAN YAZARAK) */}
                            <div style={{ border: '1px dashed #555', padding: '15px', borderRadius: '8px', background: '#181818', marginBottom: '20px' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: '#f0c042' }}>✍️ Manuel Operasyon Ekle (Seçmek İstemiyorsan Yaz)</h4>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Kaynak Köy (Örn: 500|500)</label>
                                        <input type="text" className="op-input" placeholder="500|500" value={manualSource} onChange={e => setManualSource(e.target.value)} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Gönderilecek Birim</label>
                                        <select className="op-input" style={{ padding: '6px' }} value={manualUnit} onChange={e => setManualUnit(e.target.value)}>
                                            <option value="ram">Şahmerdan (Kami/Fake)</option>
                                            <option value="snob">Misyoner</option>
                                            <option value="catapult">Mancınık</option>
                                            <option value="spy">Casus</option>
                                            <option value="axe">Balta</option>
                                        </select>
                                    </div>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Hedef Köy (Örn: 501|501)</label>
                                        <input type="text" className="op-input" placeholder="501|501" value={manualTarget} onChange={e => setManualTarget(e.target.value)} />
                                    </div>
                                    <div style={{ flex: 'none', width: '100%', marginTop: '5px' }}>
                                        <button className="op-btn" style={{ background: '#337ab7', width: '100%', padding: '10px' }} onClick={handleAddManualPlan}>➕ Operasyon Planına Ekle</button>
                                    </div>
                                </div>
                            </div>

                            {/* DROPDOWN (SELECT) ÜZERİNDEN EKLEME */}
                            <h4 style={{ margin: '0 0 10px 0', color: '#5cb85c' }}>👉 Listeden Seçerek Ekle</h4>
                            <div className="op-flex-wrap">
                                <div>
                                    <label style={{fontWeight: 'bold', fontSize: '12px', display: 'block'}}>{t('opPlanner.step4.sourceVillage')}</label>
                                    <select value={selectedSourceCoord} onChange={e => setSelectedSourceCoord(e.target.value)} style={{padding: '6px', width: '100%', fontWeight: 'bold'}}>
                                        {availableSourceVillages.length === 0 ? <option value="">{t('opPlanner.step4.allSourcesUsed')}</option> :
                                          availableSourceVillages.map(v => <option key={v.coord} value={v.coord}>{v.coord} {v.name ? `(${v.name})` : ''}</option>)
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
                                        {parsedTargets.map(v => <option key={v.coord} value={v.coord}>{v.coord} {v.name ? `(${v.name})` : ''}</option>)}
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
                                            {sortedPlanList.map((p, index) => {
                                                const sourceNameStr = p.sourceName ? ` (${p.sourceName})` : "";
                                                const targetNameStr = p.targetName ? ` (${p.targetName})` : "";
                                                
                                                return (
                                                <tr key={p.id}>
                                                    <td style={{fontWeight: 'bold'}}>{index + 1}</td>
                                                    <td style={{fontWeight: 'bold'}}>
                                                        {p.sourceCoord}
                                                        <div style={{fontSize:'10px', color:'#aaa', fontWeight:'normal'}}>{p.sourceName}</div>
                                                    </td>
                                                    <td style={{fontWeight: 'bold', color: '#d9534f', fontSize: '14px'}}>
                                                        {p.targetCoord}
                                                        <div style={{fontSize:'10px', color:'#aaa', fontWeight:'normal'}}>{p.targetName}</div>
                                                    </td>
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
                                            )})}
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
            )}
        </div>
    );
};

export default OpPlanner;