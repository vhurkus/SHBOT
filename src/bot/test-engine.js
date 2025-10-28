/**
 * ArbitrageEngine Test
 * Tests the arbitrage engine base functionality
 */

import ArbitrageEngine from './ArbitrageEngine.js';

console.log('\n🧪 ArbitrageEngine Test Başlatılıyor...\n');

// Test 1: Default yapılandırma ile engine oluşturma
console.log('📋 Test 1: Default Configuration');
console.log('='.repeat(60));
const engine1 = new ArbitrageEngine();
engine1.printStatus();

// Test 2: Custom yapılandırma ile engine oluşturma
console.log('📋 Test 2: Custom Configuration');
console.log('='.repeat(60));
const engine2 = new ArbitrageEngine({
    btcturkMakerFee: 0.001,
    btcturkTakerFee: 0.0015,
    binanceMakerFee: 0.0008,
    binanceTakerFee: 0.0008,
    minSpread: 0.5,
    minProfit: 0.15,
    tradeAmount: 20
});
engine2.printStatus();

// Test 3: Fee güncelleme
console.log('📋 Test 3: Fee Update');
console.log('='.repeat(60));
engine1.updateFees('btcturk', 0.0006, 0.001);
engine1.updateFees('binance', 0.0009, 0.0009);
console.log('\nGüncellenmiş fee\'ler:');
console.log(`  BTCTurk Maker: ${(engine1.fees.btcturk.maker * 100).toFixed(2)}%`);
console.log(`  BTCTurk Taker: ${(engine1.fees.btcturk.taker * 100).toFixed(2)}%`);
console.log(`  Binance Maker: ${(engine1.fees.binance.maker * 100).toFixed(2)}%`);
console.log(`  Binance Taker: ${(engine1.fees.binance.taker * 100).toFixed(2)}%\n`);

// Test 4: Spread ve profit güncelleme
console.log('📋 Test 4: Spread & Profit Update');
console.log('='.repeat(60));
console.log(`Eski spread: ${engine1.minSpread}%`);
console.log(`Eski profit: ${engine1.minProfit}%`);
engine1.updateMinSpread(0.4);
engine1.updateMinProfit(0.12);
console.log(`Yeni spread: ${engine1.minSpread}%`);
console.log(`Yeni profit: ${engine1.minProfit}%\n`);

// Test 5: Trade amount güncelleme
console.log('📋 Test 5: Trade Amount Update');
console.log('='.repeat(60));
console.log(`Eski trade amount: ${engine1.tradeAmount} XRP`);
engine1.updateTradeAmount(15);
console.log(`Yeni trade amount: ${engine1.tradeAmount} XRP\n`);

// Test 6: Config okuma
console.log('📋 Test 6: Get Configuration');
console.log('='.repeat(60));
const config = engine1.getConfig();
console.log(JSON.stringify(config, null, 2));
console.log('');

// Final status
console.log('📋 Final Engine Status');
console.log('='.repeat(60));
engine1.printStatus();

console.log('✅ ArbitrageEngine testleri tamamlandı!\n');
