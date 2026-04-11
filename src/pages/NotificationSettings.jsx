// NotificationSettings.jsx

import React, { useEffect, useState } from 'react';
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import './NotificationSettings.css';

// --- İkon SVG Bileşenleri ---
const IconGains = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>);
const IconLosses = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 7 10.5 15.5 15.5 10.5 22 17" /><polyline points="8 17 2 17 2 11" /></svg>);
const IconBarbarian = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L5 5v6c0 5 3.5 8 7 11 3.5-3 7-6 7-11V5l-7-3z" /><circle cx="9" cy="10" r="0.8" fill="currentColor" /><circle cx="15" cy="10" r="0.8" fill="currentColor" /><path d="M9 14c1.5 1 4.5 1 6 0" /><path d="M5 5c-1-1-2-1-3 0" /><path d="M19 5c1-1 2-1 3 0" /></svg>);
const IconSelf = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14h5a3 3 0 0 1 3 3v1a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-1a3 3 0 0 1 3-3z" /><circle cx="11" cy="7" r="4" /><path d="M8 21a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-1a3 3 0 0 1 3-3h1a3 3 0 0 1 3 3z" /></svg>);
const IconInternal = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
const IconTrash = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" /></svg>);
const IconEye = () => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>);
const IconEyeOff = () => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>);
const IconCheckAll = () => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 22 8" /><polyline points="2 13 7 18 12 13" /></svg>);
const IconChevronDown = () => (<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>);
const IconChevronUp = () => (<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>);
const IconPlus = () => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);

const filterDefinitions = {
  gains: { label: 'Gains', icon: <IconGains /> },
  losses: { label: 'Losses', icon: <IconLosses /> },
  barbarian: { label: 'Barbarian', icon: <IconBarbarian /> },
  selfConquer: { label: 'Self', icon: <IconSelf /> },
  internal: { label: 'Internal', icon: <IconInternal /> }
};

const initialFilters = { gains: false, losses: false, barbarian: false, selfConquer: false, internal: false };

const createEmptyConfig = () => ({
  uiId: Date.now() + Math.random(),
  isExpanded: true,
  globalSettings: { specialId: '', worldUrl: '', botToken: '', chatId: '' },
  periodicSettings: { hourlyReport: false, dailyReport: true, weeklyReport: false, sendMap: true, trackODAtt: true, trackODDef: true, trackODSup: true, trackAllConquests: false },
  entities: [],
  newName: '', 
  newFilters: { ...initialFilters }
});

const NotificationSettings = () => {
  // --- ÇOKLU KONFİGÜRASYON STATE'İ ---
  const [configs, setConfigs] = useState(() => {
    const savedConfigs = localStorage.getItem('twcu_configs_multi');
    if (savedConfigs) {
      return JSON.parse(savedConfigs);
    }
    
    // Eski tekli ayarları yeni çoklu yapıya göç ettir (Migration)
    const oldGlobal = localStorage.getItem('twcu_globalSettings');
    if (oldGlobal) {
      return [{
        ...createEmptyConfig(),
        globalSettings: JSON.parse(oldGlobal),
        periodicSettings: JSON.parse(localStorage.getItem('twcu_periodicSettings')) || createEmptyConfig().periodicSettings,
        entities: JSON.parse(localStorage.getItem('twcu_entities')) || [],
      }];
    }
    
    // Hiçbir şey yoksa boş bir tane aç
    return [createEmptyConfig()];
  });

  const [showSecrets, setShowSecrets] = useState({});

  useEffect(() => {
    localStorage.setItem('twcu_configs_multi', JSON.stringify(configs));
  }, [configs]);

  // --- YARDIMCI FONKSİYONLAR ---
  const updateConfig = (cIndex, field, subField, value) => {
    setConfigs(prev => prev.map((c, i) => {
      if (i !== cIndex) return c;
      if (subField) {
        return { ...c, [field]: { ...c[field], [subField]: value } };
      }
      return { ...c, [field]: value };
    }));
  };

  const toggleSecret = (id) => setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleAccordion = (cIndex) => {
    setConfigs(prev => prev.map((c, i) => i === cIndex ? { ...c, isExpanded: !c.isExpanded } : c));
  };

  const addNewProfile = () => {
    setConfigs(prev => [{ ...createEmptyConfig() }, ...prev.map(c => ({ ...c, isExpanded: false }))]);
  };

  const removeProfile = (cIndex) => {
    if (window.confirm("Bu dünya ayarlarını tamamen silmek istediğinize emin misiniz?")) {
      setConfigs(prev => prev.filter((_, i) => i !== cIndex));
    }
  };

  const generateSpecialId = (cIndex, currentId) => {
    if (currentId && currentId.length > 0) {
      alert("Zaten bir ID var! Yenisini istiyorsanız önce kutuyu temizleyin.");
      return;
    }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><,-=";
    let newId = "";
    for (let i = 0; i < 66; i++) newId += chars.charAt(Math.floor(Math.random() * chars.length));
    updateConfig(cIndex, 'globalSettings', 'specialId', newId);
  };

  const getWorldName = (url) => {
    if (!url) return "Yeni Konfigürasyon";
    try { return new URL(url).hostname.split('.')[0].toUpperCase(); } 
    catch { return "Bilinmeyen Dünya"; }
  };

  // --- ENTITY (HEDEF) İŞLEMLERİ ---
  const handleSelectAllFilters = (cIndex, currentFilters) => {
    const allSelected = Object.values(currentFilters).every(val => val === true);
    const newF = allSelected ? { gains: false, losses: false, barbarian: false, selfConquer: false, internal: false } 
                             : { gains: true, losses: true, barbarian: true, selfConquer: true, internal: true };
    updateConfig(cIndex, 'newFilters', null, newF);
  };

  const handleAddEntity = (cIndex, type, newName, currentFilters, currentEntities) => {
    if (!newName.trim()) { alert("Lütfen önce bir isim veya klan tagı girin."); return; }
    
    let namesArray = newName.split(',').map(n => n.trim()).filter(n => n !== '');
    if (namesArray.length === 0) return;
    namesArray = [...new Set(namesArray)]; // Kendi içindeki tekrarları sil

    const uniqueNames = namesArray.filter(name => {
      const isDuplicate = currentEntities.some(ent => ent.type === type && ent.name.toLowerCase() === name.toLowerCase());
      return !isDuplicate;
    });

    if (uniqueNames.length === 0) {
      alert("Girdiğiniz hedefler zaten takip listesinde mevcut!");
      return;
    }

    const newEntries = uniqueNames.map((name, index) => ({
      id: Date.now() + index,
      type: type,
      name: name,
      filters: { ...currentFilters }
    }));

    updateConfig(cIndex, 'entities', null, [...newEntries, ...currentEntities]);
    updateConfig(cIndex, 'newName', null, '');
    updateConfig(cIndex, 'newFilters', null, { ...initialFilters });
  };

  const handleToggleEntityFilter = (cIndex, entityId, filterKey, currentEntities) => {
    const updated = currentEntities.map(ent => 
      ent.id === entityId ? { ...ent, filters: { ...ent.filters, [filterKey]: !ent.filters[filterKey] } } : ent
    );
    updateConfig(cIndex, 'entities', null, updated);
  };

  const handleRemoveEntity = (cIndex, entityId, currentEntities) => {
    updateConfig(cIndex, 'entities', null, currentEntities.filter(ent => ent.id !== entityId));
  };

  // --- KAYDETME İŞLEMİ (ÇOKLU) ---
  const generateConfigPayload = (config) => ({
    global_settings: {
      special_access_id: config.globalSettings.specialId || "[EMPTY]",
      world_link: config.globalSettings.worldUrl || "[EMPTY]",
      telegram_bot_token: config.globalSettings.botToken || "[EMPTY]",
      telegram_chat_id: config.globalSettings.chatId || "[EMPTY]"
    },
    periodic_reports: { ...config.periodicSettings },
    monitored_players: config.entities.filter(e => e.type === 'Player').map(p => ({
      name: p.name,
      active_filters: Object.keys(p.filters).filter(k => p.filters[k])
    })),
    monitored_tribes: config.entities.filter(e => e.type === 'Tribe').map(t => ({
      tag: t.name,
      active_filters: Object.keys(t.filters).filter(k => t.filters[k])
    }))
  });

  const handleSave = async () => {
    let successCount = 0;
    let errorCount = 0;

    for (const config of configs) {
      const payload = generateConfigPayload(config);
      const specialId = payload.global_settings.special_access_id.trim();

      if (!specialId || specialId === "[EMPTY]") continue; // Boş olanları atla

      try {
        const userRef = doc(db, "users", specialId);
        await setDoc(userRef, payload, { merge: true });
        successCount++;
      } catch (error) {
        console.error("Kayıt hatası: ", error);
        errorCount++;
      }
    }

    if (successCount > 0) alert(`${successCount} adet dünya ayarı Firebase'e başarıyla kaydedildi!`);
    if (errorCount > 0) alert(`${errorCount} adet ayar kaydedilirken hata oluştu.`);
    if (successCount === 0 && errorCount === 0) alert("Kaydedilecek geçerli bir Special Access ID bulunamadı.");
  };

  return (
    <div className="twcu-container">
      <div className="twcu-panel">
        <div className="twcu-header-container" style={{ position: 'relative' }}>
          <h2 className="twcu-header">TwCu Notification Hub</h2>
          <p className="twcu-subtitle">Manage your real-time tribal war alerts across multiple worlds</p>
          <button 
            className="btn btn-player" 
            style={{ position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={addNewProfile}
          >
            <IconPlus /> Yeni Dünya Ekle
          </button>
        </div>

        {/* --- AKORDEON DÖNGÜSÜ --- */}
        {configs.map((config, cIndex) => (
          <div key={config.uiId} style={{ marginBottom: '20px', border: '1px solid #444', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#1e1e1e' }}>
            
            {/* Akordeon Başlığı */}
            <div 
              style={{ padding: '15px 20px', backgroundColor: '#2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: config.isExpanded ? '1px solid #444' : 'none' }}
              onClick={() => toggleAccordion(cIndex)}
            >
              <h3 style={{ margin: 0, color: '#e0e0e0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#ff4d4d' }}>⚙️ Profil {cIndex + 1}</span> 
                <span style={{ color: '#888', fontSize: '14px' }}>({getWorldName(config.globalSettings.worldUrl)})</span>
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeProfile(cIndex); }} 
                  style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}
                >
                  Sil
                </button>
                {config.isExpanded ? <IconChevronUp /> : <IconChevronDown />}
              </div>
            </div>

            {/* Akordeon İçeriği */}
            {config.isExpanded && (
              <div style={{ padding: '20px' }}>
                {/* GLOBAL SETTINGS */}
                <div className="section-block">
                  <h3 className="section-title">Global Settings</h3>
                  <div className="settings-grid">
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Special Access ID <span style={{color: '#ff4d4d'}}>*Required</span></label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <input 
                            type={showSecrets[`${config.uiId}_id`] ? "text" : "password"} 
                            className="twcu-input" placeholder="Enter or generate a 66-char license ID" 
                            value={config.globalSettings.specialId} 
                            onChange={(e) => updateConfig(cIndex, 'globalSettings', 'specialId', e.target.value)} 
                            style={{ width: '100%', paddingRight: '40px', fontFamily: 'monospace' }} 
                          />
                          <button type="button" onClick={() => toggleSecret(`${config.uiId}_id`)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                            {showSecrets[`${config.uiId}_id`] ? <IconEyeOff /> : <IconEye />}
                          </button>
                        </div>
                        <button type="button" className="btn" style={{ backgroundColor: '#ff4d4d', color: 'white', padding: '0 20px', whiteSpace: 'nowrap', opacity: config.globalSettings.specialId ? 0.6 : 1, cursor: config.globalSettings.specialId ? 'not-allowed' : 'pointer' }} onClick={() => generateSpecialId(cIndex, config.globalSettings.specialId)}>
                          ⚙️ Generate ID
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>World Link</label>
                      <input type="url" className="twcu-input" placeholder="https://ptc1.tribalwars.com.pt/" value={config.globalSettings.worldUrl} onChange={(e) => updateConfig(cIndex, 'globalSettings', 'worldUrl', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Telegram Bot Token</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showSecrets[`${config.uiId}_bot`] ? "text" : "password"} className="twcu-input" placeholder="123456789:ABCDEF..." value={config.globalSettings.botToken} onChange={(e) => updateConfig(cIndex, 'globalSettings', 'botToken', e.target.value)} style={{ width: '100%', paddingRight: '40px' }} />
                        <button type="button" onClick={() => toggleSecret(`${config.uiId}_bot`)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                          {showSecrets[`${config.uiId}_bot`] ? <IconEyeOff /> : <IconEye />}
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Telegram Chat ID</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showSecrets[`${config.uiId}_chat`] ? "text" : "password"} className="twcu-input" placeholder="e.g., 1135068175" value={config.globalSettings.chatId} onChange={(e) => updateConfig(cIndex, 'globalSettings', 'chatId', e.target.value)} style={{ width: '100%', paddingRight: '40px' }} />
                        <button type="button" onClick={() => toggleSecret(`${config.uiId}_chat`)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                          {showSecrets[`${config.uiId}_chat`] ? <IconEyeOff /> : <IconEye />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PERIODIC REPORTS & OD STATS */}
                <div className="section-block">
                  <h3 className="section-title">Report & Statistics Settings</h3>
                  <div className="toggle-grid">
                    <div className="toggle-column">
                      <h4 className="toggle-column-title">Periodic Reports</h4>
                      {['hourlyReport', 'dailyReport', 'weeklyReport', 'sendMap'].map(key => (
                        <label className="modern-toggle" key={key}>
                          <input type="checkbox" checked={config.periodicSettings[key]} onChange={(e) => updateConfig(cIndex, 'periodicSettings', key, e.target.checked)} />
                          <div className="toggle-slider"></div>
                          <span className="toggle-label">{key.replace('Report', ' Report').replace('sendMap', 'Attach Map Image')}</span>
                        </label>
                      ))}
                    </div>
                    <div className="toggle-column">
                      <h4 className="toggle-column-title">OD (Kill) Tracking</h4>
                      {['trackODAtt', 'trackODDef', 'trackODSup'].map(key => (
                        <label className="modern-toggle" key={key}>
                          <input type="checkbox" checked={config.periodicSettings[key]} onChange={(e) => updateConfig(cIndex, 'periodicSettings', key, e.target.checked)} />
                          <div className="toggle-slider"></div>
                          <span className="toggle-label">{key.replace('trackOD', 'Track OD-')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Global Monitoring */}
                <div className="section-block" style={{ border: '1px solid #ff4d4d', backgroundColor: 'rgba(255, 77, 77, 0.05)' }}>
                  <h3 className="section-title" style={{ color: '#ff4d4d' }}>🌍 Global World Monitoring</h3>
                  <label className="modern-toggle">
                    <input type="checkbox" checked={config.periodicSettings.trackAllConquests} onChange={(e) => updateConfig(cIndex, 'periodicSettings', 'trackAllConquests', e.target.checked)} />
                    <div className="toggle-slider" style={{ backgroundColor: config.periodicSettings.trackAllConquests ? '#ff4d4d' : '' }}></div>
                    <span className="toggle-label">Track All World Conquests</span>
                  </label>
                </div>

                {/* ADD NEW TARGET */}
                <div className="section-block">
                  <h3 className="section-title">Add New Target</h3>
                  <div className="form-group">
                    <label>Target Name or Tribe Tag</label>
                    <input type="text" className="twcu-input" placeholder="e.g., Player1, Player2 or ALLY1" value={config.newName} onChange={(e) => updateConfig(cIndex, 'newName', null, e.target.value)} />
                  </div>
                  
                  <div className="circle-filter-group" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {Object.keys(config.newFilters).map(key => (
                      <div key={`new-${key}`} className={`circle-toggle ${config.newFilters[key] ? 'active' : ''}`} onClick={() => updateConfig(cIndex, 'newFilters', key, !config.newFilters[key])}>
                        <div className="icon-wrapper">{filterDefinitions[key].icon}</div>
                        <span className="icon-label">{filterDefinitions[key].label}</span>
                      </div>
                    ))}
                    <div style={{ width: '1px', height: '40px', backgroundColor: '#ddd', margin: '0 10px' }}></div>
                    <div className="circle-toggle" onClick={() => handleSelectAllFilters(cIndex, config.newFilters)} style={{ borderStyle: 'dashed', borderColor: Object.values(config.newFilters).every(v => v) ? '#4caf50' : '#ff4d4d' }}>
                      <div className="icon-wrapper" style={{ color: Object.values(config.newFilters).every(v => v) ? '#4caf50' : '#ff4d4d' }}><IconCheckAll /></div>
                      <span className="icon-label">{Object.values(config.newFilters).every(v => v) ? "Clear All" : "Select All"}</span>
                    </div>
                  </div>

                  <div className="action-buttons" style={{ marginTop: '20px' }}>
                    <button className="btn btn-player" onClick={() => handleAddEntity(cIndex, 'Player', config.newName, config.newFilters, config.entities)}>+ Add as Player</button>
                    <button className="btn btn-tribe" onClick={() => handleAddEntity(cIndex, 'Tribe', config.newName, config.newFilters, config.entities)}>+ Add as Tribe</button>
                  </div>
                </div>

                {/* MANAGE NOTIFICATIONS */}
                <div className="section-block">
                  <h3 className="section-title">Manage Notifications</h3>
                  <div className="entities-container">
                    {config.entities.length === 0 ? <div className="empty-state">No targets monitored yet.</div> : (
                      config.entities.map(ent => (
                        <div className="entity-row" key={ent.id}>
                          <div className="entity-info-col">
                            <span className={`type-badge ${ent.type === 'Player' ? 'player' : 'tribe'}`}>{ent.type}</span>
                            <h4 className="entity-name">{ent.name}</h4>
                          </div>
                          <div className="entity-filters-col">
                            {Object.keys(ent.filters).map(key => (
                              <div key={`${ent.id}-${key}`} className={`circle-toggle mini ${ent.filters[key] ? 'active' : ''}`} onClick={() => handleToggleEntityFilter(cIndex, ent.id, key, config.entities)}>
                                <div className="icon-wrapper">{filterDefinitions[key].icon}</div>
                                <span className="icon-label">{filterDefinitions[key].label}</span>
                              </div>
                            ))}
                          </div>
                          <button className="btn-trash" onClick={() => handleRemoveEntity(cIndex, ent.id, config.entities)}><IconTrash /></button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        ))}

        <button className="btn btn-save" onClick={handleSave} style={{ width: '100%', fontSize: '18px', padding: '15px' }}>💾 Tüm Konfigürasyonları Kaydet</button>

      </div>
    </div>
  );
};

export default NotificationSettings;