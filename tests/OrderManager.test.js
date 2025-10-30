// tests/OrderManager.test.js
import OrderManager from '../src/bot/modules/OrderManager.js';
import BotState from '../src/bot/modules/BotState.js';
import { jest } from '@jest/globals';

describe('OrderManager', () => {
    let orderManager;
    let mockBtcturkClient;
    let mockBinanceClient;
    let mockEngine;
    let mockSlippageService; // Add mock for the new dependency
    let botState;

    beforeEach(() => {
        const mockPairConfig = { symbol: 'XRPUSDT', baseCoin: 'XRP', denominatorScale: 4 };
        botState = new BotState(mockPairConfig);

        mockBtcturkClient = {
            createLimitOrder: jest.fn().mockResolvedValue({ id: '12345' }),
            getOrder: jest.fn(),
            cancelOrder: jest.fn().mockResolvedValue(true),
        };
        mockBinanceClient = {
            createMarketOrder: jest.fn().mockResolvedValue({ id: '67890' }),
        };
        mockEngine = {
            determineScenario: jest.fn(),
            validateBalance: jest.fn(),
            calculateOrderPrice: jest.fn(),
            tradeAmount: 10,
        };
        // Mock the SlippageService
        mockSlippageService = {
            calculateSlippage: jest.fn().mockResolvedValue({
                hasEnoughLiquidity: true,
                slippagePercent: '0.0500'
            }),
        };

        // Pass the new mock service to the constructor
        orderManager = new OrderManager(mockBtcturkClient, mockBinanceClient, botState, mockEngine, mockSlippageService);
        orderManager.orderCheckInterval = 10; // Speed up tests
    });

    afterEach(() => {
        orderManager.stopOrderMonitoring();
    });

    it('should create a new order if conditions are met', async () => {
        // Setup mocks for a successful SELL scenario
        botState.updatePrice('btcturk', { bid: 2.7, ask: 2.71 });
        botState.updatePrice('binance', { bid: 2.68, ask: 2.69 });
        mockEngine.determineScenario.mockReturnValue({ scenario: 'SELL' });
        mockEngine.validateBalance.mockReturnValue(true); // Simplified return
        mockEngine.calculateOrderPrice.mockReturnValue({ orderPrice: 2.75 });

        const result = await orderManager.createNewOrder();

        expect(result).toBe(true);
        expect(mockSlippageService.calculateSlippage).toHaveBeenCalled(); // Verify slippage check was done
        expect(mockBtcturkClient.createLimitOrder).toHaveBeenCalledWith(expect.objectContaining({
            side: 'sell',
            price: 2.75,
        }));
        expect(botState.isOrderActive()).toBe(true);
    });

    it('should not create an order if liquidity is insufficient', async () => {
        // Mock slippage service to report insufficient liquidity
        mockSlippageService.calculateSlippage.mockResolvedValue({ hasEnoughLiquidity: false });

        botState.updatePrice('btcturk', { bid: 2.7, ask: 2.71 });
        botState.updatePrice('binance', { bid: 2.68, ask: 2.69 });
        mockEngine.determineScenario.mockReturnValue({ scenario: 'SELL' });
        mockEngine.validateBalance.mockReturnValue(true);

        const result = await orderManager.createNewOrder();

        expect(result).toBe(false);
        expect(mockBtcturkClient.createLimitOrder).not.toHaveBeenCalled();
    });

    // ... other tests remain the same
    it('should not create an order if another is active', async () => {
        botState.setCurrentOrder({ orderId: 'active123' });
        const result = await orderManager.createNewOrder();
        expect(result).toBe(false);
        expect(mockBtcturkClient.createLimitOrder).not.toHaveBeenCalled();
    });

    it('should not create an order if balance is insufficient', async () => {
        botState.updatePrice('btcturk', { bid: 2.7, ask: 2.71 });
        botState.updatePrice('binance', { bid: 2.68, ask: 2.69 });
        mockEngine.determineScenario.mockReturnValue({ scenario: 'SELL' });
        mockEngine.validateBalance.mockReturnValue(false); // Balance is not valid

        const result = await orderManager.createNewOrder();

        expect(result).toBe(false);
        expect(mockBtcturkClient.createLimitOrder).not.toHaveBeenCalled();
    });

    it('should execute a counter order when the main order is filled', async () => {
        botState.setCurrentOrder({ orderId: '12345', amount: 10, scenario: 'SELL', txId: 'test-tx' });
        mockBtcturkClient.getOrder.mockResolvedValue({ status: 'Closed' });
        await orderManager.checkOrderStatus();
        expect(mockBinanceClient.createMarketOrder).toHaveBeenCalled();
        expect(botState.isOrderActive()).toBe(false);
    });
});
