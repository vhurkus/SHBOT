/**
 * Karlılık Hesaplama Testi
 * Test arbitrage profitability calculations
 */

import ArbitrageEngine from './ArbitrageEngine.js';

console.log('\n🧪 Karlılık Hesaplama Testi Başlatılıyor...\n');

const engine = new ArbitrageEngine();

console.log('='.repeat(80));
console.log('📊 TEST 1: SELL Senaryosu (BTCTurk SELL, Binance BUY)');
console.log('='.repeat(80));
console.log('BTCTurk Bid: 2.6800 USDT (satış fiyatı)');
console.log('Binance Ask: 2.6750 USDT (alış fiyatı)');
console.log('Miktar: 10 XRP\n');

const sellResult = engine.calculateProfitability_Sell(2.6800, 2.6750, 10);

console.log('📈 BTCTurk\'te SELL (Limit - Maker):');
console.log(`   Fiyat: ${sellResult.btcturk.price.toFixed(4)} USDT`);
console.log(`   Miktar: ${sellResult.btcturk.amount} XRP`);
console.log(`   Toplam: ${sellResult.btcturk.total.toFixed(4)} USDT`);
console.log(`   Fee (${sellResult.btcturk.feePercent.toFixed(2)}%): ${sellResult.btcturk.fee.toFixed(4)} USDT`);
console.log(`   Net Kazanç: ${sellResult.btcturk.net.toFixed(4)} USDT`);

console.log('\n📉 Binance\'te BUY (Market - Taker):');
console.log(`   Fiyat: ${sellResult.binance.price.toFixed(4)} USDT`);
console.log(`   Miktar: ${sellResult.binance.amount} XRP`);
console.log(`   Toplam: ${sellResult.binance.total.toFixed(4)} USDT`);
console.log(`   Fee (${sellResult.binance.feePercent.toFixed(2)}%): ${sellResult.binance.fee.toFixed(4)} USDT`);
console.log(`   Net Harcama: ${sellResult.binance.net.toFixed(4)} USDT`);

console.log('\n💰 Karlılık:');
console.log(`   Kar: ${sellResult.profit.amount.toFixed(4)} USDT`);
console.log(`   Kar Oranı: ${sellResult.profit.percent.toFixed(2)}%`);
console.log(`   Spread: ${sellResult.profit.spread.toFixed(2)}%`);
console.log(`   Karlı mı? ${sellResult.profitable ? '✅ EVET' : '❌ HAYIR'}`);
console.log(`   Min Kar Karşılıyor mu? ${sellResult.meetsMinProfit ? '✅' : '❌'}`);
console.log(`   Min Spread Karşılıyor mu? ${sellResult.meetsMinSpread ? '✅' : '❌'}\n`);

console.log('='.repeat(80));
console.log('📊 TEST 2: BUY Senaryosu (Binance SELL, BTCTurk BUY)');
console.log('='.repeat(80));
console.log('Binance Bid: 2.6800 USDT (satış fiyatı)');
console.log('BTCTurk Ask: 2.6750 USDT (alış fiyatı)');
console.log('Miktar: 10 XRP\n');

const buyResult = engine.calculateProfitability_Buy(2.6750, 2.6800, 10);

console.log('📈 Binance\'te SELL (Market - Taker):');
console.log(`   Fiyat: ${buyResult.binance.price.toFixed(4)} USDT`);
console.log(`   Miktar: ${buyResult.binance.amount} XRP`);
console.log(`   Toplam: ${buyResult.binance.total.toFixed(4)} USDT`);
console.log(`   Fee (${buyResult.binance.feePercent.toFixed(2)}%): ${buyResult.binance.fee.toFixed(4)} USDT`);
console.log(`   Net Kazanç: ${buyResult.binance.net.toFixed(4)} USDT`);

console.log('\n📉 BTCTurk\'te BUY (Limit - Maker):');
console.log(`   Fiyat: ${buyResult.btcturk.price.toFixed(4)} USDT`);
console.log(`   Miktar: ${buyResult.btcturk.amount} XRP`);
console.log(`   Toplam: ${buyResult.btcturk.total.toFixed(4)} USDT`);
console.log(`   Fee (${buyResult.btcturk.feePercent.toFixed(2)}%): ${buyResult.btcturk.fee.toFixed(4)} USDT`);
console.log(`   Net Harcama: ${buyResult.btcturk.net.toFixed(4)} USDT`);

console.log('\n💰 Karlılık:');
console.log(`   Kar: ${buyResult.profit.amount.toFixed(4)} USDT`);
console.log(`   Kar Oranı: ${buyResult.profit.percent.toFixed(2)}%`);
console.log(`   Spread: ${buyResult.profit.spread.toFixed(2)}%`);
console.log(`   Karlı mı? ${buyResult.profitable ? '✅ EVET' : '❌ HAYIR'}`);
console.log(`   Min Kar Karşılıyor mu? ${buyResult.meetsMinProfit ? '✅' : '❌'}`);
console.log(`   Min Spread Karşılıyor mu? ${buyResult.meetsMinSpread ? '✅' : '❌'}\n`);

console.log('='.repeat(80));
console.log('📊 TEST 3: Gerçek Piyasa Fiyatları ile Tam Analiz');
console.log('='.repeat(80));

const prices = {
    btcturkBid: 2.6785,
    btcturkAsk: 2.6795,
    binanceBid: 2.6780,
    binanceAsk: 2.6790
};

console.log('Piyasa Fiyatları:');
console.log(`  BTCTurk: BID ${prices.btcturkBid} / ASK ${prices.btcturkAsk}`);
console.log(`  Binance: BID ${prices.binanceBid} / ASK ${prices.binanceAsk}\n`);

const analysis = engine.calculateProfitability(prices, 10);

console.log('📊 SELL Senaryosu Analizi:');
console.log(`   Kar: ${analysis.sellScenario.profit.amount.toFixed(4)} USDT (${analysis.sellScenario.profit.percent.toFixed(2)}%)`);
console.log(`   Karlı: ${analysis.sellScenario.profitable ? '✅' : '❌'}\n`);

console.log('📊 BUY Senaryosu Analizi:');
console.log(`   Kar: ${analysis.buyScenario.profit.amount.toFixed(4)} USDT (${analysis.buyScenario.profit.percent.toFixed(2)}%)`);
console.log(`   Karlı: ${analysis.buyScenario.profitable ? '✅' : '❌'}\n`);

console.log('🎯 EN İYİ SENARYO:');
console.log(`   Senaryo: ${analysis.bestScenario.scenario}`);
console.log(`   Kar: ${analysis.bestScenario.profit.amount.toFixed(4)} USDT`);
console.log(`   Kar Oranı: ${analysis.bestScenario.profit.percent.toFixed(2)}%`);
console.log(`   Fırsat Var mı? ${analysis.hasOpportunity ? '✅ EVET' : '❌ HAYIR'}\n`);

console.log('='.repeat(80));
console.log('📊 TEST 4: Karlı Olmayan Senaryo (Negatif Spread)');
console.log('='.repeat(80));

const badPrices = {
    btcturkBid: 2.6750,
    btcturkAsk: 2.6760,
    binanceBid: 2.6780,
    binanceAsk: 2.6790
};

console.log('Piyasa Fiyatları (Ters Spread):');
console.log(`  BTCTurk: BID ${badPrices.btcturkBid} / ASK ${badPrices.btcturkAsk}`);
console.log(`  Binance: BID ${badPrices.binanceBid} / ASK ${badPrices.binanceAsk}\n`);

const badAnalysis = engine.calculateProfitability(badPrices, 10);

console.log('🎯 Sonuç:');
console.log(`   SELL Kar: ${badAnalysis.sellScenario.profit.amount.toFixed(4)} USDT (${badAnalysis.sellScenario.profit.percent.toFixed(2)}%)`);
console.log(`   BUY Kar: ${badAnalysis.buyScenario.profit.amount.toFixed(4)} USDT (${badAnalysis.buyScenario.profit.percent.toFixed(2)}%)`);
console.log(`   Fırsat Var mı? ${badAnalysis.hasOpportunity ? '✅ EVET' : '❌ HAYIR - Beklenen'}\n`);

console.log('✅ Karlılık hesaplama testleri tamamlandı!\n');
