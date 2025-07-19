require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const RatesService = require('./services/RatesService');

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация сервиса курсов
const ratesService = new RatesService();

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
}); 