import TelegramBot from 'node-telegram-bot-api';
import config from '../config/config.js';
import logger from './logger.js';

class NotificationService {
    constructor() {
        this.bot = null;
        this.chatId = null;

        // Spam prevention: cooldown tracking
        this.lastNotificationTime = {
            balanceLow: 0,
            connectionLost: 0,
            priceAnomaly: 0
        };

        // Trade notification throttling
        this.tradeCounter = 0;
        this.tradeNotificationInterval = 10; // Her 10 trade'de bir bildir

        // Daily report tracking
        this.lastDailyReportDate = null;

        if (config.notifications.telegram.enabled) {
            const token = config.notifications.telegram.botToken;
            this.chatId = config.notifications.telegram.chatId;

            if (token && this.chatId) {
                try {
                    this.bot = new TelegramBot(token, { polling: false });
                    logger.info('✅ Telegram bildirim servisi aktif edildi.');
                } catch (error) {
                    logger.error('❌ Telegram botu başlatılamadı. Token veya Chat ID hatalı olabilir.', { error: error.message });
                    this.bot = null;
                }
            } else {
                logger.warn('⚠️  Telegram bildirimleri aktif ancak token veya chat ID eksik.');
            }
        }
    }

    /**
     * Sends an alert message via Telegram.
     * @param {string} message The message to send.
     */
    async sendAlert(message) {
        if (!this.bot || !this.chatId) {
            return; // Do nothing if not configured
        }

        try {
            const safeMessage = message.replace(/_/g, '\\_').replace(/\*/g, '\\*').replace(/`/g, '\\`');
            await this.bot.sendMessage(this.chatId, safeMessage);
            logger.info(`📲 Telegram uyarısı gönderildi.`);
        } catch (error) {
            logger.error('❌ Telegram mesajı gönderme hatası:', {
                message: error.message,
                // The error object from node-telegram-bot-api often contains response details
                responseCode: error.response?.statusCode,
                responseBody: error.response?.body
            });
            throw error; // Re-throw to allow caller to handle
        }
    }

    /**
     * 🚀 Bot başlatıldı bildirimi
     */
    async notifyBotStarted(balances) {
        const message = `🚀 *SHBOT BAŞLATILDI*\n\n` +
            `⏰ Zaman: ${new Date().toLocaleString('tr-TR')}\n\n` +
            `💼 Başlangıç Bakiyeleri:\n` +
            `BTCTurk:\n` +
            `  • ${balances.btcturk.totalXRP.toFixed(2)} XRP\n` +
            `  • ${balances.btcturk.totalUSDT.toFixed(2)} USDT\n\n` +
            `Binance:\n` +
            `  • ${balances.binance.totalXRP.toFixed(2)} XRP\n` +
            `  • ${balances.binance.totalUSDT.toFixed(2)} USDT\n\n` +
            `✅ Bot aktif ve arbitraj fırsatlarını izliyor...`;

        await this.sendAlert(message);
    }

    /**
     * ⏸️ Bot durduruldu bildirimi
     */
    async notifyBotStopped(metrics, balances) {
        const uptime = metrics.startTime ? Math.floor((Date.now() - metrics.startTime) / 1000 / 60) : 0; // dakika
        const successRate = metrics.tradesSucceeded + metrics.tradesFailed > 0
            ? ((metrics.tradesSucceeded / (metrics.tradesSucceeded + metrics.tradesFailed)) * 100).toFixed(1)
            : 0;

        const message = `⏸️ *SHBOT DURDURULDU*\n\n` +
            `⏰ Zaman: ${new Date().toLocaleString('tr-TR')}\n` +
            `⏱️ Çalışma Süresi: ${uptime} dakika\n\n` +
            `📊 Özet İstatistikler:\n` +
            `  • Toplam İşlem: ${metrics.tradesSucceeded + metrics.tradesFailed}\n` +
            `  • Başarılı: ${metrics.tradesSucceeded} ✅\n` +
            `  • Başarısız: ${metrics.tradesFailed} ❌\n` +
            `  • Başarı Oranı: %${successRate}\n` +
            `  • Toplam Kar: ${metrics.totalProfit.toFixed(4)} USDT 💰\n\n` +
            `💼 Son Bakiyeler:\n` +
            `BTCTurk: ${balances.btcturk.totalXRP.toFixed(2)} XRP, ${balances.btcturk.totalUSDT.toFixed(2)} USDT\n` +
            `Binance: ${balances.binance.totalXRP.toFixed(2)} XRP, ${balances.binance.totalUSDT.toFixed(2)} USDT`;

        await this.sendAlert(message);
    }

    /**
     * 💰 Başarılı trade bildirimi (throttled - her 10 trade'de bir)
     */
    async notifyTradeSuccess(txId, profit, totalProfit, metrics) {
        this.tradeCounter++;

        // Her 10 trade'de bir VEYA kar 1 USDT'den büyükse bildir
        const shouldNotify = (this.tradeCounter % this.tradeNotificationInterval === 0) || (profit > 1.0);

        if (!shouldNotify) {
            return;
        }

        const message = `💰 *ARBİTRAJ BAŞARILI*\n\n` +
            `🔄 İşlem #${metrics.tradesSucceeded}\n` +
            `📝 TX ID: ${txId}\n` +
            `💵 Kar: ${profit.toFixed(4)} USDT\n` +
            `📈 Toplam Kar: ${totalProfit.toFixed(4)} USDT\n\n` +
            `📊 Başarı Oranı: %${((metrics.tradesSucceeded / (metrics.tradesSucceeded + metrics.tradesFailed)) * 100).toFixed(1)}\n` +
            `✅ Toplam Başarılı: ${metrics.tradesSucceeded}\n` +
            `❌ Toplam Başarısız: ${metrics.tradesFailed}`;

        await this.sendAlert(message);
    }

    /**
     * ⚡ Partial fill uyarısı
     */
    async notifyPartialFill(txId, orderId, filledAmount, totalAmount) {
        const fillPercent = ((filledAmount / totalAmount) * 100).toFixed(1);

        const message = `⚡ *KISMİ DOLUM*\n\n` +
            `📝 TX ID: ${txId}\n` +
            `🔖 Emir ID: ${orderId}\n` +
            `📊 Dolum: ${filledAmount.toFixed(2)} / ${totalAmount.toFixed(2)} XRP (%${fillPercent})\n\n` +
            `✅ Kısmi dolum işlendi ve karşı emir atıldı.`;

        await this.sendAlert(message);
    }

    /**
     * 💳 Bakiye düşük uyarısı (1 saatte 1 kez max)
     */
    async notifyLowBalance(exchange, asset, current, minimum) {
        const cooldown = 60 * 60 * 1000; // 1 saat
        const now = Date.now();

        if (now - this.lastNotificationTime.balanceLow < cooldown) {
            return; // Spam önleme
        }

        this.lastNotificationTime.balanceLow = now;

        const message = `💳 *DÜŞÜK BAKİYE UYARISI*\n\n` +
            `⚠️ ${exchange} borsasında ${asset} bakiyesi düşük!\n\n` +
            `💰 Mevcut: ${current.toFixed(2)} ${asset}\n` +
            `📉 Minimum: ${minimum.toFixed(2)} ${asset}\n\n` +
            `⚡ İşlemler etkilenebilir. Lütfen bakiye ekleyin.`;

        await this.sendAlert(message);
    }

    /**
     * 📡 Bağlantı kesildi uyarısı (max retry sonrası, 30 dakikada 1 kez max)
     */
    async notifyConnectionLost(service, reason) {
        const cooldown = 30 * 60 * 1000; // 30 dakika
        const now = Date.now();

        if (now - this.lastNotificationTime.connectionLost < cooldown) {
            return; // Spam önleme
        }

        this.lastNotificationTime.connectionLost = now;

        const message = `📡 *BAĞLANTI KAYBI*\n\n` +
            `❌ ${service} bağlantısı kesildi!\n` +
            `📝 Sebep: ${reason}\n\n` +
            `⏳ Maksimum yeniden bağlanma denemesi aşıldı.\n` +
            `⚠️ Bot duraklamış olabilir. Lütfen kontrol edin.`;

        await this.sendAlert(message);
    }

    /**
     * ❌ Bot başlatma hatası
     */
    async notifyInitializationError(error) {
        const message = `❌ *BOT BAŞLATMA HATASI*\n\n` +
            `⚠️ Bot başlatılamadı!\n` +
            `📝 Hata: ${error}\n\n` +
            `🔧 Lütfen konfigürasyonu ve API bağlantılarını kontrol edin.`;

        await this.sendAlert(message);
    }

    /**
     * 📈 Fiyat anomalisi tespit edildi (10 dakikada 1 kez max)
     */
    async notifyPriceAnomaly(exchange, oldPrice, newPrice, changePercent) {
        const cooldown = 10 * 60 * 1000; // 10 dakika
        const now = Date.now();

        if (now - this.lastNotificationTime.priceAnomaly < cooldown) {
            return; // Spam önleme
        }

        this.lastNotificationTime.priceAnomaly = now;

        const message = `📈 *FİYAT ANOMALİSİ*\n\n` +
            `⚠️ ${exchange} borsasında anormal fiyat hareketi tespit edildi!\n\n` +
            `💵 Eski Fiyat: ${oldPrice.toFixed(4)} USDT\n` +
            `💵 Yeni Fiyat: ${newPrice.toFixed(4)} USDT\n` +
            `📊 Değişim: %${changePercent.toFixed(2)}\n\n` +
            `ℹ️ Fiyat verisi güvenlik kontrolünden geçemedi ve atlandı.`;

        await this.sendAlert(message);
    }

    /**
     * 📊 Günlük özet raporu
     */
    async sendDailyReport(metrics, balances, startOfDayBalances) {
        const today = new Date().toLocaleDateString('tr-TR');

        // Aynı gün zaten rapor gönderildiyse atla
        if (this.lastDailyReportDate === today) {
            return;
        }

        this.lastDailyReportDate = today;

        const uptime = metrics.startTime ? Math.floor((Date.now() - metrics.startTime) / 1000 / 60 / 60) : 0; // saat
        const successRate = metrics.tradesSucceeded + metrics.tradesFailed > 0
            ? ((metrics.tradesSucceeded / (metrics.tradesSucceeded + metrics.tradesFailed)) * 100).toFixed(1)
            : 0;

        // Bakiye değişimi hesapla
        const xrpChange = startOfDayBalances
            ? (balances.btcturk.totalXRP + balances.binance.totalXRP) - (startOfDayBalances.btcturk.totalXRP + startOfDayBalances.binance.totalXRP)
            : 0;
        const usdtChange = startOfDayBalances
            ? (balances.btcturk.totalUSDT + balances.binance.totalUSDT) - (startOfDayBalances.btcturk.totalUSDT + startOfDayBalances.binance.totalUSDT)
            : 0;

        const message = `📊 *GÜNLÜK ÖZET RAPORU*\n\n` +
            `📅 Tarih: ${today}\n` +
            `⏱️ Çalışma Süresi: ${uptime} saat\n\n` +
            `📈 İşlem İstatistikleri:\n` +
            `  • Toplam İşlem: ${metrics.tradesSucceeded + metrics.tradesFailed}\n` +
            `  • Başarılı: ${metrics.tradesSucceeded} ✅\n` +
            `  • Başarısız: ${metrics.tradesFailed} ❌\n` +
            `  • Başarı Oranı: %${successRate}\n\n` +
            `💰 Kar/Zarar:\n` +
            `  • Toplam Kar: ${metrics.totalProfit.toFixed(4)} USDT\n` +
            `  • XRP Değişimi: ${xrpChange > 0 ? '+' : ''}${xrpChange.toFixed(2)} XRP\n` +
            `  • USDT Değişimi: ${usdtChange > 0 ? '+' : ''}${usdtChange.toFixed(2)} USDT\n\n` +
            `💼 Güncel Bakiyeler:\n` +
            `BTCTurk:\n` +
            `  • ${balances.btcturk.totalXRP.toFixed(2)} XRP\n` +
            `  • ${balances.btcturk.totalUSDT.toFixed(2)} USDT\n\n` +
            `Binance:\n` +
            `  • ${balances.binance.totalXRP.toFixed(2)} XRP\n` +
            `  • ${balances.binance.totalUSDT.toFixed(2)} USDT`;

        await this.sendAlert(message);
    }

    /**
     * ⚠️ Emir iptal edildi bildirimi
     */
    async notifyOrderCancelled(orderId, side, reason) {
        const message = `⚠️ *EMİR İPTAL EDİLDİ*\n\n` +
            `🔖 Emir ID: ${orderId}\n` +
            `📊 Yön: ${side}\n` +
            `📝 Sebep: ${reason}\n\n` +
            `ℹ️ Yeni emir açılacak.`;

        await this.sendAlert(message);
    }
}

// Export a singleton instance
const notificationService = new NotificationService();
export default notificationService;
