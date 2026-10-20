# Oyun sunucusu (Railway)

Online maçlarda hamleyi sunucu doğrular: sıra, yasal hamle, mat/pat/beraberlik, pes ve 3 dakikalık hamle süresi.
Sunucu Firestore'a Firebase Admin ile yazar; istemciler hamle ve sonuç yazamaz (`firestore.rules.strict`).

## Kurulum
1. Railway'de **New Project › Deploy from GitHub repo** › `buyucu-satranc`. Servis ayarlarında **Root Directory** = `server`.
2. Firebase Console › Proje ayarları › Hizmet hesapları › **Yeni özel anahtar oluştur**. İnen JSON dosyasının tüm içeriğini
   Railway › Variables › `FIREBASE_SERVICE_ACCOUNT` değerine yapıştır. (Bu anahtar gizlidir; depoya koyma, kimseyle paylaşma.)
3. İsteğe bağlı değişkenler: `MOVE_LIMIT_MS` (varsayılan 180000), `ALLOWED_ORIGINS` (virgülle ayrılmış, varsayılan GitHub Pages ve uygulama kaynakları).
4. Railway › Settings › Networking › **Generate Domain**. Çıkan adresi `docs/firebase-config.js` ve `www/firebase-config.js` içindeki `window.SERVER_URL` değerine yaz.
5. Sunucu çalıştıktan sonra Firestore kurallarını `firestore.rules.strict` ile değiştir (Firebase Console › Firestore › Rules). Önce kuralları değiştirirsen online hamleler çalışmaz.
6. `GET /` adresi `{"ok":true,...}` dönmeli.

## Maliyet notu
Sunucu 15 saniyede bir devam eden maçları tarar (süre kontrolü). Küçük kullanıcı sayısında Firestore ücretsiz kotası yeter.
