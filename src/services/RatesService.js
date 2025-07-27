const axios = require('axios');

class RatesService {
    constructor() {
        this.cache = new Map();
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
            'USDC': 'usd-coin',
            'BNB': 'binancecoin',
            'SOL': 'solana',
            'ADA': 'cardano',
            'DOT': 'polkadot',
            'MATIC': 'matic-network',
            'AVAX': 'avalanche-2'
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
        this.autoUpdatePaused = false;   // Пауза автообновления
        this.pauseUntil = null;         // До какого времени пауза
        
        // 📊 ИНТЕГРАЦИЯ С GOOGLE SHEETS
        this.googleSheetsRates = new Map(); // Курсы из таблицы
        this.lastSheetsSync = 0;            // Время последней синхронизации
        this.sheetsSyncInterval = 30000;    // 30 секунд
        
        this.initAutoUpdate();
        this.initSheetsSync();
    }

    async getRates() {
        try {
            // Проверяем кэш
            const cached = this.cache.get('rates');
            if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                console.log('🔄 Используем курсы из кэша');
                return cached.data;
            }

            // Получаем свежие курсы
            const rates = await this.fetchFreshRates();
            
            // Применяем ручные настройки
            const adjustedRates = this.applyManualSettings(rates);
            
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
        try {
            // Получаем криптовалюты
            const cryptoIds = Object.values(this.currencyMapping).join(',');
            const cryptoResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                params: {
                    ids: cryptoIds,
                    vs_currencies: 'usd',
                    include_24hr_change: 'true',
                    include_last_updated_at: 'true'
                },
                timeout: 10000
            });

            // Получаем фиатные курсы (EUR, RUB и т.д.)
            const fiatResponse = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
                timeout: 10000
            });
            
            const rates = [];
            
            // Обрабатываем криптовалюты
            for (const [symbol, id] of Object.entries(this.currencyMapping)) {
                const coinData = cryptoResponse.data[id];
                if (coinData) {
                    const price = coinData.usd;
                    const spread = this.calculateSpread(price);
                    
                    rates.push({
                        currency: symbol,
                        buy: price - spread,
                        sell: price + spread,
                        price: price,
                        change24h: coinData.usd_24h_change || 0,
                        lastUpdate: new Date(coinData.last_updated_at * 1000).toISOString(),
                        type: 'crypto'
                    });
                }
            }
            
            // Обрабатываем фиатные валюты
            const fiatData = fiatResponse.data.rates;
            for (const [currency, defaultRate] of Object.entries(this.fiatRates)) {
                let rate = defaultRate;
                
                if (currency === 'USD') {
                    rate = 1.0;
                } else if (fiatData[currency]) {
                    rate = 1 / fiatData[currency]; // Конвертируем в USD
                }
                
                const spread = currency === 'USD' ? 0 : this.fiatSpread; // Настраиваемый спред для фиата
                
                rates.push({
                    currency: currency,
                    buy: rate - spread,
                    sell: rate + spread,
                    price: rate,
                    change24h: 0, // Для фиата не показываем изменения
                    lastUpdate: new Date().toISOString(),
                    type: 'fiat'
                });
            }
            
            return rates;
            
        } catch (error) {
            console.error('❌ Ошибка получения данных от API:', error.message);
            throw error;
        }
    }
    
    calculateSpread(price) {
        // Динамический спред в зависимости от цены (НАСТРАИВАЕМЫЙ)
        if (price >= 50000) return price * this.cryptoSpreads.high;    // BTC и дорогие
        if (price >= 1000) return price * this.cryptoSpreads.medium;   // ETH и средние
        if (price >= 1) return price * this.cryptoSpreads.stable;      // Стейблкоины
        return price * this.cryptoSpreads.low; // Дешевые монеты
    }
    
    getBasicRates() {
        // Базовые курсы на случай полного отказа API
        return [
            { currency: 'BTC', buy: 94500, sell: 95500, price: 95000, change24h: 2.4, lastUpdate: new Date().toISOString(), type: 'crypto' },
            { currency: 'ETH', buy: 3480, sell: 3520, price: 3500, change24h: 1.8, lastUpdate: new Date().toISOString(), type: 'crypto' },
            { currency: 'USDT', buy: 0.995, sell: 1.005, price: 1.0, change24h: 0.1, lastUpdate: new Date().toISOString(), type: 'crypto' },
            { currency: 'USDC', buy: 0.995, sell: 1.005, price: 1.0, change24h: 0.0, lastUpdate: new Date().toISOString(), type: 'crypto' },
            { currency: 'USD', buy: 1.0, sell: 1.0, price: 1.0, change24h: 0, lastUpdate: new Date().toISOString(), type: 'fiat' },
            { currency: 'EUR', buy: 0.90, sell: 0.94, price: 0.92, change24h: 0, lastUpdate: new Date().toISOString(), type: 'fiat' },
            { currency: 'RUB', buy: 0.0103, sell: 0.0109, price: 0.0106, change24h: 0, lastUpdate: new Date().toISOString(), type: 'fiat' },
            { currency: 'ARS', buy: 0.00098, sell: 0.00102, price: 0.001, change24h: 0, lastUpdate: new Date().toISOString(), type: 'fiat' },
            { currency: 'BRL', buy: 0.194, sell: 0.206, price: 0.20, change24h: 0, lastUpdate: new Date().toISOString(), type: 'fiat' }
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
            timestamp: Date.now()
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
        this.autoUpdatePaused = false;
        this.pauseUntil = null;
        console.log(`▶️ Автообновление возобновлено`);
    }
    
    // Принудительное обновление
    async forceUpdate() {
        console.log('🔄 Принудительное обновление курсов...');
        this.cache.clear();
        this.autoUpdatePaused = false;
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
    applyManualSettings(rates) {
        if (!rates || !Array.isArray(rates)) return rates;
        
        return rates.map(rate => {
            let adjustedRate = { ...rate };
            
            // 📊 ПРИОРИТЕТ 1: Курсы из Google Sheets (самый высокий)
            const sheetRate = this.getSheetRateForPair(rate.currency, 'USD');
            if (sheetRate) {
                adjustedRate.sell = sheetRate.sellRate;
                adjustedRate.buy = sheetRate.buyRate;
                adjustedRate.price = (sheetRate.sellRate + sheetRate.buyRate) / 2;
                adjustedRate.source = 'GOOGLE_SHEETS';
                console.log(`📊 Применен курс из Google Sheets для ${rate.currency}: продажа ${sheetRate.sellRate}, покупка ${sheetRate.buyRate}`);
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
            
            if (manualRates && manualRates.length > 0) {
                // Обновляем курсы из Google Sheets
                this.googleSheetsRates.clear();
                
                for (const rate of manualRates) {
                    this.googleSheetsRates.set(rate.pair, {
                        sellRate: rate.sellRate,
                        buyRate: rate.buyRate,
                        lastUpdated: rate.lastUpdated,
                        comment: rate.comment
                    });
                }
                
                // Очищаем кэш чтобы применить новые курсы
                this.cache.clear();
                this.lastSheetsSync = Date.now();
                
                console.log(`📊 Синхронизировано ${manualRates.length} ручных курсов из Google Sheets`);
            }

            // Также синхронизируем текущие API курсы в таблицу (если нет ручных)
            const currentRates = await this.fetchFreshRates();
            await global.googleSheetsManager.syncCurrentRatesToTable(currentRates);
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации с Google Sheets:', error.message);
        }
    }

    // Получение курса с учетом Google Sheets
    getSheetRateForPair(fromCurrency, toCurrency) {
        const pair1 = `${fromCurrency}/${toCurrency}`;
        const pair2 = `${toCurrency}/${fromCurrency}`;
        
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