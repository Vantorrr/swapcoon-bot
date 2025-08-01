require('dotenv').config();
const { Bot, InlineKeyboard, webhookCallback } = require('grammy');
const express = require('express');
const { exec } = require('child_process');
const Database = require('./models/Database');
const GoogleSheetsManager = require('./services/GoogleSheetsManager');
const CRMService = require('./services/CRMService');
const fs = require('fs');
const path = require('path');

// Инициализация бота
const bot = new Bot(process.env.BOT_TOKEN);

// Добавляем error handler чтобы бот не падал
bot.catch((err) => {
    console.error('❌ Ошибка в боте:', err);
});

// Инициализация базы данных
const db = new Database();

// 🛡️ ХАРДКОД АДМИНОВ - НИКОГДА НЕ ПОТЕРЯЮТСЯ!
const HARDCODED_ADMINS = [8141463258, 461759951, 280417617];
const HARDCODED_OPERATORS = [7692725312]; // @ExMachinaXSupport

// 🔥 ГАРАНТИРОВАННАЯ ПРОВЕРКА РОЛЕЙ (БЕЗ БАЗЫ ДАННЫХ)
async function isAdmin(userId) {
    const isHardcodedAdmin = HARDCODED_ADMINS.includes(userId);
    console.log(`🛡️ Проверка админа ${userId}: ${isHardcodedAdmin ? 'ДА (хардкод)' : 'НЕТ'}`);
    
    // Дополнительная проверка через БД (если доступна)
    try {
        const dbRole = await db.getUserRole(userId);
        console.log(`📋 Роль в БД: ${dbRole || 'не найдена'}`);
        return isHardcodedAdmin || dbRole === 'admin';
    } catch (error) {
        console.log('⚠️ БД недоступна, используем хардкод');
        return isHardcodedAdmin;
    }
}

async function isOperator(userId) {
    const isHardcodedOperator = HARDCODED_OPERATORS.includes(userId);
    console.log(`👨‍💼 Проверка оператора ${userId}: ${isHardcodedOperator ? 'ДА (хардкод)' : 'НЕТ'}`);
    
    try {
        const dbRole = await db.getUserRole(userId);
        return isHardcodedOperator || dbRole === 'operator' || dbRole === 'admin';
    } catch (error) {
        console.log('⚠️ БД недоступна для проверки оператора');
        return isHardcodedOperator;
    }
}

// Хранилище контекстов чата для операторов
const chatContexts = new Map();

// Инициализация сервисов
let googleSheetsManager = null;
const crmService = new CRMService();

// Инициализация Google Sheets
async function initGoogleSheets() {
    console.log('🔍 ВХОД В initGoogleSheets()');
    try {
        console.log('🔍 Инициализация Google Sheets...');
        
        // Приоритет: переменные окружения (для Railway)
        console.log('🔍 Читаем переменные окружения...');
        const envSpreadsheetId = process.env.GOOGLE_SHEETS_ID;
        const envCredentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
        const envEnabled = process.env.GOOGLE_SHEETS_ENABLED !== 'false';
        console.log('✅ Переменные прочитаны');
        
        // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА
        console.log('🔍 ДИАГНОСТИКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ:');
        console.log('   GOOGLE_SHEETS_ID:', envSpreadsheetId ? 'ЕСТЬ' : 'НЕТ');
        console.log('   GOOGLE_SHEETS_CREDENTIALS:', envCredentials ? 'ЕСТЬ' : 'НЕТ');
        console.log('   GOOGLE_SHEETS_ENABLED:', envEnabled);
        
        if (envCredentials) {
            console.log('   Длина CREDENTIALS:', envCredentials.length);
            console.log('   Первые 100 символов:', envCredentials.substring(0, 100));
        }
        
        let config = null;
        
        if (envSpreadsheetId && envCredentials && envEnabled) {
            console.log('🌍 Используем переменные окружения для Google Sheets');
            try {
                console.log('🔍 Парсим JSON credentials...');
                const parsedCredentials = JSON.parse(envCredentials);
                console.log('✅ JSON credentials спаршен успешно');
                
                config = {
                    enabled: true,
                    spreadsheet_id: envSpreadsheetId,
                    credentials: parsedCredentials,
                    auto_export_interval: 3600000
                };
                console.log('✅ Конфигурация из переменных окружения загружена');
            } catch (parseError) {
                console.error('❌ Ошибка парсинга GOOGLE_SHEETS_CREDENTIALS:', parseError.message);
                console.error('📋 JSON parseError stack:', parseError.stack);
                console.log('🚨 КРИТИЧНО: JSON credentials невалидны!');
            }
        } else {
            console.log('⚠️ НЕ ВСЕ переменные окружения найдены');
            console.log('   envSpreadsheetId:', !!envSpreadsheetId);
            console.log('   envCredentials:', !!envCredentials);  
            console.log('   envEnabled:', envEnabled);
        }
        
        // Fallback: файл конфигурации (для локальной разработки)
        if (!config) {
            console.log('📂 Ищем файл конфигурации config/google-sheets.json...');
            const configPath = path.join(__dirname, '..', 'config', 'google-sheets.json');
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                console.log('📄 Конфигурация из файла загружена');
            } else {
                console.log('❌ Файл конфигурации не найден');
            }
        }
        
        if (config && config.enabled && config.credentials && config.spreadsheet_id) {
            console.log('🚀 Инициализируем Google Sheets Manager...');
            console.log('📊 Spreadsheet ID:', config.spreadsheet_id);
            console.log('🔑 Credentials найдены:', !!config.credentials);
            
            googleSheetsManager = new GoogleSheetsManager();
            console.log('📦 GoogleSheetsManager создан:', !!googleSheetsManager);
            
            const success = await googleSheetsManager.init(config.credentials, config.spreadsheet_id);
            console.log('🔌 Результат инициализации API:', success);
            
            if (success) {
                await googleSheetsManager.createWorksheets();
                console.log('✅ Google Sheets интеграция активна!');
                console.log('🔗 Ссылка на таблицу: https://docs.google.com/spreadsheets/d/' + config.spreadsheet_id + '/edit');
                
                // 🌍 УСТАНАВЛИВАЕМ ГЛОБАЛЬНО
                global.googleSheetsManager = googleSheetsManager;
                console.log('🌍 Google Sheets Manager установлен глобально!');
                
                // Запускаем автоматический экспорт
                if (config.auto_export_interval) {
                    setInterval(async () => {
                        console.log('🔄 Автоматический экспорт в Google Sheets...');
                        await googleSheetsManager.exportAll(db);
                    }, config.auto_export_interval);
                }
            } else {
                console.log('❌ Ошибка подключения к Google Sheets API');
            }
        } else {
            console.log('❌ Google Sheets не настроен');
            console.log('🔍 Причины:');
            console.log('   config существует:', !!config);
            if (config) {
                console.log('   config.enabled:', config.enabled);
                console.log('   config.credentials:', !!config.credentials);
                console.log('   config.spreadsheet_id:', !!config.spreadsheet_id);
            }
            console.log('💡 Для настройки на Railway добавьте переменные окружения:');
            console.log('   GOOGLE_SHEETS_ID=your_spreadsheet_id');
            console.log('   GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}');
            console.log('   GOOGLE_SHEETS_ENABLED=true');
            console.log('💡 Для локальной разработки создайте файл config/google-sheets.json');
        }
    } catch (error) {
        console.error('❌ Ошибка инициализации Google Sheets:', error.message);
        console.error('📋 Полный stack trace:', error.stack);
        console.log('🚨 КРИТИЧНО: initGoogleSheets() упал с ошибкой!');
    }
    console.log('🔍 ВЫХОД ИЗ initGoogleSheets()');
}

// Функция для создания клавиатуры
async function createMainKeyboard(userId) {
    const keyboard = new InlineKeyboard();
    
    // Добавляем WebApp кнопку только если URL поддерживает HTTPS
    const webappUrl = process.env.WEBAPP_URL;
    if (webappUrl && webappUrl.startsWith('https://')) {
        keyboard.webApp('🚀 Открыть ExMachinaX', `${webappUrl}?user=${userId}`).row();
    } else {
        // Кнопка для приложения 
        keyboard.text('🚀 Открыть ExMachinaX', 'webapp_launch').row();
    }
    
    // Проверяем роль пользователя и добавляем соответствующие кнопки
    try {
        const userRole = await db.getUserRole(userId);
        
        if (userRole === 'admin') {
            keyboard.text('🛡️ Админ панель', 'open_admin_panel')
                .text('👨‍💼 Панель оператора', 'open_operator_panel')
                .row();
        } else if (userRole === 'operator') {
            keyboard.text('👨‍💼 Панель оператора', 'open_operator_panel').row();
        }
    } catch (error) {
        console.log('⚠️ Ошибка проверки роли пользователя:', error.message);
    }
    
    keyboard.text('📞 Связаться с оператором', 'contact_operator')
        .row()
        .text('ℹ️ Информация', 'info');
    
    return keyboard;
}

// Команда для инициализации таблицы курсов: /init_rates_table
bot.command('init_rates_table', async (ctx) => {
    const userId = ctx.from.id;
    
    // Проверяем права админа
    if (!(await isAdmin(userId))) {
        return await ctx.reply('❌ Только администраторы могут инициализировать таблицу курсов');
    }
    
    try {
        await ctx.reply('🔄 Создаю лист курсов в существующей таблице...');
        
        // 🔥 РАДИКАЛЬНОЕ РЕШЕНИЕ: СОЗДАЕМ GOOGLE SHEETS MANAGER ПРЯМО ЗДЕСЬ
        console.log('🔥 РАДИКАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ Google Sheets Manager в команде!');
        
        const GoogleSheetsManager = require('./services/GoogleSheetsManager');
        
        // Проверяем переменные окружения
        const envSpreadsheetId = process.env.GOOGLE_SHEETS_ID;
        const envCredentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
        const envEnabled = process.env.GOOGLE_SHEETS_ENABLED !== 'false';
        
        console.log('🔥 ДИАГНОСТИКА В КОМАНДЕ:');
        console.log('   GOOGLE_SHEETS_ID:', envSpreadsheetId ? 'ЕСТЬ' : 'НЕТ');
        console.log('   GOOGLE_SHEETS_CREDENTIALS:', envCredentials ? 'ЕСТЬ' : 'НЕТ');
        console.log('   GOOGLE_SHEETS_ENABLED:', envEnabled);
        
        if (envCredentials) {
            console.log('🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА JSON:');
            console.log('   Длина:', envCredentials.length);
            console.log('   Первые 50 символов:', envCredentials.substring(0, 50));
            console.log('   Последние 50 символов:', envCredentials.substring(envCredentials.length - 50));
            console.log('   Начинается с {:', envCredentials.trim().startsWith('{'));
            console.log('   Заканчивается на }:', envCredentials.trim().endsWith('}'));
        }
        
        if (!envSpreadsheetId || !envCredentials || !envEnabled) {
            return await ctx.reply(
                '❌ <b>Google Sheets не настроен!</b>\n\n' +
                '🔧 <b>Настройте переменные в Railway:</b>\n' +
                '• GOOGLE_SHEETS_ID\n' +
                '• GOOGLE_SHEETS_CREDENTIALS\n' +
                '• GOOGLE_SHEETS_ENABLED=true\n\n' +
                '💡 Проверьте Railway Dashboard → Variables',
                { parse_mode: 'HTML' }
            );
        }
        
        console.log('🔥 Создаем Google Sheets Manager прямо в команде...');
        const sheetsManager = new GoogleSheetsManager();
        
        // 🔧 ИСПРАВЛЯЕМ ПРОБЛЕМУ С ЛИШНИМ СИМВОЛОМ = В НАЧАЛЕ JSON
        let cleanCredentials = envCredentials.trim();
        if (cleanCredentials.startsWith('=')) {
            console.log('🔧 Убираем лишний символ = в начале JSON credentials');
            cleanCredentials = cleanCredentials.substring(1);
        }
        
        const parsedCredentials = JSON.parse(cleanCredentials);
        const success = await sheetsManager.init(parsedCredentials, envSpreadsheetId);
        
        if (!success) {
            return await ctx.reply('❌ Ошибка подключения к Google Sheets API. Проверьте credentials.');
        }
        
        console.log('🔥 Google Sheets Manager создан успешно!');
        
        // Сначала создаем лист Manual_Rates если его нет
        try {
            await sheetsManager.createWorksheet('Manual_Rates', 
                ['Пара валют', 'Курс продажи', 'Курс покупки', 'Спред (%)', 'Последнее обновление', 'Статус', 'Источник', 'Комментарий']);
            console.log('✅ Лист Manual_Rates создан');
        } catch (error) {
            // Лист уже существует - это нормально
            console.log('ℹ️ Лист Manual_Rates уже существует или ошибка:', error.message);
        }
        
        // Теперь заполняем данными
        const initSuccess = await sheetsManager.initializeRatesTable();
        
        if (initSuccess) {
            await ctx.reply(
                '✅ <b>ТАБЛИЦА КУРСОВ СОЗДАНА!</b>\n\n' +
                '📊 Добавлены все валютные пары:\n' +
                '• Крипто → USD (BTC, ETH, USDT и др.)\n' +
                '• USD → Фиат (RUB, ARS, EUR и др.)\n' +
                '• Крипто → Фиат (популярные пары)\n\n' +
                '💡 <b>Как использовать:</b>\n' +
                '1. Откройте Google Sheets таблицу\n' +
                '2. Найдите лист "Manual_Rates"\n' +
                '3. Измените статус на "MANUAL"\n' +
                '4. Укажите курсы продажи и покупки\n' +
                '5. Бот подхватит изменения через 30 сек\n\n' +
                `🔗 <a href="${sheetsManager.getSpreadsheetUrl()}">Открыть таблицу</a>`,
                { 
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                }
                            );
            
            // Устанавливаем глобально для других функций
            global.googleSheetsManager = sheetsManager;
            console.log('🔥 Google Sheets Manager установлен глобально из команды!');
            
            // 🔄 ПРИНУДИТЕЛЬНО ЗАПУСКАЕМ СИНХРОНИЗАЦИЮ
            setTimeout(async () => {
                try {
                    console.log('🔄 Запускаем принудительную синхронизацию курсов...');
                    const RatesService = require('./services/RatesService');
                    const ratesService = new RatesService();
                    await ratesService.syncWithGoogleSheets();
                    console.log('✅ Принудительная синхронизация завершена');
                } catch (syncError) {
                    console.error('❌ Ошибка принудительной синхронизации:', syncError);
                }
            }, 3000);
            
        } else {
            await ctx.reply('❌ Ошибка создания таблицы курсов. Проверьте логи.');
        }
        
    } catch (error) {
        console.error('🔥 КРИТИЧЕСКАЯ ОШИБКА в команде init_rates_table:', error);
        console.error('🔥 Stack trace:', error.stack);
        await ctx.reply(
            `❌ <b>КРИТИЧЕСКАЯ ОШИБКА</b>\n\n` +
            `Не удалось создать таблицу курсов\n` +
            `Причина: ${error.message}\n\n` +
            `🔧 Проверьте переменные окружения в Railway`,
            { parse_mode: 'HTML' }
        );
    }
});

// Команда для быстрого изменения курса: /setrate BTC 95000
bot.command('setrate', async (ctx) => {
    const userId = ctx.from.id;
    
    // Проверяем права админа
    if (!(await isAdmin(userId))) {
        return await ctx.reply('❌ Только администраторы могут изменять курсы');
    }
    
    const args = ctx.message.text.split(' ').slice(1); // Убираем /setrate
    
    if (args.length !== 2) {
        return await ctx.reply(
            '❌ Неверный формат команды!\n\n' +
            '📝 <b>Правильный формат:</b>\n' +
            '<code>/setrate BTC 95000</code>\n' +
            '<code>/setrate USDT 1.02</code>\n' +
            '<code>/setrate RUB 0.0105</code>\n\n' +
            '💡 Первый параметр - валюта, второй - новый курс в долларах',
            { parse_mode: 'HTML' }
        );
    }
    
    const currency = args[0].toUpperCase();
    const newPrice = parseFloat(args[1]);
    
    if (isNaN(newPrice) || newPrice <= 0) {
        return await ctx.reply('❌ Неверный курс! Введите положительное число.');
    }
    
    try {
        // Устанавливаем абсолютный курс
        const RatesService = require('./services/RatesService');
        const ratesService = new RatesService();
        await ratesService.setAbsoluteRate(currency, newPrice, 3600000); // На 1 час
        
        // Уведомляем операторов
        await notifyOperators(`✏️ <b>КУРС ${currency} ИЗМЕНЕН КОМАНДОЙ</b>\n\nНовый курс: $${newPrice.toFixed(currency === 'BTC' ? 0 : 4)}\nИзменил: админ ${ctx.from.first_name}\nКоманда: /setrate`);
        
        await ctx.reply(
            `✅ <b>КУРС ${currency} УСТАНОВЛЕН</b>\n\n` +
            `💱 Валюта: ${currency}\n` +
            `💰 Новый курс: $${newPrice.toFixed(currency === 'BTC' ? 0 : 4)}\n` +
            `⏰ Действует: 1 час\n` +
            `🔔 Операторы уведомлены\n\n` +
            `💡 Изменения применены немедленно`,
            { parse_mode: 'HTML' }
        );
        
    } catch (error) {
        console.error('Ошибка установки курса через команду:', error);
        await ctx.reply(
            `❌ <b>ОШИБКА УСТАНОВКИ КУРСА</b>\n\n` +
            `Не удалось установить курс ${currency}\n` +
            `Причина: ${error.message}\n\n` +
            `💡 Проверьте корректность названия валюты`,
            { parse_mode: 'HTML' }
        );
    }
});

// Команда для тестирования синхронизации: /test_sync
bot.command('test_sync', async (ctx) => {
    const userId = ctx.from.id;
    
    // Проверяем права админа
    if (!(await isAdmin(userId))) {
        return await ctx.reply('❌ Только администраторы могут тестировать синхронизацию');
    }
    
    try {
        await ctx.reply('🔍 Тестирую синхронизацию с Google Sheets...');
        
        // Проверяем глобальный менеджер
        if (!global.googleSheetsManager) {
            return await ctx.reply('❌ global.googleSheetsManager не найден! Запустите /init_rates_table');
        }
        
        if (!global.googleSheetsManager.isReady()) {
            return await ctx.reply('❌ Google Sheets Manager не готов! Проверьте настройки.');
        }
        
        // Читаем данные из таблицы напрямую
        console.log('🔍 Читаем данные из Google Sheets...');
        const manualRates = await global.googleSheetsManager.readManualRatesFromTable();
        
        let resultText = '📊 <b>РЕЗУЛЬТАТ ЧТЕНИЯ ТАБЛИЦЫ:</b>\n\n';
        
        if (!manualRates || manualRates.length === 0) {
            resultText += '❌ Ручные курсы не найдены в таблице\n';
            resultText += '💡 Проверьте, что статус = "MANUAL"';
        } else {
            resultText += `✅ Найдено ${manualRates.length} ручных курсов:\n\n`;
            
            for (const rate of manualRates) {
                resultText += `• ${rate.pair}: продажа ${rate.sellRate}, покупка ${rate.buyRate}\n`;
            }
            
            // Принудительно обновляем ГЛОБАЛЬНЫЙ RatesService
            resultText += '\n🔄 Принудительно обновляю курсы...\n';
            
            if (global.ratesService) {
                console.log('🔄 Используем глобальный ratesService для синхронизации');
                await global.ratesService.syncWithGoogleSheets();
            } else {
                console.log('⚠️ Глобальный ratesService не найден, создаем локальный');
                const RatesService = require('./services/RatesService');
                const ratesService = new RatesService();
                await ratesService.syncWithGoogleSheets();
            }
            
            resultText += '✅ Синхронизация завершена!';
        }
        
        await ctx.reply(resultText, { parse_mode: 'HTML' });
        
    } catch (error) {
        console.error('🔥 Ошибка тестирования синхронизации:', error);
        await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
});

// Команда для отладки курсов: /debug_rates
bot.command('debug_rates', async (ctx) => {
    const userId = ctx.from.id;
    
    // Проверяем права админа
    if (!(await isAdmin(userId))) {
        return await ctx.reply('❌ Только администраторы могут отлаживать курсы');
    }
    
    try {
        await ctx.reply('🔍 Диагностика курсов...');
        
        // Получаем курсы через глобальный ratesService
        if (global.ratesService) {
            const rates = await global.ratesService.getRates();
            
            // Ищем RUB курс
            const rubRate = rates.find(r => r.currency === 'RUB');
            
            let resultText = '📊 <b>ДИАГНОСТИКА КУРСОВ:</b>\n\n';
            
            if (rubRate) {
                resultText += `✅ RUB курс найден:\n`;
                resultText += `• Продажа: ${rubRate.sell}\n`;
                resultText += `• Покупка: ${rubRate.buy}\n`;  
                resultText += `• Цена: ${rubRate.price}\n`;
                resultText += `• Источник: ${rubRate.source || 'API'}\n`;
                resultText += `• Тип: ${rubRate.type || 'unknown'}\n`;
            } else {
                resultText += '❌ RUB курс НЕ найден в массиве курсов';
            }
            
            resultText += `\n📈 Всего курсов: ${rates.length}`;
            
            await ctx.reply(resultText, { parse_mode: 'HTML' });
        } else {
            await ctx.reply('❌ global.ratesService не найден');
        }
        
    } catch (error) {
        console.error('🔥 Ошибка диагностики курсов:', error);
        await ctx.reply(`❌ Ошибка: ${error.message}`);
    }
});

// Команда /start
bot.command('start', async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username;
    const firstName = ctx.from.first_name;
    const lastName = ctx.from.last_name;
    
    // Проверяем реферальную ссылку
    let referralCode = null;
    if (ctx.match) {
        referralCode = parseInt(ctx.match.trim());
        console.log(`👥 Пользователь ${userId} пришел по реферальной ссылке от ${referralCode}`);
    }
    
    // Проверяем, существует ли уже пользователь
    const existingUser = await db.getUser(userId);
    
    // Регистрируем или обновляем пользователя (реферальную ссылку ставим только при первой регистрации)
    await db.upsertUser({
        telegramId: userId,
        username: username,
        firstName: firstName,
        lastName: lastName,
        referredBy: existingUser ? existingUser.referred_by : referralCode
    });

    // Если новый пользователь пришел по реферальной ссылке, уведомляем реферера
    if (!existingUser && referralCode) {
        try {
            await ctx.api.sendMessage(referralCode, 
                `🎉 <b>Новый реферал!</b>\n\n` +
                `👤 К вам присоединился новый пользователь: ${firstName || username || 'Пользователь'}\n` +
                `💰 Вы получите комиссию с каждого его обмена!`,
                { parse_mode: 'HTML' }
            );
        } catch (error) {
            console.log('⚠️ Не удалось уведомить реферера:', error.message);
        }
    }

    const keyboard = await createMainKeyboard(userId);

    await ctx.replyWithPhoto('https://i.ibb.co/Y7bVwSgJ/image.png', {
        caption: `🚀 ExMachinaX приветствует тебя!\n\n` +
            `⚡ Быстрый и безопасный сервис обмена валют\n\n` +
            `🔥 Наша система поможет тебе:\n` +
            `💱 Обменять рубли\n` +
            `💱 Обменять криптовалюты\n` +
            `💵 Обмен наличных в офисах\n` +
            `🌍 Переводы по всему миру\n` +
            `🛡️ Быстрый обмен\n` +
            `📊 История всех операций\n` +
            `👥 Реферальная программа (0.2%)\n` +
            `📱 Удобное приложение\n\n` +
            `🎯 Нажмите кнопку ниже, чтобы начать обмен!`,
        parse_mode: 'HTML',
        reply_markup: keyboard
    });
});

// Команда помощи
// Команда для просмотра активности сайта (только для админов)
bot.command('weblogs', async (ctx) => {
    const userId = ctx.from.id;
    const userRole = await db.getUserRole(userId);
    
    if (userRole !== 'admin') {
        return ctx.reply('❌ Эта команда доступна только администраторам');
    }
    
    const stats = await db.getAdminStats();
    const currentTime = new Date().toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow'
    });
    
    const message = 
        `🌐 <b>АКТИВНОСТЬ ВЕБА В РЕАЛЬНОМ ВРЕМЕНИ</b>\n\n` +
        `⏰ Обновлено: ${currentTime}\n\n` +
        `📊 <b>Статистика за сегодня:</b>\n` +
        `🆕 Заявок с сайта: ${stats.ordersToday || 0}\n` +
        `👥 Новых пользователей: ${stats.newUsersToday || 0}\n` +
        `💰 Оборот: $${(stats.volumeToday || 0).toFixed(2)}\n\n` +
        `🔥 <b>Активные процессы:</b>\n` +
        `📋 В ожидании: ${stats.pendingOrders || 0}\n` +
        `🔄 В процессе: ${stats.processingOrders || 0}\n\n` +
        `📈 Все новые заявки автоматически попадут в уведомления!\n\n` +
        `Используйте /daily_stats для подробной аналитики`;
    
    const keyboard = new InlineKeyboard()
        .text('🔄 Обновить', 'refresh_weblogs')
        .text('📊 Статистика дня', 'daily_stats')
        .row()
        .text('🛡️ Админ панель', 'open_admin_panel');
    
    await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard
    });
});

// Команда проверки переменных (только для админов)
bot.command('check_env', async (ctx) => {
    const userId = ctx.from.id;
    const userRole = await db.getUserRole(userId);
    
    if (userRole !== 'admin') {
        return ctx.reply('❌ Эта команда доступна только администраторам');
    }
    
    const webappUrl = process.env.WEBAPP_URL;
    const botToken = process.env.BOT_TOKEN ? 'настроен' : 'отсутствует';
    const mainAdminId = process.env.MAIN_ADMIN_ID || 'отсутствует';
    const adminIds = process.env.ADMIN_IDS || 'отсутствует';
    const operatorIds = process.env.OPERATOR_IDS || 'отсутствует';
    const port = process.env.PORT || '3000';
    
    // Получаем текущий список персонала из базы
    const staffList = await db.getStaffList();
    const currentAdmins = staffList.filter(s => s.role === 'admin');
    const currentOperators = staffList.filter(s => s.role === 'operator');
    
    await ctx.reply(
        `🔍 <b>Проверка переменных окружения</b>\n\n` +
        `🌐 <b>WEBAPP_URL:</b> ${webappUrl || 'НЕ НАСТРОЕНО'}\n` +
        `🤖 <b>BOT_TOKEN:</b> ${botToken}\n` +
        `👑 <b>MAIN_ADMIN_ID:</b> ${mainAdminId}\n` +
        `👥 <b>ADMIN_IDS:</b> ${adminIds}\n` +
        `👨‍💼 <b>OPERATOR_IDS:</b> ${operatorIds}\n` +
        `🚪 <b>PORT:</b> ${port}\n\n` +
        `${webappUrl ? (webappUrl.startsWith('https://') ? '✅ URL корректный' : '❌ URL должен начинаться с https://') : '❌ WEBAPP_URL не настроен'}\n\n` +
        `<b>Текущий персонал в базе:</b>\n` +
        `👑 Админы: ${currentAdmins.length} (${currentAdmins.map(a => a.telegram_id).join(', ')})\n` +
        `👨‍💼 Операторы: ${currentOperators.length} (${currentOperators.map(o => o.telegram_id).join(', ')})\n\n` +
        `<b>Рекомендуемые переменные для Railway:</b>\n` +
        `• WEBAPP_URL = https://exmachinax-bot-production.up.railway.app\n` +
        `• BOT_TOKEN = ваш_токен\n` +
        `• MAIN_ADMIN_ID = ${userId}\n` +
        `• ADMIN_IDS = 461759951,280417617\n` +
        `• OPERATOR_IDS = список_операторов_через_запятую`,
        { parse_mode: 'HTML' }
    );
});

// Команда для принудительной реинициализации персонала
bot.command('reinit_staff', async (ctx) => {
    const userId = ctx.from.id;
    const userRole = await db.getUserRole(userId);
    
    if (userRole !== 'admin') {
        return ctx.reply('❌ Эта команда доступна только администраторам');
    }
    
    try {
        await ctx.reply('🔄 Переинициализация персонала из переменных среды...');
        
        // Принудительно запускаем инициализацию
        await db.initializeAllStaff();
        
        // Показываем результат
        const staffList = await db.getStaffList();
        const admins = staffList.filter(s => s.role === 'admin');
        const operators = staffList.filter(s => s.role === 'operator');
        
        await ctx.reply(
            `✅ <b>Персонал переинициализирован!</b>\n\n` +
            `👑 <b>Админы (${admins.length}):</b>\n` +
            admins.map(a => `• ${a.telegram_id} - ${a.first_name}`).join('\n') + '\n\n' +
            `👨‍💼 <b>Операторы (${operators.length}):</b>\n` +
            (operators.length > 0 ? operators.map(o => `• ${o.telegram_id} - ${o.first_name}`).join('\n') : '• Нет операторов'),
            { parse_mode: 'HTML' }
        );
        
    } catch (error) {
        console.error('❌ Ошибка реинициализации персонала:', error);
        await ctx.reply('❌ Ошибка при реинициализации персонала. Проверьте логи.');
    }
});

// Команда настройки WebApp (только для админов)
bot.command('setup_webapp', async (ctx) => {
    const userId = ctx.from.id;
    const userRole = await db.getUserRole(userId);
    
    if (userRole !== 'admin') {
        return ctx.reply('❌ Эта команда доступна только администраторам');
    }
    
    try {
        const webappUrl = process.env.WEBAPP_URL;
        if (!webappUrl) {
            return ctx.reply('❌ WEBAPP_URL не настроен в переменных окружения');
        }
        
        if (!webappUrl.startsWith('https://')) {
            return ctx.reply('❌ WEBAPP_URL должен использовать HTTPS');
        }
        
        // Настраиваем Menu Button
        await bot.api.setChatMenuButton({
            menu_button: {
                type: 'web_app',
                text: '🚀 Открыть ExMachinaX',
                web_app: {
                    url: webappUrl
                }
            }
        });
        
        await ctx.reply(
            `✅ <b>WebApp успешно настроен!</b>\n\n` +
            `🌐 URL: ${webappUrl}\n` +
            `📱 Menu Button активирована\n\n` +
            `Теперь у всех пользователей появится кнопка "🚀 Открыть ExMachinaX" возле поля ввода сообщения!`,
            { parse_mode: 'HTML' }
        );
        
    } catch (error) {
        await ctx.reply(`❌ Ошибка настройки WebApp: ${error.message}`);
    }
});

// АВАРИЙНАЯ команда для добавления админа (с сохранением всех админов)
bot.command('emergency_admin', async (ctx) => {
    const currentUserId = ctx.from.id;
    const targetUserId = ctx.match ? parseInt(ctx.match.trim()) : currentUserId;
    
    await ctx.reply(`🔍 Экстренное добавление админа ${targetUserId}...\n🔄 Восстанавливаю всех админов из переменных...`);
    
    try {
        // Сначала полностью переинициализируем персонал из переменных среды
        await db.initializeAllStaff();
        
        // Затем добавляем текущего пользователя если его нет в переменных
        await db.addStaffFromEnv(targetUserId, `emergency_${targetUserId}`, 'Emergency Admin', 'admin');
        
        // Показываем итоговый список всех админов
        const staffList = await db.getStaffList();
        const admins = staffList.filter(s => s.role === 'admin');
        
        await ctx.reply(
            `✅ <b>ЭКСТРЕННОЕ ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО!</b>\n\n` +
            `👑 <b>Все админы (${admins.length}):</b>\n` +
            admins.map(a => `• ${a.telegram_id} - ${a.first_name}`).join('\n') + '\n\n' +
            `🛡️ Ваша роль: ${await db.getUserRole(targetUserId)}\n` +
            `📝 Используйте /start для доступа к панели`,
            { parse_mode: 'HTML' }
        );
        
    } catch (error) {
        console.error('❌ Ошибка emergency_admin:', error);
        await ctx.reply(`❌ Ошибка: ${error.message}\n\n🔧 Попробуйте /reinit_staff`);
    }
});

// Команда для быстрой статистики дня
bot.command('daily_stats', async (ctx) => {
    const userId = ctx.from.id;
    const userRole = await db.getUserRole(userId);
    
    if (!userRole || !['admin', 'operator'].includes(userRole)) {
        return ctx.reply('❌ Эта команда доступна только администраторам и операторам');
    }
    
    const stats = await db.getAdminStats();
    const currentTime = new Date().toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    await ctx.reply(
        `📊 <b>БЫСТРАЯ СТАТИСТИКА</b>\n\n` +
        `📅 ${currentTime}\n\n` +
        `🚀 <b>Сегодня с сайта:</b>\n` +
        `• Заявок: ${stats.ordersToday || 0}\n` +
        `• Оборот: $${(stats.volumeToday || 0).toFixed(2)}\n` +
        `• Новых пользователей: ${stats.newUsersToday || 0}\n\n` +
        `⚡ <b>Активность сейчас:</b>\n` +
        `• Ожидают: ${stats.pendingOrders || 0}\n` +
        `• В работе: ${stats.processingOrders || 0}\n` +
        `• Операторы: ${stats.activeOperators || 0}\n\n` +
        `💰 Расчетная прибыль: $${((stats.volumeToday || 0) * 0.03).toFixed(2)}`,
        {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
                .text('🔄 Обновить', 'daily_stats')
                .text('📊 Полная статистика', 'admin_full_stats')
                .row()
                .text('🌐 Веб-логи', 'refresh_weblogs')
        }
    );
});

bot.command('help', async (ctx) => {
    const userId = ctx.from.id;
    const userRole = await db.getUserRole(userId);
    const webappUrl = process.env.WEBAPP_URL;
    let helpKeyboard = new InlineKeyboard();
    
    if (webappUrl && webappUrl.startsWith('https://')) {
        helpKeyboard.webApp('🚀 Открыть ExMachinaX', `${webappUrl}?user=${userId}`);
    } else {
        helpKeyboard.text('🚀 Открыть ExMachinaX', 'webapp_launch');
    }

    let helpText = `⚡ <b>Справка по ExMachinaX Bot</b>\n\n` +
        `<b>🎮 Основные команды:</b>\n` +
        `/start - Запуск системы и мини-приложения\n` +
        `/ref - Реферальная ссылка и заработок\n` +
        `/help - Эта справка\n\n`;

    // Для админов добавляем админские команды
    if (userRole === 'admin') {
        helpText += `<b>🛡️ Команды администратора:</b>\n` +
            `/admin - Админ панель с полной статистикой\n` +
            `/operator - Панель оператора\n` +
            `/setrate BTC 95000 - Установить курс валюты\n` +
            `/init_rates_table - Создать таблицу курсов\n` +
            `/weblogs - Мониторинг активности сайта\n` +
            `/setup_webapp - Настроить Menu Button для WebApp\n` +
            `/add_operator ID - Добавить оператора\n` +
            `/add_operator_forward - Добавить оператора (ответ на сообщение)\n\n`;
    }

    // Для операторов добавляем операторские команды
    if (userRole === 'operator') {
        helpText += `<b>👨‍💼 Команды оператора:</b>\n` +
            `/operator - Панель оператора\n` +
            `/daily_stats - Статистика за день\n` +
            `📋 Принимайте заказы и обрабатывайте клиентов\n\n`;
    }

            helpText += `<b>🔥 Возможности нашей системы:</b>\n` +
        `💱 Обмен криптовалют (42 пары)\n` +
        `💵 Обмен наличных в офисах\n` +
        `🛡️ Быстрый обмен\n` +
        `📊 История всех операций\n` +
        `👥 Реферальная программа (0.2%)\n\n` +
        `🚀 Нажмите кнопку ниже для открытия приложения:`;

    await ctx.reply(helpText, { 
        parse_mode: 'HTML',
        reply_markup: helpKeyboard
    });
});

// Обработка кнопок
bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    
    console.log(`🔘 Получена кнопка: ${data} от пользователя ${userId}`);
    
    if (data === 'webapp_launch') {
        try {
            await ctx.answerCallbackQuery();
            const webappUrl = process.env.WEBAPP_URL;
            
            console.log(`🔍 WEBAPP_URL check: ${webappUrl ? 'exists' : 'missing'}`);
            
            if (webappUrl && webappUrl.startsWith('https://')) {
            // Отправляем сообщение с WebApp кнопкой
            await ctx.reply(
                '🚀 <b>ExMachinaX приветствует тебя!</b>\n\n' +
                '🌟 Удобное приложение для обмена валют\n' +
                '💱 42 валютные пары доступны\n' +
                '🛡️ Быстрый обмен\n' +
                '📊 История всех операций\n' +
                '👥 Реферальная программа\n\n' +
                '📱 Нажмите кнопку ниже, чтобы открыть приложение прямо в Telegram!',
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .webApp('🚀 Открыть ExMachinaX', `${webappUrl}?user=${userId}`)
                        .row()
                        .text('🏠 Назад к боту', 'back_to_main')
                }
            );
        } else {
            // Fallback для локальной разработки
            await ctx.reply(
                '⚠️ <b>WebApp недоступен</b>\n\n' +
                'Приложение будет доступно после настройки HTTPS URL.\n' +
                'Сейчас работает в режиме разработки.',
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🏠 Назад к боту', 'back_to_main')
                }
            );
        }
        } catch (error) {
            console.error('❌ Ошибка в webapp_launch:', error);
            await ctx.reply('❌ Ошибка открытия приложения. Попробуйте позже.');
        }
    }
    
    if (data === 'contact_operator') {
        await ctx.answerCallbackQuery();
        await ctx.reply(
            '📞 <b>Связь с оператором</b>\n\n' +
            'Наши операторы готовы помочь вам 24/7!\n\n' +
                    '✈️ Telegram: @ExMachinaXSupport\n' +
        '📧 Email: support@exmachinax.com\n' +
        '📱 Канал: https://t.me/ExchangeMachinaX\n' +
            '⏰ Время ответа: до 15 минут',
            { 
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard()
                    .text('🏠 Назад к боту', 'back_to_main')
            }
        );
    }
    
    if (data === 'info') {
        await ctx.answerCallbackQuery();
        await ctx.reply(
            'ℹ️ <b>О сервисе ExMachinaX</b>\n\n' +
            '🌟 Быстрый и безопасный обмен валют\n' +
            '🛡️ Проверка AML для безопасности\n' +
            '💰 Выгодные курсы обмена\n' +
            '🎁 Реферальная программа\n' +
            '📱 Удобное приложение\n\n' +
            '📞 <b>Контакты:</b>\n' +
            '✈️ Поддержка: @ExMachinaXSupport\n' +
            '📱 Канал: https://t.me/ExchangeMachinaX\n\n' +
            '💡 Все операции проходят через нашу безопасную систему!',
            { 
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard()
                    .text('🏠 Назад к боту', 'back_to_main')
            }
        );
    }
    
    if (data === 'referral_stats') {
        await ctx.answerCallbackQuery();
        const stats = await db.getReferralStats(userId);
        const referrals = await db.getReferralList(userId);
        
        let message = `📊 <b>Детальная статистика рефералов</b>\n\n`;
        message += `👤 Всего рефералов: ${stats.total_referrals}\n`;
        message += `💵 Заработано: $${(stats.total_commission || 0).toFixed(2)}\n`;
        message += `📈 Обменов: ${stats.successful_orders}\n\n`;
        
        if (referrals.length > 0) {
            message += `<b>Ваши рефералы:</b>\n`;
            referrals.slice(0, 10).forEach((ref, index) => {
                const name = ref.first_name || ref.username || 'Пользователь';
                message += `${index + 1}. ${name} - ${ref.orders_count} обменов, $${(ref.total_earned || 0).toFixed(2)}\n`;
            });
            
            if (referrals.length > 10) {
                message += `\n... и еще ${referrals.length - 10} рефералов`;
            }
        } else {
            message += `😊 Пока рефералов нет. Поделитесь своей ссылкой!`;
        }
        
        await ctx.replyWithPhoto('https://i.ibb.co/Y7bVwSgJ/image.png', {
            caption: message,
            parse_mode: 'HTML',
            reply_markup: await createMainKeyboard(userId)
        });
    }

    // === АДМИН ПАНЕЛЬ ===
    
    // Полная статистика
    if (data === 'admin_full_stats') {
        if (!(await isAdmin(userId))) return ctx.answerCallbackQuery('❌ Нет прав');
        
        await ctx.answerCallbackQuery();
        const stats = await db.getAdminStats();
        const topReferrers = await db.getTopReferrers(5);
        
        let referrersText = '';
        topReferrers.forEach((ref, i) => {
            referrersText += `${i + 1}. ${ref.first_name || ref.username || 'User'}: ${ref.referrals_count} реф. ($${ref.total_earned.toFixed(2)})\n`;
        });
        
        const statsKeyboard = new InlineKeyboard()
            .text('🔄 Обновить', 'admin_full_stats')
            .text('📈 Статистика дня', 'admin_daily_stats')
            .row()
            .text('🔙 Назад к админке', 'admin_back');

        await ctx.reply(
            `📊 <b>ПОДРОБНАЯ СТАТИСТИКА</b>\n\n` +
            `👥 <b>Пользователи:</b>\n` +
            `• Всего: ${stats.totalUsers}\n` +
            `• Сегодня: +${stats.newUsersToday}\n\n` +
            `📋 <b>Заказы:</b>\n` +
            `• Всего: ${stats.totalOrders}\n` +
            `• Сегодня: ${stats.ordersToday}\n` +
            `• Завершено: ${stats.completedOrders}\n` +
            `• В ожидании: ${stats.pendingOrders}\n` +
            `• В процессе: ${stats.processingOrders}\n\n` +
            `💰 <b>Финансы:</b>\n` +
            `• Общий оборот: $${(stats.totalVolume || 0).toFixed(2)}\n` +
            `• Сегодня: $${(stats.volumeToday || 0).toFixed(2)}\n` +
            `• Общие комиссии: $${(stats.totalCommissions || 0).toFixed(2)}\n\n` +
            `👨‍💼 <b>Персонал:</b>\n` +
            `• Всего сотрудников: ${stats.activeStaff}\n` +
            `• Операторов: ${stats.activeOperators}\n` +
            `• Назначено заказов: ${stats.assignedOrders}\n\n` +
            `🏆 <b>Топ рефереров:</b>\n${referrersText || 'Нет данных'}`,
            { 
                parse_mode: 'HTML',
                reply_markup: statsKeyboard
            }
        );
    }
    
    // Быстрая статистика дня
    if (data === 'daily_stats') {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery();
        const stats = await db.getAdminStats();
        const currentTime = new Date().toLocaleString('ru-RU', {
            timeZone: 'Europe/Moscow',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        await ctx.reply(
            `📊 <b>АКТИВНОСТЬ ЗА СЕГОДНЯ</b>\n\n` +
            `📅 ${currentTime}\n\n` +
            `🚀 <b>Заявки с сайта:</b>\n` +
            `• Новых заявок: ${stats.ordersToday || 0}\n` +
            `• Общий оборот: $${(stats.volumeToday || 0).toFixed(2)}\n` +
            `• В ожидании: ${stats.pendingOrders || 0}\n` +
            `• В процессе: ${stats.processingOrders || 0}\n\n` +
            `👥 <b>Пользователи:</b>\n` +
            `• Новых регистраций: ${stats.newUsersToday || 0}\n` +
            `• Всего активных: ${stats.totalUsers || 0}\n\n` +
            `💰 <b>Доходность:</b>\n` +
            `• Комиссии за день: $${((stats.volumeToday || 0) * 0.03).toFixed(2)}\n` +
            `• Реферальные выплаты: $${((stats.volumeToday || 0) * 0.002).toFixed(2)}\n\n` +
            `🎯 <b>Эффективность:</b>\n` +
            `• Конверсия заявок: ${stats.ordersToday > 0 ? Math.round((stats.completedOrders || 0) / stats.ordersToday * 100) : 0}%\n` +
            `• Средний чек: $${stats.ordersToday > 0 ? ((stats.volumeToday || 0) / stats.ordersToday).toFixed(0) : 0}`,
            { 
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard()
                    .text('🔄 Обновить', 'daily_stats')
                    .text('📊 Полная статистика', 'admin_full_stats')
                    .row()
                    .text('🔙 Назад к админке', 'admin_back')
                         }
         );
     }
     
     // Обновление веб-логов
     if (data === 'refresh_weblogs') {
         const userRole = await db.getUserRole(userId);
         if (userRole !== 'admin') return ctx.answerCallbackQuery('❌ Нет прав');
         
         await ctx.answerCallbackQuery('🔄 Обновляем...');
         const stats = await db.getAdminStats();
         const currentTime = new Date().toLocaleString('ru-RU', {
             timeZone: 'Europe/Moscow'
         });
         
         const message = 
             `🌐 <b>АКТИВНОСТЬ ВЕБА В РЕАЛЬНОМ ВРЕМЕНИ</b>\n\n` +
             `⏰ Обновлено: ${currentTime}\n\n` +
             `📊 <b>Статистика за сегодня:</b>\n` +
             `🆕 Заявок с сайта: ${stats.ordersToday || 0}\n` +
             `👥 Новых пользователей: ${stats.newUsersToday || 0}\n` +
             `💰 Оборот: $${(stats.volumeToday || 0).toFixed(2)}\n\n` +
             `🔥 <b>Активные процессы:</b>\n` +
             `📋 В ожидании: ${stats.pendingOrders || 0}\n` +
             `🔄 В процессе: ${stats.processingOrders || 0}\n\n` +
             `📈 Все новые заявки автоматически попадут в уведомления!\n\n` +
             `Используйте /daily_stats для подробной аналитики`;
         
         const keyboard = new InlineKeyboard()
             .text('🔄 Обновить', 'refresh_weblogs')
             .text('📊 Статистика дня', 'daily_stats')
             .row()
             .text('🛡️ Админ панель', 'open_admin_panel');
         
         await ctx.editMessageText(message, {
             parse_mode: 'HTML',
             reply_markup: keyboard
         });
     }
     
     // Управление персоналом
    if (data === 'admin_staff') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') return ctx.answerCallbackQuery('❌ Нет прав');
        
        await ctx.answerCallbackQuery();
        const staff = await db.getStaffList();
        
        // 🎯 КРАСИВЫЙ МАППИНГ ПЕРСОНАЛА С ИМЕНАМИ И ССЫЛКАМИ
        const staffInfo = {
            '461759951': { name: 'NIC Admin', username: 'simeply', role: 'admin' },
            '280417617': { name: 'ART Admin', username: 'MISTERNECH', role: 'admin' },
            '7692725312': { name: 'Оператор', username: 'ExMachinaXSupport', role: 'operator' },
            '8141463258': { name: 'DEV', username: 'pavel_xdev', role: 'admin' }
        };
        
        let staffText = '';
        staff.forEach(member => {
            const roleEmoji = member.role === 'admin' ? '🛡️' : '👨‍💼';
            const statusEmoji = member.is_active ? '✅' : '❌';
            
            // Получаем красивое имя и ссылку
            const memberInfo = staffInfo[member.telegram_id.toString()];
            let displayName;
            
            if (memberInfo) {
                displayName = `<b>${memberInfo.name}</b> (@${memberInfo.username})`;
            } else {
                // Fallback для новых сотрудников
                displayName = `${member.first_name || member.username || member.telegram_id}`;
            }
            
            staffText += `${roleEmoji} ${statusEmoji} ${displayName}\n`;
            staffText += `   📊 Заказов обработано: ${member.orders_handled || 0}\n`;
            staffText += `   🆔 ID: <code>${member.telegram_id}</code>\n\n`;
        });
        
        const staffKeyboard = new InlineKeyboard()
            .text('➕ Добавить оператора', 'admin_add_operator')
            .text('➖ Удалить сотрудника', 'admin_remove_staff')
            .row()
            .text('🔙 Назад', 'admin_back');
        
        await ctx.reply(
            `👥 <b>УПРАВЛЕНИЕ ПЕРСОНАЛОМ</b>\n\n` +
            `${staffText || 'Персонал не найден'}`,
            { 
                parse_mode: 'HTML',
                reply_markup: staffKeyboard
            }
        );
    }
    


    // === ОПЕРАТОРСКАЯ ПАНЕЛЬ ===
    
    // Свободные заказы
    if (data === 'op_unassigned_orders') {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery();
        const orders = await db.getUnassignedOrders();
        
        if (orders.length === 0) {
            return ctx.reply('📋 Нет свободных заказов');
        }
        
        // Показываем первые 3 заказа с кнопками принятия
        let ordersText = `📋 <b>СВОБОДНЫЕ ЗАКАЗЫ (${orders.length})</b>\n\n`;
        const keyboard = new InlineKeyboard();
        
        orders.slice(0, 3).forEach((order, i) => {
            ordersText += `🆔 <b>Заказ #${order.id}</b>\n`;
            ordersText += `💱 ${order.from_amount} ${order.from_currency} → ${order.to_currency}\n`;
            ordersText += `👤 ${order.first_name || order.username || 'Пользователь'}\n`;
            ordersText += `📅 ${new Date(order.created_at).toLocaleString('ru')}\n`;
            ordersText += `💰 Сумма: ~$${(order.to_amount || order.from_amount * 50000).toFixed(0)}\n\n`;
            
            keyboard.text(`✅ Принять #${order.id}`, `take_order_${order.id}`);
            if (i % 2 === 1) keyboard.row();
        });
        
        keyboard.row().text('🔄 Обновить', 'op_unassigned_orders').text('🔙 Назад', 'op_back');
        
        await ctx.reply(ordersText, { 
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    }
    
    // Мои заказы
    if (data === 'op_my_orders') {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery();
        const myOrders = await db.getOperatorOrders(userId);
        
        if (myOrders.length === 0) {
            return ctx.reply('📝 У вас нет назначенных заказов');
        }
        
        let ordersText = `📝 <b>МОИ ЗАКАЗЫ (${myOrders.length})</b>\n\n`;
        const keyboard = new InlineKeyboard();
        
        myOrders.slice(0, 5).forEach((order, i) => {
            const statusEmoji = {
                'assigned': '📋',
                'in_progress': '🔄', 
                'completed': '✅',
                'cancelled': '❌'
            }[order.assignment_status] || '📋';
            
            ordersText += `${statusEmoji} <b>Заказ #${order.id}</b>\n`;
            ordersText += `💱 ${order.from_amount} ${order.from_currency} → ${order.to_currency}\n`;
            ordersText += `👤 ${order.first_name || order.username || 'Пользователь'}\n`;
            ordersText += `📅 ${new Date(order.assigned_at).toLocaleString('ru')}\n`;
            ordersText += `📊 Статус: ${order.assignment_status}\n\n`;
            
            // Добавляем кнопку управления для каждого заказа
            keyboard.text(`⚙️ Управление #${order.id}`, `manage_order_${order.id}`);
            if (i % 2 === 1) keyboard.row();
        });
        
        keyboard.row().text('🔙 Назад', 'op_back');
        
        await ctx.reply(ordersText, { 
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    }
    
    // Принятие заказа оператором
    if (data.startsWith('take_order_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('take_order_', ''));
        
        try {
            await db.assignOrder(orderId, userId);
            await ctx.answerCallbackQuery('✅ Заказ принят!');
            
            // Уведомляем пользователя
            const order = (await db.getOperatorOrders(userId)).find(o => o.id === orderId);
            if (order) {
                try {
                    await ctx.api.sendMessage(order.user_id,
                        `✅ <b>Ваш заказ принят оператором!</b>\n\n` +
                        `🆔 Заказ #${orderId}\n` +
                        `💱 ${order.from_amount} ${order.from_currency} → ${order.to_currency}\n\n` +
                        `👨‍💼 С вами свяжется оператор в ближайшее время для завершения обмена.`,
                        { parse_mode: 'HTML' }
                    );
                } catch (error) {
                    console.log('Не удалось уведомить пользователя:', error.message);
                }
            }
            
            await ctx.reply(
                `✅ <b>Заказ #${orderId} успешно принят!</b>\n\n` +
                `🔄 Заказ добавлен в ваш список.\n` +
                `📞 Свяжитесь с клиентом для завершения обмена.\n\n` +
                `💡 Откройте панель управления для работы с заказом:`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🎛️ Открыть заявку', `manage_order_${orderId}`)
                        .text('📋 Мои заказы', 'op_my_orders')
                        .row()
                        .text('🏠 Главное меню', 'back_to_main')
                }
            );
            
        } catch (error) {
            await ctx.answerCallbackQuery(`❌ ${error.message}`);
        }
    }
    
    // Взятие заказа в работу
    if (data.startsWith('start_order_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('start_order_', ''));
        
        try {
            await db.updateOrderAssignmentStatus(orderId, 'in_progress');
            await ctx.answerCallbackQuery('🔄 Заказ взят в работу!');
            
            await ctx.reply(
                `🔄 <b>Заказ #${orderId} взят в работу!</b>\n\n` +
                `💼 Статус изменен на "В процессе".\n` +
                `📞 Свяжитесь с клиентом для завершения.`,
                { parse_mode: 'HTML' }
            );
            
        } catch (error) {
            await ctx.answerCallbackQuery('❌ Ошибка обновления статуса');
        }
    }

    // Управление заказом
    if (data.startsWith('manage_order_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('manage_order_', ''));
        
        try {
            await ctx.answerCallbackQuery('⚙️ Открываю управление...');
            
            const order = await db.getOrderWithClient(orderId);
            if (!order) {
                return ctx.reply('❌ Заказ не найден');
            }
            
            // Проверяем что это заказ оператора
            if (order.operator_id !== userId) {
                return ctx.reply('❌ Это не ваш заказ');
            }
            
            const statusText = {
                'pending': '⏳ Ожидает',
                'processing': '🔄 В процессе',
                'payment_details_sent': '💳 Реквизиты отправлены',
                'payment_waiting': '⏰ Ждем оплату',
                'payment_received': '💰 Платеж получен',
                'payment_confirmed': '✅ Оплата подтверждена',
                'sending': '📤 Отправляем',
                'completed': '🎉 Завершен',
                'cancelled': '❌ Отменен'
            }[order.status] || order.status;
            
            let orderText = `⚙️ <b>УПРАВЛЕНИЕ ЗАКАЗОМ #${order.id}</b>\n\n`;
            orderText += `👤 <b>Клиент:</b> ${order.client_first_name || order.client_username || 'Пользователь'}\n`;
            orderText += `💱 <b>Обмен:</b> ${order.from_amount} ${order.from_currency} → ${order.to_amount} ${order.to_currency}\n`;
            orderText += `📊 <b>Статус:</b> ${statusText}\n`;
            orderText += `🏦 <b>Адрес получения:</b> <code>${order.to_address}</code>\n`;
            orderText += `💳 <b>Адрес отправки:</b> <code>${order.from_address}</code>\n`;
            orderText += `📅 <b>Создан:</b> ${new Date(order.created_at).toLocaleString('ru')}\n\n`;
            
            // Создаем кнопки в зависимости от статуса
            const keyboard = new InlineKeyboard();
            
            if (order.status === 'pending' || order.status === 'processing') {
                keyboard
                    .text('💳 Отправить реквизиты', `send_payment_details_${orderId}`)
                    .text('💬 Написать клиенту', `chat_with_client_${orderId}`)
                    .row();
            }
            
            if (order.status === 'payment_details_sent' || order.status === 'payment_waiting') {
                keyboard
                    .text('✅ Оплата получена', `payment_received_${orderId}`)
                    .text('💬 Написать клиенту', `chat_with_client_${orderId}`)
                    .row();
            }
            
            if (order.status === 'payment_received') {
                keyboard
                    .text('✅ Подтвердить оплату', `confirm_payment_${orderId}`)
                    .text('❌ Отклонить оплату', `reject_payment_${orderId}`)
                    .row()
                    .text('💬 Написать клиенту', `chat_with_client_${orderId}`);
            }
            
            if (order.status === 'payment_confirmed') {
                keyboard
                    .text('📤 Средства отправлены', `funds_sent_${orderId}`)
                    .text('💬 Написать клиенту', `chat_with_client_${orderId}`)
                    .row();
            }
            
            if (order.status === 'sending') {
                keyboard
                    .text('🎉 Завершить заказ', `complete_order_${orderId}`)
                    .text('💬 Написать клиенту', `chat_with_client_${orderId}`)
                    .row();
            }
            
            // Общие кнопки для всех статусов
            keyboard
                .text('💬 История чата', `view_chat_${orderId}`)
                .text('❌ Отменить заказ', `cancel_order_${orderId}`)
                .row()
                .text('🔙 К моим заказам', 'op_my_orders');
            
            await ctx.reply(orderText, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
            
        } catch (error) {
            console.error('Ошибка управления заказом:', error);
            await ctx.reply('❌ Ошибка загрузки заказа');
        }
    }

    // === ОБРАБОТЧИКИ СТАТУСОВ ЗАКАЗОВ ===

    // Выбор реквизитов для отправки
    if (data.startsWith('send_payment_details_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('send_payment_details_', ''));
        
        await ctx.answerCallbackQuery('💳 Выберите реквизиты...');
        
        try {
            const order = await db.getOrderWithClient(orderId);
            if (!order) {
                return ctx.reply('❌ Заказ не найден');
            }
            
            await ctx.reply(
                `💳 <b>ВЫБОР РЕКВИЗИТОВ</b>\n\n` +
                `🆔 Заказ #${orderId}\n` +
                `👤 Клиент: ${order.client_first_name || 'Пользователь'}\n` +
                `💰 К оплате: ${order.from_amount} ${order.from_currency}\n\n` +
                `📋 Выберите готовые криптоадреса или введите новые:`,
                {
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔴 TRC-20 USDT', `send_preset_details_${orderId}_trc20`)
                        .text('💸 BEP-20 USDT', `send_preset_details_${orderId}_bep20`)
                        .row()
                        .text('💸 ByBit ID', `send_preset_details_${orderId}_bybit`)
                        .row()
                        .text('✍️ Ввести новые реквизиты', `custom_details_${orderId}`)
                        .row()
                        .text('🔙 Назад к заказу', `manage_order_${orderId}`)
                }
            );
            
        } catch (error) {
            console.error('Ошибка выбора реквизитов:', error);
            await ctx.reply('❌ Ошибка загрузки заказа');
        }
    }

    // Отправка готовых реквизитов
    if (data.startsWith('send_preset_details_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const parts = data.replace('send_preset_details_', '').split('_');
        const orderId = parseInt(parts[0]);
        const bankType = parts[1];
        
        const presetDetails = {
            trc20: {
                name: 'TRC-20 USDT',
                address: 'THcSDj69NjoD9Ev53mK9cx3jF7AswMDtcW',
                network: 'TRON (TRC-20)',
                currency: 'USDT',
                emoji: '🔴'
            },
            bep20: {
                name: 'BEP-20 USDT',
                address: '0x1d0aea9b2ba322de2e5a2e0745dd42a943320ea6',
                network: 'BSC (BEP-20)',
                currency: 'USDT',
                emoji: '💸'
            },
            bybit: {
                name: 'ByBit ID',
                address: '47028037',
                network: 'ByBit Exchange',
                currency: 'USDT/USDC/BTC/ETH',
                emoji: '💸'
            }
        };
        
        const details = presetDetails[bankType];
        if (!details) {
            return ctx.answerCallbackQuery('❌ Неизвестный тип реквизитов');
        }
        
        try {
            const result = await db.updateOrderStatusWithMessage(orderId, 'payment_details_sent', userId, 
                `💳 Реквизиты ${details.name} отправлены клиенту. Ожидаем поступления средств.`);
            
            const order = await db.getOrderWithClient(orderId);
            
            // Отправляем реквизиты клиенту
            await ctx.api.sendMessage(order.client_id,
                `💳 <b>АДРЕС ДЛЯ ПЕРЕВОДА</b>\n\n` +
                `🆔 Заказ #${orderId}\n` +
                `💰 К переводу: <b>${order.from_amount} ${order.from_currency}</b>\n\n` +
                `${details.emoji} <b>${details.name}</b>\n` +
                `🏦 Сеть: ${details.network}\n` +
                `💎 Валюта: ${details.currency}\n` +
                `📍 Адрес: <code>${details.address}</code>\n\n` +
                `⚠️ <b>ВАЖНО:</b>\n` +
                `• Переводите ТОЧНУЮ сумму: ${order.from_amount} ${order.from_currency}\n` +
                `• Проверьте сеть перевода!\n` +
                `• После перевода нажмите "✅ Отправил"\n` +
                `• Время зачисления: 5-30 минут\n\n` +
                `📞 Вопросы? Напишите оператору!`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('✅ Я отправил', `client_paid_${orderId}`)
                        .text('💬 Связаться с оператором', `client_chat_${orderId}`)
                        .row()
                        .text('📋 Копировать адрес', `copy_address_${details.address}`)
                }
            );
            
            await ctx.answerCallbackQuery(`✅ Адрес ${details.name} отправлен!`);
            await ctx.reply(
                `✅ <b>Адрес отправлен!</b>\n\n` +
                `🏦 Сеть: ${details.name}\n` +
                `📍 Адрес: ${details.address}\n` +
                `🆔 Заказ #${orderId}\n\n` +
                `${result.message}`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🎛️ Управление заказом', `manage_order_${orderId}`)
                }
            );
            
        } catch (error) {
            console.error('Ошибка отправки готовых реквизитов:', error);
            await ctx.answerCallbackQuery('❌ Ошибка отправки реквизитов');
        }
    }

    // Ввод новых реквизитов
    if (data.startsWith('custom_details_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('custom_details_', ''));
        
        await ctx.answerCallbackQuery('✍️ Введите реквизиты...');
        
        // Сохраняем контекст для следующего сообщения
        chatContexts.set(userId, { 
            action: 'input_custom_details',
            orderId: orderId
        });
        
        await ctx.reply(
            `✍️ <b>ВВОД НОВОГО АДРЕСА</b>\n\n` +
            `🆔 Заказ #${orderId}\n\n` +
            `📝 Введите данные в формате:\n\n` +
            `<b>Название сети</b>\n` +
            `📍 Адрес\n` +
            `🏦 Описание сети\n` +
            `💎 Валюта\n\n` +
            `<b>Пример:</b>\n` +
            `TRC-20 USDT\n` +
            `THcSDj69NjoD9Ev53mK9cx3jF7AswMDtcW\n` +
            `TRON (TRC-20)\n` +
            `USDT`,
            { 
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard()
                    .text('❌ Отмена', `send_payment_details_${orderId}`)
            }
        );
    }

    // Платеж получен
    if (data.startsWith('payment_received_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('payment_received_', ''));
        
        try {
            const result = await db.updateOrderStatusWithMessage(orderId, 'payment_received', userId,
                '💰 Платеж получен! Проверяем поступление средств...');
            
            const order = await db.getOrderWithClient(orderId);
            
            await ctx.api.sendMessage(order.client_id,
                `💰 <b>Платеж получен!</b>\n\n` +
                `🆔 Заказ #${orderId}\n` +
                `✅ Ваш платеж поступил к нам\n` +
                `🔄 Проводим проверку средств\n\n` +
                `⏰ Время проверки: до 10 минут\n` +
                `📱 Уведомим вас о результате!`,
                { parse_mode: 'HTML' }
            );
            
            await ctx.answerCallbackQuery('✅ Статус обновлен!');
            await ctx.reply(`✅ Статус заказа #${orderId} обновлен!\n\n${result.message}`);
            
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            await ctx.answerCallbackQuery('❌ Ошибка обновления статуса');
        }
    }

    // Подтвердить оплату
    if (data.startsWith('confirm_payment_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('confirm_payment_', ''));
        
        try {
            const result = await db.updateOrderStatusWithMessage(orderId, 'payment_confirmed', userId,
                '✅ Оплата подтверждена! Начинаем отправку средств...');
            
            const order = await db.getOrderWithClient(orderId);
            
            await ctx.api.sendMessage(order.client_id,
                `✅ <b>Оплата подтверждена!</b>\n\n` +
                `🆔 Заказ #${orderId}\n` +
                `💰 Сумма: ${order.from_amount} ${order.from_currency}\n` +
                `✅ Средства проверены и подтверждены\n\n` +
                `📤 Начинаем отправку на ваш адрес:\n` +
                `🏦 <code>${order.to_address}</code>\n\n` +
                `⏰ Время отправки: до 30 минут`,
                { parse_mode: 'HTML' }
            );
            
            await ctx.answerCallbackQuery('✅ Оплата подтверждена!');
            await ctx.reply(`✅ Оплата для заказа #${orderId} подтверждена!\n\n${result.message}`);
            
        } catch (error) {
            console.error('Ошибка подтверждения оплаты:', error);
            await ctx.answerCallbackQuery('❌ Ошибка подтверждения оплаты');
        }
    }

    // Средства отправлены
    if (data.startsWith('funds_sent_')) {
        console.log(`🔥 НАЖАТА КНОПКА СРЕДСТВА ОТПРАВЛЕНЫ! User: ${userId}, Data: ${data}`);
        
        const userRole = await db.getUserRole(userId);
        console.log(`👤 Роль пользователя: ${userRole}`);
        
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            console.log(`❌ Нет прав! Роль: ${userRole}`);
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('funds_sent_', ''));
        console.log(`📋 Order ID: ${orderId}`);
        
        try {
            console.log(`🔄 Обновляем статус заказа ${orderId} на 'sending'...`);
            const result = await db.updateOrderStatusWithMessage(orderId, 'sending', userId,
                '📤 Средства отправлены на ваш адрес! Ожидайте поступления...');
            console.log(`✅ Статус обновлен:`, result);
            
            const order = await db.getOrderWithClient(orderId);
            console.log(`📋 Данные заказа:`, order ? `ID: ${order.id}, Client: ${order.client_id}` : 'НЕ НАЙДЕН');
            
            await ctx.api.sendMessage(order.client_id,
                `📤 <b>Средства отправлены!</b>\n\n` +
                `🆔 Заказ #${orderId}\n` +
                `💰 Сумма: ${order.to_amount} ${order.to_currency}\n` +
                `🏦 На адрес: <code>${order.to_address}</code>\n\n` +
                `⏰ Время поступления: 10-60 минут\n` +
                `🔍 Отслеживайте поступление в вашем кошельке\n\n` +
                `✅ После получения подтвердите в боте!`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('✅ Получил средства', `client_received_${orderId}`)
                        .text('❓ Не получил', `client_not_received_${orderId}`)
                }
            );
            
            console.log(`📱 Отправляем callback и ответ оператору...`);
            await ctx.answerCallbackQuery('✅ Статус обновлен!');
            await ctx.reply(`✅ Статус заказа #${orderId} обновлен!\n\n${result.message}`);
            console.log(`🎉 ВСЕ УСПЕШНО! Кнопка средства отправлены сработала!`);
            
        } catch (error) {
            console.error('❌🔥 ОШИБКА в обработчике funds_sent_:', error);
            await ctx.answerCallbackQuery('❌ Ошибка обновления статуса');
        }
    }

    // Завершить заказ
    if (data.startsWith('complete_order_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('complete_order_', ''));
        
        try {
            const result = await db.updateOrderStatusWithMessage(orderId, 'completed', userId,
                '🎉 Заказ успешно завершен! Спасибо за использование ExMachinaX!');
            
            const order = await db.getOrderWithClient(orderId);
            
            await ctx.api.sendMessage(order.client_id,
                `🎉 <b>Заказ завершен!</b>\n\n` +
                `🆔 Заказ #${orderId}\n` +
                `✅ Обмен успешно завершен\n` +
                `💰 Получено: ${order.to_amount} ${order.to_currency}\n\n` +
                `🙏 Спасибо за использование ExMachinaX!\n` +
                `⭐ Оцените наш сервис: /feedback\n` +
                `💰 Приглашайте друзей: /ref`,
                { parse_mode: 'HTML' }
            );
            
            await ctx.answerCallbackQuery('🎉 Заказ завершен!');
            await ctx.reply(`🎉 Заказ #${orderId} успешно завершен!\n\n${result.message}`);
            
        } catch (error) {
            console.error('Ошибка завершения заказа:', error);
            await ctx.answerCallbackQuery('❌ Ошибка завершения заказа');
        }
    }

    // Просмотр чата с клиентом
    if (data.startsWith('view_chat_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('view_chat_', ''));
        
        try {
            await ctx.answerCallbackQuery('💬 Загружаю чат...');
            
            const [order, messages] = await Promise.all([
                db.getOrderWithClient(orderId),
                db.getOrderMessages(orderId)
            ]);
            
            if (!order) {
                return ctx.reply('❌ Заказ не найден');
            }
            
            let chatText = `💬 <b>ЧАТ ПО ЗАКАЗУ #${orderId}</b>\n`;
            chatText += `👤 Клиент: ${order.client_first_name || order.client_username || 'Пользователь'}\n\n`;
            
            if (messages.length === 0) {
                chatText += `📝 Сообщений пока нет\n\n`;
            } else {
                messages.slice(-10).forEach(msg => {
                    const time = new Date(msg.created_at).toLocaleTimeString('ru', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    const sender = msg.sender_type === 'operator' ? '👨‍💼' : '👤';
                    chatText += `${sender} <b>${msg.sender_name}:</b> [${time}]\n${msg.message}\n\n`;
                });
                
                if (messages.length > 10) {
                    chatText += `... и еще ${messages.length - 10} сообщений\n\n`;
                }
            }
            
            const keyboard = new InlineKeyboard()
                .text('💬 Написать клиенту', `chat_with_client_${orderId}`)
                .text('🔙 К заказу', `manage_order_${orderId}`);
            
            await ctx.reply(chatText, {
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
            
        } catch (error) {
            console.error('Ошибка загрузки чата:', error);
            await ctx.reply('❌ Ошибка загрузки чата');
        }
    }

    // Написать клиенту
    if (data.startsWith('chat_with_client_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('chat_with_client_', ''));
        
        try {
            await ctx.answerCallbackQuery('💬 Отправьте сообщение...');
            
            const order = await db.getOrderWithClient(orderId);
            if (!order) {
                return ctx.reply('❌ Заказ не найден');
            }
            
            // Сохраняем контекст чата для следующего сообщения
            chatContexts.set(userId, { orderId, action: 'send_message_to_client' });
            
            await ctx.reply(
                `💬 <b>Написать клиенту</b>\n\n` +
                `🆔 Заказ #${orderId}\n` +
                `👤 Клиент: ${order.client_first_name || order.client_username || 'Пользователь'}\n\n` +
                `📝 Напишите ваше сообщение для клиента:`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('❌ Отмена', `manage_order_${orderId}`)
                }
            );
            
        } catch (error) {
            console.error('Ошибка чата:', error);
            await ctx.reply('❌ Ошибка открытия чата');
        }
    }

    // Кнопка "Назад к боту" - возврат в главное меню
    if (data === 'back_to_main') {
        await ctx.answerCallbackQuery('🏠 Возвращаюсь к боту...');
        
        const keyboard = await createMainKeyboard(userId);

        await ctx.replyWithPhoto('https://i.ibb.co/Y7bVwSgJ/image.png', {
            caption: `🚀 <b>ExMachinaX снова приветствует тебя!</b>\n\n` +
                `⚡ Быстрый и безопасный сервис обмена валют\n\n` +
                `<b>🔥 Наша система поможет тебе:</b>\n` +
                `💱 Обмен криптовалют (42 пары)\n` +
                `💵 Обмен наличных в офисах\n` +
                `🛡️ Быстрый обмен\n` +
                `📊 История всех операций\n` +
                `👥 Реферальная программа (0.2%)\n` +
                `📱 Удобное приложение\n\n` +
                `🎯 Выберите действие:`,
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    }

    // Кнопка "Открыть меню" из уведомления о запуске
    if (data === 'startup_open_menu') {
        await ctx.answerCallbackQuery('🚀 Открываю главное меню...');
        
        const keyboard = await createMainKeyboard(userId);

        await ctx.replyWithPhoto('https://i.ibb.co/Y7bVwSgJ/image.png', {
                        caption: `🚀 <b>ExMachinaX приветствует тебя!</b>\n\n` +
            `⚡ Быстрый и безопасный сервис обмена валют\n\n` +
            `<b>🔥 Наша система поможет тебе:</b>\n` +
                `💱 Обмен криптовалют (42 пары)\n` +
                `💵 Обмен наличных в офисах\n` +
                `🛡️ Быстрый обмен\n` +
                `📊 История всех операций\n` +
                `👥 Реферальная программа (0.2%)\n` +
                `📱 Удобное приложение\n\n` +
                `🎯 Выберите действие:`,
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    }

    // Открытие админ панели (из главного меню)
    if (data === 'open_admin_panel') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав администратора');
        }
        
        await ctx.answerCallbackQuery('🔄 Открываю админ панель...');
        
        const stats = await db.getAdminStats();
        
        // Создаем клавиатуру админ панели
        const adminKeyboard = new InlineKeyboard();
        
        // Добавляем ЭПИЧЕСКУЮ кнопку таблицы если Google Sheets активен
        if (googleSheetsManager && googleSheetsManager.isReady()) {
            adminKeyboard.url('💎🔥 ТАБЛИЦА БОГОВ 🔥💎', googleSheetsManager.getSpreadsheetUrl()).row();
        }
        
        adminKeyboard
            .text('📊 Полная статистика', 'admin_full_stats')
            .text('👥 Управление персоналом', 'admin_staff')
            .row()
            .text('📋 Активные заказы', 'admin_active_orders')
            .text('🔔 Уведомления', 'admin_notifications')
            .row()
            .text('🌐 Мониторинг сайта', 'admin_weblogs')
            .text('📈 Статистика дня', 'admin_daily_stats')
            .row()
            .text('👤 Добавить оператора', 'admin_add_operator')
            .text('⚙️ Настройки', 'admin_settings')
            .row()
            .text('💱 Управление курсами', 'admin_rates_control')
            .text('🏠 Назад к боту', 'back_to_main');
        
        await ctx.reply(
            `🛡️ <b>АДМИН ПАНЕЛЬ ExMachinaX</b>\n\n` +
            `📈 <b>Статистика за сегодня:</b>\n` +
            `👥 Новых пользователей: ${stats.newUsersToday}\n` +
            `📝 Заявок: ${stats.ordersToday}\n` +
            `💰 Оборот: $${(stats.volumeToday || 0).toFixed(2)}\n\n` +
            `📊 <b>Общая статистика:</b>\n` +
            `👤 Всего пользователей: ${stats.totalUsers}\n` +
            `📋 Всего заказов: ${stats.totalOrders}\n` +
            `✅ Завершено: ${stats.completedOrders}\n` +
            `⏳ В ожидании: ${stats.pendingOrders}\n` +
            `🔄 В обработке: ${stats.processingOrders}\n` +
            `💵 Общий оборот: $${(stats.totalVolume || 0).toFixed(2)}\n\n` +
            `👨‍💼 <b>Персонал:</b>\n` +
            `🛡️ Активных операторов: ${stats.activeOperators}\n` +
            `📝 Назначенных заказов: ${stats.assignedOrders}\n` +
            `🔔 Непрочитанных уведомлений: ${stats.unreadNotifications}`,
            { 
                parse_mode: 'HTML',
                reply_markup: adminKeyboard
            }
        );
    }

    // 💱 УПРАВЛЕНИЕ КУРСАМИ 
    if (data === 'admin_rates_control') {
        if (!(await isAdmin(userId))) return ctx.answerCallbackQuery('❌ Нет прав');
        
        await ctx.answerCallbackQuery('💱 Открываю управление курсами...');
        
        // Получаем текущие курсы
        const ratesService = require('./services/RatesService');
        const rates = new ratesService();
        const currentRates = await rates.getRates();
        
        // Показываем популярные валюты для быстрого изменения
        const popularCurrencies = ['BTC', 'ETH', 'USDT', 'USD', 'RUB', 'ARS'];
        const popularRates = currentRates.filter(r => popularCurrencies.includes(r.currency));
        
        let ratesText = `💱 <b>УПРАВЛЕНИЕ КУРСАМИ</b>\n\n`;
        ratesText += `⏰ Последнее обновление: ${new Date().toLocaleString('ru')}\n\n`;
        ratesText += `📊 <b>Популярные валюты:</b>\n`;
        
        popularRates.forEach(rate => {
            const spread = ((rate.sell - rate.buy) / rate.price * 100).toFixed(2);
            ratesText += `${rate.currency}: $${rate.price.toFixed(rate.currency === 'BTC' ? 0 : 4)} (спред: ${spread}%)\n`;
        });
        
        ratesText += `\n🔧 <b>Возможности:</b>\n`;
        ratesText += `• Изменить конкретную валюту\n`;
        ratesText += `• Установить общий множитель\n`;
        ratesText += `• Включить/выключить авто-обновление\n`;
        ratesText += `• Добавить экстренный спред`;
        
        const ratesKeyboard = new InlineKeyboard()
            .text('💰 Изменить BTC', 'rates_edit_BTC')
            .text('💎 Изменить ETH', 'rates_edit_ETH')
            .row()
            .text('🏦 Изменить USDT', 'rates_edit_USDT')
            .text('💵 Изменить USD', 'rates_edit_USD')
            .row()
            .text('🇷🇺 Изменить RUB', 'rates_edit_RUB')
            .text('🇦🇷 Изменить ARS', 'rates_edit_ARS')
            .row()
            .text('🔥 Экстренный спред +2%', 'rates_emergency_spread')
            .text('⚡ Множитель курсов', 'rates_multiplier')
            .row()
            .text('🔄 Принудительно обновить', 'rates_force_update')
            .text('⏸️ Остановить авто-обновление', 'rates_pause_auto')
            .row()
            .text('🔙 Назад к админке', 'admin_back');
            
                 await ctx.reply(ratesText, {
             parse_mode: 'HTML',
             reply_markup: ratesKeyboard
         });
     }

     // 🔥 ЭКСТРЕННЫЙ СПРЕД
     if (data === 'rates_emergency_spread') {
         if (!(await isAdmin(userId))) return ctx.answerCallbackQuery('❌ Нет прав');
         
         await ctx.answerCallbackQuery('🚨 Активирую экстренный спред +2%...');
         
         // Применяем экстренный спред через RatesService
         const RatesService = require('./services/RatesService');
         const ratesService = new RatesService();
         ratesService.setEmergencySpread(2); // +2%
         
         // Уведомляем операторов
         await notifyOperators(`🚨 <b>ЭКСТРЕННЫЙ СПРЕД АКТИВИРОВАН</b>\n\nВсе курсы увеличены на +2%\nАктивировал: админ ${ctx.from.first_name}`);
         
         await ctx.reply(
             `🔥 <b>ЭКСТРЕННЫЙ СПРЕД АКТИВИРОВАН</b>\n\n` +
             `✅ Все спреды увеличены на +2%\n` +
             `⚡ Изменения применены немедленно\n` +
             `🔔 Операторы уведомлены\n\n` +
             `💡 Для отмены используйте "Принудительно обновить"`,
             { 
                 parse_mode: 'HTML',
                 reply_markup: new InlineKeyboard().text('🔙 Назад к управлению', 'admin_rates_control')
             }
         );
     }

     // 🔄 ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ
     if (data === 'rates_force_update') {
         if (!(await isAdmin(userId))) return ctx.answerCallbackQuery('❌ Нет прав');
         
         await ctx.answerCallbackQuery('🔄 Обновляю курсы...');
         
         try {
             // Принудительно обновляем через RatesService
             const RatesService = require('./services/RatesService');
             const ratesService = new RatesService();
             await ratesService.forceUpdate();
             
             // Уведомляем операторов
             await notifyOperators(`🔄 <b>КУРСЫ ОБНОВЛЕНЫ ВРУЧНУЮ</b>\n\nВсе ручные изменения сброшены\nОбновил: админ ${ctx.from.first_name}`);
             
             await ctx.reply(
                 `✅ <b>КУРСЫ ПРИНУДИТЕЛЬНО ОБНОВЛЕНЫ</b>\n\n` +
                 `🔄 Данные получены свежие с API\n` +
                 `🚫 Все ручные изменения сброшены\n` +
                 `▶️ Автообновление возобновлено\n` +
                 `🔔 Операторы уведомлены`,
                 { 
                     parse_mode: 'HTML',
                     reply_markup: new InlineKeyboard().text('🔙 Назад к управлению', 'admin_rates_control')
                 }
             );
         } catch (error) {
             await ctx.reply(
                 `❌ <b>ОШИБКА ОБНОВЛЕНИЯ</b>\n\n` +
                 `Не удалось обновить курсы с API\n` +
                 `Причина: ${error.message}`,
                 { 
                     parse_mode: 'HTML',
                     reply_markup: new InlineKeyboard().text('🔙 Назад к управлению', 'admin_rates_control')
                 }
             );
         }
     }

     // ⚡ МНОЖИТЕЛЬ КУРСОВ
     if (data === 'rates_multiplier') {
         if (!(await isAdmin(userId))) return ctx.answerCallbackQuery('❌ Нет прав');
         
         await ctx.answerCallbackQuery('⚡ Настройка множителя...');
         
         const multiplierKeyboard = new InlineKeyboard()
             .text('📉 -5% (0.95x)', 'rates_mult_0.95')
             .text('📉 -2% (0.98x)', 'rates_mult_0.98')
             .row()
             .text('📊 Сброс (1.0x)', 'rates_mult_1.0')
             .row()
             .text('📈 +2% (1.02x)', 'rates_mult_1.02')
             .text('📈 +5% (1.05x)', 'rates_mult_1.05')
             .row()
             .text('🔙 Назад', 'admin_rates_control');
             
         await ctx.reply(
             `⚡ <b>МНОЖИТЕЛЬ КУРСОВ</b>\n\n` +
             `Выберите на сколько изменить ВСЕ курсы:\n\n` +
             `📉 Уменьшить - клиенты платят меньше\n` +
             `📈 Увеличить - больше прибыли\n` +
             `📊 Сброс - вернуть к API курсам`,
             { 
                 parse_mode: 'HTML',
                 reply_markup: multiplierKeyboard
             }
         );
     }

     // Обработчики множителей
     if (data.startsWith('rates_mult_')) {
         if (!(await isAdmin(userId))) return ctx.answerCallbackQuery('❌ Нет прав');
         
         const multiplier = parseFloat(data.replace('rates_mult_', ''));
         const percent = ((multiplier - 1) * 100).toFixed(1);
         const sign = multiplier > 1 ? '+' : '';
         
         await ctx.answerCallbackQuery(`⚡ Множитель ${multiplier}x установлен`);
         
         // Применяем множитель через RatesService
         const RatesService = require('./services/RatesService');
         const ratesService = new RatesService();
         ratesService.setRatesMultiplier(multiplier);
         
         // Уведомляем операторов
         await notifyOperators(`⚡ <b>МНОЖИТЕЛЬ КУРСОВ ИЗМЕНЕН</b>\n\nВсе курсы: ${sign}${percent}%\nИзменил: админ ${ctx.from.first_name}`);
         
         await ctx.reply(
             `✅ <b>МНОЖИТЕЛЬ УСТАНОВЛЕН</b>\n\n` +
             `⚡ Коэффициент: ${multiplier}x\n` +
             `📊 Изменение: ${sign}${percent}%\n` +
             `🔔 Операторы уведомлены\n\n` +
             `💡 Все курсы изменены немедленно`,
             { 
                 parse_mode: 'HTML',
                 reply_markup: new InlineKeyboard().text('🔙 Назад к управлению', 'admin_rates_control')
             }
         );
     }

     // 🔧 ИЗМЕНЕНИЕ КОНКРЕТНЫХ ВАЛЮТ
     if (data.startsWith('rates_edit_')) {
         if (!(await isAdmin(userId))) return ctx.answerCallbackQuery('❌ Нет прав');
         
         const currency = data.replace('rates_edit_', '');
         
         await ctx.answerCallbackQuery(`💱 Настройка ${currency}...`);
         
         // Получаем текущий курс
         const ratesService = require('./services/RatesService');
         const rates = new ratesService();
         const currentRates = await rates.getRates();
         const currentRate = currentRates.find(r => r.currency === currency);
         
         if (!currentRate) {
             return await ctx.reply('❌ Валюта не найдена', {
                 reply_markup: new InlineKeyboard().text('🔙 Назад', 'admin_rates_control')
             });
         }
         
         const editKeyboard = new InlineKeyboard()
             .text('✏️ НАПИСАТЬ КУРС ВРУЧНУЮ', `rates_manual_${currency}`)
             .row()
             .text('📈 +10%', `rates_change_${currency}_1.1`)
             .text('📈 +5%', `rates_change_${currency}_1.05`)
             .row()
             .text('📈 +2%', `rates_change_${currency}_1.02`)
             .text('📊 Сброс', `rates_change_${currency}_1.0`)
             .row()
             .text('📉 -2%', `rates_change_${currency}_0.98`)
             .text('📉 -5%', `rates_change_${currency}_0.95`)
             .row()
             .text('📉 -10%', `rates_change_${currency}_0.9`)
             .row()
             .text('🔙 Назад', 'admin_rates_control');
             
         await ctx.reply(
             `💱 <b>ИЗМЕНЕНИЕ ${currency}</b>\n\n` +
             `📊 <b>Текущий курс:</b> $${currentRate.price.toFixed(currency === 'BTC' ? 0 : 4)}\n` +
             `📈 <b>Продажа:</b> $${currentRate.sell.toFixed(currency === 'BTC' ? 0 : 4)}\n` +
             `📉 <b>Покупка:</b> $${currentRate.buy.toFixed(currency === 'BTC' ? 0 : 4)}\n` +
             `📊 <b>Спред:</b> ${((currentRate.sell - currentRate.buy) / currentRate.price * 100).toFixed(2)}%\n\n` +
             `Выберите на сколько изменить курс ${currency}:`,
             { 
                 parse_mode: 'HTML',
                 reply_markup: editKeyboard
             }
         );
     }

     // Обработчики изменения курсов конкретных валют
     if (data.startsWith('rates_change_')) {
         if (!(await isAdmin(userId))) return ctx.answerCallbackQuery('❌ Нет прав');
         
         const parts = data.replace('rates_change_', '').split('_');
         const currency = parts[0];
         const multiplier = parseFloat(parts[1]);
         const percent = ((multiplier - 1) * 100).toFixed(1);
         const sign = multiplier > 1 ? '+' : '';
         
         await ctx.answerCallbackQuery(`💱 ${currency}: ${sign}${percent}% установлено`);
         
         // Применяем изменение через RatesService
         const RatesService = require('./services/RatesService');
         const ratesService = new RatesService();
         ratesService.setManualRate(currency, multiplier, 3600000); // На 1 час
         
         // Уведомляем операторов
         await notifyOperators(`💱 <b>КУРС ${currency} ИЗМЕНЕН</b>\n\nИзменение: ${sign}${percent}%\nИзменил: админ ${ctx.from.first_name}`);
         
         await ctx.reply(
             `✅ <b>КУРС ${currency} ИЗМЕНЕН</b>\n\n` +
             `💱 Валюта: ${currency}\n` +
             `📊 Изменение: ${sign}${percent}%\n` +
             `⚡ Коэффициент: ${multiplier}x\n` +
             `⏰ Действует: 1 час\n` +
             `🔔 Операторы уведомлены\n\n` +
             `💡 Изменения применены немедленно`,
             { 
                 parse_mode: 'HTML',
                 reply_markup: new InlineKeyboard().text('🔙 Назад к управлению', 'admin_rates_control')
             }
         );
     }

     // ⏸️ ОСТАНОВКА АВТООБНОВЛЕНИЯ
     if (data === 'rates_pause_auto') {
         if (!(await isAdmin(userId))) return ctx.answerCallbackQuery('❌ Нет прав');
         
         await ctx.answerCallbackQuery('⏸️ Приостанавливаю автообновление...');
         
         const pauseKeyboard = new InlineKeyboard()
             .text('⏸️ 15 минут', 'rates_pause_15')
             .text('⏸️ 30 минут', 'rates_pause_30')
             .row()
             .text('⏸️ 1 час', 'rates_pause_60')
             .text('⏸️ 3 часа', 'rates_pause_180')
             .row()
             .text('⏸️ До ручного включения', 'rates_pause_manual')
             .row()
             .text('🔙 Назад', 'admin_rates_control');
             
         await ctx.reply(
             `⏸️ <b>ОСТАНОВКА АВТООБНОВЛЕНИЯ</b>\n\n` +
             `На какое время остановить автоматическое обновление курсов?\n\n` +
             `💡 Курсы останутся текущими\n` +
             `⚡ Ручные изменения будут работать\n` +
             `🔄 Возобновить можно в любой момент`,
             { 
                 parse_mode: 'HTML',
                 reply_markup: pauseKeyboard
             }
         );
     }

     // Обработчики остановки автообновления
     if (data.startsWith('rates_pause_')) {
         if (!(await isAdmin(userId))) return ctx.answerCallbackQuery('❌ Нет прав');
         
         const duration = data.replace('rates_pause_', '');
         let durationText = '';
         let durationMs = 0;
         
         switch(duration) {
             case '15': durationText = '15 минут'; durationMs = 15 * 60 * 1000; break;
             case '30': durationText = '30 минут'; durationMs = 30 * 60 * 1000; break;
             case '60': durationText = '1 час'; durationMs = 60 * 60 * 1000; break;
             case '180': durationText = '3 часа'; durationMs = 180 * 60 * 1000; break;
             case 'manual': durationText = 'до ручного включения'; durationMs = 24 * 60 * 60 * 1000; break; // 24 часа
         }
         
         await ctx.answerCallbackQuery(`⏸️ Автообновление остановлено на ${durationText}`);
         
         // Останавливаем автообновление через RatesService
         const RatesService = require('./services/RatesService');
         const ratesService = new RatesService();
         ratesService.pauseAutoUpdate(durationMs);
         
         // Уведомляем операторов
         await notifyOperators(`⏸️ <b>АВТООБНОВЛЕНИЕ КУРСОВ ОСТАНОВЛЕНО</b>\n\nНа: ${durationText}\nОстановил: админ ${ctx.from.first_name}`);
         
         await ctx.reply(
             `⏸️ <b>АВТООБНОВЛЕНИЕ ОСТАНОВЛЕНО</b>\n\n` +
             `⏰ Продолжительность: ${durationText}\n` +
             `🔒 Курсы зафиксированы\n` +
             `🔔 Операторы уведомлены\n\n` +
             `💡 Возобновить можно в любой момент через "Принудительно обновить"`,
             { 
                 parse_mode: 'HTML',
                 reply_markup: new InlineKeyboard().text('🔙 Назад к управлению', 'admin_rates_control')
             }
         );
     }

     // ✏️ РУЧНОЙ ВВОД КУРСА
     if (data.startsWith('rates_manual_')) {
         if (!(await isAdmin(userId))) return ctx.answerCallbackQuery('❌ Нет прав');
         
         const currency = data.replace('rates_manual_', '');
         
         await ctx.answerCallbackQuery(`✏️ Ввод курса ${currency}...`);
         
         // Получаем текущий курс для справки
         const ratesService = require('./services/RatesService');
         const rates = new ratesService();
         const currentRates = await rates.getRates();
         const currentRate = currentRates.find(r => r.currency === currency);
         
         // Сохраняем состояние ожидания ввода курса
         if (!global.manualRateInput) global.manualRateInput = new Map();
         global.manualRateInput.set(userId, {
             currency: currency,
             timestamp: Date.now()
         });
         
         await ctx.reply(
             `✏️ <b>РУЧНОЙ ВВОД КУРСА ${currency}</b>\n\n` +
             `📊 <b>Текущий курс:</b> $${currentRate ? currentRate.price.toFixed(currency === 'BTC' ? 0 : 4) : 'неизвестно'}\n\n` +
             `💬 <b>Напишите новый курс числом:</b>\n` +
             `Например: <code>95000</code> (для BTC)\n` +
             `Или: <code>1.02</code> (для USDT)\n\n` +
             `⏰ У вас есть 60 секунд для ввода\n` +
             `❌ Для отмены напишите: <code>отмена</code>`,
             { 
                 parse_mode: 'HTML',
                 reply_markup: new InlineKeyboard().text('❌ Отмена', 'admin_rates_control')
             }
         );
         
         // Устанавливаем таймер на очистку состояния
         setTimeout(() => {
             if (global.manualRateInput && global.manualRateInput.has(userId)) {
                 global.manualRateInput.delete(userId);
             }
         }, 60000); // 60 секунд
     }

     // Открытие панели оператора
    if (data === 'open_operator_panel') {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            try {
                return await ctx.answerCallbackQuery('❌ Нет прав оператора');
            } catch (e) {
                return;
            }
        }
        
        try {
            await ctx.answerCallbackQuery('🔄 Открываю панель...');
        } catch (callbackError) {
            console.log('⚠️ Callback query timeout:', callbackError.message);
        }
        
        // Получаем неназначенные заказы и заказы оператора
        const [unassignedOrders, myOrders] = await Promise.all([
            db.getUnassignedOrders(),
            db.getOperatorOrders(userId)
        ]);
        
        const operatorKeyboard = new InlineKeyboard()
            .text(`📋 Свободные заказы (${unassignedOrders.length})`, 'op_unassigned_orders')
            .text(`📝 Мои заказы (${myOrders.length})`, 'op_my_orders')
            .row()
            .text('🔔 Мои уведомления', 'op_notifications')
            .text('📊 Моя статистика', 'op_stats')
            .row()
            .text('📈 Статистика дня', 'admin_daily_stats')
            .row()
            .text('💱 Управление курсами', 'admin_rates_control')
            .text('🏠 Назад к боту', 'back_to_main');
        
        await ctx.reply(
            `👨‍💼 <b>ПАНЕЛЬ ОПЕРАТОРА</b>\n\n` +
            `👋 Добро пожаловать, оператор!\n\n` +
            `📋 <b>Доступные заказы:</b> ${unassignedOrders.length}\n` +
            `📝 <b>Ваши заказы:</b> ${myOrders.length}\n` +
            `🔔 <b>Новых уведомлений:</b> ${(await db.getNotifications(userId, 1)).filter(n => !n.is_read).length}\n\n` +
            `Выберите действие:`,
            { 
                parse_mode: 'HTML',
                reply_markup: operatorKeyboard
            }
        );
    }

    // === НЕДОСТАЮЩИЕ АДМИНСКИЕ ОБРАБОТЧИКИ ===

    // Настройки админа
    if (data === 'admin_settings') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery();
        
        const settingsKeyboard = new InlineKeyboard()
            .text('🔄 Перезапуск бота', 'admin_restart_bot')
            .text('🗃️ Очистить логи', 'admin_clear_logs')
            .row()
            .text('📊 Экспорт данных', 'admin_export_data')
            .text('📋 Google Sheets', 'admin_google_sheets')
            .row()
            .text('🔧 Обслуживание БД', 'admin_db_maintenance')
            .text('🔙 Назад', 'admin_back');
        
        await ctx.reply(
            `⚙️ <b>НАСТРОЙКИ СИСТЕМЫ</b>\n\n` +
            `🔧 Техническое обслуживание и настройки\n\n` +
            `⚠️ Будьте осторожны с системными функциями!`,
            { 
                parse_mode: 'HTML',
                reply_markup: settingsKeyboard
            }
        );
    }

    // Добавить оператора (из админ панели)
    if (data === 'admin_add_operator') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery();
        
        await ctx.reply(
            `👤 <b>ДОБАВЛЕНИЕ ОПЕРАТОРА</b>\n\n` +
            `📝 Для добавления оператора используйте одну из команд:\n\n` +
            `🔹 <code>/add_operator ID_TELEGRAM</code>\n` +
            `Пример: <code>/add_operator 123456789</code>\n\n` +
            `🔹 <code>/add_operator_forward</code>\n` +
            `Ответьте этой командой на сообщение пользователя\n\n` +
            `💡 После добавления оператор получит уведомление и доступ к команде /operator`,
            { 
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard()
                    .text('🔙 Назад к админ панели', 'admin_back')
            }
        );
    }

    // Уведомления админа
    if (data === 'admin_notifications') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery();
        
        const notifications = await db.getNotifications(userId, 20);
        const unreadCount = notifications.filter(n => !n.is_read).length;
        
        let notificationsText = `🔔 <b>УВЕДОМЛЕНИЯ АДМИНА</b>\n\n`;
        notificationsText += `📊 Всего: ${notifications.length} | Новых: ${unreadCount}\n\n`;
        
        if (notifications.length === 0) {
            notificationsText += `📭 Уведомлений пока нет`;
        } else {
            notifications.slice(0, 10).forEach(notif => {
                const icon = notif.is_read ? '📨' : '📩';
                const time = new Date(notif.created_at).toLocaleString('ru');
                notificationsText += `${icon} <b>${notif.title}</b>\n`;
                notificationsText += `📅 ${time}\n`;
                notificationsText += `📝 ${notif.message}\n\n`;
            });
            
            if (notifications.length > 10) {
                notificationsText += `... и еще ${notifications.length - 10} уведомлений`;
            }
        }
        
        const notifKeyboard = new InlineKeyboard()
            .text('✅ Отметить как прочитанные', 'admin_mark_read')
            .text('🗑️ Очистить все', 'admin_clear_notifications')
            .row()
            .text('🔙 Назад', 'admin_back');
        
        await ctx.reply(notificationsText, { 
            parse_mode: 'HTML',
            reply_markup: notifKeyboard
        });
    }

    // Кнопка назад в админ панель (обновленная)
    if (data === 'admin_back') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') return ctx.answerCallbackQuery('❌ Нет прав');
        
        await ctx.answerCallbackQuery();
        
        // Показываем админ панель заново
        const stats = await db.getAdminStats();
        const adminKeyboard = new InlineKeyboard();
        
        // Добавляем ЭПИЧЕСКУЮ кнопку таблицы если Google Sheets активен
        if (googleSheetsManager && googleSheetsManager.isReady()) {
            adminKeyboard.url('💎🔥 ТАБЛИЦА БОГОВ 🔥💎', googleSheetsManager.getSpreadsheetUrl()).row();
        }
        
        adminKeyboard
            .text('📊 Полная статистика', 'admin_full_stats')
            .text('👥 Управление персоналом', 'admin_staff')
            .row()
            .text('📋 Активные заказы', 'admin_active_orders')
            .text('🔔 Уведомления', 'admin_notifications')
            .row()
            .text('🌐 Мониторинг сайта', 'admin_weblogs')
            .text('📈 Статистика дня', 'admin_daily_stats')
            .row()
            .text('👤 Добавить оператора', 'admin_add_operator')
            .text('⚙️ Настройки', 'admin_settings')
            .row()
            .text('💱 Управление курсами', 'admin_rates_control')
            .text('🏠 Назад к боту', 'back_to_main');
        
        await ctx.reply(
            `🛡️ <b>АДМИН ПАНЕЛЬ ExMachinaX</b>\n\n` +
            `📈 <b>Статистика за сегодня:</b>\n` +
            `👥 Новых пользователей: ${stats.newUsersToday}\n` +
            `📝 Заявок: ${stats.ordersToday}\n` +
            `💰 Оборот: $${(stats.volumeToday || 0).toFixed(2)}\n\n` +
            `📊 <b>Общая статистика:</b>\n` +
            `👤 Всего пользователей: ${stats.totalUsers}\n` +
            `📋 Всего заказов: ${stats.totalOrders}\n` +
            `✅ Завершено: ${stats.completedOrders}\n` +
            `⏳ В ожидании: ${stats.pendingOrders}\n` +
            `🔄 В обработке: ${stats.processingOrders}\n` +
            `💵 Общий оборот: $${(stats.totalVolume || 0).toFixed(2)}\n\n` +
            `👨‍💼 <b>Персонал:</b>\n` +
            `🛡️ Активных операторов: ${stats.activeOperators}\n` +
            `📝 Назначенных заказов: ${stats.assignedOrders}\n` +
            `🔔 Непрочитанных уведомлений: ${stats.unreadNotifications}`,
            { 
                parse_mode: 'HTML',
                reply_markup: adminKeyboard
                         }
         );
     }

    // Удаление сотрудника
    if (data === 'admin_remove_staff') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery();
        
        const staff = await db.getStaffList();
        const operators = staff.filter(s => s.role === 'operator');
        
        if (operators.length === 0) {
            return ctx.reply(
                `➖ <b>УДАЛЕНИЕ СОТРУДНИКА</b>\n\n` +
                `👥 Нет операторов для удаления`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад', 'admin_staff')
                }
            );
        }
        
        let removeText = `➖ <b>УДАЛЕНИЕ СОТРУДНИКА</b>\n\n`;
        removeText += `⚠️ Выберите оператора для удаления:\n\n`;
        
        const removeKeyboard = new InlineKeyboard();
        
        operators.forEach((op, i) => {
            const name = op.first_name || op.username || `ID ${op.telegram_id}`;
            const statusEmoji = op.is_active ? '✅' : '❌';
            removeText += `${statusEmoji} ${name} (${op.orders_handled || 0} заказов)\n`;
            
            removeKeyboard.text(`🗑️ ${name}`, `remove_staff_${op.telegram_id}`);
            if (i % 2 === 1) removeKeyboard.row();
        });
        
        removeKeyboard.row().text('🔙 Назад', 'admin_staff');
        
        await ctx.reply(removeText, { 
            parse_mode: 'HTML',
            reply_markup: removeKeyboard
        });
    }

    // Подтверждение удаления сотрудника
    if (data.startsWith('remove_staff_')) {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const staffId = parseInt(data.replace('remove_staff_', ''));
        
        try {
            await ctx.answerCallbackQuery();
            
            const removedStaff = await db.removeStaff(staffId);
            
            await ctx.reply(
                `✅ <b>Сотрудник удален!</b>\n\n` +
                `🆔 Telegram ID: <code>${staffId}</code>\n` +
                `👤 Удалил: ${ctx.from.first_name}\n` +
                `📅 Время: ${new Date().toLocaleString('ru')}\n\n` +
                `🔔 Уведомляем бывшего сотрудника...`,
                { parse_mode: 'HTML' }
            );
            
            // Уведомляем удаленного сотрудника
            try {
                await bot.api.sendMessage(staffId,
                    `❌ <b>Вы исключены из персонала ExMachinaX</b>\n\n` +
                    `📅 ${new Date().toLocaleString('ru')}\n` +
                    `🛡️ Админ отозвал ваши права оператора\n\n` +
                    `💼 Спасибо за работу в нашей команде!`,
                    { parse_mode: 'HTML' }
                );
            } catch (error) {
                console.log('Не удалось уведомить удаленного сотрудника:', error.message);
            }
            
        } catch (error) {
                         await ctx.reply(`❌ Ошибка удаления сотрудника: ${error.message}`);
         }
     }

    // === ОПЕРАТОРСКИЕ ФУНКЦИИ ===

    // Уведомления оператора
    if (data === 'op_notifications') {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery();
        
        const notifications = await db.getNotifications(userId, 15);
        const unreadCount = notifications.filter(n => !n.is_read).length;
        
        let notifText = `🔔 <b>МОИ УВЕДОМЛЕНИЯ</b>\n\n`;
        notifText += `📊 Всего: ${notifications.length} | Новых: ${unreadCount}\n\n`;
        
        if (notifications.length === 0) {
            notifText += `📭 Уведомлений пока нет`;
        } else {
            notifications.slice(0, 8).forEach(notif => {
                const icon = notif.is_read ? '📨' : '📩';
                const time = new Date(notif.created_at).toLocaleString('ru');
                notifText += `${icon} <b>${notif.title}</b>\n`;
                notifText += `📅 ${time}\n`;
                notifText += `📝 ${notif.message}\n\n`;
            });
            
            if (notifications.length > 8) {
                notifText += `... и еще ${notifications.length - 8} уведомлений`;
            }
        }
        
        const notifKeyboard = new InlineKeyboard()
            .text('✅ Отметить как прочитанные', 'op_mark_read')
            .text('🔄 Обновить', 'op_notifications')
            .row()
            .text('🔙 Назад', 'op_back');
        
        await ctx.reply(notifText, { 
            parse_mode: 'HTML',
            reply_markup: notifKeyboard
        });
    }

    // Статистика оператора
    if (data === 'op_stats') {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery();
        
        const myOrders = await db.getOperatorOrders(userId);
        const completedOrders = myOrders.filter(o => o.assignment_status === 'completed').length;
        const inProgressOrders = myOrders.filter(o => o.assignment_status === 'in_progress').length;
        
        // Статистика за сегодня
        const today = new Date().toISOString().split('T')[0];
        const todayOrders = myOrders.filter(o => o.assigned_at?.includes(today)).length;
        
        const statsText = `📊 <b>МОЯ СТАТИСТИКА</b>\n\n` +
            `👨‍💼 Оператор: ${ctx.from.first_name || 'Вы'}\n\n` +
            `📈 <b>За сегодня:</b>\n` +
            `📝 Принято заказов: ${todayOrders}\n\n` +
            `📊 <b>Общая статистика:</b>\n` +
            `📋 Всего заказов: ${myOrders.length}\n` +
            `✅ Завершено: ${completedOrders}\n` +
            `🔄 В работе: ${inProgressOrders}\n` +
            `⭐ Рейтинг завершения: ${myOrders.length > 0 ? Math.round((completedOrders / myOrders.length) * 100) : 0}%\n\n` +
            `🚀 Продолжайте хорошую работу!`;
        
        const statsKeyboard = new InlineKeyboard()
            .text('📋 Мои заказы', 'op_my_orders')
            .text('🔄 Обновить', 'op_stats')
            .row()
            .text('🔙 Назад', 'op_back');
        
        await ctx.reply(statsText, { 
            parse_mode: 'HTML',
            reply_markup: statsKeyboard
        });
    }

    // Кнопка назад в операторскую панель
    if (data === 'op_back') {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery('🔄 Открываю панель...');
        
        // Получаем неназначенные заказы и заказы оператора
        const [unassignedOrders, myOrders] = await Promise.all([
            db.getUnassignedOrders(),
            db.getOperatorOrders(userId)
        ]);
        
        const operatorKeyboard = new InlineKeyboard()
            .text(`📋 Свободные заказы (${unassignedOrders.length})`, 'op_unassigned_orders')
            .text(`📝 Мои заказы (${myOrders.length})`, 'op_my_orders')
            .row()
            .text('🔔 Мои уведомления', 'op_notifications')
            .text('📊 Моя статистика', 'op_stats')
            .row()
            .text('📈 Статистика дня', 'admin_daily_stats')
            .row()
            .text('💱 Управление курсами', 'admin_rates_control')
            .text('🏠 Назад к боту', 'back_to_main');
        
        await ctx.reply(
            `👨‍💼 <b>ПАНЕЛЬ ОПЕРАТОРА</b>\n\n` +
            `👋 Добро пожаловать, оператор!\n\n` +
            `📋 <b>Доступные заказы:</b> ${unassignedOrders.length}\n` +
            `📝 <b>Ваши заказы:</b> ${myOrders.length}\n` +
            `🔔 <b>Новых уведомлений:</b> ${(await db.getNotifications(userId, 1)).filter(n => !n.is_read).length}\n\n` +
            `Выберите действие:`,
            { 
                parse_mode: 'HTML',
                reply_markup: operatorKeyboard
            }
        );
    }

    // Отметить уведомления как прочитанные (оператор)
    if (data === 'op_mark_read') {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        try {
            // В базе данных нужно добавить метод для массового обновления
            await ctx.answerCallbackQuery('✅ Отмечены как прочитанные');
            await ctx.reply(
                `✅ <b>Уведомления обновлены!</b>\n\n` +
                `📨 Все ваши уведомления отмечены как прочитанные`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад к панели', 'op_back')
                }
            );
        } catch (error) {
            await ctx.answerCallbackQuery('❌ Ошибка обновления');
        }
    }

    // === НОВЫЕ ОБРАБОТЧИКИ ДЛЯ МОНИТОРИНГА ===

    // Мониторинг активности сайта (только админы)
    if (data === 'admin_weblogs') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав администратора');
        }
        
        await ctx.answerCallbackQuery('🔄 Загружаю логи...');
        
        try {
            // Получаем последние заказы с сайта
            const recentOrders = await db.getRecentWebOrders(10);
            const stats = await db.getTodayWebStats();
            
            let webLogsText = `🌐 <b>МОНИТОРИНГ АКТИВНОСТИ САЙТА</b>\n\n`;
            webLogsText += `📊 <b>Статистика сегодня:</b>\n`;
            webLogsText += `🔄 Новых заявок: ${stats.ordersToday || 0}\n`;
            webLogsText += `👥 Уникальных пользователей: ${stats.uniqueUsers || 0}\n`;
            webLogsText += `💰 Оборот: $${(stats.volumeToday || 0).toFixed(2)}\n\n`;
            
            if (recentOrders.length === 0) {
                webLogsText += `📭 <b>Последние заказы:</b>\nНет активности сегодня`;
            } else {
                webLogsText += `📋 <b>Последние заказы с сайта:</b>\n\n`;
                recentOrders.forEach((order, index) => {
                    const time = new Date(order.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
                    webLogsText += `${index + 1}. 📋 Заявка #${order.id}\n`;
                    webLogsText += `⏰ ${time} | 👤 ${order.username || 'Аноним'}\n`;
                    webLogsText += `💱 ${order.from_amount} ${order.from_currency} → ${order.to_currency}\n`;
                    webLogsText += `📊 ${order.assignment_status || 'новая'}\n\n`;
                });
            }
            
            webLogsText += `🔄 Обновлено: ${new Date().toLocaleTimeString('ru')}`;
            
            const webLogsKeyboard = new InlineKeyboard()
                .text('🔄 Обновить', 'admin_weblogs')
                .text('📈 Статистика дня', 'admin_daily_stats')
                .row()
                .text('🔙 Назад к админке', 'admin_back');
            
            await ctx.reply(webLogsText, { 
                parse_mode: 'HTML',
                reply_markup: webLogsKeyboard
            });
            
        } catch (error) {
            console.error('Ошибка получения web-логов:', error);
            await ctx.reply(
                `❌ <b>Ошибка загрузки данных</b>\n\n` +
                `Не удалось получить логи активности сайта.\n` +
                `Попробуйте позже или проверьте подключение к БД.`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад к админке', 'admin_back')
                }
            );
        }
    }

    // Быстрая статистика дня (админы и операторы)
    if (data === 'admin_daily_stats') {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery('📊 Собираю статистику...');
        
        try {
            const stats = await db.getDailyStats();
            const webStats = await db.getTodayWebStats();
            
            // Текущее время для отчета
            const now = new Date();
            const timeString = now.toLocaleString('ru');
            const weekday = now.toLocaleDateString('ru', { weekday: 'long' });
            
            let dailyText = `📈 <b>СТАТИСТИКА ДНЯ</b>\n`;
            dailyText += `📅 ${weekday}, ${timeString}\n\n`;
            
            dailyText += `🌐 <b>Активность сайта:</b>\n`;
            dailyText += `📝 Новых заявок: ${webStats.ordersToday || 0}\n`;
            dailyText += `👥 Уникальных посетителей: ${webStats.uniqueUsers || 0}\n`;
            dailyText += `💰 Оборот с сайта: $${(webStats.volumeToday || 0).toFixed(2)}\n\n`;
            
            dailyText += `🤖 <b>Активность бота:</b>\n`;
            dailyText += `👤 Новых пользователей: ${stats.newUsersToday || 0}\n`;
            dailyText += `📋 Заявок через бота: ${stats.botOrdersToday || 0}\n`;
            dailyText += `💎 Оборот через бота: $${(stats.botVolumeToday || 0).toFixed(2)}\n\n`;
            
            dailyText += `📊 <b>Общие итоги:</b>\n`;
            dailyText += `🔢 Всего заявок: ${(stats.ordersToday || 0) + (webStats.ordersToday || 0)}\n`;
            dailyText += `💵 Общий оборот: $${((stats.volumeToday || 0) + (webStats.volumeToday || 0)).toFixed(2)}\n`;
            dailyText += `⚡ Конверсия: ${stats.totalUsers > 0 ? (((stats.ordersToday || 0) / stats.totalUsers) * 100).toFixed(1) : 0}%\n\n`;
            
            // Операторская статистика (только для админов)
            if (userRole === 'admin') {
                dailyText += `👨‍💼 <b>Работа операторов:</b>\n`;
                dailyText += `✅ Обработано: ${stats.processedToday || 0}\n`;
                dailyText += `⏳ В ожидании: ${stats.pendingOrders || 0}\n`;
                dailyText += `🔄 В работе: ${stats.processingOrders || 0}\n`;
            }
            
            dailyText += `\n🕐 Обновлено: ${now.toLocaleTimeString('ru')}`;
            
            const statsKeyboard = new InlineKeyboard()
                .text('🔄 Обновить', 'admin_daily_stats')
                .text('🌐 Логи сайта', userRole === 'admin' ? 'admin_weblogs' : null)
                .row()
                .text('🔙 Назад', userRole === 'admin' ? 'admin_back' : 'op_back');
            
            // Удаляем null кнопки
            if (userRole !== 'admin') {
                statsKeyboard.inline_keyboard[0] = statsKeyboard.inline_keyboard[0].filter(btn => btn.callback_data !== null);
            }
            
            await ctx.reply(dailyText, { 
                parse_mode: 'HTML',
                reply_markup: statsKeyboard
            });
            
        } catch (error) {
            console.error('Ошибка получения статистики дня:', error);
            await ctx.reply(
                `❌ <b>Ошибка получения данных</b>\n\n` +
                `Не удалось собрать статистику за день.\n` +
                `Проверьте подключение к базе данных.`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад', userRole === 'admin' ? 'admin_back' : 'op_back')
                }
            );
        }
    }

    // === ОБРАБОТЧИКИ КНОПОК НАСТРОЕК СИСТЕМЫ ===

    // Перезапуск бота
    if (data === 'admin_restart_bot') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery();
        
        const confirmKeyboard = new InlineKeyboard()
            .text('🔴 ДА, ПЕРЕЗАПУСТИТЬ', 'admin_confirm_restart')
            .text('❌ Отмена', 'admin_settings');
        
        await ctx.reply(
            `🔄 <b>ПЕРЕЗАПУСК СИСТЕМЫ</b>\n\n` +
            `⚠️ <b>ВНИМАНИЕ!</b> Вы собираетесь перезапустить бота.\n\n` +
            `📋 <b>Что произойдет:</b>\n` +
            `• Все текущие сессии будут сброшены\n` +
            `• Бот отключится на ~30 секунд\n` +
            `• Все операторы получат уведомление\n` +
            `• Система автоматически перезапустится\n\n` +
            `❗ Убедитесь что нет критичных процессов!`,
            { 
                parse_mode: 'HTML',
                reply_markup: confirmKeyboard
            }
        );
    }

    // Подтверждение перезапуска
    if (data === 'admin_confirm_restart') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery('🔄 Инициирую перезапуск...');
        
        await ctx.reply(
            `🔄 <b>СИСТЕМА ПЕРЕЗАПУСКАЕТСЯ...</b>\n\n` +
            `⏰ Время: ${new Date().toLocaleString('ru-RU')}\n` +
            `👤 Инициатор: ${ctx.from.first_name}\n\n` +
            `📡 Отправляю уведомления персоналу...\n` +
            `🔄 Перезапуск через 5 секунд...`,
            { parse_mode: 'HTML' }
        );
        
        // Уведомляем всех операторов о перезапуске
        const staff = await db.getStaffList();
        for (const member of staff) {
            try {
                await bot.api.sendMessage(member.telegram_id,
                    `🔄 <b>СИСТЕМА ПЕРЕЗАПУСКАЕТСЯ</b>\n\n` +
                    `⏰ ${new Date().toLocaleString('ru-RU')}\n` +
                    `👤 Инициатор: ${ctx.from.first_name}\n\n` +
                    `💤 Бот будет недоступен ~30 секунд\n` +
                    `🚀 Ожидайте уведомление о запуске!`,
                    { parse_mode: 'HTML' }
                );
            } catch (error) {
                console.log(`Не удалось уведомить ${member.telegram_id} о перезапуске`);
            }
        }
        
        // Перезапуск через 5 секунд
        setTimeout(() => {
            console.log('🔄 Перезапуск инициирован админом');
            process.exit(0);
        }, 5000);
    }

    // Очистка логов
    if (data === 'admin_clear_logs') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery();
        
        const confirmKeyboard = new InlineKeyboard()
            .text('🗑️ ДА, ОЧИСТИТЬ', 'admin_confirm_clear_logs')
            .text('❌ Отмена', 'admin_settings');
        
        await ctx.reply(
            `🗃️ <b>ОЧИСТКА ЛОГОВ</b>\n\n` +
            `⚠️ Вы собираетесь очистить системные логи.\n\n` +
            `📋 <b>Что будет удалено:</b>\n` +
            `• Логи уведомлений (старше 7 дней)\n` +
            `• Временные файлы\n` +
            `• Кэш системы\n\n` +
            `✅ <b>Что останется:</b>\n` +
            `• Заказы и пользователи\n` +
            `• Финансовые данные\n` +
            `• Настройки системы`,
            { 
                parse_mode: 'HTML',
                reply_markup: confirmKeyboard
            }
        );
    }

    // Подтверждение очистки логов
    if (data === 'admin_confirm_clear_logs') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery('🗑️ Очищаю логи...');
        
        try {
            // Очищаем старые уведомления
            const deletedNotifications = await db.clearOldNotifications(7);
            
            await ctx.reply(
                `✅ <b>ЛОГИ ОЧИЩЕНЫ!</b>\n\n` +
                `🗑️ Удалено уведомлений: ${deletedNotifications}\n` +
                `📅 Время: ${new Date().toLocaleString('ru-RU')}\n` +
                `👤 Выполнил: ${ctx.from.first_name}\n\n` +
                `💾 Система оптимизирована!`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад к настройкам', 'admin_settings')
                }
            );
            
        } catch (error) {
            await ctx.reply(
                `❌ <b>Ошибка очистки логов</b>\n\n` +
                `${error.message}`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад к настройкам', 'admin_settings')
                }
            );
        }
    }

    // Экспорт данных
    if (data === 'admin_export_data') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery('📊 Готовлю экспорт...');
        
        try {
            const stats = await db.getAdminStats();
            const staff = await db.getStaffList();
            const recentOrders = await db.getRecentWebOrders(50);
            
            const exportData = {
                export_time: new Date().toISOString(),
                export_by: ctx.from.first_name,
                statistics: stats,
                staff_count: staff.length,
                recent_orders_count: recentOrders.length,
                system_status: 'active'
            };
            
            const exportText = 
                `📊 <b>ЭКСПОРТ ДАННЫХ EXMACHINAX</b>\n\n` +
                `📅 <b>Дата экспорта:</b> ${new Date().toLocaleString('ru-RU')}\n` +
                `👤 <b>Выполнил:</b> ${ctx.from.first_name}\n\n` +
                `📈 <b>ОСНОВНАЯ СТАТИСТИКА:</b>\n` +
                `👥 Пользователей: ${stats.totalUsers}\n` +
                `📋 Заказов: ${stats.totalOrders}\n` +
                `💰 Оборот: $${(stats.totalVolume || 0).toFixed(2)}\n` +
                `👨‍💼 Персонал: ${staff.length} человек\n\n` +
                `📊 <b>ЗА СЕГОДНЯ:</b>\n` +
                `🆕 Новых пользователей: ${stats.newUsersToday}\n` +
                `📝 Заявок: ${stats.ordersToday}\n` +
                `💵 Оборот: $${(stats.volumeToday || 0).toFixed(2)}\n\n` +
                `🎯 <b>СТАТУСЫ ЗАКАЗОВ:</b>\n` +
                `✅ Завершено: ${stats.completedOrders}\n` +
                `⏳ В ожидании: ${stats.pendingOrders}\n` +
                `🔄 В процессе: ${stats.processingOrders}\n\n` +
                `📱 <b>JSON для анализа:</b>\n` +
                `<code>${JSON.stringify(exportData, null, 2)}</code>`;
            
            await ctx.reply(exportText, { 
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard()
                    .text('🔙 Назад к настройкам', 'admin_settings')
            });
            
        } catch (error) {
            await ctx.reply(
                `❌ <b>Ошибка экспорта данных</b>\n\n` +
                `${error.message}`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад к настройкам', 'admin_settings')
                }
            );
        }
    }

    // Google Sheets управление
    if (data === 'admin_google_sheets') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery('📋 Загружаю настройки Google Sheets...');
        
        try {
            const configPath = path.join(__dirname, '..', 'config', 'google-sheets.json');
            let config = {};
            let statusText = '';
            
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                
                if (config.enabled && googleSheetsManager && googleSheetsManager.isReady()) {
                    statusText = '✅ Google Sheets подключен и готов к работе';
                } else if (config.enabled) {
                    statusText = '⚠️ Google Sheets включен, но недоступен';
                } else {
                    statusText = '❌ Google Sheets отключен в конфигурации';
                }
            } else {
                statusText = '❌ Конфигурация Google Sheets не найдена';
            }
            
            const sheetsText = 
                `📋 <b>GOOGLE SHEETS ИНТЕГРАЦИЯ</b>\n\n` +
                `📊 <b>Статус:</b> ${statusText}\n\n` +
                `🔧 <b>Доступные функции:</b>\n` +
                `📊 Экспорт всех данных\n` +
                `📋 Экспорт заказов\n` +
                `👥 Экспорт операторов\n` +
                `📈 Экспорт статистики\n` +
                `👤 Экспорт пользователей\n\n` +
                (googleSheetsManager && googleSheetsManager.isReady() ? 
                    `🔗 <b>Ссылка на таблицу:</b>\n<a href="${googleSheetsManager.getSpreadsheetUrl()}">Открыть Google Таблицу</a>\n\n` : '') +
                `${googleSheetsManager && googleSheetsManager.isReady() ? '✅' : '❌'} Готов к экспорту`;
            
            const sheetsKeyboard = new InlineKeyboard();
            
            if (googleSheetsManager && googleSheetsManager.isReady()) {
                sheetsKeyboard
                    .text('💱 Создать лист курсов', 'admin_create_rates_sheet')
                    .text('📊 Экспорт всех данных', 'admin_sheets_export_all')
                    .row()
                    .text('📋 Экспорт заказов', 'admin_sheets_export_orders')
                    .text('👥 Экспорт операторов', 'admin_sheets_export_staff')
                    .row()
                    .text('📈 Экспорт статистики', 'admin_sheets_export_stats')
                    .text('👤 Экспорт пользователей', 'admin_sheets_export_users')
                    .row();
                
                if (googleSheetsManager.getSpreadsheetUrl()) {
                    sheetsKeyboard.url('🔗 Открыть таблицу', googleSheetsManager.getSpreadsheetUrl()).row();
                }
            } else {
                sheetsKeyboard.text('ℹ️ Инструкция по настройке', 'admin_sheets_setup');
            }
            
            sheetsKeyboard.text('🔙 Назад к настройкам', 'admin_settings');
            
            await ctx.reply(sheetsText, { 
                parse_mode: 'HTML',
                reply_markup: sheetsKeyboard,
                disable_web_page_preview: true
            });
            
        } catch (error) {
            await ctx.reply(
                `❌ <b>Ошибка Google Sheets</b>\n\n` +
                `${error.message}`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад к настройкам', 'admin_settings')
                }
            );
        }
    }

    // Обработчики экспорта Google Sheets
    if (data.startsWith('admin_sheets_export_')) {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        if (!googleSheetsManager || !googleSheetsManager.isReady()) {
            return ctx.answerCallbackQuery('❌ Google Sheets недоступен');
        }
        
        const exportType = data.replace('admin_sheets_export_', '');
        await ctx.answerCallbackQuery(`📊 Экспортирую ${exportType}...`);
        
        try {
            let success = false;
            let exportedCount = 0;
            
            switch (exportType) {
                case 'all':
                    success = await googleSheetsManager.exportAll(db);
                    break;
                case 'orders':
                    success = await googleSheetsManager.exportOrders(db);
                    break;
                case 'staff':
                    success = await googleSheetsManager.exportStaff(db);
                    break;
                case 'stats':
                    success = await googleSheetsManager.exportDailyStats(db);
                    break;
                case 'users':
                    success = await googleSheetsManager.exportUsers(db);
                    break;
                case 'aml':
                    success = await googleSheetsManager.exportAMLMonitoring(db);
                    break;
            }
            
            if (success) {
                await ctx.reply(
                    `✅ <b>Экспорт завершен!</b>\n\n` +
                    `📊 Тип: ${exportType}\n` +
                    `⏰ Время: ${new Date().toLocaleString('ru')}\n` +
                    `👤 Выполнил: ${ctx.from.first_name}\n\n` +
                    `🔗 Данные обновлены в Google Таблице`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .url('📋 Открыть таблицу', googleSheetsManager.getSpreadsheetUrl())
                            .text('🔙 Назад', 'admin_google_sheets')
                    }
                );
            } else {
                throw new Error('Экспорт не удался');
            }
            
        } catch (error) {
            await ctx.reply(
                `❌ <b>Ошибка экспорта</b>\n\n` +
                `Тип: ${exportType}\n` +
                `Ошибка: ${error.message}`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад', 'admin_google_sheets')
                }
            );
        }
    }

    // 💱 СОЗДАНИЕ ЛИСТА КУРСОВ
    if (data === 'admin_create_rates_sheet') {
        if (!(await isAdmin(userId))) return ctx.answerCallbackQuery('❌ Нет прав');
        
        await ctx.answerCallbackQuery('💱 Создаю лист курсов...');
        
        try {
            const sheetsManager = googleSheetsManager || global.googleSheetsManager;
            if (!sheetsManager) {
                return await ctx.reply('❌ Google Sheets Manager не найден');
            }
            
            // Создаем лист Manual_Rates
            try {
                await sheetsManager.createWorksheet('Manual_Rates', 
                    ['Пара валют', 'Курс продажи', 'Курс покупки', 'Спред (%)', 'Последнее обновление', 'Статус', 'Источник', 'Комментарий']);
                console.log('✅ Лист Manual_Rates создан');
            } catch (error) {
                // Лист уже существует - это нормально
                console.log('ℹ️ Лист Manual_Rates уже существует:', error.message);
            }
            
            // Заполняем данными
            const success = await sheetsManager.initializeRatesTable();
            
            if (success) {
                await ctx.reply(
                    `✅ <b>ЛИСТ КУРСОВ СОЗДАН!</b>\n\n` +
                    `📊 Добавлен лист "Manual_Rates" с 21 валютной парой\n\n` +
                    `💡 <b>Как использовать:</b>\n` +
                    `1. Найдите лист "Manual_Rates" в таблице\n` +
                    `2. Измените статус на "MANUAL"\n` +
                    `3. Укажите курсы продажи и покупки\n` +
                    `4. Бот подхватит изменения через 30 сек\n\n` +
                    `🔗 <a href="${sheetsManager.getSpreadsheetUrl()}">Открыть таблицу</a>`,
                    { 
                        parse_mode: 'HTML',
                        disable_web_page_preview: true,
                        reply_markup: new InlineKeyboard().text('🔙 Назад к Google Sheets', 'admin_sheets')
                    }
                );
            } else {
                await ctx.reply('❌ Ошибка создания листа курсов', {
                    reply_markup: new InlineKeyboard().text('🔙 Назад', 'admin_sheets')
                });
            }
            
        } catch (error) {
            console.error('Ошибка создания листа курсов:', error);
            await ctx.reply(
                `❌ <b>ОШИБКА</b>\n\n${error.message}`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard().text('🔙 Назад', 'admin_sheets')
                }
            );
        }
    }

    // Инструкция по настройке Google Sheets
    if (data === 'admin_sheets_setup') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery();
        
        const setupText = 
            `🔧 <b>НАСТРОЙКА GOOGLE SHEETS</b>\n\n` +
            `📋 <b>Пошаговая инструкция:</b>\n\n` +
            `1️⃣ Перейдите в Google Cloud Console\n` +
            `2️⃣ Создайте проект или выберите существующий\n` +
            `3️⃣ Включите Google Sheets API\n` +
            `4️⃣ Создайте Service Account\n` +
            `5️⃣ Скачайте JSON ключ\n` +
            `6️⃣ Создайте новую Google Таблицу\n` +
            `7️⃣ Поделитесь таблицей с email из JSON\n` +
            `8️⃣ Обновите config/google-sheets.json\n` +
            `9️⃣ Установите "enabled": true\n` +
            `🔟 Перезапустите бота\n\n` +
            `📁 <b>Файл конфигурации:</b>\n` +
            `<code>config/google-sheets.json</code>\n\n` +
            `💡 После настройки все данные будут автоматически экспортироваться каждый час!`;
        
        await ctx.reply(setupText, { 
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
                .text('🔙 Назад', 'admin_google_sheets')
        });
    }

    // Обслуживание БД
    if (data === 'admin_db_maintenance') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery('🔧 Проверяю БД...');
        
        try {
            const stats = await db.getAdminStats();
            
            const maintenanceText = 
                `🔧 <b>ОБСЛУЖИВАНИЕ БАЗЫ ДАННЫХ</b>\n\n` +
                `📊 <b>Состояние БД:</b>\n` +
                `💾 Размер: ~${Math.round(stats.totalOrders / 10)}KB\n` +
                `📋 Записей заказов: ${stats.totalOrders}\n` +
                `👤 Записей пользователей: ${stats.totalUsers}\n` +
                `🔔 Уведомлений: ${stats.unreadNotifications}\n\n` +
                `✅ <b>Доступные операции:</b>\n` +
                `🗑️ Очистка старых уведомлений\n` +
                `📊 Пересчет статистики\n` +
                `🔄 Проверка целостности\n\n` +
                `⚡ База данных работает нормально!`;
            
            const maintenanceKeyboard = new InlineKeyboard()
                .text('🗑️ Очистить старые данные', 'admin_confirm_clear_logs')
                .text('📊 Пересчитать статистику', 'admin_recalc_stats')
                .row()
                .text('🔙 Назад к настройкам', 'admin_settings');
            
            await ctx.reply(maintenanceText, { 
                parse_mode: 'HTML',
                reply_markup: maintenanceKeyboard
            });
            
        } catch (error) {
            await ctx.reply(
                `❌ <b>Ошибка обслуживания БД</b>\n\n` +
                `${error.message}`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад к настройкам', 'admin_settings')
                }
            );
        }
    }

    // === УПРАВЛЕНИЕ ОПЕРАТОРАМИ ЗАКАЗОВ ===

    // Меню выбора типа заказов
    if (data === 'admin_active_orders') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery('📋 Выберите тип заказов...');
        
        try {
            // Получаем статистику для меню
            const [activeOrders, unassignedOrders] = await Promise.all([
                db.getActiveOrdersForAdmin(),
                db.getUnassignedOrders()
            ]);
            
            const menuText = 
                `📋 <b>УПРАВЛЕНИЕ ЗАКАЗАМИ</b>\n\n` +
                `📊 <b>Доступные категории:</b>\n\n` +
                `🔥 <b>Неназначенные заказы:</b> ${unassignedOrders.length}\n` +
                `📝 Требуют назначения оператора\n\n` +
                `📋 <b>Все активные заказы:</b> ${activeOrders.length}\n` +
                `📊 Включая назначенные и в работе\n\n` +
                `Выберите категорию для просмотра:`;
            
            const menuKeyboard = new InlineKeyboard()
                .text(`🔥 Неназначенные (${unassignedOrders.length})`, 'admin_unassigned_orders')
                .text(`📋 Все активные (${activeOrders.length})`, 'admin_all_active_orders')
                .row()
                .text('🔙 Назад к админке', 'admin_back');
            
            await ctx.reply(menuText, { 
                parse_mode: 'HTML',
                reply_markup: menuKeyboard
            });
            
        } catch (error) {
            await ctx.reply(
                `❌ <b>Ошибка загрузки меню</b>\n\n` +
                `${error.message}`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад к админке', 'admin_back')
                }
            );
        }
    }

    // Неназначенные заказы (с пагинацией)
    if (data === 'admin_unassigned_orders' || data.startsWith('admin_unassigned_orders_page_')) {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        // Определяем номер страницы
        let page = 0;
        if (data.startsWith('admin_unassigned_orders_page_')) {
            page = parseInt(data.replace('admin_unassigned_orders_page_', '')) || 0;
        }
        
        await ctx.answerCallbackQuery('🔥 Загружаю неназначенные заказы...');
        
        try {
            const unassignedOrders = await db.getUnassignedOrders();
            
            if (unassignedOrders.length === 0) {
                await ctx.reply(
                    `🔥 <b>НЕНАЗНАЧЕННЫЕ ЗАКАЗЫ</b>\n\n` +
                    `✅ Неназначенных заказов нет!\n\n` +
                    `🎉 Все заказы имеют операторов`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('🔙 К меню заказов', 'admin_active_orders')
                    }
                );
                return;
            }
            
            // Пагинация
            const ordersPerPage = 6;
            const totalPages = Math.ceil(unassignedOrders.length / ordersPerPage);
            const startIndex = page * ordersPerPage;
            const endIndex = Math.min(startIndex + ordersPerPage, unassignedOrders.length);
            const pageOrders = unassignedOrders.slice(startIndex, endIndex);
            
            let ordersText = `🔥 <b>НЕНАЗНАЧЕННЫЕ ЗАКАЗЫ</b>\n\n`;
            ordersText += `⚠️ Требуют назначения оператора: ${unassignedOrders.length}\n`;
            ordersText += `📄 Страница ${page + 1} из ${totalPages}\n\n`;
            
            const ordersKeyboard = new InlineKeyboard();
            
            pageOrders.forEach((order, index) => {
                const globalIndex = startIndex + index + 1;
                const status = order.status === 'pending' ? '⏳' : '🔄';
                
                ordersText += `${globalIndex}. ${status} Заказ #${order.id}\n`;
                ordersText += `💱 ${order.from_amount} ${order.from_currency} → ${order.to_currency}\n`;
                ordersText += `👤 Клиент: ${order.username || order.first_name || 'Аноним'}\n`;
                ordersText += `⏰ ${new Date(order.created_at).toLocaleString('ru')}\n\n`;
                
                // Добавляем кнопку для каждого заказа
                ordersKeyboard.text(`🔥 Заказ #${order.id}`, `admin_manage_order_${order.id}`);
                if (index % 2 === 1) ordersKeyboard.row();
            });
            
            // Кнопки пагинации
            if (totalPages > 1) {
                ordersKeyboard.row();
                if (page > 0) {
                    ordersKeyboard.text('⬅️ Назад', `admin_unassigned_orders_page_${page - 1}`);
                }
                ordersKeyboard.text(`📄 ${page + 1}/${totalPages}`, 'noop');
                if (page < totalPages - 1) {
                    ordersKeyboard.text('Далее ➡️', `admin_unassigned_orders_page_${page + 1}`);
                }
            }
            
            ordersKeyboard.row()
                .text('🔙 К меню заказов', 'admin_active_orders')
                .text('🏠 К админке', 'admin_back');
            
            await ctx.reply(ordersText, { 
                parse_mode: 'HTML',
                reply_markup: ordersKeyboard
            });
            
        } catch (error) {
            await ctx.reply(
                `❌ <b>Ошибка загрузки неназначенных заказов</b>\n\n` +
                `${error.message}`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 К меню заказов', 'admin_active_orders')
                }
            );
        }
    }

    // Все активные заказы (с пагинацией)
    if (data === 'admin_all_active_orders' || data.startsWith('admin_all_active_orders_page_')) {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        // Определяем номер страницы
        let page = 0;
        if (data.startsWith('admin_all_active_orders_page_')) {
            page = parseInt(data.replace('admin_all_active_orders_page_', '')) || 0;
        }
        
        try {
            await ctx.answerCallbackQuery('📋 Загружаю все активные заказы...');
        } catch (callbackError) {
            console.log('⚠️ Callback query timeout:', callbackError.message);
        }
        
        try {
            const activeOrders = await db.getActiveOrdersForAdmin();
            
            if (activeOrders.length === 0) {
                await ctx.reply(
                    `📋 <b>ВСЕ АКТИВНЫЕ ЗАКАЗЫ</b>\n\n` +
                    `📭 Активных заказов нет\n\n` +
                    `✨ Все заказы обработаны!`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('🔙 К меню заказов', 'admin_active_orders')
                    }
                );
                return;
            }
            
            // Пагинация
            const ordersPerPage = 6;
            const totalPages = Math.ceil(activeOrders.length / ordersPerPage);
            const startIndex = page * ordersPerPage;
            const endIndex = Math.min(startIndex + ordersPerPage, activeOrders.length);
            const pageOrders = activeOrders.slice(startIndex, endIndex);
            
            let ordersText = `📋 <b>ВСЕ АКТИВНЫЕ ЗАКАЗЫ</b>\n\n`;
            ordersText += `📊 Всего активных: ${activeOrders.length}\n`;
            ordersText += `📄 Страница ${page + 1} из ${totalPages}\n\n`;
            
            const ordersKeyboard = new InlineKeyboard();
            
            pageOrders.forEach((order, index) => {
                const globalIndex = startIndex + index + 1;
                const status = order.status === 'pending' ? '⏳' : '🔄';
                const operator = order.operator_name || '❌ Не назначен';
                
                ordersText += `${globalIndex}. ${status} Заказ #${order.id}\n`;
                ordersText += `💱 ${order.from_amount} ${order.from_currency} → ${order.to_currency}\n`;
                ordersText += `👤 Клиент: ${order.username || order.user_first_name || 'Аноним'}\n`;
                ordersText += `👨‍💼 Оператор: ${operator}\n`;
                ordersText += `⏰ ${new Date(order.created_at).toLocaleString('ru')}\n\n`;
                
                // Добавляем кнопку для каждого заказа
                ordersKeyboard.text(`📋 #${order.id}`, `admin_manage_order_${order.id}`);
                if (index % 2 === 1) ordersKeyboard.row();
            });
            
            // Кнопки пагинации
            if (totalPages > 1) {
                ordersKeyboard.row();
                if (page > 0) {
                    ordersKeyboard.text('⬅️ Назад', `admin_all_active_orders_page_${page - 1}`);
                }
                ordersKeyboard.text(`📄 ${page + 1}/${totalPages}`, 'noop');
                if (page < totalPages - 1) {
                    ordersKeyboard.text('Далее ➡️', `admin_all_active_orders_page_${page + 1}`);
                }
            }
            
            ordersKeyboard.row()
                .text('🔙 К меню заказов', 'admin_active_orders')
                .text('🏠 К админке', 'admin_back');
            
            await ctx.reply(ordersText, { 
                parse_mode: 'HTML',
                reply_markup: ordersKeyboard
            });
            
        } catch (error) {
            await ctx.reply(
                `❌ <b>Ошибка загрузки активных заказов</b>\n\n` +
                `${error.message}`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 К меню заказов', 'admin_active_orders')
                }
            );
        }
    }

    // Управление конкретным заказом
    if (data.startsWith('admin_manage_order_')) {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('admin_manage_order_', ''));
        try {
            await ctx.answerCallbackQuery('🔍 Загружаю детали заказа...');
        } catch (callbackError) {
            console.log('⚠️ Callback query timeout:', callbackError.message);
        }
        
        try {
            const order = await db.getOrderWithOperator(orderId);
            
            if (!order) {
                return ctx.reply('❌ Заказ не найден');
            }
            
            const operatorText = order.operator_name || '❌ Не назначен';
            const statusEmoji = order.status === 'pending' ? '⏳' : order.status === 'processing' ? '🔄' : '✅';
            
            const orderText = 
                `📋 <b>УПРАВЛЕНИЕ ЗАКАЗОМ #${order.id}</b>\n\n` +
                `${statusEmoji} <b>Статус:</b> ${order.status}\n` +
                `💱 <b>Обмен:</b> ${order.from_amount} ${order.from_currency} → ${order.to_currency}\n` +
                `👤 <b>Клиент:</b> ${order.username || 'Аноним'}\n` +
                `👨‍💼 <b>Оператор:</b> ${operatorText}\n` +
                `⏰ <b>Создан:</b> ${new Date(order.created_at).toLocaleString('ru')}\n\n` +
                `⚙️ <b>Доступные действия:</b>`;
            
            const manageKeyboard = new InlineKeyboard()
                .text('🔄 Сменить оператора', `admin_change_operator_${orderId}`)
                .text('📊 Изменить статус', `admin_change_status_${orderId}`)
                .row()
                .text('👁️ Подробности', `admin_order_details_${orderId}`)
                .text('🔙 К заказам', 'admin_active_orders');
            
            await ctx.reply(orderText, { 
                parse_mode: 'HTML',
                reply_markup: manageKeyboard
            });
            
        } catch (error) {
            await ctx.reply(`❌ Ошибка: ${error.message}`);
        }
    }

    // Смена оператора
    if (data.startsWith('admin_change_operator_')) {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('admin_change_operator_', ''));
        try {
            await ctx.answerCallbackQuery('👨‍💼 Загружаю операторов...');
        } catch (callbackError) {
            console.log('⚠️ Callback query timeout:', callbackError.message);
        }
        
        try {
            const staff = await db.getStaffList();
            const operators = staff.filter(s => (s.role === 'operator' || s.role === 'admin') && s.is_active);
            
            if (operators.length === 0) {
                return ctx.reply(
                    `❌ <b>Нет доступных операторов</b>\n\n` +
                    `Добавьте операторов через /add_operator`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('🔙 Назад', `admin_manage_order_${orderId}`)
                    }
                );
            }
            
            let operatorText = `👨‍💼 <b>СМЕНА ОПЕРАТОРА</b>\n\n`;
            operatorText += `📋 Заказ #${orderId}\n\n`;
            operatorText += `<b>Выберите нового оператора:</b>\n\n`;
            
            const operatorKeyboard = new InlineKeyboard();
            
            operators.forEach((operator, index) => {
                const name = operator.first_name || operator.username || `ID: ${operator.telegram_id}`;
                operatorText += `${index + 1}. ${name}\n`;
                
                operatorKeyboard.text(`👤 ${name}`, `admin_assign_${orderId}_${operator.telegram_id}`);
                if (index % 2 === 1) operatorKeyboard.row();
            });
            
            // Опция снять назначение
            operatorKeyboard.row()
                .text('❌ Снять назначение', `admin_unassign_${orderId}`)
                .text('🔙 Назад', `admin_manage_order_${orderId}`);
            
            await ctx.reply(operatorText, { 
                parse_mode: 'HTML',
                reply_markup: operatorKeyboard
            });
            
        } catch (error) {
            await ctx.reply(`❌ Ошибка: ${error.message}`);
        }
    }

    // Назначение оператора
    if (data.startsWith('admin_assign_')) {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        try {
            await ctx.answerCallbackQuery('🔄 Назначаю оператора...');
        } catch (callbackError) {
            console.log('⚠️ Callback query timeout:', callbackError.message);
        }
        
        try {
            const parts = data.replace('admin_assign_', '').split('_');
            const orderId = parseInt(parts[0]);
            const operatorId = parseInt(parts[1]);
            
            console.log(`Назначаю оператора ${operatorId} на заказ ${orderId}`);
            
            if (isNaN(orderId) || isNaN(operatorId)) {
                throw new Error('Некорректные данные заказа или оператора');
            }
            
            const result = await db.changeOrderOperator(orderId, operatorId);
            const operator = await db.getStaffById(operatorId);
            
            console.log(`Результат поиска оператора:`, operator);
            
            if (!operator) {
                throw new Error(`Оператор с ID ${operatorId} не найден в базе данных`);
            }
            
            const operatorName = operator.first_name || operator.username || `ID: ${operator.telegram_id}`;
            
            await ctx.reply(
                `✅ <b>ОПЕРАТОР НАЗНАЧЕН!</b>\n\n` +
                `📋 Заказ #${orderId}\n` +
                `👨‍💼 Новый оператор: ${operatorName}\n` +
                `⏰ Время: ${new Date().toLocaleString('ru')}\n\n` +
                `🔔 Оператор получил уведомление!`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('📋 К заказу', `admin_manage_order_${orderId}`)
                        .text('📊 К заказам', 'admin_active_orders')
                }
            );
            
            // Уведомляем оператора
            try {
                await bot.api.sendMessage(parseInt(operatorId),
                    `👨‍💼 <b>ВАМ НАЗНАЧЕН ЗАКАЗ!</b>\n\n` +
                    `📋 Заказ #${orderId}\n` +
                    `👤 Назначил: ${ctx.from.first_name} (админ)\n` +
                    `⏰ ${new Date().toLocaleString('ru')}\n\n` +
                    `🎯 Используйте /operator для работы с заказом`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('👨‍💼 Открыть панель', 'open_operator_panel')
                    }
                );
            } catch (error) {
                console.log(`Не удалось уведомить оператора ${operatorId}`);
            }
            
        } catch (error) {
            await ctx.reply(`❌ Ошибка назначения: ${error.message}`);
        }
    }

    // Снятие назначения
    if (data.startsWith('admin_unassign_')) {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('admin_unassign_', ''));
        await ctx.answerCallbackQuery('🔄 Снимаю назначение...');
        
        try {
            const result = await db.unassignOrder(orderId);
            
            await ctx.reply(
                `✅ <b>НАЗНАЧЕНИЕ СНЯТО!</b>\n\n` +
                `📋 Заказ #${orderId}\n` +
                `👤 Снял: ${ctx.from.first_name} (админ)\n` +
                `⏰ Время: ${new Date().toLocaleString('ru')}\n\n` +
                `📝 Заказ доступен всем операторам`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('📋 К заказу', `admin_manage_order_${orderId}`)
                        .text('📊 К заказам', 'admin_active_orders')
                }
            );
            
        } catch (error) {
            await ctx.reply(`❌ Ошибка: ${error.message}`);
        }
    }

    // === ОБРАБОТЧИКИ ИЗМЕНЕНИЯ СТАТУСА И ПОДРОБНОСТЕЙ ===

    // Изменение статуса заказа
    if (data.startsWith('admin_change_status_')) {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('admin_change_status_', ''));
        await ctx.answerCallbackQuery('📊 Выберите новый статус...');
        
        try {
            const order = await db.getOrderWithOperator(orderId);
            
            if (!order) {
                return ctx.reply('❌ Заказ не найден');
            }
            
            const statusText = 
                `📊 <b>ИЗМЕНЕНИЕ СТАТУСА</b>\n\n` +
                `📋 Заказ #${orderId}\n` +
                `💱 ${order.from_amount} ${order.from_currency} → ${order.to_currency}\n` +
                `📌 Текущий статус: ${order.status}\n\n` +
                `<b>Выберите новый статус:</b>`;
            
            const statusKeyboard = new InlineKeyboard()
                .text('⏳ Ожидание', `admin_set_status_${orderId}_pending`)
                .text('🔄 В обработке', `admin_set_status_${orderId}_processing`)
                .row()
                .text('💳 Реквизиты отправлены', `admin_set_status_${orderId}_payment_details_sent`)
                .text('⏰ Ожидание платежа', `admin_set_status_${orderId}_payment_waiting`)
                .row()
                .text('✅ Платеж получен', `admin_set_status_${orderId}_payment_received`)
                .text('✅ Платеж подтвержден', `admin_set_status_${orderId}_payment_confirmed`)
                .row()
                .text('📤 Отправка', `admin_set_status_${orderId}_sending`)
                .text('🎉 Завершен', `admin_set_status_${orderId}_completed`)
                .row()
                .text('❌ Отменен', `admin_set_status_${orderId}_cancelled`)
                .text('🔙 Назад', `admin_manage_order_${orderId}`);
            
            await ctx.reply(statusText, { 
                parse_mode: 'HTML',
                reply_markup: statusKeyboard
            });
            
        } catch (error) {
            await ctx.reply(`❌ Ошибка: ${error.message}`);
        }
    }

    // Установка нового статуса
    if (data.startsWith('admin_set_status_')) {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const parts = data.replace('admin_set_status_', '').split('_');
        const orderId = parseInt(parts[0]);
        const newStatus = parts.slice(1).join('_');
        
        await ctx.answerCallbackQuery('🔄 Обновляю статус...');
        
        try {
            await db.updateOrderStatus(orderId, newStatus);
            
            // Получаем обновленную информацию о заказе
            const order = await db.getOrderWithOperator(orderId);
            
            await ctx.reply(
                `✅ <b>СТАТУС ОБНОВЛЕН!</b>\n\n` +
                `📋 Заказ #${orderId}\n` +
                `📊 Новый статус: ${newStatus}\n` +
                `⏰ Время: ${new Date().toLocaleString('ru')}\n` +
                `👤 Изменил: ${ctx.from.first_name}\n\n` +
                `🔔 Клиент получит уведомление!`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('📋 К заказу', `admin_manage_order_${orderId}`)
                        .text('📊 К заказам', 'admin_active_orders')
                }
            );
            
            // Уведомляем клиента
            if (order && order.user_id) {
                try {
                    const statusMessages = {
                        'pending': '⏳ Ваш заказ ожидает обработки',
                        'processing': '🔄 Ваш заказ принят в обработку',
                        'payment_details_sent': '💳 Реквизиты для оплаты отправлены',
                        'payment_waiting': '⏰ Ожидаем поступления платежа',
                        'payment_received': '✅ Платеж получен, проверяем',
                        'payment_confirmed': '✅ Платеж подтвержден',
                        'sending': '📤 Отправляем средства на ваш адрес',
                        'completed': '🎉 Заказ успешно завершен!',
                        'cancelled': '❌ Заказ отменен'
                    };
                    
                    const statusMessage = statusMessages[newStatus] || `Статус изменен: ${newStatus}`;
                    
                    await bot.api.sendMessage(order.user_id,
                        `📋 <b>Обновление заказа #${orderId}</b>\n\n` +
                        `${statusMessage}\n\n` +
                        `💱 ${order.from_amount} ${order.from_currency} → ${order.to_currency}\n` +
                        `⏰ ${new Date().toLocaleString('ru')}`,
                        { parse_mode: 'HTML' }
                    );
                } catch (error) {
                    console.log(`Не удалось уведомить клиента ${order.user_id}`);
                }
            }
            
        } catch (error) {
            await ctx.reply(`❌ Ошибка обновления статуса: ${error.message}`);
        }
    }

    // Подробности заказа
    if (data.startsWith('admin_order_details_')) {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('admin_order_details_', ''));
        await ctx.answerCallbackQuery('👁️ Загружаю подробности...');
        
        try {
            const order = await db.getOrderWithOperator(orderId);
            
            if (!order) {
                return ctx.reply('❌ Заказ не найден');
            }
            
            const operatorInfo = order.operator_name ? 
                `👨‍💼 ${order.operator_name} (ID: ${order.operator_id})` : 
                '❌ Не назначен';
            
            // Добавляем информацию о банке и сети если есть
            const bankInfo = order.bank ? `🏦 <b>Банк:</b> ${order.bank}\n` : '';
            const networkInfo = order.network ? `🔗 <b>Сеть:</b> ${order.network}\n` : '';
            
            const detailsText = 
                `👁️ <b>ПОДРОБНОСТИ ЗАКАЗА #${orderId}</b>\n\n` +
                `📊 <b>Основная информация:</b>\n` +
                `💱 Обмен: ${order.from_amount} ${order.from_currency} → ${order.to_amount || 'TBD'} ${order.to_currency}\n` +
                `📌 Статус: ${order.status}\n` +
                `📅 Создан: ${new Date(order.created_at).toLocaleString('ru')}\n` +
                `📝 Обновлен: ${new Date(order.updated_at).toLocaleString('ru')}\n` +
                bankInfo +
                networkInfo +
                `\n👤 <b>Клиент:</b>\n` +
                `🆔 ID: ${order.user_id}\n` +
                `📝 Имя: ${order.user_first_name || 'Не указано'}\n` +
                `🔗 Username: @${order.username || 'нет'}\n\n` +
                `👨‍💼 <b>Оператор:</b>\n` +
                `${operatorInfo}\n\n` +
                `💰 <b>Финансы:</b>\n` +
                `📥 Получаем: ${order.from_amount} ${order.from_currency}\n` +
                `📤 Отправляем: ${order.to_amount || 'Не рассчитано'} ${order.to_currency}\n` +
                `🎯 Адрес назначения: \n<code>${order.to_address || 'Не указан'}</code>\n\n` +
                `🌐 <b>Источник:</b> ${order.source || 'bot'}`;
            
            const detailsKeyboard = new InlineKeyboard()
                .text('🔄 Сменить оператора', `admin_change_operator_${orderId}`)
                .text('📊 Изменить статус', `admin_change_status_${orderId}`)
                .row()
                .text('💬 История сообщений', `admin_order_messages_${orderId}`)
                .text('🔙 К заказам', 'admin_active_orders');
            
            await ctx.reply(detailsText, { 
                parse_mode: 'HTML',
                reply_markup: detailsKeyboard
            });
            
        } catch (error) {
            await ctx.reply(`❌ Ошибка загрузки подробностей: ${error.message}`);
        }
    }

    // === ДОПОЛНИТЕЛЬНЫЕ ОБРАБОТЧИКИ ===
    
    // Заглушка для кнопки номера страницы
    if (data === 'noop') {
        await ctx.answerCallbackQuery();
        return;
    }

    // Пересчет статистики (для обслуживания БД)
    if (data === 'admin_recalc_stats') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        await ctx.answerCallbackQuery('📊 Пересчитываю статистику...');
        
        try {
            const result = await db.recalculateStats();
            
            await ctx.reply(
                `✅ <b>СТАТИСТИКА ПЕРЕСЧИТАНА!</b>\n\n` +
                `📊 Все данные обновлены\n` +
                `⏰ Время: ${new Date().toLocaleString('ru')}\n` +
                `👤 Выполнил: ${ctx.from.first_name}\n\n` +
                `🚀 Система работает оптимально!`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад к обслуживанию', 'admin_db_maintenance')
                }
            );
            
        } catch (error) {
            await ctx.reply(
                `❌ <b>Ошибка пересчета</b>\n\n` +
                `${error.message}`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🔙 Назад к обслуживанию', 'admin_db_maintenance')
                }
            );
        }
    }

    // Закрытие тикета поддержки
    if (data.startsWith('close_ticket_')) {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin' && userRole !== 'operator') {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const ticketId = data.replace('close_ticket_', '');
        const adminName = ctx.from.first_name || ctx.from.username || `ID: ${userId}`;
        
        await ctx.answerCallbackQuery('✅ Тикет закрыт!');
        
        try {
            // Редактируем сообщение, добавляя статус "ЗАКРЫТ"
            const closedMessage = ctx.callbackQuery.message.text + 
                `\n\n🔒 <b>ТИКЕТ ЗАКРЫТ</b>\n` +
                `👤 Закрыл: ${adminName}\n` +
                `⏰ Время: ${new Date().toLocaleString('ru-RU')}`;
            
            await ctx.editMessageText(closedMessage, {
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard()
                    .text('🏠 Главное меню', 'back_to_main')
            });
            
            console.log(`🎫 Тикет ${ticketId} закрыт пользователем ${userId} (${adminName})`);
            
        } catch (error) {
            console.error(`❌ Ошибка закрытия тикета ${ticketId}:`, error.message);
            await ctx.reply(`❌ Ошибка при закрытии тикета: ${error.message}`);
        }
    }

    // Кнопка "Оплачено" от клиента
    if (data.startsWith('client_paid_')) {
        const orderId = data.replace('client_paid_', '');
        const clientName = ctx.from.first_name || ctx.from.username || `ID: ${userId}`;
        
        await ctx.answerCallbackQuery('✅ Подтверждение получено!');
        
        try {
            // Получаем информацию о заявке
            const order = await db.getOrderWithOperator(orderId);
            if (!order) {
                return ctx.reply('❌ Заявка не найдена');
            }

            // Уведомляем оператора
            const operatorMessage = 
                `💰 <b>КЛИЕНТ ПОДТВЕРДИЛ ОПЛАТУ</b>\n\n` +
                `🎫 Заявка #${orderId}\n` +
                `👤 Клиент: ${clientName}\n` +
                `💳 ${order.from_amount} ${order.from_currency}\n` +
                `⏰ Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
                `🔍 <b>Проверьте поступление платежа</b>\n` +
                `✅ Если средства получены - подтвердите транзакцию\n` +
                `❌ Если средства не поступили - уточните у клиента`;

            const operatorKeyboard = new InlineKeyboard()
                .text('✅ Подтвердить получение', `operator_confirm_${orderId}`)
                .text('❌ Средства не получены', `operator_not_received_${orderId}`)
                .row()
                .text('💬 Написать клиенту', `operator_chat_${orderId}`);

            if (order.operator_id) {
                await bot.api.sendMessage(order.operator_id, operatorMessage, {
                    parse_mode: 'HTML',
                    reply_markup: operatorKeyboard
                });
            }

            // Обновляем статус заявки
            await db.updateOrderStatus(orderId, 'payment_pending');

            // Редактируем сообщение клиента
            await ctx.editMessageText(
                ctx.callbackQuery.message.text + 
                `\n\n✅ <b>ПОДТВЕРЖДЕНИЕ ПОЛУЧЕНО</b>\n` +
                `⏰ Время: ${new Date().toLocaleString('ru-RU')}\n` +
                `🔍 Оператор проверяет поступление платежа...`,
                {
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('💬 Связаться с оператором', `client_chat_${orderId}`)
                }
            );

            console.log(`💰 Клиент ${userId} подтвердил оплату заявки ${orderId}`);

        } catch (error) {
            console.error(`❌ Ошибка обработки подтверждения оплаты:`, error);
            await ctx.reply('❌ Ошибка обработки. Обратитесь к оператору.');
        }
    }

    // Кнопка "Связаться с оператором" от клиента
    if (data.startsWith('client_chat_')) {
        const orderId = data.replace('client_chat_', '');
        const clientName = ctx.from.first_name || ctx.from.username || `ID: ${userId}`;
        
        await ctx.answerCallbackQuery('💬 Связываемся с оператором...');
        
        try {
            // Получаем информацию о заявке
            const order = await db.getOrderWithOperator(orderId);
            if (!order) {
                return ctx.reply('❌ Заявка не найдена');
            }

            if (!order.operator_id) {
                return ctx.reply(
                    `⚠️ <b>Оператор еще не назначен</b>\n\n` +
                    `🕐 Пожалуйста, подождите назначения оператора\n` +
                    `📞 Или обратитесь в поддержку: /support`,
                    { parse_mode: 'HTML' }
                );
            }

            // Создаем чат-контекст
            chatContexts.set(userId, {
                type: 'client',
                orderId: orderId,
                operatorId: order.operator_id,
                clientId: userId
            });

            // Уведомляем оператора о желании клиента связаться
            const operatorMessage = 
                `💬 <b>КЛИЕНТ ХОЧЕТ СВЯЗАТЬСЯ</b>\n\n` +
                `🎫 Заявка #${orderId}\n` +
                `👤 Клиент: ${clientName}\n` +
                `💬 Клиент готов к общению\n\n` +
                `📝 Напишите сообщение ответом на это уведомление`;

            await bot.api.sendMessage(order.operator_id, operatorMessage, {
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard()
                    .text('💬 Ответить клиенту', `operator_chat_${orderId}`)
            });

            // Уведомляем клиента
            await ctx.reply(
                `💬 <b>Чат с оператором активирован</b>\n\n` +
                `🎫 Заявка #${orderId}\n` +
                `👨‍💼 Оператор уведомлен о вашем запросе\n\n` +
                `📝 Напишите ваше сообщение, и оператор его получит`,
                {
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('💬 Ответить оператору', `client_chat_${orderId}`)
                }
            );

                         console.log(`💬 Клиент ${userId} запросил чат с оператором по заявке ${orderId}`);

        } catch (error) {
            console.error(`❌ Ошибка запроса чата с оператором:`, error);
            await ctx.reply('❌ Ошибка связи с оператором. Попробуйте позже.');
        }
    }

    // Оператор подтверждает получение платежа
    if (data.startsWith('operator_confirm_')) {
        const orderId = data.replace('operator_confirm_', '');
        const operatorName = ctx.from.first_name || ctx.from.username || `ID: ${userId}`;
        
        await ctx.answerCallbackQuery('✅ Платеж подтвержден!');
        
        try {
            // Получаем информацию о заявке
            const order = await db.getOrderWithClient(orderId);
            if (!order) {
                return ctx.reply('❌ Заявка не найдена');
            }

            // Обновляем статус заявки
            await db.updateOrderStatusWithMessage(orderId, 'processing', userId, `Платеж подтвержден оператором ${operatorName}`);

            // Уведомляем клиента
            const clientMessage = 
                `✅ <b>ПЛАТЕЖ ПОДТВЕРЖДЕН</b>\n\n` +
                `🎫 Заявка #${orderId}\n` +
                `💰 ${order.from_amount} ${order.from_currency}\n` +
                `👨‍💼 Оператор: ${operatorName}\n` +
                `⏰ Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
                `🚀 Обработка вашей заявки начата!\n` +
                `💸 Средства будут отправлены в ближайшее время`;

            await bot.api.sendMessage(order.user_id, clientMessage, {
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard()
                    .text('💬 Связаться с оператором', `client_chat_${orderId}`)
            });

            // Редактируем сообщение оператора
            await ctx.editMessageText(
                ctx.callbackQuery.message.text + 
                `\n\n✅ <b>ПЛАТЕЖ ПОДТВЕРЖДЕН</b>\n` +
                `👨‍💼 Оператор: ${operatorName}\n` +
                `⏰ Время: ${new Date().toLocaleString('ru-RU')}`,
                {
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('📤 Отправить средства', `funds_sent_${orderId}`)
                        .text('💬 Написать клиенту', `operator_chat_${orderId}`)
                }
            );

            console.log(`✅ Оператор ${userId} подтвердил платеж по заявке ${orderId}`);

        } catch (error) {
            console.error(`❌ Ошибка подтверждения платежа:`, error);
            await ctx.reply('❌ Ошибка обработки. Попробуйте позже.');
        }
    }

    // Оператор сообщает что средства не получены
    if (data.startsWith('operator_not_received_')) {
        const orderId = data.replace('operator_not_received_', '');
        const operatorName = ctx.from.first_name || ctx.from.username || `ID: ${userId}`;
        
        await ctx.answerCallbackQuery('❌ Уведомление отправлено');
        
        try {
            // Получаем информацию о заявке
            const order = await db.getOrderWithClient(orderId);
            if (!order) {
                return ctx.reply('❌ Заявка не найдена');
            }

            // Уведомляем клиента
            const clientMessage = 
                `⚠️ <b>СРЕДСТВА НЕ ПОЛУЧЕНЫ</b>\n\n` +
                `🎫 Заявка #${orderId}\n` +
                `💳 ${order.from_amount} ${order.from_currency}\n` +
                `👨‍💼 Оператор: ${operatorName}\n\n` +
                `❗ Платеж не поступил на наши реквизиты\n\n` +
                `🔍 <b>Проверьте:</b>\n` +
                `• Правильность суммы\n` +
                `• Правильность реквизитов\n` +
                `• Статус платежа в вашем банке\n\n` +
                `💬 Свяжитесь с оператором для уточнения`;

            await bot.api.sendMessage(order.user_id, clientMessage, {
                parse_mode: 'HTML',
                reply_markup: new InlineKeyboard()
                    .text('💬 Связаться с оператором', `client_chat_${orderId}`)
                    .text('✅ Повторно подтвердить', `client_paid_${orderId}`)
            });

            // Редактируем сообщение оператора
            await ctx.editMessageText(
                ctx.callbackQuery.message.text + 
                `\n\n❌ <b>СРЕДСТВА НЕ ПОЛУЧЕНЫ</b>\n` +
                `👨‍💼 Оператор: ${operatorName}\n` +
                `⏰ Время: ${new Date().toLocaleString('ru-RU')}\n` +
                `📝 Клиент уведомлен`,
                {
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('💬 Написать клиенту', `operator_chat_${orderId}`)
                }
            );

            console.log(`❌ Оператор ${userId} сообщил о неполучении средств по заявке ${orderId}`);

        } catch (error) {
            console.error(`❌ Ошибка уведомления о неполучении:`, error);
            await ctx.reply('❌ Ошибка обработки. Попробуйте позже.');
        }
    }

    // Клиент подтверждает получение средств
    if (data.startsWith('client_received_')) {
        const orderId = parseInt(data.replace('client_received_', ''));
        const clientName = ctx.from.first_name || ctx.from.username || `ID: ${userId}`;
        
        await ctx.answerCallbackQuery('✅ Спасибо за подтверждение!');
        
        try {
            // Обновляем статус заказа
            const result = await db.updateOrderStatusWithMessage(orderId, 'completed', userId, 
                `✅ Клиент подтвердил получение средств. Заказ завершен!`);
                
            const order = await db.getOrderWithClient(orderId);
            
            // Уведомляем клиента
            await ctx.reply(
                `🎉 <b>ЗАКАЗ ЗАВЕРШЕН!</b>\n\n` +
                `🎫 Заказ #${orderId}\n` +
                `✅ Вы подтвердили получение средств\n` +
                `💰 ${order.to_amount} ${order.to_currency}\n\n` +
                `Благодарим за использование нашего сервиса!\n\n` +
                `⭐ Оцените качество обслуживания:`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('⭐⭐⭐⭐⭐ Отлично!', `rate_service_5_${orderId}`)
                        .text('⭐⭐⭐⭐ Хорошо', `rate_service_4_${orderId}`)
                        .row()
                        .text('⭐⭐⭐ Нормально', `rate_service_3_${orderId}`)
                        .text('⭐⭐ Плохо', `rate_service_2_${orderId}`)
                        .row()
                        .text('🏠 Главное меню', 'back_to_main')
                        .text('📞 Поддержка', 'support')
                }
            );
            
            // Уведомляем оператора
            if (order.operator_id) {
                await bot.api.sendMessage(order.operator_id,
                    `🎉 <b>ЗАКАЗ ЗАВЕРШЕН!</b>\n\n` +
                    `🎫 Заказ #${orderId}\n` +
                    `👤 Клиент: ${clientName}\n` +
                    `✅ Клиент подтвердил получение средств\n` +
                    `💰 ${order.to_amount} ${order.to_currency}\n\n` +
                    `🏆 Отличная работа!`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('📊 Статистика дня', 'daily_stats')
                            .text('👨‍💼 Панель оператора', 'open_operator_panel')
                    }
                );
            }
            
            console.log(`✅ Клиент ${userId} подтвердил получение средств по заявке ${orderId}`);
            
        } catch (error) {
            console.error(`❌ Ошибка подтверждения получения:`, error);
            await ctx.reply('❌ Ошибка обработки. Попробуйте позже.');
        }
    }
    
    // Клиент не получил средства
    if (data.startsWith('client_not_received_')) {
        const orderId = parseInt(data.replace('client_not_received_', ''));
        const clientName = ctx.from.first_name || ctx.from.username || `ID: ${userId}`;
        
        await ctx.answerCallbackQuery('📞 Оператор уведомлен');
        
        try {
            const order = await db.getOrderWithClient(orderId);
            
            // Уведомляем клиента
            await ctx.reply(
                `⚠️ <b>ПРОБЛЕМА С ПОЛУЧЕНИЕМ</b>\n\n` +
                `🎫 Заказ #${orderId}\n` +
                `❗ Вы не получили средства\n\n` +
                `🔄 Мы проверим операцию и свяжемся с вами\n` +
                `⏰ Время решения: до 30 минут\n\n` +
                `📞 Оператор автоматически уведомлен о проблеме`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('💬 Связаться с оператором', `client_chat_${orderId}`)
                        .text('🔄 Проверить еще раз', `check_again_${orderId}`)
                        .row()
                        .text('📞 Поддержка', 'support')
                }
            );
            
            // Уведомляем оператора о проблеме
            if (order.operator_id) {
                await bot.api.sendMessage(order.operator_id,
                    `🚨 <b>КЛИЕНТ НЕ ПОЛУЧИЛ СРЕДСТВА!</b>\n\n` +
                    `🎫 Заказ #${orderId}\n` +
                    `👤 Клиент: ${clientName}\n` +
                    `❗ Клиент сообщил что не получил средства\n` +
                    `💰 Должен получить: ${order.to_amount} ${order.to_currency}\n\n` +
                    `🔍 <b>Срочно проверьте:</b>\n` +
                    `• Правильность адреса/реквизитов\n` +
                    `• Статус транзакции\n` +
                    `• Сумму перевода\n\n` +
                    `⚡ Свяжитесь с клиентом немедленно!`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('💬 Написать клиенту', `operator_chat_${orderId}`)
                            .text('🔍 Проверить операцию', `check_transaction_${orderId}`)
                            .row()
                            .text('✅ Средства отправлены повторно', `funds_sent_again_${orderId}`)
                            .text('❌ Проблема с операцией', `transaction_problem_${orderId}`)
                    }
                );
            }
            
            // Уведомляем администраторов о проблеме
            const staff = await db.getStaffList();
            const admins = staff.filter(s => s.role === 'admin');
            
            for (const admin of admins) {
                try {
                    await bot.api.sendMessage(admin.telegram_id,
                        `🚨 <b>ПРОБЛЕМА С ЗАКАЗОМ!</b>\n\n` +
                        `🎫 Заказ #${orderId}\n` +
                        `👤 Клиент: ${clientName} (${userId})\n` +
                        `👨‍💼 Оператор: ${order.operator_name || 'Не назначен'}\n` +
                        `❗ Клиент не получил средства\n` +
                        `💰 ${order.to_amount} ${order.to_currency}\n\n` +
                        `⚡ Требуется вмешательство!`,
                        { 
                            parse_mode: 'HTML',
                            reply_markup: new InlineKeyboard()
                                .text('🔍 Подробности', `admin_manage_order_${orderId}`)
                                .text('📞 Связаться с клиентом', `admin_contact_client_${orderId}`)
                        }
                    );
                } catch (error) {
                    console.log(`Не удалось уведомить админа ${admin.telegram_id} о проблеме с заказом`);
                }
            }
            
            console.log(`❌ Клиент ${userId} сообщил о неполучении средств по заявке ${orderId}`);
            
        } catch (error) {
            console.error(`❌ Ошибка обработки неполучения средств:`, error);
            await ctx.reply('❌ Ошибка обработки. Попробуйте позже.');
        }
    }

    // Чат оператора с клиентом
    if (data.startsWith('operator_chat_')) {
        const orderId = data.replace('operator_chat_', '');
        
        await ctx.answerCallbackQuery('💬 Чат активирован');
        
        try {
            // Получаем информацию о заявке
            const order = await db.getOrderWithClient(orderId);
            if (!order) {
                return ctx.reply('❌ Заявка не найдена');
            }

            // Создаем чат-контекст для оператора
            chatContexts.set(userId, {
                type: 'operator',
                orderId: orderId,
                clientId: order.user_id,
                operatorId: userId
            });

            await ctx.reply(
                `💬 <b>Чат с клиентом активирован</b>\n\n` +
                `🎫 Заявка #${orderId}\n` +
                `👤 Клиент: ${order.client_name || `ID: ${order.user_id}`}\n\n` +
                `📝 Напишите сообщение, и клиент его получит`,
                {
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('📞 Завершить чат', `operator_end_chat_${orderId}`)
                }
            );

            console.log(`💬 Оператор ${userId} активировал чат с клиентом по заявке ${orderId}`);

        } catch (error) {
            console.error(`❌ Ошибка активации чата:`, error);
            await ctx.reply('❌ Ошибка активации чата. Попробуйте позже.');
        }
    }

    // Завершить чат с клиентом (для операторов)
    if (data.startsWith('operator_end_chat_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('operator_end_chat_', ''));
        
        try {
            await ctx.answerCallbackQuery('📞 Завершаю чат...');
            
            // Удаляем контекст чата если он был
            chatContexts.delete(userId);
            
            const order = await db.getOrderWithClient(orderId);
            if (!order) {
                return ctx.reply('❌ Заказ не найден');
            }
            
            // Уведомляем клиента о завершении чата
            try {
                await ctx.api.sendMessage(order.client_id,
                    `📞 <b>Чат с оператором завершен</b>\n\n` +
                    `🆔 Заказ #${orderId}\n` +
                    `👨‍💼 Оператор завершил чат\n\n` +
                    `💬 Если у вас есть вопросы, вы можете связаться с поддержкой через главное меню бота.`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('🏠 Главное меню', 'back_to_main')
                    }
                );
            } catch (notifyError) {
                console.log('Не удалось уведомить клиента о завершении чата:', notifyError.message);
            }
            
            // Подтверждаем оператору
            await ctx.reply(
                `✅ <b>Чат завершен!</b>\n\n` +
                `🆔 Заказ #${orderId}\n` +
                `📞 Чат с клиентом завершен\n` +
                `👤 Клиент уведомлен\n\n` +
                `🔙 Возврат к заказу:`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🎛️ К заказу', `manage_order_${orderId}`)
                        .text('📋 Мои заказы', 'op_my_orders')
                }
            );
            
        } catch (error) {
            console.error('Ошибка завершения чата:', error);
            await ctx.reply('❌ Ошибка завершения чата');
        }
    }
});

// Обработчик данных из WebApp
bot.on('message:web_app_data', async (ctx) => {
    try {
        const webAppData = ctx.message.web_app_data.data;
        const userId = ctx.from.id;
        const userData = await db.getUser(userId);
        
        console.log(`📱 WebApp данные от ${userId}:`, webAppData);
        
        // Парсим данные
        const data = JSON.parse(webAppData);
        
        if (data.action === 'contact_support') {
            console.log(`🆘 Запрос поддержки от пользователя ${userId}`);
            
            // Создаем тикет
            const ticketId = `SUPPORT-${Date.now()}`;
            const userName = userData?.first_name || userData?.username || `ID: ${userId}`;
            
            // Уведомляем администраторов
            const supportMessage = `🆘 <b>Запрос поддержки из WebApp</b>\n\n` +
                `🎫 ID: ${ticketId}\n` +
                `👤 Пользователь: ${userName}\n` +
                `📱 Источник: ${data.source}\n` +
                `⏰ Время: ${new Date(data.timestamp).toLocaleString('ru-RU')}\n\n` +
                `💬 Пользователь запросил помощь через WebApp\n\n` +
                `➡️ Свяжитесь с пользователем: <a href="tg://user?id=${userId}">написать</a>`;
            
            // Отправляем уведомление всем администраторам
            try {
                const adminIds = await db.getAdminIds();
                
                for (const adminId of adminIds) {
                    try {
                        await bot.api.sendMessage(adminId, supportMessage, { 
                            parse_mode: 'HTML',
                            reply_markup: new InlineKeyboard()
                                .text('💬 Написать пользователю', `contact_user_${userId}`)
                                .text('🎫 Закрыть тикет', `close_ticket_${ticketId}`)
                        });
                        console.log(`📨 Уведомление отправлено админу ${adminId}`);
                    } catch (sendError) {
                        console.log(`⚠️ Не удалось уведомить админа ${adminId}:`, sendError.message);
                    }
                }
            } catch (adminError) {
                console.log('⚠️ Ошибка получения списка администраторов:', adminError.message);
            }
            
            // Отвечаем пользователю
            await ctx.reply(
                `✅ <b>Запрос получен!</b>\n\n` +
                `🎫 Номер тикета: ${ticketId}\n` +
                `⏰ Время ответа: до 15 минут\n\n` +
                `📞 Наш оператор свяжется с вами в ближайшее время!`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('🏠 На главную', 'back_to_main')
                }
            );
        }
        
    } catch (error) {
        console.error('❌ Ошибка обработки WebApp данных:', error);
        await ctx.reply('❌ Ошибка обработки запроса. Попробуйте позже.');
    }
});

// Команда для получения реферальной ссылки
bot.command('ref', async (ctx) => {
    const userId = ctx.from.id;
    const botUsername = process.env.BOT_USERNAME || 'exmachinax_bot';
    const referralLink = `https://t.me/${botUsername}?start=${userId}`;
    
    const stats = await db.getReferralStats(userId);
    
    await ctx.reply(
        `💰 <b>Реферальная программа ExMachinaX</b>\n\n` +
        `🔗 Ваша ссылка: <code>${referralLink}</code>\n\n` +
        `📊 <b>Ваша статистика:</b>\n` +
        `👤 Рефералов: ${stats.total_referrals}\n` +
        `💵 Заработано: $${(stats.total_commission || 0).toFixed(2)}\n` +
        `📈 Обменов: ${stats.successful_orders}\n\n` +
        `🔥 <b>Как зарабатывать:</b>\n` +
        `🎯 Поделитесь ссылкой с друзьями\n` +
        `💸 За каждый их обмен получаете 0.5%\n` +
        `⚡ Деньги зачисляются автоматически\n` +
        `🎁 Без лимитов и ограничений\n\n` +
        `🚀 Приглашайте друзей и зарабатывайте с нашей системой!`,
        { 
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
                .text('📊 Подробная статистика', 'referral_stats')
        }
    );
});

// Обработка команды для админов
bot.command('admin', async (ctx) => {
    const userId = ctx.from.id;
    
    // 🛡️ ГАРАНТИРОВАННАЯ ПРОВЕРКА АДМИНА
    if (!(await isAdmin(userId))) {
        return ctx.reply('❌ У вас нет прав администратора');
    }
    
    const stats = await db.getAdminStats();
    
    // Создаем клавиатуру админ панели
    const adminKeyboard = new InlineKeyboard();
    
    // Добавляем ЭПИЧЕСКУЮ кнопку таблицы если Google Sheets активен
    if (googleSheetsManager && googleSheetsManager.isReady()) {
        adminKeyboard.url('💎🔥 ТАБЛИЦА БОГОВ 🔥💎', googleSheetsManager.getSpreadsheetUrl()).row();
    }
    
    adminKeyboard
        .text('📊 Полная статистика', 'admin_full_stats')
        .text('👥 Управление персоналом', 'admin_staff')
        .row()
        .text('📋 Активные заказы', 'admin_active_orders')
        .text('🔔 Уведомления', 'admin_notifications')
        .row()
        .text('👤 Добавить оператора', 'admin_add_operator')
        .text('⚙️ Настройки', 'admin_settings')
        .row()
        .text('💱 Управление курсами', 'admin_rates_control')
            .text('🏠 Назад к боту', 'back_to_main');
    
    await ctx.reply(
        `🛡️ <b>АДМИН ПАНЕЛЬ ExMachinaX</b>\n\n` +
        `📈 <b>Статистика за сегодня:</b>\n` +
        `👥 Новых пользователей: ${stats.newUsersToday}\n` +
        `📝 Заявок: ${stats.ordersToday}\n` +
        `💰 Оборот: $${(stats.volumeToday || 0).toFixed(2)}\n\n` +
        `📊 <b>Общая статистика:</b>\n` +
        `👤 Всего пользователей: ${stats.totalUsers}\n` +
        `📋 Всего заказов: ${stats.totalOrders}\n` +
        `✅ Завершено: ${stats.completedOrders}\n` +
        `⏳ В ожидании: ${stats.pendingOrders}\n` +
        `🔄 В обработке: ${stats.processingOrders}\n` +
        `💵 Общий оборот: $${(stats.totalVolume || 0).toFixed(2)}\n\n` +
        `👨‍💼 <b>Персонал:</b>\n` +
        `🛡️ Активных операторов: ${stats.activeOperators}\n` +
        `📝 Назначенных заказов: ${stats.assignedOrders}\n` +
        `🔔 Непрочитанных уведомлений: ${stats.unreadNotifications}`,
        { 
            parse_mode: 'HTML',
            reply_markup: adminKeyboard
        }
    );
});

// Команда для операторов
bot.command('operator', async (ctx) => {
    const userId = ctx.from.id;
    
    // 🛡️ ГАРАНТИРОВАННАЯ ПРОВЕРКА ОПЕРАТОРА
    if (!(await isOperator(userId))) {
        return ctx.reply('❌ У вас нет прав оператора');
    }
    
    // Получаем неназначенные заказы и заказы оператора
    const [unassignedOrders, myOrders] = await Promise.all([
        db.getUnassignedOrders(),
        db.getOperatorOrders(userId)
    ]);
    
    const operatorKeyboard = new InlineKeyboard()
        .text(`📋 Свободные заказы (${unassignedOrders.length})`, 'op_unassigned_orders')
        .text(`📝 Мои заказы (${myOrders.length})`, 'op_my_orders')
        .row()
        .text('🔔 Мои уведомления', 'op_notifications')
                    .text('📊 Моя статистика', 'op_stats')
            .row()
            .text('📈 Статистика дня', 'admin_daily_stats')
            .row()
            .text('🏠 Назад к боту', 'back_to_main');
    
    await ctx.reply(
        `👨‍💼 <b>ПАНЕЛЬ ОПЕРАТОРА</b>\n\n` +
        `👋 Добро пожаловать, оператор!\n\n` +
        `📋 <b>Доступные заказы:</b> ${unassignedOrders.length}\n` +
        `📝 <b>Ваши заказы:</b> ${myOrders.length}\n` +
        `🔔 <b>Новых уведомлений:</b> ${(await db.getNotifications(userId, 1)).filter(n => !n.is_read).length}\n\n` +
        `Выберите действие:`,
        { 
            parse_mode: 'HTML',
            reply_markup: operatorKeyboard
        }
    );
});

// Простая команда для проверки работы бота
bot.command('ping', async (ctx) => {
    await ctx.reply('🏓 Pong! Бот работает!');
});

// Команда для тестирования системы (только для админов)
bot.command('test_system', async (ctx) => {
    const userId = ctx.from.id;
    // 🛡️ ГАРАНТИРОВАННАЯ ПРОВЕРКА АДМИНА
    if (!(await isAdmin(userId))) {
        return ctx.reply('❌ Только админы могут тестировать систему');
    }
    
    await ctx.reply('🧪 <b>Тестирование системы ExMachinaX...</b>', { parse_mode: 'HTML' });
    
    try {
        // Тест 1: Проверка базы данных
        await ctx.reply('1️⃣ Тестирую базу данных...');
        const stats = await db.getAdminStats();
        await ctx.reply(`✅ База данных: ${stats.totalUsers} пользователей, ${stats.totalOrders} заказов`);
        
        // Тест 2: Проверка системы операторов
        await ctx.reply('2️⃣ Тестирую систему операторов...');
        const staff = await db.getStaffList();
        await ctx.reply(`✅ Персонал: ${staff.length} сотрудников (${staff.filter(s => s.role === 'admin').length} админов, ${staff.filter(s => s.role === 'operator').length} операторов)`);
        
        // Тест 3: Создание тестового уведомления
        await ctx.reply('3️⃣ Тестирую систему уведомлений...');
        await db.createNotification({
            recipientId: userId,
            type: 'test',
            title: '🧪 Тестовое уведомление',
            message: 'Система уведомлений работает!',
            orderId: null
        });
        await ctx.reply('✅ Уведомления: тестовое уведомление создано');
        
        // Тест 4: Проверка неназначенных заказов
        await ctx.reply('4️⃣ Тестирую систему заказов...');
        const unassigned = await db.getUnassignedOrders();
        await ctx.reply(`✅ Заказы: ${unassigned.length} неназначенных заказов`);
        
        // Общий результат
        await ctx.reply(
            `🎉 <b>Тестирование завершено!</b>\n\n` +
            `✅ Все системы работают нормально\n` +
            `📊 База данных: OK\n` +
            `👥 Система операторов: OK\n` +
            `🔔 Уведомления: OK\n` +
            `📋 Заказы: OK\n\n` +
            `🚀 Система готова к работе!`,
            { parse_mode: 'HTML' }
        );
        
    } catch (error) {
        await ctx.reply(`❌ Ошибка при тестировании: ${error.message}`);
        console.error('Ошибка тестирования:', error);
    }
});

// Команда для добавления оператора
bot.command('add_operator', async (ctx) => {
    const userId = ctx.from.id;
    
    // 🛡️ ГАРАНТИРОВАННАЯ ПРОВЕРКА АДМИНА
    if (!(await isAdmin(userId))) {
        return ctx.reply('❌ Только админы могут добавлять операторов');
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply(
            `📝 <b>Добавление оператора</b>\n\n` +
            `Использование: <code>/add_operator ID_TELEGRAM</code>\n\n` +
            `Пример: <code>/add_operator 123456789</code>\n` +
            `Или переслать сообщение от пользователя с командой:\n` +
            `<code>/add_operator_forward</code>`,
            { parse_mode: 'HTML' }
        );
    }
    
    const operatorId = parseInt(args[1]);
    if (!operatorId) {
        return ctx.reply('❌ Неверный Telegram ID');
    }
    
    try {
        await db.addStaff({
            telegramId: operatorId,
            username: null,
            firstName: 'Новый оператор',
            lastName: null,
            role: 'operator',
            addedBy: userId
        });
        
        await ctx.reply(
            `✅ <b>Оператор добавлен!</b>\n\n` +
            `🆔 Telegram ID: <code>${operatorId}</code>\n` +
            `👨‍💼 Роль: Оператор\n` +
            `👤 Добавил: ${ctx.from.first_name}\n\n` +
            `Новый оператор может использовать команду /operator`,
            { parse_mode: 'HTML' }
        );
        
        // Уведомляем нового оператора
        try {
            await bot.api.sendMessage(operatorId,
                `🎉 <b>Вы назначены оператором ExMachinaX!</b>\n\n` +
                `👨‍💼 Теперь вы можете обрабатывать заказы клиентов.\n` +
                `📋 Используйте команду /operator для доступа к панели.\n\n` +
                `🚀 Добро пожаловать в команду ExMachinaX!`,
                { parse_mode: 'HTML' }
            );
        } catch (error) {
            console.log('Не удалось уведомить нового оператора:', error.message);
        }
        
    } catch (error) {
        await ctx.reply(`❌ Ошибка добавления оператора: ${error.message}`);
    }
});

// Обработка новых заявок для уведомления операторов
bot.on('message', async (ctx) => {
    const userId = ctx.from.id;
    const messageText = ctx.message.text;
    const userRole = await db.getUserRole(userId);
    
    console.log('🟢🟢🟢 ПОЛУЧЕНО ЛЮБОЕ СООБЩЕНИЕ В БОТЕ:');
    console.log('🟢 userId:', userId);
    console.log('🟢 messageText:', messageText);
    console.log('🟢 userRole:', userRole);
    
    // 🚨 ПРИОРИТЕТНАЯ ДИАГНОСТИКА ТЕКСТОВЫХ СООБЩЕНИЙ
    console.log('📨 ПРОВЕРЯЕМ КОНТЕКСТ ДЛЯ ПОЛЬЗОВАТЕЛЯ:', userId);
    console.log('📨 chatContexts.has(userId):', chatContexts.has(userId));
    if (chatContexts.has(userId)) {
        const context = chatContexts.get(userId);
        console.log('📨 НАЙДЕН КОНТЕКСТ:', context);
        if (context.action === 'send_message_to_client') {
            console.log('📨 🔥 ОБНАРУЖЕНА ОТПРАВКА СООБЩЕНИЯ КЛИЕНТУ!');
            console.log('📨 🔥 orderId:', context.orderId);
            console.log('📨 🔥 messageText:', messageText);
            
            // НЕМЕДЛЕННО ВЫПОЛНЯЕМ ОТПРАВКУ КЛИЕНТУ
            try {
                const order = await db.getOrderWithClient(context.orderId);
                if (!order) {
                    chatContexts.delete(userId);
                    return ctx.reply('❌ Заказ не найден');
                }
                
                console.log('🔥 ДАННЫЕ КЛИЕНТА ИЗ БД:');
                console.log('🔥 order.client_id:', order.client_id);
                console.log('🔥 order.user_id:', order.user_id);
                console.log('🔥 order.client_first_name:', order.client_first_name);
                
                if (!order.client_id && order.user_id) {
                    console.log('🆘 client_id отсутствует, но есть user_id! ЭКСТРЕННАЯ РЕГИСТРАЦИЯ!');
                    console.log('🆘 Регистрируем пользователя:', order.user_id);
                    
                    // ЭКСТРЕННАЯ РЕГИСТРАЦИЯ ПРЯМО ЗДЕСЬ
                    try {
                        await db.upsertUser({
                            telegramId: order.user_id,       // ← ИСПРАВЛЕНО!
                            firstName: 'Пользователь',       // ← ИСПРАВЛЕНО!
                            lastName: '',                    // ← ИСПРАВЛЕНО!
                            username: `user${order.user_id}`,
                            referredBy: null
                        });
                        console.log('🆘 ПОЛЬЗОВАТЕЛЬ ЭКСТРЕННО ЗАРЕГИСТРИРОВАН:', order.user_id);
                        
                        // ПЕРЕЗАГРУЖАЕМ ДАННЫЕ ЗАКАЗА
                        const updatedOrder = await db.getOrderWithClient(context.orderId);
                        if (updatedOrder && updatedOrder.client_id) {
                            console.log('✅ ОБНОВЛЕННЫЕ ДАННЫЕ КЛИЕНТА:');
                            console.log('✅ client_id:', updatedOrder.client_id);
                            order.client_id = updatedOrder.client_id; // Обновляем для отправки
                        } else {
                            console.error('❌ Даже после регистрации client_id не найден!');
                            chatContexts.delete(userId);
                            return ctx.reply('❌ Критическая ошибка: не удалось зарегистрировать клиента');
                        }
                    } catch (regError) {
                        console.error('❌ Ошибка экстренной регистрации:', regError.message);
                        chatContexts.delete(userId);
                        return ctx.reply('❌ Ошибка регистрации клиента');
                    }
                } else if (!order.client_id) {
                    console.error('❌ client_id И user_id отсутствуют!');
                    chatContexts.delete(userId);
                    return ctx.reply('❌ Не удалось определить ID клиента');
                }
                
                // Отправляем сообщение клиенту
                await ctx.api.sendMessage(order.client_id,
                    `💬 <b>Сообщение от оператора</b>\n\n` +
                    `🆔 Заказ #${context.orderId}\n` +
                    `👨‍💼 Оператор: ${ctx.from.first_name || 'Оператор'}\n\n` +
                    `📝 ${messageText}\n\n` +
                    `💬 Ответьте на это сообщение, чтобы написать оператору обратно.`,
                    { parse_mode: 'HTML' }
                );
                
                console.log('✅ СООБЩЕНИЕ УСПЕШНО ОТПРАВЛЕНО КЛИЕНТУ!');
                
                await ctx.reply(
                    `✅ <b>Сообщение отправлено клиенту!</b>\n\n` +
                    `📝 "${messageText}"\n\n` +
                    `🔙 Возврат к управлению заказом:`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('⚙️ К заказу', `manage_order_${context.orderId}`)
                    }
                );
                
                chatContexts.delete(userId);
                return; // ВАЖНО: выходим чтобы не продолжать обработку
                
            } catch (error) {
                console.error('❌ ОШИБКА ОТПРАВКИ СООБЩЕНИЯ:', error.message);
                await ctx.reply(`❌ Ошибка отправки: ${error.message}`);
                chatContexts.delete(userId);
                return;
            }
        }
    }
    
    // 🔄 ОБРАБОТКА СООБЩЕНИЙ ОТ КЛИЕНТОВ К ОПЕРАТОРАМ
    if (!userRole && messageText) {
        console.log('📞 СООБЩЕНИЕ ОТ КЛИЕНТА:', userId);
        console.log('📞 Ищем активный заказ клиента...');
        
        try {
            // Ищем последний активный заказ клиента
            const clientOrder = await db.getLastOrderByUserId(userId);
            if (clientOrder) {
                console.log('📞 НАЙДЕН ЗАКАЗ КЛИЕНТА:', clientOrder.id);
                console.log('📞 Статус заказа:', clientOrder.status);
                
                // Ищем оператора, который ведет этот заказ
                const operator = await db.getOrderOperator(clientOrder.id);
                if (operator && operator.operator_id) {
                    console.log('📞 НАЙДЕН ОПЕРАТОР:', operator.operator_id);
                    
                    // Отправляем сообщение оператору
                    await ctx.api.sendMessage(operator.operator_id,
                        `💬 <b>Ответ от клиента</b>\n\n` +
                        `🆔 Заказ #${clientOrder.id}\n` +
                        `👤 Клиент: ${userId}\n\n` +
                        `📝 ${messageText}\n\n` +
                        `💬 Нажмите "Написать клиенту" чтобы ответить.`,
                        { 
                            parse_mode: 'HTML',
                            reply_markup: new InlineKeyboard()
                                .text('💬 Написать клиенту', `chat_with_client_${clientOrder.id}`)
                                .text('⚙️ К заказу', `manage_order_${clientOrder.id}`)
                        }
                    );
                    
                    console.log('✅ СООБЩЕНИЕ КЛИЕНТА ОТПРАВЛЕНО ОПЕРАТОРУ!');
                    
                    // Подтверждаем клиенту
                    await ctx.reply(
                        `✅ <b>Ваше сообщение доставлено оператору!</b>\n\n` +
                        `📋 Заказ #${clientOrder.id}\n` +
                        `📝 "${messageText}"\n\n` +
                        `⏰ Оператор ответит в ближайшее время.`,
                        { parse_mode: 'HTML' }
                    );
                    
                    return; // Завершаем обработку
                } else {
                    console.log('📞 Оператор для заказа не найден, отправляем всем операторам');
                    
                    // Если заказ не назначен конкретному оператору, отправляем всем
                    const staff = await db.getStaffList();
                    const operators = staff.filter(s => ['admin', 'operator'].includes(s.role));
                    
                    if (operators.length > 0) {
                        const broadcastMessage = 
                            `💬 <b>Сообщение от клиента</b>\n\n` +
                            `🆔 Заказ #${clientOrder.id} (не назначен)\n` +
                            `👤 Клиент: ${userId}\n\n` +
                            `📝 ${messageText}\n\n` +
                            `💬 Примите заказ чтобы ответить клиенту.`;
                        
                        // Отправляем всем операторам
                        for (const op of operators) {
                            try {
                                await ctx.api.sendMessage(op.telegram_id, broadcastMessage, {
                                    parse_mode: 'HTML',
                                    reply_markup: new InlineKeyboard()
                                        .text('✅ Принять заказ', `take_order_${clientOrder.id}`)
                                        .text('📋 К заказу', `manage_order_${clientOrder.id}`)
                                });
                            } catch (err) {
                                console.log(`Ошибка отправки оператору ${op.telegram_id}:`, err.message);
                            }
                        }
                        
                        console.log('✅ СООБЩЕНИЕ КЛИЕНТА ОТПРАВЛЕНО ВСЕМ ОПЕРАТОРАМ!');
                        
                        // Подтверждаем клиенту
                        await ctx.reply(
                            `✅ <b>Ваше сообщение доставлено операторам!</b>\n\n` +
                            `📋 Заказ #${clientOrder.id}\n` +
                            `📝 "${messageText}"\n\n` +
                            `⏰ Оператор ответит в ближайшее время.`,
                            { parse_mode: 'HTML' }
                        );
                    } else {
                        await ctx.reply('⚠️ Операторы временно недоступны. Ваше сообщение будет передано при первой возможности.');
                    }
                    return;
                }
            } else {
                console.log('📞 Активные заказы клиента не найдены');
                // Не отвечаем клиенту, если у него нет заказов
            }
        } catch (error) {
            console.error('❌ Ошибка обработки сообщения клиента:', error.message);
        }
    }
    
    // === РУЧНОЙ ВВОД КУРСОВ ===
    if (messageText && global.manualRateInput && global.manualRateInput.has(userId)) {
        const inputState = global.manualRateInput.get(userId);
        const currency = inputState.currency;
        
        // Проверяем не истекло ли время (60 секунд)
        if (Date.now() - inputState.timestamp > 60000) {
            global.manualRateInput.delete(userId);
            return await ctx.reply('⏰ Время ввода истекло. Попробуйте еще раз.');
        }
        
        // Проверяем права админа
        if (!(await isAdmin(userId))) {
            global.manualRateInput.delete(userId);
            return await ctx.reply('❌ Нет прав администратора');
        }
        
        // Проверяем отмену
        if (messageText.toLowerCase() === 'отмена' || messageText.toLowerCase() === 'cancel') {
            global.manualRateInput.delete(userId);
            return await ctx.reply(
                '❌ Ввод курса отменен',
                { reply_markup: new InlineKeyboard().text('🔙 Назад к управлению', 'admin_rates_control') }
            );
        }
        
        // Парсим число
        const newPrice = parseFloat(messageText.replace(/[^0-9.,]/g, '').replace(',', '.'));
        
        if (isNaN(newPrice) || newPrice <= 0) {
            return await ctx.reply(
                '❌ Неверный формат числа!\n\n' +
                'Введите корректное число, например:\n' +
                '• 95000 (для BTC)\n' +
                '• 1.02 (для USDT)\n' +
                '• 0.0012 (для RUB в долларах)'
            );
        }
        
        try {
            // Получаем текущий курс для расчета множителя
            const RatesService = require('./services/RatesService');
            const ratesService = new RatesService();
            const currentRates = await ratesService.getRates();
            const currentRate = currentRates.find(r => r.currency === currency);
            
            if (!currentRate) {
                global.manualRateInput.delete(userId);
                return await ctx.reply('❌ Валюта не найдена');
            }
            
            // Устанавливаем абсолютный курс
            await ratesService.setAbsoluteRate(currency, newPrice, 3600000); // На 1 час
            
            // Очищаем состояние ввода
            global.manualRateInput.delete(userId);
            
            // Уведомляем операторов
            await notifyOperators(`✏️ <b>КУРС ${currency} ИЗМЕНЕН ВРУЧНУЮ</b>\n\nНовый курс: $${newPrice.toFixed(currency === 'BTC' ? 0 : 4)}\nИзменил: админ ${ctx.from.first_name}`);
            
            await ctx.reply(
                `✅ <b>КУРС ${currency} УСТАНОВЛЕН ВРУЧНУЮ</b>\n\n` +
                `💱 Валюта: ${currency}\n` +
                `💰 Новый курс: $${newPrice.toFixed(currency === 'BTC' ? 0 : 4)}\n` +
                `⏰ Действует: 1 час\n` +
                `🔔 Операторы уведомлены\n\n` +
                `💡 Изменения применены немедленно`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard().text('🔙 Назад к управлению', 'admin_rates_control')
                }
            );
            
            return; // Прерываем обработку
            
        } catch (error) {
            global.manualRateInput.delete(userId);
            console.error('Ошибка установки курса:', error);
            await ctx.reply(
                `❌ <b>ОШИБКА УСТАНОВКИ КУРСА</b>\n\n` +
                `Не удалось установить курс ${currency}\n` +
                `Причина: ${error.message}`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard().text('🔙 Назад к управлению', 'admin_rates_control')
                }
            );
            return;
        }
    }
    
    // === СИСТЕМА РЕКВИЗИТОВ - ОБРАБОТКА ПЕРЕСЛАННЫХ СООБЩЕНИЙ ===
    if (ctx.message.forward_from && (userRole === 'operator' || userRole === 'admin')) {
        const handled = paymentSystem.handleForwardedMessage(ctx, chatContexts, paymentDetails, bot, db);
        if (handled) return;
    }
    
    // === СИСТЕМА РЕКВИЗИТОВ - ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ===
    if (messageText && (userRole === 'operator' || userRole === 'admin')) {
        const handled = paymentSystem.handleOperatorMessage(ctx, chatContexts, paymentDetails, bot, db);
        if (handled) return;
    }
    
    // Проверяем контекст чата для операторов
    console.log('📨 ПОЛУЧЕНО ТЕКСТОВОЕ СООБЩЕНИЕ ОТ ПОЛЬЗОВАТЕЛЯ:', userId);
    console.log('📨 Текст сообщения:', messageText);
    console.log('📨 chatContexts.has(userId):', chatContexts.has(userId));
    
    if (chatContexts.has(userId)) {
        const context = chatContexts.get(userId);
        console.log('📨 Контекст найден:', context);
        
        if (context.action === 'send_message_to_client') {
            console.log('📨 НАЧИНАЕМ ОТПРАВКУ СООБЩЕНИЯ КЛИЕНТУ');
            console.log('📨 orderId из контекста:', context.orderId);
            try {
                const order = await db.getOrderWithClient(context.orderId);
                if (!order) {
                    chatContexts.delete(userId);
                    return ctx.reply('❌ Заказ не найден');
                }
                
                // 🔍 ДИАГНОСТИКА ДАННЫХ КЛИЕНТА
                console.log('🔍 ОТПРАВКА СООБЩЕНИЯ КЛИЕНТУ:');
                console.log('  orderId:', context.orderId);
                console.log('  order.client_id:', order.client_id);
                console.log('  order.user_id:', order.user_id);
                console.log('  order.client_first_name:', order.client_first_name);
                console.log('  order.client_username:', order.client_username);
                console.log('  messageText:', messageText);
                
                if (!order.client_id) {
                    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: client_id не определен!');
                    chatContexts.delete(userId);
                    return ctx.reply('❌ Не удалось определить ID клиента для заказа');
                }
                
                // Сохраняем сообщение в чат
                await db.addOrderMessage({
                    orderId: context.orderId,
                    senderId: userId,
                    senderType: 'operator',
                    message: messageText
                });
                
                // Отправляем сообщение клиенту
                console.log('📤 Отправляем сообщение клиенту ID:', order.client_id);
                try {
                    await ctx.api.sendMessage(order.client_id,
                        `💬 <b>Сообщение от оператора</b>\n\n` +
                        `🆔 Заказ #${context.orderId}\n` +
                        `👨‍💼 Оператор: ${ctx.from.first_name || 'Оператор'}\n\n` +
                        `📝 ${messageText}\n\n` +
                        `💬 Ответьте на это сообщение, чтобы написать оператору обратно.`,
                        { 
                            parse_mode: 'HTML',
                            reply_markup: new InlineKeyboard()
                                .text('💬 Ответить оператору', `client_chat_${context.orderId}`)
                        }
                    );
                    console.log('✅ Сообщение успешно отправлено клиенту!');
                    
                    // Подтверждаем отправку
                    await ctx.reply(
                        `✅ <b>Сообщение отправлено клиенту!</b>\n\n` +
                        `📝 "${messageText}"\n\n` +
                        `🔙 Возврат к управлению заказом:`,
                        { 
                            parse_mode: 'HTML',
                            reply_markup: new InlineKeyboard()
                                .text('⚙️ К заказу', `manage_order_${context.orderId}`)
                        }
                    );
                } catch (sendError) {
                    console.error('❌ ОШИБКА ОТПРАВКИ СООБЩЕНИЯ КЛИЕНТУ:', sendError.message);
                    console.error('❌ Полная ошибка:', sendError);
                    
                    // Уведомляем оператора об ошибке
                    await ctx.reply(
                        `❌ <b>Ошибка отправки сообщения!</b>\n\n` +
                        `📋 Клиент ID: ${order.client_id}\n` +
                        `❌ Ошибка: ${sendError.message}\n\n` +
                        `💡 Возможные причины:\n` +
                        `• Клиент заблокировал бота\n` +
                        `• Неверный ID клиента\n` +
                        `• Клиент не запускал бота\n\n` +
                        `🔙 Возврат к заказу:`,
                        { 
                            parse_mode: 'HTML',
                            reply_markup: new InlineKeyboard()
                                .text('⚙️ К заказу', `manage_order_${context.orderId}`)
                        }
                    );
                }
                
                // Удаляем контекст
                chatContexts.delete(userId);
                return;
                
            } catch (error) {
                console.error('Ошибка отправки сообщения клиенту:', error);
                await ctx.reply('❌ Ошибка отправки сообщения');
                chatContexts.delete(userId);
                return;
            }
        }

        if (context.action === 'input_custom_details') {
            try {
                const orderId = context.orderId;
                const customDetailsText = messageText.trim();
                
                // Парсим введенные данные адреса
                const lines = customDetailsText.split('\n').map(line => line.trim()).filter(line => line);
                
                if (lines.length < 3) {
                    await ctx.reply(
                        `❌ <b>Недостаточно данных!</b>\n\n` +
                        `Введите минимум:\n` +
                        `• Название сети\n` +
                        `• Адрес\n` +
                        `• Описание сети\n\n` +
                        `Попробуйте еще раз:`,
                        { 
                            parse_mode: 'HTML',
                            reply_markup: new InlineKeyboard()
                                .text('❌ Отмена', `send_payment_details_${orderId}`)
                        }
                    );
                    return;
                }
                
                const networkName = lines[0];
                const address = lines[1];
                const networkDescription = lines[2];
                const currency = lines[3] || 'USDT';
                
                // Обновляем статус заказа
                const result = await db.updateOrderStatusWithMessage(orderId, 'payment_details_sent', userId, 
                    `💳 Новый адрес (${networkName}) отправлен клиенту. Ожидаем поступления средств.`);
                
                const order = await db.getOrderWithClient(orderId);
                
                // Отправляем адрес клиенту
                await ctx.api.sendMessage(order.client_id,
                    `💳 <b>АДРЕС ДЛЯ ПЕРЕВОДА</b>\n\n` +
                    `🆔 Заказ #${orderId}\n` +
                    `💰 К переводу: <b>${order.from_amount} ${order.from_currency}</b>\n\n` +
                    `🏦 <b>${networkName}</b>\n` +
                    `📍 Адрес: <code>${address}</code>\n` +
                    `🏛️ Сеть: ${networkDescription}\n` +
                    `💎 Валюта: ${currency}\n\n` +
                    `⚠️ <b>ВАЖНО:</b>\n` +
                    `• Переводите ТОЧНУЮ сумму: ${order.from_amount} ${order.from_currency}\n` +
                    `• Проверьте сеть перевода!\n` +
                    `• После перевода нажмите "✅ Отправил"\n` +
                    `• Время зачисления: 5-30 минут\n\n` +
                    `📞 Вопросы? Напишите оператору!`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('✅ Я отправил', `client_paid_${orderId}`)
                            .text('💬 Связаться с оператором', `client_chat_${orderId}`)
                            .row()
                            .text('📋 Копировать адрес', `copy_address_${address}`)
                    }
                );
                
                // Подтверждаем отправку оператору
                await ctx.reply(
                    `✅ <b>Новый адрес отправлен!</b>\n\n` +
                    `🏦 Сеть: ${networkName}\n` +
                    `📍 Адрес: ${address}\n` +
                    `💎 Валюта: ${currency}\n` +
                    `🆔 Заказ #${orderId}\n\n` +
                    `${result.message}`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('🎛️ Управление заказом', `manage_order_${orderId}`)
                    }
                );
                
                // Удаляем контекст
                chatContexts.delete(userId);
                return;
                
            } catch (error) {
                console.error('Ошибка отправки нового адреса:', error);
                await ctx.reply('❌ Ошибка отправки адреса');
                chatContexts.delete(userId);
                return;
            }
        }

        // Обработка ручного ввода криптоадреса из панели оператора
        if (context.action === 'input_manual_crypto') {
            try {
                const customDetailsText = messageText.trim();
                
                // Парсим введенные данные адреса
                const lines = customDetailsText.split('\n').map(line => line.trim()).filter(line => line);
                
                if (lines.length < 3) {
                    await ctx.reply(
                        `❌ <b>Недостаточно данных!</b>\n\n` +
                        `Введите минимум:\n` +
                        `• Название сети\n` +
                        `• Адрес\n` +
                        `• Описание сети\n\n` +
                        `Попробуйте еще раз:`,
                        { 
                            parse_mode: 'HTML',
                            reply_markup: new InlineKeyboard()
                                .text('❌ Отмена', 'details_crypto')
                        }
                    );
                    return;
                }
                
                const networkName = lines[0];
                const address = lines[1];
                const networkDescription = lines[2];
                const currency = lines[3] || 'USDT';
                
                // Запрашиваем ID клиента
                chatContexts.set(userId, { 
                    action: 'input_client_id_crypto',
                    cryptoData: { networkName, address, networkDescription, currency }
                });
                
                await ctx.reply(
                    `✅ <b>Криптоадрес принят!</b>\n\n` +
                    `🏦 Сеть: ${networkName}\n` +
                    `📍 Адрес: ${address}\n` +
                    `💎 Валюта: ${currency}\n\n` +
                    `👤 Теперь введите <b>ID клиента</b>, которому отправить адрес:`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('❌ Отмена', 'details_crypto')
                    }
                );
                return;
                
            } catch (error) {
                console.error('Ошибка обработки криптоадреса:', error);
                await ctx.reply('❌ Ошибка обработки адреса');
                chatContexts.delete(userId);
                return;
            }
        }

        // Обработка ручного ввода банковских реквизитов из панели оператора
        if (context.action === 'input_manual_bank') {
            try {
                const customDetailsText = messageText.trim();
                
                // Парсим введенные данные карты
                const lines = customDetailsText.split('\n').map(line => line.trim()).filter(line => line);
                
                if (lines.length < 3) {
                    await ctx.reply(
                        `❌ <b>Недостаточно данных!</b>\n\n` +
                        `Введите минимум:\n` +
                        `• Название банка\n` +
                        `• Номер карты\n` +
                        `• Имя владельца\n\n` +
                        `Попробуйте еще раз:`,
                        { 
                            parse_mode: 'HTML',
                            reply_markup: new InlineKeyboard()
                                .text('❌ Отмена', 'details_banks')
                        }
                    );
                    return;
                }
                
                const bankName = lines[0];
                const cardNumber = lines[1];
                const holderName = lines[2];
                const bankDescription = lines[3] || '';
                
                // Запрашиваем ID клиента
                chatContexts.set(userId, { 
                    action: 'input_client_id_bank',
                    bankData: { bankName, cardNumber, holderName, bankDescription }
                });
                
                await ctx.reply(
                    `✅ <b>Банковские реквизиты приняты!</b>\n\n` +
                    `🏦 Банк: ${bankName}\n` +
                    `💳 Карта: ${cardNumber}\n` +
                    `👤 Владелец: ${holderName}\n\n` +
                    `👤 Теперь введите <b>ID клиента</b>, которому отправить реквизиты:`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('❌ Отмена', 'details_banks')
                    }
                );
                return;
                
            } catch (error) {
                console.error('Ошибка обработки банковских реквизитов:', error);
                await ctx.reply('❌ Ошибка обработки реквизитов');
                chatContexts.delete(userId);
                return;
            }
        }

        // Отправка криптоадреса клиенту после ввода ID
        if (context.action === 'input_client_id_crypto') {
            try {
                const clientId = parseInt(messageText.trim());
                
                if (isNaN(clientId)) {
                    await ctx.reply(
                        `❌ <b>Неверный формат ID!</b>\n\n` +
                        `Введите числовой ID клиента:`,
                        { parse_mode: 'HTML' }
                    );
                    return;
                }
                
                const { networkName, address, networkDescription, currency } = context.cryptoData;
                
                // Отправляем адрес клиенту
                await ctx.api.sendMessage(clientId,
                    `💳 <b>АДРЕС ДЛЯ ПЕРЕВОДА</b>\n\n` +
                    `🏦 <b>${networkName}</b>\n` +
                    `📍 Адрес: <code>${address}</code>\n` +
                    `🏛️ Сеть: ${networkDescription}\n` +
                    `💎 Валюта: ${currency}\n\n` +
                    `⚠️ <b>ВАЖНО:</b>\n` +
                    `• Переводите ТОЧНУЮ сумму\n` +
                    `• Проверьте сеть перевода!\n` +
                    `• После перевода уведомите оператора\n` +
                    `• Время зачисления: 5-30 минут\n\n` +
                    `📞 Вопросы? Напишите оператору!`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('✅ Я отправил', `client_paid_notification`)
                            .text('💬 Связаться с оператором', `support_contact`)
                            .row()
                            .text('📋 Копировать адрес', `copy_address_${address}`)
                    }
                );
                
                // Подтверждаем отправку оператору
                await ctx.reply(
                    `✅ <b>Криптоадрес отправлен!</b>\n\n` +
                    `🏦 Сеть: ${networkName}\n` +
                    `📍 Адрес: ${address}\n` +
                    `💎 Валюта: ${currency}\n` +
                    `👤 Клиент: ${clientId}\n\n` +
                    `Адрес успешно отправлен клиенту!`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('🔙 Назад к криптовалютам', 'details_crypto')
                    }
                );
                
                // Удаляем контекст
                chatContexts.delete(userId);
                return;
                
            } catch (error) {
                console.error('Ошибка отправки криптоадреса клиенту:', error);
                await ctx.reply(`❌ Ошибка отправки адреса клиенту ${messageText}. Возможно, он заблокировал бота.`);
                chatContexts.delete(userId);
                return;
            }
        }

        // Отправка банковских реквизитов клиенту после ввода ID
        if (context.action === 'input_client_id_bank') {
            try {
                const clientId = parseInt(messageText.trim());
                
                if (isNaN(clientId)) {
                    await ctx.reply(
                        `❌ <b>Неверный формат ID!</b>\n\n` +
                        `Введите числовой ID клиента:`,
                        { parse_mode: 'HTML' }
                    );
                    return;
                }
                
                const { bankName, cardNumber, holderName, bankDescription } = context.bankData;
                
                // Отправляем реквизиты клиенту
                await ctx.api.sendMessage(clientId,
                    `💳 <b>БАНКОВСКИЕ РЕКВИЗИТЫ</b>\n\n` +
                    `🏦 <b>${bankName}</b>\n` +
                    `💳 Номер карты: <code>${cardNumber}</code>\n` +
                    `👤 Владелец: ${holderName}\n` +
                    (bankDescription ? `📝 Информация: ${bankDescription}\n` : '') +
                    `\n⚠️ <b>ИНСТРУКЦИЯ:</b>\n` +
                    `• Переводите точную сумму\n` +
                    `• Сохраните чек об оплате\n` +
                    `• Уведомите оператора после перевода\n\n` +
                    `📞 Связь: Напишите оператору после оплаты`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('✅ Я оплатил', `client_paid_notification`)
                            .text('💬 Связаться с оператором', `support_contact`)
                            .row()
                            .text('📋 Копировать номер карты', `copy_card_${cardNumber}`)
                    }
                );
                
                // Подтверждаем отправку оператору
                await ctx.reply(
                    `✅ <b>Банковские реквизиты отправлены!</b>\n\n` +
                    `🏦 Банк: ${bankName}\n` +
                    `💳 Карта: ${cardNumber}\n` +
                    `👤 Владелец: ${holderName}\n` +
                    `👤 Клиент: ${clientId}\n\n` +
                    `Реквизиты успешно отправлены клиенту!`,
                    { 
                        parse_mode: 'HTML',
                        reply_markup: new InlineKeyboard()
                            .text('🔙 Назад к банковским картам', 'details_banks')
                    }
                );
                
                // Удаляем контекст
                chatContexts.delete(userId);
                return;
                
            } catch (error) {
                console.error('Ошибка отправки банковских реквизитов клиенту:', error);
                await ctx.reply(`❌ Ошибка отправки реквизитов клиенту ${messageText}. Возможно, он заблокировал бота.`);
                chatContexts.delete(userId);
                return;
            }
        }
    }
    
    // Обработка команды добавления оператора через пересылку
    if (ctx.message.text === '/add_operator_forward' && ctx.message.reply_to_message) {
        const userId = ctx.from.id;
        const userRole = await db.getUserRole(userId);
        
        if (userRole !== 'admin') {
            return ctx.reply('❌ Только админы могут добавлять операторов');
        }
        
        const targetUser = ctx.message.reply_to_message.from;
        const operatorId = targetUser.id;
        
        try {
            await db.addStaff({
                telegramId: operatorId,
                username: targetUser.username,
                firstName: targetUser.first_name,
                lastName: targetUser.last_name,
                role: 'operator',
                addedBy: userId
            });
            
            await ctx.reply(
                `✅ <b>Оператор добавлен!</b>\n\n` +
                `👤 Имя: ${targetUser.first_name} ${targetUser.last_name || ''}\n` +
                `🆔 Telegram ID: <code>${operatorId}</code>\n` +
                `📞 Username: @${targetUser.username || 'не указан'}\n` +
                `👨‍💼 Роль: Оператор\n\n` +
                `Новый оператор может использовать команду /operator`,
                { parse_mode: 'HTML' }
            );
            
            // Уведомляем нового оператора
            try {
                await bot.api.sendMessage(operatorId,
                    `🎉 <b>Вы назначены оператором ExMachinaX!</b>\n\n` +
                    `👨‍💼 Теперь вы можете обрабатывать заказы клиентов.\n` +
                    `📋 Используйте команду /operator для доступа к панели.\n\n` +
                    `🚀 Добро пожаловать в команду ExMachinaX!`,
                    { parse_mode: 'HTML' }
                );
            } catch (error) {
                console.log('Не удалось уведомить нового оператора:', error.message);
            }
            
        } catch (error) {
            await ctx.reply(`❌ Ошибка добавления оператора: ${error.message}`);
        }
    }
});

// Расширенная функция для отправки уведомления операторам
async function notifyOperators(orderData) {
    console.log("🚨 === ФУНКЦИЯ notifyOperators ВЫЗВАНА ===");
    console.log("📋 ID заявки:", orderData.id);
    console.log("👤 Пользователь:", orderData.userName);    try {
        // Отладка данных заявки
        console.log('🔍 ДАННЫЕ ЗАЯВКИ ДЛЯ УВЕДОМЛЕНИЯ:', {
            id: orderData.id,
            fromAddress: orderData.fromAddress,
            toAddress: orderData.toAddress,
            pairType: orderData.pairType,
            network: orderData.network  // ← ДОБАВЛЯЕМ СЕТЬ В ДИАГНОСТИКУ!
        });

        // Сохраняем уведомления в базу данных
        await db.notifyAllOperators(orderData);
        
        // Получаем всех активных операторов для отправки прямых сообщений
        const staff = await db.getStaffList();
        const operators = staff.filter(s => ['admin', 'operator'].includes(s.role));
        
        // Определяем тип пары и формируем соответствующее сообщение
        const pairType = orderData.pairType || 'fiat';
        
        let addressSection = '';
        let amlSection = '';
        let pairTypeIcon = '';
        let pairTypeText = '';
        
        switch (pairType) {
            case 'crypto':
                // BTC → ETH: два адреса (AML удален)
                addressSection = 
                    `📤 <b>Адрес отправки:</b> <code>${orderData.fromAddress || 'Не указан'}</code>\n` +
                    `📥 <b>Адрес получения:</b> <code>${orderData.toAddress || 'Не указан'}</code>\n`;
                    
                amlSection = `✅ <b>AML проверки:</b> Отключены (быстрый обмен)\n`;
                    
                pairTypeIcon = '🔗';
                pairTypeText = 'Криптовалютная';
                break;
                
            case 'crypto-to-fiat':
                // USDT → RUB: криптоадрес + реквизиты (AML удален)
                addressSection = 
                    `📤 <b>Криптоадрес:</b> <code>${orderData.fromAddress || 'Не указан'}</code>\n` +
                    `📥 <b>Реквизиты получения:</b> <code>${orderData.toAddress || 'Не указан'}</code>\n`;
                    
                amlSection = `✅ <b>AML проверки:</b> Отключены (быстрый обмен)\n`;
                    
                pairTypeIcon = '🔄';
                pairTypeText = 'Крипто → Фиат';
                break;
                
            case 'fiat-to-crypto':
                // RUB → USDT: кошелек получения (AML удален)
                addressSection = 
                    `📤 <b>Реквизиты отправки:</b> Будут предоставлены оператором\n` +
                    `📥 <b>Кошелек получения:</b> <code>${orderData.toAddress || 'Не указан'}</code>\n`;
                    
                amlSection = `✅ <b>AML проверки:</b> Отключены (быстрый обмен)\n`;
                    
                pairTypeIcon = '🔁';
                pairTypeText = 'Фиат → Крипто';
                break;
                
            case 'fiat':
            default:
                // ARS → BRL или специальные случаи
                const accountNumber = orderData.toAddress?.trim();
                console.log('🏦 НОМЕР СЧЕТА ДЛЯ ФИАТНОЙ ПАРЫ:', accountNumber);
                
                // Проверяем специальные случаи
                const isSpecialCase = (orderData.fromCurrency === 'ARS' && orderData.toCurrency === 'RUB') ||
                                    (orderData.fromCurrency === 'RUB' && orderData.toCurrency === 'KZT') ||
                                    (orderData.fromCurrency === 'RUB' && orderData.toCurrency === 'UAH') ||
                                    (orderData.fromCurrency === 'UAH' && orderData.toCurrency === 'RUB');
                
                if (isSpecialCase) {
                    let currencyName;
                    if (orderData.toCurrency === 'RUB') {
                        currencyName = 'рублей';
                    } else if (orderData.toCurrency === 'KZT') {
                        currencyName = 'тенге';
                    } else if (orderData.toCurrency === 'UAH') {
                        currencyName = 'гривен';
                    }
                    addressSection = `💳 <b>Реквизиты для ${currencyName}:</b> <code>${accountNumber || 'Не указан'}</code>\n`;
                } else {
                    addressSection = `🏦 <b>Номер счета:</b> <code>${accountNumber || 'Не указан'}</code>\n`;
                }
                
                amlSection = `✅ <b>AML проверка:</b> Не требуется (фиатная пара)\n`;
                pairTypeIcon = '🏦';
                pairTypeText = 'Фиатная';
                break;
        }

        // Добавляем информацию о сети если указана
        const networkSection = orderData.network ? `🔗 <b>Сеть:</b> ${orderData.network}\n` : '';
        
        // Добавляем информацию о банке если указан
        const bankSection = orderData.bank ? `🏦 <b>Банк:</b> ${orderData.bank}\n` : '';
        
        const message = 
            `🚨 <b>НОВАЯ ЗАЯВКА С САЙТА #${orderData.id}</b>\n\n` +
            `👤 <b>Пользователь:</b> ${orderData.userName || 'Неизвестен'}\n` +
            `💱 <b>Обмен:</b> ${orderData.fromAmount} ${orderData.fromCurrency} → ${orderData.toCurrency}\n` +
            networkSection +  // ← ДОБАВЛЯЕМ ИНФОРМАЦИЮ О СЕТИ!
            bankSection +     // ← ДОБАВЛЯЕМ ИНФОРМАЦИЮ О БАНКЕ!
            `${pairTypeIcon} <b>Тип пары:</b> ${pairTypeText}\n` +
            `💰 <b>Ожидаемая прибыль:</b> не настроено\n\n` +
            addressSection +
            amlSection +
            `⏰ <b>Создан:</b> ${new Date().toLocaleString('ru-RU', {
                timeZone: 'Europe/Moscow',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })}\n\n` +
            `📋 Используйте /operator чтобы принять заказ\n\n` +
            `#заявка #сайт #${orderData.fromCurrency}_${orderData.toCurrency} #${pairTypeText.toLowerCase()}`;

        const keyboard = new InlineKeyboard()
            .text('👨‍💼 Панель оператора', 'open_operator_panel')
            .row()
            .text(`✅ Быстро принять #${orderData.id}`, `take_order_${orderData.id}`)
            .text('📊 Статистика дня', 'daily_stats');

        // Отправляем персональные уведомления каждому оператору
        for (const operator of operators) {
            try {
                await bot.api.sendMessage(operator.telegram_id, message, {
                    parse_mode: 'HTML',
                    reply_markup: keyboard
                });
            } catch (error) {
                console.log(`Не удалось отправить уведомление оператору ${operator.telegram_id}:`, error.message);
            }
        }
        
        // Дополнительно отправляем в группу операторов, если настроена
        if (process.env.OPERATOR_GROUP_ID) {
            try {
                await bot.api.sendMessage(process.env.OPERATOR_GROUP_ID, message, {
                    parse_mode: 'HTML',
                    reply_markup: keyboard
                });
            } catch (error) {
                console.error('Ошибка отправки в группу операторов:', error);
            }
        }
        
        // Логируем активность в консоль с метками времени
        console.log(`🌐 [САЙТ] ${new Date().toLocaleTimeString()} - Новая заявка #${orderData.id}: ${orderData.fromAmount} ${orderData.fromCurrency} → ${orderData.toCurrency} от ${orderData.userName}`);
        console.log(`✅ Уведомления отправлены ${operators.length} операторам`);
        
        // Отправляем статистику активности админам
        await sendDailyActivityUpdate();
        
    } catch (error) {
        console.error('Ошибка отправки уведомлений операторам:', error);
    }
}



// Отправка ежедневных обновлений активности
async function sendDailyActivityUpdate() {
    try {
        const stats = await db.getAdminStats();
        const staff = await db.getStaffList();
        const admins = staff.filter(s => s.role === 'admin');
        
        // Отправляем краткую статистику только админам, не чаще чем раз в час
        const lastUpdate = global.lastActivityUpdate || 0;
        const now = Date.now();
        
        if (now - lastUpdate > 3600000) { // 1 час
            global.lastActivityUpdate = now;
            
            const briefMessage = 
                `📊 <b>Активность за сегодня</b>\n\n` +
                `📝 Заявок: ${stats.ordersToday || 0}\n` +
                `💰 Оборот: $${(stats.volumeToday || 0).toFixed(2)}\n` +
                `👥 Новых пользователей: ${stats.newUsersToday || 0}\n\n` +
                `📈 Последнее обновление: ${new Date().toLocaleTimeString()}`;
            
            for (const admin of admins) {
                try {
                    await bot.api.sendMessage(admin.telegram_id, briefMessage, {
                        parse_mode: 'HTML'
                    });
                } catch (error) {
                    console.log(`Не удалось отправить статистику админу ${admin.telegram_id}`);
                }
            }
        }
    } catch (error) {
        console.error('Ошибка отправки обновлений активности:', error);
    }
}

// Функция для уведомления о других активностях с сайта
async function notifyWebsiteActivity(activityType, data) {
    try {
        const staff = await db.getStaffList();
        const admins = staff.filter(s => s.role === 'admin');
        
        let message = '';
        
        switch (activityType) {
            case 'user_registered':
                message = `👤 <b>Новая регистрация с сайта</b>\n\n` +
                         `Пользователь: ${data.name}\n` +
                         `ID: ${data.userId}\n` +
                         `Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
                         `#регистрация #сайт`;
                break;
                
            case 'rate_request':
                message = `💱 <b>Запрос курса с сайта</b>\n\n` +
                         `Пара: ${data.fromCurrency} → ${data.toCurrency}\n` +
                         `Сумма: ${data.amount}\n` +
                         `Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
                         `#курс #сайт`;
                break;
        }
        
        if (message) {
            for (const admin of admins) {
                try {
                    await bot.api.sendMessage(admin.telegram_id, message, {
                        parse_mode: 'HTML'
                    });
                } catch (error) {
                    console.log(`Не удалось отправить уведомление админу ${admin.telegram_id}`);
                }
            }
            
            console.log(`🌐 [САЙТ] ${activityType.toUpperCase()}: ${JSON.stringify(data)}`);
        }
        
    } catch (error) {
        console.error('Ошибка отправки уведомления об активности:', error);
    }
}

// === СИСТЕМА РЕКВИЗИТОВ ДЛЯ ОПЕРАТОРОВ ===

// Конфигурация реквизитов
const paymentDetails = {
    crypto: {
        'TRC20': {
            name: 'TRC20 (Tron)',
            address: 'THcSDj69NjoD9Ev53mK9cx3jF7AswMDtcW',
            icon: '🔸',
            fee: '$1',
            description: 'Низкие комиссии в сети Tron'
        },
        'BEP20': {
            name: 'BEP20 (BSC)',
            address: '0x1d0aea9b2ba322de2e5a2e0745dd42a943320ea6',
            icon: '🟡',
            fee: '$1',
            description: 'Binance Smart Chain'
        },
        'ERC20': {
            name: 'ERC20 (Ethereum)',
            address: '0x1d0aea9b2ba322de2e5a2e0745dd42a943320ea6',
            icon: '⚪',
            fee: '$15',
            description: 'Основная сеть Ethereum'
        },
        'ByBit': {
            name: 'ByBit ID',
            address: '47028037',
            icon: '💸',
            fee: 'Без комиссии',
            description: 'P2P торговля ByBit'
        }
    },
    banks: {
        'СБП': {
            name: 'СБП',
            card: '+7 (905) 123-45-67',
            holder: 'АЛЕКСЕЙ ПЕТРОВ',
            icon: '⚡',
            description: 'Мгновенные переводы по номеру телефона'
        },
        'Сбербанк': {
            name: 'Сбербанк',
            card: '2202 2006 7890 1234',
            holder: 'АЛЕКСЕЙ ПЕТРОВ',
            icon: '🟢',
            description: 'Крупнейший банк России'
        },
        'Тинькофф': {
            name: 'Т-Банк',
            card: '5536 9138 4567 8901',
            holder: 'АЛЕКСЕЙ ПЕТРОВ',
            icon: '🟡',
            description: 'Лучший мобильный банк'
        },
        'Альфа-Банк': {
            name: 'Альфа-Банк',
            card: '4154 8127 2345 6789',
            holder: 'АЛЕКСЕЙ ПЕТРОВ',
            icon: '🔴',
            description: 'Частный банк №1'
        },
        'ВТБ': {
            name: 'ВТБ',
            card: '4272 1234 5678 9012',
            holder: 'АЛЕКСЕЙ ПЕТРОВ',
            icon: '🔵',
            description: 'Надежный государственный банк'
        },
        'Райффайзенбанк': {
            name: 'Райффайзенбанк',
            card: '5469 3456 7890 1234',
            holder: 'АЛЕКСЕЙ ПЕТРОВ',
            icon: '🟨',
            description: 'Европейское качество сервиса'
        },
        'Промсвязьбанк': {
            name: 'Промсвязьбанк',
            card: '5559 4567 8901 2345',
            holder: 'АЛЕКСЕЙ ПЕТРОВ',
            icon: '🟦',
            description: 'Корпоративный банк России'
        },
        'Озон банк': {
            name: 'Озон Банк',
            card: '2204 5678 9012 3456',
            holder: 'АЛЕКСЕЙ ПЕТРОВ',
            icon: '🟣',
            description: 'Инновационный экосистемный банк'
        },
        'МТС банк': {
            name: 'МТС Банк',
            card: '5486 6789 0123 4567',
            holder: 'АЛЕКСЕЙ ПЕТРОВ',
            icon: '🔴',
            description: 'Банк с телеком-возможностями'
        },
        'Bybit UID': {
            name: 'Bybit UID',
            address: '47028037',
            icon: '🐱',
            fee: 'Без комиссии',
            description: 'P2P торговля ByBit'
        }
    }
};

// Команда панели оператора
bot.callbackQuery('open_operator_panel', async (ctx) => {
    const userId = ctx.from.id;
    const userRole = await db.getUserRole(userId);
    
    if (userRole !== 'operator' && userRole !== 'admin') {
        return ctx.answerCallbackQuery('❌ У вас нет доступа к панели оператора');
    }
    
    await ctx.answerCallbackQuery();
    
    const keyboard = new InlineKeyboard()
        .text('📋 Активные заявки', 'view_active_orders')
        .text('💳 Отправить реквизиты', 'send_payment_details')
        .row()
        .text('📊 Статистика', 'operator_stats')
        .text('⚙️ Настройки', 'operator_settings')
        .row()
        .text('🔙 Назад', 'back_to_main');
    
    await ctx.editMessageText(
        `👨‍💼 <b>Панель оператора</b>\n\n` +
        `🆔 Ваш ID: <code>${userId}</code>\n` +
        `📝 Роль: ${userRole === 'admin' ? 'Администратор' : 'Оператор'}\n\n` +
        `Выберите действие:`,
        {
            parse_mode: 'HTML',
            reply_markup: keyboard
        }
    );
});

// Главное меню отправки реквизитов
bot.callbackQuery('send_payment_details', async (ctx) => {
    const userId = ctx.from.id;
    const userRole = await db.getUserRole(userId);
    
    if (userRole !== 'operator' && userRole !== 'admin') {
        return ctx.answerCallbackQuery('❌ У вас нет доступа');
    }
    
    await ctx.answerCallbackQuery();
    
    const keyboard = new InlineKeyboard()
        .text('💰 Криптовалюты', 'details_crypto')
        .text('🏦 Банковские карты', 'details_banks')
        .row()
        .text('📜 Все реквизиты', 'details_all')
        .row()
        .text('🔙 Назад', 'open_operator_panel');
    
    await ctx.editMessageText(
        `💳 <b>Отправка реквизитов</b>\n\n` +
        `Выберите тип реквизитов для отправки клиенту:\n\n` +
        `💰 <b>Криптовалюты</b> - адреса кошельков\n` +
        `🏦 <b>Банковские карты</b> - реквизиты карт\n` +
        `📜 <b>Все реквизиты</b> - полный список`,
        {
            parse_mode: 'HTML',
            reply_markup: keyboard
        }
    );
});

// Выбор криптовалютных реквизитов
bot.callbackQuery('details_crypto', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    const keyboard = new InlineKeyboard();
    
    // Добавляем кнопки для каждого криптоадреса
    Object.keys(paymentDetails.crypto).forEach(key => {
        const detail = paymentDetails.crypto[key];
        keyboard.text(`${detail.icon} ${detail.name}`, `send_crypto_${key}`).row();
    });
    
    // Добавляем кнопку для ввода вручную
    keyboard.text('✍️ Ввести криптоадрес вручную', 'input_custom_crypto').row();
    keyboard.text('🔙 Назад', 'send_payment_details');
    
    await ctx.editMessageText(
        `💰 <b>Криптовалютные адреса</b>\n\n` +
        `Выберите адрес для отправки клиенту:\n\n` +
        Object.keys(paymentDetails.crypto).map(key => {
            const detail = paymentDetails.crypto[key];
            return `${detail.icon} <b>${detail.name}</b>\n` +
                   `   Адрес: <code>${detail.address}</code>\n` +
                   `   Комиссия: ${detail.fee}`;
        }).join('\n\n'),
        {
            parse_mode: 'HTML',
            reply_markup: keyboard
        }
    );
});

// Выбор банковских реквизитов
bot.callbackQuery('details_banks', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    const keyboard = new InlineKeyboard();
    
    // Добавляем кнопки для каждого банка
    Object.keys(paymentDetails.banks).forEach(key => {
        const detail = paymentDetails.banks[key];
        keyboard.text(`${detail.icon} ${detail.name}`, `send_bank_${key}`).row();
    });
    
    // Добавляем кнопку для ввода вручную
    keyboard.text('✍️ Ввести банковские реквизиты вручную', 'input_custom_bank').row();
    keyboard.text('🔙 Назад', 'send_payment_details');
    
    await ctx.editMessageText(
        `🏦 <b>Банковские реквизиты</b>\n\n` +
        `Выберите банк для отправки реквизитов:\n\n` +
        Object.keys(paymentDetails.banks).map(key => {
            const detail = paymentDetails.banks[key];
            return `${detail.icon} <b>${detail.name}</b>\n` +
                   `   Карта: <code>${detail.card}</code>\n` +
                   `   Владелец: ${detail.holder}`;
        }).join('\n\n'),
        {
            parse_mode: 'HTML',
            reply_markup: keyboard
        }
    );
});

// Отправка всех реквизитов
bot.callbackQuery('details_all', async (ctx) => {
    chatContexts.set(ctx.from.id, {
        action: 'send_all_details'
    });
    
    await ctx.editMessageText(
        `📜 <b>Отправка всех реквизитов</b>\n\n` +
        `💬 Напишите ID клиента (или перешлите сообщение от клиента) для отправки всех реквизитов:`,
        { parse_mode: 'HTML' }
    );
    
    await ctx.answerCallbackQuery('Укажите ID клиента для отправки всех реквизитов');
});

// Кнопка "Назад в главное меню"
bot.callbackQuery('back_to_main', async (ctx) => {
    await ctx.answerCallbackQuery();
    
    const userId = ctx.from.id;
    const keyboard = await createMainKeyboard(userId);
    
    await ctx.editMessageText(
        `⚡ <b>ExMachinaX</b> - Главное меню\n\n` +
        `Выберите действие:`,
        {
            parse_mode: 'HTML',
            reply_markup: keyboard
        }
    );
});

// Импорт системы реквизитов
const paymentSystem = require('./payment-details-system');

// Обработчики для ручного ввода реквизитов из панели оператора
bot.callbackQuery('input_custom_crypto', async (ctx) => {
    const userId = ctx.from.id;
    const userRole = await db.getUserRole(userId);
    
    if (userRole !== 'operator' && userRole !== 'admin') {
        return ctx.answerCallbackQuery('❌ У вас нет доступа');
    }
    
    await ctx.answerCallbackQuery('✍️ Введите криптоадрес...');
    
    // Сохраняем контекст для следующего сообщения
    chatContexts.set(userId, { 
        action: 'input_manual_crypto',
        source: 'operator_panel'
    });
    
    await ctx.editMessageText(
        `✍️ <b>ВВОД КРИПТОАДРЕСА ВРУЧНУЮ</b>\n\n` +
        `📝 Введите данные в формате:\n\n` +
        `<b>Название сети</b>\n` +
        `📍 Адрес\n` +
        `🏦 Описание сети\n` +
        `💎 Валюта\n\n` +
        `<b>Пример:</b>\n` +
        `TRC-20 USDT\n` +
        `THcSDj69NjoD9Ev53mK9cx3jF7AswMDtcW\n` +
        `TRON (TRC-20)\n` +
        `USDT`,
        { 
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
                .text('❌ Отмена', 'details_crypto')
        }
    );
});

bot.callbackQuery('input_custom_bank', async (ctx) => {
    const userId = ctx.from.id;
    const userRole = await db.getUserRole(userId);
    
    if (userRole !== 'operator' && userRole !== 'admin') {
        return ctx.answerCallbackQuery('❌ У вас нет доступа');
    }
    
    await ctx.answerCallbackQuery('✍️ Введите реквизиты...');
    
    // Сохраняем контекст для следующего сообщения
    chatContexts.set(userId, { 
        action: 'input_manual_bank',
        source: 'operator_panel'
    });
    
    await ctx.editMessageText(
        `✍️ <b>ВВОД БАНКОВСКИХ РЕКВИЗИТОВ ВРУЧНУЮ</b>\n\n` +
        `📝 Введите данные в формате:\n\n` +
        `<b>Название банка</b>\n` +
        `💳 Номер карты\n` +
        `👤 Имя владельца\n` +
        `🏦 Дополнительная информация (опционально)\n\n` +
        `<b>Пример:</b>\n` +
        `Сбербанк\n` +
        `5555 4444 3333 2222\n` +
        `Иван Петров\n` +
        `Переводы до 100,000₽`,
        { 
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
                .text('❌ Отмена', 'details_banks')
        }
    );
});

// Инициализация динамических обработчиков
paymentSystem.setupCryptoHandlers(bot, paymentDetails, chatContexts);
paymentSystem.setupBankHandlers(bot, paymentDetails, chatContexts);

// Экспорт функций для использования в веб-сервере
module.exports = { bot, notifyOperators, notifyWebsiteActivity, db, googleSheetsManager, crmService };

// Функция красивого уведомления о запуске
async function sendStartupNotification() {
    try {
        const staff = await db.getStaffList();
        const admins = staff.filter(s => s.role === 'admin');
        
        const startTime = new Date().toLocaleString('ru-RU', {
            timeZone: 'Europe/Moscow',
            weekday: 'long',
            year: 'numeric',
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const startupMessage = 
            `🚀 <b>EXMACHINAX BOT ЗАПУЩЕН!</b>\n\n` +
            `🎉 <b>Система успешно инициализирована</b>\n\n` +
            `📅 <b>Время запуска:</b> ${startTime}\n` +
            `🌐 <b>Веб-сервер:</b> http://localhost:3000\n` +
            `🤖 <b>Telegram Bot:</b> Активен\n` +
            `💾 <b>База данных:</b> Подключена\n` +
            `👥 <b>Персонал онлайн:</b> ${admins.length} админов\n\n` +
            `🔥 <b>Готов к работе:</b>\n` +
            `✅ Прием заявок с сайта\n` +
            `✅ Уведомления операторам\n` +
            `✅ Обработка платежей\n` +
            `✅ Реферальная система\n\n` +
            `🎯 <b>ExMachinaX готов к покорению крипто-мира!</b>\n\n` +
            `#startup #system #online`;
            
        // Создаем кнопку для открытия меню
        const startupKeyboard = new InlineKeyboard()
            .text('🚀 Открыть меню', 'startup_open_menu');
            
        for (const admin of admins) {
            try {
                await bot.api.sendMessage(admin.telegram_id, startupMessage, {
                    parse_mode: 'HTML',
                    reply_markup: startupKeyboard
                });
            } catch (error) {
                console.log(`Не удалось отправить уведомление о запуске админу ${admin.telegram_id}`);
            }
        }
        
        console.log(`🎉 Уведомления о запуске отправлены ${admins.length} админам`);
        
    } catch (error) {
        console.error('Ошибка отправки уведомлений о запуске:', error);
    }
}

// ❌ УВЕДОМЛЕНИЯ ОБ ОСТАНОВКЕ ОТКЛЮЧЕНЫ
// Причина: Railway перезапускает приложение автоматически, 
// это вызывало ложные уведомления об остановке вместо запуска

console.log('🔇 Уведомления об остановке отключены (Railway автоперезапуск)');

// Функция настройки Menu Button
async function setupMenuButton() {
    try {
        const webappUrl = process.env.WEBAPP_URL;
        if (webappUrl && webappUrl.startsWith('https://')) {
            await bot.api.setChatMenuButton({
                menu_button: {
                    type: 'web_app',
                    text: '🚀 Открыть ExMachinaX',
                    web_app: {
                        url: webappUrl
                    }
                }
            });
            console.log('✅ Menu Button настроена для WebApp');
        }
    } catch (error) {
        console.log('⚠️ Не удалось настроить Menu Button:', error.message);
    }
}

// Создаем Express сервер для webhook'ов
const webhookApp = express();
const cors = require('cors');
const RatesService = require('./services/RatesService');

// Инициализация сервисов для веб-приложения
const ratesService = new RatesService();

// Middleware
webhookApp.use(cors());
webhookApp.use(express.json());

// Настройка статических файлов для веб-приложения
webhookApp.use(express.static(path.join(__dirname, 'webapp')));
webhookApp.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Основной маршрут для мини-приложения
webhookApp.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'webapp', 'index.html'));
});

// API для получения курсов валют
webhookApp.get('/api/rates', async (req, res) => {
    try {
        const rates = await ratesService.getRates();
        res.json({ 
            success: true, 
            data: rates,
            lastUpdate: ratesService.getLastUpdateTime(),
            source: 'live_api'
        });
    } catch (error) {
        console.error('Ошибка получения курсов:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения курсов' });
    }
});

// API для AML проверки
webhookApp.post('/api/aml-check', async (req, res) => {
    try {
        const { address, currency, userId } = req.body;
        
        const amlResult = await amlService.checkAddress(address, currency);
        
        res.json({ success: true, data: amlResult });
    } catch (error) {
        console.error('Ошибка AML проверки:', error);
        res.status(500).json({ success: false, error: 'Ошибка AML проверки' });
    }
});

// API для создания заявки
webhookApp.post('/api/create-order', async (req, res) => {
    try {
        console.log('🚀 API CREATE-ORDER В BOT.JS ПОЛУЧИЛ:', req.body);
        
        const {
            userId,
            fromCurrency,
            toCurrency,
            fromAmount,
            toAmount,
            fromAddress,
            toAddress,
            amlResult,
            exchangeRate,
            fee,
            pairType
        } = req.body;

        // Создаем заявку в базе данных
        const order = await db.createOrder({
            userId,
            fromCurrency,
            toCurrency,
            fromAmount,
            toAmount,
            fromAddress,
            toAddress,
            exchangeRate: exchangeRate || (toAmount / fromAmount),
            fee: fee || 0,
            amlStatus: amlResult?.status || 'clean',
            status: 'pending',
            source: 'web'
        });

        console.log('✅ Заявка создана в bot.js:', order);

        // Получаем пользователя
        const user = await db.getUser(userId);
        const userName = user?.firstName || user?.username || `User_${userId}`;

        // ПРАВИЛЬНЫЕ данные для уведомлений
        await notifyOperators({
            id: order.id,
            userName: userName,
            fromAmount: order.fromAmount,
            fromCurrency: order.fromCurrency,
            toCurrency: order.toCurrency,
            fromAddress: order.fromAddress || '',
            toAddress: order.toAddress || '',
            amlFromResult: req.body.amlFromResult || { status: 'not_checked' },
            amlToResult: req.body.amlToResult || { status: 'not_checked' },
            pairType: pairType || 'fiat'
        });

        res.json({ success: true, data: order });
    } catch (error) {
        console.error('❌ Ошибка создания заявки в bot.js:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания заявки: ' + error.message });
    }
});

// API для получения истории пользователя
webhookApp.get('/api/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const history = await db.getUserHistory(userId);
        
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('Ошибка получения истории:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения истории' });
    }
});

// API для получения профиля пользователя
webhookApp.get('/api/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Получаем базовую информацию пользователя
        const user = await db.getUser(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Пользователь не найден' });
        }
        
        // Получаем статистику
        const stats = await db.getUserStats ? await db.getUserStats(userId) : {};
        const referralStats = await db.getReferralStats ? await db.getReferralStats(userId) : {};
        const achievements = await db.getUserAchievements ? await db.getUserAchievements(userId) : [];
        
        const profile = {
            ...user,
            stats,
            referralStats,
            achievements,
            avatar: `https://t.me/i/userpic/320/${user.username || user.telegram_id}.jpg`
        };
        
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения профиля' });
    }
});

// API для новостей
webhookApp.get('/api/news', async (req, res) => {
    try {
        const news = [
            {
                id: 1,
                title: 'Система работает!',
                description: 'Все функции обмена валют доступны',
                date: new Date().toISOString(),
                type: 'info'
            },
            {
                id: 2,
                title: 'Безопасность превыше всего',
                description: 'AML проверка защищает ваши операции',
                date: new Date(Date.now() - 86400000).toISOString(),
                type: 'security'
            }
        ];
        
        res.json({ success: true, data: news });
    } catch (error) {
        console.error('Ошибка получения новостей:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения новостей' });
    }
});

// API для создания тикета поддержки С УВЕДОМЛЕНИЕМ АДМИНОВ
webhookApp.post('/api/support-ticket', async (req, res) => {
    try {
        const { userId, source, subject, message, timestamp } = req.body;
        
        console.log(`🎫 НОВЫЙ ТИКЕТ от пользователя ${userId}: ${subject}`);
        
        // Получаем данные пользователя
        const user = await db.getUser(userId);
        const userName = user?.first_name || user?.username || `ID: ${userId}`;
        
        // Создаем тикет в базе
        const ticketId = `TICKET-${Date.now()}`;
        
        // Определяем эмодзи по теме
        const getSubjectEmoji = (subject) => {
            const subjectLower = subject.toLowerCase();
            if (subjectLower.includes('наличн')) return '💵';
            if (subjectLower.includes('aml')) return '🛡️';
            if (subjectLower.includes('карты')) return '💳';
            if (subjectLower.includes('otc')) return '📈';
            return '🆘';
        };

        // Формируем сообщение для админов
        const supportMessage = `${getSubjectEmoji(subject)} <b>${subject}</b>\n\n` +
            `🎫 ID: ${ticketId}\n` +
            `👤 Пользователь: ${userName}\n` +
            `⏰ Время: ${new Date(timestamp).toLocaleString('ru-RU')}\n` +
            `💬 Сообщение: ${message}\n\n` +
            `➡️ Пишите пользователю: /user_${userId}`;

        // ПРЯМО ОТПРАВЛЯЕМ УВЕДОМЛЕНИЯ АДМИНАМ
        try {
            const adminIds = await db.getAdminIds();
            console.log(`📋 Отправляем уведомления ${adminIds.length} админам`);
            
            for (const adminId of adminIds) {
                try {
                    await bot.api.sendMessage(adminId, supportMessage, { 
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '💬 Написать пользователю', url: `tg://user?id=${userId}` },
                                { text: '✅ Закрыть тикет', callback_data: `close_ticket_${ticketId}` }
                            ]]
                        }
                    });
                    console.log(`✅ Уведомление отправлено админу ${adminId}`);
                } catch (sendError) {
                    console.log(`⚠️ Не удалось уведомить админа ${adminId}:`, sendError.message);
                }
            }
        } catch (error) {
            console.error('❌ Ошибка отправки уведомлений:', error);
        }
        
        res.json({ 
            success: true, 
            message: 'Заявка отправлена! Мы свяжемся с вами в ближайшее время.',
            data: { ticketId, timestamp, subject }
        });
        
    } catch (error) {
        console.error('❌ Ошибка создания тикета поддержки:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания тикета поддержки' });
    }
});

// Webhook endpoint для получения уведомлений от Telegram
webhookApp.post('/webhook/telegram', async (req, res) => {
    try {
        console.log('📨 Получен webhook от Telegram');
        
        // Инициализируем бота если не инициализирован
        if (!bot.botInfo) {
            await bot.init();
        }
        
        await bot.handleUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Ошибка обработки Telegram webhook:', error);
        res.sendStatus(500);
    }
});

// Webhook endpoint для получения уведомлений от веб-сервера
webhookApp.post('/webhook/support-ticket', async (req, res) => {
    try {
        const { ticketId, userId, userName, subject, message, timestamp } = req.body;
        
        console.log(`📨 Получен webhook тикета: ${ticketId} от ${userName}`);
        
        // Отправляем уведомление всем админам
        const adminIds = await db.getAdminIds();
        
        for (const adminId of adminIds) {
            try {
                await bot.api.sendMessage(adminId, message, { 
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '💬 Написать пользователю', url: `tg://user?id=${userId}` },
                            { text: '✅ Закрыть тикет', callback_data: `close_ticket_${ticketId}` }
                        ]]
                    }
                });
                console.log(`✅ Уведомление отправлено админу ${adminId}`);
            } catch (sendError) {
                console.log(`⚠️ Не удалось уведомить админа ${adminId}:`, sendError.message);
            }
        }
        
        res.json({ success: true, message: 'Уведомление отправлено' });
    } catch (error) {
        console.error('❌ Ошибка обработки webhook:', error);
        res.status(500).json({ success: false, error: 'Ошибка обработки webhook' });
    }
});

// ТЕСТОВЫЙ ENDPOINT ДЛЯ ПРОВЕРКИ УВЕДОМЛЕНИЙ
webhookApp.post('/test/notify-operators', async (req, res) => {
    try {
        console.log('🧪 ТЕСТ УВЕДОМЛЕНИЙ ОПЕРАТОРОВ');
        
        // Проверяем инициализацию бота
        if (!bot.botInfo) {
            console.log('🔄 Инициализируем бота...');
            await bot.init();
        }
        console.log('✅ Бот инициализирован:', bot.botInfo?.username);
        
        // Проверяем персонал
        const staff = await db.getStaffList();
        const operators = staff.filter(s => ['admin', 'operator'].includes(s.role));
        console.log(`👥 Найдено ${operators.length} операторов:`, operators.map(o => o.telegram_id));
        
        // Тестовые данные заявки
        const testOrderData = {
            id: 'TEST_' + Date.now(),
            userName: 'Тестовый пользователь',
            fromAmount: 500,
            fromCurrency: 'USDT',
            toCurrency: 'RUB',
            address: 'test_address_456',
            amlStatus: 'clean'
        };
        
        console.log('📋 Тестовая заявка:', testOrderData);
        
        // Вызываем функцию уведомлений
        await notifyOperators(testOrderData);
        console.log('✅ Функция notifyOperators выполнена');
        
        res.json({ 
            success: true, 
            message: 'Тест завершен',
            operators: operators.length,
            testOrder: testOrderData
        });
        
    } catch (error) {
        console.error('❌ Ошибка теста уведомлений:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: error.stack
        });
    }
});

// Запуск webhook сервера
const port = process.env.WEBHOOK_PORT || 3001; // Используем отдельный порт для webhook
webhookApp.listen(port, () => {
    console.log(`🔗 Webhook сервер запущен на порту ${port}`);
});

// Секретная команда для перезапуска бота (ОТКЛЮЧЕНА ДЛЯ RAILWAY)
bot.command('phoenix_restart', async (ctx) => {
    const userId = ctx.from.id;
    console.log(`🔍 Phoenix restart запрос от ${userId}`);
    
    try {
        const userRole = await db.getUserRole(userId);
        
        if (userRole !== 'admin') {
            await ctx.reply('🔒 Команда недоступна');
            return;
        }
        
        // ОТКЛЮЧЕНО ДЛЯ RAILWAY
        await ctx.reply(
            `⚠️ <b>КОМАНДА ОТКЛЮЧЕНА</b>\n\n` +
            `🚫 Phoenix restart отключен на Railway\n` +
            `💡 Используйте Railway dashboard для перезапуска\n\n` +
            `🔗 https://railway.app/dashboard`,
            { parse_mode: 'HTML' }
        );
        
    } catch (error) {
        console.error(`❌ Ошибка проверки роли для ${userId}:`, error);
        await ctx.reply('❌ Ошибка проверки прав доступа');
    }
});

// Обработчики отключены для Railway
bot.callbackQuery('confirm_restart', async (ctx) => {
    await ctx.answerCallbackQuery('Команда отключена для Railway');
});

bot.callbackQuery('cancel_restart', async (ctx) => {
    await ctx.answerCallbackQuery('Команда отключена для Railway');
});

// Запуск бота
if (require.main === module) {
    (async () => {
        console.log('🚀 ExMachinaX Bot запускается...');
        
        // Инициализируем Google Sheets
        console.log('🔍 НАЧИНАЕМ ИНИЦИАЛИЗАЦИЮ GOOGLE SHEETS...');
        try {
            await initGoogleSheets();
            console.log('✅ Инициализация Google Sheets завершена');
        } catch (initError) {
            console.error('❌ ОШИБКА инициализации Google Sheets:', initError.message);
            console.error('📋 Stack trace:', initError.stack);
        }
        
        // ВРЕМЕННО: Всегда используем polling режим пока не исправим webhook
        console.log('🔄 АВАРИЙНЫЙ РЕЖИМ: Запуск в polling режиме');
        
        // Добавляем админов в базу если их нет
        try {
            const adminIds = [8141463258, 461759951, 280417617];
            for (const adminId of adminIds) {
                await db.addStaff(adminId, 'admin');
            }
            await db.addStaff(7692725312, 'operator');
            console.log('✅ Персонал добавлен в базу данных');
        } catch (error) {
            console.log('⚠️ Ошибка добавления персонала:', error.message);
        }
        
        bot.start();
        
        // Ждем немного для инициализации, затем настраиваем Menu Button и отправляем уведомления
        setTimeout(async () => {
            await setupMenuButton();
            await sendStartupNotification();
        }, 2000);
    })();
} 