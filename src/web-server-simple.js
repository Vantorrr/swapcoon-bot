require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

console.log('🚀 Запуск простого веб-сервера...');
console.log('📂 __dirname:', __dirname);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'не установлен');
console.log('🔌 PORT:', process.env.PORT || 3000);

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

// 🔥 ТЕСТОВЫЕ ДАННЫЕ ОТКЛЮЧЕНЫ НАВСЕГДА!
function getTestRates() {
    console.log("🔥 getTestRates() ОТКЛЮЧЕН - НЕТ ТЕСТОВЫХ ДАННЫХ!");
    return []; // 🔥 ПУСТОЙ МАССИВ!
}

// API для создания заявки в поддержку
app.post('/api/support-ticket', async (req, res) => {
    try {
        console.log('🎫 Создание заявки поддержки (тестовый режим):', req.body);
        
        const { userId, source, subject, message, timestamp } = req.body;
        
        // Имитация успешного создания заявки
        const ticketId = `TICKET_${Date.now()}`;
        
        console.log(`📋 Заявка создана:
        ID: ${ticketId}
        Пользователь: ${userId}
        Тема: ${subject}
        Сообщение: ${message}
        Источник: ${source}
        Время: ${timestamp}`);
        
        res.json({ 
            success: true, 
            data: {
                ticketId: ticketId,
                status: 'created',
                message: 'Заявка создана. В реальном режиме будет отправлена операторам.'
            }
        });
    } catch (error) {
        console.error('❌ Ошибка создания заявки поддержки:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка создания заявки' });
    }
});

// Заглушка для создания заявки (без бота)
app.post('/api/create-order', async (req, res) => {
    try {
        console.log('📝 Создание заявки (тестовый режим):', req.body);
        
        // Имитация успешного создания заявки
        const orderId = Date.now();
        
        res.json({ 
            success: true, 
            data: {
                orderId: orderId,
                status: 'pending',
                message: 'Заявка создана в тестовом режиме'
            }
        });
    } catch (error) {
        console.error('Ошибка создания заявки:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания заявки' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🌐 Простой веб-сервер запущен на порту ${PORT}`);
    console.log(`📱 Веб-приложение: http://localhost:${PORT}`);
    console.log(`🎯 Только фронтенд, без Telegram бота`);
    console.log(`📡 RatesService статус:`, ratesService ? '✅ Активен' : '❌ Отключен (используем тестовые данные)');
    console.log(`🚀 Готов к работе!`);
}).on('error', (err) => {
    console.error('❌ Ошибка запуска сервера:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Порт ${PORT} занят. Попробуйте другой порт.`);
    }
    process.exit(1);
}); 