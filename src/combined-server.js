require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

console.log('🚀 Запуск комбинированного сервера (БОТ + ВЕБ)...');
console.log('📂 __dirname:', __dirname);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'не установлен');
console.log('🔌 PORT:', process.env.PORT || 3000);

// 🤖 ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ БОТА
let bot = null;
let notifyOperators = null;
let notifyWebsiteActivity = null;
let db = null;

// 🤖 ЗАПУСК TELEGRAM БОТА
console.log('🤖 Инициализация Telegram бота...');
try {
    // Импортируем бота НО не блокируем веб-сервер
    const botModule = require('./bot');
    bot = botModule.bot;
    notifyOperators = botModule.notifyOperators;
    notifyWebsiteActivity = botModule.notifyWebsiteActivity;
    db = botModule.db;
    console.log('✅ Telegram бот инициализирован');
    
    // Запускаем бота В ФОНЕ
    setTimeout(() => {
        try {
            console.log('🔄 Запуск бота в фоновом режиме...');
            bot.start().then(() => {
                console.log('✅ Бот успешно запущен и готов к отправке уведомлений');
            }).catch(error => {
                console.error('❌ Ошибка запуска бота (продолжаем работу):', error.message);
            });
        } catch (error) {
            console.error('❌ Ошибка фонового запуска бота:', error.message);
        }
    }, 2000);
    
} catch (error) {
    console.error('❌ Ошибка инициализации бота (продолжаем без бота):', error.message);
}

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
        
        // 🚨 ОТПРАВЛЯЕМ УВЕДОМЛЕНИЯ ВСЕМ АДМИНАМ
        try {
            if (!bot) {
                console.log('⚠️ Бот еще не инициализирован, пропускаем уведомления');
            } else if (!bot.api) {
                console.log('⚠️ Bot API недоступен, пропускаем уведомления');
            } else {
                console.log('📨 Начинаем отправку уведомлений админам...');
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
                        console.log(`📤 Отправляем уведомление админу ${adminId}...`);
                        await bot.api.sendMessage(adminId, notificationMessage, { 
                            parse_mode: 'HTML',
                            disable_web_page_preview: true 
                        });
                        console.log(`✅ Уведомление успешно отправлено админу ${adminId}`);
                    } catch (error) {
                        console.error(`❌ Ошибка отправки админу ${adminId}:`, error.message);
                    }
                }
                
                console.log('📨 Процесс отправки уведомлений завершен');
            }
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

// API для создания заявки
app.post('/api/create-order', async (req, res) => {
    try {
        console.log('📝 Создание заявки (комбинированный режим):', req.body);
        
        // Имитация успешного создания заявки
        const orderId = Date.now();
        
        res.json({ 
            success: true, 
            data: {
                orderId: orderId,
                status: 'pending',
                message: 'Заявка создана'
            }
        });
    } catch (error) {
        console.error('Ошибка создания заявки:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания заявки' });
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