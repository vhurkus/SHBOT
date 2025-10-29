/**
 * Arbitrage Engine
 * Core arbitrage logic and profitability calculations
 */

import logger from '../utils/logger.js';
import config from '../config/config.js';
import { roundToBinanceLOT_SIZE, roundToBTCTurkScale } from '../utils/precision.js';

class ArbitrageEngine {
    constructor(options = {}) {
        // ✅ ÇOKLU PARİTE DESTEĞİ: Parite config'i sakla
        this.pairConfig = options.pairConfig || null;

        if (!this.pairConfig) {
            throw new Error('❌ pairConfig gerekli! options.pairConfig parametresi eksik.');
        }

        // Exchange fee'leri (config'den veya manual)
        this.fees = {
            btcturk: {
                maker: options.btcturkMakerFee || config.trading.fees.btcturk.maker,
                taker: options.btcturkTakerFee || config.trading.fees.btcturk.taker
            },
            binance: {
                maker: options.binanceMakerFee || config.trading.fees.binance.maker,
                taker: options.binanceTakerFee || config.trading.fees.binance.taker
            }
        };

        // Slippage buffer (market emirler için)
        this.slippageBuffer = options.slippageBuffer || config.trading.slippageBuffer || 0.0005;

        // Minimum spread ve kar parametreleri
        this.minSpread = options.minSpread || config.trading.minSpread;
        this.minProfit = options.minProfit || config.trading.minProfit;

        // Trade amount (dinamik coin - AVAX/XRP/SOL)
        this.tradeAmount = options.tradeAmount || this.pairConfig.tradeAmount;

        logger.info('🤖 ArbitrageEngine başlatıldı', {
            pair: this.pairConfig.symbol,
            fees: this.fees,
            slippageBuffer: `${(this.slippageBuffer * 100).toFixed(3)}%`,
            minSpread: `${this.minSpread}%`,
            minProfit: `${this.minProfit}%`,
            tradeAmount: `${this.tradeAmount} ${this.pairConfig.baseCoin}`
        });
    }

    /**
     * Fee'leri güncelle (dinamik olarak API'den alınabilir)
     */
    updateFees(exchange, maker, taker) {
        if (this.fees[exchange]) {
            this.fees[exchange].maker = maker;
            this.fees[exchange].taker = taker;
            
            logger.info(`💸 ${exchange.toUpperCase()} fee'leri güncellendi`, {
                maker: `${(maker * 100).toFixed(2)}%`,
                taker: `${(taker * 100).toFixed(2)}%`
            });
        }
    }

    /**
     * Minimum spread'i güncelle
     */
    updateMinSpread(spread) {
        this.minSpread = spread;
        logger.info(`📊 Minimum spread güncellendi: ${spread}%`);
    }

    /**
     * Minimum kar oranını güncelle
     */
    updateMinProfit(profit) {
        this.minProfit = profit;
        logger.info(`💰 Minimum kar oranı güncellendi: ${profit}%`);
    }

    /**
     * Trade amount'u güncelle
     */
    updateTradeAmount(amount) {
        this.tradeAmount = amount;
        logger.info(`📦 Trade amount güncellendi: ${amount} ${this.pairConfig.baseCoin}`);
    }

    /**
     * Mevcut yapılandırmayı getir
     */
    getConfig() {
        return {
            fees: this.fees,
            minSpread: this.minSpread,
            minProfit: this.minProfit,
            tradeAmount: this.tradeAmount
        };
    }

    /**
     * ==========================================
     * FAZ 1: DİNAMİK SPREAD VE VOLATİLİTE SİSTEMİ
     * ==========================================
     */

    /**
     * Volatilite hesaplama (son N fiyat değişimi üzerinden)
     * Standard deviation metodu ile piyasa volatilitesini hesaplar
     * 
     * @param {Array<number>} priceHistory - Fiyat geçmişi array'i
     * @param {number} periods - Kaç periyot geriye bakılacak (default: 20)
     * @returns {number} Volatilite yüzdesi (%)
     */
    calculateVolatility(priceHistory, periods = 20) {
        if (!priceHistory || priceHistory.length < 2) {
            return 0;
        }

        // Yeterli veri yoksa mevcut tüm veriyi kullan
        const n = Math.min(periods, priceHistory.length);
        const recentPrices = priceHistory.slice(-n);
        
        if (recentPrices.length < 2) {
            return 0;
        }

        // Fiyat değişimlerini (returns) hesapla
        const returns = [];
        for (let i = 1; i < recentPrices.length; i++) {
            const return_ = (recentPrices[i] - recentPrices[i-1]) / recentPrices[i-1];
            returns.push(return_);
        }
        
        if (returns.length === 0) {
            return 0;
        }

        // Ortalama return
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        
        // Variance (varyans)
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        
        // Standard deviation (volatilite) - yüzde olarak
        const volatility = Math.sqrt(variance) * 100;
        
        return volatility;
    }

    /**
     * Dinamik minimum spread belirleme
     * Volatiliteye göre spread'i otomatik ayarlar
     * 
     * Mantık:
     * - Düşük volatilite → Dar spread (daha fazla fırsat yakalama)
     * - Yüksek volatilite → Geniş spread (risk yönetimi)
     * 
     * @param {number} currentVolatility - Mevcut volatilite (%)
     * @returns {number} Önerilen minimum spread (%)
     */
    getDynamicMinSpread(currentVolatility) {
        const baseSpread = 0.15; // Temel spread %0.15
        const volatilityMultiplier = 2.0; // Volatilite çarpanı
        const maxSpread = 1.0; // Maksimum spread cap (%1.0)
        const minSpread = 0.10; // Minimum spread floor (%0.10)
        
        // Formül: Base + (Volatility × Multiplier)
        let dynamicSpread = baseSpread + (currentVolatility * volatilityMultiplier);
        
        // Cap ve floor uygulama (spread çok büyük veya küçük olmasın)
        dynamicSpread = Math.min(dynamicSpread, maxSpread);
        dynamicSpread = Math.max(dynamicSpread, minSpread);
        
        return parseFloat(dynamicSpread.toFixed(4));
    }

    /**
     * Dinamik kar hedefi belirleme
     * Volatilite ve spread'e göre kar hedefini otomatik ayarlar
     * 
     * Mantık:
     * - Spread'in bir kısmı kar olmalı
     * - Yüksek volatilite → Daha yüksek kar hedefi (risk-reward dengesi)
     * 
     * @param {number} currentVolatility - Mevcut volatilite (%)
     * @param {number} currentSpread - Mevcut spread (%)
     * @returns {number} Önerilen minimum kar (%)
     */
    getDynamicMinProfit(currentVolatility, currentSpread) {
        const baseProfitRatio = 0.3; // ✅ Spread'in %30'u kar (daha agresif)
        const volatilityAdjustment = currentVolatility * 0.3; // Volatiliteye göre artış
        
        // Minimum kar = Spread'in %30'u + volatilite eklentisi
        let minProfit = (currentSpread * baseProfitRatio) + volatilityAdjustment;
        
        // ✅ DÜZELTME: Minimumda %0.03 kar garantisi (çok daha agresif)
        minProfit = Math.max(minProfit, 0.03);
        
        // Maksimum %0.30 kar hedefi (daha agresif, fırsatları kaçırmamak için)
        minProfit = Math.min(minProfit, 0.30);
        
        return parseFloat(minProfit.toFixed(4));
    }

    /**
     * Volatilite bazlı dinamik parametreleri güncelle
     * 
     * @param {Array<number>} priceHistory - Fiyat geçmişi
     * @param {number} periods - Volatilite hesaplama periyodu
     * @returns {object} Güncellenmiş parametreler
     */
    updateDynamicParameters(priceHistory, periods = 20) {
        // Volatilite hesapla
        const volatility = this.calculateVolatility(priceHistory, periods);
        
        // Dinamik spread ve kar hedefi belirle
        const dynamicSpread = this.getDynamicMinSpread(volatility);
        const dynamicProfit = this.getDynamicMinProfit(volatility, dynamicSpread);
        
        // Parametreleri güncelle
        const oldSpread = this.minSpread;
        const oldProfit = this.minProfit;
        
        this.minSpread = dynamicSpread;
        this.minProfit = dynamicProfit;
        
        // Log sadece değişiklik varsa
        if (Math.abs(oldSpread - dynamicSpread) > 0.01 || Math.abs(oldProfit - dynamicProfit) > 0.01) {
            logger.info('📊 Dinamik parametreler güncellendi', {
                volatility: `${volatility.toFixed(4)}%`,
                spread: {
                    old: `${oldSpread.toFixed(3)}%`,
                    new: `${dynamicSpread.toFixed(3)}%`,
                    change: `${((dynamicSpread - oldSpread) / oldSpread * 100).toFixed(1)}%`
                },
                profit: {
                    old: `${oldProfit.toFixed(3)}%`,
                    new: `${dynamicProfit.toFixed(3)}%`,
                    change: `${((dynamicProfit - oldProfit) / oldProfit * 100).toFixed(1)}%`
                }
            });
        }
        
        return {
            volatility,
            minSpread: dynamicSpread,
            minProfit: dynamicProfit,
            updated: Math.abs(oldSpread - dynamicSpread) > 0.01 || Math.abs(oldProfit - dynamicProfit) > 0.01
        };
    }

    /**
     * FAZ 3: Volatiliteye göre dinamik update threshold
     * Yüksek volatilite → daha sık güncelleme (düşük threshold)
     * Düşük volatilite → daha az güncelleme (yüksek threshold)
     * 
     * @param {number} currentVolatility - Mevcut volatilite (%)
     * @returns {number} Dinamik threshold (%)
     */
    getDynamicUpdateThreshold(currentVolatility) {
        const minThreshold = 0.05; // %0.05 minimum (çok sık güncelleme)
        const maxThreshold = 0.30; // %0.30 maksimum (az güncelleme)
        
        // Kripto piyasa volatilite aralıkları:
        // < 0.01% → çok sakin (max threshold)
        // 0.01-0.10% → normal (0.25-0.15% threshold)
        // 0.10-0.50% → hareketli (0.15-0.05% threshold)
        // > 0.50% → çok hareketli (min threshold)
        
        if (currentVolatility < 0.01) {
            // Çok sakin → en az güncelleme
            return maxThreshold;
        } else if (currentVolatility > 0.50) {
            // Çok hareketli → en sık güncelleme
            return minThreshold;
        } else {
            // Doğrusal interpolasyon: 0.01% → 0.30%, 0.50% → 0.05%
            const ratio = (currentVolatility - 0.01) / (0.50 - 0.01);
            return maxThreshold - (ratio * (maxThreshold - minThreshold));
        }
    }

    /**
     * ==========================================
     * FAZ 2: ORDER BOOK DEPTH VE SLIPPAGE ANALİZİ
     * ==========================================
     */

    /**
     * Order book depth analizi ve slippage hesaplama
     * Market order gerçekleştirildiğinde kaç seviye kullanılacağını ve slippage'ı hesaplar
     * 
     * @param {Array<{price: number, amount: number}>} orderBook - Order book (bids veya asks)
     * @param {number} tradeAmount - İşlem miktarı (XRP)
     * @param {string} side - 'bid' veya 'ask'
     * @returns {object} Depth analizi
     */
    analyzeOrderBookDepth(orderBook, tradeAmount, side = 'ask') {
        if (!orderBook || orderBook.length === 0) {
            return {
                hasEnoughLiquidity: false,
                availableLiquidity: 0,
                requiredLiquidity: tradeAmount,
                levelsNeeded: 0,
                bestPrice: 0,
                avgExecutionPrice: 0,
                deepestPrice: 0,
                slippage: 0,
                slippagePercent: '0.0000'
            };
        }

        let cumulativeAmount = 0;
        let weightedPriceSum = 0;
        let levelsNeeded = 0;
        let deepestPrice = 0;
        
        // Order book seviyelerini dolaş
        for (let i = 0; i < orderBook.length; i++) {
            const level = orderBook[i];
            
            if (!level || !level.price || !level.amount) continue;
            
            levelsNeeded++;
            
            // Bu seviyeden ne kadar alınabilir
            const amountToTake = Math.min(level.amount, tradeAmount - cumulativeAmount);
            cumulativeAmount += amountToTake;
            weightedPriceSum += amountToTake * level.price;
            deepestPrice = level.price;
            
            // Yeterli likidite toplandı mı?
            if (cumulativeAmount >= tradeAmount) break;
        }
        
        const hasEnoughLiquidity = cumulativeAmount >= tradeAmount;
        const avgExecutionPrice = hasEnoughLiquidity 
            ? weightedPriceSum / cumulativeAmount 
            : 0;
        
        const bestPrice = orderBook[0]?.price || 0;
        
        // Slippage hesaplama: (Ortalama Fiyat - En İyi Fiyat) / En İyi Fiyat × 100
        const slippage = hasEnoughLiquidity && bestPrice > 0
            ? ((avgExecutionPrice - bestPrice) / bestPrice) * 100
            : 0;
        
        return {
            hasEnoughLiquidity,
            availableLiquidity: cumulativeAmount,
            requiredLiquidity: tradeAmount,
            levelsNeeded,
            bestPrice,
            avgExecutionPrice,
            deepestPrice,
            slippage: Math.abs(slippage),
            slippagePercent: Math.abs(slippage).toFixed(4)
        };
    }

    /**
     * Binance market order için beklenen slippage hesaplama
     * Order book'u kullanarak gerçek slippage tahmini yapar
     * 
     * @param {object} binanceClient - Binance client instance
     * @param {string} side - 'BUY' veya 'SELL'
     * @param {number} amount - İşlem miktarı (XRP)
     * @returns {Promise<object>} Slippage analizi
     */
    /**
     * FAZ 2: Slippage ile karlılık hesaplama - SELL senaryosu (API wrapper)
     * Order book'u fetch edip slippage dahil karlılık hesaplar
     */
    async calculateProfitability_Sell_WithSlippage_API(prices, binanceClient, amount = this.tradeAmount) {
        try {
            // Order book al
            const orderBook = await binanceClient.getOrderBook(this.pairConfig.symbol, 20);
            
            // Slippage dahil karlılık hesapla
            return this.calculateProfitability_Sell_WithSlippage(
                prices.btcturkBid,
                orderBook.asks,  // SELL için Binance'te BUY (asks)
                amount
            );
        } catch (error) {
            logger.error('❌ Slippage ile karlılık hesaplama hatası (SELL):', error.message);
            throw error;
        }
    }

    /**
     * FAZ 2: Slippage ile karlılık hesaplama - BUY senaryosu (API wrapper)
     * Order book'u fetch edip slippage dahil karlılık hesaplar
     */
    async calculateProfitability_Buy_WithSlippage_API(prices, binanceClient, amount = this.tradeAmount) {
        try {
            // Order book al
            const orderBook = await binanceClient.getOrderBook(this.pairConfig.symbol, 20);
            
            // Slippage dahil karlılık hesapla
            return this.calculateProfitability_Buy_WithSlippage(
                prices.btcturkAsk,
                orderBook.bids,  // BUY için Binance'te SELL (bids)
                amount
            );
        } catch (error) {
            logger.error('❌ Slippage ile karlılık hesaplama hatası (BUY):', error.message);
            throw error;
        }
    }

    async calculateExpectedSlippage(binanceClient, side, amount) {
        try {
            // Order book al
            const orderBook = await binanceClient.getOrderBook(this.pairConfig.symbol, 20);
            
            // Side'a göre book seç (BUY için asks, SELL için bids)
            const book = side === 'BUY' ? orderBook.asks : orderBook.bids;
            
            // Depth analizi yap
            const analysis = this.analyzeOrderBookDepth(book, amount, side.toLowerCase());
            
            if (!analysis.hasEnoughLiquidity) {
                logger.warn('⚠️ Yetersiz likidite!', {
                    side,
                    required: amount,
                    available: analysis.availableLiquidity,
                    levelsAvailable: orderBook[side === 'BUY' ? 'asks' : 'bids'].length
                });
            }
            
            return analysis;
        } catch (error) {
            logger.error('❌ Slippage hesaplama hatası:', error.message);
            return null;
        }
    }

    /**
     * Karlılık hesaplama - Satış senaryosu
     * BTCTurk'te limit SELL, Binance'te market BUY
     * 
     * @param {number} btcturkBid - BTCTurk'teki bid fiyatı (USDT)
     * @param {number} binanceAsk - Binance'teki ask fiyatı (USDT)
     * @param {number} amount - Trade miktarı (XRP)
     * @returns {object} Karlılık analizi
     */
    calculateProfitability_Sell(btcturkBid, binanceAsk, amount = this.tradeAmount) {
        // BTCTurk'te SELL (limit - maker fee)
        const sellPrice = btcturkBid;
        const sellAmount = amount;
        const sellTotal = sellPrice * sellAmount; // USDT
        const sellFee = sellTotal * this.fees.btcturk.maker;
        const sellNet = sellTotal - sellFee; // USDT (elde edilen)

        // Binance'te BUY (market - taker fee)
        const buyPrice = binanceAsk;
        const buyAmount = amount;
        const buyTotal = buyPrice * buyAmount; // USDT
        const buyFee = buyTotal * this.fees.binance.taker;
        const buyNet = buyTotal + buyFee; // USDT (harcanan)

        // Kar hesaplama
        const profit = sellNet - buyNet; // USDT
        const profitPercent = (profit / buyNet) * 100; // %

        // Spread hesaplama
        const spread = ((sellPrice - buyPrice) / buyPrice) * 100; // %

        return {
            scenario: 'SELL',
            profitable: profit > 0 && profitPercent >= this.minProfit,
            
            btcturk: {
                side: 'SELL',
                price: sellPrice,
                amount: sellAmount,
                total: sellTotal,
                fee: sellFee,
                feePercent: this.fees.btcturk.maker * 100,
                net: sellNet
            },
            
            binance: {
                side: 'BUY',
                price: buyPrice,
                amount: buyAmount,
                total: buyTotal,
                fee: buyFee,
                feePercent: this.fees.binance.taker * 100,
                net: buyNet
            },
            
            profit: {
                amount: profit,
                percent: profitPercent,
                spread: spread
            },
            
            meetsMinProfit: profitPercent >= this.minProfit,
            meetsMinSpread: spread >= this.minSpread
        };
    }

    /**
     * Karlılık hesaplama - Alış senaryosu
     * BTCTurk'te limit BUY, Binance'te market SELL
     * 
     * @param {number} btcturkAsk - BTCTurk'teki ask fiyatı (USDT)
     * @param {number} binanceBid - Binance'teki bid fiyatı (USDT)
     * @param {number} amount - Trade miktarı (XRP)
     * @returns {object} Karlılık analizi
     */
    calculateProfitability_Buy(btcturkAsk, binanceBid, amount = this.tradeAmount) {
        // Binance'te SELL (market - taker fee)
        const sellPrice = binanceBid;
        const sellAmount = amount;
        const sellTotal = sellPrice * sellAmount; // USDT
        const sellFee = sellTotal * this.fees.binance.taker;
        const sellNet = sellTotal - sellFee; // USDT (elde edilen)

        // BTCTurk'te BUY (limit - maker fee)
        const buyPrice = btcturkAsk;
        const buyAmount = amount;
        const buyTotal = buyPrice * buyAmount; // USDT
        const buyFee = buyTotal * this.fees.btcturk.maker;
        const buyNet = buyTotal + buyFee; // USDT (harcanan)

        // Kar hesaplama
        const profit = sellNet - buyNet; // USDT
        const profitPercent = (profit / buyNet) * 100; // %

        // Spread hesaplama
        const spread = ((sellPrice - buyPrice) / buyPrice) * 100; // %

        return {
            scenario: 'BUY',
            profitable: profit > 0 && profitPercent >= this.minProfit,
            
            binance: {
                side: 'SELL',
                price: sellPrice,
                amount: sellAmount,
                total: sellTotal,
                fee: sellFee,
                feePercent: this.fees.binance.taker * 100,
                net: sellNet
            },
            
            btcturk: {
                side: 'BUY',
                price: buyPrice,
                amount: buyAmount,
                total: buyTotal,
                fee: buyFee,
                feePercent: this.fees.btcturk.maker * 100,
                net: buyNet
            },
            
            profit: {
                amount: profit,
                percent: profitPercent,
                spread: spread
            },
            
            meetsMinProfit: profitPercent >= this.minProfit,
            meetsMinSpread: spread >= this.minSpread
        };
    }

    /**
     * Her iki senaryo için karlılık hesapla ve en iyisini bul
     * 
     * @param {object} prices - Fiyat bilgileri
     * @param {number} prices.btcturkBid - BTCTurk bid
     * @param {number} prices.btcturkAsk - BTCTurk ask
     * @param {number} prices.binanceBid - Binance bid
     * @param {number} prices.binanceAsk - Binance ask
     * @param {number} amount - Trade miktarı
     * @returns {object} En karlı senaryo
     */
    calculateProfitability(prices, amount = this.tradeAmount) {
        const sellScenario = this.calculateProfitability_Sell(
            prices.btcturkBid,
            prices.binanceAsk,
            amount
        );

        const buyScenario = this.calculateProfitability_Buy(
            prices.btcturkAsk,
            prices.binanceBid,
            amount
        );

        // En karlı senaryoyu seç
        const bestScenario = sellScenario.profit.percent > buyScenario.profit.percent 
            ? sellScenario 
            : buyScenario;

        return {
            sellScenario,
            buyScenario,
            bestScenario,
            hasOpportunity: bestScenario.profitable
        };
    }

    /**
     * FAZ 2: GELIŞMIŞ Karlılık Hesaplama - Slippage Dahil (SELL Senaryosu)
     * Order book depth kullanarak gerçekçi slippage ile karlılık hesaplar
     * 
     * @param {number} btcturkBid - BTCTurk bid fiyatı
     * @param {Array<{price, amount}>} binanceOrderBook - Binance order book asks
     * @param {number} amount - Trade miktarı
     * @returns {object} Slippage dahil karlılık analizi
     */
    calculateProfitability_Sell_WithSlippage(btcturkBid, binanceOrderBook, amount = this.tradeAmount) {
        // Binance'te market BUY slippage analizi
        const slippageAnalysis = this.analyzeOrderBookDepth(binanceOrderBook, amount, 'ask');
        
        if (!slippageAnalysis.hasEnoughLiquidity) {
            return {
                profitable: false,
                reason: 'Insufficient liquidity on Binance',
                slippageAnalysis
            };
        }
        
        // BTCTurk'te SELL (limit - maker fee)
        const sellPrice = btcturkBid;
        const sellAmount = amount;
        const sellTotal = sellPrice * sellAmount;
        const sellFee = sellTotal * this.fees.btcturk.maker;
        const sellNet = sellTotal - sellFee;

        // Binance'te BUY (market - taker fee - SLIPPAGE DAHİL)
        const buyPrice = slippageAnalysis.avgExecutionPrice; // Slippage dahil ortalama fiyat
        const buyTotal = buyPrice * amount;
        const buyFee = buyTotal * this.fees.binance.taker;
        const buyNet = buyTotal + buyFee;

        // Kar hesaplama
        const profit = sellNet - buyNet;
        const profitPercent = (profit / buyNet) * 100;
        const spread = ((sellPrice - slippageAnalysis.bestPrice) / slippageAnalysis.bestPrice) * 100;

        return {
            scenario: 'SELL',
            profitable: profit > 0 && profitPercent >= this.minProfit,
            
            btcturk: {
                side: 'SELL',
                price: sellPrice,
                amount: sellAmount,
                total: sellTotal,
                fee: sellFee,
                feePercent: this.fees.btcturk.maker * 100,
                net: sellNet
            },
            
            binance: {
                side: 'BUY',
                bestPrice: slippageAnalysis.bestPrice,
                avgPrice: buyPrice,
                slippage: slippageAnalysis.slippage,
                slippagePercent: slippageAnalysis.slippage, // Number olarak (toFixed dışarıda)
                amount: amount,
                total: buyTotal,
                fee: buyFee,
                feePercent: this.fees.binance.taker * 100,
                net: buyNet,
                levelsUsed: slippageAnalysis.levelsNeeded
            },
            
            profit: {
                amount: profit,
                percent: profitPercent,
                spread: spread
            },
            
            slippageImpact: {
                priceWithoutSlippage: slippageAnalysis.bestPrice,
                priceWithSlippage: buyPrice,
                difference: buyPrice - slippageAnalysis.bestPrice,
                differencePercent: slippageAnalysis.slippage
            },
            
            meetsMinProfit: profitPercent >= this.minProfit,
            meetsMinSpread: spread >= this.minSpread
        };
    }

    /**
     * FAZ 2: GELIŞMIŞ Karlılık Hesaplama - Slippage Dahil (BUY Senaryosu)
     * Order book depth kullanarak gerçekçi slippage ile karlılık hesaplar
     * 
     * @param {number} btcturkAsk - BTCTurk ask fiyatı
     * @param {Array<{price, amount}>} binanceOrderBook - Binance order book bids
     * @param {number} amount - Trade miktarı
     * @returns {object} Slippage dahil karlılık analizi
     */
    calculateProfitability_Buy_WithSlippage(btcturkAsk, binanceOrderBook, amount = this.tradeAmount) {
        // Binance'te market SELL slippage analizi
        const slippageAnalysis = this.analyzeOrderBookDepth(binanceOrderBook, amount, 'bid');
        
        if (!slippageAnalysis.hasEnoughLiquidity) {
            return {
                profitable: false,
                reason: 'Insufficient liquidity on Binance',
                slippageAnalysis
            };
        }
        
        // Binance'te SELL (market - taker fee - SLIPPAGE DAHİL)
        const sellPrice = slippageAnalysis.avgExecutionPrice;
        const sellTotal = sellPrice * amount;
        const sellFee = sellTotal * this.fees.binance.taker;
        const sellNet = sellTotal - sellFee;

        // BTCTurk'te BUY (limit - maker fee)
        const buyPrice = btcturkAsk;
        const buyTotal = buyPrice * amount;
        const buyFee = buyTotal * this.fees.btcturk.maker;
        const buyNet = buyTotal + buyFee;

        // Kar hesaplama
        const profit = sellNet - buyNet;
        const profitPercent = (profit / buyNet) * 100;
        const spread = ((slippageAnalysis.bestPrice - buyPrice) / buyPrice) * 100;

        return {
            scenario: 'BUY',
            profitable: profit > 0 && profitPercent >= this.minProfit,
            
            binance: {
                side: 'SELL',
                bestPrice: slippageAnalysis.bestPrice,
                avgPrice: sellPrice,
                slippage: slippageAnalysis.slippage,
                slippagePercent: slippageAnalysis.slippage, // Number olarak (toFixed dışarıda)
                amount: amount,
                total: sellTotal,
                fee: sellFee,
                feePercent: this.fees.binance.taker * 100,
                net: sellNet,
                levelsUsed: slippageAnalysis.levelsNeeded
            },
            
            btcturk: {
                side: 'BUY',
                price: buyPrice,
                amount: amount,
                total: buyTotal,
                fee: buyFee,
                feePercent: this.fees.btcturk.maker * 100,
                net: buyNet
            },
            
            profit: {
                amount: profit,
                percent: profitPercent,
                spread: spread
            },
            
            slippageImpact: {
                priceWithoutSlippage: slippageAnalysis.bestPrice,
                priceWithSlippage: sellPrice,
                difference: slippageAnalysis.bestPrice - sellPrice,
                differencePercent: slippageAnalysis.slippage
            },
            
            meetsMinProfit: profitPercent >= this.minProfit,
            meetsMinSpread: spread >= this.minSpread
        };
    }

    /**
     * SELL senaryosu için optimal limit emir fiyatı hesapla
     * BTCTurk'te SELL limit emri için fiyat
     * 
     * PHASE 1 - Profesyonel Aggressive Pricing
     * Strateji:
     * 1. Binance ask fiyatını baz al (bu fiyattan market BUY yapacağız)
     * 2. Binance fee'sini ekle (taker fee)
     * 3. Hedef kar marjını ekle
     * 4. BTCTurk fee'sini ekle (maker fee)
     * (spreadBuffer KALDIRILDI - double padding problemi çözüldü)
     * 
     * @param {number} binanceAsk - Binance ask fiyatı
     * @param {number} targetProfitPercent - Hedef kar yüzdesi (default: minProfit)
     * @param {number} spreadBuffer - KULLANILMIYOR (geriye uyumluluk için)
     * @returns {object} Hesaplanan fiyat bilgisi
     */
    calculateOrderPrice_Sell(binanceAsk, targetProfitPercent = this.minProfit, spreadBuffer = 0) {
        // 1. Binance'te alış maliyeti (ask + taker fee)
        const binanceBuyCost = binanceAsk * (1 + this.fees.binance.taker);
        
        // 2. Hedef kar ekleme
        const withProfit = binanceBuyCost * (1 + targetProfitPercent / 100);
        
        // 3. BTCTurk maker fee'yi ters hesaplama (satış fiyatından fee düşülecek)
        // price * (1 - maker_fee) = withProfit
        // price = withProfit / (1 - maker_fee)
        const withBtcturkFee = withProfit / (1 - this.fees.btcturk.maker);
        
        // 4. PHASE 1: spreadBuffer kaldırıldı - aggressive pricing
        const finalPrice = withBtcturkFee;
        
        // Precision kontrolü (4 decimal)
        const roundedPrice = parseFloat(finalPrice.toFixed(4));
        
        return {
            scenario: 'SELL',
            binanceAsk,
            binanceBuyCost,
            targetProfit: targetProfitPercent,
            spreadBuffer: 0, // PHASE 1: Artık kullanılmıyor
            calculatedPrice: finalPrice,
            orderPrice: roundedPrice,
            breakdown: {
                binanceAsk: binanceAsk,
                binanceFee: binanceAsk * this.fees.binance.taker,
                targetProfit: binanceBuyCost * (targetProfitPercent / 100),
                btcturkFee: roundedPrice * this.fees.btcturk.maker,
                spreadBuffer: 0 // PHASE 1: Kaldırıldı
            }
        };
    }

    /**
     * BUY senaryosu için optimal limit emir fiyatı hesapla
     * BTCTurk'te BUY limit emri için fiyat
     * 
     * PHASE 1 - Profesyonel Aggressive Pricing
     * Strateji:
     * 1. Binance bid fiyatını baz al (bu fiyattan market SELL yapacağız)
     * 2. Binance fee'sini düş (taker fee)
     * 3. Hedef kar marjını düş
     * 4. BTCTurk fee'sini düş (maker fee)
     * (spreadBuffer KALDIRILDI - double padding problemi çözüldü)
     * 
     * @param {number} binanceBid - Binance bid fiyatı
     * @param {number} targetProfitPercent - Hedef kar yüzdesi (default: minProfit)
     * @param {number} spreadBuffer - KULLANILMIYOR (geriye uyumluluk için)
     * @returns {object} Hesaplanan fiyat bilgisi
     */
    calculateOrderPrice_Buy(binanceBid, targetProfitPercent = this.minProfit, spreadBuffer = 0) {
        // 1. Binance'te satış geliri (bid - taker fee)
        const binanceSellRevenue = binanceBid * (1 - this.fees.binance.taker);
        
        // 2. Hedef kar düşme
        const withProfit = binanceSellRevenue * (1 - targetProfitPercent / 100);
        
        // 3. BTCTurk maker fee'yi ters hesaplama (alış fiyatına fee eklenecek)
        // price * (1 + maker_fee) = withProfit
        // price = withProfit / (1 + maker_fee)
        const withBtcturkFee = withProfit / (1 + this.fees.btcturk.maker);
        
        // 4. PHASE 1: spreadBuffer kaldırıldı - aggressive pricing
        const finalPrice = withBtcturkFee;
        
        // Precision kontrolü (4 decimal)
        const roundedPrice = parseFloat(finalPrice.toFixed(4));
        
        return {
            scenario: 'BUY',
            binanceBid,
            binanceSellRevenue,
            targetProfit: targetProfitPercent,
            spreadBuffer: 0, // PHASE 1: Artık kullanılmıyor
            calculatedPrice: finalPrice,
            orderPrice: roundedPrice,
            breakdown: {
                binanceBid: binanceBid,
                binanceFee: binanceBid * this.fees.binance.taker,
                targetProfit: binanceSellRevenue * (targetProfitPercent / 100),
                btcturkFee: roundedPrice * this.fees.btcturk.maker,
                spreadBuffer: 0 // PHASE 1: Kaldırıldı
            }
        };
    }

    /**
     * Verilen piyasa fiyatları için optimal emir fiyatını hesapla
     * Belirtilen senaryoya göre emir fiyatı döndürür
     * 
     * PHASE 1 - spreadBuffer kaldırıldı (default 0)
     * 
     * @param {object} prices - Piyasa fiyatları
     * @param {string} scenario - 'SELL' veya 'BUY' senaryosu
     * @param {number} targetProfitPercent - Hedef kar yüzdesi
     * @param {number} spreadBuffer - KULLANILMIYOR (geriye uyumluluk için)
     * @returns {object} Optimal emir fiyatı ve senaryo
     */
    calculateOrderPrice(prices, scenario, targetProfitPercent = this.minProfit, spreadBuffer = 0) {
        // Belirtilen senaryoya göre fiyat hesapla
        let orderPricing;
        
        if (scenario === 'SELL') {
            // SELL: BTCTurk'te SELL, Binance'de BUY
            orderPricing = this.calculateOrderPrice_Sell(
                prices.binanceAsk,  // Binance'de alacağız (ASK)
                targetProfitPercent,
                0 // PHASE 1: spreadBuffer kaldırıldı
            );
        } else {
            // BUY: BTCTurk'te BUY, Binance'de SELL
            orderPricing = this.calculateOrderPrice_Buy(
                prices.binanceBid,  // Binance'de satacağız (BID)
                targetProfitPercent,
                0 // PHASE 1: spreadBuffer kaldırıldı
            );
        }
        
        return {
            ...orderPricing,
            scenario: scenario
        };
    }

    /**
     * Bakiyelere göre hangi tarafta işlem yapılacağını belirle
     * 
     * Strateji:
     * - BTCTurk'te XRP varsa → SELL (BTCTurk SELL + Binance BUY)
     * - Binance'te XRP varsa → BUY (Binance SELL + BTCTurk BUY)
     * - Her ikisinde de varsa → En karlı senaryoya göre
     * 
     * @param {object} balances - Bakiye bilgileri
     * @param {object} balances.btcturk - BTCTurk bakiyesi
     * @param {number} balances.btcturk.XRP - XRP bakiyesi
     * @param {number} balances.btcturk.USDT - USDT bakiyesi
     * @param {object} balances.binance - Binance bakiyesi
     * @param {number} balances.binance.XRP - XRP bakiyesi
     * @param {number} balances.binance.USDT - USDT bakiyesi
     * @param {object} prices - Piyasa fiyatları (opsiyonel, karlılık karşılaştırması için)
     * @returns {object} Emir yönü ve detayları
     */
    determineOrderSide(balances, prices = null) {
        const baseCoin = this.pairConfig.baseCoin;
        const btcturkBase = balances.btcturk[baseCoin] || 0;
        const binanceBase = balances.binance[baseCoin] || 0;
        const btcturkUSDT = balances.btcturk.USDT || 0;
        const binanceUSDT = balances.binance.USDT || 0;

        // Trade için yeterli baseCoin var mı kontrol
        const hasBtcturkBase = btcturkBase >= this.tradeAmount;
        const hasBinanceBase = binanceBase >= this.tradeAmount;

        logger.info('💼 Bakiye kontrolü yapılıyor', {
            btcturk: {
                [baseCoin]: btcturkBase.toFixed(2),
                USDT: btcturkUSDT.toFixed(2),
                [`hasEnough${baseCoin}`]: hasBtcturkBase
            },
            binance: {
                [baseCoin]: binanceBase.toFixed(2),
                USDT: binanceUSDT.toFixed(2),
                [`hasEnough${baseCoin}`]: hasBinanceBase
            },
            [`required${baseCoin}`]: this.tradeAmount
        });

        // Hiçbir yerde yeterli baseCoin yok
        if (!hasBtcturkBase && !hasBinanceBase) {
            return {
                possible: false,
                reason: `Insufficient ${baseCoin} balance on both exchanges`,
                [`btcturk${baseCoin}`]: btcturkBase,
                [`binance${baseCoin}`]: binanceBase,
                [`required${baseCoin}`]: this.tradeAmount
            };
        }

        // Sadece BTCTurk'te baseCoin var → SELL senaryosu
        if (hasBtcturkBase && !hasBinanceBase) {
            // Binance'te USDT kontrolü
            const requiredUSDT = this.calculateRequiredBalance('BUY', prices?.binanceAsk || 0);
            const hasEnoughUSDT = binanceUSDT >= requiredUSDT;

            return {
                possible: hasEnoughUSDT,
                scenario: 'SELL',
                btcturkSide: 'SELL',
                binanceSide: 'BUY',
                reason: hasBtcturkBase ? `${baseCoin} only available on BTCTurk` : 'Insufficient USDT on Binance',
                balances: {
                    [`btcturk${baseCoin}`]: btcturkBase,
                    binanceUSDT,
                    requiredUSDT
                }
            };
        }

        // Sadece Binance'te baseCoin var → BUY senaryosu
        if (!hasBtcturkBase && hasBinanceBase) {
            // BTCTurk'te USDT kontrolü
            const requiredUSDT = this.calculateRequiredBalance('SELL', prices?.btcturkAsk || 0);
            const hasEnoughUSDT = btcturkUSDT >= requiredUSDT;

            return {
                possible: hasEnoughUSDT,
                scenario: 'BUY',
                btcturkSide: 'BUY',
                binanceSide: 'SELL',
                reason: hasBinanceBase ? `${baseCoin} only available on Binance` : 'Insufficient USDT on BTCTurk',
                balances: {
                    [`binance${baseCoin}`]: binanceBase,
                    btcturkUSDT,
                    requiredUSDT
                }
            };
        }

        // Her iki borsada da baseCoin var → En karlı senaryoya göre
        if (hasBtcturkBase && hasBinanceBase && prices) {
            const profitability = this.calculateProfitability(prices);
            const bestScenario = profitability.bestScenario.scenario;

            if (bestScenario === 'SELL') {
                const requiredUSDT = this.calculateRequiredBalance('BUY', prices.binanceAsk);
                const hasEnoughUSDT = binanceUSDT >= requiredUSDT;

                return {
                    possible: hasEnoughUSDT,
                    scenario: 'SELL',
                    btcturkSide: 'SELL',
                    binanceSide: 'BUY',
                    reason: 'SELL scenario is more profitable',
                    profitability: profitability.bestScenario.profit,
                    balances: {
                        [`btcturk${baseCoin}`]: btcturkBase,
                        binanceUSDT,
                        requiredUSDT
                    }
                };
            } else {
                const requiredUSDT = this.calculateRequiredBalance('SELL', prices.btcturkAsk);
                const hasEnoughUSDT = btcturkUSDT >= requiredUSDT;

                return {
                    possible: hasEnoughUSDT,
                    scenario: 'BUY',
                    btcturkSide: 'BUY',
                    binanceSide: 'SELL',
                    reason: 'BUY scenario is more profitable',
                    profitability: profitability.bestScenario.profit,
                    balances: {
                        [`binance${baseCoin}`]: binanceBase,
                        btcturkUSDT,
                        requiredUSDT
                    }
                };
            }
        }

        // Fiyat bilgisi olmadan her iki tarafta da baseCoin var
        return {
            possible: true,
            scenario: 'BOTH_AVAILABLE',
            reason: `${baseCoin} available on both exchanges, need prices to determine best scenario`,
            balances: {
                [`btcturk${baseCoin}`]: btcturkBase,
                [`binance${baseCoin}`]: binanceBase,
                btcturkUSDT,
                binanceUSDT
            }
        };
    }

    /**
     * İşlem için gerekli bakiyeyi hesapla
     *
     * @param {string} side - İşlem yönü ('BUY' veya 'SELL')
     * @param {number} price - İşlem fiyatı (USDT)
     * @returns {number} Gerekli USDT miktarı
     */
    calculateRequiredBalance(side, price) {
        if (side === 'BUY') {
            // Market BUY için gerekli USDT (fiyat + taker fee + slippage buffer)
            const baseAmount = price * this.tradeAmount;
            const fee = baseAmount * this.fees.binance.taker;
            const slippage = baseAmount * this.slippageBuffer; // Market order kayması için güvenlik marjı
            return baseAmount + fee + slippage;
        } else if (side === 'SELL') {
            // Limit BUY için gerekli USDT (fiyat + maker fee)
            // Not: Limit order'da slippage yok, fiyat garantili
            const baseAmount = price * this.tradeAmount;
            const fee = baseAmount * this.fees.btcturk.maker;
            return baseAmount + fee;
        }
        return 0;
    }

    /**
     * Bakiye doğrulama - Yeterli bakiye var mı kontrol et
     * 
     * @param {object} balances - Bakiye bilgileri
     * @param {string} scenario - 'SELL' veya 'BUY'
     * @param {object} prices - Piyasa fiyatları
     * @returns {object} Validasyon sonucu
     */
    validateBalance(balances, scenario, prices) {
        const baseCoin = this.pairConfig.baseCoin;

        if (scenario === 'SELL') {
            // BTCTurk'te baseCoin, Binance'te USDT kontrolü
            const hasBaseCoin = balances.btcturk[baseCoin] >= this.tradeAmount;

            // Fiyat kontrolü
            if (!prices || !prices.binanceAsk || prices.binanceAsk <= 0) {
                return {
                    valid: false,
                    scenario: 'SELL',
                    reason: 'Binance ask price not available',
                    checks: {}
                };
            }

            const requiredUSDT = this.calculateRequiredBalance('BUY', prices.binanceAsk);
            const hasUSDT = balances.binance.USDT >= requiredUSDT;

            return {
                valid: hasBaseCoin && hasUSDT,
                scenario: 'SELL',
                checks: {
                    [`btcturk${baseCoin}`]: {
                        required: this.tradeAmount,
                        available: balances.btcturk[baseCoin],
                        sufficient: hasBaseCoin
                    },
                    binanceUSDT: {
                        required: requiredUSDT,
                        available: balances.binance.USDT,
                        sufficient: hasUSDT
                    }
                },
                reason: !hasBaseCoin ? `Insufficient ${baseCoin} on BTCTurk` :
                        !hasUSDT ? 'Insufficient USDT on Binance' :
                        'Balance validation passed'
            };
        } else if (scenario === 'BUY') {
            // Binance'te baseCoin, BTCTurk'te USDT kontrolü
            const hasBaseCoin = balances.binance[baseCoin] >= this.tradeAmount;

            // Fiyat kontrolü
            if (!prices || !prices.btcturkAsk || prices.btcturkAsk <= 0) {
                return {
                    valid: false,
                    scenario: 'BUY',
                    reason: 'BTCTurk ask price not available',
                    checks: {}
                };
            }

            const requiredUSDT = this.calculateRequiredBalance('SELL', prices.btcturkAsk);
            const hasUSDT = balances.btcturk.USDT >= requiredUSDT;

            return {
                valid: hasBaseCoin && hasUSDT,
                scenario: 'BUY',
                checks: {
                    [`binance${baseCoin}`]: {
                        required: this.tradeAmount,
                        available: balances.binance[baseCoin],
                        sufficient: hasBaseCoin
                    },
                    btcturkUSDT: {
                        required: requiredUSDT,
                        available: balances.btcturk.USDT,
                        sufficient: hasUSDT
                    }
                },
                reason: !hasBaseCoin ? `Insufficient ${baseCoin} on Binance` :
                        !hasUSDT ? 'Insufficient USDT on BTCTurk' :
                        'Balance validation passed'
            };
        }

        return {
            valid: false,
            reason: 'Invalid scenario'
        };
    }

    /**
     * Mevcut yapılandırmayı getir
     */
    getConfig() {
        return {
            fees: this.fees,
            minSpread: this.minSpread,
            minProfit: this.minProfit,
            tradeAmount: this.tradeAmount
        };
    }

    /**
     * Bakiye durumuna göre senaryo belirle ve hazırlık gerekiyorsa belirt
     *
     * ✅ YENİ FONKSİYON 28-10-2025:
     * Market Maker stratejisi için bakiye bazlı senaryo belirleme
     *
     * Mantık:
     * 1. XRP BTCTurk'te → SELL senaryosu
     * 2. XRP Binance'te → BUY senaryosu
     * 3. Her iki borsada da YOK → Binance market BUY (hazırlık) → SELL döngüsü
     * 4. Her iki borsada da VAR → Binance market SELL (hazırlık) → SELL döngüsü
     *
     * @param {object} balances - Bakiye bilgileri
     * @param {number} balances.btcturk.XRP - BTCTurk XRP bakiyesi
     * @param {number} balances.btcturk.USDT - BTCTurk USDT bakiyesi
     * @param {number} balances.binance.XRP - Binance XRP bakiyesi
     * @param {number} balances.binance.USDT - Binance USDT bakiyesi
     * @returns {object} Senaryo bilgisi
     */
    determineScenario(balances, prices) {
        const baseCoin = this.pairConfig.baseCoin;
        const btcturkBase = balances.btcturk[baseCoin];
        const binanceBase = balances.binance[baseCoin];
        const btcturkUSDT = balances.btcturk.USDT;
        const binanceUSDT = balances.binance.USDT;
        const tradeAmount = this.tradeAmount;
        const tolerance = this.pairConfig.binance.stepSize; // Binance LOT_SIZE minimum (stepSize - dinamik)

        // Durum 1: baseCoin sadece BTCTurk'te var (>= tradeAmount - tolerance)
        if (btcturkBase >= (tradeAmount - tolerance) && binanceBase < (tradeAmount - tolerance)) {
            logger.info(`📊 Senaryo: ${baseCoin} BTCTurk'te → SELL senaryosu`);
            return {
                scenario: 'SELL',
                btcturkSide: 'sell',
                binanceSide: 'buy',
                needsPreparation: false,
                reason: `${baseCoin} available on BTCTurk`,
                balances: {
                    [`btcturk${baseCoin}`]: btcturkBase,
                    [`binance${baseCoin}`]: binanceBase,
                    btcturkUSDT,
                    binanceUSDT
                }
            };
        }

        // Durum 2: baseCoin sadece Binance'te var (>= tradeAmount - tolerance)
        if (binanceBase >= (tradeAmount - tolerance) && btcturkBase < (tradeAmount - tolerance)) {
            logger.info(`📊 Senaryo: ${baseCoin} Binance'te → BUY senaryosu`);
            return {
                scenario: 'BUY',
                btcturkSide: 'buy',
                binanceSide: 'sell',
                needsPreparation: false,
                reason: `${baseCoin} available on Binance`,
                balances: {
                    [`btcturk${baseCoin}`]: btcturkBase,
                    [`binance${baseCoin}`]: binanceBase,
                    btcturkUSDT,
                    binanceUSDT
                }
            };
        }

        // Durum 3: Her iki borsada da baseCoin YOK (< tradeAmount - tolerance)
        if (btcturkBase < (tradeAmount - tolerance) && binanceBase < (tradeAmount - tolerance)) {
            logger.info(`📊 Senaryo: Her iki borsada da ${baseCoin} yok → Hazırlık gerekli`);

            // Binance'te yeterli USDT var mı?
            const estimatedCost = tradeAmount * prices.binanceAsk * (1 + this.fees.binance.taker);
            const hasEnoughUSDT = binanceUSDT >= estimatedCost;

            if (!hasEnoughUSDT) {
                return {
                    scenario: null,
                    needsPreparation: true,
                    canPrepare: false,
                    reason: 'Insufficient USDT on Binance for initialization trade',
                    requiredUSDT: estimatedCost,
                    availableUSDT: binanceUSDT,
                    balances: {
                        [`btcturk${baseCoin}`]: btcturkBase,
                        [`binance${baseCoin}`]: binanceBase,
                        btcturkUSDT,
                        binanceUSDT
                    }
                };
            }

            return {
                scenario: 'SELL', // Hedef senaryo (hazırlık sonrası)
                btcturkSide: 'sell',
                binanceSide: 'buy',
                needsPreparation: true,
                canPrepare: true,
                preparationType: 'BINANCE_BUY',
                preparationDetails: {
                    exchange: 'Binance',
                    side: 'BUY',
                    amount: roundToBinanceLOT_SIZE(tradeAmount, this.pairConfig.binance.stepSize), // Dinamik stepSize
                    reason: 'Initialize arbitrage cycle with BUY on Binance (lower fees)'
                },
                reason: `No ${baseCoin} on either exchange, need to buy on Binance first`,
                balances: {
                    [`btcturk${baseCoin}`]: btcturkBase,
                    [`binance${baseCoin}`]: binanceBase,
                    btcturkUSDT,
                    binanceUSDT
                }
            };
        }

        // Durum 4: Her iki borsada da baseCoin VAR (>= tradeAmount - tolerance)
        if (btcturkBase >= (tradeAmount - tolerance) && binanceBase >= (tradeAmount - tolerance)) {
            logger.info(`📊 Senaryo: Her iki borsada da ${baseCoin} var → Binance'i boşalt`);

            return {
                scenario: 'SELL', // Hedef senaryo (hazırlık sonrası)
                btcturkSide: 'sell',
                binanceSide: 'buy',
                needsPreparation: true,
                canPrepare: true,
                preparationType: 'BINANCE_SELL',
                preparationDetails: {
                    exchange: 'Binance',
                    side: 'SELL',
                    amount: roundToBinanceLOT_SIZE(binanceBase, this.pairConfig.binance.stepSize), // Dinamik stepSize
                    reason: `Clear Binance ${baseCoin} to maintain single-sided balance`
                },
                reason: `${baseCoin} on both exchanges, consolidate to BTCTurk for SELL cycle`,
                balances: {
                    [`btcturk${baseCoin}`]: btcturkBase,
                    [`binance${baseCoin}`]: binanceBase,
                    btcturkUSDT,
                    binanceUSDT
                }
            };
        }

        // Geçersiz durum (olmaması gereken bir durum)
        logger.warn('⚠️ Belirsiz bakiye durumu');
        return {
            scenario: null,
            needsPreparation: false,
            reason: 'Unclear balance situation',
            balances: {
                btcturkXRP,
                binanceXRP,
                btcturkUSDT,
                binanceUSDT
            }
        };
    }

    /**
     * Engine durumunu yazdır
     */
    printStatus() {
        console.log('\n' + '='.repeat(60));
        console.log('🤖 ARBITRAGE ENGINE STATUS');
        console.log('='.repeat(60));
        console.log('\n💸 Fee Configuration:');
        console.log(`  BTCTurk Maker: ${(this.fees.btcturk.maker * 100).toFixed(2)}%`);
        console.log(`  BTCTurk Taker: ${(this.fees.btcturk.taker * 100).toFixed(2)}%`);
        console.log(`  Binance Maker: ${(this.fees.binance.maker * 100).toFixed(2)}%`);
        console.log(`  Binance Taker: ${(this.fees.binance.taker * 100).toFixed(2)}%`);
        console.log('\n💰 Trading Parameters:');
        console.log(`  Pair: ${this.pairConfig.symbol}`);
        console.log(`  Trade Amount: ${this.tradeAmount} ${this.pairConfig.baseCoin}`);
        console.log(`  Min Spread: ${this.minSpread}%`);
        console.log(`  Min Profit: ${this.minProfit}%`);
        console.log('\n' + '='.repeat(60) + '\n');
    }
}

export default ArbitrageEngine;
