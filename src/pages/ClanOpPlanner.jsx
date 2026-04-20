import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next'; // YENİ: Çeviri motoru eklendi
import storage from '../utils/storage';
import './ClanOpPlanner.css';

const formatToLocalISO = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - offset)).toISOString().slice(0, 19);
};

const formatCustomStr = (dateObj) => {
    return dateObj.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Birim İkonları ve Hızları
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

const ClanOpPlanner = () => {
    const { t } = useTranslation(); // YENİ: Çeviri kancası

    // A. TEMEL STATE'LER
    const [worldUrl, setWorldUrl] = useState(() => storage.get("cop_world_url", "https://ptc1.tribalwars.com.pt/"));
    const [clanTag, setClanTag] = useState(() => storage.get("cop_clan_tag", ""));
    const [maxSnobDist, setMaxSnobDist] = useState(() => storage.get("cop_max_snob", 100));
    const [status, setStatus] = useState("");
    const [toastMsg, setToastMsg] = useState("");
    const [worldClans, setWorldClans] = useState([]);

    // B. VERİTABANI STATE'LERİ
    const [allVillagesRaw, setAllVillagesRaw] = useState(() => storage.get("cop_cache_allVils", []));
    const [clanPlayers, setClanPlayers] = useState(() => storage.get("cop_cache_players", {}));
    const [clanVillages, setClanVillages] = useState(() => storage.get("cop_cache_cVils", []));
    const [parsedTargets, setParsedTargets] = useState(() => storage.get("cop_parsedTargets", []));

    // C. SAYFA DEĞİŞİNCE KAYBOLMAYAN PLANLAMA STATE'LERİ
    const [targetInput, setTargetInput] = useState(() => storage.get("cop_targetInput", ""));
    const [planList, setPlanList] = useState(() => storage.get("cop_planList", []));
    const [selectedTarget, setSelectedTarget] = useState(() => storage.get("cop_selectedTarget", ""));
    const [suggestedSources, setSuggestedSources] = useState([]);
    const [selectedDateTime, setSelectedDateTime] = useState(() => storage.get("cop_datetime", formatToLocalISO(new Date())));

    const [suggestionMode, setSuggestionMode] = useState(() => storage.get("cop_suggestionMode", 'closest'));
    const [selectedPlayer, setSelectedPlayer] = useState(() => storage.get("cop_selectedPlayer", ''));

    const [hiddenTargets, setHiddenTargets] = useState(() => storage.get("cop_hiddenTargets", []));
    const [hiddenSources, setHiddenSources] = useState(() => storage.get("cop_hiddenSources", []));

    const [manualPlayer, setManualPlayer] = useState(() => storage.get("cop_manualPlayer", ""));
    const [manualUnit, setManualUnit] = useState(() => storage.get("cop_manualUnit", "ram"));

    const [unitSpeedMultiplier, setUnitSpeedMultiplier] = useState(() => storage.get("cop_speed_multi", 1));


    const [bbCols, setBbCols] = useState(() => storage.get("cop_bbCols", {
        no: true, player: true, source: true, target: true, departure: true, arrival: true, unit: true, distance: false, travelTime: false, attackLink: true
    }));

    const canvasRef = useRef(null);

    useEffect(() => {
        storage.set("cop_world_url", worldUrl);
        storage.set("cop_clan_tag", clanTag);
        storage.set("cop_max_snob", maxSnobDist);
        storage.set("cop_targetInput", targetInput);
        storage.set("cop_planList", planList);
        storage.set("cop_selectedTarget", selectedTarget);
        storage.set("cop_datetime", selectedDateTime);
        storage.set("cop_suggestionMode", suggestionMode);
        storage.set("cop_selectedPlayer", selectedPlayer);
        storage.set("cop_hiddenTargets", hiddenTargets);
        storage.set("cop_hiddenSources", hiddenSources);
        storage.set("cop_manualPlayer", manualPlayer);
        storage.set("cop_manualUnit", manualUnit);
        storage.set("cop_bbCols", bbCols);
        storage.set("cop_speed_multi", unitSpeedMultiplier);
    }, [worldUrl, clanTag, maxSnobDist, targetInput, planList, selectedTarget, selectedDateTime, suggestionMode, selectedPlayer, hiddenTargets, hiddenSources, manualPlayer, manualUnit, bbCols, unitSpeedMultiplier]);

    const showToast = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(""), 1500);
    };

    const clearAllData = () => {
        if (window.confirm(t('clanOp.alerts.confirmClear'))) {
            setPlanList([]);
            setTargetInput("");
            setParsedTargets([]);
            setSelectedTarget("");
            setHiddenTargets([]);
            setHiddenSources([]);
            setManualPlayer("");
            showToast(t('clanOp.alerts.cleared'));
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
            // FastAPI'ye istek atıyoruz (Tüm klanları çekmek için limiti yüksek tutuyoruz)
            const targetApiUrl = `http://152.70.16.201.sslip.io/api/${worldId}/Klanlar?limit=5000`;
            const rawText = await fetchWithProxy(targetApiUrl);
            const data = JSON.parse(rawText);

            const clans = [];
            data.veriler.forEach(item => {
                clans.push({
                    id: item.id,
                    name: item.isim,  // API'den gelen 'isim'
                    tag: item.kisaltma // API'den gelen 'kisaltma'
                });
            });
            setWorldClans(clans);
        } catch (err) {
            console.log("Klan listesi API'den çekilemedi:", err);
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
            // 1. CONFIG ÇEKİMİ (Veritabanında olmadığı için proxy ile çekiyoruz)
            const cleanUrl = worldUrl.replace(/\/$/, "");
            try {
                const configData = await fetchWithProxy(`${cleanUrl}/interface.php?func=get_config`);
                const distMatch = configData.match(/<max_dist>(\d+)<\/max_dist>/);
                if (distMatch && distMatch[1]) setMaxSnobDist(parseInt(distMatch[1]));

                const speedMatch = configData.match(/<speed>([\d.]+)<\/speed>/);
                const unitSpeedMatch = configData.match(/<unit_speed>([\d.]+)<\/unit_speed>/);
                let s_speed = 1; let u_speed = 1;
                if (speedMatch && speedMatch[1]) s_speed = parseFloat(speedMatch[1]);
                if (unitSpeedMatch && unitSpeedMatch[1]) u_speed = parseFloat(unitSpeedMatch[1]);
                setUnitSpeedMultiplier(s_speed * u_speed);
            } catch (err) {
                console.log("Konfigürasyon proxy'den çekilemedi, manuel sınır kullanılacak.");
            }

            // 2. API'DEN KLANLARI ÇEK VE KLAN ID BUL
            const clanApiUrl = `http://152.70.16.201.sslip.io/api/${worldId}/Klanlar?limit=5000`;
            const rawClanText = await fetchWithProxy(clanApiUrl);
            const clanData = JSON.parse(rawClanText);
            let clanId = null;

            // Aranan klan etiketini hazırla
            const searchTag = clanTag.toLocaleLowerCase('tr-TR').trim();

            clanData.veriler.forEach(item => {
                // ÖNEMLİ: Artik item[1] yok, item.kisaltma (veya API'den gelen isim) var.
                // item doğrudan bir obje olduğu için tekrar JSON.parse(item[1]) yapmıyoruz.

                const currentTag = (item.kisaltma || "").toLocaleLowerCase('tr-TR').trim();

                if (currentTag === searchTag) {
                    clanId = parseInt(item.id);
                }
            });

            if (!clanId) return setStatus(t('clanOp.step1.status.notFound'));

            // 3. API'DEN OYUNCULARI ÇEK VE KLANA AİT OLANLARI FİLTRELE
            const playerApiUrl = `http://152.70.16.201.sslip.io/api/${worldId}/Oyuncular?limit=500000`;
            const rawPlayerText = await fetchWithProxy(playerApiUrl);
            const playerData = JSON.parse(rawPlayerText);
            const allPlayers = {}; const cPlayers = {};

            playerData.veriler.forEach(item => {
                // API'den gelen sütun isimlerini buraya yaz (id, isim, klan_id gibi)
                const pid = parseInt(item.id);
                const pname = item.isim;
                allPlayers[pid] = pname;
                if (parseInt(item.klan_id) === clanId) cPlayers[pid] = pname;
            });
            setClanPlayers(cPlayers);

            // 4. API'DEN KÖYLERİ ÇEK VE KLANA AİT KÖYLERİ AYIR
            const villageApiUrl = `http://152.70.16.201.sslip.io/api/${worldId}/Koyler?limit=500000`;
            const rawVillageText = await fetchWithProxy(villageApiUrl);
            const villageData = JSON.parse(rawVillageText);
            const cVils = []; const allVils = [];

            villageData.veriler.forEach(item => {
                const pid = parseInt(item.oyuncu_id || item.pid); // API'deki sütun adın neyse o
                const vObj = {
                    id: parseInt(item.id),
                    coord: `${item.x}|${item.y}`, // Eğer sütun adları x ve y ise
                    x: parseInt(item.x),
                    y: parseInt(item.y),
                    pid: pid,
                    points: parseInt(item.puan || item.points),
                    playerName: pid === 0 ? "Barbar" : (allPlayers[pid] || t('clanOp.bbcode.unknown'))
                };
                allVils.push(vObj);
                if (cPlayers[pid]) cVils.push({ ...vObj, playerName: cPlayers[pid] });
            });

            setAllVillagesRaw(allVils);
            setClanVillages(cVils);
       

            setStatus(t('clanOp.step1.status.success', { clanId, memberCount: Object.keys(cPlayers).length, villageCount: cVils.length }));
        } catch (err) {
            setStatus(t('clanOp.step1.status.error', { msg: err.message }));
        }
    };

    // === 2. HEDEF İSTİHBARATI ===
    useEffect(() => {
        if (!targetInput) return setParsedTargets([]);

        const coords = [];
        const regex = /(\d{3})\|(\d{3})/g;
        let match;
        const uniqueCheck = new Set();

        while ((match = regex.exec(targetInput)) !== null) {
            const coord = `${match[1]}|${match[2]}`;
            if (!uniqueCheck.has(coord)) {
                uniqueCheck.add(coord);
                const vil = allVillagesRaw.find(v => v.coord === coord);
                coords.push({
                    coord, x: parseInt(match[1]), y: parseInt(match[2]),
                    id: vil ? vil.id : null,
                    points: vil ? vil.points : 0,
                    owner: vil ? vil.playerName : t('clanOp.bbcode.unknown')
                });
            }
        }
        setParsedTargets(coords);
        if (coords.length > 0 && !selectedTarget) setSelectedTarget(coords[0].coord);
    }, [targetInput, allVillagesRaw, t]);

    const activeTargets = useMemo(() => {
        return parsedTargets.filter(t => !hiddenTargets.includes(t.coord));
    }, [parsedTargets, hiddenTargets]);

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
        setHiddenSources(prev => {
            if (prev.includes(coord)) return prev.filter(c => c !== coord);
            return [...prev, coord];
        });
    };

    // === 3. AKILLI TAKTİKSEL ATAMA ALGORİTMASI ===
    const calculateDistance = (x1, y1, x2, y2) => Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));

    const updateSuggestions = (targetCoord, mode, playerOverride = selectedPlayer) => {
        const tObj = parsedTargets.find(v => v.coord === targetCoord);
        if (!tObj) return setSuggestedSources([]);

        let list = clanVillages.map(src => ({ ...src, dist: calculateDistance(src.x, src.y, tObj.x, tObj.y) }));

        if (mode === 'closest') {
            list = list.sort((a, b) => a.dist - b.dist).slice(0, 10).map((s, i) => ({ ...s, mapColor: mapColors[i % mapColors.length] }));
        } else if (mode === 'furthest') {
            list = list.sort((a, b) => b.dist - a.dist).slice(0, 10).map((s, i) => ({ ...s, mapColor: mapColors[i % mapColors.length] }));
        } else if (mode === 'player') {
            list = list.filter(v => v.playerName === playerOverride)
                .sort((a, b) => a.dist - b.dist)
                .map(s => ({ ...s, mapColor: '#5bc0de' }));
        }

        setSuggestedSources(list);
    };

    useEffect(() => {
        if (selectedTarget) {
            updateSuggestions(selectedTarget, suggestionMode);
        } else {
            setSuggestedSources([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTarget, suggestionMode, selectedPlayer, clanVillages, planList]);

    const addClanPlan = (sourceObj, unitType) => {
        fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=ops").catch(() => { });
        const targetObj = parsedTargets.find(v => v.coord === selectedTarget);
        if (!targetObj) return alert(t('clanOp.alerts.selectTarget'));

        const dist = sourceObj.dist;

        if (unitType === 'snob' && dist > maxSnobDist) {
            alert(t('clanOp.alerts.snobLimitExceeded', { dist: dist.toFixed(1), limit: maxSnobDist }));
            return;
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
        showToast(t('clanOp.alerts.orderAdded'));
    };

    const addManualPlan = () => {
        fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=ops").catch(() => { });
        const targetObj = parsedTargets.find(v => v.coord === selectedTarget);
        if (!targetObj) return alert(t('clanOp.alerts.selectTargetLeft'));
        if (!manualPlayer) return alert(t('clanOp.alerts.selectPlayer'));

        const baseDate = new Date(selectedDateTime);

        const newPlan = {
            id: Date.now() + Math.random(),
            player: manualPlayer,
            sourceCoord: "-", sourceId: null, sourcePoints: "-",
            targetCoord: targetObj.coord, targetId: targetObj.id, targetPoints: targetObj.points, targetOwner: targetObj.owner,
            unitType: manualUnit, dist: "-",
            travelTime: "-",
            departureTime: "-",
            arrivalTime: formatCustomStr(baseDate),
            timestamp: baseDate.getTime()
        };

        setPlanList([...planList, newPlan]);
        showToast(t('clanOp.alerts.manualAdded'));
    };

    const formatTravelTime = (minutes) => {
        const hrs = Math.floor(minutes / 60);
        const mins = Math.floor(minutes % 60);
        const secs = Math.round((minutes * 60) % 60);
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const sortedPlanList = useMemo(() => {
        return [...planList].sort((a, b) => a.timestamp - b.timestamp);
    }, [planList]);

    const clearQueue = () => {
        if (window.confirm(t('clanOp.alerts.confirmClearQueue'))) {
            setPlanList([]);
            showToast(t('clanOp.alerts.queueCleared'));
        }
    };

    // === 5. KİŞİYE ÖZEL BÖLÜNMÜŞ BBCODE MOTORU ===
    const generatedBBCode = useMemo(() => {
        if (sortedPlanList.length === 0) return "";

        const groupedPlans = sortedPlanList.reduce((acc, plan) => {
            if (!acc[plan.player]) acc[plan.player] = [];
            acc[plan.player].push(plan);
            return acc;
        }, {});

        let bbcode = "";

        Object.keys(groupedPlans).forEach(player => {
            bbcode += `\n[b]${t('clanOp.bbcode.ordersFor').replace('{{player}}', player)}[/b]\n`;
            bbcode += `[table]\n[**]`;

            if (bbCols.no) bbcode += `[b]${t('clanOp.columns.no')}[/b][||]`;
            if (bbCols.player) bbcode += `[b]${t('clanOp.columns.player')}[/b][||]`;
            if (bbCols.source) bbcode += `[b]${t('clanOp.columns.source')}[/b][||]`;
            if (bbCols.target) bbcode += `[b]${t('clanOp.columns.target')}[/b][||]`;
            if (bbCols.departure) bbcode += `[b]${t('clanOp.columns.departure')}[/b][||]`;
            if (bbCols.arrival) bbcode += `[b]${t('clanOp.columns.arrival')}[/b][||]`;
            if (bbCols.unit) bbcode += `[b]${t('clanOp.columns.unit')}[/b][||]`;
            if (bbCols.distance) bbcode += `[b]${t('clanOp.columns.distance')}[/b][||]`;
            if (bbCols.travelTime) bbcode += `[b]${t('clanOp.columns.travelTime')}[/b][||]`;
            if (bbCols.attackLink) bbcode += `[b]${t('clanOp.columns.attackLink')}[/b][||]`;

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
                // Birim ismini çeviriden çekiyoruz
                const uName = t(`clanOp.units.${uTypeSafe}`, { defaultValue: uTypeSafe.toUpperCase() || t('clanOp.bbcode.unknown') });
                const uColor = uTypeSafe === 'snob' ? '#8b0000' : (uTypeSafe === 'catapult' || uTypeSafe === 'ram') ? '#b8860b' : '#333333';

                if (bbCols.unit) row += ` [b][color=${uColor}]${uName}[/color][/b] [|]`;
                if (bbCols.distance) row += ` ${p.dist} [|]`;
                if (bbCols.travelTime) row += ` ${p.travelTime} [|]`;

                let aLink = "-";
                if (p.sourceId && p.targetId) {
                    aLink = `[url=${worldUrl.replace(/\/$/, '')}/game.php?village=${p.sourceId}&screen=place&target=${p.targetId}]${t('clanOp.bbcode.attack')}[/url]`;
                } else if (p.targetId) {
                    aLink = `[url=${worldUrl.replace(/\/$/, '')}/game.php?screen=info_village&id=${p.targetId}]${t('clanOp.bbcode.viewTarget')}[/url]`;
                }

                if (bbCols.attackLink) row += ` [b]${aLink}[/b] [|]`;

                row = row.replace(/ \[\|\]$/, '') + `\n`;
                bbcode += row;
            });

            bbcode += `[/table]\n`;
        });

        return bbcode.trim();
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

        const manualVils = manualPlayer ? clanVillages.filter(v => v.playerName === manualPlayer) : [];
        const visibleSources = suggestedSources.filter(s => !hiddenSources.includes(s.coord));
        const allPoints = [...activeTargets, ...visibleSources, ...manualVils];

        if (allPoints.length === 0) return;

        let minX = 999, minY = 999, maxX = 0, maxY = 0;
        allPoints.forEach(v => {
            if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
        });

        let padding = 15;
        if (selectedTarget) padding = Math.max(padding, maxSnobDist + 5);

        minX -= padding; minY -= padding; maxX += padding; maxY += padding;
        const mapWidth = maxX - minX;
        const mapHeight = maxY - minY;
        const scale = Math.min(canvas.width / mapWidth, canvas.height / mapHeight);

        const sTarget = activeTargets.find(v => v.coord === selectedTarget);
        if (sTarget) {
            const tx = (sTarget.x - minX) * scale;
            const ty = (sTarget.y - minY) * scale;
            ctx.beginPath(); ctx.arc(tx, ty, maxSnobDist * scale, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(139, 0, 0, 0.1)'; ctx.fill();
            ctx.strokeStyle = 'rgba(139, 0, 0, 0.6)'; ctx.setLineDash([5, 5]);
            ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
        }

        planList.forEach(plan => {
            if (plan.sourceCoord === "-" || hiddenTargets.includes(plan.targetCoord) || hiddenSources.includes(plan.sourceCoord)) return;
            const s = clanVillages.find(v => v.coord === plan.sourceCoord);
            const tObj = activeTargets.find(v => v.coord === plan.targetCoord);
            if (s && tObj) {
                const sx = (s.x - minX) * scale; const sy = (s.y - minY) * scale;
                const tx = (tObj.x - minX) * scale; const ty = (tObj.y - minY) * scale;
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty);
                if (plan.unitType === 'snob') ctx.strokeStyle = 'rgba(139, 0, 0, 0.8)';
                else if (plan.unitType === 'ram' || plan.unitType === 'catapult') ctx.strokeStyle = 'rgba(184, 134, 11, 0.7)';
                else ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1.5; ctx.stroke();
            }
        });

        activeTargets.forEach(v => {
            const vx = (v.x - minX) * scale; const vy = (v.y - minY) * scale;
            const isSelected = v.coord === selectedTarget;

            ctx.beginPath(); ctx.arc(vx, vy, isSelected ? 8 : 5, 0, 2 * Math.PI);
            ctx.fillStyle = isSelected ? "#f0c042" : "#d9534f";
            ctx.fill();
            ctx.strokeStyle = "#fff"; ctx.lineWidth = isSelected ? 2 : 1; ctx.stroke();

            // YENİ: Koordinat yazıları kaldırıldı, sadece seçiliyse hedef ikonu basılır.
            if (isSelected) {
                ctx.font = "14px Arial";
                ctx.fillText("🎯", vx + 10, vy + 5);
            }
        });

        visibleSources.forEach(v => {
            const vx = (v.x - minX) * scale; const vy = (v.y - minY) * scale;
            ctx.beginPath(); ctx.arc(vx, vy, 4, 0, 2 * Math.PI);
            ctx.fillStyle = v.mapColor; ctx.fill();
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
        });

        manualVils.forEach(v => {
            if (!visibleSources.find(s => s.coord === v.coord)) {
                const vx = (v.x - minX) * scale; const vy = (v.y - minY) * scale;
                ctx.beginPath(); ctx.arc(vx, vy, 4, 0, 2 * Math.PI);
                ctx.fillStyle = '#5bc0de';
                ctx.fill();
                ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
            }
        });

    }, [activeTargets, suggestedSources, selectedTarget, planList, maxSnobDist, hiddenTargets, hiddenSources, clanVillages, manualPlayer]);

    // Checkbox labelleri için dinamik obje
    const bbColLabels = {
        no: t('clanOp.columns.no'), player: t('clanOp.columns.player'), source: t('clanOp.columns.source'),
        target: t('clanOp.columns.target'), departure: t('clanOp.columns.departure'),
        arrival: t('clanOp.columns.arrival'), unit: t('clanOp.columns.unit'),
        distance: t('clanOp.columns.distance'), travelTime: t('clanOp.columns.travelTime'), attackLink: t('clanOp.columns.attackLink')
    };

    return (
        <div className="cop-container">
            <h1 className="cop-header">{t('clanOp.title')}</h1>

            <div className="cop-grid">
                <div className="cop-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0 }}>{t('clanOp.step1.title')}</h3>
                        <button className="cop-btn-danger" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={clearAllData}>{t('clanOp.step1.clearAll')}</button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text" className="cop-input" placeholder={t('clanOp.step1.worldUrl')}
                            value={worldUrl} onChange={e => setWorldUrl(e.target.value)} onBlur={loadWorldClans}
                        />
                        <input
                            type="text" className="cop-input" placeholder={t('clanOp.step1.clanTag')}
                            value={clanTag} onChange={e => setClanTag(e.target.value)} list="world-clans-list"
                        />
                        <datalist id="world-clans-list">
                            {worldClans.map(c => <option key={c.id} value={c.tag}>{c.name}</option>)}
                        </datalist>
                    </div>
                    <button className="cop-btn" style={{ width: '100%' }} onClick={handleFetchClan}>{t('clanOp.step1.runIntel')}</button>
                    <div style={{ fontSize: '12px', marginTop: '10px', color: '#5cb85c' }}>{status}</div>
                </div>

                <div className="cop-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>{t('clanOp.step2.title')}</h3>
                        <div style={{ fontSize: '12px' }}>
                            {t('clanOp.step2.snobLimit')} <input type="number" style={{ width: '50px', padding: '2px', background: '#111', color: '#f0c042', border: '1px solid #814c11' }} value={maxSnobDist} onChange={e => setMaxSnobDist(parseInt(e.target.value) || 100)} />
                        </div>
                    </div>
                    <textarea
                        className="cop-textarea" rows="2"
                        placeholder={t('clanOp.step2.placeholder')}
                        value={targetInput} onChange={e => setTargetInput(e.target.value)}
                    />
                    <div style={{ fontSize: '12px', color: '#aaa' }}>{t('clanOp.step2.foundTargets').replace('{{count}}', parsedTargets.length)}</div>
                </div>
            </div>

            {clanVillages.length > 0 && parsedTargets.length > 0 && (
                <div className="cop-box">
                    <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '1px dashed #603000', paddingBottom: '15px' }}>
                        <h3 style={{ borderBottom: 'none', paddingBottom: 0 }}>{t('clanOp.step3.title')}</h3>

                        {/* YENİ: Ortalı ve Karanlık Mod Uyumlu Takvim */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.6)', padding: '10px 20px', borderRadius: '8px', border: '1px solid #814c11', fontSize: '14px', fontWeight: 'bold', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}>
                            <span style={{ color: '#f0c042' }}>{t('clanOp.step3.arrivalTime')}</span>
                            <input
                                type="datetime-local"
                                step="1"
                                style={{
                                    padding: '8px',
                                    background: '#111',
                                    color: '#eaddbd',
                                    border: '1px solid #603000',
                                    borderRadius: '4px',
                                    colorScheme: 'dark', /* YENİ: Tarayıcıya ikonları BEYAZ yapmasını söyler */
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                                value={selectedDateTime}
                                onChange={e => setSelectedDateTime(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="cop-grid" style={{ marginTop: '15px' }}>
                        {/* HEDEFLER */}
                        <div>
                            <div className="cop-inner-box" style={{ marginBottom: '15px' }}>
                                <h4 style={{ color: '#f0c042', margin: '0 0 10px 0' }}>{t('clanOp.step3.targetsTitle')}</h4>
                                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                    {parsedTargets.map(targetObj => {
                                        const isHidden = hiddenTargets.includes(targetObj.coord);
                                        const kamiCount = planList.filter(p => p.targetCoord === targetObj.coord && p.unitType === 'ram').length;
                                        const misCount = planList.filter(p => p.targetCoord === targetObj.coord && p.unitType === 'snob').length;
                                        const fakeCount = planList.filter(p => p.targetCoord === targetObj.coord && p.unitType === 'catapult').length;

                                        return (
                                            <div
                                                key={targetObj.coord}
                                                onClick={() => !isHidden && setSelectedTarget(targetObj.coord)}
                                                className={`cop-list-item ${selectedTarget === targetObj.coord && !isHidden ? 'active' : ''}`}
                                                style={{ opacity: isHidden ? 0.4 : 1, cursor: isHidden ? 'default' : 'pointer' }}
                                            >
                                                <div>
                                                    <b style={{ color: '#d9534f', fontSize: '14px' }}>{targetObj.coord}</b> {targetObj.owner} <span className="cop-points">({targetObj.points.toLocaleString('tr-TR')} {t('clanOp.step3.p')})</span>
                                                    <div className="cop-target-stats">
                                                        <span><img src={unitIcons.ram} alt="Kami" /> {kamiCount}</span>
                                                        <span><img src={unitIcons.snob} alt="Mis" /> {misCount}</span>
                                                        <span><img src={unitIcons.catapult} alt="Fake" /> {fakeCount}</span>
                                                    </div>
                                                </div>
                                                <button className="cop-hide-btn" title={isHidden ? t('clanOp.suggestions.show') : t('clanOp.suggestions.hide')} onClick={(e) => toggleHideTarget(targetObj.coord, e)}>
                                                    {isHidden ? '👁️' : '❌'}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Serbest Oyuncu Atama */}
                            <div className="cop-inner-box" style={{ marginBottom: '15px', borderLeft: '3px solid #5bc0de' }}>
                                <h4 style={{ color: '#5bc0de', margin: '0 0 10px 0' }}>{t('clanOp.manualAssign.title')}</h4>
                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <select style={{ flex: 1, padding: '5px', background: '#111', color: '#f0c042', border: '1px solid #814c11' }} value={manualPlayer} onChange={e => setManualPlayer(e.target.value)}>
                                        <option value="">{t('clanOp.manualAssign.selectPlayer')}</option>
                                        {Object.values(clanPlayers).sort().map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    <select style={{ width: '90px', padding: '5px', background: '#111', color: '#f0c042', border: '1px solid #814c11' }} value={manualUnit} onChange={e => setManualUnit(e.target.value)}>
                                        <option value="ram">{t('clanOp.shortUnits.ram')}</option>
                                        <option value="snob">{t('clanOp.shortUnits.snob')}</option>
                                        <option value="catapult">{t('clanOp.shortUnits.catapult')}</option>
                                        <option value="spy">{t('clanOp.shortUnits.spy')}</option>
                                    </select>
                                    <button className="cop-btn" style={{ background: '#5bc0de', color: '#fff' }} onClick={addManualPlan}>{t('clanOp.manualAssign.assignBtn')}</button>
                                </div>
                                <div style={{ fontSize: '10px', color: '#aaa', marginTop: '5px' }}>{t('clanOp.manualAssign.info')}</div>
                            </div>

                            {/* Taktiksel Öneriler */}
                            <div className="cop-inner-box">
                                <div className="cop-tabs">
                                    <button className={`cop-tab-btn ${suggestionMode === 'closest' ? 'active' : ''}`} onClick={() => setSuggestionMode('closest')}>{t('clanOp.tabs.closest10')}</button>
                                    <button className={`cop-tab-btn ${suggestionMode === 'furthest' ? 'active' : ''}`} onClick={() => setSuggestionMode('furthest')}>{t('clanOp.tabs.furthest10')}</button>
                                    <button className={`cop-tab-btn ${suggestionMode === 'player' ? 'active' : ''}`} onClick={() => setSuggestionMode('player')}>{t('clanOp.tabs.selectPlayer')}</button>
                                </div>

                                {suggestionMode === 'player' && (
                                    <select style={{ width: '100%', padding: '5px', marginBottom: '10px', background: '#111', color: '#f0c042', border: '1px solid #814c11' }} value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)}>
                                        <option value="">{t('clanOp.manualAssign.selectPlayer')}</option>
                                        {Object.values(clanPlayers).sort().map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                )}

                                <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                                    {suggestedSources.length === 0 ? (
                                        <div style={{ padding: '10px', color: '#777', textAlign: 'center', fontSize: '12px' }}>{t('clanOp.suggestions.noVillages')}</div>
                                    ) : suggestedSources.map(s => {
                                        const isHidden = hiddenSources.includes(s.coord);
                                        const activeOrders = planList.filter(p => p.sourceCoord === s.coord);

                                        return (
                                            <div key={s.coord} className="cop-list-item" style={{ opacity: isHidden ? 0.4 : 1 }}>
                                                <div>
                                                    <span className="cop-color-dot" style={{ background: s.mapColor }}></span>
                                                    <span className="cop-player-badge">{s.playerName}</span><br />
                                                    <b>{s.coord}</b> <span className="cop-points">({s.points.toLocaleString('tr-TR')} {t('clanOp.step3.p')})</span><br />
                                                    <span style={{ fontSize: '11px', color: '#aaa' }}>{t('clanOp.step3.distance')} {s.dist.toFixed(1)}</span>

                                                    {activeOrders.length > 0 && (
                                                        <div style={{ marginTop: '5px', fontSize: '10px', color: '#f0ad4e', background: 'rgba(240, 173, 78, 0.1)', padding: '2px 4px', borderRadius: '3px', borderLeft: '2px solid #f0ad4e' }}>
                                                            {activeOrders.map(o => (
                                                                <div key={o.id}>📌 {o.targetCoord} ({t(`clanOp.units.${o.unitType}`, { defaultValue: o.unitType })})</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                    {!isHidden && (
                                                        <>
                                                            <img src={unitIcons.ram} alt="Kami" title={t('clanOp.suggestions.kami')} className="cop-action-icon" onClick={() => addClanPlan(s, 'ram')} />
                                                            <img src={unitIcons.snob} alt="Mis" title={t('clanOp.suggestions.snob')} className="cop-action-icon" onClick={() => addClanPlan(s, 'snob')} />
                                                            <img src={unitIcons.catapult} alt="Fake" title={t('clanOp.suggestions.fake')} className="cop-action-icon" onClick={() => addClanPlan(s, 'catapult')} />
                                                        </>
                                                    )}
                                                    <button className="cop-hide-btn" title={isHidden ? t('clanOp.suggestions.show') : t('clanOp.suggestions.hide')} onClick={(e) => toggleHideSource(s.coord, e)}>
                                                        {isHidden ? '👁️' : '❌'}
                                                    </button>
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
                    <div style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2a1908', flexWrap: 'wrap', gap: '10px' }}>
                        <h4 style={{ margin: 0, color: '#fff' }}>{t('clanOp.queue.title').replace('{{count}}', sortedPlanList.length)}</h4>
                        <button className="cop-btn-danger" onClick={clearQueue} style={{ padding: '6px 12px' }}>{t('clanOp.queue.clear')}</button>
                    </div>
                    <table className="cop-table">
                        <thead>
                            <tr>
                                <th style={{ color: '#fff' }}>{t('clanOp.columns.no')}</th>
                                <th style={{ color: '#fff' }}>{t('clanOp.columns.player')}</th>
                                <th style={{ color: '#fff' }}>{t('clanOp.columns.source')}</th>
                                <th style={{ color: '#fff' }}>{t('clanOp.columns.target')}</th>
                                <th style={{ color: '#fff' }}>{t('clanOp.queue.enemy')}</th>
                                <th style={{ color: '#fff' }}>{t('clanOp.columns.departure')}</th>
                                <th style={{ color: '#fff' }}>{t('clanOp.columns.arrival')}</th>
                                <th style={{ color: '#fff' }}>{t('clanOp.columns.unit')}</th>
                                <th style={{ color: '#fff' }}>{t('clanOp.columns.distance')}</th>
                                <th style={{ color: '#fff' }}>{t('clanOp.columns.travelTime')}</th>
                                <th style={{ color: '#fff' }}>{t('clanOp.columns.attackLink')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPlanList.map((p, index) => (
                                <tr key={p.id}>
                                    <td style={{ fontWeight: 'bold', color: '#eaddbd' }}>{index + 1}</td>
                                    <td><span className="cop-player-badge">{p.player}</span></td>
                                    <td style={{ fontWeight: 'bold', color: '#eaddbd' }}>{p.sourceCoord}</td>
                                    <td style={{ fontWeight: 'bold', color: '#d9534f', fontSize: '13px' }}>{p.targetCoord}</td>
                                    <td style={{ fontWeight: 'bold', color: '#dcb589' }}>{p.targetOwner}</td>
                                    <td style={{ fontWeight: 'bold', color: '#5cb85c' }}>{p.departureTime}</td>
                                    <td style={{ fontWeight: 'bold', color: '#d9534f' }}>{p.arrivalTime}</td>
                                    <td style={{ whiteSpace: 'nowrap', color: '#eaddbd' }}>
                                        {unitIcons[p.unitType] && <img src={unitIcons[p.unitType]} alt={p.unitType} style={{ verticalAlign: 'middle', marginRight: '5px', width: '16px' }} />}
                                        {t(`clanOp.units.${p.unitType}`, { defaultValue: p.unitType })}
                                    </td>
                                    <td style={{ color: '#eaddbd' }}>{p.dist}</td>
                                    <td style={{ color: '#eaddbd' }}>{p.travelTime}</td>
                                    <td><button className="cop-btn-danger" onClick={() => setPlanList(planList.filter(x => x.id !== p.id))}>{t('clanOp.queue.delete')}</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* CANLI BBCODE ŞABLON KUTUSU */}
                    <div style={{ background: '#1a1a1a', padding: '15px', borderTop: '2px solid #603000' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                            <h4 style={{ margin: 0, color: '#f0c042' }}>{t('clanOp.bbcode.title')}</h4>
                            <button className="cop-btn" onClick={() => { navigator.clipboard.writeText(generatedBBCode); showToast(t('clanOp.alerts.copied')); }}>{t('clanOp.bbcode.copyAll')}</button>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px', fontSize: '13px' }}>
                            <b style={{ color: '#dcb589' }}>{t('clanOp.bbcode.selectCols')}</b>
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

            {/* TOAST BİLDİRİM KUTUSU */}
            <div className={`cop-toast ${toastMsg ? 'show' : ''}`}>
                {toastMsg}
            </div>
        </div>
    );
};

export default ClanOpPlanner;