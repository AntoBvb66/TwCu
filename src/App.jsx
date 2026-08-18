import React, { useState, useEffect, Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Sidebar from './components/Sidebar';
import { bumpStat, fetchStats } from './utils/twApi';

// Sayfalar tembel yüklenir: ilk açılışta sadece açılan sayfanın kodu iner.
// (Öncesinde 16 sayfa tek pakette geliyordu -> ~1.6 MB ilk yükleme.)
const BuildingTimes = lazy(() => import('./pages/BuildingTimes'));
const MapAnalysis = lazy(() => import('./pages/MapAnalysis'));
const MapGenerator = lazy(() => import('./pages/MapGenerator'));
const ProductionData = lazy(() => import('./pages/ProductionData'));
const ChurchPlanner = lazy(() => import('./pages/ChurchPlanner'));
const CoinMinter = lazy(() => import('./pages/CoinMinter'));
const BuildingPlanner = lazy(() => import('./pages/BuildingPlanner'));
const UnitCalculator = lazy(() => import('./pages/UnitCalculator'));
const OpPlanner = lazy(() => import('./pages/OpPlanner'));
const ClanOpPlanner = lazy(() => import('./pages/ClanOpPlanner'));
const ClanTroopPlanner = lazy(() => import('./pages/ClanTroopPlanner'));
const FastSupport = lazy(() => import('./pages/FastSupport'));
const ScavengingPlanner = lazy(() => import('./pages/ScavengingPlanner'));
const About = lazy(() => import('./pages/About'));
const Privacy = lazy(() => import('./pages/Privacy'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'));

import './App.css';

const PageLoader = () => (
    <div className="page-loader" role="status" aria-live="polite">
        <div className="page-loader-spinner" />
    </div>
);

const Home = () => {
    const { t } = useTranslation();

    // Araçlar konularına göre gruplanır; ana sayfada 14 kart tek yığın hâlinde
    // dururken hangisinin ne işe yaradığını taramak zordu.
    const sections = [
        {
            key: 'ops',
            title: t('home.categories.ops'),
            tools: [
                { path: '/clan-op', title: t('home.tools.clanOp.title'), desc: t('home.tools.clanOp.desc'), icon: '📜' },
                { path: '/clan-troop-op', title: t('home.tools.clanTroop.title'), desc: t('home.tools.clanTroop.desc'), icon: '🪖' },
                { path: '/op-planner', title: t('home.tools.opPlanner.title'), desc: t('home.tools.opPlanner.desc'), icon: '🎯' },
                { path: '/fast-support', title: t('home.tools.fastSupport.title'), desc: t('home.tools.fastSupport.desc'), icon: '🛡️' }
            ]
        },
        {
            key: 'build',
            title: t('home.categories.build'),
            tools: [
                { path: '/building-planner', title: t('home.tools.buildingPlanner.title'), desc: t('home.tools.buildingPlanner.desc'), icon: '🏰' },
                { path: '/building-times', title: t('home.tools.buildingTimes.title'), desc: t('home.tools.buildingTimes.desc'), icon: '⏳' },
                { path: '/unit-calculator', title: t('home.tools.unitCalculator.title'), desc: t('home.tools.unitCalculator.desc'), icon: '⚔️' }
            ]
        },
        {
            key: 'eco',
            title: t('home.categories.eco'),
            tools: [
                { path: '/scavenging', title: t('home.tools.scavengingPlanner.title'), desc: t('home.tools.scavengingPlanner.desc'), icon: '🏕️' },
                { path: '/production-data', title: t('home.tools.productionData.title'), desc: t('home.tools.productionData.desc'), icon: '⛏️' },
                { path: '/coin-minter', title: t('home.tools.coinMinter.title'), desc: t('home.tools.coinMinter.desc'), icon: '💰' }
            ]
        },
        {
            key: 'intel',
            title: t('home.categories.intel'),
            tools: [
                { path: '/map-generator', title: t('home.tools.mapGenerator.title'), desc: t('home.tools.mapGenerator.desc'), icon: '🌍' },
                { path: '/map-analysis', title: t('home.tools.mapAnalysis.title'), desc: t('home.tools.mapAnalysis.desc'), icon: '🧭' },
                { path: '/church-planner', title: t('home.tools.churchPlanner.title'), desc: t('home.tools.churchPlanner.desc'), icon: '⛪' },
                { path: '/notification-settings', title: t('home.tools.notificationSettings.title'), desc: t('home.tools.notificationSettings.desc'), icon: '🔔' }
            ]
        }
    ];

    return (
        <div className="home-container">
            <header className="home-hero">
                <span className="home-hero-badge">{t('menu.title')}</span>
                <h1 className="home-title">{t('home.hero.title')}</h1>
                <p className="home-subtitle">{t('home.hero.subtitle')}</p>
            </header>

            {sections.map(section => (
                <section className="home-section" key={section.key}>
                    <h2 className="home-section-title">{section.title}</h2>
                    <div className="home-grid">
                        {section.tools.map(tool => (
                            <Link to={tool.path} key={tool.path} className="home-card">
                                <div className="home-card-icon" aria-hidden="true">{tool.icon}</div>
                                <div className="home-card-content">
                                    <h3>{tool.title}</h3>
                                    <p>{tool.desc}</p>
                                </div>
                                <span className="home-card-arrow" aria-hidden="true">→</span>
                            </Link>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};

function App() {
    const { t } = useTranslation();
    const [stats, setStats] = useState({ visits: '...', maps: '...', ops: '...', sims: '...' });

    useEffect(() => {
        const loadStats = async () => {
            try {
                if (!sessionStorage.getItem("tw_visited")) {
                    bumpStat('visits');
                    sessionStorage.setItem("tw_visited", "true");
                }
                setStats(await fetchStats());
            } catch (err) {
                // İstatistikler kritik değil; sayfa çalışmaya devam eder.
                setStats({ visits: '–', maps: '–', ops: '–', sims: '–' });
            }
        };
        loadStats();
    }, []);

    return (
        <Router>
            <div className="app-container">
                <Sidebar />
                <main className="main-content">
                    <div className="page-wrapper">
                    <Suspense fallback={<PageLoader />}>
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
                    </Suspense>
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
                            <span className="stat-value" style={{color: 'var(--copper)'}}>{stats.maps}</span>
                        </div>
                        
                        <div className="stat-divider"></div>

                        <div className="stat-item" title={t('menu.opsTitle')}>
                            <span className="stat-icon">⚔️</span>
                            <span className="stat-value" style={{color: 'var(--danger)'}}>{stats.ops || '0'}</span>
                        </div>

                        <div className="stat-divider"></div>

                        <div className="stat-item" title={t('menu.simsTitle')}>
                            <span className="stat-icon">⚙️</span>
                            <span className="stat-value" style={{color: 'var(--success)'}}>{stats.sims || '0'}</span>
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
                            <p>{t('footer.text2')} <b style={{color: 'var(--gold)'}}>Anto Bvb 66</b></p>
                        </div>
                    </footer>

                </main>
            </div>
        </Router>
    );
}

export default App;