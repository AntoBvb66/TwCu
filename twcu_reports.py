import os
import requests
import gzip
import json
import io
import urllib.parse
import time
import schedule
import gc
import asyncio
import aiohttp
import certifi
from datetime import datetime
from threading import Thread
from flask import Flask, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from sqlalchemy import create_engine, text
from PIL import Image, ImageDraw, ImageFont

# ==========================================
# 1. BAĞLANTILAR (FIREBASE & TiDB)
# ==========================================
try:
    FIREBASE_KEY_JSON = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')
    if not firebase_admin._apps:
        cred = credentials.Certificate(json.loads(FIREBASE_KEY_JSON))
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Firebase bağlantısı başarılı!")
except Exception as e:
    print(f"❌ Firebase bağlantı hatası: {e}")

db_engine = None
try:
    TIDB_URI = os.environ.get("TIDB_URI")
    ssl_args = {'ssl': {'ca': certifi.where()}}
    db_engine = create_engine(TIDB_URI, pool_recycle=3600, connect_args=ssl_args)
    print("✅ TiDB (MySQL) Bağlantı Motoru Hazır!")
except Exception as e:
    print(f"❌ TiDB bağlantı hatası: {e}")

DOSYALAR = {
    "/map/village.txt.gz": "Koyler",
    "/map/player.txt.gz": "Oyuncular",
    "/map/ally.txt.gz": "Klanlar"
}

# ==========================================
# 2. DİL VE ÇİZİM AYARLARI (TELEGRAM İÇİN)
# ==========================================
LANG = {
    "tr": {"gains": "KAZANÇ", "losses": "KAYIP", "internal": "İÇ FETİH", "barbarian": "BARBAR", "self": "KENDİ KÖYÜ", "other": "FETİH", "village": "Köy", "points": "Puan", "old": "Eski Sahip", "new": "Yeni Sahip"},
    "en": {"gains": "GAINS", "losses": "LOSSES", "internal": "INTERNAL", "barbarian": "BARBARIAN", "self": "SELF CONQ.", "other": "CONQUEST", "village": "Village", "points": "Points", "old": "Old Owner", "new": "New Owner"}
}

COLORS = {
    "gains": (46, 204, 113),      # Yeşil
    "losses": (231, 76, 60),      # Kırmızı
    "internal": (52, 152, 219),   # Mavi
    "barbarian": (149, 165, 166), # Gri
    "self": (241, 196, 15),       # Sarı
    "other": (155, 89, 182)       # Mor
}

def get_conquest_type(fetih, active_filters, p_name=None, t_tag=None):
    """Fetihin türünü filtreye göre belirler."""
    if fetih["eski_sahip"] == fetih["yeni_sahip"]: return "self"
    if fetih["eski_sahip"] == "Barbar": return "barbarian"
    if fetih["eski_klan_tag"] == fetih["yeni_klan_tag"] and fetih["eski_klan_tag"] != "---": return "internal"
    
    if p_name:
        if fetih["yeni_sahip"] == p_name and "gains" in active_filters: return "gains"
        if fetih["eski_sahip"] == p_name and "losses" in active_filters: return "losses"
    if t_tag:
        if fetih["yeni_klan_tag"] == t_tag and "gains" in active_filters: return "gains"
        if fetih["eski_klan_tag"] == t_tag and "losses" in active_filters: return "losses"
    
    return "other"

def generate_text_report(fetih, lang_code, world_id):
    """Metin bildirim şablonu oluşturur."""
    l = LANG.get(lang_code, LANG["en"])
    tur_adi = l.get(fetih["tur"], l["other"])
    
    ikon = "⚔️"
    if fetih["tur"] == "gains": ikon = "🟢"
    elif fetih["tur"] == "losses": ikon = "🔴"
    elif fetih["tur"] == "barbarian": ikon = "⚪"
    elif fetih["tur"] == "internal": ikon = "🔵"
    
    text = f"{ikon} *[{world_id.upper()}] {tur_adi}*\n"
    text += f"🏡 {l['village']}: {fetih['koy_adi']} ({fetih['koordinat']}) K{fetih['kita']}\n"
    text += f"📈 {l['points']}: {fetih['puan']}\n"
    text += f"🛡 {l['old']}: {fetih['eski_sahip']} [{fetih['eski_klan_tag']}]\n"
    text += f"🗡 {l['new']}: {fetih['yeni_sahip']} [{fetih['yeni_klan_tag']}]"
    return text

def generate_grid_table(fetih, lang_code, world_id):
    """Görsel bildirim şablonu oluşturur (Pillow)."""
    l = LANG.get(lang_code, LANG["en"])
    tur_adi = l.get(fetih["tur"], l["other"])
    renk = COLORS.get(fetih["tur"], (255,255,255))
    
    width, height = 600, 300
    img = Image.new('RGB', (width, height), color=(30, 30, 30))
    d = ImageDraw.Draw(img)
    
    # Basit bir tasarım için font varsayılan yüklenir (Sunucuda TTF olmayabilir diye default font)
    font = ImageFont.load_default()
    
    # Başlık Şeridi
    d.rectangle([0, 0, width, 50], fill=renk)
    d.text((10, 15), f"[{world_id.upper()}] {tur_adi}", fill=(255,255,255), font=font)
    
    # Veriler
    d.text((20, 80), f"{l['village']}: {fetih['koy_adi']} ({fetih['koordinat']}) K{fetih['kita']}", fill=(200,200,200), font=font)
    d.text((20, 120), f"{l['points']}: {fetih['puan']}", fill=(200,200,200), font=font)
    d.text((20, 160), f"{l['old']}: {fetih['eski_sahip']} [{fetih['eski_klan_tag']}]", fill=(231, 76, 60), font=font)
    d.text((20, 200), f"{l['new']}: {fetih['yeni_sahip']} [{fetih['yeni_klan_tag']}]", fill=(46, 204, 113), font=font)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf

# ==========================================
# 3. TELEGRAM GÖNDERİM MOTORU (ASYNC)
# ==========================================
async def send_async_telegram(session, bot_token, chat_id, text_msg=None, image_buf=None):
    url = f"https://api.telegram.org/bot{bot_token}/"
    try:
        if image_buf:
            req_url = url + "sendPhoto"
            data = aiohttp.FormData()
            data.add_field('chat_id', chat_id)
            data.add_field('photo', image_buf, filename='report.png', content_type='image/png')
            if text_msg: data.add_field('caption', text_msg, parse_mode='Markdown')
            async with session.post(req_url, data=data) as response:
                await response.read()
        elif text_msg:
            req_url = url + "sendMessage"
            payload = {'chat_id': chat_id, 'text': text_msg, 'parse_mode': 'Markdown'}
            async with session.post(req_url, json=payload) as response:
                await response.read()
    except Exception as e:
        print(f"Telegram gönderim hatası: {e}")

async def dispatch_all_tasks(tasks_queue):
    async with aiohttp.ClientSession() as session:
        tasks = []
        for (b_token, c_id, text_msg, img_buf) in tasks_queue:
            tasks.append(send_async_telegram(session, b_token, c_id, text_msg, img_buf))
        await asyncio.gather(*tasks)

# ==========================================
# 4. MOTOR 1: SAATLİK ARŞİVCİ (TiDB YAZICI)
# ==========================================
def get_active_worlds():
    try:
        doc = db.collection('system_data').document('active_worlds').get()
        all_worlds = []
        if doc.exists:
            for dunya_listesi in doc.to_dict().values():
                if isinstance(dunya_listesi, list): all_worlds.extend(dunya_listesi)
            return all_worlds
        return []
    except: return []

def ana_arsiv_gorevi():
    if db_engine is None: return
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] SAATLİK ARŞİVLEME BAŞLADI (TiDB)...")
    dunyalar = get_active_worlds()

    for d in dunyalar:
        d_id = d.get('id')
        d_url = d.get('url')
        if not d_id or not d_url: continue
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {d_id} çekiliyor...")
        try:
            with db_engine.connect() as conn:
                for endpoint, tablo_adi in DOSYALAR.items():
                    g_tablo = f"{d_id}_{tablo_adi}_temp"
                    g_gercek = f"{d_id}_{tablo_adi}"
                    try:
                        r = requests.get(f"{d_url.rstrip('/')}{endpoint}", stream=True, timeout=20)
                        if r.status_code == 200:
                            conn.execute(text(f"DROP TABLE IF EXISTS {g_tablo}"))
                            conn.execute(text(f"CREATE TABLE {g_tablo} (id VARCHAR(30) PRIMARY KEY, veri JSON)"))
                            toplu_veri, CHUNK_SIZE, kaydedilen = [], 2500, 0
                            
                            with gzip.open(io.BytesIO(r.content), 'rt', encoding='utf-8') as f:
                                for satir in f:
                                    if satir.strip():
                                        parcalar = [urllib.parse.unquote_plus(p) for p in satir.strip().split(',')]
                                        toplu_veri.append({"id": str(parcalar[0]), "veri": json.dumps(parcalar)})
                                        if len(toplu_veri) >= CHUNK_SIZE:
                                            conn.execute(text(f"INSERT INTO {g_tablo} (id, veri) VALUES (:id, :veri)"), toplu_veri)
                                            kaydedilen += len(toplu_veri)
                                            toplu_veri.clear()
                            if toplu_veri:
                                conn.execute(text(f"INSERT INTO {g_tablo} (id, veri) VALUES (:id, :veri)"), toplu_veri)
                                kaydedilen += len(toplu_veri)
                            if kaydedilen > 0:
                                conn.execute(text(f"DROP TABLE IF EXISTS {g_gercek}"))
                                conn.execute(text(f"RENAME TABLE {g_tablo} TO {g_gercek}"))
                                conn.commit()
                    except Exception as e:
                        conn.rollback()
        except: pass
        time.sleep(1)
        gc.collect()
    print("SAATLİK GÜNCELLEME TAMAMLANDI.")

def run_schedule():
    ana_arsiv_gorevi()
    schedule.every().hour.at(":00").do(ana_arsiv_gorevi)
    while True:
        schedule.run_pending()
        time.sleep(1)

# ==========================================
# 5. MOTOR 2: TELEGRAM RADARI (CANLI FETİH)
# ==========================================
def get_info_from_tidb(world_id, tablo_adi, doc_id):
    if not db_engine or str(doc_id) == "0": return None
    sorgu = text(f"SELECT veri FROM {world_id}_{tablo_adi} WHERE id = :doc_id")
    try:
        with db_engine.connect() as conn:
            sonuc = conn.execute(sorgu, {"doc_id": str(doc_id)}).fetchone()
            if sonuc: return json.loads(sonuc[0]) 
    except: pass
    return None

def check_filters(fetih, active_filters, p_name=None, t_tag=None):
    tur = get_conquest_type(fetih, active_filters, p_name, t_tag)
    if tur in active_filters: return True
    if "selfConquer" in active_filters and tur == "self": return True
    if "barbarian" in active_filters and tur == "barbarian": return True
    if "internal" in active_filters and tur == "internal": return True
    return False

def run_telegram_radar():
    print("🚀 Telegram Radar Motoru Başlatıldı...")
    while True:
        try:
            users_docs = list(db.collection('users').stream()) 
            worlds_cache = {}
            for doc in users_docs:
                config = doc.to_dict()
                gs = config.get('global_settings', {})
                w_link = gs.get('world_link', '').strip().rstrip('/')
                b_token = gs.get('telegram_bot_token', '')
                c_id = gs.get('telegram_chat_id', '')
                if not w_link or not b_token or not c_id or b_token == "[EMPTY]": continue
                w_id = w_link.split('//')[-1].split('.')[0]
                if w_id not in worlds_cache: worlds_cache[w_id] = {'users': [], 'url': w_link}
                worlds_cache[w_id]['users'].append(config)

            async_tasks_queue = []
            now_ts = int(time.time())

            for world_id, w_data in worlds_cache.items():
                check_ref = db.collection('system_data').document('last_conquests').collection(world_id).document('ts')
                last_ts_doc = check_ref.get()
                last_ts = last_ts_doc.to_dict().get('timestamp', 0) if last_ts_doc.exists else now_ts - 300 # Son 5 dk

                try:
                    r = requests.get(f"{w_data['url']}/interface.php?func=get_conquer&since={last_ts + 1}", timeout=5)
                    if r.status_code != 200 or not r.text.strip(): continue
                except: continue

                yeni_fetihler = []
                max_ts = last_ts

                for satir in r.text.strip().split('\n'):
                    if not satir: continue
                    v_id, ts, new_o, old_o = satir.split(',')
                    ts = int(ts)
                    if ts > max_ts: max_ts = ts

                    koy = get_info_from_tidb(world_id, "Koyler", v_id)
                    yeni_oy = get_info_from_tidb(world_id, "Oyuncular", new_o)
                    eski_oy = get_info_from_tidb(world_id, "Oyuncular", old_o)
                    y_klan = get_info_from_tidb(world_id, "Klanlar", yeni_oy[2]) if yeni_oy and yeni_oy[2] != "0" else None
                    e_klan = get_info_from_tidb(world_id, "Klanlar", eski_oy[2]) if eski_oy and eski_oy[2] != "0" else None

                    koordinat, kita, puan, koy_adi = "000|000", "K00", "0", "Bilinmeyen"
                    if koy:
                        x, y = str(koy[2]).zfill(3), str(koy[3]).zfill(3)
                        koordinat, kita, puan, koy_adi = f"{x}|{y}", f"{y[0]}{x[0]}", str(koy[5]), str(koy[1])

                    yeni_fetihler.append({
                        "koy_adi": koy_adi, "koordinat": koordinat, "kita": kita, "puan": puan,
                        "yeni_sahip": str(yeni_oy[1]) if yeni_oy else "Barbar", "yeni_klan_tag": str(y_klan[2]) if y_klan else "---",
                        "eski_sahip": str(eski_oy[1]) if eski_oy else "Barbar", "eski_klan_tag": str(e_klan[2]) if e_klan else "---", "ts": ts
                    })

                if not yeni_fetihler: continue

                for u_cfg in w_data['users']:
                    kitalar = [k.strip() for k in u_cfg.get("continent_tracking", "").split(",") if k.strip()]
                    full_track = u_cfg.get("full_tracking", False)
                    m_players = u_cfg.get("monitored_players", [])
                    m_tribes = u_cfg.get("monitored_tribes", [])
                    
                    gs = u_cfg.get('global_settings', {})
                    lang = gs.get('language', 'tr')
                    n_type = gs.get('notification_type', 'text')
                    b_token, c_id = gs.get('telegram_bot_token'), gs.get('telegram_chat_id')

                    for fetih in yeni_fetihler:
                        matched = False
                        fetih["tur"] = "other" # Varsayılan

                        # 1. Full veya Kıta Takibi
                        if full_track or fetih['kita'] in kitalar:
                            matched = True
                            fetih["tur"] = get_conquest_type(fetih, ["gains", "losses", "barbarian", "internal", "selfConquer"])
                        
                        # 2. Oyuncu Takibi
                        if not matched:
                            for p in m_players:
                                if fetih["yeni_sahip"] == p["name"] or fetih["eski_sahip"] == p["name"]:
                                    if check_filters(fetih, p["active_filters"], p_name=p["name"]):
                                        matched = True
                                        fetih["tur"] = get_conquest_type(fetih, p["active_filters"], p_name=p["name"])
                                        break
                        # 3. Klan Takibi
                        if not matched:
                            for t in m_tribes:
                                if fetih["yeni_klan_tag"] == t["tag"] or fetih["eski_klan_tag"] == t["tag"]:
                                    if check_filters(fetih, t["active_filters"], t_tag=t["tag"]):
                                        matched = True
                                        fetih["tur"] = get_conquest_type(fetih, t["active_filters"], t_tag=t["tag"])
                                        break
                        
                        if matched:
                            text_msg = generate_text_report(fetih, lang, world_id)
                            if n_type == "text":
                                async_tasks_queue.append((b_token, c_id, text_msg, None))
                            else:
                                img_buf = generate_grid_table(fetih, lang, world_id)
                                async_tasks_queue.append((b_token, c_id, text_msg if n_type=="both" else None, img_buf))

                check_ref.set({"timestamp": max_ts}, merge=True)

            if async_tasks_queue:
                asyncio.run(dispatch_all_tasks(async_tasks_queue))

        except Exception as e: print(f"❌ Radar Hatası: {e}")
        time.sleep(60)

# ==========================================
# 6. FLASK WEB SUNUCUSU VE ATEŞLEME
# ==========================================
app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return "🚀 TwCu Çift Motorlu Sistem (Arşiv & Radar) Aktif!"

@app.route('/api/<world_id>/<tablo_adi>', methods=['GET'])
def get_world_data(world_id, tablo_adi):
    if tablo_adi not in ["Koyler", "Oyuncular", "Klanlar"]: return jsonify({"hata": "Geçersiz tablo"}), 400
    if db_engine is None: return jsonify({"hata": "DB yok"}), 500
    try:
        with db_engine.connect() as conn:
            sonuclar = conn.execute(text(f"SELECT veri FROM {world_id}_{tablo_adi}")).fetchall()
            return jsonify({"veriler": [json.loads(s[0]) for s in sonuclar]})
    except Exception as e: return jsonify({"hata": str(e)}), 500

print("✅ 1. Motor: Arşivci Başlatılıyor...")
Thread(target=run_schedule, daemon=True).start()

print("✅ 2. Motor: Telegram Radarı Başlatılıyor...")
Thread(target=run_telegram_radar, daemon=True).start()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 10000)), debug=False)