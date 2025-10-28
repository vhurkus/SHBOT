/**
 * Logger Test Script
 * Tests all logger functionality
 */

import logger from './logger.js';

console.log('\n🧪 Logger Test Başlatılıyor...\n');

// Test 1: Farklı log seviyeleri
logger.info('✅ Info seviyesi test');
logger.warn('⚠️  Warn seviyesi test');
logger.error('❌ Error seviyesi test');
logger.debug('🔍 Debug seviyesi test');

// Test 2: Metadata ile loglama
logger.info('📊 Metadata ile log testi', {
    exchange: 'BTCTurk',
    symbol: 'XRPTRY',
    price: 19.5432
});

// Test 3: Özel helper metodlar
logger.trade('Yeni trade başlatıldı', {
    side: 'BUY',
    amount: 10,
    price: 19.50
});

logger.order('Limit emir oluşturuldu', {
    orderId: '12345',
    symbol: 'XRPTRY',
    type: 'LIMIT',
    side: 'SELL'
});

logger.balance('Bakiye güncellendi', {
    btcturk: { XRP: 10, TRY: 1000 },
    binance: { XRP: 0, USDT: 500 }
});

logger.websocket('WebSocket bağlantısı kuruldu', {
    exchange: 'BTCTurk',
    channel: 'ticker'
});

logger.api('API isteği gönderildi', {
    method: 'GET',
    endpoint: '/api/v1/balances',
    status: 200
});

logger.profit('Kar hesaplandı', {
    grossProfit: 5.25,
    netProfit: 4.80,
    profitPercent: 0.25
});

// Test 4: Error stack trace
try {
    throw new Error('Test hatası - Bu bir test hatasıdır');
} catch (error) {
    logger.error('Hata yakalandı', { error: error.message, stack: error.stack });
}

console.log('\n✅ Logger testleri tamamlandı!');
console.log('📁 Log dosyalarını kontrol edin: logs/ klasörü\n');
