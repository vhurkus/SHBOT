// src/bot/modules/WebSocketManager.js
import logger from '../../utils/logger.js';

class WebSocketManager {
    constructor(btcturkClient, binanceClient, botState, onPriceUpdateCallback) {
        this.btcturk = btcturkClient;
        this.binance = binanceClient;
        this.state = botState;
        this.onPriceUpdate = onPriceUpdateCallback;
    }

    async connectAll() {
        try {
            await this.connectBTCTurk();
            await this.connectBinance();
            logger.info('✅ All WebSocket connections established.');
            return true;
        } catch (error) {
            logger.error('❌ WebSocket connection failed during setup.', { error: error.message });
            throw error;
        }
    }

    async connectBTCTurk() {
        await this.btcturk.connectWebSocket((data) => {
            const updated = this.state.updatePrice('btcturk', data);
            if (updated) {
                this.onPriceUpdate('btcturk', data);
            }
        }, this.state.pairConfig.symbol);
        logger.info(`✅ BTCTurk WebSocket connected for ${this.state.pairConfig.symbol}.`);
    }

    async connectBinance() {
        await this.binance.connectWebSocket((data) => {
            const updated = this.state.updatePrice('binance', data);
            if (updated) {
                this.onPriceUpdate('binance', data);
            }
        });
        logger.info(`✅ Binance WebSocket connected for ${this.state.pairConfig.symbol}.`);
    }

    disconnectAll() {
        logger.info('🔌 Disconnecting all WebSockets...');
        if (this.btcturk) {
            this.btcturk.disconnectWebSocket();
        }
        if (this.binance) {
            this.binance.disconnectWebSocket();
        }
    }
}

export default WebSocketManager;
