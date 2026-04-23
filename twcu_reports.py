import os
import requests
import gzip
import json
import io
import time
import schedule
import gc
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from pymongo import MongoClient, UpdateOne
from flask import Flask
from threading import Thread

# ==========================================
# 1. BAĞLANTILAR (FIREBASE & MONGODB)
# ==========================================
try:
    # Render'da Firebase key'ini Environment Variable (FIREBASE_SERVICE_ACCOUNT_KEY) olarak eklemelisin
    FIREBASE_KEY_JSON = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')
    if not firebase_admin._apps:
        cred = credentials.Certificate(json.loads(FIREBASE_KEY_JSON))
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Firebase bağlantısı başarılı!")
except Exception as e:
    print(f"❌ Firebase bağlantı hatası: {e}")

try:
    MONGO_URI = os.getenv("MONGO_URI") 
    mongo_client = MongoClient(MONGO_URI)
    mongo_db = mongo_client["TwCu_Data"]
    print("✅ MongoDB Atlas bağlantısı başarılı!")
except Exception as e:
    print(f"❌ MongoDB bağlantı hatası: {e}")

# ==========================================
# 2. AYARLAR VE YARDIMCI FONKSİYONLAR
# ==========================================
DOSYALAR = {
    "/map/village.txt.gz": "Koyler",
    "/map/player.txt.gz": "Oyuncular",
    "/map/ally.txt.gz": "Klanlar"
}

def get_active_worlds():
    try:
        doc_ref = db.collection('system_data').document('active_worlds')
        doc = doc_ref.get()
        all_worlds = []
        if doc.exists:
            for dunya_listesi in doc.to_dict().values():
                if isinstance(dunya_listesi, list):
                    all_worlds.extend(dunya_listesi)
            return all_worlds
        return []
    except Exception as e:
        print(f"Firebase'den dünya listesi çekilemedi: {e}")
        return []

# ==========================================
# 3. VERİ ÇEKME VE MONGODB'YE YAZMA GÖREVİ
# ==========================================
def ana_arsiv_gorevi():
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] SAATLİK ARŞİVLEME BAŞLADI...")
    dunyalar = get_active_worlds()

    if not dunyalar:
        print("Hata: Aktif dünya listesi boş, atlanıyor.")
        return

    for d in dunyalar:
        d_id = d.get('id')
        d_url = d.get('url')
        
        if not d_id or not d_url: continue

        print(f"[{datetime.now().strftime('%H:%M:%S')}] {d_id} verisi çekiliyor...")

        for endpoint, tablo_adi in DOSYALAR.items():
            koleksiyon_adi = f"{d_id}_{tablo_adi}"
            koleksiyon = mongo_db[koleksiyon_adi]

            tam_url = f"{d_url.rstrip('/')}{endpoint}"
            try:
                r = requests.get(tam_url, stream=True, timeout=20)
                if r.status_code == 200:
                    with gzip.open(io.BytesIO(r.content), 'rt', encoding='utf-8') as f:
                        toplu_islemler = []
                        for satir in f:
                            if satir.strip():
                                parcalar = satir.strip().split(',')
                                islem = UpdateOne(
                                    {'_id': str(parcalar[0])}, 
                                    {'$set': {'veri': json.dumps(parcalar)}}, 
                                    upsert=True
                                )
                                toplu_islemler.append(islem)

                        if toplu_islemler:
                            koleksiyon.bulk_write(toplu_islemler)
                            print(f"    {tablo_adi} Atlas'a kaydedildi: {len(toplu_islemler)} kayıt.")
            except Exception as e:
                print(f"    HATA ({tablo_adi}): {e}")

        time.sleep(5)
        gc.collect()

    print(f"[{datetime.now().strftime('%H:%M:%S')}] SAATLİK GÜNCELLEME TAMAMLANDI.\n")

# ==========================================
# 4. ARKA PLAN DÖNGÜSÜ (THREAD)
# ==========================================
def run_schedule():
    print("🔄 Arka plan arşiv döngüsü başlatıldı (Saat başı çalışacak)")
    # İlk çalışma (Sunucu açılır açılmaz çalışsın)
    ana_arsiv_gorevi()
    
    # Sonrakiler her saat başı
    schedule.every().hour.at(":00").do(ana_arsiv_gorevi)
    
    while True:
        schedule.run_pending()
        time.sleep(1)

# ==========================================
# 5. FLASK WEB SUNUCUSU (RENDER İÇİN ŞART)
# ==========================================
app = Flask(__name__)

@app.route('/')
def home():
    return "🚀 TwCu Arşivci (MongoDB) Başarıyla Çalışıyor!"

if __name__ == "__main__":
    # Arka plan işini başlat
    bot_thread = Thread(target=run_schedule, daemon=True)
    bot_thread.start()

    # Flask'ı başlatıp Render'ın istediği Portu dinle
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port, debug=False)