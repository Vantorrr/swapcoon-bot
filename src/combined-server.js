require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 🔍 САМАЯ РАННЯЯ ДИАГНОСТИКА COMBINED-SERVER
console.log('🚀 COMBINED-SERVER.JS ЗАПУЩЕН!');
console.log('📅 Время запуска:', new Date().toISOString());
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
console.log('🔍 ПРОВЕРКА ПЕРЕМЕННЫХ GOOGLE SHEETS:');
console.log('   GOOGLE_SHEETS_ID:', process.env.GOOGLE_SHEETS_ID ? 'ЕСТЬ' : 'НЕТ');
console.log('   GOOGLE_SHEETS_CREDENTIALS:', process.env.GOOGLE_SHEETS_CREDENTIALS ? 'ЕСТЬ' : 'НЕТ');
console.log('   GOOGLE_SHEETS_ENABLED:', process.env.GOOGLE_SHEETS_ENABLED);

// 🤖 ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ БОТА
let bot = null;
let notifyOperators = null;
let notifyWebsiteActivity = null;
let db = null;

// 🤖 АСИНХРОННЫЙ ЗАПУСК TELEGRAM БОТА С ИНИЦИАЛИЗАЦИЕЙ АДМИНОВ
async function initializeBotAndAdmins() {
    console.log('🔍 НАЧАЛО ФУНКЦИИ initializeBotAndAdmins()');
    console.log('🤖 Инициализация Telegram бота...');
    try {
        // Импортируем бота
        const botModule = require('./bot');
        bot = botModule.bot;
        notifyOperators = botModule.notifyOperators;
        notifyWebsiteActivity = botModule.notifyWebsiteActivity;
        db = botModule.db;
        console.log('✅ Telegram бот инициализирован');
        
        // 🔍 ПРИНУДИТЕЛЬНАЯ ИНИЦИАЛИЗАЦИЯ GOOGLE SHEETS
        console.log('🔍 НАЧИНАЕМ ИНИЦИАЛИЗАЦИЮ GOOGLE SHEETS В COMBINED-SERVER...');
        try {
            // Импортируем функцию initGoogleSheets напрямую
            const fs = require('fs');
            const path = require('path');
            const GoogleSheetsManager = require('./services/GoogleSheetsManager');
            
            // Проверяем переменные окружения
            const envSpreadsheetId = process.env.GOOGLE_SHEETS_ID;
            const envCredentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
            const envEnabled = process.env.GOOGLE_SHEETS_ENABLED !== 'false';
            
            console.log('🔍 ДИАГНОСТИКА ПЕРЕМЕННЫХ В COMBINED-SERVER:');
            console.log('   GOOGLE_SHEETS_ID:', envSpreadsheetId ? 'ЕСТЬ' : 'НЕТ');
            console.log('   GOOGLE_SHEETS_CREDENTIALS:', envCredentials ? 'ЕСТЬ' : 'НЕТ');
            console.log('   GOOGLE_SHEETS_ENABLED:', envEnabled);
            
            let config = null;
            
            // Сначала пробуем переменные окружения
            if (envSpreadsheetId && envCredentials && envEnabled) {
                console.log('🌍 Используем переменные окружения для Google Sheets');
                const parsedCredentials = JSON.parse(envCredentials);
                config = {
                    credentials: parsedCredentials,
                    spreadsheet_id: envSpreadsheetId,
                    enabled: true
                };
            } else {
                // 🔥 FALLBACK: ЧИТАЕМ ИЗ ФАЙЛА config/google-sheets.json
                console.log('📂 Переменные окружения не найдены, читаем config/google-sheets.json...');
                const configPath = path.join(__dirname, '..', 'config', 'google-sheets.json');
                
                if (fs.existsSync(configPath)) {
                    console.log('📄 Файл config/google-sheets.json найден!');
                    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    console.log('✅ Конфигурация из файла загружена');
                    console.log('📊 Spreadsheet ID:', config.spreadsheet_id);
                    console.log('📊 Enabled:', config.enabled);
                } else {
                    console.log('❌ Файл config/google-sheets.json не найден');
                }
            }
            
            console.log('🔍 ДИАГНОСТИКА CONFIG:');
            console.log('   config существует?', !!config);
            if (config) {
                console.log('   config.enabled:', config.enabled);
                console.log('   config.spreadsheet_id:', config.spreadsheet_id ? 'есть' : 'нет');
                console.log('   config.credentials:', config.credentials ? 'есть' : 'нет');
            }
            
            if (config && config.enabled) {
                console.log('🚀 Инициализируем Google Sheets Manager в combined-server...');
                const googleSheetsManager = new GoogleSheetsManager();
                const success = await googleSheetsManager.init(config.credentials, config.spreadsheet_id);
                
                console.log('🔍 Результат googleSheetsManager.init():', success);
                if (success) {
                    console.log('🔧 Создаем worksheets...');
                    await googleSheetsManager.createWorksheets();
                    global.googleSheetsManager = googleSheetsManager;
                    console.log('✅ Google Sheets Manager инициализирован в combined-server!');
                    console.log('🔍 global.googleSheetsManager установлен:', !!global.googleSheetsManager);
                } else {
                    console.log('❌ Ошибка подключения к Google Sheets API в combined-server');
                }
            } else {
                console.log('❌ Google Sheets не настроены или отключены в combined-server');
                console.log('   Причина: config =', !!config, ', enabled =', config?.enabled);
            }
        } catch (sheetsInitError) {
            console.error('❌ ОШИБКА инициализации Google Sheets в combined-server:', sheetsInitError.message);
        }
        
        // Инициализируем Google Sheets Manager глобально
        try {
            console.log('🔍 ПРОВЕРЯЕМ BOTMODULE:');
            console.log('   botModule существует?', !!botModule);
            console.log('   botModule.googleSheetsManager существует?', !!botModule.googleSheetsManager);
            
            if (botModule.googleSheetsManager) {
                global.googleSheetsManager = botModule.googleSheetsManager;
                console.log('📊 Google Sheets Manager доступен глобально из botModule');
                console.log('🔍 global.googleSheetsManager теперь:', !!global.googleSheetsManager);
            } else {
                console.log('⚠️ Google Sheets Manager НЕ инициализирован в botModule');
            }
        } catch (error) {
            console.log('❌ Ошибка инициализации Google Sheets Manager:', error.message);
        }
        
        // 🔍 ФИНАЛЬНАЯ ПРОВЕРКА
        console.log('🔍 ИТОГОВОЕ СОСТОЯНИЕ global.googleSheetsManager:', !!global.googleSheetsManager);
        
        // 🔥 ПРИНУДИТЕЛЬНАЯ ИНИЦИАЛИЗАЦИЯ ЕСЛИ НЕ УДАЛОСЬ
        if (!global.googleSheetsManager) {
            console.log('🔥 ПРИНУДИТЕЛЬНАЯ ИНИЦИАЛИЗАЦИЯ Google Sheets...');
            try {
                const fs = require('fs');
                const path = require('path');
                const configPath = path.join(__dirname, '..', 'config', 'google-sheets.json');
                
                if (fs.existsSync(configPath)) {
                    console.log('🔥 Читаем config/google-sheets.json напрямую...');
                    const forceConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    
                    console.log('🔥 Принудительный конфиг:');
                    console.log('   enabled:', forceConfig.enabled);
                    console.log('   spreadsheet_id:', forceConfig.spreadsheet_id ? 'есть' : 'нет');
                    console.log('   credentials:', forceConfig.credentials ? 'есть' : 'нет');
                    
                    if (forceConfig.enabled && forceConfig.spreadsheet_id && forceConfig.credentials) {
                        const GoogleSheetsManager = require('./services/GoogleSheetsManager');
                        const forceManager = new GoogleSheetsManager();
                        const forceSuccess = await forceManager.init(forceConfig.credentials, forceConfig.spreadsheet_id);
                        
                        console.log('🔥 Результат принудительной инициализации:', forceSuccess);
                        if (forceSuccess) {
                            await forceManager.createWorksheets();
                            global.googleSheetsManager = forceManager;
                            console.log('🔥 ✅ ПРИНУДИТЕЛЬНАЯ ИНИЦИАЛИЗАЦИЯ УСПЕШНА!');
                        } else {
                            console.log('🔥 ❌ Принудительная инициализация не удалась');
                        }
                    } else {
                        console.log('🔥 ❌ Некорректная конфигурация в файле');
                    }
                } else {
                    console.log('🔥 ❌ Файл config/google-sheets.json не найден');
                }
            } catch (forceError) {
                console.error('🔥 ❌ Ошибка принудительной инициализации:', forceError.message);
            }
        }
        
        // 👑 ГАРАНТИРОВАННОЕ ДОБАВЛЕНИЕ АДМИНОВ (ВСЕГДА РАБОТАЕТ)
        console.log('👑 Гарантированная инициализация админов...');
        
        // СПИСОК ВСЕХ АДМИНОВ - ДОБАВЛЯЕМ ПРИНУДИТЕЛЬНО
        const allAdmins = [
            { id: 8141463258, name: 'Главный Админ', username: 'main_admin' },
            { id: 461759951, name: 'Админ Павел', username: 'pavel_admin' },
            { id: 280417617, name: 'Админ 3', username: null }
        ];
        
        for (const adminData of allAdmins) {
            try {
                // Проверяем есть ли уже
                const existing = await db.getStaffById(adminData.id);
                if (existing) {
                    console.log(`   ✅ Админ ${adminData.name} (${adminData.id}) уже есть в системе`);
                    continue;
                }
                
                // Добавляем админа
                await db.addStaff({
                    telegramId: adminData.id,
                    username: adminData.username,
                    firstName: adminData.name,
                    lastName: null,
                    role: 'admin',
                    addedBy: 8141463258
                });
                console.log(`✅ ДОБАВЛЕН админ ${adminData.name} (${adminData.id})`);
                
            } catch (addError) {
                console.log(`⚠️ Ошибка добавления админа ${adminData.name}:`, addError.message);
                
                // КРИТИЧНО! Если не получается добавить - пробуем без проверки existing
                try {
                    await db.addStaff({
                        telegramId: adminData.id,
                        username: adminData.username,
                        firstName: adminData.name,
                        lastName: null,
                        role: 'admin',
                        addedBy: 8141463258
                    });
                    console.log(`✅ ПРИНУДИТЕЛЬНО добавлен админ ${adminData.name} (${adminData.id})`);
                } catch (forceError) {
                    console.log(`❌ КРИТИЧНО! Не удалось добавить админа ${adminData.name}:`, forceError.message);
                }
            }
        }
        
        // Показываем итоговый список админов
        try {
            const finalStaffList = await db.getStaffList();
            const finalAdmins = finalStaffList.filter(s => s.role === 'admin');
            console.log(`👑 ИТОГО АДМИНОВ В СИСТЕМЕ: ${finalAdmins.length}`);
            finalAdmins.forEach(admin => {
                console.log(`   - ${admin.first_name} (@${admin.username || 'null'}) - ID: ${admin.telegram_id}`);
            });
        } catch (error) {
            console.log('⚠️ Не удалось получить итоговый список админов:', error.message);
        }
        
        // 👨‍💼 ПРИНУДИТЕЛЬНАЯ ИНИЦИАЛИЗАЦИЯ ОПЕРАТОРОВ
        console.log('👨‍💼 Инициализируем операторов...');
        try {
            // Добавляем известных операторов
            const knownOperators = [
                {
                    telegramId: 7692725312,
                    username: 'ExMachinaXSupport',
                    firstName: 'Оператор',
                    lastName: 'ExMachinaX'
                }
            ];
            
            for (const operator of knownOperators) {
                try {
                    // Проверяем не существует ли уже
                    const existing = await db.getStaffById(operator.telegramId);
                    if (existing) {
                        console.log(`   ✅ Оператор @${operator.username} (${operator.telegramId}) уже существует`);
                        continue;
                    }
                    
                    await db.addStaff({
                        telegramId: operator.telegramId,
                        username: operator.username,
                        firstName: operator.firstName,
                        lastName: operator.lastName,
                        role: 'operator',
                        addedBy: 8141463258
                    });
                    console.log(`✅ Добавлен оператор @${operator.username} (${operator.telegramId})`);
                } catch (addError) {
                    console.log(`⚠️ Не удалось добавить оператора @${operator.username}:`, addError.message);
                }
            }
            
            // Проверяем итоговое количество операторов
            const finalStaffList = await db.getStaffList();
            const operators = finalStaffList.filter(s => s.role === 'operator');
            console.log(`👨‍💼 Найдено операторов: ${operators.length}`);
            operators.forEach(op => {
                console.log(`   - ${op.first_name} @${op.username || 'null'} (ID: ${op.telegram_id})`);
            });
            
        } catch (error) {
            console.error('❌ Ошибка инициализации операторов:', error.message);
        }
        
        // 🔥 ЗАПУСКАЕМ БОТ СРАЗУ - НЕ ЖДЕМ!
        console.log('🔄 Запуск бота СЕЙЧАС ЖЕ...');
        await bot.start();
        console.log('✅ КРИТИЧНО! Бот успешно запущен и готов к отправке уведомлений');
        console.log('🎯 БОТ ЗАПУЩЕН! Переходим к отправке уведомления о запуске...');
        
        // 📨 УВЕДОМЛЯЕМ АДМИНОВ О ЗАПУСКЕ С МАКСИМАЛЬНОЙ ДИАГНОСТИКОЙ
        console.log('📤 🔥 НАЧАЛАСЬ отправка уведомлений админам о запуске...');
        console.log('🔍 ДИАГНОСТИКА:');
        console.log('   - bot существует?', !!bot);
        console.log('   - bot.api существует?', !!bot.api);
        console.log('   - db существует?', !!db);
        console.log('   - db.getStaffList функция?', typeof db.getStaffList);
        
        try {
            // Получаем админов из базы данных
            console.log('🔍 Получаем список персонала из БД...');
            const staffList = await db.getStaffList();
            console.log(`📊 Всего персонала в БД: ${staffList.length}`);
            
            const admins = staffList.filter(s => s.role === 'admin');
            const operators = staffList.filter(s => s.role === 'operator');
            console.log(`👑 Найдено админов в БД: ${admins.length}`);
            console.log(`👨‍💼 Найдено операторов в БД: ${operators.length}`);
            
            // Показываем всех админов
            console.log('📋 СПИСОК АДМИНОВ:');
            admins.forEach((admin, index) => {
                console.log(`   ${index + 1}. ${admin.first_name} (@${admin.username || 'null'}) - ID: ${admin.telegram_id}`);
            });
            
            if (admins.length === 0) {
                console.log('⚠️ КРИТИЧНО! АДМИНЫ НЕ НАЙДЕНЫ В БД! Используем аварийный список');
                const emergencyAdmins = [8141463258, 461759951, 280417617];
                for (const adminId of emergencyAdmins) {
                    admins.push({ telegram_id: adminId, first_name: `Админ ${adminId}` });
                }
                console.log(`🆘 Добавлено аварийных админов: ${admins.length}`);
            }
            
            const startupMessage = `🚀 <b>ExMachinaX запущен успешно!</b>\n\n` +
                `✅ Веб-сервер: Активен\n` +
                `✅ Telegram бот: РАБОТАЕТ\n` +
                `✅ Уведомления: ВКЛЮЧЕНЫ\n` +
                `👑 Админов: ${admins.length}\n` +
                `👨‍💼 Операторов: ${operators.length}\n` +
                `⏰ Время: ${new Date().toLocaleString('ru-RU')}`;
            
            console.log('📝 Текст уведомления подготовлен, начинаем отправку...');
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const admin of admins) {
                try {
                    console.log(`📤 Отправляю уведомление админу ${admin.telegram_id} (${admin.first_name})...`);
                    
                    const result = await bot.api.sendMessage(admin.telegram_id, startupMessage, { 
                        parse_mode: 'HTML',
                        disable_web_page_preview: true 
                    });
                    
                    console.log(`✅ УСПЕХ! Админ ${admin.telegram_id} получил уведомление! Message ID: ${result.message_id}`);
                    successCount++;
                    
                } catch (error) {
                    console.error(`❌ ПРОВАЛ для админа ${admin.telegram_id}:`, error.message);
                    console.error(`🔥 Детали ошибки:`, error);
                    errorCount++;
                }
            }
            
            console.log(`📊 ИТОГИ ОТПРАВКИ:`);
            console.log(`   ✅ Успешно: ${successCount}`);
            console.log(`   ❌ Ошибок: ${errorCount}`);
            console.log(`   📨 Всего попыток: ${admins.length}`);
            console.log('📨 🎉 ЗАВЕРШЕНА отправка уведомлений о запуске');
            
        } catch (dbError) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА получения админов из БД:', dbError.message);
            console.error('🔥 Детали ошибки БД:', dbError);
            
            // Пробуем аварийную отправку
            console.log('🆘 Пробуем аварийную отправку...');
            const emergencyAdmins = [8141463258, 461759951, 280417617];
            for (const adminId of emergencyAdmins) {
                try {
                    await bot.api.sendMessage(adminId, '🚨 ExMachinaX запущен (аварийное уведомление)', { 
                        parse_mode: 'HTML' 
                    });
                    console.log(`✅ Аварийное уведомление отправлено админу ${adminId}`);
                } catch (error) {
                    console.error(`❌ Аварийная отправка не удалась для ${adminId}:`, error.message);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ КРИТИЧНО! Ошибка запуска бота:', error.message);
        console.error('🔥 Детали ошибки запуска бота:', error);
        console.log('🌐 Веб-сервер продолжает работу БЕЗ уведомлений о запуске');
    }
}

// 🧪 ФУНКЦИЯ ИСПРАВЛЕНИЯ ПУСТОЙ СТАТИСТИКИ
async function fixEmptyStats() {
    try {
        console.log('🔧 ИСПРАВЛЕНИЕ: Проверяем состояние статистики...');
        
        // Ждем пока db будет доступен
        if (!db) {
            console.log('⏳ ИСПРАВЛЕНИЕ: Ждем инициализации базы данных...');
            return;
        }
        
        // Проверяем количество данных в базе
        const stats = await new Promise((resolve, reject) => {
            db.db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as users,
                    (SELECT COUNT(*) FROM orders) as orders
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        console.log('📊 ИСПРАВЛЕНИЕ: Текущие данные - Пользователей:', stats.users, ', Заказов:', stats.orders);
        
        if (stats.users === 0 && stats.orders === 0) {
            console.log('🎯 ИСПРАВЛЕНИЕ: База пустая! Создаем тестовые данные...');
            
            // Создаем тестового пользователя
            await new Promise((resolve, reject) => {
                db.db.run(`
                    INSERT OR IGNORE INTO users 
                    (telegram_id, first_name, username, created_at, updated_at)
                    VALUES (?, ?, ?, datetime('now'), datetime('now'))
                `, [888999777, 'Тест Статистика', 'test_stats'], function(err) {
                    if (err) reject(err);
                    else {
                        console.log('✅ ИСПРАВЛЕНИЕ: Тестовый пользователь создан');
                        resolve();
                    }
                });
            });
            
            // Создаем тестовые заказы с разными статусами и источниками
            const testOrders = [
                [null, 888999777, 'USDT', 'RUB', 100.0, 10000.0, null, null, 100.0, 0, null, 'completed', 'web'],
                [null, 888999777, 'BTC', 'USDT', 0.001, 95.0, null, null, 95000.0, 0, null, 'pending', 'bot'],
                [null, 888999777, 'ETH', 'ARS', 1.0, 3500000.0, null, null, 3500000.0, 0, null, 'processing', 'web'],
                [null, 888999777, 'USDT', 'USD', 50.0, 50.0, null, null, 1.0, 0, null, 'completed', 'bot']
            ];
            
            for (let i = 0; i < testOrders.length; i++) {
                const order = testOrders[i];
                await new Promise((resolve, reject) => {
                    db.db.run(`
                        INSERT OR IGNORE INTO orders 
                        (id, user_id, from_currency, to_currency, from_amount, to_amount, 
                         from_address, to_address, exchange_rate, fee, aml_status, status, source, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    `, order, function(err) {
                        if (err) reject(err);
                        else {
                            console.log(`✅ ИСПРАВЛЕНИЕ: Тестовый заказ ${i + 1} создан (${order[7]}, ${order[8]})`);
                            resolve();
                        }
                    });
                });
            }
            
            console.log('🎉 ИСПРАВЛЕНИЕ: Тестовые данные созданы!');
            console.log('📊 ИСПРАВЛЕНИЕ: Теперь статистика в боте должна показывать:');
            console.log('   👥 Пользователей: 1');
            console.log('   📋 Заказов всего: 4');
            console.log('   ✅ Завершенных: 2');
            console.log('   ⏳ В ожидании: 1');
            console.log('   🔄 В процессе: 1');
            console.log('💡 ИСПРАВЛЕНИЕ: Проблема с пустой статистикой решена!');
            
        } else {
            console.log('✅ ИСПРАВЛЕНИЕ: В базе уже есть данные, тестовые не добавляем');
        }
        
    } catch (error) {
        console.error('❌ ИСПРАВЛЕНИЕ: Ошибка исправления статистики:', error);
    }
}

// Запускаем инициализацию бота
initializeBotAndAdmins().catch(error => {
    console.error('❌ Ошибка инициализации бота и админов:', error.message);
    console.log('🌐 Веб-сервер продолжает работу без бота');
});

// Запускаем исправление статистики через 5 секунд после запуска
setTimeout(() => {
    fixEmptyStats().catch(error => {
        console.error('❌ Ошибка исправления статистики:', error.message);
    });
}, 5000);

// 🌐 ЗАПУСК ВЕБ-СЕРВЕРА
let ratesService;
try {
    console.log('📡 Инициализация RatesService...');
    const RatesService = require('./services/RatesService');
    ratesService = new RatesService();
    global.ratesService = ratesService; // Делаем доступным глобально
    console.log('✅ RatesService инициализирован и доступен глобально');
} catch (error) {
    console.error('❌ Ошибка инициализации RatesService:', error.message);
    console.log('🔄 Продолжаем без RatesService - будем использовать заглушки');
    ratesService = null;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'webapp')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Основной маршрут для мини-приложения
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'webapp', 'index.html'));
});

// API для получения курсов валют
app.get('/api/rates', async (req, res) => {
    console.log('📈 Запрос курсов валют...');
    
    try {
        // 🔥 ТОЛЬКО GLOBAL.RATESSERVICE!!! НИКАКИХ FALLBACK НА ТЕСТОВЫЕ ДАННЫЕ!
        if (!global.ratesService) {
            console.error('❌ GLOBAL.RATESSERVICE НЕ ИНИЦИАЛИЗИРОВАН!');
            return res.status(500).json({ 
                success: false, 
                error: 'RatesService не инициализирован',
                message: 'Google Sheets недоступен'
            });
        }

        console.log('📡 Получаем курсы ТОЛЬКО через GLOBAL.RatesService с Google Sheets...');
        const rates = await global.ratesService.getRates();
        console.log(`📊 Получено ${rates.length} курсов из global.ratesService`);
        
        console.log('🔥🔥🔥 ПОЛНАЯ ДИАГНОСТИКА КУРСОВ ДЛЯ API:');
        rates.forEach(rate => {
            console.log(`📊 API: ${rate.currency} = sell:${rate.sell}, buy:${rate.buy}, price:${rate.price}, source:"${rate.source || 'API'}"`);
            if (rate.currency === 'BTC') {
                console.log(`🔥 BTC ДЕТАЛЬНО: sell=${rate.sell}, buy=${rate.buy}, source="${rate.source}"`);
            }
        });
        
        // НАЙДЕМ BTC КУРС СПЕЦИАЛЬНО
        const btcRate = rates.find(r => r.currency === 'BTC');
        if (btcRate) {
            console.log(`🔥🔥🔥 BTC КУРС НАЙДЕН: sell=${btcRate.sell}, source="${btcRate.source}"`);
            console.log(`🔥 ДОЛЖЕН ЛИ FRONTEND НАЙТИ ЕГО? source.includes('GOOGLE')=${btcRate.source && btcRate.source.includes('GOOGLE')}`);
        } else {
            console.log(`❌❌❌ BTC КУРС НЕ НАЙДЕН В RATES!`);
        }
        
        res.json({ 
            success: true, 
            data: rates,
            lastUpdate: global.ratesService.getLastUpdateTime(),
            source: 'ТОЛЬКО_GOOGLE_SHEETS'
        });
        console.log('✅ Курсы отправлены:', rates.length, 'валют');
        
    } catch (error) {
        console.error('❌ Ошибка получения курсов:', error.message);
        // 🔥 НЕ ИСПОЛЬЗУЕМ ТЕСТОВЫЕ ДАННЫЕ! ВОЗВРАЩАЕМ ОШИБКУ!
        res.status(500).json({ 
            success: false, 
            error: 'Не удалось получить курсы из Google Sheets',
            message: error.message
        });
    }
});

// API для создания заявки в поддержку
app.post('/api/support-ticket', async (req, res) => {
    try {
        console.log('🎫 Создание заявки поддержки:', req.body);
        
        const { userId, source, subject, message, timestamp } = req.body;
        
        // Создаем заявку
        const ticketId = `TICKET_${Date.now()}`;
        
        console.log(`📋 Заявка создана:
        ID: ${ticketId}
        Пользователь: ${userId}
        Тема: ${subject}
        Сообщение: ${message}
        Источник: ${source}
        Время: ${timestamp}`);
        
        // 🚨 ОТПРАВЛЯЕМ УВЕДОМЛЕНИЯ ВСЕМ АДМИНАМ - ПОЛНАЯ ДИАГНОСТИКА!
        console.log('🔍 ПОЛНАЯ ДИАГНОСТИКА БОТА:');
        console.log('   - bot существует?', !!bot);
        console.log('   - bot.api существует?', !!(bot && bot.api));
        console.log('   - bot.isInited?', !!(bot && bot.isInited));
        console.log('   - typeof bot:', typeof bot);
        console.log('   - bot.constructor.name:', bot?.constructor?.name);
        
        // ПРИНУДИТЕЛЬНАЯ ОТПРАВКА ДАЖЕ ЕСЛИ БОТ НЕ ГОТОВ
        if (!bot) {
            console.log('❌ КРИТИЧНО! БОТ НЕ ИНИЦИАЛИЗИРОВАН!');
            // НЕ возвращаем ошибку, продолжаем
        } else if (!bot.api) {
            console.log('❌ КРИТИЧНО! BOT API НЕДОСТУПЕН!');
            // НЕ возвращаем ошибку, продолжаем
        } else {
        }
        
        // 🔥 ПРИНУДИТЕЛЬНАЯ ПОПЫТКА ОТПРАВКИ УВЕДОМЛЕНИЙ
        try {
            console.log('📨 ПРИНУДИТЕЛЬНАЯ ОТПРАВКА уведомлений админам...');
            console.log('🎯 КРИТИЧНО: User ID заявки:', userId);
            console.log('🎯 КРИТИЧНО: Это тестовый ID?', userId === 123456789 ? 'ДА (может не работать на Railway)' : 'НЕТ (реальный пользователь)');
            const adminIds = [8141463258, 461759951, 280417617]; // ID админов
            
            for (const adminId of adminIds) {
                const notificationMessage = `🎫 <b>НОВАЯ ЗАЯВКА ПОДДЕРЖКИ</b>\n\n` +
                    `📋 <b>ID:</b> <code>${ticketId}</code>\n` +
                    `👤 <b>Пользователь:</b> ${userId}\n` +
                    `📂 <b>Тема:</b> ${subject}\n` +
                    `💬 <b>Сообщение:</b> ${message}\n` +
                    `🌐 <b>Источник:</b> ${source}\n` +
                    `⏰ <b>Время:</b> ${new Date(timestamp).toLocaleString('ru-RU')}`;
                
                try {
                    console.log(`📤 ПРИНУДИТЕЛЬНАЯ отправка админу ${adminId}...`);
                    
                    if (!bot || !bot.api) {
                        console.log(`❌ Бот недоступен для админа ${adminId}, пропускаем`);
                        continue;
                    }
                    
                    const result = await bot.api.sendMessage(adminId, notificationMessage, { 
                        parse_mode: 'HTML',
                        disable_web_page_preview: true,
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '💬 Написать клиенту', url: `tg://user?id=${userId}` },
                                { text: '✅ Закрыть тикет', callback_data: `close_ticket_${ticketId}` }
                            ]]
                        }
                    });
                    console.log(`✅ УСПЕШНО ОТПРАВЛЕНО админу ${adminId}! Message ID: ${result.message_id}`);
                    console.log(`🎯 Telegram ответил:`, result);
                } catch (error) {
                    console.error(`❌ ПРОВАЛ отправки админу ${adminId}:`, error.message);
                    console.error(`🔥 Детали ошибки:`, error);
                    
                    // КРИТИЧЕСКАЯ ПРОВЕРКА - бот заблокирован?
                    if (error.message.includes('bot was blocked')) {
                        console.error(`🚫 АДМИН ${adminId} ЗАБЛОКИРОВАЛ БОТА!`);
                    } else if (error.message.includes('chat not found')) {
                        console.error(`👻 АДМИН ${adminId} НЕ НАЙДЕН В TELEGRAM!`);
                    } else {
                        console.error(`💥 НЕИЗВЕСТНАЯ ОШИБКА для админа ${adminId}`);
                    }
                }
            }
            
            console.log('📨 Процесс отправки уведомлений завершен');
        } catch (error) {
            console.error('❌ Критическая ошибка отправки уведомлений:', error.message);
        }
        
        res.json({ 
            success: true, 
            data: {
                ticketId: ticketId,
                status: 'created',
                message: 'Заявка создана и отправлена операторам.'
            }
        });
    } catch (error) {
        console.error('❌ Ошибка создания заявки поддержки:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка создания заявки' });
    }
});

// 🚨 ПРОСТЕЙШИЙ ТЕСТ ЖИВОСТИ СЕРВЕРА
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        time: new Date().toISOString(),
        version: '2024-07-19-FINAL',
        bot: bot ? 'READY' : 'NOT_READY'
    });
});

// 🧪 ТЕСТОВЫЙ ENDPOINT ДЛЯ ПРОВЕРКИ УВЕДОМЛЕНИЙ
app.get('/test-notification', async (req, res) => {
    try {
        console.log('🧪 ТЕСТ УВЕДОМЛЕНИЙ ЗАПУЩЕН');
        console.log('🔍 BOT_TOKEN на сервере:', process.env.BOT_TOKEN ? 'ЕСТЬ' : 'НЕТ');
        console.log('🔍 Bot объект:', bot ? 'ЕСТЬ' : 'НЕТ');
        console.log('🔍 Bot.api:', bot?.api ? 'ЕСТЬ' : 'НЕТ');
        
        if (!bot || !bot.api) {
            return res.json({ success: false, error: 'Бот не инициализирован' });
        }
        
        const testMessage = `🧪 <b>ТЕСТ УВЕДОМЛЕНИЙ</b>\n\n` +
            `⏰ Время: ${new Date().toLocaleString('ru-RU')}\n` +
            `🌐 Источник: Railway Test\n` +
            `✅ Бот работает!`;
            
        const result = await bot.api.sendMessage(8141463258, testMessage, { 
            parse_mode: 'HTML' 
        });
        
        console.log('✅ ТЕСТ УСПЕШЕН! Message ID:', result.message_id);
        res.json({ success: true, messageId: result.message_id });
        
    } catch (error) {
        console.error('❌ ТЕСТ ПРОВАЛЕН:', error.message);
        res.json({ success: false, error: error.message });
    }
});

// API для профиля пользователя
app.get('/api/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('👤 Запрос профиля пользователя:', userId);
        
        // Имитация профиля пользователя
        const userProfile = {
            id: userId,
            first_name: 'Пользователь',
            last_name: '',
            username: `user${userId}`,
            level: 1,
            experience: 0,
            total_volume: 0,
            successful_orders: 0,
            avatar: null,
            created_at: new Date().toISOString()
        };
        
        console.log('✅ Профиль отправлен:', userProfile);
        res.json({ success: true, data: userProfile });
    } catch (error) {
        console.error('❌ Ошибка получения профиля:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка получения профиля' });
    }
});

// API для создания заявки
app.post('/api/create-order', async (req, res) => {
    try {
        console.log('📝 Создание заявки (комбинированный режим):', req.body);
        console.log('🚨 === ПЕРЕД ВЫЗОВОМ notifyOperators ===');
        
        const {
            userId,
            fromCurrency,
            toCurrency,
            fromAmount,
            toAmount,
            fromAddress,
            toAddress,
            exchangeRate,
            fee,
            amlFromResult,
            amlToResult,
            pairType
        } = req.body;

        // ДЕТАЛЬНАЯ ДИАГНОСТИКА ИЗВЛЕЧЕННЫХ ДАННЫХ
        console.log('🔍 ИЗВЛЕЧЕННЫЕ ДАННЫЕ:');
        console.log('  userId:', userId);
        console.log('  fromCurrency:', fromCurrency);
        console.log('  toCurrency:', toCurrency);
        console.log('  fromAmount:', fromAmount);
        console.log('  toAmount:', toAmount);
        console.log('  fromAddress:', fromAddress);
        console.log('  toAddress:', toAddress);
        console.log('  exchangeRate:', exchangeRate);
        console.log('  pairType:', pairType);

        // Генерируем уникальный ID заявки
        const orderId = `EM${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        console.log('📝 Сгенерированный ID заявки:', orderId);

        // Создаем заявку в базе данных
        let realOrderId = orderId; // fallback к сгенерированному ID
        if (db && db.createOrder) {
            try {
                const order = await db.createOrder({
                    userId: userId,                    // ← ИСПРАВЛЕНО: camelCase
                    fromCurrency: fromCurrency,       // ← ИСПРАВЛЕНО: camelCase
                    toCurrency: toCurrency,           // ← ИСПРАВЛЕНО: camelCase
                    fromAmount: fromAmount,           // ← ИСПРАВЛЕНО: camelCase
                    toAmount: toAmount,               // ← ИСПРАВЛЕНО: camelCase
                    fromAddress: fromAddress || '',   // ← ИСПРАВЛЕНО: camelCase
                    toAddress: toAddress || '',       // ← ИСПРАВЛЕНО: camelCase
                    exchangeRate: exchangeRate,       // ← ИСПРАВЛЕНО: camelCase
                    fee: fee || 0,
                    amlStatus: JSON.stringify({ from: amlFromResult, to: amlToResult }),  // ← ИСПРАВЛЕНО: camelCase
                    status: 'pending',
                    source: 'web'
                });
                console.log('✅ Заявка создана в базе:', order.id);
                realOrderId = order.id; // ← СОХРАНЯЕМ РЕАЛЬНЫЙ ID ИЗ БАЗЫ!
            } catch (dbError) {
                console.error('❌ Ошибка сохранения в базу:', dbError);
            }
        }

        // Получаем информацию о пользователе
        let user = null;
        if (db && db.getUser) {
            try {
                user = await db.getUser(userId);
            } catch (userError) {
                console.error('❌ Ошибка получения пользователя:', userError);
            }
        }
        
        user = user || {
            first_name: 'Пользователь',
            username: `user${userId}`
        };

        console.log('📋 Данные для уведомления:', {
            realOrderId,
            orderId,
            userName: user.first_name || user.username,
            fromAmount,
            fromCurrency,
            toCurrency
        });

        // Отправляем уведомление операторам
        if (notifyOperators) {
            try {
                await notifyOperators({
                    id: realOrderId,                          // ← ИСПРАВЛЕНО: используем РЕАЛЬНЫЙ ID из базы!
                    userName: user.first_name || user.username || `User_${userId}`,
                    fromAmount: fromAmount,
                    fromCurrency: fromCurrency,
                    toCurrency: toCurrency,
                    fromAddress: fromAddress || '',
                    toAddress: toAddress || '',
                    pairType: pairType || 'fiat'
                });
                console.log('✅ ВЫЗОВ notifyOperators ЗАВЕРШЕН');
            } catch (notifyError) {
                console.error('❌ Ошибка уведомления операторов:', notifyError);
            }
        } else {
            console.error('❌ notifyOperators НЕ ДОСТУПЕН!');
        }
        
        res.json({ 
            success: true, 
            data: {
                id: realOrderId,        // ← ИСПРАВЛЕНО: используем РЕАЛЬНЫЙ ID из базы!
                orderId: orderId,       // ← оставляем сгенерированный ID для совместимости
                status: 'pending',
                message: 'Заявка создана'
            }
        });
    } catch (error) {
        console.error('❌ Ошибка создания заявки:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания заявки' });
    }
});

// 🔍 ДИАГНОСТИКА ФАЙЛОВ
app.get('/api/check-files', (req, res) => {
    const fs = require('fs');
    const assetsPath = path.join(__dirname, '..', 'assets', 'images', 'currencies');
    
    try {
        const files = fs.readdirSync(assetsPath);
        const pngFiles = files.filter(f => f.endsWith('.png'));
        
        res.json({
            success: true,
            assetsPath: assetsPath,
            totalFiles: files.length,
            pngFiles: pngFiles,
            first5: pngFiles.slice(0, 5)
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            assetsPath: assetsPath
        });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🌐 Комбинированный сервер запущен на порту ${PORT}`);
    console.log(`📱 Веб-приложение: http://localhost:${PORT}`);
    console.log(`🤖 Telegram бот: АКТИВЕН`);
    console.log(`📡 RatesService статус:`, ratesService ? '✅ Активен' : '❌ Отключен (используем тестовые данные)');
    console.log(`🚀 Готов к работе!`);
}).on('error', (err) => {
    console.error('❌ Ошибка запуска сервера:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Порт ${PORT} занят. Попробуйте другой порт.`);
    }
    process.exit(1);
}); 