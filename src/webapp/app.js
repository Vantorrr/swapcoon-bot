// Глобальные переменные
let tg = window.Telegram?.WebApp;
let currentUserId = null;
let currentRates = [];
let fromCurrency = 'BTC';
let toCurrency = 'USDT';
let currentAMLResult = null;
let currentFromAMLResult = null;
let currentToAMLResult = null;
let currentCalculation = null;
let userProfile = null;
let charts = {};
let favoriteCurrencies = [];
let currentBank = null;
let currentNetwork = null;
let pendingCurrencySelection = null;

// Функции для работы с избранными валютами
function loadFavorites() {
    try {
        const saved = localStorage.getItem('favoriteCurrencies');
        favoriteCurrencies = saved ? JSON.parse(saved) : ['BTC', 'USDT', 'RUB'];
        console.log('✅ Избранные валюты загружены:', favoriteCurrencies);
    } catch (error) {
        console.error('❌ Ошибка загрузки избранных валют:', error);
        favoriteCurrencies = ['BTC', 'USDT', 'RUB']; // По умолчанию
    }
}

function saveFavorites() {
    try {
        localStorage.setItem('favoriteCurrencies', JSON.stringify(favoriteCurrencies));
        console.log('✅ Избранные валюты сохранены:', favoriteCurrencies);
    } catch (error) {
        console.error('❌ Ошибка сохранения избранных валют:', error);
    }
}

function toggleFavorite(currency) {
    const index = favoriteCurrencies.indexOf(currency);
    if (index === -1) {
        favoriteCurrencies.push(currency);
        showNotification(`${currency} добавлено в избранное ⭐️`, 'success');
    } else {
        favoriteCurrencies.splice(index, 1);
        showNotification(`${currency} удалено из избранного`, 'info');
    }
    saveFavorites();
    updateCurrencyList(); // Обновляем список
}

function isFavorite(currency) {
    return favoriteCurrencies.includes(currency);
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initTelegramWebApp();
    initEventListeners();
    loadFavorites(); // Загружаем избранные валюты
    loadInitialData();
});

// Инициализация Telegram Web App
function initTelegramWebApp() {
    try {
        if (tg && typeof tg.ready === 'function') {
            tg.ready();
            
            // Безопасная проверка expand
            if (typeof tg.expand === 'function') {
                tg.expand();
            }
            
            // Получаем ID пользователя из параметров или Telegram
            const urlParams = new URLSearchParams(window.location.search);
            currentUserId = urlParams.get('user') || tg.initDataUnsafe?.user?.id;
            
            // Безопасная настройка темы
            if (tg.themeParams) {
                document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#F2F2F7');
                document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
                document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#8E8E93');
                document.documentElement.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color || '#007AFF');
                document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#007AFF');
                document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#FFFFFF');
            }
            
            // Безопасная настройка кнопок Telegram
            if (tg.MainButton && typeof tg.MainButton.hide === 'function') {
                tg.MainButton.hide();
            }
            if (tg.BackButton && typeof tg.BackButton.hide === 'function') {
                tg.BackButton.hide();
            }
            
            console.log('✅ Telegram Web App инициализировано');
            console.log('👤 User ID:', currentUserId);
            console.log('👤 User data:', tg.initDataUnsafe?.user);
        } else {
            console.log('⚠️ Telegram Web App недоступно, режим разработки');
            const urlParams = new URLSearchParams(window.location.search);
            currentUserId = urlParams.get('user') || 123456789; // Тестовый ID для разработки
        }
    } catch (error) {
        console.error('❌ Ошибка инициализации Telegram Web App:', error);
        console.log('🔄 Переключение в режим разработки');
        const urlParams = new URLSearchParams(window.location.search);
        currentUserId = urlParams.get('user') || 123456789;
    }
    
    // Дополнительная проверка и установка userId если он не определен
    if (!currentUserId) {
        console.log('⚠️ userId не определен, устанавливаем тестовый ID');
        currentUserId = 123456789; // Тестовый ID для разработки
    }
    
    console.log('🔑 Финальный User ID:', currentUserId);
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
        { currency: 'BTC', buy: 95000, sell: 96000, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'ETH', buy: 3500, sell: 3520, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'USDT', buy: 1.0, sell: 1.02, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'USDC', buy: 1.0, sell: 1.02, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'USD', buy: 1.0, sell: 1.0, lastUpdate: new Date().toISOString(), type: 'fiat' },
        { currency: 'EUR', buy: 0.92, sell: 0.94, lastUpdate: new Date().toISOString(), type: 'fiat' },
        { currency: 'RUB', buy: 0.0098, sell: 0.0102, lastUpdate: new Date().toISOString(), type: 'fiat' },
        { currency: 'ARS', buy: 0.00098, sell: 0.00102, lastUpdate: new Date().toISOString(), type: 'fiat' },
        { currency: 'BRL', buy: 0.194, sell: 0.206, lastUpdate: new Date().toISOString(), type: 'fiat' }
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
    const fee = 0; // Комиссия убрана
    const finalAmount = toAmount;
    
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
    const fee = 0; // Комиссия убрана
    const grossAmount = toAmount; // Без комиссии
    const fromAmount = grossAmount / exchangeRate;
    
    document.getElementById('from-amount').value = fromAmount.toFixed(8);
    calculateExchange();
}

// Обновление отображения расчета
function updateCalculationDisplay(fromAmount, toAmount, exchangeRate, fee) {
    document.getElementById('to-amount').value = toAmount.toFixed(8);
    document.getElementById('exchange-rate').textContent = `1 ${fromCurrency} = ${exchangeRate.toFixed(2)} ${toCurrency}`;
    document.getElementById('final-amount').textContent = `${toAmount.toFixed(8)} ${toCurrency}`;
}

// Переключение валют
function swapCurrencies() {
    const temp = fromCurrency;
    fromCurrency = toCurrency;
    toCurrency = temp;
    
    // Обновляем кнопки валют
    const fromButton = document.querySelector('#from-currency');
    const toButton = document.querySelector('#to-currency');
    
    fromButton.querySelector('.currency-name').textContent = fromCurrency;
    fromButton.querySelector('.currency-desc').textContent = getCurrencyName(fromCurrency);
    fromButton.querySelector('.currency-icon').textContent = getCurrencyIcon(fromCurrency);
    
    toButton.querySelector('.currency-name').textContent = toCurrency;
    toButton.querySelector('.currency-desc').textContent = getCurrencyName(toCurrency);
    toButton.querySelector('.currency-icon').textContent = getCurrencyIcon(toCurrency);
    
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
    
    // Разделяем валюты на избранные и обычные
    const favorites = currentRates.filter(rate => isFavorite(rate.currency));
    const others = currentRates.filter(rate => !isFavorite(rate.currency));
    
    // Добавляем заголовок избранных (если есть)
    if (favorites.length > 0) {
        const favoritesHeader = document.createElement('div');
        favoritesHeader.className = 'currency-section-header';
        favoritesHeader.innerHTML = `
            <h4><i class="fas fa-star" style="color: #FFD700;"></i> Избранные</h4>
        `;
        currencyList.appendChild(favoritesHeader);
        
        // Добавляем избранные валюты
        favorites.forEach(rate => {
            currencyList.appendChild(createCurrencyItem(rate, true));
        });
        
        // Разделитель
        if (others.length > 0) {
            const separator = document.createElement('div');
            separator.className = 'currency-section-header';
            separator.innerHTML = `<h4><i class="fas fa-list"></i> Все валюты</h4>`;
            currencyList.appendChild(separator);
        }
    }
    
    // Добавляем остальные валюты
    others.forEach(rate => {
        currencyList.appendChild(createCurrencyItem(rate, false));
    });
}

// Создание элемента валюты
function createCurrencyItem(rate, isFav) {
    const item = document.createElement('div');
    item.className = 'currency-item';
    
    const changePercent = rate.change24h || 0;
    const changeClass = changePercent > 0 ? 'positive' : 'negative';
    const changeIcon = changePercent > 0 ? '+' : '';
    
    // Форматируем цену в зависимости от типа валюты
    let priceDisplay;
    if (rate.type === 'fiat' && rate.currency !== 'USD') {
        priceDisplay = `$${rate.price.toFixed(4)}`;
    } else if (rate.price >= 1000) {
        priceDisplay = `$${rate.price.toLocaleString()}`;
    } else if (rate.price >= 1) {
        priceDisplay = `$${rate.price.toFixed(2)}`;
    } else {
        priceDisplay = `$${rate.price.toFixed(6)}`;
    }

    item.innerHTML = `
        <div class="currency-info" onclick="selectCurrency('${rate.currency}')">
            <div class="currency-icon">${rate.currency.substr(0, 2)}</div>
            <div class="currency-details">
                <h4>${rate.currency}</h4>
                <p>${getCurrencyName(rate.currency)}</p>
            </div>
        </div>
        <div class="currency-actions">
            <div class="currency-rate">
                <div class="currency-price">${priceDisplay}</div>
                <div class="currency-change ${changeClass}">${changeIcon}${Math.abs(changePercent).toFixed(1)}%</div>
            </div>
            <button class="favorite-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${rate.currency}')" title="${isFav ? 'Удалить из избранного' : 'Добавить в избранное'}">
                <i class="fas fa-star"></i>
            </button>
        </div>
    `;
    
    return item;
}

// Получение названия валюты
function getCurrencyName(currency) {
    const names = {
        'BTC': 'Bitcoin',
        'ETH': 'Ethereum',
        'USDT': 'Tether',
        'USDC': 'USD Coin',
        'BNB': 'Binance Coin',
        'SOL': 'Solana',
        'ADA': 'Cardano',
        'DOT': 'Polkadot',
        'MATIC': 'Polygon',
        'AVAX': 'Avalanche',
        'USD': 'US Dollar',
        'EUR': 'Euro',
        'RUB': 'Russian Ruble',
        'UAH': 'Ukrainian Hryvnia',
        'KZT': 'Kazakhstani Tenge',
        'ARS': 'Argentine Peso',
        'BRL': 'Brazilian Real'
    };
    return names[currency] || currency;
}

// Получение иконки валюты
function getCurrencyIcon(currency) {
    const icons = {
        'BTC': '₿',
        'ETH': '⟠',
        'USDT': '💵',
        'USDC': '💵',
        'BNB': '🟡',
        'SOL': '☀️',
        'ADA': '🔷',
        'DOT': '⚫',
        'MATIC': '🟣',
        'AVAX': '🏔️',
        'USD': '💵',
        'EUR': '💶',
        'RUB': '₽',
        'UAH': '₴',
        'KZT': '₸',
        'ARS': '💰',
        'BRL': '💰'
    };
    return icons[currency] || '🪙';
}

// Выбор валюты
function selectCurrency(currency) {
    // Сохраняем тип валюты и валюту для дальнейшей обработки
    pendingCurrencySelection = {
        type: currentCurrencyType,
        currency: currency
    };
    
    // Если это рубли - показываем выбор банка
    if (currency === 'RUB') {
        closeCurrencyModal();
        openBankModal();
        return;
    }
    
    // Если это USDT - показываем выбор сети
    if (currency === 'USDT') {
        closeCurrencyModal();
        openNetworkModal();
        return;
    }
    
    // Для остальных валют - обычная логика
    finalizeCurrencySelection(currency);
}

// Завершение выбора валюты
function finalizeCurrencySelection(currency, additionalInfo = null) {
    const currencyType = pendingCurrencySelection?.type || currentCurrencyType;
    
    if (currencyType === 'from') {
        fromCurrency = currency;
        let displayText = currency;
        let desc = getCurrencyName(currency);
        if (additionalInfo) {
            displayText += ` (${additionalInfo})`;
            desc = additionalInfo;
        }
        
        const button = document.querySelector('#from-currency');
        button.querySelector('.currency-name').textContent = displayText;
        button.querySelector('.currency-desc').textContent = desc;
        button.querySelector('.currency-icon').textContent = getCurrencyIcon(currency);
    } else {
        toCurrency = currency;
        let displayText = currency;
        let desc = getCurrencyName(currency);
        if (additionalInfo) {
            displayText += ` (${additionalInfo})`;
            desc = additionalInfo;
        }
        
        const button = document.querySelector('#to-currency');
        button.querySelector('.currency-name').textContent = displayText;
        button.querySelector('.currency-desc').textContent = desc;
        button.querySelector('.currency-icon').textContent = getCurrencyIcon(currency);
    }
    
    // Сбрасываем состояние
    pendingCurrencySelection = null;
    
    closeCurrencyModal();
    calculateExchange();
}

// Модальные окна банков
function openBankModal() {
    document.getElementById('bank-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeBankModal() {
    document.getElementById('bank-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function selectBank(bank) {
    currentBank = bank;
    finalizeCurrencySelection('RUB', bank);
    closeBankModal();
}

// Модальные окна сетей
function openNetworkModal() {
    document.getElementById('network-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeNetworkModal() {
    document.getElementById('network-modal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function selectNetwork(network) {
    currentNetwork = network;
    finalizeCurrencySelection('USDT', network);
    closeNetworkModal();
}

// Фильтрация валют
// Функция поиска валют удалена

// Проверка является ли пара криптовалютной
function isCryptoPair(fromCurrency, toCurrency) {
    const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'BNB', 'ADA', 'DOT', 'XRP', 'LTC', 'BCH', 'LINK'];
    return cryptoCurrencies.includes(fromCurrency) && cryptoCurrencies.includes(toCurrency);
}

// Переход к оформлению заявки
function proceedToOrder() {
    if (!currentCalculation) {
        showNotification('Сначала введите сумму для обмена', 'warning');
        return;
    }
    
    // Определяем тип валютной пары
    const isCrypto = isCryptoPair(currentCalculation.fromCurrency, currentCalculation.toCurrency);
    
    // Обновляем интерфейс в зависимости от типа пары
    updateOrderInterfaceForPairType(isCrypto);
    
    // Обновляем сводку заявки
    updateOrderSummary();
    showScreen('order-screen');
    
    // Очищаем предыдущие данные
    document.getElementById('wallet-address').value = '';
    document.getElementById('aml-result').innerHTML = '';
    document.getElementById('create-order-button').disabled = true; // Пока не введен адрес
    currentAMLResult = null;
}

// Обновление интерфейса в зависимости от типа валютной пары
function updateOrderInterfaceForPairType(isCrypto) {
    const addressLabel = document.querySelector('label[for="wallet-address"]');
    const addressInput = document.getElementById('wallet-address');
    const amlSection = document.getElementById('aml-section');
    const inputHelp = document.querySelector('.input-help');
    
    if (isCrypto) {
        // Криптовалютная пара - добавляем поле для адреса отправки
        if (addressLabel) addressLabel.textContent = 'Адреса кошельков';
        if (addressInput) addressInput.placeholder = 'Введите адрес для получения';
        if (amlSection) {
            amlSection.style.display = 'block';
            // Добавляем второе поле для адреса отправки если его еще нет
            if (!document.getElementById('from-address-input')) {
                const fromAddressDiv = document.createElement('div');
                fromAddressDiv.className = 'address-input';
                fromAddressDiv.innerHTML = `
                    <label for="from-wallet-address">Адрес кошелька для отправки</label>
                    <div class="input-group">
                        <input type="text" id="from-wallet-address" placeholder="Введите адрес отправки">
                        <button class="scan-button" onclick="scanQR('from')">
                            <i class="fas fa-qrcode"></i>
                        </button>
                    </div>
                    <div class="input-help">
                        Адрес с которого вы будете отправлять средства
                    </div>
                `;
                fromAddressDiv.id = 'from-address-input';
                amlSection.parentNode.insertBefore(fromAddressDiv, amlSection);
            }
            
            // Обновляем AML секцию для двух адресов
            amlSection.innerHTML = `
                <div class="aml-checks">
                    <h4>Проверка AML</h4>
                    <button class="secondary-button" id="aml-check-from-button" disabled>
                        <i class="fas fa-shield-alt"></i>
                        Проверить адрес отправки
                    </button>
                    <div class="aml-result" id="aml-from-result"></div>
                    
                    <button class="secondary-button" id="aml-check-to-button" disabled>
                        <i class="fas fa-shield-alt"></i>
                        Проверить адрес получения
                    </button>
                    <div class="aml-result" id="aml-to-result"></div>
                </div>
            `;
            
            // Добавляем обработчики для новых кнопок
            setTimeout(() => {
                const fromButton = document.getElementById('aml-check-from-button');
                const toButton = document.getElementById('aml-check-to-button');
                const fromInput = document.getElementById('from-wallet-address');
                const toInput = document.getElementById('wallet-address');
                
                if (fromButton) fromButton.addEventListener('click', () => performAMLCheck('from'));
                if (toButton) toButton.addEventListener('click', () => performAMLCheck('to'));
                
                if (fromInput) fromInput.addEventListener('input', () => validateCryptoAddresses());
                if (toInput) toInput.addEventListener('input', () => validateCryptoAddresses());
            }, 100);
        }
        if (inputHelp) inputHelp.textContent = 'Проверьте правильность адресов перед отправкой';
    } else {
        // Фиатная пара
        // Удаляем поле адреса отправки если оно есть
        const fromAddressDiv = document.getElementById('from-address-input');
        if (fromAddressDiv) fromAddressDiv.remove();
        
        if (addressLabel) addressLabel.textContent = 'Номер счета (CVU/Alias)';
        if (addressInput) addressInput.placeholder = 'Введите номер счета';
        if (amlSection) {
            amlSection.style.display = 'none'; // Скрываем AML для фиатных пар
            // Возвращаем оригинальную структуру AML
            amlSection.innerHTML = `
                <button class="secondary-button" id="aml-check-button">
                    <i class="fas fa-shield-alt"></i>
                    Проверить AML
                </button>
                <div class="aml-result" id="aml-result"></div>
            `;
        }
        if (inputHelp) inputHelp.textContent = 'Проверьте правильность номера счета перед отправкой';
    }
}

// Обновление сводки заявки
function updateOrderSummary() {
    const summary = document.getElementById('order-summary');
    const isCrypto = isCryptoPair(currentCalculation.fromCurrency, currentCalculation.toCurrency);
    
    let addressSection = '';
    
    if (isCrypto) {
        // Для криптовалютных пар показываем оба адреса
        const fromAddress = document.getElementById('from-wallet-address')?.value?.trim() || '';
        const toAddress = document.getElementById('wallet-address')?.value?.trim() || '';
        
        if (fromAddress || toAddress) {
            addressSection = `
                <div class="info-section">
                    <h4>🎯 Адреса кошельков</h4>
                    ${fromAddress ? createCopyableElement(fromAddress, 'Адрес отправки', '📤') : ''}
                    ${toAddress ? createCopyableElement(toAddress, 'Адрес получения', '📥') : ''}
                </div>
            `;
        }
    } else {
        // Для фиатных пар показываем номер счета
        const account = document.getElementById('wallet-address')?.value?.trim() || '';
        
        if (account) {
            addressSection = `
                <div class="info-section">
                    <h4>🏦 Номер счета</h4>
                    ${createCopyableElement(account, 'CVU/Alias', '💳')}
                </div>
            `;
        }
    }
    
    summary.innerHTML = `
        <h3>Сводка обмена</h3>
        <div class="info-row">
            <span>Отдаете</span>
            <span><strong>${currentCalculation.fromAmount} ${currentCalculation.fromCurrency}</strong></span>
        </div>
        <div class="info-row">
            <span>Получаете</span>
            <span><strong>${currentCalculation.toAmount.toFixed(8)} ${currentCalculation.toCurrency}</strong></span>
        </div>
        <div class="info-row">
            <span>Курс обмена</span>
            <span>1 ${currentCalculation.fromCurrency} = ${currentCalculation.exchangeRate.toFixed(2)} ${currentCalculation.toCurrency}</span>
        </div>
        ${addressSection}
    `;
}

// Валидация адреса кошелька (старая функция для совместимости)
function validateWalletAddress() {
    const isCrypto = currentCalculation && isCryptoPair(currentCalculation.fromCurrency, currentCalculation.toCurrency);
    
    if (isCrypto) {
        validateCryptoAddresses();
    } else {
        validateFiatAccount();
    }
}

// Валидация криптовалютных адресов (два адреса)
function validateCryptoAddresses() {
    const fromAddress = document.getElementById('from-wallet-address')?.value?.trim() || '';
    const toAddress = document.getElementById('wallet-address')?.value?.trim() || '';
    
    const fromButton = document.getElementById('aml-check-from-button');
    const toButton = document.getElementById('aml-check-to-button');
    const createButton = document.getElementById('create-order-button');
    
    // Валидация адреса отправки
    if (fromButton) {
        fromButton.disabled = fromAddress.length <= 20;
    }
    
    // Валидация адреса получения
    if (toButton) {
        toButton.disabled = toAddress.length <= 20;
    }
    
    // Разрешаем создание заявки если оба адреса заполнены
    if (createButton) {
        createButton.disabled = !(fromAddress.length > 20 && toAddress.length > 20);
    }
    
    // Обновляем сводку заказа
    if (currentCalculation) {
        updateOrderSummary();
    }
}

// Валидация фиатного счета
function validateFiatAccount() {
    const account = document.getElementById('wallet-address').value.trim();
    const createButton = document.getElementById('create-order-button');
    
    if (createButton) {
        // Для фиатных пар требуется только номер счета
        createButton.disabled = account.length <= 5; // Минимальная длина для номера счета
    }
    
    // Обновляем сводку заказа
    if (currentCalculation) {
        updateOrderSummary();
    }
}

// Выполнение AML проверки
async function performAMLCheck(addressType = 'to') {
    const addressInput = addressType === 'from' ? 
        document.getElementById('from-wallet-address') : 
        document.getElementById('wallet-address');
    
    const address = addressInput?.value?.trim();
    
    if (!address) {
        showNotification(`Введите адрес ${addressType === 'from' ? 'отправки' : 'получения'}`, 'warning');
        return;
    }
    
    const amlButton = addressType === 'from' ? 
        document.getElementById('aml-check-from-button') : 
        document.getElementById('aml-check-to-button');
    
    const amlResult = addressType === 'from' ? 
        document.getElementById('aml-from-result') : 
        document.getElementById('aml-to-result');
    
    if (!amlButton || !amlResult) {
        // Fallback для старого интерфейса
        return performOldAMLCheck();
    }
    
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
                currency: addressType === 'from' ? currentCalculation.fromCurrency : currentCalculation.toCurrency,
                type: addressType
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const amlResult = data.data;
            
            // Сохраняем результат AML
            if (addressType === 'from') {
                currentFromAMLResult = amlResult;
            } else {
                currentToAMLResult = amlResult;
            }
            
            displayAMLResult(amlResult, addressType);
            
            // Отправляем AML результат админам если статус не "approved"
            if (amlResult.status !== 'approved') {
                sendAMLAlertToAdmins(address, amlResult, addressType);
            }
        } else {
            throw new Error(data.error || 'Ошибка AML проверки');
        }
        
    } catch (error) {
        console.error('❌ Ошибка AML проверки:', error);
        showNotification('Ошибка проверки AML. Попробуйте позже.', 'error');
        
        const resultDiv = addressType === 'from' ? 
            document.getElementById('aml-from-result') : 
            document.getElementById('aml-to-result');
        
        if (resultDiv) {
            resultDiv.innerHTML = `
                <div class="aml-result error">
                    <i class="fas fa-exclamation-triangle"></i>
                    Ошибка проверки. Обратитесь к оператору.
                </div>
            `;
        }
    } finally {
        const button = addressType === 'from' ? 
            document.getElementById('aml-check-from-button') : 
            document.getElementById('aml-check-to-button');
        
        if (button) {
            button.disabled = false;
            button.innerHTML = `<i class="fas fa-shield-alt"></i> Проверить адрес ${addressType === 'from' ? 'отправки' : 'получения'}`;
        }
    }
}

// Старая функция AML проверки для совместимости
async function performOldAMLCheck() {
    const address = document.getElementById('wallet-address').value.trim();
    
    if (!address) {
        showNotification('Введите адрес кошелька', 'warning');
        return;
    }
    
    const amlButton = document.getElementById('aml-check-button');
    const amlResult = document.getElementById('aml-result');
    
    if (!amlButton || !amlResult) return;
    
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
            
            // Отправляем AML результат админам если статус не "approved"
            if (currentAMLResult.status !== 'approved') {
                sendAMLAlertToAdmins(address, currentAMLResult);
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
function displayAMLResult(result, addressType = 'to') {
    // Сохраняем результат AML для создания заявки
    if (addressType === 'from') {
        currentFromAMLResult = result;
    } else if (addressType === 'to') {
        currentToAMLResult = result;
    } else {
        // Для совместимости со старым кодом
        currentAMLResult = result;
    }
    
    const amlResultId = addressType === 'from' ? 'aml-from-result' : 
                       addressType === 'to' ? 'aml-to-result' : 'aml-result';
    const amlResult = document.getElementById(amlResultId);
    
    if (!amlResult) return; // Элемент не найден
    
    let resultClass = 'success';
    let icon = 'fas fa-check-circle';
    let message = `Адрес ${addressType === 'from' ? 'отправки' : 'получения'} прошел проверку`;
    
    if (result.status === 'rejected') {
        resultClass = 'warning'; // Изменил с error на warning
        icon = 'fas fa-exclamation-triangle';
        message = `Адрес ${addressType === 'from' ? 'отправки' : 'получения'} требует внимания (можно продолжить)`;
    } else if (result.status === 'manual_review') {
        resultClass = 'warning';
        icon = 'fas fa-exclamation-triangle';
        message = `Требуется ручная проверка адреса ${addressType === 'from' ? 'отправки' : 'получения'} (можно продолжить)`;
    }

    // Для криптопар проверяем оба адреса перед разрешением создания заявки
    const createButton = document.getElementById('create-order-button');
    if (createButton && currentCalculation) {
        const isCrypto = isCryptoPair(currentCalculation.fromCurrency, currentCalculation.toCurrency);
        if (isCrypto) {
            // Разрешаем создание только если оба адреса заполнены
            const fromAddress = document.getElementById('from-wallet-address')?.value?.trim() || '';
            const toAddress = document.getElementById('wallet-address')?.value?.trim() || '';
            createButton.disabled = !(fromAddress.length > 20 && toAddress.length > 20);
        } else {
            // Для фиатных пар как раньше
            createButton.disabled = false;
        }
    }

    // Если есть детальный отчет, показываем его
    if (result.detailedReport && result.connections) {
        const majorConnections = result.connections.filter(c => c.percent >= 1.0);
        const minorConnections = result.connections.filter(c => c.percent < 1.0);
        
        let majorConnectionsHtml = majorConnections.map(conn => {
            const riskClass = conn.risk === 'high' ? 'high-risk' : conn.risk === 'medium' ? 'medium-risk' : 'low-risk';
            return `<div class="connection-item ${riskClass}">
                        <span class="connection-name">• ${conn.name}</span>
                        <span class="connection-percent">${conn.percent}%</span>
                    </div>`;
        }).join('');

        let minorConnectionsHtml = '';
        if (minorConnections.length > 0) {
            const minorList = minorConnections.map(conn => conn.name).join(', ');
            minorConnectionsHtml = `
                <div class="minor-connections">
                    <p class="minor-header">Менее 1.0%:</p>
                    <p class="minor-list">${minorList}</p>
                </div>
            `;
        }

        // Определяем цвет для уровня риска
        let riskColor = '#10B981'; // зеленый
        let riskIcon = '🟢';
        if (result.score > 80) {
            riskColor = '#EF4444'; // красный
            riskIcon = '🔴';
        } else if (result.score > 50) {
            riskColor = '#F59E0B'; // желтый
            riskIcon = '🟡';
        }

        amlResult.innerHTML = `
            <div class="aml-detailed-result ${resultClass}">
                <div class="aml-header">
                    <i class="${icon}"></i>
                    <strong>${message}</strong>
                </div>
                
                <div class="aml-detailed-report">
                    <div class="address-info">
                        ${createCopyableElement(result.address || 'N/A', '🔵 Адрес', '📍')}
                    </div>
                    
                    <div class="blockchain-info">
                        ⛓️ <strong>Блокчейн:</strong> ${result.blockchain || 'Unknown'}
                    </div>
                    
                    <div class="connections-section">
                        <h4>Связи адреса:</h4>
                        <div class="connections-list">
                            ${majorConnectionsHtml}
                        </div>
                        ${minorConnectionsHtml}
                    </div>
                    
                    <div class="risk-summary" style="border-left: 4px solid ${riskColor};">
                        📈 <strong>Уровень риска:</strong> 
                        <span style="color: ${riskColor};">${result.score > 80 ? 'Высокий' : result.score > 50 ? 'Средний' : 'Низкий'} (${result.score}%) ${riskIcon}</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Простое отображение для обратной совместимости
        amlResult.innerHTML = `
            <div class="aml-result ${resultClass}">
                <i class="${icon}"></i>
                <strong>${message}</strong>
                <p>Риск: ${result.risk} (${result.score}/100)</p>
                ${result.reasons.length > 0 ? `<p>Причины: ${result.reasons.join(', ')}</p>` : ''}
            </div>
        `;
    }
    
    if (result.status === 'rejected') {
        amlResult.innerHTML += `
            <div style="margin-top: 15px;">
                <button class="secondary-button" onclick="contactOperator()">
                    <i class="fas fa-phone"></i> Связаться с оператором
                </button>
            </div>
        `;
    }
}

// Создание заявки
async function createOrder() {
    if (!currentCalculation) {
        showNotification('Сначала рассчитайте обмен', 'warning');
        return;
    }
    
    const address = document.getElementById('wallet-address').value.trim();
    
    if (!address) {
        showNotification('Введите адрес кошелька', 'warning');
        return;
    }
    
    // Убеждаемся что userId определен
    if (!currentUserId) {
        console.log('⚠️ currentUserId не определен при создании заявки, устанавливаем тестовый');
        currentUserId = 123456789;
    }
    
    console.log('🔄 Создание заявки с userId:', currentUserId);
    
    const createButton = document.getElementById('create-order-button');
    createButton.disabled = true;
    createButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создаем заявку...';
    
    try {
        const isCrypto = isCryptoPair(currentCalculation.fromCurrency, currentCalculation.toCurrency);
        
        let orderData;
        
        if (isCrypto) {
            // Для криптовалютных пар
            const fromAddress = document.getElementById('from-wallet-address')?.value?.trim() || '';
            
            if (!fromAddress) {
                showNotification('Введите адрес отправки', 'warning');
                return;
            }
            
            orderData = {
                userId: currentUserId,
                fromCurrency: currentCalculation.fromCurrency,
                toCurrency: currentCalculation.toCurrency,
                fromAmount: currentCalculation.fromAmount,
                toAmount: currentCalculation.toAmount,
                fromAddress: fromAddress,
                toAddress: address,
                exchangeRate: currentCalculation.exchangeRate,
                fee: currentCalculation.fee,
                amlFromResult: currentFromAMLResult || { status: 'not_checked', risk: 'unknown' },
                amlToResult: currentToAMLResult || { status: 'not_checked', risk: 'unknown' },
                pairType: 'crypto'
            };
        } else {
            // Для фиатных пар
            orderData = {
                userId: currentUserId,
                fromCurrency: currentCalculation.fromCurrency,
                toCurrency: currentCalculation.toCurrency,
                fromAmount: currentCalculation.fromAmount,
                toAmount: currentCalculation.toAmount,
                fromAddress: '', // Будет заполнено оператором
                toAddress: address, // Номер счета для фиатных пар
                exchangeRate: currentCalculation.exchangeRate,
                fee: currentCalculation.fee,
                pairType: 'fiat'
            };
        }
        
        console.log('📋 Данные заявки:', orderData);
        
        const response = await fetch('/api/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });
        
        console.log('📡 Ответ сервера:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📋 Данные ответа:', data);
        
        if (data.success) {
            console.log('✅ Заявка успешно создана:', data.data);
            showNotification(`Заявка #${data.data.id} успешно создана!`, 'success');
            
            // Показываем информацию о заявке
            try {
                if (tg && typeof tg.showAlert === 'function') {
                    tg.showAlert(`Заявка #${data.data.id} создана!\n\nОператор свяжется с вами в течение 15 минут.`);
                } else {
                    // Если нет Telegram, показываем обычное уведомление
                    alert(`Заявка #${data.data.id} создана!\n\nОператор свяжется с вами в течение 15 минут.`);
                }
            } catch (alertError) {
                console.error('❌ Ошибка показа уведомления:', alertError);
                // Fallback уведомление
                alert(`Заявка #${data.data.id} создана!\n\nОператор свяжется с вами в течение 15 минут.`);
            }
            
            // Возвращаемся на главный экран
            setTimeout(() => {
                showScreen('calculator-screen');
                const navItem = document.querySelector('.nav-item[data-screen="calculator-screen"]');
                if (navItem) navItem.click();
                
                // Очищаем форму
                const fromAmountInput = document.getElementById('from-amount');
                const toAmountInput = document.getElementById('to-amount');
                if (fromAmountInput) fromAmountInput.value = '';
                if (toAmountInput) toAmountInput.value = '';
                calculateExchange();
            }, 2000);
            
        } else {
            console.error('❌ Ошибка от сервера:', data);
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
    
    // Проверка на админа - если админ, то показываем статус АДМИН
    if (userProfile?.role === 'admin') {
        level = {
            level: 'АДМИН',
            name: 'Администратор',
            color: '#FF3B30',
            benefits: ['Полный доступ к системе', 'Управление пользователями', 'Статистика и аналитика']
        };
        console.log('👨‍💼 Установлен статус администратора для пользователя', currentUserId);
    } else if (!level) {
        // Если нет уровня, устанавливаем новичка
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
    
    // В профиле (если элементы существуют)
    
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
        case 'АДМИН':
            nextLevel = 'АДМИНИСТРАТОР';
            requirement = '';
            current = target = 1;
            break;
        default:
            nextLevel = 'МАКСИМУМ';
            requirement = '';
            current = target = 1;
    }
    
    percentage = Math.min(100, Math.round((current / target) * 100));
    
    if (currentLevel === 'АДМИН') {
        description = 'Администратор системы - максимальные привилегии!';
    } else {
        description = target > current ? 
            `До следующего уровня: ${target - current} ${requirement}` : 
            'Максимальный уровень достигнут!';
    }
    
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
        try {
            if (tg && typeof tg.setHeaderColor === 'function') {
                tg.setHeaderColor(theme === 'dark' ? '#1C1C1E' : '#007AFF');
            }
            if (tg && typeof tg.setBackgroundColor === 'function') {
                tg.setBackgroundColor(theme === 'dark' ? '#000000' : '#F2F2F7');
            }
        } catch (error) {
            console.error('❌ Ошибка установки цветов Telegram:', error);
        }
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
        try {
            if (tg && typeof tg.showAlert === 'function') {
                tg.showAlert('Функция экспорта данных будет доступна в ближайшее время!');
            } else {
                alert('Функция экспорта данных будет доступна в ближайшее время!');
            }
        } catch (error) {
            console.error('❌ Ошибка показа уведомления экспорта:', error);
            alert('Функция экспорта данных будет доступна в ближайшее время!');
        }
    } else {
        alert('Функция экспорта данных будет доступна в ближайшее время!');
    }
}

// УНИВЕРСАЛЬНАЯ ФУНКЦИЯ КОПИРОВАНИЯ
function copyToClipboard(text, successMessage = 'Скопировано!') {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification(successMessage, 'success');
            
            // Анимация вибрации на мобильных
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            
            // Анимация для Telegram WebApp
            if (tg && typeof tg.HapticFeedback === 'object') {
                tg.HapticFeedback.notificationOccurred('success');
            }
        }).catch(err => {
            console.error('❌ Ошибка копирования:', err);
            fallbackCopy(text, successMessage);
        });
    } else {
        fallbackCopy(text, successMessage);
    }
}

// Резервный способ копирования для старых браузеров
function fallbackCopy(text, successMessage) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification(successMessage, 'success');
        
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    } catch (err) {
        console.error('❌ Ошибка резервного копирования:', err);
        showNotification('Не удалось скопировать', 'error');
    }
    
    document.body.removeChild(textArea);
}

// Копирование реферальной ссылки (обновлено)
function copyReferralLink() {
    const linkInput = document.getElementById('referral-link-input');
    if (linkInput && linkInput.value) {
        copyToClipboard(linkInput.value, '🔗 Реферальная ссылка скопирована!');
    }
}

// СОЗДАНИЕ КОПИРУЕМОГО ЭЛЕМЕНТА С КНОПКОЙ
function createCopyableElement(text, label = '', icon = '📋') {
    return `
        <div class="copyable-item">
            <div class="copyable-content">
                ${label ? `<span class="copyable-label">${label}:</span>` : ''}
                <code class="copyable-text" onclick="copyToClipboard('${text}', '${icon} ${label || 'Данные'} скопированы!')">${text}</code>
            </div>
            <button class="copy-btn" onclick="copyToClipboard('${text}', '${icon} ${label || 'Данные'} скопированы!')" title="Копировать">
                <i class="fas fa-copy"></i>
            </button>
        </div>
    `;
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



// Переключение экранов с дополнительной логикой
function showScreen(screenId) {
    // Скрываем все экраны
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.remove('active'));
    
    // Показываем нужный экран
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        
        // Сбрасываем скролл к началу экрана
        setTimeout(() => {
            targetScreen.scrollTop = 0;
            // Также сбрасываем скролл основного контейнера
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.scrollTop = 0;
            }
            // И скролл всего окна
            window.scrollTo(0, 0);
        }, 10);
        
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

// Связь с оператором (общая функция)
function contactOperator() {
    createSupportTicket('Помощь оператора', 'Пользователь запросил помощь через WebApp');
}

// Обмен наличных
function requestCashExchange() {
    createSupportTicket('Обмен наличных', 'Заявка на обмен физических денег в офисах. Клиент интересуется обменом наличных валют.');
}

// Обмен без AML
function requestNoAMLExchange() {
    createSupportTicket('Обмен без AML', 'Заявка на быстрый обмен без AML проверки. Клиент хочет выполнить обмен без детальной проверки адресов.');
}

// Банковские карты
function requestBankCards() {
    createSupportTicket('Банковские карты', 'Заявка на обмен с банковскими картами. Клиент интересуется пополнением или выводом средств на банковские карты.');
}

// OTC торговля
function requestOTCTrading() {
    createSupportTicket('OTC торговля', 'Заявка на OTC торговлю большими объемами. Клиент интересуется обменом крупных сумм с индивидуальными условиями.');
}

// Отправка AML уведомления админам
async function sendAMLAlertToAdmins(address, amlResult, addressType = 'to') {
    try {
        if (!currentUserId) return;
        
        const riskLevel = amlResult.status === 'rejected' ? 'ВЫСОКИЙ' : 'СРЕДНИЙ';
        const addressTypeText = addressType === 'from' ? 'отправки' : 'получения';
        const subject = `🛡️ AML ПРЕДУПРЕЖДЕНИЕ - ${riskLevel} РИСК (${addressTypeText.toUpperCase()})`;
        const message = `Адрес ${addressTypeText}: ${address}\nСтатус: ${amlResult.status}\nРиск: ${amlResult.risk}\nОценка: ${amlResult.score}/100\nПользователь: ${currentUserId}`;
        
        await createSupportTicket(subject, message);
        console.log(`📨 AML уведомление для адреса ${addressTypeText} отправлено админам`);
    } catch (error) {
        console.error('❌ Ошибка отправки AML уведомления:', error);
    }
}

// Создание заявки в поддержку с темой
async function createSupportTicket(subject = 'Помощь оператора', message = 'Пользователь запросил помощь через WebApp') {
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
                subject: subject,
                message: message,
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
function scanQR(addressType = 'to') {
    try {
        if (tg && typeof tg.showScanQrPopup === 'function') {
            const text = addressType === 'from' ? 
                'Отсканируйте QR код адреса отправки' : 
                'Отсканируйте QR код адреса получения';
                
            tg.showScanQrPopup({
                text: text
            }, (result) => {
                const inputId = addressType === 'from' ? 'from-wallet-address' : 'wallet-address';
                const input = document.getElementById(inputId);
                
                if (input) {
                    input.value = result;
                    validateWalletAddress();
                    showNotification('QR код отсканирован!', 'success');
                }
                
                if (typeof tg.closeScanQrPopup === 'function') {
                    tg.closeScanQrPopup();
                }
            });
        } else {
            showNotification('Сканирование QR недоступно в браузере', 'warning');
        }
    } catch (error) {
        console.error('❌ Ошибка сканирования QR:', error);
        showNotification('Ошибка сканирования QR', 'error');
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