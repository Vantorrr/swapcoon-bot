const axios = require('axios');

class RatesService {
    constructor() {
        this.cacheExpiry = 10 * 1000; // 🔥 10 секунд для отладки!
        this.cacheExpiry = 30 * 60 * 1000; // 30 минут
        this.lastUpdate = null;
        
        // ⚙️ НАСТРОЙКИ ПРИБЫЛЬНОСТИ (можно вынести в переменные окружения)
        this.commission = parseFloat(process.env.EXCHANGE_COMMISSION) || 0.01; // 1% по умолчанию
        this.cryptoSpreads = {
            high: parseFloat(process.env.CRYPTO_SPREAD_HIGH) || 0.005,    // 0.5% для BTC
            medium: parseFloat(process.env.CRYPTO_SPREAD_MEDIUM) || 0.008, // 0.8% для ETH  
            stable: parseFloat(process.env.CRYPTO_SPREAD_STABLE) || 0.01,  // 1% для стейблкоинов
            low: parseFloat(process.env.CRYPTO_SPREAD_LOW) || 0.02        // 2% для дешевых
        };
        this.fiatSpread = parseFloat(process.env.FIAT_SPREAD) || 0.02;      // 2% для фиата
        
        console.log('💰 Настройки прибыльности:');
        console.log(`   Комиссия: ${(this.commission * 100).toFixed(1)}%`);
        console.log(`   Спреды крипто: ${(this.cryptoSpreads.high * 100).toFixed(1)}%-${(this.cryptoSpreads.low * 100).toFixed(1)}%`);
        console.log(`   Спред фиат: ${(this.fiatSpread * 100).toFixed(1)}%`);

        // Маппинг валют
        this.currencyMapping = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum', 
            'USDT': 'tether',
            'USDC': 'usd-coin'
        };
        
        // Фиатные валюты
        this.fiatRates = {
            'USD': 1.0,
            'EUR': 0.92,
            'RUB': 95.0,
            'UAH': 37.0,
            'KZT': 450.0,
            'ARS': 1000.0, // Аргентинский песо
            'BRL': 5.1     // Бразильский реал
        };
        
        // 🔧 РУЧНОЕ УПРАВЛЕНИЕ КУРСАМИ
        this.emergencySpread = 0;        // Экстренный спред в процентах
        this.ratesMultiplier = 1.0;      // Общий множитель курсов
        this.manualRates = new Map();    // Ручные курсы конкретных валют
        this.autoUpdatePaused = true; // ОТКЛЮЧЕНО НАВСЕГДА - используем ТОЛЬКО Google Sheets!   // Пауза автообновления
        this.pauseUntil = null;         // До какого времени пауза
        
        // 📊 ИНТЕГРАЦИЯ С GOOGLE SHEETS
        this.googleSheetsRates = new Map(); // Курсы из таблицы
        this.lastSheetsSync = 0;            // Время последней синхронизации
        this.sheetsSyncInterval = 180000;   // 3 минуты (уменьшаем нагрузку на Google API)
        
        // 🔥 API АВТООБНОВЛЕНИЕ ПОЛНОСТЬЮ ОТКЛЮЧЕНО!
        // // this.initAutoUpdate(); // 🔥 ОТКЛЮЧЕНО - ТОЛЬКО Google Sheets! // УБРАНО НАВСЕГДА!
        this.initSheetsSync();
    }

    async getRates() {
        try {
            console.log("🔍 ===== НАЧИНАЕМ getRates() =====");
            console.log("🔍 global.googleSheetsManager существует?", !!global.googleSheetsManager);
            if (global.googleSheetsManager) {
                console.log("🔍 googleSheetsManager.isReady()?", global.googleSheetsManager.isReady());
            }
            console.log("🔍 this.googleSheetsRates.size:", this.googleSheetsRates.size);            // Проверяем кэш
            const cached = this.cache.get('rates');
            const cacheAge = cached ? Date.now() - cached.timestamp : 'нет кэша';
            console.log(`🔍 ПРОВЕРКА КЭША: возраст ${cacheAge}ms, лимит ${this.cacheExpiry}ms`);
            
            if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                console.log('🔄 Используем курсы из кэша + ПРИМЕНЯЕМ Google Sheets настройки');
                console.log(`🔍 Google Sheets в памяти: ${this.googleSheetsRates.size} курсов`);
                
                // ПРИМЕНЯЕМ Google Sheets настройки даже к кэшированным курсам!
                const adjustedCachedRates = this.applyManualSettings(cached.data);
                return adjustedCachedRates;
            }
            
            console.log('📊 Кэш истек или отсутствует - получаем свежие курсы');


            // 🔥 ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ С GOOGLE SHEETS!
            if (global.googleSheetsManager && global.googleSheetsManager.isReady()) {
                console.log("🔥 Принудительно синхронизируемся с Google Sheets...");
                await this.syncWithGoogleSheets();
            } else {
                console.log("❌ Google Sheets Manager недоступен для синхронизации");
            }            // Получаем свежие курсы
            const rates = await this.fetchFreshRates();
            
            // Применяем ручные настройки
            console.log(`🔍 ПЕРЕД ПРИМЕНЕНИЕМ НАСТРОЕК: ${rates.length} курсов`);
            console.log(`🔍 Google Sheets в памяти: ${this.googleSheetsRates.size} курсов`);
            if (this.googleSheetsRates.size > 0) {
                console.log('🔍 Курсы в Google Sheets:');
                for (const [pair, rate] of this.googleSheetsRates.entries()) {
                    console.log(`   ${pair}: продажа ${rate.sellRate}, покупка ${rate.buyRate}`);
                }
            }
            const adjustedRates = this.applyManualSettings(rates);
            
            // Диагностика: проверяем RUB курс после применения настроек
            const rubRate = adjustedRates.find(r => r.currency === 'RUB');
            if (rubRate) {
                console.log(`🔍 RUB КУРС ПОСЛЕ НАСТРОЕК: sell=${rubRate.sell}, buy=${rubRate.buy}, price=${rubRate.price}, source=${rubRate.source || 'API'}`);
            } else {
                console.log('❌ RUB курс НЕ НАЙДЕН в adjustedRates');
            }
            
            // Сохраняем в кэш
            this.cache.set('rates', {
                data: adjustedRates,
                timestamp: Date.now()
            });
            
            this.lastUpdate = new Date();
            console.log('✅ Курсы валют обновлены:', adjustedRates.length, 'валют');
            return adjustedRates;
            
        } catch (error) {
            console.error('❌ Ошибка получения курсов:', error.message);
            
            // Возвращаем кэшированные данные если есть
            const cached = this.cache.get('rates');
            if (cached) {
                console.log('⚠️ Используем устаревшие курсы из кэша');
                return cached.data;
            }
            
            // В крайнем случае возвращаем базовые курсы
            return this.getBasicRates();
        }
    }
    async fetchFreshRates() {
        // 🔥 API ЗАПРОСЫ ПОЛНОСТЬЮ ОТКЛЮЧЕНЫ! ТОЛЬКО БАЗОВЫЕ КУРСЫ + Google Sheets!
        console.log("🔥 НЕ ДЕЛАЕМ API ЗАПРОСЫ - используем только базовые курсы + Google Sheets");
        return this.getBasicRates();
    }    
    calculateSpread(price) {
        // Динамический спред в зависимости от цены (НАСТРАИВАЕМЫЙ)
        if (price >= 50000) return price * this.cryptoSpreads.high;    // BTC и дорогие
        if (price >= 1000) return price * this.cryptoSpreads.medium;   // ETH и средние
        if (price >= 1) return price * this.cryptoSpreads.stable;      // Стейблкоины
        return price * this.cryptoSpreads.low; // Дешевые монеты
    }
    
    getBasicRates() {
        // 🔥 БАЗОВЫЕ КУРСЫ ДЛЯ ВСЕХ ВАЛЮТ (заглушки для применения Google Sheets)
        console.log("📊 getBasicRates: возвращаем заглушки для применения Google Sheets");
        return [
            { currency: "USD", buy: 1.0, sell: 1.0, price: 1.0, change24h: 0, lastUpdate: new Date().toISOString(), type: "fiat", source: "BASE" },
            { currency: "USDT", buy: 1.0, sell: 1.0, price: 1.0, change24h: 0, lastUpdate: new Date().toISOString(), type: "crypto", source: "BASE" },
            { currency: "BTC", buy: 95000, sell: 95000, price: 95000, change24h: 0, lastUpdate: new Date().toISOString(), type: "crypto", source: "BASE" },
            { currency: "ETH", buy: 3500, sell: 3500, price: 3500, change24h: 0, lastUpdate: new Date().toISOString(), type: "crypto", source: "BASE" },
            { currency: "RUB", buy: 0.0128, sell: 0.0128, price: 0.0128, change24h: 0, lastUpdate: new Date().toISOString(), type: "fiat", source: "BASE" },
            { currency: "ARS", buy: 0.001, sell: 0.001, price: 0.001, change24h: 0, lastUpdate: new Date().toISOString(), type: "fiat", source: "BASE" },
            { currency: "EUR", buy: 0.92, sell: 0.92, price: 0.92, change24h: 0, lastUpdate: new Date().toISOString(), type: "fiat", source: "BASE" },
            { currency: "BRL", buy: 0.20, sell: 0.20, price: 0.20, change24h: 0, lastUpdate: new Date().toISOString(), type: "fiat", source: "BASE" }
        ];
    }
    initAutoUpdate() {
        // Обновляем курсы каждые 5 минут
        this.updateInterval = setInterval(async () => {
            try {
                console.log('🔄 Автообновление курсов...');
                await this.getRates();
            } catch (error) {
                console.error('❌ Ошибка автообновления курсов:', error.message);
            }
        }, 5 * 60 * 1000);
        
        console.log('✅ Автообновление курсов запущено (каждые 5 минут)');
    }

    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('🛑 Автообновление курсов остановлено');
        }
    }

    getLastUpdateTime() {
        return this.lastUpdate;
    }

    // Получить курс конкретной валютной пары
    async getExchangeRate(fromCurrency, toCurrency, amount = 1) {
        console.log(`🔍 ЗАПРОС КУРСА: ${fromCurrency} → ${toCurrency}, сумма: ${amount}`);
        console.log(`🔍 Google Sheets курсов в памяти: ${this.googleSheetsRates.size}`);
        
        if (this.googleSheetsRates.size > 0) {
            console.log('🔍 Список курсов в Google Sheets:');
            for (const [pair, rate] of this.googleSheetsRates.entries()) {
                console.log(`   ${pair}: продажа ${rate.sellRate}, покупка ${rate.buyRate}`);
            }
        }
        
        // 📊 ПРИОРИТЕТ 1: Проверяем ручные курсы из Google Sheets
        const sheetRate = this.getSheetRateForPair(fromCurrency, toCurrency);
        console.log(`🔍 Результат поиска в Google Sheets для ${fromCurrency}/${toCurrency}:`, sheetRate ? 'НАЙДЕН' : 'НЕ НАЙДЕН');
        if (sheetRate) {
            console.log(`📊 Используем ручной курс из Google Sheets для ${fromCurrency}/${toCurrency}: продажа ${sheetRate.sellRate}, покупка ${sheetRate.buyRate}`);
            
            const exchangeRate = sheetRate.sellRate;
            const resultAmount = amount * exchangeRate;
            const fee = resultAmount * this.commission;
            
            return {
                fromCurrency,
                toCurrency,
                amount,
                exchangeRate,
                resultAmount: resultAmount - fee,
                fee,
                fromRate: sheetRate.sellRate,
                toRate: sheetRate.buyRate,
                timestamp: Date.now(),
                source: 'GOOGLE_SHEETS'
            };
        }
        
        // 📡 ПРИОРИТЕТ 2: Используем API курсы
        const rates = await this.getRates();
        
        const fromRate = rates.find(r => r.currency === fromCurrency);
        const toRate = rates.find(r => r.currency === toCurrency);
        
        if (!fromRate || !toRate) {
            throw new Error(`Валютная пара ${fromCurrency}/${toCurrency} не поддерживается`);
        }
        
        // Расчет через USD
        const fromUSD = fromCurrency === 'USD' ? 1 : fromRate.sell;
        const toUSD = toCurrency === 'USD' ? 1 : toRate.buy;
        
        const exchangeRate = fromUSD / toUSD;
        const resultAmount = amount * exchangeRate;
        const fee = resultAmount * this.commission; // Настраиваемая комиссия
        
        return {
            fromCurrency,
            toCurrency,
            amount,
            exchangeRate,
            resultAmount: resultAmount - fee,
            fee,
            fromRate: fromRate.sell,
            toRate: toRate.buy,
            timestamp: Date.now(),
            source: 'API'
        };
    }

    // 🔧 МЕТОДЫ РУЧНОГО УПРАВЛЕНИЯ КУРСАМИ

    // Установка экстренного спреда
    setEmergencySpread(emergencyPercent) {
        this.emergencySpread = emergencyPercent || 0;
        console.log(`🚨 Установлен экстренный спред: +${emergencyPercent}%`);
        this.cache.clear(); // Очищаем кэш для применения
    }
    
    // Установка множителя курсов
    setRatesMultiplier(multiplier) {
        this.ratesMultiplier = multiplier || 1.0;
        console.log(`⚡ Установлен множитель курсов: ${multiplier}x`);
        this.cache.clear();
    }
    
    // Ручная установка курса конкретной валюты (множитель)
    setManualRate(currency, multiplier, duration = 3600000) { // 1 час по умолчанию
        if (!this.manualRates) this.manualRates = new Map();
        
        this.manualRates.set(currency, {
            multiplier: multiplier,
            setAt: Date.now(),
            duration: duration,
            type: 'multiplier'
        });
        
        console.log(`💱 Установлен ручной курс ${currency}: ${multiplier}x на ${duration/60000} минут`);
        this.cache.clear();
    }
    
    // Ручная установка абсолютного курса валюты
    async setAbsoluteRate(currency, absolutePrice, duration = 3600000) { // 1 час по умолчанию
        if (!this.manualRates) this.manualRates = new Map();
        
        // Получаем ЧИСТЫЕ курсы без ручных настроек для правильного расчета множителя
        const freshRates = await this.fetchFreshRates();
        const currentRate = freshRates.find(r => r.currency === currency);
        
        if (!currentRate) {
            throw new Error(`Валюта ${currency} не найдена`);
        }
        
        // Рассчитываем множитель для достижения нужной цены
        const multiplier = absolutePrice / currentRate.price;
        
        this.manualRates.set(currency, {
            absolutePrice: absolutePrice,
            multiplier: multiplier,
            setAt: Date.now(),
            duration: duration,
            type: 'absolute'
        });
        
        console.log(`✏️ Установлен абсолютный курс ${currency}: $${absolutePrice} (множитель: ${multiplier.toFixed(4)}x) на ${duration/60000} минут`);
        this.cache.clear();
    }
    
    // Пауза автообновления
    pauseAutoUpdate(duration = 3600000) { // 1 час
        this.autoUpdatePaused = true;
        this.pauseUntil = Date.now() + duration;
        console.log(`⏸️ Автообновление приостановлено на ${duration/60000} минут`);
    }
    
    // Возобновление автообновления
    resumeAutoUpdate() {
        this.autoUpdatePaused = true; // ОТКЛЮЧЕНО НАВСЕГДА - используем ТОЛЬКО Google Sheets!
        this.pauseUntil = null;
        console.log(`▶️ Автообновление возобновлено`);
    }
    
    // Принудительное обновление
    async forceUpdate() {
        console.log('🔄 Принудительное обновление курсов...');
        this.cache.clear();
        this.autoUpdatePaused = true; // ОТКЛЮЧЕНО НАВСЕГДА - используем ТОЛЬКО Google Sheets!
        this.pauseUntil = null;
        this.emergencySpread = 0;
        this.ratesMultiplier = 1.0;
        this.manualRates.clear();
        
        try {
            const rates = await this.fetchFreshRates();
            this.cache.set('rates', {
                data: rates,
                timestamp: Date.now()
            });
            console.log('✅ Принудительное обновление завершено');
            return rates;
        } catch (error) {
            console.error('❌ Ошибка принудительного обновления:', error);
            throw error;
        }
    }

    // Применение ручных настроек к курсам
    // Применение ручных настроек к курсам
    applyManualSettings(rates) {
        if (!rates || !Array.isArray(rates)) return rates;
        
        console.log(`🔍 ПРИМЕНЯЕМ НАСТРОЙКИ К ${rates.length} КУРСАМ`);
        console.log(`🔍 Google Sheets курсов в памяти: ${this.googleSheetsRates.size}`);
        
        return rates.map(rate => {
            let adjustedRate = { ...rate };
            
            console.log(`🔍 Обрабатываем валюту: ${rate.currency}`);
            
            // 📊 ПРИОРИТЕТ 1: Курсы из Google Sheets (самый высокий)
            // Ищем ЛЮБУЮ пару с этой валютой, не только USD
            let sheetRate = null;
            
            // Ищем прямые пары (currency/XXX)
            for (const [pair, rateData] of this.googleSheetsRates.entries()) {
                if (pair.startsWith(rate.currency + '/')) {
                    sheetRate = {
                        sellRate: rateData.sellRate,
                        buyRate: rateData.buyRate,
                        source: 'GOOGLE_SHEETS',
                        comment: rateData.comment,
                        pair: pair
                    };
                    console.log(`🔍 НАЙДЕНА ПРЯМАЯ ПАРА для ${rate.currency}: ${pair}`);
                    break;
                }
            }
            
            // Если не нашли прямую, ищем обратные пары (XXX/currency)
            if (!sheetRate) {
                for (const [pair, rateData] of this.googleSheetsRates.entries()) {
                    if (pair.endsWith('/' + rate.currency)) {
                        sheetRate = {
                            sellRate: 1 / rateData.buyRate,  // Обращаем курсы
                            buyRate: 1 / rateData.sellRate,
                            source: 'GOOGLE_SHEETS',
                            comment: rateData.comment,
                            pair: pair + ' (обратная)'
                        };
                        console.log(`🔍 НАЙДЕНА ОБРАТНАЯ ПАРА для ${rate.currency}: ${pair}`);
                        break;
                    }
                }
            }
            
            if (sheetRate) {
                console.log(`🔍 ДО ПРИМЕНЕНИЯ ${rate.currency}: sell=${adjustedRate.sell}, buy=${adjustedRate.buy}, price=${adjustedRate.price}`);
                
                adjustedRate.sell = sheetRate.sellRate;
                adjustedRate.buy = sheetRate.buyRate;
                adjustedRate.price = (sheetRate.sellRate + sheetRate.buyRate) / 2;
                adjustedRate.source = 'GOOGLE_SHEETS';
                
                console.log(`📊 Применен курс из Google Sheets для ${rate.currency} (${sheetRate.pair}): продажа ${sheetRate.sellRate}, покупка ${sheetRate.buyRate}`);
                console.log(`🔍 ПОСЛЕ ПРИМЕНЕНИЯ ${rate.currency}: sell=${adjustedRate.sell}, buy=${adjustedRate.buy}, price=${adjustedRate.price}, source=${adjustedRate.source}`);
                
                return adjustedRate; // Возвращаем сразу, Google Sheets имеет максимальный приоритет
            }
            
            // 🔧 ПРИОРИТЕТ 2: Ручные настройки через бот
            // Применяем общий множитель
            if (this.ratesMultiplier !== 1.0) {
                adjustedRate.price *= this.ratesMultiplier;
                adjustedRate.buy *= this.ratesMultiplier;
                adjustedRate.sell *= this.ratesMultiplier;
            }
            
            // Применяем индивидуальный множитель валюты
            if (this.manualRates && this.manualRates.has(rate.currency)) {
                const manual = this.manualRates.get(rate.currency);
                // Проверяем не истек ли срок
                if (Date.now() - manual.setAt < manual.duration) {
                    adjustedRate.price *= manual.multiplier;
                    adjustedRate.buy *= manual.multiplier;
                    adjustedRate.sell *= manual.multiplier;
                } else {
                    this.manualRates.delete(rate.currency); // Удаляем истекшую настройку
                }
            }
            
            // Применяем экстренный спред
            if (this.emergencySpread > 0) {
                const emergencyMultiplier = 1 + (this.emergencySpread / 100);
                const currentSpread = adjustedRate.sell - adjustedRate.buy;
                const newSpread = currentSpread * emergencyMultiplier;
                const center = (adjustedRate.sell + adjustedRate.buy) / 2;
                
                adjustedRate.buy = center - newSpread / 2;
                adjustedRate.sell = center + newSpread / 2;
            }
            
            return adjustedRate;
        });
    }
    
    // Ручная установка абсолютного курса валюты
    async setAbsoluteRate(currency, absolutePrice, duration = 3600000) { // 1 час по умолчанию
        if (!this.manualRates) this.manualRates = new Map();
        
        // Получаем текущие курсы БЕЗ ручных настроек для расчета чистого множителя
        const freshRates = await this.fetchFreshRates();
        const currentRate = freshRates.find(r => r.currency === currency);
        
        if (!currentRate) {
            throw new Error(`Валюта ${currency} не найдена`);
        }
        
        // Рассчитываем множитель для достижения нужной цены
        const multiplier = absolutePrice / currentRate.price;
        
        this.manualRates.set(currency, {
            absolutePrice: absolutePrice,
            multiplier: multiplier,
            setAt: Date.now(),
            duration: duration,
            type: 'absolute'
        });
        
        console.log(`✏️ Установлен абсолютный курс ${currency}: $${absolutePrice} (множитель: ${multiplier.toFixed(4)}x) на ${duration/60000} минут`);
        this.cache.clear();
    }

    // 📊 ИНТЕГРАЦИЯ С GOOGLE SHEETS

    // Инициализация синхронизации с Google Sheets
    initSheetsSync() {
        // Синхронизируем курсы каждые 30 секунд
        setInterval(async () => {
            await this.syncWithGoogleSheets();
        }, this.sheetsSyncInterval);
        
        // Первая синхронизация через 5 секунд после запуска
        setTimeout(async () => {
            await this.syncWithGoogleSheets();
        }, 5000);
        
        console.log('📊 Инициализирована синхронизация с Google Sheets (каждые 30 сек)');
    }

    // Синхронизация курсов с Google Sheets
    async syncWithGoogleSheets() {
        try {
            console.log('📊 ПОПЫТКА СИНХРОНИЗАЦИИ с Google Sheets...');
            console.log('   global.googleSheetsManager:', !!global.googleSheetsManager);
            
            if (global.googleSheetsManager) {
                console.log('   googleSheetsManager.isReady():', global.googleSheetsManager.isReady());
            }
            
            // Проверяем есть ли Google Sheets Manager
            if (!global.googleSheetsManager || !global.googleSheetsManager.isReady()) {
                console.log('❌ Google Sheets не готов для синхронизации. Пропускаем...');
                return; // Тихо пропускаем если Google Sheets не настроен
            }
            
            console.log('✅ Google Sheets готов! Начинаем синхронизацию...');

            // Читаем ручные курсы из таблицы
            const manualRates = await global.googleSheetsManager.readManualRatesFromTable();
            
            console.log(`📊 РЕЗУЛЬТАТ ЧТЕНИЯ: получено ${manualRates ? manualRates.length : 0} курсов`);
            if (manualRates && manualRates.length > 0) {
                console.log('📊 ПОЛУЧЕННЫЕ КУРСЫ:');
                manualRates.forEach(rate => {
                    console.log(`   Пара: "${rate.pair}", продажа: ${rate.sellRate}, покупка: ${rate.buyRate}`);
                });
            }
            
            if (manualRates && manualRates.length > 0) {
                // Обновляем курсы из Google Sheets
                console.log('🔄 ОЧИЩАЕМ старые курсы...');
                this.googleSheetsRates.clear();
                
                console.log('💾 СОХРАНЯЕМ новые курсы:');
                for (const rate of manualRates) {
                    console.log(`   Сохраняем: "${rate.pair}" -> продажа: ${rate.sellRate}, покупка: ${rate.buyRate}`);
                    this.googleSheetsRates.set(rate.pair, {
                        sellRate: rate.sellRate,
                        buyRate: rate.buyRate,
                        lastUpdated: rate.lastUpdated,
                        comment: rate.comment
                    });
                }
                
                console.log(`✅ СОХРАНЕНО ${this.googleSheetsRates.size} курсов в памяти`);
                console.log('📋 СПИСОК КЛЮЧЕЙ:', Array.from(this.googleSheetsRates.keys()));
                
                // Очищаем кэш чтобы применить новые курсы
                this.cache.clear();
                this.lastSheetsSync = Date.now();
                
                console.log(`📊 Синхронизировано ${manualRates.length} ручных курсов из Google Sheets`);
            }

            // Также синхронизируем текущие API курсы в таблицу (если нет ручных)
            const currentRates = await this.fetchFreshRates();
            await global.googleSheetsManager.syncCurrentRatesToTable(currentRates);
            
        } catch (error) {
            if (error.message.includes('429')) {
                console.log('⏳ Google API rate limit достигнут. Пропускаем синхронизацию до следующего интервала...');
            } else {
                console.error('❌ Ошибка синхронизации с Google Sheets:', error.message);
            }
        }
    }

    // Получение курса с учетом Google Sheets
    getSheetRateForPair(fromCurrency, toCurrency) {
        const pair1 = `${fromCurrency}/${toCurrency}`;
        const pair2 = `${toCurrency}/${fromCurrency}`;
        
        console.log(`🔍 ПОИСК КУРСА В GOOGLE SHEETS:`);
        console.log(`   Ищем пару 1: "${pair1}"`);
        console.log(`   Ищем пару 2: "${pair2}"`);
        console.log(`   Доступные пары:`, Array.from(this.googleSheetsRates.keys()));
        
        // Проверяем прямую пару
        if (this.googleSheetsRates.has(pair1)) {
            const rate = this.googleSheetsRates.get(pair1);
            return {
                sellRate: rate.sellRate,
                buyRate: rate.buyRate,
                source: 'GOOGLE_SHEETS',
                comment: rate.comment
            };
        }
        
        // Проверяем обратную пару
        if (this.googleSheetsRates.has(pair2)) {
            const rate = this.googleSheetsRates.get(pair2);
            return {
                sellRate: 1 / rate.buyRate,  // Обращаем курсы
                buyRate: 1 / rate.sellRate,
                source: 'GOOGLE_SHEETS',
                comment: rate.comment
            };
        }
        
        return null;
    }
}

module.exports = RatesService; 