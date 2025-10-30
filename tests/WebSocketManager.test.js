// tests/WebSocketManager.test.js
import WebSocketManager from '../src/bot/modules/WebSocketManager.js';
import BotState from '../src/bot/modules/BotState.js';
import { jest } from '@jest/globals';

describe('WebSocketManager', () => {
    let wsManager;
    let mockBtcturkClient;
    let mockBinanceClient;
    let botState;
    let onPriceUpdateCallback;

    beforeEach(() => {
        // Mock exchange clients
        mockBtcturkClient = {
            connectWebSocket: jest.fn().mockResolvedValue(true),
            disconnectWebSocket: jest.fn(),
        };
        mockBinanceClient = {
            connectWebSocket: jest.fn().mockResolvedValue(true),
            disconnectWebSocket: jest.fn(),
        };

        const mockPairConfig = { symbol: 'XRPUSDT', baseCoin: 'XRP' };
        botState = new BotState(mockPairConfig);
        onPriceUpdateCallback = jest.fn();

        wsManager = new WebSocketManager(mockBtcturkClient, mockBinanceClient, botState, onPriceUpdateCallback);
    });

    it('should call connectWebSocket on both clients when connectAll is called', async () => {
        await wsManager.connectAll();
        expect(mockBtcturkClient.connectWebSocket).toHaveBeenCalledTimes(1);
        expect(mockBinanceClient.connectWebSocket).toHaveBeenCalledTimes(1);
    });

    it('should invoke the onPriceUpdate callback when a client sends a price update', async () => {
        await wsManager.connectAll();

        // Simulate a price update from BTCTurk
        const btcturkCallback = mockBtcturkClient.connectWebSocket.mock.calls[0][0];
        btcturkCallback({ bid: 2.7, ask: 2.71 });

        expect(onPriceUpdateCallback).toHaveBeenCalledWith('btcturk', expect.any(Object));
        expect(botState.prices.btcturk.bid).toBe(2.7);

        // Simulate a price update from Binance
        const binanceCallback = mockBinanceClient.connectWebSocket.mock.calls[0][0];
        binanceCallback({ bestBid: 2.72, bestAsk: 2.73 });

        expect(onPriceUpdateCallback).toHaveBeenCalledWith('binance', expect.any(Object));
        expect(botState.prices.binance.ask).toBe(2.73);
    });

    it('should call disconnectWebSocket on both clients when disconnectAll is called', () => {
        wsManager.disconnectAll();
        expect(mockBtcturkClient.disconnectWebSocket).toHaveBeenCalledTimes(1);
        expect(mockBinanceClient.disconnectWebSocket).toHaveBeenCalledTimes(1);
    });
});
