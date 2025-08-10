const { google } = require('googleapis');

class GoogleSheetsManager {
    constructor() {
        this.sheets = null;
        this.spreadsheetId = null;
        this.auth = null;
        this.isConnected = false;
    }

    // Инициализация подключения к Google Sheets API
    async init(credentials, spreadsheetId) {
        try {
            console.log('🔧 Инициализация Google Sheets API...');
            
            this.auth = new google.auth.GoogleAuth({
                credentials: credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            this.spreadsheetId = spreadsheetId;
            this.isConnected = true;

            console.log('✅ Google Sheets API подключен');
            return true;
        } catch (error) {
            console.error('❌ Ошибка подключения к Google Sheets:', error.message);
            this.isConnected = false;
            return false;
        }
    }

    // Создание всех необходимых листов
    async createWorksheets() {
        if (!this.isConnected) {
            throw new Error('Google Sheets API не подключен');
        }

        const worksheets = [
            {
                title: 'Orders',
                headers: ['ID заказа', 'Дата создания', 'Пользователь ID', 'Username', 'От валюты', 'Сумма отправки', 'К валюте', 'Сумма получения', 'Курс обмена', 'Комиссия ($)', 'Статус', 'Оператор ID', 'Оператор', 'Время обработки', 'AML статус', 'Прибыль ($)', 'Приоритет', 'Реф. комиссия ($)']
            },
            {
                title: 'Staff',
                headers: ['ID оператора', 'Имя', 'Username', 'Роль', 'Заказов обработано', 'Общая сумма ($)', 'Средняя комиссия ($)', 'Активен с', 'Последняя активность', 'Статус']
            },
            {
                title: 'Daily_Stats',
                headers: ['Дата', 'Всего заказов', 'Завершено', 'Отменено', 'В обработке', 'Общий оборот ($)', 'Прибыль ($)', 'Новых клиентов', 'Активных операторов', 'Ср. время обработки (мин)']
            },
            {
                title: 'Users',
                headers: ['User ID', 'Username', 'Имя', 'Фамилия', 'Дата регистрации', 'Всего заказов', 'Общая сумма ($)', 'Последний заказ', 'Статус', 'Реферал от', 'Привел рефералов', 'Заработано на рефералах ($)']
            },
            {
                title: 'Manual_Rates',
                headers: ['Пара валют', 'Курс продажи', 'Курс покупки', 'Спред (%)', 'Последнее обновление', 'Статус', 'Источник', 'Комментарий']
            }
        ];

        try {
            for (const worksheet of worksheets) {
                await this.createWorksheet(worksheet.title, worksheet.headers);
            }
            console.log('✅ Все листы созданы');
            return true;
        } catch (error) {
            console.error('❌ Ошибка создания листов:', error.message);
            return false;
        }
    }

    // Создание отдельного листа
    async createWorksheet(title, headers) {
        try {
            // Добавляем новый лист
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: title,
                                gridProperties: {
                                    rowCount: 1000,
                                    columnCount: headers.length
                                }
                            }
                        }
                    }]
                }
            });

            // Добавляем заголовки
            await this.updateSheet(title, [headers], 'A1');

            // Форматируем заголовки
            await this.formatHeaders(title, headers.length);

            console.log(`✅ Лист "${title}" создан`);
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log(`ℹ️ Лист "${title}" уже существует`);
                // Обновляем заголовки
                await this.updateSheet(title, [headers], 'A1');
                await this.formatHeaders(title, headers.length);
            } else {
                throw error;
            }
        }
    }

    // Форматирование заголовков
    async formatHeaders(sheetTitle, columnCount) {
        try {
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        repeatCell: {
                            range: {
                                sheetId: await this.getSheetId(sheetTitle),
                                startRowIndex: 0,
                                endRowIndex: 1,
                                startColumnIndex: 0,
                                endColumnIndex: columnCount
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 0.2, green: 0.6, blue: 1.0 },
                                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                                }
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat)'
                        }
                    }]
                }
            });
        } catch (error) {
            console.error(`Ошибка форматирования заголовков для листа ${sheetTitle}:`, error.message);
        }
    }

    // Получение ID листа по названию
    async getSheetId(sheetTitle) {
        const response = await this.sheets.spreadsheets.get({
            spreadsheetId: this.spreadsheetId
        });
        
        const sheet = response.data.sheets.find(s => s.properties.title === sheetTitle);
        return sheet ? sheet.properties.sheetId : null;
    }

    // Обновление данных на листе
    async updateSheet(sheetTitle, data, range = 'A2') {
        if (!this.isConnected) {
            throw new Error('Google Sheets API не подключен');
        }

        try {
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetTitle}!${range}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: data
                }
            });
            return true;
        } catch (error) {
            console.error(`Ошибка обновления листа ${sheetTitle}:`, error.message);
            return false;
        }
    }

    // Очистка листа (кроме заголовков)
    async clearSheet(sheetTitle) {
        try {
            await this.sheets.spreadsheets.values.clear({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetTitle}!A2:Z1000`
            });
            return true;
        } catch (error) {
            console.error(`Ошибка очистки листа ${sheetTitle}:`, error.message);
            return false;
        }
    }

    // Добавление данных в конец листа
    async appendSheet(sheetTitle, data) {
        if (!this.isConnected) {
            throw new Error('Google Sheets API не подключен');
        }

        try {
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetTitle}!A:A`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: data
                }
            });
            return true;
        } catch (error) {
            console.error(`Ошибка добавления данных в лист ${sheetTitle}:`, error.message);
            return false;
        }
    }

    // ПРОСТОЕ логирование заказа - без создания листов, прямо в существующий
    async logOrder(orderData) {
        console.log('📊 ЛОГИРОВАНИЕ ЗАКАЗА В GOOGLE SHEETS (вставка вверху)...');
        
        if (!this.isConnected) {
            console.log('❌ Google Sheets не подключен');
            return false;
        }

        try {
            // Подготовка строки
            const commission = orderData.referralCommission || 0;
            const rowData = [
                orderData.id || 'unknown',
                new Date().toLocaleString('ru'),
                orderData.user_id || orderData.userId || 'unknown',
                orderData.userName || 'User',
                orderData.from_currency || orderData.fromCurrency || '',
                orderData.from_amount || orderData.fromAmount || 0,
                orderData.to_currency || orderData.toCurrency || '',
                orderData.to_amount || orderData.toAmount || 0,
                orderData.exchange_rate || orderData.exchangeRate || (orderData.fromAmount && orderData.toAmount ? (orderData.toAmount / orderData.fromAmount) : 0),
                orderData.fee || 0,
                orderData.status || 'pending',
                '', // operator
                '', // operator name
                0,  // processing time
                '', // aml
                0,  // profit
                '',  // priority (removed)
                commission // Referral commission USD
            ];

            // 1) Вставляем пустую строку на позицию 2 (после заголовков), чтобы новые заказы были сверху
            const sheetId = await this.getSheetId('Orders');
            if (sheetId) {
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    resource: {
                        requests: [
                            {
                                insertDimension: {
                                    range: {
                                        sheetId: sheetId,
                                        dimension: 'ROWS',
                                        startIndex: 1,
                                        endIndex: 2
                                    },
                                    inheritFromBefore: false
                                }
                            }
                        ]
                    }
                });
            }

            // 2) Записываем значения в только что вставленную строку A2:Q2
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: 'Orders!A2:R2',
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [rowData]
                }
            });

            console.log(`✅ ЗАКАЗ #${orderData.id} записан вверху листа Orders`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка вставки вверху:', error.message);
            console.error('   Stack:', error.stack);
            // Fallback: обычный append в конец, чтобы не потерять запись
            try {
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Orders!A:Q',
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    resource: { values: [
                        [
                            orderData.id || 'unknown',
                            new Date().toLocaleString('ru'),
                            orderData.user_id || orderData.userId || 'unknown',
                            orderData.userName || 'User',
                            orderData.from_currency || orderData.fromCurrency || '',
                            orderData.from_amount || orderData.fromAmount || 0,
                            orderData.to_currency || orderData.toCurrency || '',
                            orderData.to_amount || orderData.toAmount || 0,
                            orderData.exchange_rate || orderData.exchangeRate || 0,
                            orderData.fee || 0,
                            orderData.status || 'pending',
                            '', '', 0, '', 0, '',
                            commission
                        ]
                    ] }
                });
                console.log(`ℹ️ Fallback: заказ #${orderData.id} добавлен в конец листа`);
                return true;
            } catch (appendError) {
                console.error('💥 Ошибка fallback append:', appendError.message);
                return false;
            }
        }
    }

    // Экспорт данных заказов
    async exportOrders(db) {
        console.log('📊 Экспорт данных заказов...');
        
        try {
            const orders = await db.getAllOrdersForExport();
            const data = orders.map(order => [
                order.id,
                new Date(order.created_at).toLocaleString('ru'),
                order.user_id,
                order.username || '',
                order.from_currency,
                parseFloat(order.from_amount),
                order.to_currency,
                parseFloat(order.to_amount || 0),
                parseFloat(order.exchange_rate || 0),
                parseFloat(order.commission || 0),
                order.status,
                order.operator_id || '',
                order.operator_name || '',
                0, // время обработки
                order.aml_status || 'unknown',
                parseFloat(order.profit || 0),
                this.getPriorityFromAmount(order.from_amount)
            ]);

            await this.clearSheet('Orders');
            await this.updateSheet('Orders', data);
            console.log(`✅ Экспортировано ${data.length} заказов`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка экспорта заказов:', error.message);
            return false;
        }
    }

    // Экспорт данных операторов
    async exportStaff(db) {
        console.log('👥 Экспорт данных операторов...');
        
        try {
            const staff = await db.getStaffForExport();
            const data = staff.map(member => [
                member.telegram_id,
                member.first_name || '',
                member.username || '',
                member.role,
                member.orders_handled || 0,
                parseFloat(member.total_amount || 0),
                parseFloat(member.avg_commission || 0),
                new Date(member.created_at).toLocaleDateString('ru'),
                member.last_activity ? new Date(member.last_activity).toLocaleString('ru') : '',
                member.is_active ? 'Активен' : 'Неактивен'
            ]);

            await this.clearSheet('Staff');
            await this.updateSheet('Staff', data);
            console.log(`✅ Экспортировано ${data.length} операторов`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка экспорта операторов:', error.message);
            return false;
        }
    }

    // Экспорт дневной статистики
    async exportDailyStats(db) {
        console.log('📈 Экспорт дневной статистики...');
        
        try {
            const stats = await db.getDailyStatsForExport();
            const data = stats.map(stat => [
                stat.date,
                stat.total_orders || 0,
                stat.completed_orders || 0,
                stat.cancelled_orders || 0,
                stat.processing_orders || 0,
                parseFloat(stat.total_volume || 0),
                parseFloat(stat.total_profit || 0),
                stat.new_users || 0,
                stat.active_operators || 0,
                parseFloat(stat.avg_processing_time || 0)
            ]);

            await this.clearSheet('Daily_Stats');
            await this.updateSheet('Daily_Stats', data);
            console.log(`✅ Экспортировано ${data.length} дней статистики`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка экспорта статистики:', error.message);
            return false;
        }
    }

    // Экспорт данных пользователей
    async exportUsers(db) {
        console.log('👤 Экспорт данных пользователей...');
        
        try {
            const users = await db.getUsersForExport();
            const data = users.map(user => [
                user.telegram_id,
                user.username || '',
                user.first_name || '',
                user.last_name || '',
                new Date(user.created_at).toLocaleDateString('ru'),
                user.total_orders || 0,
                parseFloat(user.total_amount || 0),
                user.last_order_date ? new Date(user.last_order_date).toLocaleDateString('ru') : '',
                user.is_active ? 'Активен' : 'Неактивен',
                user.referred_by || '',
                user.referrals_count || 0,
                parseFloat(user.total_commission || 0)
            ]);

            await this.clearSheet('Users');
            await this.updateSheet('Users', data);
            console.log(`✅ Экспортировано ${data.length} пользователей`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка экспорта пользователей:', error.message);
            return false;
        }
    }

    // Экспорт AML мониторинга
    async exportAMLMonitoring(db) {
        console.log('🛡️ Экспорт AML мониторинга...');
        
        try {
            const amlData = await db.getAMLDataForExport();
            const data = amlData.map(record => [
                new Date(record.created_at).toLocaleString('ru'),
                record.user_id,
                record.order_id,
                parseFloat(record.amount),
                record.currency,
                record.aml_status || 'unknown',
                parseFloat(record.risk_score || 0),
                record.blockchain_analysis || '',
                record.action_taken || '',
                record.notes || ''
            ]);

            await this.clearSheet('AML_Monitoring');
            await this.updateSheet('AML_Monitoring', data);
            console.log(`✅ Экспортировано ${data.length} AML записей`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка экспорта AML данных:', error.message);
            return false;
        }
    }

    // Полный экспорт всех данных
    async exportAll(db) {
        console.log('🚀 Начинаю полный экспорт данных...');
        
        const results = [];
        
        try {
            results.push(await this.exportOrders(db));
            results.push(await this.exportStaff(db));
            results.push(await this.exportDailyStats(db));
            results.push(await this.exportUsers(db));
            results.push(await this.exportAMLMonitoring(db));
            
            const successCount = results.filter(r => r).length;
            console.log(`✅ Экспорт завершен: ${successCount}/5 листов обновлено`);
            
            return successCount === 5;
        } catch (error) {
            console.error('❌ Ошибка полного экспорта:', error.message);
            return false;
        }
    }

    // Вспомогательные функции
    calculateProcessingTime(createdAt, updatedAt) {
        if (!updatedAt) return 0;
        const created = new Date(createdAt);
        const updated = new Date(updatedAt);
        return Math.round((updated - created) / (1000 * 60)); // в минутах
    }

    getPriorityFromAmount(amount) {
        const amountNum = parseFloat(amount);
        if (amountNum >= 10000) return '🔥 ВЫСОКИЙ';
        if (amountNum >= 1000) return '🟡 СРЕДНИЙ';
        return '🟢 НИЗКИЙ';
    }

    // Получение ссылки на таблицу
    getSpreadsheetUrl() {
        return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`;
    }

    // Проверка статуса подключения
    isReady() {
        return Boolean(this.isConnected && this.spreadsheetId);
    }

    // 💱 МЕТОДЫ ДЛЯ РАБОТЫ С КУРСАМИ

    // Инициализация таблицы курсов с всеми валютными парами
    async initializeRatesTable() {
        if (!this.isConnected) return false;
        
        try {
            // Определяем все валютные пары
            const currencyPairs = [
                // Крипто к USD
                { pair: 'BTC/USD', status: 'API' },
                { pair: 'ETH/USD', status: 'API' },
                { pair: 'USDT/USD', status: 'API' },
                { pair: 'USDC/USD', status: 'API' },
                
                // Фиат валюты к USD
                { pair: 'USD/RUB', status: 'API' },
                { pair: 'USD/EUR', status: 'API' },
                { pair: 'USD/ARS', status: 'API' },
                { pair: 'USD/BRL', status: 'API' },
                { pair: 'USD/UAH', status: 'API' },
                { pair: 'USD/KZT', status: 'API' },
                
                // Крипто к фиат (популярные пары)
                { pair: 'BTC/RUB', status: 'API' },
                { pair: 'ETH/RUB', status: 'API' },
                { pair: 'USDT/RUB', status: 'API' },
                { pair: 'BTC/ARS', status: 'API' },
                { pair: 'USDT/ARS', status: 'API' }
            ];

            const rows = currencyPairs.map(pair => [
                pair.pair,
                '', // Курс продажи - будет заполнен автоматически
                '', // Курс покупки - будет заполнен автоматически
                '', // Спред - будет рассчитан автоматически
                new Date().toLocaleString('ru'),
                pair.status,
                'MANUAL', 
                'Ручные курсы (AUTO отключено)'
            ]);

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: 'Manual_Rates!A2:H' + (rows.length + 1),
                valueInputOption: 'USER_ENTERED',
                resource: { values: rows }
            });

            console.log('✅ Таблица курсов инициализирована с', rows.length, 'валютными парами');
            return true;
        } catch (error) {
            console.error('❌ Ошибка инициализации таблицы курсов:', error.message);
            return false;
        }
    }

    // Чтение ручных курсов из таблицы
    async readManualRatesFromTable() {
        if (!this.isConnected) return [];
        
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Manual_Rates!A2:H1000' // Читаем все данные
            });

            const rows = response.data.values || [];
            const manualRates = [];

            for (const row of rows) {
                if (row.length >= 6 && row[0]) { // Проверяем что есть пара валют
                    const [pair, sellRate, buyRate, spread, lastUpdated, status, source, comment] = row;
                    
                    const sellPrice = parseFloat(sellRate);
                    const buyPrice = parseFloat(buyRate);
                    
                    // Проверяем что это ручной курс с валидными числами
                    if (status === 'MANUAL' && !isNaN(sellPrice) && !isNaN(buyPrice) && sellPrice > 0 && buyPrice > 0) {
                        // 🔥 АВТОМАТИЧЕСКОЕ ПЕРЕВОРАЧИВАНИЕ ПАР ДЛЯ КРИПТО-ВАЛЮТ
                        let finalPair = pair;
                        let finalSellRate = sellPrice;
                        let finalBuyRate = buyPrice;
                        
                        // Список крипто-валют которые должны быть ПЕРВЫМИ в парах
                        const cryptoFirst = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'ADA', 'DOT', 'LINK', 'LTC', 'XRP', 'SOL', 'MATIC', 'AVAX', 'BCH'];
                        
                        // Разбираем пару на валюты
                        const [fromCurrency, toCurrency] = pair.split('/');
                        
                        // Если первая валюта НЕ крипто, а вторая крипто - переворачиваем пару
                        if (!cryptoFirst.includes(fromCurrency) && cryptoFirst.includes(toCurrency)) {
                            finalPair = `${toCurrency}/${fromCurrency}`;
                            finalSellRate = 1 / buyPrice; // Инвертируем курсы
                            finalBuyRate = 1 / sellPrice;
                            console.log(`🔄 ПЕРЕВЕРНУЛИ ПАРУ: ${pair} → ${finalPair} (курсы инвертированы)`);
                        }
                        
                        manualRates.push({
                            pair: finalPair,
                            sellRate: finalSellRate,
                            buyRate: finalBuyRate,
                            spread: parseFloat(spread) || 0,
                            lastUpdated: lastUpdated,
                            status: status,
                            source: source || 'MANUAL',
                            comment: comment || ''
                        });
                    }
                }
            }

            console.log(`📊 Прочитано ${manualRates.length} ручных курсов из таблицы`);
            return manualRates;
        } catch (error) {
            console.error('❌ Ошибка чтения курсов из таблицы:', error.message);
            return [];
        }
    }

    // Обновление всех курсов в таблице (синхронизация с API)
    async syncCurrentRatesToTable(currentRates) {
        if (!this.isConnected || !currentRates) return false;
        
        try {
            // Читаем текущие ручные курсы
            const manualRates = await this.readManualRatesFromTable();
            const manualPairs = new Set(manualRates.map(r => r.pair));

            const updatePromises = [];

            for (const rate of currentRates) {
                // Создаем основную пару валют к USD
                const mainPair = `${rate.currency}/USD`;
                
                // Если это не ручной курс, обновляем автоматически
                if (!manualPairs.has(mainPair)) {
                    updatePromises.push(
                        this.updateRateInTable(mainPair, rate.sell, rate.buy, 'MANUAL', 'Ручные курсы (AUTO отключено)')
                    );
                }
            }

            await Promise.allSettled(updatePromises);
            console.log('✅ Синхронизированы автоматические курсы в таблицу');
            return true;
        } catch (error) {
            console.error('❌ Ошибка синхронизации курсов:', error.message);
            return false;
        }
    }

    // Обновление курса в таблице
    async updateRateInTable(pair, sellRate, buyRate, status = 'MANUAL', comment = '') {
        if (!this.isConnected) return false;
        
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Manual_Rates!A2:H1000'
            });

            const rows = response.data.values || [];
            let rowIndex = -1;

            for (let i = 0; i < rows.length; i++) {
                if (rows[i][0] === pair) {
                    rowIndex = i + 2; // +2 потому что начинаем с A2
                    break;
                }
            }

            if (rowIndex === -1) {
                // Если пары нет, добавляем новую строку
                rowIndex = rows.length + 2;
            }

            const spread = sellRate > 0 ? ((sellRate - buyRate) / sellRate * 100).toFixed(2) : '0';
            const source = "MANUAL"; // 🔥 Всегда MANUAL!
            
            const updateData = [
                pair,
                sellRate,
                buyRate,
                spread,
                new Date().toLocaleString('ru'),
                status,
                source,
                comment
            ];

            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `Manual_Rates!A${rowIndex}:H${rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [updateData] }
            });

            if (status === 'MANUAL') {
                console.log(`✅ Ручной курс ${pair}: продажа ${sellRate}, покупка ${buyRate}`);
            }
            return true;
        } catch (error) {
            console.error('❌ Ошибка обновления курса в таблице:', error.message);
            return false;
        }
    }
}

module.exports = GoogleSheetsManager; 