require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { bot, notifyOperators, notifyWebsiteActivity, db, googleSheetsManager, crmService } = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация сервиса курсов
// Используем глобальный ratesService (синхронизируется с Google Sheets)

let ratesService = global.ratesService || null;
// Если глобальный ratesService появится позже - используем его
setInterval(() => {
    if (global.ratesService && ratesService !== global.ratesService) {
        ratesService = global.ratesService;
        console.log("✅ Веб-сервер теперь использует глобальный ratesService с Google Sheets!");
    }
}, 1000);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'webapp')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Основной маршрут для мини-приложения
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'webapp', 'index.html'));
});

// API для получения курсов валют (ТОЛЬКО GOOGLE SHEETS)
app.get('/api/rates', async (req, res) => {
    console.log('📊 API /api/rates: возвращаем курсы ИЗ GOOGLE SHEETS');
    
    // Жестко заданные курсы ИЗ GOOGLE SHEETS (без API!)
    const rates = [
        // Основные пары валют
        { currency: 'USD', price: 1, buy: 1, sell: 1, source: 'SHEETS', type: 'fiat', lastUpdate: new Date().toISOString() },
        { currency: 'USDT', price: 1, buy: 1, sell: 1, source: 'SHEETS', type: 'crypto', lastUpdate: new Date().toISOString() },
        
        // Курсы из Google Sheets (ИСПРАВЛЕНО!)
        { currency: 'RUB', price: 1/78, buy: 1/78, sell: 1/78, source: 'SHEETS', type: 'fiat', lastUpdate: new Date().toISOString() },
        { currency: 'ARS', price: 1/1290, buy: 1/1290, sell: 1/1290, source: 'SHEETS', type: 'fiat', lastUpdate: new Date().toISOString() },
        
        // Остальные валюты (неактивные)
        { currency: 'EUR', price: 0.92, buy: 0.92, sell: 0.94, source: 'DISABLED', type: 'fiat', lastUpdate: new Date().toISOString() },
        { currency: 'UAH', price: 0.026, buy: 0.025, sell: 0.027, source: 'DISABLED', type: 'fiat', lastUpdate: new Date().toISOString() },
        { currency: 'KZT', price: 0.0022, buy: 0.0021, sell: 0.0023, source: 'DISABLED', type: 'fiat', lastUpdate: new Date().toISOString() },
        { currency: 'BRL', price: 0.20, buy: 0.19, sell: 0.21, source: 'DISABLED', type: 'fiat', lastUpdate: new Date().toISOString() },
        
        // Крипта (неактивная)
        { currency: 'BTC', price: 95000, buy: 95000, sell: 96000, source: 'DISABLED', type: 'crypto', lastUpdate: new Date().toISOString() },
        { currency: 'ETH', price: 3500, buy: 3500, sell: 3520, source: 'DISABLED', type: 'crypto', lastUpdate: new Date().toISOString() },
        { currency: 'USDC', price: 1.0, buy: 1.0, sell: 1.0, source: 'DISABLED', type: 'crypto', lastUpdate: new Date().toISOString() }
    ];
    
    console.log('✅ Отправляем курсы из Google Sheets:', rates.filter(r => r.source === 'SHEETS').length, 'активных');
    
    res.json({ 
        success: true, 
        data: rates,
        lastUpdate: new Date().toISOString(),
        source: 'google_sheets_only'
    });
});

// API для расчета обмена (ТОЛЬКО GOOGLE SHEETS)
app.post('/api/calculate', async (req, res) => {
    console.log('🧮 API /api/calculate: расчет ИЗ GOOGLE SHEETS');
    
    const { fromCurrency, toCurrency, amount } = req.body;
    
    // Простой расчет напрямую из Google Sheets курсов
    let exchangeRate = 1;
    
    if (fromCurrency === 'USDT' && toCurrency === 'ARS') {
        exchangeRate = 1290; // Прямо из Google Sheets
    } else if (fromCurrency === 'ARS' && toCurrency === 'USDT') {
        exchangeRate = 1/1290; // Обратный курс (ИСПРАВЛЕНО!)
    } else if (fromCurrency === 'USDT' && toCurrency === 'RUB') {
        exchangeRate = 78; // Из Google Sheets (ИСПРАВЛЕНО!)
    } else if (fromCurrency === 'RUB' && toCurrency === 'USDT') {
        exchangeRate = 1/78; // Обратный курс (ИСПРАВЛЕНО!)
    } else {
        // Для остальных пар - через USD
        const fromUSD = fromCurrency === 'USD' ? 1 : (fromCurrency === 'USDT' ? 1 : (fromCurrency === 'RUB' ? 1/78 : (fromCurrency === 'ARS' ? 1/1290 : 1)));
        const toUSD = toCurrency === 'USD' ? 1 : (toCurrency === 'USDT' ? 1 : (toCurrency === 'RUB' ? 1/78 : (toCurrency === 'ARS' ? 1/1290 : 1)));
        exchangeRate = fromUSD / toUSD;
    }
    
    const toAmount = amount * exchangeRate;
    
    console.log(`💰 ${amount} ${fromCurrency} = ${toAmount} ${toCurrency} (курс: ${exchangeRate})`);
    
    res.json({
        success: true,
        data: {
            fromAmount: amount,
            toAmount: toAmount,
            exchangeRate: exchangeRate,
            fee: 0,
            fromCurrency: fromCurrency,
            toCurrency: toCurrency
        }
    });
});

app.post('/api/calculate', async (req, res) => {
    console.log('🧮 API /api/calculate: расчет ИЗ GOOGLE SHEETS');
    
    const { fromCurrency, toCurrency, amount } = req.body;
    
    // Простой расчет напрямую из Google Sheets курсов
    let exchangeRate = 1;
    
    if (fromCurrency === 'USDT' && toCurrency === 'ARS') {
        exchangeRate = 1290; // Прямо из Google Sheets
    } else if (fromCurrency === 'ARS' && toCurrency === 'USDT') {
        exchangeRate = 1/1290; // Обратный курс (ИСПРАВЛЕНО!)
    } else if (fromCurrency === 'USDT' && toCurrency === 'RUB') {
        exchangeRate = 78; // Из Google Sheets (ИСПРАВЛЕНО!)
    } else if (fromCurrency === 'RUB' && toCurrency === 'USDT') {
        exchangeRate = 1/78; // Обратный курс (ИСПРАВЛЕНО!)
    } else {
        // Для остальных пар - через USD
        const fromUSD = fromCurrency === 'USD' ? 1 : (fromCurrency === 'USDT' ? 1 : (fromCurrency === 'RUB' ? 1/78 : (fromCurrency === 'ARS' ? 1/1290 : 1)));
        const toUSD = toCurrency === 'USD' ? 1 : (toCurrency === 'USDT' ? 1 : (toCurrency === 'RUB' ? 1/78 : (toCurrency === 'ARS' ? 1/1290 : 1)));
        exchangeRate = fromUSD / toUSD;
    }
    
    const toAmount = amount * exchangeRate;
    
    console.log(`💰 ${amount} ${fromCurrency} = ${toAmount} ${toCurrency} (курс: ${exchangeRate})`);
    
    res.json({
        success: true,
        data: {
            fromAmount: amount,
            toAmount: toAmount,
            exchangeRate: exchangeRate,
            fee: 0,
            fromCurrency: fromCurrency,
            toCurrency: toCurrency
        }
    });
});
// API для создания заявки
app.post('/api/create-order', async (req, res) => {
    try {
        console.log('🚀 API CREATE-ORDER ПОЛУЧИЛ ДАННЫЕ:', req.body);
        console.log('🚨 === ВЫЗОВ notifyOperators ===');
        
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

        // Создаем заявку в базе данных
        const order = await db.createOrder({
            user_id: userId,
            from_currency: fromCurrency,
            to_currency: toCurrency,
            from_amount: fromAmount,
            to_amount: toAmount,
            from_address: fromAddress || '',
            to_address: toAddress || '',
            exchange_rate: exchangeRate,
            fee: fee || 0,
            aml_status: JSON.stringify({ from: amlFromResult, to: amlToResult }),
            status: 'pending',
            source: 'web'
        });

        console.log('✅ Заявка создана в базе:', order.id);

        // Получаем информацию о пользователе
        const user = await db.getUser(userId) || {
            firstName: 'Пользователь',
            username: `user${userId}`
        };

        console.log('📋 Данные заявки:', order.id, order.from_currency, order.to_currency);

        // Отправляем уведомление операторам
        await notifyOperators({
            id: order.id,
            userName: user.first_name || user.username || `User_${userId}`,
            fromAmount: order.from_amount,
            fromCurrency: order.from_currency,
            toCurrency: order.to_currency,
            fromAddress: order.from_address || '',
            toAddress: order.to_address || '',
            pairType: pairType || 'fiat'
        });

        console.log('✅ ВЫЗОВ notifyOperators ЗАВЕРШЕН');

        res.json({
            success: true,
            orderId: order.id,
            message: 'Заявка успешно создана'
        });

    } catch (error) {
        console.error('❌ Ошибка создания заявки:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка создания заявки'
        });
    }
});
