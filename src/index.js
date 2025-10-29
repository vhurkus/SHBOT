/**
 * SHBOT - Cross-Exchange Arbitrage Bot
 * Entry Point
 */

import ArbitrageBot from './bot/ArbitrageBot.js';
import logger from './utils/logger.js';
import config from './config/config.js';

console.log('\n' + '='.repeat(80));
console.log('🤖 SHBOT - Cross-Exchange Arbitrage Bot');
console.log('='.repeat(80));
console.log(`📅 Başlangıç: ${new Date().toLocaleString('tr-TR')}`);
console.log(`🌍 Environment: ${config.env}`);
console.log(`💱 Symbol: ${config.trading.symbol}`);
console.log(`📊 Trade Amount: ${config.trading.tradeAmount} ${config.trading.baseCoin}`);
console.log(`💰 Min Profit: ${config.trading.minProfit}%`);
console.log(`📈 Min Spread: ${config.trading.minSpread}%`);
console.log(`🔄 Price Update Threshold: ${config.trading.priceUpdateThreshold}%`);

if (config.advanced.dryRun) {
    console.log('\n⚠️  DRY RUN MODE AKTIF - Gerçek emir girilmeyecek!');
}

console.log('='.repeat(80) + '\n');

// Global bot instance
let bot = null;

async function startBot() {
    try {
        logger.info('🚀 Bot başlatılıyor...');
        
        // Bot instance oluştur
        bot = new ArbitrageBot({
            symbol: config.trading.symbol,
            tradeAmount: config.trading.tradeAmount,
            minProfit: config.trading.minProfit,
            minSpread: config.trading.minSpread,
            priceUpdateThreshold: config.trading.priceUpdateThreshold,
            balanceUpdateInterval: config.monitoring.balanceCheckInterval,
            orderCheckInterval: config.monitoring.orderCheckInterval
        });
        
        // Initialize
        logger.info('⚙️  Bot initialize ediliyor...');
        await bot.initialize();
        
        // İlk durum
        logger.info('📊 İlk durum kontrol ediliyor...');
        bot.printStatus();
        
        // Start
        logger.info('▶️  Bot başlatılıyor...');
        await bot.start();
        
        logger.info('✅ Bot başarıyla başlatıldı ve çalışıyor!');
        logger.info('📝 Log dosyaları: logs/ klasörü');
        logger.info('⏸️  Durdurmak için CTRL+C kullanın');
        
        // Periyodik durum raporu (her 1 dakikada)
        setInterval(() => {
            logger.info('📊 Periyodik Durum Raporu');
            bot.printStatus();
        }, 60000); // 1 dakika
        
    } catch (error) {
        logger.error('❌ Bot başlatma hatası', {
            error: error.message,
            stack: error.stack
        });
        
        console.error('\n❌ HATA: Bot başlatılamadı!');
        console.error(`📝 Detaylar: ${error.message}`);
        console.error('📋 Loglara bakın: logs/ klasörü\n');
        
        process.exit(1);
    }
}

async function stopBot() {
    if (bot) {
        logger.info('⏸️  Bot durduruluyor...');
        
        try {
            await bot.stop();
            logger.info('✅ Bot başarıyla durduruldu');
        } catch (error) {
            logger.error('❌ Bot durdurma hatası', {
                error: error.message
            });
        }
    }
    
    console.log('\n👋 Bot kapatıldı. Görüşmek üzere!\n');
    process.exit(0);
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n⏸️  SIGINT alındı, bot kapatılıyor...');
    await stopBot();
});

process.on('SIGTERM', async () => {
    console.log('\n\n⏸️  SIGTERM alındı, bot kapatılıyor...');
    await stopBot();
});

// Uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception', {
        error: error.message,
        stack: error.stack
    });
    
    console.error('\n❌ CRITICAL ERROR:', error.message);
    stopBot();
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled Rejection', {
        reason: reason,
        promise: promise
    });
    
    console.error('\n❌ UNHANDLED REJECTION:', reason);
    stopBot();
});

// Bot'u başlat
startBot();
