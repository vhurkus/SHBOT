/**
 * Sürekli Açık Emir Stratejisi Testi
 * Continuous open order strategy ile bot'u test eder
 */

import ArbitrageBot from './ArbitrageBot.js';
import logger from '../utils/logger.js';

console.log('\n' + '='.repeat(80));
console.log('🔄 SÜREKLI AÇIK EMİR STRATEJİSİ TESTİ');
console.log('='.repeat(80) + '\n');

console.log('📋 Strateji Özeti:');
console.log('  1. Bot başlangıçta ilk emri açar');
console.log('  2. Binance fiyat değişimini sürekli izler');
console.log('  3. Fiyat değişimi > %0.2 ise emri iptal edip yeni fiyattan açar');
console.log('  4. Emir dolduğunda counter order yapar ve yeni emir açar');
console.log('  5. Sürekli en az 1 açık emir bulundurur\n');

const bot = new ArbitrageBot();

// Test süresi
const TEST_DURATION = 300000; // 5 dakika (300 saniye)

async function runTest() {
    try {
        // Bot'u initialize et
        console.log('🚀 Bot initialize ediliyor...\n');
        await bot.initialize();
        
        console.log('\n📊 İlk Durum:\n');
        bot.printStatus();
        
        // Bot'u başlat
        console.log('\n▶️  Bot başlatılıyor (Sürekli Açık Emir Stratejisi)...\n');
        await bot.start();
        
        console.log(`\n⏰ ${TEST_DURATION / 1000} saniye boyunca izlenecek...\n`);
        console.log('💡 Beklenenler:');
        console.log('  • İlk emir otomatik açılacak');
        console.log('  • Binance fiyat değişimi izlenecek');
        console.log('  • %0.2+ değişimde emir güncellenecek');
        console.log('  • Emir dolarsa counter order + yeni emir\n');
        
        // Periyodik durum raporu
        const statusInterval = setInterval(() => {
            console.log('\n' + '─'.repeat(80));
            console.log('📊 Anlık Durum:');
            console.log('─'.repeat(80) + '\n');
            bot.printStatus();
        }, 30000); // 30 saniyede bir
        
        // Test süresi bitince durdur
        setTimeout(async () => {
            clearInterval(statusInterval);
            
            console.log('\n' + '='.repeat(80));
            console.log('⏰ Test süresi doldu');
            console.log('='.repeat(80) + '\n');
            
            console.log('📊 Final Durum:\n');
            bot.printStatus();
            
            console.log('\n⏸️  Bot durduruluyor...\n');
            await bot.stop();
            
            console.log('✅ Test tamamlandı!\n');
            
            // İstatistikler
            console.log('📈 TEST İSTATİSTİKLERİ:');
            console.log(`  Test süresi: ${TEST_DURATION / 1000} saniye`);
            console.log(`  Fiyat güncelleme eşiği: %${bot.config.priceUpdateThreshold}`);
            console.log(`  Minimum spread: %${bot.config.minSpread}`);
            console.log(`  Trade amount: ${bot.config.tradeAmount} XRP\n`);
            
            process.exit(0);
        }, TEST_DURATION);
        
    } catch (error) {
        logger.error('❌ Test hatası', {
            error: error.message,
            stack: error.stack
        });
        
        await bot.stop();
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Kullanıcı tarafından durduruldu (Ctrl+C)\n');
    
    console.log('📊 Son Durum:\n');
    bot.printStatus();
    
    await bot.stop();
    process.exit(0);
});

// Test'i başlat
runTest();
