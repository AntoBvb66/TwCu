"""
GitHub Actions için tek seferlik tarama scripti.
Bir kez tarama yapar, mesajları gönderir ve çıkar.
main.py'deki yardımcı fonksiyonları yeniden kullanır (Flask/loop başlatmaz).
"""
import asyncio
import time
import requests
from datetime import datetime, timedelta

import main as bot

MAX_LOOKBACK_SEC = 300


def do_one_scan():
    print(f"[{(datetime.utcnow() + timedelta(hours=3)).strftime('%H:%M:%S')}] Tek seferlik tarama başlıyor...")
    users_docs = list(bot.db.collection('users').stream())
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
        print("⚠ Takip edilecek geçerli dünya/kullanıcı yok.")
        return

    async_tasks_queue = []
    now_ts = int(time.time())

    for world_id, w_data in worlds_cache.items():
        check_ref = bot.db.collection('system_data').document('last_conquests').collection(world_id).document('ts')
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

            koy = bot.get_info_from_tidb(world_id, "Koyler", v_id)
            yeni_oy = bot.get_info_from_tidb(world_id, "Oyuncular", new_o)
            eski_oy = bot.get_info_from_tidb(world_id, "Oyuncular", old_o)
            y_klan = bot.get_info_from_tidb(world_id, "Klanlar", yeni_oy[2]) if yeni_oy and yeni_oy[2] != "0" else None
            e_klan = bot.get_info_from_tidb(world_id, "Klanlar", eski_oy[2]) if eski_oy and eski_oy[2] != "0" else None

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
                    fetih["tur"] = bot.get_conquest_type(fetih, ["gains", "losses", "barbarian", "internal", "selfConquer"])

                if not matched:
                    for p in m_players:
                        if fetih["yeni_sahip"] == p["name"] or fetih["eski_sahip"] == p["name"]:
                            if bot.check_filters(fetih, p["active_filters"], p_name=p["name"]):
                                matched = True
                                fetih["tur"] = bot.get_conquest_type(fetih, p["active_filters"], p_name=p["name"])
                                break
                if not matched:
                    for t in m_tribes:
                        if fetih["yeni_klan_tag"] == t["tag"] or fetih["eski_klan_tag"] == t["tag"]:
                            if bot.check_filters(fetih, t["active_filters"], t_tag=t["tag"]):
                                matched = True
                                fetih["tur"] = bot.get_conquest_type(fetih, t["active_filters"], t_tag=t["tag"])
                                break

                if matched:
                    text_msg = bot.generate_text_report(fetih, world_id)
                    if notif_type == "text":
                        async_tasks_queue.append((b_token, c_id, text_msg, None))
                    else:
                        img_bytes = bot.generate_grid_table(fetih, world_id)
                        caption = text_msg if notif_type == "both" else None
                        async_tasks_queue.append((b_token, c_id, caption, img_bytes))

        check_ref.set({"timestamp": max_ts}, merge=True)

    if async_tasks_queue:
        print(f"🔥 {len(async_tasks_queue)} mesaj Telegram'a gönderiliyor...")
        results = asyncio.run(bot.dispatch_all_tasks(async_tasks_queue))
        ok = sum(1 for r in results if r is True)
        fail = len(results) - ok
        print(f"✅ Gönderildi: {ok} | ❌ Başarısız: {fail}")
    else:
        print("✅ Tüm dünyalar tarandı, eşleşen yeni fetih yok.")


if __name__ == "__main__":
    try:
        do_one_scan()
        print("🏁 Tarama tamamlandı.")
    except Exception as e:
        print(f"❌ Hata: {e}")
        raise
