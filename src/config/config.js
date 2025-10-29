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
        // ========================================
        // ÇOK PARİTE SİSTEMİ (MULTI-PAIR SUPPORT)
        // ========================================
        // Buraya istediğin kadar coin ekleyebilirsin!
        pairs: [
            // AVAX/USDT (Birincil Parite)
            {
                symbol: 'AVAXUSDT',
                baseCoin: 'AVAX',
                quoteCoin: 'USDT',
                tradeAmount: getFloat('AVAX_TRADE_AMOUNT', 0.5), // 0.5 AVAX (~$10)
                minProfit: getFloat('AVAX_MIN_PROFIT', 0.05),    // %0.05 (agresif)
                minSpread: getFloat('AVAX_MIN_SPREAD', 0.20),    // %0.20
                priceUpdateThreshold: getFloat('AVAX_UPDATE_THRESHOLD', 0.15), // %0.15

                // Binance precision
                binance: {
                    stepSize: 0.01,      // Min miktar: 0.01 AVAX
                    tickSize: 0.01,      // Fiyat artışı: $0.01
                    minQty: 0.01,        // Min emir: 0.01 AVAX
                    maxQty: 9000000      // Max emir: 9M AVAX
                },

                // BTCTurk precision
                btcturk: {
                    numeratorScale: 2,   // Miktar: 0.50 AVAX
                    denominatorScale: 2  // Fiyat: 825.14 TRY
                }
            },

            // XRP/USDT (İkinci Parite)
            {
                symbol: 'XRPUSDT',
                baseCoin: 'XRP',
                quoteCoin: 'USDT',
                tradeAmount: getFloat('XRP_TRADE_AMOUNT', 10),   // 10 XRP
                minProfit: getFloat('XRP_MIN_PROFIT', 0.03),     // %0.03
                minSpread: getFloat('XRP_MIN_SPREAD', 0.15),     // %0.15
                priceUpdateThreshold: getFloat('XRP_UPDATE_THRESHOLD', 0.2), // %0.20

                binance: {
                    stepSize: 0.1,
                    tickSize: 0.0001,
                    minQty: 0.1,
                    maxQty: 9000000
                },

                btcturk: {
                    numeratorScale: 1,
                    denominatorScale: 4
                }
            },

            // SOL/USDT (Üçüncü Parite - Opsiyonel)
            {
                symbol: 'SOLUSDT',
                baseCoin: 'SOL',
                quoteCoin: 'USDT',
                tradeAmount: getFloat('SOL_TRADE_AMOUNT', 0.05),  // 0.05 SOL (~$10)
                minProfit: getFloat('SOL_MIN_PROFIT', 0.05),      // %0.05
                minSpread: getFloat('SOL_MIN_SPREAD', 0.20),      // %0.20
                priceUpdateThreshold: getFloat('SOL_UPDATE_THRESHOLD', 0.15), // %0.15

                binance: {
                    stepSize: 0.01,
                    tickSize: 0.01,
                    minQty: 0.01,
                    maxQty: 9000000
                },

                btcturk: {
                    numeratorScale: 2,
                    denominatorScale: 2
                }
            }
        ],

        // ========================================
        // GLOBAL AYARLAR (Tüm Pariteler İçin)
        // ========================================

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
        slippageBuffer: getFloat('SLIPPAGE_BUFFER', 0.0005), // %0.05

        // Güvenlik limitleri
        safety: {
            priceSanityCheckThreshold: getFloat('PRICE_SANITY_CHECK_THRESHOLD', 25), // %25
            maxDailyTrades: getInt('MAX_DAILY_TRADES', 100),
            maxDailyLoss: getFloat('MAX_DAILY_LOSS', 100), // USDT cinsinden
            minBalance: {
                usdt: getFloat('MIN_USDT_BALANCE', 10)  // Minimum USDT (tüm coinler için)
            },
            minNotionalValue: getFloat('MIN_NOTIONAL_VALUE', 10) // Minimum 10 USDT
        },

        // ========================================
        // GERIYE UYUMLULUK (Eski Kodlar İçin)
        // ========================================
        // Deprecated: Yeni kodlar pairs[] kullanmalı
        get symbol() { return this.pairs[0].symbol; },
        get baseCoin() { return this.pairs[0].baseCoin; },
        get quoteCoin() { return this.pairs[0].quoteCoin; },
        get tradeAmount() { return this.pairs[0].tradeAmount; },
        get minProfit() { return this.pairs[0].minProfit; },
        get minSpread() { return this.pairs[0].minSpread; },
        get priceUpdateThreshold() { return this.pairs[0].priceUpdateThreshold; },
        get precision() {
            return {
                price: this.pairs[0].btcturk.denominatorScale,
                quantity: this.pairs[0].btcturk.numeratorScale
            };
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
 * Get parite config by symbol
 * @param {string} symbol - 'AVAXUSDT', 'XRPUSDT', etc.
 * @returns {object} Parite config object
 */
export function getPairConfig(symbol) {
    const pair = config.trading.pairs.find(p => p.symbol === symbol);
    if (!pair) {
        throw new Error(`❌ Parite bulunamadı: ${symbol}\nMevcut pariteler: ${config.trading.pairs.map(p => p.symbol).join(', ')}`);
    }
    return pair;
}

/**
 * List all available pairs
 * @returns {Array<string>} Symbol listesi
 */
export function listPairs() {
    return config.trading.pairs.map(p => p.symbol);
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
    console.log(`\n🪙 Available Pairs: ${config.trading.pairs.length}`);
    config.trading.pairs.forEach((pair, index) => {
        console.log(`  ${index + 1}. ${pair.symbol} (${pair.baseCoin}/${pair.quoteCoin})`);
        console.log(`     Trade Amount: ${pair.tradeAmount} ${pair.baseCoin}`);
        console.log(`     Min Profit: ${pair.minProfit}%`);
        console.log(`     Min Spread: ${pair.minSpread}%`);
    });
    console.log(`\nFees:`);
    console.log(`  BTCTurk Maker: ${(config.trading.fees.btcturk.maker * 100).toFixed(2)}%`);
    console.log(`  BTCTurk Taker: ${(config.trading.fees.btcturk.taker * 100).toFixed(2)}%`);
    console.log(`  Binance Maker: ${(config.trading.fees.binance.maker * 100).toFixed(2)}%`);
    console.log(`  Binance Taker: ${(config.trading.fees.binance.taker * 100).toFixed(2)}%`);
    console.log(`\nDry Run Mode: ${config.advanced.dryRun ? '✅ ON' : '❌ OFF'}`);
    console.log('========================\n');
}

export default config;
