import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage } from '../i18n';
import './Sidebar.css';

function Sidebar() {
    const location = useLocation();
    const { t, i18n } = useTranslation();

    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1');
    const [isLangOpen, setIsLangOpen] = useState(false); // Dil menüsü aç/kapa state'i

    // Dil dosyası artık ihtiyaç anında indiriliyor (bkz. src/i18n.js)
    const changeLanguage = async (lng) => {
        await changeAppLanguage(lng);
        setIsLangOpen(false); // Seçim yapınca menüyü kapat
    };

    const toggleCollapsed = () => {
        setIsCollapsed(prev => {
            localStorage.setItem('sidebarCollapsed', prev ? '0' : '1');
            return !prev;
        });
    };

    // Çekmece açıkken arka planın kaymasını engelle (mobil)
    useEffect(() => {
        document.body.classList.toggle('drawer-open', isOpen);
        return () => document.body.classList.remove('drawer-open');
    }, [isOpen]);

    // Rota değişince çekmeceyi kapat
    useEffect(() => { setIsOpen(false); }, [location.pathname]);

    // ESC ile kapat
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen]);

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

    // group: ana sayfadaki kategorilerle aynı sıralama. Grup değişince
    // menüde ince bir ayraç çizgisi çıkar (bkz. .menu-item.group-start).
    const menuItems = [
        { path: '/clan-op', label: t('menu.items.clanOp'), icon: '📜', group: 'ops' },
        { path: '/clan-troop-op', label: t('menu.items.clanTroop'), icon: '🪖', group: 'ops' },
        { path: '/op-planner', label: t('menu.items.opPlanner'), icon: '🎯', group: 'ops' },
        { path: '/fast-support', label: t('menu.items.fastSupport'), icon: '🛡️', group: 'ops' },

        { path: '/building-planner', label: t('menu.items.buildingPlanner'), icon: '🏰', group: 'build' },
        { path: '/building-times', label: t('menu.items.buildingTimes'), icon: '⏳', group: 'build' },
        { path: '/unit-calculator', label: t('menu.items.unitCalculator'), icon: '⚔️', group: 'build' },

        { path: '/scavenging', label: t('scavenging.title'), icon: '🏕️', group: 'eco' },
        { path: '/production-data', label: t('menu.items.productionData'), icon: '⛏️', group: 'eco' },
        { path: '/coin-minter', label: t('menu.items.coinMinter'), icon: '💰', group: 'eco' },

        { path: '/map-generator', label: t('menu.items.mapGenerator'), icon: '🌍', group: 'intel' },
        { path: '/map-analysis', label: t('menu.items.mapAnalysis'), icon: '🧭', group: 'intel' },
        { path: '/church-planner', label: t('menu.items.churchPlanner'), icon: '⛪', group: 'intel' },
        { path: '/notification-settings', label: t('menu.items.notificationSettings'), icon: '🔔', group: 'intel' }
    ];

    return (
        <>
            {/* Görünürlük CSS ile yönetilir; window.innerWidth ile değil
                (yeniden boyutlandırma/ekran döndürmede kilitlenmesin diye). */}
            <div className="mobile-topbar">
                <button
                    className="hamburger"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label={t('menu.toggle')}
                    aria-expanded={isOpen}
                >
                    ☰
                </button>
                <div className="logo">
                    <img
                        src={`${import.meta.env.BASE_URL}logo192.png`}
                        alt="TW Cobre"
                        width="32"
                        height="32"
                        className="topbar-logo-img"
                    />
                    <span>{t('menu.title')}</span>
                </div>
            </div>

            <nav className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isOpen ? 'open' : ''}`}>
               <div className="sidebar-header">
                    <Link to="/" className="sidebar-brand" onClick={() => setIsOpen(false)}>
                        <img src={`${import.meta.env.BASE_URL}logo192.png`} alt="TW Cobre" className="sidebar-logo-img" width="62" height="62" />
                        <h1 className="sidebar-logo-text">{t('menu.title')}</h1>
                    </Link>

                    {/* YENİ: CSS sınıfına bağlandı, inline style temizlendi */}
                    <button
                        className="collapse-btn"
                        onClick={toggleCollapsed}
                        title={isCollapsed ? t('menu.expand') : t('menu.collapse')}
                        aria-label={isCollapsed ? t('menu.expand') : t('menu.collapse')}
                    >
                        {isCollapsed ? '→' : '←'}
                    </button>
                </div>

                {/* YENİ: AÇILIR (DROPDOWN) DİL SEÇİCİ */}
                <div className="language-switcher">
                    <button
                        className="lang-btn-main"
                        onClick={() => setIsLangOpen(!isLangOpen)}
                        title={t('menu.changeLanguage')}
                        aria-expanded={isLangOpen}
                    >
                        <span className="lang-current">
                            <img src={`https://flagcdn.com/w20/${currentLang.flag}.png`} alt={currentLang.label} className="lang-flag" />
                            <span className="lang-text">{currentLang.label}</span>
                        </span>
                        <span className="lang-arrow">{isLangOpen ? '▲' : '▼'}</span>
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
                    {menuItems.map((item, index) => (
                        <li
                            key={item.path}
                            className={`menu-item ${index > 0 && menuItems[index - 1].group !== item.group ? 'group-start' : ''}`}
                        >
                            <Link 
                                to={item.path} 
                                className={`menu-link ${location.pathname === item.path ? 'active' : ''}`}
                                title={item.label}
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

            {/* Karartma katmanı: sadece mobilde ve çekmece açıkken görünür (CSS) */}
            {isOpen && (
                <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />
            )}
        </>
    );
}

export default Sidebar;