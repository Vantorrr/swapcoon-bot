class RatesService {
    constructor() {
        console.log('🔥 ПРОСТОЙ RatesService - ТОЛЬКО GOOGLE SHEETS!');
    }

    async getRates() {
        console.log('🔥 getRates() - ЧИТАЕМ ТОЛЬКО ИЗ GOOGLE SHEETS!');
        
        if (!global.googleSheetsManager || !global.googleSheetsManager.isReady()) {
            console.error('❌ Google Sheets недоступен!');
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
            
            // Создаем запись для fromCurrency (прямой курс)
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
            
            // Создаем запись для toCurrency (обратный курс)
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
}

module.exports = RatesService;
