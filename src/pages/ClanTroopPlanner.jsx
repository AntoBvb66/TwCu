import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import storage from '../utils/storage';
import './ClanOpPlanner.css'; // Aynı CSS'i kullanıyoruz

const formatToLocalISO = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - offset)).toISOString().slice(0, 19);
};

const formatCustomStr = (dateObj) => {
    return dateObj.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Orijinal Birim İkonları
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

const defaultUnitSpeeds = { spear: 18, sword: 22, axe: 18, spy: 9, light: 10, heavy: 11, ram: 30, catapult: 30, knight: 10, snob: 35 };
const mapColors = ['#3498db', '#f0ad4e', '#5cb85c', '#9b59b6', '#00ced1', '#ffb6c1', '#ffa500', '#20b2aa', '#778899', '#ff69b4'];

// --- ASKERİ ZEKÂ (FARM & GÜÇ HESAPLAMA) ---
const calculateVillageProfile = (obj, t) => {
    const farmValues = { spear: 1, sword: 1, axe: 1, spy: 2, light: 4, heavy: 6, ram: 5, catapult: 8, knight: 1, snob: 100, archer: 1, marcher: 4, militia: 1 };

    const farmSize = Object.keys(farmValues).reduce((sum, unit) => sum + (Number(obj[unit]) || 0) * farmValues[unit], 0);

    let farmCategory = t('clanTroop.profiles.quarter');
    if (farmSize >= 15000) farmCategory = t('clanTroop.profiles.full');
    else if (farmSize >= 10000) farmCategory = t('clanTroop.profiles.threeQuarters');
    else if (farmSize >= 5000) farmCategory = t('clanTroop.profiles.half');

    const attackPower = (Number(obj.axe) || 0) * 1 + (Number(obj.light) || 0) * 4 + (Number(obj.ram) || 0) * 5 + (Number(obj.marcher) || 0) * 4;
    const defensePower = (Number(obj.spear) || 0) * 1 + (Number(obj.sword) || 0) * 1 + (Number(obj.heavy) || 0) * 6 + (Number(obj.archer) || 0) * 1;

    let type = attackPower >= defensePower ? t('clanTroop.profiles.kami') : t('clanTroop.profiles.sav');
    if (farmSize < 1500) { type = t('clanTroop.profiles.empty'); farmCategory = ""; }

    return { farmSize, villageType: type, profile: farmCategory ? `${farmCategory} ${type}` : type };
};

const ClanTroopPlanner = () => {
    const { t } = useTranslation();

    const [worldUrl, setWorldUrl] = useState(() => storage.get("ctp_world_url", "https://ptc1.tribalwars.com.pt/"));
    const [clanTag, setClanTag] = useState(() => storage.get("ctp_clan_tag", ""));
    const [targetInput, setTargetInput] = useState(() => storage.get("ctp_targetInput", ""));
    const [troopInput, setTroopInput] = useState(() => storage.get("ctp_troopInput", ""));
    const [maxSnobDist, setMaxSnobDist] = useState(() => storage.get("ctp_max_snob", 100));
    const [status, setStatus] = useState("");
    const [toastMsg, setToastMsg] = useState("");
    const [worldClans, setWorldClans] = useState([]);

    const [allVillagesRaw, setAllVillagesRaw] = useState([]);
    const [clanPlayers, setClanPlayers] = useState(() => storage.get("ctp_cache_players", {}));
    const [clanVillages, setClanVillages] = useState(() => storage.get("ctp_cache_cVils", []));
    const [activeUnits, setActiveUnits] = useState(() => storage.get("ctp_activeUnits", ['spear', 'sword', 'axe', 'spy', 'light', 'heavy', 'ram', 'catapult', 'knight', 'snob']));

    const [parsedTargets, setParsedTargets] = useState(() => storage.get("ctp_parsedTargets", []));
    const [parsedTroops, setParsedTroops] = useState(() => storage.get("ctp_parsedTroops", {}));

    const [planList, setPlanList] = useState(() => storage.get("ctp_planList", []));
    const [selectedTarget, setSelectedTarget] = useState(() => storage.get("ctp_selectedTarget", ""));
    const [suggestedSources, setSuggestedSources] = useState([]);
    const [selectedDateTime, setSelectedDateTime] = useState(() => storage.get("ctp_datetime", formatToLocalISO(new Date())));

    const [suggestionMode, setSuggestionMode] = useState(() => storage.get("ctp_suggestionMode", 'closest'));
    const [selectedPlayer, setSelectedPlayer] = useState(() => storage.get("ctp_selectedPlayer", ''));

    const [hiddenTargets, setHiddenTargets] = useState(() => storage.get("ctp_hiddenTargets", []));
    const [hiddenSources, setHiddenSources] = useState(() => storage.get("ctp_hiddenSources", []));

    const [bbCols, setBbCols] = useState(() => storage.get("ctp_bbCols", {
        no: true, player: true, source: true, target: true, departure: true, arrival: true, unit: true, distance: false, travelTime: false, attackLink: true
    }));

    const [unitSpeedMultiplier, setUnitSpeedMultiplier] = useState(() => storage.get("cop_speed_multi", 1));

    const canvasRef = useRef(null);

    useEffect(() => {
        storage.set("ctp_world_url", worldUrl); storage.set("ctp_clan_tag", clanTag);
        storage.set("ctp_max_snob", maxSnobDist); storage.set("ctp_targetInput", targetInput);
        storage.set("ctp_troopInput", troopInput); storage.set("ctp_planList", planList);
        storage.set("ctp_selectedTarget", selectedTarget); storage.set("ctp_datetime", selectedDateTime);
        storage.set("ctp_suggestionMode", suggestionMode); storage.set("ctp_selectedPlayer", selectedPlayer);
        storage.set("ctp_hiddenTargets", hiddenTargets); storage.set("ctp_hiddenSources", hiddenSources);
        storage.set("ctp_parsedTroops", parsedTroops); storage.set("ctp_activeUnits", activeUnits);
        storage.set("ctp_bbCols", bbCols);
        storage.set("cop_speed_multi", unitSpeedMultiplier);
    }, [worldUrl, clanTag, maxSnobDist, targetInput, troopInput, planList, selectedTarget, selectedDateTime, suggestionMode, selectedPlayer, hiddenTargets, hiddenSources, parsedTroops, activeUnits, bbCols, unitSpeedMultiplier]);

    const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 1500); };

    const clearAllData = () => {
        if (window.confirm(t('clanTroop.alerts.confirmClear'))) {
            setPlanList([]); setTargetInput(""); setTroopInput(""); setParsedTargets([]); setParsedTroops({});
            setSelectedTarget(""); setHiddenTargets([]); setHiddenSources([]); showToast(t('clanTroop.alerts.cleared'));
        }
    };

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

    const loadWorldClans = async () => {
        const worldId = extractWorldId(worldUrl);
        if (!worldId) return;

        try {
            const targetApiUrl = `https://twcu-bot.onrender.com/api/${worldId}/Klanlar`;
            const res = await fetch(targetApiUrl);
            const data = await res.json();

            // GÜVENLİK: API'den hata döndüyse işlemi sessizce durdur
            if (data.hata || !data.veriler) {
                console.log("Klan listesi API hatası:", data.hata);
                return;
            }

            const clans = [];
            data.veriler.forEach(item => {
                clans.push({
                    id: parseInt(item[0]),
                    name: item[1], 
                    tag: item[2]
                });
            });
            setWorldClans(clans);
        } catch (err) {
            console.log("Klan listesi çekilemedi:", err);
        }
    };
    useEffect(() => {
        if (worldUrl) loadWorldClans();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleFetchClan = async () => {
        if (!clanTag) return alert(t('clanOp.alerts.enterClanTag'));
        setStatus(t('clanOp.step1.status.gathering'));

        const worldId = extractWorldId(worldUrl);
        if (!worldId) return setStatus("Geçersiz dünya URL'si. Lütfen kontrol edin.");

        try {
            const cleanUrl = worldUrl.replace(/\/$/, "");

            // --- YENİ: DÜNYA KONFİGÜRASYONUNU VE BİRİMLERİ ÇEK ---
            try {
                const configData = await fetchWithProxy(`${cleanUrl}/interface.php?func=get_config`);
                const distMatch = configData.match(/<max_dist>(\d+)<\/max_dist>/);
                if (distMatch && distMatch[1]) setMaxSnobDist(parseInt(distMatch[1]));

                const speedMatch = configData.match(/<speed>([\d.]+)<\/speed>/);
                const unitSpeedMatch = configData.match(/<unit_speed>([\d.]+)<\/unit_speed>/);

                let s_speed = 1;
                let u_speed = 1;

                if (speedMatch && speedMatch[1]) s_speed = parseFloat(speedMatch[1]);
                if (unitSpeedMatch && unitSpeedMatch[1]) u_speed = parseFloat(unitSpeedMatch[1]);

                const totalMultiplier = s_speed * u_speed;
                setUnitSpeedMultiplier(totalMultiplier);

                const unitXml = await fetchWithProxy(`${cleanUrl}/interface.php?func=get_unit_info`);
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(unitXml, "text/xml");
                const configUnits = [];
                Array.from(xmlDoc.documentElement.children).forEach(node => { configUnits.push(node.nodeName); });
                if (configUnits.length > 0) setActiveUnits(configUnits);
            } catch (e) { console.log("Birim bilgisi veya sınır çekilemedi, manuel sınır kullanılacak."); }

           // 2. API'DEN KLANLARI ÇEK VE KLAN ID BUL
            const clanApiUrl = `https://twcu-bot.onrender.com/api/${worldId}/Klanlar`;
            const clanRes = await fetch(clanApiUrl);
            const clanData = await clanRes.json();
            
            // GÜVENLİK: Eğer API "Böyle bir tablo yok" derse kullanıcıyı uyar
            if (clanData.hata || !clanData.veriler) {
                throw new Error(clanData.hata || "Veritabanında klan bilgisi bulunamadı.");
            }

            let clanId = null;
            const searchTag = clanTag.toLocaleLowerCase('tr-TR').trim();

            clanData.veriler.forEach(item => {
                const currentTag = (item[2] || "").toLocaleLowerCase('tr-TR').trim();
                if (currentTag === searchTag) {
                    clanId = parseInt(item[0]);
                }
            });

            if (!clanId) return setStatus(t('clanOp.step1.status.notFound'));

            // 3. API'DEN OYUNCULARI ÇEK VE KLANA AİT OLANLARI FİLTRELE
            const playerApiUrl = `https://twcu-bot.onrender.com/api/${worldId}/Oyuncular`;
            const playerRes = await fetch(playerApiUrl);
            const playerData = await playerRes.json();

            if (playerData.hata || !playerData.veriler) {
                throw new Error("Veritabanında oyuncu bilgisi bulunamadı.");
            }

            const allPlayers = {}; const cPlayers = {};
            playerData.veriler.forEach(item => {
                const pid = parseInt(item[0]);
                const pname = item[1];
                allPlayers[pid] = pname;
                if (parseInt(item[2]) === clanId) cPlayers[pid] = pname;
            });
            setClanPlayers(cPlayers);

            // 4. API'DEN KÖYLERİ ÇEK VE KLANA AİT KÖYLERİ AYIR
            const villageApiUrl = `https://twcu-bot.onrender.com/api/${worldId}/Koyler`;
            const villageRes = await fetch(villageApiUrl);
            const villageData = await villageRes.json();

            if (villageData.hata || !villageData.veriler) {
                throw new Error("Veritabanında köy bilgisi bulunamadı.");
            }

            const cVils = []; const allVils = [];
            villageData.veriler.forEach(item => {
                const pid = parseInt(item[4]);
                const vObj = {
                    id: parseInt(item[0]),
                    coord: `${item[2]}|${item[3]}`,
                    x: parseInt(item[2]),
                    y: parseInt(item[3]),
                    pid: pid,
                    points: parseInt(item[5]) || 0,
                    playerName: pid === 0 ? "Barbar" : (allPlayers[pid] || t('clanOp.bbcode.unknown'))
                };
                allVils.push(vObj);
                if (cPlayers[pid]) cVils.push({ ...vObj, playerName: cPlayers[pid] });
            });

            setAllVillagesRaw(allVils);
            setClanVillages(cVils);

            setStatus(t('clanOp.step1.status.success', { clanId, memberCount: Object.keys(cPlayers).length, villageCount: cVils.length }));
        } catch (err) {
            setStatus(t('clanTroop.step1.error', { msg: err.message }));
        }
    };

    // === 2. KUSURSUZ ASKERİ İSTİHBARAT ÇÖZÜCÜSÜ (PARSER) ===
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
                // Parantezler, kıtalar ve puanları temizleyen zeki ayrıştırıcı
                let remainder = line.substring(line.indexOf(coord) + 7);
                remainder = remainder.replace(/^[)\]\s]*(K\d{2})?\s*/, '');

                const parts = remainder.trim().split(/[\s\t]+/);

                // İlk eleman puan mı kontrol et (nokta içeriyorsa veya birim sayısından fazlaysa)
                if (parts.length > 0 && (parts[0].includes('.') || parts.length > activeUnits.length)) {
                    parts.shift(); // Puan (5.390 gibi) kısmını at
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

    const playerTroopSummary = useMemo(() => {
        const summary = {};
        Object.keys(parsedTroops).forEach(coord => {
            const vil = clanVillages.find(v => v.coord === coord);
            if (!vil) return;
            const player = vil.playerName;
            const profile = parsedTroops[coord].profile;

            if (!summary[player]) summary[player] = {};
            if (!summary[player][profile]) summary[player][profile] = { total: 0, used: 0 };

            summary[player][profile].total += 1;
            if (planList.some(p => p.sourceCoord === coord)) summary[player][profile].used += 1;
        });
        return summary;
    }, [parsedTroops, clanVillages, planList]);

    // === 3. HEDEF İSTİHBARATI ===
    useEffect(() => {
        if (!targetInput) return setParsedTargets([]);
        const coords = []; const regex = /(\d{3})\|(\d{3})/g;
        let match; const uniqueCheck = new Set();

        while ((match = regex.exec(targetInput)) !== null) {
            const coord = `${match[1]}|${match[2]}`;
            if (!uniqueCheck.has(coord)) {
                uniqueCheck.add(coord);
                const vil = allVillagesRaw.find(v => v.coord === coord);
                coords.push({ coord, x: parseInt(match[1]), y: parseInt(match[2]), id: vil ? vil.id : null, points: vil ? vil.points : 0, owner: vil ? vil.playerName : t('clanTroop.bbcode.unknown') });
            }
        }
        setParsedTargets(coords);
        if (coords.length > 0 && !selectedTarget) setSelectedTarget(coords[0].coord);
    }, [targetInput, allVillagesRaw, t]);

    const activeTargets = useMemo(() => parsedTargets.filter(t => !hiddenTargets.includes(t.coord)), [parsedTargets, hiddenTargets]);

    const toggleHideTarget = (coord, e) => {
        e.stopPropagation();
        setHiddenTargets(prev => {
            const isHidden = prev.includes(coord);
            const newList = isHidden ? prev.filter(c => c !== coord) : [...prev, coord];
            if (!isHidden && selectedTarget === coord) {
                const nextAvail = parsedTargets.find(t => t.coord !== coord && !newList.includes(t.coord));
                setSelectedTarget(nextAvail ? nextAvail.coord : "");
            }
            return newList;
        });
    };

    const toggleHideSource = (coord, e) => {
        e.stopPropagation();
        setHiddenSources(prev => prev.includes(coord) ? prev.filter(c => c !== coord) : [...prev, coord]);
    };

    // === 4. AKILLI TAKTİKSEL ATAMA ALGORİTMASI ===
    const calculateDistance = (x1, y1, x2, y2) => Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));

    const updateSuggestions = (targetCoord, mode, playerOverride = selectedPlayer) => {
        const targetObj = parsedTargets.find(v => v.coord === targetCoord);
        if (!targetObj) return setSuggestedSources([]);

        let list = clanVillages.map(src => {
            const troopData = parsedTroops[src.coord];
            return {
                ...src,
                dist: calculateDistance(src.x, src.y, targetObj.x, targetObj.y),
                profile: troopData ? troopData.profile : "Bilinmiyor",
                units: troopData ? troopData.units : null
            };
        });

        if (mode === 'closest') {
            list = list.sort((a, b) => a.dist - b.dist).slice(0, 10).map((s, i) => ({ ...s, mapColor: mapColors[i % mapColors.length] }));
        } else if (mode === 'furthest') {
            list = list.sort((a, b) => b.dist - a.dist).slice(0, 10).map((s, i) => ({ ...s, mapColor: mapColors[i % mapColors.length] }));
        } else if (mode === 'player') {
            list = list.filter(v => v.playerName === playerOverride).sort((a, b) => a.dist - b.dist).map(s => ({ ...s, mapColor: '#5bc0de' }));
        }

        setSuggestedSources(list);
    };

    useEffect(() => {
        if (selectedTarget) updateSuggestions(selectedTarget, suggestionMode);
        else setSuggestedSources([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTarget, suggestionMode, selectedPlayer, clanVillages, planList, parsedTroops]);

    const addClanPlan = (sourceObj, unitType) => {
        fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=ops").catch(() => { });
        const targetObj = parsedTargets.find(v => v.coord === selectedTarget);
        if (!targetObj) return alert(t('clanTroop.alerts.selectTarget'));

        const dist = sourceObj.dist;
        if (unitType === 'snob' && dist > maxSnobDist) {
            if (!window.confirm(t('clanTroop.alerts.snobLimitExceeded').replace('{{limit}}', maxSnobDist))) return;
        }

        const baseSpeed = defaultUnitSpeeds[unitType] || 30;
        const realSpeed = baseSpeed / unitSpeedMultiplier;
        const travelMinutes = dist * realSpeed;
        const travelMs = travelMinutes * 60 * 1000;

        const baseDate = new Date(selectedDateTime);
        const departureDate = new Date(baseDate.getTime() - travelMs);

        const newPlan = {
            id: Date.now() + Math.random(),
            player: sourceObj.playerName,
            sourceCoord: sourceObj.coord, sourceId: sourceObj.id, sourcePoints: sourceObj.points,
            targetCoord: targetObj.coord, targetId: targetObj.id, targetPoints: targetObj.points, targetOwner: targetObj.owner,
            unitType, dist: dist.toFixed(1),
            travelTime: formatTravelTime(travelMinutes),
            departureTime: formatCustomStr(departureDate),
            arrivalTime: formatCustomStr(baseDate),
            timestamp: departureDate.getTime()
        };

        setPlanList([...planList, newPlan]);
        showToast(t('clanTroop.alerts.orderAdded'));
    };

    const formatTravelTime = (minutes) => {
        const hrs = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const secs = Math.round((minutes * 60) % 60);
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const sortedPlanList = useMemo(() => [...planList].sort((a, b) => a.timestamp - b.timestamp), [planList]);
    const clearQueue = () => { if (window.confirm(t('clanTroop.alerts.confirmClearQueue'))) { setPlanList([]); showToast(t('clanTroop.alerts.queueCleared')); } };

    // === 5. KİŞİYE ÖZEL BÖLÜNMÜŞ BBCODE MOTORU ===
    const generatedBBCode = useMemo(() => {
        if (sortedPlanList.length === 0) return "";
        const groupedPlans = sortedPlanList.reduce((acc, plan) => {
            if (!acc[plan.player]) acc[plan.player] = [];
            acc[plan.player].push(plan); return acc;
        }, {});

        let bbcode = "";
        Object.keys(groupedPlans).forEach(player => {
            bbcode += `\n[b]${t('clanTroop.bbcode.ordersFor').replace('{{player}}', player)}[/b]\n[table]\n[**]`;
            if (bbCols.no) bbcode += `[b]${t('clanTroop.columns.no')}[/b][||]`;
            if (bbCols.player) bbcode += `[b]${t('clanTroop.columns.player')}[/b][||]`;
            if (bbCols.source) bbcode += `[b]${t('clanTroop.columns.source')}[/b][||]`;
            if (bbCols.target) bbcode += `[b]${t('clanTroop.columns.target')}[/b][||]`;
            if (bbCols.departure) bbcode += `[b]${t('clanTroop.columns.departure')}[/b][||]`;
            if (bbCols.arrival) bbcode += `[b]${t('clanTroop.columns.arrival')}[/b][||]`;
            if (bbCols.unit) bbcode += `[b]${t('clanTroop.columns.unit')}[/b][||]`;
            if (bbCols.distance) bbcode += `[b]${t('clanTroop.columns.distance')}[/b][||]`;
            if (bbCols.travelTime) bbcode += `[b]${t('clanTroop.columns.travelTime')}[/b][||]`;
            if (bbCols.attackLink) bbcode += `[b]${t('clanTroop.columns.attackLink')}[/b][||]`;

            bbcode = bbcode.replace(/\[\|\|\]$/, '') + `[/**]\n`;

            groupedPlans[player].forEach((p, index) => {
                let row = `[*]`;
                if (bbCols.no) row += ` ${index + 1} [|]`;
                if (bbCols.player) row += ` [b]${p.player}[/b] [|]`;
                if (bbCols.source) row += ` ${p.sourceCoord} [|]`;
                if (bbCols.target) row += ` ${p.targetCoord} (${p.targetOwner}) [|]`;
                if (bbCols.departure) row += ` [b][color=#2b542c]${p.departureTime}[/color][/b] [|]`;
                if (bbCols.arrival) row += ` [b][color=#ff0000]${p.arrivalTime}[/color][/b] [|]`;

                const uTypeSafe = p.unitType || "";
                const uName = t(`clanTroop.units.${uTypeSafe}`, { defaultValue: uTypeSafe.toUpperCase() || t('clanTroop.bbcode.unknown') });
                const uColor = p.unitType === 'snob' ? '#8b0000' : (p.unitType === 'catapult' || p.unitType === 'ram') ? '#b8860b' : '#333333';

                if (bbCols.unit) row += ` [b][color=${uColor}]${uName}[/color][/b] [|]`;
                if (bbCols.distance) row += ` ${p.dist} [|]`;
                if (bbCols.travelTime) row += ` ${p.travelTime} [|]`;

                let aLink = "-";
                if (p.sourceId && p.targetId) aLink = `[url=${worldUrl.replace(/\/$/, '')}/game.php?village=${p.sourceId}&screen=place&target=${p.targetId}]${t('clanTroop.bbcode.attack')}[/url]`;
                if (bbCols.attackLink) row += ` [b]${aLink}[/b] [|]`;

                row = row.replace(/ \[\|\]$/, '') + `\n`; bbcode += row;
            });
            bbcode += `[/table]\n`;
        });
        return bbcode.trim();
    }, [sortedPlanList, bbCols, worldUrl, t]);

    // === 6. TEMİZ HARİTA ÇİZİMİ ===
    useEffect(() => {
        const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d");
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width; canvas.height = rect.height || 450;
        ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, canvas.width, canvas.height);

        const visibleSources = suggestedSources.filter(s => !hiddenSources.includes(s.coord));
        const allPoints = [...activeTargets, ...visibleSources];
        if (allPoints.length === 0) return;

        let minX = 999, minY = 999, maxX = 0, maxY = 0;
        allPoints.forEach(v => { if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x; if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y; });
        let padding = 15; if (selectedTarget) padding = Math.max(padding, maxSnobDist + 5);
        minX -= padding; minY -= padding; maxX += padding; maxY += padding;
        const scale = Math.min(canvas.width / (maxX - minX), canvas.height / (maxY - minY));

        const sTarget = activeTargets.find(v => v.coord === selectedTarget);
        if (sTarget) {
            const tx = (sTarget.x - minX) * scale; const ty = (sTarget.y - minY) * scale;
            ctx.beginPath(); ctx.arc(tx, ty, maxSnobDist * scale, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(139, 0, 0, 0.1)'; ctx.fill(); ctx.strokeStyle = 'rgba(139, 0, 0, 0.6)'; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
        }

        planList.forEach(plan => {
            if (plan.sourceCoord === "-" || hiddenTargets.includes(plan.targetCoord) || hiddenSources.includes(plan.sourceCoord)) return;
            const s = clanVillages.find(v => v.coord === plan.sourceCoord); const targetObj = activeTargets.find(v => v.coord === plan.targetCoord);
            if (s && targetObj) {
                const sx = (s.x - minX) * scale; const sy = (s.y - minY) * scale; const tx = (targetObj.x - minX) * scale; const ty = (targetObj.y - minY) * scale;
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty);
                ctx.strokeStyle = plan.unitType === 'snob' ? 'rgba(139, 0, 0, 0.8)' : (plan.unitType === 'ram' ? 'rgba(184, 134, 11, 0.7)' : 'rgba(255, 255, 255, 0.4)');
                ctx.lineWidth = 1.5; ctx.stroke();
            }
        });

        activeTargets.forEach(v => {
            const vx = (v.x - minX) * scale; const vy = (v.y - minY) * scale;
            const isSelected = v.coord === selectedTarget;
            ctx.beginPath(); ctx.arc(vx, vy, isSelected ? 8 : 5, 0, 2 * Math.PI);
            ctx.fillStyle = isSelected ? "#f0c042" : "#d9534f"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = isSelected ? 2 : 1; ctx.stroke();

            if (isSelected) {
                ctx.font = "14px Arial";
                ctx.fillText("🎯", vx + 10, vy + 5);
            }
        });

        visibleSources.forEach(v => {
            const vx = (v.x - minX) * scale; const vy = (v.y - minY) * scale;
            ctx.beginPath(); ctx.arc(vx, vy, 4, 0, 2 * Math.PI);
            ctx.fillStyle = v.mapColor; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
        });
    }, [activeTargets, suggestedSources, selectedTarget, planList, maxSnobDist, hiddenTargets, hiddenSources, clanVillages]);

    const bbColLabels = {
        no: t('clanTroop.columns.no'), player: t('clanTroop.columns.player'), source: t('clanTroop.columns.source'),
        target: t('clanTroop.columns.target'), departure: t('clanTroop.columns.departure'),
        arrival: t('clanTroop.columns.arrival'), unit: t('clanTroop.columns.unit'),
        distance: t('clanTroop.columns.distance'), travelTime: t('clanTroop.columns.travelTime'), attackLink: t('clanTroop.columns.attackLink')
    };
    return (
        <div className="cop-container">
            <h1 className="cop-header">{t('clanTroop.title')}</h1>

            <div className="cop-grid">
                <div className="cop-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0 }}>{t('clanTroop.step1.title')}</h3>
                        <button className="cop-btn-danger" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={clearAllData}>{t('clanTroop.step1.clear')}</button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text" className="cop-input" placeholder={t('clanTroop.step1.worldUrl')}
                            value={worldUrl} onChange={e => setWorldUrl(e.target.value)} onBlur={loadWorldClans}
                        />
                        <input
                            type="text" className="cop-input" placeholder={t('clanTroop.step1.clanTag')}
                            value={clanTag} onChange={e => setClanTag(e.target.value)} list="world-clans-list"
                        />
                        <datalist id="world-clans-list">
                            {worldClans.map(c => <option key={c.id} value={c.tag}>{c.name}</option>)}
                        </datalist>
                    </div>
                    <button className="cop-btn" style={{ width: '100%' }} onClick={handleFetchClan}>{t('clanTroop.step1.run')}</button>
                    <div style={{ fontSize: '12px', marginTop: '10px', color: '#5cb85c' }}>{status}</div>
                </div>

                <div className="cop-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>{t('clanTroop.step2.title')}</h3>
                        <div style={{ fontSize: '12px' }}>{t('clanTroop.step2.snobLimit')} <input type="number" style={{ width: '40px', padding: '2px', background: '#111', color: '#f0c042', border: '1px solid #814c11' }} value={maxSnobDist} onChange={e => setMaxSnobDist(parseInt(e.target.value) || 100)} /></div>
                    </div>
                    <textarea className="cop-textarea" rows="2" placeholder={t('clanTroop.step2.placeholder')} value={targetInput} onChange={e => setTargetInput(e.target.value)} />
                </div>
            </div>

            {clanVillages.length > 0 && (
                <div className="cop-box">
                    <h3>{t('clanTroop.stepTroop.title')}</h3>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <textarea
                                className="cop-textarea" rows="6"
                                placeholder={t('clanTroop.stepTroop.placeholder')}
                                value={troopInput} onChange={e => setTroopInput(e.target.value)}
                            />
                            <div style={{ fontSize: '11px', color: '#aaa' }}>{t('clanTroop.stepTroop.detected').replace('{{count}}', Object.keys(parsedTroops).length)}</div>
                        </div>

                        {Object.keys(playerTroopSummary).length > 0 && (
                            <div style={{ flex: 1, minWidth: '250px', background: '#111', border: '1px solid #603000', borderRadius: '4px', padding: '10px', maxHeight: '160px', overflowY: 'auto' }}>
                                <h4 style={{ color: '#f0c042', margin: '0 0 10px 0', fontSize: '13px', borderBottom: '1px dashed #603000', paddingBottom: '5px' }}>{t('clanTroop.stepTroop.summaryTitle')}</h4>
                                {Object.entries(playerTroopSummary).map(([player, profiles]) => (
                                    <div key={player} style={{ marginBottom: '10px' }}>
                                        <b style={{ color: '#fff', fontSize: '13px' }}>{player}</b>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '3px' }}>
                                            {Object.entries(profiles).map(([profName, counts]) => (
                                                <span key={profName} style={{ fontSize: '11px', background: '#2a1908', padding: '2px 6px', borderRadius: '3px', border: '1px solid #4a2a10', color: '#eaddbd' }}>
                                                    {profName}: <b style={{ color: '#5cb85c' }}>{counts.total}</b>
                                                    {counts.total - counts.used > 0 ? <span style={{ color: '#f0c042' }}>{t('clanTroop.stepTroop.idle').replace('{{count}}', counts.total - counts.used)}</span> : <span style={{ color: '#d9534f' }}>{t('clanTroop.stepTroop.depleted')}</span>}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {clanVillages.length > 0 && parsedTargets.length > 0 && (
                <div className="cop-box">
                    <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '1px dashed #603000', paddingBottom: '15px' }}>
                        <h3 style={{ borderBottom: 'none', paddingBottom: 0 }}>{t('clanTroop.step3.title')}</h3>

                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.6)', padding: '10px 20px', borderRadius: '8px', border: '1px solid #814c11', fontSize: '14px', fontWeight: 'bold', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}>
                            <span style={{ color: '#f0c042' }}>{t('clanTroop.step3.arrivalTime')}</span>
                            <input
                                type="datetime-local"
                                step="1"
                                style={{
                                    padding: '8px',
                                    background: '#111',
                                    color: '#eaddbd',
                                    border: '1px solid #603000',
                                    borderRadius: '4px',
                                    colorScheme: 'dark',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                                value={selectedDateTime}
                                onChange={e => setSelectedDateTime(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="cop-grid" style={{ marginTop: '15px' }}>
                        <div>
                            <div className="cop-inner-box" style={{ marginBottom: '15px' }}>
                                <h4 style={{ color: '#f0c042', margin: '0 0 10px 0' }}>{t('clanTroop.step3.targetsTitle')}</h4>
                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {parsedTargets.map(tObj => {
                                        const isHidden = hiddenTargets.includes(tObj.coord);
                                        const k = planList.filter(p => p.targetCoord === tObj.coord && p.unitType === 'ram').length;
                                        const m = planList.filter(p => p.targetCoord === tObj.coord && p.unitType === 'snob').length;
                                        const f = planList.filter(p => p.targetCoord === tObj.coord && p.unitType === 'catapult').length;

                                        return (
                                            <div key={tObj.coord} onClick={() => !isHidden && setSelectedTarget(tObj.coord)} className={`cop-list-item ${selectedTarget === tObj.coord && !isHidden ? 'active' : ''}`} style={{ opacity: isHidden ? 0.4 : 1, cursor: isHidden ? 'default' : 'pointer' }}>
                                                <div>
                                                    <b style={{ color: '#d9534f', fontSize: '14px' }}>{tObj.coord}</b> {tObj.owner}
                                                    <div className="cop-target-stats">
                                                        <span><img src={unitIcons.ram} alt="Kami" /> {k}</span>
                                                        <span><img src={unitIcons.snob} alt="Mis" /> {m}</span>
                                                        <span><img src={unitIcons.catapult} alt="Fake" /> {f}</span>
                                                    </div>
                                                </div>
                                                <button className="cop-hide-btn" title={isHidden ? t('clanTroop.suggestions.show') : t('clanTroop.suggestions.hide')} onClick={(e) => toggleHideTarget(tObj.coord, e)}>{isHidden ? '👁️' : '❌'}</button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="cop-inner-box">
                                <div className="cop-tabs">
                                    <button className={`cop-tab-btn ${suggestionMode === 'closest' ? 'active' : ''}`} onClick={() => setSuggestionMode('closest')}>{t('clanTroop.tabs.closest')}</button>
                                    <button className={`cop-tab-btn ${suggestionMode === 'furthest' ? 'active' : ''}`} onClick={() => setSuggestionMode('furthest')}>{t('clanTroop.tabs.furthest')}</button>
                                    <button className={`cop-tab-btn ${suggestionMode === 'player' ? 'active' : ''}`} onClick={() => setSuggestionMode('player')}>{t('clanTroop.tabs.player')}</button>
                                </div>

                                {suggestionMode === 'player' && (
                                    <select style={{ width: '100%', padding: '5px', marginBottom: '10px', background: '#111', color: '#f0c042', border: '1px solid #814c11' }} value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)}>
                                        <option value="">{t('clanTroop.tabs.selectPlayer')}</option>
                                        {Object.values(clanPlayers).sort().map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                )}

                                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                    {suggestedSources.length === 0 ? <div style={{ padding: '10px', color: '#777', textAlign: 'center' }}>{t('clanTroop.suggestions.noVillages')}</div> :
                                        suggestedSources.map(s => {
                                            const isHidden = hiddenSources.includes(s.coord);
                                            const activeOrders = planList.filter(p => p.sourceCoord === s.coord);

                                            return (
                                                <div key={s.coord} className="cop-list-item" style={{ opacity: isHidden ? 0.4 : 1 }}>
                                                    <div>
                                                        <span className="cop-player-badge">{s.playerName}</span> <b style={{ color: '#fff' }}>{s.coord}</b>
                                                        <br />

                                                        {s.profile !== "Bilinmiyor" ? (
                                                            <div style={{ marginTop: '4px' }}>
                                                                <span style={{ fontSize: '11px', background: s.profile.includes(t('clanTroop.profiles.kami')) ? '#8b0000' : '#2b542c', color: 'white', padding: '2px 4px', borderRadius: '3px', fontWeight: 'bold', marginRight: '5px' }}>
                                                                    [{s.profile}]
                                                                </span>
                                                                <span style={{ fontSize: '11px', color: '#aaa' }}>{t('clanTroop.step3.distance')} {s.dist.toFixed(1)}</span>
                                                                <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: '#eaddbd', marginTop: '4px', flexWrap: 'wrap' }}>
                                                                    {s.units && s.units.axe > 0 && <span title="Balta"><img src={unitIcons.axe} style={{ width: '12px' }} alt="" />{s.units.axe}</span>}
                                                                    {s.units && s.units.light > 0 && <span title="Hafif"><img src={unitIcons.light} style={{ width: '12px' }} alt="" />{s.units.light}</span>}
                                                                    {s.units && s.units.ram > 0 && <span title="Şah"><img src={unitIcons.ram} style={{ width: '12px' }} alt="" />{s.units.ram}</span>}
                                                                    {s.units && s.units.snob > 0 && <span title="Mis"><img src={unitIcons.snob} style={{ width: '12px' }} alt="" />{s.units.snob}</span>}

                                                                    {/* Savunma Ağırlıklıysa */}
                                                                    {s.profile.includes(t('clanTroop.profiles.sav')) && s.units && s.units.spear > 0 && <span title="Mızrak"><img src={unitIcons.spear} style={{ width: '12px' }} alt="" />{s.units.spear}</span>}
                                                                    {s.profile.includes(t('clanTroop.profiles.sav')) && s.units && s.units.sword > 0 && <span title="Kılıç"><img src={unitIcons.sword} style={{ width: '12px' }} alt="" />{s.units.sword}</span>}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ fontSize: '11px', color: '#aaa' }}>{t('clanTroop.step3.distance')} {s.dist.toFixed(1)} {t('clanTroop.suggestions.noIntel')}</span>
                                                        )}

                                                        {activeOrders.length > 0 && (
                                                            <div style={{ marginTop: '5px', fontSize: '10px', color: '#f0ad4e', background: 'rgba(240, 173, 78, 0.1)', padding: '2px 4px', borderRadius: '3px', borderLeft: '2px solid #f0ad4e' }}>
                                                                {activeOrders.map(o => <div key={o.id}>📌 {o.targetCoord} ({t(`clanTroop.units.${o.unitType}`, { defaultValue: o.unitType })})</div>)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                        {!isHidden && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                <div style={{ display: 'flex', gap: '3px' }}>
                                                                    <img src={unitIcons.ram} alt="Kami" title={t('clanTroop.suggestions.kami')} className="cop-action-icon" onClick={() => addClanPlan(s, 'ram')} />
                                                                    <img src={unitIcons.snob} alt="Mis" title={t('clanTroop.suggestions.snob')} className="cop-action-icon" onClick={() => addClanPlan(s, 'snob')} />
                                                                    <img src={unitIcons.catapult} alt="Fake" title={t('clanTroop.suggestions.fake')} className="cop-action-icon" onClick={() => addClanPlan(s, 'catapult')} />
                                                                </div>
                                                            </div>
                                                        )}
                                                        <button className="cop-hide-btn" title={isHidden ? t('clanTroop.suggestions.show') : t('clanTroop.suggestions.hide')} onClick={(e) => toggleHideSource(s.coord, e)}>{isHidden ? '👁️' : '❌'}</button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        </div>

                        {/* HARİTA */}
                        <div className="cop-map-container">
                            <canvas ref={canvasRef} style={{ display: 'block' }}></canvas>
                        </div>
                    </div>
                </div>
            )}

            {/* OPERASYON KUYRUĞU */}
            {sortedPlanList.length > 0 && (
                <div className="cop-table-wrapper" style={{ marginTop: '25px' }}>
                    <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2a1908' }}>
                        <h4 style={{ margin: 0, color: '#fff' }}>{t('clanTroop.queue.title').replace('{{count}}', sortedPlanList.length)}</h4>
                        <button className="cop-btn-danger" onClick={clearQueue} style={{ padding: '6px 12px' }}>{t('clanTroop.queue.clear')}</button>
                    </div>
                    <table className="cop-table">
                        <thead>
                            <tr>
                                <th style={{ color: '#fff' }}>{t('clanTroop.columns.no')}</th> <th style={{ color: '#fff' }}>{t('clanTroop.columns.player')}</th>
                                <th style={{ color: '#fff' }}>{t('clanTroop.columns.source')}</th> <th style={{ color: '#fff' }}>{t('clanTroop.columns.target')}</th>
                                <th style={{ color: '#fff' }}>{t('clanTroop.columns.departure')}</th> <th style={{ color: '#fff' }}>{t('clanTroop.columns.arrival')}</th>
                                <th style={{ color: '#fff' }}>{t('clanTroop.columns.unit')}</th> <th style={{ color: '#fff' }}>{t('clanTroop.columns.distance')}</th>
                                <th style={{ color: '#fff' }}>{t('clanTroop.queue.delete')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPlanList.map((p, index) => (
                                <tr key={p.id}>
                                    <td style={{ fontWeight: 'bold', color: '#eaddbd' }}>{index + 1}</td>
                                    <td><span className="cop-player-badge">{p.player}</span></td>
                                    <td style={{ fontWeight: 'bold', color: '#eaddbd' }}>{p.sourceCoord}</td>
                                    <td style={{ fontWeight: 'bold', color: '#d9534f', fontSize: '13px' }}>{p.targetCoord}</td>
                                    <td style={{ fontWeight: 'bold', color: '#5cb85c' }}>{p.departureTime}</td>
                                    <td style={{ fontWeight: 'bold', color: '#d9534f' }}>{p.arrivalTime}</td>
                                    <td style={{ whiteSpace: 'nowrap', color: '#eaddbd' }}>{t(`clanTroop.units.${p.unitType}`, { defaultValue: p.unitType })}</td>
                                    <td style={{ color: '#eaddbd' }}>{p.dist}</td>
                                    <td><button className="cop-btn-danger" onClick={() => setPlanList(planList.filter(x => x.id !== p.id))}>{t('clanTroop.queue.delete')}</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* BBCODE */}
                    <div style={{ background: '#1a1a1a', padding: '15px', borderTop: '2px solid #603000' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                            <h4 style={{ margin: 0, color: '#f0c042' }}>{t('clanTroop.bbcode.title')}</h4>
                            <button className="cop-btn" onClick={() => { navigator.clipboard.writeText(generatedBBCode); showToast(t('clanTroop.alerts.copied')); }}>{t('clanTroop.bbcode.copyAll')}</button>
                        </div>

                        {/* YENİ EKLENEN: SÜTUN SEÇİCİ */}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px', fontSize: '13px' }}>
                            <b style={{ color: '#dcb589' }}>{t('clanTroop.bbcode.selectCols', 'Sütunları Seç:')}</b>
                            {Object.keys(bbCols).map(col => (
                                <label key={col} style={{ cursor: 'pointer', color: '#eaddbd', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <input type="checkbox" checked={bbCols[col]} onChange={() => setBbCols({ ...bbCols, [col]: !bbCols[col] })} />
                                    {bbColLabels[col]}
                                </label>
                            ))}
                        </div>

                        <textarea className="cop-textarea" style={{ height: '250px', background: '#0a0a0a', color: '#f0c042' }} value={generatedBBCode} readOnly />
                    </div>
                </div>
            )}

            <div className={`cop-toast ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
        </div>
    );
};

export default ClanTroopPlanner;