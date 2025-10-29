/**
 * Configuration Management
 * Centralized configuration for the entire application
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validate required environment variables
 */
function validateConfig() {
    const required = [
        'BTCTURK_API_KEY',
        'BTCTURK_API_SECRET',
        'BINANCE_API_KEY',
        'BINANCE_API_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`❌ Eksik environment variables: ${missing.join(', ')}\n.env dosyasını kontrol edin!`);
    }
}

/**
 * Parse float from env or use default
 */
function getFloat(key, defaultValue) {
    const value = process.env[key];
    return value ? parseFloat(value) : defaultValue;
}

/**
 * Parse int from env or use default
 */
function getInt(key, defaultValue) {
    const value = process.env[key];
    return value ? parseInt(value, 10) : defaultValue;
}

/**
 * Parse boolean from env or use default
 */
function getBoolean(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value === 'true' || value === '1';
}

// Validate on import
validateConfig();

/**
 * Main Configuration Object
 */
const config = {
    // Environment
    env: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',

    // BTCTurk Configuration
    btcturk: {
        apiKey: process.env.BTCTURK_API_KEY,
        apiSecret: process.env.BTCTURK_API_SECRET,
        baseURL: process.env.BTCTURK_BASE_URL || 'https://api.btcturk.com',
        wsURL: process.env.BTCTURK_WS_URL || 'wss://ws-feed-pro.btcturk.com',
        
        // Rate limits
        rateLimit: {
            maxRequests: getInt('BTCTURK_RATE_LIMIT', 10), // per second
            retryDelay: getInt('BTCTURK_RETRY_DELAY', 1000), // ms
            maxRetries: getInt('BTCTURK_MAX_RETRIES', 3),
            enableRetry: getBoolean('BTCTURK_ENABLE_RETRY', true)
        }
    },

    // Binance Configuration
    binance: {
        apiKey: process.env.BINANCE_API_KEY,
        apiSecret: process.env.BINANCE_API_SECRET,
        baseURL: process.env.BINANCE_BASE_URL || 'https://api.binance.com',
        wsURL: process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws',
        
        // Rate limits
        rateLimit: {
            maxRequests: getInt('BINANCE_RATE_LIMIT', 1200), // per minute
            retryDelay: getInt('BINANCE_RETRY_DELAY', 1000), // ms
            maxRetries: getInt('BINANCE_MAX_RETRIES', 3)
        }
    },

    // Trading Configuration
    trading: {
        // Coin paritesi (HER İKİ BORSA DA USDT)
        symbol: process.env.TRADE_SYMBOL || 'XRPUSDT',
        baseCoin: process.env.BASE_COIN || 'XRP',
        quoteCoin: process.env.QUOTE_COIN || 'USDT',
        
        // Binance için parite (aynı)
        binanceSymbol: process.env.BINANCE_SYMBOL || 'XRPUSDT',
        binanceBaseCoin: process.env.BINANCE_BASE_COIN || 'XRP',
        binanceQuoteCoin: process.env.BINANCE_QUOTE_COIN || 'USDT',
        
        // İşlem miktarı
        tradeAmount: getFloat('TRADE_AMOUNT', 5), // 5 XRP (mevcut bakiyeye göre ayarlandı)
        
        // Karlılık ayarları (PHASE 1 - Profesyonel standartlar)
        minProfit: getFloat('MIN_PROFIT_PERCENT', 0.15), // Minimum %0.15 kar (profesyonel hedef)
        minSpread: getFloat('MIN_SPREAD_PERCENT', 0.5), // Minimum %0.5 spread (0.3-0.5% brüt = 0.1% net)
        
        // Fiyat güncelleme eşiği (yüzde olarak)
        priceUpdateThreshold: getFloat('PRICE_UPDATE_THRESHOLD', 0.2), // %0.2 değişim
        
        // İşlem ücretleri (%)
        fees: {
            btcturk: {
                maker: getFloat('BTCTURK_MAKER_FEE', 0.0008), // %0.08 (Piyasa Yapıcı)
                taker: getFloat('BTCTURK_TAKER_FEE', 0.0012)  // %0.12 (Piyasa Alıcı)
            },
            binance: {
                maker: getFloat('BINANCE_MAKER_FEE', 0.001), // %0.1
                taker: getFloat('BINANCE_TAKER_FEE', 0.001)  // %0.1
            }
        },

        // Slippage buffer (market emirler için)
        slippageBuffer: getFloat('SLIPPAGE_BUFFER', 0.0005), // %0.05 (market order kayması için güvenlik marjı)
        
        // Decimal precision
        precision: {
            price: getInt('PRICE_PRECISION', 4), // XRP/TRY için 4 decimal
            quantity: getInt('QUANTITY_PRECISION', 2) // XRP miktarı için 2 decimal
        },
        
        // Güvenlik limitleri
        safety: {
            priceSanityCheckThreshold: getFloat('PRICE_SANITY_CHECK_THRESHOLD', 25), // %25, ani fiyat sıçramalarını engellemek için
            maxDailyTrades: getInt('MAX_DAILY_TRADES', 100),
            maxDailyLoss: getFloat('MAX_DAILY_LOSS', 100), // USDT cinsinden
            minBalance: {
                xrp: getFloat('MIN_XRP_BALANCE', 10),
                usdt: getFloat('MIN_USDT_BALANCE', 10)
            }
        }
    },

    // Monitoring Configuration
    monitoring: {
        // Kontrol intervalleri
        orderCheckInterval: getInt('ORDER_CHECK_INTERVAL', 1000), // 1 saniye
        balanceCheckInterval: getInt('BALANCE_CHECK_INTERVAL', 5000), // 5 saniye
        priceCheckInterval: getInt('PRICE_CHECK_INTERVAL', 100), // 100ms
        
        // WebSocket ayarları
        websocket: {
            pingInterval: getInt('WS_PING_INTERVAL', 30000), // 30 saniye
            reconnectDelay: getInt('WS_RECONNECT_DELAY', 5000), // 5 saniye
            maxReconnectAttempts: getInt('WS_MAX_RECONNECT', 10)
        },
        
        // Loglama
        logLevel: process.env.LOG_LEVEL || 'info',
        enableTradeLog: getBoolean('ENABLE_TRADE_LOG', true),
        enableApiLog: getBoolean('ENABLE_API_LOG', false)
    },

    // Advanced Features (Opsiyonel)
    advanced: {
        // Dry-run mode (gerçek emir girmez)
        dryRun: getBoolean('DRY_RUN', false),
        
        // Order book depth analysis
        useOrderBookDepth: getBoolean('USE_ORDERBOOK_DEPTH', false),
        orderBookDepth: getInt('ORDERBOOK_DEPTH', 10),
        
        // Dynamic spread adjustment
        dynamicSpread: getBoolean('DYNAMIC_SPREAD', false)
    },

    // Notification Configuration (Opsiyonel)
    notifications: {
        enabled: getBoolean('NOTIFICATIONS_ENABLED', false),
        telegram: {
            enabled: getBoolean('TELEGRAM_ENABLED', false),
            botToken: process.env.TELEGRAM_BOT_TOKEN || '',
            chatId: process.env.TELEGRAM_CHAT_ID || ''
        },
        email: {
            enabled: getBoolean('EMAIL_ENABLED', false),
            from: process.env.EMAIL_FROM || '',
            to: process.env.EMAIL_TO || ''
        }
    }
};

/**
 * Get masked API key for logging (shows only first/last 4 chars)
 */
export function maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) return '****';
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
}

/**
 * Print configuration summary (for debugging)
 */
export function printConfig() {
    console.log('\n📋 Configuration Summary:');
    console.log('========================');
    console.log(`Environment: ${config.env}`);
    console.log(`\nBTCTurk API Key: ${maskApiKey(config.btcturk.apiKey)}`);
    console.log(`Binance API Key: ${maskApiKey(config.binance.apiKey)}`);
    console.log(`\nTrading Symbol: ${config.trading.symbol}`);
    console.log(`Trade Amount: ${config.trading.tradeAmount} ${config.trading.baseCoin}`);
    console.log(`Min Profit: ${config.trading.minProfit}%`);
    console.log(`Min Spread: ${config.trading.minSpread}%`);
    console.log(`Price Update Threshold: ${config.trading.priceUpdateThreshold * 100}%`);
    console.log(`\nFees:`);
    console.log(`  BTCTurk Maker: ${(config.trading.fees.btcturk.maker * 100).toFixed(2)}%`);
    console.log(`  BTCTurk Taker: ${(config.trading.fees.btcturk.taker * 100).toFixed(2)}%`);
    console.log(`  Binance Maker: ${(config.trading.fees.binance.maker * 100).toFixed(2)}%`);
    console.log(`  Binance Taker: ${(config.trading.fees.binance.taker * 100).toFixed(2)}%`);
    console.log(`\nDry Run Mode: ${config.advanced.dryRun ? '✅ ON' : '❌ OFF'}`);
    console.log('========================\n');
}

export default config;
