import os
import json
import requests # type: ignore
import re
import firebase_admin # type: ignore
from google.cloud import firestore
import urllib.parse
import time
import io
from flask import Flask # type: ignore
from threading import Thread
from firebase_admin import credentials, firestore # type: ignore
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw, ImageFont # type: ignore

# ====================== BAŞLATMA ======================
FIREBASE_KEY_JSON = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')

if not firebase_admin._apps:
    cred = credentials.Certificate(json.loads(FIREBASE_KEY_JSON))
    firebase_admin.initialize_app(cred)
db = firestore.client()


def update_global_worlds(db):
    """Tüm ülke sunucularını gezer, aktif normal dünyaları bulur ve Firebase'e yazar."""
    
    # Kullanıcının verdiği tüm ana sunucular (Güvenlik için HTTPS yapıldı)
    server_roots = {
        "en": "https://www.tribalwars.net",
        "se": "https://www.tribalwars.se",
        "nl": "https://www.tribalwars.nl",
        "br": "https://www.tribalwars.com.br",
        "ro": "https://www.triburile.ro",
        "no": "https://no.tribalwars.com",
        "pt": "https://www.tribalwars.com.pt",
        "gr": "https://www.fyletikesmaxes.gr",
        "sk": "https://www.divoke-kmene.sk",
        "hu": "https://www.klanhaboru.hu",
        "cz": "https://www.divokekmeny.cz",
        "es": "https://www.guerrastribales.es",
        "it": "https://www.tribals.it",
        "fr": "https://www.guerretribale.fr",
        "tr": "https://www.klanlar.org",
        "ae": "https://www.tribalwars.ae",
        "uk": "https://www.tribalwars.co.uk",
        "de": "https://www.die-staemme.de",
        "pl": "https://www.plemiona.pl",
        "si": "https://www.vojnaplemen.si",
        "hr": "https://www.plemena.com",
        "th": "https://www.tribalwars.asia",
        "us": "https://www.tribalwars.us",
        "ru": "https://www.voynaplemyon.com",
        "ch": "https://www.staemme.ch"
    }

    print("🌍 Küresel Dünya Tarayıcı Başlatıldı...")
    
    # Firebase'de bu verileri tutacağımız ana koleksiyon:
    worlds_ref = db.collection('system_data').document('active_worlds')
    counts_ref = db.collection('system_data').document('world_counts')
    all_worlds_data = {}
    world_counts = {}
    total_active_worlds = 0
    
    for lang, base_url in server_roots.items():
        try:
            res = requests.get(f"{base_url}/backend/get_servers.php", timeout=10)
            if res.status_code != 200:
                continue
                
            php_string = res.text
            matches = re.findall(r's:\d+:"([^"]+)";s:\d+:"([^"]+)"', php_string)
            
            standard_worlds = []
            for world_id, world_url in matches:
                
                # SENİN KURALIN: İçinde 's1.' veya 's2.' varsa çöpe at (Speed dünyaları dışla)
                # GÜVENLİK: us1 (Amerika), es1 (İspanya), cs1 (Çekya) silinmesin!
                is_speed = ("s1." in world_url or "s2." in world_url or "s3." in world_url)
                is_safe = ("us1." in world_url or "es1." in world_url or "cs1." in world_url)
                
                if is_speed and not is_safe:
                    continue # Çöpe at! Listeye ekleme.
                    
                standard_worlds.append({
                    "id": world_id,
                    "url": world_url
                })
            
            if standard_worlds:
                count = len(standard_worlds)
                all_worlds_data[lang] = standard_worlds
                world_counts[lang] = count # Ülkenin sayısını kaydet
                total_active_worlds += count # Toplama ekle
                
                print(f"✅ {lang.upper()}: {count} dünya bulundu.")
                
        except Exception as e:
            print(f"❌ {lang.upper()} sunucusu taranırken hata oluştu: {e}")

    # Toplam sayıyı da JSON'un en sonuna ekle
    world_counts["total"] = total_active_worlds

    # İki veriyi de Firebase'e kaydet
    worlds_ref.set(all_worlds_data)
    counts_ref.set(world_counts)
    
    print(f"💾 İşlem Tamam! Tüm veriler kaydedildi. Toplam Aktif Dünya: {total_active_worlds}")


# ====================== YARDIMCI FONKSİYONLAR ======================
def generate_table_image(rows):
    """Verileri ızgara (kareli) bir tablo resmine dönüştürür"""
    headers = ["Saat", "Yeni Sahip", "Eski Sahip", "Köy (Kıta)", "Puan", "T"]
    font_size = 14
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", font_size)
        char_w = 8.5
    except:
        font = ImageFont.load_default()
        char_w = 7.0

    col_widths = [6, 18, 18, 15, 9, 3]
    cell_h = 30 # Biraz daha genişlik çizgiler için iyi olur
    margin = 20
    
    # Sütunların başlangıç X koordinatlarını hesapla
    x_positions = [margin]
    current_x = margin
    for w in col_widths:
        current_x += w * char_w + 12
        x_positions.append(current_x)

    width = int(x_positions[-1] + margin)
    height = (len(rows) + 1) * cell_h + (margin * 2)

    img = Image.new("RGB", (width, height), (25, 25, 25))
    draw = ImageDraw.Draw(img)
    line_color = (60, 60, 60) # Çizgi rengi (koyu gri)

    # --- DİKEY ÇİZGİLER ---
    for x in x_positions:
        draw.line((x, margin, x, height - margin), fill=line_color, width=1)

    # --- YATAY ÇİZGİLER & VERİLER ---
    # Üst kenar çizgisi
    draw.line((margin, margin, x_positions[-1], margin), fill=line_color, width=1)
    
    # Başlıkları Yaz
    y = margin
    for i, h in enumerate(headers):
        draw.text((x_positions[i] + 5, y + 5), h, font=font, fill=(255, 215, 0))
    
    # Başlık altı çizgisi
    y += cell_h
    draw.line((margin, y, x_positions[-1], y), fill=line_color, width=1)

    # Satırları Yaz
    for row in rows:
        for i, cell in enumerate(row):
            draw.text((x_positions[i] + 5, y + 5), str(cell), font=font, fill=(230, 230, 230))
        y += cell_h
        # Her satır altına çizgi (Kareli görünüm)
        draw.line((margin, y, x_positions[-1], y), fill=line_color, width=1)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def send_telegram_photo(caption, photo_bytes, bot_token, chat_id):
    """Kullanıcıya özel Telegram mesajını fotoğraf olarak gönderir"""
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"
        payload = {"chat_id": chat_id, "caption": caption, "parse_mode": "Markdown"}
        files = {"photo": ("conquer_report.png", photo_bytes, "image/png")}
        requests.post(url, data=payload, files=files, timeout=15)
    except Exception as e:
        print(f"Fotoğraf gönderilemedi (Chat ID: {chat_id}): {e}")

def send_telegram_message(text, bot_token, chat_id):
    """Kullanıcıya özel standart metin gönderir"""
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        print(f"Mesaj gönderilemedi (Chat ID: {chat_id}): {e}")

def get_world_data_maps(base_url):
    """ID -> Detaylı Bilgi haritalarını oluşturur"""
    p_map = {"0": {"name": "Barbarian", "tag": ""}}
    a_map = {"0": ""}
    v_map = {}

    try:
        a_req = requests.get(f"{base_url}/map/ally.txt", timeout=15).text.splitlines()
        for line in a_req:
            parts = line.split(',')
            if len(parts) >= 3: a_map[parts[0]] = urllib.parse.unquote_plus(parts[2])

        p_req = requests.get(f"{base_url}/map/player.txt", timeout=15).text.splitlines()
        for line in p_req:
            parts = line.split(',')
            if len(parts) >= 3:
                p_map[parts[0]] = {"name": urllib.parse.unquote_plus(parts[1]), "tag": a_map.get(parts[2], "")}

        v_req = requests.get(f"{base_url}/map/village.txt", timeout=15).text.splitlines()
        for line in v_req:
            parts = line.split(',')
            if len(parts) >= 6:
                vx, vy, pts = parts[2], parts[3], int(parts[5])
                continent = f"K{vy[:1]}{vx[:1]}"
                v_map[parts[0]] = {"coord": f"{vx}|{vy} ({continent})", "pts": f"{pts:,}".replace(",", ".")}
    except Exception as e:
        print(f"Map çekme hatası ({base_url}): {e}")
    
    return p_map, a_map, v_map

def get_entity_stats(name, is_tribe, base_url):
    """Oyuncu veya klanın güncel istatistiklerini çeker"""
    stats = {"id": None, "points": 0, "villages": 0, "od_att": 0, "od_def": 0, "od_sup": 0}
    file_type = "ally" if is_tribe else "player"
    
    try:
        r = requests.get(f"{base_url}/map/{file_type}.txt", timeout=10)
        for line in r.text.splitlines():
            p = line.split(',')
            actual_name = urllib.parse.unquote_plus(p[2 if is_tribe else 1])
            if actual_name == name:
                stats["id"] = p[0]
                stats["villages"] = int(p[4 if is_tribe else 3])
                stats["points"] = int(p[5 if is_tribe else 4])
                break
    except: return stats

    if not stats["id"]: return stats

    suffix = "_tribe" if is_tribe else ""
    od_tasks = [("kill_att", "od_att"), ("kill_def", "od_def")]
    if not is_tribe: od_tasks.append(("kill_sup", "od_sup"))
    else: od_tasks.append(("kill_all_tribe", "od_all"))

    for f_name, key in od_tasks:
        try:
            res = requests.get(f"{base_url}/map/{f_name}{suffix if 'tribe' not in f_name else ''}.txt", timeout=10)
            for line in res.text.splitlines():
                p = line.split(',')
                if p[1] == stats["id"]:
                    stats[key] = int(p[2])
                    break
        except: pass
    
    if is_tribe:
        stats["od_sup"] = max(0, stats.get("od_all", 0) - stats["od_att"] - stats["od_def"])
    return stats

def create_entity_map(base_url, target_name, is_tribe):
    """Oyuncunun veya klanın bulunduğu bölgenin mini haritasını çizer"""
    print(f"🗺️ Harita oluşturuluyor: {target_name}...")
    
    try:
        # 1. Gerekli ID'leri bul
        target_player_ids = set()
        
        p_req = requests.get(f"{base_url}/map/player.txt", timeout=10).text.splitlines()
        a_req = requests.get(f"{base_url}/map/ally.txt", timeout=10).text.splitlines()
        
        # Eğer klan ise, önce klan ID'sini bul, sonra o klandaki oyuncuları topla
        if is_tribe:
            tribe_id = None
            for line in a_req:
                parts = line.split(',')
                if len(parts) > 2 and urllib.parse.unquote_plus(parts[2]) == target_name:
                    tribe_id = parts[0]
                    break
            if not tribe_id: return None
            
            for line in p_req:
                parts = line.split(',')
                if len(parts) > 2 and parts[2] == tribe_id:
                    target_player_ids.add(parts[0])
        else: # Eğer oyuncu ise direkt oyuncu ID'sini bul
            for line in p_req:
                parts = line.split(',')
                if len(parts) > 1 and urllib.parse.unquote_plus(parts[1]) == target_name:
                    target_player_ids.add(parts[0])
                    break

        if not target_player_ids: return None

        # 2. Köyleri Tara ve Hedefin Merkezini Bul
        v_req = requests.get(f"{base_url}/map/village.txt", timeout=10).text.splitlines()
        all_villages = []
        target_x, target_y = [], []

        for line in v_req:
            parts = line.split(',')
            if len(parts) >= 5:
                x, y, p_id = int(parts[2]), int(parts[3]), parts[4]
                all_villages.append((x, y, p_id))
                if p_id in target_player_ids:
                    target_x.append(x)
                    target_y.append(y)

        if not target_x: return None

        # Merkez koordinatları ve kamera açısını belirle (Hedefin etrafında 40 karelik alan)
        min_x, max_x = max(0, min(target_x) - 20), min(999, max(target_x) + 20)
        min_y, max_y = max(0, min(target_y) - 20), min(999, max(target_y) + 20)
        
        width_grids = max_x - min_x + 1
        height_grids = max_y - min_y + 1
        
        # Resmi 10 kat büyüt (Her köy 10x10 piksel olsun ki net görünsün)
        scale = 10 
        img = Image.new("RGB", (width_grids * scale, height_grids * scale), (20, 30, 20)) # Koyu Orman Yeşili Arkaplan
        draw = ImageDraw.Draw(img)

        # 3. Köyleri Haritaya Çiz
        for x, y, p_id in all_villages:
            if min_x <= x <= max_x and min_y <= y <= max_y:
                # Ekrana çizeceğimiz pikselin yerini hesapla
                px = (x - min_x) * scale
                py = (y - min_y) * scale
                
                # Renk Belirleme
                if p_id == "0":
                    color = (150, 150, 150) # Barbar (Gri)
                elif p_id in target_player_ids:
                    color = (0, 255, 255) # Hedef (Parlak Turkuaz)
                else:
                    color = (200, 50, 50) # Düşman/Diğer (Kırmızı)
                    
                # Köyü kare olarak çiz (Aralarda 1 piksel boşluk bırakarak grid efekti ver)
                draw.rectangle([px + 1, py + 1, px + scale - 1, py + scale - 1], fill=color)

        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return buf.getvalue()
        
    except Exception as e:
        print(f"Harita çizim hatası: {e}")
        return None


# ====================== RAPORLAMA MANTIKLARI ======================
def process_periodic_report(world_id, base_url, user_config, name, e_type, mode):
    """Kullanıcıya özel saatlik/günlük raporları işler"""
    is_tribe = e_type == "Tribe"
    p_settings = user_config.get('periodic_reports', {})
    bot_token = user_config['global_settings']['telegram_bot_token']
    chat_id = user_config['global_settings']['telegram_chat_id']

    now_stats = get_entity_stats(name, is_tribe, base_url)
    if not now_stats["id"]: return

    ref = db.collection('worlds').document(world_id).collection(f"{mode}_snapshots").document(f"{e_type}_{name}")
    old_doc = ref.get()
    old_stats = old_doc.to_dict() if old_doc.exists else {}
    tr_now = datetime.now(timezone.utc) + timedelta(hours=3)

    # ================= SPAM KORUMASI: AYNI RAPORU 2 KERE ATMA =================
    if old_stats and "timestamp" in old_stats:
        try:
            old_ts = datetime.fromisoformat(old_stats["timestamp"])
            if mode == "hourly" and tr_now.hour == old_ts.hour and tr_now.date() == old_ts.date(): return
            if mode == "daily" and tr_now.date() == old_ts.date(): return
            if mode == "weekly" and tr_now.isocalendar()[1] == old_ts.isocalendar()[1] and tr_now.year == old_ts.year: return
        except: pass
    # ==========================================================================

    def get_diff(key):
        return now_stats[key] - old_stats.get(key, now_stats[key])

    lines = [
        f"{'🛡️' if is_tribe else '👤'} *{mode.capitalize()} Report: {name}*",
        f"📅 `{tr_now.strftime('%d/%m %H:%M')}`",
        "━━━━━━━━━━━━━━━━━━"
    ]
    
    if p_settings.get("trackODAtt"): lines.append(f"⚔️ *OD Att:* {get_diff('od_att'):+,} ({now_stats['od_att']:,})")
    if p_settings.get("trackODDef"): lines.append(f"🛡️ *OD Def:* {get_diff('od_def'):+,} ({now_stats['od_def']:,})")
    if p_settings.get("trackODSup"): lines.append(f"🩹 *OD Sup:* {get_diff('od_sup'):+,} ({now_stats['od_sup']:,})")
    
    lines.append(f"🏘️ *Villages:* {get_diff('villages'):+} ({now_stats['villages']})")
    lines.append(f"📈 *Points:* {now_stats['points']:,}")

    # ===== HARİTA ÖZELLİĞİ =====
    # Ayarlarda sendMap aktifse metin yerine harita görseliyle birlikte at!
    if p_settings.get("sendMap"):
        map_bytes = create_entity_map(base_url, name, is_tribe)
        if map_bytes:
            send_telegram_photo("\n".join(lines), map_bytes, bot_token, chat_id)
        else:
            # Harita çizilemezse mecburen sadece metin at
            send_telegram_message("\n".join(lines), bot_token, chat_id)
    else:
        # Harita kapalıysa normal metin at
        send_telegram_message("\n".join(lines), bot_token, chat_id)

    # Ne zaman mesaj attığını kaydet ki bir daha atmasın
    now_stats["timestamp"] = tr_now.isoformat()
    ref.set(now_stats)


def process_user_conquests(user_config, conquests_lines, p_map, a_map, v_map, world_id, last_ts):
    """Çekilmiş fetih verilerini kullanıcının filtrelerine göre tarayıp mesaj atar"""
    p_settings = user_config.get('periodic_reports', {})
    track_all = p_settings.get('trackAllConquests', False)
    bot_token = user_config['global_settings']['telegram_bot_token']
    chat_id = user_config['global_settings']['telegram_chat_id']

    monitored_p = {p['name']: p.get('active_filters', []) for p in user_config.get('monitored_players', [])}
    monitored_t = {t['tag']: t.get('active_filters', []) for t in user_config.get('monitored_tribes', [])}

    # İki ayrı liste oluşturuyoruz
    global_rows = []
    monitored_rows = []

    for line in conquests_lines:
        parts = line.split(',')
        if len(parts) < 4: continue
        v_id, ts, new_id, old_id = parts[0], int(parts[1]), parts[2], parts[3]
        
        # Duble Fetih Koruması
        if ts <= last_ts: continue 
        
        v_info = v_map.get(v_id, {"coord": "??|?? (K??)", "pts": "???"})
        new_d = p_map.get(new_id, {"name": "Unknown", "tag": ""})
        old_d = p_map.get(old_id, {"name": "Barbarian", "tag": ""})
        
        new_txt = f"{new_d['name']}({new_d['tag']})" if new_d['tag'] else new_d['name']
        old_txt = f"{old_d['name']}({old_d['tag']})" if old_d['tag'] else old_d['name']
        
        tip = "G"
        if old_id == "0": tip = "B"
        elif new_d['tag'] == old_d['tag'] and new_d['tag'] != "": tip = "I"

        tr_time = datetime.fromtimestamp(ts, tz=timezone.utc) + timedelta(hours=3)
        row_data = [tr_time.strftime('%H:%M'), new_txt[:16], old_txt[:16], v_info['coord'], v_info['pts'], tip]

        # Bu işlem takip edilen birine mi ait?
        is_monitored = (new_d['name'] in monitored_p or old_d['name'] in monitored_p or 
                        new_d['tag'] in monitored_t or old_d['tag'] in monitored_t)

        # Eğer takip edilense özel listeye ekle
        if is_monitored:
            monitored_rows.append(row_data)
        
        # Eğer dünyayı izle açıksa global listeye ekle
        if track_all:
            global_rows.append(row_data)

    # 1. ÖNCE TAKİP EDİLENLERİN MESAJINI AT (Özel Uyarı)
    if monitored_rows:
        photo_bytes = generate_table_image(monitored_rows)
        caption = f"🎯 *HEDEF FETİH RAPORU [{world_id.upper()}]*\n_Takip listendeki bir oyuncu/klan işlem yaptı!_"
        send_telegram_photo(caption, photo_bytes, bot_token, chat_id)

    # 2. SONRA GLOBAL RAPORU AT
    if track_all and global_rows:
        photo_bytes = generate_table_image(global_rows)
        caption = f"🌍 *GLOBAL CONQUER REPORT [{world_id.upper()}]*\n*T: G=Gain, B=Barb, I=Internal*"
        send_telegram_photo(caption, photo_bytes, bot_token, chat_id)

# ====================== ANA AKIŞ ======================
# --- RENDER İÇİN MİNİ WEB SUNUCUSU ---
app = Flask(__name__)

@app.route('/')
def home():
    return "🚀 TW Engine is Alive and Running 7/24!"

def run_bot():
    last_world_check_time = 0  # Bot ilk açıldığında sıfır
    while True:
        now_ts = int(time.time())
        
        # 1. GÜNDE BİR KERE DÜNYALARI GÜNCELLE (86400 saniye = 24 saat)
        if now_ts - last_world_check_time > 86400:
            update_global_worlds(db)  # Yukarıdaki fonksiyonu çağır
            last_world_check_time = now_ts

        """Botu sonsuza kadar 3 dakikada bir çalıştıran döngü"""
        while True:
            try:
                tr_now = datetime.now(timezone.utc) + timedelta(hours=3)
                print(f"🚀 TW Engine Multi-Tenant Başlatıldı: {tr_now.strftime('%Y-%m-%d %H:%M:%S')} (TRT)")
                
                # 1. GEÇERLİ LİSANSLARI ÇEK (Güvenlik Duvarı)
                valid_keys_doc = db.collection('admin_system').document('licenses').get()
                if not valid_keys_doc.exists:
                    print("❌ SİSTEM HATASI: 'admin_system/licenses' bulunamadı!")
                    exit(1)
                approved_keys = valid_keys_doc.to_dict().get('valid_keys', [])

                # 2. KULLANICILARI DÜNYALARA GÖRE GRUPLA (Optimizasyon için)
                worlds_cache = {}
                users_docs = db.collection('users').stream()

                for user_doc in users_docs:
                    user_id = user_doc.id
                    # Lisans onaylı değilse bu kullanıcıyı atla
                    if user_id not in approved_keys:
                        print(f"🚫 Yetkisiz erişim denemesi veya süresi dolmuş lisans engellendi: {user_id[:10]}...")
                        continue

                    user_config = user_doc.to_dict()
                    gs = user_config.get('global_settings', {})
                    world_link = gs.get('world_link', '').strip().rstrip('/')
                    bot_token = gs.get('telegram_bot_token', '')
                    chat_id = gs.get('telegram_chat_id', '')

                    # Gerekli bilgiler eksikse atla
                    if not world_link or not bot_token or not chat_id or bot_token == "*****HIDDEN*****":
                        continue
                        
                    world_id = world_link.split('//')[-1].split('.')[0] # Örn: ptc1

                    if world_id not in worlds_cache:
                        worlds_cache[world_id] = {
                            'base_url': world_link,
                            'users': [],
                            'maps_fetched': False,
                            'p_map': None, 'a_map': None, 'v_map': None,
                            'conquests_lines': []
                        }
                    worlds_cache[world_id]['users'].append(user_config)

                # 3. HER DÜNYAYI VE İÇİNDEKİ KULLANICILARI İŞLE
                now_ts = int(time.time())

                for world_id, w_data in worlds_cache.items():
                    print(f"\n🌍 İşleniyor: Dünya [{world_id}] - Toplam {len(w_data['users'])} kullanıcı aktif.")
                    base_url = w_data['base_url']

                    # --- A. DÜNYA FETİH VERİLERİNİ ÇEK (Sadece 1 Kere) ---
                    check_ref = db.collection('worlds').document(world_id).collection('config').document('last_conquer_check')
                    check_doc = check_ref.get()
                    last_ts = check_doc.to_dict().get('timestamp', 0) if check_doc.exists else now_ts - 3600
                    
                    # 86400 (1 gün) veya gelecek zaman hatası varsa son 1 saate çek
                    if last_ts > now_ts or (now_ts - last_ts) > 86400: 
                        last_ts = now_ts - 3600 
                        print(f"   ⚠️  {world_id} - Timestamp sıfırlandı (çok eski/yüksek)")

                    url = f"{base_url}/interface.php?func=get_conquer&since={last_ts}"
                    print(f"   🔍 {world_id} - since={last_ts} ({datetime.fromtimestamp(last_ts, tz=timezone.utc) + timedelta(hours=3):%H:%M:%S} TRT)")

                    try:
                        conquests_text = requests.get(url, timeout=10).text.strip()
                        if conquests_text:
                            w_data['conquests_lines'] = conquests_text.splitlines()
                            print(f"🔍 {len(w_data['conquests_lines'])} yeni fetih bulundu, haritalar indiriliyor...")
                        else:
                            print(f"   ℹ️  {world_id} - Yeni fetih yok")
                    except Exception as e:
                        print(f"Fetih çekme hatası ({world_id}): {e}")
                        w_data['conquests_lines'] = []

                    # Eğer fetih varsa, harita verilerini (isim, köy koordinat) de 1 kere çek
                    current_max_ts = last_ts
                    if w_data['conquests_lines']:
                        print(f"🔍 {len(w_data['conquests_lines'])} yeni fetih bulundu, haritalar indiriliyor...")
                        w_data['p_map'], w_data['a_map'], w_data['v_map'] = get_world_data_maps(base_url)
                        w_data['maps_fetched'] = True
                        
                        # Yeni max_ts'i hesapla
                        for line in w_data['conquests_lines']:
                            parts = line.split(',')
                            if len(parts) >= 2:
                                ts = int(parts[1])
                                if ts > current_max_ts: current_max_ts = ts
                    
                    # --- B. BU DÜNYADAKİ KULLANICILARI DÖNGÜYE SOK ---
                    for user_config in w_data['users']:
                        user_log_name = user_config['global_settings']['telegram_chat_id']
                        print(f"  👤 İşleniyor: Kullanıcı/ChatID -> {user_log_name}")

                        # 1. Fetihleri Kullanıcıya Göre Filtrele ve Gönder
                        if w_data['conquests_lines']:
                            process_user_conquests(user_config, w_data['conquests_lines'], w_data['p_map'], w_data['a_map'], w_data['v_map'], world_id, last_ts)

                        # 2. Periyodik Raporları Belirle ve Gönder
                        p_settings = user_config.get('periodic_reports', {})
                        modes = []
                        
                        # --- TRT Saatlerine Göre Kontrol (YENİ AYARLAR) ---
                        
                        # SAATLİK RAPOR (Saat başı ilk 5 dakika içinde çalışır)
                        if p_settings.get("hourlyReport") and tr_now.minute < 5: 
                            modes.append("hourly")
                        
                        # GÜNLÜK RAPOR (Her sabah 09:00 - 09:05 arası)
                        if p_settings.get("dailyReport") and tr_now.hour == 9 and tr_now.minute < 5: 
                            modes.append("daily")
                        
                        # HAFTALIK RAPOR (Pazartesi sabah 09:00 - 09:05 arası)
                        # weekday() == 0 Pazartesi demektir.
                        if p_settings.get("weeklyReport") and tr_now.weekday() == 0 and tr_now.hour == 9 and tr_now.minute < 5: 
                            modes.append("weekly")

                        # Belirlenen raporları gönder
                        for mode in modes:
                            for p in user_config.get('monitored_players', []):
                                process_periodic_report(world_id, base_url, user_config, p['name'], "Player", mode)
                            for t in user_config.get('monitored_tribes', []):
                                process_periodic_report(world_id, base_url, user_config, t['tag'], "Tribe", mode)

                    # Dünya işlemleri bitince, o dünyanın son fetih saatini güncelle
                    check_ref.set({"timestamp": current_max_ts})
                print(f"  ⏰ TRT: {tr_now.strftime('%H:%M')} | Hourly: {p_settings.get('hourlyReport')} | Daily: {p_settings.get('dailyReport')} | Weekly: {p_settings.get('weeklyReport')}")

                print("\n✅ Tüm dünyalar ve kullanıcılar için TW Engine işlemi tamamlandı.")
                
            except Exception as e:
                print(f"🔥 Döngüde hata oluştu ama bot çökmeyecek: {e}")
                
            # İşlem bitince 3 dakika (180 saniye) uyu, sonra tekrar başa dön!
            print("⏳ 3 dakika bekleniyor...\n")
            time.sleep(180) 

# ====================== ANA AKIŞ ======================
if __name__ == "__main__":
    # 1. Botu arka planda ayrı bir kolda (thread) başlat
    bot_thread = Thread(target=run_bot)
    bot_thread.daemon = True
    bot_thread.start()
    
    # 2. Flask Web Sunucusunu Başlat (Render'ın botu canlı görmesi için şart)
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)