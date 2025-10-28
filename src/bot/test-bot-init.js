/**
 * ArbitrageBot Test
 * Task 3.1 ve 3.2 - Bot initialization ve temel fonksiyonlar
 */

import ArbitrageBot from './ArbitrageBot.js';
import logger from '../utils/logger.js';

console.log('\n' + '='.repeat(80));
console.log('🧪 ARBITRAGE BOT - INITIALIZATION TESTİ');
console.log('='.repeat(80) + '\n');

async function testBot() {
    try {
        // Bot oluştur
        console.log('📦 Bot oluşturuluyor...\n');
        const bot = new ArbitrageBot({
            tradeAmount: 10,
            minProfit: 0.1,
            minSpread: 0.3
        });
        
        // Initialize
        console.log('\n🚀 Bot initialize ediliyor...\n');
        await bot.initialize();
        
        // Durum yazdır
        console.log('\n📊 Bot durumu:');
        bot.printStatus();
        
        // 5 saniye bekle (WebSocket mesajları için)
        console.log('⏳ 5 saniye WebSocket mesajları bekleniyor...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Bot'u başlat
        console.log('\n▶️  Bot başlatılıyor...\n');
        await bot.start();
        
        // 10 saniye çalışmasını bekle
        console.log('⏳ 10 saniye bot çalıştırılıyor...\n');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Son durum
        console.log('\n📊 Son durum:');
        bot.printStatus();
        
        // Bot'u durdur
        console.log('\n⏸️  Bot durduruluyor...\n');
        await bot.stop();
        
        console.log('\n✅ Test tamamlandı!\n');
        
    } catch (error) {
        logger.error('❌ Test hatası', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Test'i çalıştır
testBot();
