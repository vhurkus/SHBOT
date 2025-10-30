# SHBOT - Cross-Exchange Arbitrage Bot

BTCTurk ve Binance borsaları arasında **çoklu parite** desteğiyle otomatik arbitraj işlemi yapan gelişmiş bot.

## 🚀 Özellikler

### 🎯 Temel Özellikler
- **Çoklu Parite Desteği:** AVAX/USDT, XRP/USDT, SOL/USDT (daha fazla eklenebilir)
- WebSocket ile gerçek zamanlı fiyat takibi
- BTCTurk'te otomatik limit emir açma (Maker Fee: %0.08)
- Binance'te market emir yürütme (Taker Fee: %0.10)
- Piyasa değişimlerine göre dinamik emir fiyat güncelleme
- Transfer gerektirmeyen sürekli arbitraj döngüsü
- Kapsamlı loglama ve hata yönetimi

### 🧠 Gelişmiş Özellikler
- ✅ **Market Maker Stratejisi:** Sürekli açık emir, fiyat dolunca otomatik işlem
- ✅ **Dinamik Volatilite Sistemi:** Piyasa volatilitesine göre spread ayarlama
- ✅ **Slippage Tahmin Mekanizması:** Order book derinlik analizi
- ✅ **Rate Limiting & Auto-Retry:** API koruması ve otomatik yeniden deneme
- ✅ **Graceful Shutdown:** Güvenli kapatma mekanizması
- ⚙️ **Telegram Bildirimleri:** Opsiyonel (kurulum gerektirir)

## 📋 Gereksinimler

- Node.js v18 veya üzeri
- BTCTurk API credentials (Trading yetkisi gerekli)
- Binance API credentials (Spot Trading yetkisi gerekli)
- Her iki borsada minimum bakiye:
  - **AVAX paritesi için:** ~0.5 AVAX + 10 USDT (her iki borsada)
  - **XRP paritesi için:** ~10 XRP + 10 USDT (her iki borsada)
  - **SOL paritesi için:** ~0.05 SOL + 10 USDT (her iki borsada)

## 🛠️ Kurulum

### 1. Dependencies Yükleme
```bash
npm install
```

### 2. Environment Konfigürasyonu
```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin ve aşağıdaki bilgileri girin:
- BTCTurk API Key ve Secret
- Binance API Key ve Secret
- **Parite bazlı parametreler** (AVAX, XRP, SOL için ayrı ayarlar)
- Trading parametreleri (varsayılanlar kullanılabilir)

**Önemli:** Çoklu parite kullanacaksanız, her parite için ayrı parametreler tanımlayın:
```env
# AVAX Paritesi
AVAX_TRADE_AMOUNT=0.5
AVAX_MIN_PROFIT=0.05
AVAX_MIN_SPREAD=0.20

# XRP Paritesi  
XRP_TRADE_AMOUNT=10
XRP_MIN_PROFIT=0.03
XRP_MIN_SPREAD=0.15

# SOL Paritesi
SOL_TRADE_AMOUNT=0.05
SOL_MIN_PROFIT=0.05
SOL_MIN_SPREAD=0.20
```

### 3. Sistem Kontrolü (Önerilen)
Kurulumdan sonra sistem sağlığını kontrol edin:
```bash
npm run diagnostic
```

Bu komut:
- ✅ Dosya yapısını kontrol eder
- ✅ .env dosyasını ve API key'leri doğrular
- ✅ Dependencies'i kontrol eder
- ✅ Kod tutarlılığını kontrol eder
- ✅ Potansiyel sorunları tespit eder

## ⚙️ Konfigürasyon

`.env` dosyasındaki önemli parametreler:

### Zorunlu
```env
BTCTURK_API_KEY=your_api_key
BTCTURK_API_SECRET=your_api_secret
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
```

### Parite Bazlı Trading Parametreleri (Çoklu Parite Desteği)

Her parite için ayrı parametreler tanımlayabilirsiniz:

```env
# AVAX/USDT Paritesi (Birincil)
AVAX_TRADE_AMOUNT=0.5            # İşlem miktarı (AVAX)
AVAX_MIN_PROFIT=0.05             # Minimum kar hedefi (%)
AVAX_MIN_SPREAD=0.20             # Minimum spread (%)
AVAX_UPDATE_THRESHOLD=0.15       # Fiyat değişim eşiği (%)

# XRP/USDT Paritesi (İkincil)
XRP_TRADE_AMOUNT=10              # İşlem miktarı (XRP)
XRP_MIN_PROFIT=0.03              # Minimum kar hedefi (%)
XRP_MIN_SPREAD=0.15              # Minimum spread (%)
XRP_UPDATE_THRESHOLD=0.2         # Fiyat değişim eşiği (%)

# SOL/USDT Paritesi (Opsiyonel)
SOL_TRADE_AMOUNT=0.05            # İşlem miktarı (SOL)
SOL_MIN_PROFIT=0.05              # Minimum kar hedefi (%)
SOL_MIN_SPREAD=0.20              # Minimum spread (%)
SOL_UPDATE_THRESHOLD=0.15        # Fiyat değişim eşiği (%)
```

**Not:** Tanımlamadığınız pariteler için config.js'deki varsayılan değerler kullanılır.
```

### Fee'ler (Global - Tüm Pariteler İçin)
```env
BTCTURK_MAKER_FEE=0.0008    # %0.08 (Piyasa Yapıcı)
BTCTURK_TAKER_FEE=0.0012    # %0.12 (Piyasa Alıcı)
BINANCE_MAKER_FEE=0.001     # %0.10
BINANCE_TAKER_FEE=0.001     # %0.10
```

### Gelişmiş Özellikler (Opsiyonel)
```env
# Dinamik spread ayarlama (volatiliteye göre)
DYNAMIC_SPREAD=false

# Order book derinlik analizi
USE_ORDERBOOK_DEPTH=false

# Dry run mode (gerçek emir girmez, test amaçlı)
DRY_RUN=false

# Telegram bildirimleri
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## 🧪 Test

### Test Dizini
Tüm test dosyaları `tests/` klasöründe bulunur:
```bash
tests/
  ├── test-phase3.js              # Ana entegrasyon testi
  ├── comprehensive-test.js       # Kapsamlı test
  └── test-balance-scenarios.js   # Bakiye senaryoları testi
```

### Entegrasyon Testi (Önerilen)
Bot'un tüm fonksiyonlarını test eder:
```bash
npm test
```

Test edilen özellikler:
- ✅ Bot initialization
- ✅ WebSocket bağlantıları (BTCTurk & Binance)
- ✅ Bakiye sorgulaması
- ✅ Fiyat güncellemeleri
- ✅ Emir oluşturma
- ✅ Emir monitoring
- ✅ Çoklu parite desteği

### Diagnostic (Kurulum Sonrası)
Sistem sağlık kontrolü:
```bash
npm run diagnostic
```

Kontrol edilenler:
- ✅ Dosya yapısı ve kod tutarlılığı
- ✅ .env konfigürasyonu
- ✅ API key validasyonu
- ✅ Dependencies kontrolü
- ✅ Parite konfigürasyonları

## 🚀 Kullanım

### Parite Seçimi (3 Yöntem)

Bot çoklu parite destekler. Çalıştırmadan önce hangi parite ile işlem yapacağınızı seçin:

**1. Komut satırı parametresi (Önerilen):**
```bash
# AVAX paritesi ile çalıştır
node src/index.js AVAXUSDT

# XRP paritesi ile çalıştır
node src/index.js XRPUSDT

# SOL paritesi ile çalıştır
node src/index.js SOLUSDT
```

**2. Environment variable:**
```bash
# Windows (PowerShell)
$env:SELECTED_PAIR="AVAXUSDT"; node src/index.js

# Linux/Mac
SELECTED_PAIR=AVAXUSDT node src/index.js
```

**3. Default (İlk parite):**
```bash
# Parite belirtilmezse config.js'deki ilk parite (AVAX) kullanılır
node src/index.js
```

### Production Mode (Canlı Bot)
```bash
npm start
```

Veya parite ile:
```bash
node src/index.js XRPUSDT
```

**⚠️ UYARI:** Bu mod gerçek emirler açar! İlk kullanımda:
1. Küçük miktarlarla başlayın (örn: `AVAX_TRADE_AMOUNT=0.1`)
2. Bakiyelerinizi kontrol edin
3. Log dosyalarını izleyin (`logs/` klasörü)
4. İlk birkaç işlemi yakından takip edin
5. DRY_RUN=true ile önce test edin

### Development Mode (Geliştirme)
```bash
npm run dev
```
Auto-reload özelliği ile çalışır (nodemon).

### Dry Run Mode (Test - Gerçek Emir Girmez)
`.env` dosyasında:
```env
DRY_RUN=true
```
Sonra çalıştırın:
```bash
npm start
```
Bot çalışır, fiyatları izler, karlılık hesaplar ama **gerçek emir girmez**. Test için idealdir.

## 📁 Proje Yapısı

```
SHBOT/
├── src/
│   ├── bot/
│   │   ├── ArbitrageBot.js          # Ana bot mantığı (çoklu parite)
│   │   ├── ArbitrageEngine.js       # Arbitraj hesaplamaları + volatilite sistemi
│   │   └── test-*.js                # Bot testleri
│   ├── exchanges/
│   │   ├── BTCTurkClient.js         # BTCTurk API client
│   │   ├── BinanceClient.js         # Binance API client
│   │   └── test-*.js                # Exchange testleri
│   ├── utils/
│   │   ├── logger.js                # Winston logger
│   │   ├── precision.js             # Precision yardımcıları
│   │   └── NotificationService.js   # Telegram bildirimleri (opsiyonel)
│   ├── config/
│   │   └── config.js                # Merkezi konfigürasyon (çoklu parite tanımları)
│   └── index.js                     # Entry point (parite seçimi)
├── tests/                           # Test dosyaları
│   ├── test-phase3.js               # Ana entegrasyon testi
│   ├── comprehensive-test.js        # Kapsamlı test
│   └── test-balance-scenarios.js    # Bakiye senaryoları
├── logs/                            # Log dosyaları (otomatik)
├── diagnostic.js                    # Sistem sağlık kontrolü
├── .env                             # Environment variables (GİZLİ)
├── .env.example                     # Environment template
├── package.json
├── PRD.md                           # Product Requirements Document
├── MULTI-PAIR-UPGRADE.md            # Çoklu parite upgrade guide
├── STRATEGY_CHANGE.md               # Market maker strateji değişikliği
├── ARBITRAGE_OPTIMIZATION_REPORT.md # Optimizasyon raporu
└── README.md
```

## 📊 Faz Durumu

- ✅ **Faz 1**: Altyapı ve Bağlantı Kurulumu (TAMAMLANDI - 27 Ekim 2025)
  - BTCTurk/Binance REST API ve WebSocket entegrasyonları
  - Logger ve config sistemleri
- ✅ **Faz 2**: Arbitraj Motoru Geliştirme (TAMAMLANDI - 27 Ekim 2025)
  - Karlılık hesaplama algoritmaları
  - Emir fiyat hesaplama
  - Bakiye ve pozisyon yönetimi
- ✅ **Faz 3**: Bot Mantığı ve Sürekli Açık Emir Stratejisi (TAMAMLANDI - 27 Ekim 2025)
  - Market maker stratejisi implementasyonu
  - Dinamik emir güncelleme
  - Counter order sistemi
- ✅ **Faz 3.5**: Market Maker Moduna Geçiş (TAMAMLANDI - 28 Ekim 2025)
  - Spread kontrolü kaldırıldı
  - Sürekli açık emir stratejisi optimize edildi
- ✅ **Faz 4**: Çoklu Parite Desteği (TAMAMLANDI - 29 Ekim 2025)
  - AVAX, XRP, SOL parite desteği
  - Dinamik parite seçimi
  - Parite bazlı konfigürasyon
- ✅ **Faz 5**: Volatilite ve Optimizasyon Sistemi (TAMAMLANDI - 29 Ekim 2025)
  - Dinamik volatilite hesaplama
  - Slippage tahmin mekanizması
  - Order book derinlik analizi
- 🔄 **Faz 6**: Hata Yönetimi ve Güvenlik (KISMEN TAMAMLANDI)
  - ✅ Rate limiting ve auto-retry
  - ✅ WebSocket reconnection
  - ✅ Graceful shutdown
  - ⏳ Advanced monitoring (devam ediyor)
- ⏳ **Faz 7**: Testing ve Production Deployment (PLANLAMA)
- ⏳ **Faz 8**: Gelişmiş Özellikler (OPSIYONEL)

## 🔍 Sorun Giderme

### Bot başlamıyor
```bash
npm run diagnostic
```
Sistem kontrolü yapın ve hataları düzeltin. Özellikle:
- ✅ .env dosyası var mı?
- ✅ API key'ler doğru mu?
- ✅ Parite konfigürasyonları tanımlı mı?

### "Parite bulunamadı" hatası
```bash
# Mevcut pariteleri listeleyin
node src/index.js
```
Çıktıda kullanılabilir pariteler görünür. Sadece bunlardan birini seçin:
- AVAXUSDT
- XRPUSDT
- SOLUSDT

Yeni parite eklemek için `src/config/config.js` dosyasını düzenleyin.

### WebSocket bağlantı hatası
- İnternet bağlantınızı kontrol edin
- Firewall ayarlarını kontrol edin
- API endpoints erişilebilir mi kontrol edin
- Log dosyalarını kontrol edin: `logs/error.log`

### Emir oluşturulmuyor
- Bakiye kontrolü yapın (yeterli coin ve USDT var mı?)
  - `AVAX`: ~0.5 AVAX + 10 USDT (her iki borsada)
  - `XRP`: ~10 XRP + 10 USDT (her iki borsada)
  - `SOL`: ~0.05 SOL + 10 USDT (her iki borsada)
- API key'lerin **trade yetkisi** var mı kontrol edin
- Log dosyalarını inceleyin: `logs/combined.log`
- DRY_RUN=false olduğundan emin olun (canlı emir için)

### Fiyat güncellenmiyor
- WebSocket bağlantısını kontrol edin
- PRICE_UPDATE_THRESHOLD değerini kontrol edin (örn: `AVAX_UPDATE_THRESHOLD=0.15`)
- Çok yüksek threshold fiyat güncellemelerini engelleyebilir

### "Bakiye yetersiz" hatası
- Her iki borsada da yeterli bakiye olmalı
- Minimum bakiyeler:
  - BTCTurk: Trade amount + 10 USDT
  - Binance: Trade amount + 10 USDT
- Locked (emirlerde kilitli) bakiyeler hesaba katılır

## 📝 Loglar

Tüm aktiviteler `logs/` klasöründe kaydedilir:
- `combined.log`: Tüm loglar (info, warn, error)
- `error.log`: Sadece hatalar

### Log Seviyeleri:
- `error`: Kritik hatalar (API hataları, bağlantı sorunları)
- `warn`: Uyarılar (yetersiz bakiye, rate limit)
- `info`: Genel bilgi (emir açma, fiyat güncellemeleri) - **varsayılan**
- `debug`: Detaylı debug bilgisi (tüm hesaplamalar)
- `api`: API çağrıları (performans ölçümü)

### Log Seviyesi Değiştirme:
`.env` dosyasında:
```env
LOG_LEVEL=debug  # Daha detaylı loglar için
LOG_LEVEL=info   # Normal kullanım (önerilen)
LOG_LEVEL=warn   # Sadece önemli uyarılar
```

### Log Örnekleri:
```
2025-10-30 15:30:45 [info]: 🚀 Bot başlatılıyor... {"pair":"AVAXUSDT"}
2025-10-30 15:30:46 [info]: ✅ BTCTurk API bağlantısı başarılı
2025-10-30 15:30:47 [info]: 📊 Fiyat güncellendi {"btcturk":{"bid":25.14,"ask":25.16},"binance":{"bid":25.15,"ask":25.16}}
2025-10-30 15:30:50 [info]: 🆕 Yeni emir oluşturuldu {"side":"SELL","price":25.20,"amount":0.5}
2025-10-30 15:31:25 [info]: ✅ Emir doldu! Counter order başlatılıyor...
```

## 🛡️ Güvenlik

### API Key Yönetimi
- API key'lerinizi **ASLA** paylaşmayın veya public repo'ya commit etmeyin
- `.env` dosyası `.gitignore`'da olduğundan emin olun
- API key'lere sadece **gerekli yetkiler** verin:
  - **BTCTurk**: Trade, View Balance (Withdraw yetkisi vermeyin!)
  - **Binance**: Spot Trading, Read (Withdraw yetkisi vermeyin!)

### Önerilen Güvenlik Ayarları
```env
# BTCTurk API
# ✅ Trade + View Balance YETKİLERİ
# ❌ Withdraw YETKİSİ VERME!

# Binance API
# ✅ Enable Spot & Margin Trading
# ✅ Enable Reading
# ❌ Enable Withdrawals - KAPALI TUTUN!
```

### IP Whitelist (Önerilen)
- BTCTurk ve Binance'te API key'lerinize **IP whitelist** ekleyin
- Sadece botun çalıştığı sunucunun IP'sini ekleyin
- Bu sayede başkaları key'inizi ele geçirse bile kullanamaz

### 2FA (İki Faktörlü Doğrulama)
- Borsa hesaplarınızda **mutlaka 2FA** aktif olsun
- Google Authenticator veya Authy kullanın
- Yedek kodları güvenli bir yerde saklayın

## ⚠️ Riskler ve Sorumluluk Reddi

### Finansal Riskler
- Kripto para ticareti **yüksek risklidir** ve sermaye kaybına yol açabilir
- Bot otomatik işlem yapar - **kayıp riski** vardır
- Market volatilitesi, slippage, ve ani fiyat hareketleri zarar oluşturabilir
- **Kaybetmeyi göze alabileceğiniz** miktarlarla başlayın

### Teknik Riskler
- API bağlantı sorunları, WebSocket kesintileri emir yönetimini etkileyebilir
- Network gecikmeleri arbitraj fırsatlarını kaçırabilir veya slippage artırabilir
- Bot hataları veya bug'lar beklenmedik sonuçlara yol açabilir
- Exchange downtime veya maintenance botun çalışmasını durdurabilir

### Operasyonel Riskler
- Konfigürasyon hataları (yanlış trade amount, threshold vb.) zarara yol açabilir
- Yetersiz bakiye emirlerin gerçekleşmemesine neden olur
- API rate limiting botun geçici olarak bloke edilmesine yol açabilir

### Öneriler
1. **İlk kullanımda:**
   - ✅ DRY_RUN=true ile başlayın (gerçek emir girmeden test)
   - ✅ Çok küçük miktarlarla başlayın (örn: AVAX_TRADE_AMOUNT=0.1)
   - ✅ İlk 24 saati yakından takip edin
   - ✅ Log dosyalarını sürekli kontrol edin

2. **Risk yönetimi:**
   - ✅ Trade amount'ları muhafazakar tutun (toplam bakiyenizin max %10'u)
   - ✅ MAX_DAILY_LOSS limiti ayarlayın
   - ✅ Düzenli olarak karlılığı izleyin
   - ✅ Beklenmedik durumlar için stop-loss stratejisi planlayın

3. **Monitoring:**
   - ✅ Telegram bildirimleri aktif edin
   - ✅ Log dosyalarını günlük kontrol edin
   - ✅ Bakiyeleri düzenli kontrol edin

### Sorumluluk Reddi
⚠️ **BU BOT EĞİTİM AMAÇLIDIR**

- Bu yazılım "olduğu gibi" sağlanır, hiçbir garanti verilmez
- Yazılımın kullanımından doğan tüm sorumluluk kullanıcıya aittir
- Geliştirici(ler) hiçbir maddi veya manevi zarardan sorumlu tutulamaz
- Kullanım tamamen kendi riskinizedir
- Profesyonel finansal tavsiye değildir

**KULLANMADAN ÖNCE:**
- Kodu tamamen anlayın
- Küçük miktarlarla test edin
- Kaybetmeyi göze alabileceğiniz miktarlarla çalışın
- Sorumluluğun size ait olduğunu kabul edin

## 🎯 Strateji: Market Maker (Sürekli Açık Emir)

Bot gelişmiş bir **Market Maker** stratejisi kullanır:

### Çalışma Akışı

1. **İlk Emir Açma**: 
   - Bot başlatıldığında seçili parite için BTCTurk'te limit emir açar (BUY veya SELL)
   - Emir fiyatı **her zaman karlı** olacak şekilde hesaplanır (fee + kar + buffer dahil)
   - Spread negatif olsa bile emir açılır (çünkü fiyat zaten karlı)

2. **Sürekli Monitoring**:
   - Emir durumu sürekli izlenir (1 saniyede bir)
   - Binance fiyatları gerçek zamanlı takip edilir

3. **Dinamik Fiyat Güncelleme**:
   - Binance fiyatı %0.2+ (threshold) değişirse emir iptal edilip yeni fiyattan açılır
   - Bu sayede her zaman piyasaya uygun fiyattan emir bekler

4. **Emir Dolduğunda**:
   - BTCTurk emri dolunca anında Binance'te counter order (market) yapılır
   - Kar realize edilir
   - 1 saniye sonra otomatik yeni emir açılır
   - Döngü devam eder

5. **Dinamik Volatilite Sistemi** (Opsiyonel):
   - `DYNAMIC_SPREAD=true` yapıldığında volatiliteye göre spread ayarlanır
   - Yüksek volatilite → Geniş spread (risk yönetimi)
   - Düşük volatilite → Dar spread (daha fazla fırsat)

### Avantajlar
- ✅ Transfer gerektirmez (her iki borsada bakiye var)
- ✅ Sürekli piyasada emir var (pasif gelir)
- ✅ Market maker gibi davranır (maker fee avantajı)
- ✅ Spread'den ve fiyat hareketlerinden kazanç
- ✅ Volatiliteye göre otomatik optimizasyon

### Dezavantajlar
- ⚠️ Her iki borsada yeterli bakiye gerekir
- ⚠️ Emir uzun süre dolmayabilir (fiyat o seviyeye gelmezse)
- ⚠️ Market volatilitesine duyarlı
- ⚠️ Fee'ler karı azaltır (%0.18 toplam fee)

## 📞 Destek ve Dokümantasyon

### Sorun Yaşıyorsanız:
1. **Diagnostic çalıştırın:**
   ```bash
   npm run diagnostic
   ```
   
2. **Log dosyalarını inceleyin:**
   ```bash
   # Windows PowerShell
   Get-Content logs/error.log -Tail 50
   
   # Linux/Mac
   tail -n 50 logs/error.log
   ```

3. **Test scriptlerini çalıştırın:**
   ```bash
   npm test
   ```

4. **Dokümantasyona bakın:**
   - `PRD.md` - Detaylı product requirements
   - `STRATEGY_CHANGE.md` - Market maker stratejisi açıklaması
   - `MULTI-PAIR-UPGRADE.md` - Çoklu parite sistemi rehberi
   - `ARBITRAGE_OPTIMIZATION_REPORT.md` - Optimizasyon raporu
   - `PHASE3_REPORT.md` - Faz 3 tamamlanma raporu

### Sık Sorulan Sorular (FAQ)

**S: Hangi parite ile başlamalıyım?**
A: XRP/USDT ile başlamanızı öneriyoruz (düşük maliyetli, yüksek likidite). AVAX ve SOL daha yüksek volatilite ve potansiyel kar sunar ama risk de yüksektir.

**S: Minimum ne kadar sermaye gerekir?**
A: Her iki borsada toplam ~$30-50 başlangıç için yeterli (XRP için). AVAX/SOL için ~$20-30 her borsada.

**S: Bot ne kadar kar eder?**
A: Piyasa koşullarına bağlı. Günlük %0.1-0.5 gerçekçi hedefler. Garanti yoktur.

**S: Bot 7/24 çalışmalı mı?**
A: Evet, arbitraj fırsatları herhangi bir zamanda ortaya çıkabilir. VPS kullanmanız önerilir.

**S: Telegram bildirimleri nasıl aktif edilir?**
A: `.env` dosyasında `TELEGRAM_ENABLED=true` yapın ve bot token + chat ID ekleyin. Detaylar için `src/utils/NotificationService.js` dosyasına bakın.

**S: Birden fazla parite aynı anda çalıştırabilir miyim?**
A: Şu an tek instance bir parite destekliyor. Birden fazla parite için ayrı botlar (farklı klasörlerde) çalıştırın.

## 🚀 Gelecek Özellikler (Roadmap)

- [ ] Multi-instance support (aynı anda birden fazla parite)
- [ ] Web dashboard (gerçek zamanlı monitoring)
- [ ] Advanced risk management (stop-loss, trailing stop)
- [ ] Machine learning fiyat tahmini
- [ ] Daha fazla exchange desteği (Kraken, Coinbase vb.)
- [ ] Backtesting framework
- [ ] Performance analytics dashboard

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen:
1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add some amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📝 License

MIT License - Detaylar için LICENSE dosyasına bakın.

---

## 📊 Proje İstatistikleri

- **İlk Release:** 27 Ekim 2025
- **Desteklenen Pariteler:** 3 (AVAX, XRP, SOL) - daha fazla eklenebilir
- **Toplam Kod Satırı:** ~5000+ satır
- **Test Coverage:** Manuel testler (automated test suite geliştirme aşamasında)
- **Durum:** Production-ready (gerçek emir test edilmeli)

---

**Son Güncelleme:** 30 Ekim 2025  
**Versiyon:** 2.0.0 (Çoklu Parite + Market Maker Stratejisi)  
**Geliştirici:** SHBOT Team  

---

### 🎯 Hızlı Başlangıç Özeti

```bash
# 1. Repo'yu klonla
git clone https://github.com/vhurkus/SHBOT.git
cd SHBOT

# 2. Dependencies yükle
npm install

# 3. Environment ayarla
cp .env.example .env
# .env dosyasını düzenle (API keys ekle)

# 4. Sistem kontrolü
npm run diagnostic

# 5. Test çalıştır (opsiyonel)
npm test

# 6. Dry-run ile test et
# .env: DRY_RUN=true
npm start

# 7. Canlı başlat (küçük miktarlarla!)
# .env: DRY_RUN=false, AVAX_TRADE_AMOUNT=0.1
node src/index.js AVAXUSDT
```

**⚠️ ÖNEMLİ:** İlk kullanımda mutlaka DRY_RUN=true ile test edin!

---

🌟 **Başarılı trading dileriz!** 🌟
