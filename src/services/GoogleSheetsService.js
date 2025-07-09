const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class GoogleSheetsService {
    constructor() {
        this.doc = null;
        this.sheet = null;
        this.initSheet();
    }

    async initSheet() {
        try {
            // Проверяем наличие переменных окружения
            if (!process.env.GOOGLE_SHEETS_ID) {
                console.log('⚠️ GOOGLE_SHEETS_ID не настроен, используем тестовые данные');
                this.sheet = null;
                return;
            }

            this.doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID);
            
            // Аутентификация через Service Account (исправленная версия)
            if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
                const serviceAccountAuth = new JWT({
                    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                    scopes: [
                        'https://www.googleapis.com/auth/spreadsheets',
                    ],
                });

                this.doc.useServiceAccountAuth(serviceAccountAuth);
                
                await this.doc.loadInfo();
                this.sheet = this.doc.sheetsByIndex[0]; // Первый лист
                
                console.log('✅ Google Sheets подключен:', this.doc.title);
            } else {
                console.log('⚠️ Google Sheets учетные данные не настроены, используем тестовые данные');
                this.sheet = null;
            }
        } catch (error) {
            console.error('❌ Ошибка подключения к Google Sheets:', error.message);
            console.log('🔄 Переключаемся на тестовые данные');
            // Заглушка для разработки
            this.sheet = null;
        }
    }

    async getRates() {
        try {
            if (!this.sheet) {
                // Возвращаем тестовые данные если нет подключения
                return this.getTestRates();
            }

            const rows = await this.sheet.getRows();
            const rates = [];

            for (const row of rows) {
                rates.push({
                    currency: row.currency || row['Валюта'],
                    buy: parseFloat(row.buy || row['Покупка']) || 0,
                    sell: parseFloat(row.sell || row['Продажа']) || 0,
                    lastUpdate: row.lastUpdate || row['Обновлено'] || new Date().toISOString()
                });
            }

            return rates;
        } catch (error) {
            console.error('Ошибка получения курсов из Google Sheets:', error);
            return this.getTestRates();
        }
    }

    getTestRates() {
        // Тестовые курсы для разработки
        return [
            {
                currency: 'BTC',
                buy: 95000,
                sell: 96000,
                lastUpdate: new Date().toISOString()
            },
            {
                currency: 'ETH',
                buy: 3500,
                sell: 3520,
                lastUpdate: new Date().toISOString()
            },
            {
                currency: 'USDT',
                buy: 1.0,
                sell: 1.02,
                lastUpdate: new Date().toISOString()
            },
            {
                currency: 'USDC',
                buy: 1.0,
                sell: 1.02,
                lastUpdate: new Date().toISOString()
            },
            {
                currency: 'USD',
                buy: 1.0,
                sell: 1.0,
                lastUpdate: new Date().toISOString()
            },
            {
                currency: 'EUR',
                buy: 0.92,
                sell: 0.94,
                lastUpdate: new Date().toISOString()
            },
            {
                currency: 'RUB',
                buy: 100,
                sell: 102,
                lastUpdate: new Date().toISOString()
            }
        ];
    }

    async updateRates(newRates) {
        try {
            if (!this.sheet) {
                console.log('Google Sheets не подключен, обновление пропущено');
                return false;
            }

            // Очищаем существующие данные
            await this.sheet.clear();

            // Добавляем заголовки
            await this.sheet.setHeaderRow(['currency', 'buy', 'sell', 'lastUpdate']);

            // Добавляем новые курсы
            const rows = newRates.map(rate => ({
                currency: rate.currency,
                buy: rate.buy,
                sell: rate.sell,
                lastUpdate: new Date().toISOString()
            }));

            await this.sheet.addRows(rows);
            
            console.log('✅ Курсы обновлены в Google Sheets');
            return true;
        } catch (error) {
            console.error('Ошибка обновления курсов в Google Sheets:', error);
            return false;
        }
    }

    async logOrder(orderData) {
        try {
            if (!this.doc) {
                console.log('Google Sheets не подключен, логирование пропущено');
                return false;
            }

            // Находим лист для логов или создаем новый
            let logSheet = this.doc.sheetsByTitle['Orders'];
            if (!logSheet) {
                logSheet = await this.doc.addSheet({ title: 'Orders' });
                await logSheet.setHeaderRow([
                    'ID', 'UserID', 'FromCurrency', 'ToCurrency', 
                    'FromAmount', 'ToAmount', 'ExchangeRate', 'Fee',
                    'AMLStatus', 'Status', 'CreatedAt'
                ]);
            }

            await logSheet.addRow({
                ID: orderData.id,
                UserID: orderData.userId,
                FromCurrency: orderData.fromCurrency,
                ToCurrency: orderData.toCurrency,
                FromAmount: orderData.fromAmount,
                ToAmount: orderData.toAmount,
                ExchangeRate: orderData.exchangeRate,
                Fee: orderData.fee,
                AMLStatus: orderData.amlStatus,
                Status: orderData.status,
                CreatedAt: new Date().toISOString()
            });

            console.log('✅ Заявка записана в Google Sheets');
            return true;
        } catch (error) {
            console.error('Ошибка записи заявки в Google Sheets:', error);
            return false;
        }
    }
}

module.exports = GoogleSheetsService; 