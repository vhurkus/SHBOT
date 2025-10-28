/**
 * DERİN ANALİZ - Kritik sorunları tespit et
 * createNewOrder() fonksiyonunu detaylı incele
 */

import fs from 'fs';

console.log('\n' + '='.repeat(80));
console.log('🔍 DERİN ANALİZ - KRİTİK SORUNLAR');
console.log('='.repeat(80) + '\n');

const botCode = fs.readFileSync('./src/bot/ArbitrageBot.js', 'utf8');

// createNewOrder fonksiyonunu extract et
const createNewOrderRegex = /async createNewOrder\(\) \{([\s\S]*?)\n    \}/;
const match = botCode.match(createNewOrderRegex);

if (!match) {
    console.log('❌ createNewOrder fonksiyonu bulunamadı!');
    process.exit(1);
}

const functionBody = match[1];

console.log('📋 createNewOrder() Analizi:\n');
console.log('Fonksiyon Uzunluğu:', functionBody.length, 'karakter');
console.log('Satır Sayısı:', functionBody.split('\n').length, '\n');

// Kritik kontroller
const issues = [];
const warnings = [];

// 1. Profitability kontrolü
console.log('🔍 1. KARLILIK KONTROLÜ:');
const hasProfitabilityCheck = functionBody.match(/if\s*\([^)]*profit[^)]*\)/gi);
const hasMinProfitCheck = functionBody.match(/minProfit|meetsMinProfit/gi);

if (!hasProfitabilityCheck || !hasMinProfitCheck) {
    issues.push({
        severity: 'CRITICAL',
        title: 'Karlılık kontrolü eksik',
        description: 'createNewOrder() içinde profit check yapmıyor!',
        risk: 'Bot negatif spread\'de de emir açabilir = PARA KAYBI',
        line: 'src/bot/ArbitrageBot.js:557-715'
    });
    console.log('  ❌ Karlılık kontrolü BULUNAMADI!');
    console.log('  🔴 Bot zarar eden işlemlerde de emir açabilir!');
} else {
    console.log('  ✅ Karlılık kontrolü mevcut');
}

// 2. Spread kontrolü
console.log('\n🔍 2. SPREAD KONTROLÜ:');
const hasSpreadCheck = functionBody.match(/if\s*\([^)]*spread[^)]*</gi);
const hasMinSpreadCheck = functionBody.match(/minSpread|meetsMinSpread/gi);

if (!hasSpreadCheck || !hasMinSpreadCheck) {
    warnings.push({
        severity: 'HIGH',
        title: 'Spread threshold kontrolü zayıf',
        description: 'Spread hesaplanıyor ama min threshold kontrolü net değil',
        risk: 'Çok küçük spread\'lerde de emir açılabilir = düşük kar'
    });
    console.log('  ⚠️  Spread threshold kontrolü net değil');
} else {
    console.log('  ✅ Spread kontrolü mevcut');
}

// 3. Engine'in calculateProfitability kullanımı
console.log('\n🔍 3. ENGINE KULLANIMI:');
const usesEngineCalculation = functionBody.includes('engine.calculateProfitability');

if (!usesEngineCalculation) {
    issues.push({
        severity: 'CRITICAL',
        title: 'Engine karlılık hesaplaması kullanılmıyor',
        description: 'createNewOrder() engine.calculateProfitability() çağırmıyor',
        risk: 'Manuel hesaplamalar hatalı olabilir, fee\'ler atlabilir',
        fix: 'engine.calculateProfitability() kullanılmalı'
    });
    console.log('  ❌ engine.calculateProfitability() KULLANILMIYOR!');
    console.log('  🔴 Manuel hesaplamalar güvenilir değil!');
} else {
    console.log('  ✅ Engine profitability hesaplaması kullanılıyor');
}

// 4. Bakiye kontrolü
console.log('\n🔍 4. BAKİYE KONTROLÜ:');
const hasBalanceValidation = functionBody.match(/balance|sufficient|required/gi);

if (hasBalanceValidation && hasBalanceValidation.length < 3) {
    warnings.push({
        severity: 'MEDIUM',
        title: 'Bakiye kontrolü yetersiz',
        description: 'Bakiye kontrolü var ama kapsamlı değil',
        risk: 'Yetersiz bakiyeyle emir açılabilir = rejected order'
    });
    console.log('  ⚠️  Bakiye kontrolü var ama yetersiz olabilir');
} else if (!hasBalanceValidation) {
    issues.push({
        severity: 'CRITICAL',
        title: 'Bakiye kontrolü yok',
        description: 'Yetersiz bakiye kontrolü yapılmıyor',
        risk: 'Exchange API error, rejected order'
    });
    console.log('  ❌ Bakiye kontrolü YOK!');
} else {
    console.log('  ✅ Bakiye kontrolü mevcut');
}

// 5. Price precision kontrolü
console.log('\n🔍 5. PRECISION KONTROLÜ:');
const hasPrecisionControl = functionBody.match(/toFixed|round|precision/gi);

if (!hasPrecisionControl) {
    issues.push({
        severity: 'HIGH',
        title: 'Precision kontrolü eksik',
        description: 'Fiyat precision kontrolü yapılmıyor',
        risk: 'Exchange API rejected order (invalid precision)'
    });
    console.log('  ❌ Precision kontrolü YOK!');
} else {
    console.log('  ✅ Precision kontrolü var');
}

// 6. Aktif emir kontrolü (çift emir önleme)
console.log('\n🔍 6. ÇİFT EMİR ÖNLEME:');
const hasActiveOrderCheck = functionBody.includes('currentOrder.active');

if (!hasActiveOrderCheck) {
    issues.push({
        severity: 'HIGH',
        title: 'Aktif emir kontrolü eksik',
        description: 'Çift emir önleme mekanizması yok',
        risk: 'Aynı anda birden fazla emir açılabilir'
    });
    console.log('  ❌ Çift emir kontrolü YOK!');
} else {
    console.log('  ✅ Aktif emir kontrolü mevcut');
}

// 7. Dry-run modu kontrolü
console.log('\n🔍 7. DRY-RUN MODU:');
const hasDryRunCheck = functionBody.includes('dryRun') || botCode.includes('if (config.advanced.dryRun)');

if (!hasDryRunCheck) {
    warnings.push({
        severity: 'MEDIUM',
        title: 'Dry-run modu kullanılmamış',
        description: 'Test modu olmadan production\'da çalıştırılıyor',
        risk: 'İlk denemede gerçek para ile test = risk'
    });
    console.log('  ⚠️  Dry-run modu kullanılmıyor');
} else {
    console.log('  ✅ Dry-run desteği var');
}

// Kodu satır satır incele - kritik bölümler
console.log('\n🔍 8. KOD İNCELEME - Emir Fiyat Hesaplama:');

// Margin-based pricing bulalım
const marginPricingMatch = functionBody.match(/orderPrice\s*=\s*this\.prices\.(binance|btcturk)\.(bid|ask)\s*\*\s*\(1\s*[+-]\s*[^)]+\)/g);

if (marginPricingMatch) {
    console.log('  ⚠️  Basit margin-based pricing kullanılıyor:');
    marginPricingMatch.forEach(m => console.log('    -', m));
    console.log('  🔴 Fee hesaplamaları ve karlılık göz önünde bulundurulmamış olabilir!');

    warnings.push({
        severity: 'HIGH',
        title: 'Basit margin-based pricing',
        description: 'Fiyat sadece Binance fiyatı + margin ile hesaplanıyor',
        risk: 'Fee\'ler ve gerçek karlılık hesaplanmamış olabilir',
        fix: 'engine.calculateOrderPrice() kullanılmalı'
    });
}

// Engine'in calculateOrderPrice kullanımını kontrol et
const usesCalculateOrderPrice = functionBody.includes('calculateOrderPrice');
if (!usesCalculateOrderPrice) {
    console.log('  ❌ engine.calculateOrderPrice() KULLANILMIYOR!');
    issues.push({
        severity: 'CRITICAL',
        title: 'Emir fiyat hesaplaması yanlış',
        description: 'Engine\'in calculateOrderPrice() metodu kullanılmıyor',
        risk: 'Fee\'siz basit hesaplama = zarar',
        fix: 'engine.calculateOrderPrice() ile doğru fiyat hesapla'
    });
}

// ============================================================================
// ÖZET RAPOR
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('📊 SORUN RAPORU');
console.log('='.repeat(80) + '\n');

console.log(`🔴 CRITICAL Sorunlar: ${issues.filter(i => i.severity === 'CRITICAL').length}`);
console.log(`⚠️  HIGH Uyarılar: ${issues.filter(i => i.severity === 'HIGH').length + warnings.filter(w => w.severity === 'HIGH').length}`);
console.log(`⚠️  MEDIUM Uyarılar: ${warnings.filter(w => w.severity === 'MEDIUM').length}`);
console.log('');

if (issues.filter(i => i.severity === 'CRITICAL').length > 0) {
    console.log('🔴 KRİTİK SORUNLAR (Acil düzeltilmeli!):\n');

    issues.filter(i => i.severity === 'CRITICAL').forEach((issue, idx) => {
        console.log(`${idx + 1}. ${issue.title}`);
        console.log(`   📝 ${issue.description}`);
        console.log(`   ⚠️  Risk: ${issue.risk}`);
        if (issue.fix) {
            console.log(`   💡 Çözüm: ${issue.fix}`);
        }
        if (issue.line) {
            console.log(`   📍 Konum: ${issue.line}`);
        }
        console.log('');
    });
}

if (warnings.filter(w => w.severity === 'HIGH').length > 0 ||
    issues.filter(i => i.severity === 'HIGH').length > 0) {
    console.log('⚠️  YÜKSEK ÖNCELİKLİ UYARILAR:\n');

    [...warnings, ...issues].filter(w => w.severity === 'HIGH').forEach((warning, idx) => {
        console.log(`${idx + 1}. ${warning.title}`);
        console.log(`   📝 ${warning.description}`);
        console.log(`   ⚠️  Risk: ${warning.risk}`);
        if (warning.fix) {
            console.log(`   💡 Çözüm: ${warning.fix}`);
        }
        console.log('');
    });
}

console.log('='.repeat(80));
console.log('🎯 ÖNERİLER:');
console.log('='.repeat(80) + '\n');

console.log('1. createNewOrder() içine şu kontrolleri ekle:');
console.log('   - const profitability = engine.calculateProfitability(prices);');
console.log('   - if (!profitability.hasOpportunity) return false;');
console.log('   - if (!profitability.bestScenario.meetsMinProfit) return false;');
console.log('');

console.log('2. Emir fiyatını engine ile hesapla:');
console.log('   - const pricing = engine.calculateOrderPrice(prices);');
console.log('   - orderPrice = pricing.orderPrice;');
console.log('');

console.log('3. Dry-run modu ekle:');
console.log('   - if (config.advanced.dryRun) { log only, no real order }');
console.log('');

console.log('4. Testleri production öncesi çalıştır:');
console.log('   - Önce dry-run ile 24 saat test');
console.log('   - Sonra küçük miktarlarla (1-2 XRP) gerçek test');
console.log('   - Bakiyeleri sürekli kontrol et');
console.log('');

// Final verdict
const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;

if (criticalCount > 0) {
    console.log('='.repeat(80));
    console.log('❌ SONUÇ: BOT PRODUCTION\'A HAZIR DEĞİL!');
    console.log('='.repeat(80));
    console.log(`${criticalCount} kritik sorun var, MUTLAKA düzeltilmeli.`);
    console.log('Bu sorunlar PARA KAYBI riskine neden olabilir!');
    console.log('');
} else {
    console.log('='.repeat(80));
    console.log('✅ SONUÇ: Kritik sorun yok, ama iyileştirmeler öneriliyor.');
    console.log('='.repeat(80));
    console.log('');
}
