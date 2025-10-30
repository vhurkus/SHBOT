// src/bot/modules/VolatilityService.js
import logger from '../../utils/logger.js';

class VolatilityService {
    constructor() {
        // Configuration for dynamic parameters can be passed here
    }

    calculateVolatility(priceHistory, periods = 20) {
        if (!priceHistory || priceHistory.length < 2) {
            return 0;
        }

        const n = Math.min(periods, priceHistory.length);
        const recentPrices = priceHistory.slice(-n);

        if (recentPrices.length < 2) return 0;

        const returns = [];
        for (let i = 1; i < recentPrices.length; i++) {
            returns.push((recentPrices[i] - recentPrices[i-1]) / recentPrices[i-1]);
        }

        if (returns.length === 0) return 0;

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance) * 100;
    }

    getDynamicMinSpread(currentVolatility) {
        const baseSpread = 0.15;
        const volatilityMultiplier = 2.0;
        const maxSpread = 1.0;
        const minSpread = 0.10;

        let dynamicSpread = baseSpread + (currentVolatility * volatilityMultiplier);
        dynamicSpread = Math.min(Math.max(dynamicSpread, minSpread), maxSpread);
        return parseFloat(dynamicSpread.toFixed(4));
    }

    getDynamicMinProfit(currentVolatility, currentSpread) {
        const baseProfitRatio = 0.3;
        const volatilityAdjustment = currentVolatility * 0.3;

        let minProfit = (currentSpread * baseProfitRatio) + volatilityAdjustment;
        minProfit = Math.max(minProfit, 0.03);
        minProfit = Math.min(minProfit, 0.30);
        return parseFloat(minProfit.toFixed(4));
    }

    getDynamicUpdateThreshold(currentVolatility) {
        const minThreshold = 0.05;
        const maxThreshold = 0.30;

        if (currentVolatility < 0.01) return maxThreshold;
        if (currentVolatility > 0.50) return minThreshold;

        const ratio = (currentVolatility - 0.01) / (0.50 - 0.01);
        return maxThreshold - (ratio * (maxThreshold - minThreshold));
    }
}

export default VolatilityService;
