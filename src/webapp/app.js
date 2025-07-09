// Глобальные переменные
let tg = window.Telegram?.WebApp;
let currentUserId = null;
let currentRates = [];
let fromCurrency = 'BTC';
let toCurrency = 'USDT';
let currentAMLResult = null;
let currentCalculation = null;
let userProfile = null;
let charts = {};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initTelegramWebApp();
    initEventListeners();
    loadInitialData();
});

// Инициализация Telegram Web App
function initTelegramWebApp() {
    if (tg) {
        tg.ready();
        tg.expand();
        
        // Получаем ID пользователя из параметров или Telegram
        const urlParams = new URLSearchParams(window.location.search);
        currentUserId = urlParams.get('user') || tg.initDataUnsafe?.user?.id;
        
        // Настройка темы
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#F2F2F7');
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
        document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#8E8E93');
        document.documentElement.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color || '#007AFF');
        document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#007AFF');
        document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#FFFFFF');
        
        // Настройка кнопок Telegram
        tg.MainButton.hide();
        tg.BackButton.hide();
        
        console.log('✅ Telegram Web App инициализировано');
        console.log('👤 User ID:', currentUserId);
        console.log('👤 User data:', tg.initDataUnsafe?.user);
    } else {
        console.log('⚠️ Telegram Web App недоступно, режим разработки');
        currentUserId = 123456789; // Тестовый ID для разработки
    }
}

// Инициализация обработчиков событий
function initEventListeners() {
    // Навигация
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = item.dataset.screen;
            showScreen(screen);
            
            // Обновляем активную вкладку
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Калькулятор
    const fromAmountInput = document.getElementById('from-amount');
    const toAmountInput = document.getElementById('to-amount');
    
    fromAmountInput.addEventListener('input', calculateExchange);
    toAmountInput.addEventListener('input', reverseCalculateExchange);
    
    // Выбор валют
    document.getElementById('from-currency').addEventListener('click', () => openCurrencyModal('from'));
    document.getElementById('to-currency').addEventListener('click', () => openCurrencyModal('to'));
    
    // Переключение валют
    document.getElementById('swap-currencies').addEventListener('click', swapCurrencies);
    
    // Продолжить обмен
    document.getElementById('continue-button').addEventListener('click', proceedToOrder);
    
    // AML проверка
    document.getElementById('aml-check-button').addEventListener('click', performAMLCheck);
    
    // Создание заявки
    document.getElementById('create-order-button').addEventListener('click', createOrder);
    
    // Поиск валют
    // Поиск валют удален
    
    // Адрес кошелька
    document.getElementById('wallet-address').addEventListener('input', validateWalletAddress);
    
    // Обработчики настроек для немедленного применения
    const themeSelect = document.getElementById('theme-select');
    const languageSelect = document.getElementById('language-select');
    
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            applyTheme(e.target.value);
        });
    }
    
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            applyLanguage(e.target.value);
        });
    }
    
    // Дашборд - переключение периодов
    const chartPeriods = document.querySelectorAll('.chart-period');
    chartPeriods.forEach(button => {
        button.addEventListener('click', () => {
            chartPeriods.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            const period = button.dataset.period;
            loadDashboardData(period);
        });
    });
    
    // Кастомные дропдауны
    initCustomDropdowns();
    
    console.log('✅ Обработчики событий инициализированы');
}

// Загрузка начальных данных
async function loadInitialData() {
    console.log('🚀 Начинаем загрузку начальных данных...');
    showNotification('Загружаем данные приложения...', 'info');
    
    // Загружаем курсы валют (критически важно)
    try {
        await loadExchangeRates();
        console.log('✅ Курсы валют загружены');
    } catch (error) {
        console.error('❌ Ошибка загрузки курсов:', error);
        console.log('ℹ️ Используем тестовые курсы');
    }
    
    // Загружаем профиль пользователя (не критично)
    if (currentUserId) {
        try {
            await loadUserProfile();
            console.log('✅ Попытка загрузки профиля завершена');
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
        }
        
        // Загружаем новости (не критично)
        try {
            await loadNews();
            console.log('✅ Новости загружены');
        } catch (error) {
            console.error('❌ Ошибка загрузки новостей:', error);
        }
    }
    
    // Обновляем отображение профиля с данными из Telegram
    try {
        updateProfileDisplay();
        console.log('✅ Профиль обновлен');
    } catch (error) {
        console.error('❌ Ошибка обновления профиля:', error);
    }
    
    // Обновляем калькулятор
    try {
        calculateExchange();
        console.log('✅ Калькулятор инициализирован');
    } catch (error) {
        console.error('❌ Ошибка инициализации калькулятора:', error);
    }
    
    // Загружаем сохраненные настройки (не критично)
    setTimeout(() => {
        try {
            loadSavedSettings();
            console.log('✅ Настройки загружены');
        } catch (error) {
            console.error('❌ Ошибка загрузки настроек:', error);
        }
    }, 500);
    
    // Скрываем загрузочный экран через фиксированное время
    console.log('🎬 Скрываем загрузочный экран...');
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                if (app) {
                    app.classList.remove('hidden');
                }
                console.log('🎉 Приложение полностью загружено!');
                showNotification('Приложение готово к работе!', 'success');
            }, 300);
        }
    }, 1200); // Сократили время загрузки
}

// Загрузка курсов валют
async function loadExchangeRates() {
    try {
        const response = await fetch('/api/rates');
        const data = await response.json();
        
        if (data.success) {
            currentRates = data.data;
            updateCurrencyList();
            updateRatesTime();
            console.log('✅ Курсы валют загружены:', currentRates.length, 'валют');
        } else {
            throw new Error(data.error || 'Ошибка загрузки курсов');
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки курсов:', error);
        // Используем тестовые курсы
        currentRates = getTestRates();
        updateCurrencyList();
        updateRatesTime();
    }
}

// Тестовые курсы для разработки
function getTestRates() {
    return [
        { currency: 'BTC', buy: 95000, sell: 96000, lastUpdate: new Date().toISOString() },
        { currency: 'ETH', buy: 3500, sell: 3520, lastUpdate: new Date().toISOString() },
        { currency: 'USDT', buy: 1.0, sell: 1.02, lastUpdate: new Date().toISOString() },
        { currency: 'USDC', buy: 1.0, sell: 1.02, lastUpdate: new Date().toISOString() },
        { currency: 'USD', buy: 1.0, sell: 1.0, lastUpdate: new Date().toISOString() },
        { currency: 'EUR', buy: 0.92, sell: 0.94, lastUpdate: new Date().toISOString() },
        { currency: 'RUB', buy: 100, sell: 102, lastUpdate: new Date().toISOString() }
    ];
}

// Обновление времени курсов
function updateRatesTime() {
    const updateTime = document.getElementById('update-time');
    updateTime.textContent = new Date().toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// Расчет обмена
function calculateExchange() {
    const fromAmount = parseFloat(document.getElementById('from-amount').value) || 0;
    
    if (fromAmount <= 0) {
        updateCalculationDisplay(0, 0, 0, 0);
        document.getElementById('continue-button').disabled = true;
        return;
    }
    
    const fromRate = currentRates.find(r => r.currency === fromCurrency);
    const toRate = currentRates.find(r => r.currency === toCurrency);
    
    if (!fromRate || !toRate) {
        console.error('❌ Валютная пара не найдена');
        return;
    }
    
    // Расчет курса обмена
    const exchangeRate = fromRate.sell / toRate.buy;
    const toAmount = fromAmount * exchangeRate;
    const fee = toAmount * 0.01; // 1% комиссия
    const finalAmount = toAmount - fee;
    
    currentCalculation = {
        fromAmount,
        toAmount: finalAmount,
        exchangeRate,
        fee,
        fromCurrency,
        toCurrency
    };
    
    updateCalculationDisplay(fromAmount, finalAmount, exchangeRate, fee);
    document.getElementById('continue-button').disabled = false;
}

// Обратный расчет обмена
function reverseCalculateExchange() {
    const toAmount = parseFloat(document.getElementById('to-amount').value) || 0;
    
    if (toAmount <= 0) {
        document.getElementById('from-amount').value = '';
        calculateExchange();
        return;
    }
    
    const fromRate = currentRates.find(r => r.currency === fromCurrency);
    const toRate = currentRates.find(r => r.currency === toCurrency);
    
    if (!fromRate || !toRate) {
        return;
    }
    
    const exchangeRate = fromRate.sell / toRate.buy;
    const fee = toAmount * 0.01;
    const grossAmount = toAmount + fee;
    const fromAmount = grossAmount / exchangeRate;
    
    document.getElementById('from-amount').value = fromAmount.toFixed(8);
    calculateExchange();
}

// Обновление отображения расчета
function updateCalculationDisplay(fromAmount, toAmount, exchangeRate, fee) {
    document.getElementById('to-amount').value = toAmount.toFixed(8);
    document.getElementById('exchange-rate').textContent = `1 ${fromCurrency} = ${exchangeRate.toFixed(2)} ${toCurrency}`;
    document.getElementById('fee-amount').textContent = `${fee.toFixed(8)} ${toCurrency}`;
    document.getElementById('final-amount').textContent = `${toAmount.toFixed(8)} ${toCurrency}`;
    
    // Обновляем балансы (приблизительные в USD)
    const fromUSD = fromAmount * (currentRates.find(r => r.currency === fromCurrency)?.sell || 1);
    const toUSD = toAmount * (currentRates.find(r => r.currency === toCurrency)?.sell || 1);
    
    document.getElementById('from-balance').textContent = `≈ $${fromUSD.toFixed(2)}`;
    document.getElementById('to-balance').textContent = `≈ $${toUSD.toFixed(2)}`;
}

// Переключение валют
function swapCurrencies() {
    const temp = fromCurrency;
    fromCurrency = toCurrency;
    toCurrency = temp;
    
    document.querySelector('#from-currency .currency-code').textContent = fromCurrency;
    document.querySelector('#to-currency .currency-code').textContent = toCurrency;
    
    // Анимация кнопки
    const swapButton = document.getElementById('swap-currencies');
    swapButton.style.transform = 'rotate(180deg)';
    setTimeout(() => {
        swapButton.style.transform = 'rotate(0deg)';
    }, 300);
    
    calculateExchange();
}

// Открытие модала выбора валюты
let currentCurrencyType = 'from';

function openCurrencyModal(type) {
    currentCurrencyType = type;
    updateCurrencyList();
    document.getElementById('currency-modal').classList.add('active');
}

// Закрытие модала валют
function closeCurrencyModal() {
    document.getElementById('currency-modal').classList.remove('active');
}

// Обновление списка валют
function updateCurrencyList() {
    const currencyList = document.getElementById('currency-list');
    currencyList.innerHTML = '';
    
    currentRates.forEach(rate => {
        const item = document.createElement('div');
        item.className = 'currency-item';
        item.onclick = () => selectCurrency(rate.currency);
        
        const changePercent = Math.random() * 10 - 5; // Фиктивное изменение
        const changeClass = changePercent > 0 ? 'positive' : 'negative';
        const changeIcon = changePercent > 0 ? '+' : '';
        
        item.innerHTML = `
            <div class="currency-info">
                <div class="currency-icon">${rate.currency.substr(0, 2)}</div>
                <div class="currency-details">
                    <h4>${rate.currency}</h4>
                    <p>${getCurrencyName(rate.currency)}</p>
                </div>
            </div>
            <div class="currency-rate">
                <div class="currency-price">$${rate.sell.toFixed(2)}</div>
                <div class="currency-change ${changeClass}">${changeIcon}${Math.abs(changePercent).toFixed(1)}%</div>
            </div>
        `;
        
        currencyList.appendChild(item);
    });
}

// Получение названия валюты
function getCurrencyName(currency) {
    const names = {
        'BTC': 'Bitcoin',
        'ETH': 'Ethereum',
        'USDT': 'Tether',
        'USDC': 'USD Coin',
        'USD': 'US Dollar',
        'EUR': 'Euro',
        'RUB': 'Russian Ruble'
    };
    return names[currency] || currency;
}

// Выбор валюты
function selectCurrency(currency) {
    if (currentCurrencyType === 'from') {
        fromCurrency = currency;
        document.querySelector('#from-currency .currency-code').textContent = currency;
    } else {
        toCurrency = currency;
        document.querySelector('#to-currency .currency-code').textContent = currency;
    }
    
    closeCurrencyModal();
    calculateExchange();
}

// Фильтрация валют
// Функция поиска валют удалена

// Переход к оформлению заявки
function proceedToOrder() {
    if (!currentCalculation) {
        showNotification('Сначала введите сумму для обмена', 'warning');
        return;
    }
    
    // Обновляем сводку заявки
    updateOrderSummary();
    showScreen('order-screen');
    
    // Очищаем предыдущие данные
    document.getElementById('wallet-address').value = '';
    document.getElementById('aml-result').innerHTML = '';
    document.getElementById('create-order-button').disabled = true;
    currentAMLResult = null;
}

// Обновление сводки заявки
function updateOrderSummary() {
    const summary = document.getElementById('order-summary');
    summary.innerHTML = `
        <h3>Сводка обмена</h3>
        <div class="info-row">
            <span>Отдаете</span>
            <span>${currentCalculation.fromAmount} ${currentCalculation.fromCurrency}</span>
        </div>
        <div class="info-row">
            <span>Получаете</span>
            <span>${currentCalculation.toAmount.toFixed(8)} ${currentCalculation.toCurrency}</span>
        </div>
        <div class="info-row">
            <span>Курс обмена</span>
            <span>1 ${currentCalculation.fromCurrency} = ${currentCalculation.exchangeRate.toFixed(2)} ${currentCalculation.toCurrency}</span>
        </div>
        <div class="info-row">
            <span>Комиссия</span>
            <span>${currentCalculation.fee.toFixed(8)} ${currentCalculation.toCurrency}</span>
        </div>
    `;
}

// Валидация адреса кошелька
function validateWalletAddress() {
    const address = document.getElementById('wallet-address').value.trim();
    const amlButton = document.getElementById('aml-check-button');
    
    if (address.length > 20) { // Базовая валидация
        amlButton.disabled = false;
    } else {
        amlButton.disabled = true;
        document.getElementById('create-order-button').disabled = true;
    }
}

// Выполнение AML проверки
async function performAMLCheck() {
    const address = document.getElementById('wallet-address').value.trim();
    
    if (!address) {
        showNotification('Введите адрес кошелька', 'warning');
        return;
    }
    
    const amlButton = document.getElementById('aml-check-button');
    const amlResult = document.getElementById('aml-result');
    
    amlButton.disabled = true;
    amlButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Проверяем...';
    
    try {
        const response = await fetch('/api/aml-check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: address,
                currency: currentCalculation.toCurrency
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentAMLResult = data.data;
            displayAMLResult(currentAMLResult);
            
            if (currentAMLResult.status === 'approved') {
                document.getElementById('create-order-button').disabled = false;
            }
        } else {
            throw new Error(data.error || 'Ошибка AML проверки');
        }
        
    } catch (error) {
        console.error('❌ Ошибка AML проверки:', error);
        showNotification('Ошибка проверки AML. Попробуйте позже.', 'error');
        
        amlResult.innerHTML = `
            <div class="aml-result error">
                <i class="fas fa-exclamation-triangle"></i>
                Ошибка проверки. Обратитесь к оператору.
            </div>
        `;
    } finally {
        amlButton.disabled = false;
        amlButton.innerHTML = '<i class="fas fa-shield-alt"></i> Проверить AML';
    }
}

// Отображение результата AML
function displayAMLResult(result) {
    // Сохраняем результат AML для создания заявки
    currentAMLResult = result;
    
    const amlResult = document.getElementById('aml-result');
    let resultClass = 'success';
    let icon = 'fas fa-check-circle';
    let message = 'Адрес прошел проверку';
    
    if (result.status === 'rejected') {
        resultClass = 'error';
        icon = 'fas fa-times-circle';
        message = 'Адрес заблокирован';
    } else if (result.status === 'manual_review') {
        resultClass = 'warning';
        icon = 'fas fa-exclamation-triangle';
        message = 'Требуется ручная проверка';
    }
    
    amlResult.innerHTML = `
        <div class="aml-result ${resultClass}">
            <i class="${icon}"></i>
            <strong>${message}</strong>
            <p>Риск: ${result.risk} (${result.score}/100)</p>
            ${result.reasons.length > 0 ? `<p>Причины: ${result.reasons.join(', ')}</p>` : ''}
        </div>
    `;
    
    if (result.status === 'rejected') {
        amlResult.innerHTML += `
            <div style="margin-top: 10px;">
                <button class="secondary-button" onclick="contactOperator()">
                    <i class="fas fa-phone"></i> Связаться с оператором
                </button>
            </div>
        `;
    }
}

// Создание заявки
async function createOrder() {
    if (!currentCalculation || !currentAMLResult) {
        showNotification('Завершите все проверки перед созданием заявки', 'warning');
        return;
    }
    
    const address = document.getElementById('wallet-address').value.trim();
    
    if (!address) {
        showNotification('Введите адрес кошелька', 'warning');
        return;
    }
    
    const createButton = document.getElementById('create-order-button');
    createButton.disabled = true;
    createButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создаем заявку...';
    
    try {
        const response = await fetch('/api/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUserId,
                fromCurrency: currentCalculation.fromCurrency,
                toCurrency: currentCalculation.toCurrency,
                fromAmount: currentCalculation.fromAmount,
                toAmount: currentCalculation.toAmount,
                fromAddress: '', // Будет заполнено оператором
                toAddress: address,
                amlResult: currentAMLResult
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Заявка успешно создана!', 'success');
            
            // Показываем информацию о заявке
            if (tg) {
                tg.showAlert(`Заявка #${data.data.id} создана!\n\nОператор свяжется с вами в течение 15 минут.`);
            }
            
            // Возвращаемся на главный экран
            setTimeout(() => {
                showScreen('calculator-screen');
                document.querySelector('.nav-item[data-screen="calculator-screen"]').click();
                
                // Очищаем форму
                document.getElementById('from-amount').value = '';
                document.getElementById('to-amount').value = '';
                calculateExchange();
            }, 2000);
            
        } else {
            throw new Error(data.error || 'Ошибка создания заявки');
        }
        
    } catch (error) {
        console.error('❌ Ошибка создания заявки:', error);
        showNotification('Ошибка создания заявки. Попробуйте позже.', 'error');
    } finally {
        createButton.disabled = false;
        createButton.innerHTML = '<i class="fas fa-check"></i> Создать заявку';
    }
}

// Загрузка профиля пользователя
async function loadUserProfile() {
    try {
        const response = await fetch(`/api/profile/${currentUserId}`);
        const data = await response.json();
        
        if (data.success) {
            userProfile = data.data;
            console.log('✅ Профиль пользователя загружен');
        } else {
            console.log('ℹ️ Профиль не найден, создается новый пользователь');
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки профиля:', error);
        console.log('ℹ️ Продолжаем без профиля пользователя');
    }
}

// Обновление отображения профиля
function updateProfileDisplay() {
    // Получаем данные пользователя из Telegram WebApp API
    const telegramUser = tg?.initDataUnsafe?.user;
    
    // Основная информация (приоритет данным из Telegram)
    const firstName = telegramUser?.first_name || userProfile?.first_name || 'Пользователь';
    const lastName = telegramUser?.last_name || userProfile?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    const username = telegramUser?.username || userProfile?.username || currentUserId;
    
    // Обновляем профиль (если элементы существуют)
    const profileName = document.getElementById('profile-name');
    const profileUsername = document.getElementById('profile-username');
    
    if (profileName) profileName.textContent = fullName;
    if (profileUsername) profileUsername.textContent = `@${username}`;
    
    // Обновляем имя в заголовке
    const headerUserName = document.getElementById('header-user-name');
    if (headerUserName) {
        headerUserName.textContent = firstName; // Используем только имя в заголовке
    }
    
    // Аватар (если есть фото в Telegram, используем его)
    const avatarImg = document.getElementById('avatar-image');
    if (avatarImg) {
        if (telegramUser?.photo_url) {
            console.log('🖼️ Используем аватар из Telegram:', telegramUser.photo_url);
            avatarImg.src = telegramUser.photo_url;
        } else if (userProfile?.avatar) {
            console.log('🖼️ Используем аватар из профиля:', userProfile.avatar);
            avatarImg.src = userProfile.avatar;
        } else {
            console.log('🖼️ Используем аватар по умолчанию');
            // Создаем аватар с инициалами пользователя
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 100;
            canvas.height = 100;
            
            // Фон градиентом
            const gradient = ctx.createLinearGradient(0, 0, 100, 100);
            gradient.addColorStop(0, '#007AFF');
            gradient.addColorStop(1, '#5856D6');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 100, 100);
            
            // Инициалы
            ctx.fillStyle = 'white';
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const initials = firstName.charAt(0) + (lastName ? lastName.charAt(0) : '');
            ctx.fillText(initials.toUpperCase(), 50, 50);
            
            avatarImg.src = canvas.toDataURL();
        }
        
        avatarImg.onerror = () => {
            console.log('❌ Ошибка загрузки аватара, создаем аватар с инициалами');
            // Создаем аватар с инициалами при ошибке
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 100;
            canvas.height = 100;
            
            ctx.fillStyle = '#6B7280';
            ctx.fillRect(0, 0, 100, 100);
            
            ctx.fillStyle = 'white';
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const initials = firstName.charAt(0) + (lastName ? lastName.charAt(0) : '');
            ctx.fillText(initials.toUpperCase(), 50, 50);
            
            avatarImg.src = canvas.toDataURL();
        };
    }
    
    // Статистика в профиле (если userProfile загружен и элементы существуют)
    if (userProfile) {
        const stats = userProfile.stats || {};
        const profileOrders = document.getElementById('profile-orders');
        const profileVolume = document.getElementById('profile-volume');
        
        if (profileOrders) profileOrders.textContent = stats.ordersCount || 0;
        if (profileVolume) profileVolume.textContent = `$${formatNumber(stats.totalVolume || 0)}`;
    }
    
    // Уровень пользователя (всегда показываем, даже для новых)
    const stats = userProfile?.stats || { ordersCount: 0, totalVolume: 0 };
    let level = userProfile?.level;
    
    // Если нет уровня, устанавливаем новичка
    if (!level) {
        level = { 
            level: 'NEWBIE', 
            name: 'Новичок', 
            color: '#6B7280',
            benefits: ['Доступ к базовым функциям', 'Поддержка 24/7']
        };
        console.log('👶 Установлен уровень новичка для пользователя', currentUserId);
    }
    
    updateLevelDisplay(level, stats);
    
    // Реферальная статистика (только если есть userProfile)
    if (userProfile) {
        const referralStats = userProfile.referralStats || {};
        const referralCount = document.getElementById('referral-count');
        const referralEarnings = document.getElementById('referral-earnings');
        
        if (referralCount) referralCount.textContent = referralStats.total_referrals || 0;
        if (referralEarnings) referralEarnings.textContent = `$${formatNumber(referralStats.total_commission || 0)}`;
    }
    
    // Реферальная ссылка (всегда показываем, если есть currentUserId)
    if (currentUserId) {
        const referralLinkInput = document.getElementById('referral-link-input');
        if (referralLinkInput) {
            const botUsername = 'swapcoon_bot'; // Или получить из env
            const referralLink = `https://t.me/${botUsername}?start=${currentUserId}`;
            referralLinkInput.value = referralLink;
        }
    }
}

// Обновление отображения уровня
function updateLevelDisplay(level, stats) {
    console.log('📊 Обновляем отображение уровня:', level, stats);
    
    // В заголовке (если элемент существует)
    const userLevelEl = document.getElementById('user-level');
    if (userLevelEl) {
        userLevelEl.innerHTML = `<span class="level-badge" style="background: ${level.color}">${level.level}</span>`;
    }
    
    // В профиле (если элементы существуют)
    const levelIndicator = document.getElementById('level-indicator');
    if (levelIndicator) {
        levelIndicator.innerHTML = `<span class="level-text">${level.level}</span>`;
    }
    
    const currentLevelEl = document.getElementById('current-level');
    if (currentLevelEl) {
        currentLevelEl.innerHTML = `
            <span class="level-badge" style="background: ${level.color}">${level.level}</span>
            <span class="level-name">${level.name}</span>
        `;
    }
    
    // Прогресс до следующего уровня
    const progress = calculateLevelProgress(level.level, stats);
    
    const progressFill = document.getElementById('level-progress-fill');
    if (progressFill) {
        progressFill.style.width = `${progress.percentage}%`;
    }
    
    const progressDesc = document.getElementById('progress-description');
    if (progressDesc) {
        progressDesc.textContent = progress.description;
    }
    
    const profileProgress = document.getElementById('profile-level-progress');
    if (profileProgress) {
        profileProgress.textContent = `${progress.percentage}%`;
    }
    
    // Следующий уровень
    const nextLevelEl = document.getElementById('next-level');
    if (nextLevelEl) {
        nextLevelEl.innerHTML = `<span>Следующий: ${progress.nextLevel}</span>`;
    }
    
    // Преимущества
    const benefits = level.benefits || ['Доступ к базовым функциям', 'Поддержка 24/7'];
    const benefitsList = benefits.map(benefit => `<li>${benefit}</li>`).join('');
    const levelBenefits = document.getElementById('level-benefits');
    if (levelBenefits) {
        levelBenefits.innerHTML = `
            <h4>Ваши преимущества:</h4>
            <ul>${benefitsList}</ul>
        `;
    }
}

// Расчет прогресса уровня
function calculateLevelProgress(currentLevel, stats) {
    const ordersCount = stats.ordersCount || 0;
    const totalVolume = stats.totalVolume || 0;
    
    let nextLevel, requirement, current, target, percentage, description;
    
    switch (currentLevel) {
        case 'NEWBIE':
            nextLevel = 'ТРЕЙДЕР';
            requirement = 'обменов';
            current = ordersCount;
            target = 5;
            break;
        case 'TRADER':
            nextLevel = 'ПРО';
            requirement = 'обменов';
            current = ordersCount;
            target = 25;
            break;
        case 'PRO':
            nextLevel = 'VIP';
            requirement = 'обменов';
            current = ordersCount;
            target = 100;
            break;
        default:
            nextLevel = 'МАКСИМУМ';
            requirement = '';
            current = target = 1;
    }
    
    percentage = Math.min(100, Math.round((current / target) * 100));
    description = target > current ? 
        `До следующего уровня: ${target - current} ${requirement}` : 
        'Максимальный уровень достигнут!';
    
    return { percentage, description, nextLevel };
}

// Загрузка данных дашборда
async function loadDashboardData(period = '7d') {
    try {
        // Загружаем статистику пользователя
        const statsResponse = await fetch(`/api/stats/${currentUserId}?period=${period}`);
        const statsData = await statsResponse.json();
        
        if (statsData.success) {
            updateDashboardMetrics(statsData.data.summary);
            updateCharts(statsData.data.charts);
        }
        
        // Загружаем рыночные данные
        const marketResponse = await fetch('/api/market-data');
        const marketData = await marketResponse.json();
        
        if (marketData.success) {
            updateMarketData(marketData.data);
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных дашборда:', error);
    }
}

// Обновление метрик дашборда
function updateDashboardMetrics(summary) {
    document.getElementById('total-volume').textContent = `$${formatNumber(summary.totalVolume || 0)}`;
    document.getElementById('total-orders').textContent = summary.totalOrders || 0;
    document.getElementById('total-fees').textContent = `$${formatNumber(summary.totalFees || 0)}`;
    
    if (userProfile?.referralStats) {
        document.getElementById('referral-earnings').textContent = `$${formatNumber(userProfile.referralStats.total_commission || 0)}`;
    }
}

// Обновление графиков
function updateCharts(chartsData) {
    // График объема
    updateChart('volume-chart', {
        type: 'line',
        data: {
            labels: chartsData.volume.labels,
            datasets: [{
                label: 'Объем ($)',
                data: chartsData.volume.data,
                borderColor: '#007AFF',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
    
    // График количества операций
    updateChart('orders-chart', {
        type: 'bar',
        data: {
            labels: chartsData.orders.labels,
            datasets: [{
                label: 'Операции',
                data: chartsData.orders.data,
                backgroundColor: 'rgba(0, 122, 255, 0.8)',
                borderColor: '#007AFF',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// Обновление или создание графика
function updateChart(canvasId, config) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    // Уничтожаем существующий график
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }
    
    // Создаем новый график
    charts[canvasId] = new Chart(ctx, config);
}

// Обновление рыночных данных
function updateMarketData(marketData) {
    const marketGrid = document.getElementById('market-data');
    if (!marketGrid || !marketData.trends) return;
    
    marketGrid.innerHTML = marketData.trends.map(trend => `
        <div class="market-item">
            <div>
                <div class="market-currency">${trend.currency}</div>
                <div class="market-price">${trend.price}</div>
            </div>
            <div class="market-change ${trend.change24h.startsWith('+') ? 'positive' : 'negative'}">
                ${trend.change24h}
            </div>
        </div>
    `).join('');
}

// Загрузка достижений
async function loadAchievements() {
    try {
        const response = await fetch(`/api/achievements/${currentUserId}`);
        const data = await response.json();
        
        if (data.success) {
            updateAchievementsDisplay(data.data);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки достижений:', error);
    }
}

// Обновление отображения достижений
function updateAchievementsDisplay(achievementsData) {
    const earned = achievementsData.earned || [];
    const available = achievementsData.available || [];
    
    // Статистика
    document.getElementById('earned-achievements').textContent = earned.length;
    document.getElementById('total-achievements').textContent = available.length;
    const progress = available.length > 0 ? Math.round((earned.length / available.length) * 100) : 0;
    document.getElementById('achievement-progress').textContent = `${progress}%`;
    
    // Список достижений
    const achievementsGrid = document.getElementById('achievements-grid');
    if (!achievementsGrid) return;
    
    const earnedIds = earned.map(a => a.achievement_id);
    
    achievementsGrid.innerHTML = available.map(achievement => {
        const isEarned = earnedIds.includes(achievement.id);
        return `
            <div class="achievement-card ${isEarned ? 'earned' : 'locked'}">
                ${isEarned ? '<div class="achievement-earned-badge">✓</div>' : ''}
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-description">${achievement.description}</div>
                <div class="achievement-reward">${achievement.reward}</div>
            </div>
        `;
    }).join('');
}

// Загрузка новостей
async function loadNews() {
    try {
        const response = await fetch('/api/news');
        const data = await response.json();
        
        if (data.success) {
            updateNewsDisplay(data.data);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки новостей:', error);
    }
}

// Обновление отображения новостей
function updateNewsDisplay(news) {
    const newsList = document.getElementById('news-list');
    if (!newsList || !news.length) return;
    
    newsList.innerHTML = news.map(item => `
        <div class="news-item">
            <div class="news-header">
                <div>
                    <div class="news-title">${item.title}</div>
                    <div class="news-description">${item.description}</div>
                </div>
                <div class="news-type ${item.type}">${item.type}</div>
            </div>
            <div class="news-date">${formatDate(item.date)}</div>
        </div>
    `).join('');
}

// Сохранение настроек
async function saveSettings() {
    try {
        const settings = {
            notifications_enabled: document.getElementById('notifications-enabled').checked,
            language: document.getElementById('language-select').value,
            theme: document.getElementById('theme-select').value,
            currency_preference: document.getElementById('currency-preference').value,
            privacy_level: document.getElementById('privacy-level').value,
            two_fa_enabled: document.getElementById('two-fa-enabled').checked
        };
        
        const response = await fetch(`/api/profile/${currentUserId}/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Сохраняем настройки локально
            localStorage.setItem('userSettings', JSON.stringify(settings));
            
            // Применяем настройки
            applyTheme(settings.theme);
            applyLanguage(settings.language);
            
            showNotification('Настройки сохранены и применены!', 'success');
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('❌ Ошибка сохранения настроек:', error);
        showNotification('Ошибка сохранения настроек', 'error');
    }
}

// Применение темы
function applyTheme(theme) {
    const root = document.documentElement;
    
    console.log(`🎨 Применение темы: ${theme}`);
    
    if (theme === 'dark') {
        // Темная тема
        root.style.setProperty('--background-color', '#000000');
        root.style.setProperty('--surface-color', '#1C1C1E');
        root.style.setProperty('--text-primary', '#FFFFFF');
        root.style.setProperty('--text-secondary', '#8E8E93');
        root.style.setProperty('--text-tertiary', '#48484A');
        root.style.setProperty('--border-color', '#38383A');
        
        document.body.classList.add('dark-theme');
    } else if (theme === 'light') {
        // Светлая тема
        root.style.setProperty('--background-color', '#F2F2F7');
        root.style.setProperty('--surface-color', '#FFFFFF');
        root.style.setProperty('--text-primary', '#000000');
        root.style.setProperty('--text-secondary', '#8E8E93');
        root.style.setProperty('--text-tertiary', '#C7C7CC');
        root.style.setProperty('--border-color', '#E5E5EA');
        
        document.body.classList.remove('dark-theme');
    } else {
        // Авто тема (следует системной)
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');
    }
    
    // Обновляем цвета Telegram WebApp
    if (tg) {
        tg.setHeaderColor(theme === 'dark' ? '#1C1C1E' : '#007AFF');
        tg.setBackgroundColor(theme === 'dark' ? '#000000' : '#F2F2F7');
    }
}

// Применение языка
function applyLanguage(language) {
    console.log(`🌐 Применение языка: ${language}`);
    
    if (language === 'en') {
        // Английские переводы
        updateText('Главная', 'Main');
        updateText('Дашборд', 'Dashboard');
        updateText('История', 'History');
        updateText('Профиль', 'Profile');
        updateText('Настройки', 'Settings');
        updateText('Обмен валют', 'Currency Exchange');
        updateText('Сумма', 'Amount');
        updateText('Продолжить', 'Continue');
        updateText('Создать заявку', 'Create Order');
        updateText('Сохранить настройки', 'Save Settings');
        
        // Обновляем плейсхолдеры
        const amountInput = document.getElementById('from-amount');
        if (amountInput) amountInput.placeholder = 'Enter amount';
        
    } else {
        // Русские переводы (по умолчанию)
        updateText('Main', 'Главная');
        updateText('Dashboard', 'Дашборд');
        updateText('History', 'История');
        updateText('Profile', 'Профиль');
        updateText('Settings', 'Настройки');
        updateText('Currency Exchange', 'Обмен валют');
        updateText('Amount', 'Сумма');
        updateText('Continue', 'Продолжить');
        updateText('Create Order', 'Создать заявку');
        updateText('Save Settings', 'Сохранить настройки');
        
        const amountInput = document.getElementById('from-amount');
        if (amountInput) amountInput.placeholder = 'Введите сумму';
    }
}

// Обновление текста элементов
function updateText(oldText, newText) {
    const elements = document.querySelectorAll('*');
    elements.forEach(element => {
        if (element.children.length === 0 && element.textContent.trim() === oldText) {
            element.textContent = newText;
        }
    });
}

// Загрузка сохраненных настроек
function loadSavedSettings() {
    try {
        const savedSettings = localStorage.getItem('userSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            console.log('📋 Загружаем сохраненные настройки:', settings);
            
            // Применяем настройки безопасно
            if (settings.theme) {
                const themeSelect = document.getElementById('theme-select');
                if (themeSelect) {
                    themeSelect.value = settings.theme;
                }
                applyTheme(settings.theme);
            }
            
            if (settings.language) {
                const languageSelect = document.getElementById('language-select');
                if (languageSelect) {
                    languageSelect.value = settings.language;
                }
                applyLanguage(settings.language);
            }
            
            if (settings.notifications_enabled !== undefined) {
                const notificationsToggle = document.getElementById('notifications-enabled');
                if (notificationsToggle) {
                    notificationsToggle.checked = settings.notifications_enabled;
                }
            }
            
            if (settings.currency_preference) {
                const currencySelect = document.getElementById('currency-preference');
                if (currencySelect) {
                    currencySelect.value = settings.currency_preference;
                }
            }
            
            if (settings.privacy_level) {
                const privacySelect = document.getElementById('privacy-level');
                if (privacySelect) {
                    privacySelect.value = settings.privacy_level;
                }
            }
            
            if (settings.two_fa_enabled !== undefined) {
                const twoFaToggle = document.getElementById('two-fa-enabled');
                if (twoFaToggle) {
                    twoFaToggle.checked = settings.two_fa_enabled;
                }
            }
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки настроек:', error);
    }
}

// Экспорт данных
function exportData() {
    if (tg) {
        tg.showAlert('Функция экспорта данных будет доступна в ближайшее время!');
    } else {
        alert('Функция экспорта данных будет доступна в ближайшее время!');
    }
}

// Копирование реферальной ссылки
function copyReferralLink() {
    const linkInput = document.getElementById('referral-link-input');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999); // Для мобильных устройств
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(linkInput.value).then(() => {
            showNotification('Ссылка скопирована!', 'success');
        });
    } else {
        document.execCommand('copy');
        showNotification('Ссылка скопирована!', 'success');
    }
}

// Глобальные переменные для фильтров
let currentStatusFilter = '';
let currentPeriodFilter = 'all';

// Инициализация кастомных дропдаунов
function initCustomDropdowns() {
    const dropdowns = document.querySelectorAll('.custom-dropdown');
    
    dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.dropdown-trigger');
        const items = dropdown.querySelectorAll('.dropdown-item');
        
        // Устанавливаем первый элемент как выбранный по умолчанию
        const firstItem = items[0];
        if (firstItem) {
            firstItem.classList.add('selected');
        }
        
        // Клик по триггеру
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns();
            dropdown.classList.toggle('active');
        });
        
        // Клик по элементу
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                selectDropdownItem(dropdown, item);
                dropdown.classList.remove('active');
            });
        });
    });
    
    // Закрытие при клике вне дропдауна
    document.addEventListener('click', closeAllDropdowns);
}

// Выбор элемента дропдауна
function selectDropdownItem(dropdown, selectedItem) {
    const trigger = dropdown.querySelector('.dropdown-trigger');
    const valueSpan = trigger.querySelector('.dropdown-value');
    const items = dropdown.querySelectorAll('.dropdown-item');
    
    // Убираем выделение с других элементов
    items.forEach(item => item.classList.remove('selected'));
    
    // Выделяем выбранный элемент
    selectedItem.classList.add('selected');
    
    // Обновляем текст в триггере
    const newText = selectedItem.querySelector('span').textContent;
    valueSpan.textContent = newText;
    
    // Сохраняем значение
    const value = selectedItem.dataset.value;
    if (dropdown.id === 'status-dropdown') {
        currentStatusFilter = value;
    } else if (dropdown.id === 'period-dropdown') {
        currentPeriodFilter = value;
    }
    
    // Применяем фильтрацию
    filterHistory();
}

// Закрытие всех дропдаунов
function closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.custom-dropdown');
    dropdowns.forEach(dropdown => {
        dropdown.classList.remove('active');
    });
}

// Фильтрация истории
function filterHistory() {
    // Здесь можно добавить логику фильтрации
    console.log('Фильтры истории:', { 
        status: currentStatusFilter, 
        period: currentPeriodFilter 
    });
    loadHistory();
}

// Обновление заголовка с уровнем
function updateHeaderLevel() {
    if (userProfile?.level) {
        const levelBadge = document.querySelector('#user-level .level-badge');
        if (levelBadge) {
            levelBadge.textContent = userProfile.level.level;
            levelBadge.style.background = userProfile.level.color;
        }
    }
}

// Переключение экранов с дополнительной логикой
function showScreen(screenId) {
    // Скрываем все экраны
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    // Показываем нужный экран
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        
        // Дополнительная логика для конкретных экранов
        if (screenId === 'history-screen') {
            loadHistory();
        } else if (screenId === 'profile-screen' && currentUserId) {
            loadUserProfile();
        } else if (screenId === 'dashboard-screen') {
            loadDashboardData();
        } else if (screenId === 'achievements-screen') {
            loadAchievements();
        } else if (screenId === 'browser-screen') {
            loadNews();
        }
    }
}

// Вспомогательные функции
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(2);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Загрузка истории операций
async function loadHistory() {
    if (!currentUserId) return;
    
    try {
        const response = await fetch(`/api/history/${currentUserId}`);
        const data = await response.json();
        
        if (data.success) {
            displayHistory(data.data);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки истории:', error);
        displayHistory([]);
    }
}

// Отображение истории
function displayHistory(history) {
    const historyContent = document.getElementById('history-content');
    
    if (history.length === 0) {
        historyContent.innerHTML = `
            <div class="coming-soon">
                <i class="fas fa-history"></i>
                <h3>История пуста</h3>
                <p>Ваши обмены будут отображаться здесь</p>
            </div>
        `;
        return;
    }
    
    historyContent.innerHTML = history.map(order => `
        <div class="history-item">
            <div class="history-header">
                <div class="history-pair">${order.from_currency} → ${order.to_currency}</div>
                <div class="history-date">${new Date(order.created_at_local).toLocaleDateString('ru-RU')}</div>
            </div>
            <div class="history-details">
                <div class="history-detail">
                    <span>Отдал:</span>
                    <span>${order.from_amount} ${order.from_currency}</span>
                </div>
                <div class="history-detail">
                    <span>Получил:</span>
                    <span>${order.to_amount} ${order.to_currency}</span>
                </div>
                <div class="history-detail">
                    <span>Курс:</span>
                    <span>${order.exchange_rate?.toFixed(4) || 'N/A'}</span>
                </div>
                <div class="history-detail">
                    <span>Комиссия:</span>
                    <span>${order.fee || 0} ${order.to_currency}</span>
                </div>
            </div>
            <div class="history-status ${order.status}">
                ${getStatusText(order.status)}
            </div>
        </div>
    `).join('');
}

// Получение текста статуса
function getStatusText(status) {
    const statuses = {
        'pending': 'Ожидает',
        'processing': 'В обработке',
        'completed': 'Завершен',
        'failed': 'Отклонен',
        'cancelled': 'Отменен'
    };
    return statuses[status] || status;
}

// Связь с оператором
function contactOperator() {
    // Создаем заявку через API (работает и в Telegram и в браузере)
    createSupportTicket();
}

// Создание заявки в поддержку (для браузера)
async function createSupportTicket() {
    try {
        if (!currentUserId) {
            showNotification('Ошибка: пользователь не авторизован', 'error');
            return;
        }
        
        showNotification('Создаем заявку в поддержку...', 'info');
        
        const response = await fetch('/api/support-ticket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUserId,
                source: tg ? 'webapp_telegram' : 'webapp_browser',
                message: 'Пользователь запросил помощь через WebApp',
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Заявка создана! Мы свяжемся с вами в ближайшее время.', 'success');
            console.log('✅ Тикет поддержки создан:', data.data);
        } else {
            throw new Error(data.error || 'Ошибка создания заявки');
        }
        
    } catch (error) {
        console.error('❌ Ошибка создания заявки в поддержку:', error);
        showNotification('Ошибка создания заявки. Пишите @SwapCoonSupport', 'error');
        
        // Откатываемся к старому способу
        if (window && window.open) {
            setTimeout(() => {
                window.open('https://t.me/SwapCoonSupport', '_blank');
            }, 1000);
        }
    }
}

// Сканирование QR кода
function scanQR() {
    if (tg && tg.showScanQrPopup) {
        tg.showScanQrPopup({
            text: 'Отсканируйте QR код кошелька'
        }, (result) => {
            document.getElementById('wallet-address').value = result;
            validateWalletAddress();
            tg.closeScanQrPopup();
        });
    } else {
        showNotification('Сканирование QR недоступно', 'warning');
    }
}

// Показ уведомлений
function showNotification(message, type = 'info') {
    const notifications = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notifications.appendChild(notification);
    
    // Автоудаление уведомления
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
    
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
}

// Обновление курсов каждые 30 секунд
setInterval(() => {
    loadExchangeRates();
}, 30000);

console.log('✅ SwapCoon App загружено успешно!'); 