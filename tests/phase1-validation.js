/**
 * Phase 1 - Simple Final Validation
 */

import dotenv from 'dotenv';
import BTCTurkClient from '../src/exchanges/BTCTurkClient.js';
import BinanceClient from '../src/exchanges/BinanceClient.js';

dotenv.config();

console.log('\n' + '='.repeat(80));
console.log('✅ PHASE 1 - COMPLETION REPORT');
console.log('='.repeat(80) + '\n');

async function validate() {
    const results = {
        btcturk: { rest: false, websocket: false },
        binance: { rest: false, websocket: false }
    };
    
    // BTCTurk REST
    try {
        const btcturk = new BTCTurkClient({
            apiKey: process.env.BTCTURK_API_KEY,
            apiSecret: process.env.BTCTURK_API_SECRET,
            baseURL: 'https://api.btcturk.com'
        });
        
        const balances = await btcturk.getBalances();
        const ticker = await btcturk.getTicker24h('XRPUSDT');
        
        if (balances.XRP && ticker.bid > 0) {
            results.btcturk.rest = true;
            console.log('✅ BTCTurk REST API çalışıyor');
            console.log(`   Bakiye: ${balances.XRP.free} XRP, ${balances.USDT.free} USDT`);
            console.log(`   Ticker: BID ${ticker.bid}, ASK ${ticker.ask}\n`);
        }
    } catch (error) {
        console.log('❌ BTCTurk REST API hatası:', error.message, '\n');
    }
    
    // Binance REST
    try {
        const binance = new BinanceClient({
            apiKey: process.env.BINANCE_API_KEY,
            apiSecret: process.env.BINANCE_API_SECRET,
            baseURL: 'https://api.binance.com'
        });
        
        const balances = await binance.getBalances();
        const ticker = await binance.getTicker24h('XRPUSDT');
        
        if (balances.XRP && ticker.bid > 0) {
            results.binance.rest = true;
            console.log('✅ Binance REST API çalışıyor');
            console.log(`   Bakiye: ${balances.XRP.free} XRP, ${balances.USDT.free} USDT`);
            console.log(`   Ticker: BID ${ticker.bid}, ASK ${ticker.ask}\n`);
        }
    } catch (error) {
        console.log('❌ Binance REST API hatası:', error.message, '\n');
    }
    
    // WebSocket quick test
    console.log('🔌 WebSocket bağlantıları test ediliyor (her biri 3 saniye)...\n');
    
    // BTCTurk WebSocket
    try {
        const btcturk = new BTCTurkClient({
            apiKey: process.env.BTCTURK_API_KEY,
            apiSecret: process.env.BTCTURK_API_SECRET,
            baseURL: 'https://api.btcturk.com'
        });
        
        let btcturkCount = 0;
        await btcturk.connectWebSocket((data) => {
            btcturkCount++;
        }, 'XRPUSDT');
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (btcturkCount > 0) {
            results.btcturk.websocket = true;
            console.log(`✅ BTCTurk WebSocket çalışıyor (${btcturkCount} güncelleme)\n`);
        }
        
        btcturk.disconnectWebSocket();
    } catch (error) {
        console.log('❌ BTCTurk WebSocket hatası:', error.message, '\n');
    }
    
    // Binance WebSocket
    try {
        const binance = new BinanceClient({
            apiKey: process.env.BINANCE_API_KEY,
            apiSecret: process.env.BINANCE_API_SECRET,
            baseURL: 'https://api.binance.com'
        });
        
        let binanceCount = 0;
        await binance.connectWebSocket((data) => {
            binanceCount++;
        });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (binanceCount > 0) {
            results.binance.websocket = true;
            console.log(`✅ Binance WebSocket çalışıyor (${binanceCount} güncelleme)\n`);
        }
        
        binance.disconnectWebSocket();
    } catch (error) {
        console.log('❌ Binance WebSocket hatası:', error.message, '\n');
    }
    
    // Final Report
    console.log('='.repeat(80));
    console.log('📊 ÖZET');
    console.log('='.repeat(80) + '\n');
    
    const allPassed = 
        results.btcturk.rest && 
        results.btcturk.websocket && 
        results.binance.rest && 
        results.binance.websocket;
    
    console.log('🇹🇷 BTCTurk:');
    console.log(`   REST API:    ${results.btcturk.rest ? '✅' : '❌'}`);
    console.log(`   WebSocket:   ${results.btcturk.websocket ? '✅' : '❌'}\n`);
    
    console.log('🌐 Binance:');
    console.log(`   REST API:    ${results.binance.rest ? '✅' : '❌'}`);
    console.log(`   WebSocket:   ${results.binance.websocket ? '✅' : '❌'}\n`);
    
    if (allPassed) {
        console.log('='.repeat(80));
        console.log('🎉 PHASE 1 TAMAMLANDI!');
        console.log('='.repeat(80) + '\n');
        console.log('✨ Tamamlanan Bileşenler:');
        console.log('   ✅ Task 1.1 - Proje Yapısı');
        console.log('   ✅ Task 1.2 - Logger Sistemi');
        console.log('   ✅ Task 1.3 - Config Yönetimi');
        console.log('   ✅ Task 1.4 - BTCTurk REST API');
        console.log('   ✅ Task 1.5 - BTCTurk WebSocket');
        console.log('   ✅ Task 1.6 - Binance REST API');
        console.log('   ✅ Task 1.7 - Binance WebSocket');
        console.log('   ✅ Task 1.8 - Test & Validation\n');
        console.log('🚀 Phase 2: Arbitrage Engine\'e geçmeye hazır!\n');
        process.exit(0);
    } else {
        console.log('⚠️  Bazı testler başarısız oldu.\n');
        process.exit(1);
    }
}

validate().catch(error => {
    console.error('❌ Validation hatası:', error);
    process.exit(1);
});
