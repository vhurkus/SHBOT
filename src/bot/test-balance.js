/**
 * Bakiye ve Pozisyon Yönetimi Testleri
 * Task 2.5 için test senaryoları
 */

import ArbitrageEngine from './ArbitrageEngine.js';

console.log('\n🧪 Bakiye ve Pozisyon Yönetimi Testi Başlatılıyor...\n');

const engine = new ArbitrageEngine();

// Test fiyatları
const testPrices = {
    btcturkBid: 2.7000,
    btcturkAsk: 2.7010,
    binanceBid: 2.6900,
    binanceAsk: 2.6910
};

console.log('='.repeat(80));
console.log('📊 TEST 1: Sadece BTCTurk\'te XRP var (SELL senaryosu)');
console.log('='.repeat(80));

const balances1 = {
    btcturk: {
        XRP: 15.00,    // Yeterli XRP var
        USDT: 5.00     // Az USDT
    },
    binance: {
        XRP: 0.00,     // XRP yok
        USDT: 50.00    // Yeterli USDT var
    }
};

console.log('\n💼 Bakiyeler:');
console.log(`  BTCTurk: ${balances1.btcturk.XRP} XRP, ${balances1.btcturk.USDT} USDT`);
console.log(`  Binance: ${balances1.binance.XRP} XRP, ${balances1.binance.USDT} USDT`);

const orderSide1 = engine.determineOrderSide(balances1, testPrices);

console.log('\n🎯 Emir Yönü Kararı:');
console.log(`  Mümkün mü? ${orderSide1.possible ? '✅ EVET' : '❌ HAYIR'}`);
console.log(`  Senaryo: ${orderSide1.scenario}`);
console.log(`  BTCTurk Emri: ${orderSide1.btcturkSide}`);
console.log(`  Binance Emri: ${orderSide1.binanceSide}`);
console.log(`  Sebep: ${orderSide1.reason}`);

if (orderSide1.balances) {
    console.log('\n💰 Bakiye Detayları:');
    console.log(`  Gerekli USDT: ${orderSide1.balances.requiredUSDT?.toFixed(2) || 'N/A'} USDT`);
    console.log(`  Mevcut USDT: ${orderSide1.balances.binanceUSDT?.toFixed(2) || 'N/A'} USDT`);
}

// Validasyon testi
const validation1 = engine.validateBalance(balances1, orderSide1.scenario, testPrices);
console.log('\n✅ Bakiye Validasyonu:');
console.log(`  Geçerli mi? ${validation1.valid ? '✅ EVET' : '❌ HAYIR'}`);
console.log(`  Sebep: ${validation1.reason}`);

if (validation1.checks) {
    console.log('\n📋 Kontrol Detayları:');
    Object.entries(validation1.checks).forEach(([key, check]) => {
        console.log(`  ${key}:`);
        console.log(`    Gerekli: ${check.required.toFixed(2)}`);
        console.log(`    Mevcut: ${check.available.toFixed(2)}`);
        console.log(`    Yeterli: ${check.sufficient ? '✅' : '❌'}`);
    });
}

console.log('\n' + '='.repeat(80));
console.log('📊 TEST 2: Sadece Binance\'te XRP var (BUY senaryosu)');
console.log('='.repeat(80));

const balances2 = {
    btcturk: {
        XRP: 0.00,     // XRP yok
        USDT: 50.00    // Yeterli USDT var
    },
    binance: {
        XRP: 15.00,    // Yeterli XRP var
        USDT: 5.00     // Az USDT
    }
};

console.log('\n💼 Bakiyeler:');
console.log(`  BTCTurk: ${balances2.btcturk.XRP} XRP, ${balances2.btcturk.USDT} USDT`);
console.log(`  Binance: ${balances2.binance.XRP} XRP, ${balances2.binance.USDT} USDT`);

const orderSide2 = engine.determineOrderSide(balances2, testPrices);

console.log('\n🎯 Emir Yönü Kararı:');
console.log(`  Mümkün mü? ${orderSide2.possible ? '✅ EVET' : '❌ HAYIR'}`);
console.log(`  Senaryo: ${orderSide2.scenario}`);
console.log(`  BTCTurk Emri: ${orderSide2.btcturkSide}`);
console.log(`  Binance Emri: ${orderSide2.binanceSide}`);
console.log(`  Sebep: ${orderSide2.reason}`);

if (orderSide2.balances) {
    console.log('\n💰 Bakiye Detayları:');
    console.log(`  Gerekli USDT: ${orderSide2.balances.requiredUSDT?.toFixed(2) || 'N/A'} USDT`);
    console.log(`  Mevcut USDT: ${orderSide2.balances.btcturkUSDT?.toFixed(2) || 'N/A'} USDT`);
}

// Validasyon testi
const validation2 = engine.validateBalance(balances2, orderSide2.scenario, testPrices);
console.log('\n✅ Bakiye Validasyonu:');
console.log(`  Geçerli mi? ${validation2.valid ? '✅ EVET' : '❌ HAYIR'}`);
console.log(`  Sebep: ${validation2.reason}`);

if (validation2.checks) {
    console.log('\n📋 Kontrol Detayları:');
    Object.entries(validation2.checks).forEach(([key, check]) => {
        console.log(`  ${key}:`);
        console.log(`    Gerekli: ${check.required.toFixed(2)}`);
        console.log(`    Mevcut: ${check.available.toFixed(2)}`);
        console.log(`    Yeterli: ${check.sufficient ? '✅' : '❌'}`);
    });
}

console.log('\n' + '='.repeat(80));
console.log('📊 TEST 3: Her iki borsada da XRP var (Karlılığa göre seçim)');
console.log('='.repeat(80));

const balances3 = {
    btcturk: {
        XRP: 15.00,    // Yeterli XRP
        USDT: 50.00    // Yeterli USDT
    },
    binance: {
        XRP: 15.00,    // Yeterli XRP
        USDT: 50.00    // Yeterli USDT
    }
};

console.log('\n💼 Bakiyeler:');
console.log(`  BTCTurk: ${balances3.btcturk.XRP} XRP, ${balances3.btcturk.USDT} USDT`);
console.log(`  Binance: ${balances3.binance.XRP} XRP, ${balances3.binance.USDT} USDT`);

console.log('\n📈 Piyasa Fiyatları:');
console.log(`  BTCTurk: BID ${testPrices.btcturkBid} / ASK ${testPrices.btcturkAsk}`);
console.log(`  Binance: BID ${testPrices.binanceBid} / ASK ${testPrices.binanceAsk}`);

const orderSide3 = engine.determineOrderSide(balances3, testPrices);

console.log('\n🎯 Emir Yönü Kararı:');
console.log(`  Mümkün mü? ${orderSide3.possible ? '✅ EVET' : '❌ HAYIR'}`);
console.log(`  Senaryo: ${orderSide3.scenario}`);
console.log(`  BTCTurk Emri: ${orderSide3.btcturkSide}`);
console.log(`  Binance Emri: ${orderSide3.binanceSide}`);
console.log(`  Sebep: ${orderSide3.reason}`);

if (orderSide3.profitability) {
    console.log('\n💰 Karlılık Bilgisi:');
    console.log(`  Kar Oranı: ${orderSide3.profitability.percent.toFixed(2)}%`);
    console.log(`  Kar Miktarı: ${orderSide3.profitability.amount.toFixed(4)} USDT`);
    console.log(`  Spread: ${orderSide3.profitability.spread.toFixed(2)}%`);
}

// Validasyon testi
const validation3 = engine.validateBalance(balances3, orderSide3.scenario, testPrices);
console.log('\n✅ Bakiye Validasyonu:');
console.log(`  Geçerli mi? ${validation3.valid ? '✅ EVET' : '❌ HAYIR'}`);
console.log(`  Sebep: ${validation3.reason}`);

console.log('\n' + '='.repeat(80));
console.log('📊 TEST 4: Yetersiz bakiye senaryoları');
console.log('='.repeat(80));

const balances4 = {
    btcturk: {
        XRP: 5.00,     // Yetersiz XRP (10 gerekli)
        USDT: 10.00    // Az USDT
    },
    binance: {
        XRP: 3.00,     // Yetersiz XRP
        USDT: 15.00    // Az USDT
    }
};

console.log('\n💼 Bakiyeler:');
console.log(`  BTCTurk: ${balances4.btcturk.XRP} XRP, ${balances4.btcturk.USDT} USDT`);
console.log(`  Binance: ${balances4.binance.XRP} XRP, ${balances4.binance.USDT} USDT`);
console.log(`  Gerekli: ${engine.tradeAmount} XRP`);

const orderSide4 = engine.determineOrderSide(balances4, testPrices);

console.log('\n🎯 Emir Yönü Kararı:');
console.log(`  Mümkün mü? ${orderSide4.possible ? '✅ EVET' : '❌ HAYIR'}`);
console.log(`  Sebep: ${orderSide4.reason}`);

if (orderSide4.btcturkXRP !== undefined) {
    console.log('\n📊 Bakiye Durumu:');
    console.log(`  BTCTurk XRP: ${orderSide4.btcturkXRP.toFixed(2)} (Gerekli: ${orderSide4.requiredXRP})`);
    console.log(`  Binance XRP: ${orderSide4.binanceXRP.toFixed(2)} (Gerekli: ${orderSide4.requiredXRP})`);
}

console.log('\n' + '='.repeat(80));
console.log('📊 TEST 5: Gerekli bakiye hesaplama testleri');
console.log('='.repeat(80));

const testPrice = 2.6910;
const requiredForBuy = engine.calculateRequiredBalance('BUY', testPrice);
const requiredForSell = engine.calculateRequiredBalance('SELL', 2.7010);

console.log('\n💵 Market BUY için gerekli bakiye:');
console.log(`  Fiyat: ${testPrice} USDT`);
console.log(`  Miktar: ${engine.tradeAmount} XRP`);
console.log(`  Base Amount: ${(testPrice * engine.tradeAmount).toFixed(2)} USDT`);
console.log(`  Fee (${(engine.fees.binance.taker * 100).toFixed(1)}%): ${(testPrice * engine.tradeAmount * engine.fees.binance.taker).toFixed(2)} USDT`);
console.log(`  Toplam Gerekli: ${requiredForBuy.toFixed(2)} USDT`);

console.log('\n💵 Limit BUY için gerekli bakiye:');
console.log(`  Fiyat: 2.7010 USDT`);
console.log(`  Miktar: ${engine.tradeAmount} XRP`);
console.log(`  Base Amount: ${(2.7010 * engine.tradeAmount).toFixed(2)} USDT`);
console.log(`  Fee (${(engine.fees.btcturk.maker * 100).toFixed(2)}%): ${(2.7010 * engine.tradeAmount * engine.fees.btcturk.maker).toFixed(2)} USDT`);
console.log(`  Toplam Gerekli: ${requiredForSell.toFixed(2)} USDT`);

console.log('\n✅ Bakiye ve pozisyon yönetimi testleri tamamlandı!\n');
