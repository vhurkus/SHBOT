/**
 * ArbitrageEngine Tam Doğrulama Testleri
 * Task 2.6 - Arbitraj motorunun tüm özelliklerini test eder
 */

import ArbitrageEngine from './ArbitrageEngine.js';

console.log('\n' + '='.repeat(80));
console.log('🧪 ARBITRAGE ENGINE - KAPSAMLI TEST SÜİTİ');
console.log('='.repeat(80) + '\n');

const engine = new ArbitrageEngine();

// Test verileri
const realWorldPrices = {
    btcturkBid: 2.7000,
    btcturkAsk: 2.7010,
    binanceBid: 2.6900,
    binanceAsk: 2.6910
};

const realWorldBalances = {
    btcturk: {
        XRP: 15.00,
        USDT: 50.00
    },
    binance: {
        XRP: 15.00,
        USDT: 50.00
    }
};

let testsPassed = 0;
let testsFailed = 0;

function runTest(testName, testFunc) {
    try {
        console.log(`\n🧪 ${testName}`);
        const result = testFunc();
        if (result) {
            console.log(`   ✅ BAŞARILI`);
            testsPassed++;
        } else {
            console.log(`   ❌ BAŞARISIZ`);
            testsFailed++;
        }
        return result;
    } catch (error) {
        console.log(`   ❌ HATA: ${error.message}`);
        testsFailed++;
        return false;
    }
}

console.log('━'.repeat(80));
console.log('📊 BÖLÜM 1: FEE YÖNETİMİ TESTLERİ');
console.log('━'.repeat(80));

runTest('Fee değerleri doğru yüklenmiş mi?', () => {
    const config = engine.getConfig();
    return config.fees.btcturk.maker === 0.0008 &&
           config.fees.btcturk.taker === 0.0012 &&
           config.fees.binance.maker === 0.001 &&
           config.fees.binance.taker === 0.001;
});

runTest('Fee güncelleme çalışıyor mu?', () => {
    const oldFee = engine.fees.btcturk.maker;
    engine.updateFees('btcturk', 0.001, 0.002);
    const updated = engine.fees.btcturk.maker === 0.001;
    engine.updateFees('btcturk', oldFee, 0.0012); // Restore
    return updated;
});

console.log('\n━'.repeat(80));
console.log('💰 BÖLÜM 2: KARLILIK HESAPLAMA TESTLERİ');
console.log('━'.repeat(80));

runTest('SELL senaryosu karlılık hesabı doğru mu?', () => {
    const result = engine.calculateProfitability_Sell(
        realWorldPrices.btcturkBid,
        realWorldPrices.binanceAsk,
        10
    );
    
    console.log(`      Kar: ${result.profit.amount.toFixed(4)} USDT (${result.profit.percent.toFixed(2)}%)`);
    console.log(`      Spread: ${result.profit.spread.toFixed(2)}%`);
    console.log(`      Karlı mı: ${result.profitable ? 'EVET' : 'HAYIR'}`);
    
    return result.scenario === 'SELL' && 
           result.profit.amount > 0 &&
           result.btcturk.side === 'SELL' &&
           result.binance.side === 'BUY';
});

runTest('BUY senaryosu karlılık hesabı doğru mu?', () => {
    const result = engine.calculateProfitability_Buy(
        realWorldPrices.btcturkAsk,
        realWorldPrices.binanceBid,
        10
    );
    
    console.log(`      Kar: ${result.profit.amount.toFixed(4)} USDT (${result.profit.percent.toFixed(2)}%)`);
    console.log(`      Spread: ${result.profit.spread.toFixed(2)}%`);
    console.log(`      Karlı mı: ${result.profitable ? 'EVET' : 'HAYIR'}`);
    
    return result.scenario === 'BUY' &&
           result.binance.side === 'SELL' &&
           result.btcturk.side === 'BUY';
});

runTest('Otomatik senaryo seçimi en karlıyı seçiyor mu?', () => {
    const result = engine.calculateProfitability(realWorldPrices, 10);
    
    console.log(`      SELL kar: ${result.sellScenario.profit.percent.toFixed(2)}%`);
    console.log(`      BUY kar: ${result.buyScenario.profit.percent.toFixed(2)}%`);
    console.log(`      Seçilen: ${result.bestScenario.scenario}`);
    console.log(`      Fırsat var mı: ${result.hasOpportunity ? 'EVET' : 'HAYIR'}`);
    
    const sellProfit = result.sellScenario.profit.percent;
    const buyProfit = result.buyScenario.profit.percent;
    const correctChoice = sellProfit > buyProfit ? 'SELL' : 'BUY';
    
    return result.bestScenario.scenario === correctChoice;
});

runTest('Fee hesaplamaları doğru mu?', () => {
    const result = engine.calculateProfitability_Sell(2.7000, 2.6910, 10);
    
    const expectedBinanceFee = 2.6910 * 10 * 0.001;
    const expectedBtcturkFee = 2.7000 * 10 * 0.0008;
    
    console.log(`      Binance fee: ${result.binance.fee.toFixed(4)} USDT (beklenen: ${expectedBinanceFee.toFixed(4)})`);
    console.log(`      BTCTurk fee: ${result.btcturk.fee.toFixed(4)} USDT (beklenen: ${expectedBtcturkFee.toFixed(4)})`);
    
    return Math.abs(result.binance.fee - expectedBinanceFee) < 0.0001 &&
           Math.abs(result.btcturk.fee - expectedBtcturkFee) < 0.0001;
});

console.log('\n━'.repeat(80));
console.log('🎯 BÖLÜM 3: EMİR FİYAT HESAPLAMA TESTLERİ');
console.log('━'.repeat(80));

runTest('SELL senaryosu fiyat hesabı doğru mu?', () => {
    const result = engine.calculateOrderPrice_Sell(2.6910, 0.15, 0.1);
    
    console.log(`      Binance Ask: ${result.binanceAsk} USDT`);
    console.log(`      Hesaplanan Fiyat: ${result.orderPrice} USDT`);
    console.log(`      Hedef Kar: ${result.targetProfit}%`);
    
    return result.scenario === 'SELL' &&
           result.orderPrice > result.binanceAsk &&
           result.orderPrice.toString().split('.')[1]?.length <= 4;
});

runTest('BUY senaryosu fiyat hesabı doğru mu?', () => {
    const result = engine.calculateOrderPrice_Buy(2.6900, 0.15, 0.1);
    
    console.log(`      Binance Bid: ${result.binanceBid} USDT`);
    console.log(`      Hesaplanan Fiyat: ${result.orderPrice} USDT`);
    console.log(`      Hedef Kar: ${result.targetProfit}%`);
    
    return result.scenario === 'BUY' &&
           result.orderPrice < result.binanceBid &&
           result.orderPrice.toString().split('.')[1]?.length <= 4;
});

runTest('Otomatik fiyat hesaplama doğru senaryoyu kullanıyor mu?', () => {
    const result = engine.calculateOrderPrice(realWorldPrices, 0.15, 0.1);
    
    console.log(`      Seçilen Senaryo: ${result.scenario}`);
    console.log(`      Emir Fiyatı: ${result.orderPrice} USDT`);
    console.log(`      Fırsat var mı: ${result.hasOpportunity ? 'EVET' : 'HAYIR'}`);
    
    return result.scenario && 
           result.orderPrice > 0 &&
           result.profitability;
});

runTest('Precision kontrolü çalışıyor mu?', () => {
    const result = engine.calculateOrderPrice_Sell(2.691234567, 0.15, 0.1);
    
    const decimalPlaces = result.orderPrice.toString().split('.')[1]?.length || 0;
    console.log(`      Emir Fiyatı: ${result.orderPrice} (${decimalPlaces} decimal)`);
    
    return decimalPlaces <= 4;
});

console.log('\n━'.repeat(80));
console.log('💼 BÖLÜM 4: BAKİYE YÖNETİMİ TESTLERİ');
console.log('━'.repeat(80));

runTest('Sadece BTCTurk\'te XRP var - SELL seçiliyor mu?', () => {
    const balances = {
        btcturk: { XRP: 15, USDT: 10 },
        binance: { XRP: 0, USDT: 50 }
    };
    
    const result = engine.determineOrderSide(balances, realWorldPrices);
    
    console.log(`      Senaryo: ${result.scenario}`);
    console.log(`      Mümkün mü: ${result.possible ? 'EVET' : 'HAYIR'}`);
    
    return result.scenario === 'SELL' && result.possible;
});

runTest('Sadece Binance\'te XRP var - BUY seçiliyor mu?', () => {
    const balances = {
        btcturk: { XRP: 0, USDT: 50 },
        binance: { XRP: 15, USDT: 10 }
    };
    
    const result = engine.determineOrderSide(balances, realWorldPrices);
    
    console.log(`      Senaryo: ${result.scenario}`);
    console.log(`      Mümkün mü: ${result.possible ? 'EVET' : 'HAYIR'}`);
    
    return result.scenario === 'BUY' && result.possible;
});

runTest('Her iki borsada XRP var - Karlılığa göre seçim yapılıyor mu?', () => {
    const result = engine.determineOrderSide(realWorldBalances, realWorldPrices);
    
    console.log(`      Senaryo: ${result.scenario}`);
    console.log(`      Sebep: ${result.reason}`);
    console.log(`      Kar: ${result.profitability?.percent.toFixed(2)}%`);
    
    return (result.scenario === 'SELL' || result.scenario === 'BUY') &&
           result.profitability !== undefined;
});

runTest('Yetersiz bakiye tespiti çalışıyor mu?', () => {
    const balances = {
        btcturk: { XRP: 5, USDT: 10 },
        binance: { XRP: 3, USDT: 15 }
    };
    
    const result = engine.determineOrderSide(balances, realWorldPrices);
    
    console.log(`      Mümkün mü: ${result.possible ? 'EVET' : 'HAYIR'}`);
    console.log(`      Sebep: ${result.reason}`);
    
    return !result.possible;
});

runTest('Gerekli bakiye hesaplaması doğru mu?', () => {
    const requiredBuy = engine.calculateRequiredBalance('BUY', 2.6910);
    const requiredSell = engine.calculateRequiredBalance('SELL', 2.7010);
    
    const expectedBuy = 2.6910 * 10 * (1 + 0.001);
    const expectedSell = 2.7010 * 10 * (1 + 0.0008);
    
    console.log(`      BUY gerekli: ${requiredBuy.toFixed(2)} USDT (beklenen: ${expectedBuy.toFixed(2)})`);
    console.log(`      SELL gerekli: ${requiredSell.toFixed(2)} USDT (beklenen: ${expectedSell.toFixed(2)})`);
    
    return Math.abs(requiredBuy - expectedBuy) < 0.01 &&
           Math.abs(requiredSell - expectedSell) < 0.01;
});

runTest('Bakiye validasyonu çalışıyor mu?', () => {
    const validation = engine.validateBalance(realWorldBalances, 'SELL', realWorldPrices);
    
    console.log(`      Geçerli mi: ${validation.valid ? 'EVET' : 'HAYIR'}`);
    console.log(`      Sebep: ${validation.reason}`);
    
    return validation.valid === true;
});

console.log('\n━'.repeat(80));
console.log('🔢 BÖLÜM 5: EDGE CASE TESTLERİ');
console.log('━'.repeat(80));

runTest('Sıfır spread durumu', () => {
    const zeroPrices = {
        btcturkBid: 2.7000,
        btcturkAsk: 2.7000,
        binanceBid: 2.7000,
        binanceAsk: 2.7000
    };
    
    const result = engine.calculateProfitability(zeroPrices, 10);
    
    console.log(`      SELL kar: ${result.sellScenario.profit.percent.toFixed(2)}%`);
    console.log(`      Fırsat var: ${result.hasOpportunity ? 'EVET' : 'HAYIR'}`);
    
    return !result.hasOpportunity;
});

runTest('Negatif spread durumu (Binance daha pahalı)', () => {
    const negativePrices = {
        btcturkBid: 2.6800,
        btcturkAsk: 2.6810,
        binanceBid: 2.7000,
        binanceAsk: 2.7010
    };
    
    const result = engine.calculateProfitability(negativePrices, 10);
    
    console.log(`      SELL kar: ${result.sellScenario.profit.percent.toFixed(2)}%`);
    console.log(`      BUY kar: ${result.buyScenario.profit.percent.toFixed(2)}%`);
    console.log(`      Fırsat var: ${result.hasOpportunity ? 'EVET' : 'HAYIR'}`);
    
    return result.sellScenario.profit.amount < 0;
});

runTest('Çok küçük spread (%0.05)', () => {
    const smallSpreadPrices = {
        btcturkBid: 2.7005,
        btcturkAsk: 2.7015,
        binanceBid: 2.6995,
        binanceAsk: 2.7000
    };
    
    const result = engine.calculateProfitability(smallSpreadPrices, 10);
    
    console.log(`      Spread: ${result.bestScenario.profit.spread.toFixed(2)}%`);
    console.log(`      Min spread: ${engine.minSpread}%`);
    console.log(`      Fırsat var: ${result.hasOpportunity ? 'EVET' : 'HAYIR'}`);
    
    return !result.hasOpportunity; // Min spread %0.3 olduğu için fırsat yok
});

runTest('Farklı trade amount ile hesaplama', () => {
    const result1 = engine.calculateProfitability_Sell(2.7000, 2.6910, 10);
    const result2 = engine.calculateProfitability_Sell(2.7000, 2.6910, 20);
    
    console.log(`      10 XRP kar: ${result1.profit.amount.toFixed(4)} USDT`);
    console.log(`      20 XRP kar: ${result2.profit.amount.toFixed(4)} USDT`);
    console.log(`      Oran aynı mı: ${Math.abs(result1.profit.percent - result2.profit.percent) < 0.001 ? 'EVET' : 'HAYIR'}`);
    
    return Math.abs(result2.profit.amount - (result1.profit.amount * 2)) < 0.01;
});

console.log('\n━'.repeat(80));
console.log('📊 BÖLÜM 6: MATEMATİKSEL DOĞRULAMA');
console.log('━'.repeat(80));

runTest('Karlılık ve fiyat hesabı tutarlı mı?', () => {
    // Önce karlılık hesapla
    const profitability = engine.calculateProfitability_Sell(
        realWorldPrices.btcturkBid,
        realWorldPrices.binanceAsk,
        10
    );
    
    // Sonra fiyat hesapla
    const pricing = engine.calculateOrderPrice_Sell(
        realWorldPrices.binanceAsk,
        0.15,
        0.1
    );
    
    console.log(`      Karlılık hesabı kar: ${profitability.profit.percent.toFixed(2)}%`);
    console.log(`      Fiyat hesabı hedef: ${pricing.targetProfit}%`);
    console.log(`      Hesaplanan fiyat: ${pricing.orderPrice} USDT`);
    console.log(`      Mevcut bid: ${realWorldPrices.btcturkBid} USDT`);
    
    // Hesaplanan fiyat, mevcut bid'den yüksek olmalı
    return pricing.orderPrice > realWorldPrices.btcturkBid;
});

runTest('Net kar pozitif ise profitable true olmalı', () => {
    const result = engine.calculateProfitability_Sell(2.7100, 2.6910, 10);
    
    console.log(`      Net kar: ${result.profit.amount.toFixed(4)} USDT`);
    console.log(`      Kar oranı: ${result.profit.percent.toFixed(2)}%`);
    console.log(`      Profitable: ${result.profitable ? 'EVET' : 'HAYIR'}`);
    
    return (result.profit.amount > 0 && result.profit.percent >= 0.1) === result.profitable;
});

// SONUÇLAR
console.log('\n' + '='.repeat(80));
console.log('📊 TEST SONUÇLARI');
console.log('='.repeat(80));
console.log(`\n✅ Başarılı: ${testsPassed} test`);
console.log(`❌ Başarısız: ${testsFailed} test`);
console.log(`📈 Başarı Oranı: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (testsFailed === 0) {
    console.log('\n🎉 TÜM TESTLER BAŞARIYLA TAMAMLANDI!');
    console.log('✅ ArbitrageEngine production-ready durumda!');
} else {
    console.log('\n⚠️  Bazı testler başarısız oldu. Lütfen kontrol edin.');
}

console.log('\n' + '='.repeat(80) + '\n');
