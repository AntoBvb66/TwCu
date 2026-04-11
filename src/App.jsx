import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom'; 
import { useTranslation } from 'react-i18next'; 

// Bileşen İçe Aktarmaları
import Sidebar from './components/Sidebar';
import BuildingTimes from './pages/BuildingTimes';
import MapAnalysis from './pages/MapAnalysis';
import MapGenerator from './pages/MapGenerator';
import ProductionData from './pages/ProductionData';
import ChurchPlanner from './pages/ChurchPlanner';
import CoinMinter from './pages/CoinMinter';
import BuildingPlanner from './pages/BuildingPlanner';
import UnitCalculator from './pages/UnitCalculator';
import OpPlanner from './pages/OpPlanner';
import ClanOpPlanner from './pages/ClanOpPlanner';
import ClanTroopPlanner from './pages/ClanTroopPlanner';
import FastSupport from './pages/FastSupport';
import ScavengingPlanner from './pages/ScavengingPlanner';
import About from './pages/About';
import Privacy from './pages/Privacy';
import NotificationSettings from './pages/NotificationSettings'; // YENİ EKLENDİ    

import './App.css'; 

const Home = () => {
    const { t } = useTranslation();

    const tools = [
        // --- 1. KATEGORİ: OPERASYON VE ASKERİ HAREKATLAR ---
        { path: '/clan-op', title: t('home.tools.clanOp.title'), desc: t('home.tools.clanOp.desc'), icon: '📜' },
        { path: '/clan-troop-op', title: t('home.tools.clanTroop.title'), desc: t('home.tools.clanTroop.desc'), icon: '🪖' },
        { path: '/op-planner', title: t('home.tools.opPlanner.title'), desc: t('home.tools.opPlanner.desc'), icon: '🎯' },
        { path: '/fast-support', title: t('home.tools.fastSupport.title'), desc: t('home.tools.fastSupport.desc'), icon: '🛡️' },

        // --- 2. KATEGORİ: MİMARİ VE KÖY YÖNETİMİ ---
        { path: '/building-planner', title: t('home.tools.buildingPlanner.title'), desc: t('home.tools.buildingPlanner.desc'), icon: '🏰' },
        { path: '/building-times', title: t('home.tools.buildingTimes.title'), desc: t('home.tools.buildingTimes.desc'), icon: '⏳' },
        { path: '/unit-calculator', title: t('home.tools.unitCalculator.title'), desc: t('home.tools.unitCalculator.desc'), icon: '⚔️' },

        // --- 3. KATEGORİ: EKONOMİ, HAMMADDE VE GELİŞİM ---
        { path: '/scavenging', title: t('home.tools.scavengingPlanner.title'), desc: t('home.tools.scavengingPlanner.desc'), icon: '🏕️' },
        { path: '/production-data', title: t('home.tools.productionData.title'), desc: t('home.tools.productionData.desc'), icon: '⛏️' },
        { path: '/coin-minter', title: t('home.tools.coinMinter.title'), desc: t('home.tools.coinMinter.desc'), icon: '💰' },

        // --- 4. KATEGORİ: HARİTA, ANALİZ VE İSTİHBARAT ---
        { path: '/map-generator', title: t('home.tools.mapGenerator.title'), desc: t('home.tools.mapGenerator.desc'), icon: '🌍' },
        { path: '/map-analysis', title: t('home.tools.mapAnalysis.title'), desc: t('home.tools.mapAnalysis.desc'), icon: '🧭' },
        { path: '/church-planner', title: t('home.tools.churchPlanner.title'), desc: t('home.tools.churchPlanner.desc'), icon: '⛪' },
        { path: '/notification-settings', title: t('home.tools.notificationSettings.title'), desc: t('home.tools.notificationSettings.desc'), icon: '🔔' }
    ];

    return (
        <div className="home-container">
            <div className="home-hero">
                <h1 className="home-title">{t('home.hero.title')}</h1>
                <p className="home-subtitle">{t('home.hero.subtitle')}</p>
            </div>
            
            <div className="home-grid">
                {tools.map(tool => (
                    <Link to={tool.path} key={tool.path} className="home-card">
                        <div className="home-card-icon">{tool.icon}</div>
                        <div className="home-card-content">
                            <h3>{tool.title}</h3>
                            <p>{tool.desc}</p>
                        </div>
                        <div className="home-card-arrow">➔</div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

function App() {
    const { t } = useTranslation();
    const [stats, setStats] = useState({ visits: '...', maps: '...', ops: '...', sims: '...' });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const hasVisited = sessionStorage.getItem("tw_visited");
                if (!hasVisited) {
                    await fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=visits");
                    sessionStorage.setItem("tw_visited", "true");
                }
                const res = await fetch("https://tw-proxy.halimtttt10.workers.dev/?stat=get_all");
                const data = await res.json();
                setStats(data);
            } catch (err) {
                console.log("Stats yüklenemedi");
            }
        };
        fetchStats();
    }, []);

    return (
        <Router>
            <div className="app-container">
                <Sidebar />
                <main className="main-content">
                    <div className="page-wrapper">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/building-times" element={<BuildingTimes />} />
                        <Route path="/map-analysis" element={<MapAnalysis />} />
                        <Route path="/map-generator" element={<MapGenerator />} />
                        <Route path="/production-data" element={<ProductionData />} />
                        <Route path="/church-planner" element={<ChurchPlanner />} />
                        <Route path="/coin-minter" element={<CoinMinter />} />
                        <Route path="/building-planner" element={<BuildingPlanner />} />
                        <Route path="/unit-calculator" element={<UnitCalculator />} />
                        <Route path="/op-planner" element={<OpPlanner />} />
                        <Route path="/clan-op" element={<ClanOpPlanner />} />
                        <Route path="/clan-troop-op" element={<ClanTroopPlanner />} />
                        <Route path="/fast-support" element={<FastSupport />} />
                        <Route path="/scavenging" element={<ScavengingPlanner />} />
                        <Route path="/notification-settings" element={<NotificationSettings />} />
                    </Routes>
                    </div> 
                    
                    {/* YENİ VE BÜTÜNLEŞİK FOOTER */}
                    <footer className="global-footer">
                        {/* 1. Kısım: İstatistikler */}
                        <div className="app-global-stats">
                        <div className="stat-item" title={t('menu.visitsTitle')}>
                            <span className="stat-icon">👁️</span>
                            <span className="stat-value">{stats.visits}</span>
                        </div>
                        
                        <div className="stat-divider"></div>

                        <div className="stat-item" title={t('menu.mapsTitle')}>
                            <span className="stat-icon">🗺️</span>
                            <span className="stat-value" style={{color: '#dcb589'}}>{stats.maps}</span>
                        </div>
                        
                        <div className="stat-divider"></div>

                        <div className="stat-item" title={t('menu.opsTitle')}>
                            <span className="stat-icon">⚔️</span>
                            <span className="stat-value" style={{color: '#d9534f'}}>{stats.ops || '0'}</span>
                        </div>

                        <div className="stat-divider"></div>

                        <div className="stat-item" title={t('menu.simsTitle')}>
                            <span className="stat-icon">⚙️</span>
                            <span className="stat-value" style={{color: '#5cb85c'}}>{stats.sims || '0'}</span>
                        </div>
                    </div>

                        {/* 2. Kısım: Hızlı Linkler */}
                        <div className="footer-links">
                            <Link to="/">{t('menu.title', 'TW Cobre')}</Link>
                            <Link to="/about">{t('footer.links.about')}</Link>
                            <Link to="/privacy">{t('footer.links.privacy')}</Link>
                        </div>

                        {/* 3. Kısım: Telif Hakkı */}
                        <div className="footer-copyright">
                            <p>{t('footer.text1')}</p>
                            <p>{t('footer.text2')} <b style={{color: '#f0c042'}}>Anto Bvb 66</b></p>
                        </div>
                    </footer>

                </main>
            </div>
        </Router>
    );
}

export default App;