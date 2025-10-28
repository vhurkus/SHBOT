/**
 * Emir Oluşturma Test
 * Task 3.5 - createNewOrder() metodu testi
 */

import ArbitrageBot from './ArbitrageBot.js';
import logger from '../utils/logger.js';

console.log('\n' + '='.repeat(80));
console.log('🧪 EMİR OLUŞTURMA TESTİ');
console.log('='.repeat(80) + '\n');

async function testOrderCreation() {
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
        
        console.log('⏳ Arbitraj fırsatı bekleniyor (60 saniye)...\n');
        console.log('💡 Fırsat tespit edilirse otomatik emir oluşturulacak\n');
        
        // 60 saniye bekle - fırsat varsa emir oluşturulacak
        await new Promise(resolve => setTimeout(resolve, 60000));
        
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

// Manual test - createNewOrder metodunu direkt test et
async function manualOrderTest() {
    const bot = new ArbitrageBot({
        tradeAmount: 10,
        minProfit: 0.1,
        minSpread: 0.3
    });
    
    try {
        console.log('🚀 Bot initialize ediliyor...\n');
        await bot.initialize();
        
        console.log('⏳ Fiyat güncellemeleri bekleniyor...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('\n📊 Mevcut Fiyatlar:');
        console.log(`  BTCTurk: ${bot.prices.btcturk.bid} / ${bot.prices.btcturk.ask}`);
        console.log(`  Binance: ${bot.prices.binance.bid} / ${bot.prices.binance.ask}`);
        
        console.log('\n💼 Mevcut Bakiyeler:');
        console.log(`  BTCTurk: ${bot.balances.btcturk.XRP} XRP, ${bot.balances.btcturk.USDT} USDT`);
        console.log(`  Binance: ${bot.balances.binance.XRP} XRP, ${bot.balances.binance.USDT} USDT`);
        
        console.log('\n🧪 createNewOrder() metodu çağrılıyor...\n');
        
        const result = await bot.createNewOrder();
        
        if (result) {
            console.log('\n✅ Emir oluşturuldu!');
            console.log(`  Emir ID: ${bot.currentOrder.orderId}`);
            console.log(`  Side: ${bot.currentOrder.side}`);
            console.log(`  Price: ${bot.currentOrder.price}`);
            console.log(`  Amount: ${bot.currentOrder.amount}`);
        } else {
            console.log('\n⚠️  Emir oluşturulamadı (bakiye/fırsat eksik olabilir)');
        }
        
        console.log('\n📊 Son Durum:');
        bot.printStatus();
        
        await bot.stop();
        process.exit(0);
        
    } catch (error) {
        logger.error('❌ Test hatası', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Hangi testi çalıştıracağız?
const testMode = process.argv[2] || 'auto';

if (testMode === 'manual') {
    console.log('📝 MANUEL TEST MODU\n');
    manualOrderTest();
} else {
    console.log('🤖 OTOMATİK TEST MODU\n');
    testOrderCreation();
}
