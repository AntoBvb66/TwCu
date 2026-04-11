🏰 TW Cobre
🌍 English | 🇹🇷 Türkçe

<a id="english"></a>

🌍 English
TW Cobre is an elite tactical panel and command center designed to provide powerful analysis, operation planning, and visualization tools for Tribal Wars players. Just like refining copper from a mine, it extracts raw game data and forges it into strategic superiority.

⚠️ Disclaimer: This project is developed strictly for informational and analytical purposes. It is an independent tool and is not officially affiliated with InnoGames.

🛑 Server Friendly (1-Hour Cache): To respect the game's servers and prevent unnecessary load, this application utilizes a strict 1-hour local caching mechanism. When world data (village.txt, player.txt, ally.txt) is fetched via proxy, it is stored in your browser. Any subsequent requests within the next hour will load instantly from the cache without pinging the game servers.

✨ Features (14 Powerful Modules)
⚔️ Operations & Military:

Tribe Operation Planner (With/Without Troops): Analyze all clan villages and make smart assignments. Distribute personalized BBCode orders to members with map-supported staff intelligence.

Personal Op Planner & Fast Support: Match source and target villages to prepare flawless operation templates and support requests.

🏕️ Economy & Scavenging:

Scavenging Calculator: Compare scavenging times in detail, supported by interactive break-even capacity charts.

Production & Coin Minter: Optimize mine production rates, storage capacities, and calculate the most ideal village for minting Gold Coins.

🏰 Architecture & Village Management:

Building Times Calculator: Calculate exact building completion times based on World Speed and HQ Level with an interactive drag-and-drop table.

Building Planner & Unit Calculator: Design your village's construction plan step by step and calculate unit production times (including bonuses).

🗺️ Map & Intelligence:

Advanced Map Generator: A highly customizable map rendering engine. Automatically assigns visually distinct (Golden Angle HSL) colors to tribes situated close to each other. Calculates the Center of Mass to place highly readable tags exactly where village density is highest.

Teleport & Continent Analysis: Tracks player movements and detects exact "Teleportation" events by comparing old and new coordinates.

Church Planner: Optimize your church coverage areas on the map with a population-saving algorithm.

🛠️ Technical Stack
Frontend: React.js, Vite, React Router (HashRouter for static hosting)

Internationalization: react-i18next (Multi-language support with flag-based dropdown)

Backend : Cloudflare Workers (Manages global live statistics like Visits, Maps, Ops, and Sims)

Storage: Browser LocalStorage & SessionStorage for user settings, archives, and 1-hour data caching.

<a id="türkçe"></a>

🇹🇷 Türkçe
TW Cobre, Klanlar (Tribal Wars) oyuncuları için ham verileri işleyerek stratejik bir üstünlük kurmasını sağlamak amacıyla tasarlanmış elit bir taktik paneli ve komuta merkezidir. Tıpkı bir bakır madenini işler gibi, oyunun ham verisini süzüyor ve zafere dönüştürüyoruz.

⚠️ Yasal Uyarı: Bu proje tamamen bilgi vermek ve istatistiksel analiz yapmak amacıyla geliştirilmiştir. Bağımsız bir araçtır ve InnoGames ile resmi bir bağlantısı yoktur.

🛑 Sunucu Dostu (1 Saatlik Önbellek): Oyun sunucularını yormamak ve gereksiz trafik yaratmamak adına bu uygulama katı bir 1 saatlik önbellek (cache) sistemi kullanır. Dünya verileri (village.txt, vb.) proxy üzerinden çekildiğinde tarayıcınıza kaydedilir. Sonraki 1 saat içindeki tüm işlemleriniz, oyun sunucularına istek atmadan doğrudan tarayıcınızın hafızasından şimşek hızında gerçekleşir.

✨ Özellikler (14 Güçlü Modül)
⚔️ Operasyon ve Askeri Harekâtlar:

Klan Operasyon Planlayıcı (Askerli/Askersiz): Tüm klan köylerini analiz eder ve akıllı eşleştirmeler yapar. Üyelere kişiselleştirilmiş BBCode emirlerini dağıtır.

Kişisel Operasyon & Hızlı Destek: Kaynak ve hedef köyleri eşleştirerek kusursuz operasyon şablonları ve destek talepleri hazırlar.

🏕️ Ekonomi ve Hammadde:

Temizlik (Scavenging) Hesaplayıcı: Etkileşimli başa baş (dönüm noktası) grafikleriyle temizlik sürelerini ve kazançlarını detaylıca kıyaslar.

Üretim Verileri & Altın Para: Maden üretim hızlarını optimize eder ve Altın Para basmak için en ideal köyleri hesaplar.

🏰 Mimari ve Köy Yönetimi:

Bina Süreleri Hesaplayıcı: Dünya Hızı ve Ana Bina seviyesine göre kesin inşaat sürelerini hesaplar (Sürükle-bırak destekli tablo).

İnşaat Planlayıcı & Birim Hesaplayıcı: Köyünüzün inşaat sırasını adım adım tasarlar ve asker üretim sürelerini (bonuslar dahil) hesaplar.

🗺️ Harita ve İstihbarat:

Gelişmiş Harita Oluşturucu: TWStats benzeri, özelleştirilebilir harita motoru. Yan yana olan klanlara zıt renkleri (Altın Açı HSL) otomatik atar. Ağırlık Merkezini (Center of Mass) hesaplayarak etiketleri yoğunluğun en yüksek olduğu noktaya basar.

Işınlanma ve Kıta Analizi: Koordinatları karşılaştırarak oyuncuların kıtalar arası "Işınlanma" hareketlerini tespit eder.

Kilise Planlayıcı: Nüfus tasarrufu sağlayan algoritmasıyla harita üzerindeki kilise kapsama alanlarınızı optimize eder.

🛠️ Kullanılan Teknolojiler
Arayüz: React.js, Vite, React Router (Statik yayın için HashRouter)

Çoklu Dil (i18n): react-i18next (Bayraklı açılır menü ile çoklu dil desteği)

Arka Uç: Cloudflare Workers (Ziyaret, Harita, Operasyon, Simülasyon gibi küresel canlı istatistikleri yönetir)

Veri Saklama: Ayarlar, arşivler ve 1 saatlik önbellek için Browser LocalStorage & SessionStorage.
