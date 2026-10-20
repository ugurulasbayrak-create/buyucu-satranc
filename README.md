# Büyücü Satranç – Google Play paketi

Bu klasör oyunu Capacitor ile Android uygulamasına çevirir. Oyun çevrimdışı çalışır, kütüphaneler uygulamanın içine gömülür.
Android paketini (AAB) üretmek ve Play'e yüklemek senin bilgisayarında ve Play Console hesabında yapılır; ben bu ortamdan yapamam
(internet kısıtlı, Android SDK yok, imzalama anahtarı ve geliştirici hesabı sana ait).

## 0. Gerekenler
- Node.js 20+ ve Android Studio (SDK ile)
- Google Play geliştirici hesabı (tek seferlik 25 USD). Yeni kişisel hesaplarda yayına çıkmadan önce kapalı test şartı olabilir
  (şu an 12 test kullanıcısı ve 14 gün). Güncel şartı Play Console'da kontrol et.

## 1. Paket adı
Paket adı `com.ulas.buyucusatranc` olarak ayarlı (Firebase Android uygulaması da bu adla kayıtlı). Sonradan değişmez.

## 2. Kur ve derle
```
npm install
npm run libs                  # three.js ve chess.js'i www/libs içine indirir
npx cap add android
npm run icons                 # assets/icon-only.png'den simgeleri üretir
npx cap sync android
npx cap open android          # Android Studio açılır
```
Android Studio'da: Build › Generate Signed App Bundle › Android App Bundle.
Yeni keystore oluştur ve **dosyayı ile şifresini yedekle** (kaybedersen güncelleme yayınlayamazsın). Play App Signing'i aç.

## 2b. Firebase (giriş + online oyun)
Firebase projesi `buyucu-satranc` oluşturuldu: Google ve E-posta/Şifre girişi açık, Firestore veritabanı ve güvenlik kuralları (`firestore.rules`) yayında.
`www/firebase-config.js` bu projenin web ayarlarıyla dolu. Senin yapacakların:
1. Firebase Console › Proje ayarları › Android uygulaması › `google-services.json` dosyasını indirip `android/app/` içine koy (`npx cap add android` sonrası).
2. Aynı sayfada **SHA-1 ve SHA-256** parmak izlerini ekle: debug için `cd android && ./gradlew signingReport`; yayın için Play Console › Uygulama bütünlüğü › Uygulama imzalama anahtarı sertifikası. Google ile giriş bunlar olmadan çalışmaz.
3. Yeni `google-services.json` indirip tekrar `android/app/` içine koy, `npx cap sync android`.
4. Firebase Console › Authentication › Settings › Authorized domains: `localhost` ekli olmalı (varsayılan gelir).
Online oyun: Ana menü › Online Oyna › Hızlı eşleş / Oda kur (5 harfli kod) / Koda katıl. Rakip Wi-Fi'de ya da başka telefonda olabilir.
Bilinen sınırlar: hamle kuralları sunucuda doğrulanmaz (sadece sıra ve oyuncu kontrol edilir), süre sayacı yok, bağlantısı kopan oyuncu için otomatik hükmen yenilgi yok.

## 3. Kontrol et
- `android/variables.gradle` içinde `targetSdkVersion` Play'in güncel şartını karşılamalı (Capacitor 7 varsayılanı genelde yeterli, yine de kontrol et).
- Gerçek telefonda test et: `npx cap run android`. Düşük model telefonda yavaşlarsa oyun kaliteyi kendisi düşürür.
- Oyun tam ekran hissi için `android/app/src/main/res/values/styles.xml` içinde `AppTheme.NoActionBar` zaten kullanılır; durum çubuğu rengi koyu kalır.

## 4. Play Console
1. Uygulama oluştur (Dil: Türkçe, Oyun, Ücretsiz)
2. `store/magaza-metinleri.md` içindeki metinleri, simgeyi ve öne çıkan grafiği yükle
3. `store/gizlilik-politikasi.html` dosyasını [TARİH] ve [E-POSTA] alanlarını doldurarak herkese açık bir adrese koy
   (GitHub Pages yeter) ve bağlantısını forma yaz
4. Veri güvenliği, içerik derecelendirme, hedef kitle formlarını doldur (cevaplar metin dosyasında)
5. AAB'yi önce Kapalı test kanalına yükle, şartlar tamamlanınca Üretim'e geç

## Hesap silme (Play şartı)
Uygulamada Online › 'Hesabımı sil' var. Play Console'da silme talebi için gizlilik politikası sayfasının adresini yaz (sayfada silme yolu anlatılıyor).

## Not
Google Fonts bağlantısı çevrimdışıyken çalışmaz, oyun yedek yazı tipine düşer. Tam çevrimdışı görünüm için Almendra ve Spectral
yazı tiplerini indirip `www/` içine koyabilir ve CSS'e `@font-face` olarak ekleyebilirsin.


## Depo yapısı
- `docs/` GitHub Pages (canlı web sürümü + gizlilik sayfası)
- `www/` Android (Capacitor) için web içeriği
- `src/` oyunun parça parça kaynak kodu (`sh src/build.sh`)
- `store/` Play mağaza metinleri ve görselleri
- `firestore.rules` veritabanı kuralları
