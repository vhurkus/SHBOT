# SHBOT - Cross-Exchange Arbitrage Bot

BTCTurk ve Binance borsaları arasında otomatik arbitraj işlemi yapan bot.

## 🚀 Özellikler

- WebSocket ile gerçek zamanlı fiyat takibi
- BTCTurk'te otomatik limit emir açma
- Binance'te market emir yürütme
- Piyasa değişimlerine göre dinamik emir fiyat güncelleme
- Transfer gerektirmeyen sürekli arbitraj döngüsü
- Kapsamlı loglama ve hata yönetimi
- **Faz 3: Sürekli Açık Emir Stratejisi** tamamlandı!

## 📋 Gereksinimler

- Node.js v18 veya üzeri
- BTCTurk API credentials
- Binance API credentials
- Her iki borsada minimum bakiye (XRP ve USDT)

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
- Trading parametreleri (opsiyonel, varsayılanlar kullanılabilir)

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

### Trading Parametreleri
```env
TRADE_AMOUNT=10              # İşlem miktarı (XRP)
MIN_PROFIT_PERCENT=0.1       # Minimum kar hedefi (%)
MIN_SPREAD_PERCENT=0.3       # Minimum spread (%)
PRICE_UPDATE_THRESHOLD=0.2   # Fiyat değişim eşiği (%)
```

### Fee'ler
```env
BTCTURK_MAKER_FEE=0.0008    # %0.08
BTCTURK_TAKER_FEE=0.0012    # %0.12
BINANCE_MAKER_FEE=0.001     # %0.10
BINANCE_TAKER_FEE=0.001     # %0.10
```

## 🧪 Test

### Faz 3 Test (Önerilen)
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

### Diagnostic (Kurulum Sonrası)
Sistem sağlık kontrolü:
```bash
npm run diagnostic
```

## 🚀 Kullanım

### Production Mode (Canlı Bot)
```bash
npm start
```

**⚠️ UYARI:** Bu mod gerçek emirler açar! İlk kullanımda:
1. Küçük miktarlarla başlayın (TRADE_AMOUNT=5)
2. Bakiyelerinizi kontrol edin
3. Log dosyalarını izleyin (logs/ klasörü)
4. İlk birkaç işlemi yakından takip edin

### Development Mode (Geliştirme)
```bash
npm run dev
```
Auto-reload özelliği ile çalışır.

### Dry Run Mode (Test - Gerçek Emir Girmez)
`.env` dosyasında:
```env
DRY_RUN=true
```
Bot çalışır ama gerçek emir girmez.

## 📁 Proje Yapısı

```
SHBOT/
├── src/
│   ├── bot/
│   │   ├── ArbitrageBot.js       # Ana bot mantığı
│   │   ├── ArbitrageEngine.js    # Arbitraj hesaplamaları
│   │   └── test-*.js             # Test dosyaları
│   ├── exchanges/
│   │   ├── BTCTurkClient.js      # BTCTurk API client
│   │   ├── BinanceClient.js      # Binance API client
│   │   └── test-*.js             # Exchange testleri
│   ├── utils/
│   │   └── logger.js             # Winston logger
│   ├── config/
│   │   └── config.js             # Merkezi konfigürasyon
│   └── index.js                  # Entry point
├── logs/                         # Log dosyaları (otomatik)
├── tests/                        # Test dosyaları
├── diagnostic.js                 # Sistem sağlık kontrolü
├── test-phase3.js                # Faz 3 entegrasyon testi
├── .env                          # Environment variables (GİZLİ)
├── .env.example                  # Environment template
├── package.json
├── PRD.md                        # Product Requirements
└── README.md
```

## 📊 Faz Durumu

- ✅ **Faz 1**: Altyapı ve Bağlantı Kurulumu (TAMAMLANDI)
- ✅ **Faz 2**: Arbitraj Motoru Geliştirme (TAMAMLANDI)
- ✅ **Faz 3**: Bot Mantığı ve Sürekli Açık Emir Stratejisi (TAMAMLANDI)
- ⏳ **Faz 4**: Hata Yönetimi ve Recovery (GELİŞTİRME)
- ⏳ **Faz 5**: Monitoring ve Reporting (PLANLAMA)
- ⏳ **Faz 6**: Testing (PLANLAMA)
- ⏳ **Faz 7**: Deployment (PLANLAMA)

## 🔍 Sorun Giderme

### Bot başlamıyor
```bash
npm run diagnostic
```
Sistem kontrolü yapın ve hataları düzeltin.

### WebSocket bağlantı hatası
- İnternet bağlantınızı kontrol edin
- Firewall ayarlarını kontrol edin
- API endpoints erişilebilir mi kontrol edin

### Emir oluşturulmuyor
- Bakiye kontrolü yapın (yeterli XRP ve USDT var mı?)
- API key'lerin trade yetkisi var mı kontrol edin
- Log dosyalarını inceleyin: `logs/combined.log`

### Fiyat güncellenmiyor
- WebSocket bağlantısını kontrol edin
- PRICE_UPDATE_THRESHOLD çok yüksek olabilir (0.2 olmalı)

## 📝 Loglar

Tüm aktiviteler `logs/` klasöründe kaydedilir:
- `combined.log`: Tüm loglar
- `error.log`: Sadece hatalar

Log seviyeleri:
- `error`: Kritik hatalar
- `warn`: Uyarılar
- `info`: Genel bilgi (varsayılan)
- `debug`: Detaylı debug bilgisi

## 🛡️ Güvenlik

- API key'lerinizi **ASLA** paylaşmayın
- `.env` dosyası git'e commit edilmez (.gitignore'da)
- API key'lere sadece gerekli yetkiler verin:
  - BTCTurk: Trade, View Balance
  - Binance: Spot Trading, Read

## ⚠️ Riskler ve Sorumluluk Reddi

- Kripto para ticareti **risklidir**
- Bot otomatik işlem yapar - **kayıp riski** vardır
- **Küçük miktarlarla** test edin
- Sorumuluk size aittir
- Bu bot eğitim amaçlıdır

## 🎯 Stratejı: Sürekli Açık Emir (Continuous Open Order)

Bot şu stratejiyi kullanır:

1. **İlk Emir**: BTCTurk'te limit emir açar (BUY veya SELL)
2. **Monitoring**: Emri sürekli izler
3. **Fiyat Değişimi**: Binance fiyatı %0.2+ değişirse emri günceller
4. **Emir Dolma**: BTCTurk emri dolunca, Binance'te market emir yapar
5. **Döngü**: Yeni emir açar, döngü devam eder

### Avantajlar
- ✅ Transfer gerektirmez
- ✅ Sürekli aktif
- ✅ Market maker gibi davranır
- ✅ Spread'den kazanç

### Dezavantajlar
- ⚠️ Her iki borsada bakiye gerekir
- ⚠️ Market volatilitesine duyarlı
- ⚠️ Fee'ler karı azaltır

## 📞 Destek

Sorun yaşarsanız:
1. `npm run diagnostic` çalıştırın
2. Log dosyalarını inceleyin
3. PRD.md dosyasına bakın
4. Test scriptlerini çalıştırın

## 📝 License

MIT

---

**Son Güncelleme**: 27 Ekim 2025  
**Durum**: Faz 3 Tamamlandı - Test Aşamasında  
**Versiyon**: 1.0.0
