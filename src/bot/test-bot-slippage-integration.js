/**
 * Test: ArbitrageBot Faz 2 Entegrasyonu - Slippage Kontrolü
 * 
 * Test senaryoları:
 * 1. createNewOrder() - Slippage ile karlılık hesabı
 * 2. executeCounterOrder() - Counter order öncesi slippage kontrolü
 * 3. Gerçek order book ile entegrasyon testi
 */

import ArbitrageBot from './ArbitrageBot.js';
import ArbitrageEngine from './ArbitrageEngine.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

// Mock Binance Client (test için)
class MockBinanceClient {
    constructor(scenario = 'normal') {
        this.scenario = scenario;
    }

    async getOrderBook(symbol, limit = 20) {
        // Farklı slippage senaryoları
        const scenarios = {
            // Düşük slippage - Derin likidite
            low: {
                symbol: 'XRPUSDT',
                timestamp: Date.now(),
                lastUpdateId: 123456789,
                bids: [
                    { price: 0.5000, amount: 10000 },  // 50 XRP için yeterli
                    { price: 0.4999, amount: 10000 },
                    { price: 0.4998, amount: 10000 },
                ],
                asks: [
                    { price: 0.5010, amount: 10000 },  // 50 XRP için yeterli
                    { price: 0.5011, amount: 10000 },
                    { price: 0.5012, amount: 10000 },
                ]
            },
            // Orta slippage - Normal likidite
            normal: {
                symbol: 'XRPUSDT',
                timestamp: Date.now(),
                lastUpdateId: 123456790,
                bids: [
                    { price: 0.5000, amount: 30 },     // 1. seviye yetersiz
                    { price: 0.4999, amount: 100 },    // 2. seviye kullanılacak
                    { price: 0.4998, amount: 500 },
                ],
                asks: [
                    { price: 0.5010, amount: 30 },     // 1. seviye yetersiz
                    { price: 0.5011, amount: 100 },    // 2. seviye kullanılacak
                    { price: 0.5012, amount: 500 },
                ]
            },
            // Yüksek slippage - Sığ likidite
            high: {
                symbol: 'XRPUSDT',
                timestamp: Date.now(),
                lastUpdateId: 123456791,
                bids: [
                    { price: 0.5000, amount: 10 },     // Çok sığ
                    { price: 0.4995, amount: 15 },     // Büyük spread
                    { price: 0.4990, amount: 30 },     // Daha da büyük spread
                    { price: 0.4985, amount: 100 },
                ],
                asks: [
                    { price: 0.5010, amount: 10 },     // Çok sığ
                    { price: 0.5015, amount: 15 },     // Büyük spread
                    { price: 0.5020, amount: 30 },     // Daha da büyük spread
                    { price: 0.5025, amount: 100 },
                ]
            }
        };

        return scenarios[this.scenario] || scenarios.normal;
    }

    async createMarketOrder(params) {
        logger.info('[MOCK] Binance market order:', params);
        return {
            id: 'MOCK_' + Date.now(),
            orderId: Date.now(),
            status: 'FILLED',
            executedQty: params.quantity,
            side: params.side
        };
    }
}

// Mock BTCTurk Client
class MockBTCTurkClient {
    async getBalances() {
        return {
            USDT: { free: 1000, locked: 0, total: 1000 },
            XRP: { free: 500, locked: 0, total: 500 }
        };
    }

    async createLimitOrder(params) {
        logger.info('[MOCK] BTCTurk limit order:', params);
        return {
            id: 'MOCK_BT_' + Date.now(),
            price: params.price,
            quantity: params.quantity,
            side: params.side,
            status: 'Untouched'
        };
    }

    async getOrder(orderId) {
        return {
            id: orderId,
            status: 'Closed',
            leftAmount: 0,
            executedQuantity: 50
        };
    }

    async cancelOrder(orderId) {
        logger.info('[MOCK] Order cancelled:', orderId);
        return true;
    }
}

async function testCreateOrderWithSlippage(slippageScenario) {
    console.log('\n' + '='.repeat(80));
    console.log(`📊 TEST: createNewOrder() - ${slippageScenario.toUpperCase()} Slippage Senaryosu`);
    console.log('='.repeat(80));

    const bot = new ArbitrageBot(config);
    
    // Engine'i initialize et
    bot.engine = new ArbitrageEngine(config);
    
    // Mock clients enjekte et
    bot.binance = new MockBinanceClient(slippageScenario);
    bot.btcturk = new MockBTCTurkClient();
    
    // İlk durumu ayarla - SELL senaryosu (XRP BTCTurk'te)
    bot.isInitialized = true;
    bot.balances = {
        btcturk: {
            USDT: 100,    // free
            XRP: 500      // free (trade amount: 10)
        },
        binance: {
            USDT: 100,    // free
            XRP: 0        // free (boş)
        }
    };
    bot.prices = {
        btcturk: { bid: 0.5020, ask: 0.5030 },
        binance: { bid: 0.5000, ask: 0.5010 }
    };

    // Fiyat geçmişi ekle (volatilite hesabı için)
    bot.priceHistory = [
        { price: 0.5000, timestamp: Date.now() - 30000 },
        { price: 0.5005, timestamp: Date.now() - 20000 },
        { price: 0.5010, timestamp: Date.now() - 10000 },
        { price: 0.5010, timestamp: Date.now() }
    ];

    try {
        const result = await bot.createNewOrder();
        
        if (result) {
            console.log('\n✅ Emir başarıyla oluşturuldu!');
            console.log('📋 Emir detayları:', {
                orderId: bot.currentOrder.orderId,
                side: bot.currentOrder.side,
                price: bot.currentOrder.price,
                amount: bot.currentOrder.amount,
                scenario: bot.currentOrder.scenario
            });
        } else {
            console.log('\n⚠️ Emir oluşturulamadı (slippage veya diğer kontroller)');
        }

        return result;
    } catch (error) {
        console.error('\n❌ Test hatası:', error.message);
        return false;
    }
}

async function testCounterOrderWithSlippage(slippageScenario) {
    console.log('\n' + '='.repeat(80));
    console.log(`📊 TEST: executeCounterOrder() - ${slippageScenario.toUpperCase()} Slippage Senaryosu`);
    console.log('='.repeat(80));

    const bot = new ArbitrageBot(config);
    
    // Engine'i initialize et
    bot.engine = new ArbitrageEngine(config);
    
    // Mock clients enjekte et
    bot.binance = new MockBinanceClient(slippageScenario);
    bot.btcturk = new MockBTCTurkClient();
    
    // İlk durumu ayarla
    bot.isInitialized = true;
    bot.currentOrder = {
        active: true,
        txId: 'TEST_TX_' + Date.now(),
        orderId: 'TEST_ORDER_123',
        scenario: 'SELL',
        price: 0.5030,
        amount: 50
    };

    try {
        const result = await bot.executeCounterOrder(
            50,                     // amount
            'TEST_ORDER_123',       // originalOrderId
            bot.currentOrder.txId,  // txId
            0.50                    // profit (0.50 USDT)
        );
        
        if (result) {
            console.log('\n✅ Counter order başarıyla gerçekleşti!');
        } else {
            console.log('\n⚠️ Counter order gerçekleştirilemedi');
        }

        return result;
    } catch (error) {
        console.error('\n❌ Test hatası:', error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('\n🚀 FAZ 2 ENTEGRASYON TESTLERİ BAŞLIYOR\n');
    console.log('Test edilen özellikler:');
    console.log('  1. ✅ createNewOrder() - Slippage ile karlılık hesabı');
    console.log('  2. ✅ executeCounterOrder() - Counter order öncesi slippage kontrolü');
    console.log('  3. ✅ 3 farklı slippage senaryosu (low/normal/high)');
    console.log('');

    // Test 1: Düşük slippage - İdeal durum
    await testCreateOrderWithSlippage('low');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Normal slippage - Günlük kullanım
    await testCreateOrderWithSlippage('normal');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Yüksek slippage - Risk senaryosu
    await testCreateOrderWithSlippage('high');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 4: Counter order - Düşük slippage
    await testCounterOrderWithSlippage('low');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 5: Counter order - Yüksek slippage (uyarı verecek)
    await testCounterOrderWithSlippage('high');

    console.log('\n' + '='.repeat(80));
    console.log('✅ TÜM TESTLER TAMAMLANDI');
    console.log('='.repeat(80));
    console.log('\n📌 ÖNEMLİ NOTLAR:');
    console.log('  • Düşük slippage: Normal işlem akışı');
    console.log('  • Orta slippage: Karlılık hafif etkilenir');
    console.log('  • Yüksek slippage: ⚠️ Uyarı verilir ama counter order yine de yapılır');
    console.log('  • Counter order her durumda gerçekleşir (hedge gerekli)');
    console.log('  • createNewOrder() slippage yüksekse karlılık düşük çıkar\n');
}

// Testleri çalıştır
runAllTests().catch(err => {
    console.error('❌ Test suite hatası:', err);
    process.exit(1);
});
