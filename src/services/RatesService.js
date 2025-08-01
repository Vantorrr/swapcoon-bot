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

        // 🔥 НОВАЯ ЛОГИКА: ТОЛЬКО ПРЯМЫЕ ПАРЫ, БЕЗ ОБРАТНЫХ КУРСОВ!
        const pairRates = [];
        
        for (const rate of manualRates) {
            console.log(`🔥 Добавляем прямую пару: ${rate.pair} (sell=${rate.sellRate}, buy=${rate.buyRate})`);
            
            pairRates.push({
                pair: rate.pair,
                sellRate: rate.sellRate,
                buyRate: rate.buyRate,
                source: 'GOOGLE_SHEETS',
                lastUpdate: new Date().toISOString()
            });
        }
        
        console.log(`🔥 ВОЗВРАЩАЕМ ${pairRates.length} ПРЯМЫХ ПАР ИЗ GOOGLE SHEETS!`);
        pairRates.forEach(rate => {
            console.log(`   ${rate.pair}: sell=${rate.sellRate}, buy=${rate.buyRate}`);
        });
        
                 return pairRates;
    }

    async syncWithGoogleSheets() {
        console.log('🔥 syncWithGoogleSheets() - ничего не делаем, всегда читаем напрямую');
        return true;
    }

    // Метод для получения курса обмена между двумя валютами
    async getExchangeRate(fromCurrency, toCurrency, amount = 1) {
        console.log(`🔥 getExchangeRate: ${fromCurrency} → ${toCurrency} (сумма: ${amount})`);
        
        try {
            // Получаем все курсы из Google Sheets
            const rates = await this.getRates();
            console.log(`📊 Получено ${rates.length} курсов из Google Sheets`);
            
            // Если валюты одинаковые, курс = 1
            if (fromCurrency === toCurrency) {
                console.log('💡 Одинаковые валюты, курс = 1');
                return 1;
            }
            
            // Ищем прямую пару
            const directPair = `${fromCurrency}/${toCurrency}`;
            const directRate = rates.find(r => r.pair === directPair);
            
            if (directRate) {
                console.log(`✅ Найдена прямая пара ${directPair}: sell=${directRate.sellRate}, buy=${directRate.buyRate}`);
                // Используем средний курс между покупкой и продажей
                const avgRate = (directRate.sellRate + directRate.buyRate) / 2;
                console.log(`💱 Средний курс: ${avgRate}`);
                return avgRate;
            }
            
            // Ищем обратную пару
            const reversePair = `${toCurrency}/${fromCurrency}`;
            const reverseRate = rates.find(r => r.pair === reversePair);
            
            if (reverseRate) {
                console.log(`✅ Найдена обратная пара ${reversePair}: sell=${reverseRate.sellRate}, buy=${reverseRate.buyRate}`);
                // Для обратной пары инвертируем курс
                const avgRate = (reverseRate.sellRate + reverseRate.buyRate) / 2;
                const invertedRate = 1 / avgRate;
                console.log(`💱 Обращенный курс: ${invertedRate}`);
                return invertedRate;
            }
            
            // Пытаемся найти курс через USDT как промежуточную валюту
            const fromToUsdt = rates.find(r => r.pair === `${fromCurrency}/USDT`);
            const toToUsdt = rates.find(r => r.pair === `${toCurrency}/USDT`);
            
            if (fromToUsdt && toToUsdt) {
                console.log(`✅ Найден путь через USDT: ${fromCurrency}/USDT и ${toCurrency}/USDT`);
                const fromUsdtRate = (fromToUsdt.sellRate + fromToUsdt.buyRate) / 2;
                const toUsdtRate = (toToUsdt.sellRate + toToUsdt.buyRate) / 2;
                const crossRate = fromUsdtRate / toUsdtRate;
                console.log(`💱 Кросс-курс через USDT: ${crossRate}`);
                return crossRate;
            }
            
            // Пытаемся найти обратные курсы к USDT
            const usdtToFrom = rates.find(r => r.pair === `USDT/${fromCurrency}`);
            const usdtToTo = rates.find(r => r.pair === `USDT/${toCurrency}`);
            
            if (usdtToFrom && usdtToTo) {
                console.log(`✅ Найден обратный путь через USDT: USDT/${fromCurrency} и USDT/${toCurrency}`);
                const fromUsdtRate = 1 / ((usdtToFrom.sellRate + usdtToFrom.buyRate) / 2);
                const toUsdtRate = 1 / ((usdtToTo.sellRate + usdtToTo.buyRate) / 2);
                const crossRate = fromUsdtRate / toUsdtRate;
                console.log(`💱 Обратный кросс-курс через USDT: ${crossRate}`);
                return crossRate;
            }
            
            // Если ничего не найдено, используем fallback
            console.log(`⚠️ Пара ${fromCurrency}/${toCurrency} не найдена в таблице, используем fallback`);
            return this.getFallbackRate(fromCurrency, toCurrency);
            
        } catch (error) {
            console.error(`❌ Ошибка получения курса ${fromCurrency}/${toCurrency}:`, error.message);
            // Возвращаем fallback курс в случае ошибки
            return this.getFallbackRate(fromCurrency, toCurrency);
        }
    }
    
    // Fallback курсы на случай отсутствия данных в Google Sheets
    getFallbackRate(fromCurrency, toCurrency) {
        console.log(`🔄 Fallback курс для ${fromCurrency}/${toCurrency}`);
        
        // Захардкоженные курсы как запасной вариант
        const fallbackRates = {
            'USDT/ARS': 1290,
            'ARS/USDT': 1/1290,
            'USDT/RUB': 78,
            'RUB/USDT': 1/78,
            'RUB/ARS': 1290/78,
            'ARS/RUB': 78/1290
        };
        
        const pairKey = `${fromCurrency}/${toCurrency}`;
        const rate = fallbackRates[pairKey];
        
        if (rate) {
            console.log(`✅ Fallback курс найден: ${rate}`);
            return rate;
        }
        
        console.log(`⚠️ Fallback курс не найден, возвращаем 1`);
        return 1;
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
