// src/bot/modules/BotState.js
import logger from '../../utils/logger.js';

class BotState {
    constructor(pairConfig) {
        this.pairConfig = pairConfig;
        this.baseCoin = pairConfig.baseCoin;

        this.prices = {
            btcturk: { bid: null, ask: null, last: null, timestamp: null },
            binance: { bid: null, ask: null, last: null, timestamp: null }
        };

        this.balances = {
            btcturk: this.getInitialBalance(),
            binance: this.getInitialBalance()
        };

        this.currentOrder = {
            active: false,
            txId: null,
            exchange: null,
            orderId: null,
            side: null,
            price: null,
            amount: null,
            scenario: null,
            timestamp: null,
            expectedProfit: null,
            lastBinancePrice: null
        };
    }

    getInitialBalance() {
        return {
            [this.baseCoin]: 0,
            USDT: 0,
            [`locked${this.baseCoin}`]: 0,
            lockedUSDT: 0,
            [`total${this.baseCoin}`]: 0,
            totalUSDT: 0
        };
    }

    updatePrice(exchange, data) {
        if (!this.prices[exchange]) return;

        const newBid = parseFloat(data.bid || data.bestBid);
        const newAsk = parseFloat(data.ask || data.bestAsk);
        const newLast = parseFloat(data.last || newAsk); // Fallback for bookTicker

        // Basic validation
        if (isNaN(newBid) || isNaN(newAsk) || newBid <= 0 || newAsk <= 0) {
            logger.warn(`[BotState] Invalid price data from ${exchange}`, { data });
            return false;
        }

        this.prices[exchange] = {
            bid: newBid,
            ask: newAsk,
            last: newLast,
            timestamp: Date.now()
        };
        return true;
    }

    updateBalance(exchange, data) {
        if (!this.balances[exchange]) return;

        const baseBalance = data[this.baseCoin] || { free: 0, locked: 0, total: 0 };
        const usdtBalance = data.USDT || { free: 0, locked: 0, total: 0 };

        const baseFree = parseFloat(baseBalance.free || 0);
        const baseLocked = parseFloat(baseBalance.locked || 0);
        const usdtFree = parseFloat(usdtBalance.free || 0);
        const usdtLocked = parseFloat(usdtBalance.locked || 0);

        this.balances[exchange] = {
            [this.baseCoin]: baseFree,
            USDT: usdtFree,
            [`locked${this.baseCoin}`]: baseLocked,
            lockedUSDT: usdtLocked,
            [`total${this.baseCoin}`]: baseFree + baseLocked,
            totalUSDT: usdtFree + usdtLocked,
        };
    }

    setCurrentOrder(orderData) {
        this.currentOrder = { ...this.currentOrder, ...orderData, active: true };
    }

    clearCurrentOrder() {
        this.currentOrder = {
            active: false,
            txId: null,
            exchange: null,
            orderId: null,
            side: null,
            price: null,
            amount: null,
            scenario: null,
            timestamp: null,
            expectedProfit: null,
            lastBinancePrice: null
        };
    }

    isOrderActive() {
        return this.currentOrder.active;
    }

    getPricesForEngine() {
        return {
            btcturkBid: this.prices.btcturk.bid,
            btcturkAsk: this.prices.btcturk.ask,
            binanceBid: this.prices.binance.bid,
            binanceAsk: this.prices.binance.ask,
        };
    }
}

export default BotState;
