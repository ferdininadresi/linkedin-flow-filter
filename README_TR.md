# LinkedIn Bildirim Akışları — v0.3.0

Bu Chrome eklentisi LinkedIn'in Bildirimler sayfasındaki bildirimleri kişi/kurum
bazında özel akışlara (sekmelere) ayırır. Örn. "Hocalarım", "Takip Ettiğim Kurumlar"
gibi kendi gruplarını oluşturup sadece onların paylaşımlarını görebilirsin.

**Dil:** Panel arayüzü varsayılan olarak İngilizce açılır. Başlıktaki
**TR/ENG** düğmesiyle istediğin zaman Türkçe/İngilizce arasında geçiş
yapabilirsin; tercihin kaydedilir.

**Veri gizliliği:** Tüm ayarlar yalnızca kendi tarayıcında (`chrome.storage.local`)
tutulur, hiçbir sunucuya gönderilmez.

**Not:** Bu, LinkedIn tarafından yayınlanmış veya desteklenen resmi bir eklenti
değildir; bağımsız bir kişisel araçtır. LinkedIn sayfa yapısını değiştirirse
eklenti geçici olarak bozulabilir.

## Kurulum
1. Bu depoyu ZIP olarak indir (yeşil **Code → Download ZIP** butonu) ve aç.
2. Chrome adres çubuğuna `chrome://extensions` yaz.
3. Sağ üstten **Geliştirici modu**'nu aç.
4. **Paketlenmemiş öğe yükle** seç, açtığın klasörü göster.
5. LinkedIn Bildirimler sayfasını (linkedin.com/notifications) yenile.

(Chromium tabanlı diğer tarayıcılarda — Edge, Brave, Opera — da aynı şekilde çalışır.)

## Temel kullanım
- Bildirim kartlarının sağ üstünde beliren **＋** düğmesiyle o kişiyi/kurumu bir
  veya birden fazla akışa ekleyebilirsin.
- Üstteki sekmelerden istediğin akışı seçip sadece o akıştaki kişilerin
  bildirimlerini görebilirsin.
- **＋ Akış** yeni bir akış (sekme) oluşturur.
- **⚙** akışları yönetir: yeniden adlandırma, silme, kişi/kurum ekleme-çıkarma.
- **👥** tüm izlediğin kişileri tek ekranda listeler; isimle arayabilir, hangi
  akışlarda olduklarını görebilir, **Akışları düzenle** ile değiştirebilir veya
  **Sil** ile tüm akışlardan çıkarabilirsin.

## Henüz hiç bildirimi olmayan kişi/kurumu ekleme
İki yol var:
1. **⚙ → Kişi / kurum ekle** — ad ve LinkedIn profil (`/in/...`) veya şirket
   sayfası (`/company/...`) URL'sini gir, akışı seç, ekle.
2. İlgili kişinin profilini veya kurumun şirket sayfasını ziyaret ettiğinde
   sağ altta beliren **＋ Bildirim Akışına Ekle** düğmesini kullan.

Not: LinkedIn o kişiyle/kurumla ilgili henüz bir bildirim üretmediyse
filtrelenecek bir kart da yoktur — gelecekte bir bildirim geldiğinde otomatik
olarak doğru akışta görünür.

## Yedekleme (Dışa/İçe Aktar)
Eklenti verisi tarayıcı profiline bağlı olduğundan (profil değişimi, Chrome
çıkış/giriş, farklı bir klasörden yeniden yükleme gibi durumlarda) kaybolabilir.
**⚙ → 💾 Dışa aktar** ile tüm akış/kişi verini bir JSON dosyası olarak indirebilir,
**📂 İçe aktar** ile aynı veya başka bir tarayıcıya geri yükleyebilirsin. Önemli
değişikliklerden sonra düzenli yedek almanı öneririz.

## Eşleşme sorunu yaşarsan
Panelde **🩺** düğmesi, sayfadaki bildirim kartlarından çıkarılan anahtarlarla
kayıtlı kişilerin anahtarlarını karşılaştırıp neyin eşleşmediğini gösteren bir
teşhis penceresi açar. Bir kişi akışına eklendiği halde bildirimleri
görünmüyorsa buradan kontrol edebilirsin.

## Teknik not
Eklenti, bildirim kartlarını `article.nt-card[data-view-name="notification-card-container"]`
seçicisiyle bulur. LinkedIn bu yapıyı değiştirirse eklenti kartları tanımayı
bırakabilir; böyle bir durumda selector'ün güncellenmesi gerekir (bkz. Issues).
