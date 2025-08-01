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
    console.log('📊 API /api/rates: читаем курсы ИЗ RatesService с Google Sheets');
    
    try {
        let rates = [];
        let rawPairs = [];
        
        // 🔥 ЧИТАЕМ ИЗ GLOBAL.RATESSERVICE (с Google Sheets синхронизацией)
        if (global.ratesService) {
            console.log('✅ Используем global.ratesService с Google Sheets');
            rawPairs = await global.ratesService.getRates();
            console.log(`📊 Получено ${rawPairs.length} пар валют из RatesService`);
        } else if (ratesService) {
            console.log('✅ Используем локальный ratesService');
            rawPairs = await ratesService.getRates();
            console.log(`📊 Получено ${rawPairs.length} пар валют из локального RatesService`);
        } else {
            console.log('⚠️ RatesService недоступен, используем fallback курсы');
            // Fallback курсы только если RatesService не работает
            rates = [
                { currency: "USDT", price: 1, buy: 1, sell: 1, source: "FALLBACK", type: "crypto", lastUpdate: new Date().toISOString() }
            ];
        }
        
        // 🔥 ПРОСТОЙ СПИСОК ВАЛЮТ ИЗ ПАР БЕЗ ДЕБИЛЬНЫХ ПРЕОБРАЗОВАНИЙ
        if (rawPairs.length > 0) {
            const currencySet = new Set();
            
            // Извлекаем уникальные валюты из пар
            for (const pair of rawPairs) {
                const [fromCurrency, toCurrency] = pair.pair.split('/');
                currencySet.add(fromCurrency);
                currencySet.add(toCurrency);
            }
            
            // Определяем тип валюты (крипто или фиат)
            const getCurrencyType = (currency) => {
                const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'ADA', 'DOT', 'LINK'];
                return cryptoCurrencies.includes(currency) ? 'crypto' : 'fiat';
            };
            
            // Создаем простой список валют БЕЗ КУРСОВ
            rates = Array.from(currencySet).map(currency => ({
                currency: currency,
                price: 1, // Заглушка
                buy: 1,   // Заглушка
                sell: 1,  // Заглушка
                source: "GOOGLE_SHEETS",
                type: getCurrencyType(currency),
                lastUpdate: new Date().toISOString()
            }));
            
            console.log(`📊 Создан простой список из ${rates.length} валют без курсов`);
        }
        
        console.log(`📊 Отправляем ${rates.length} валют в веб-приложение`);
        
        res.json({ 
            success: true, 
            data: rates,
            rawPairs: rawPairs, // Передаем сырые пары для прямых расчетов
            lastUpdate: new Date().toISOString(),
            source: global.ratesService ? 'rates_service_with_sheets' : (ratesService ? 'local_rates_service' : 'fallback'),
            count: rates.length
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения курсов:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения курсов',
            source: 'error'
        });
    }
});

// API для принудительной синхронизации курсов
app.post('/api/force-sync', async (req, res) => {
    console.log('🔄 API /api/force-sync: принудительная синхронизация курсов');
    
    try {
        if (global.ratesService) {
            console.log('🔄 Вызываем синхронизацию RatesService...');
            await global.ratesService.syncWithGoogleSheets();
            console.log('✅ Синхронизация завершена');
        } else {
            console.log('⚠️ RatesService недоступен для синхронизации');
        }
        
        res.json({ 
            success: true, 
            message: 'Синхронизация выполнена',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Ошибка принудительной синхронизации:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка синхронизации'
        });
    }
});

// API для расчета обмена (ИЗ RatesService с Google Sheets)
app.post('/api/calculate', async (req, res) => {
    console.log('🧮 API /api/calculate: расчет ИЗ RatesService с Google Sheets');
    
    const { fromCurrency, toCurrency, amount } = req.body;
    
    try {
        let exchangeRate = 1;
        
        // 🔥 ИСПОЛЬЗУЕМ RATESSERVICE для получения курса
        if (global.ratesService && global.ratesService.getExchangeRate) {
            console.log(`🧮 Получаем курс ${fromCurrency} → ${toCurrency} из RatesService`);
            exchangeRate = await global.ratesService.getExchangeRate(fromCurrency, toCurrency);
            console.log(`📊 Курс из RatesService: ${exchangeRate}`);
        } else if (ratesService && ratesService.getExchangeRate) {
            console.log(`🧮 Получаем курс ${fromCurrency} → ${toCurrency} из локального RatesService`);
            exchangeRate = await ratesService.getExchangeRate(fromCurrency, toCurrency);
            console.log(`📊 Курс из локального RatesService: ${exchangeRate}`);
        } else {
            console.log('⚠️ RatesService недоступен, используем fallback расчет');
            
            // Fallback расчет если RatesService не работает
            if (fromCurrency === 'USDT' && toCurrency === 'ARS') {
                exchangeRate = 1290;
            } else if (fromCurrency === 'ARS' && toCurrency === 'USDT') {
                exchangeRate = 1/1290;
            } else if (fromCurrency === 'USDT' && toCurrency === 'RUB') {
                exchangeRate = 78;
            } else if (fromCurrency === 'RUB' && toCurrency === 'USDT') {
                exchangeRate = 1/78;
            } else {
                const fromUSD = fromCurrency === 'USD' ? 1 : (fromCurrency === 'USDT' ? 1 : (fromCurrency === 'RUB' ? 1/78 : (fromCurrency === 'ARS' ? 1/1290 : 1)));
                const toUSD = toCurrency === 'USD' ? 1 : (toCurrency === 'USDT' ? 1 : (toCurrency === 'RUB' ? 1/78 : (toCurrency === 'ARS' ? 1/1290 : 1)));
                exchangeRate = fromUSD / toUSD;
            }
        }
        
        const toAmount = amount * exchangeRate;
        
        console.log(`�� РЕЗУЛЬТАТ: ${amount} ${fromCurrency} = ${toAmount} ${toCurrency} (курс: ${exchangeRate})`);
        
        res.json({
            success: true,
            data: {
                fromAmount: amount,
                toAmount: toAmount,
                exchangeRate: exchangeRate,
                fee: 0,
                fromCurrency: fromCurrency,
                toCurrency: toCurrency,
                source: global.ratesService ? 'rates_service' : 'fallback'
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка расчета обмена:', error.message);
        res.status(500).json({
            success: false,
            error: 'Ошибка расчета обмена'
        });
    }
});

// API для создания заявки
app.post('/api/create-order', async (req, res) => {
    try {
        console.log('🚀 API CREATE-ORDER ПОЛУЧИЛ ДАННЫЕ:', req.body);
        console.log('🚨 === ВЫЗОВ notifyOperators ===');
        
        // ДИАГНОСТИКА СЕРВИСОВ
        console.log('🔍 ДИАГНОСТИКА СЕРВИСОВ ПРИ СОЗДАНИИ ЗАКАЗА:');
        console.log('   db:', !!db);
        console.log('   googleSheetsManager:', !!googleSheetsManager);
        console.log('   notifyOperators:', !!notifyOperators);
        if (googleSheetsManager) {
            console.log('   googleSheetsManager.isReady():', googleSheetsManager.isReady());
            console.log('   googleSheetsManager.isConnected:', googleSheetsManager.isConnected);
        }
        
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

        // Логируем заказ в Google Sheets
        console.log('🔍 ДИАГНОСТИКА GOOGLE SHEETS:');
        console.log('   googleSheetsManager существует?', !!googleSheetsManager);
        if (googleSheetsManager) {
            console.log('   googleSheetsManager.isReady():', googleSheetsManager.isReady());
        }
        
        if (googleSheetsManager && googleSheetsManager.isReady()) {
            console.log('📊 ЗАПИСЫВАЕМ ЗАКАЗ В GOOGLE SHEETS...');
            try {
                const result = await googleSheetsManager.logOrder({
                    id: order.id,
                    user_id: userId,
                    userName: user.first_name || user.username || `User_${userId}`,
                    fromCurrency: fromCurrency,
                    toCurrency: toCurrency,
                    fromAmount: fromAmount,
                    toAmount: toAmount,
                    exchangeRate: exchangeRate,
                    fee: fee || 0,
                    status: 'pending',
                    aml_status: JSON.stringify({ from: amlFromResult, to: amlToResult })
                });
                console.log('✅ РЕЗУЛЬТАТ ЗАПИСИ В GOOGLE SHEETS:', result);
            } catch (error) {
                console.error('❌ ОШИБКА ЗАПИСИ В GOOGLE SHEETS:', error.message);
                console.error('🔍 Stack trace:', error.stack);
            }
        } else {
            console.log('❌ GOOGLE SHEETS НЕДОСТУПЕН! Заказ НЕ записан в таблицу');
            if (!googleSheetsManager) {
                console.log('   Причина: googleSheetsManager не существует');
            } else if (!googleSheetsManager.isReady()) {
                console.log('   Причина: googleSheetsManager не готов');
            }
        }

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
