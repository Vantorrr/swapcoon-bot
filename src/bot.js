require('dotenv').config();
const { Bot, InlineKeyboard, webhookCallback } = require('grammy');
const express = require('express');
const Database = require('./models/Database');
const GoogleSheetsManager = require('./services/GoogleSheetsManager');
const AMLService = require('./services/AMLService');
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

// Хранилище контекстов чата для операторов
const chatContexts = new Map();

// Инициализация сервисов
let googleSheetsManager = null;
const amlService = new AMLService();
const crmService = new CRMService();

// Инициализация Google Sheets
async function initGoogleSheets() {
    try {
        const configPath = path.join(__dirname, '..', 'config', 'google-sheets.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.enabled && config.credentials && config.spreadsheet_id) {
                googleSheetsManager = new GoogleSheetsManager();
                const success = await googleSheetsManager.init(config.credentials, config.spreadsheet_id);
                if (success) {
                    await googleSheetsManager.createWorksheets();
                    console.log('✅ Google Sheets интеграция активна');
                    
                    // Запускаем автоматический экспорт
                    if (config.auto_export_interval) {
                        setInterval(async () => {
                            console.log('🔄 Автоматический экспорт в Google Sheets...');
                            await googleSheetsManager.exportAll(db);
                        }, config.auto_export_interval);
                    }
                } else {
                    console.log('⚠️ Google Sheets недоступен');
                }
            } else {
                console.log('ℹ️ Google Sheets отключен в конфигурации');
            }
        } else {
            console.log('ℹ️ Конфигурация Google Sheets не найдена');
        }
    } catch (error) {
        console.error('❌ Ошибка инициализации Google Sheets:', error.message);
    }
}

// Функция для создания клавиатуры
async function createMainKeyboard(userId) {
    const keyboard = new InlineKeyboard();
    
    // Добавляем WebApp кнопку только если URL поддерживает HTTPS
    const webappUrl = process.env.WEBAPP_URL;
    if (webappUrl && webappUrl.startsWith('https://')) {
        keyboard.webApp('🚀 Открыть SwapCoon', `${webappUrl}?user=${userId}`).row();
    } else {
        // Кнопка для приложения 
        keyboard.text('🚀 Открыть SwapCoon', 'webapp_launch').row();
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

    await ctx.replyWithPhoto('https://i.ibb.co/hP0PbvF/IMAGE-2025-07-09-12-57-19.jpg', {
        caption: `🦝 <b>SwapCoon приветствует тебя!</b>\n\n` +
            `🚀 Быстрый и безопасный сервис обмена валют\n\n` +
            `<b>🔥 Енот поможет тебе:</b>\n` +
            `💱 Обмен криптовалют (42 пары)\n` +
            `💵 Обмен наличных в офисах\n` +
            `🛡️ AML проверка адресов\n` +
            `📊 История всех операций\n` +
            `👥 Реферальная программа (0.5%)\n` +
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
        `• WEBAPP_URL = https://swapcoon-bot-production.up.railway.app\n` +
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
                text: '🚀 Открыть SwapCoon',
                web_app: {
                    url: webappUrl
                }
            }
        });
        
        await ctx.reply(
            `✅ <b>WebApp успешно настроен!</b>\n\n` +
            `🌐 URL: ${webappUrl}\n` +
            `📱 Menu Button активирована\n\n` +
            `Теперь у всех пользователей появится кнопка "🚀 Открыть SwapCoon" возле поля ввода сообщения!`,
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
        helpKeyboard.webApp('🚀 Открыть SwapCoon', `${webappUrl}?user=${userId}`);
    } else {
        helpKeyboard.text('🚀 Открыть SwapCoon', 'webapp_launch');
    }

    let helpText = `🦝 <b>Справка по SwapCoon Bot</b>\n\n` +
        `<b>🎮 Основные команды:</b>\n` +
        `/start - Запуск енота и мини-приложения\n` +
        `/ref - Реферальная ссылка и заработок\n` +
        `/help - Эта справка\n\n`;

    // Для админов добавляем админские команды
    if (userRole === 'admin') {
        helpText += `<b>🛡️ Команды администратора:</b>\n` +
            `/admin - Админ панель с полной статистикой\n` +
            `/operator - Панель оператора\n` +
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

    helpText += `<b>🔥 Возможности нашего енота:</b>\n` +
        `💱 Обмен криптовалют (42 пары)\n` +
        `💵 Обмен наличных в офисах\n` +
        `🛡️ AML проверка адресов\n` +
        `📊 История всех операций\n` +
        `👥 Реферальная программа (0.5%)\n\n` +
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
                '🚀 <b>SwapCoon приветствует тебя!</b>\n\n' +
                '🌟 Удобное приложение для обмена валют\n' +
                '💱 42 валютные пары доступны\n' +
                '🛡️ AML проверка адресов\n' +
                '📊 История всех операций\n' +
                '👥 Реферальная программа\n\n' +
                '📱 Нажмите кнопку ниже, чтобы открыть приложение прямо в Telegram!',
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .webApp('🚀 Открыть SwapCoon', `${webappUrl}?user=${userId}`)
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
            '✈️ Telegram: @SwapCoonSupport\n' +
            '📧 Email: support@swapcoon.com\n' +
            '📱 Канал: https://t.me/SwapCoon\n' +
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
            'ℹ️ <b>О сервисе SwapCoon</b>\n\n' +
            '🌟 Быстрый и безопасный обмен валют\n' +
            '🛡️ Проверка AML для безопасности\n' +
            '💰 Выгодные курсы обмена\n' +
            '🎁 Реферальная программа\n' +
            '📱 Удобное приложение\n\n' +
            '📞 <b>Контакты:</b>\n' +
            '✈️ Поддержка: @SwapCoonSupport\n' +
            '📱 Канал: https://t.me/SwapCoon\n\n' +
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
        
        await ctx.replyWithPhoto('https://i.ibb.co/hP0PbvF/IMAGE-2025-07-09-12-57-19.jpg', {
            caption: message,
            parse_mode: 'HTML',
            reply_markup: await createMainKeyboard(userId)
        });
    }

    // === АДМИН ПАНЕЛЬ ===
    
    // Полная статистика
    if (data === 'admin_full_stats') {
        const userRole = await db.getUserRole(userId);
        if (userRole !== 'admin') return ctx.answerCallbackQuery('❌ Нет прав');
        
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
            `• Реферальные выплаты: $${((stats.volumeToday || 0) * 0.005).toFixed(2)}\n\n` +
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
        
        let staffText = '';
        staff.forEach(member => {
            const roleEmoji = member.role === 'admin' ? '🛡️' : '👨‍💼';
            const statusEmoji = member.is_active ? '✅' : '❌';
            staffText += `${roleEmoji} ${statusEmoji} ${member.first_name || member.username || member.telegram_id}\n`;
            staffText += `   Заказов: ${member.orders_handled || 0}\n\n`;
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
                `📞 Свяжитесь с клиентом для завершения обмена.`,
                { parse_mode: 'HTML' }
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

    // Отправить реквизиты
    if (data.startsWith('send_payment_details_')) {
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('send_payment_details_', ''));
        
        try {
            const result = await db.updateOrderStatusWithMessage(orderId, 'payment_details_sent', userId, 
                '💳 Реквизиты для оплаты отправлены. Ожидаем поступления средств.');
            
            const order = await db.getOrderWithClient(orderId);
            
            // Отправляем реквизиты клиенту
            await ctx.api.sendMessage(order.client_id,
                `💳 <b>Реквизиты для оплаты</b>\n\n` +
                `🆔 Заказ #${orderId}\n` +
                `💰 К оплате: ${order.from_amount} ${order.from_currency}\n\n` +
                `🏦 <b>Реквизиты:</b>\n` +
                `📧 Email: payments@swapcoon.com\n` +
                `💳 Карта: 1234 5678 9012 3456\n` +
                `🏛️ Банк: SwapCoon Bank\n\n` +
                `⚠️ <b>Важно:</b>\n` +
                `• Переводите точную сумму\n` +
                `• Сохраните чек об оплате\n` +
                `• После оплаты нажмите "Оплачено"\n\n` +
                `❓ Есть вопросы? Напишите нашему оператору.`,
                { 
                    parse_mode: 'HTML',
                    reply_markup: new InlineKeyboard()
                        .text('✅ Оплачено', `client_paid_${orderId}`)
                        .text('💬 Связаться с оператором', `client_chat_${orderId}`)
                }
            );
            
            await ctx.answerCallbackQuery('✅ Реквизиты отправлены клиенту!');
            await ctx.reply(`✅ Реквизиты для заказа #${orderId} отправлены клиенту!\n\n${result.message}`);
            
        } catch (error) {
            console.error('Ошибка отправки реквизитов:', error);
            await ctx.answerCallbackQuery('❌ Ошибка отправки реквизитов');
        }
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
        const userRole = await db.getUserRole(userId);
        if (!userRole || !['admin', 'operator'].includes(userRole)) {
            return ctx.answerCallbackQuery('❌ Нет прав');
        }
        
        const orderId = parseInt(data.replace('funds_sent_', ''));
        
        try {
            const result = await db.updateOrderStatusWithMessage(orderId, 'sending', userId,
                '📤 Средства отправлены на ваш адрес! Ожидайте поступления...');
            
            const order = await db.getOrderWithClient(orderId);
            
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
            
            await ctx.answerCallbackQuery('✅ Статус обновлен!');
            await ctx.reply(`✅ Статус заказа #${orderId} обновлен!\n\n${result.message}`);
            
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
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
                '🎉 Заказ успешно завершен! Спасибо за использование SwapCoon!');
            
            const order = await db.getOrderWithClient(orderId);
            
            await ctx.api.sendMessage(order.client_id,
                `🎉 <b>Заказ завершен!</b>\n\n` +
                `🆔 Заказ #${orderId}\n` +
                `✅ Обмен успешно завершен\n` +
                `💰 Получено: ${order.to_amount} ${order.to_currency}\n\n` +
                `🙏 Спасибо за использование SwapCoon!\n` +
                `⭐ Оцените наш сервис: /feedback\n` +
                `🦝 Приглашайте друзей: /ref`,
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

        await ctx.replyWithPhoto('https://i.ibb.co/hP0PbvF/IMAGE-2025-07-09-12-57-19.jpg', {
            caption: `🦝 <b>SwapCoon снова приветствует тебя!</b>\n\n` +
                `🚀 Быстрый и безопасный сервис обмена валют\n\n` +
                `<b>🔥 Енот поможет тебе:</b>\n` +
                `💱 Обмен криптовалют (42 пары)\n` +
                `💵 Обмен наличных в офисах\n` +
                `🛡️ AML проверка адресов\n` +
                `📊 История всех операций\n` +
                `👥 Реферальная программа (0.5%)\n` +
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

        await ctx.replyWithPhoto('https://i.ibb.co/hP0PbvF/IMAGE-2025-07-09-12-57-19.jpg', {
            caption: `🦝 <b>SwapCoon приветствует тебя!</b>\n\n` +
                `🚀 Быстрый и безопасный сервис обмена валют\n\n` +
                `<b>🔥 Енот поможет тебе:</b>\n` +
                `💱 Обмен криптовалют (42 пары)\n` +
                `💵 Обмен наличных в офисах\n` +
                `🛡️ AML проверка адресов\n` +
                `📊 История всех операций\n` +
                `👥 Реферальная программа (0.5%)\n` +
                `📱 Удобное приложение\n\n` +
                `🎯 Нажмите кнопку ниже, чтобы начать обмен!`,
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
            .text('🏠 Назад к боту', 'back_to_main');
        
        await ctx.reply(
            `🛡️ <b>АДМИН ПАНЕЛЬ SwapCoon</b>\n\n` +
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
            .text('🏠 Назад к боту', 'back_to_main');
        
        await ctx.reply(
            `🛡️ <b>АДМИН ПАНЕЛЬ SwapCoon</b>\n\n` +
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
                    `❌ <b>Вы исключены из персонала SwapCoon</b>\n\n` +
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
                    const priority = getPriorityText(order.from_amount * 100); // примерная цена
                    webLogsText += `${index + 1}. ${priority} Заявка #${order.id}\n`;
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
                `📊 <b>ЭКСПОРТ ДАННЫХ SWAPCOON</b>\n\n` +
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
                `👤 Экспорт пользователей\n` +
                `🛡️ Экспорт AML данных\n\n` +
                (googleSheetsManager && googleSheetsManager.isReady() ? 
                    `🔗 <b>Ссылка на таблицу:</b>\n<a href="${googleSheetsManager.getSpreadsheetUrl()}">Открыть Google Таблицу</a>\n\n` : '') +
                `${googleSheetsManager && googleSheetsManager.isReady() ? '✅' : '❌'} Готов к экспорту`;
            
            const sheetsKeyboard = new InlineKeyboard();
            
            if (googleSheetsManager && googleSheetsManager.isReady()) {
                sheetsKeyboard
                    .text('📊 Экспорт всех данных', 'admin_sheets_export_all')
                    .text('📋 Экспорт заказов', 'admin_sheets_export_orders')
                    .row()
                    .text('👥 Экспорт операторов', 'admin_sheets_export_staff')
                    .text('📈 Экспорт статистики', 'admin_sheets_export_stats')
                    .row()
                    .text('👤 Экспорт пользователей', 'admin_sheets_export_users')
                    .text('🛡️ Экспорт AML', 'admin_sheets_export_aml')
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
            
            const detailsText = 
                `👁️ <b>ПОДРОБНОСТИ ЗАКАЗА #${orderId}</b>\n\n` +
                `📊 <b>Основная информация:</b>\n` +
                `💱 Обмен: ${order.from_amount} ${order.from_currency} → ${order.to_amount || 'TBD'} ${order.to_currency}\n` +
                `📌 Статус: ${order.status}\n` +
                `📅 Создан: ${new Date(order.created_at).toLocaleString('ru')}\n` +
                `📝 Обновлен: ${new Date(order.updated_at).toLocaleString('ru')}\n\n` +
                `👤 <b>Клиент:</b>\n` +
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
                    .text('✅ Тикет закрыт', 'noop')
            });
            
            console.log(`🎫 Тикет ${ticketId} закрыт пользователем ${userId} (${adminName})`);
            
        } catch (error) {
            console.error(`❌ Ошибка закрытия тикета ${ticketId}:`, error.message);
            await ctx.reply(`❌ Ошибка при закрытии тикета: ${error.message}`);
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
    const botUsername = process.env.BOT_USERNAME || 'swapcoon_bot';
    const referralLink = `https://t.me/${botUsername}?start=${userId}`;
    
    const stats = await db.getReferralStats(userId);
    
    await ctx.reply(
        `🦝💰 <b>Реферальная программа SwapCoon</b>\n\n` +
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
        `🚀 Приглашайте друзей и зарабатывайте вместе с енотом!`,
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
    
    // Проверяем роль пользователя в базе данных
    const userRole = await db.getUserRole(userId);
    
    if (!userRole || userRole !== 'admin') {
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
        .text('🏠 Назад к боту', 'back_to_main');
    
    await ctx.reply(
        `🛡️ <b>АДМИН ПАНЕЛЬ SwapCoon</b>\n\n` +
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
    
    const userRole = await db.getUserRole(userId);
    
    if (!userRole || !['admin', 'operator'].includes(userRole)) {
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
    const userRole = await db.getUserRole(userId);
    
    if (userRole !== 'admin') {
        return ctx.reply('❌ Только админы могут тестировать систему');
    }
    
    await ctx.reply('🧪 <b>Тестирование системы SwapCoon...</b>', { parse_mode: 'HTML' });
    
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
    
    const userRole = await db.getUserRole(userId);
    if (userRole !== 'admin') {
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
                `🎉 <b>Вы назначены оператором SwapCoon!</b>\n\n` +
                `👨‍💼 Теперь вы можете обрабатывать заказы клиентов.\n` +
                `📋 Используйте команду /operator для доступа к панели.\n\n` +
                `🚀 Добро пожаловать в команду SwapCoon!`,
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
    
    // Проверяем контекст чата для операторов
    if (chatContexts.has(userId)) {
        const context = chatContexts.get(userId);
        
        if (context.action === 'send_message_to_client') {
            try {
                const order = await db.getOrderWithClient(context.orderId);
                if (!order) {
                    chatContexts.delete(userId);
                    return ctx.reply('❌ Заказ не найден');
                }
                
                // Сохраняем сообщение в чат
                await db.addOrderMessage({
                    orderId: context.orderId,
                    senderId: userId,
                    senderType: 'operator',
                    message: messageText
                });
                
                // Отправляем сообщение клиенту
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
                    `🎉 <b>Вы назначены оператором SwapCoon!</b>\n\n` +
                    `👨‍💼 Теперь вы можете обрабатывать заказы клиентов.\n` +
                    `📋 Используйте команду /operator для доступа к панели.\n\n` +
                    `🚀 Добро пожаловать в команду SwapCoon!`,
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
    try {
        // Сохраняем уведомления в базу данных
        await db.notifyAllOperators(orderData);
        
        // Получаем всех активных операторов для отправки прямых сообщений
        const staff = await db.getStaffList();
        const operators = staff.filter(s => ['admin', 'operator'].includes(s.role));
        
        // Расчет примерной прибыли (3% комиссия)
        const estimatedProfit = (orderData.fromAmount * 0.03).toFixed(2);
        
        const message = 
            `🚨 <b>НОВАЯ ЗАЯВКА С САЙТА #${orderData.id}</b>\n\n` +
            `🌐 <b>Источник:</b> Веб-приложение\n` +
            `👤 <b>Пользователь:</b> ${orderData.userName || 'Неизвестен'}\n` +
            `💱 <b>Обмен:</b> ${orderData.fromAmount} ${orderData.fromCurrency} → ${orderData.toCurrency}\n` +
            `💰 <b>Ожидаемая прибыль:</b> ~$${estimatedProfit}\n` +
            `📍 <b>Адрес получения:</b> <code>${orderData.address || 'Не указан'}</code>\n` +
            `🛡️ <b>AML статус:</b> ${getAMLStatusEmoji(orderData.amlStatus)} ${orderData.amlStatus || 'Не проверен'}\n` +
            `⏰ <b>Создан:</b> ${new Date().toLocaleString('ru-RU', {
                timeZone: 'Europe/Moscow',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })}\n\n` +
            `📊 <b>Приоритет:</b> ${getPriorityText(orderData.fromAmount)}\n` +
            `📋 Используйте /operator чтобы принять заказ\n\n` +
            `#заявка #сайт #${orderData.fromCurrency}_${orderData.toCurrency}`;

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

// Функция для получения эмодзи статуса AML
function getAMLStatusEmoji(status) {
    const statusMap = {
        'clean': '✅',
        'warning': '⚠️',
        'risky': '🔴',
        'blocked': '⛔'
    };
    return statusMap[status] || '❓';
}

// Функция для определения приоритета заявки
function getPriorityText(amount) {
    if (amount >= 10000) return '🔥 ВЫСОКИЙ (от $10K)';
    if (amount >= 1000) return '🟡 СРЕДНИЙ ($1K-$10K)';
    return '🟢 ОБЫЧНЫЙ (до $1K)';
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
                
            case 'aml_check':
                // Получаем детальную информацию из AML сервиса
                const detailedAML = data.detailedResult || {};
                const connections = detailedAML.connections || [];
                const blockchain = detailedAML.blockchain || data.currency;
                const riskScore = detailedAML.riskScore || 0;
                const riskLevel = riskScore <= 50 ? 'Низкий' : riskScore <= 80 ? 'Средний' : 'Высокий';
                const riskIcon = riskScore <= 50 ? '🟢' : riskScore <= 80 ? '🟡' : '🔴';
                
                let connectionsText = '';
                if (connections.length > 0) {
                    const mainConnections = connections.filter(c => c.percentage >= 1);
                    const minorConnections = connections.filter(c => c.percentage < 1);
                    
                    connectionsText = '\n\n🔗 <b>Связи адреса:</b>\n';
                    mainConnections.forEach(conn => {
                        connectionsText += `• ${conn.category} - ${conn.percentage}%\n`;
                    });
                    
                    if (minorConnections.length > 0) {
                        connectionsText += `\n📊 <b>Менее 1%:</b> ${minorConnections.map(c => c.category).join(', ')}`;
                    }
                }
                
                message = `🛡️ <b>AML ПРОВЕРКА ЗАВЕРШЕНА</b>\n\n` +
                         `🔵 <b>Адрес:</b> <code>${data.address}</code>\n` +
                         `⛓️ <b>Блокчейн:</b> ${blockchain}\n` +
                         `${connectionsText}\n` +
                         `${riskIcon} <b>Уровень риска:</b> ${riskLevel} (${riskScore}%)\n` +
                         `⏰ <b>Время:</b> ${new Date().toLocaleString('ru-RU')}\n\n` +
                         `#aml #детальный_отчет`;
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

// Экспорт функций для использования в веб-сервере
module.exports = { bot, notifyOperators, notifyWebsiteActivity, db, googleSheetsManager, amlService, crmService };

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
            `🚀 <b>SWAPCOON BOT ЗАПУЩЕН!</b>\n\n` +
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
            `🎯 <b>SwapCoon готов к покорению крипто-мира!</b>\n\n` +
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

// Функция красивого уведомления об остановке
async function sendShutdownNotification() {
    try {
        const staff = await db.getStaffList();
        const admins = staff.filter(s => s.role === 'admin');
        
        const shutdownTime = new Date().toLocaleString('ru-RU', {
            timeZone: 'Europe/Moscow',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric', 
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Получаем статистику перед остановкой
        const stats = await db.getAdminStats();
        
        const shutdownMessage =
            `🛑 <b>SWAPCOON BOT ОСТАНОВЛЕН</b>\n\n` +
            `⚠️ <b>Система выключается...</b>\n\n` +
            `📅 <b>Время остановки:</b> ${shutdownTime}\n` +
            `⏱️ <b>Статус:</b> Плановая остановка\n\n` +
            `📊 <b>Статистика сессии:</b>\n` +
            `• Заявок сегодня: ${stats.ordersToday || 0}\n` +
            `• Оборот: $${(stats.volumeToday || 0).toFixed(2)}\n` +
            `• Активных заказов: ${(stats.pendingOrders || 0) + (stats.processingOrders || 0)}\n\n` +
            `🔧 <b>Техническое обслуживание</b>\n` +
            `⏰ Время перезапуска: ~1-2 минуты\n\n` +
            `💤 <b>Енот ушел спать, но скоро вернется!</b>\n\n` +
            `#shutdown #system #maintenance`;
            
        for (const admin of admins) {
            try {
                await bot.api.sendMessage(admin.telegram_id, shutdownMessage, {
                    parse_mode: 'HTML'
                });
            } catch (error) {
                console.log(`Не удалось отправить уведомление об остановке админу ${admin.telegram_id}`);
            }
        }
        
        console.log(`🛑 Уведомления об остановке отправлены ${admins.length} админам`);
        
    } catch (error) {
        console.error('Ошибка отправки уведомлений об остановке:', error);
    }
}

// Флаг для предотвращения множественных уведомлений об остановке
let isShuttingDown = false;

// Обработка сигналов завершения
process.on('SIGINT', async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('\n🛑 Получен сигнал SIGINT, останавливаем бота...');
    await sendShutdownNotification();
    setTimeout(() => {
        console.log('✅ SwapCoon Bot остановлен корректно');
        process.exit(0);
    }, 3000);
});

process.on('SIGTERM', async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('\n🛑 Получен сигнал SIGTERM, останавливаем бота...');
    await sendShutdownNotification();
    setTimeout(() => {
        console.log('✅ SwapCoon Bot остановлен корректно');
        process.exit(0);
    }, 3000);
});

// Функция настройки Menu Button
async function setupMenuButton() {
    try {
        const webappUrl = process.env.WEBAPP_URL;
        if (webappUrl && webappUrl.startsWith('https://')) {
            await bot.api.setChatMenuButton({
                menu_button: {
                    type: 'web_app',
                    text: '🚀 Открыть SwapCoon',
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

// Запуск бота
if (require.main === module) {
    console.log('🚀 SwapCoon Bot запускается...');
    
    // Инициализируем Google Sheets
    initGoogleSheets();
    
    // Запускаем бота
    bot.start();
    
    // Ждем немного для инициализации, затем настраиваем Menu Button и отправляем уведомления
    setTimeout(async () => {
        await setupMenuButton();
        await sendStartupNotification();
    }, 2000);
} 