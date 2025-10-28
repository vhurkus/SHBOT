/**
 * Final Integration Test - Phase 1 Validation
 * Tüm altyapıyı test eder: REST API + WebSocket
 */

import dotenv from 'dotenv';
import BTCTurkClient from './BTCTurkClient.js';
import BinanceClient from './BinanceClient.js';
import logger from '../utils/logger.js';

dotenv.config();

console.log('\n' + '='.repeat(80));
console.log('🧪 PHASE 1 - FINAL VALIDATION TEST');
console.log('='.repeat(80) + '\n');

let allTestsPassed = true;
const results = [];

function testResult(name, passed, details = '') {
    results.push({ name, passed, details });
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}${details ? ': ' + details : ''}`);
    if (!passed) allTestsPassed = false;
}

async function testBTCTurk() {
    console.log('\n📍 BTCTurk Tests');
    console.log('─'.repeat(80));
    
    const client = new BTCTurkClient({
        apiKey: process.env.BTCTURK_API_KEY,
        apiSecret: process.env.BTCTURK_API_SECRET,
        baseURL: 'https://api.btcturk.com'
    });
    
    try {
        // Test 1: Bakiye Sorgulama
        const balances = await client.getBalances();
        const hasXRP = balances.XRP && balances.XRP.free > 0;
        const hasUSDT = balances.USDT && balances.USDT.free > 0;
        testResult('Bakiye Sorgulama', true, 
            `XRP: ${balances.XRP?.free || 0}, USDT: ${balances.USDT?.free || 0}`);
        testResult('XRP Bakiyesi', hasXRP, `${balances.XRP?.free || 0} XRP`);
        testResult('USDT Bakiyesi', hasUSDT, `${balances.USDT?.free || 0} USDT`);
        
        // Test 2: Ticker
        const ticker = await client.getTicker24h('XRPUSDT');
        testResult('Ticker Veri', ticker.bid > 0 && ticker.ask > 0, 
            `BID: ${ticker.bid}, ASK: ${ticker.ask}`);
        
        // Test 3: Açık Emirler
        const openOrders = await client.getOpenOrders('XRPUSDT');
        testResult('Açık Emir Sorgulama', true, `${openOrders.length} açık emir`);
        
        // Test 4: WebSocket (5 saniye)
        let wsUpdateCount = 0;
        const wsPromise = new Promise((resolve) => {
            client.connectWebSocket((data) => {
                wsUpdateCount++;
                if (wsUpdateCount === 1) {
                    testResult('WebSocket İlk Veri', true, 
                        `BID: ${data.bid}, ASK: ${data.ask}`);
                }
            }, 'XRPUSDT');
            
            setTimeout(() => {
                client.disconnectWebSocket();
                testResult('WebSocket Güncelleme Sayısı', wsUpdateCount > 0, 
                    `${wsUpdateCount} güncelleme`);
                resolve();
            }, 5000);
        });
        
        await wsPromise;
        
    } catch (error) {
        testResult('BTCTurk Genel Test', false, error.message);
    }
}

async function testBinance() {
    console.log('\n📍 Binance Tests');
    console.log('─'.repeat(80));
    
    const client = new BinanceClient({
        apiKey: process.env.BINANCE_API_KEY,
        apiSecret: process.env.BINANCE_API_SECRET,
        baseURL: 'https://api.binance.com'
    });
    
    try {
        // Test 1: Bakiye Sorgulama
        const balances = await client.getBalances();
        const hasXRP = balances.XRP && balances.XRP.free > 0;
        const hasUSDT = balances.USDT && balances.USDT.free > 0;
        testResult('Bakiye Sorgulama', true, 
            `XRP: ${balances.XRP?.free || 0}, USDT: ${balances.USDT?.free || 0}`);
        testResult('XRP Bakiyesi', hasXRP, `${balances.XRP?.free || 0} XRP`);
        testResult('USDT Bakiyesi', hasUSDT, `${balances.USDT?.free || 0} USDT`);
        
        // Test 2: Ticker
        const ticker = await client.getTicker24h('XRPUSDT');
        testResult('Ticker Veri', ticker.bid > 0 && ticker.ask > 0, 
            `BID: ${ticker.bid}, ASK: ${ticker.ask}`);
        
        // Test 3: Açık Emirler
        const openOrders = await client.getOpenOrders('XRPUSDT');
        testResult('Açık Emir Sorgulama', true, `${openOrders.length} açık emir`);
        
        // Test 4: WebSocket (5 saniye)
        let wsUpdateCount = 0;
        const wsPromise = new Promise((resolve) => {
            client.connectWebSocket((data) => {
                wsUpdateCount++;
                if (wsUpdateCount === 1) {
                    testResult('WebSocket İlk Veri', true, 
                        `BID: ${data.bid}, ASK: ${data.ask}`);
                }
            });
            
            setTimeout(() => {
                client.disconnectWebSocket();
                testResult('WebSocket Güncelleme Sayısı', wsUpdateCount > 0, 
                    `${wsUpdateCount} güncelleme (${(wsUpdateCount / 5).toFixed(1)}/s)`);
                resolve();
            }, 5000);
        });
        
        await wsPromise;
        
    } catch (error) {
        testResult('Binance Genel Test', false, error.message);
    }
}

async function runAllTests() {
    try {
        await testBTCTurk();
        await testBinance();
        
        // Sonuç Özeti
        console.log('\n' + '='.repeat(80));
        console.log('📊 TEST SONUÇLARI');
        console.log('='.repeat(80));
        
        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        const total = results.length;
        
        console.log(`\n✅ Başarılı: ${passed}/${total}`);
        console.log(`❌ Başarısız: ${failed}/${total}`);
        console.log(`📈 Başarı Oranı: ${((passed / total) * 100).toFixed(1)}%`);
        
        if (allTestsPassed) {
            console.log('\n🎉 TÜM TESTLER BAŞARILI! Phase 1 tamamlandı!\n');
            console.log('✨ Sistem hazır:');
            console.log('   ✅ Logger sistemi aktif');
            console.log('   ✅ Config yönetimi çalışıyor');
            console.log('   ✅ BTCTurk REST API entegrasyonu tamamlandı');
            console.log('   ✅ BTCTurk WebSocket bağlantısı çalışıyor');
            console.log('   ✅ Binance REST API entegrasyonu tamamlandı');
            console.log('   ✅ Binance WebSocket bağlantısı çalışıyor');
            console.log('\n🚀 Phase 2\'ye geçmeye hazır!\n');
            process.exit(0);
        } else {
            console.log('\n⚠️  Bazı testler başarısız! Yukarıdaki hataları kontrol edin.\n');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n❌ Test hatası:', error);
        process.exit(1);
    }
}

runAllTests();
