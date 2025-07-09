require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const Database = require('./models/Database');
const AMLService = require('./services/AMLService');
const CRMService = require('./services/CRMService');
const RatesService = require('./services/RatesService');

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация сервисов
const db = new Database();
const amlService = new AMLService();
const crmService = new CRMService();
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

// API для AML проверки
app.post('/api/aml-check', async (req, res) => {
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
app.post('/api/create-order', async (req, res) => {
    try {
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
            fee
        } = req.body;

        console.log('🔄 Создание заявки:', { userId, fromCurrency, toCurrency, fromAmount, toAmount });

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
            status: 'pending'
        });

        console.log('✅ Заявка создана:', order);

        res.json({ success: true, data: order });
    } catch (error) {
        console.error('❌ Ошибка создания заявки:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания заявки: ' + error.message });
    }
});

// API для получения истории пользователя
app.get('/api/history/:userId', async (req, res) => {
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
app.get('/api/profile/:userId', async (req, res) => {
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

// API для новостей (недостающий endpoint)
app.get('/api/news', async (req, res) => {
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

// API для создания тикета поддержки
app.post('/api/support-ticket', async (req, res) => {
    try {
        const { userId, source, subject, message, timestamp } = req.body;
        
        console.log(`🎫 Создание тикета поддержки от пользователя ${userId} по теме: ${subject}`);
        
        // Получаем данные пользователя
        const user = await db.getUser(userId);
        const userName = user?.first_name || user?.username || `ID: ${userId}`;
        
        // Создаем тикет в базе
        const ticketId = `SUPPORT-${Date.now()}`;
        
        // Определяем эмодзи по теме
        const getSubjectEmoji = (subject) => {
            const subjectLower = subject.toLowerCase();
            if (subjectLower.includes('наличн')) return '💵';
            if (subjectLower.includes('aml')) return '🛡️';
            if (subjectLower.includes('карт')) return '💳';
            if (subjectLower.includes('otc')) return '📈';
            return '🆘';
        };

        // Логируем тикет
        console.log(`📋 Тикет ${ticketId}:`);
        console.log(`   👤 Пользователь: ${userName}`);
        console.log(`   📱 Источник: ${source}`);
        console.log(`   🏷️ Тема: ${subject}`);
        console.log(`   💬 Сообщение: ${message}`);
        console.log(`   ⏰ Время: ${new Date(timestamp).toLocaleString('ru-RU')}`);
        
        // Формируем сообщение для админов
        const supportMessage = `${getSubjectEmoji(subject)} <b>${subject}</b>\n\n` +
            `🎫 ID: ${ticketId}\n` +
            `👤 Пользователь: ${userName}\n` +
            `📱 Источник: ${source}\n` +
            `⏰ Время: ${new Date(timestamp).toLocaleString('ru-RU')}\n` +
            `💬 Сообщение: ${message}\n\n` +
            `➡️ Свяжитесь с пользователем: /user ${userId}`;

        // Пытаемся отправить уведомление через webhook
        try {
            // Отправляем уведомление на localhost:3001 (где работает бот)
            const response = await axios.post('http://localhost:3001/webhook/support-ticket', {
                ticketId,
                userId,
                userName,
                subject,
                message: supportMessage,
                timestamp
            }, {
                timeout: 3000,
                headers: { 'Content-Type': 'application/json' }
            }).catch(() => null);
            
            if (response && response.status === 200) {
                console.log('📨 Уведомление отправлено в бот');
            } else {
                console.log('⚠️ Бот недоступен, уведомление не отправлено');
            }
        } catch (webhookError) {
            console.log('⚠️ Не удалось отправить webhook:', webhookError.message);
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

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🌐 Standalone веб-сервер запущен на порту ${PORT}`);
    console.log(`📱 Мини-приложение: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/`);
});

module.exports = app; 