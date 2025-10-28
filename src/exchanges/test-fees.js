/**
 * Test - Fee bilgilerini kontrol et
 */

import dotenv from 'dotenv';
import BinanceClient from './BinanceClient.js';
import BTCTurkClient from './BTCTurkClient.js';

dotenv.config();

async function testFees() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 FEE BİLGİLERİ TESTI');
    console.log('='.repeat(80) + '\n');
    
    // Binance Account Info (includes commission rates)
    try {
        const binance = new BinanceClient({
            apiKey: process.env.BINANCE_API_KEY,
            apiSecret: process.env.BINANCE_API_SECRET
        });
        
        console.log('🌐 Binance Account Info (includes commission):');
        const accountInfo = await binance.getAccountInfo();
        
        console.log('  Commission Rates:');
        console.log(`    Maker: ${accountInfo.commissionRates.maker} (${parseFloat(accountInfo.commissionRates.maker) * 100}%)`);
        console.log(`    Taker: ${accountInfo.commissionRates.taker} (${parseFloat(accountInfo.commissionRates.taker) * 100}%)`);
        console.log('');
        
    } catch (error) {
        console.log('❌ Binance fee hatası:', error.message);
    }
    
    // Binance Specific Symbol Commission
    try {
        const binance = new BinanceClient({
            apiKey: process.env.BINANCE_API_KEY,
            apiSecret: process.env.BINANCE_API_SECRET
        });
        
        console.log('🌐 Binance XRPUSDT Commission:');
        const commissionInfo = await binance.getCommissionRates('XRPUSDT');
        
        console.log('  Standard Commission:');
        console.log(`    Maker: ${commissionInfo.standardCommission.maker} (${parseFloat(commissionInfo.standardCommission.maker) * 100}%)`);
        console.log(`    Taker: ${commissionInfo.standardCommission.taker} (${parseFloat(commissionInfo.standardCommission.taker) * 100}%)`);
        
        if (commissionInfo.discount?.enabledForAccount) {
            console.log('  BNB Discount:');
            console.log(`    Enabled: ${commissionInfo.discount.enabledForAccount}`);
            console.log(`    Discount Rate: ${parseFloat(commissionInfo.discount.discount) * 100}%`);
        }
        console.log('');
        
    } catch (error) {
        console.log('❌ Binance XRPUSDT commission hatası:', error.message);
    }
    
    // BTCTurk - API'den direkt fee endpoint'i yok
    // Dokümantasyondan: https://www.btcturk.com/ucret-tarifesi
    console.log('🇹🇷 BTCTurk Fee Bilgisi:');
    console.log('  ℹ️  API\'den direkt fee endpoint\'i yok');
    console.log('  📄 Dokümantasyon: https://www.btcturk.com/ucret-tarifesi');
    console.log('  Güncel Maker/Taker Fee:');
    console.log('    Maker (Piyasa Yapıcı): 0.08% (0.0008)');
    console.log('    Taker (Piyasa Alıcı): 0.12% (0.0012)');
    console.log('  (VIP seviyelere göre değişebilir)');
    console.log('');
    
    console.log('='.repeat(80));
    console.log('✅ FEE BİLGİLERİ TESTI TAMAMLANDI');
    console.log('='.repeat(80) + '\n');
}

testFees().catch(error => {
    console.error('❌ Test hatası:', error);
    process.exit(1);
});
