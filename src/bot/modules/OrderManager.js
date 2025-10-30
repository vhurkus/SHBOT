// src/bot/modules/OrderManager.js
import logger from '../../utils/logger.js';
import notificationService from '../../utils/NotificationService.js';

/**
 * @class OrderManager
 * @description Manages the lifecycle of arbitrage orders.
 */
class OrderManager {
    /**
     * Creates an instance of OrderManager.
     * @param {object} btcturkClient
     * @param {object} binanceClient
     * @param {object} botState
     * @param {object} engine
     * @param {object} slippageService - The service for slippage calculations.
     */
    constructor(btcturkClient, binanceClient, botState, engine, slippageService) {
        this.btcturk = btcturkClient;
        this.binance = binanceClient;
        this.state = botState;
        this.engine = engine;
        this.slippageService = slippageService; // Store the slippage service

        this.isUpdatingOrder = false;
        this.monitoringInterval = null;
        this.orderCheckInterval = 1000; // ms
    }

    /**
     * Creates a new arbitrage order on BTCTurk.
     * @returns {Promise<boolean>}
     */
    async createNewOrder() {
        const txId = `TX_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        logger.info('📝 Creating new order...', { txId });

        if (this.state.isOrderActive()) {
            logger.warn('⚠️ Active order exists.', { txId });
            return false;
        }

        const flatPrices = this.state.getPricesForEngine();
        if (!flatPrices.btcturkBid || !flatPrices.binanceBid) {
            logger.warn('⚠️ Incomplete price info.', { txId });
            return false;
        }

        const scenarioInfo = this.engine.determineScenario(this.state.balances);
        const { scenario } = scenarioInfo;

        // ** Re-integrate Slippage Check **
        const slippageResult = await this.slippageService.calculateSlippage(
            this.state.pairConfig.symbol,
            scenario === 'SELL' ? 'BUY' : 'SELL', // Counter-order side
            this.engine.tradeAmount
        );

        if (!slippageResult.hasEnoughLiquidity) {
            logger.warn('⚠️ Insufficient liquidity on Binance, order creation halted.', { txId });
            return false;
        }
        logger.info(`Calculated slippage for counter-order: ${slippageResult.slippagePercent}%`, { txId });


        const balanceValidation = this.engine.validateBalance(this.state.balances, scenario);
        if (!balanceValidation) {
            logger.warn('⚠️ Insufficient balance.', { txId });
            return false;
        }

        const pricing = this.engine.calculateOrderPrice(flatPrices, scenario);
        const { orderPrice } = pricing;
        const orderAmount = this.engine.tradeAmount;
        const btcturkSide = scenario === 'SELL' ? 'sell' : 'buy';

        try {
            const orderResponse = await this.btcturk.createLimitOrder({
                symbol: this.state.pairConfig.symbol,
                side: btcturkSide,
                quantity: orderAmount,
                price: orderPrice
            });

            this.state.setCurrentOrder({
                txId,
                orderId: orderResponse.id,
                side: btcturkSide.toUpperCase(),
                price: orderPrice,
                amount: orderAmount,
                scenario,
                timestamp: Date.now(),
                lastBinancePrice: scenario === 'SELL' ? flatPrices.binanceAsk : flatPrices.binanceBid,
            });

            logger.info('✅ New order created successfully!', { txId, orderId: orderResponse.id });
            this.startOrderMonitoring();
            return true;
        } catch (error) {
            logger.error('❌ Failed to create new order.', { txId, error: error.message });
            return false;
        }
    }

    // ... other methods remain the same
    async updateOrder() {
        if (this.isUpdatingOrder || !this.state.isOrderActive()) {
            return;
        }
        this.isUpdatingOrder = true;
        const { orderId, scenario } = this.state.currentOrder;
        logger.info('🔄 Updating order...', { orderId, scenario });

        try {
            const cancelResult = await this.btcturk.cancelOrder(orderId);
            if (!cancelResult) throw new Error('Failed to cancel order.');

            logger.info('✅ Previous order cancelled.', { orderId });
            this.state.clearCurrentOrder();
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for API to process

            await this.createNewOrder();
        } catch (error) {
            logger.error('❌ Failed to update order.', { orderId, error: error.message });
            this.state.clearCurrentOrder(); // Clear state on failure
        } finally {
            this.isUpdatingOrder = false;
        }
    }
    startOrderMonitoring() {
        if (this.monitoringInterval) clearInterval(this.monitoringInterval);
        const { orderId } = this.state.currentOrder;
        logger.info('👀 Starting order monitoring.', { orderId });

        this.monitoringInterval = setInterval(async () => {
            await this.checkOrderStatus();
        }, this.orderCheckInterval);
    }
    stopOrderMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            logger.info('🛑 Stopped order monitoring.');
        }
    }
    async checkOrderStatus() {
        if (!this.state.isOrderActive()) {
            this.stopOrderMonitoring();
            return;
        }

        const { orderId, amount, scenario, txId } = this.state.currentOrder;
        try {
            const order = await this.btcturk.getOrder(orderId);
            if (order.status === 'Closed') {
                logger.info('✅ Order fully filled!', { txId, orderId });
                this.stopOrderMonitoring();
                const success = await this.executeCounterOrder(amount, scenario, txId);
                if (success) {
                    this.state.clearCurrentOrder();
                }
            }
        } catch (error) {
            logger.error('❌ Error checking order status.', { orderId, error: error.message });
        }
    }
    async executeCounterOrder(amount, scenario, txId) {
        const binanceSide = scenario === 'SELL' ? 'BUY' : 'SELL';
        logger.info('Executing counter order...', { txId, side: binanceSide, amount });

        try {
            const counterOrder = await this.binance.createMarketOrder({
                symbol: this.state.pairConfig.symbol,
                side: binanceSide,
                quantity: amount
            });
            logger.profit('🎉 Arbitrage cycle complete!', { txId, counterOrderId: counterOrder.id });
            notificationService.notifyTradeSuccess(txId, 0, 0, {}); // Profit needs to be calculated
            return true;
        } catch (error) {
            logger.error('🚨 CRITICAL: Failed to execute counter order!', { txId, error: error.message });
            notificationService.sendAlert(`Counter order failed for ${txId}: ${error.message}`);
            return false;
        }
    }
    async checkForPriceChange() {
        if (!this.state.isOrderActive() || this.isUpdatingOrder) {
            return;
        }

        const { scenario, lastBinancePrice } = this.state.currentOrder;
        const prices = this.state.getPricesForEngine();
        const currentBinancePrice = scenario === 'SELL' ? prices.binanceAsk : prices.binanceBid;

        if (!currentBinancePrice || !lastBinancePrice) return;

        const priceChangePercent = (Math.abs(currentBinancePrice - lastBinancePrice) / lastBinancePrice) * 100;

        if (priceChangePercent >= this.state.pairConfig.priceUpdateThreshold) {
            logger.info('Price change threshold exceeded, updating order.', {
                change: `${priceChangePercent.toFixed(3)}%`,
                threshold: `${this.state.pairConfig.priceUpdateThreshold}%`
            });
            await this.updateOrder();
        }
    }
}

export default OrderManager;
