
import ArbitrageEngine from '../src/bot/ArbitrageEngine.js';
import config from '../src/config/config.js';

console.log('--- Running Test: Hardcoded Price Bug ---');

const engine = new ArbitrageEngine({
    ...config.trading,
    tradeAmount: 100
});

const balances_insufficient_for_real_price = {
    btcturk: { XRP: 0, USDT: 1000 },
    binance: { XRP: 0, USDT: 280 }
};

const prices_high = {
    binanceAsk: 3.0,
};

const result = engine.determineScenario(balances_insufficient_for_real_price, prices_high);

console.log('Balances:', balances_insufficient_for_real_price);
console.log('Prices:', prices_high);
console.log('Result:', result);

const pass = result.canPrepare === false;

console.log(`Test Result: ${pass ? '✅ BAŞARILI' : '❌ BAŞARISIZ'}`);

if (!pass) {
    console.error('Expected canPrepare to be false, but it was true.');
    process.exit(1);
}
