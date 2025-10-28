/**
 * Emir Fiyat Hesaplama Testi
 * Test order price calculation algorithms
 */

import ArbitrageEngine from './ArbitrageEngine.js';

console.log('\n🧪 Emir Fiyat Hesaplama Testi Başlatılıyor...\n');

const engine = new ArbitrageEngine();

console.log('='.repeat(80));
console.log('📊 TEST 1: SELL Senaryosu - Emir Fiyatı Hesaplama');
console.log('='.repeat(80));
console.log('Binance Ask: 2.6790 USDT (buradan market BUY yapacağız)');
console.log('Hedef Kar: %0.15');
console.log('Spread Buffer: %0.1\n');

const sellPrice = engine.calculateOrderPrice_Sell(2.6790, 0.15, 0.1);

console.log('💰 Fiyat Hesaplama Detayları:');
console.log(`   Binance Ask: ${sellPrice.binanceAsk.toFixed(4)} USDT`);
console.log(`   Binance Alış Maliyeti (fee ile): ${sellPrice.binanceBuyCost.toFixed(4)} USDT`);
console.log(`   Hedef Kar: %${sellPrice.targetProfit}`);
console.log(`   Spread Buffer: %${sellPrice.spreadBuffer}\n`);

console.log('📋 Maliyet Dağılımı:');
console.log(`   Binance Ask: ${sellPrice.breakdown.binanceAsk.toFixed(4)} USDT`);
console.log(`   Binance Fee (%0.1): ${sellPrice.breakdown.binanceFee.toFixed(4)} USDT`);
console.log(`   Hedef Kar (%0.15): ${sellPrice.breakdown.targetProfit.toFixed(4)} USDT`);
console.log(`   BTCTurk Fee (%0.08): ${sellPrice.breakdown.btcturkFee.toFixed(4)} USDT`);
console.log(`   Spread Buffer (%0.1): ${sellPrice.breakdown.spreadBuffer.toFixed(4)} USDT\n`);

console.log('🎯 Sonuç:');
console.log(`   Hesaplanan Fiyat: ${sellPrice.calculatedPrice.toFixed(4)} USDT`);
console.log(`   Emir Fiyatı (rounded): ${sellPrice.orderPrice} USDT`);
console.log(`   BTCTurk'te ${sellPrice.orderPrice} USDT'den SELL limit emri ver\n`);

console.log('='.repeat(80));
console.log('📊 TEST 2: BUY Senaryosu - Emir Fiyatı Hesaplama');
console.log('='.repeat(80));
console.log('Binance Bid: 2.6800 USDT (buradan market SELL yapacağız)');
console.log('Hedef Kar: %0.15');
console.log('Spread Buffer: %0.1\n');

const buyPrice = engine.calculateOrderPrice_Buy(2.6800, 0.15, 0.1);

console.log('💰 Fiyat Hesaplama Detayları:');
console.log(`   Binance Bid: ${buyPrice.binanceBid.toFixed(4)} USDT`);
console.log(`   Binance Satış Geliri (fee ile): ${buyPrice.binanceSellRevenue.toFixed(4)} USDT`);
console.log(`   Hedef Kar: %${buyPrice.targetProfit}`);
console.log(`   Spread Buffer: %${buyPrice.spreadBuffer}\n`);

console.log('📋 Maliyet Dağılımı:');
console.log(`   Binance Bid: ${buyPrice.breakdown.binanceBid.toFixed(4)} USDT`);
console.log(`   Binance Fee (%0.1): ${buyPrice.breakdown.binanceFee.toFixed(4)} USDT`);
console.log(`   Hedef Kar (%0.15): ${buyPrice.breakdown.targetProfit.toFixed(4)} USDT`);
console.log(`   BTCTurk Fee (%0.08): ${buyPrice.breakdown.btcturkFee.toFixed(4)} USDT`);
console.log(`   Spread Buffer (%0.1): ${buyPrice.breakdown.spreadBuffer.toFixed(4)} USDT\n`);

console.log('🎯 Sonuç:');
console.log(`   Hesaplanan Fiyat: ${buyPrice.calculatedPrice.toFixed(4)} USDT`);
console.log(`   Emir Fiyatı (rounded): ${buyPrice.orderPrice} USDT`);
console.log(`   BTCTurk'te ${buyPrice.orderPrice} USDT'den BUY limit emri ver\n`);

console.log('='.repeat(80));
console.log('📊 TEST 3: Otomatik Senaryo Seçimi ve Fiyat Hesaplama');
console.log('='.repeat(80));

const prices = {
    btcturkBid: 2.7000,
    btcturkAsk: 2.7010,
    binanceBid: 2.6900,
    binanceAsk: 2.6910
};

console.log('Piyasa Fiyatları:');
console.log(`  BTCTurk: BID ${prices.btcturkBid} / ASK ${prices.btcturkAsk}`);
console.log(`  Binance: BID ${prices.binanceBid} / ASK ${prices.binanceAsk}\n`);

const optimalOrder = engine.calculateOrderPrice(prices);

console.log('🎯 Optimal Emir:');
console.log(`   Seçilen Senaryo: ${optimalOrder.scenario}`);
console.log(`   Emir Fiyatı: ${optimalOrder.orderPrice} USDT`);
console.log(`   Hedef Kar: %${optimalOrder.targetProfit}`);
console.log(`   Fırsat Var mı? ${optimalOrder.hasOpportunity ? '✅ EVET' : '❌ HAYIR'}\n`);

if (optimalOrder.scenario === 'SELL') {
    console.log('📝 Aksiyon:');
    console.log(`   1. BTCTurk'te ${optimalOrder.orderPrice} USDT'den 10 XRP SELL limit emri ver`);
    console.log(`   2. Emir dolduğunda, Binance'te ${prices.binanceAsk} USDT'den 10 XRP market BUY yap`);
} else {
    console.log('📝 Aksiyon:');
    console.log(`   1. BTCTurk'te ${optimalOrder.orderPrice} USDT'den 10 XRP BUY limit emri ver`);
    console.log(`   2. Emir dolduğunda, Binance'te ${prices.binanceBid} USDT'den 10 XRP market SELL yap`);
}

console.log('\n💰 Beklenen Karlılık:');
console.log(`   Kar Oranı: ${optimalOrder.profitability.profit.percent.toFixed(2)}%`);
console.log(`   Kar Miktarı: ${optimalOrder.profitability.profit.amount.toFixed(4)} USDT`);
console.log(`   Spread: ${optimalOrder.profitability.profit.spread.toFixed(2)}%\n`);

console.log('='.repeat(80));
console.log('📊 TEST 4: Farklı Hedef Kar Oranları ile Test');
console.log('='.repeat(80));

const testProfits = [0.1, 0.15, 0.2, 0.3];

console.log('Binance Ask: 2.6790 USDT\n');
console.log('Hedef Kar %  | Emir Fiyatı | Fark');
console.log('-'.repeat(40));

testProfits.forEach(profit => {
    const result = engine.calculateOrderPrice_Sell(2.6790, profit, 0.1);
    const diff = ((result.orderPrice - 2.6790) / 2.6790 * 100).toFixed(2);
    console.log(`%${profit.toFixed(2).padEnd(9)} | ${result.orderPrice.toFixed(4).padEnd(11)} | +${diff}%`);
});

console.log('\n✅ Emir fiyat hesaplama testleri tamamlandı!\n');
