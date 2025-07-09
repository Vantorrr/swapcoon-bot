// === ОБРАБОТЧИКИ СИСТЕМЫ РЕКВИЗИТОВ ===

// Отправка конкретного криптоадреса
function setupCryptoHandlers(bot, paymentDetails, chatContexts) {
    Object.keys(paymentDetails.crypto).forEach(key => {
        bot.callbackQuery(`send_crypto_${key}`, async (ctx) => {
            const detail = paymentDetails.crypto[key];
            
            // Запрашиваем ID клиента
            chatContexts.set(ctx.from.id, {
                action: 'send_crypto_details',
                detailKey: key,
                detail: detail
            });
            
            await ctx.editMessageText(
                `${detail.icon} <b>Отправка ${detail.name}</b>\n\n` +
                `Адрес: <code>${detail.address}</code>\n` +
                `Комиссия: ${detail.fee}\n\n` +
                `💬 Напишите ID клиента (или перешлите сообщение от клиента) для отправки этих реквизитов:`,
                { parse_mode: 'HTML' }
            );
            
            await ctx.answerCallbackQuery(`Выбран ${detail.name}. Укажите ID клиента.`);
        });
    });
}

// Отправка конкретного банковского реквизита
function setupBankHandlers(bot, paymentDetails, chatContexts) {
    Object.keys(paymentDetails.banks).forEach(key => {
        bot.callbackQuery(`send_bank_${key}`, async (ctx) => {
            const detail = paymentDetails.banks[key];
            
            // Запрашиваем ID клиента
            chatContexts.set(ctx.from.id, {
                action: 'send_bank_details',
                detailKey: key,
                detail: detail
            });
            
            await ctx.editMessageText(
                `${detail.icon} <b>Отправка реквизитов ${detail.name}</b>\n\n` +
                `Карта: <code>${detail.card}</code>\n` +
                `Владелец: ${detail.holder}\n\n` +
                `💬 Напишите ID клиента (или перешлите сообщение от клиента) для отправки этих реквизитов:`,
                { parse_mode: 'HTML' }
            );
            
            await ctx.answerCallbackQuery(`Выбран ${detail.name}. Укажите ID клиента.`);
        });
    });
}

// Кнопка "Назад в главное меню"
function setupBackButton(bot, createMainKeyboard) {
    bot.callbackQuery('back_to_main', async (ctx) => {
        await ctx.answerCallbackQuery();
        
        const userId = ctx.from.id;
        const keyboard = await createMainKeyboard(userId);
        
        await ctx.editMessageText(
            `🦝 <b>SwapCoon</b> - Главное меню\n\n` +
            `Выберите действие:`,
            {
                parse_mode: 'HTML',
                reply_markup: keyboard
            }
        );
    });
}

// === ФУНКЦИИ ОТПРАВКИ РЕКВИЗИТОВ ===

// Функция отправки криптореквизитов клиенту
async function handleSendCryptoDetails(ctx, context, bot) {
    const clientIdText = ctx.message.text.trim();
    const clientId = parseInt(clientIdText);
    
    if (isNaN(clientId)) {
        return ctx.reply('❌ Неверный формат ID клиента. Введите числовой ID.');
    }
    
    await sendCryptoDetailsToClient(ctx, clientId, context.detail, bot);
}

async function sendCryptoDetailsToClient(ctx, clientId, detail, bot) {
    try {
        const message = 
            `💳 <b>Реквизиты для пополнения</b>\n\n` +
            `${detail.icon} <b>${detail.name}</b>\n\n` +
            `📍 <b>Адрес:</b>\n<code>${detail.address}</code>\n\n` +
            `💰 <b>Комиссия сети:</b> ${detail.fee}\n` +
            `📝 <b>Описание:</b> ${detail.description}\n\n` +
            `⚠️ <b>Внимание:</b>\n` +
            `• Отправляйте только USDT в сети ${detail.name}\n` +
            `• Проверьте адрес перед отправкой\n` +
            `• Минимальная сумма: $10\n\n` +
            `📞 После отправки уведомите оператора`;
        
        await bot.api.sendMessage(clientId, message, { 
            parse_mode: 'HTML'
        });
        
        await ctx.reply(`✅ Реквизиты ${detail.name} отправлены клиенту ${clientId}`);
        
    } catch (error) {
        console.error('Ошибка отправки реквизитов:', error);
        await ctx.reply(`❌ Ошибка отправки реквизитов клиенту ${clientId}. Возможно, он заблокировал бота.`);
    }
}

// Функция отправки банковских реквизитов клиенту
async function handleSendBankDetails(ctx, context, bot) {
    const clientIdText = ctx.message.text.trim();
    const clientId = parseInt(clientIdText);
    
    if (isNaN(clientId)) {
        return ctx.reply('❌ Неверный формат ID клиента. Введите числовой ID.');
    }
    
    await sendBankDetailsToClient(ctx, clientId, context.detail, bot);
}

async function sendBankDetailsToClient(ctx, clientId, detail, bot) {
    try {
        const message = 
            `💳 <b>Банковские реквизиты</b>\n\n` +
            `${detail.icon} <b>${detail.name}</b>\n\n` +
            `💳 <b>Номер карты:</b>\n<code>${detail.card}</code>\n\n` +
            `👤 <b>Владелец:</b> ${detail.holder}\n` +
            `📝 <b>Описание:</b> ${detail.description}\n\n` +
            `⚠️ <b>Инструкция:</b>\n` +
            `• Переводите точную сумму\n` +
            `• Сохраните чек об оплате\n` +
            `• Уведомите оператора после перевода\n\n` +
            `📞 Связь: Напишите оператору после оплаты`;
        
        await bot.api.sendMessage(clientId, message, { 
            parse_mode: 'HTML'
        });
        
        await ctx.reply(`✅ Банковские реквизиты ${detail.name} отправлены клиенту ${clientId}`);
        
    } catch (error) {
        console.error('Ошибка отправки реквизитов:', error);
        await ctx.reply(`❌ Ошибка отправки реквизитов клиенту ${clientId}. Возможно, он заблокировал бота.`);
    }
}

// Функция отправки всех реквизитов клиенту
async function handleSendAllDetails(ctx, paymentDetails, bot) {
    const clientIdText = ctx.message.text.trim();
    const clientId = parseInt(clientIdText);
    
    if (isNaN(clientId)) {
        return ctx.reply('❌ Неверный формат ID клиента. Введите числовой ID.');
    }
    
    await sendAllDetailsToClient(ctx, clientId, paymentDetails, bot);
}

async function sendAllDetailsToClient(ctx, clientId, paymentDetails, bot) {
    try {
        // Формируем сообщение со всеми реквизитами
        let message = `📜 <b>Все доступные реквизиты</b>\n\n`;
        
        // Криптовалютные адреса
        message += `💰 <b>КРИПТОВАЛЮТЫ:</b>\n\n`;
        Object.keys(paymentDetails.crypto).forEach(key => {
            const detail = paymentDetails.crypto[key];
            message += `${detail.icon} <b>${detail.name}</b>\n`;
            message += `<code>${detail.address}</code>\n`;
            message += `Комиссия: ${detail.fee}\n\n`;
        });
        
        // Банковские карты
        message += `🏦 <b>БАНКОВСКИЕ КАРТЫ:</b>\n\n`;
        Object.keys(paymentDetails.banks).forEach(key => {
            const detail = paymentDetails.banks[key];
            message += `${detail.icon} <b>${detail.name}</b>\n`;
            message += `<code>${detail.card}</code>\n`;
            message += `Владелец: ${detail.holder}\n\n`;
        });
        
        message += `📢 <b>Дополнительные адреса по запросу</b>\n\n`;
        message += `⚠️ <b>ВАЖНО:</b>\n`;
        message += `• Адреса копируются коротким нажатием\n`;
        message += `• Проверяйте сеть перед отправкой\n`;
        message += `• Уведомляйте оператора о платеже\n\n`;
        message += `📞 Поддержка: @swapcoon_support`;
        
        await bot.api.sendMessage(clientId, message, { 
            parse_mode: 'HTML'
        });
        
        await ctx.reply(`✅ Все реквизиты отправлены клиенту ${clientId}`);
        
    } catch (error) {
        console.error('Ошибка отправки всех реквизитов:', error);
        await ctx.reply(`❌ Ошибка отправки реквизитов клиенту ${clientId}. Возможно, он заблокировал бота.`);
    }
}

// Обработка пересланных сообщений от операторов
function handleForwardedMessage(ctx, chatContexts, paymentDetails, bot, db) {
    const userId = ctx.from.id;
    
    if (chatContexts.has(userId)) {
        const clientId = ctx.message.forward_from?.id;
        
        if (!clientId) {
            return ctx.reply('❌ Не удалось получить ID клиента из пересланного сообщения');
        }
        
        const context = chatContexts.get(userId);
        
        if (context.action === 'send_crypto_details') {
            sendCryptoDetailsToClient(ctx, clientId, context.detail, bot);
        } else if (context.action === 'send_bank_details') {
            sendBankDetailsToClient(ctx, clientId, context.detail, bot);
        } else if (context.action === 'send_all_details') {
            sendAllDetailsToClient(ctx, clientId, paymentDetails, bot);
        }
        
        chatContexts.delete(userId);
        return true;
    }
    return false;
}

// Обработка текстовых сообщений от операторов для реквизитов
function handleOperatorMessage(ctx, chatContexts, paymentDetails, bot, db) {
    const userId = ctx.from.id;
    
    if (chatContexts.has(userId)) {
        const context = chatContexts.get(userId);
        
        if (context.action === 'send_crypto_details') {
            handleSendCryptoDetails(ctx, context, bot);
        } else if (context.action === 'send_bank_details') {
            handleSendBankDetails(ctx, context, bot);
        } else if (context.action === 'send_all_details') {
            handleSendAllDetails(ctx, paymentDetails, bot);
        }
        
        chatContexts.delete(userId);
        return true;
    }
    return false;
}

module.exports = {
    setupCryptoHandlers,
    setupBankHandlers, 
    setupBackButton,
    handleSendCryptoDetails,
    handleSendBankDetails,
    handleSendAllDetails,
    handleForwardedMessage,
    handleOperatorMessage
}; 