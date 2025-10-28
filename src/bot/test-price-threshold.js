/**
 * Fiyat değişimi eşiği testi
 * 0.04% veya 0.05% eşiğinin düzgün çalıştığını doğrula
 */

import dotenv from 'dotenv';
dotenv.config();

const THRESHOLD = parseFloat(process.env.PRICE_UPDATE_THRESHOLD || '0.05');

// Test senaryoları
const testCases = [
    {
        scenario: 'SELL',
        lastPrice: 2.6308,
        currentPrices: [
            2.6302, // -0.023%
            2.6295, // -0.049% → GÜNCELLEME
            2.6320, // +0.046% → GÜNCELLEME
            2.6325, // +0.065% → GÜNCELLEME
        ]
    },
    {
        scenario: 'BUY',
        lastPrice: 2.6308,
        currentPrices: [
            2.6302, // -0.023%
            2.6295, // -0.049% → GÜNCELLEME
            2.6320, // +0.046% → GÜNCELLEME
            2.6325, // +0.065% → GÜNCELLEME
        ]
    }
];

console.log('================================================================================');
console.log('📊 FİYAT DEĞİŞİMİ EŞİĞİ TESTİ');
console.log('================================================================================\n');
console.log(`⚙️  Eşik: %${THRESHOLD}\n`);

testCases.forEach(testCase => {
    console.log(`\n🔹 Senaryo: ${testCase.scenario}`);
    console.log(`📌 Son Binance Fiyatı: ${testCase.lastPrice}\n`);
    
    testCase.currentPrices.forEach(currentPrice => {
        // Fiyat değişimi hesapla
        const changePercent = Math.abs((currentPrice - testCase.lastPrice) / testCase.lastPrice * 100);
        const shouldUpdate = changePercent >= THRESHOLD;
        
        // Direction
        const direction = currentPrice > testCase.lastPrice ? '📈' : '📉';
        
        console.log(`${direction} Yeni Fiyat: ${currentPrice}`);
        console.log(`   Değişim: ${changePercent.toFixed(3)}%`);
        console.log(`   Güncelleme: ${shouldUpdate ? '✅ EVET' : '❌ HAYIR'}`);
        console.log('');
    });
});

console.log('================================================================================\n');

// Gerçek zamanlı hesaplama
console.log('📊 GERÇEKDen HESAPLAMA (Loglardan):\n');
const realCases = [
    { last: 2.6308, current: 2.6302, label: 'Test Run 1' },
    { last: 2.6308, current: 2.632, label: 'Test Run 2' },
    { last: 2.6308, current: 2.6295, label: 'Simülasyon' },
];

realCases.forEach(({ last, current, label }) => {
    const changePercent = Math.abs((current - last) / last * 100);
    const shouldUpdate = changePercent >= THRESHOLD;
    
    console.log(`${label}:`);
    console.log(`  Son: ${last} → Yeni: ${current}`);
    console.log(`  Değişim: ${changePercent.toFixed(3)}%`);
    console.log(`  Eşik: ${THRESHOLD}%`);
    console.log(`  Güncelleme: ${shouldUpdate ? '✅ EVET' : '❌ HAYIR'}\n`);
});
