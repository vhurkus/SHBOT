/**
 * SHBOT - Cross-Exchange Arbitrage Bot
 * Entry Point - Multi-Pair Support
 */

import ArbitrageBot from './bot/ArbitrageBot.js';
import logger from './utils/logger.js';
import config, { getPairConfig, listPairs } from './config/config.js';

// ========================================
// PARİTE SEÇİMİ (3 YOL)
// ========================================
// 1. Komut satırı: node src/index.js AVAXUSDT
// 2. Environment: SELECTED_PAIR=AVAXUSDT node src/index.js
// 3. Default: İlk parite (AVAX)

let selectedSymbol = process.argv[2] || process.env.SELECTED_PAIR || config.trading.pairs[0].symbol;

// Parite kontrolü
try {
    const pair = getPairConfig(selectedSymbol);
} catch (error) {
    console.error(`\n❌ HATA: ${error.message}\n`);
    console.log('📋 Kullanılabilir pariteler:');
    listPairs().forEach((symbol, index) => {
        const pair = getPairConfig(symbol);
        console.log(`   ${index + 1}. ${symbol} (${pair.baseCoin}/${pair.quoteCoin}) - ${pair.tradeAmount} ${pair.baseCoin}`);
    });
    console.log('\n💡 Kullanım: node src/index.js AVAXUSDT\n');
    process.exit(1);
}

const selectedPair = getPairConfig(selectedSymbol);

console.log('\n' + '='.repeat(80));
console.log('🤖 SHBOT - Cross-Exchange Arbitrage Bot (Multi-Pair)');
console.log('='.repeat(80));
console.log(`📅 Başlangıç: ${new Date().toLocaleString('tr-TR')}`);
console.log(`🌍 Environment: ${config.env}`);
console.log(`\n🪙 Seçili Parite: ${selectedPair.symbol}`);
console.log(`   Base Coin: ${selectedPair.baseCoin}`);
console.log(`   Quote Coin: ${selectedPair.quoteCoin}`);
console.log(`   Trade Amount: ${selectedPair.tradeAmount} ${selectedPair.baseCoin}`);
console.log(`   Min Profit: ${selectedPair.minProfit}%`);
console.log(`   Min Spread: ${selectedPair.minSpread}%`);
console.log(`   Update Threshold: ${selectedPair.priceUpdateThreshold}%`);

console.log(`\n📊 Diğer Pariteler: ${listPairs().filter(s => s !== selectedSymbol).join(', ')}`);

if (config.advanced.dryRun) {
    console.log('\n⚠️  DRY RUN MODE AKTIF - Gerçek emir girilmeyecek!');
}

console.log('='.repeat(80) + '\n');

// Global bot instance
let bot = null;

async function startBot() {
    try {
        logger.info('🚀 Bot başlatılıyor...', { pair: selectedPair.symbol });

        // Bot instance oluştur - YENİ: pairConfig parametresi
        bot = new ArbitrageBot({
            pairConfig: selectedPair,  // ✅ YENİ: Tam parite config'i gönderiyoruz
            symbol: selectedPair.symbol,
            tradeAmount: selectedPair.tradeAmount,
            minProfit: selectedPair.minProfit,
            minSpread: selectedPair.minSpread,
            priceUpdateThreshold: selectedPair.priceUpdateThreshold,
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
