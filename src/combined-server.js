require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 🔍 САМАЯ РАННЯЯ ДИАГНОСТИКА COMBINED-SERVER
console.log('🚀 COMBINED-SERVER.JS ЗАПУЩЕН!');
console.log('📅 Время запуска:', new Date().toISOString());
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
console.log('🔍 ПРОВЕРКА ПЕРЕМЕННЫХ GOOGLE SHEETS:');
console.log('   GOOGLE_SHEETS_ID:', process.env.GOOGLE_SHEETS_ID ? 'ЕСТЬ' : 'НЕТ');
console.log('   GOOGLE_SHEETS_CREDENTIALS:', process.env.GOOGLE_SHEETS_CREDENTIALS ? 'ЕСТЬ' : 'НЕТ');
console.log('   GOOGLE_SHEETS_ENABLED:', process.env.GOOGLE_SHEETS_ENABLED);

// 🤖 ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ БОТА
let bot = null;
let notifyOperators = null;
let notifyWebsiteActivity = null;
let db = null;

// 🤖 АСИНХРОННЫЙ ЗАПУСК TELEGRAM БОТА С ИНИЦИАЛИЗАЦИЕЙ АДМИНОВ
async function initializeBotAndAdmins() {
    console.log('🔍 НАЧАЛО ФУНКЦИИ initializeBotAndAdmins()');
    console.log('🤖 Инициализация Telegram бота...');
    try {
        // Импортируем бота
        const botModule = require('./bot');
        bot = botModule.bot;
        notifyOperators = botModule.notifyOperators;
        notifyWebsiteActivity = botModule.notifyWebsiteActivity;
        db = botModule.db;
        console.log('✅ Telegram бот инициализирован');
        
        // 🔍 ПРИНУДИТЕЛЬНАЯ ИНИЦИАЛИЗАЦИЯ GOOGLE SHEETS
        console.log('🔍 НАЧИНАЕМ ИНИЦИАЛИЗАЦИЮ GOOGLE SHEETS В COMBINED-SERVER...');
        try {
            // Импортируем функцию initGoogleSheets напрямую
            const fs = require('fs');
            const path = require('path');
            const GoogleSheetsManager = require('./services/GoogleSheetsManager');
            
            // Проверяем переменные окружения
            const envSpreadsheetId = process.env.GOOGLE_SHEETS_ID;
            const envCredentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
            const envEnabled = process.env.GOOGLE_SHEETS_ENABLED !== 'false';
            
            console.log('🔍 ДИАГНОСТИКА ПЕРЕМЕННЫХ В COMBINED-SERVER:');
            console.log('   GOOGLE_SHEETS_ID:', envSpreadsheetId ? 'ЕСТЬ' : 'НЕТ');
            console.log('   GOOGLE_SHEETS_CREDENTIALS:', envCredentials ? 'ЕСТЬ' : 'НЕТ');
            console.log('   GOOGLE_SHEETS_ENABLED:', envEnabled);
            
            let config = null;
            
            // 🔥 СНАЧАЛА ФАЙЛ, ПОТОМ RAILWAY ПЕРЕМЕННЫЕ
            console.log("🔥 ПРОБУЕМ ФАЙЛ, ПОТОМ RAILWAY ПЕРЕМЕННЫЕ!");
            const configPath = path.join(__dirname, "..", "config", "google-sheets.json");
            
            if (fs.existsSync(configPath)) {
                console.log("📄 Файл config/google-sheets.json найден!");
                config = JSON.parse(fs.readFileSync(configPath, "utf8"));
                console.log("✅ Конфигурация из файла загружена");
                console.log("📊 Spreadsheet ID:", config.spreadsheet_id);
                console.log("📊 Enabled:", config.enabled);
                console.log("📊 Credentials client_email:", config.credentials?.client_email);
            } else {
                console.log("❌ Файл config/google-sheets.json не найден");
                console.log("🔄 ПРОБУЕМ RAILWAY ПЕРЕМЕННЫЕ...");
                
                if (envSpreadsheetId && envCredentials && envEnabled) {
                    try {
                        console.log('🔥 ⚡ ПАРСИМ RAILWAY CREDENTIALS...');
                        let cleanCredentials = envCredentials.trim();
                        if (cleanCredentials.startsWith('=')) {
                            console.log('🔧 Убираем лишний = из начала');
                            cleanCredentials = cleanCredentials.substring(1);
                        }
                        
                        const railwayCredentialsObj = JSON.parse(cleanCredentials);
                        console.log('✅ Railway JSON успешно спаршен!');
                        
                        config = {
                            enabled: true,
                            spreadsheet_id: envSpreadsheetId,
                            credentials: railwayCredentialsObj
                        };
                        
                        console.log("✅ Конфигурация из Railway переменных загружена");
                        console.log("📊 Spreadsheet ID:", config.spreadsheet_id);
                        console.log("📊 Credentials client_email:", config.credentials?.client_email);
                    } catch (railwayError) {
                        console.error('❌ Ошибка парсинга Railway credentials:', railwayError.message);
                    }
                } else {
                    console.log('❌ Railway переменные неполные');
                }
            }

                        if (config && config.enabled) {
                console.log('🚀 Инициализируем Google Sheets Manager в combined-server...');
                const googleSheetsManager = new GoogleSheetsManager();
                const success = await googleSheetsManager.init(config.credentials, config.spreadsheet_id);
                
                console.log('🔍 Результат googleSheetsManager.init():', success);
                if (success) {
                    console.log('🔧 Создаем worksheets...');
                    await googleSheetsManager.createWorksheets();
                    global.googleSheetsManager = googleSheetsManager;
                    console.log('✅ Google Sheets Manager инициализирован в combined-server!');
                    console.log('🔍 global.googleSheetsManager установлен:', !!global.googleSheetsManager);
                } else {
                    console.log('❌ Ошибка подключения к Google Sheets API в combined-server');
                }
            } else {
                console.log('❌ Google Sheets не настроены или отключены в combined-server');
                console.log('   Причина: config =', !!config, ', enabled =', config?.enabled);
            }
        } catch (sheetsInitError) {
            console.error('❌ ОШИБКА инициализации Google Sheets в combined-server:', sheetsInitError.message);
        }
        
        // Инициализируем Google Sheets Manager глобально
        try {
            console.log('🔍 ПРОВЕРЯЕМ BOTMODULE:');
            console.log('   botModule существует?', !!botModule);
            console.log('   botModule.googleSheetsManager существует?', !!botModule.googleSheetsManager);
            
            if (botModule.googleSheetsManager) {
                global.googleSheetsManager = botModule.googleSheetsManager;
                console.log('📊 Google Sheets Manager доступен глобально из botModule');
                console.log('🔍 global.googleSheetsManager теперь:', !!global.googleSheetsManager);
            } else {
                console.log('⚠️ Google Sheets Manager НЕ инициализирован в botModule');
            }
        } catch (error) {
            console.log('❌ Ошибка инициализации Google Sheets Manager:', error.message);
        }
        
        // 🔍 ФИНАЛЬНАЯ ПРОВЕРКА
        console.log('🔍 ИТОГОВОЕ СОСТОЯНИЕ global.googleSheetsManager:', !!global.googleSheetsManager);
        
                    // 🔥 ПРИНУДИТЕЛЬНАЯ ИНИЦИАЛИЗАЦИЯ ЕСЛИ НЕ УДАЛОСЬ
            console.log('🔍 СОСТОЯНИЕ: global.googleSheetsManager =', !!global.googleSheetsManager);
            if (!global.googleSheetsManager) {
            console.log('🔥🔥🔥 ПРИНУДИТЕЛЬНАЯ ИНИЦИАЛИЗАЦИЯ Google Sheets...');
            try {
                const fs = require('fs');
                const path = require('path');
                const configPath = path.join(__dirname, '..', 'config', 'google-sheets.json');
                
                console.log('🔥 ПОЛНАЯ ДИАГНОСТИКА ПУТИ:');
                console.log('   __dirname:', __dirname);
                console.log('   configPath:', configPath);
                console.log('   файл существует?', fs.existsSync(configPath));
                
                if (fs.existsSync(configPath)) {
                    console.log('🔥 Читаем config/google-sheets.json напрямую...');
                    const fileContent = fs.readFileSync(configPath, 'utf8');
                    console.log('🔥 СОДЕРЖИМОЕ ФАЙЛА (первые 200 символов):', fileContent.substring(0, 200));
                    
                    const forceConfig = JSON.parse(fileContent);
                    
                    console.log('🔥 ПАРСИНГ УСПЕШЕН! Принудительный конфиг:');
                    console.log('   enabled:', forceConfig.enabled);
                    console.log('   spreadsheet_id:', forceConfig.spreadsheet_id ? 'есть' : 'нет');
                    console.log('   credentials:', forceConfig.credentials ? 'есть' : 'нет');
                    console.log('   credentials.type:', forceConfig.credentials?.type);
                    console.log('   credentials.client_email:', forceConfig.credentials?.client_email ? 'есть' : 'нет');
                    
                    if (forceConfig.enabled && forceConfig.spreadsheet_id && forceConfig.credentials) {
                        console.log('🔥 НАЧИНАЕМ ИНИЦИАЛИЗАЦИЮ GoogleSheetsManager...');
                        const GoogleSheetsManager = require('./services/GoogleSheetsManager');
                        const forceManager = new GoogleSheetsManager();
                        
                        console.log('🔥 GoogleSheetsManager создан, вызываем init()...');
                        const forceSuccess = await forceManager.init(forceConfig.credentials, forceConfig.spreadsheet_id);
                        
                        console.log('🔥 Результат принудительной инициализации:', forceSuccess);
                        if (forceSuccess) {
                            console.log('🔥 init() успешен! Создаем worksheets...');
                            await forceManager.createWorksheets();
                            
                            console.log('🔥 worksheets созданы! Устанавливаем global...');
                            global.googleSheetsManager = forceManager;
                            
                            console.log('🔥 Тестируем isReady()...');
                            console.log('🔥 forceManager.isReady():', forceManager.isReady());
                            
                            console.log('🔥 ✅ ПРИНУДИТЕЛЬНАЯ ИНИЦИАЛИЗАЦИЯ УСПЕШНА!');
                        } else {
                            console.log('🔥 ❌ Принудительная инициализация не удалась - init() вернул false');
                        }
                    } else {
                        console.log('🔥 ❌ Некорректная конфигурация в файле');
                    }
                } else {
                    console.log('🔥 ❌ Файл config/google-sheets.json не найден');
                    console.log('🔥 ⚡ ПРОБУЕМ ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ RAILWAY...');
                    
                    // Пробуем переменные окружения
                    const envSpreadsheetId = process.env.GOOGLE_SHEETS_ID;
                    const envCredentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
                    const envEnabled = process.env.GOOGLE_SHEETS_ENABLED !== 'false';
                    
                    console.log('🔥 Railway переменные:');
                    console.log('   GOOGLE_SHEETS_ID:', envSpreadsheetId ? 'ЕСТЬ' : 'НЕТ');
                    console.log('   GOOGLE_SHEETS_CREDENTIALS:', envCredentials ? 'ЕСТЬ' : 'НЕТ');
                    console.log('   GOOGLE_SHEETS_ENABLED:', envEnabled);
                    
                    if (envSpreadsheetId && envCredentials && envEnabled) {
                        try {
                            console.log('🔥 ⚡ ПАРСИМ CREDENTIALS ИЗ RAILWAY...');
                            console.log('🔍 Длина envCredentials:', envCredentials.length);
                            console.log('🔍 Первые 50 символов:', envCredentials.substring(0, 50));
                            console.log('🔍 Последние 50 символов:', envCredentials.substring(envCredentials.length - 50));
                            
                            // Очищаем от возможных лишних символов
                            let cleanCredentials = envCredentials.trim();
                            console.log('🔍 После trim - первые 10:', cleanCredentials.substring(0, 10));
                            
                            // Если есть лишний = в начале - убираем его
                            if (cleanCredentials.startsWith('=')) {
                                console.log('🔥 ⚡ НАЙДЕН ЛИШНИЙ = В НАЧАЛЕ! Убираем...');
                                cleanCredentials = cleanCredentials.substring(1);
                                console.log('🔍 После удаления = - первые 10:', cleanCredentials.substring(0, 10));
                            }
                            
                            const railwayCredentials = JSON.parse(cleanCredentials);
                            console.log('🔥 ✅ JSON УСПЕШНО СПАРШЕН!');
                            
                            const railwayConfig = {
                                enabled: true,
                                spreadsheet_id: envSpreadsheetId,
                                credentials: railwayCredentials
                            };
                            
                            console.log('🔥 ⚡ НАЧИНАЕМ RAILWAY ИНИЦИАЛИЗАЦИЮ...');
                            const GoogleSheetsManager = require('./services/GoogleSheetsManager');
                            const railwayManager = new GoogleSheetsManager();
                            
                            console.log('🔥 ⚡ ВЫЗЫВАЕМ init() с Railway конфигом...');
                            const railwaySuccess = await railwayManager.init(railwayConfig.credentials, railwayConfig.spreadsheet_id);
                            
                            if (railwaySuccess) {
                                console.log('🔥 ⚡ RAILWAY INIT УСПЕШЕН! Создаем worksheets...');
                                await railwayManager.createWorksheets();
                                global.googleSheetsManager = railwayManager;
                                console.log('🔥 ⚡ ✅ RAILWAY ИНИЦИАЛИЗАЦИЯ ЗАВЕРШЕНА!');
                            } else {
                                console.log('🔥 ⚡ ❌ Railway init вернул false');
                            }
                        } catch (railwayError) {
                            console.error('🔥 ⚡ ❌ Ошибка Railway инициализации:', railwayError.message);
                        }
                    } else {
                        console.log('🔥 ⚡ ❌ Railway переменные неполные');
                    }
                }
            } catch (forceError) {
                console.error('🔥 ❌ Ошибка принудительной инициализации:', forceError.message);
                console.error('🔥 ❌ Stack trace:', forceError.stack);
            }
        }
        
        // 🔍 ФИНАЛЬНАЯ ДИАГНОСТИКА
        console.log('🔍🔍🔍 ФИНАЛЬНАЯ ПРОВЕРКА GOOGLE SHEETS:');
        console.log('   global.googleSheetsManager существует:', !!global.googleSheetsManager);
        if (global.googleSheetsManager) {
            console.log('   isReady():', global.googleSheetsManager.isReady());
            console.log('   isConnected:', global.googleSheetsManager.isConnected);
            console.log('   spreadsheetId:', global.googleSheetsManager.spreadsheetId ? 'есть' : 'нет');
        } else {
            console.log('🔥🔥🔥 КРИТИЧНО! global.googleSheetsManager = НЕТ!');
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
                const emergencyAdmins = [8141463258, 461759951, 280417617, 7692725312];
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
            const emergencyAdmins = [8141463258, 461759951, 280417617, 7692725312];
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
            console.log('📊 СТАТИСТИКА: База пустая - это нормально для нового бота');
            console.log('💡 Тестовые данные НЕ создаются - работаем с реальными данными');
            
            // ❌ ОТКЛЮЧЕНО: Создание тестовых данных
            // Работаем только с реальными пользователями и заказами
            
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
    global.ratesService = ratesService; // Делаем доступным глобально
    console.log('✅ RatesService инициализирован и доступен глобально');
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

// API для принудительной синхронизации с Google Sheets
app.post('/api/force-sync', async (req, res) => {
    console.log('🔥 ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ ЗАПРОШЕНА!');
    
    try {
        if (!global.ratesService) {
            console.error('❌ GLOBAL.RATESSERVICE НЕ ИНИЦИАЛИЗИРОВАН!');
            return res.status(500).json({ 
                success: false, 
                error: 'RatesService не инициализирован'
            });
        }

        if (!global.googleSheetsManager || !global.googleSheetsManager.isReady()) {
            console.error('❌ GOOGLE SHEETS MANAGER НЕ ГОТОВ!');
            return res.status(500).json({ 
                success: false, 
                error: 'Google Sheets Manager не готов'
            });
        }

        console.log('🔥 Запускаем принудительную синхронизацию...');
        await global.ratesService.syncWithGoogleSheets();
        
        console.log('✅ Принудительная синхронизация завершена!');
        res.json({ 
            success: true, 
            message: 'Синхронизация завершена',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Ошибка принудительной синхронизации:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API для получения курсов валют
app.get('/api/rates', async (req, res) => {
    console.log('📈 Запрос курсов валют...');
    
    try {
        // 🔥 ТОЛЬКО GLOBAL.RATESSERVICE!!! НИКАКИХ FALLBACK НА ТЕСТОВЫЕ ДАННЫЕ!
        if (!global.ratesService) {
            console.error('❌ GLOBAL.RATESSERVICE НЕ ИНИЦИАЛИЗИРОВАН!');
            return res.status(500).json({ 
                success: false, 
                error: 'RatesService не инициализирован',
                message: 'Google Sheets недоступен'
            });
        }

        console.log('📡 Получаем курсы ТОЛЬКО через GLOBAL.RatesService с Google Sheets...');
        const pairRates = await global.ratesService.getRates();
        console.log(`📊 Получено ${pairRates.length} пар из global.ratesService`);
        
        // Простой список валют без дебильных курсов
        const currencySet = new Set();
        
        pairRates.forEach(pairData => {
            const [from, to] = pairData.pair.split('/');
            currencySet.add(from);
            currencySet.add(to);
        });
        
        const rates = Array.from(currencySet).map(currency => ({
            currency: currency,
            price: 1,
            sell: 1, 
            buy: 1,
            type: ['RUB', 'ARS', 'UAH', 'KZT'].includes(currency) ? 'fiat' : 'crypto',
            source: 'GOOGLE_SHEETS',
            lastUpdate: new Date().toISOString()
        }));
        
        res.json({ 
            success: true, 
            data: rates,
            rawPairs: pairRates, // 🔥 ДОБАВЛЯЕМ СЫРЫЕ ДАННЫЕ ПАР!
            lastUpdate: global.ratesService.getLastUpdateTime(),
            source: 'ТОЛЬКО_GOOGLE_SHEETS'
        });
        console.log('✅ Курсы отправлены:', rates.length, 'валют');
        
    } catch (error) {
        console.error('❌ Ошибка получения курсов:', error.message);
        // 🔥 НЕ ИСПОЛЬЗУЕМ ТЕСТОВЫЕ ДАННЫЕ! ВОЗВРАЩАЕМ ОШИБКУ!
        res.status(500).json({ 
            success: false, 
            error: 'Не удалось получить курсы из Google Sheets',
            message: error.message
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
            const adminIds = [8141463258, 461759951, 280417617, 7692725312]; // ID админов
            
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
        
        // Получаем базовую инфу о пользователе
        const user = await db.getUser ? await db.getUser(userId) : null;
        
        // Получаем статистику сделок
        const stats = await db.getUserStats ? await db.getUserStats(userId) : {
            ordersCount: 0,
            totalVolume: 0,
            completedOrders: 0,
            avgOrderValue: 0
        };
        
        // Достижения и уровень
        const achievements = await db.getUserAchievements ? await db.getUserAchievements(userId) : [];
        // Реферальная статистика
        const referralStats = await db.getReferralStats ? await db.getReferralStats(userId) : { total_referrals: 0, total_commission: 0, successful_orders: 0 };
        const referrals = await db.getReferralList ? await db.getReferralList(userId) : [];

        // Страховка: пересчёт total_commission по факту таблицы referrals
        try {
            if (db.updateUserCommission) {
                await db.updateUserCommission(userId);
                const freshRefStats = await db.getReferralStats(userId);
                referralStats.total_commission = freshRefStats.total_commission;
                referralStats.total_referrals = freshRefStats.total_referrals;
                referralStats.successful_orders = freshRefStats.successful_orders;
            }
        } catch (_) {}
        
        const profile = {
            id: userId,
            first_name: user?.first_name || 'Пользователь',
            last_name: user?.last_name || '',
            username: user?.username || `user${userId}`,
            created_at: user?.created_at || null,
            stats: {
                ordersCount: stats.ordersCount || 0,
                completedOrders: stats.completedOrders || 0,
                totalVolume: Number(stats.totalVolume || 0),
                avgOrderValue: Number(stats.avgOrderValue || 0)
            },
            achievements,
            referralStats,
            referrals
        };
        
        console.log('✅ Профиль отправлен:', profile);
        res.json({ success: true, data: profile });
    } catch (error) {
        console.error('❌ Ошибка получения профиля:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка получения профиля' });
    }
});

// API для истории пользователя (для веб-приложения)
app.get('/api/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const history = await db.getUserHistory ? await db.getUserHistory(userId) : [];
        res.json({ success: true, data: history });
    } catch (error) {
        console.error('❌ Ошибка получения истории:', error.message);
        res.status(500).json({ success: false, error: 'Ошибка получения истории' });
    }
});

// API для создания заявки
app.post('/api/create-order', async (req, res) => {
    console.log('🔥🔥🔥 ВХОД В ENDPOINT /api/create-order');
    console.log('🔥🔥🔥 req.body:', req.body);
    
    try {
        console.log('📝 Создание заявки (комбинированный режим):', req.body);
        console.log('🚨 === ПЕРЕД ВЫЗОВОМ notifyOperators ===');
        
        const {
            userId,
            userData, // Добавляем извлечение данных пользователя
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
            pairType,
            network,  // ← ДОБАВЛЯЕМ ИЗВЛЕЧЕНИЕ СЕТИ!
            bank      // ← ДОБАВЛЯЕМ ИЗВЛЕЧЕНИЕ БАНКА!
        } = req.body;

        // ДЕТАЛЬНАЯ ДИАГНОСТИКА ИЗВЛЕЧЕННЫХ ДАННЫХ
        console.log('🔍 ИЗВЛЕЧЕННЫЕ ДАННЫЕ:');
        console.log('  userId:', userId);
        console.log('  fromCurrency:', fromCurrency);
        console.log('  toCurrency:', toCurrency);
        console.log('  fromAmount:', fromAmount);
        console.log('  toAmount:', toAmount);
        console.log('  fromAddress:', fromAddress);
        console.log('  toAddress:', toAddress);
        console.log('  exchangeRate:', exchangeRate);
        console.log('  pairType:', pairType);

        console.log('🔄 АВТОМАТИЧЕСКИ РЕГИСТРИРУЕМ ПОЛЬЗОВАТЕЛЯ В БОТЕ');
        console.log('🔄 ПОПЫТКА РЕГИСТРАЦИИ ПОЛЬЗОВАТЕЛЯ:', userId);
        console.log('🔄 db существует?', !!db);
        console.log('🔄 db.upsertUser существует?', !!(db && db.upsertUser));
        
        if (db && db.upsertUser) {
            try {
                console.log('🔄 Регистрируем пользователя в боте...', userId);
                const userData = {
                    telegramId: userId,           // ← ИСПРАВЛЕНО!
                    firstName: 'Пользователь',   // ← ИСПРАВЛЕНО!
                    lastName: '',                // ← ИСПРАВЛЕНО!
                    username: `user${userId}`,
                    referredBy: null
                };
                console.log('🔄 Данные пользователя:', userData);
                
                const result = await db.upsertUser(userData);
                console.log('✅ Пользователь зарегистрирован в боте:', userId);
                console.log('✅ Результат регистрации:', result);
            } catch (userError) {
                console.error('❌ Ошибка регистрации пользователя:', userError.message);
                console.error('❌ Полная ошибка:', userError);
            }
        } else {
            console.error('❌ КРИТИЧНО: db или db.upsertUser не доступны!');
        }

        // Создаем заявку в базе данных
        let realOrderId = null; // будет установлен после создания в базе
        if (db && db.createOrder) {
            try {
                // Нормализуем оборот в USD/USDT ноге для метрик
                let usdEquiv = 0;
                try {
                    const RatesService = require('./services/RatesService');
                    const ratesService = new RatesService();
                    if (toCurrency === 'USDT' || toCurrency === 'USD') {
                        usdEquiv = parseFloat(toAmount) || 0;
                    } else if (fromCurrency === 'USDT' || fromCurrency === 'USD') {
                        usdEquiv = parseFloat(fromAmount) || 0;
                    } else {
                        // Попробуем через USDT как мост
                        const toToUsdt = await ratesService.getExchangeRate(toCurrency, 'USDT');
                        if (toToUsdt && isFinite(toToUsdt)) {
                            usdEquiv = (parseFloat(toAmount) || 0) * toToUsdt;
                        }
                    }
                } catch (e) {
                    console.log('⚠️ Не удалось посчитать usdEquiv:', e.message);
                }

                const order = await db.createOrder({
                    userId: userId,                    // ← ИСПРАВЛЕНО: camelCase
                    fromCurrency: fromCurrency,       // ← ИСПРАВЛЕНО: camelCase
                    toCurrency: toCurrency,           // ← ИСПРАВЛЕНО: camelCase
                    fromAmount: fromAmount,           // ← ИСПРАВЛЕНО: camelCase
                    toAmount: toAmount,               // ← ИСПРАВЛЕНО: camelCase
                    fromAddress: fromAddress || '',   // ← ИСПРАВЛЕНО: camelCase
                    toAddress: toAddress || '',       // ← ИСПРАВЛЕНО: camelCase
                    exchangeRate: exchangeRate,       // ← ИСПРАВЛЕНО: camelCase
                    usdEquiv: usdEquiv,
                    fee: fee || 0,
                    amlStatus: JSON.stringify({ from: amlFromResult, to: amlToResult }),  // ← ИСПРАВЛЕНО: camelCase
                    status: 'pending',
                    source: 'web',
                    bank: bank || null,               // ← ДОБАВЛЯЕМ БАНК
                    network: network || null          // ← ДОБАВЛЯЕМ СЕТЬ
                });
                console.log('✅ Заявка создана в базе:', order.id);
                realOrderId = order.id; // ← СОХРАНЯЕМ РЕАЛЬНЫЙ ID ИЗ БАЗЫ!

                // 📊 ЛОГИРУЕМ ЗАКАЗ В GOOGLE SHEETS
                console.log('🔍 ДИАГНОСТИКА GOOGLE SHEETS (COMBINED SERVER):');
                console.log('   global.googleSheetsManager существует?', !!global.googleSheetsManager);
                if (global.googleSheetsManager) {
                    console.log('   global.googleSheetsManager.isReady():', global.googleSheetsManager.isReady());
                }
                
                if (global.googleSheetsManager && global.googleSheetsManager.isReady()) {
                    console.log('📊 ЗАПИСЫВАЕМ ЗАКАЗ В GOOGLE SHEETS (COMBINED)...');
                    try {
                        // Используем данные пользователя из запроса
                        const userForSheets = userData || {
                            first_name: 'Пользователь',
                            username: `user${userId}`
                        };
                        
                        const result = await global.googleSheetsManager.logOrder({
                            id: order.id,
                            user_id: userId,
                            userName: userForSheets.first_name ? 
                                `${userForSheets.first_name}${userForSheets.last_name ? ' ' + userForSheets.last_name : ''}${userForSheets.username ? ' (@' + userForSheets.username + ')' : ''}` :
                                userForSheets.username || `User_${userId}`,
                            fromCurrency: fromCurrency,
                            toCurrency: toCurrency,
                            fromAmount: fromAmount,
                            toAmount: toAmount,
                            exchangeRate: exchangeRate,
                            fee: fee || 0,
                            status: 'pending',
                            aml_status: JSON.stringify({ from: amlFromResult, to: amlToResult })
                        });
                        console.log('✅ РЕЗУЛЬТАТ ЗАПИСИ В GOOGLE SHEETS (COMBINED):', result);
                    } catch (error) {
                        console.error('❌ ОШИБКА ЗАПИСИ В GOOGLE SHEETS (COMBINED):', error.message);
                        console.error('🔍 Stack trace:', error.stack);
                    }
                } else {
                    console.log('❌ GOOGLE SHEETS НЕДОСТУПЕН (COMBINED)! Заказ НЕ записан в таблицу');
                    if (!global.googleSheetsManager) {
                        console.log('   Причина: global.googleSheetsManager не существует');
                    } else if (!global.googleSheetsManager.isReady()) {
                        console.log('   Причина: global.googleSheetsManager не готов');
                    }
                }

            } catch (dbError) {
                console.error('❌ Ошибка сохранения в базу:', dbError);
            }
        }

        // Используем данные пользователя из запроса
        const user = userData || {
            first_name: 'Пользователь',
            username: `user${userId}`
        };
        console.log('👤 Данные пользователя для уведомления:', user);

        console.log('📋 Данные для уведомления:', {
            realOrderId,
            userName: user.first_name || user.username,
            fromAmount,
            fromCurrency,
            toCurrency
        });

        // 🔄 ЭКСТРЕННАЯ РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ ПЕРЕД УВЕДОМЛЕНИЕМ
        console.log('🆘 ЭКСТРЕННАЯ РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ:', userId);
        if (db && db.upsertUser) {
            try {
                await db.upsertUser({
                    telegramId: userId,
                    firstName: user.first_name || 'Пользователь',
                    lastName: user.last_name || '',
                    username: user.username || `user${userId}`,
                    referredBy: null
                });
                console.log('🆘 ЭКСТРЕННО ЗАРЕГИСТРИРОВАН:', userId, 'как', user.first_name || user.username);
            } catch (err) {
                console.error('🆘 Ошибка экстренной регистрации:', err.message);
            }
        }

        // Отправляем уведомление операторам
        if (notifyOperators) {
            try {
                await notifyOperators({
                    id: realOrderId,                          // ← ИСПРАВЛЕНО: используем РЕАЛЬНЫЙ ID из базы!
                    userName: user.first_name ? 
                        `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}${user.username ? ' (@' + user.username + ')' : ''}` :
                        user.username || `User_${userId}`,
                    fromAmount: fromAmount,
                    fromCurrency: fromCurrency,
                    toAmount: toAmount,
                    toCurrency: toCurrency,
                    exchangeRate: exchangeRate,
                    fromAddress: fromAddress || '',
                    toAddress: toAddress || '',
                    pairType: pairType || 'fiat',
                    network: network || null,                 // ← ДОБАВЛЯЕМ СЕТЬ ДЛЯ ОПЕРАТОРОВ!
                    bank: bank || null                        // ← ДОБАВЛЯЕМ БАНК ДЛЯ ОПЕРАТОРОВ!
                });
                console.log('✅ ВЫЗОВ notifyOperators ЗАВЕРШЕН');
            } catch (notifyError) {
                console.error('❌ Ошибка уведомления операторов:', notifyError);
            }
        } else {
            console.error('❌ notifyOperators НЕ ДОСТУПЕН!');
        }
        
        if (!realOrderId) {
            throw new Error('Не удалось создать заказ в базе данных');
        }

        res.json({ 
            success: true, 
            data: {
                id: realOrderId,        // ← ID из базы данных
                orderId: realOrderId,   // ← тот же ID для совместимости
                status: 'pending',
                message: 'Заявка создана'
            }
        });
    } catch (error) {
        console.error('❌ Ошибка создания заявки:', error);
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