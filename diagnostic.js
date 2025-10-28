/**
 * SHBOT Diagnostics Script
 * Sistemdeki tüm sorunları tespit eder ve rapor verir
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n' + '='.repeat(80));
console.log('🔍 SHBOT DİAGNOSTİK TARAMA');
console.log('='.repeat(80) + '\n');

let diagnostics = {
    fileStructure: [],
    envConfig: [],
    dependencies: [],
    code: [],
    warnings: [],
    errors: []
};

// 1. Dosya Yapısı Kontrolü
console.log('📁 Dosya Yapısı Kontrolü...');
console.log('─'.repeat(80));

const requiredFiles = [
    'package.json',
    '.env.example',
    'src/index.js',
    'src/bot/ArbitrageBot.js',
    'src/bot/ArbitrageEngine.js',
    'src/config/config.js',
    'src/utils/logger.js',
    'src/exchanges/BTCTurkClient.js',
    'src/exchanges/BinanceClient.js'
];

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    const exists = fs.existsSync(filePath);
    
    if (exists) {
        diagnostics.fileStructure.push({ file, status: 'OK' });
        console.log(`✅ ${file}`);
    } else {
        diagnostics.fileStructure.push({ file, status: 'MISSING' });
        diagnostics.errors.push(`Dosya bulunamadı: ${file}`);
        console.log(`❌ ${file} - BULUNAMADI`);
    }
});

// 2. .env Dosya Kontrolü
console.log('\n📝 .env Dosya Kontrolü...');
console.log('─'.repeat(80));

const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
    console.log('✅ .env dosyası mevcut');
    
    // .env içeriğini kontrol et
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const requiredEnvVars = [
        'BTCTURK_API_KEY',
        'BTCTURK_API_SECRET',
        'BINANCE_API_KEY',
        'BINANCE_API_SECRET'
    ];
    
    requiredEnvVars.forEach(varName => {
        const regex = new RegExp(`^${varName}=(.+)$`, 'm');
        const match = envContent.match(regex);
        
        if (match && match[1] && match[1] !== 'your_btcturk_api_key_here' && match[1] !== 'your_binance_api_key_here' && match[1] !== 'your_btcturk_api_secret_here' && match[1] !== 'your_binance_api_secret_here') {
            diagnostics.envConfig.push({ variable: varName, status: 'OK' });
            console.log(`✅ ${varName} - AYARLANMIŞ`);
        } else {
            diagnostics.envConfig.push({ variable: varName, status: 'NOT_SET' });
            diagnostics.warnings.push(`${varName} ayarlanmamış veya varsayılan değerde`);
            console.log(`⚠️  ${varName} - AYARLANMAMIŞ`);
        }
    });
    
} else {
    diagnostics.errors.push('.env dosyası bulunamadı');
    console.log('❌ .env dosyası bulunamadı');
    console.log('ℹ️  .env.example dosyasından kopyalayıp .env oluşturun');
}

// 3. package.json ve Dependencies Kontrolü
console.log('\n📦 Dependencies Kontrolü...');
console.log('─'.repeat(80));

const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    const requiredDeps = ['ws', 'dotenv', 'winston'];
    
    requiredDeps.forEach(dep => {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
            diagnostics.dependencies.push({ package: dep, status: 'OK' });
            console.log(`✅ ${dep} - ${packageJson.dependencies[dep]}`);
        } else {
            diagnostics.dependencies.push({ package: dep, status: 'MISSING' });
            diagnostics.errors.push(`Dependency eksik: ${dep}`);
            console.log(`❌ ${dep} - BULUNAMADI`);
        }
    });
    
    // node_modules var mı?
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        console.log('✅ node_modules klasörü mevcut');
    } else {
        diagnostics.errors.push('node_modules bulunamadı - npm install çalıştırın');
        console.log('❌ node_modules bulunamadı');
        console.log('ℹ️  "npm install" komutunu çalıştırın');
    }
}

// 4. Kod Analizi (Basit)
console.log('\n🔍 Kod Analizi...');
console.log('─'.repeat(80));

// ArbitrageBot.js kontrolü
const botPath = path.join(__dirname, 'src/bot/ArbitrageBot.js');
if (fs.existsSync(botPath)) {
    const botContent = fs.readFileSync(botPath, 'utf8');
    
    // Kritik metodları kontrol et
    const criticalMethods = [
        'initialize',
        'start',
        'stop',
        'createNewOrder',
        'checkOrderStatus',
        'executeCounterOrder',
        'updateBalances',
        'checkPriceChange'
    ];
    
    let missingMethods = [];
    criticalMethods.forEach(method => {
        if (botContent.includes(`async ${method}(`) || botContent.includes(`${method}(`)) {
            console.log(`✅ ${method}() metodu mevcut`);
        } else {
            missingMethods.push(method);
            diagnostics.warnings.push(`ArbitrageBot.js'de ${method}() metodu bulunamadı`);
            console.log(`⚠️  ${method}() metodu bulunamadı veya isim farklı`);
        }
    });
}

// Config kontrolü
const configPath = path.join(__dirname, 'src/config/config.js');
if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // priceUpdateThreshold kontrolü
    if (configContent.includes('priceUpdateThreshold:')) {
        const thresholdMatch = configContent.match(/priceUpdateThreshold:\s*getFloat\(['"]PRICE_UPDATE_THRESHOLD['"]\s*,\s*([\d.]+)\)/);
        
        if (thresholdMatch) {
            const defaultValue = parseFloat(thresholdMatch[1]);
            
            if (defaultValue === 0.2) {
                console.log('✅ priceUpdateThreshold doğru yapılandırılmış (0.2%)');
            } else if (defaultValue === 0.002) {
                diagnostics.warnings.push('priceUpdateThreshold 0.002 olarak ayarlı - 0.2 olmalı (yüzde formatı)');
                console.log('⚠️  priceUpdateThreshold 0.002 olarak ayarlı - 0.2 olmalı');
            } else {
                diagnostics.warnings.push(`priceUpdateThreshold beklenmeyen değer: ${defaultValue}`);
                console.log(`⚠️  priceUpdateThreshold: ${defaultValue} (beklenmeyen değer)`);
            }
        }
    }
}

// 5. Logs Klasörü Kontrolü
console.log('\n📋 Logs Klasörü Kontrolü...');
console.log('─'.repeat(80));

const logsPath = path.join(__dirname, 'logs');
if (fs.existsSync(logsPath)) {
    console.log('✅ logs/ klasörü mevcut');
    
    // Log dosyalarını listele
    const logFiles = fs.readdirSync(logsPath);
    if (logFiles.length > 0) {
        console.log(`ℹ️  ${logFiles.length} log dosyası bulundu:`);
        logFiles.slice(0, 5).forEach(file => {
            const stats = fs.statSync(path.join(logsPath, file));
            console.log(`   - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
        });
        if (logFiles.length > 5) {
            console.log(`   ... ve ${logFiles.length - 5} dosya daha`);
        }
    } else {
        console.log('ℹ️  Henüz log dosyası oluşturulmamış');
    }
} else {
    console.log('⚠️  logs/ klasörü bulunamadı - ilk çalıştırmada oluşturulacak');
}

// 6. SONUÇ RAPORU
console.log('\n' + '='.repeat(80));
console.log('📊 DİAGNOSTİK RAPORU');
console.log('='.repeat(80));

console.log(`\n✅ Dosya Yapısı: ${diagnostics.fileStructure.filter(f => f.status === 'OK').length}/${diagnostics.fileStructure.length} OK`);
console.log(`✅ Environment Variables: ${diagnostics.envConfig.filter(e => e.status === 'OK').length}/${diagnostics.envConfig.length} OK`);
console.log(`✅ Dependencies: ${diagnostics.dependencies.filter(d => d.status === 'OK').length}/${diagnostics.dependencies.length} OK`);

if (diagnostics.errors.length > 0) {
    console.log('\n❌ HATALAR:');
    diagnostics.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
    });
}

if (diagnostics.warnings.length > 0) {
    console.log('\n⚠️  UYARILAR:');
    diagnostics.warnings.forEach((warn, i) => {
        console.log(`   ${i + 1}. ${warn}`);
    });
}

const hasErrors = diagnostics.errors.length > 0;
const hasWarnings = diagnostics.warnings.length > 0;

console.log('\n' + '='.repeat(80));

if (!hasErrors && !hasWarnings) {
    console.log('🎉 SİSTEM SAĞLIKLI!');
    console.log('✅ Tüm kontroller başarılı');
    console.log('\n📝 Sonraki Adım:');
    console.log('   1. "npm run start" ile botu başlatın');
    console.log('   2. veya "node test-phase3.js" ile test edin');
} else if (!hasErrors && hasWarnings) {
    console.log('⚠️  SİSTEM ÇALIŞIR DURUMDA (Uyarılar var)');
    console.log('✅ Kritik hatalar yok');
    console.log('⚠️  Bazı uyarılar mevcut - yukarıdaki listeye bakın');
    console.log('\n📝 Sonraki Adım:');
    console.log('   1. Uyarıları inceleyin ve mümkünse düzeltin');
    console.log('   2. "node test-phase3.js" ile test edin');
} else {
    console.log('❌ SİSTEMDE HATALAR VAR!');
    console.log('❌ Lütfen yukarıdaki hataları düzeltin');
    console.log('\n📝 Yapılması Gerekenler:');
    console.log('   1. Eksik dosyaları tamamlayın');
    console.log('   2. .env dosyasını oluşturun ve API key\'leri girin');
    console.log('   3. npm install çalıştırın');
    console.log('   4. Bu scripti tekrar çalıştırın');
}

console.log('='.repeat(80) + '\n');

process.exit(hasErrors ? 1 : 0);
