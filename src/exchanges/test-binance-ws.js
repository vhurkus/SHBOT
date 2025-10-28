/**
 * Binance WebSocket Test
 * Gerçek zamanlı fiyat güncellemelerini test eder
 */

import dotenv from 'dotenv';
import BinanceClient from './BinanceClient.js';
import logger from '../utils/logger.js';

// .env dosyasını yükle
dotenv.config();

const binance = new BinanceClient({
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    baseURL: 'https://api.binance.com'
});

let updateCount = 0;
let lastBid = 0;
let lastAsk = 0;
const startTime = Date.now();

console.log('\n🚀 Binance WebSocket Test Başlatılıyor...\n');
console.log('📊 Stream: XRPUSDT@bookTicker (En iyi bid/ask fiyatları)');
console.log('⏱️  Süre: 30 saniye\n');

// WebSocket callback fonksiyonu
const handlePriceUpdate = (data) => {
    updateCount++;
    
    // Fiyat değişim göstergesi
    const bidChange = lastBid > 0 ? (data.bid > lastBid ? '↑' : data.bid < lastBid ? '↓' : '→') : '→';
    const askChange = lastAsk > 0 ? (data.ask > lastAsk ? '↑' : data.ask < lastAsk ? '↓' : '→') : '→';
    
    const spread = (data.ask - data.bid).toFixed(4);
    const spreadPercent = ((spread / data.bid) * 100).toFixed(3);
    
    console.log(
        `[${updateCount.toString().padStart(3)}] ` +
        `${bidChange} BID: ${data.bid.toFixed(4)} (${data.bidQty.toFixed(2)} XRP) | ` +
        `${askChange} ASK: ${data.ask.toFixed(4)} (${data.askQty.toFixed(2)} XRP) | ` +
        `SPREAD: ${spread} (${spreadPercent}%)`
    );
    
    lastBid = data.bid;
    lastAsk = data.ask;
};

// WebSocket'i başlat
binance.connectWebSocket(handlePriceUpdate);

// 30 saniye sonra test sonuçlarını göster
setTimeout(() => {
    const duration = (Date.now() - startTime) / 1000;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Test Sonuçları:');
    console.log('='.repeat(80));
    console.log(`✅ Toplam Güncelleme: ${updateCount} adet`);
    console.log(`⏱️  Süre: ${duration.toFixed(1)} saniye`);
    console.log(`📈 Saniyedeki Güncelleme: ${(updateCount / duration).toFixed(2)} update/s`);
    console.log(`💹 Son Bid: ${lastBid.toFixed(4)} USDT`);
    console.log(`💹 Son Ask: ${lastAsk.toFixed(4)} USDT`);
    console.log(`📊 Son Spread: ${(lastAsk - lastBid).toFixed(4)} USDT`);
    console.log('='.repeat(80));
    
    // Bağlantıyı kapat ve çık
    binance.disconnectWebSocket();
    
    setTimeout(() => {
        process.exit(0);
    }, 500);
    
}, 30000);

// Hata yakalama
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled rejection:', error);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n\n⚠️  Test manuel olarak durduruldu');
    binance.disconnectWebSocket();
    process.exit(0);
});
