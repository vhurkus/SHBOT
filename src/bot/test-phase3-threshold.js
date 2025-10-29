/**
 * FAZ 3 TEST: Adaptive Update Threshold
 * Volatiliteye göre dinamik fiyat güncelleme eşiği testi
 */

import ArbitrageEngine from './ArbitrageEngine.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

console.log('\n' + '='.repeat(80));
console.log('🧪 FAZ 3 TEST: ADAPTIVE UPDATE THRESHOLD');
console.log('='.repeat(80));
console.log('\nTest: Volatiliteye göre dinamik threshold hesaplama\n');

const engine = new ArbitrageEngine(config);

// Test senaryoları: GERÇEKÇİ kripto volatilite seviyeleri
const testScenarios = [
    { volatility: 0.001, description: 'Çok Düşük Volatilite (çok sakin piyasa)' },
    { volatility: 0.005, description: 'Çok Düşük Volatilite (sakin)' },
    { volatility: 0.02, description: 'Düşük Volatilite (normal stabil)' },
    { volatility: 0.10, description: 'Orta Volatilite (normal)' },
    { volatility: 0.30, description: 'Yüksek Volatilite (hareketli)' },
    { volatility: 0.60, description: 'Çok Yüksek Volatilite (çok hareketli)' }
];

console.log('📊 SENARYO TESTLERİ:\n');

testScenarios.forEach((scenario, index) => {
    const threshold = engine.getDynamicUpdateThreshold(scenario.volatility);
    
    console.log(`${index + 1}. ${scenario.description}`);
    console.log(`   Volatilite: ${(scenario.volatility * 100).toFixed(3)}%`);
    console.log(`   Threshold: ${(threshold * 100).toFixed(3)}%`);
    
    // Yorum ekle
    if (threshold > 0.3) {
        console.log(`   💡 Sonuç: Az güncelleme (stabil fiyatlarda işlem maliyeti düşük)`);
    } else if (threshold < 0.1) {
        console.log(`   💡 Sonuç: Sık güncelleme (hareketli piyasada fırsatları kaçırma)`);
    } else {
        console.log(`   💡 Sonuç: Dengeli güncelleme`);
    }
    console.log('');
});

console.log('='.repeat(80));
console.log('📈 PRATIK ÖRNEK: Fiyat Değişimi Simülasyonu\n');

// Örnek: Fiyat 2.65 → 2.66 (0.377% değişim)
const examplePriceChange = 0.377; // %0.377

console.log(`Senaryo: XRP fiyatı 2.6500 → 2.6600 (${examplePriceChange}% değişim)\n`);

testScenarios.forEach((scenario, index) => {
    const threshold = engine.getDynamicUpdateThreshold(scenario.volatility);
    const willUpdate = examplePriceChange >= (threshold * 100);
    
    console.log(`${index + 1}. ${scenario.description} (threshold: ${(threshold * 100).toFixed(3)}%)`);
    console.log(`   ${willUpdate ? '✅ EMİR GÜNCELLENİR' : '❌ Emir güncellenmez'}`);
});

console.log('\n' + '='.repeat(80));
console.log('📌 SONUÇ:');
console.log('  • Düşük volatilite → yüksek threshold → daha az güncelleme');
console.log('  • Yüksek volatilite → düşük threshold → daha sık güncelleme');
console.log('  • Adaptif sistem, piyasa koşullarına göre otomatik ayarlanır');
console.log('  • Trade miktarı SABİT kalır (kullanıcı isteği)');
console.log('='.repeat(80) + '\n');
