import os
import json
import requests # type: ignore
import firebase_admin # type: ignore
import urllib.parse
import time
import io
from firebase_admin import credentials, firestore # type: ignore
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw, ImageFont # type: ignore

# ====================== BAŞLATMA ======================
FIREBASE_KEY_JSON = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')

if not firebase_admin._apps:
    cred = credentials.Certificate(json.loads(FIREBASE_KEY_JSON))
    firebase_admin.initialize_app(cred)
db = firestore.client()

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

# ====================== RAPORLAMA MANTIKLARI ======================
def process_periodic_report(world_id, base_url, user_config, name, e_type, mode):
    """Kullanıcıya özel saatlik/günlük raporları işler"""
    is_tribe = e_type == "Tribe"
    p_settings = user_config.get('periodic_reports', {})
    bot_token = user_config['global_settings']['telegram_bot_token']
    chat_id = user_config['global_settings']['telegram_chat_id']

    now_stats = get_entity_stats(name, is_tribe, base_url)
    if not now_stats["id"]: return

    # Snapshots (anlık görüntüler) dünya bazında ortak tutulur
    ref = db.collection('worlds').document(world_id).collection(f"{mode}_snapshots").document(f"{e_type}_{name}")
    old_doc = ref.get()
    old_stats = old_doc.to_dict() if old_doc.exists else {}
    tr_now = datetime.now(timezone.utc) + timedelta(hours=3)

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

    send_telegram_message("\n".join(lines), bot_token, chat_id)

    # Dünya snapshot'ını güncelle (aynı dünyadaki diğer kullanıcılar da taze veri üzerinden hesap yapsın)
    now_stats["timestamp"] = datetime.now(timezone.utc).isoformat()
    ref.set(now_stats)

def process_user_conquests(user_config, conquests_lines, p_map, a_map, v_map):
    """Çekilmiş fetih verilerini kullanıcının filtrelerine göre tarayıp mesaj atar"""
    p_settings = user_config.get('periodic_reports', {})
    track_all = p_settings.get('trackAllConquests', False)
    bot_token = user_config['global_settings']['telegram_bot_token']
    chat_id = user_config['global_settings']['telegram_chat_id']

    monitored_p = {p['name']: p.get('active_filters', []) for p in user_config.get('monitored_players', [])}
    monitored_t = {t['tag']: t.get('active_filters', []) for t in user_config.get('monitored_tribes', [])}

    table_rows = []

    for line in conquests_lines:
        parts = line.split(',')
        if len(parts) < 4: continue
        v_id, ts, new_id, old_id = parts[0], int(parts[1]), parts[2], parts[3]
        
        v_info = v_map.get(v_id, {"coord": "??|?? (K??)", "pts": "???"})
        new_d = p_map.get(new_id, {"name": "Unknown", "tag": ""})
        old_d = p_map.get(old_id, {"name": "Barbarian", "tag": ""})
        
        new_txt = f"{new_d['name']}({new_d['tag']})" if new_d['tag'] else new_d['name']
        old_txt = f"{old_d['name']}({old_d['tag']})" if old_d['tag'] else old_d['name']
        
        tip = "G"
        if old_id == "0": tip = "B"
        elif new_d['tag'] == old_d['tag'] and new_d['tag'] != "": tip = "I"

        is_monitored = (new_d['name'] in monitored_p or old_d['name'] in monitored_p or 
                        new_d['tag'] in monitored_t or old_d['tag'] in monitored_t)

        if track_all or is_monitored:
            tr_time = datetime.fromtimestamp(ts, tz=timezone.utc) + timedelta(hours=3)
            row_data = [tr_time.strftime('%H:%M'), new_txt[:16], old_txt[:16], v_info['coord'], v_info['pts'], tip]
            table_rows.append(row_data)

    if table_rows:
        photo_bytes = generate_table_image(table_rows)
        caption = "🌍 *CONQUER REPORT*\n*T: G=Gain, B=Barb, I=Internal*"
        send_telegram_photo(caption, photo_bytes, bot_token, chat_id)

# ====================== ANA AKIŞ ======================
if __name__ == "__main__":
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
            if last_ts > now_ts or (now_ts - last_ts) > 86400: last_ts = now_ts - 3600 

            url = f"{base_url}/interface.php?func=get_conquer&since={last_ts}"
            try:
                conquests_text = requests.get(url, timeout=10).text.strip()
                if conquests_text:
                    w_data['conquests_lines'] = conquests_text.splitlines()
            except Exception as e:
                print(f"Fetih çekme hatası ({world_id}): {e}")

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
                    process_user_conquests(user_config, w_data['conquests_lines'], w_data['p_map'], w_data['a_map'], w_data['v_map'])

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

        print("\n✅ Tüm dünyalar ve kullanıcılar için TW Engine işlemi tamamlandı.")

    except Exception as e:
        print(f"🔥 KRİTİK HATA: {e}")
        raise e