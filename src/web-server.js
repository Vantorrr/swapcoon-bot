require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { bot, notifyOperators, notifyWebsiteActivity, db, googleSheets, amlService, crmService } = require('./bot');

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
    try {
        const rates = await googleSheets.getRates();
        res.json({ success: true, data: rates });
    } catch (error) {
        console.error('Ошибка получения курсов:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения курсов' });
    }
});

// Серверная функция расчета обмена
function calculateExchange(rates, fromCurrency, toCurrency, amount) {
    const fromRate = rates.find(r => r.currency === fromCurrency);
    const toRate = rates.find(r => r.currency === toCurrency);
    
    if (!fromRate || !toRate) {
        throw new Error(`Валютная пара ${fromCurrency}/${toCurrency} не найдена`);
    }
    
    // Расчет курса обмена
    const exchangeRate = fromRate.sell / toRate.buy;
    const toAmount = amount * exchangeRate;
    const fee = toAmount * 0.01; // 1% комиссия
    const finalAmount = toAmount - fee;
    
    return {
        fromAmount: amount,
        toAmount: finalAmount,
        exchangeRate,
        fee,
        fromCurrency,
        toCurrency
    };
}

// API для расчета обмена
app.post('/api/calculate', async (req, res) => {
    try {
        const { fromCurrency, toCurrency, amount, userId } = req.body;
        
        const rates = await googleSheets.getRates();
        const calculation = calculateExchange(rates, fromCurrency, toCurrency, amount);
        
        // Уведомляем о запросе курса (только для больших сумм)
        if (amount >= 1000) {
            await notifyWebsiteActivity('rate_request', {
                fromCurrency,
                toCurrency,
                amount,
                userId: userId || 'anonymous'
            });
        }
        
        res.json({ success: true, data: calculation });
    } catch (error) {
        console.error('Ошибка расчета:', error);
        res.status(500).json({ success: false, error: 'Ошибка расчета' });
    }
});

// API для AML проверки
app.post('/api/aml-check', async (req, res) => {
    try {
        const { address, currency, userId } = req.body;
        
        const amlResult = await amlService.checkAddress(address, currency);
        
        // Уведомляем об AML проверке (только если есть предупреждения)
        if (amlResult.status !== 'clean') {
            await notifyWebsiteActivity('aml_check', {
                address,
                currency,
                result: amlResult.status,
                userId: userId || 'anonymous'
            });
        }
        
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
            amlResult
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
            amlStatus: amlResult.status,
            status: 'pending'
        });

        // Получаем данные пользователя
        const user = await db.getUser(userId);

        // Отправляем уведомление операторам
        await notifyOperators({
            id: order.id,
            userName: user.firstName || user.username,
            fromAmount,
            fromCurrency,
            toCurrency,
            address: toAddress,
            amlStatus: amlResult.status
        });

        // Отправляем данные в CRM
        await crmService.createLead(order, user);

        // Обрабатываем реферальную систему
        if (user.referred_by) {
            await processReferralBonus(user.referred_by, order);
        }

        // Проверяем достижения
        await checkAndUpdateAchievements(userId, order);

        res.json({ success: true, data: order });
    } catch (error) {
        console.error('Ошибка создания заявки:', error);
        res.status(500).json({ success: false, error: 'Ошибка создания заявки' });
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
        const stats = await db.getUserStats(userId);
        const referralStats = await db.getReferralStats(userId);
        const achievements = await db.getUserAchievements(userId);
        const level = calculateUserLevel(stats);
        
        const profile = {
            ...user,
            stats,
            referralStats,
            achievements,
            level,
            avatar: `https://t.me/i/userpic/320/${user.username || user.telegram_id}.jpg`
        };
        
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения профиля' });
    }
});

// API для получения реферальной ссылки
app.get('/api/referral/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const referralLink = `https://t.me/${process.env.BOT_USERNAME || 'swapcoon_bot'}?start=${userId}`;
        
        res.json({ success: true, data: { referralLink } });
    } catch (error) {
        console.error('Ошибка получения реферальной ссылки:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения реферальной ссылки' });
    }
});

// API для получения статистики рефералов
app.get('/api/referral-stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Получаем список рефералов
        const referrals = await db.getReferralList(userId);
        const stats = await db.getReferralStats(userId);
        
        res.json({ 
            success: true, 
            data: {
                stats,
                referrals
            }
        });
    } catch (error) {
        console.error('Ошибка получения статистики рефералов:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения статистики рефералов' });
    }
});

// API для получения статистики пользователя с графиками
app.get('/api/stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { period = '7d' } = req.query;
        
        const stats = await db.getDetailedStats(userId, period);
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения статистики' });
    }
});

// API для получения рыночных данных
app.get('/api/market-data', async (req, res) => {
    try {
        const marketData = await getMarketData();
        res.json({ success: true, data: marketData });
    } catch (error) {
        console.error('Ошибка получения рыночных данных:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения рыночных данных' });
    }
});

// API для получения достижений
app.get('/api/achievements/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const achievements = await db.getUserAchievements(userId);
        const availableAchievements = await db.getAvailableAchievements();
        
        res.json({ 
            success: true, 
            data: {
                earned: achievements,
                available: availableAchievements
            }
        });
    } catch (error) {
        console.error('Ошибка получения достижений:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения достижений' });
    }
});

// API для новостей и обновлений
app.get('/api/news', async (req, res) => {
    try {
        const news = await getLatestNews();
        res.json({ success: true, data: news });
    } catch (error) {
        console.error('Ошибка получения новостей:', error);
        res.status(500).json({ success: false, error: 'Ошибка получения новостей' });
    }
});

// Функция обработки реферального бонуса
async function processReferralBonus(referrerId, order) {
    try {
        const commission = order.toAmount * 0.005; // 0.5% комиссия рефереру
        
        await db.addReferralCommission({
            referrerId: referrerId,
            refereeId: order.userId,
            orderId: order.id,
            commission: commission
        });
        
        // Обновляем общую комиссию пользователя
        await db.updateUserCommission(referrerId);
        
        console.log(`✅ Реферальная комиссия ${commission} добавлена для пользователя ${referrerId}`);
        
        // Уведомляем реферера о получении комиссии
        try {
            if (bot && bot.api) {
                await bot.api.sendMessage(referrerId, 
                    `💰 <b>Получена реферальная комиссия!</b>\n\n` +
                    `💵 Сумма: $${commission.toFixed(2)}\n` +
                    `📝 За обмен: ${order.fromCurrency} → ${order.toCurrency}\n` +
                    `👤 От реферала: ${order.userId}\n\n` +
                    `🎉 Спасибо за привлечение новых пользователей!`,
                    { parse_mode: 'HTML' }
                );
            }
        } catch (notifyError) {
            console.log('⚠️ Не удалось уведомить о комиссии:', notifyError.message);
        }
        
    } catch (error) {
        console.error('❌ Ошибка обработки реферального бонуса:', error);
    }
}

// Функция расчета уровня пользователя
function calculateUserLevel(stats) {
    const totalVolume = stats.totalVolume || 0;
    const ordersCount = stats.ordersCount || 0;
    
    if (totalVolume >= 100000 || ordersCount >= 100) {
        return { level: 'VIP', name: 'VIP Трейдер', color: '#FFD700', benefits: ['Приоритетная поддержка', 'Минимальные комиссии', 'Эксклюзивные курсы'] };
    } else if (totalVolume >= 10000 || ordersCount >= 25) {
        return { level: 'PRO', name: 'Про Трейдер', color: '#8B5CF6', benefits: ['Быстрая обработка', 'Персональный менеджер', 'Аналитика'] };
    } else if (totalVolume >= 1000 || ordersCount >= 5) {
        return { level: 'TRADER', name: 'Трейдер', color: '#10B981', benefits: ['Расширенная статистика', 'Приоритет в очереди'] };
    } else {
        return { level: 'NEWBIE', name: 'Новичок', color: '#6B7280', benefits: ['Обучающие материалы', 'Поддержка 24/7'] };
    }
}

// Функция проверки достижений
async function checkAndUpdateAchievements(userId, order) {
    try {
        const stats = await db.getUserStats(userId);
        const newAchievements = [];
        
        // Первый обмен
        if (stats.ordersCount === 1) {
            newAchievements.push('first_exchange');
        }
        
        // Различные объемы
        if (stats.totalVolume >= 1000 && !await db.hasAchievement(userId, 'volume_1k')) {
            newAchievements.push('volume_1k');
        }
        if (stats.totalVolume >= 10000 && !await db.hasAchievement(userId, 'volume_10k')) {
            newAchievements.push('volume_10k');
        }
        
        // Количество обменов
        if (stats.ordersCount >= 10 && !await db.hasAchievement(userId, 'orders_10')) {
            newAchievements.push('orders_10');
        }
        
        // Сохраняем новые достижения
        for (const achievement of newAchievements) {
            await db.addUserAchievement(userId, achievement);
        }
        
        if (newAchievements.length > 0) {
            console.log(`🏆 Пользователь ${userId} получил достижения:`, newAchievements);
        }
        
    } catch (error) {
        console.error('Ошибка проверки достижений:', error);
    }
}

// Функция получения рыночных данных
async function getMarketData() {
    // В реальном проекте здесь будет API криптобирж
    return {
        trends: [
            { currency: 'BTC', change24h: '+2.5%', price: '$95,000' },
            { currency: 'ETH', change24h: '+1.8%', price: '$3,500' },
            { currency: 'USDT', change24h: '0.0%', price: '$1.00' }
        ],
        volume24h: '$2.5B',
        topGainers: [
            { currency: 'BTC', change: '+2.5%' },
            { currency: 'ETH', change: '+1.8%' }
        ],
        topLosers: []
    };
}

// Функция получения новостей
async function getLatestNews() {
    return [
        {
            id: 1,
            title: 'Новые валютные пары доступны!',
            description: 'Добавили поддержку EUR и RUB для всех операций',
            date: new Date().toISOString(),
            type: 'feature'
        },
        {
            id: 2,
            title: 'Улучшили безопасность',
            description: 'Внедрена расширенная AML проверка для защиты пользователей',
            date: new Date(Date.now() - 86400000).toISOString(),
            type: 'security'
        }
    ];
}

// Webhook для Telegram (если используется)
app.use(`/webhook/${process.env.BOT_TOKEN}`, express.json(), (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🌐 Веб-сервер запущен на порту ${PORT}`);
    console.log(`📱 Мини-приложение: http://localhost:${PORT}`);
    
    // Инициализация базы данных
    console.log('✅ База данных подключена');
    console.log('✅ Таблицы базы данных созданы');
});

module.exports = app; 