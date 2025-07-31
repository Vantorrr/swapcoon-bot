class RatesService {
    constructor() {
        console.log('🔥 ПРОСТОЙ RatesService - ТОЛЬКО GOOGLE SHEETS!');
    }

    async getRates() {
        console.log('🔥 getRates() - ЧИТАЕМ ТОЛЬКО ИЗ GOOGLE SHEETS!');
        
        // 🔥 ПРОВЕРЯЕМ СОСТОЯНИЕ GOOGLE SHEETS MANAGER
        console.log('🔍 global.googleSheetsManager существует?', !!global.googleSheetsManager);
        if (global.googleSheetsManager) {
            console.log('🔍 global.googleSheetsManager.isReady():', global.googleSheetsManager.isReady());
        }
        
        // 🔥 ЛОГИКА: ЕСЛИ НЕТ GLOBAL ИЛИ НЕ ГОТОВ - ПРОБУЕМ ИНИЦИАЛИЗИРОВАТЬ
        if (!global.googleSheetsManager || !global.googleSheetsManager.isReady()) {
            console.log('🔥 НУЖНА ИНИЦИАЛИЗАЦИЯ GoogleSheetsManager!');
            await this.initGoogleSheetsFromFile();
            
            // Дополнительная проверка после инициализации
            console.log('🔍 После инициализации - googleSheetsManager существует?', !!global.googleSheetsManager);
            if (global.googleSheetsManager) {
                console.log('🔍 После инициализации - isReady():', global.googleSheetsManager.isReady());
            }
        }
        
        if (!global.googleSheetsManager || !global.googleSheetsManager.isReady()) {
            console.error('❌ Google Sheets недоступен даже после инициализации!');
            console.error('🔍 ДИАГНОСТИКА ФИНАЛЬНОГО СОСТОЯНИЯ:');
            console.error('   global.googleSheetsManager:', !!global.googleSheetsManager);
            if (global.googleSheetsManager) {
                console.error('   isReady():', global.googleSheetsManager.isReady());
                console.error('   isConnected:', global.googleSheetsManager.isConnected);
            }
            throw new Error('Google Sheets недоступен!');
        }

        const manualRates = await global.googleSheetsManager.readManualRatesFromTable();
        console.log(`📊 Получено ${manualRates.length} курсов из Google Sheets`);
        
        if (!manualRates || manualRates.length === 0) {
            throw new Error('Google Sheets пуст!');
        }

        // 🔥 ВОЗВРАЩАЕМ ФОРМАТ СОВМЕСТИМЫЙ С API (currency + rates)
        const currencyMap = new Map();
        
        for (const rate of manualRates) {
            const [fromCurrency, toCurrency] = rate.pair.split('/');
            console.log(`🔥 Обрабатываем пару: ${rate.pair} (${fromCurrency} → ${toCurrency})`);
            
            // Добавляем fromCurrency если еще нет
            if (!currencyMap.has(fromCurrency)) {
                currencyMap.set(fromCurrency, {
                currency: fromCurrency,
                    price: rate.sellRate,
                sell: rate.sellRate,
                buy: rate.buyRate,
                source: 'GOOGLE_SHEETS',
                    type: fromCurrency === 'USD' || fromCurrency === 'EUR' || fromCurrency === 'RUB' || fromCurrency === 'ARS' || fromCurrency === 'BRL' ? 'fiat' : 'crypto',
                    lastUpdate: new Date().toISOString(),
                    pair: rate.pair
            });
                console.log(`🔥 Добавляем валюту ${fromCurrency}: sell=${rate.sellRate}, buy=${rate.buyRate}`);
            }
            
            // Добавляем toCurrency если еще нет (с обратным курсом)
            if (!currencyMap.has(toCurrency)) {
                const reverseSell = 1 / rate.buyRate;
                const reverseBuy = 1 / rate.sellRate;
                currencyMap.set(toCurrency, {
                    currency: toCurrency,
                    price: reverseSell,
                    sell: reverseSell,
                    buy: reverseBuy,
                    source: 'GOOGLE_SHEETS',
                    type: toCurrency === 'USD' || toCurrency === 'EUR' || toCurrency === 'RUB' || toCurrency === 'ARS' || toCurrency === 'BRL' ? 'fiat' : 'crypto',
                    lastUpdate: new Date().toISOString(),
                    pair: `${toCurrency}/${fromCurrency}`
                });
                console.log(`🔥 Добавляем валюту ${toCurrency} (обратный): sell=${reverseSell}, buy=${reverseBuy}`);
            }
        }
        
        // Преобразуем Map в массив
        const rates = Array.from(currencyMap.values());

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

    // 🔥 ИНИЦИАЛИЗАЦИЯ GOOGLE SHEETS (ПРИОРИТЕТ: ФАЙЛ → RAILWAY)
    async initGoogleSheetsFromFile() {
        console.log('🔥 ⚡ НАЧИНАЕМ ИНИЦИАЛИЗАЦИЮ GoogleSheetsManager...');
        
        try {
            const fs = require('fs');
            const path = require('path');
            const configPath = path.join(__dirname, '..', '..', 'config', 'google-sheets.json');
            
            console.log('🔍 Путь к файлу:', configPath);
            console.log('🔍 Файл существует?', fs.existsSync(configPath));
            
            let config = null;
            
            // ПОПЫТКА 1: Читаем локальный файл
            if (fs.existsSync(configPath)) {
                console.log('📄 ✅ НАЙДЕН ЛОКАЛЬНЫЙ ФАЙЛ! Читаем config/google-sheets.json...');
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                console.log('📊 Файл загружен! Spreadsheet ID:', config.spreadsheet_id ? 'есть' : 'нет');
                console.log('📊 Enabled:', config.enabled);
                console.log('📊 Credentials client_email:', config.credentials?.client_email || 'нет');
            } else {
                console.log('❌ Локальный файл НЕ НАЙДЕН');
            }
            
            // ПОПЫТКА 2: Railway переменные (если файла нет)
            if (!config) {
                console.log('🚂 ⚡ ПРОБУЕМ RAILWAY ПЕРЕМЕННЫЕ...');
                
                const envSpreadsheetId = process.env.GOOGLE_SHEETS_ID;
                const envCredentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
                const envEnabled = process.env.GOOGLE_SHEETS_ENABLED !== 'false';
                
                console.log('🔍 GOOGLE_SHEETS_ID:', envSpreadsheetId ? 'ЕСТЬ' : 'НЕТ');
                console.log('🔍 GOOGLE_SHEETS_CREDENTIALS:', envCredentials ? 'ЕСТЬ' : 'НЕТ');
                console.log('🔍 GOOGLE_SHEETS_ENABLED:', envEnabled);
                
                if (envSpreadsheetId && envCredentials && envEnabled) {
                    try {
                        console.log('🔧 ⚡ ОБРАБАТЫВАЕМ RAILWAY JSON...');
                        console.log('🔍 Длина credentials:', envCredentials.length);
                        console.log('🔍 Первые 20 символов:', envCredentials.substring(0, 20));
                        
                        // Очистка JSON
                        let cleanCredentials = envCredentials.trim();
                        if (cleanCredentials.startsWith('=')) {
                            console.log('🔧 Убираем лишний = из начала');
                            cleanCredentials = cleanCredentials.substring(1);
                        }
                        
                        console.log('🔧 Парсим очищенный JSON...');
                        const railwayCredentials = JSON.parse(cleanCredentials);
                        console.log('✅ RAILWAY JSON УСПЕШНО СПАРШЕН!');
                        console.log('📊 Client email:', railwayCredentials.client_email || 'нет');
                        
                        config = {
                            enabled: true,
                            spreadsheet_id: envSpreadsheetId,
                            credentials: railwayCredentials
                        };
                        
                        console.log('✅ RAILWAY КОНФИГ СОЗДАН!');
                    } catch (railwayError) {
                        console.error('❌ ОШИБКА ПАРСИНГА RAILWAY JSON:', railwayError.message);
                        console.error('🔍 Проблемная строка (первые 100):', envCredentials?.substring(0, 100));
                        return;
                    }
                } else {
                    console.log('❌ RAILWAY ПЕРЕМЕННЫЕ НЕПОЛНЫЕ!');
                    console.log('   Нужны: GOOGLE_SHEETS_ID, GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SHEETS_ENABLED');
                    return;
                }
            }
            
            // ПОПЫТКА 3: Инициализация GoogleSheetsManager
            if (config && config.enabled && config.spreadsheet_id && config.credentials) {
                console.log('🚀 ЗАПУСКАЕМ ИНИЦИАЛИЗАЦИЮ GOOGLESHEETSMANAGER...');
                console.log('📊 Spreadsheet ID:', config.spreadsheet_id);
                console.log('📊 Client email:', config.credentials.client_email);
                
                const GoogleSheetsManager = require('./GoogleSheetsManager');
                const manager = new GoogleSheetsManager();
                
                console.log('🔧 Вызываем manager.init()...');
                const success = await manager.init(config.credentials, config.spreadsheet_id);
                console.log('🔍 Результат manager.init():', success);
                
                if (success) {
                    console.log('📋 ✅ INIT УСПЕШЕН! Создаем worksheets...');
                    await manager.createWorksheets();
                    console.log('📋 ✅ WORKSHEETS СОЗДАНЫ!');
                    
                    global.googleSheetsManager = manager;
                    console.log('🌐 ✅ GLOBAL УСТАНОВЛЕН!');
                    console.log('🔍 Проверяем isReady():', manager.isReady());
                    console.log('🎉 ✅ ИНИЦИАЛИЗАЦИЯ ПОЛНОСТЬЮ ЗАВЕРШЕНА!');
                } else {
                    console.error('❌ manager.init() ВЕРНУЛ FALSE!');
                }
            } else {
                console.error('❌ НЕПОЛНАЯ КОНФИГУРАЦИЯ!');
                console.error('   enabled:', !!config?.enabled);
                console.error('   spreadsheet_id:', !!config?.spreadsheet_id);  
                console.error('   credentials:', !!config?.credentials);
            }
        } catch (error) {
            console.error('💥 КРИТИЧЕСКАЯ ОШИБКА ИНИЦИАЛИЗАЦИИ:', error.message);
            console.error('🔍 Stack:', error.stack);
        }
    }
}

module.exports = RatesService;
