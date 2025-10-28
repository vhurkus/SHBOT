/**
 * Binance Client Test Script
 */

import BinanceClient from './BinanceClient.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

console.log('\n🧪 Binance Client Test Başlatılıyor...\n');

const client = new BinanceClient(config.binance);

async function runTests() {
    try {
        // Test 1: Connection Test
        logger.info('📡 Test 1: Bağlantı testi...');
        await client.testConnection();
        
        // Test 2: Server Time
        logger.info('\n⏰ Test 2: Server time...');
        const serverTime = await client.getServerTime();
        logger.info('Server time:', new Date(serverTime.serverTime).toISOString());
        
        // Test 3: Ticker Data
        logger.info('\n📊 Test 3: Ticker verisi çekiliyor (XRPUSDT)...');
        const ticker = await client.getTicker24h('XRPUSDT');
        logger.info('Ticker verisi:', {
            symbol: ticker.symbol,
            last: ticker.last,
            bid: ticker.bid,
            ask: ticker.ask,
            volume: ticker.volume,
            priceChangePercent: ticker.priceChangePercent
        });
        
        // Test 4: Order Book
        logger.info('\n📖 Test 4: Order book çekiliyor...');
        const orderBook = await client.getOrderBook('XRPUSDT', 5);
        logger.info('Order book:', {
            bestBid: orderBook.bids[0],
            bestAsk: orderBook.asks[0],
            bidsCount: orderBook.bids.length,
            asksCount: orderBook.asks.length
        });
        
        // Test 5: Balances (requires valid API key)
        logger.info('\n💰 Test 5: Bakiyeler çekiliyor...');
        try {
            const balances = await client.getBalances();
            logger.info('Bakiyeler alındı:', {
                XRP: balances.XRP || 'Yok',
                USDT: balances.USDT || 'Yok'
            });
        } catch (error) {
            logger.warn('⚠️  Bakiye çekme başarısız (API key geçersiz olabilir)', {
                error: error.message
            });
        }
        
        // Test 6: Open Orders (requires valid API key)
        logger.info('\n📋 Test 6: Açık emirler çekiliyor...');
        try {
            const openOrders = await client.getOpenOrders('XRPUSDT');
            logger.info('Açık emirler:', {
                count: openOrders.length,
                orders: openOrders.slice(0, 3) // İlk 3 emri göster
            });
        } catch (error) {
            logger.warn('⚠️  Açık emir çekme başarısız (API key geçersiz olabilir)', {
                error: error.message
            });
        }
        
        // Test 7: Rate Limiting
        logger.info('\n⏱️  Test 7: Rate limiting testi (10 paralel istek)...');
        const startTime = Date.now();
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(client.getTicker24h('XRPUSDT'));
        }
        await Promise.all(promises);
        const elapsed = Date.now() - startTime;
        logger.info(`10 istek ${elapsed}ms'de tamamlandı (Rate limiting aktif)`);
        
        logger.info('\n✅ Tüm testler tamamlandı!\n');
        
    } catch (error) {
        logger.error('❌ Test hatası:', error);
    }
}

runTests();
