import ArbitrageEngine from '../src/bot/ArbitrageEngine.js';
// Correctly import both the default and the named export
import config, { getPairConfig } from '../src/config/config.js';

// NOTE: The config module validates environment variables on import.
// To work around this for tests, dummy environment variables are set
// in the "test" script in package.json. This is a pragmatic solution
// to unblock testing of the engine's pure logic.

describe('ArbitrageEngine - Core Calculations', () => {
    let engine;
    let mockPairConfig;

    beforeEach(() => {
        // Use the correctly imported named function
        mockPairConfig = getPairConfig('XRPUSDT');

        engine = new ArbitrageEngine({
            pairConfig: mockPairConfig,
            tradeAmount: mockPairConfig.tradeAmount,
            minProfit: mockPairConfig.minProfit,
            minSpread: mockPairConfig.minSpread
        });
    });

    describe('Constructor', () => {
        it('should initialize with the correct parameters from pairConfig', () => {
            expect(engine.tradeAmount).toBe(10);
            expect(engine.minProfit).toBe(0.03);
            expect(engine.minSpread).toBe(0.15);
            expect(engine.pairConfig.symbol).toBe('XRPUSDT');
        });
    });

    describe('Profitability Calculations', () => {
        const amount = 10;

        it('should correctly calculate a profitable SELL scenario', () => {
            const result = engine.calculateProfitability_Sell(2.7000, 2.6800, amount);
            expect(result.profitable).toBe(true);
            expect(result.profit.amount).toBeCloseTo(0.1516);
        });

        it('should correctly calculate a profitable BUY scenario', () => {
            const result = engine.calculateProfitability_Buy(2.6800, 2.7000, amount);
            expect(result.profitable).toBe(true);
            expect(result.profit.amount).toBeCloseTo(0.15156);
        });

        it('should identify an unprofitable scenario', () => {
            const result = engine.calculateProfitability_Sell(2.6810, 2.6800, amount);
            expect(result.profitable).toBe(false);
        });
    });

    describe('Order Price Calculations', () => {
        const targetProfit = 0.1; // 0.1%

        it('should calculate the correct SELL order price', () => {
            const binanceAsk = 2.6800;
            const result = engine.calculateOrderPrice_Sell(binanceAsk, targetProfit);
            const expectedPrice = 2.6875;
            expect(result.orderPrice).toBeCloseTo(expectedPrice);
            expect(result.scenario).toBe('SELL');
        });

        it('should calculate the correct BUY order price', () => {
            const binanceBid = 2.7000;
            const result = engine.calculateOrderPrice_Buy(binanceBid, targetProfit);
            const expectedPrice = 2.6924;
            expect(result.orderPrice).toBeCloseTo(expectedPrice);
            expect(result.scenario).toBe('BUY');
        });
    });
});
