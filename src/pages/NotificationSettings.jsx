// NotificationSettings.jsx

import React, { useEffect, useState } from 'react';
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import './NotificationSettings.css';


// --- İkon SVG Bileşenleri ---
const IconGains = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

const IconLosses = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2 7 10.5 15.5 15.5 10.5 22 17" />
    <polyline points="8 17 2 17 2 11" />
  </svg>
);

const IconBarbarian = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    
    {/* Kalkan */}
    <path d="M12 2L5 5v6c0 5 3.5 8 7 11 3.5-3 7-6 7-11V5l-7-3z" />
    
    {/* Gözler */}
    <circle cx="9" cy="10" r="0.8" fill="currentColor" />
    <circle cx="15" cy="10" r="0.8" fill="currentColor" />
    
    {/* Ağız / maske */}
    <path d="M9 14c1.5 1 4.5 1 6 0" />
    
    {/* Boynuzlar (barbar hissi) */}
    <path d="M5 5c-1-1-2-1-3 0" />
    <path d="M19 5c1-1 2-1 3 0" />
    
  </svg>
);

const IconSelf = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 14h5a3 3 0 0 1 3 3v1a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-1a3 3 0 0 1 3-3z" />
    <circle cx="11" cy="7" r="4" />
    <path d="M8 21a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-1a3 3 0 0 1 3-3h1a3 3 0 0 1 3 3z" />
  </svg>
);

const IconInternal = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="9" x2="15" y2="15" />
    <line x1="15" y1="9" x2="9" y2="15" />
  </svg>
);

const IconEye = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const IconCheckAll = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="7 13 12 18 22 8" />
    <polyline points="2 13 7 18 12 13" />
  </svg>
);

const filterDefinitions = {
  gains: { label: 'Gains', icon: <IconGains /> },
  losses: { label: 'Losses', icon: <IconLosses /> },
  barbarian: { label: 'Barbarian', icon: <IconBarbarian /> },
  selfConquer: { label: 'Self', icon: <IconSelf /> },
  internal: { label: 'Internal', icon: <IconInternal /> }
};

const NotificationSettings = () => {
  const [globalSettings, setGlobalSettings] = useState(() => {
    const saved = localStorage.getItem('twcu_globalSettings');
    return saved ? JSON.parse(saved) : { specialId: '', worldUrl: 'https://ptc1.tribalwars.com.pt/', botToken: '', chatId: '' };
  });

  const [showSecrets, setShowSecrets] = useState({
    specialId: false,
    botToken: false,
    chatId: false
  });

  const toggleSecret = (field) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };


  // YENİ: Periyodik ve OD Ayarları State'i
  const [periodicSettings, setPeriodicSettings] = useState(() => {
    const saved = localStorage.getItem('twcu_periodicSettings');
    return saved ? JSON.parse(saved) : {
      hourlyReport: false,
      dailyReport: true,
      weeklyReport: false,
      sendMap: true,
      trackODAtt: true,
      trackODDef: true,
      trackODSup: true,
      trackAllConquests: false
    };
  });
  
  const [entities, setEntities] = useState(() => {
    const saved = localStorage.getItem('twcu_entities');
    return saved ? JSON.parse(saved) : []; // Varsayılan boş liste
  });

  const initialFilters = { gains: false, losses: false, barbarian: false, selfConquer: false, internal: false };
  const [newName, setNewName] = useState('');
  const [newFilters, setNewFilters] = useState(initialFilters);

  useEffect(() => {
    localStorage.setItem('twcu_globalSettings', JSON.stringify(globalSettings));
  }, [globalSettings]);

  useEffect(() => {
    localStorage.setItem('twcu_periodicSettings', JSON.stringify(periodicSettings));
  }, [periodicSettings]);

  useEffect(() => {
    localStorage.setItem('twcu_entities', JSON.stringify(entities));
  }, [entities]);
  const handleGlobalChange = (e) => setGlobalSettings({ ...globalSettings, [e.target.name]: e.target.value });
  
  const generateSpecialId = () => {
    if (globalSettings.specialId && globalSettings.specialId.length > 0) {
      alert("An ID is already generated! If you want a new one, delete the current ID first.");
      return;
    }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><,./-=";
    let newId = "";
    for (let i = 0; i < 66; i++) {
      newId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGlobalSettings({ ...globalSettings, specialId: newId });
  };

  // Filtrelerin tümünü seçme veya temizleme fonksiyonu
  const handleSelectAllFilters = () => {
    // Hepsi zaten "true" (seçili) ise kontrol et
    const allSelected = Object.values(newFilters).every(val => val === true);
    
    if (allSelected) {
      // Eğer hepsi seçiliyse -> Hepsini temizle
      setNewFilters({ gains: false, losses: false, barbarian: false, selfConquer: false, internal: false });
    } else {
      // Değilse -> Hepsini seç
      setNewFilters({ gains: true, losses: true, barbarian: true, selfConquer: true, internal: true });
    }
  };

  // YENİ: Periyodik ayarları değiştirme fonksiyonu
  const handlePeriodicChange = (e) => setPeriodicSettings({ ...periodicSettings, [e.target.name]: e.target.checked });

  useEffect(() => {
    localStorage.setItem('twcu_globalSettings', JSON.stringify(globalSettings));
  }, [globalSettings]);

  useEffect(() => {
    localStorage.setItem('twcu_periodicSettings', JSON.stringify(periodicSettings));
  }, [periodicSettings]);

  useEffect(() => {
    localStorage.setItem('twcu_entities', JSON.stringify(entities));
  }, [entities]);

  const handleNewFilterChange = (filterName) => setNewFilters({ ...newFilters, [filterName]: !newFilters[filterName] });
  
  const handleToggleEntityFilter = (id, filterKey) => {
    setEntities(entities.map(ent => 
      ent.id === id ? { ...ent, filters: { ...ent.filters, [filterKey]: !ent.filters[filterKey] } } : ent
    ));
  };

  const handleAddEntity = (type) => {
    if (!newName.trim()) { alert("Please enter a name or tag first."); return; }
    const namesArray = newName.split(',').map(n => n.trim()).filter(n => n !== '');
    if (namesArray.length === 0) return;

    const newEntries = namesArray.map((name, index) => ({
      id: Date.now() + index,
      type: type,
      name: name,
      filters: { ...newFilters }
    }));

    setEntities([...newEntries, ...entities]);
    setNewName('');
    setNewFilters(initialFilters);
  };

  const handleRemove = (id) => setEntities(entities.filter(ent => ent.id !== id));

  const generateConfigPayload = () => {
    return {
      global_settings: {
        special_access_id: globalSettings.specialId || "[EMPTY]",
        world_link: globalSettings.worldUrl || "[EMPTY]",
        telegram_bot_token: globalSettings.botToken ? "*****HIDDEN*****" : "[EMPTY]",
        telegram_chat_id: globalSettings.chatId || "[EMPTY]"
      },
      periodic_reports: { ...periodicSettings }, // YENİ: JSON'a eklendi
      monitored_players: entities.filter(e => e.type === 'Player').map(p => ({
        name: p.name,
        active_filters: Object.keys(p.filters).filter(k => p.filters[k])
      })),
      monitored_tribes: entities.filter(e => e.type === 'Tribe').map(t => ({
        tag: t.name,
        active_filters: Object.keys(t.filters).filter(k => t.filters[k])
      }))
    };
  };

 const handleSave = async () => {
    // 1. Ekrandaki tüm ayarları JSON formatında topla
    const payload = generateConfigPayload();
    
    // 2. Kullanıcının formda girdiği Special Access ID'yi al
    const specialId = payload.global_settings?.special_access_id?.trim();

    // Güvenlik kontrolü: Şifre girilmemişse veya boşsa kaydetmeyi durdur
    if (!specialId || specialId === "" || specialId === "[EMPTY]") {
      alert("Hata: Ayarları kaydetmek için lütfen geçerli bir Special Access ID (Lisans) girin!");
      return; 
    }

    try {
      // 3. Firebase'e "users > [KULLANICI_ID]" yoluna kaydet
      // { merge: true } ile belge yoksa oluşturulur, varsa sadece değişen kısımlar üzerine yazılır
      const userRef = doc(db, "users", specialId);
      await setDoc(userRef, payload, { merge: true });
      
      alert("Ayarlar başarıyla kaydedildi! Sistem lisansın üzerinden çalışacak.");
    } catch (error) {
      console.error("Error saving config: ", error);
      alert("Ayarlar Firebase'e kaydedilirken bir hata oluştu.");
    }
  };

  return (
    <div className="twcu-container">
      <div className="twcu-panel">
        <div className="twcu-header-container">
          <h2 className="twcu-header">TwCu Notification Hub</h2>
          <p className="twcu-subtitle">Manage your real-time tribal war alerts</p>
        </div>

        {/* --- GLOBAL SETTINGS --- */}
        <div className="section-block">
          <h3 className="section-title">Global Settings</h3>
          <div className="settings-grid">
            {/* SPECIAL ACCESS ID */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Special Access ID <span style={{color: '#ff4d4d'}}>*Required</span></label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input 
                    type={showSecrets.specialId ? "text" : "password"} 
                    name="specialId" 
                    className="twcu-input" 
                    placeholder="Enter or generate a 66-char license ID" 
                    value={globalSettings.specialId} 
                    onChange={handleGlobalChange} 
                    style={{ width: '100%', paddingRight: '40px', fontFamily: 'monospace' }} 
                  />
                  <button type="button" onClick={() => toggleSecret('specialId')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                    {showSecrets.specialId ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                <button 
                  type="button"
                  className="btn" 
                  style={{ backgroundColor: '#ff4d4d', color: 'white', padding: '0 20px', whiteSpace: 'nowrap', opacity: globalSettings.specialId ? 0.6 : 1, cursor: globalSettings.specialId ? 'not-allowed' : 'pointer' }} 
                  onClick={generateSpecialId}
                >
                  ⚙️ Generate ID
                </button>
              </div>
              <small style={{ color: '#888', marginTop: '5px', display: 'block' }}>
                Generate a unique 66-character ID and send it to the admin for activation.
              </small>
            </div>
            <div className="form-group">
              <label>World Link</label>
              <input type="url" name="worldUrl" className="twcu-input" placeholder="https://ptc1.tribalwars.com.pt/" value={globalSettings.worldUrl} onChange={handleGlobalChange} />
            </div>
            {/* TELEGRAM BOT TOKEN */}
            <div className="form-group">
              <label>Telegram Bot Token</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showSecrets.botToken ? "text" : "password"} 
                  name="botToken" 
                  className="twcu-input" 
                  placeholder="123456789:ABCDEF..." 
                  value={globalSettings.botToken} 
                  onChange={handleGlobalChange} 
                  style={{ width: '100%', paddingRight: '40px' }} 
                />
                <button type="button" onClick={() => toggleSecret('botToken')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                  {showSecrets.botToken ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
                Get this from <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" style={{color: '#ff4d4d'}}>@BotFather</a>
              </small>
            </div>
            {/* TELEGRAM CHAT ID */}
            <div className="form-group">
              <label>Telegram Chat ID</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showSecrets.chatId ? "text" : "password"} 
                  name="chatId" 
                  className="twcu-input" 
                  placeholder="e.g., 1135068175" 
                  value={globalSettings.chatId} 
                  onChange={handleGlobalChange} 
                  style={{ width: '100%', paddingRight: '40px' }} 
                />
                <button type="button" onClick={() => toggleSecret('chatId')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                  {showSecrets.chatId ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
                Get this from <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" style={{color: '#ff4d4d'}}>@userinfobot</a>
              </small>
            </div>
          </div>
        </div>

        {/* --- YENİ: PERIODIC REPORTS & OD STATS --- */}
        <div className="section-block">
          <h3 className="section-title">Report & Statistics Settings</h3>
          
          <div className="toggle-grid">
            {/* Periodic Reports */}
            <div className="toggle-column">
              <h4 className="toggle-column-title">Periodic Reports</h4>
              
              <label className="modern-toggle">
                <input type="checkbox" name="hourlyReport" checked={periodicSettings.hourlyReport} onChange={handlePeriodicChange} />
                <div className="toggle-slider"></div>
                <span className="toggle-label">Hourly Summary <small>(Counts only)</small></span>
              </label>
              
              <label className="modern-toggle">
                <input type="checkbox" name="dailyReport" checked={periodicSettings.dailyReport} onChange={handlePeriodicChange} />
                <div className="toggle-slider"></div>
                <span className="toggle-label">Daily Report <small>(OD Stats + Counts)</small></span>
              </label>

              <label className="modern-toggle">
                <input type="checkbox" name="weeklyReport" checked={periodicSettings.weeklyReport} onChange={handlePeriodicChange} />
                <div className="toggle-slider"></div>
                <span className="toggle-label">Weekly Report <small>(Full Performance)</small></span>
              </label>

              <label className="modern-toggle">
                <input type="checkbox" name="sendMap" checked={periodicSettings.sendMap} onChange={handlePeriodicChange} />
                <div className="toggle-slider"></div>
                <span className="toggle-label">Attach Map Image <small>(Visual Reports)</small></span>
              </label>
            </div>

            {/* OD Statistics */}
            <div className="toggle-column">
              <h4 className="toggle-column-title">OD (Kill) Tracking</h4>
              
              <label className="modern-toggle">
                <input type="checkbox" name="trackODAtt" checked={periodicSettings.trackODAtt} onChange={handlePeriodicChange} />
                <div className="toggle-slider"></div>
                <span className="toggle-label">Track Attack <small>(OD-A)</small></span>
              </label>
              
              <label className="modern-toggle">
                <input type="checkbox" name="trackODDef" checked={periodicSettings.trackODDef} onChange={handlePeriodicChange} />
                <div className="toggle-slider"></div>
                <span className="toggle-label">Track Defense <small>(OD-D)</small></span>
              </label>

              <label className="modern-toggle">
                <input type="checkbox" name="trackODSup" checked={periodicSettings.trackODSup} onChange={handlePeriodicChange} />
                <div className="toggle-slider"></div>
                <span className="toggle-label">Track Support <small>(OD-S)</small></span>
              </label>
            </div>
          </div>
        </div>

        {/* Global Monitoring Section */}
<div className="section-block" style={{ border: '1px solid #ff4d4d', backgroundColor: 'rgba(255, 77, 77, 0.05)' }}>
  <h3 className="section-title" style={{ color: '#ff4d4d' }}>🌍 Global World Monitoring</h3>
  <label className="modern-toggle">
    <input 
      type="checkbox" 
      name="trackAllConquests" 
      checked={periodicSettings.trackAllConquests} 
      onChange={handlePeriodicChange} 
    />
    <div className="toggle-slider" style={{ backgroundColor: periodicSettings.trackAllConquests ? '#ff4d4d' : '' }}></div>
    <span className="toggle-label">
      Track All World Conquests 
      <small style={{ display: 'block', color: '#888' }}>
        Notify for EVERY village change in the last 10 minutes. (No stats tracked)
      </small>
    </span>
  </label>
</div>

        {/* --- ADD NEW ENTRY --- */}
        <div className="section-block">
          <h3 className="section-title">Add New Target</h3>
          <div className="form-group">
            <label>Target Name or Tribe Tag</label>
            <input type="text" className="twcu-input" placeholder="e.g., Player1, Player2 or ALLY1, ALLY2" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          
          <div className="circle-filter-group" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Mevcut Filtre İkonları */}
            {Object.keys(newFilters).map(key => (
              <div key={`new-${key}`} className={`circle-toggle ${newFilters[key] ? 'active' : ''}`} onClick={() => handleNewFilterChange(key)}>
                <div className="icon-wrapper">{filterDefinitions[key].icon}</div>
                <span className="icon-label">{filterDefinitions[key].label}</span>
              </div>
            ))}

            {/* Araya Küçük Bir Ayırıcı Çizgi */}
            <div style={{ width: '1px', height: '40px', backgroundColor: '#ddd', margin: '0 10px' }}></div>

            {/* YENİ: Tümünü Seç / Temizle Butonu */}
            <div 
              className="circle-toggle" 
              onClick={handleSelectAllFilters}
              style={{ borderStyle: 'dashed', borderColor: Object.values(newFilters).every(v => v) ? '#4caf50' : '#ff4d4d' }}
              title="Select / Deselect All"
            >
              <div className="icon-wrapper" style={{ color: Object.values(newFilters).every(v => v) ? '#4caf50' : '#ff4d4d' }}>
                <IconCheckAll />
              </div>
              <span className="icon-label">
                {Object.values(newFilters).every(v => v) ? "Clear All" : "Select All"}
              </span>
            </div>
          </div>

          <div className="action-buttons" style={{ marginTop: '20px' }}>
            <button className="btn btn-player" onClick={() => handleAddEntity('Player')}>+ Add as Player</button>
            <button className="btn btn-tribe" onClick={() => handleAddEntity('Tribe')}>+ Add as Tribe</button>
          </div>
        </div>

        {/* --- MANAGE NOTIFICATIONS (ACTIVE LIST) --- */}
        <div className="section-block">
          <h3 className="section-title">Manage Notifications</h3>
          <div className="entities-container">
            {entities.length === 0 ? (
              <div className="empty-state">No targets monitored yet.</div>
            ) : (
              entities.map(ent => (
                <div className="entity-row" key={ent.id}>
                  <div className="entity-info-col">
                    <span className={`type-badge ${ent.type === 'Player' ? 'player' : 'tribe'}`}>{ent.type}</span>
                    <h4 className="entity-name">{ent.name}</h4>
                  </div>
                  <div className="entity-filters-col">
                    {Object.keys(ent.filters).map(key => (
                      <div key={`${ent.id}-${key}`} className={`circle-toggle mini ${ent.filters[key] ? 'active' : ''}`} onClick={() => handleToggleEntityFilter(ent.id, key)} title={`Toggle ${filterDefinitions[key].label}`}>
                        <div className="icon-wrapper">{filterDefinitions[key].icon}</div>
                        <span className="icon-label">{filterDefinitions[key].label}</span>
                      </div>
                    ))}
                  </div>
                  <button className="btn-trash" onClick={() => handleRemove(ent.id)}><IconTrash /></button>
                </div>
              ))
            )}
          </div>
        </div>

        <button className="btn btn-save" onClick={handleSave}>Save Configuration</button>

        <div className="json-preview">
          <div className="json-header">Live Configuration State</div>
          <pre>{JSON.stringify(generateConfigPayload(), null, 2)}</pre>
        </div>

      </div>
    </div>
  );
};

export default NotificationSettings;