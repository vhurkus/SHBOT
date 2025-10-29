# 🚀 ÇOKLU PARİTE SİSTEMİ - UPGRADE GUIDE

## ✅ TAMAMLANAN AŞAMALAR

1. ✅ **config.js** - Çoklu parite sistemi eklendi
2. ✅ **index.js** - Parite seçim sistemi eklendi

## 🔧 YAPILMASI GEREKENLER

### **ADIM 1: .env Dosyasını Güncelle**

```env
# ====================================
# AVAX Paritesi (Birincil)
# ====================================
AVAX_TRADE_AMOUNT=0.5
AVAX_MIN_PROFIT=0.05
AVAX_MIN_SPREAD=0.20
AVAX_UPDATE_THRESHOLD=0.15

# ====================================
# XRP Paritesi (İkincil)
# ====================================
XRP_TRADE_AMOUNT=10
XRP_MIN_PROFIT=0.03
XRP_MIN_SPREAD=0.15
XRP_UPDATE_THRESHOLD=0.2

# ====================================
# SOL Paritesi (Opsiyonel)
# ====================================
SOL_TRADE_AMOUNT=0.05
SOL_MIN_PROFIT=0.05
SOL_MIN_SPREAD=0.20
SOL_UPDATE_THRESHOLD=0.15
```

---

### **ADIM 2: ArbitrageBot.js Güncellemeleri**

#### **2.1 Constructor'da `pairConfig` Ekle**

```javascript
// Satır 15 civarı - constructor()
constructor(options = {}, clients = {}) {
    // ✅ YENİ: Parite config'i sakla
    this.pairConfig = options.pairConfig || null;

    // Eski kodlar devam eder...
    this.btcturk = clients.btcturk || null;
    this.binance = clients.binance || null;
    ...
}
```

#### **2.2 Hardcoded 'XRPUSDT' Değiştir**

**Bul:** `'XRPUSDT'` (11 yer)
**Değiştir:** `this.pairConfig.symbol`

**Örnekler:**

```javascript
// Satır 212 - testConnections()
❌ const btcturkTest = await this.btcturk.getTicker24h('XRPUSDT');
✅ const btcturkTest = await this.btcturk.getTicker24h(this.pairConfig.symbol);

// Satır 309 - setupWebSockets()
❌ await this.btcturk.connectWebSocket(callback, 'XRPUSDT');
✅ await this.btcturk.connectWebSocket(callback, this.pairConfig.symbol);

// Satır 540 - checkOpenOrders()
❌ const btcturkOrders = await this.btcturk.getOpenOrders('XRPUSDT');
✅ const btcturkOrders = await this.btcturk.getOpenOrders(this.pairConfig.symbol);

// Satır 778, 796, 952, 1135 - createMarketOrder(), createOrder()
❌ symbol: 'XRPUSDT',
✅ symbol: this.pairConfig.symbol,
```

#### **2.3 Dinamik Bakiye Referansları**

**Bul:** `.XRP` (bakiye referansları)
**Değiştir:** `[this.pairConfig.baseCoin]`

```javascript
// Örnek: Satır 247 - updateBalances()
❌ this.balances.btcturk = { XRP: btcturkXRPFree, USDT: btcturkUSDTFree, ... };
✅ this.balances.btcturk = {
    [this.pairConfig.baseCoin]: btcturkXRPFree,  // AVAX veya XRP
    USDT: btcturkUSDTFree,
    ...
};

// Satır 934 - createNewOrder()
❌ if (balances.btcturk.XRP < this.engine.tradeAmount) {
✅ if (balances.btcturk[this.pairConfig.baseCoin] < this.engine.tradeAmount) {
```

---

### **ADIM 3: ArbitrageEngine.js Güncellemeleri**

#### **3.1 Constructor'da `pairConfig` Ekle**

```javascript
// Satır 11 - constructor()
constructor(options = {}) {
    // ✅ YENİ: Parite config'i sakla
    this.pairConfig = options.pairConfig;

    // Eski kodlar...
    this.fees = { ... };
    this.tradeAmount = options.tradeAmount || this.pairConfig.tradeAmount;
    ...
}
```

#### **3.2 Hardcoded 'XRPUSDT' Değiştir**

**Bul:** `'XRPUSDT'` (5 yer)
**Değiştir:** `this.pairConfig.symbol`

```javascript
// Satır 371, 392, 409 - calculateExpectedSlippage()
❌ const orderBook = await binanceClient.getOrderBook('XRPUSDT', 20);
✅ const orderBook = await binanceClient.getOrderBook(this.pairConfig.symbol, 20);
```

#### **3.3 Dinamik Coin Referansları**

**Bul:** `XRP` (bakiye referansları)
**Değiştir:** `this.pairConfig.baseCoin`

```javascript
// Satır 1209 - determineScenario()
❌ const btcturkXRP = balances.btcturk.XRP;
❌ const binanceXRP = balances.binance.XRP;
✅ const baseCoin = this.pairConfig.baseCoin;
✅ const btcturkBase = balances.btcturk[baseCoin];
✅ const binanceBase = balances.binance[baseCoin];
```

#### **3.4 Precision Fonksiyonları Dinamik Yap**

**Bul:** Hardcoded `0.1` (XRP stepSize)
**Değiştir:** `this.pairConfig.binance.stepSize`

```javascript
// Satır 1287, 1314 - roundToBinanceLOT_SIZE()
❌ amount: roundToBinanceLOT_SIZE(tradeAmount, 0.1),
✅ amount: roundToBinanceLOT_SIZE(tradeAmount, this.pairConfig.binance.stepSize),
```

---

### **ADIM 4: precision.js Güncellemesi (GEREKMİYOR)**

✅ `precision.js` zaten dinamik, parametre alıyor. Değişiklik gerekmez!

---

## 🚀 NASIL KULLANILIR?

### **1. Config'i Kontrol Et**

```bash
node -e "import('./src/config/config.js').then(m => m.printConfig())"
```

### **2. AVAX ile Başlat (Default)**

```bash
# Yöntem 1: Komut satırı
node src/index.js AVAXUSDT

# Yöntem 2: Environment variable
SELECTED_PAIR=AVAXUSDT node src/index.js

# Yöntem 3: Default (AVAX)
node src/index.js
```

### **3. XRP ile Başlat**

```bash
node src/index.js XRPUSDT
```

### **4. SOL ile Başlat**

```bash
node src/index.js SOLUSDT
```

### **5. Yeni Coin Ekle (Örn: BTC)**

**config.js'e ekle:**

```javascript
// src/config/config.js - pairs array'e ekle
{
    symbol: 'BTCUSDT',
    baseCoin: 'BTC',
    quoteCoin: 'USDT',
    tradeAmount: 0.0001,  // 0.0001 BTC (~$11)
    minProfit: 0.05,
    minSpread: 0.20,
    priceUpdateThreshold: 0.15,

    binance: {
        stepSize: 0.00001,
        tickSize: 0.01,
        minQty: 0.00001,
        maxQty: 9000
    },

    btcturk: {
        numeratorScale: 5,  // 0.00100 BTC
        denominatorScale: 0  // 112751 TRY (tam sayı)
    }
}
```

**.env'e ekle:**

```env
BTC_TRADE_AMOUNT=0.0001
BTC_MIN_PROFIT=0.05
BTC_MIN_SPREAD=0.20
BTC_UPDATE_THRESHOLD=0.15
```

**Başlat:**

```bash
node src/index.js BTCUSDT
```

---

## 🔍 HIZLI ARAMA REHBERİ

### **ArbitrageBot.js'te Değiştirilecekler**

```bash
# Hardcoded XRPUSDT bul
grep -n "'XRPUSDT'" src/bot/ArbitrageBot.js

# Bakiye XRP referansları bul
grep -n "\.XRP" src/bot/ArbitrageBot.js

# Toplam: ~20 satır değişiklik
```

### **ArbitrageEngine.js'te Değiştirilecekler**

```bash
# Hardcoded XRPUSDT bul
grep -n "'XRPUSDT'" src/bot/ArbitrageEngine.js

# XRP referansları bul
grep -n "XRP" src/bot/ArbitrageEngine.js | grep -v "// "

# Hardcoded 0.1 (stepSize) bul
grep -n "0\.1" src/bot/ArbitrageEngine.js

# Toplam: ~15 satır değişiklik
```

---

## ⚠️ ÖNEMLİ NOTLAR

1. **Geriye Uyumluluk:** Eski kod çalışmaya devam edecek (config.trading.symbol hala XRP döner)
2. **Test:** Önce DRY_RUN=true ile test et
3. **Bakiye:** Her coin için ayrı bakiye gerekli (AVAX + XRP + SOL)
4. **Precision:** Her coin'in kendi precision ayarları var

---

## 📊 ÖZellİKLER

✅ Sınırsız parite desteği
✅ Kolay coin ekleme (config.js'e yeni object)
✅ Komut satırı ile parite seçimi
✅ Her coin için özel ayarlar (trade amount, kar hedefi, vb.)
✅ Dinamik precision (her coin'e göre)
✅ Geriye uyumlu (eski kod çalışır)

---

## 🎉 SONUÇ

Config ve index.js hazır! Sadece 2 dosyada ~35 satır değişiklik yapman yeterli:

1. **ArbitrageBot.js:** ~20 satır (constructor + hardcoded XRPUSDT + bakiye refs)
2. **ArbitrageEngine.js:** ~15 satır (constructor + hardcoded XRPUSDT + coin refs)

**Toplam süre:** 30-45 dakika ⏱️

**Sonuç:** İstediğin coini 2 dakikada ekle! 🚀
