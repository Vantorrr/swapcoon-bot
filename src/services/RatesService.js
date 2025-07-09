const axios = require('axios');

class RatesService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 минут
        this.lastUpdate = null;
        this.updateInterval = null;
        
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
        
        this.initAutoUpdate();
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
            
            // Сохраняем в кэш
            this.cache.set('rates', {
                data: rates,
                timestamp: Date.now()
            });
            
            this.lastUpdate = new Date();
            console.log('✅ Курсы валют обновлены:', rates.length, 'валют');
            return rates;
            
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
                
                const spread = currency === 'USD' ? 0 : 0.02; // 2% спред для фиата
                
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
        // Динамический спред в зависимости от цены
        if (price >= 50000) return price * 0.005; // 0.5% для дорогих монет (BTC)
        if (price >= 1000) return price * 0.008;  // 0.8% для средних (ETH)
        if (price >= 1) return price * 0.01;     // 1% для стейблкоинов
        return price * 0.02; // 2% для дешевых монет
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
        const fee = resultAmount * 0.01; // 1% комиссия
        
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
}

module.exports = RatesService; 