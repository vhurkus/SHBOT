/**
 * ArbitrageBot Live Test
 * Gerçek zamanlı fiyat güncellemeleri ve arbitraj kontrolü
 */

import ArbitrageBot from './ArbitrageBot.js';
import logger from '../utils/logger.js';

console.log('\n' + '='.repeat(80));
console.log('🤖 ARBITRAGE BOT - CANLI TEST');
console.log('='.repeat(80) + '\n');

async function liveTest() {
    const bot = new ArbitrageBot({
        tradeAmount: 10,
        minProfit: 0.1,
        minSpread: 0.3
    });
    
    try {
        console.log('🚀 Bot başlatılıyor...\n');
        
        // Initialize
        await bot.initialize();
        
        console.log('\n📊 İlk Durum:');
        bot.printStatus();
        
        // Bot'u başlat
        console.log('▶️  Bot çalıştırılıyor...\n');
        await bot.start();
        
        // Fiyat güncellemelerini izle
        let updateCount = 0;
        const priceInterval = setInterval(() => {
            updateCount++;
            
            const { btcturk, binance } = bot.prices;
            
            if (btcturk.bid && binance.bid) {
                const spread = ((btcturk.bid - binance.ask) / binance.ask * 100).toFixed(2);
                
                console.log(`\n📊 Güncelleme #${updateCount}:`);
                console.log(`   BTCTurk: ${btcturk.bid} / ${btcturk.ask}`);
                console.log(`   Binance: ${binance.bid} / ${binance.ask}`);
                console.log(`   Spread: ${spread}%`);
            }
        }, 5000); // Her 5 saniyede bir yazdır
        
        // 30 saniye çalıştır
        console.log('⏳ Bot 30 saniye çalışacak...\n');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // Temizlik
        clearInterval(priceInterval);
        
        // Son durum
        console.log('\n📊 Son Durum:');
        bot.printStatus();
        
        // Durdur
        console.log('⏸️  Bot durduruluyor...\n');
        await bot.stop();
        
        console.log('✅ Test tamamlandı!\n');
        process.exit(0);
        
    } catch (error) {
        logger.error('❌ Test hatası', {
            error: error.message,
            stack: error.stack
        });
        
        try {
            await bot.stop();
        } catch (e) {
            // Ignore
        }
        
        process.exit(1);
    }
}

// Test'i çalıştır
liveTest();
