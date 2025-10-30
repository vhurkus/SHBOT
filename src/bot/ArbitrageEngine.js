// src/bot/ArbitrageEngine.js
import logger from '../utils/logger.js';
import config from '../config/config.js';

/**
 * @class ArbitrageEngine
 * @description Handles the core arbitrage logic, including profitability calculations and order pricing.
 */
class ArbitrageEngine {
    /**
     * Creates an instance of ArbitrageEngine.
     * @param {object} options - The options for the engine.
     * @param {object} options.pairConfig - The configuration for the trading pair.
     */
    constructor(options = {}) {
        this.pairConfig = options.pairConfig;
        if (!this.pairConfig) throw new Error('pairConfig is required.');

        this.fees = config.trading.fees;
        this.tradeAmount = this.pairConfig.tradeAmount;
        this.minProfit = this.pairConfig.minProfit;
        this.minSpread = this.pairConfig.minSpread;

        logger.info('🤖 ArbitrageEngine initialized.', { pair: this.pairConfig.symbol });
    }

    /**
     * Calculates the profitability of a SELL-side arbitrage.
     * (Sell on BTCTurk, Buy on Binance)
     * @param {number} btcturkBid - The highest price a buyer is willing to pay on BTCTurk.
     * @param {number} binanceAsk - The lowest price a seller is willing to accept on Binance.
     * @returns {object} An object containing the profitability analysis.
     */
    calculateProfitability_Sell(btcturkBid, binanceAsk) {
        const sellTotal = btcturkBid * this.tradeAmount;
        const sellNet = sellTotal * (1 - this.fees.btcturk.maker);
        
        const buyTotal = binanceAsk * this.tradeAmount;
        const buyNet = buyTotal * (1 + this.fees.binance.taker);

        const profit = sellNet - buyNet;
        const profitPercent = (profit / buyNet) * 100;
        const spread = ((btcturkBid - binanceAsk) / binanceAsk) * 100;

        return {
            scenario: 'SELL',
            profitable: profit > 0 && profitPercent >= this.minProfit,
            profit: { amount: profit, percent: profitPercent },
            spread,
            meetsMinProfit: profitPercent >= this.minProfit,
            meetsMinSpread: spread >= this.minSpread,
        };
    }

    /**
     * Calculates the profitability of a BUY-side arbitrage.
     * (Buy on BTCTurk, Sell on Binance)
     * @param {number} btcturkAsk - The lowest price a seller is willing to accept on BTCTurk.
     * @param {number} binanceBid - The highest price a buyer is willing to pay on Binance.
     * @returns {object} An object containing the profitability analysis.
     */
    calculateProfitability_Buy(btcturkAsk, binanceBid) {
        const sellTotal = binanceBid * this.tradeAmount;
        const sellNet = sellTotal * (1 - this.fees.binance.taker);

        const buyTotal = btcturkAsk * this.tradeAmount;
        const buyNet = buyTotal * (1 + this.fees.btcturk.maker);

        const profit = sellNet - buyNet;
        const profitPercent = (profit / buyNet) * 100;
        const spread = ((binanceBid - btcturkAsk) / btcturkAsk) * 100;

        return {
            scenario: 'BUY',
            profitable: profit > 0 && profitPercent >= this.minProfit,
            profit: { amount: profit, percent: profitPercent },
            spread,
            meetsMinProfit: profitPercent >= this.minProfit,
            meetsMinSpread: spread >= this.minSpread,
        };
    }

    /**
     * Calculates the ideal limit order price for a SELL-side arbitrage on BTCTurk.
     * @param {number} binanceAsk - The current ask price on Binance.
     * @returns {object} An object containing the calculated order price.
     */
    calculateOrderPrice_Sell(binanceAsk) {
        const binanceBuyCost = binanceAsk * (1 + this.fees.binance.taker);
        const withProfit = binanceBuyCost * (1 + this.minProfit / 100);
        const finalPrice = withProfit / (1 - this.fees.btcturk.maker);
        return {
            scenario: 'SELL',
            orderPrice: parseFloat(finalPrice.toFixed(this.pairConfig.btcturk.denominatorScale)),
        };
    }

    /**
     * Calculates the ideal limit order price for a BUY-side arbitrage on BTCTurk.
     * @param {number} binanceBid - The current bid price on Binance.
     * @returns {object} An object containing the calculated order price.
     */
    calculateOrderPrice_Buy(binanceBid) {
        const binanceSellRevenue = binanceBid * (1 - this.fees.binance.taker);
        const withProfit = binanceSellRevenue * (1 - this.minProfit / 100);
        const finalPrice = withProfit / (1 + this.fees.btcturk.maker);
        return {
            scenario: 'BUY',
            orderPrice: parseFloat(finalPrice.toFixed(this.pairConfig.btcturk.denominatorScale)),
        };
    }

    /**
     * Determines the arbitrage scenario based on market prices.
     * @param {object} prices - The current market prices.
     * @param {string} scenario - The arbitrage scenario ('SELL' or 'BUY').
     * @returns {object} An object containing the calculated order price.
     */
    calculateOrderPrice(prices, scenario) {
        return scenario === 'SELL'
            ? this.calculateOrderPrice_Sell(prices.binanceAsk)
            : this.calculateOrderPrice_Buy(prices.binanceBid);
    }

    /**
     * Determines the arbitrage scenario based on account balances.
     * @param {object} balances - The current account balances.
     * @returns {object} An object containing the determined scenario.
     */
    determineScenario(balances) {
        const { baseCoin } = this.pairConfig;
        const hasBtcturkBase = balances.btcturk[baseCoin] >= this.tradeAmount;
        const hasBinanceBase = balances.binance[baseCoin] < this.tradeAmount;

        if (hasBtcturkBase && hasBinanceBase) {
            return { scenario: 'SELL' };
        }
        if (!hasBtcturkBase && !hasBinanceBase) {
            return { scenario: 'BUY' };
        }
        return { scenario: 'SELL' };
    }

    /**
     * Validates if there is sufficient balance for a given scenario.
     * @param {object} balances - The current account balances.
     * @param {string} scenario - The arbitrage scenario ('SELL' or 'BUY').
     * @returns {boolean} True if the balance is sufficient, false otherwise.
     */
    validateBalance(balances, scenario) {
        const { baseCoin } = this.pairConfig;
        if (scenario === 'SELL') {
            return balances.btcturk[baseCoin] >= this.tradeAmount;
        }
        if (scenario === 'BUY') {
            return balances.binance[baseCoin] >= this.tradeAmount;
        }
        return false;
    }
}

export default ArbitrageEngine;
