import os
import json
import requests # type: ignore
import firebase_admin # type: ignore
import urllib.parse
import time
import io # Resim verisi için
from firebase_admin import credentials, firestore # type: ignore
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw, ImageFont # type: ignore

# ====================== AYARLAR & BAĞLANTI ======================
FIREBASE_KEY_JSON = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID')
WORLD_ID = "ptc1"
BASE_URL = "https://ptc1.tribalwars.com.pt"

# Firebase Başlatma
if not firebase_admin._apps:
    cred = credentials.Certificate(json.loads(FIREBASE_KEY_JSON))
    firebase_admin.initialize_app(cred)
db = firestore.client()

# ====================== TABLO RESMİ OLUŞTURMA ======================
def generate_table_image(rows):
    """Verileri şık bir koyu tema tablo resmine dönüştürür"""
    headers = ["Saat", "Yeni Sahip", "Eski Sahip", "Köy (Kıta)", "Puan", "T"]
    
    # Font Ayarları
    font_size = 14
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", font_size)
        char_w = 8.5
    except:
        font = ImageFont.load_default()
        char_w = 7.0

    # Sütun Genişlikleri (Karakter Sayısı)
    col_widths = [6, 18, 18, 15, 9, 3]
    cell_h = 28
    margin = 20
    
    # Resim Boyutu Hesaplama
    width = int(sum(col_widths) * char_w + (len(col_widths) * 10) + (margin * 2))
    height = (len(rows) + 2) * cell_h + (margin * 2)

    # Arka Plan (Koyu Tema)
    img = Image.new("RGB", (width, height), (25, 25, 25))
    draw = ImageDraw.Draw(img)

    # Başlıkları Yaz
    x_offset = margin
    for i, h in enumerate(headers):
        # Puan sütununu (index 4) sağa '>'. Diğerlerini sola '<' hizala
        align = ">" if i == 4 else "<"
        text_format = f"{h:{align}{col_widths[i]}}"
        draw.text((x_offset, margin), text_format, font=font, fill=(255, 215, 0))
        x_offset += col_widths[i] * char_w + 10

    # Ayırıcı Çizgi
    draw.line((margin, margin + 25, width - margin, margin + 25), fill=(80, 80, 80), width=1)

    # Verileri Yaz
    y_offset = margin + 35
    for row in rows:
        x_offset = margin
        for i, cell in enumerate(row):
            # Puan sütununu (index 4) sağa '>'. Diğerlerini sola '<' hizala
            align = ">" if i == 4 else "<"
            text_format = f"{str(cell):{align}{col_widths[i]}}"
            draw.text((x_offset, y_offset), text_format, font=font, fill=(230, 230, 230))
            x_offset += col_widths[i] * char_w + 10
        y_offset += cell_h

    # Belleğe Kaydet
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()
# ====================== TELEGRAM GÖNDERME ======================
def send_telegram_photo(caption, photo_bytes):
    """Telegram mesajını fotoğraf olarak gönderir"""
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
        payload = {"chat_id": TELEGRAM_CHAT_ID, "caption": caption, "parse_mode": "Markdown"}
        
        # io'daki fotoğraf verisini Telegram'a gönder
        files = {"photo": ("conquer_report.png", photo_bytes, "image/png")}
        
        requests.post(url, data=payload, files=files, timeout=15)
    except Exception as e:
        print(f"Fotoğraf gönderilemedi: {e}")
        # Hata varsa metin olarak göndermeyi dene (Kurtarma)
        # requests.post(..., text=caption, ...) # Opsiyonel

# ... (Veri Haritalama ve Stats Çekme fonksiyonları aynı kalır - twcu_reports.py içindeki get_world_data_maps, get_entity_stats, process_periodic_report) ...
def get_world_data_maps():
    """ID -> Detaylı Bilgi haritalarını oluşturur (Village, Player, Ally)"""
    p_map = {"0": {"name": "Barbarian", "tag": ""}}
    a_map = {"0": ""}
    v_map = {}

    try:
        # 1. Klanlar
        a_req = requests.get(f"{BASE_URL}/map/ally.txt", timeout=15).text.splitlines()
        for line in a_req:
            parts = line.split(',')
            if len(parts) >= 3:
                a_map[parts[0]] = urllib.parse.unquote_plus(parts[2])

        # 2. Oyuncular
        p_req = requests.get(f"{BASE_URL}/map/player.txt", timeout=15).text.splitlines()
        for line in p_req:
            parts = line.split(',')
            if len(parts) >= 3:
                p_map[parts[0]] = {
                    "name": urllib.parse.unquote_plus(parts[1]),
                    "tag": a_map.get(parts[2], "")
                }

        # 3. Köyler (Koordinat, Kıta ve Puan)
        v_req = requests.get(f"{BASE_URL}/map/village.txt", timeout=15).text.splitlines()
        for line in v_req:
            parts = line.split(',')
            if len(parts) >= 6:
                vx, vy, pts = parts[2], parts[3], int(parts[5])
                continent = f"K{vy[:1]}{vx[:1]}"
                v_map[parts[0]] = {
                    "coord": f"{vx}|{vy} ({continent})",
                    "pts": f"{pts:,}".replace(",", ".")
                }
    except Exception as e:
        print(f"Map çekme hatası: {e}")
    
    return p_map, a_map, v_map

def get_entity_stats(name, is_tribe=False):
    """Oyuncu veya klanın güncel istatistiklerini çeker"""
    stats = {"id": None, "points": 0, "villages": 0, "od_att": 0, "od_def": 0, "od_sup": 0}
    file_type = "ally" if is_tribe else "player"
    
    try:
        r = requests.get(f"{BASE_URL}/map/{file_type}.txt", timeout=10)
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

    # OD Verileri
    suffix = "_tribe" if is_tribe else ""
    od_tasks = [("kill_att", "od_att"), ("kill_def", "od_def")]
    if not is_tribe: od_tasks.append(("kill_sup", "od_sup"))
    else: od_tasks.append(("kill_all_tribe", "od_all"))

    for f_name, key in od_tasks:
        try:
            res = requests.get(f"{BASE_URL}/map/{f_name}{suffix if 'tribe' not in f_name else ''}.txt", timeout=10)
            for line in res.text.splitlines():
                p = line.split(',')
                if p[1] == stats["id"]:
                    stats[key] = int(p[2])
                    break
        except: pass
    
    if is_tribe:
        stats["od_sup"] = max(0, stats.get("od_all", 0) - stats["od_att"] - stats["od_def"])
    return stats

def process_periodic_report(name, e_type, mode, p_settings):
    """Saatlik/Günlük raporları işler"""
    is_tribe = e_type == "Tribe"
    now_stats = get_entity_stats(name, is_tribe)
    if not now_stats["id"]: return

    ref = db.collection('worlds').document(WORLD_ID).collection(f"{mode}_snapshots").document(f"{e_type}_{name}")
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

    # Raporlar metin kalabilir (Çok yer kaplamaz)
    # create_text_report(f"{header}```\n{sep}\n{table_body}```\n{footer}") 
    # Ama istenirse send_telegram_photo ile resim olarak da gönderilebilir.

    # Raporlar metin olarak kalır
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": "\n".join(lines), "parse_mode": "Markdown"}
    requests.post(url, json=payload, timeout=10)

    now_stats["timestamp"] = datetime.now(timezone.utc).isoformat()
    ref.set(now_stats)

# ====================== ANA MODÜL (FETİH TAKİBİ) ======================
def check_conquer_notifications(config):
    """Fetihleri kontrol eder ve tabloyu resim olarak gönderir"""
    print("🔍 Fetih kontrolü (Resim Tablosu)...")
    
    p_settings = config.get('periodic_reports', {})
    track_all = p_settings.get('trackAllConquests', False)

    check_ref = db.collection('worlds').document(WORLD_ID).collection('config').document('last_conquer_check')
    check_doc = check_ref.get()
    now_ts = int(time.time())

    if check_doc.exists:
        last_ts = check_doc.to_dict().get('timestamp', 0)
        if last_ts > now_ts or (now_ts - last_ts) > 86400:
            last_ts = now_ts - 3600 # Hata varsa son 1 saate dön
    else:
        last_ts = now_ts - 3600

    url = f"{BASE_URL}/interface.php?func=get_conquer&since={last_ts}"
    try:
        lines = requests.get(url, timeout=10).text.strip().splitlines()
        if not lines: return
    except: return

    p_map, a_map, v_map = get_world_data_maps()
    monitored_p = {p['name']: p.get('active_filters', []) for p in config.get('monitored_players', [])}
    monitored_t = {t['tag']: t.get('active_filters', []) for t in config.get('monitored_tribes', [])}

    # Resim tablosu için satırları topla (Dizi olarak)
    table_rows = []
    current_max_ts = last_ts

    for line in lines:
        parts = line.split(',')
        if len(parts) < 4: continue
        v_id, ts, new_id, old_id = parts[0], int(parts[1]), parts[2], parts[3]
        
        if ts > current_max_ts: current_max_ts = ts

        # Veri Hazırlama
        v_info = v_map.get(v_id, {"coord": "??|?? (K??)", "pts": "???"})
        new_d = p_map.get(new_id, {"name": "Unknown", "tag": ""})
        old_d = p_map.get(old_id, {"name": "Barbarian", "tag": ""})
        
        # İsim(Klan) Formatı
        new_txt = f"{new_d['name']}({new_d['tag']})" if new_d['tag'] else new_d['name']
        old_txt = f"{old_d['name']}({old_d['tag']})" if old_d['tag'] else old_d['name']
        
        # Filtreleme & Tip
        tip = "G" # Gain
        if old_id == "0": tip = "B" # Barbarian
        elif new_d['tag'] == old_d['tag'] and new_d['tag'] != "": tip = "I" # Internal

        is_monitored = (new_d['name'] in monitored_p or old_d['name'] in monitored_p or 
                        new_d['tag'] in monitored_t or old_d['tag'] in monitored_t)

        if track_all or is_monitored:
            tr_time = datetime.fromtimestamp(ts, tz=timezone.utc) + timedelta(hours=3)
            t_str = tr_time.strftime('%H:%M')
            # Resim tablosu satırı: Saat | Yeni | Eski | Köy | Puan | T
            row_data = [t_str, new_txt[:16], old_txt[:16], v_info['coord'], v_info['pts'], tip]
            table_rows.append(row_data)

    if table_rows:
        # 1. Metin tablosunu oluşturma mantığını siliyoruz.
        # 2. generate_table_image fonksiyonu ile resim oluşturuyoruz.
        # 3. send_telegram_photo ile gönderiyoruz.
        
        # Resmi Oluştur
        photo_bytes = generate_table_image(table_rows)
        
        # Telegram Mesajı
        caption = "🌍 *GLOBAL CONQUER REPORT*\n*T: G=Gain, B=Barb, I=Internal*"
        send_telegram_photo(caption, photo_bytes)

    check_ref.set({"timestamp": current_max_ts})

# ====================== GÜVENLİK VE LİSANS KONTROLÜ ======================
def verify_license(config):
    """Kullanıcının lisans anahtarını Firebase'deki kasa ile karşılaştırır"""
    print("🔐 Güvenlik duvarı: Lisans kontrol ediliyor...")
    
    # React'ten gelen şifreyi al
    global_settings = config.get('global_settings', {})
    special_id = global_settings.get('special_access_id', '').strip()

    # Şifre yoksa veya boşsa sistemi kapat
    if not special_id or special_id == "[EMPTY]":
        print("❌ YETKİSİZ ERİŞİM: Lisans anahtarı bulunamadı! Lütfen React panelinden 66 haneli ID'nizi oluşturun.")
        exit(1)

    try:
        # Kasanın (admin_system > licenses) içine bak
        license_doc = db.collection('admin_system').document('licenses').get()
        
        if not license_doc.exists:
            print("❌ SİSTEM HATASI: 'admin_system/licenses' kasası Firebase'de bulunamadı!")
            exit(1)
        
        # Kasadaki onaylı şifreleri (Array) al
        approved_keys = license_doc.to_dict().get('valid_keys', [])
        
        # Kullanıcının şifresi kasada yoksa sistemi kapat
        if special_id not in approved_keys:
            # Şifrenin sadece ilk 10 hanesini gösterelim ki loglardan çalınmasın
            print(f"🚫 YETKİSİZ ERİŞİM: Bu lisans ID'si ({special_id[:10]}...) yönetici tarafından onaylanmamış!")
            exit(1)
            
        print("✅ LİSANS ONAYLANDI! Sisteme giriş yapılıyor...")
    except Exception as e:
        print(f"🔥 Lisans doğrulama servisi çöktü: {e}")
        exit(1)
        
# ====================== ANA AKIŞ ======================
if __name__ == "__main__":
    try:
        # 1. TÜRKİYE SAATİNİ (UTC+3) HESAPLA
        tr_now = datetime.now(timezone.utc) + timedelta(hours=3)
        print(f"🚀 TW Engine Başlatıldı: {tr_now.strftime('%Y-%m-%d %H:%M:%S')} (TRT)")
        
        # 2. AYARLARI ÇEK
        config_doc = db.collection('worlds').document(WORLD_ID).collection('config').document('main_settings').get()
        if not config_doc.exists:
            print("❌ Firebase config bulunamadı!")
            exit(1)
            
        config = config_doc.to_dict()

        # 3. KAPIYI KONTROL ET (GÜVENLİK ONAYI)
        verify_license(config)

        # 4. TELEGRAM AYARLARINI GÜNCELLE
        sc = config.get('global_settings', {}).get('telegram_chat_id')
        if sc and sc != "[EMPTY]": 
            TELEGRAM_CHAT_ID = sc

        # 5. FETİHLERİ KONTROL ET (Resimli Tablo)
        check_conquer_notifications(config) 

       # 6. RAPOR MODLARINI BELİRLE (Türkiye Saatine Göre)
        p_settings = config.get('periodic_reports', {})
        modes = []
        
        # SAATLİK RAPOR (Sadece saat başlarında çalışır, örn: 15:00 - 15:09 arası)
        if p_settings.get("hourlyReport") and tr_now.minute < 10: 
            modes.append("hourly")
            
        # GÜNLÜK RAPOR (Sadece Sabah 09:00 - 09:09 TRT arasında çalışır)
        if tr_now.hour == 9 and tr_now.minute < 10 and p_settings.get("dailyReport"): 
            modes.append("daily")
            
        # HAFTALIK RAPOR (Sadece Pazar günleri sabah 09:00 - 09:09 TRT arasında çalışır)
        if tr_now.hour == 9 and tr_now.minute < 10 and tr_now.weekday() == 6 and p_settings.get("weeklyReport"): 
            modes.append("weekly")

        # 7. PERİYODİK RAPORLARI ÇALIŞTIR
        for mode in modes:
            print(f"📊 {mode.upper()} raporları hazırlanıyor...")
            for p in config.get('monitored_players', []):
                process_periodic_report(p['name'], "Player", mode, p_settings)
            for t in config.get('monitored_tribes', []):
                process_periodic_report(t['tag'], "Tribe", mode, p_settings)

        print("✅ TW Engine işlemi tamamlandı.")
        
    except Exception as e:
        print(f"🔥 KRİTİK HATA: {e}")
        raise e