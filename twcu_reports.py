import os
import json
import requests
import re
import urllib.parse
import time
import io
import asyncio
import aiohttp
import math
from flask import Flask
from threading import Thread
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw, ImageFont

# ====================== BAŞLATMA ======================
FIREBASE_KEY_JSON = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')

if not firebase_admin._apps:
    cred = credentials.Certificate(json.loads(FIREBASE_KEY_JSON))
    firebase_admin.initialize_app(cred)
db = firestore.client()

ORACLE_API_URL = "http://152.70.16.201:8000/api"

app = Flask(__name__)
@app.route('/')
def home():
    return "🚀 TW Oracle-Linked Engine is Alive!"

# ====================== 1. GÜNLÜK DÜNYA GÜNCELLEMESİ ======================
def update_global_worlds():
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
    print("\n🌍 GÜNLÜK SENKRONİZASYON: Aktif dünyalar taranıyor...")
    worlds_ref = db.collection('system_data').document('active_worlds')
    all_worlds_data = {}
    total = 0
    
    for lang, base_url in server_roots.items():
        try:
            res = requests.get(f"{base_url}/backend/get_servers.php", timeout=10)
            if res.status_code != 200: continue
            matches = re.findall(r's:\d+:"([^"]+)";s:\d+:"([^"]+)"', res.text)
            
            standard_worlds = []
            for w_id, w_url in matches:
                if ("s1." in w_url or "s2." in w_url) and not ("us1." in w_url): continue
                standard_worlds.append({"id": w_id, "url": w_url})
            
            if standard_worlds:
                all_worlds_data[lang] = standard_worlds
                total += len(standard_worlds)
        except: pass

    if all_worlds_data:
        worlds_ref.set(all_worlds_data)
        print(f"💾 {total} aktif dünya Firebase'e kaydedildi!\n")

def generate_vertical_image(fetihler, baslik):
    """Modern, şık ve fetih türü gösteren görüntü oluşturur"""
    toplam_fetih = len(fetihler)
    gosterilecek_sayi = min(toplam_fetih, 25)

    # Sütun mantığı
    if gosterilecek_sayi <= 6:
        sutun_sayisi = 1
    elif gosterilecek_sayi <= 12:
        sutun_sayisi = 2
    else:
        sutun_sayisi = 3

    satir_sayisi = math.ceil(gosterilecek_sayi / sutun_sayisi)

    card_w, card_h = 480, 155
    margin, padding = 26, 22
    header_h = 95

    img_w = margin + (sutun_sayisi * (card_w + margin))
    img_h = header_h + (satir_sayisi * (card_h + margin)) + 40

    img = Image.new("RGB", (img_w, img_h), (15, 18, 26))
    draw = ImageDraw.Draw(img)

    # Fontlar
    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
        font_bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
        font_regular = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    except:
        font_title = font_bold = font_regular = font_small = ImageFont.load_default()

    # ====================== BAŞLIK ======================
    baslik_metni = f"⚔️ {baslik} ({toplam_fetih} İşlem)"
    draw.rectangle([0, 0, img_w, header_h], fill=(22, 27, 42))
    draw.text((margin, 24), baslik_metni, font=font_title, fill=(255, 215, 0))

    draw.line((margin, header_h - 10, img_w - margin, header_h - 10), fill=(70, 90, 130), width=4)

    # ====================== KARTLAR ======================
    for idx in range(gosterilecek_sayi):
        f = fetihler[idx]

        sutun = idx // satir_sayisi
        satir = idx % satir_sayisi

        x = margin + (sutun * (card_w + margin))
        y = header_h + (satir * (card_h + margin))

        # Kart arka planı
        draw.rounded_rectangle([x + 4, y + 4, x + card_w + 4, y + card_h + 4], radius=14, fill=(0, 0, 0, 90))
        draw.rounded_rectangle([x, y, x + card_w, y + card_h], radius=14, fill=(28, 34, 48))

        # Saat
        saat_txt = datetime.fromtimestamp(f['ts'], tz=timezone.utc) + timedelta(hours=3)
        saat_str = saat_txt.strftime('%H:%M')
        draw.text((x + padding, y + 14), f"🕒 {saat_str}", font=font_small, fill=(160, 180, 210))

        # Köy Bilgisi
        koy_str = f"{f.get('koy_adi', 'Bilinmeyen')} ({f.get('koordinat', '??|??')})"
        draw.text((x + padding, y + 38), "🏰 " + koy_str, font=font_bold, fill=(235, 235, 245))

        # ====================== FETİH TÜRÜ BELİRLEME ======================
        yeni_sahip = f.get('yeni_sahip', '').lower()
        eski_sahip = f.get('eski_sahip', '').lower()
        yeni_klan = f.get('yeni_klan_tag', '')
        eski_klan = f.get('eski_klan_tag', '')

        is_gain = yeni_sahip and yeni_sahip != eski_sahip
        is_loss = eski_sahip and eski_sahip != yeni_sahip
        is_barb = eski_sahip == "barbar" or f.get('eski_sahip_id') == "0"
        is_self = yeni_sahip == eski_sahip and yeni_sahip != ""
        is_internal = yeni_klan == eski_klan and yeni_klan not in ["", "---", None]

        # Tür ve Renk Belirleme
        if is_barb and is_gain:
            tur_adi = "BARBAR KÖYÜ FETİHİ"
            tur_emoji = "🏹"
            tur_renk = (255, 180, 60)      # Turuncu
        elif is_self:
            tur_adi = "KENDİ KÖYÜNÜ FETİH"
            tur_emoji = "🔄"
            tur_renk = (100, 200, 255)     # Mavi
        elif is_internal:
            tur_adi = "KLAN İÇİ FETİH"
            tur_emoji = "🔄"
            tur_renk = (180, 100, 255)     # Mor
        elif is_gain:
            tur_adi = "KÖY FETHİ (GAINS)"
            tur_emoji = "✅"
            tur_renk = (80, 255, 140)      # Yeşil
        elif is_loss:
            tur_adi = "KÖY KAYBI (LOSSES)"
            tur_emoji = "❌"
            tur_renk = (255, 90, 100)      # Kırmızı
        else:
            tur_adi = "FETİH"
            tur_emoji = "⚔️"
            tur_renk = (200, 200, 200)

        # Türü göster
        draw.text((x + padding, y + 68), f"{tur_emoji} {tur_adi}", font=font_bold, fill=tur_renk)

        # Alan (Yeni Sahip)
        alan_txt = f"Alan: {f['yeni_sahip']}"
        if yeni_klan and yeni_klan != "---":
            alan_txt += f" [{yeni_klan}]"
        draw.text((x + padding, y + 98), alan_txt, font=font_regular, fill=(100, 255, 160))

        # Veren (Eski Sahip)
        veren_txt = f"Veren: {f['eski_sahip']}"
        if eski_klan and eski_klan != "---":
            veren_txt += f" [{eski_klan}]"
        draw.text((x + padding, y + 122), veren_txt, font=font_regular, fill=(255, 130, 130))

    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True, quality=95)
    return buf.getvalue()

# ====================== 3. ASENKRON TELEGRAM ======================
async def send_async_telegram(session, task):
    try:
        url = f"https://api.telegram.org/bot{task['token']}/sendPhoto"
        data = aiohttp.FormData()
        data.add_field('chat_id', str(task['chat_id']))
        data.add_field('caption', task["caption"])
        data.add_field('parse_mode', 'Markdown')
        data.add_field('photo', task["bytes"], filename='report.png', content_type='image/png')
        await session.post(url, data=data, timeout=10)
    except: pass

async def dispatch_all_tasks(tasks):
    if not tasks: return
    async with aiohttp.ClientSession() as session:
        await asyncio.gather(*[send_async_telegram(session, t) for t in tasks])

# ====================== 4. FİLTRELEME MOTORU ======================
def get_continent(coord_str):
    try:
        x, y = coord_str.split("|")
        return str(int(y) // 100) + str(int(x) // 100)
    except: return "00"

def is_conquest_matching(fetih, config):
    if config.get("full_tracking", False): return True
    
    koy_kita = get_continent(fetih['koordinat'])
    if config.get("continent_tracking", ""):
        hedef_kitalar = [k.strip() for k in config.get("continent_tracking").split(",")]
        if koy_kita in hedef_kitalar: return True

    oyuncular = config.get("monitored_players", [])
    klanlar = config.get("monitored_tribes", [])
    
    yeni_o = urllib.parse.unquote_plus(fetih.get('yeni_sahip', '')).lower()
    yeni_k = urllib.parse.unquote_plus(fetih.get('yeni_klan_tag', '')).lower()
    eski_o = urllib.parse.unquote_plus(fetih.get('eski_sahip', '')).lower()
    eski_k = urllib.parse.unquote_plus(fetih.get('eski_klan_tag', '')).lower()

    if eski_o == "barbar" or fetih.get('eski_sahip_id') == "0":
        eski_o = "barbar"

    for hedef in oyuncular + klanlar:
        h_adi = (hedef.get("name") or hedef.get("tag", "")).lower()
        aktif = hedef.get("active_filters", [])
        if not h_adi or not aktif: continue

        is_gain = (h_adi == yeni_o) or (h_adi == yeni_k)
        is_loss = (h_adi == eski_o) or (h_adi == eski_k)
        
        if not is_gain and not is_loss: continue
        
        if "selfConquer" in aktif and yeni_o == eski_o: return True
        if "internal" in aktif and yeni_k == eski_k and yeni_k not in ["", "---"]: return True
        if "barbarian" in aktif and is_gain and eski_o == "barbar": return True
        if "gains" in aktif and is_gain: return True
        if "losses" in aktif and is_loss and (yeni_o != eski_o): return True
        
    return False

# ====================== 5. ANA DÖNGÜ (Oracle API Okuyucu) ======================
def run_bot():
    last_world_check_time = 0
    loop_count = 0
    
    print("🔄 Arka plan bot döngüsü başlatıldı (her 60 saniyede bir tarama)")

    while True:
        loop_count += 1
        now_ts = int(time.time())
        
        # Günde bir kez dünya güncellemesi
        if now_ts - last_world_check_time > 86400:
            update_global_worlds()
            last_world_check_time = now_ts

        print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] 🚀 Tarama #{loop_count} - Oracle kontrol ediliyor...")

        try:
            # Firebase'den kullanıcıları çek
            users_docs = list(db.collection('users').stream())   # list() ekledik ki tüketilsin
            worlds_cache = {}
            
            for user_doc in users_docs:
                config = user_doc.to_dict()
                gs = config.get('global_settings', {})
                w_link = gs.get('world_link', '').strip().rstrip('/')
                b_token = gs.get('telegram_bot_token', '')
                c_id = gs.get('telegram_chat_id', '')
                
                if not w_link or not b_token or not c_id or b_token == "*****HIDDEN*****":
                    continue
                
                w_id = w_link.split('//')[-1].split('.')[0]
                if w_id not in worlds_cache:
                    worlds_cache[w_id] = {'users': []}
                worlds_cache[w_id]['users'].append(config)

            print(f"   → {len(worlds_cache)} dünya ve {sum(len(w['users']) for w in worlds_cache.values())} kullanıcı config yüklendi.")

            async_tasks_queue = []

            for world_id, w_data in worlds_cache.items():
                # last_ts kontrolü
                check_ref = db.collection('worlds').document(world_id).collection('config').document('last_ts')
                last_ts_doc = check_ref.get()
                last_ts = last_ts_doc.to_dict().get('timestamp', 0) if last_ts_doc.exists else now_ts - 300

                oracle_url = f"{ORACLE_API_URL}/{world_id}/Anlik_Fetihler"
                try:
                    res = requests.get(oracle_url, timeout=15)
                    print(f"   → {world_id} API çağrısı: Status {res.status_code} | Response uzunluğu: {len(res.text)}")

                    if res.status_code != 200:
                        print(f"   → Hata: {res.text[:300]}")
                        continue
                    
                    data = res.json()
                    fetih_listesi = data.get("veriler", [])
                    print(f"   → {world_id}: Toplam {len(fetih_listesi)} fetih çekildi. En yeni ts: {max((f.get('ts',0) for f in fetih_listesi), default=0)}")
                    
                except Exception as e:
                    print(f"   → {world_id} Bağlantı hatası: {e}")
                    continue

                yeni_fetihler = [f for f in fetih_listesi if f.get("ts", 0) > last_ts]
                
                if yeni_fetihler:
                    print(f"   → {world_id}: {len(fetih_listesi)} toplam fetih, {len(yeni_fetihler)} yeni fetih bulundu.")
                    current_max_ts = max(f["ts"] for f in yeni_fetihler)

                    # Kullanıcı filtreleme
                    for user_config in w_data['users']:
                        eslesen_fetihler = []
                        for fetih in yeni_fetihler:
                            if is_conquest_matching(fetih, user_config):
                                # decode
                                fetih['yeni_sahip'] = urllib.parse.unquote_plus(fetih.get('yeni_sahip', ''))
                                fetih['eski_sahip'] = urllib.parse.unquote_plus(fetih.get('eski_sahip', ''))
                                fetih['yeni_klan_tag'] = urllib.parse.unquote_plus(fetih.get('yeni_klan_tag', ''))
                                fetih['eski_klan_tag'] = urllib.parse.unquote_plus(fetih.get('eski_klan_tag', ''))
                                eslesen_fetihler.append(fetih)

                        if eslesen_fetihler:
                            baslik = f"⚔️ YENİ FETİH RAPORU [{world_id.upper()}]"
                            photo_bytes = generate_vertical_image(eslesen_fetihler, baslik)
                            
                            async_tasks_queue.append({
                                "token": user_config['global_settings']['telegram_bot_token'],
                                "chat_id": user_config['global_settings']['telegram_chat_id'],
                                "caption": f"🎯 Kriterlerinize uyan {len(eslesen_fetihler)} işlem bulundu! ({world_id.upper()})",
                                "bytes": photo_bytes
                            })

                    # Timestamp güncelle
                    check_ref.set({"timestamp": current_max_ts})
                else:
                    print(f"   → {world_id}: Yeni fetih yok.")

            # Telegram gönderimleri
            if async_tasks_queue:
                print(f"🔥 {len(async_tasks_queue)} adet rapor Telegram'a gönderiliyor...")
                asyncio.run(dispatch_all_tasks(async_tasks_queue))
                print("✅ Gönderimler tamamlandı!")

        except Exception as e:
            print(f"❌ Ana döngü hatası: {e}")

        print(f"   ⏳ {60} saniye bekleniyor...\n")
        time.sleep(60)

def start_background_bot():
    """Gunicorn worker'ları başladığında botu çalıştır"""
    print("✅ Background bot thread başlatılıyor...")
    bot_thread = Thread(target=run_bot, daemon=True)
    bot_thread.start()

# Bu fonksiyonu app yüklenirken çağıracağız
start_background_bot()

# Gunicorn için sadece app'i expose et (hiçbir şey çalıştırma)
if __name__ == "__main__":
    # Sadece yerel test için (Render'da bu blok çalışmaz)
    print("🚀 Yerel test modu - Flask dev server başlatılıyor...")
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port, debug=False)