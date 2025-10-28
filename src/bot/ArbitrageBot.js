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

class ArbitrageBot {
    constructor(options = {}, clients = {}) {
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
        
        // Bakiye state
        this.balances = {
            btcturk: {
                XRP: 0,
                USDT: 0,
                lockedXRP: 0,
                lockedUSDT: 0,
                totalXRP: 0,
                totalUSDT: 0
            },
            binance: {
                XRP: 0,
                USDT: 0,
                lockedXRP: 0,
                lockedUSDT: 0,
                totalXRP: 0,
                totalUSDT: 0
            }
        };
        
        // Aktif emir state
        this.currentOrder = {
            active: false,
            exchange: null,      // 'btcturk' veya 'binance'
            orderId: null,
            side: null,          // 'BUY' veya 'SELL'
            price: null,
            amount: null,
            scenario: null,      // 'SELL' veya 'BUY'
            timestamp: null,
            lastOrderPrice: null,     // Emir oluşturulduğundaki BTCTurk fiyatı
            lastBinancePrice: null    // Emir oluşturulduğundaki Binance fiyatı
        };
        
        // Emir güncelleme lock flag (race condition önleme)
        this.isUpdatingOrder = false;

        // ✅ DÜZELTME: Throttling için
        this.lastOrderAttemptTime = 0;
        this.orderAttemptCooldown = 5000; // 5 saniye (her 5 saniyede bir deneme)

        // Debug için
        this.lastPriceCheckLog = 0;
        
        // Monitoring intervals
        this.intervals = {
            balanceUpdate: null,
            orderMonitoring: null,
            priceUpdate: null
        };
        
        // Konfigürasyon
        this.config = {
            symbol: options.symbol || config.trading.symbol,
            tradeAmount: options.tradeAmount || config.trading.tradeAmount,
            minProfit: options.minProfit || config.trading.minProfit,
            minSpread: options.minSpread || config.trading.minSpread,
            balanceUpdateInterval: options.balanceUpdateInterval || 30000,  // 30 saniye
            orderCheckInterval: options.orderCheckInterval || 1000,         // 1 saniye
            priceUpdateThreshold: options.priceUpdateThreshold || config.trading.priceUpdateThreshold || 0.2
        };
        
        logger.info('🤖 ArbitrageBot oluşturuldu', {
            symbol: this.config.symbol,
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

            // 2. ArbitrageEngine'i oluştur
            logger.info('⚙️  ArbitrageEngine başlatılıyor...');
            this.engine = new ArbitrageEngine({
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
            throw error;
        }
    }
    
    /**
     * API bağlantı testleri
     */
    async testConnections() {
        try {
            // BTCTurk test
            const btcturkTest = await this.btcturk.getTicker24h('XRPUSDT');
            logger.info('✅ BTCTurk API bağlantısı başarılı', {
                symbol: 'XRPUSDT',
                last: btcturkTest.last
            });
            
            // Binance test
            const binanceTest = await this.binance.getTicker24h('XRPUSDT');
            logger.info('✅ Binance API bağlantısı başarılı', {
                symbol: 'XRPUSDT',
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
            // Format: { XRP: { free, locked, total }, USDT: { free, locked, total } }
            const btcturkXRP = btcturkResp.XRP || { free: 0, locked: 0, total: 0 };
            const btcturkUSDT = btcturkResp.USDT || { free: 0, locked: 0, total: 0 };
            
            // BTCTurk bakiyeleri
            const btcturkXRPFree = parseFloat(btcturkXRP.free || 0);
            const btcturkXRPLocked = parseFloat(btcturkXRP.locked || 0);
            const btcturkUSDTFree = parseFloat(btcturkUSDT.free || 0);
            const btcturkUSDTLocked = parseFloat(btcturkUSDT.locked || 0);
            
            this.balances.btcturk = {
                XRP: btcturkXRPFree,
                USDT: btcturkUSDTFree,
                lockedXRP: btcturkXRPLocked,
                lockedUSDT: btcturkUSDTLocked,
                totalXRP: btcturkXRPFree + btcturkXRPLocked,
                totalUSDT: btcturkUSDTFree + btcturkUSDTLocked
            };
            
            // Binance response'u object olarak geldiği için direkt kullan
            const binanceXRP = binanceResp.XRP || { free: 0, locked: 0, total: 0 };
            const binanceUSDT = binanceResp.USDT || { free: 0, locked: 0, total: 0 };
            
            this.balances.binance = {
                XRP: parseFloat(binanceXRP.free || 0),
                USDT: parseFloat(binanceUSDT.free || 0),
                lockedXRP: parseFloat(binanceXRP.locked || 0),
                lockedUSDT: parseFloat(binanceUSDT.locked || 0),
                totalXRP: parseFloat(binanceXRP.free || 0) + parseFloat(binanceXRP.locked || 0),
                totalUSDT: parseFloat(binanceUSDT.free || 0) + parseFloat(binanceUSDT.locked || 0)
            };
            
            logger.info('💼 Bakiyeler güncellendi', {
                btcturk: {
                    XRP: `${this.balances.btcturk.XRP.toFixed(2)} (${this.balances.btcturk.lockedXRP.toFixed(2)} locked)`,
                    USDT: `${this.balances.btcturk.USDT.toFixed(2)} (${this.balances.btcturk.lockedUSDT.toFixed(2)} locked)`
                },
                binance: {
                    XRP: `${this.balances.binance.XRP.toFixed(2)} (${this.balances.binance.lockedXRP.toFixed(2)} locked)`,
                    USDT: `${this.balances.binance.USDT.toFixed(2)} (${this.balances.binance.lockedUSDT.toFixed(2)} locked)`
                }
            });
            
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
            // BTCTurk WebSocket - XRPUSDT ticker
            await this.btcturk.connectWebSocket((data) => {
                this.onBTCTurkPriceUpdate(data);
            }, 'XRPUSDT');
            
            logger.info('✅ BTCTurk WebSocket bağlandı (XRPUSDT)');
            
            // Binance WebSocket - XRPUSDT bookTicker
            await this.binance.connectWebSocket((data) => {
                this.onBinancePriceUpdate(data);
            });
            
            logger.info('✅ Binance WebSocket bağlandı (XRPUSDT)');
            
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
        this.prices.btcturk = {
            bid: parseFloat(data.bid),
            ask: parseFloat(data.ask),
            last: parseFloat(data.last),
            timestamp: Date.now()
        };
        
        // Fiyat değişimi kontrolü ve potansiyel arbitraj analizi
        this.checkArbitrageOpportunity();
    }
    
    /**
     * Binance fiyat güncellemesi callback
     */
    onBinancePriceUpdate(data) {
        this.prices.binance = {
            bid: parseFloat(data.bid || data.bestBid),
            ask: parseFloat(data.ask || data.bestAsk),
            last: parseFloat(data.ask || data.bestAsk), // Binance bookTicker'da last yok
            timestamp: Date.now()
        };
        
        // Debug: Her 500 güncellemede bir log (spam olmasın)
        if (!this.binancePriceUpdateCount) this.binancePriceUpdateCount = 0;
        this.binancePriceUpdateCount++;
        
        if (this.binancePriceUpdateCount % 500 === 0) {
            logger.info('💰 onBinancePriceUpdate çağrıldı', {
                bid: this.prices.binance.bid,
                ask: this.prices.binance.ask,
                count: this.binancePriceUpdateCount,
                hasActiveOrder: this.currentOrder.active,
                lastBinancePrice: this.currentOrder.lastBinancePrice
            });
        }
        
        // Açık emir varsa fiyat değişimini kontrol et
        if (this.currentOrder.active && this.currentOrder.lastBinancePrice) {
            this.checkPriceChange();
        }
        
        // Fiyat değişimi kontrolü ve potansiyel arbitraj analizi
        this.checkArbitrageOpportunity();
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
            
            // Threshold aşıldıysa emri güncelle
            if (priceChangePercent >= this.config.priceUpdateThreshold) {
                logger.info('📊 Fiyat değişimi eşiği aşıldı, emir güncelleniyor', {
                    scenario: this.currentOrder.scenario,
                    oldPrice: this.currentOrder.lastBinancePrice.toFixed(4),
                    newPrice: currentBinancePrice.toFixed(4),
                    change: `${priceChangePercent.toFixed(2)}%`,
                    threshold: `${this.config.priceUpdateThreshold}%`
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
            // BTCTurk açık emirleri
            const btcturkOrders = await this.btcturk.getOpenOrders('XRPUSDT');
            
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
                    lastBinancePrice: scenario === 'SELL' ? this.prices.binance.ask : this.prices.binance.bid
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
        try {
            if (!this.currentOrder.active) {
                logger.warn('⚠️  Güncellenecek açık emir yok');
                return false;
            }
            
            // Zaten güncelleme işlemi devam ediyorsa atla
            if (this.isUpdatingOrder) {
                logger.debug('⏭️  Emir güncelleme zaten devam ediyor, atlandı');
                return false;
            }
            
            // Lock flag'i set et
            this.isUpdatingOrder = true;
            
            logger.info('🔄 Emir güncelleme başlıyor...', {
                currentOrderId: this.currentOrder.orderId,
                currentPrice: this.currentOrder.price,
                scenario: this.currentOrder.scenario
            });
            
            // 1. Mevcut emri iptal et
            const cancelResult = await this.btcturk.cancelOrder(this.currentOrder.orderId);
            
            if (!cancelResult) {
                logger.error('❌ Emir iptali başarısız');
                this.isUpdatingOrder = false; // Lock'u aç
                return false;
            }
            
            logger.info('✅ Mevcut emir iptal edildi', {
                orderId: this.currentOrder.orderId
            });
            
            // State'i temizle
            this.currentOrder.active = false;
            this.currentOrder.orderId = null;
            
            // Kısa bir bekleme (BTCTurk API emir iptalini işlesin)
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 2. Yeni emir oluştur
            const newOrderCreated = await this.createNewOrder();
            
            if (newOrderCreated) {
                logger.info('✅ Emir güncelleme başarılı', {
                    newOrderId: this.currentOrder.orderId,
                    newPrice: this.currentOrder.price
                });
                this.isUpdatingOrder = false; // Lock'u aç
                return true;
            } else {
                logger.warn('⚠️  Yeni emir oluşturulamadı');
                this.isUpdatingOrder = false; // Lock'u aç
                return false;
            }
            
        } catch (error) {
            logger.error('❌ Emir güncelleme hatası', {
                error: error.message,
                orderId: this.currentOrder.orderId
            });
            
            // Hata durumunda state'i temizle
            this.currentOrder.active = false;
            this.currentOrder.orderId = null;
            this.isUpdatingOrder = false; // Lock'u aç
            
            return false;
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

        // Throttling timestamp'i güncelle
        this.lastOrderAttemptTime = now;

        // Sürekli açık emir stratejisi: Aktif emir yoksa emir oluşturmayı dene
        try {
            await this.createNewOrder();
        } catch (error) {
            logger.error('❌ Arbitraj kontrolü hatası', {
                error: error.message
            });
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
                    symbol: 'XRPUSDT',
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
                    symbol: 'XRPUSDT',
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
    async createNewOrder() {
        try {
            logger.info('📝 Yeni emir oluşturma başlıyor...');

            // ============================================================================
            // 1. PRE-CHECKS
            // ============================================================================

            // Aktif emir var mı kontrol
            if (this.currentOrder.active) {
                logger.warn('⚠️  Zaten aktif emir var, yeni emir oluşturulmayacak', {
                    orderId: this.currentOrder.orderId,
                    side: this.currentOrder.side
                });
                return false;
            }

            // Fiyatlar mevcut mu kontrol
            if (!this.prices.btcturk.bid || !this.prices.binance.bid) {
                logger.warn('⚠️  Fiyat bilgisi eksik, emir oluşturulamıyor');
                return false;
            }

            // ============================================================================
            // 2. SENARYO BELİRLEME (✅ YENİ - Bakiye Bazlı!)
            // ============================================================================
            // Market Maker Mode: Bakiyelere göre senaryo belirle
            // XRP nerede ise o tarafa göre emir aç

            logger.info('🔍 Bakiye bazlı senaryo belirleniyor...');

            const balances = {
                btcturk: {
                    XRP: this.balances.btcturk.XRP,
                    USDT: this.balances.btcturk.USDT
                },
                binance: {
                    XRP: this.balances.binance.XRP,
                    USDT: this.balances.binance.USDT
                }
            };

            const scenarioInfo = this.engine.determineScenario(balances, this.prices);

            // Senaryo belirlenemedi mi?
            if (!scenarioInfo.scenario) {
                logger.warn('❌ Senaryo belirlenemedi', {
                    reason: scenarioInfo.reason,
                    balances: scenarioInfo.balances
                });
                return false;
            }

            logger.info('📊 Senaryo belirlendi:', {
                scenario: scenarioInfo.scenario,
                btcturkSide: scenarioInfo.btcturkSide,
                binanceSide: scenarioInfo.binanceSide,
                needsPreparation: scenarioInfo.needsPreparation ? '⚠️ Evet' : '✅ Hayır',
                reason: scenarioInfo.reason
            });

            // Hazırlık gerekiyor mu?
            if (scenarioInfo.needsPreparation) {
                if (!scenarioInfo.canPrepare) {
                    logger.warn('❌ Hazırlık yapılamıyor', {
                        reason: scenarioInfo.reason,
                        requiredUSDT: scenarioInfo.requiredUSDT,
                        availableUSDT: scenarioInfo.availableUSDT
                    });
                    return false;
                }

                // Hazırlık işlemini yap
                logger.info('🔧 Hazırlık işlemi gerekiyor...', scenarioInfo.preparationDetails);
                const preparationSuccess = await this.executePreparationTrade(scenarioInfo);

                if (!preparationSuccess) {
                    logger.error('❌ Hazırlık işlemi başarısız, emir açılamıyor');
                    return false;
                }

                logger.info('✅ Hazırlık tamamlandı, şimdi limit emir açılabilir');

                // Bakiyeleri güncelle (hazırlık sonrası)
                await this.updateBalances();
            }

            const scenario = scenarioInfo.scenario;

            // ============================================================================
            // 3. KARLILIK ANALİZİ (Bilgilendirme)
            // ============================================================================

            logger.info('🔍 Karlılık analizi yapılıyor (bilgilendirme için)...');

            const profitability = this.engine.calculateProfitability({
                btcturkBid: this.prices.btcturk.bid,
                btcturkAsk: this.prices.btcturk.ask,
                binanceBid: this.prices.binance.bid,
                binanceAsk: this.prices.binance.ask
            });

            const profitScenario = scenario === 'SELL' ? profitability.sellScenario : profitability.buyScenario;

            logger.info('📊 Piyasa durumu:', {
                scenario: scenario,
                profit: profitScenario.profit.amount.toFixed(4) + ' USDT',
                profitPercent: profitScenario.profit.percent.toFixed(2) + '%',
                spread: profitScenario.profit.spread.toFixed(2) + '%',
                meetsMinProfit: profitScenario.meetsMinProfit ? '✅' : '❌',
                meetsMinSpread: profitScenario.meetsMinSpread ? '✅' : '❌'
            });

            // ============================================================================
            // SPREAD KONTROLÜ (Kullanıcı isteğiyle değiştirildi)
            // ============================================================================
            // Strateji gereği, spread negatif olsa bile karlı fiyattan emir açıp bekliyoruz.
            // Bu yüzden negatif spread kontrolü kaldırıldı. Emir her zaman açılmayı deneyecek.

            // Market Maker Mode: Her zaman emir açmayı dene
            logger.info('✅ Market maker mode: Emir açma denemesi yapılıyor...', {
                spread: profitScenario.profit.spread.toFixed(2) + '%',
                note: 'Spread negatif olsa bile karlı fiyattan emir açılacak.'
            });

            // ============================================================================
            // 4. EMİR FİYATI HESAPLAMA (✅ YENİ - Engine kullanımı!)
            // ============================================================================

            logger.info('💰 Emir fiyatı hesaplanıyor (engine ile)...');

            const pricing = this.engine.calculateOrderPrice({
                btcturkBid: this.prices.btcturk.bid,
                btcturkAsk: this.prices.btcturk.ask,
                binanceBid: this.prices.binance.bid,
                binanceAsk: this.prices.binance.ask
            }, scenario, this.config.minProfit, 0); // PHASE 1: spreadBuffer kaldırıldı (0)

            const orderPrice = pricing.orderPrice;
            const orderAmount = roundToBTCTurkScale(this.config.tradeAmount, 4); // BTCTurk XRPUSDT numeratorScale: 4
            const btcturkSide = scenario === 'SELL' ? 'sell' : 'buy';

            logger.info('🎯 Emir detayları hazır', {
                exchange: 'BTCTurk',
                side: btcturkSide.toUpperCase(),
                price: orderPrice,
                amount: orderAmount,
                total: (orderPrice * orderAmount).toFixed(2) + ' USDT',
                expectedProfit: profitScenario.profit.amount.toFixed(4) + ' USDT',
                profitPercent: profitScenario.profit.percent.toFixed(2) + '%',
                breakdown: pricing.breakdown
            });

            // ============================================================================
            // 5. DRY-RUN KONTROLÜ (✅ YENİ - Test modu!)
            // ============================================================================

            if (config.advanced.dryRun) {
                logger.info('🧪 DRY-RUN MODE: Emir simüle ediliyor (gerçek emir gönderilmiyor)', {
                    exchange: 'BTCTurk',
                    side: btcturkSide.toUpperCase(),
                    price: orderPrice,
                    amount: orderAmount,
                    scenario: scenario,
                    expectedProfit: profitScenario.profit.amount.toFixed(4) + ' USDT'
                });

                // Fake order response (simülasyon için)
                this.currentOrder = {
                    active: true,
                    exchange: 'btcturk',
                    orderId: `DRY_RUN_${Date.now()}`,
                    side: btcturkSide.toUpperCase(),
                    price: orderPrice,
                    amount: orderAmount,
                    scenario: scenario,
                    timestamp: Date.now(),
                    lastOrderPrice: orderPrice,
                    lastBinancePrice: scenario === 'SELL' ? this.prices.binance.ask : this.prices.binance.bid,
                    isDryRun: true  // DRY-RUN flag
                };

                logger.info('✅ DRY-RUN: Emir simüle edildi (ID: ' + this.currentOrder.orderId + ')');

                // Monitoring başlatma (dry-run için de)
                this.startOrderMonitoring();

                return true;
            }

            // ============================================================================
            // 6. GERÇEK EMİR GÖNDERME (Production)
            // ============================================================================

            logger.info('📤 BTCTurk\'e limit emir gönderiliyor...');

            const orderResponse = await this.btcturk.createLimitOrder({
                symbol: 'XRPUSDT',
                side: btcturkSide,
                quantity: orderAmount,
                price: orderPrice
            });

            logger.info('✅ Emir başarıyla oluşturuldu!', {
                orderId: orderResponse.id,
                side: btcturkSide.toUpperCase(),
                price: orderPrice,
                amount: orderAmount,
                status: orderResponse.status
            });

            // ============================================================================
            // 7. STATE GÜNCELLEME
            // ============================================================================

            this.currentOrder = {
                active: true,
                exchange: 'btcturk',
                orderId: orderResponse.id,
                side: btcturkSide.toUpperCase(),
                price: orderPrice,
                amount: orderAmount,
                scenario: scenario,
                timestamp: Date.now(),
                lastOrderPrice: orderPrice,
                lastBinancePrice: scenario === 'SELL' ? this.prices.binance.ask : this.prices.binance.bid,
                expectedProfit: profitScenario.profit.amount,  // Beklenen kar
                isDryRun: false
            };

            // ============================================================================
            // 8. EMİR MONİTORİNG BAŞLAT
            // ============================================================================

            this.startOrderMonitoring();

            return true;

        } catch (error) {
            logger.error('❌ Emir oluşturma hatası', {
                error: error.message,
                stack: error.stack
            });
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
    
    /**
     * Emir durumunu kontrol et
     *
     * ✅ DÜZELTME 28-10-2025: Dry-run desteği eklendi
     */
    async checkOrderStatus() {
        if (!this.currentOrder.active) {
            return;
        }

        try {
            // ✅ DRY-RUN modu kontrolü
            if (this.currentOrder.isDryRun) {
                // Simülasyon: 10 saniye sonra emir "dolmuş" gibi davran
                const orderAge = Date.now() - this.currentOrder.timestamp;
                const fillTime = 10000; // 10 saniye

                if (orderAge > fillTime) {
                    logger.info('🧪 DRY-RUN: Emir simüle edildi (dolmuş gibi)', {
                        orderId: this.currentOrder.orderId,
                        side: this.currentOrder.side,
                        price: this.currentOrder.price,
                        amount: this.currentOrder.amount,
                        age: (orderAge / 1000).toFixed(0) + 's'
                    });

                    // State temizle
                    this.currentOrder.active = false;

                    // Monitoring durdur
                    if (this.intervals.orderMonitoring) {
                        clearInterval(this.intervals.orderMonitoring);
                        this.intervals.orderMonitoring = null;
                    }

                    // Counter order tetikle (simüle)
                    await this.executeCounterOrder();
                }

                return;
            }

            // GERÇEK MOD: BTCTurk'ten emir durumunu sorgula
            const order = await this.btcturk.getOrder(this.currentOrder.orderId);

            logger.debug('📊 Emir durumu kontrol edildi', {
                orderId: order.id,
                status: order.status,
                filled: order.quantity - order.leftAmount
            });

            // Emir tamamen doldu mu?
            if (order.status === 'Closed' || order.leftAmount === 0) {
                logger.info('✅ Emir tamamen doldu!', {
                    orderId: order.id,
                    side: this.currentOrder.side,
                    price: this.currentOrder.price,
                    amount: this.currentOrder.amount
                });

                // State temizle (counter order ÖNCE!)
                this.currentOrder.active = false;

                // Monitoring durdur
                if (this.intervals.orderMonitoring) {
                    clearInterval(this.intervals.orderMonitoring);
                    this.intervals.orderMonitoring = null;
                }

                // Counter order tetikle
                await this.executeCounterOrder();
            }

        } catch (error) {
            logger.error('❌ Emir durum kontrolü hatası', {
                error: error.message
            });
        }
    }
    
    /**
     * Counter order (karşı emir) yürüt
     * BTCTurk'teki limit emir dolduysa, Binance'te market emir yap
     *
     * ✅ DÜZELTME 28-10-2025: Dry-run desteği eklendi
     */
    async executeCounterOrder() {
        try {
            logger.info('🔄 Counter order başlatılıyor...', {
                scenario: this.currentOrder.scenario,
                isDryRun: this.currentOrder.isDryRun || false
            });

            const scenario = this.currentOrder.scenario;
            const amount = this.currentOrder.amount;
            const isDryRun = this.currentOrder.isDryRun || false;

            let binanceSide;
            let expectedPrice;

            if (scenario === 'SELL') {
                // BTCTurk'te SELL yaptık -> Binance'te BUY yapacağız
                binanceSide = 'BUY';
                expectedPrice = this.prices.binance.ask;
            } else {
                // BTCTurk'te BUY yaptık -> Binance'te SELL yapacağız
                binanceSide = 'SELL';
                expectedPrice = this.prices.binance.bid;
            }

            // ✅ DRY-RUN modu kontrolü
            if (isDryRun) {
                logger.info('🧪 DRY-RUN: Binance counter order simüle ediliyor', {
                    side: binanceSide,
                    amount: amount,
                    expectedPrice: expectedPrice,
                    expectedProfit: this.currentOrder.expectedProfit
                });

                // Simüle edilmiş kar hesaplama
                const simulatedProfit = this.currentOrder.expectedProfit || 0;

                logger.info('🎉 DRY-RUN: Arbitraj döngüsü simüle edildi!', {
                    btcturkOrder: this.currentOrder.orderId,
                    binanceOrder: 'DRY_RUN_COUNTER_' + Date.now(),
                    scenario: scenario,
                    btcturkPrice: this.currentOrder.price,
                    binancePrice: expectedPrice,
                    simulatedProfit: simulatedProfit.toFixed(4) + ' USDT'
                });

                // Bakiyeleri güncelle (dry-run'da da gerekli)
                await this.updateBalances();

                // Yeni emir oluştur
                logger.info('🔁 DRY-RUN: Yeni döngü başlatılıyor...');

                await new Promise(resolve => setTimeout(resolve, 1000));

                const newOrderCreated = await this.createNewOrder();

                if (newOrderCreated) {
                    logger.info('✅ DRY-RUN: Yeni emir simüle edildi');
                } else {
                    logger.warn('⚠️  DRY-RUN: Yeni emir oluşturulamadı');
                }

                return true;
            }

            // GERÇEK MOD: Binance market emir
            logger.info('📤 Binance market emri gönderiliyor...', {
                side: binanceSide,
                amount: amount,
                expectedPrice: expectedPrice
            });

            const counterOrder = await this.binance.createMarketOrder({
                symbol: 'XRPUSDT',
                side: binanceSide,
                quantity: amount
            });

            logger.info('✅ Counter order başarılı!', {
                orderId: counterOrder.orderId,
                side: binanceSide,
                executedQty: counterOrder.executedQty,
                status: counterOrder.status
            });

            // Başarılı arbitraj döngüsü tamamlandı
            const actualProfit = this.currentOrder.expectedProfit || 0;

            logger.info('🎉 Arbitraj döngüsü tamamlandı!', {
                btcturkOrder: this.currentOrder.orderId,
                binanceOrder: counterOrder.orderId,
                scenario: scenario,
                btcturkPrice: this.currentOrder.price,
                binancePrice: expectedPrice,
                expectedProfit: actualProfit.toFixed(4) + ' USDT'
            });

            // Bakiyeleri güncelle
            await this.updateBalances();

            // SÜREKLI AÇIK EMİR STRATEJİSİ: Yeni emir oluştur
            logger.info('🔁 Yeni döngü başlatılıyor, yeni emir oluşturuluyor...');

            // Kısa bir bekleme (rate limiting ve market stabilization)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Yeni emir oluştur
            const newOrderCreated = await this.createNewOrder();

            if (newOrderCreated) {
                logger.info('✅ Yeni emir oluşturuldu, sürekli açık emir stratejisi devam ediyor');
            } else {
                logger.warn('⚠️  Yeni emir oluşturulamadı, fiyat güncellemelerinde tekrar denenecek');
            }

            return true;

        } catch (error) {
            logger.error('❌ Counter order hatası', {
                error: error.message,
                stack: error.stack
            });

            // TODO: Hata durumunda ne yapılacak? (recovery stratejisi)
            return false;
        }
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
        
        this.isRunning = true;
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
        
        console.log('\n' + '='.repeat(80));
        console.log('🤖 ARBITRAGE BOT STATUS');
        console.log('='.repeat(80));
        console.log(`\n⚙️  Durum: ${status.isRunning ? '▶️  ÇALIŞIYOR' : '⏸️  DURDU'}`);
        console.log(`📡 Initialize: ${status.isInitialized ? '✅' : '❌'}`);
        console.log(`\n💼 Bakiyeler:`);
        console.log(`  BTCTurk: ${status.balances.btcturk.XRP.toFixed(2)} XRP, ${status.balances.btcturk.USDT.toFixed(2)} USDT`);
        console.log(`  Binance: ${status.balances.binance.XRP.toFixed(2)} XRP, ${status.balances.binance.USDT.toFixed(2)} USDT`);
        console.log(`\n📊 Fiyatlar:`);
        console.log(`  BTCTurk: BID ${status.prices.btcturk.bid || 'N/A'} / ASK ${status.prices.btcturk.ask || 'N/A'}`);
        console.log(`  Binance: BID ${status.prices.binance.bid || 'N/A'} / ASK ${status.prices.binance.ask || 'N/A'}`);
        console.log(`\n📋 Aktif Emir: ${status.currentOrder.active ? `✅ ${status.currentOrder.exchange} - ${status.currentOrder.side}` : '❌ YOK'}`);
        console.log('\n' + '='.repeat(80) + '\n');
    }
}

export default ArbitrageBot;
