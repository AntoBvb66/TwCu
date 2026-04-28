"""
Render için birleşik bot:
- Saatlik veri arşivleme (köy/oyuncu/klan -> TiDB)
- Her 1 dakikada fetih taraması + Telegram bildirimi
- Flask: ana sayfa + /api/<world>/<table> verisi
"""
import os
import io
import gc
import json
import time
import gzip
import urllib.parse
import asyncio
import threading

import requests
import schedule
import aiohttp
from datetime import datetime, timedelta

import firebase_admin
from firebase_admin import credentials, firestore
import libsql_client
from libsql_client import Statement

from flask import Flask, jsonify
from flask_cors import CORS
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

turso_client = None
try:
    TURSO_URL = os.environ.get("TURSO_DATABASE_URL")
    TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")
    if not TURSO_URL or not TURSO_TOKEN:
        print("❌ HATA: TURSO_DATABASE_URL veya TURSO_AUTH_TOKEN tanımlanmamış!")
    else:
        # Render'daki asenkron olmayan Flask/Zamanlayıcı yapımız için sync client kullanıyoruz
        turso_client = libsql_client.create_client_sync(url=TURSO_URL, auth_token=TURSO_TOKEN)
        print("✅ Turso bağlantısı başarılı!")
except Exception as e:
    print(f"❌ Turso bağlantı hatası: {e}")


# ==========================================
# 2. AYARLAR
# ==========================================
DOSYALAR = {
    "/map/village.txt.gz": "Koyler",
    "/map/player.txt.gz": "Oyuncular",
    "/map/ally.txt.gz": "Klanlar"
}

MAX_LOOKBACK_SEC = 300
SCAN_INTERVAL_SEC = 60
SCAN_LOCK = threading.Lock()


def get_active_worlds():
    try:
        doc_ref = db.collection('system_data').document('active_worlds')
        doc = doc_ref.get()
        all_worlds = []
        if doc.exists:
            data = doc.to_dict()
            for dunya_listesi in data.values():
                if isinstance(dunya_listesi, list):
                    all_worlds.extend(dunya_listesi)
            return all_worlds
        return []
    except Exception as e:
        print(f"Firebase'den dünya listesi çekilemedi: {e}")
        return []


# ==========================================
# 3. SAATLİK ARŞİVLEME GÖREVİ
# ==========================================
def ana_arsiv_gorevi():
    if turso_client is None:
        print("⚠ Turso bağlantısı yok, arşivleme yapılamaz!")
        return

    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] SAATLİK ARŞİVLEME BAŞLADI...")
    dunyalar = get_active_worlds()

    for d in dunyalar:
        d_id = d.get('id')
        d_url = d.get('url')
        if not d_id or not d_url:
            continue

        print(f"[{datetime.now().strftime('%H:%M:%S')}] {d_id} verisi çekiliyor...")
        try:
            for endpoint, tablo_adi in DOSYALAR.items():
                gercek_tablo = f"{d_id}_{tablo_adi}"
                golge_tablo = f"{gercek_tablo}_temp"
                tam_url = f"{d_url.rstrip('/')}{endpoint}"
                
                try:
                    r = requests.get(tam_url, stream=True, timeout=20)
                    if r.status_code == 200:
                        turso_client.execute(f"DROP TABLE IF EXISTS {golge_tablo}")
                        # SQLite'ta JSON yerine TEXT kullanıyoruz
                        turso_client.execute(f"CREATE TABLE {golge_tablo} (id TEXT PRIMARY KEY, veri TEXT)")

                        toplu_veri = []
                        CHUNK_SIZE = 1000 # HTTP üzerinden gideceği için limiti makul tutuyoruz
                        kaydedilen_toplam = 0

                        with gzip.open(io.BytesIO(r.content), 'rt', encoding='utf-8') as f:
                            for satir in f:
                                if satir.strip():
                                    parcalar = satir.strip().split(',')
                                    temiz_parcalar = [urllib.parse.unquote_plus(p) for p in parcalar]
                                    toplu_veri.append({
                                        "id": str(temiz_parcalar[0]),
                                        "veri": json.dumps(temiz_parcalar)
                                    })
                                    
                                    if len(toplu_veri) >= CHUNK_SIZE:
                                        # Turso Batch Insert işlemi
                                        stmts = [Statement(f"INSERT INTO {golge_tablo} (id, veri) VALUES (?, ?)", [item["id"], item["veri"]]) for item in toplu_veri]
                                        turso_client.batch(stmts)
                                        kaydedilen_toplam += len(toplu_veri)
                                        toplu_veri.clear()

                        if toplu_veri:
                            stmts = [Statement(f"INSERT INTO {golge_tablo} (id, veri) VALUES (?, ?)", [item["id"], item["veri"]]) for item in toplu_veri]
                            turso_client.batch(stmts)
                            kaydedilen_toplam += len(toplu_veri)

                        if kaydedilen_toplam > 0:
                            turso_client.execute(f"DROP TABLE IF EXISTS {gercek_tablo}")
                            # MySQL RENAME sözdizimi yerine SQLite ALTER TABLE sözdizimi
                            turso_client.execute(f"ALTER TABLE {golge_tablo} RENAME TO {gercek_tablo}")
                            print(f"    {tablo_adi} Turso'ya kaydedildi: {kaydedilen_toplam} kayıt.")
                except Exception as e:
                    print(f"    HATA ({tablo_adi}): {e}")
        except Exception as genel_hata:
            print(f"    {d_id} genel işleme hatası: {genel_hata}")
        time.sleep(1)
        gc.collect()
    print(f"[{datetime.now().strftime('%H:%M:%S')}] SAATLİK GÜNCELLEME TAMAMLANDI.")

# ==========================================
# 4. FETİH TARAMA — YARDIMCI FONKSİYONLAR
# ==========================================
def get_info_from_db(world_id, tablo_adi, doc_id):
    if not turso_client or str(doc_id) == "0":
        return None
    try:
        # SQLite sorgusunda parametreler ? ile belirtilir
        rs = turso_client.execute(f"SELECT veri FROM {world_id}_{tablo_adi} WHERE id = ?", [str(doc_id)])
        if len(rs.rows) > 0:
            return json.loads(rs.rows[0][0])
    except Exception:
        pass
    return None

def get_conquest_type(fetih, active_filters, p_name=None, t_tag=None):
    if fetih["eski_sahip"] == fetih["yeni_sahip"]:
        return "self"
    if fetih["eski_sahip"] == "Barbar":
        return "barbarian"
    if fetih["eski_klan_tag"] == fetih["yeni_klan_tag"] and fetih["eski_klan_tag"] != "---":
        return "internal"
    if p_name:
        if fetih["yeni_sahip"] == p_name and "gains" in active_filters:
            return "gains"
        if fetih["eski_sahip"] == p_name and "losses" in active_filters:
            return "losses"
    if t_tag:
        if fetih["yeni_klan_tag"] == t_tag and "gains" in active_filters:
            return "gains"
        if fetih["eski_klan_tag"] == t_tag and "losses" in active_filters:
            return "losses"
    return "other"


def check_filters(fetih, active_filters, p_name=None, t_tag=None):
    tur = get_conquest_type(fetih, active_filters, p_name, t_tag)
    if tur in active_filters:
        return True
    if "selfConquer" in active_filters and tur == "self":
        return True
    if "barbarian" in active_filters and tur == "barbarian":
        return True
    if "internal" in active_filters and tur == "internal":
        return True
    return False


def generate_text_report(fetih, world_id):
    tur = fetih.get("tur", "other")
    tur_metin = {"gains": "Fetih", "losses": "Kayıp", "barbarian": "Barbar",
                 "self": "Kendi", "internal": "Klan İçi"}.get(tur, "Diğer")
    try:
        puan_str = f"{int(fetih['puan']):,}".replace(',', '.')
    except Exception:
        puan_str = str(fetih['puan'])
    ts = int(fetih.get('ts', time.time()))
    saat = (datetime.utcfromtimestamp(ts) + timedelta(hours=3)).strftime('%H:%M')

    text_msg = f"⚔️ *YENİ FETİH RAPORU [{world_id.upper()}]*\n\n"
    text_msg += f"🕒 {saat}\n"
    text_msg += f"🟢 *Yeni:* {fetih['yeni_sahip']} [{fetih['yeni_klan_tag']}]\n"
    text_msg += f"🔴 *Eski:* {fetih['eski_sahip']} [{fetih['eski_klan_tag']}]\n"
    text_msg += f"📍 *Köy:* {fetih['koordinat']} ({fetih['kita']})\n"
    text_msg += f"⭐ *Puan:* {puan_str}\n"
    text_msg += f"📌 *Tür:* {tur_metin}\n"
    text_msg += "───────────────"
    return text_msg


def generate_grid_table(fetih, world_id):
    width, height = 760, 270
    img = Image.new('RGB', (width, height), color=(20, 24, 30))
    d = ImageDraw.Draw(img)

    try:
        font_m = ImageFont.truetype("arial.ttf", 15)
        font_b = ImageFont.truetype("arialbd.ttf", 15)
        title_font = ImageFont.truetype("arialbd.ttf", 20)
    except Exception:
        font_m = ImageFont.load_default()
        font_b = ImageFont.load_default()
        title_font = ImageFont.load_default()

    ts = int(fetih.get('ts', time.time()))
    saat = (datetime.utcfromtimestamp(ts) + timedelta(hours=3)).strftime('%H:%M')

    colors = {
        "gains": (46, 204, 113),
        "losses": (231, 76, 60),
        "barbarian": (241, 196, 15),
        "self": (149, 165, 166),
        "internal": (52, 152, 219)
    }
    aktif_renk = colors.get(fetih.get("tur", "other"), (255, 255, 255))

    def draw_poly(x, y, color):
        size = 8
        pts = [(x, y - size), (x + size, y - size / 2), (x + size, y + size / 2),
               (x, y + size), (x - size, y + size / 2), (x - size, y - size / 2)]
        d.polygon(pts, fill=color)

    title_text = f"⚔ YENİ FETİH RAPORU [{world_id.upper()}]"
    bbox = d.textbbox((0, 0), title_text, font=title_font)
    tw = bbox[2] - bbox[0]
    d.text(((width - tw) / 2, 20), title_text, fill=(255, 215, 0), font=title_font)

    t_y1, t_y2 = 65, 170
    cols = [30, 100, 310, 510, 620, 690, 730]
    for y in [t_y1, t_y1 + 35, t_y1 + 70, t_y1 + 105]:
        d.line([(cols[0], y), (cols[-1], y)], fill=(42, 51, 73), width=1)
    for x in cols:
        d.line([(x, t_y1), (x, t_y2)], fill=(42, 51, 73), width=1)

    headers = [("Saat", 45), ("Yeni Sahip", 175), ("Eski Sahip", 380),
               ("Köy(Kıta)", 530), ("Puan", 630), ("Tür", 695)]
    for h_text, h_x in headers:
        d.text((h_x, t_y1 + 8), h_text, fill=(255, 215, 0), font=font_b)

    y_klan = f" [{fetih['yeni_klan_tag']}]" if fetih['yeni_klan_tag'] != "---" else ""
    e_klan = f" [{fetih['eski_klan_tag']}]" if fetih['eski_klan_tag'] != "---" else ""
    yeni_sahip_str = f"{fetih['yeni_sahip']}{y_klan}"
    eski_sahip_str = f"{fetih['eski_sahip']}{e_klan}"
    koy_str = f"{fetih['koordinat']} ({fetih['kita']})"

    d.text((45, t_y1 + 44), saat, fill=(180, 180, 180), font=font_m)
    d.text((110, t_y1 + 44), yeni_sahip_str, fill=(255, 255, 255), font=font_b)
    d.text((320, t_y1 + 44), eski_sahip_str, fill=(180, 180, 180), font=font_m)
    d.text((520, t_y1 + 44), koy_str, fill=(180, 180, 180), font=font_m)
    d.text((630, t_y1 + 44), str(fetih['puan']), fill=(241, 196, 15), font=font_m)
    draw_poly(710, t_y1 + 52, aktif_renk)

    legend_y = 200
    l_items = [("Fetih", colors["gains"]), ("Kayıp", colors["losses"]),
               ("Barbar", colors["barbarian"]), ("Kendi", colors["self"]),
               ("Klan İçi", colors["internal"])]
    start_x = 140
    spacing = 100
    for i, (isim, rnk) in enumerate(l_items):
        cx = start_x + (i * spacing)
        draw_poly(cx, legend_y + 8, rnk)
        d.text((cx + 15, legend_y), isim, fill=(180, 180, 180), font=font_b)

    watermark = "TwCu | Anto Bvb 66"
    bbox_w = d.textbbox((0, 0), watermark, font=font_m)
    ww = bbox_w[2] - bbox_w[0]
    d.text(((width - ww) / 2, 240), watermark, fill=(60, 65, 80), font=font_m)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


# ==========================================
# 5. TELEGRAM GÖNDERİM (ASYNC)
# ==========================================
async def send_async_telegram(session, bot_token, chat_id, text_msg, image_bytes=None):
    url = f"https://api.telegram.org/bot{bot_token}/"
    try:
        if image_bytes:
            req_url = url + "sendPhoto"
            data = aiohttp.FormData()
            data.add_field('chat_id', chat_id)
            data.add_field('photo', image_bytes, filename='rapor.png', content_type='image/png')
            if text_msg:
                data.add_field('caption', text_msg)
                data.add_field('parse_mode', 'Markdown')
            async with session.post(req_url, data=data) as response:
                await response.read()
                return response.status == 200
        else:
            req_url = url + "sendMessage"
            payload = {'chat_id': chat_id, 'text': text_msg, 'parse_mode': 'Markdown'}
            async with session.post(req_url, json=payload) as response:
                await response.read()
                return response.status == 200
    except Exception as e:
        print(f"Telegram gönderim hatası: {e}")
        return False


async def dispatch_all_tasks(tasks_queue):
    async with aiohttp.ClientSession() as session:
        tasks = [send_async_telegram(session, b_t, c_id, msg, img) for (b_t, c_id, msg, img) in tasks_queue]
        return await asyncio.gather(*tasks, return_exceptions=True)


# ==========================================
# 6. FETİH TARAMA (1 DAKİKADA BİR)
# ==========================================
def fetih_tarama_gorevi():
    if not SCAN_LOCK.acquire(blocking=False):
        return
    try:
        scan_start = time.time()
        print(f"\n[{(datetime.utcnow() + timedelta(hours=3)).strftime('%H:%M:%S')}] 🔍 Fetih taraması başlıyor...")
        users_docs = list(db.collection('users').stream())
        worlds_cache = {}

        for doc_item in users_docs:
            config = doc_item.to_dict() or {}
            gs = config.get('global_settings', {})
            w_link = gs.get('world_link', '').strip().rstrip('/')
            b_token = gs.get('telegram_bot_token', '')
            c_id = gs.get('telegram_chat_id', '')
            if not w_link or not b_token or not c_id or b_token == "[EMPTY]":
                continue
            w_id = w_link.split('//')[-1].split('.')[0]
            if w_id not in worlds_cache:
                worlds_cache[w_id] = {'users': [], 'url': w_link}
            worlds_cache[w_id]['users'].append(config)

        if not worlds_cache:
            print("   └ ⚠ Takip edilecek geçerli dünya/kullanıcı yok.")
            return

        async_tasks_queue = []
        now_ts = int(time.time())

        for world_id, w_data in worlds_cache.items():
            check_ref = db.collection('system_data').document('last_conquests').collection(world_id).document('ts')
            last_ts_doc = check_ref.get()
            stored_ts = last_ts_doc.to_dict().get('timestamp', 0) if last_ts_doc.exists else 0
            last_ts = max(stored_ts, now_ts - MAX_LOOKBACK_SEC)
            age_min = round((now_ts - last_ts) / 60, 1)
            print(f"🌍 [{world_id.upper()}] Taranıyor... (Son {age_min} dk | TS: {last_ts})")

            try:
                r = requests.get(f"{w_data['url']}/interface.php?func=get_conquer&since={last_ts + 1}", timeout=10)
                if r.status_code != 200 or not r.text.strip():
                    print("   └ ⚪ Yeni fetih yok.")
                    continue
            except Exception as e:
                print(f"   └ ❌ Sunucuya ulaşılamadı: {e}")
                continue

            yeni_fetihler = []
            max_ts = last_ts
            for satir in r.text.strip().split('\n'):
                if not satir:
                    continue
                v_id, ts, new_o, old_o = satir.split(',')
                ts = int(ts)
                if ts > max_ts:
                    max_ts = ts

                koy = get_info_from_db(world_id, "Koyler", v_id)
                yeni_oy = get_info_from_db(world_id, "Oyuncular", new_o)
                eski_oy = get_info_from_db(world_id, "Oyuncular", old_o)
                y_klan = get_info_from_db(world_id, "Klanlar", yeni_oy[2]) if yeni_oy and yeni_oy[2] != "0" else None
                e_klan = get_info_from_db(world_id, "Klanlar", eski_oy[2]) if eski_oy and eski_oy[2] != "0" else None

                koordinat, kita, puan, koy_adi = "000|000", "K00", "0", "Bilinmeyen"
                if koy:
                    x, y = str(koy[2]).zfill(3), str(koy[3]).zfill(3)
                    koordinat, kita, puan, koy_adi = f"{x}|{y}", f"{y[0]}{x[0]}", str(koy[5]), str(koy[1])

                yeni_fetihler.append({
                    "koy_adi": koy_adi, "koordinat": koordinat, "kita": kita, "puan": puan,
                    "yeni_sahip": str(yeni_oy[1]) if yeni_oy else "Barbar",
                    "yeni_klan_tag": str(y_klan[2]) if y_klan else "---",
                    "eski_sahip": str(eski_oy[1]) if eski_oy else "Barbar",
                    "eski_klan_tag": str(e_klan[2]) if e_klan else "---",
                    "ts": ts
                })

            if not yeni_fetihler:
                print("   └ ⚪ Yeni fetih yok.")
                continue

            print(f"   └ 🔴 {len(yeni_fetihler)} yeni fetih bulundu, filtreler kontrol ediliyor...")

            for u_cfg in w_data['users']:
                kitalar = [k.strip() for k in u_cfg.get("continent_tracking", "").split(",") if k.strip()]
                full_track = u_cfg.get("full_tracking", False)
                m_players = u_cfg.get("monitored_players", [])
                m_tribes = u_cfg.get("monitored_tribes", [])
                gs = u_cfg.get('global_settings', {})
                b_token, c_id = gs.get('telegram_bot_token'), gs.get('telegram_chat_id')
                notif_type = gs.get('notification_type', gs.get('notificationType', 'both'))

                for fetih in yeni_fetihler:
                    matched = False
                    fetih["tur"] = "other"

                    if full_track or fetih['kita'] in kitalar:
                        matched = True
                        fetih["tur"] = get_conquest_type(fetih, ["gains", "losses", "barbarian", "internal", "selfConquer"])

                    if not matched:
                        for p in m_players:
                            if fetih["yeni_sahip"] == p["name"] or fetih["eski_sahip"] == p["name"]:
                                if check_filters(fetih, p["active_filters"], p_name=p["name"]):
                                    matched = True
                                    fetih["tur"] = get_conquest_type(fetih, p["active_filters"], p_name=p["name"])
                                    break
                    if not matched:
                        for t in m_tribes:
                            if fetih["yeni_klan_tag"] == t["tag"] or fetih["eski_klan_tag"] == t["tag"]:
                                if check_filters(fetih, t["active_filters"], t_tag=t["tag"]):
                                    matched = True
                                    fetih["tur"] = get_conquest_type(fetih, t["active_filters"], t_tag=t["tag"])
                                    break

                    if matched:
                        text_msg = generate_text_report(fetih, world_id)
                        if notif_type == "text":
                            async_tasks_queue.append((b_token, c_id, text_msg, None))
                        else:
                            img_bytes = generate_grid_table(fetih, world_id)
                            caption = text_msg if notif_type == "both" else None
                            async_tasks_queue.append((b_token, c_id, caption, img_bytes))

            check_ref.set({"timestamp": max_ts}, merge=True)

        if async_tasks_queue:
            print(f"🔥 {len(async_tasks_queue)} mesaj Telegram'a gönderiliyor...")
            results = asyncio.run(dispatch_all_tasks(async_tasks_queue))
            ok = sum(1 for r in results if r is True)
            fail = len(results) - ok
            print(f"✅ Gönderildi: {ok} | ❌ Başarısız: {fail}")
        else:
            print("✅ Tarama bitti, eşleşen fetih yok.")

        print(f"⏱ Tarama süresi: {round(time.time() - scan_start, 2)}s")
    except Exception as e:
        print(f"❌ Tarama hatası: {e}")
    finally:
        SCAN_LOCK.release()


# ==========================================
# 7. ZAMANLAYICI DÖNGÜ (Arka plan)
# ==========================================
def run_schedule():
    print("🔄 Arka plan zamanlayıcısı başlatıldı.")
    ana_arsiv_gorevi()
    fetih_tarama_gorevi()

    schedule.every().hour.at(":00").do(ana_arsiv_gorevi)
    schedule.every(SCAN_INTERVAL_SEC).seconds.do(fetih_tarama_gorevi)

    while True:
        schedule.run_pending()
        time.sleep(1)


# ==========================================
# 8. FLASK WEB SUNUCUSU
# ==========================================
app = Flask(__name__)
CORS(app)


@app.route('/')
def home():
    return "🚀 TwCu Engine (TiDB + Telegram Radar) is Running!"


@app.route('/api/<world_id>/<tablo_adi>', methods=['GET'])
def get_world_data(world_id, tablo_adi):
    izin_verilenler = ["Koyler", "Oyuncular", "Klanlar"]
    if tablo_adi not in izin_verilenler:
        return jsonify({"hata": "Geçersiz tablo adı"}), 400

    gercek_tablo = f"{world_id}_{tablo_adi}"
    veriler = []

    if turso_client is None:
        return jsonify({"hata": "Veritabanı bağlantısı yok"}), 500

    try:
        rs = turso_client.execute(f"SELECT veri FROM {gercek_tablo}")
        for satir in rs.rows:
            veriler.append(json.loads(satir[0]))
        return jsonify({"veriler": veriler})
    except Exception as e:
        # Tablo henüz oluşturulmamışsa (ilk kurulumda) hata vermesin boş dönsün
        if "no such table" in str(e).lower():
            return jsonify({"veriler": []})
        return jsonify({"hata": str(e)}), 500

# Botu arka planda başlat
print("✅ Arka plan botu tetikleniyor...")
bot_thread = threading.Thread(target=run_schedule, daemon=True)
bot_thread.start()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
