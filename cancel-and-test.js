/**
 * Test Script: Açık emri iptal et ve yeni emir oluştur
 * Faz 2 slippage hesaplamasını test etmek için
 */

import BTCTurkClient from './src/exchanges/BTCTurkClient.js';
import config from './src/config/config.js';
import logger from './src/utils/logger.js';

async function cancelAndTest() {
    console.log('\n🧪 TEST: Açık emri iptal edip yeni emir oluşturma\n');

    const btcturk = new BTCTurkClient(config.btcturk);

    try {
        // 1. Açık emirleri sorgula
        console.log('1️⃣ Açık emirler sorgulanıyor...');
        const openOrders = await btcturk.getOpenOrders('XRPUSDT');
        
        if (openOrders.length === 0) {
            console.log('✅ Açık emir yok, bot yeni emir oluşturabilir.\n');
            return;
        }

        console.log(`📋 ${openOrders.length} adet açık emir bulundu:\n`);
        openOrders.forEach(order => {
            console.log(`   ID: ${order.id}`);
            console.log(`   Side: ${order.side.toUpperCase()}`);
            console.log(`   Price: ${order.price}`);
            console.log(`   Amount: ${order.amount}`);
            console.log('   ---');
        });

        // 2. İptal et
        console.log('\n2️⃣ Emirler iptal ediliyor...');
        for (const order of openOrders) {
            console.log(`   ❌ Emir iptal ediliyor: ${order.id}`);
            await btcturk.cancelOrder(order.id);
            console.log(`   ✅ İptal edildi: ${order.id}`);
        }

        console.log('\n✅ Tüm emirler iptal edildi!');
        console.log('\n📌 ŞİMDİ:');
        console.log('   1. Bot yeni emir oluşturacak');
        console.log('   2. Slippage hesaplaması yapılacak');
        console.log('   3. Log\'larda "📊 SELL Karlılık (Slippage dahil)" mesajını göreceksin');
        console.log('   4. Gerçek order book verisi kullanılacak\n');

    } catch (error) {
        console.error('❌ Hata:', error.message);
        console.error(error.stack);
    }
}

cancelAndTest();
