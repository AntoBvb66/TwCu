import os
import requests
import gzip
import json
import io
import urllib.parse
import time
import schedule
import gc
import firebase_admin
import certifi
from firebase_admin import credentials, firestore
from datetime import datetime
from threading import Thread
from flask import Flask
from flask import jsonify
from flask_cors import CORS

# MySQL / TiDB bağlantısı için SQLAlchemy kullanıyoruz
from sqlalchemy import create_engine, text

# ==========================================
# 1. BAĞLANTILAR (FIREBASE & TiDB)
# ==========================================
# Firebase
try:
    FIREBASE_KEY_JSON = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')
    if not firebase_admin._apps:
        cred = credentials.Certificate(json.loads(FIREBASE_KEY_JSON))
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Firebase bağlantısı başarılı!")
except Exception as e:
    print(f"❌ Firebase bağlantı hatası: {e}")

# TiDB (MySQL Serverless)
db_engine = None
try:
    TIDB_URI = os.environ.get("TIDB_URI")
    if not TIDB_URI:
        print("❌ HATA: TIDB_URI tanımlanmamış! Render panelini kontrol et.")
    else:
        # SSL sertifikası hatasını önlemek için certifi ekliyoruz
        ssl_args = {'ssl': {'ca': certifi.where()}}
        
        # Bağlantı motorunu oluşturuyoruz (pool_recycle bağlantıların kopmasını engeller)
        db_engine = create_engine(
            TIDB_URI, 
            pool_recycle=3600, 
            connect_args=ssl_args
        )
        print("✅ TiDB (MySQL) Bağlantı Motoru Hazır!")
except Exception as e:
    print(f"❌ TiDB bağlantı hatası: {e}")

# ==========================================
# 2. AYARLAR
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
            data = doc.to_dict()
            for dunya_listesi in data.values():
                if isinstance(dunya_listesi, list):
                    all_worlds.extend(dunya_listesi)
            return all_worlds
        return []
    except Exception as e:
        print(f"Firebase'den dunya listesi cekilemedi: {e}")
        return []

# ==========================================
# 3. VERİ ÇEKME VE TiDB'YE YAZMA GÖREVİ (TIKANMA KORUMALI)
# ==========================================
def ana_arsiv_gorevi():
    if db_engine is None:
        print("⚠️ TiDB bağlantısı yok, arşivleme yapılamaz!")
        return

    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] SAATLİK ARŞİVLEME BAŞLADI (TiDB)...")
    dunyalar = get_active_worlds()

    for d in dunyalar:
        d_id = d.get('id')
        d_url = d.get('url')
        if not d_id or not d_url: continue

        print(f"[{datetime.now().strftime('%H:%M:%S')}] {d_id} verisi çekiliyor...")

        # BAĞLANTIYI HER DÜNYA İÇİN TAZE AÇIYORUZ (Biri bozulursa diğerleri etkilenmez)
        try:
            with db_engine.connect() as conn:
                for endpoint, tablo_adi in DOSYALAR.items():
                    gercek_tablo = f"{d_id}_{tablo_adi}"
                    golge_tablo = f"{gercek_tablo}_temp"

                    tam_url = f"{d_url.rstrip('/')}{endpoint}"
                    try:
                        r = requests.get(tam_url, stream=True, timeout=20)
                        if r.status_code == 200:
                            conn.execute(text(f"DROP TABLE IF EXISTS {golge_tablo}"))
                            conn.execute(text(f"CREATE TABLE {golge_tablo} (id VARCHAR(30) PRIMARY KEY, veri JSON)"))
                            
                            toplu_veri = []
                            CHUNK_SIZE = 2500 
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
                                            sorgu = text(f"INSERT INTO {golge_tablo} (id, veri) VALUES (:id, :veri)")
                                            conn.execute(sorgu, toplu_veri)
                                            kaydedilen_toplam += len(toplu_veri)
                                            toplu_veri.clear() 

                            if toplu_veri:
                                sorgu = text(f"INSERT INTO {golge_tablo} (id, veri) VALUES (:id, :veri)")
                                conn.execute(sorgu, toplu_veri)
                                kaydedilen_toplam += len(toplu_veri)

                            if kaydedilen_toplam > 0:
                                conn.execute(text(f"DROP TABLE IF EXISTS {gercek_tablo}"))
                                conn.execute(text(f"RENAME TABLE {golge_tablo} TO {gercek_tablo}"))
                                conn.commit() # Başarılıysa onayla
                                print(f"    {tablo_adi} TiDB'ye kaydedildi: {kaydedilen_toplam} kayıt.")
                                
                    except Exception as e:
                        # HAYAT KURTARAN SATIR: Hata olursa işlemi geri al ve kağıt sıkışmasını önle
                        conn.rollback()
                        print(f"    HATA ({tablo_adi}): {e}")

        except Exception as genel_hata:
            print(f"    {d_id} bağlantı hatası: {genel_hata}")

        time.sleep(1) 
        gc.collect()  

    print(f"[{datetime.now().strftime('%H:%M:%S')}] SAATLİK GÜNCELLEME TAMAMLANDI.")
# ==========================================
# 4. ÇALIŞTIRICI DÖNGÜ
# ==========================================
def run_schedule():
    print("🔄 Arka plan arşiv döngüsü başlatıldı.")
    # İlk çalıştırma
    ana_arsiv_gorevi()
    
    schedule.every().hour.at(":00").do(ana_arsiv_gorevi)
    
    while True:
        schedule.run_pending()
        time.sleep(1)

# ==========================================
# 5. FLASK WEB SUNUCUSU
# ==========================================
app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return "🚀 TwCu Engine (TiDB Serverless) is Running!"

@app.route('/api/<world_id>/<tablo_adi>', methods=['GET'])
def get_world_data(world_id, tablo_adi):
    # Sadece izin verdiğimiz tablolar sorgulanabilsin (Güvenlik)
    izin_verilenler = ["Koyler", "Oyuncular", "Klanlar"]
    if tablo_adi not in izin_verilenler:
        return jsonify({"hata": "Geçersiz tablo adı"}), 400

    gercek_tablo = f"{world_id}_{tablo_adi}"
    veriler = []

    if db_engine is None:
        return jsonify({"hata": "Veritabanı bağlantısı yok"}), 500

    try:
        with db_engine.connect() as conn:
            # Tablodaki tüm JSON verilerini çek
            sorgu = text(f"SELECT veri FROM {gercek_tablo}")
            sonuclar = conn.execute(sorgu).fetchall()

            for satir in sonuclar:
                # TiDB'den gelen JSON stringini tekrar diziye (array) çevirip listeye ekle
                veriler.append(json.loads(satir[0]))

        return jsonify({"veriler": veriler})
    
    except Exception as e:
        return jsonify({"hata": str(e)}), 500
    
# Botu arka planda başlat
print("✅ Arka plan botu tetikleniyor...")
bot_thread = Thread(target=run_schedule, daemon=True)
bot_thread.start()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port, debug=False)