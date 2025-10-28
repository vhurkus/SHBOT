/**
 * BTCTurk XRPUSDT Quick Test
 */

import BTCTurkClient from './BTCTurkClient.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

const client = new BTCTurkClient(config.btcturk);

async function quickTest() {
    try {
        logger.info('🧪 BTCTurk XRPUSDT Test...\n');
        
        // Test 1: Ticker
        const ticker = await client.getTicker24h('XRPUSDT');
        console.log('📊 XRPUSDT Ticker:');
        console.log(`   Bid:    ${ticker.bid} USDT`);
        console.log(`   Ask:    ${ticker.ask} USDT`);
        console.log(`   Last:   ${ticker.last} USDT`);
        console.log(`   Volume: ${ticker.volume.toFixed(2)} XRP`);
        console.log(`   Daily:  ${ticker.dailyPercent > 0 ? '+' : ''}${ticker.dailyPercent.toFixed(2)}%\n`);
        
        // Test 2: Balances
        const balances = await client.getBalances();
        console.log('💰 Bakiyeler:');
        console.log(`   XRP:  ${balances.XRP?.free || 0} (free) + ${balances.XRP?.locked || 0} (locked)`);
        console.log(`   USDT: ${balances.USDT?.free || 0} (free) + ${balances.USDT?.locked || 0} (locked)\n`);
        
        // Test 3: Open Orders
        const orders = await client.getOpenOrders('XRPUSDT');
        console.log(`📋 Açık Emirler: ${orders.length} adet\n`);
        
        logger.info('✅ Test tamamlandı!');
        
    } catch (error) {
        logger.error('❌ Test hatası:', error.message);
    }
}

quickTest();
