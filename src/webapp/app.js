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
    
    // 🧪 ГЛОБАЛЬНАЯ ОТЛАДОЧНАЯ ФУНКЦИЯ ДЛЯ КОНСОЛИ
    window.debugCreateButton = function() {
        console.log('🧪 РУЧНАЯ ОТЛАДКА КНОПКИ ЗАЯВКИ');
        testCreateButton();
        setTimeout(() => {
            console.log('🧪 ЗАПУСКАЕМ ВАЛИДАЦИЮ...');
            validateWalletAddress();
        }, 100);
    };
    
    console.log('🧪 Доступна команда: debugCreateButton() - для отладки кнопки из консоли');
    
    // 🧪 ГЛОБАЛЬНАЯ ФУНКЦИЯ ДЛЯ ТЕСТИРОВАНИЯ СОЗДАНИЯ ЗАЯВКИ
    window.testCreateOrder = function() {
        console.log('🧪 РУЧНОЙ ТЕСТ СОЗДАНИЯ ЗАЯВКИ');
        createOrder();
    };
    
    // 🔧 ГЛОБАЛЬНАЯ ФУНКЦИЯ ДЛЯ ПРИНУДИТЕЛЬНОЙ ПРИВЯЗКИ ОБРАБОТЧИКА
    window.forceBindCreateButton = function() {
        console.log('🔧 ПРИНУДИТЕЛЬНАЯ ПРИВЯЗКА ОБРАБОТЧИКА КНОПКИ');
        const createOrderButton = document.getElementById('create-order-button');
        if (createOrderButton) {
            console.log('✅ Кнопка найдена');
            
            // Удаляем все предыдущие обработчики
            createOrderButton.replaceWith(createOrderButton.cloneNode(true));
            const newButton = document.getElementById('create-order-button');
            
            // Добавляем новые обработчики
            newButton.addEventListener('click', function(event) {
                console.log('🔥 НОВЫЙ ОБРАБОТЧИК CLICK СРАБОТАЛ');
                event.preventDefault();
                event.stopPropagation();
                createOrder();
            });
            
            newButton.onclick = function(event) {
                console.log('🔥 НОВЫЙ ОБРАБОТЧИК ONCLICK СРАБОТАЛ');
                event.preventDefault();
                event.stopPropagation();
                createOrder();
            };
            
            console.log('✅ Обработчики успешно перепривязаны');
        } else {
            console.error('❌ Кнопка не найдена!');
        }
    };
    
    // 🤖 ГЛОБАЛЬНАЯ ФУНКЦИЯ ДЛЯ ПРОГРАММНОГО КЛИКА
    window.simulateClick = function() {
        console.log('🤖 СИМУЛЯЦИЯ КЛИКА ПО КНОПКЕ');
        const createOrderButton = document.getElementById('create-order-button');
        if (createOrderButton) {
            console.log('✅ Кнопка найдена, симулируем клик...');
            
            // Несколько способов симуляции клика
            createOrderButton.click();
            
            // Альтернативный способ
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
            });
            createOrderButton.dispatchEvent(clickEvent);
            
            console.log('✅ Клик отправлен');
        } else {
            console.error('❌ Кнопка не найдена!');
        }
    };
    
    // 🔍 ДИАГНОСТИКА ПЕРЕКРЫВАЮЩИХ ЭЛЕМЕНТОВ
    window.checkOverlappingElements = function() {
        console.log('🔍 ПРОВЕРКА ПЕРЕКРЫВАЮЩИХ ЭЛЕМЕНТОВ');
        const createOrderButton = document.getElementById('create-order-button');
        if (createOrderButton) {
            const rect = createOrderButton.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            console.log('🔍 Кнопка rect:', rect);
            console.log('🔍 Центр кнопки:', centerX, centerY);
            
            const elementAtPoint = document.elementFromPoint(centerX, centerY);
            console.log('🔍 Элемент в центре кнопки:', elementAtPoint);
            console.log('🔍 Это та же кнопка?', elementAtPoint === createOrderButton);
            
            // Проверяем всю иерархию родителей
            let currentElement = createOrderButton;
            console.log('🔍 ========== ИЕРАРХИЯ РОДИТЕЛЕЙ ==========');
            while (currentElement) {
                console.log('🔍 Элемент:', currentElement.tagName, currentElement.id, currentElement.className);
                console.log('🔍 pointer-events:', getComputedStyle(currentElement).pointerEvents);
                console.log('🔍 z-index:', getComputedStyle(currentElement).zIndex);
                console.log('🔍 position:', getComputedStyle(currentElement).position);
                console.log('🔍 overflow:', getComputedStyle(currentElement).overflow);
                console.log('---');
                currentElement = currentElement.parentElement;
                if (currentElement && currentElement.tagName === 'BODY') break;
            }
            
            if (elementAtPoint !== createOrderButton) {
                console.log('❌ КНОПКА ПЕРЕКРЫТА ДРУГИМ ЭЛЕМЕНТОМ!');
                console.log('❌ Перекрывающий элемент:', elementAtPoint);
                console.log('❌ Z-index кнопки:', getComputedStyle(createOrderButton).zIndex);
                console.log('❌ Z-index перекрывающего:', elementAtPoint ? getComputedStyle(elementAtPoint).zIndex : 'N/A');
                
                // Попробуем поднять z-index кнопки
                createOrderButton.style.zIndex = '999999';
                createOrderButton.style.position = 'relative';
                console.log('✅ Подняли z-index кнопки до 999999');
            } else {
                console.log('✅ Кнопка НЕ перекрыта');
            }
        }
    };
    
    // 💀 ЯДЕРНЫЙ СПОСОБ ПРИВЯЗКИ ОБРАБОТЧИКА
    window.nuclearBind = function() {
        console.log('💀 ЯДЕРНАЯ ПРИВЯЗКА ОБРАБОТЧИКА');
        
        // Очищаем все предыдущие обработчики
        const oldButton = document.getElementById('create-order-button');
        if (oldButton) {
            console.log('💀 Информация о кнопке ДО замены:');
            console.log('💀 Parent:', oldButton.parentElement);
            console.log('💀 Siblings:', Array.from(oldButton.parentElement.children));
            
            const newButton = oldButton.cloneNode(true);
            oldButton.parentNode.replaceChild(newButton, oldButton);
            
            // Привязываем МАКСИМАЛЬНО простой обработчик
            newButton.onclick = function(e) {
                console.log('💀 ЯДЕРНЫЙ КЛИК СРАБОТАЛ!');
                console.log('💀 Event:', e);
                alert('КЛИК СРАБОТАЛ! Сейчас запустим createOrder...');
                try {
                    createOrder();
                } catch (error) {
                    console.error('💀 Ошибка в createOrder:', error);
                    alert('Ошибка: ' + error.message);
                }
            };
            
            // ДОБАВЛЯЕМ ВСЕ ВОЗМОЖНЫЕ ОБРАБОТЧИКИ
            newButton.addEventListener('click', function(e) {
                console.log('💀 ADDEVENTLISTENER КЛИК СРАБОТАЛ!');
                e.preventDefault();
                e.stopPropagation();
                createOrder();
            });
            
            newButton.addEventListener('mousedown', function(e) {
                console.log('💀 MOUSEDOWN СРАБОТАЛ!');
            });
            
            newButton.addEventListener('touchstart', function(e) {
                console.log('💀 TOUCHSTART СРАБОТАЛ!');
            });
            
            // Убираем все блокировки
            newButton.style.setProperty('pointer-events', 'auto', 'important');
            newButton.style.setProperty('cursor', 'pointer', 'important');
            newButton.style.setProperty('z-index', '999999', 'important');
            newButton.style.setProperty('position', 'relative', 'important');
            newButton.style.setProperty('background', '#ff0000', 'important'); // Красная для отличия
            newButton.style.setProperty('border', '3px solid #00ff00', 'important'); // Зеленая рамка
            newButton.disabled = false;
            newButton.removeAttribute('disabled');
            newButton.classList.remove('disabled');
            
            console.log('💀 ЯДЕРНАЯ ПРИВЯЗКА ЗАВЕРШЕНА - кнопка должна быть КРАСНОЙ С ЗЕЛЕНОЙ РАМКОЙ');
            console.log('💀 Новая кнопка:', newButton);
        }
    };
    
    // 🎯 СОЗДАНИЕ ТЕСТОВОЙ КНОПКИ ДЛЯ СРАВНЕНИЯ
    window.createTestButton = function() {
        console.log('🎯 СОЗДАНИЕ ТЕСТОВОЙ КНОПКИ');
        
        // Удаляем старую тестовую кнопку если есть
        const oldTestButton = document.getElementById('test-button');
        if (oldTestButton) oldTestButton.remove();
        
        // Создаем новую тестовую кнопку
        const testButton = document.createElement('button');
        testButton.id = 'test-button';
        testButton.textContent = '🎯 ТЕСТ КНОПКА - КЛИК СЮДА';
        testButton.style.cssText = `
            position: fixed !important;
            top: 50px !important;
            right: 50px !important;
            z-index: 999999 !important;
            background: #ff6600 !important;
            color: white !important;
            border: none !important;
            padding: 15px !important;
            border-radius: 5px !important;
            cursor: pointer !important;
            pointer-events: auto !important;
            font-size: 14px !important;
            font-weight: bold !important;
        `;
        
        testButton.onclick = function() {
            console.log('🎯 ТЕСТОВАЯ КНОПКА КЛИКНУТА!');
            alert('ТЕСТОВАЯ КНОПКА РАБОТАЕТ! Теперь вызываем createOrder...');
            createOrder();
        };
        
        document.body.appendChild(testButton);
        console.log('🎯 Тестовая кнопка добавлена в правый верхний угол');
    };
    
    console.log('🧪 Доступна команда: testCreateOrder() - для тестирования создания заявки из консоли');
    console.log('🔧 Доступна команда: forceBindCreateButton() - для принудительной привязки обработчика');
    console.log('🤖 Доступна команда: simulateClick() - для программного клика по кнопке');
    console.log('🔍 Доступна команда: checkOverlappingElements() - для проверки перекрывающих элементов');
    console.log('💀 Доступна команда: nuclearBind() - для ядерной привязки обработчика (делает кнопку КРАСНОЙ)');
    console.log('🎯 Доступна команда: createTestButton() - создать тестовую кнопку в углу экрана');
});

// Инициализация Telegram Web App
function initTelegramWebApp() {
    console.log('🔌 Инициализация Telegram WebApp...');
    
    // 🛡️ КРАЙНЕ БЫСТРЫЙ ТАЙМЕР БЕЗОПАСНОСТИ - 1 СЕКУНДА
    setTimeout(() => {
        console.log('🛡️ Таймер безопасности: принудительно скрываем заставку');
        hideLoadingScreen();
    }, 1000); // Еще быстрее для лучшего UX
    
    if (window.Telegram?.WebApp) {
        tg = window.Telegram.WebApp;
        
        console.log('✅ Telegram WebApp API обнаружен');
        console.log('📱 initData:', tg.initData ? 'Есть данные' : 'Нет данных');
        
        // Готовим WebApp
        tg.ready();
        tg.expand();
        
        // Извлекаем User ID
        if (tg.initDataUnsafe?.user?.id) {
            currentUserId = tg.initDataUnsafe.user.id;
            console.log('👤 РЕАЛЬНЫЙ User ID из Telegram:', currentUserId);
            console.log('✅ Это настоящий пользователь - уведомления будут отправлены!');
        } else {
            console.log('⚠️ User ID не найден в initDataUnsafe, используем тестовый');
            currentUserId = 123456789; // Тестовый ID для разработки
            console.log('🔥 ВНИМАНИЕ: Тестовый ID! На производстве может не работать!');
        }
        
        // Применяем тему
        applyTelegramTheme();
        
        // 👤 МГНОВЕННО ОБНОВЛЯЕМ ПРОФИЛЬ С ДАННЫМИ TELEGRAM
        setTimeout(() => {
            try {
                updateProfileDisplay();
                console.log('✅ Профиль обновлен сразу после инициализации');
            } catch (error) {
                console.error('❌ Ошибка быстрого обновления профиля:', error);
            }
        }, 100);
        
        // ❌ УБРАЛ ГЛАВНУЮ КНОПКУ - ОНА НЕ НУЖНА
        // tg.MainButton скрыта по умолчанию
        if (tg.MainButton) {
            tg.MainButton.hide();
        }
        
    } else {
        console.log('⚠️ Telegram WebApp API недоступен');
        console.log('🌐 Запуск в режиме браузера с тестовыми данными');
        currentUserId = 123456789;
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
            
            // Проверяем если это кнопка сайта - она работает через onclick
            if (item.dataset.action === 'website') {
                return; // Для кнопки сайта используется onclick в HTML
            }
            
            const screen = item.dataset.screen;
            if (screen) {
                console.log('📱 Переключение на экран:', screen);
                showScreen(screen);
                
                // Обновляем активную вкладку
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            } else {
                console.log('⚠️ Экран не найден для:', item);
            }
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
    const createOrderButton = document.getElementById('create-order-button');
    if (createOrderButton) {
        console.log('✅ Кнопка create-order-button найдена, привязываем обработчик');
        createOrderButton.addEventListener('click', function(event) {
            console.log('🔥 ========== КЛИК ЗАФИКСИРОВАН ==========');
            console.log('🔥 Event:', event);
            console.log('🔥 Target:', event.target);
            console.log('🔥 Button disabled:', createOrderButton.disabled);
            console.log('🔥 Button classes:', createOrderButton.className);
            console.log('🔥 Вызываем createOrder...');
            createOrder();
        });
        console.log('✅ Обработчик клика успешно привязан');
    } else {
        console.error('❌ Кнопка create-order-button НЕ НАЙДЕНА при инициализации!');
    }
    
    // Поиск валют
    // Поиск валют удален
    
    // Адрес кошелька
    const walletAddressField = document.getElementById('wallet-address');
    if (walletAddressField) {
        walletAddressField.addEventListener('input', function() {
            console.log('💡 Поле адреса изменено, запускаем валидацию...');
            validateWalletAddress();
        });
    } else {
        console.log('⚠️ Поле wallet-address не найдено при инициализации');
    }
    
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

// 🎨 ОБНОВЛЕНИЕ ИКОНОК ВАЛЮТ ПО УМОЛЧАНИЮ
function updateDefaultCurrencyIcons() {
    console.log('🎨 Обновляем иконки валют по умолчанию...');
    
    // Обновляем иконку BTC (fromCurrency)
    const fromButton = document.querySelector('#from-currency');
    if (fromButton) {
        fromButton.querySelector('.currency-icon').innerHTML = getCurrencyIcon(fromCurrency);
        console.log(`✅ Иконка ${fromCurrency} обновлена`);
    }
    
    // Обновляем иконку USDT (toCurrency)  
    const toButton = document.querySelector('#to-currency');
    if (toButton) {
        toButton.querySelector('.currency-icon').innerHTML = getCurrencyIcon(toCurrency);
        console.log(`✅ Иконка ${toCurrency} обновлена`);
    }
}

// Загрузка начальных данных
async function loadInitialData() {
    console.log('🚀 Начинаем загрузку начальных данных...');
    showNotification('Загружаем данные приложения...', 'info');
    
    // 🛡️ МГНОВЕННАЯ ЗАЩИТА! СРАЗУ ЗАГРУЖАЕМ ТЕСТОВЫЕ КУРСЫ
    console.log('🛡️ Загружаем тестовые курсы как защиту от зависания...');
    currentRates = getTestRates();
    updateCurrencyList();
    updateRatesTime();
    console.log('✅ Защитные тестовые курсы загружены');
    
    // 🔥 МГНОВЕННОЕ СКРЫТИЕ ЗАГРУЗОЧНОГО ЭКРАНА
    hideLoadingScreen();
    
    // ⚡ УСКОРЕННАЯ ИНИЦИАЛИЗАЦИЯ - ВСЕ ПАРАЛЛЕЛЬНО
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
    
    // 🎨 ОБНОВЛЯЕМ ИКОНКИ ПО УМОЛЧАНИЮ НА PNG
    try {
        updateDefaultCurrencyIcons();
        console.log('✅ Иконки валют обновлены на PNG');
    } catch (error) {
        console.error('❌ Ошибка обновления иконок:', error);
    }
    
    // 🚀 МГНОВЕННАЯ ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА КУРСОВ
    loadExchangeRates().catch(error => {
        console.error('❌ Ошибка загрузки курсов:', error);
    });
    
    // 🚀 МГНОВЕННАЯ ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА ПРОФИЛЯ
    if (currentUserId && currentUserId !== 123456789) {
        loadUserProfile().catch(error => {
            console.error('❌ Ошибка загрузки профиля:', error);
        });
    }
}

// 🚀 БЫСТРАЯ ЗАГРУЗКА КУРСОВ С TIMEOUT И FALLBACK
async function loadExchangeRates() {
    console.log('📡 Загружаем курсы валют...');
    
    try {
        // 🔥 МОЛНИЕНОСНЫЙ TIMEOUT 500МС!
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 500);
        
        const response = await fetch('/api/rates', {
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
            currentRates = data.data;
            updateCurrencyList();
            updateRatesTime();
            console.log('✅ Актуальные курсы заменили тестовые:', currentRates.length, 'валют');
            showNotification('Курсы валют обновлены!', 'success');
            
            // 🔥 ПРИНУДИТЕЛЬНОЕ СКРЫТИЕ ЗАСТАВКИ ПОСЛЕ ЗАГРУЗКИ КУРСОВ
            hideLoadingScreen();
        } else {
            throw new Error(data.error || 'Пустой ответ от сервера');
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки курсов:', error.message);
        
        if (error.name === 'AbortError') {
            console.log('⚡ Таймаут 500мс превышен - продолжаем с тестовыми курсами');
            showNotification('Используем тестовые курсы для быстрой работы', 'info');
        } else {
            console.log('⚡ Ошибка API - продолжаем с тестовыми курсами');
            showNotification('Не удалось загрузить актуальные курсы', 'warning');
        }
        
        // 🔥 ПРИНУДИТЕЛЬНОЕ СКРЫТИЕ ЗАСТАВКИ ДАЖЕ ПРИ ОШИБКЕ
        hideLoadingScreen();
    }
}

// Тестовые курсы для разработки
function getTestRates() {
    return [
        // 🪙 КРИПТОВАЛЮТЫ
        { currency: 'BTC', price: 95000, buy: 95000, sell: 96000, change24h: 2.5, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'ETH', price: 3500, buy: 3500, sell: 3520, change24h: 1.8, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'USDT', price: 1.0, buy: 1.0, sell: 1.02, change24h: 0.1, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'USDC', price: 1.0, buy: 1.0, sell: 1.02, change24h: 0.0, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'BNB', price: 650, buy: 650, sell: 655, change24h: -0.8, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'SOL', price: 180, buy: 180, sell: 182, change24h: 3.2, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'ADA', price: 0.55, buy: 0.55, sell: 0.56, change24h: 1.1, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'DOT', price: 12.5, buy: 12.5, sell: 12.7, change24h: -1.5, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'MATIC', price: 0.95, buy: 0.95, sell: 0.97, change24h: 2.8, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'AVAX', price: 45, buy: 45, sell: 46, change24h: 0.9, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'XRP', price: 0.48, buy: 0.48, sell: 0.49, change24h: -0.3, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'LTC', price: 110, buy: 110, sell: 112, change24h: 1.7, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'BCH', price: 280, buy: 280, sell: 285, change24h: -2.1, lastUpdate: new Date().toISOString(), type: 'crypto' },
        { currency: 'LINK', price: 18.5, buy: 18.5, sell: 18.8, change24h: 0.6, lastUpdate: new Date().toISOString(), type: 'crypto' },
        
        // 💰 ФИАТНЫЕ ВАЛЮТЫ
        { currency: 'USD', price: 1.0, buy: 1.0, sell: 1.0, change24h: 0.0, lastUpdate: new Date().toISOString(), type: 'fiat' },
        { currency: 'EUR', price: 0.92, buy: 0.92, sell: 0.94, change24h: 0.2, lastUpdate: new Date().toISOString(), type: 'fiat' },
        { currency: 'RUB', price: 0.0105, buy: 0.0098, sell: 0.0102, change24h: -0.5, lastUpdate: new Date().toISOString(), type: 'fiat' },
        { currency: 'UAH', price: 0.026, buy: 0.025, sell: 0.027, change24h: -0.3, lastUpdate: new Date().toISOString(), type: 'fiat' },
        { currency: 'KZT', price: 0.0022, buy: 0.0021, sell: 0.0023, change24h: 0.1, lastUpdate: new Date().toISOString(), type: 'fiat' },
        { currency: 'ARS', price: 0.001, buy: 0.0009, sell: 0.0011, change24h: -1.2, lastUpdate: new Date().toISOString(), type: 'fiat' },
        { currency: 'BRL', price: 0.20, buy: 0.19, sell: 0.21, change24h: 0.4, lastUpdate: new Date().toISOString(), type: 'fiat' }
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
    fromButton.querySelector('.currency-icon').innerHTML = getCurrencyIcon(fromCurrency);
    
    toButton.querySelector('.currency-name').textContent = toCurrency;
    toButton.querySelector('.currency-desc').textContent = getCurrencyName(toCurrency);
    toButton.querySelector('.currency-icon').innerHTML = getCurrencyIcon(toCurrency);
    
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
    
    // 🚀 МГНОВЕННАЯ ПРОВЕРКА И ЗАГРУЗКА КУРСОВ
    if (!currentRates || currentRates.length === 0) {
        console.log('⚡ Курсы еще не загружены - используем тестовые');
        currentRates = getTestRates();
    }
    
    updateCurrencyList();
    document.getElementById('currency-modal').classList.add('active');
    
    // 🔄 ФОРСИРУЕМ АКТУАЛЬНЫЕ КУРСЫ В ФОНЕ (не блокируем UI)
    if (currentRates === getTestRates()) {
        loadExchangeRates().then(() => {
            console.log('✅ Актуальные курсы загружены - обновляем список');
            updateCurrencyList();
        }).catch(error => {
            console.log('⚠️ Остаемся с тестовыми курсами:', error.message);
        });
    }
}

// Закрытие модала валют
function closeCurrencyModal() {
    document.getElementById('currency-modal').classList.remove('active');
}

// Обновление списка валют
function updateCurrencyList() {
    const currencyList = document.getElementById('currency-list');
    currencyList.innerHTML = '';
    
    // 🛡️ ЗАЩИТА ОТ ПУСТЫХ КУРСОВ
    if (!currentRates || currentRates.length === 0) {
        console.log('⚡ Нет курсов - загружаем тестовые мгновенно');
        currentRates = getTestRates();
    }
    
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

    // 🪙 КРАСИВЫЕ ИКОНКИ ВАЛЮТ
    const currencyIcon = getCurrencyIcon(rate.currency);

    item.innerHTML = `
        <div class="currency-info" onclick="selectCurrency('${rate.currency}')">
            <div class="currency-icon">${currencyIcon}</div>
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
        'XRP': 'Ripple',
        'LTC': 'Litecoin',
        'BCH': 'Bitcoin Cash',
        'LINK': 'Chainlink',
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

// 🔄 FALLBACK ИКОНКИ ДЛЯ СЛУЧАЕВ КОГДА PNG НЕ ЗАГРУЖАЕТСЯ
function getFallbackIcon(currency) {
    const fallbackSymbols = {
        'BTC': '₿',
        'ETH': 'Ξ', 
        'USDT': '₮',
        'USDC': 'Ⓤ',
        'BNB': '🔸',
        'SOL': '◎',
        'ADA': '₳',
        'DOT': '●',
        'MATIC': '◇',
        'AVAX': '▲',
        'XRP': '✕',
        'LTC': 'Ł',
        'BCH': '⚡',
        'LINK': '🔗',
        'USD': '$',
        'EUR': '€',
        'RUB': '₽',
        'UAH': '₴',
        'KZT': '₸',
        'ARS': '$',
        'BRL': 'R$'
    };
    return fallbackSymbols[currency] || '💱';
}

// Получение иконки валюты
function getCurrencyIcon(currency) {
    // 🎨 ОРИГИНАЛЬНЫЕ ИКОНКИ ВАЛЮТ (48x48px)
    const availableIcons = [
        'BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX',
        'XRP', 'LTC', 'BCH', 'LINK',
        'USD', 'EUR', 'RUB', 'UAH', 'KZT', 'ARS', 'BRL'
    ];
    
    // Если есть оригинальная иконка - используем её
    if (availableIcons.includes(currency)) {
        const imgPath = `/assets/images/currencies/${currency.toLowerCase()}.png`;
        console.log(`🎨 Загружаем PNG иконку для ${currency}: ${imgPath}`);
        return `<img src="${imgPath}" alt="${currency}" class="currency-icon-img" onerror="console.error('❌ PNG не загрузился: ${imgPath}'); this.style.display='none'; this.parentNode.innerHTML='${getFallbackIcon(currency)}';">`;
    }
    
    // Фоллбэк - символы для остальных валют
    const fallbackIcons = {
        'TRX': '🌊',
        'DOGE': '🐕',
        'SHIB': '🐱',
        'GBP': '£',
        'JPY': '¥',
        'CNY': '¥'
    };
    
    return fallbackIcons[currency] || '💱';
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
        button.querySelector('.currency-icon').innerHTML = getCurrencyIcon(currency);
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
        button.querySelector('.currency-icon').innerHTML = getCurrencyIcon(currency);
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
    const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'ADA', 'DOT', 'XRP', 'LTC', 'BCH', 'LINK', 'SOL', 'MATIC', 'AVAX'];
    return cryptoCurrencies.includes(fromCurrency) && cryptoCurrencies.includes(toCurrency);
}

// Проверка является ли пара смешанной (крипто → фиат)
function isCryptoToFiatPair(fromCurrency, toCurrency) {
    const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'ADA', 'DOT', 'XRP', 'LTC', 'BCH', 'LINK', 'SOL', 'MATIC', 'AVAX'];
    const fiatCurrencies = ['USD', 'EUR', 'RUB', 'UAH', 'KZT', 'ARS', 'BRL'];
    return cryptoCurrencies.includes(fromCurrency) && fiatCurrencies.includes(toCurrency);
}

// Проверка является ли пара смешанной (фиат → крипто)
function isFiatToCryptoPair(fromCurrency, toCurrency) {
    const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'ADA', 'DOT', 'XRP', 'LTC', 'BCH', 'LINK', 'SOL', 'MATIC', 'AVAX'];
    const fiatCurrencies = ['USD', 'EUR', 'RUB', 'UAH', 'KZT', 'ARS', 'BRL'];
    return fiatCurrencies.includes(fromCurrency) && cryptoCurrencies.includes(toCurrency);
}

// Определяем тип валютной пары
function getPairType(fromCurrency, toCurrency) {
    if (isCryptoPair(fromCurrency, toCurrency)) {
        return 'crypto'; // BTC → ETH
    } else if (isCryptoToFiatPair(fromCurrency, toCurrency)) {
        return 'crypto-to-fiat'; // USDT → RUB
    } else if (isFiatToCryptoPair(fromCurrency, toCurrency)) {
        return 'fiat-to-crypto'; // RUB → USDT
    } else {
        return 'fiat'; // ARS → BRL
    }
}

// Переход к оформлению заявки
function proceedToOrder() {
    if (!currentCalculation) {
        showNotification('Сначала введите сумму для обмена', 'warning');
        return;
    }
    
    // Определяем тип валютной пары
    const pairType = getPairType(currentCalculation.fromCurrency, currentCalculation.toCurrency);
    
    // ОТЛАДКА: выводим информацию о классификации пары
    console.log(`🔍 ПРОВЕРКА ПАРЫ: ${currentCalculation.fromCurrency} → ${currentCalculation.toCurrency}`);
    console.log(`🔍 Тип пары: ${pairType}`);
    console.log(`🔍 currentCalculation:`, currentCalculation);
    
    let interfaceDescription = '';
    switch (pairType) {
        case 'crypto':
            interfaceDescription = 'Два адреса кошельков + AML для каждого';
            break;
        case 'crypto-to-fiat':
            interfaceDescription = 'Криптоадрес + AML, затем реквизиты получения';
            break;
        case 'fiat-to-crypto':
            interfaceDescription = 'Кошелек получения крипты + AML проверка';
            break;
        case 'fiat':
            const isSpecialCase = currentCalculation && (
                (currentCalculation.fromCurrency === 'ARS' && currentCalculation.toCurrency === 'RUB') ||
                (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'KZT') ||
                (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'UAH') ||
                (currentCalculation.fromCurrency === 'UAH' && currentCalculation.toCurrency === 'RUB')
            );
            if (isSpecialCase) {
                if (currentCalculation.fromCurrency === 'ARS' && currentCalculation.toCurrency === 'RUB') {
                    interfaceDescription = 'Реквизиты для получения рублей БЕЗ AML';
                } else if (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'KZT') {
                    interfaceDescription = 'Реквизиты для получения тенге БЕЗ AML';
                } else if (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'UAH') {
                    interfaceDescription = 'Реквизиты для получения гривен БЕЗ AML';
                } else if (currentCalculation.fromCurrency === 'UAH' && currentCalculation.toCurrency === 'RUB') {
                    interfaceDescription = 'Реквизиты для получения рублей БЕЗ AML';
                }
            } else {
                interfaceDescription = 'Номер счета БЕЗ AML';
            }
            break;
    }
    console.log(`🔍 Интерфейс: ${interfaceDescription}`);
    
    // Обновляем интерфейс в зависимости от типа пары
    updateOrderInterfaceForPairType(pairType);
    
    // Обновляем сводку заявки
    updateOrderSummary();
    showScreen('order-screen');
    
    // Очищаем предыдущие данные
    document.getElementById('wallet-address').value = '';
    document.getElementById('aml-result').innerHTML = '';
    currentAMLResult = null;
    
    // Принудительно деактивируем кнопку пока не введен адрес
    setCreateButtonState(false);
    
    // Запускаем первичную валидацию
    setTimeout(() => {
        validateWalletAddress();
    }, 100);
}

// Управление состоянием кнопки создания заявки
function setCreateButtonState(enabled) {
    const createButton = document.getElementById('create-order-button');
    if (createButton) {
        console.log('🔧 ========== ИЗМЕНЕНИЕ СОСТОЯНИЯ КНОПКИ ==========');
        console.log('🔧 Текущее состояние disabled:', createButton.disabled);
        console.log('🔧 Текущие классы:', createButton.className);
        console.log('🔧 Запрошенное состояние:', enabled);
        
        if (enabled) {
            createButton.removeAttribute('disabled');
            createButton.classList.remove('disabled');
            console.log('🔧 ✅ АКТИВИРОВАЛИ кнопку');
        } else {
            createButton.setAttribute('disabled', 'disabled');
            createButton.classList.add('disabled');
            console.log('🔧 ❌ ДЕАКТИВИРОВАЛИ кнопку');
        }
        
        console.log('🔧 Новое состояние disabled:', createButton.disabled);
        console.log('🔧 Новые классы:', createButton.className);
        console.log(`🔄 КНОПКА ЗАЯВКИ: ${enabled ? '✅ АКТИВНА' : '❌ НЕАКТИВНА'}`);
        console.log('🔧 ========== КОНЕЦ ИЗМЕНЕНИЯ СОСТОЯНИЯ ==========');
    } else {
        console.log('❌ setCreateButtonState: кнопка не найдена!');
    }
}

// Обновление интерфейса в зависимости от типа валютной пары
function updateOrderInterfaceForPairType(pairType) {
    const addressLabel = document.querySelector('label[for="wallet-address"]');
    const addressInput = document.getElementById('wallet-address');
    const amlSection = document.getElementById('aml-section');
    const inputHelp = document.querySelector('.input-help');
    
    // Удаляем дополнительные поля если они есть
    const toAddressDiv = document.getElementById('to-address-input');
    const receivingDetailsDiv = document.getElementById('receiving-details-input');
    if (toAddressDiv) toAddressDiv.remove();
    if (receivingDetailsDiv) receivingDetailsDiv.remove();
    
    if (pairType === 'crypto') {
        // Криптовалютная пара (BTC → ETH) - два адреса + AML для каждого
        if (addressLabel) addressLabel.textContent = 'Адреса кошельков';
        if (addressInput) addressInput.placeholder = 'Введите адрес отправки';
        if (amlSection) {
            amlSection.style.display = 'block';
            // Добавляем второе поле для адреса получения
            const toAddressDiv = document.createElement('div');
            toAddressDiv.className = 'address-input';
            toAddressDiv.innerHTML = `
                <label for="to-wallet-address">Адрес кошелька для получения</label>
                <div class="input-group">
                    <input type="text" id="to-wallet-address" placeholder="Введите адрес получения">
                    <button class="scan-button" onclick="scanQR('to')">
                        <i class="fas fa-qrcode"></i>
                    </button>
                </div>
                <div class="input-help">
                    Адрес на который вы хотите получить средства
                </div>
            `;
            toAddressDiv.id = 'to-address-input';
            amlSection.parentNode.insertBefore(toAddressDiv, amlSection);
            
            // AML секция для двух адресов
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
            
            // Добавляем обработчики
            setTimeout(() => {
                const fromButton = document.getElementById('aml-check-from-button');
                const toButton = document.getElementById('aml-check-to-button');
                const fromInput = document.getElementById('wallet-address');
                const toInput = document.getElementById('to-wallet-address');
                
                if (fromButton) fromButton.addEventListener('click', () => performAMLCheck('from'));
                if (toButton) toButton.addEventListener('click', () => performAMLCheck('to'));
                if (fromInput) fromInput.addEventListener('input', () => validateCryptoAddresses());
                if (toInput) toInput.addEventListener('input', () => validateCryptoAddresses());
            }, 100);
        }
        if (inputHelp) inputHelp.textContent = 'Проверьте правильность адресов перед отправкой';
        
    } else if (pairType === 'crypto-to-fiat') {
        // Смешанная пара (USDT → RUB) - криптоадрес + AML, затем реквизиты
        if (addressLabel) addressLabel.textContent = 'Адрес криптокошелька для отправки';
        if (addressInput) addressInput.placeholder = 'Введите адрес USDT кошелька';
        if (amlSection) {
            amlSection.style.display = 'block';
            
            // Добавляем поле для реквизитов получения
            const receivingDetailsDiv = document.createElement('div');
            receivingDetailsDiv.className = 'address-input';
            receivingDetailsDiv.innerHTML = `
                <label for="receiving-details">Укажите реквизиты для получения средств</label>
                <div class="input-group">
                    <input type="text" id="receiving-details" placeholder="Номер карты, счета или реквизиты">
                    <button class="scan-button" onclick="scanQR('receiving')">
                        <i class="fas fa-qrcode"></i>
                    </button>
                </div>
                <div class="input-help">
                    Укажите реквизиты для получения фиатных средств
                </div>
            `;
            receivingDetailsDiv.id = 'receiving-details-input';
            amlSection.parentNode.insertBefore(receivingDetailsDiv, amlSection);
            
            // AML секция только для криптоадреса
            amlSection.innerHTML = `
                <div class="aml-checks">
                    <h4>Проверка AML криптоадреса</h4>
                    <button class="secondary-button" id="aml-check-crypto-button" disabled>
                        <i class="fas fa-shield-alt"></i>
                        Проверить криптоадрес на AML
                    </button>
                    <div class="aml-result" id="aml-crypto-result"></div>
                </div>
            `;
            
            // Добавляем обработчики
            setTimeout(() => {
                const cryptoButton = document.getElementById('aml-check-crypto-button');
                const cryptoInput = document.getElementById('wallet-address');
                const receivingInput = document.getElementById('receiving-details');
                
                if (cryptoButton) cryptoButton.addEventListener('click', () => performAMLCheck('crypto'));
                if (cryptoInput) cryptoInput.addEventListener('input', () => validateCryptoToFiatAddresses());
                if (receivingInput) receivingInput.addEventListener('input', () => validateCryptoToFiatAddresses());
            }, 100);
                 }
         if (inputHelp) inputHelp.textContent = 'Сначала укажите криптоадрес, затем реквизиты получения';
         
     } else if (pairType === 'fiat-to-crypto') {
         // Смешанная пара (RUB → USDT) - только кошелек получения + AML
         if (addressLabel) addressLabel.textContent = 'Кошелек для получения криптовалюты';
         if (addressInput) addressInput.placeholder = `Введите адрес ${currentCalculation?.toCurrency || 'USDT'} кошелька`;
         if (amlSection) {
             amlSection.style.display = 'block';
             
             // AML секция только для кошелька получения
             amlSection.innerHTML = `
                 <div class="aml-checks">
                     <h4>Проверка AML кошелька</h4>
                     <button class="secondary-button" id="aml-check-wallet-button" disabled>
                         <i class="fas fa-shield-alt"></i>
                         Проверить кошелек на AML
                     </button>
                     <div class="aml-result" id="aml-wallet-result"></div>
                 </div>
             `;
             
             // Добавляем обработчики
             setTimeout(() => {
                 const walletButton = document.getElementById('aml-check-wallet-button');
                 const walletInput = document.getElementById('wallet-address');
                 
                 if (walletButton) walletButton.addEventListener('click', () => performAMLCheck('wallet'));
                 if (walletInput) walletInput.addEventListener('input', () => validateFiatToCryptoAddresses());
             }, 100);
         }
         if (inputHelp) inputHelp.textContent = 'Укажите адрес кошелька для получения криптовалюты';
         
          } else {
         // Фиатная пара - проверяем специальные случаи
         const isSpecialCase = currentCalculation && (
             (currentCalculation.fromCurrency === 'ARS' && currentCalculation.toCurrency === 'RUB') ||
             (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'KZT') ||
             (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'UAH') ||
             (currentCalculation.fromCurrency === 'UAH' && currentCalculation.toCurrency === 'RUB')
         );
         
         if (isSpecialCase) {
             // Специальные случаи: ARS → RUB, RUB → KZT (переводы на карты)
             if (currentCalculation.fromCurrency === 'ARS' && currentCalculation.toCurrency === 'RUB') {
                 if (addressLabel) addressLabel.textContent = 'Реквизиты для получения рублей';
                 if (addressInput) addressInput.placeholder = 'Номер карты или банковские реквизиты';
                 if (inputHelp) inputHelp.textContent = 'Укажите реквизиты для получения рублей на карту';
             } else if (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'KZT') {
                 if (addressLabel) addressLabel.textContent = 'Реквизиты для получения тенге';
                 if (addressInput) addressInput.placeholder = 'Номер карты или банковские реквизиты';
                 if (inputHelp) inputHelp.textContent = 'Укажите реквизиты для получения тенге на карту';
             } else if (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'UAH') {
                 if (addressLabel) addressLabel.textContent = 'Реквизиты для получения гривен';
                 if (addressInput) addressInput.placeholder = 'Номер карты или банковские реквизиты';
                 if (inputHelp) inputHelp.textContent = 'Укажите реквизиты для получения гривен на карту';
             } else if (currentCalculation.fromCurrency === 'UAH' && currentCalculation.toCurrency === 'RUB') {
                 if (addressLabel) addressLabel.textContent = 'Реквизиты для получения рублей';
                 if (addressInput) addressInput.placeholder = 'Номер карты или банковские реквизиты';
                 if (inputHelp) inputHelp.textContent = 'Укажите реквизиты для получения рублей на карту';
             }
         } else {
             // Обычные фиатные пары (ARS → BRL, etc.)
             if (addressLabel) addressLabel.textContent = 'Номер счета (CVU/Alias)';
             if (addressInput) addressInput.placeholder = 'Введите номер счета';
             if (inputHelp) inputHelp.textContent = 'Проверьте правильность номера счета перед отправкой';
         }
         
         if (amlSection) {
             amlSection.style.display = 'none'; // Скрываем AML для фиатных пар
             amlSection.innerHTML = `
                 <button class="secondary-button" id="aml-check-button">
                     <i class="fas fa-shield-alt"></i>
                     Проверить AML
                 </button>
                 <div class="aml-result" id="aml-result"></div>
             `;
         }
     }
}

// Обновление сводки заявки
function updateOrderSummary() {
    const summary = document.getElementById('order-summary');
    const pairType = getPairType(currentCalculation.fromCurrency, currentCalculation.toCurrency);
    
    let addressSection = '';
    
    if (pairType === 'crypto') {
        // Для криптовалютных пар показываем оба адреса
        const fromAddress = document.getElementById('wallet-address')?.value?.trim() || ''; // адрес отправки
        const toAddress = document.getElementById('to-wallet-address')?.value?.trim() || ''; // адрес получения
        
        if (fromAddress || toAddress) {
            addressSection = `
                <div class="info-section">
                    <h4>🎯 Адреса кошельков</h4>
                    ${fromAddress ? createCopyableElement(fromAddress, 'Адрес отправки', '📤') : ''}
                    ${toAddress ? createCopyableElement(toAddress, 'Адрес получения', '📥') : ''}
                </div>
            `;
        }
    } else if (pairType === 'crypto-to-fiat') {
        // Для смешанных пар показываем криптоадрес и реквизиты
        const cryptoAddress = document.getElementById('wallet-address')?.value?.trim() || '';
        const receivingDetails = document.getElementById('receiving-details')?.value?.trim() || '';
        
        if (cryptoAddress || receivingDetails) {
            addressSection = `
                <div class="info-section">
                    <h4>💰 Детали обмена</h4>
                    ${cryptoAddress ? createCopyableElement(cryptoAddress, 'Криптоадрес отправки', '📤') : ''}
                    ${receivingDetails ? createCopyableElement(receivingDetails, 'Реквизиты получения', '📥') : ''}
                </div>
                         `;
         }
     } else if (pairType === 'fiat-to-crypto') {
         // Для смешанных пар показываем кошелек получения крипты
         const walletAddress = document.getElementById('wallet-address')?.value?.trim() || '';
         
         if (walletAddress) {
             addressSection = `
                 <div class="info-section">
                     <h4>💰 Детали обмена</h4>
                     ${createCopyableElement(walletAddress, 'Кошелек получения', '📥')}
                 </div>
             `;
         }
          } else {
         // Для фиатных пар показываем номер счета или реквизиты
         const account = document.getElementById('wallet-address')?.value?.trim() || '';
         
         if (account) {
             // Проверяем специальные случаи
             const isSpecialCase = (currentCalculation.fromCurrency === 'ARS' && currentCalculation.toCurrency === 'RUB') ||
                                 (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'KZT') ||
                                 (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'UAH') ||
                                 (currentCalculation.fromCurrency === 'UAH' && currentCalculation.toCurrency === 'RUB');
                                 
             if (isSpecialCase) {
                 let currencyName, icon;
                 if (currentCalculation.fromCurrency === 'ARS' && currentCalculation.toCurrency === 'RUB') {
                     currencyName = 'рублей';
                     icon = '💳';
                 } else if (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'KZT') {
                     currencyName = 'тенге';
                     icon = '💳';
                 } else if (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'UAH') {
                     currencyName = 'гривен';
                     icon = '💳';
                 } else if (currentCalculation.fromCurrency === 'UAH' && currentCalculation.toCurrency === 'RUB') {
                     currencyName = 'рублей';
                     icon = '💳';
                 }
                 
                 addressSection = `
                     <div class="info-section">
                         <h4>💳 Реквизиты получения</h4>
                         ${createCopyableElement(account, `Реквизиты для ${currencyName}`, icon)}
                     </div>
                 `;
             } else {
                 addressSection = `
                     <div class="info-section">
                         <h4>🏦 Номер счета</h4>
                         ${createCopyableElement(account, 'CVU/Alias', '💳')}
                     </div>
                 `;
             }
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
    const createButton = document.getElementById('create-order-button');
    const addressInput = document.getElementById('wallet-address');
    const address = addressInput?.value?.trim() || '';
    
    console.log('🔍 ========== НАЧАЛО ВАЛИДАЦИИ ==========');
    console.log('🔍 createButton найдена:', !!createButton);
    console.log('🔍 addressInput найден:', !!addressInput);
    console.log('🔍 address:', address);
    console.log('🔍 currentCalculation:', !!currentCalculation);
    console.log(`🔍 validateWalletAddress: адрес длиной ${address.length} символов`);
    
    if (!currentCalculation) {
        console.log('❌ validateWalletAddress: currentCalculation отсутствует, но проверяем базовую валидацию');
        // Базовая валидация без currentCalculation
        const shouldEnable = address.length > 20;
        console.log('🔍 shouldEnable:', shouldEnable, '(адрес больше 20 символов?)');
        setCreateButtonState(shouldEnable);
        console.log(`🔄 БАЗОВАЯ ВАЛИДАЦИЯ: адрес ${address.length} символов`);
        console.log('🔍 ========== КОНЕЦ БАЗОВОЙ ВАЛИДАЦИИ ==========');
        return;
    }
    
    const pairType = getPairType(currentCalculation.fromCurrency, currentCalculation.toCurrency);
    console.log(`🔍 validateWalletAddress: ${currentCalculation.fromCurrency} → ${currentCalculation.toCurrency} = ${pairType}`);
    
    switch (pairType) {
        case 'crypto':
            validateCryptoAddresses();
            break;
                 case 'crypto-to-fiat':
             validateCryptoToFiatAddresses();
             break;
         case 'fiat-to-crypto':
             validateFiatToCryptoAddresses();
             break;
         case 'fiat':
             validateFiatAccount();
             break;
    }
}

// Валидация криптовалютных адресов (два адреса)
function validateCryptoAddresses() {
    const fromAddress = document.getElementById('wallet-address')?.value?.trim() || ''; // адрес отправки
    const toAddress = document.getElementById('to-wallet-address')?.value?.trim() || ''; // адрес получения
    
    const fromButton = document.getElementById('aml-check-from-button');
    const toButton = document.getElementById('aml-check-to-button');
    const createButton = document.getElementById('create-order-button');
    
    console.log('🔄 ВАЛИДАЦИЯ CRYPTO:', { fromAddress: fromAddress.length, createButton: !!createButton });
    
    // Валидация адреса отправки
    if (fromButton) {
        fromButton.disabled = fromAddress.length <= 20;
    }
    
    // Валидация адреса получения
    if (toButton) {
        toButton.disabled = toAddress.length <= 20;
    }
    
    // Разрешаем создание заявки если основной адрес заполнен
    const shouldEnable = fromAddress.length > 20;
    setCreateButtonState(shouldEnable);
    console.log(`🔄 CRYPTO ВАЛИДАЦИЯ: fromAddress ${fromAddress.length} символов`);
    
    // Обновляем сводку заказа
    if (currentCalculation) {
        updateOrderSummary();
    }
}

// Валидация фиатного счета
function validateFiatAccount() {
    const account = document.getElementById('wallet-address').value.trim();
    const createButton = document.getElementById('create-order-button');
    
    // Определяем тип поля в зависимости от пары
    const isSpecialCase = currentCalculation && (
        (currentCalculation.fromCurrency === 'ARS' && currentCalculation.toCurrency === 'RUB') ||
        (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'KZT') ||
        (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'UAH') ||
        (currentCalculation.fromCurrency === 'UAH' && currentCalculation.toCurrency === 'RUB')
    );
    
    const fieldType = isSpecialCase ? 'реквизиты' : 'номер счета';
    
    console.log(`🏦 ВАЛИДАЦИЯ ФИАТНОГО ${fieldType.toUpperCase()}:`, account, 'длина:', account.length);
    
    if (createButton) {
        // Для фиатных пар требуется только номер счета или реквизиты (минимум 3 символа)
        setCreateButtonState(account.length >= 3);
    }
    
    // Обновляем сводку заказа
    if (currentCalculation) {
        updateOrderSummary();
    }
}

// Валидация смешанных пар (крипто → фиат)
function validateCryptoToFiatAddresses() {
    const cryptoAddress = document.getElementById('wallet-address')?.value?.trim() || ''; // USDT адрес
    const receivingDetails = document.getElementById('receiving-details')?.value?.trim() || ''; // реквизиты получения
    
    const cryptoButton = document.getElementById('aml-check-crypto-button');
    const createButton = document.getElementById('create-order-button');
    
    console.log('🔄 ВАЛИДАЦИЯ CRYPTO-TO-FIAT:', { cryptoAddress: cryptoAddress.length, receivingDetails: receivingDetails.length });
    
    // Валидация криптоадреса для AML
    if (cryptoButton) {
        cryptoButton.disabled = cryptoAddress.length <= 20;
    }
    
    // Разрешаем создание заявки если оба поля заполнены
    if (createButton) {
        setCreateButtonState(cryptoAddress.length > 20 && receivingDetails.length >= 3);
    }
    
    // Обновляем сводку заказа
    if (currentCalculation) {
        updateOrderSummary();
    }
}

// Валидация смешанных пар (фиат → крипто)
function validateFiatToCryptoAddresses() {
    const walletAddress = document.getElementById('wallet-address')?.value?.trim() || ''; // адрес кошелька для получения крипты
    
    const walletButton = document.getElementById('aml-check-wallet-button');
    const createButton = document.getElementById('create-order-button');
    
    console.log('🔄 ВАЛИДАЦИЯ FIAT-TO-CRYPTO:', { walletAddress: walletAddress.length });
    
    // Валидация адреса кошелька для AML
    if (walletButton) {
        walletButton.disabled = walletAddress.length <= 20;
    }
    
    // Разрешаем создание заявки если адрес заполнен
    if (createButton) {
        setCreateButtonState(walletAddress.length > 20);
    }
    
    // Обновляем сводку заказа
    if (currentCalculation) {
        updateOrderSummary();
    }
}

// Выполнение AML проверки
async function performAMLCheck(addressType = 'to') {
    let addressInput;
    
    if (addressType === 'from') {
        addressInput = document.getElementById('wallet-address');
    } else if (addressType === 'to') {
        addressInput = document.getElementById('to-wallet-address');
    } else if (addressType === 'crypto') {
        // Для смешанных пар crypto-to-fiat
        addressInput = document.getElementById('wallet-address');
    } else if (addressType === 'wallet') {
        // Для смешанных пар fiat-to-crypto
        addressInput = document.getElementById('wallet-address');
    } else {
        addressInput = document.getElementById('wallet-address');
    }
    
    const address = addressInput?.value?.trim();
    
    if (!address) {
        let message;
        if (addressType === 'from') {
            message = 'Введите адрес отправки';
        } else if (addressType === 'to') {
            message = 'Введите адрес получения';
        } else if (addressType === 'crypto') {
            message = 'Введите криптоадрес';
        } else if (addressType === 'wallet') {
            message = 'Введите адрес кошелька';
        } else {
            message = 'Введите адрес кошелька';
        }
        showNotification(message, 'warning');
        return;
    }
    
    let amlButton, amlResult;
    
    if (addressType === 'from') {
        amlButton = document.getElementById('aml-check-from-button');
        amlResult = document.getElementById('aml-from-result');
    } else if (addressType === 'to') {
        amlButton = document.getElementById('aml-check-to-button');
        amlResult = document.getElementById('aml-to-result');
    } else if (addressType === 'crypto') {
        amlButton = document.getElementById('aml-check-crypto-button');
        amlResult = document.getElementById('aml-crypto-result');
    } else if (addressType === 'wallet') {
        amlButton = document.getElementById('aml-check-wallet-button');
        amlResult = document.getElementById('aml-wallet-result');
    } else {
        amlButton = document.getElementById('aml-check-button');
        amlResult = document.getElementById('aml-result');
    }
    
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
        let button;
        let buttonText;
        
        if (addressType === 'from') {
            button = document.getElementById('aml-check-from-button');
            buttonText = 'Проверить адрес отправки';
        } else if (addressType === 'to') {
            button = document.getElementById('aml-check-to-button');
            buttonText = 'Проверить адрес получения';
        } else if (addressType === 'crypto') {
            button = document.getElementById('aml-check-crypto-button');
            buttonText = 'Проверить криптоадрес на AML';
        } else if (addressType === 'wallet') {
            button = document.getElementById('aml-check-wallet-button');
            buttonText = 'Проверить кошелек на AML';
        } else {
            button = document.getElementById('aml-check-button');
            buttonText = 'Проверить AML';
        }
        
        if (button) {
            button.disabled = false;
            button.innerHTML = `<i class="fas fa-shield-alt"></i> ${buttonText}`;
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
            setCreateButtonState(fromAddress.length > 20 && toAddress.length > 20);
        } else {
            // Для фиатных пар как раньше
            setCreateButtonState(true);
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
    console.log('🚀 ========== КЛИК ПО КНОПКЕ ЗАЯВКИ ==========');
    console.log('🚀 currentCalculation:', currentCalculation);
    console.log('🚀 currentUserId:', currentUserId);
    
    if (!currentCalculation) {
        console.log('❌ currentCalculation отсутствует! Создаем тестовый расчет.');
        
        // Создаем тестовый currentCalculation
        currentCalculation = {
            fromAmount: 100,
            toAmount: 102.02,
            exchangeRate: 1.0202,
            fee: 0,
            fromCurrency: fromCurrency || 'USDT',
            toCurrency: toCurrency || 'USDT'
        };
        
        console.log('✅ Создан тестовый currentCalculation:', currentCalculation);
    }
    
    // Убеждаемся что userId определен
    if (!currentUserId) {
        console.log('⚠️ currentUserId не определен при создании заявки, устанавливаем тестовый');
        currentUserId = 123456789;
    }
    
    console.log('🔄 Создание заявки с userId:', currentUserId);
    
    const createButton = document.getElementById('create-order-button');
    setCreateButtonState(false);
    createButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создаем заявку...';
    
    try {
        const pairType = getPairType(currentCalculation.fromCurrency, currentCalculation.toCurrency);
        
        // Проверка для фиатных пар - нужен номер счета или реквизиты
        if (pairType === 'fiat') {
            const address = document.getElementById('wallet-address').value.trim();
                         if (!address) {
                 // Определяем тип сообщения в зависимости от пары
                 const isSpecialCase = (currentCalculation.fromCurrency === 'ARS' && currentCalculation.toCurrency === 'RUB') ||
                                     (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'KZT') ||
                                     (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'UAH') ||
                                     (currentCalculation.fromCurrency === 'UAH' && currentCalculation.toCurrency === 'RUB');
                 const message = isSpecialCase ? 'Введите реквизиты для получения' : 'Введите номер счета';
                
                showNotification(message, 'warning');
                setCreateButtonState(true);
                createButton.innerHTML = '<i class="fas fa-check"></i> Создать заявку';
                return;
            }
        }
        
        // Проверка для fiat-to-crypto пар - нужен адрес кошелька
        if (pairType === 'fiat-to-crypto') {
            const address = document.getElementById('wallet-address').value.trim();
            if (!address) {
                showNotification('Введите адрес кошелька', 'warning');
                setCreateButtonState(true);
                createButton.innerHTML = '<i class="fas fa-check"></i> Создать заявку';
                return;
            }
        }
        
        let orderData;
        
        if (pairType === 'crypto') {
            // Для криптовалютных пар
            const fromAddress = document.getElementById('wallet-address')?.value?.trim() || ''; // адрес отправки
            const toAddress = document.getElementById('to-wallet-address')?.value?.trim() || ''; // адрес получения
            
            if (!fromAddress) {
                showNotification('Введите адрес отправки', 'warning');
                return;
            }
            
            if (!toAddress) {
                showNotification('Введите адрес получения', 'warning');
                return;
            }
            
            orderData = {
                userId: currentUserId,
                fromCurrency: currentCalculation.fromCurrency,
                toCurrency: currentCalculation.toCurrency,
                fromAmount: currentCalculation.fromAmount,
                toAmount: currentCalculation.toAmount,
                fromAddress: fromAddress,
                toAddress: toAddress,
                exchangeRate: currentCalculation.exchangeRate,
                fee: currentCalculation.fee,
                amlFromResult: currentFromAMLResult || { status: 'not_checked', risk: 'unknown' },
                amlToResult: currentToAMLResult || { status: 'not_checked', risk: 'unknown' },
                pairType: 'crypto'
            };
        } else if (pairType === 'crypto-to-fiat') {
            // Для смешанных пар (USDT → RUB)
            const cryptoAddress = document.getElementById('wallet-address')?.value?.trim() || ''; // USDT адрес
            const receivingDetails = document.getElementById('receiving-details')?.value?.trim() || ''; // реквизиты получения
            
            if (!cryptoAddress) {
                showNotification('Введите криптоадрес', 'warning');
                setCreateButtonState(true);
                createButton.innerHTML = '<i class="fas fa-check"></i> Создать заявку';
                return;
            }
            
            if (!receivingDetails) {
                showNotification('Введите реквизиты для получения', 'warning');
                setCreateButtonState(true);
                createButton.innerHTML = '<i class="fas fa-check"></i> Создать заявку';
                return;
            }
            
            console.log('🔄 СОЗДАНИЕ CRYPTO-TO-FIAT ЗАЯВКИ:', { cryptoAddress, receivingDetails });
            orderData = {
                userId: currentUserId,
                fromCurrency: currentCalculation.fromCurrency,
                toCurrency: currentCalculation.toCurrency,
                fromAmount: currentCalculation.fromAmount,
                toAmount: currentCalculation.toAmount,
                fromAddress: cryptoAddress, // USDT адрес
                toAddress: receivingDetails, // реквизиты получения
                exchangeRate: currentCalculation.exchangeRate,
                fee: currentCalculation.fee,
                amlFromResult: currentFromAMLResult || { status: 'not_checked', risk: 'unknown' },
                amlToResult: { status: 'not_required', risk: 'none' }, // для фиатных реквизитов AML не нужен
                pairType: 'crypto-to-fiat'
            };
            console.log('🔄 ФИНАЛЬНЫЕ ДАННЫЕ CRYPTO-TO-FIAT ЗАЯВКИ:', orderData);
        } else if (pairType === 'fiat-to-crypto') {
            // Для смешанных пар (RUB → USDT)
            const walletAddress = document.getElementById('wallet-address')?.value?.trim() || ''; // кошелек получения крипты
            
            if (!walletAddress) {
                showNotification('Введите адрес кошелька', 'warning');
                setCreateButtonState(true);
                createButton.innerHTML = '<i class="fas fa-check"></i> Создать заявку';
                return;
            }
            
            console.log('🔄 СОЗДАНИЕ FIAT-TO-CRYPTO ЗАЯВКИ:', { walletAddress });
            orderData = {
                userId: currentUserId,
                fromCurrency: currentCalculation.fromCurrency,
                toCurrency: currentCalculation.toCurrency,
                fromAmount: currentCalculation.fromAmount,
                toAmount: currentCalculation.toAmount,
                fromAddress: '', // Реквизиты отправки будут заполнены оператором
                toAddress: walletAddress, // кошелек получения крипты
                exchangeRate: currentCalculation.exchangeRate,
                fee: currentCalculation.fee,
                amlFromResult: { status: 'not_required', risk: 'none' }, // для фиатных средств AML не нужен
                amlToResult: currentFromAMLResult || { status: 'not_checked', risk: 'unknown' }, // AML кошелька получения
                pairType: 'fiat-to-crypto'
            };
            console.log('🔄 ФИНАЛЬНЫЕ ДАННЫЕ FIAT-TO-CRYPTO ЗАЯВКИ:', orderData);
                } else {
             // Для фиатных пар
             const address = document.getElementById('wallet-address').value.trim(); // номер счета или реквизиты
             
             // Специальная логика для переводов на карты
             const isSpecialCase = (currentCalculation.fromCurrency === 'ARS' && currentCalculation.toCurrency === 'RUB') ||
                                 (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'KZT') ||
                                 (currentCalculation.fromCurrency === 'RUB' && currentCalculation.toCurrency === 'UAH') ||
                                 (currentCalculation.fromCurrency === 'UAH' && currentCalculation.toCurrency === 'RUB');
                                 
             if (isSpecialCase) {
                 const pairName = `${currentCalculation.fromCurrency}→${currentCalculation.toCurrency}`;
                 console.log(`💳 СОЗДАНИЕ ${pairName} ЗАЯВКИ - реквизиты:`, address);
                 orderData = {
                     userId: currentUserId,
                     fromCurrency: currentCalculation.fromCurrency,
                     toCurrency: currentCalculation.toCurrency,
                     fromAmount: currentCalculation.fromAmount,
                     toAmount: currentCalculation.toAmount,
                     fromAddress: '', // Будет заполнено оператором
                     toAddress: address, // Реквизиты для получения средств
                     exchangeRate: currentCalculation.exchangeRate,
                     fee: currentCalculation.fee,
                     pairType: 'fiat'
                 };
                 console.log(`💳 ФИНАЛЬНЫЕ ДАННЫЕ ${pairName} ЗАЯВКИ:`, orderData);
             } else {
                 console.log('🏦 СОЗДАНИЕ ФИАТНОЙ ЗАЯВКИ - номер счета:', address);
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
                 console.log('🏦 ФИНАЛЬНЫЕ ДАННЫЕ ФИАТНОЙ ЗАЯВКИ:', orderData);
             }
         }
        
        console.log('🚀 ========== ОТПРАВКА ЗАЯВКИ НА СЕРВЕР ==========');
        console.log('📋 Данные заявки:', orderData);
        console.log('📋 JSON для отправки:', JSON.stringify(orderData, null, 2));
        
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
            console.log('🚀 ========== ЗАЯВКА УСПЕШНО СОЗДАНА ==========');
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
        console.error('🚀 ========== ОШИБКА СОЗДАНИЯ ЗАЯВКИ ==========');
        console.error('🚀 Тип ошибки:', error.name);
        console.error('🚀 Сообщение ошибки:', error.message);
        console.error('🚀 Полная ошибка:', error);
        console.error('❌ Ошибка создания заявки:', error);
        showNotification('Ошибка создания заявки. Попробуйте позже.', 'error');
    } finally {
        console.log('🚀 ========== ЗАВЕРШЕНИЕ СОЗДАНИЯ ЗАЯВКИ ==========');
        setCreateButtonState(true);
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
    console.log('👤 Обновление отображения профиля...');
    console.log('📱 tg:', tg ? 'доступен' : 'недоступен');
    console.log('👤 currentUserId:', currentUserId);
    console.log('📄 userProfile:', userProfile);
    
    try {
        // Получаем данные пользователя из Telegram WebApp API
        const telegramUser = tg?.initDataUnsafe?.user;
        console.log('📱 telegramUser:', telegramUser);
        
        // Основная информация (приоритет данным из Telegram)
        const firstName = telegramUser?.first_name || userProfile?.first_name || 'Пользователь';
        const lastName = telegramUser?.last_name || userProfile?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const username = telegramUser?.username || userProfile?.username || `user${currentUserId}`;
        
        console.log('✨ Данные для отображения:', { firstName, lastName, fullName, username });
    
    // Обновляем имя в заголовке (ПРИОРИТЕТ!)
    const headerUserName = document.getElementById('header-user-name');
    if (headerUserName) {
        headerUserName.textContent = firstName;
        console.log('✅ Обновлен header-user-name:', firstName);
    } else {
        console.log('⚠️ Элемент header-user-name не найден');
    }
    
    // Обновляем профиль (если элементы существуют)
    const profileName = document.getElementById('profile-name');
    const profileUsername = document.getElementById('profile-username');
    
    if (profileName) {
        profileName.textContent = fullName;
        console.log('✅ Обновлен profile-name:', fullName);
    } else {
        console.log('⚠️ Элемент profile-name не найден');
    }
    
    if (profileUsername) {
        profileUsername.textContent = `@${username}`;
        console.log('✅ Обновлен profile-username:', `@${username}`);
    } else {
        console.log('⚠️ Элемент profile-username не найден');
    }
    
    // Обновляем статус профиля
    const profileStatus = document.querySelector('.profile-status');
    if (profileStatus) {
        if (currentUserId && currentUserId !== 123456789) {
            profileStatus.textContent = '✅ Верифицирован';
            profileStatus.className = 'profile-status verified';
        } else {
            profileStatus.textContent = 'Гость';
            profileStatus.className = 'profile-status guest';
        }
        console.log('✅ Обновлен статус профиля');
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
            console.log('🖼️ Создаем аватар с инициалами');
            // 🎨 ПРАВИЛЬНЫЙ АВАТАР С ИНИЦИАЛАМИ ЧЕРЕЗ SVG
            const initials = firstName.charAt(0) + (lastName.charAt(0) || '');
            const svgAvatar = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#007AFF;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#34C759;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <circle cx="20" cy="20" r="20" fill="url(#grad)" />
                    <text x="20" y="26" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="white">${initials}</text>
                </svg>
            `)}`;
            avatarImg.src = svgAvatar;
            console.log('✅ SVG аватар создан с инициалами:', initials);
        }
    } else {
        console.log('⚠️ Элемент avatar-image не найден');
    }
    
    console.log('✅ Обновление профиля завершено');
    
    } catch (error) {
        console.error('❌ Ошибка в updateProfileDisplay:', error);
        // Базовая защита - хотя бы имя показываем
        try {
            const headerUserName = document.getElementById('header-user-name');
            if (headerUserName && !headerUserName.textContent) {
                headerUserName.textContent = 'Пользователь';
            }
        } catch (e) {
            console.error('❌ Критическая ошибка профиля:', e);
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
        } else if (screenId === 'order-screen') {
            // Запускаем валидацию кнопки заявки при показе экрана
            setTimeout(() => {
                console.log('🔄 Экран заявки показан, запускаем валидацию...');
                const addressField = document.getElementById('wallet-address');
                const address = addressField?.value?.trim() || '';
                console.log('🔍 Текущий адрес в поле:', address);
                
                // Принудительная валидация состояния кнопки
                setCreateButtonState(address.length > 20);
                validateWalletAddress();
                
                // 🔧 АВТОМАТИЧЕСКАЯ ДИАГНОСТИКА КНОПКИ
                const createOrderButton = document.getElementById('create-order-button');
                if (createOrderButton) {
                    console.log('🔧 ========== АВТОМАТИЧЕСКАЯ ДИАГНОСТИКА ==========');
                    console.log('🔧 Кнопка найдена на экране заявки');
                    console.log('🔧 Disabled:', createOrderButton.disabled);
                    console.log('🔧 ClassName:', createOrderButton.className);
                    console.log('🔧 Style pointer-events:', getComputedStyle(createOrderButton).pointerEvents);
                    console.log('🔧 Style z-index:', getComputedStyle(createOrderButton).zIndex);
                    console.log('🔧 Parent element:', createOrderButton.parentElement.tagName);
                    
                    // Проверяем перекрытие
                    const rect = createOrderButton.getBoundingClientRect();
                    const elementAtCenter = document.elementFromPoint(
                        rect.left + rect.width / 2, 
                        rect.top + rect.height / 2
                    );
                    console.log('🔧 Элемент в центре кнопки:', elementAtCenter === createOrderButton ? 'КНОПКА' : elementAtCenter);
                    
                    // Добавляем МАКСИМАЛЬНО простой onclick
                    createOrderButton.onclick = function(event) {
                        console.log('🔥 ========== ПРОСТОЙ ONCLICK СРАБОТАЛ ==========');
                        console.log('🔥 Event:', event);
                        console.log('🔥 Запускаем createOrder...');
                        try {
                            createOrder();
                        } catch (error) {
                            console.error('🔥 Ошибка в createOrder:', error);
                            alert('Ошибка createOrder: ' + error.message);
                        }
                    };
                    
                    // Убираем все блокировки принудительно
                    createOrderButton.style.setProperty('pointer-events', 'auto', 'important');
                    createOrderButton.style.setProperty('cursor', 'pointer', 'important');
                    createOrderButton.style.setProperty('z-index', '999999', 'important');
                    createOrderButton.disabled = false;
                    createOrderButton.removeAttribute('disabled');
                    createOrderButton.classList.remove('disabled');
                    
                    console.log('✅ ПРОСТОЙ ONCLICK ДОБАВЛЕН + УБРАНЫ ВСЕ БЛОКИРОВКИ');
                } else {
                    console.error('❌ Кнопка НЕ НАЙДЕНА на экране заявки!');
                }
            }, 100);
            
            // 🧪 ТЕСТОВАЯ АКТИВАЦИЯ ЧЕРЕЗ 2 СЕКУНДЫ
            setTimeout(() => {
                console.log('🧪 ЗАПУСКАЕМ ТЕСТОВУЮ АКТИВАЦИЮ КНОПКИ...');
                testCreateButton();
            }, 2000);
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
    console.log('💰 НАЖАЛИ: Обмен наличных');
    console.log('👤 currentUserId:', currentUserId);
    createSupportTicket('Обмен наличных', 'Заявка на обмен физических денег в офисах. Клиент интересуется обменом наличных валют.');
}

// Обмен без AML
function requestNoAMLExchange() {
    console.log('🚫 НАЖАЛИ: Обмен без AML');
    console.log('👤 currentUserId:', currentUserId);
    createSupportTicket('Обмен без AML', 'Заявка на быстрый обмен без AML проверки. Клиент хочет выполнить обмен без детальной проверки адресов.');
}

// 🌟 ОТЗЫВЫ - ПРАВИЛЬНЫЙ ПЕРЕХОД В ТЕЛЕГРАМ
function openReviews() {
    const reviewsUrl = 'https://t.me/ExMachinaXReviews';
    
    console.log('📝 Открываем отзывы в Telegram:', reviewsUrl);
    
    try {
        // 🚀 ПРИНУДИТЕЛЬНОЕ ОТКРЫТИЕ В TELEGRAM БЕЗ БРАУЗЕРА
        console.log('📱 Тестируем доступные методы Telegram WebApp:');
        console.log('- tg.openLink:', typeof tg?.openLink);
        console.log('- tg.openTelegramLink:', typeof tg?.openTelegramLink);
        console.log('- tg.switchInlineQuery:', typeof tg?.switchInlineQuery);
        
        // Используем haptic feedback для подтверждения
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
        
        // Прямой переход без использования tg.openLink (чтобы избежать браузера)
        console.log('🔗 ПРЯМОЙ переход в Telegram приложение');
        window.location.href = reviewsUrl;
        
        showNotification('Открываем группу отзывов...', 'success');
        console.log('✅ Переход к отзывам выполнен');
    } catch (error) {
        console.error('❌ Ошибка открытия отзывов:', error);
        // Принудительный fallback
        try {
            window.location.href = reviewsUrl;
        } catch (e) {
            console.error('❌ Критическая ошибка перехода:', e);
            showNotification('Ошибка перехода. Откройте: @ExMachinaXReviews', 'error');
        }
    }
}

// OTC торговля
function requestOTCTrading() {
    console.log('📈 НАЖАЛИ: OTC торговля');
    console.log('👤 currentUserId:', currentUserId);
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
        console.log('🎫 СОЗДАНИЕ ЗАЯВКИ ПОДДЕРЖКИ:');
        console.log('📂 Тема:', subject);
        console.log('💬 Сообщение:', message);
        console.log('👤 currentUserId:', currentUserId);
        
        if (!currentUserId) {
            console.error('❌ currentUserId отсутствует!');
            showNotification('Ошибка: пользователь не авторизован', 'error');
            return;
        }
        
        showNotification('Создаем заявку в поддержку...', 'info');
        
        const requestBody = {
            userId: currentUserId,
            source: tg ? 'webapp_telegram' : 'webapp_browser',
            subject: subject,
            message: message,
            timestamp: new Date().toISOString()
        };
        
        console.log('📤 Отправляем данные:', requestBody);
        
        const response = await fetch('/api/support-ticket', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('📥 Ответ сервера - статус:', response.status);
        const data = await response.json();
        console.log('📥 Ответ сервера - данные:', data);
        
        if (data.success) {
            showNotification('Заявка создана! Мы свяжемся с вами в ближайшее время.', 'success');
            console.log('✅ Тикет поддержки создан:', data.data);
        } else {
            throw new Error(data.error || 'Ошибка создания заявки');
        }
        
    } catch (error) {
        console.error('❌ Ошибка создания заявки в поддержку:', error);
        showNotification('Ошибка создания заявки. Пишите @ExMachinaXSupport', 'error');
        
        // Откатываемся к старому способу
        if (window && window.open) {
            setTimeout(() => {
                window.open('https://t.me/ExMachinaXSupport', '_blank');
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

        console.log('✅ ExMachinaX App загружено успешно!');

// 🤖 АВТООТПРАВКА РЕКВИЗИТОВ - НОВАЯ СИСТЕМА  
window.showOrderRequisites = function(orderId, paymentMethod, orderData) {
    const requisites = {
        'Bybit UID': {
            type: 'crypto_platform',
            name: 'Bybit UID',
            address: '47028037',
            network: 'Bybit Exchange',
            currency: 'USDT/USDC/BTC/ETH',
            emoji: '💰'
        },
        'Сбербанк': {
            type: 'bank_card',
            name: 'Сбербанк',
            card: '2202 2006 7890 1234',
            holder: 'АЛЕКСЕЙ ПЕТРОВ',
            emoji: '🟢'
        },
        'Т банк': {
            type: 'bank_card', 
            name: 'Т-Банк',
            card: '5536 9138 4567 8901',
            holder: 'АЛЕКСЕЙ ПЕТРОВ',
            emoji: '🟡'
        },
        'СБП': {
            type: 'bank_transfer',
            name: 'СБП',
            phone: '+7 900 123 45 67',
            holder: 'АЛЕКСЕЙ ПЕТРОВ',
            emoji: '⚡'
        }
    };
    
    const requisite = requisites[paymentMethod];
    if (!requisite) return;
    
    const modalHtml = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;" id="requisites-modal">
            <div style="background: white; border-radius: 12px; padding: 20px; max-width: 400px; width: 90%;">
                <h3>${requisite.emoji} Реквизиты для оплаты</h3>
                <p><strong>Заказ #${orderId}</strong></p>
                <p><strong>К оплате:</strong> ${orderData.fromAmount} ${orderData.fromCurrency}</p>
                <p><strong>К получению:</strong> ${orderData.toAmount} ${orderData.toCurrency}</p>
                <hr>
                <p><strong>${requisite.name}</strong></p>
                ${requisite.type === 'crypto_platform' ? `
                    <p><strong>UID:</strong> <code style="background: #f0f0f0; padding: 4px; border-radius: 4px;">${requisite.address}</code></p>
                ` : requisite.type === 'bank_card' ? `
                    <p><strong>Карта:</strong> <code style="background: #f0f0f0; padding: 4px; border-radius: 4px;">${requisite.card}</code></p>
                    <p><strong>Владелец:</strong> ${requisite.holder}</p>
                ` : `
                    <p><strong>Телефон:</strong> <code style="background: #f0f0f0; padding: 4px; border-radius: 4px;">${requisite.phone}</code></p>
                    <p><strong>Получатель:</strong> ${requisite.holder}</p>
                `}
                <button onclick="document.getElementById('requisites-modal').remove()" style="width: 100%; padding: 12px; background: #007AFF; color: white; border: none; border-radius: 8px; margin-top: 10px;">
                    ✅ Понятно
                </button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}; 

// 🚀 БЫСТРОЕ СКРЫТИЕ ЗАГРУЗОЧНОГО ЭКРАНА
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.getElementById('app');
    
    if (loadingScreen && !loadingScreen.hasAttribute('data-hidden')) {
        loadingScreen.setAttribute('data-hidden', 'true');
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
}

// 🌐 ФУНКЦИЯ ДЛЯ ПОКАЗА СООБЩЕНИЯ О САЙТЕ В РАЗРАБОТКЕ
function showWebsiteMessage() {
    if (tg && tg.showAlert) {
        // Используем Telegram WebApp API
        tg.showAlert('🚧 Сайт находится в разработке\n\nСкоро будет доступен полный функционал!');
    } else {
        // Обычный alert для браузера
        alert('🚧 Сайт находится в разработке\n\nСкоро будет доступен полный функционал!');
    }
    
    console.log('🌐 Показано сообщение о сайте в разработке');
    
    // Убираем активный класс с кнопки сайта
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Возвращаем активный класс на главную
    document.querySelector('[data-screen="calculator-screen"]').classList.add('active');
}

// 🎨 ПРИМЕНЕНИЕ ТЕМЫ TELEGRAM
function applyTelegramTheme() {
    if (!tg || !tg.themeParams) {
        console.log('🎨 Тема Telegram недоступна, используем стандартную');
        return;
    }
    
    try {
        const theme = tg.themeParams;
        console.log('🎨 Применяем тему Telegram:', tg.colorScheme);
        
        // Применяем цвета темы
        if (theme.bg_color) {
            document.documentElement.style.setProperty('--tg-theme-bg-color', theme.bg_color);
        }
        if (theme.text_color) {
            document.documentElement.style.setProperty('--tg-theme-text-color', theme.text_color);
        }
        if (theme.hint_color) {
            document.documentElement.style.setProperty('--tg-theme-hint-color', theme.hint_color);
        }
        if (theme.link_color) {
            document.documentElement.style.setProperty('--tg-theme-link-color', theme.link_color);
        }
        if (theme.button_color) {
            document.documentElement.style.setProperty('--tg-theme-button-color', theme.button_color);
        }
        if (theme.button_text_color) {
            document.documentElement.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
        }
        
        console.log('✅ Тема Telegram применена');
    } catch (error) {
        console.error('❌ Ошибка применения темы:', error);
    }
}

// 🎨 РУЧНАЯ СМЕНА ТЕМЫ
function switchTheme(theme) {
    console.log('🎨 Переключение темы на:', theme);
    
    const root = document.documentElement;
    
    // Удаляем все классы тем
    root.classList.remove('theme-light', 'theme-dark', 'theme-auto');
    
    if (theme === 'light') {
        root.classList.add('theme-light');
        console.log('☀️ Включена светлая тема');
    } else if (theme === 'dark') {
        root.classList.add('theme-dark');
        console.log('🌙 Включена темная тема');
    } else {
        // Авто - используем тему Telegram
        root.classList.add('theme-auto');
        applyTelegramTheme();
        console.log('🤖 Автоматическая тема (Telegram)');
    }
    
    // Сохраняем в localStorage
    try {
        localStorage.setItem('theme', theme);
        console.log('✅ Тема сохранена:', theme);
    } catch (error) {
        console.error('❌ Ошибка сохранения темы:', error);
    }
}

// 🔄 ЗАГРУЗКА ТЕМЫ ИЗ НАСТРОЕК
function loadTheme() {
    try {
        const savedTheme = localStorage.getItem('theme') || 'auto';
        console.log('📥 Загружаем сохраненную тему:', savedTheme);
        
        // Устанавливаем значение в селекте
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = savedTheme;
            
            // Добавляем обработчик изменения
            themeSelect.addEventListener('change', function() {
                switchTheme(this.value);
            });
        }
        
        // Применяем тему
        switchTheme(savedTheme);
    } catch (error) {
        console.error('❌ Ошибка загрузки темы:', error);
        switchTheme('auto'); // По умолчанию
    }
}

// 🔗 ГЕНЕРАЦИЯ РЕФЕРАЛЬНОЙ ССЫЛКИ
function generateReferralLink() {
    try {
        if (!currentUserId) {
            console.log('⚠️ User ID не найден, используем тестовый');
            currentUserId = 123456789;
        }
        
        // Генерируем реферальную ссылку
        const referralLink = `https://t.me/ExMachinaXBot?start=ref_${currentUserId}`;
        console.log('🔗 Сгенерирована реферальная ссылка:', referralLink);
        
        // Заполняем поле
        const referralInput = document.getElementById('referral-link-input');
        if (referralInput) {
            referralInput.value = referralLink;
            console.log('✅ Реферальная ссылка заполнена в поле');
        }
        
        return referralLink;
    } catch (error) {
        console.error('❌ Ошибка генерации реферальной ссылки:', error);
        return null;
    }
}

// 📋 КОПИРОВАНИЕ РЕФЕРАЛЬНОЙ ССЫЛКИ
function copyReferralLink() {
    try {
        const referralInput = document.getElementById('referral-link-input');
        if (!referralInput || !referralInput.value) {
            console.log('⚠️ Реферальная ссылка не найдена, генерируем...');
            generateReferralLink();
        }
        
        const link = referralInput.value;
        
        // Пытаемся скопировать через Telegram API
        if (tg && tg.writeToClipboard) {
            tg.writeToClipboard(link);
            showNotification('🔗 Реферальная ссылка скопирована!', 'success');
            console.log('✅ Ссылка скопирована через Telegram API');
            return;
        }
        
        // Фоллбэк - обычное копирование
        if (navigator.clipboard) {
            navigator.clipboard.writeText(link).then(() => {
                showNotification('🔗 Реферальная ссылка скопирована!', 'success');
                console.log('✅ Ссылка скопирована через Clipboard API');
            }).catch(error => {
                console.error('❌ Ошибка копирования:', error);
                fallbackCopy(link);
            });
        } else {
            fallbackCopy(link);
        }
    } catch (error) {
        console.error('❌ Ошибка копирования реферальной ссылки:', error);
        showNotification('❌ Ошибка копирования', 'error');
    }
}

// 📋 ФОЛЛБЭК КОПИРОВАНИЕ
function fallbackCopy(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            showNotification('🔗 Реферальная ссылка скопирована!', 'success');
            console.log('✅ Ссылка скопирована через execCommand');
        } else {
            showNotification('❌ Не удалось скопировать', 'error');
            console.log('❌ Не удалось скопировать через execCommand');
        }
    } catch (error) {
        console.error('❌ Ошибка фоллбэк копирования:', error);
        showNotification('❌ Ошибка копирования', 'error');
    }
}

// ⚙️ СОХРАНЕНИЕ НАСТРОЕК
function saveSettings() {
    try {
        console.log('💾 Сохранение настроек...');
        
        // Сохраняем тему
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            localStorage.setItem('theme', themeSelect.value);
            console.log('✅ Тема сохранена:', themeSelect.value);
        }
        
        // Сохраняем уведомления
        const notificationsEnabled = document.getElementById('notifications-enabled');
        if (notificationsEnabled) {
            localStorage.setItem('notifications', notificationsEnabled.checked);
            console.log('✅ Настройки уведомлений сохранены:', notificationsEnabled.checked);
        }
        
        // Сохраняем язык
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            localStorage.setItem('language', languageSelect.value);
            console.log('✅ Язык сохранен:', languageSelect.value);
        }
        
        showNotification('✅ Настройки сохранены!', 'success');
        console.log('✅ Все настройки сохранены');
        
    } catch (error) {
        console.error('❌ Ошибка сохранения настроек:', error);
        showNotification('❌ Ошибка сохранения настроек', 'error');
    }
}

// 📥 ЗАГРУЗКА НАСТРОЕК
function loadSettings() {
    try {
        console.log('📥 Загрузка настроек...');
        
        // Загружаем тему
        loadTheme();
        
        // Загружаем уведомления
        const savedNotifications = localStorage.getItem('notifications');
        if (savedNotifications !== null) {
            const notificationsEnabled = document.getElementById('notifications-enabled');
            if (notificationsEnabled) {
                notificationsEnabled.checked = savedNotifications === 'true';
                console.log('✅ Настройки уведомлений загружены:', savedNotifications);
            }
        }
        
        // Загружаем язык
        const savedLanguage = localStorage.getItem('language');
        if (savedLanguage) {
            const languageSelect = document.getElementById('language-select');
            if (languageSelect) {
                languageSelect.value = savedLanguage;
                console.log('✅ Язык загружен:', savedLanguage);
            }
        }
        
        console.log('✅ Все настройки загружены');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки настроек:', error);
    }
}

// 📤 ЭКСПОРТ ДАННЫХ
function exportData() {
    try {
        console.log('📤 Экспорт данных пользователя...');
        
        const userData = {
            userId: currentUserId,
            profile: userProfile,
            favorites: favoriteCurrencies,
            settings: {
                theme: localStorage.getItem('theme'),
                notifications: localStorage.getItem('notifications'),
                language: localStorage.getItem('language')
            },
            timestamp: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(userData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `exmachinax_data_${currentUserId}_${Date.now()}.json`;
        link.click();
        
        showNotification('📤 Данные экспортированы!', 'success');
        console.log('✅ Данные экспортированы');
        
    } catch (error) {
        console.error('❌ Ошибка экспорта данных:', error);
        showNotification('❌ Ошибка экспорта данных', 'error');
    }
}

// 🚀 ИНИЦИАЛИЗАЦИЯ НАСТРОЕК И РЕФЕРАЛЬНОЙ ССЫЛКИ
document.addEventListener('DOMContentLoaded', function() {
    // Добавляем к существующей инициализации
    setTimeout(() => {
        loadSettings();
        generateReferralLink();
        console.log('🚀 Настройки и реферальная ссылка инициализированы');
    }, 1000);
});

// 🧪 ОТЛАДОЧНАЯ ФУНКЦИЯ - ПРИНУДИТЕЛЬНАЯ АКТИВАЦИЯ КНОПКИ
function testCreateButton() {
    const createButton = document.getElementById('create-order-button');
    if (createButton) {
        console.log('🧪 ========== ДИАГНОСТИКА КНОПКИ ==========');
        console.log('🧪 Disabled:', createButton.disabled);
        console.log('🧪 ClassName:', createButton.className);
        console.log('🧪 Style display:', getComputedStyle(createButton).display);
        console.log('🧪 Style pointerEvents:', getComputedStyle(createButton).pointerEvents);
        console.log('🧪 Style zIndex:', getComputedStyle(createButton).zIndex);
        console.log('🧪 Style position:', getComputedStyle(createButton).position);
        console.log('🧪 Parent element:', createButton.parentElement);
        console.log('🧪 Rect:', createButton.getBoundingClientRect());
        
        createButton.removeAttribute('disabled');
        createButton.classList.remove('disabled');
        createButton.style.background = '#28a745 !important';
        createButton.style.cursor = 'pointer !important';
        createButton.style.pointerEvents = 'auto !important';
        createButton.style.opacity = '1 !important';
        createButton.style.zIndex = '9999 !important';
        createButton.style.position = 'relative !important';
        
        // 🔥 ПРИНУДИТЕЛЬНОЕ ПЕРЕОПРЕДЕЛЕНИЕ ВСЕХ CSS БЛОКИРОВОК
        createButton.style.setProperty('pointer-events', 'auto', 'important');
        createButton.style.setProperty('cursor', 'pointer', 'important');
        createButton.style.setProperty('background', '#28a745', 'important');
        createButton.style.setProperty('opacity', '1', 'important');
        
        // Убираем класс и атрибут disabled принудительно
        createButton.removeAttribute('disabled');
        createButton.disabled = false;
        createButton.classList.remove('disabled');
        
        console.log('🧪 ТЕСТОВАЯ КНОПКА АКТИВИРОВАНА ПРИНУДИТЕЛЬНО!');
        console.log('🧪 Новый style pointerEvents:', getComputedStyle(createButton).pointerEvents);
        console.log('🧪 Новый disabled атрибут:', createButton.disabled);
        console.log('🧪 Новые классы:', createButton.className);
    } else {
        console.log('❌ Кнопка create-order-button не найдена!');
    }
}

// Управление состоянием кнопки создания заявки
function setCreateButtonState(enabled) {
    const createButton = document.getElementById('create-order-button');
    if (createButton) {
        console.log('🔧 ========== ИЗМЕНЕНИЕ СОСТОЯНИЯ КНОПКИ ==========');
        console.log('🔧 Текущее состояние disabled:', createButton.disabled);
        console.log('🔧 Текущие классы:', createButton.className);
        console.log('🔧 Запрошенное состояние:', enabled);
        
        if (enabled) {
            createButton.removeAttribute('disabled');
            createButton.classList.remove('disabled');
            console.log('🔧 ✅ АКТИВИРОВАЛИ кнопку');
        } else {
            createButton.setAttribute('disabled', 'disabled');
            createButton.classList.add('disabled');
            console.log('🔧 ❌ ДЕАКТИВИРОВАЛИ кнопку');
        }
        
        console.log('🔧 Новое состояние disabled:', createButton.disabled);
        console.log('🔧 Новые классы:', createButton.className);
        console.log(`🔄 КНОПКА ЗАЯВКИ: ${enabled ? '✅ АКТИВНА' : '❌ НЕАКТИВНА'}`);
        console.log('🔧 ========== КОНЕЦ ИЗМЕНЕНИЯ СОСТОЯНИЯ ==========');
    } else {
        console.log('❌ setCreateButtonState: кнопка не найдена!');
    }
}