/**
 * Bakiye Bazlı Senaryo Testi
 *
 * Bu test 4 farklı bakiye durumunu simüle eder:
 * 1. XRP sadece BTCTurk'te
 * 2. XRP sadece Binance'te
 * 3. Her iki borsada da XRP yok
 * 4. Her iki borsada da XRP var
 */

import ArbitrageEngine from './src/bot/ArbitrageEngine.js';
import config from './src/config/config.js';

console.log('\n' + '='.repeat(80));
console.log('🧪 BAKİYE BAZLI SENARYO TESTİ');
console.log('='.repeat(80) + '\n');

// Engine oluştur
const engine = new ArbitrageEngine({
    btcturkMakerFee: config.trading.fees.btcturk.maker,
    btcturkTakerFee: config.trading.fees.btcturk.taker,
    binanceMakerFee: config.trading.fees.binance.maker,
    binanceTakerFee: config.trading.fees.binance.taker,
    minSpread: config.trading.minSpread,
    minProfit: config.trading.minProfit,
    tradeAmount: config.trading.tradeAmount
});

console.log('✅ ArbitrageEngine başlatıldı\n');
console.log('📊 Konfigürasyon:', {
    tradeAmount: config.trading.tradeAmount + ' XRP',
    minProfit: config.trading.minProfit + '%',
    minSpread: config.trading.minSpread + '%'
});
console.log('\n' + '='.repeat(80) + '\n');

// ============================================================================
// TEST SENARYO 1: XRP sadece BTCTurk'te
// ============================================================================

console.log('📋 TEST 1: XRP sadece BTCTurk\'te');
console.log('-'.repeat(80));

const scenario1 = engine.determineScenario({
    btcturk: {
        XRP: 15,    // Yeterli XRP var
        USDT: 50
    },
    binance: {
        XRP: 0,     // XRP yok
        USDT: 100
    }
});

console.log('Bakiye Durumu:');
console.log('  BTCTurk: 15 XRP, 50 USDT');
console.log('  Binance: 0 XRP, 100 USDT\n');

console.log('Sonuç:', {
    scenario: scenario1.scenario,
    btcturkSide: scenario1.btcturkSide,
    binanceSide: scenario1.binanceSide,
    needsPreparation: scenario1.needsPreparation,
    reason: scenario1.reason
});

console.log('\n✅ Beklenen: SELL senaryosu, hazırlık YOK');
console.log('✅ Gerçekleşen:', scenario1.scenario === 'SELL' && !scenario1.needsPreparation ? 'DOĞRU ✅' : 'YANLIŞ ❌');
console.log('\n' + '='.repeat(80) + '\n');

// ============================================================================
// TEST SENARYO 2: XRP sadece Binance'te
// ============================================================================

console.log('📋 TEST 2: XRP sadece Binance\'te');
console.log('-'.repeat(80));

const scenario2 = engine.determineScenario({
    btcturk: {
        XRP: 0,     // XRP yok
        USDT: 100
    },
    binance: {
        XRP: 15,    // Yeterli XRP var
        USDT: 50
    }
});

console.log('Bakiye Durumu:');
console.log('  BTCTurk: 0 XRP, 100 USDT');
console.log('  Binance: 15 XRP, 50 USDT\n');

console.log('Sonuç:', {
    scenario: scenario2.scenario,
    btcturkSide: scenario2.btcturkSide,
    binanceSide: scenario2.binanceSide,
    needsPreparation: scenario2.needsPreparation,
    reason: scenario2.reason
});

console.log('\n✅ Beklenen: BUY senaryosu, hazırlık YOK');
console.log('✅ Gerçekleşen:', scenario2.scenario === 'BUY' && !scenario2.needsPreparation ? 'DOĞRU ✅' : 'YANLIŞ ❌');
console.log('\n' + '='.repeat(80) + '\n');

// ============================================================================
// TEST SENARYO 3: Her iki borsada da XRP yok
// ============================================================================

console.log('📋 TEST 3: Her iki borsada da XRP yok (HAZIRLIK GEREKLİ)');
console.log('-'.repeat(80));

const scenario3 = engine.determineScenario({
    btcturk: {
        XRP: 0,     // XRP yok
        USDT: 50
    },
    binance: {
        XRP: 0,     // XRP yok
        USDT: 100   // Ama USDT var (BUY için yeterli)
    }
});

console.log('Bakiye Durumu:');
console.log('  BTCTurk: 0 XRP, 50 USDT');
console.log('  Binance: 0 XRP, 100 USDT\n');

console.log('Sonuç:', {
    scenario: scenario3.scenario,
    btcturkSide: scenario3.btcturkSide,
    binanceSide: scenario3.binanceSide,
    needsPreparation: scenario3.needsPreparation,
    canPrepare: scenario3.canPrepare,
    preparationType: scenario3.preparationType,
    reason: scenario3.reason
});

if (scenario3.preparationDetails) {
    console.log('\nHazırlık Detayları:', {
        exchange: scenario3.preparationDetails.exchange,
        side: scenario3.preparationDetails.side,
        amount: scenario3.preparationDetails.amount,
        reason: scenario3.preparationDetails.reason
    });
}

console.log('\n✅ Beklenen: SELL senaryosu (hedef), hazırlık VAR (Binance BUY)');
console.log('✅ Gerçekleşen:',
    scenario3.scenario === 'SELL' &&
    scenario3.needsPreparation &&
    scenario3.preparationType === 'BINANCE_BUY'
    ? 'DOĞRU ✅' : 'YANLIŞ ❌');
console.log('\n' + '='.repeat(80) + '\n');

// ============================================================================
// TEST SENARYO 4: Her iki borsada da XRP var
// ============================================================================

console.log('📋 TEST 4: Her iki borsada da XRP var (HAZIRLIK GEREKLİ)');
console.log('-'.repeat(80));

const scenario4 = engine.determineScenario({
    btcturk: {
        XRP: 15,    // XRP var
        USDT: 50
    },
    binance: {
        XRP: 20,    // XRP var
        USDT: 100
    }
});

console.log('Bakiye Durumu:');
console.log('  BTCTurk: 15 XRP, 50 USDT');
console.log('  Binance: 20 XRP, 100 USDT\n');

console.log('Sonuç:', {
    scenario: scenario4.scenario,
    btcturkSide: scenario4.btcturkSide,
    binanceSide: scenario4.binanceSide,
    needsPreparation: scenario4.needsPreparation,
    canPrepare: scenario4.canPrepare,
    preparationType: scenario4.preparationType,
    reason: scenario4.reason
});

if (scenario4.preparationDetails) {
    console.log('\nHazırlık Detayları:', {
        exchange: scenario4.preparationDetails.exchange,
        side: scenario4.preparationDetails.side,
        amount: scenario4.preparationDetails.amount,
        reason: scenario4.preparationDetails.reason
    });
}

console.log('\n✅ Beklenen: SELL senaryosu (hedef), hazırlık VAR (Binance SELL - boşalt)');
console.log('✅ Gerçekleşen:',
    scenario4.scenario === 'SELL' &&
    scenario4.needsPreparation &&
    scenario4.preparationType === 'BINANCE_SELL'
    ? 'DOĞRU ✅' : 'YANLIŞ ❌');
console.log('\n' + '='.repeat(80) + '\n');

// ============================================================================
// TEST SENARYO 5: Yetersiz USDT (hazırlık yapılamaz)
// ============================================================================

console.log('📋 TEST 5: Her iki borsada da XRP yok, USDT da YETERSİZ');
console.log('-'.repeat(80));

const scenario5 = engine.determineScenario({
    btcturk: {
        XRP: 0,
        USDT: 5     // Çok az
    },
    binance: {
        XRP: 0,
        USDT: 10    // Yetersiz (10 XRP × 2.7 = ~27 USDT gerekli)
    }
});

console.log('Bakiye Durumu:');
console.log('  BTCTurk: 0 XRP, 5 USDT');
console.log('  Binance: 0 XRP, 10 USDT (yetersiz!)\n');

console.log('Sonuç:', {
    scenario: scenario5.scenario,
    needsPreparation: scenario5.needsPreparation,
    canPrepare: scenario5.canPrepare,
    reason: scenario5.reason
});

console.log('\n✅ Beklenen: scenario=null, canPrepare=false');
console.log('✅ Gerçekleşen:',
    scenario5.scenario === null &&
    scenario5.canPrepare === false
    ? 'DOĞRU ✅' : 'YANLIŞ ❌');
console.log('\n' + '='.repeat(80) + '\n');

// ============================================================================
// ÖZET
// ============================================================================

console.log('📊 TEST SONUÇLARI ÖZET:');
console.log('='.repeat(80));

const results = [
    {
        name: 'Test 1: XRP BTCTurk\'te',
        pass: scenario1.scenario === 'SELL' && !scenario1.needsPreparation
    },
    {
        name: 'Test 2: XRP Binance\'te',
        pass: scenario2.scenario === 'BUY' && !scenario2.needsPreparation
    },
    {
        name: 'Test 3: Her iki borsada da YOK',
        pass: scenario3.scenario === 'SELL' &&
              scenario3.needsPreparation &&
              scenario3.preparationType === 'BINANCE_BUY'
    },
    {
        name: 'Test 4: Her iki borsada da VAR',
        pass: scenario4.scenario === 'SELL' &&
              scenario4.needsPreparation &&
              scenario4.preparationType === 'BINANCE_SELL'
    },
    {
        name: 'Test 5: Yetersiz USDT',
        pass: scenario5.scenario === null && scenario5.canPrepare === false
    }
];

results.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.name}: ${result.pass ? '✅ BAŞARILI' : '❌ BAŞARISIZ'}`);
});

const passedCount = results.filter(r => r.pass).length;
const totalCount = results.length;

console.log('\n' + '='.repeat(80));
console.log(`Sonuç: ${passedCount}/${totalCount} test geçti`);

if (passedCount === totalCount) {
    console.log('🎉 TÜM TESTLER BAŞARILI!');
} else {
    console.log('❌ Bazı testler başarısız oldu!');
}
console.log('='.repeat(80) + '\n');
