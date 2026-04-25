import os
import requests
import json
import time
import asyncio
import aiohttp
import certifi
import io
from threading import Thread, Lock, Event
from flask import Flask
from datetime import datetime, timedelta
from PIL import Image, ImageDraw, ImageFont

import firebase_admin
from firebase_admin import credentials, firestore
from sqlalchemy import create_engine, text

# ==========================================
# 0. CANLI İSTATİSTİKLER (DASHBOARD İÇİN)
# ==========================================
SCAN_TRIGGER = Event()
STATS_LOCK = Lock()
STATS = {
    "started_at": (datetime.utcnow() + timedelta(hours=3)).isoformat(timespec="seconds"),
    "last_scan_at": None,
    "last_scan_duration_sec": 0.0,
    "scan_count": 0,
    "monitored_worlds": 0,
    "monitored_users": 0,
    "messages_sent_total": 0,
    "messages_failed_total": 0,
    "messages_last_scan": 0,
    "world_list": [],
    "last_error": None,
}

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
    print("✅ TiDB (MySQL) Telegram Radarı İçin Hazır!")
except Exception as e:
    print(f"❌ TiDB bağlantı hatası: {e}")

# ==========================================
# 2. YARDIMCI FONKSİYONLAR (Filtreleme & Format)
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

def get_conquest_type(fetih, active_filters, p_name=None, t_tag=None):
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

def check_filters(fetih, active_filters, p_name=None, t_tag=None):
    tur = get_conquest_type(fetih, active_filters, p_name, t_tag)
    if tur in active_filters: return True
    if "selfConquer" in active_filters and tur == "self": return True
    if "barbarian" in active_filters and tur == "barbarian": return True
    if "internal" in active_filters and tur == "internal": return True
    return False

def generate_text_report(fetih, world_id):
    # Tür belirleme
    tur_metin = "Bilinmeyen"
    tur = fetih.get("tur", "other")
    if tur == "gains": tur_metin = "Fetih"
    elif tur == "losses": tur_metin = "Kayıp"
    elif tur == "barbarian": tur_metin = "Barbar"
    elif tur == "self": tur_metin = "Kendi"
    elif tur == "internal": tur_metin = "Klan İçi"
    else: tur_metin = "Diğer"

    # Puanı noktalı formata çevir (Örn: 7243 -> 7.243)
    try:
        puan_str = f"{int(fetih['puan']):,}".replace(',', '.')
    except:
        puan_str = str(fetih['puan'])

    # Unix timestamp'i HH:MM Türkiye saatine çevir
    ts = int(fetih.get('ts', time.time()))
    saat = (datetime.utcfromtimestamp(ts) + timedelta(hours=3)).strftime('%H:%M')

    # Telegram Metin Şablonu (Gönderdiğin fotoğrafa birebir uyumlu)
    text_msg = f"⚔️ *YENİ FETİH RAPORU [{world_id.upper()}]*\n\n"
    text_msg += f"🕒 {saat}\n"
    text_msg += f"🟢 *Yeni:* {fetih['yeni_sahip']} [{fetih['yeni_klan_tag']}]\n"
    text_msg += f"🔴 *Eski:* {fetih['eski_sahip']} [{fetih['eski_klan_tag']}]\n"
    text_msg += f"📍 *Köy:* {fetih['koordinat']} ({fetih['kita']})\n"
    text_msg += f"⭐ *Puan:* {puan_str}\n"
    text_msg += f"📌 *Tür:* {tur_metin}\n"
    text_msg += f"───────────────"

    return text_msg


def generate_grid_table(fetih, world_id):
    width, height = 760, 270
    img = Image.new('RGB', (width, height), color=(20, 24, 30))
    d = ImageDraw.Draw(img)

    try:
        font_m = ImageFont.truetype("arial.ttf", 15)
        font_b = ImageFont.truetype("arialbd.ttf", 15)
        title_font = ImageFont.truetype("arialbd.ttf", 20)
    except:
        font_m = ImageFont.load_default()
        font_b = ImageFont.load_default()
        title_font = ImageFont.load_default()

    # Zaman hesaplama
    ts = int(fetih.get('ts', time.time()))
    saat = (datetime.utcfromtimestamp(ts) + timedelta(hours=3)).strftime('%H:%M')

    # Tür Renkleri
    colors = {
        "gains": (46, 204, 113),    # Yeşil (Fetih)
        "losses": (231, 76, 60),    # Kırmızı (Kayıp)
        "barbarian": (241, 196, 15),# Sarı (Barbar)
        "self": (149, 165, 166),    # Gri (Kendi)
        "internal": (52, 152, 219)  # Mavi (Klan İçi)
    }
    tur = fetih.get("tur", "other")
    aktif_renk = colors.get(tur, (255, 255, 255))

    # Altıgen (Polygon) çizim fonksiyonu
    def draw_poly(x, y, color):
        size = 8
        pts = [(x, y-size), (x+size, y-size/2), (x+size, y+size/2), 
               (x, y+size), (x-size, y+size/2), (x-size, y-size/2)]
        d.polygon(pts, fill=color)

    # Başlık
    title_text = f"⚔ YENİ FETİH RAPORU [{world_id.upper()}]"
    bbox = d.textbbox((0,0), title_text, font=title_font)
    tw = bbox[2] - bbox[0]
    d.text(((width - tw)/2, 20), title_text, fill=(255, 215, 0), font=title_font)

    # Tablo Çizgileri ve Hücre Koordinatları
    t_y1, t_y2 = 65, 170
    cols = [30, 100, 310, 510, 620, 690, 730]

    # Yatay Çizgiler (Üst, Orta, Alt boşluklar)
    for y in [t_y1, t_y1 + 35, t_y1 + 70, t_y1 + 105]:
        d.line([(cols[0], y), (cols[-1], y)], fill=(42, 51, 73), width=1)

    # Dikey Çizgiler
    for x in cols:
        d.line([(x, t_y1), (x, t_y2)], fill=(42, 51, 73), width=1)

    # Başlıklar
    headers = [("Saat", 45), ("Yeni Sahip", 175), ("Eski Sahip", 380), 
               ("Köy(Kıta)", 530), ("Puan", 630), ("Tür", 695)]
    for h_text, h_x in headers:
        d.text((h_x, t_y1 + 8), h_text, fill=(255, 215, 0), font=font_b)

    # Satır Verileri
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

    # Legend (Alt Kısım İkon Açıklamaları)
    legend_y = 200
    l_items = [
        ("Fetih", colors["gains"]), ("Kayıp", colors["losses"]), 
        ("Barbar", colors["barbarian"]), ("Kendi", colors["self"]), 
        ("Klan İçi", colors["internal"])
    ]

    start_x = 140
    spacing = 100
    for i, (isim, rnk) in enumerate(l_items):
        cx = start_x + (i * spacing)
        draw_poly(cx, legend_y + 8, rnk)
        d.text((cx + 15, legend_y), isim, fill=(180, 180, 180), font=font_b)

    # İmza / Watermark
    watermark = "TwCu | Anto Bvb 66"
    bbox_w = d.textbbox((0,0), watermark, font=font_m)
    ww = bbox_w[2] - bbox_w[0]
    d.text(((width - ww)/2, 240), watermark, fill=(60, 65, 80), font=font_m)

    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

# ==========================================
# 3. TELEGRAM GÖNDERİM MOTORU (ASYNC)
# ==========================================
async def send_async_telegram(session, bot_token, chat_id, text_msg, image_bytes=None):
    url = f"https://api.telegram.org/bot{bot_token}/"
    try:
        # Görsel varsa Form Data ile gönder (sendPhoto)
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
        # Sadece metin ise JSON ile gönder (sendMessage)
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
        results = await asyncio.gather(*tasks, return_exceptions=True)
    return results

# ==========================================
# 4. ANA RADAR DÖNGÜSÜ (Her 3 Dakikada Bir)
# ==========================================
def run_telegram_radar():
    print("🚀 Telegram Radar Motoru Başlatıldı (Her 3 Dakikada Bir Tarayacak)...")
    while True:
        scan_start = time.time()
        try:
            print(f"\n[{(datetime.utcnow() + timedelta(hours=3)).strftime('%H:%M:%S')}] Yeni Tarama Başlıyor...")
            users_docs = list(db.collection('users').stream()) 
            worlds_cache = {}

            for doc_item in users_docs:
                config = doc_item.to_dict()
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
                last_ts = last_ts_doc.to_dict().get('timestamp', 0) if last_ts_doc.exists else now_ts - 120 # Son 3 dk

                try:
                    # Klanlar API'sinden son fetihleri çek
                    r = requests.get(f"{w_data['url']}/interface.php?func=get_conquer&since={last_ts + 1}", timeout=10)
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

                # Kullanıcı filtrelerini kontrol et
                for u_cfg in w_data['users']:
                    kitalar = [k.strip() for k in u_cfg.get("continent_tracking", "").split(",") if k.strip()]
                    full_track = u_cfg.get("full_tracking", False)
                    m_players = u_cfg.get("monitored_players", [])
                    m_tribes = u_cfg.get("monitored_tribes", [])

                    gs = u_cfg.get('global_settings', {})
                    b_token, c_id = gs.get('telegram_bot_token'), gs.get('telegram_chat_id')
                    notif_type = gs.get('notification_type', gs.get('notificationType', 'both')) # Varsayılan 'both'

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
                            # Hem metin hem görsel (veya ayarlara göre) kuyruğa ekle
                            if notif_type == "text":
                                async_tasks_queue.append((b_token, c_id, text_msg, None))
                            else:
                                img_bytes = generate_grid_table(fetih, world_id)
                                caption = text_msg if notif_type == "both" else None
                                async_tasks_queue.append((b_token, c_id, caption, img_bytes))

                # O dünyanın zaman damgasını güncelle
                check_ref.set({"timestamp": max_ts}, merge=True)

            sent_ok = 0
            sent_fail = 0
            if async_tasks_queue:
                print(f"🔥 {len(async_tasks_queue)} mesaj Telegram'a gönderiliyor...")
                results = asyncio.run(dispatch_all_tasks(async_tasks_queue))
                for ok in results:
                    if ok is True:
                        sent_ok += 1
                    else:
                        sent_fail += 1
            else:
                print("Tüm dünyalar tarandı, yeni eşleşen fetih yok.")

            with STATS_LOCK:
                STATS["last_scan_at"] = (datetime.utcnow() + timedelta(hours=3)).isoformat(timespec="seconds")
                STATS["last_scan_duration_sec"] = round(time.time() - scan_start, 2)
                STATS["scan_count"] += 1
                STATS["monitored_worlds"] = len(worlds_cache)
                STATS["monitored_users"] = sum(len(w["users"]) for w in worlds_cache.values())
                STATS["world_list"] = sorted(worlds_cache.keys())
                STATS["messages_sent_total"] += sent_ok
                STATS["messages_failed_total"] += sent_fail
                STATS["messages_last_scan"] = sent_ok + sent_fail
                STATS["last_error"] = None

        except Exception as e: 
            print(f"❌ Radar Hatası: {e}")
            with STATS_LOCK:
                STATS["last_error"] = f"{(datetime.utcnow() + timedelta(hours=3)).isoformat(timespec='seconds')} — {e}"
                STATS["last_scan_at"] = (datetime.utcnow() + timedelta(hours=3)).isoformat(timespec="seconds")
                STATS["last_scan_duration_sec"] = round(time.time() - scan_start, 2)
                STATS["scan_count"] += 1

        # Döngüyü 180 saniye (3 dakika) uyut, manuel tetiklemeyle erken uyanabilir
        triggered = SCAN_TRIGGER.wait(timeout=60)
        if triggered:
            SCAN_TRIGGER.clear()
            print("⚡ Manuel tarama tetiklendi.")

# ==========================================
# 5. REPLIT KEEP-ALIVE SUNUCUSU
# ==========================================
app = Flask(__name__)

DASHBOARD_HTML = """
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>Telegram Radar — Durum Paneli</title>
<meta http-equiv="refresh" content="15">
<style>
  :root {
    --bg: #0b1020;
    --panel: #141a2e;
    --panel-2: #1b2240;
    --border: #2a3358;
    --text: #e7ecff;
    --muted: #8a93b8;
    --accent: #5b8cff;
    --good: #3ddc97;
    --warn: #ffb454;
    --bad: #ff6b6b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px;
    background: radial-gradient(1200px 600px at 20% -10%, #1a2350 0%, transparent 60%), var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    min-height: 100vh;
  }
  .wrap { max-width: 980px; margin: 0 auto; }
  header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 28px;
  }
  h1 { font-size: 22px; margin: 0; letter-spacing: 0.3px; }
  .pill {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px; border-radius: 999px;
    background: rgba(61, 220, 151, 0.12); color: var(--good);
    border: 1px solid rgba(61, 220, 151, 0.25);
    font-size: 13px; font-weight: 600;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--good);
         box-shadow: 0 0 0 4px rgba(61,220,151,0.18); }
  .actions { display: flex; align-items: center; gap: 12px; }
  .btn {
    appearance: none; border: 1px solid rgba(91, 140, 255, 0.4);
    background: linear-gradient(180deg, rgba(91,140,255,0.18), rgba(91,140,255,0.10));
    color: var(--text); font-weight: 600; font-size: 13px;
    padding: 8px 14px; border-radius: 10px; cursor: pointer;
    transition: transform 0.05s ease, background 0.15s ease;
  }
  .btn:hover { background: linear-gradient(180deg, rgba(91,140,255,0.28), rgba(91,140,255,0.16)); }
  .btn:active { transform: translateY(1px); }
  .btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: var(--panel-2); border: 1px solid var(--border);
    color: var(--text); padding: 10px 16px; border-radius: 10px;
    font-size: 13px; opacity: 0; transition: opacity 0.2s ease;
    pointer-events: none;
  }
  .toast.show { opacity: 1; }
  .grid {
    display: grid; gap: 14px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  .card {
    background: linear-gradient(180deg, var(--panel) 0%, var(--panel-2) 100%);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 18px 20px;
  }
  .label { font-size: 12px; color: var(--muted); text-transform: uppercase;
           letter-spacing: 0.8px; margin-bottom: 8px; }
  .value { font-size: 28px; font-weight: 700; }
  .sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .section { margin-top: 28px; }
  .section h2 { font-size: 14px; color: var(--muted); text-transform: uppercase;
                letter-spacing: 1px; margin: 0 0 12px; }
  .worlds { display: flex; flex-wrap: wrap; gap: 8px; }
  .tag {
    background: rgba(91, 140, 255, 0.12); color: var(--accent);
    border: 1px solid rgba(91, 140, 255, 0.3);
    padding: 6px 10px; border-radius: 8px; font-size: 13px; font-weight: 600;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
  }
  .empty { color: var(--muted); font-size: 13px; }
  .error {
    background: rgba(255, 107, 107, 0.10); color: var(--bad);
    border: 1px solid rgba(255, 107, 107, 0.3);
    padding: 12px 16px; border-radius: 10px; font-size: 13px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
  }
  footer { margin-top: 28px; color: var(--muted); font-size: 12px; text-align: center; }
  a { color: var(--accent); text-decoration: none; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Telegram Radar — Durum Paneli</h1>
    <div class="actions">
      <button class="btn" id="scanBtn" onclick="triggerScan()">⚡ Şimdi Tara</button>
      <button class="btn" id="testBtn" onclick="triggerTest()">🧪 Test Mesajı</button>
      <span class="pill"><span class="dot"></span> Çalışıyor</span>
    </div>
  </header>

  <div class="grid">
    <div class="card">
      <div class="label">Son Tarama</div>
      <div class="value">{{ last_scan_at or '—' }}</div>
      <div class="sub">Süre: {{ last_scan_duration }} sn · Tarama #{{ scan_count }}</div>
    </div>
    <div class="card">
      <div class="label">Takip Edilen Dünyalar</div>
      <div class="value">{{ monitored_worlds }}</div>
      <div class="sub">Aktif olarak taranan dünya sayısı</div>
    </div>
    <div class="card">
      <div class="label">Aktif Kullanıcılar</div>
      <div class="value">{{ monitored_users }}</div>
      <div class="sub">Firestore'da konfigüre edilmiş kullanıcı</div>
    </div>
    <div class="card">
      <div class="label">Toplam Mesaj</div>
      <div class="value" style="color: var(--good)">{{ messages_sent_total }}</div>
      <div class="sub">Son taramada: {{ messages_last_scan }} · Hata: {{ messages_failed_total }}</div>
    </div>
  </div>

  <div class="section">
    <h2>İzlenen Dünyalar</h2>
    {% if world_list %}
      <div class="worlds">
        {% for w in world_list %}<span class="tag">{{ w }}</span>{% endfor %}
      </div>
    {% else %}
      <div class="empty">Henüz aktif dünya yok — ilk tarama tamamlanınca burada görünecek.</div>
    {% endif %}
  </div>

  {% if last_error %}
  <div class="section">
    <h2>Son Hata</h2>
    <div class="error">{{ last_error }}</div>
  </div>
  {% endif %}

  <footer>
    Bot başlangıcı: {{ started_at }} · Otomatik yenileme: 15 sn ·
    <a href="/stats.json">JSON</a>
  </footer>
</div>
<div class="toast" id="toast"></div>
<script>
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2400);
  }
  async function triggerScan() {
    const btn = document.getElementById('scanBtn');
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Tetiklendi…';
    try {
      const r = await fetch('/scan', { method: 'POST' });
      const data = await r.json();
      showToast(data.queued ? '⚡ Tarama kuyruğa alındı — birkaç saniye içinde başlar' : 'Zaten kuyrukta bir tarama var');
      setTimeout(() => location.reload(), 4000);
    } catch (e) {
      showToast('Tarama tetiklenemedi: ' + e);
      btn.disabled = false;
      btn.textContent = orig;
    }
  }
  async function triggerTest() {
    const btn = document.getElementById('testBtn');
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = 'Gönderiliyor…';
    try {
      const r = await fetch('/test', { method: 'POST' });
      const data = await r.json();
      if (data.error) {
        showToast('Hata: ' + data.error);
      } else if (data.targets === 0 || data.targets === undefined) {
        showToast(data.message || 'Hiç hedef yok');
      } else {
        showToast(`🧪 ${data.sent}/${data.targets} test mesajı gönderildi` + (data.failed ? ` (${data.failed} hata)` : ''));
      }
      setTimeout(() => location.reload(), 2500);
    } catch (e) {
      showToast('Test gönderilemedi: ' + e);
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }
</script>
</body>
</html>
"""

@app.route('/')
def home():
    from flask import render_template_string
    with STATS_LOCK:
        snap = dict(STATS)
    return render_template_string(
        DASHBOARD_HTML,
        last_scan_at=snap["last_scan_at"],
        last_scan_duration=snap["last_scan_duration_sec"],
        scan_count=snap["scan_count"],
        monitored_worlds=snap["monitored_worlds"],
        monitored_users=snap["monitored_users"],
        messages_sent_total=snap["messages_sent_total"],
        messages_failed_total=snap["messages_failed_total"],
        messages_last_scan=snap["messages_last_scan"],
        world_list=snap["world_list"],
        last_error=snap["last_error"],
        started_at=snap["started_at"],
    )

@app.route('/stats.json')
def stats_json():
    from flask import jsonify
    with STATS_LOCK:
        return jsonify(dict(STATS))

@app.route('/scan', methods=['POST'])
def trigger_scan():
    from flask import jsonify
    already = SCAN_TRIGGER.is_set()
    SCAN_TRIGGER.set()
    return jsonify({"queued": not already})

@app.route('/test', methods=['POST'])
def trigger_test_message():
    from flask import jsonify
    try:
        users_docs = list(db.collection('users').stream())
        targets = []
        seen = set()
        for doc_item in users_docs:
            gs = (doc_item.to_dict() or {}).get('global_settings', {})
            b_token = gs.get('telegram_bot_token', '')
            c_id = gs.get('telegram_chat_id', '')
            if not b_token or not c_id or b_token == "[EMPTY]":
                continue
            key = (b_token, c_id)
            if key in seen:
                continue
            seen.add(key)
            targets.append(key)

        if not targets:
            return jsonify({"sent": 0, "failed": 0, "message": "Hiç konfigüre edilmiş kullanıcı bulunamadı."})

        ts = (datetime.utcnow() + timedelta(hours=3)).strftime('%H:%M:%S')
        msg = (
            f"*🧪 TEST MESAJI*\n"
            f"Telegram Radar botunuz çalışıyor.\n"
            f"Zaman: {ts}\n"
            f"Bu, dashboard üzerinden gönderilen bir test bildirimidir."
        )
        queue = [(bt, cid, msg, None) for (bt, cid) in targets]
        results = asyncio.run(dispatch_all_tasks(queue))
        ok = sum(1 for r in results if r is True)
        fail = len(results) - ok
        with STATS_LOCK:
            STATS["messages_sent_total"] += ok
            STATS["messages_failed_total"] += fail
        return jsonify({"sent": ok, "failed": fail, "targets": len(targets)})
    except Exception as e:
        return jsonify({"sent": 0, "failed": 0, "error": str(e)}), 500

def run_server():
    # Replit keep-alive sunucusu için port 5000
    app.run(host='0.0.0.0', port=5000)

if __name__ == "__main__":
    # Web sunucusunu arka planda başlat
    server_thread = Thread(target=run_server, daemon=True)
    server_thread.start()

    # Radar motorunu ana iplikte başlat
    run_telegram_radar()