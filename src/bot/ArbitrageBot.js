// src/bot/ArbitrageBot.js
import logger from '../utils/logger.js';
import ArbitrageEngine from './ArbitrageEngine.js';
import BotState from './modules/BotState.js';
import WebSocketManager from './modules/WebSocketManager.js';
import OrderManager from './modules/OrderManager.js';
import VolatilityService from './modules/VolatilityService.js';
import SlippageService from './modules/SlippageService.js';
import BTCTurkClient from '../exchanges/BTCTurkClient.js';
import BinanceClient from '../exchanges/BinanceClient.js';
import config from '../config/config.js';

/**
 * @class ArbitrageBot
 * @description The main orchestrator for the arbitrage bot.
 */
class ArbitrageBot {
    /**
     * Creates an instance of ArbitrageBot.
     * @param {object} pairConfig - The configuration for the trading pair.
     */
    constructor(pairConfig) {
        this.pairConfig = pairConfig;
        this.isRunning = false;

        this.btcturk = new BTCTurkClient(config.btcturk);
        this.binance = new BinanceClient(config.binance);

        this.state = new BotState(this.pairConfig);
        this.engine = new ArbitrageEngine({ pairConfig: this.pairConfig });
        this.volatilityService = new VolatilityService();
        this.slippageService = new SlippageService(this.binance);
        
        this.wsManager = new WebSocketManager(this.btcturk, this.binance, this.state, this.onPriceUpdate.bind(this));
        // Pass the slippage service to the order manager
        this.orderManager = new OrderManager(this.btcturk, this.binance, this.state, this.engine, this.slippageService);

        this.balanceUpdateInterval = null;
        this.priceHistory = [];
        this.volatilityUpdateCounter = 0;
    }

    /**
     * Initializes all the necessary components of the bot.
     * @returns {Promise<boolean>} A promise that resolves to true if initialization is successful.
     */
    async initialize() {
        logger.info('🚀 Bot initializing...');
        try {
            await this.binance.syncServerTime();
            await this.updateBalances();
            await this.wsManager.connectAll();
            logger.info('✅ Bot initialization complete!');
            return true;
        } catch (error) {
            logger.error('❌ Bot initialization failed.', { error: error.message });
            throw error;
        }
    }

    /**
     * Starts the bot's trading activity.
     */
    async start() {
        if (this.isRunning) {
            logger.warn('⚠️ Bot is already running.');
            return;
        }
        logger.info('▶️ Starting bot...');
        this.isRunning = true;

        this.balanceUpdateInterval = setInterval(() => this.updateBalances(), 30000);

        await new Promise(resolve => setTimeout(resolve, 2000));
        if (!this.state.isOrderActive()) {
            await this.orderManager.createNewOrder();
        }
    }

    /**
     * Stops the bot's trading activity.
     */
    async stop() {
        // ... (stop logic remains the same)
    }

    /**
     * Callback function invoked on every price update from the WebSocket manager.
     * @param {string} exchange - The name of the exchange that sent the update.
     * @private
     */
    onPriceUpdate(exchange) {
        if (!this.isRunning) return;

        // Add to price history for volatility calculations
        this.priceHistory.push(this.state.prices.binance.ask);
        if (this.priceHistory.length > 100) this.priceHistory.shift();

        // Update dynamic parameters periodically
        this.volatilityUpdateCounter++;
        if (this.volatilityUpdateCounter >= 10) {
            this.updateDynamicParameters();
            this.volatilityUpdateCounter = 0;
        }

        if (exchange === 'binance') {
            if (this.state.isOrderActive()) {
                this.orderManager.checkForPriceChange();
            } else {
                this.orderManager.createNewOrder();
            }
        }
    }

    /**
     * Updates the dynamic trading parameters based on recent volatility.
     */
    updateDynamicParameters() {
        if (this.priceHistory.length < 20) return;
        
        const volatility = this.volatilityService.calculateVolatility(this.priceHistory);
        const dynamicSpread = this.volatilityService.getDynamicMinSpread(volatility);
        const dynamicProfit = this.volatilityService.getDynamicMinProfit(volatility, dynamicSpread);

        // Update the engine's parameters
        this.engine.minSpread = dynamicSpread;
        this.engine.minProfit = dynamicProfit;

        logger.info('✨ Volatility-based parameters updated.', {
            volatility: `${volatility.toFixed(4)}%`,
            newSpread: `${dynamicSpread}%`,
            newProfit: `${dynamicProfit}%`,
        });
    }

    /**
     * Fetches and updates the account balances from both exchanges.
     */
    async updateBalances() {
        // ... (updateBalances logic remains the same)
    }
}

export default ArbitrageBot;
