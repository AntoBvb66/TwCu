import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Sidebar.css';

function Sidebar() {
    const location = useLocation();
    const { t, i18n } = useTranslation();

    const [isOpen, setIsOpen] = useState(false);        
    const [isCollapsed, setIsCollapsed] = useState(false); 
    const [isLangOpen, setIsLangOpen] = useState(false); // YENİ: Dil menüsü aç/kapa state'i

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('appLanguage', lng);
        setIsLangOpen(false); // Seçim yapınca menüyü kapat
    };

    // Desteklenen Diller Listesi
const languages = [
    { code: 'tr', flag: 'tr', label: 'TR' }, // Türkçe
    { code: 'en', flag: 'gb', label: 'EN' }, // İngilizce
    { code: 'hr', flag: 'hr', label: 'HR' }, // Hırvatça
    { code: 'cz', flag: 'cz', label: 'CZ' }, // Çekçe
    { code: 'dk', flag: 'dk', label: 'DK' }, // Danca
    { code: 'nl', flag: 'nl', label: 'NL' }, // Felemenkçe
    { code: 'fr', flag: 'fr', label: 'FR' }, // Fransızca
    { code: 'de', flag: 'de', label: 'DE' }, // Almanca
    { code: 'gr', flag: 'gr', label: 'GR' }, // Yunanca
    { code: 'hu', flag: 'hu', label: 'HU' }, // Macarca
    { code: 'it', flag: 'it', label: 'IT' }, // İtalyanca
    { code: 'no', flag: 'no', label: 'NO' }, // Norveççe
    { code: 'pl', flag: 'pl', label: 'PL' }, // Lehçe
    { code: 'br', flag: 'br', label: 'BR' }, // Portekizce (Brezilya)
    { code: 'pt', flag: 'pt', label: 'PT' }, // Portekizce (Portekiz)
    { code: 'ro', flag: 'ro', label: 'RO' }, // Romence
    { code: 'ru', flag: 'ru', label: 'RU' }, // Rusça
    { code: 'sk', flag: 'sk', label: 'SK' }, // Slovakça
    { code: 'si', flag: 'si', label: 'SI' }, // Slovence
    { code: 'es', flag: 'es', label: 'ES' }, // İspanyolca
    { code: 'se', flag: 'se', label: 'SE' }, // İsveççe
    { code: 'ch', flag: 'ch', label: 'CH' }, // İsviçre Almancası
    { code: 'th', flag: 'th', label: 'TH' }, // Tayca
    { code: 'ua', flag: 'ua', label: 'UA' }  // Ukraynaca
];

    const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

    const menuItems = [
        { path: '/clan-op', label: t('menu.items.clanOp'), icon: '📜' },
        { path: '/clan-troop-op', label: t('menu.items.clanTroop'), icon: '🪖' },
        { path: '/op-planner', label: t('menu.items.opPlanner'), icon: '🎯' },
        { path: '/fast-support', label: t('menu.items.fastSupport'), icon: '🛡️' },

        { path: '/building-planner', label: t('menu.items.buildingPlanner'), icon: '🏰' },
        { path: '/building-times', label: t('menu.items.buildingTimes'), icon: '⏳' },
        { path: '/unit-calculator', label: t('menu.items.unitCalculator'), icon: '⚔️' },

        { path: '/scavenging', label: t('scavenging.title'), icon: '🏕️' },
        { path: '/production-data', label: t('menu.items.productionData'), icon: '⛏️' },
        { path: '/coin-minter', label: t('menu.items.coinMinter'), icon: '💰' },

        { path: '/map-generator', label: t('menu.items.mapGenerator'), icon: '🌍' },
        { path: '/map-analysis', label: t('menu.items.mapAnalysis'), icon: '🧭' },
        { path: '/church-planner', label: t('menu.items.churchPlanner'), icon: '⛪' },
        { path: '/notification-settings', label: t('menu.items.notificationSettings'), icon: '🔔' }
    ];

    return (
        <>
            <div className="mobile-topbar" style={{ display: window.innerWidth <= 768 ? 'flex' : 'none' }}>
                <button className="hamburger" onClick={() => setIsOpen(!isOpen)}>☰</button>
                <div className="logo">
                    <img 
                        src={`${import.meta.env.BASE_URL}logo192.png`} 
                        alt="TW" 
                        style={{ width: '32px', height: '32px', borderRadius: '6px' }} 
                    />
                    <span>{t('menu.title')}</span>
                </div>
            </div>

            <nav className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isOpen ? 'open' : ''}`}>
               <div className="sidebar-header" style={{ position: 'relative' }}>
                    <Link 
                        to="/" 
                        style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }} 
                        onClick={() => setIsOpen(false)}
                    >
                        <img src={`${import.meta.env.BASE_URL}logo192.png`} alt="TW Logo" className="sidebar-logo-img" />
                        <h1 className="sidebar-logo-text">{t('menu.title')}</h1>
                    </Link>

                    {/* YENİ: CSS sınıfına bağlandı, inline style temizlendi */}
                    <button
                        className="collapse-btn"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        title={isCollapsed ? "Genişlet" : "Daralt"}
                    >
                        {isCollapsed ? '→' : '←'}
                    </button>
                </div>

                {/* YENİ: AÇILIR (DROPDOWN) DİL SEÇİCİ */}
                <div className="language-switcher">
                    <button 
                        className="lang-btn-main" 
                        onClick={() => setIsLangOpen(!isLangOpen)}
                        title="Dili Değiştir"
                    >
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <img src={`https://flagcdn.com/w20/${currentLang.flag}.png`} alt={currentLang.label} className="lang-flag" />
                            <span className="lang-text">{currentLang.label}</span>
                        </div>
                        <span className="lang-arrow" style={{ fontSize: '10px' }}>{isLangOpen ? '▲' : '▼'}</span>
                    </button>

                    {isLangOpen && (
                        <div className="lang-dropdown">
                            {languages.map(lang => (
                                <button 
                                    key={lang.code}
                                    className={`lang-dropdown-item ${i18n.language === lang.code ? 'active' : ''}`}
                                    onClick={() => changeLanguage(lang.code)}
                                >
                                    <img src={`https://flagcdn.com/w20/${lang.flag}.png`} alt={lang.label} className="lang-flag" />
                                    <span className="lang-text">{lang.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <ul className="sidebar-menu">
                    {menuItems.map((item) => (
                        <li key={item.path} className="menu-item">
                            <Link 
                                to={item.path} 
                                className={`menu-link ${location.pathname === item.path ? 'active' : ''}`}
                                data-tooltip={item.label}
                                onClick={() => setIsOpen(false)}
                            >
                                <span className="menu-icon">{item.icon}</span>
                                <span className="menu-text">{item.label}</span>
                            </Link>
                        </li>
                    ))}
                </ul>

                <div className="sidebar-footer">
                    <p>{t('menu.developer')}: Anto Bvb 66</p>
                </div>
            </nav>

            {isOpen && window.innerWidth <= 768 && (
                <div 
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1090 }}
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}

export default Sidebar;