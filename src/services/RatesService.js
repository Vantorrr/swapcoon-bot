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
            
            console.log(`🔥 Добавляем курс: ${fromCurrency} sell=${rate.sellRate}, buy=${rate.buyRate}`);
            
            rates.push({
                currency: fromCurrency,
                price: (rate.sellRate + rate.buyRate) / 2,
                sell: rate.sellRate,
                buy: rate.buyRate,
                source: 'GOOGLE_SHEETS',
                type: 'crypto',
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
