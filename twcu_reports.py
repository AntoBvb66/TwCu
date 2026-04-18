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

# ====================== 2. MOBİL UYUMLU ŞIK FOTOĞRAF OLUŞTURUCU ======================
# ====================== 2. AKILLI DİNAMİK FOTOĞRAF OLUŞTURUCU ======================
def generate_vertical_image(fetihler, baslik):
    """Gelen veri sayısına göre tek, çift veya üçlü sütun tasarımı yapar."""
    toplam_fetih = len(fetihler)
    
    # 💥 Güvenlik Sınırı: Resim devasa olup Telegramı çökertmesin diye maks 30 kart çizilir.
    gosterilecek_sayi = min(toplam_fetih, 30)

    # 📐 Kaç sütun olacağına karar ver
    if gosterilecek_sayi <= 8:
        sutun_sayisi = 1
    elif gosterilecek_sayi <= 16:
        sutun_sayisi = 2
    else:
        sutun_sayisi = 3

    satir_sayisi = math.ceil(gosterilecek_sayi / sutun_sayisi)

    # Kart boyutları
    card_w, card_h = 420, 110 # Yan yana geleceği için hafif daralttık
    margin, padding = 20, 15
    header_h = 60

    # Resmin devasa (Dinamik) Tuvali
    img_w = margin + (sutun_sayisi * (card_w + margin))
    img_h = header_h + (satir_sayisi * (card_h + margin))

    img = Image.new("RGB", (img_w, img_h), (20, 24, 28))
    draw = ImageDraw.Draw(img)

    # Fontları Yükle
    try:
        font_bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
        font_regular = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
    except:
        font_bold = font_regular = font_small = ImageFont.load_default()

    # Başlığı Yaz
    if toplam_fetih > 30:
        baslik_metni = f"{baslik} (Gösterilen: {gosterilecek_sayi} / Toplam: {toplam_fetih})"
    else:
        baslik_metni = f"{baslik} (Toplam: {toplam_fetih} İşlem)"
        
    draw.text((margin, margin), baslik_metni, font=font_bold, fill=(255, 215, 0))
    draw.line((margin, header_h - 10, img_w - margin, header_h - 10), fill=(60, 60, 60), width=2)

    # Kartları Çiz (Izgara Mantığı)
    for idx in range(gosterilecek_sayi):
        f = fetihler[idx]
        
        # Bu kart hangi satır ve sütuna denk geliyor?
        sutun = idx // satir_sayisi
        satir = idx % satir_sayisi

        # Kartın X ve Y başlangıç noktaları
        x = margin + (sutun * (card_w + margin))
        y = header_h + (satir * (card_h + margin))

        # 1. Kart Arka Planı
        draw.rounded_rectangle([x, y, x + card_w, y + card_h], radius=8, fill=(30, 36, 43))
        
        # 2. Saat ve Köy
        saat_txt = datetime.fromtimestamp(f['ts'], tz=timezone.utc) + timedelta(hours=3)
        saat_str = f"🕒 {saat_txt.strftime('%H:%M')}"
        koy_str = f"🏰 {f['koy_adi']} ({f['koordinat']})"
        
        draw.text((x + padding, y + 10), saat_str, font=font_small, fill=(150, 150, 150))
        draw.text((x + padding + 70, y + 8), koy_str, font=font_bold, fill=(240, 240, 240))

        # 3. Alan (Yeşil)
        alan_txt = f"🟢 Alan: {f['yeni_sahip']}"
        if f.get('yeni_klan_tag') and f['yeni_klan_tag'] != "---":
            alan_txt += f" [{f['yeni_klan_tag']}]"
        draw.text((x + padding, y + 40), alan_txt, font=font_regular, fill=(74, 222, 128))

        # 4. Veren (Kırmızı)
        veren_txt = f"🔴 Veren: {f['eski_sahip']}"
        if f.get('eski_klan_tag') and f['eski_klan_tag'] != "---":
            veren_txt += f" [{f['eski_klan_tag']}]"
        draw.text((x + padding, y + 70), veren_txt, font=font_regular, fill=(248, 113, 113))

    buf = io.BytesIO()
    img.save(buf, format='PNG')
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
    
    while True:
        now_ts = int(time.time())
        
        # 1. GÜNDE BİR KERE DÜNYA GÜNCELLEMESİ
        if now_ts - last_world_check_time > 86400:
            update_global_worlds()
            last_world_check_time = now_ts

        print(f"\n[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] 🚀 TW Santrali Oracle'ı Tarıyor...")
        
        try:
            # 2. Firebase'den Tüm Kullanıcıları Çek
            users_docs = db.collection('users').stream()
            worlds_cache = {}
            
            for user_doc in users_docs:
                config = user_doc.to_dict()
                gs = config.get('global_settings', {})
                w_link = gs.get('world_link', '').strip().rstrip('/')
                b_token = gs.get('telegram_bot_token', '')
                c_id = gs.get('telegram_chat_id', '')
                
                if not w_link or not b_token or not c_id or b_token == "*****HIDDEN*****": continue
                
                w_id = w_link.split('//')[-1].split('.')[0] # ptc1
                if w_id not in worlds_cache:
                    worlds_cache[w_id] = {'users': []}
                worlds_cache[w_id]['users'].append(config)

            async_tasks_queue = []

            # 3. Her Dünya İçin Doğrudan ORACLE'A SOR
            for world_id, w_data in worlds_cache.items():
                
                # Render kapanıp açıldığında eski mesajları spamlamamak için ts kontrolü
                check_ref = db.collection('worlds').document(world_id).collection('config').document('last_ts')
                last_ts = check_ref.get().to_dict().get('timestamp', 0) if check_ref.get().exists else now_ts - 120
                if last_ts > now_ts or (now_ts - last_ts) > 86400: last_ts = now_ts - 120

                # İŞTE BÜYÜ BURADA: Oracle API'sine bağlan!
                oracle_url = f"{ORACLE_API_URL}/{world_id}/Anlik_Fetihler"
                try:
                    res = requests.get(oracle_url, timeout=10)
                    if res.status_code != 200: continue
                    fetih_listesi = res.json().get("veriler", [])
                except: continue

                # Yeni fetihleri ayıkla
                yeni_fetihler = [f for f in fetih_listesi if f["ts"] > last_ts]
                if not yeni_fetihler: continue

                current_max_ts = max(f["ts"] for f in yeni_fetihler)

                # 4. Kullanıcılara Göre Süz
                for user_config in w_data['users']:
                    eslesen_fetihler = []
                    
                    for fetih in yeni_fetihler:
                        # URL Encoding çözümü ve süzgeç kontrolü
                        if is_conquest_matching(fetih, user_config):
                            # Mesajda güzel görünsün diye decode edelim
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
                            "caption": f"🎯 Kriterlerinize uyan {len(eslesen_fetihler)} işlem bulundu!",
                            "bytes": photo_bytes
                        })

                # İşlem bitti, zamanı Firebase'e kaydet
                check_ref.set({"timestamp": current_max_ts})

            # 5. Mesajları Fırlat
            if async_tasks_queue:
                print(f"🔥 {len(async_tasks_queue)} adet görsel Telegram'a asenkron fırlatılıyor...")
                asyncio.run(dispatch_all_tasks(async_tasks_queue))
                print("✅ Başarıyla gönderildi!")

        except Exception as e:
            print(f"Döngü Hatası: {e}")

        # Oracle API zaten hazır ve veriyi tuttuğu için 60 saniyede bir taramamız yeterli
        time.sleep(60) 

if __name__ == "__main__":
    bot_thread = Thread(target=run_bot)
    bot_thread.daemon = True
    bot_thread.start()
    
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)