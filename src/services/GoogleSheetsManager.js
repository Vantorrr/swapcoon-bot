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
                headers: ['ID заказа', 'Дата создания', 'Пользователь ID', 'Username', 'От валюты', 'Сумма отправки', 'К валюте', 'Сумма получения', 'Курс обмена', 'Комиссия ($)', 'Статус', 'Оператор ID', 'Оператор', 'Время обработки', 'AML статус', 'Прибыль ($)', 'Приоритет']
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
                headers: ['User ID', 'Username', 'Имя', 'Фамилия', 'Дата регистрации', 'Всего заказов', 'Общая сумма ($)', 'Последний заказ', 'Статус', 'Реферал от', 'Привел рефералов']
            },
            {
                title: 'AML_Monitoring',
                headers: ['Дата', 'User ID', 'Заказ ID', 'Сумма операции', 'Валюта', 'AML статус', 'Риск-скор', 'Блокчейн анализ', 'Действие', 'Примечания']
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
                user.referrals_count || 0
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
        return this.isConnected && this.spreadsheetId;
    }
}

module.exports = GoogleSheetsManager; 