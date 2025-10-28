/**
 * Config Test Script
 * Tests configuration management
 */

import config, { maskApiKey, printConfig } from './config.js';
import logger from '../utils/logger.js';

console.log('\n🧪 Config Test Başlatılıyor...\n');

// Test 1: Config yükleme
logger.info('✅ Config başarıyla yüklendi');

// Test 2: Masked API keys
logger.info('🔐 API Key Masking Test:', {
    btcturk: maskApiKey(config.btcturk.apiKey),
    binance: maskApiKey(config.binance.apiKey)
});

// Test 3: Trading config
logger.info('💰 Trading Configuration:', {
    symbol: config.trading.symbol,
    amount: config.trading.tradeAmount,
    minProfit: `${config.trading.minProfit}%`,
    minSpread: `${config.trading.minSpread}%`,
    priceThreshold: `${config.trading.priceUpdateThreshold * 100}%`
});

// Test 4: Fee configuration
logger.info('💸 Fee Configuration:', {
    btcturk: {
        maker: `${(config.trading.fees.btcturk.maker * 100).toFixed(2)}%`,
        taker: `${(config.trading.fees.btcturk.taker * 100).toFixed(2)}%`
    },
    binance: {
        maker: `${(config.trading.fees.binance.maker * 100).toFixed(2)}%`,
        taker: `${(config.trading.fees.binance.taker * 100).toFixed(2)}%`
    }
});

// Test 5: Safety limits
logger.info('🛡️  Safety Limits:', config.trading.safety);

// Test 6: Monitoring settings
logger.info('📊 Monitoring Settings:', {
    orderCheck: `${config.monitoring.orderCheckInterval}ms`,
    balanceCheck: `${config.monitoring.balanceCheckInterval}ms`,
    priceCheck: `${config.monitoring.priceCheckInterval}ms`
});

// Test 7: Advanced features
logger.info('🚀 Advanced Features:', {
    dryRun: config.advanced.dryRun,
    useOrderBookDepth: config.advanced.useOrderBookDepth,
    dynamicSpread: config.advanced.dynamicSpread
});

// Test 8: Environment info
logger.info('🌍 Environment:', {
    env: config.env,
    isDevelopment: config.isDevelopment,
    isProduction: config.isProduction
});

// Print summary
printConfig();

console.log('✅ Config testleri tamamlandı!\n');
