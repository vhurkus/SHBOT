/**
 * Açık emirleri kontrol et ve gerekirse iptal et
 */

import BTCTurkClient from './src/exchanges/BTCTurkClient.js';
import logger from './src/utils/logger.js';

const client = new BTCTurkClient();

async function checkAndCancelOrders() {
    try {
        console.log('\n🔍 Açık emirler kontrol ediliyor...\n');
        
        const orders = await client.getOpenOrders('XRPUSDT');
        
        if (orders.length === 0) {
            console.log('✅ Açık emir yok!\n');
            return;
        }
        
        console.log(`📋 ${orders.length} adet açık emir bulundu:\n`);
        
        orders.forEach((order, index) => {
            console.log(`${index + 1}. Emir:`);
            console.log(`   ID: ${order.id}`);
            console.log(`   Yön: ${order.type}`);
            console.log(`   Fiyat: ${order.price}`);
            console.log(`   Miktar: ${order.quantity}`);
            console.log('');
        });
        
        // Emirleri iptal et
        console.log('❌ Tüm emirler iptal ediliyor...\n');
        
        for (const order of orders) {
            try {
                await client.cancelOrder(order.id);
                console.log(`✅ Emir iptal edildi: ${order.id}`);
            } catch (error) {
                console.error(`❌ Emir iptal hatası ${order.id}:`, error.message);
            }
        }
        
        console.log('\n✅ İşlem tamamlandı!\n');
        
    } catch (error) {
        logger.error('Hata:', {
            error: error.message,
            stack: error.stack
        });
    }
}

checkAndCancelOrders();
