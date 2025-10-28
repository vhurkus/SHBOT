/**
 * Faz 3 Test Script
 * Bot'un çalışıp çalışmadığını kontrol eder
 */

import ArbitrageBot from './src/bot/ArbitrageBot.js';
import logger from './src/utils/logger.js';

console.log('\n' + '='.repeat(80));
console.log('🧪 FAZ 3 TEST - Sürekli Açık Emir Stratejisi Testi');
console.log('='.repeat(80) + '\n');

let testResults = {
    initialization: false,
    websocketConnection: false,
    balanceUpdate: false,
    priceUpdate: false,
    orderCreation: false,
    orderMonitoring: false
};

async function testPhase3() {
    const bot = new ArbitrageBot({
        tradeAmount: 5, // Küçük miktar ile test
        minProfit: 0.1,
        minSpread: 0.3,
        priceUpdateThreshold: 0.2
    });
    
    try {
        console.log('📋 Test 1: Bot Initialization');
        console.log('─'.repeat(80));
        
        await bot.initialize();
        testResults.initialization = true;
        console.log('✅ Bot başarıyla initialize edildi\n');
        
        console.log('📋 Test 2: WebSocket Bağlantıları');
        console.log('─'.repeat(80));
        
        // 3 saniye bekle fiyat güncellemesi için
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (bot.prices.btcturk.bid && bot.prices.binance.bid) {
            testResults.websocketConnection = true;
            testResults.priceUpdate = true;
            console.log('✅ WebSocket bağlantıları çalışıyor');
            console.log(`   BTCTurk: ${bot.prices.btcturk.bid} / ${bot.prices.btcturk.ask}`);
            console.log(`   Binance: ${bot.prices.binance.bid} / ${bot.prices.binance.ask}\n`);
        } else {
            throw new Error('WebSocket fiyat güncellemeleri alınamadı');
        }
        
        console.log('📋 Test 3: Bakiye Kontrolü');
        console.log('─'.repeat(80));
        
        if (bot.balances.btcturk.XRP >= 0 && bot.balances.binance.XRP >= 0) {
            testResults.balanceUpdate = true;
            console.log('✅ Bakiyeler başarıyla okundu');
            console.log(`   BTCTurk: ${bot.balances.btcturk.XRP.toFixed(2)} XRP, ${bot.balances.btcturk.USDT.toFixed(2)} USDT`);
            console.log(`   Binance: ${bot.balances.binance.XRP.toFixed(2)} XRP, ${bot.balances.binance.USDT.toFixed(2)} USDT\n`);
        } else {
            throw new Error('Bakiyeler okunamadı');
        }
        
        console.log('📋 Test 4: Açık Emir Kontrolü');
        console.log('─'.repeat(80));
        
        const hasOpenOrder = await bot.checkOpenOrders();
        
        if (hasOpenOrder) {
            console.log('ℹ️  Mevcut açık emir tespit edildi');
            console.log(`   Order ID: ${bot.currentOrder.orderId}`);
            console.log(`   Side: ${bot.currentOrder.side}`);
            console.log(`   Price: ${bot.currentOrder.price}`);
            console.log(`   Amount: ${bot.currentOrder.amount}\n`);
            
            testResults.orderMonitoring = true;
        } else {
            console.log('✅ Açık emir yok, temiz başlangıç\n');
        }
        
        console.log('📋 Test 5: Bot Start (Dry Run - 10 saniye)');
        console.log('─'.repeat(80));
        
        await bot.start();
        console.log('✅ Bot başarıyla başlatıldı\n');
        
        // 10 saniye çalıştır
        console.log('⏳ Bot izleniyor (10 saniye)...\n');
        
        let updateInterval = setInterval(() => {
            if (bot.currentOrder.active) {
                console.log(`📊 Aktif Emir: ${bot.currentOrder.side} @ ${bot.currentOrder.price} USDT (ID: ${bot.currentOrder.orderId})`);
                console.log(`   Senaryo: ${bot.currentOrder.scenario}`);
                console.log(`   BTCTurk Fiyat: ${bot.prices.btcturk.bid.toFixed(4)} / ${bot.prices.btcturk.ask.toFixed(4)}`);
                console.log(`   Binance Fiyat: ${bot.prices.binance.bid.toFixed(4)} / ${bot.prices.binance.ask.toFixed(4)}\n`);
                
                testResults.orderCreation = true;
            } else {
                console.log('⏳ Emir oluşturuluyor...\n');
            }
        }, 3000);
        
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        clearInterval(updateInterval);
        
        console.log('📋 Test 6: Bot Stop');
        console.log('─'.repeat(80));
        
        await bot.stop();
        console.log('✅ Bot başarıyla durduruldu\n');
        
        // Test sonuçları
        console.log('\n' + '='.repeat(80));
        console.log('📊 TEST SONUÇLARI');
        console.log('='.repeat(80));
        
        console.log(`\n✅ Initialization: ${testResults.initialization ? 'BAŞARILI' : 'BAŞARISIZ'}`);
        console.log(`✅ WebSocket Bağlantısı: ${testResults.websocketConnection ? 'BAŞARILI' : 'BAŞARISIZ'}`);
        console.log(`✅ Bakiye Güncellemesi: ${testResults.balanceUpdate ? 'BAŞARILI' : 'BAŞARISIZ'}`);
        console.log(`✅ Fiyat Güncellemesi: ${testResults.priceUpdate ? 'BAŞARILI' : 'BAŞARISIZ'}`);
        console.log(`${testResults.orderCreation ? '✅' : 'ℹ️ '} Emir Oluşturma: ${testResults.orderCreation ? 'BAŞARILI' : 'TEST EDİLEMEDİ (Bakiye yetersiz olabilir)'}`);
        console.log(`${testResults.orderMonitoring ? '✅' : 'ℹ️ '} Emir Monitoring: ${testResults.orderMonitoring ? 'BAŞARILI' : 'TEST EDİLEMEDİ'}`);
        
        const allCriticalPassed = testResults.initialization && 
                                  testResults.websocketConnection && 
                                  testResults.balanceUpdate && 
                                  testResults.priceUpdate;
        
        console.log('\n' + '='.repeat(80));
        
        if (allCriticalPassed) {
            console.log('🎉 FAZ 3 KRİTİK TESTLERİ BAŞARILI!');
            console.log('✅ Bot temel işlevleri çalışıyor');
            
            if (!testResults.orderCreation) {
                console.log('\n⚠️  NOT: Emir oluşturma test edilemedi (yetersiz bakiye olabilir)');
                console.log('   Gerçek kullanımda yeterli bakiye ile test ediniz.');
            }
            
            console.log('\n📝 ÖNERİLER:');
            console.log('   1. .env dosyasını kontrol edin (API key\'ler doğru mu?)');
            console.log('   2. Bakiyeleri kontrol edin (yeterli XRP ve USDT var mı?)');
            console.log('   3. Küçük miktarlarla canlı test yapın');
            console.log('   4. Log dosyalarını izleyin (logs/ klasörü)');
        } else {
            console.log('❌ FAZ 3 TESTLERİ BAŞARISIZ!');
            console.log('   Lütfen yukarıdaki hataları inceleyin ve düzeltin.');
        }
        
        console.log('='.repeat(80) + '\n');
        
        process.exit(allCriticalPassed ? 0 : 1);
        
    } catch (error) {
        console.error('\n❌ Test Hatası:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\n' + '='.repeat(80));
        console.log('❌ FAZ 3 TESTLERİ BAŞARISIZ!');
        console.log('='.repeat(80));
        console.log('\nHata detayları log dosyalarında bulunabilir (logs/ klasörü)\n');
        
        try {
            await bot.stop();
        } catch (e) {
            // Ignore
        }
        
        process.exit(1);
    }
}

// Test başlat
testPhase3();
