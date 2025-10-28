/**
 * BTCTurk WebSocket Test Script
 */

import BTCTurkClient from './BTCTurkClient.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

console.log('\n🧪 BTCTurk WebSocket Test Başlatılıyor...\n');

const client = new BTCTurkClient(config.btcturk);

// Fiyat güncellemelerini dinle
let updateCount = 0;
const priceUpdateHandler = (data) => {
    updateCount++;
    console.log(`\n📊 Fiyat Güncelleme #${updateCount}:`);
    console.log('─────────────────────────────');
    console.log(`Symbol: ${data.symbol}`);
    console.log(`Bid:    ${data.bid} USDT`);
    console.log(`Ask:    ${data.ask} USDT`);
    console.log(`Last:   ${data.last} USDT`);
    console.log(`Spread: ${(data.ask - data.bid).toFixed(4)} USDT (${(((data.ask - data.bid) / data.bid) * 100).toFixed(3)}%)`);
    console.log(`Volume: ${data.volume.toFixed(2)}`);
    console.log(`Daily:  ${data.dailyPercent > 0 ? '+' : ''}${data.dailyPercent.toFixed(2)}%`);
    console.log('─────────────────────────────');
};

async function runWebSocketTest() {
    try {
        logger.info('📡 WebSocket bağlantısı kuruluyor...');
        await client.connectWebSocket(priceUpdateHandler, 'XRPUSDT');
        
        logger.info('✅ WebSocket bağlantısı kuruldu');
        logger.info('⏳ Fiyat güncellemelerini bekliyorum (30 saniye)...');
        logger.info('💡 CTRL+C ile çıkış yapabilirsiniz\n');
        
        // 30 saniye bekle
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        logger.info(`\n📊 Toplam ${updateCount} fiyat güncellemesi alındı`);
        
        // Bağlantıyı kapat
        await client.disconnect();
        
        logger.info('✅ Test tamamlandı!\n');
        process.exit(0);
        
    } catch (error) {
        logger.error('❌ WebSocket test hatası:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('\n👋 Test sonlandırılıyor...');
    await client.disconnect();
    process.exit(0);
});

runWebSocketTest();
