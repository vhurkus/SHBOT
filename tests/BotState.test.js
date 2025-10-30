// tests/BotState.test.js
import BotState from '../src/bot/modules/BotState.js';

describe('BotState', () => {
    let botState;
    const mockPairConfig = {
        symbol: 'XRPUSDT',
        baseCoin: 'XRP',
        quoteCoin: 'USDT',
    };

    beforeEach(() => {
        botState = new BotState(mockPairConfig);
    });

    it('should initialize with correct default values', () => {
        expect(botState.pairConfig).toEqual(mockPairConfig);
        expect(botState.prices.btcturk.bid).toBeNull();
        expect(botState.balances.binance.USDT).toBe(0);
        expect(botState.isOrderActive()).toBe(false);
    });

    describe('updatePrice', () => {
        it('should update the price for a given exchange', () => {
            const priceData = { bid: 2.7, ask: 2.71, last: 2.7 };
            botState.updatePrice('binance', priceData);
            expect(botState.prices.binance.bid).toBe(2.7);
            expect(botState.prices.binance.ask).toBe(2.71);
            expect(botState.prices.binance.timestamp).toBeDefined();
        });

        it('should return false for invalid price data', () => {
            const result = botState.updatePrice('btcturk', { bid: 'invalid', ask: 0 });
            expect(result).toBe(false);
            expect(botState.prices.btcturk.bid).toBeNull();
        });
    });

    describe('updateBalance', () => {
        it('should update the balance for a given exchange', () => {
            const balanceData = {
                XRP: { free: '100.5', locked: '10.2' },
                USDT: { free: '5000.75', locked: '500.1' }
            };
            botState.updateBalance('btcturk', balanceData);
            expect(botState.balances.btcturk.XRP).toBe(100.5);
            expect(botState.balances.btcturk.lockedXRP).toBe(10.2);
            expect(botState.balances.btcturk.totalUSDT).toBeCloseTo(5500.85);
        });
    });

    describe('Order State Management', () => {
        it('should set and clear the current order', () => {
            const orderData = { orderId: '123', side: 'SELL', price: 2.75 };
            botState.setCurrentOrder(orderData);
            expect(botState.isOrderActive()).toBe(true);
            expect(botState.currentOrder.orderId).toBe('123');

            botState.clearCurrentOrder();
            expect(botState.isOrderActive()).toBe(false);
            expect(botState.currentOrder.orderId).toBeNull();
        });
    });
});
