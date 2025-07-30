class RatesService {
    constructor() {
        console.log('🔥 ПРОСТОЙ RatesService - ТОЛЬКО GOOGLE SHEETS!');
    }

    async getRates() {
        console.log('🔥 getRates() - ЧИТАЕМ ТОЛЬКО ИЗ GOOGLE SHEETS!');
        
        // 🔥 ПРОСТАЯ ЛОГИКА: ЕСЛИ НЕТ GLOBAL - СОЗДАЕМ САМИ!
        if (!global.googleSheetsManager || !global.googleSheetsManager.isReady()) {
            console.log('🔥 СОЗДАЕМ GoogleSheetsManager ИЗ config/google-sheets.json!');
            await this.initGoogleSheetsFromFile();
        }
        
        if (!global.googleSheetsManager || !global.googleSheetsManager.isReady()) {
            console.error('❌ Google Sheets недоступен даже после инициализации!');
            throw new Error('Google Sheets недоступен!');
        }

        const manualRates = await global.googleSheetsManager.readManualRatesFromTable();
        console.log(`📊 Получено ${manualRates.length} курсов из Google Sheets`);
        
        if (!manualRates || manualRates.length === 0) {
            throw new Error('Google Sheets пуст!');
        }

        const rates = [];
        for (const rate of manualRates) {
            const [fromCurrency, toCurrency] = rate.pair.split('/');
            
            console.log(`🔥 Обрабатываем пару: ${rate.pair} (${fromCurrency} → ${toCurrency})`);
            
            // Создаем запись для fromCurrency (прямой курс) - БЕЗ ДУБЛИКАТОВ
            const existingFromCurrency = rates.find(r => r.currency === fromCurrency);
            if (!existingFromCurrency) {
                console.log(`🔥 Добавляем ${fromCurrency}: sell=${rate.sellRate}, buy=${rate.buyRate}`);
                rates.push({
                    currency: fromCurrency,
                    pair: rate.pair,
                    price: (rate.sellRate + rate.buyRate) / 2,
                    sell: rate.sellRate,
                    buy: rate.buyRate,
                    source: 'GOOGLE_SHEETS',
                    type: fromCurrency === 'USD' || fromCurrency === 'EUR' || fromCurrency === 'RUB' || fromCurrency === 'ARS' || fromCurrency === 'BRL' ? 'fiat' : 'crypto',
                    lastUpdate: new Date().toISOString()
                });
            } else {
                console.log(`⚠️ ПРОПУСКАЕМ ${fromCurrency} - уже есть: sell=${existingFromCurrency.sell}`);
            }
            
            // Создаем запись для toCurrency (обратный курс) - БЕЗ ДУБЛИКАТОВ
            const existingToCurrency = rates.find(r => r.currency === toCurrency);
            if (!existingToCurrency) {
                const reverseSell = 1 / rate.buyRate;
                const reverseBuy = 1 / rate.sellRate;
                console.log(`🔥 Добавляем ${toCurrency} (обратный): sell=${reverseSell}, buy=${reverseBuy}`);
                rates.push({
                    currency: toCurrency,
                    pair: `${toCurrency}/${fromCurrency}`,
                    price: (reverseSell + reverseBuy) / 2,
                    sell: reverseSell,
                    buy: reverseBuy,
                    source: 'GOOGLE_SHEETS',
                    type: toCurrency === 'USD' || toCurrency === 'EUR' || toCurrency === 'RUB' || toCurrency === 'ARS' || toCurrency === 'BRL' ? 'fiat' : 'crypto',
                    lastUpdate: new Date().toISOString()
                });
            } else {
                console.log(`⚠️ ПРОПУСКАЕМ ${toCurrency} - уже есть: sell=${existingToCurrency.sell}`);
            }
        }

        console.log(`🔥 ВОЗВРАЩАЕМ ${rates.length} КУРСОВ ИЗ GOOGLE SHEETS!`);
        rates.forEach(rate => {
            console.log(`   ${rate.currency}: sell=${rate.sell}, source=${rate.source}`);
        });
        
        return rates;
    }

    async syncWithGoogleSheets() {
        console.log('🔥 syncWithGoogleSheets() - ничего не делаем, всегда читаем напрямую');
        return true;
    }

    getLastUpdateTime() {
        return new Date().toISOString();
    }

    // 🔥 ПРОСТАЯ ИНИЦИАЛИЗАЦИЯ GOOGLE SHEETS ИЗ ФАЙЛА
    async initGoogleSheetsFromFile() {
        console.log('🔥 ПРОСТАЯ ИНИЦИАЛИЗАЦИЯ GoogleSheetsManager...');
        
        try {
            const fs = require('fs');
            const path = require('path');
            const configPath = path.join(__dirname, '..', '..', 'config', 'google-sheets.json');
            
            console.log('🔍 Ищем файл:', configPath);
            console.log('🔍 Файл существует?', fs.existsSync(configPath));
            
            if (fs.existsSync(configPath)) {
                console.log('📄 Читаем config/google-sheets.json...');
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                console.log('📊 Конфигурация загружена, spreadsheet_id:', config.spreadsheet_id ? 'есть' : 'нет');
                
                if (config.enabled && config.spreadsheet_id && config.credentials) {
                    const GoogleSheetsManager = require('./GoogleSheetsManager');
                    const manager = new GoogleSheetsManager();
                    
                    console.log('🔧 Инициализируем GoogleSheetsManager...');
                    const success = await manager.init(config.credentials, config.spreadsheet_id);
                    
                    if (success) {
                        console.log('📋 Создаем worksheets...');
                        await manager.createWorksheets();
                        global.googleSheetsManager = manager;
                        console.log('✅ ПРОСТАЯ ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА!');
                    } else {
                        console.log('❌ Инициализация вернула false');
                    }
                } else {
                    console.log('❌ Неполная конфигурация в файле');
                }
            } else {
                console.log('❌ Файл config/google-sheets.json не найден');
                console.log('🔄 Пробуем переменные окружения Railway...');
                
                // FALLBACK: переменные окружения Railway
                const envSpreadsheetId = process.env.GOOGLE_SHEETS_ID;
                const envCredentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
                const envEnabled = process.env.GOOGLE_SHEETS_ENABLED !== 'false';
                
                console.log('🔍 Railway переменные - ID:', envSpreadsheetId ? 'есть' : 'нет', ', CREDENTIALS:', envCredentials ? 'есть' : 'нет');
                
                if (envSpreadsheetId && envCredentials && envEnabled) {
                    try {
                        // Очищаем credentials от лишних символов
                        let cleanCredentials = envCredentials.trim();
                        if (cleanCredentials.startsWith('=')) {
                            cleanCredentials = cleanCredentials.substring(1);
                            console.log('🔧 Убрал лишний = из Railway переменной');
                        }
                        
                        console.log('🔧 Парсим Railway JSON...');
                        const credentials = JSON.parse(cleanCredentials);
                        console.log('✅ Railway JSON спаршен!');
                        
                        const GoogleSheetsManager = require('./GoogleSheetsManager');
                        const manager = new GoogleSheetsManager();
                        
                        console.log('🔧 Railway инициализация GoogleSheetsManager...');
                        const success = await manager.init(credentials, envSpreadsheetId);
                        
                        if (success) {
                            console.log('📋 Railway создание worksheets...');
                            await manager.createWorksheets();
                            global.googleSheetsManager = manager;
                            console.log('✅ RAILWAY ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА!');
                        } else {
                            console.log('❌ Railway инициализация вернула false');
                        }
                    } catch (railwayError) {
                        console.error('❌ Ошибка Railway инициализации:', railwayError.message);
                    }
                } else {
                    console.log('❌ Railway переменные неполные');
                }
            }
        } catch (error) {
            console.error('❌ Ошибка простой инициализации:', error.message);
        }
    }
}

module.exports = RatesService;
