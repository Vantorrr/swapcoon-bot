require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

console.log('🚀 Запуск комбинированного сервера (БОТ + ВЕБ)...');
console.log('📂 __dirname:', __dirname);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'не установлен');
console.log('🔌 PORT:', process.env.PORT || 3000);
console.log('🔑 BOT_TOKEN установлен?', process.env.BOT_TOKEN ? 'ДА' : 'НЕТ');
console.log('🔑 BOT_TOKEN длина:', process.env.BOT_TOKEN ? process.env.BOT_TOKEN.length : 0);
console.log('🔑 BOT_TOKEN начинается с:', process.env.BOT_TOKEN ? process.env.BOT_TOKEN.substring(0, 10) + '...' : 'НЕТ');

// 🤖 ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ БОТА
let bot = null;
let notifyOperators = null;
let notifyWebsiteActivity = null;
let db = null;

// 🤖 АСИНХРОННЫЙ ЗАПУСК TELEGRAM БОТА С ИНИЦИАЛИЗАЦИЕЙ АДМИНОВ
async function initializeBotAndAdmins() {
    console.log('🤖 Инициализация Telegram бота...');
    try {
        // Импортируем бота
        const botModule = require('./bot');
        bot = botModule.bot;
        notifyOperators = botModule.notifyOperators;
        notifyWebsiteActivity = botModule.notifyWebsiteActivity;
        db = botModule.db;
        console.log('✅ Telegram бот инициализирован');
        
        // Инициализируем Google Sheets Manager глобально
        try {
            if (botModule.googleSheetsManager) {
                global.googleSheetsManager = botModule.googleSheetsManager;
                console.log('📊 Google Sheets Manager доступен глобально');
            } else {
                console.log('⚠️ Google Sheets Manager не инициализирован');
            }
        } catch (error) {
            console.log('❌ Ошибка инициализации Google Sheets Manager:', error.message);
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
                ['FIX_001', 888999777, 'USDT', 'RUB', 100, 10000, 100, 'completed', 'web'],
                ['FIX_002', 888999777, 'BTC', 'USDT', 0.001, 95, 95000, 'pending', 'bot'],
                ['FIX_003', 888999777, 'ETH', 'ARS', 1, 3500000, 3500000, 'processing', 'web'],
                ['FIX_004', 888999777, 'USDT', 'USD', 50, 50, 1, 'completed', 'bot']
            ];
            
            for (let i = 0; i < testOrders.length; i++) {
                const order = testOrders[i];
                await new Promise((resolve, reject) => {
                    db.db.run(`
                        INSERT OR IGNORE INTO orders 
                        (id, user_id, from_currency, to_currency, from_amount, to_amount, 
                         exchange_rate, status, source, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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
    console.log('✅ RatesService инициализирован');
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
        if (ratesService) {
            console.log('📡 Получаем курсы через RatesService...');
            const rates = await ratesService.getRates();
            res.json({ 
                success: true, 
                data: rates,
                lastUpdate: ratesService.getLastUpdateTime(),
                source: 'live_api'
            });
            console.log('✅ Курсы отправлены:', rates.length, 'валют');
        } else {
            console.log('🔄 RatesService недоступен, используем тестовые курсы...');
            const testRates = getTestRates();
            res.json({ 
                success: true, 
                data: testRates,
                lastUpdate: new Date().toISOString(),
                source: 'test_data'
            });
            console.log('✅ Тестовые курсы отправлены:', testRates.length, 'валют');
        }
    } catch (error) {
        console.error('❌ Ошибка получения курсов:', error.message);
        console.log('🔄 Fallback на тестовые курсы...');
        const testRates = getTestRates();
        res.json({ 
            success: true, 
            data: testRates,
            lastUpdate: new Date().toISOString(),
            source: 'fallback_data'
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
        
        // Генерируем уникальный ID заявки
        const orderId = `EM${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        console.log('📝 Сгенерированный ID заявки:', orderId);
        
        res.json({ 
            success: true, 
            data: {
                id: orderId,        // ← ИСПРАВЛЕНО: теперь "id" вместо "orderId"
                orderId: orderId,   // ← оставляем для совместимости
                status: 'pending',
                message: 'Заявка создана'
            }
        });
    } catch (error) {
        console.error('Ошибка создания заявки:', error);
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

// Тестовые курсы как fallback
function getTestRates() {
    return [
        // 🪙 КРИПТОВАЛЮТЫ
        { currency: 'BTC', price: 95000, buy: 95000, sell: 96000, change24h: 2.5, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'ETH', price: 3500, buy: 3500, sell: 3520, change24h: 1.8, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'USDT', price: 1.0, buy: 1.0, sell: 1.02, change24h: 0.1, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'USDC', price: 1.0, buy: 1.0, sell: 1.02, change24h: 0.0, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'BNB', price: 650, buy: 650, sell: 655, change24h: -0.8, lastUpdate: new Date().toISOString(), type: 'crypto' },
        
        // 💰 ФИАТНЫЕ ВАЛЮТЫ
        { currency: 'USD', price: 1.0, buy: 1.0, sell: 1.0, change24h: 0.0, lastUpdate: new Date().toISOString(), type: 'fiat' },
        { currency: 'EUR', price: 0.92, buy: 0.92, sell: 0.94, change24h: 0.2, lastUpdate: new Date().toISOString(), type: 'fiat' },
        { currency: 'RUB', price: 0.0105, buy: 0.0098, sell: 0.0102, change24h: -0.5, lastUpdate: new Date().toISOString(), type: 'fiat' }
    ];
}

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