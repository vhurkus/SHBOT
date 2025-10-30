// src/bot/modules/SlippageService.js
import logger from '../../utils/logger.js';

class SlippageService {
    constructor(binanceClient) {
        this.binanceClient = binanceClient;
    }

    analyzeOrderBookDepth(orderBook, tradeAmount) {
        if (!orderBook || orderBook.length === 0) {
            return this.defaultDepthAnalysis(tradeAmount);
        }

        let cumulativeAmount = 0;
        let weightedPriceSum = 0;
        let levelsNeeded = 0;
        const bestPrice = orderBook[0]?.price || 0;

        for (const level of orderBook) {
            if (!level || !level.price || !level.amount) continue;
            levelsNeeded++;

            const amountToTake = Math.min(level.amount, tradeAmount - cumulativeAmount);
            cumulativeAmount += amountToTake;
            weightedPriceSum += amountToTake * level.price;

            if (cumulativeAmount >= tradeAmount) break;
        }

        const hasEnoughLiquidity = cumulativeAmount >= tradeAmount;
        const avgExecutionPrice = hasEnoughLiquidity ? weightedPriceSum / cumulativeAmount : 0;
        const slippage = hasEnoughLiquidity && bestPrice > 0
            ? Math.abs(((avgExecutionPrice - bestPrice) / bestPrice) * 100)
            : 0;

        return {
            hasEnoughLiquidity,
            avgExecutionPrice,
            slippagePercent: slippage.toFixed(4),
        };
    }

    async calculateSlippage(symbol, side, amount) {
        try {
            const orderBook = await this.binanceClient.getOrderBook(symbol, 20);
            const bookSide = side === 'BUY' ? orderBook.asks : orderBook.bids;

            const analysis = this.analyzeOrderBookDepth(bookSide, amount);
            if (!analysis.hasEnoughLiquidity) {
                logger.warn(`⚠️ Insufficient liquidity for slippage calculation.`, { side, amount });
            }
            return analysis;
        } catch (error) {
            logger.error('❌ Slippage calculation failed.', { error: error.message });
            return this.defaultDepthAnalysis(amount);
        }
    }

    defaultDepthAnalysis(tradeAmount) {
        return {
            hasEnoughLiquidity: false,
            avgExecutionPrice: 0,
            slippagePercent: '0.0000',
        };
    }
}

export default SlippageService;
