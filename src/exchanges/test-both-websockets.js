/**
 * Her İki Borsa WebSocket Test
 * BTCTurk ve Binance WebSocket'lerini aynı anda test eder
 */

import dotenv from 'dotenv';
import BTCTurkClient from './BTCTurkClient.js';
import BinanceClient from './BinanceClient.js';
import logger from '../utils/logger.js';

dotenv.config();

console.log('\n🚀 Çift Borsa WebSocket Entegrasyon Testi\n');
console.log('═'.repeat(80));

// BTCTurk Client
const btcturk = new BTCTurkClient({
    apiKey: process.env.BTCTURK_API_KEY,
    apiSecret: process.env.BTCTURK_API_SECRET,
    baseURL: 'https://api.btcturk.com'
});

// Binance Client
const binance = new BinanceClient({
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    baseURL: 'https://api.binance.com'
});

// İstatistikler
const stats = {
    btcturk: {
        updates: 0,
        lastBid: 0,
        lastAsk: 0,
        startTime: Date.now()
    },
    binance: {
        updates: 0,
        lastBid: 0,
        lastAsk: 0,
        startTime: Date.now()
    },
    arbitrage: {
        opportunities: 0,
        totalSpread: 0,
        maxSpread: 0,
        minSpread: Infinity
    }
};

// BTCTurk WebSocket Handler
const handleBTCTurkPrice = (data) => {
    stats.btcturk.updates++;
    stats.btcturk.lastBid = data.bid;
    stats.btcturk.lastAsk = data.ask;
    
    // Arbitraj kontrolü
    checkArbitrage();
};

// Binance WebSocket Handler
const handleBinancePrice = (data) => {
    stats.binance.updates++;
    stats.binance.lastBid = data.bid;
    stats.binance.lastAsk = data.ask;
    
    // Arbitraj kontrolü
    checkArbitrage();
};

// Arbitraj Fırsatı Kontrolü
function checkArbitrage() {
    // Her iki borsadan da veri gelmediyse kontrol etme
    if (stats.btcturk.lastBid === 0 || stats.binance.lastBid === 0) return;
    
    // BTCTurk'te sat, Binance'de al
    const spread1 = stats.btcturk.lastBid - stats.binance.lastAsk;
    const spreadPercent1 = (spread1 / stats.binance.lastAsk) * 100;
    
    // Binance'de sat, BTCTurk'te al
    const spread2 = stats.binance.lastBid - stats.btcturk.lastAsk;
    const spreadPercent2 = (spread2 / stats.btcturk.lastAsk) * 100;
    
    // En iyi spread'i bul
    let bestSpread = 0;
    let direction = '';
    
    if (spreadPercent1 > spreadPercent2) {
        bestSpread = spreadPercent1;
        direction = 'BTCTurk → Binance';
    } else {
        bestSpread = spreadPercent2;
        direction = 'Binance → BTCTurk';
    }
    
    // İstatistikleri güncelle
    stats.arbitrage.totalSpread += Math.abs(bestSpread);
    stats.arbitrage.maxSpread = Math.max(stats.arbitrage.maxSpread, Math.abs(bestSpread));
    stats.arbitrage.minSpread = Math.min(stats.arbitrage.minSpread, Math.abs(bestSpread));
    
    // Karlı fırsat varsa say (min %0.1 kar)
    if (Math.abs(bestSpread) > 0.1) {
        stats.arbitrage.opportunities++;
        
        console.log(
            `\n💰 ARBITRAJ FIRSATI! Spread: ${bestSpread.toFixed(4)}% (${direction})`
        );
        console.log(`   BTCTurk: BID ${stats.btcturk.lastBid.toFixed(4)} / ASK ${stats.btcturk.lastAsk.toFixed(4)}`);
        console.log(`   Binance: BID ${stats.binance.lastBid.toFixed(4)} / ASK ${stats.binance.lastAsk.toFixed(4)}\n`);
    }
}

// İstatistik Gösterimi (her 5 saniyede)
setInterval(() => {
    const btcturkDuration = (Date.now() - stats.btcturk.startTime) / 1000;
    const binanceDuration = (Date.now() - stats.binance.startTime) / 1000;
    
    console.clear();
    console.log('\n📊 CANLI WebSocket İSTATİSTİKLERİ\n');
    console.log('═'.repeat(80));
    console.log('\n🇹🇷 BTCTurk:');
    console.log(`   Güncelleme: ${stats.btcturk.updates} (${(stats.btcturk.updates / btcturkDuration).toFixed(2)}/s)`);
    console.log(`   Son Fiyat: BID ${stats.btcturk.lastBid.toFixed(4)} / ASK ${stats.btcturk.lastAsk.toFixed(4)}`);
    console.log(`   Spread: ${(stats.btcturk.lastAsk - stats.btcturk.lastBid).toFixed(4)} USDT`);
    
    console.log('\n🌐 Binance:');
    console.log(`   Güncelleme: ${stats.binance.updates} (${(stats.binance.updates / binanceDuration).toFixed(2)}/s)`);
    console.log(`   Son Fiyat: BID ${stats.binance.lastBid.toFixed(4)} / ASK ${stats.binance.lastAsk.toFixed(4)}`);
    console.log(`   Spread: ${(stats.binance.lastAsk - stats.binance.lastBid).toFixed(4)} USDT`);
    
    console.log('\n💹 Arbitraj Analizi:');
    console.log(`   Fırsat Sayısı: ${stats.arbitrage.opportunities}`);
    console.log(`   Maks Spread: ${stats.arbitrage.maxSpread.toFixed(4)}%`);
    console.log(`   Min Spread: ${stats.arbitrage.minSpread === Infinity ? 'N/A' : stats.arbitrage.minSpread.toFixed(4) + '%'}`);
    
    const totalChecks = stats.btcturk.updates + stats.binance.updates;
    if (totalChecks > 0) {
        console.log(`   Fırsat Oranı: ${((stats.arbitrage.opportunities / totalChecks) * 100).toFixed(2)}%`);
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('⏹️  Durdurmak için Ctrl+C basın...\n');
    
}, 5000);

// WebSocket'leri başlat
console.log('🔌 BTCTurk WebSocket bağlanıyor...');
btcturk.connectWebSocket(handleBTCTurkPrice);

console.log('🔌 Binance WebSocket bağlanıyor...');
binance.connectWebSocket(handleBinancePrice);

console.log('\n⏳ Veriler toplanıyor...\n');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Test sonlandırılıyor...\n');
    
    const btcturkDuration = (Date.now() - stats.btcturk.startTime) / 1000;
    const binanceDuration = (Date.now() - stats.binance.startTime) / 1000;
    
    console.log('═'.repeat(80));
    console.log('📈 ÖZET RAPOR');
    console.log('═'.repeat(80));
    console.log('\n🇹🇷 BTCTurk:');
    console.log(`   ✅ Toplam Güncelleme: ${stats.btcturk.updates}`);
    console.log(`   ⏱️  Süre: ${btcturkDuration.toFixed(1)} saniye`);
    console.log(`   📊 Ortalama Hız: ${(stats.btcturk.updates / btcturkDuration).toFixed(2)} update/s`);
    
    console.log('\n🌐 Binance:');
    console.log(`   ✅ Toplam Güncelleme: ${stats.binance.updates}`);
    console.log(`   ⏱️  Süre: ${binanceDuration.toFixed(1)} saniye`);
    console.log(`   📊 Ortalama Hız: ${(stats.binance.updates / binanceDuration).toFixed(2)} update/s`);
    
    console.log('\n💹 Arbitraj:');
    console.log(`   💰 Tespit Edilen Fırsat: ${stats.arbitrage.opportunities} adet`);
    console.log(`   📈 Maksimum Spread: ${stats.arbitrage.maxSpread.toFixed(4)}%`);
    console.log(`   📉 Minimum Spread: ${stats.arbitrage.minSpread === Infinity ? 'N/A' : stats.arbitrage.minSpread.toFixed(4) + '%'}`);
    
    console.log('\n' + '═'.repeat(80));
    console.log('✅ Test başarıyla tamamlandı!\n');
    
    btcturk.disconnectWebSocket();
    binance.disconnectWebSocket();
    
    process.exit(0);
});
