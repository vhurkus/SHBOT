/**
 * ArbitrageBot - Ana Bot Mantığı
 * BTCTurk ve Binance arasında arbitraj işlemleri yapan bot
 */

import logger from '../utils/logger.js';
import config from '../config/config.js';
import BTCTurkClient from '../exchanges/BTCTurkClient.js';
import BinanceClient from '../exchanges/BinanceClient.js';
import ArbitrageEngine from './ArbitrageEngine.js';
import { roundToBinanceLOT_SIZE, roundToBTCTurkScale } from '../utils/precision.js';
import notificationService from '../utils/NotificationService.js';

class ArbitrageBot {
    constructor(options = {}, clients = {}) {
        // ✅ ÇOKLU PARİTE DESTEĞİ: Parite config'i sakla
        this.pairConfig = options.pairConfig || null;

        if (!this.pairConfig) {
            throw new Error('❌ pairConfig gerekli! options.pairConfig parametresi eksik.');
        }

        // Exchange clients
        this.btcturk = clients.btcturk || null;
        this.binance = clients.binance || null;

        // Arbitrage engine
        this.engine = null;

        // Bot durumu
        this.isRunning = false;
        this.isInitialized = false;
        
        // Fiyat state
        this.prices = {
            btcturk: {
                bid: null,
                ask: null,
                last: null,
                timestamp: null
            },
            binance: {
                bid: null,
                ask: null,
                last: null,
                timestamp: null
            }
        };
        
        // Bakiye state (dinamik coin desteği)
        const baseCoin = this.pairConfig.baseCoin;
        this.balances = {
            btcturk: {
                [baseCoin]: 0,
                USDT: 0,
                [`locked${baseCoin}`]: 0,
                lockedUSDT: 0,
                [`total${baseCoin}`]: 0,
                totalUSDT: 0
            },
            binance: {
                [baseCoin]: 0,
                USDT: 0,
                [`locked${baseCoin}`]: 0,
                lockedUSDT: 0,
                [`total${baseCoin}`]: 0,
                totalUSDT: 0
            }
        };
        
        // Aktif emir state
        this.currentOrder = {
            active: false,
            txId: null,          // Task 5.1: Transaction ID
            exchange: null,
            orderId: null,
            side: null,
            price: null,
            amount: null,
            scenario: null,
            timestamp: null,
            expectedProfit: null, // Task 5.2: Beklenen kar
            lastBinancePrice: null
        };

        // Task 5.2: Performance Metrics
        this.metrics = {
            totalProfit: 0,
            tradesSucceeded: 0,
            tradesFailed: 0,
            startTime: Date.now()
        };
        
        // Emir güncelleme lock flag (race condition önleme)
        this.isUpdatingOrder = false;

        // ✅ DÜZELTME: Throttling için
        this.lastOrderAttemptTime = 0;
        this.orderAttemptCooldown = 5000; // 5 saniye (her 5 saniyede bir deneme)

        // Debug için
        this.lastPriceCheckLog = 0;
        
        // FAZ 1: Fiyat geçmişi tracking (volatilite hesaplama için)
        this.priceHistory = [];
        this.maxPriceHistorySize = 100; // Son 100 fiyat
        this.volatilityUpdateCounter = 0; // Her 10 fiyat güncellemesinde volatilite hesapla
        
        // Monitoring intervals
        this.intervals = {
            balanceUpdate: null,
            orderMonitoring: null,
            priceUpdate: null
        };
        
        // Konfigürasyon - pairConfig'den alınıyor
        this.config = {
            symbol: this.pairConfig.symbol,
            baseCoin: this.pairConfig.baseCoin,
            quoteCoin: this.pairConfig.quoteCoin,
            tradeAmount: this.pairConfig.tradeAmount,
            minProfit: this.pairConfig.minProfit,
            minSpread: this.pairConfig.minSpread,
            balanceUpdateInterval: options.balanceUpdateInterval || 30000,  // 30 saniye
            orderCheckInterval: options.orderCheckInterval || 1000,         // 1 saniye
            priceUpdateThreshold: this.pairConfig.priceUpdateThreshold
        };

        logger.info('🤖 ArbitrageBot oluşturuldu', {
            symbol: this.config.symbol,
            baseCoin: this.config.baseCoin,
            quoteCoin: this.config.quoteCoin,
            tradeAmount: this.config.tradeAmount,
            minProfit: `${this.config.minProfit}%`,
            minSpread: `${this.config.minSpread}%`
        });
    }
    
    /**
     * Bot'u başlat ve initialize et
     */
    async initialize() {
        if (this.isInitialized) {
            logger.warn('⚠️  Bot zaten initialize edilmiş');
            return true;
        }
        
        logger.info('🚀 Bot initialization başlıyor...');
        
        try {
            // 1. Exchange client'ları oluştur
            if (!this.btcturk && !this.binance) {
                logger.info('📡 Exchange client\'ları oluşturuluyor...');
                this.btcturk = new BTCTurkClient({
                    apiKey: config.btcturk.apiKey,
                    apiSecret: config.btcturk.apiSecret,
                    baseURL: config.btcturk.baseURL,
                    wsURL: config.btcturk.wsURL,
                    rateLimit: config.btcturk.rateLimit
                });

                this.binance = new BinanceClient({
                    apiKey: config.binance.apiKey,
                    apiSecret: config.binance.apiSecret,
                    baseURL: config.binance.baseURL,
                    wsURL: config.binance.wsURL,
                    rateLimit: config.binance.rateLimit
                });
            }

            // ✅ 1.5. Binance server time sync
            logger.info('🕐 Binance server time senkronize ediliyor...');
            await this.binance.syncServerTime();

            // 2. ArbitrageEngine'i oluştur - pairConfig ile
            logger.info('⚙️  ArbitrageEngine başlatılıyor...');
            this.engine = new ArbitrageEngine({
                pairConfig: this.pairConfig,  // ✅ Parite config'i gönder
                tradeAmount: this.config.tradeAmount,
                minProfit: this.config.minProfit,
                minSpread: this.config.minSpread
            });

            // 3. API bağlantı testleri
            logger.info('🔌 API bağlantıları test ediliyor...');
            await this.testConnections();
            
            // 4. İlk bakiye sorgulaması
            logger.info('💰 Bakiyeler sorgulanıyor...');
            await this.updateBalances();
            
            // 5. WebSocket bağlantıları kur
            logger.info('📊 WebSocket bağlantıları kuruluyor...');
            await this.setupWebSockets();
            
            // 6. Açık emirleri kontrol et
            logger.info('📋 Açık emirler kontrol ediliyor...');
            await this.checkOpenOrders();
            
            this.isInitialized = true;
            logger.info('✅ Bot initialization tamamlandı!');
            
            return true;
        } catch (error) {
            logger.error('❌ Bot initialization hatası', {
                error: error.message,
                stack: error.stack
            });

            // Telegram bildirimi - Initialization hatası
            notificationService.notifyInitializationError(error.message).catch(err =>
                logger.error('Telegram bildirimi gönderilemedi', { error: err.message })
            );

            throw error;
        }
    }
    
    /**
     * API bağlantı testleri
     */
    async testConnections() {
        try {
            // BTCTurk test - dinamik symbol
            const btcturkTest = await this.btcturk.getTicker24h(this.config.symbol);
            logger.info('✅ BTCTurk API bağlantısı başarılı', {
                symbol: this.config.symbol,
                last: btcturkTest.last
            });

            // Binance test - dinamik symbol
            const binanceTest = await this.binance.getTicker24h(this.config.symbol);
            logger.info('✅ Binance API bağlantısı başarılı', {
                symbol: this.config.symbol,
                lastPrice: binanceTest.lastPrice
            });
            
            return true;
        } catch (error) {
            logger.error('❌ API bağlantı testi başarısız', {
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Bakiyeleri güncelle
     */
    async updateBalances() {
        try {
            // Paralel bakiye sorgulaması
            const [btcturkResp, binanceResp] = await Promise.all([
                this.btcturk.getBalances(),
                this.binance.getBalances()
            ]);
            
            // BTCTurk response'u object olarak geldiği için direkt kullan
            // Format: { AVAX/XRP/SOL: { free, locked, total }, USDT: { free, locked, total } }
            const baseCoin = this.config.baseCoin;
            const btcturkBase = btcturkResp[baseCoin] || { free: 0, locked: 0, total: 0 };
            const btcturkUSDT = btcturkResp.USDT || { free: 0, locked: 0, total: 0 };

            // BTCTurk bakiyeleri
            const btcturkBaseFree = parseFloat(btcturkBase.free || 0);
            const btcturkBaseLocked = parseFloat(btcturkBase.locked || 0);
            const btcturkUSDTFree = parseFloat(btcturkUSDT.free || 0);
            const btcturkUSDTLocked = parseFloat(btcturkUSDT.locked || 0);

            this.balances.btcturk = {
                [baseCoin]: btcturkBaseFree,
                USDT: btcturkUSDTFree,
                [`locked${baseCoin}`]: btcturkBaseLocked,
                lockedUSDT: btcturkUSDTLocked,
                [`total${baseCoin}`]: btcturkBaseFree + btcturkBaseLocked,
                totalUSDT: btcturkUSDTFree + btcturkUSDTLocked
            };

            // Binance response'u object olarak geldiği için direkt kullan
            const binanceBase = binanceResp[baseCoin] || { free: 0, locked: 0, total: 0 };
            const binanceUSDT = binanceResp.USDT || { free: 0, locked: 0, total: 0 };

            this.balances.binance = {
                [baseCoin]: parseFloat(binanceBase.free || 0),
                USDT: parseFloat(binanceUSDT.free || 0),
                [`locked${baseCoin}`]: parseFloat(binanceBase.locked || 0),
                lockedUSDT: parseFloat(binanceUSDT.locked || 0),
                [`total${baseCoin}`]: parseFloat(binanceBase.free || 0) + parseFloat(binanceBase.locked || 0),
                totalUSDT: parseFloat(binanceUSDT.free || 0) + parseFloat(binanceUSDT.locked || 0)
            };
            
            logger.info('💼 Bakiyeler güncellendi', {
                btcturk: {
                    [baseCoin]: `${this.balances.btcturk[baseCoin].toFixed(2)} (${this.balances.btcturk[`locked${baseCoin}`].toFixed(2)} locked)`,
                    USDT: `${this.balances.btcturk.USDT.toFixed(2)} (${this.balances.btcturk.lockedUSDT.toFixed(2)} locked)`
                },
                binance: {
                    [baseCoin]: `${this.balances.binance[baseCoin].toFixed(2)} (${this.balances.binance[`locked${baseCoin}`].toFixed(2)} locked)`,
                    USDT: `${this.balances.binance.USDT.toFixed(2)} (${this.balances.binance.lockedUSDT.toFixed(2)} locked)`
                }
            });

            // Düşük bakiye kontrolü
            this.checkLowBalance();

            return this.balances;
        } catch (error) {
            logger.error('❌ Bakiye güncelleme hatası', {
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * WebSocket bağlantılarını kur
     */
    async setupWebSockets() {
        try {
            // BTCTurk WebSocket - dinamik symbol
            await this.btcturk.connectWebSocket((data) => {
                this.onBTCTurkPriceUpdate(data);
            }, this.config.symbol);

            logger.info(`✅ BTCTurk WebSocket bağlandı (${this.config.symbol})`);

            // Binance WebSocket - dinamik symbol (lowercase)
            await this.binance.connectWebSocket((data) => {
                this.onBinancePriceUpdate(data);
            });

            logger.info(`✅ Binance WebSocket bağlandı (${this.config.symbol})`);
            
            return true;
        } catch (error) {
            logger.error('❌ WebSocket kurulum hatası', {
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * BTCTurk fiyat güncellemesi callback
     */
        onBTCTurkPriceUpdate(data) {
            const newBid = parseFloat(data.bid);
            const newAsk = parseFloat(data.ask);
    
            // --- DATA VALIDATION (Task 4.5) ---
            if (isNaN(newBid) || isNaN(newAsk) || newBid <= 0 || newAsk <= 0) {
                logger.warn(`[Data Validation] BTCTurk'ten geçersiz fiyat verisi geldi (0 veya sayı değil), atlanıyor.`, { bid: data.bid, ask: data.ask });
                return;
            }
            if (newBid > newAsk) {
                logger.warn(`[Data Validation] BTCTurk'ten geçersiz fiyat verisi geldi (bid > ask), atlanıyor.`, { bid: newBid, ask: newAsk });
                return;
            }
            const threshold = config.trading.safety.priceSanityCheckThreshold;
            const oldPrice = this.prices.btcturk.ask;
            if (oldPrice && threshold > 0) {
                const changePercent = Math.abs((newAsk - oldPrice) / oldPrice) * 100;
                if (changePercent > threshold) {
                    logger.warn(`[Data Validation] BTCTurk'te anormal fiyat sıçraması tespit edildi (%${changePercent.toFixed(2)}), veri atlanıyor.`, { oldPrice, newAsk, threshold });

                    // Telegram bildirimi - Price anomaly (throttled)
                    notificationService.notifyPriceAnomaly('BTCTurk', oldPrice, newAsk, changePercent).catch(err =>
                        logger.error('Telegram bildirimi gönderilemedi', { error: err.message })
                    );

                    return;
                }
            }
            // --- END VALIDATION ---
    
            this.prices.btcturk = {
                bid: newBid,
                ask: newAsk,
                last: parseFloat(data.last),
                timestamp: Date.now()
            };
            
            this.checkArbitrageOpportunity();
        }
    
        /**
         * Binance fiyat güncellemesi callback
         */
        onBinancePriceUpdate(data) {
            const newBid = parseFloat(data.bid || data.bestBid);
            const newAsk = parseFloat(data.ask || data.bestAsk);
    
            // --- DATA VALIDATION (Task 4.5) ---
            if (isNaN(newBid) || isNaN(newAsk) || newBid <= 0 || newAsk <= 0) {
                logger.warn(`[Data Validation] Binance'ten geçersiz fiyat verisi geldi (0 veya sayı değil), atlanıyor.`, { bid: data.bid, ask: data.ask });
                return;
            }
            if (newBid > newAsk) {
                logger.warn(`[Data Validation] Binance'ten geçersiz fiyat verisi geldi (bid > ask), atlanıyor.`, { bid: newBid, ask: newAsk });
                return;
            }
            const threshold = config.trading.safety.priceSanityCheckThreshold;
            const oldPrice = this.prices.binance.ask;
            if (oldPrice && threshold > 0) {
                const changePercent = Math.abs((newAsk - oldPrice) / oldPrice) * 100;
                if (changePercent > threshold) {
                    logger.warn(`[Data Validation] Binance'te anormal fiyat sıçraması tespit edildi (%${changePercent.toFixed(2)}), veri atlanıyor.`, { oldPrice, newAsk, threshold });

                    // Telegram bildirimi - Price anomaly (throttled)
                    notificationService.notifyPriceAnomaly('Binance', oldPrice, newAsk, changePercent).catch(err =>
                        logger.error('Telegram bildirimi gönderilemedi', { error: err.message })
                    );

                    return;
                }
            }
            // --- END VALIDATION ---
    
            this.prices.binance = {
                bid: newBid,
                ask: newAsk,
                last: newAsk, // Binance bookTicker'da last yok
                timestamp: Date.now()
            };
            
            // FAZ 1: Fiyat geçmişine ekle (volatilite hesaplama için)
            this.priceHistory.push({
                timestamp: Date.now(),
                binanceBid: newBid,
                binanceAsk: newAsk
            });
            
            // Son N fiyatı tut (memory yönetimi)
            if (this.priceHistory.length > this.maxPriceHistorySize) {
                this.priceHistory.shift();
            }
            
            // FAZ 1: Her 10 güncelleme (yaklaşık 30 saniye) volatilite hesapla ve parametreleri güncelle
            this.volatilityUpdateCounter++;
            if (this.volatilityUpdateCounter >= 10) {
                this.volatilityUpdateCounter = 0;
                this.updateVolatilityBasedParameters();
            }
            
            if (this.currentOrder.active && this.currentOrder.lastBinancePrice) {
                this.checkPriceChange();
            }
            
            this.checkArbitrageOpportunity();
        }    
    
    /**
     * FAZ 1: Volatilite bazlı parametreleri güncelle
     * Her 10 fiyat güncellemesinde çağrılır (yaklaşık 30 saniye)
     */
    updateVolatilityBasedParameters() {
        try {
            // Yeterli fiyat verisi yoksa çık
            if (this.priceHistory.length < 10) {
                return;
            }
            
            // Ask fiyatlarını al (SELL senaryosu için en önemli)
            const askPrices = this.priceHistory.map(p => p.binanceAsk);
            
            // ArbitrageEngine'den dinamik parametreleri güncelle
            const result = this.engine.updateDynamicParameters(askPrices, 20);
            
            // Sadece anlamlı değişiklik varsa log
            if (result.updated) {
                logger.info('✨ Volatilite bazlı parametre güncellemesi', {
                    dataPoints: this.priceHistory.length,
                    volatility: `${result.volatility.toFixed(4)}%`,
                    newSpread: `${result.minSpread.toFixed(3)}%`,
                    newProfit: `${result.minProfit.toFixed(3)}%`
                });
            }
        } catch (error) {
            logger.error('❌ Volatilite güncelleme hatası', {
                error: error.message
            });
        }
    }
    
    /**
     * Fiyat değişimini kontrol et ve gerekirse emri güncelle
     * Sürekli açık emir stratejisi için kritik metod
     */
    checkPriceChange() {
        try {
            if (!this.currentOrder.active || !this.currentOrder.lastBinancePrice) {
                return;
            }
            
            // Emir güncelleme işlemi devam ediyorsa atla (race condition önleme)
            if (this.isUpdatingOrder) {
                return;
            }
            
            // Mevcut Binance fiyatı (senaryoya göre bid veya ask)
            // SELL senaryosu: BTCTurk'te SELL, Binance'te BUY → binance.ask kullan
            // BUY senaryosu: BTCTurk'te BUY, Binance'te SELL → binance.bid kullan
            const currentBinancePrice = this.currentOrder.scenario === 'SELL' 
                ? this.prices.binance.ask  // SELL: Binance ASK (biz alacağız)
                : this.prices.binance.bid; // BUY: Binance BID (biz satacağız)
            
            if (!currentBinancePrice) {
                return;
            }
            
            // Fiyat değişim yüzdesi
            const priceChange = Math.abs(currentBinancePrice - this.currentOrder.lastBinancePrice);
            const priceChangePercent = (priceChange / this.currentOrder.lastBinancePrice) * 100;
            
            // FAZ 3: Dinamik threshold hesapla (volatiliteye göre)
            let dynamicThreshold = this.config.priceUpdateThreshold; // Fallback sabit değer
            
            if (this.priceHistory && this.priceHistory.length >= 10) {
                // Volatilite hesapla
                const recentPrices = this.priceHistory.slice(-20).map(p => p.price);
                const volatility = this.engine.calculateVolatility(recentPrices, recentPrices.length);
                
                // Dinamik threshold al
                dynamicThreshold = this.engine.getDynamicUpdateThreshold(volatility);
            }
            
            // Threshold aşıldıysa emri güncelle
            if (priceChangePercent >= dynamicThreshold) {
                logger.info('📊 Fiyat değişimi eşiği aşıldı, emir güncelleniyor', {
                    scenario: this.currentOrder.scenario,
                    oldPrice: this.currentOrder.lastBinancePrice.toFixed(4),
                    newPrice: currentBinancePrice.toFixed(4),
                    change: `${priceChangePercent.toFixed(3)}%`,
                    threshold: `${dynamicThreshold.toFixed(3)}%`,
                    type: dynamicThreshold === this.config.priceUpdateThreshold ? 'static' : 'dynamic'
                });
                
                // Emri güncelle
                this.updateOrder();
            }
        } catch (error) {
            logger.error('❌ Fiyat değişimi kontrolü hatası', {
                error: error.message
            });
        }
    }
    
    /**
     * Açık emirleri kontrol et
     */
    async checkOpenOrders() {
        try {
            // BTCTurk açık emirleri - dinamik symbol
            const btcturkOrders = await this.btcturk.getOpenOrders(this.config.symbol);
            
            if (btcturkOrders && btcturkOrders.length > 0) {
                logger.warn('⚠️  BTCTurk\'te açık emirler var!', {
                    count: btcturkOrders.length,
                    orders: btcturkOrders.map(o => ({
                        id: o.id,
                        side: o.type,
                        price: o.price,
                        amount: o.quantity
                    }))
                });
                
                // İlk emri state'e kaydet
                const firstOrder = btcturkOrders[0];
                const scenario = firstOrder.type === 'sell' ? 'SELL' : 'BUY';
                
                const initialBinancePrice = scenario === 'SELL' ? this.prices.binance.ask : this.prices.binance.bid;
                this.currentOrder = {
                    active: true,
                    exchange: 'btcturk',
                    orderId: firstOrder.id,
                    side: firstOrder.type,
                    price: parseFloat(firstOrder.price),
                    amount: parseFloat(firstOrder.quantity),
                    scenario: scenario,
                    timestamp: Date.now(),
                    lastOrderPrice: parseFloat(firstOrder.price),
                    lastBinancePrice: initialBinancePrice, // Set from current price
                    initialBinancePrice: initialBinancePrice // Set from current price
                };
                
                // Mevcut emir için monitoring başlat
                this.startOrderMonitoring();
                
                return true; // Açık emir var
            }
            
            logger.info('✅ Açık emir yok, bot temiz durumda');
            return false; // Açık emir yok
        } catch (error) {
            logger.error('❌ Açık emir kontrolü hatası', {
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Mevcut emri iptal edip yeni fiyattan güncelle
     * Sürekli açık emir stratejisinin core metodu
     */
    async updateOrder() {
        // Zaten güncelleme işlemi devam ediyorsa atla
        if (this.isUpdatingOrder) {
            logger.debug('⏭️  Emir güncelleme zaten devam ediyor, atlandı');
            return false;
        }

        if (!this.currentOrder.active) {
            logger.warn('⚠️  Güncellenecek açık emir yok');
            return false;
        }

        // Lock'u ayarla
        this.isUpdatingOrder = true;

        try {
            logger.info('🔄 Emir güncelleme başlıyor...', {
                currentOrderId: this.currentOrder.orderId,
                currentPrice: this.currentOrder.price,
                scenario: this.currentOrder.scenario
            });

            // 1. Mevcut emri iptal et
            const cancelResult = await this.btcturk.cancelOrder(this.currentOrder.orderId);

            if (!cancelResult) {
                logger.error('❌ Emir iptali başarısız, state temizleniyor', { orderId: this.currentOrder.orderId });
                // State'i güvenli bir şekilde temizle ve çık
                this.currentOrder.active = false;
                this.currentOrder.orderId = null;
                return false;
            }

            logger.info('✅ Mevcut emir iptal edildi', {
                orderId: this.currentOrder.orderId
            });

            // State'i temizle
            this.currentOrder.active = false;
            this.currentOrder.orderId = null;

            // Kısa bir bekleme (API'nin iptali işlemesi için)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 2. Yeni emir oluştur
            const newOrderCreated = await this.createNewOrder();

            if (newOrderCreated) {
                logger.info('✅ Emir güncelleme başarılı', {
                    newOrderId: this.currentOrder.orderId,
                    newPrice: this.currentOrder.price
                });
                return true;
            } else {
                logger.warn('⚠️  Yeni emir oluşturulamadı. Bot bir sonraki döngüde tekrar deneyecek.');
                return false;
            }

        } catch (error) {
            logger.error('❌ Emir güncelleme hatası', {
                error: error.message,
                orderId: this.currentOrder.orderId
            });

            // Hata durumunda state'i güvenli bir şekilde temizle
            this.currentOrder.active = false;
            this.currentOrder.orderId = null;
            return false;

        } finally {
            // Lock'u her zaman kaldır
            this.isUpdatingOrder = false;
            logger.debug('🔄 Emir güncelleme lock serbest bırakıldı');
        }
    }
    
    /**
     * Arbitraj fırsatı kontrolü
     * Her fiyat güncellemesinde çağrılır
     *
     * ✅ DÜZELTME 28-10-2025: Throttling eklendi (infinite loop önleme)
     */
    async checkArbitrageOpportunity() {
        // Henüz her iki borsadan da fiyat gelmemişse bekle
        if (!this.prices.btcturk.bid || !this.prices.binance.bid) {
            return;
        }

        // Bot çalışmıyorsa veya initialize olmamışsa kontrol etme
        if (!this.isRunning || !this.isInitialized) {
            return;
        }

        // Aktif emir varsa yeni fırsat arama - fiyat değişimi zaten izleniyor
        if (this.currentOrder.active) {
            return;
        }

        // ✅ THROTTLING: Son deneme üzerinden yeterli süre geçmiş mi?
        const now = Date.now();
        const timeSinceLastAttempt = now - this.lastOrderAttemptTime;

        if (timeSinceLastAttempt < this.orderAttemptCooldown) {
            // Henüz erken, bekle
            return;
        }

        // ✅ Artık basit XRP kontrolü yapmıyoruz!
        // createNewOrder() içinde determineScenario() tüm bakiye kontrollerini yapacak
        // XRP yoksa ama USDT varsa hazırlık işlemi yapacak

        // Sürekli açık emir stratejisi: Aktif emir yoksa emir oluşturmayı dene
        try {
            const orderCreated = await this.createNewOrder();

            // Eğer emir oluşturma denemesi başarısız olduysa (bakiye yetersizliği, vb.),
            // bir sonraki deneme için bekleme süresini başlat.
            if (!orderCreated) {
                this.lastOrderAttemptTime = Date.now();
                logger.debug(`Emir oluşturma başarısız, ${this.orderAttemptCooldown / 1000} saniye cooldown başlatıldı.`);
            }
        } catch (error) {
            logger.error('❌ Arbitraj kontrolü sırasında beklenmedik hata', {
                error: error.message
            });
            // Beklenmedik bir hata durumunda da cooldown uygula
            this.lastOrderAttemptTime = Date.now();
        }
    }

    /**
     * Hazırlık işlemi yap (initialization trade)
     *
     * ✅ YENİ FONKSİYON 28-10-2025:
     * Bakiye durumuna göre hazırlık market emri gönder
     *
     * Durum 3: Her iki borsada da XRP yok → Binance market BUY
     * Durum 4: Her iki borsada da XRP var → Binance market SELL (boşalt)
     *
     * @param {object} scenarioInfo - determineScenario() çıktısı
     * @returns {boolean} Başarı durumu
     */
    async executePreparationTrade(scenarioInfo) {
        try {
            const { preparationType, preparationDetails } = scenarioInfo;

            logger.info('🔧 Hazırlık işlemi başlıyor:', {
                type: preparationType,
                exchange: preparationDetails.exchange,
                side: preparationDetails.side,
                amount: preparationDetails.amount,
                reason: preparationDetails.reason
            });

            // ============================================================================
            // DRY-RUN KONTROLÜ
            // ============================================================================

            if (config.advanced.dryRun) {
                logger.info('🧪 DRY-RUN MODE: Hazırlık emri simüle ediliyor (gerçek emir gönderilmiyor)', {
                    exchange: preparationDetails.exchange,
                    side: preparationDetails.side,
                    amount: preparationDetails.amount
                });

                // Simülasyon: Bakiyeleri güncelle (fake)
                if (preparationType === 'BINANCE_BUY') {
                    logger.info('✅ DRY-RUN: Binance BUY simülasyonu tamamlandı');
                    logger.info(`   → ${preparationDetails.amount} XRP Binance'e eklendi (simüle)`);
                } else if (preparationType === 'BINANCE_SELL') {
                    logger.info('✅ DRY-RUN: Binance SELL simülasyonu tamamlandı');
                    logger.info(`   → ${preparationDetails.amount} XRP Binance'ten satıldı (simüle)`);
                }

                return true; // Simülasyon başarılı
            }

            // ============================================================================
            // GERÇEK MARKET EMİR
            // ============================================================================

            if (preparationType === 'BINANCE_BUY') {
                // Binance'te market BUY
                logger.info('📤 Binance market BUY emri gönderiliyor...');

                const orderResponse = await this.binance.createMarketOrder({
                    symbol: this.config.symbol,  // Dinamik symbol
                    side: 'BUY',
                    quantity: preparationDetails.amount
                });

                logger.info('✅ Binance market BUY tamamlandı!', {
                    orderId: orderResponse.orderId,
                    executedQty: orderResponse.executedQty,
                    status: orderResponse.status
                });

                return true;

            } else if (preparationType === 'BINANCE_SELL') {
                // Binance'te market SELL (XRP'yi boşalt)
                logger.info('📤 Binance market SELL emri gönderiliyor (XRP boşaltılıyor)...');

                const orderResponse = await this.binance.createMarketOrder({
                    symbol: this.config.symbol,  // Dinamik symbol
                    side: 'SELL',
                    quantity: preparationDetails.amount
                });

                logger.info('✅ Binance market SELL tamamlandı!', {
                    orderId: orderResponse.orderId,
                    executedQty: orderResponse.executedQty,
                    status: orderResponse.status
                });

                return true;

            } else {
                logger.error('❌ Bilinmeyen hazırlık tipi:', preparationType);
                return false;
            }

        } catch (error) {
            logger.error('❌ Hazırlık işlemi hatası:', {
                error: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    /**
     * Yeni emir oluştur
     * Market Maker stratejisi: Karlı fiyattan emir aç, dolunca counter order yap
     *
     * ✅ DÜZELTME 28-10-2025:
     * - Karlılık kontrolü eklendi (engine.calculateProfitability)
     * - Doğru fiyat hesaplama (engine.calculateOrderPrice)
     * - Dry-run modu desteği eklendi
     *
     * ✅ STRATEJİ DEĞİŞİKLİĞİ 28-10-2025:
     * - Market maker moduna geçildi
     * - Spread negatif olsa bile emir açılır
     * - Emir zaten karlı fiyattan açıldığı için risk yok
     * - Fiyat o seviyeye gelirse otomatik dolacak ve karşı işlem yapılacak
     *
     * ✅ BAKİYE BAZLI SENARYO 28-10-2025:
     * - XRP nerede ise o tarafa göre emir açılır
     * - Hazırlık gerekiyorsa önce hazırlık işlemi yapılır
     */
    /**
     * Helper: prices objesini ArbitrageEngine'in beklediği formata çevir
     */
    getFlatPrices() {
        return {
            btcturkBid: this.prices.btcturk.bid,
            btcturkAsk: this.prices.btcturk.ask,
            binanceBid: this.prices.binance.bid,
            binanceAsk: this.prices.binance.ask
        };
    }

    async createNewOrder() {
        let scenario = null;
        let txId = null; // Task 5.1: Transaction ID
        try {
            // Task 5.1: Yeni bir işlem döngüsü için yeni bir ID oluştur
            txId = `TX_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            logger.info('📝 Yeni emir oluşturma başlıyor...', { txId });

            if (this.currentOrder.active) {
                logger.warn('⚠️  Zaten aktif emir var, yeni emir oluşturulmayacak', { txId });
                return false;
            }
            if (!this.prices.btcturk.bid || !this.prices.binance.bid) {
                logger.warn('⚠️  Fiyat bilgisi eksik, emir oluşturulamıyor', { txId });
                return false;
            }

            // Prices objesini düzleştir
            const flatPrices = this.getFlatPrices();

            logger.info('🔍 Bakiye bazlı senaryo belirleniyor...', { txId });
            const scenarioInfo = this.engine.determineScenario(this.balances, flatPrices);
            if (!scenarioInfo.scenario) {
                logger.warn('❌ Senaryo belirlenemedi', { txId, reason: scenarioInfo.reason });
                return false;
            }
            scenario = scenarioInfo.scenario;

            logger.info(`[Task 4.4] Proaktif bakiye kontrolü yapılıyor (${scenario} senaryosu)...`, { txId });
            const balanceValidation = this.engine.validateBalance(this.balances, scenario, flatPrices);
            if (!balanceValidation.valid) {
                logger.warn('⚠️  Yetersiz bakiye nedeniyle emir oluşturulamadı (proaktif kontrol)', {
                    txId,
                    reason: balanceValidation.reason,
                    details: balanceValidation.checks
                });
                return false;
            }

            // Faz 2: Slippage kontrolü ile karlılık hesapla
            logger.info('🔍 Slippage hesaplanıyor...', { txId });
            let profitScenario;
            try {
                if (scenario === 'SELL') {
                    const profitWithSlippage = await this.engine.calculateProfitability_Sell_WithSlippage_API(flatPrices, this.binance);
                    profitScenario = profitWithSlippage; // Response kendisi scenario objesi
                    const slippage = profitWithSlippage.binance && profitWithSlippage.binance.slippagePercent !== undefined 
                        ? profitWithSlippage.binance.slippagePercent.toFixed(3) + '%' 
                        : 'N/A';
                    logger.info('📊 SELL Karlılık (Slippage dahil):', {
                        txId,
                        profit: profitWithSlippage.profit.percent.toFixed(3) + '%',
                        slippage: slippage
                    });
                } else {
                    const profitWithSlippage = await this.engine.calculateProfitability_Buy_WithSlippage_API(flatPrices, this.binance);
                    profitScenario = profitWithSlippage; // Response kendisi scenario objesi
                    const slippage = profitWithSlippage.binance && profitWithSlippage.binance.slippagePercent !== undefined 
                        ? profitWithSlippage.binance.slippagePercent.toFixed(3) + '%' 
                        : 'N/A';
                    logger.info('📊 BUY Karlılık (Slippage dahil):', {
                        txId,
                        profit: profitWithSlippage.profit.percent.toFixed(3) + '%',
                        slippage: slippage
                    });
                }
            } catch (slippageError) {
                logger.warn('⚠️  Slippage hesaplaması başarısız, basit karlılık kullanılıyor:', {
                    txId,
                    error: slippageError.message
                });
                const profitability = this.engine.calculateProfitability(flatPrices);
                profitScenario = scenario === 'SELL' ? profitability.sellScenario : profitability.buyScenario;
            }

            logger.info('📊 Piyasa durumu:', { txId, scenario, profitPercent: profitScenario.profit.percent.toFixed(2) + '%' });

            logger.info('💰 Emir fiyatı hesaplanıyor...', { txId });
            const pricing = this.engine.calculateOrderPrice(flatPrices, scenario, this.config.minProfit);
            const orderPrice = pricing.orderPrice;
            const orderAmount = roundToBTCTurkScale(this.config.tradeAmount, 4);
            const btcturkSide = scenario === 'SELL' ? 'sell' : 'buy';

            // Notional Değer Kontrolü (Minimum Emir Tutarı)
            const notionalValue = orderPrice * orderAmount;
            if (notionalValue < config.trading.safety.minNotionalValue) {
                logger.warn('❌ Emir oluşturma reddedildi: Minimum emir değeri altında.', {
                    txId,
                    notionalValue: notionalValue.toFixed(4),
                    minNotional: config.trading.safety.minNotionalValue,
                    price: orderPrice,
                    amount: orderAmount
                });
                return false;
            }

            logger.info('📤 BTCTurk\'e limit emir gönderiliyor...', { txId, side: btcturkSide.toUpperCase(), price: orderPrice, amount: orderAmount });
            const orderResponse = await this.btcturk.createLimitOrder({
                symbol: this.config.symbol,  // Dinamik symbol
                side: btcturkSide,
                quantity: orderAmount,
                price: orderPrice
            });

            this.currentOrder = {
                active: true,
                txId: txId, // Task 5.1
                exchange: 'btcturk',
                orderId: orderResponse.id,
                side: btcturkSide.toUpperCase(),
                price: orderPrice,
                amount: orderAmount,
                scenario: scenario,
                timestamp: Date.now(),
                expectedProfit: profitScenario.profit.amount, // Task 5.2
                lastBinancePrice: scenario === 'SELL' ? this.prices.binance.ask : this.prices.binance.bid, // Persist this
                initialBinancePrice: scenario === 'SELL' ? this.prices.binance.ask : this.prices.binance.bid // Store the initial price
            };
            logger.info('✅ Emir başarıyla oluşturuldu!', { txId, orderId: orderResponse.id });

            this.startOrderMonitoring();
            return true;

        } catch (error) {
            this.metrics.tradesFailed++; // Task 5.2
            const errorMessage = error.message?.toLowerCase() || '';
            const isInsufficientBalance = errorMessage.includes('insufficient') || errorMessage.includes('balance');
            const isPrecisionOrNotionalError = errorMessage.includes('filter failure') || errorMessage.includes('size') || errorMessage.includes('precision') || errorMessage.includes('small');

            if (isInsufficientBalance) {
                logger.error('❌ Emir reddedildi: YETERSİZ BAKİYE.', { txId, scenario, error: error.message });
                this.updateBalances();
            } else if (isPrecisionOrNotionalError) {
                logger.error('❌ Emir reddedildi: MİKTAR/TUTAR HATASI. Bot durduruluyor.', { txId, scenario, error: error.message });
                this.stop();
            } else {
                logger.error('❌ Emir oluşturma hatası (Bilinmeyen sebep)', { txId, scenario, error: error.message, stack: error.stack });
            }
            return false;
        }
    }
    
    /**
     * Emir monitoring başlat
     * Emrin dolup dolmadığını kontrol eder
     */
    startOrderMonitoring() {
        // Eğer zaten monitoring varsa durdur
        if (this.intervals.orderMonitoring) {
            clearInterval(this.intervals.orderMonitoring);
        }
        
        logger.info('👀 Emir monitoring başlatıldı', {
            orderId: this.currentOrder.orderId,
            checkInterval: `${this.config.orderCheckInterval}ms`
        });
        
        this.intervals.orderMonitoring = setInterval(async () => {
            try {
                await this.checkOrderStatus();
            } catch (error) {
                logger.error('❌ Emir monitoring hatası', {
                    error: error.message
                });
            }
        }, this.config.orderCheckInterval);
    }
    
    async checkOrderStatus() {
        if (!this.currentOrder.active) {
            return;
        }

        const { txId, orderId, timestamp, amount, expectedProfit, scenario } = this.currentOrder;

        try {
            const order = await this.btcturk.getOrder(orderId);
            const fillDuration = (Date.now() - timestamp) / 1000;

            logger.debug('📊 Emir durumu kontrol edildi', { txId, orderId, status: order.status, executed: order.executedQuantity });

            const isFullyFilled = order.status === 'Closed' || order.leftAmount <= 0.0001;
            const isPartiallyFilled = order.executedQuantity > 0 && !isFullyFilled;

            if (isFullyFilled) {
                logger.info('✅ Emir tamamen doldu!', { txId, orderId, fillDuration: `${fillDuration.toFixed(2)}s` });
                if (this.intervals.orderMonitoring) clearInterval(this.intervals.orderMonitoring);

                // State'i temizlemeden önce counter order'ı güvenle çalıştır
                const counterOrderSuccess = await this.executeCounterOrder(amount, orderId, txId, expectedProfit, scenario);
                if (counterOrderSuccess) {
                    this.currentOrder.active = false;
                    this.currentOrder.orderId = null;
                    await this.updateBalances();
                } else {
                    logger.error('CRITICAL: Emir doldu ama karşı işlem başarısız. Manuel müdahale gerekebilir!', { txId, orderId });
                    // Bot'u güvenli moda alabilir veya durdurabiliriz.
                }
                return;
            }

            if (isPartiallyFilled) {
                const filledAmount = order.executedQuantity;
                const proRatedProfit = expectedProfit * (filledAmount / amount);

                logger.warn('⚠️ Emir kısmen doldu! Karşı işlem ve kalan emrin iptali tetikleniyor.', {
                    txId, orderId, filledAmount,
                    remainingAmount: order.leftAmount,
                    fillDuration: `${fillDuration.toFixed(2)}s`
                });

                notificationService.notifyPartialFill(txId, orderId, filledAmount, amount).catch(err =>
                    logger.error('Telegram bildirimi gönderilemedi', { error: err.message })
                );

                if (this.intervals.orderMonitoring) clearInterval(this.intervals.orderMonitoring);

                // 1. Önce karşı işlemi yap (en kritik adım)
                const counterOrderSuccess = await this.executeCounterOrder(filledAmount, orderId, txId, proRatedProfit, scenario);

                if (!counterOrderSuccess) {
                    logger.error('CRITICAL: Kısmi dolum sonrası karşı işlem başarısız. Kalan emir iptal edilmeyecek!', { txId, orderId });
                    // Monitoring'i yeniden başlat ki bot durumu tekrar değerlendirsin
                    this.startOrderMonitoring();
                    return;
                }

                // 2. Karşı işlem başarılıysa, kalan emri iptal et
                try {
                    logger.info(`Kalan ${order.leftAmount} XRP emri iptal ediliyor...`, { txId, orderId });
                    const cancelSuccess = await this.btcturk.cancelOrder(orderId);

                    if (cancelSuccess) {
                        logger.info('✅ Kalan emir başarıyla iptal edildi.', { txId, orderId });
                        // SADECE iptal başarılı olursa state'i temizle
                        this.currentOrder.active = false;
                        this.currentOrder.orderId = null;
                        await this.updateBalances();
                    } else {
                        logger.error('CRITICAL: Kalan emir iptal edilemedi. Manuel kontrol gerekli!', { txId, orderId });
                        // State'i temizleme, bot bir sonraki döngüde tekrar denesin
                        this.startOrderMonitoring();
                    }
                } catch (cancelError) {
                    logger.error('CRITICAL: Kalan emri iptal ederken hata oluştu.', { txId, orderId, error: cancelError.message });
                    this.startOrderMonitoring();
                }
                return;
            }

        } catch (error) {
            const errorMessage = error.message?.toLowerCase() || '';
            if (errorMessage.includes('order not found')) {
                logger.warn('Emir durumu sorgulanırken bulunamadı. Muhtemelen manuel iptal edildi. State temizleniyor.', { txId, orderId });
                if (this.intervals.orderMonitoring) clearInterval(this.intervals.orderMonitoring);
                this.currentOrder.active = false;
                this.currentOrder.orderId = null;
                this.updateBalances();
            } else {
                logger.error('❌ Emir durum kontrolü hatası', { txId, orderId, error: error.message });
            }
        }
    }
    async executeCounterOrder(overrideAmount = null, originalOrderId = null, txId = null, profit = 0, scenario = null) {
        const amount = overrideAmount;
        if (!amount || amount <= 0) {
            logger.warn('⚠️ Counter order için geçersiz miktar, işlem atlanıyor', { txId, amount });
            return false;
        }

        const binanceSide = scenario === 'SELL' ? 'BUY' : 'SELL';
        const maxRetries = 3;
        let attempt = 0;
        let lastError = null;

        while (attempt < maxRetries) {
            try {
                attempt++;
                logger.info(`🔄 Karşı emir deneniyor (Attempt ${attempt}/${maxRetries})...`, { txId, originalOrderId, side: binanceSide, amount });

                const counterOrder = await this.binance.createMarketOrder({
                    symbol: this.config.symbol,
                    side: binanceSide,
                    quantity: amount
                });

                this.metrics.tradesSucceeded++;
                this.metrics.totalProfit += profit;

                logger.profit('🎉 Arbitraj döngüsü tamamlandı!', {
                    txId,
                    profit: `${profit.toFixed(4)} USDT`,
                    totalProfit: `${this.metrics.totalProfit.toFixed(4)} USDT`,
                    successfulTrades: this.metrics.tradesSucceeded,
                    originalOrderId,
                    counterOrderId: counterOrder.id,
                });

                notificationService.notifyTradeSuccess(txId, profit, this.metrics.totalProfit, this.metrics).catch(err =>
                    logger.error('Telegram bildirimi gönderilemedi', { error: err.message })
                );

                // Başarılı olunca 2 saniye sonra yeni fırsat ara
                setTimeout(() => this.checkArbitrageOpportunity(), 2000);
                return true;

            } catch (error) {
                lastError = error;
                logger.error(`❌ Karşı emir denemesi ${attempt} başarısız oldu`, {
                    txId, originalOrderId,
                    error: error.message,
                    isLastAttempt: attempt === maxRetries
                });

                if (attempt < maxRetries) {
                    const delay = 1000 * Math.pow(2, attempt); // Exponential backoff: 2s, 4s
                    logger.info(`${delay / 1000} saniye sonra tekrar denenecek...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Tüm denemeler başarısız oldu
        this.metrics.tradesFailed++;
        const alertMessage = `🚨 KRİTİK HATA: Karşı emir ${maxRetries} deneme sonrası atılamadı!\nBorsa: Binance\nOrijinal Emir ID: ${originalOrderId}\nSon Hata: ${lastError.message}`;
        notificationService.sendAlert(alertMessage);

        logger.error('❌ CRITICAL: Karşı emir tüm denemelere rağmen başarısız oldu. Bot güvenli modda durduruluyor.', {
            txId, originalOrderId,
            error: lastError.message,
            stack: lastError.stack
        });

        // Güvenli moda geç
        await this.enterSafeMode();
        return false;
    }

    /**
     * Acil durumlarda botu güvenli bir şekilde durdurur.
     */
    async enterSafeMode() {
        logger.fatal('🚨 GÜVENLİ MOD AKTİF EDİLDİ! Bot tüm işlemleri durduruyor.');
        
        // Tüm zamanlayıcıları temizle
        Object.values(this.intervals).forEach(clearInterval);

        // Olası açık emri iptal etmeyi dene (best-effort)
        if (this.currentOrder.active && this.currentOrder.orderId) {
            try {
                logger.warn(`Güvenli mod: Açık emir ${this.currentOrder.orderId} iptal ediliyor...`);
                await this.btcturk.cancelOrder(this.currentOrder.orderId);
                logger.info('Açık emir iptal edildi.');
            } catch (error) {
                logger.error('Güvenli mod sırasında açık emir iptal edilemedi.', { error: error.message });
            }
        }
        
        // Bot'u resmi olarak durdur
        await this.stop();
    }

	/**
     * Bot'u başlat
     */
    async start() {
        if (!this.isInitialized) {
            throw new Error('Bot başlatılmadan önce initialize() çağrılmalı');
        }
        
        if (this.isRunning) {
            logger.warn('⚠️  Bot zaten çalışıyor');
            return;
        }
        
        logger.info('▶️  Bot başlatılıyor...');
        
        // SÜREKLI AÇIK EMİR STRATEJİSİ
        // İlk emri oluştur (eğer açık emir yoksa)
        if (!this.currentOrder.active) {
            logger.info('🎯 İlk emir oluşturuluyor...');
            
            // Kısa bir bekleme (fiyatların gelmesi için)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const orderCreated = await this.createNewOrder();
            
            if (orderCreated) {
                logger.info('✅ İlk emir başarıyla oluşturuldu, sürekli açık emir stratejisi aktif!');
            } else {
                logger.warn('⚠️  İlk emir oluşturulamadı, fiyat güncellemelerinde tekrar denenecek');
            }
        } else {
            logger.info('ℹ️  Zaten açık emir var, monitoring devam edecek');
        }
        
        // Bakiye güncelleme interval'ı
        this.intervals.balanceUpdate = setInterval(async () => {
            try {
                await this.updateBalances();
            } catch (error) {
                logger.error('❌ Periyodik bakiye güncelleme hatası', {
                    error: error.message
                });
            }
        }, this.config.balanceUpdateInterval);

        // Günlük rapor interval (her gece saat 00:00'da)
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
        const msUntilMidnight = midnight - now;

        setTimeout(() => {
            // İlk rapor
            this.sendDailyReportIfNeeded();
            // Sonraki raporlar için 24 saatlik interval
            setInterval(() => this.sendDailyReportIfNeeded(), 24 * 60 * 60 * 1000);
        }, msUntilMidnight);

        this.isRunning = true;

        // Telegram bildirimi - Bot başladı
        notificationService.notifyBotStarted(this.balances).catch(err =>
            logger.error('Telegram bildirimi gönderilemedi', { error: err.message })
        );

        logger.info('✅ Bot çalışıyor! Sürekli açık emir stratejisi aktif.');
        logger.info('ℹ️  Fiyat değişimi eşiği: %' + this.config.priceUpdateThreshold);
    }
    
    /**
     * Bot'u durdur
     */
    async stop() {
        if (!this.isRunning) {
            logger.warn('⚠️  Bot zaten durmuş');
            return;
        }
        
        logger.info('⏸️  Bot durduruluyor...');
        
        // Interval'ları temizle
        if (this.intervals.balanceUpdate) {
            clearInterval(this.intervals.balanceUpdate);
            this.intervals.balanceUpdate = null;
        }
        
        if (this.intervals.orderMonitoring) {
            clearInterval(this.intervals.orderMonitoring);
            this.intervals.orderMonitoring = null;
        }
        
        // WebSocket bağlantılarını kapat
        if (this.btcturk) {
            this.btcturk.disconnectWebSocket();
        }
        
        if (this.binance) {
            this.binance.disconnectWebSocket();
        }

        this.isRunning = false;

        // Telegram bildirimi - Bot durdu
        notificationService.notifyBotStopped(this.metrics, this.balances).catch(err =>
            logger.error('Telegram bildirimi gönderilemedi', { error: err.message })
        );

        logger.info('✅ Bot durduruldu');
    }
    
    /**
     * Bot durumunu al
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isInitialized: this.isInitialized,
            currentOrder: this.currentOrder,
            balances: this.balances,
            prices: this.prices,
            config: this.config
        };
    }
    
    /**
     * Bot durumunu yazdır
     */
    printStatus() {
        const status = this.getStatus();

        // Memory kullanımı (MB cinsinden)
        const memUsage = process.memoryUsage();
        const formatMemory = (bytes) => (bytes / 1024 / 1024).toFixed(2);

        console.log('\n' + '='.repeat(80));
        console.log('🤖 ARBITRAGE BOT STATUS');
        console.log('='.repeat(80));
        console.log(`\n⚙️  Durum: ${status.isRunning ? '▶️  ÇALIŞIYOR' : '⏸️  DURDU'}`);
        console.log(`📡 Initialize: ${status.isInitialized ? '✅' : '❌'}`);

        console.log(`\n💾 Memory Kullanımı:`);
        console.log(`  RSS (Total): ${formatMemory(memUsage.rss)} MB`);
        console.log(`  Heap Used: ${formatMemory(memUsage.heapUsed)} MB / ${formatMemory(memUsage.heapTotal)} MB`);
        console.log(`  External: ${formatMemory(memUsage.external)} MB`);

        console.log(`\n💼 Bakiyeler:`);
        console.log(`  BTCTurk: ${status.balances.btcturk[this.config.baseCoin].toFixed(2)} ${this.config.baseCoin}, ${status.balances.btcturk.USDT.toFixed(2)} USDT`);
        console.log(`  Binance: ${status.balances.binance[this.config.baseCoin].toFixed(2)} ${this.config.baseCoin}, ${status.balances.binance.USDT.toFixed(2)} USDT`);
        console.log(`\n📊 Fiyatlar:`);
        console.log(`  BTCTurk: BID ${status.prices.btcturk.bid || 'N/A'} / ASK ${status.prices.btcturk.ask || 'N/A'}`);
        console.log(`  Binance: BID ${status.prices.binance.bid || 'N/A'} / ASK ${status.prices.binance.ask || 'N/A'}`);
        console.log(`\n📋 Aktif Emir: ${status.currentOrder.active ? `✅ ${status.currentOrder.exchange} - ${status.currentOrder.side}` : '❌ YOK'}`);
        console.log('\n' + '='.repeat(80) + '\n');
    }

    /**
     * Günlük rapor gönder (gece 00:00'da)
     */
    async sendDailyReportIfNeeded() {
        try {
            // Gün başındaki bakiyeleri saklamak için (ilk çalıştırmada mevcut bakiye kullanılır)
            if (!this.startOfDayBalances) {
                this.startOfDayBalances = JSON.parse(JSON.stringify(this.balances));
            }

            await notificationService.sendDailyReport(this.metrics, this.balances, this.startOfDayBalances);

            // Bir sonraki gün için bakiyeleri sıfırla
            this.startOfDayBalances = JSON.parse(JSON.stringify(this.balances));
        } catch (error) {
            logger.error('Günlük rapor gönderilemedi', { error: error.message });
        }
    }

    /**
     * Düşük bakiye kontrolü
     */
    checkLowBalance() {
        const minBalances = config.trading.safety.minBalance;
        const baseCoin = this.config.baseCoin;
        const totalBaseCoinKey = `total${baseCoin}`;

        // BTCTurk baseCoin kontrolü (AVAX/XRP/SOL dinamik)
        // Not: Şu an config'te sadece USDT min balance var, baseCoin için gerekirse eklenebilir
        // if (minBalances[baseCoin.toLowerCase()] && this.balances.btcturk[totalBaseCoinKey] < minBalances[baseCoin.toLowerCase()]) {
        //     notificationService.notifyLowBalance('BTCTurk', baseCoin, this.balances.btcturk[totalBaseCoinKey], minBalances[baseCoin.toLowerCase()]).catch(err =>
        //         logger.error('Telegram bildirimi gönderilemedi', { error: err.message })
        //     );
        // }

        // BTCTurk USDT kontrolü
        if (this.balances.btcturk.totalUSDT < minBalances.usdt) {
            notificationService.notifyLowBalance('BTCTurk', 'USDT', this.balances.btcturk.totalUSDT, minBalances.usdt).catch(err =>
                logger.error('Telegram bildirimi gönderilemedi', { error: err.message })
            );
        }

        // Binance baseCoin kontrolü (AVAX/XRP/SOL dinamik)
        // Not: Şu an config'te sadece USDT min balance var, baseCoin için gerekirse eklenebilir
        // if (minBalances[baseCoin.toLowerCase()] && this.balances.binance[totalBaseCoinKey] < minBalances[baseCoin.toLowerCase()]) {
        //     notificationService.notifyLowBalance('Binance', baseCoin, this.balances.binance[totalBaseCoinKey], minBalances[baseCoin.toLowerCase()]).catch(err =>
        //         logger.error('Telegram bildirimi gönderilemedi', { error: err.message })
        //     );
        // }

        // Binance USDT kontrolü
        if (this.balances.binance.totalUSDT < minBalances.usdt) {
            notificationService.notifyLowBalance('Binance', 'USDT', this.balances.binance.totalUSDT, minBalances.usdt).catch(err =>
                logger.error('Telegram bildirimi gönderilemedi', { error: err.message })
            );
        }
    }
}

export default ArbitrageBot;
