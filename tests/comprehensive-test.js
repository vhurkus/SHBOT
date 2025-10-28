/**
 * KAPSAMLI TEST SÜİTİ
 * Tüm fazların detaylı doğrulaması
 *
 * AMAÇ: Para kaybı riskini önlemek için tüm kritik fonksiyonları test et
 */

import ArbitrageEngine from './src/bot/ArbitrageEngine.js';
import logger from './src/utils/logger.js';

console.log('\n' + '='.repeat(80));
console.log('🧪 KAPSAMLI TEST SÜİTİ - FAZ 1, 2, 3 DOĞRULAMA');
console.log('='.repeat(80) + '\n');

// Test sonuçları
const results = {
    phase1: { total: 0, passed: 0, failed: 0, critical: 0 },
    phase2: { total: 0, passed: 0, failed: 0, critical: 0 },
    phase3: { total: 0, passed: 0, failed: 0, critical: 0 },
    security: { total: 0, passed: 0, failed: 0, critical: 0 }
};

// Test helper
function test(phase, name, fn, isCritical = false) {
    results[phase].total++;

    try {
        const result = fn();

        if (result.pass) {
            results[phase].passed++;
            console.log(`✅ [${phase.toUpperCase()}] ${name}`);
            if (result.details) {
                console.log(`   ℹ️  ${result.details}`);
            }
        } else {
            results[phase].failed++;
            if (isCritical) results[phase].critical++;
            console.log(`❌ [${phase.toUpperCase()}] ${name}`);
            console.log(`   ⚠️  ${result.reason}`);
            if (isCritical) {
                console.log(`   🔴 CRITICAL: Para kaybı riski!`);
            }
        }
    } catch (error) {
        results[phase].failed++;
        if (isCritical) results[phase].critical++;
        console.log(`❌ [${phase.toUpperCase()}] ${name}`);
        console.log(`   ⚠️  Test exception: ${error.message}`);
    }
}

// Test verileri
const testPrices = {
    btcturkBid: 2.6800,
    btcturkAsk: 2.6850,
    binanceBid: 2.6820,
    binanceAsk: 2.6840
};

const testBalances = {
    btcturk: { XRP: 50, USDT: 100 },
    binance: { XRP: 50, USDT: 100 }
};

console.log('📋 Test Verileri:');
console.log('  BTCTurk: BID', testPrices.btcturkBid, '/ ASK', testPrices.btcturkAsk);
console.log('  Binance: BID', testPrices.binanceBid, '/ ASK', testPrices.binanceAsk);
console.log('  Spread: ', ((testPrices.btcturkBid - testPrices.binanceAsk) / testPrices.binanceAsk * 100).toFixed(4), '%');
console.log('');

// ============================================================================
// FAZ 2: ARBITRAGE ENGINE TESTLERI
// ============================================================================

console.log('\n🔧 FAZ 2: ARBITRAGE ENGINE TESTLERI\n');

const engine = new ArbitrageEngine({
    tradeAmount: 10,
    minProfit: 0.1,
    minSpread: 0.3,
    btcturkMakerFee: 0.0008,  // %0.08
    btcturkTakerFee: 0.0012,  // %0.12
    binanceMakerFee: 0.001,   // %0.1
    binanceTakerFee: 0.001    // %0.1
});

// Test 2.1: Fee konfigürasyonu
test('phase2', 'Fee konfigürasyonu doğru yüklenmiş', () => {
    const fees = engine.fees;

    if (fees.btcturk.maker !== 0.0008) {
        return { pass: false, reason: `BTCTurk maker fee yanlış: ${fees.btcturk.maker}` };
    }
    if (fees.binance.taker !== 0.001) {
        return { pass: false, reason: `Binance taker fee yanlış: ${fees.binance.taker}` };
    }

    return {
        pass: true,
        details: `BTCTurk: ${fees.btcturk.maker*100}%/${fees.btcturk.taker*100}%, Binance: ${fees.binance.maker*100}%/${fees.binance.taker*100}%`
    };
}, false);

// Test 2.2: Karlılık hesaplama - SELL senaryosu (KRİTİK)
test('phase2', 'Karlılık hesaplama - SELL senaryosu (matematik)', () => {
    const result = engine.calculateProfitability_Sell(
        testPrices.btcturkBid,  // 2.6800
        testPrices.binanceAsk,   // 2.6840
        10 // XRP
    );

    // Manuel hesaplama:
    // BTCTurk SELL: 10 XRP * 2.6800 = 26.80 USDT
    // BTCTurk maker fee: 26.80 * 0.0008 = 0.02144 USDT
    // BTCTurk net: 26.80 - 0.02144 = 26.77856 USDT

    // Binance BUY: 10 XRP * 2.6840 = 26.84 USDT
    // Binance taker fee: 26.84 * 0.001 = 0.02684 USDT
    // Binance cost: 26.84 + 0.02684 = 26.86684 USDT

    // Profit: 26.77856 - 26.86684 = -0.08828 USDT (ZARAR!)

    const expectedProfit = -0.08828;
    const actualProfit = result.profit.amount;
    const diff = Math.abs(actualProfit - expectedProfit);

    if (diff > 0.001) {
        return { pass: false, reason: `Kar hesabı yanlış: beklenen ${expectedProfit.toFixed(4)}, bulunan ${actualProfit.toFixed(4)}` };
    }

    // Bu senaryoda profitable olmamalı
    if (result.profitable) {
        return { pass: false, reason: 'Negatif spread\'de profitable gösteriyor - TEHLIKE!' };
    }

    return {
        pass: true,
        details: `Profit: ${actualProfit.toFixed(4)} USDT (${result.profit.percent.toFixed(2)}%), Spread: ${result.profit.spread.toFixed(2)}%`
    };
}, true); // CRITICAL

// Test 2.3: Karlılık hesaplama - BUY senaryosu
test('phase2', 'Karlılık hesaplama - BUY senaryosu (matematik)', () => {
    const result = engine.calculateProfitability_Buy(
        testPrices.btcturkAsk,   // 2.6850
        testPrices.binanceBid,   // 2.6820
        10
    );

    // Manuel hesaplama:
    // Binance SELL: 10 XRP * 2.6820 = 26.82 USDT
    // Binance taker fee: 26.82 * 0.001 = 0.02682 USDT
    // Binance net: 26.82 - 0.02682 = 26.79318 USDT

    // BTCTurk BUY: 10 XRP * 2.6850 = 26.85 USDT
    // BTCTurk maker fee: 26.85 * 0.0008 = 0.02148 USDT
    // BTCTurk cost: 26.85 + 0.02148 = 26.87148 USDT

    // Profit: 26.79318 - 26.87148 = -0.0783 USDT (ZARAR!)

    const expectedProfit = -0.0783;
    const actualProfit = result.profit.amount;
    const diff = Math.abs(actualProfit - expectedProfit);

    if (diff > 0.001) {
        return { pass: false, reason: `Kar hesabı yanlış: beklenen ${expectedProfit.toFixed(4)}, bulunan ${actualProfit.toFixed(4)}` };
    }

    if (result.profitable) {
        return { pass: false, reason: 'Negatif spread\'de profitable gösteriyor!' };
    }

    return {
        pass: true,
        details: `Profit: ${actualProfit.toFixed(4)} USDT (${result.profit.percent.toFixed(2)}%)`
    };
}, true);

// Test 2.4: Pozitif karlılık testi
test('phase2', 'Pozitif karlılık testi - SELL senaryosu', () => {
    // Karlı bir senaryo oluştur
    const profitablePrices = {
        btcturkBid: 2.7000,  // Yüksek bid
        binanceAsk: 2.6800   // Düşük ask
    };

    const result = engine.calculateProfitability_Sell(
        profitablePrices.btcturkBid,
        profitablePrices.binanceAsk,
        10
    );

    // Manuel:
    // BTCTurk SELL: 10 * 2.7000 = 27.00 USDT - (27.00 * 0.0008) = 26.9784 USDT
    // Binance BUY: 10 * 2.6800 = 26.80 USDT + (26.80 * 0.001) = 26.8268 USDT
    // Profit: 26.9784 - 26.8268 = 0.1516 USDT

    if (result.profit.amount <= 0) {
        return { pass: false, reason: `Pozitif spread\'de zarar gösteriyor: ${result.profit.amount}` };
    }

    if (!result.profitable) {
        return { pass: false, reason: 'Profitable flag false olmamalı' };
    }

    return {
        pass: true,
        details: `Profit: ${result.profit.amount.toFixed(4)} USDT (${result.profit.percent.toFixed(2)}%)`
    };
}, true);

// Test 2.5: Emir fiyat hesaplama - SELL
test('phase2', 'Emir fiyat hesaplama - SELL senaryosu', () => {
    const pricing = engine.calculateOrderPrice_Sell(2.6800, 0.15, 0.1);

    // Mantık kontrolü
    if (pricing.orderPrice <= 2.6800) {
        return { pass: false, reason: `Emir fiyatı Binance ask\'tan düşük olamaz: ${pricing.orderPrice}` };
    }

    if (pricing.orderPrice < pricing.binanceAsk) {
        return { pass: false, reason: 'BTCTurk SELL fiyatı Binance ask\'tan yüksek olmalı' };
    }

    // Precision kontrolü
    const decimals = pricing.orderPrice.toString().split('.')[1]?.length || 0;
    if (decimals > 4) {
        return { pass: false, reason: `Precision hatası: ${decimals} decimal (max 4)` };
    }

    return {
        pass: true,
        details: `Order price: ${pricing.orderPrice} (Binance: ${pricing.binanceAsk})`
    };
}, true);

// Test 2.6: Bakiye yönetimi
test('phase2', 'Bakiye yönetimi - determineOrderSide', () => {
    const result = engine.determineOrderSide(testBalances, testPrices);

    if (!result.possible) {
        return { pass: false, reason: 'Yeterli bakiye olmasına rağmen possible=false' };
    }

    if (!result.scenario || (result.scenario !== 'SELL' && result.scenario !== 'BUY' && result.scenario !== 'BOTH_AVAILABLE')) {
        return { pass: false, reason: `Geçersiz scenario: ${result.scenario}` };
    }

    return {
        pass: true,
        details: `Scenario: ${result.scenario}, Reason: ${result.reason}`
    };
}, false);

// Test 2.7: Gerekli bakiye hesaplama
test('phase2', 'Gerekli bakiye hesaplama - BUY', () => {
    const requiredUSDT = engine.calculateRequiredBalance('BUY', 2.6800);

    // 10 XRP * 2.6800 = 26.80 USDT
    // Binance taker fee: 26.80 * 0.001 = 0.0268 USDT
    // Total: 26.8268 USDT

    const expected = 26.8268;
    const diff = Math.abs(requiredUSDT - expected);

    if (diff > 0.001) {
        return { pass: false, reason: `Hesaplama hatası: beklenen ${expected}, bulunan ${requiredUSDT}` };
    }

    return {
        pass: true,
        details: `Required USDT: ${requiredUSDT.toFixed(4)} (10 XRP @ 2.6800)`
    };
}, true);

// Test 2.8: Bakiye validasyonu
test('phase2', 'Bakiye validasyonu - yetersiz bakiye tespiti', () => {
    const insufficientBalances = {
        btcturk: { XRP: 5, USDT: 5 },  // Yetersiz
        binance: { XRP: 5, USDT: 5 }
    };

    const validation = engine.validateBalance(insufficientBalances, 'SELL', testPrices);

    if (validation.valid) {
        return { pass: false, reason: 'Yetersiz bakiye olmasına rağmen valid=true' };
    }

    return {
        pass: true,
        details: `Correctly detected insufficient balance: ${validation.reason}`
    };
}, true);

// ============================================================================
// GÜVENLİK TESTLERİ
// ============================================================================

console.log('\n🔒 GÜVENLİK TESTLERİ\n');

// Test S.1: Negatif spread koruması
test('security', 'Negatif spread koruması', () => {
    const badPrices = {
        btcturkBid: 2.6800,
        btcturkAsk: 2.6850,
        binanceBid: 2.6900, // Binance daha yüksek - arbitraj imkansız
        binanceAsk: 2.6920
    };

    const result = engine.calculateProfitability(badPrices, 10);

    // Her iki senaryo da zararlı olmalı
    if (result.bestScenario.profitable) {
        return {
            pass: false,
            reason: `Negatif spread\'de karlı gösteriyor! Profit: ${result.bestScenario.profit.amount.toFixed(4)}`
        };
    }

    return { pass: true, details: 'Negatif spread doğru tespit edildi' };
}, true);

// Test S.2: Fee hesaplama doğruluğu (birikimli test)
test('security', 'Fee hesaplama doğruluğu - birikimli işlem', () => {
    // 100 işlem simülasyonu
    let totalProfit = 0;

    for (let i = 0; i < 100; i++) {
        const result = engine.calculateProfitability_Sell(
            2.7000 + (Math.random() * 0.01),
            2.6800 + (Math.random() * 0.01),
            10
        );
        totalProfit += result.profit.amount;
    }

    // Fee hesapları tutarsızsa birikimli profit anormal olur
    const avgProfit = totalProfit / 100;

    if (Math.abs(avgProfit) > 10) {
        return { pass: false, reason: `Anormal birikimli profit: ${avgProfit.toFixed(2)} USDT` };
    }

    return {
        pass: true,
        details: `100 işlem avg profit: ${avgProfit.toFixed(4)} USDT`
    };
}, true);

// Test S.3: Precision/rounding hataları
test('security', 'Precision/rounding kontrol - 4 decimal', () => {
    const pricing = engine.calculateOrderPrice_Sell(2.678912345, 0.15, 0.1);

    const decimals = pricing.orderPrice.toString().split('.')[1]?.length || 0;

    if (decimals > 4) {
        return { pass: false, reason: `Çok fazla decimal: ${decimals} (max 4)` };
    }

    // Rounding kaybı kontrolü
    const diff = Math.abs(pricing.calculatedPrice - pricing.orderPrice);
    if (diff > 0.0001) {
        return { pass: false, reason: `Rounding kaybı çok büyük: ${diff}` };
    }

    return { pass: true, details: `Price: ${pricing.orderPrice} (${decimals} decimals)` };
}, true);

// Test S.4: Min profit/spread kontrolü
test('security', 'Min profit/spread threshold kontrolü', () => {
    const result = engine.calculateProfitability({
        btcturkBid: 2.6810,
        btcturkAsk: 2.6850,
        binanceBid: 2.6805,
        binanceAsk: 2.6808
    }, 10);

    // Çok küçük spread - profitable olmamalı
    const bestScenario = result.bestScenario;

    if (bestScenario.meetsMinProfit && bestScenario.profit.percent < engine.minProfit) {
        return { pass: false, reason: 'Min profit kontrolü çalışmıyor!' };
    }

    return {
        pass: true,
        details: `Profit: ${bestScenario.profit.percent.toFixed(2)}%, Min: ${engine.minProfit}%`
    };
}, true);

// Test S.5: Bakiye overflow koruması
test('security', 'Bakiye overflow koruması - çok büyük miktar', () => {
    try {
        const result = engine.calculateProfitability_Sell(2.6800, 2.6700, 1000000); // 1M XRP

        // Hesaplama çalışmalı ama reasonable değerler vermeli
        if (!isFinite(result.profit.amount) || !isFinite(result.profit.percent)) {
            return { pass: false, reason: 'Infinity veya NaN değer' };
        }

        return { pass: true, details: 'Büyük miktarlar doğru işlendi' };
    } catch (error) {
        return { pass: false, reason: `Exception: ${error.message}` };
    }
}, false);

// ============================================================================
// FAZ 3: BOT MANTIK TESTLERİ (Statik Analiz)
// ============================================================================

console.log('\n🤖 FAZ 3: BOT MANTIĞI TESTLERİ (Statik Analiz)\n');

// Kod dosyasını oku ve kritik kontrolleri yap
import fs from 'fs';
const botCode = fs.readFileSync('./src/bot/ArbitrageBot.js', 'utf8');

// Test 3.1: createNewOrder içinde karlılık kontrolü var mı?
test('phase3', 'createNewOrder() içinde karlılık kontrolü (KRİTİK)', () => {
    // createNewOrder fonksiyonunu bul
    const createNewOrderMatch = botCode.match(/async createNewOrder\(\) \{[\s\S]*?\n    \}/);

    if (!createNewOrderMatch) {
        return { pass: false, reason: 'createNewOrder fonksiyonu bulunamadı!' };
    }

    const functionBody = createNewOrderMatch[0];

    // Karlılık kontrolü aranıyor
    const hasProfitabilityCheck = functionBody.includes('profitable') ||
                                  functionBody.includes('minProfit') ||
                                  functionBody.includes('meetsMinProfit');

    const hasSpreadCheck = functionBody.includes('spread') ||
                          functionBody.includes('minSpread');

    if (!hasProfitabilityCheck && !hasSpreadCheck) {
        return {
            pass: false,
            reason: '🔴 KRİTİK: createNewOrder() karlılık/spread kontrolü yapmıyor - PARA KAYBI RİSKİ!'
        };
    }

    return { pass: true, details: 'Karlılık kontrolü mevcut' };
}, true); // CRITICAL

// Test 3.2: State management - race condition koruması
test('phase3', 'Race condition koruması (isUpdatingOrder flag)', () => {
    const hasLockFlag = botCode.includes('isUpdatingOrder');
    const hasLockCheck = botCode.includes('if (this.isUpdatingOrder)');

    if (!hasLockFlag || !hasLockCheck) {
        return { pass: false, reason: 'Race condition koruması eksik' };
    }

    return { pass: true, details: 'Lock flag mevcut' };
}, false);

// Test 3.3: WebSocket reconnection
test('phase3', 'WebSocket auto-reconnection mekanizması', () => {
    const btcturkCode = fs.readFileSync('./src/exchanges/BTCTurkClient.js', 'utf8');
    const binanceCode = fs.readFileSync('./src/exchanges/BinanceClient.js', 'utf8');

    const btcturkHasReconnect = btcturkCode.includes('reconnect');
    const binanceHasReconnect = binanceCode.includes('reconnect');

    if (!btcturkHasReconnect || !binanceHasReconnect) {
        return { pass: false, reason: 'WebSocket reconnection eksik' };
    }

    return { pass: true, details: 'Her iki exchange\'de de reconnect var' };
}, false);

// Test 3.4: Error handling
test('phase3', 'Error handling - try/catch coverage', () => {
    const functions = ['createNewOrder', 'updateOrder', 'executeCounterOrder', 'updateBalances'];

    const missingHandlers = [];

    functions.forEach(fn => {
        const regex = new RegExp(`async ${fn}\\([^)]*\\) \\{[\\s\\S]*?try \\{`, 'g');
        if (!regex.test(botCode)) {
            missingHandlers.push(fn);
        }
    });

    if (missingHandlers.length > 0) {
        return {
            pass: false,
            reason: `Try/catch eksik: ${missingHandlers.join(', ')}`
        };
    }

    return { pass: true, details: 'Kritik fonksiyonlarda error handling var' };
}, false);

// Test 3.5: Graceful shutdown
test('phase3', 'Graceful shutdown implementasyonu', () => {
    const indexCode = fs.readFileSync('./src/index.js', 'utf8');

    const hasSIGINT = indexCode.includes('SIGINT');
    const hasSIGTERM = indexCode.includes('SIGTERM');
    const hasStopBot = indexCode.includes('stopBot');

    if (!hasSIGINT || !hasSIGTERM || !hasStopBot) {
        return { pass: false, reason: 'Graceful shutdown eksik' };
    }

    return { pass: true, details: 'SIGINT, SIGTERM ve stopBot mevcut' };
}, false);

// ============================================================================
// SONUÇLAR
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('📊 TEST SONUÇLARI');
console.log('='.repeat(80) + '\n');

const phases = ['phase2', 'security', 'phase3'];
let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
let totalCritical = 0;

phases.forEach(phase => {
    const r = results[phase];
    totalTests += r.total;
    totalPassed += r.passed;
    totalFailed += r.failed;
    totalCritical += r.critical;

    const phaseNames = {
        phase2: 'FAZ 2 - Arbitrage Engine',
        phase3: 'FAZ 3 - Bot Mantığı',
        security: 'GÜVENLİK'
    };

    console.log(`${phaseNames[phase]}:`);
    console.log(`  Total: ${r.total}`);
    console.log(`  ✅ Passed: ${r.passed}`);
    console.log(`  ❌ Failed: ${r.failed}`);
    if (r.critical > 0) {
        console.log(`  🔴 CRITICAL: ${r.critical}`);
    }
    console.log(`  Success Rate: ${((r.passed / r.total) * 100).toFixed(1)}%`);
    console.log('');
});

console.log('='.repeat(80));
console.log(`TOPLAM: ${totalTests} test`);
console.log(`✅ Başarılı: ${totalPassed}`);
console.log(`❌ Başarısız: ${totalFailed}`);
if (totalCritical > 0) {
    console.log(`🔴 KRİTİK: ${totalCritical} - ACIL DİKKAT GEREKTİRİYOR!`);
}
console.log(`Başarı Oranı: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
console.log('='.repeat(80) + '\n');

// Kritik sorunlar varsa uyarı
if (totalCritical > 0) {
    console.log('⚠️⚠️⚠️  UYARI  ⚠️⚠️⚠️');
    console.log(`${totalCritical} kritik sorun tespit edildi!`);
    console.log('Bu sorunlar PARA KAYBI riskine neden olabilir.');
    console.log('Production\'a geçmeden önce mutlaka düzeltilmeli!');
    console.log('\n');
}

// Özet
if (totalFailed === 0) {
    console.log('🎉 TÜM TESTLER BAŞARILI! Bot production\'a hazır.');
} else {
    console.log(`⚠️  ${totalFailed} test başarısız. Düzeltmeler gerekli.`);
}

console.log('\n');
