console.log("🚀 APP.JS ЗАГРУЖАЕТСЯ!");

// ⚡ СВЕРХБЫСТРАЯ ЗАГРУЗКА КУРСОВ (ДО DOM!)
console.log("⚡ Запускаем загрузку курсов сразу при загрузке скрипта!");

// Функция ранней загрузки из кеша
function loadCachedRatesEarly() {
    try {
        const cachedRates = localStorage.getItem('cachedRates');
        const cacheTime = localStorage.getItem('ratesCacheTime');
        
        if (cachedRates && cacheTime) {
            const cacheAge = Date.now() - parseInt(cacheTime);
            // Используем кеш если он свежее 2 минут
            if (cacheAge < 120000) {
                console.log('⚡ МГНОВЕННО загружаем курсы из кеша!');
                const cached = JSON.parse(cachedRates);
                currentRates = cached.rates || [];
                window.rawPairData = cached.rawPairs || [];
                console.log('✅ Курсы из кеша загружены до DOM!', currentRates.length, 'валют');
                return true;
            }
        }
    } catch (error) {
        console.log('⚠️ Ошибка раннего кеша:', error.message);
    }
    return false;
}

// Запускаем раннюю загрузку сразу!
loadCachedRatesEarly();

let earlyRatesPromise = null;

// Глобальные переменные
let tg = window.Telegram?.WebApp;
let currentUserId = null;
let currentUserData = null; // Добавляем данные пользователя
let currentRates = [];
let fromCurrency = null; // Убираем дефолтные BTC
let toCurrency = null; // Убираем дефолтные USDT
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
    if (!currentUserId) {
        favoriteCurrencies = ['BTC', 'USDT', 'RUB'];
        return;
    }
    
    fetch(`/api/favorites/${currentUserId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                favoriteCurrencies = data.data;
                updateCurrencyList();
            }
        })
        .catch(() => {
            favoriteCurrencies = ['BTC', 'USDT', 'RUB'];
        });
}

function saveFavorites() {
    console.log("💾 Сохраняем избранные валюты, currentUserId:", currentUserId, "favorites:", favoriteCurrencies);
    if (!currentUserId) return;
    
    fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, favorites: favoriteCurrencies })
    }).catch(console.error);
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
    
    // 🔧 ГЛОБАЛЬНАЯ ФУНКЦИЯ ДЛЯ ТЕСТИРОВАНИЯ ИНТЕРФЕЙСА БЕЗ AML
    window.testInterface = function() {
        console.log('🔧 ТЕСТИРОВАНИЕ ИНТЕРФЕЙСА ЗАЯВКИ БЕЗ AML');
        
        if (!currentCalculation) {
            console.log('🔧 Создаем тестовый currentCalculation для USDT → ARS');
            currentCalculation = {
                fromAmount: 500,
                toAmount: 566666.67,
                exchangeRate: 1133.33,
                fee: 0,
                fromCurrency: 'USDT',
                toCurrency: 'ARS'
            };
        }
        
        console.log('🔧 currentCalculation:', currentCalculation);
        const pairType = getPairType(currentCalculation.fromCurrency, currentCalculation.toCurrency);
        console.log('🔧 Определенный тип пары:', pairType);
        
        console.log('🔧 Вызываем updateOrderInterfaceForPairType БЕЗ AML...');
        updateOrderInterfaceForPairType(pairType);
        
        setTimeout(() => {
            const receivingField = document.getElementById('receiving-details');
            const amlSection = document.getElementById('aml-section');
            console.log('🔧 Поле для реквизитов создано?', !!receivingField);
            console.log('🔧 AML секция скрыта?', amlSection ? amlSection.style.display === 'none' : 'не найдена');
            
            if (receivingField) {
                console.log('🔧 ✅ Поле найдено:', receivingField);
                receivingField.value = 'test-receiving-details';
                receivingField.dispatchEvent(new Event('input'));
                console.log('🔧 ✅ Заполнили тестовые реквизиты');
            } else {
                console.log('🔧 ❌ Поле НЕ НАЙДЕНО');
            }
            
            // Проверяем активацию кнопки
            const createButton = document.getElementById('create-order-button');
            if (createButton) {
                console.log('🔧 Кнопка заявки disabled?', createButton.disabled);
                console.log('🔧 Кнопка заявки className:', createButton.className);
            }
        }, 200);
    };
    
    console.log('🧪 Доступна команда: testCreateOrder() - для тестирования создания заявки из консоли');
    console.log('🔧 Доступна команда: forceBindCreateButton() - для принудительной привязки обработчика');
    console.log('🤖 Доступна команда: simulateClick() - для программного клика по кнопке');
    console.log('🔍 Доступна команда: checkOverlappingElements() - для проверки перекрывающих элементов');
    console.log('💀 Доступна команда: nuclearBind() - для ядерной привязки обработчика (делает кнопку КРАСНОЙ)');
    console.log('🎯 Доступна команда: createTestButton() - создать тестовую кнопку в углу экрана');
    console.log('🔧 Доступна команда: testInterface() - протестировать создание интерфейса БЕЗ AML');
    console.log('💥 AML ПРОВЕРКИ ПОЛНОСТЬЮ УДАЛЕНЫ - теперь только простые поля ввода!');
});

// Инициализация Telegram Web App
function initTelegramWebApp() {
    console.log('🔌 Инициализация Telegram WebApp...');
    
    // ⚡ УМНАЯ ЗАГРУЗКА КУРСОВ (ТОЛЬКО ЕСЛИ НЕ ЗАГРУЖЕНЫ)
    if (currentRates.length === 0) {
        console.log('⚡ Курсы не загружены, запускаем загрузку...');
        earlyRatesPromise = loadExchangeRates().catch(error => {
            console.log('⚠️ Предварительная загрузка курсов неудачна:', error.message);
        });
    } else {
        console.log('✅ Курсы уже загружены из кеша!');
    }
    
    // 🚀 БОМБОВАЯ ЗАСТАВКА УПРАВЛЯЕТСЯ АВТОМАТИЧЕСКИ
    
    if (window.Telegram?.WebApp) {
        tg = window.Telegram.WebApp;
        
        console.log('✅ Telegram WebApp API обнаружен');
        console.log('📱 initData:', tg.initData ? 'Есть данные' : 'Нет данных');
        
        // 🚀 НАСТОЯЩИЙ ПОЛНОЭКРАННЫЙ РЕЖИМ (Bot API 8.0+)
        window.Telegram.WebApp.ready();
        
        // Проверяем версию и используем правильный метод
        setTimeout(() => {
            console.log('🔍 Telegram Bot API версия:', tg.version);
            
            // Обработчики событий полноэкранного режима
            tg.onEvent('fullscreenChanged', (data) => {
                console.log('🎯 Fullscreen changed:', data.is_fullscreen);
                if (data.is_fullscreen) {
                    console.log('✅ ПОЛНОЭКРАННЫЙ РЕЖИМ АКТИВИРОВАН!');
                } else {
                    console.log('📱 Режим обычного окна');
                }
            });
            
            tg.onEvent('fullscreenFailed', (data) => {
                console.log('❌ Fullscreen failed:', data.error);
                console.log('🔄 Fallback to expand...');
                window.Telegram.WebApp.expand();
            });
            
            // Используем новый метод для Bot API 8.0+
            if (tg.isVersionAtLeast && tg.isVersionAtLeast('8.0')) {
                console.log('🚀 ИСПОЛЬЗУЕМ НАСТОЯЩИЙ ПОЛНОЭКРАННЫЙ РЕЖИМ!');
                try {
                    window.Telegram.WebApp.requestFullscreen();
                    console.log('📱 requestFullscreen() вызван!');
                } catch (error) {
                    console.log('❌ Ошибка requestFullscreen:', error);
                    window.Telegram.WebApp.expand(); // Fallback
                }
            } else {
                console.log('⚠️ Старая версия API, используем expand()');
                window.Telegram.WebApp.expand(); // Fallback для старых версий
            }
            
            // Логируем состояние
            setTimeout(() => {
                console.log('📊 Состояние после запроса:');
                console.log('  - isExpanded:', tg.isExpanded);
                console.log('  - isFullscreen:', tg.isFullscreen);
                console.log('  - viewportHeight:', tg.viewportHeight);
                console.log('  - viewportStableHeight:', tg.viewportStableHeight);
            }, 500);
        }, 50);
        
        // Извлекаем User ID и данные пользователя
        if (tg.initDataUnsafe?.user?.id) {
            currentUserId = tg.initDataUnsafe.user.id;
            currentUserData = {
                id: tg.initDataUnsafe.user.id,
                first_name: tg.initDataUnsafe.user.first_name || '',
                last_name: tg.initDataUnsafe.user.last_name || '',
                username: tg.initDataUnsafe.user.username || ''
            };
            console.log('👤 РЕАЛЬНЫЙ пользователь из Telegram:', currentUserData);
            console.log('✅ Это настоящий пользователь - уведомления будут отправлены!');
        } else {
            console.log('⚠️ User ID не найден в initDataUnsafe, используем тестовый');
            currentUserId = 123456789; // Тестовый ID для разработки
            currentUserData = {
                id: 123456789,
                first_name: 'Тестовый',
                last_name: 'Пользователь',
                username: 'test_user'
            };
            console.log('🔥 ВНИМАНИЕ: Тестовые данные! На производстве может не работать!');
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
        
        // Настраиваем полноэкранный режим для обычных браузеров
        setupFullscreenMode();
    }
    
    console.log('🔑 Финальный User ID:', currentUserId);
    loadFavorites();
}

// Инициализация обработчиков событий
function initEventListeners() {
    console.log('🔧 Инициализируем обработчики событий...');
    
    // 📱 ДОБАВЛЯЕМ ОБРАБОТЧИК ДЛЯ СКРЫТИЯ КЛАВИАТУРЫ ПРИ КЛИКЕ НА ОБЛАСТЬ
    document.addEventListener('click', function(event) {
        // Проверяем, что клик НЕ по полю ввода
        if (!event.target.matches('input[type="number"]') && 
            !event.target.closest('.currency-input')) {
            // Убираем фокус с всех полей ввода
            const inputs = document.querySelectorAll('input[type="number"]');
            inputs.forEach(input => {
                input.blur();
            });
            
            // Если доступен Telegram WebApp API, скрываем клавиатуру
            if (tg && tg.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            }
        }
    });

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
    
    // 📱 СКРЫТИЕ КЛАВИАТУРЫ ПРИ ТАПЕ В ЛЮБОЕ МЕСТО
    document.addEventListener('click', function(event) {
        // Проверяем что клик не по полю ввода
        if (!event.target.matches('input[type="number"], input[type="text"], textarea')) {
            // Убираем фокус с активного элемента (скрывает клавиатуру)
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }
        }
    });
    
    // 📱 СКРЫТИЕ КЛАВИАТУРЫ ПРИ НАЖАТИИ ENTER
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && event.target.matches('input[type="number"], input[type="text"]')) {
            event.target.blur();
        }
    });
    
    console.log('✅ Обработчики событий инициализированы');
}

    // 🎨 ОБНОВЛЕНИЕ КНОПОК ВАЛЮТ
function updateDefaultCurrencyIcons() {
    console.log('🎨 Обновляем кнопки валют...');
    updateCurrencyButtons();
}

// Загрузка начальных данных
async function loadInitialData() {
    console.log('🚀 Начинаем загрузку начальных данных...');
    showNotification('Загружаем данные приложения...', 'info');
    
    // 🔥 ЖДЕМ ТОЛЬКО GOOGLE SHEETS - БЕЗ FALLBACK!
    console.log('🔥 ЖДЕМ ЗАГРУЗКИ КУРСОВ ИЗ GOOGLE SHEETS...');
    currentRates = [];
    // НЕ ОБНОВЛЯЕМ ИНТЕРФЕЙС ПОКА НЕ ЗАГРУЗИМ РЕАЛЬНЫЕ КУРСЫ
    
    // 🔥 МГНОВЕННОЕ СКРЫТИЕ ЗАГРУЗОЧНОГО ЭКРАНА
    // 🚀 БОМБОВАЯ ЗАСТАВКА УПРАВЛЯЕТСЯ АВТОМАТИЧЕСКИ
    
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
    
    // 🚀 УМНОЕ ОЖИДАНИЕ КУРСОВ
    try {
        console.log('⚡ Проверяем статус курсов...');
        if (currentRates.length === 0) {
            if (earlyRatesPromise) {
                console.log('⚡ Ждем завершения уже запущенной загрузки...');
                await earlyRatesPromise;
            } else {
                console.log('⚡ Запускаем загрузку курсов...');
                await loadExchangeRates();
            }
        } else {
            console.log('✅ Курсы уже загружены!');
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки курсов:', error);
    }
    
    // 🚀 МГНОВЕННАЯ ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА ПРОФИЛЯ
    if (currentUserId && currentUserId !== 123456789) {
        loadUserProfile().catch(error => {
            console.error('❌ Ошибка загрузки профиля:', error);
        });
    }
}

// 🚀 БЫСТРАЯ ЗАГРУЗКА КУРСОВ С КЕШИРОВАНИЕМ
async function loadExchangeRates() {
    console.log('📡 Загружаем курсы валют...');
    
    // ⚡ МГНОВЕННАЯ ЗАГРУЗКА ИЗ КЕША
    try {
        const cachedRates = localStorage.getItem('cachedRates');
        const cacheTime = localStorage.getItem('ratesCacheTime');
        
        if (cachedRates && cacheTime) {
            const cacheAge = Date.now() - parseInt(cacheTime);
            // Используем кеш если он свежее 30 секунд
            if (cacheAge < 30000) {
                console.log('⚡ Используем СВЕЖИЙ кеш курсов!');
                const cached = JSON.parse(cachedRates);
                currentRates = cached.rates || [];
                window.rawPairData = cached.rawPairs || [];
                updateCurrencyList();
                updateRatesTime();
                console.log('✅ Курсы загружены из кеша мгновенно!');
                // Продолжаем загрузку свежих данных в фоне
            } else {
                console.log('⚠️ Кеш устарел, загружаем свежие данные...');
            }
        }
    } catch (cacheError) {
        console.log('⚠️ Ошибка чтения кеша:', cacheError.message);
    }
    
    try {
        // 🔥 ПРИНУДИТЕЛЬНАЯ СИНХРОНИЗАЦИЯ ПЕРЕД ЗАПРОСОМ!
        console.log('🔥 Запрашиваем принудительную синхронизацию...');
        try {
            await fetch('/api/force-sync', { method: 'POST' });
            console.log('✅ Принудительная синхронизация запрошена');
            // УБРАЛИ ЗАДЕРЖКУ 2 СЕКУНДЫ ДЛЯ УСКОРЕНИЯ!
        } catch (syncError) {
            console.log('⚠️ Ошибка принудительной синхронизации:', syncError.message);
        }
        
        const response = await fetch('/api/rates', {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
            currentRates = data.data;
            
            // 🔥 СОХРАНЯЕМ СЫРЫЕ ДАННЫЕ ПАР ДЛЯ ПРЯМЫХ РАСЧЕТОВ!
            if (data.rawPairs && data.rawPairs.length > 0) {
                window.rawPairData = data.rawPairs;
                console.log('🔥 Сохранены сырые данные пар:', window.rawPairData.length, 'пар');
                window.rawPairData.forEach(pair => {
                    console.log(`   ${pair.pair}: ${pair.sellRate}/${pair.buyRate}`);
                });
            } else {
                console.log('⚠️ Нет сырых данных пар от API');
            }
            
            // ⚡ СОХРАНЯЕМ В КЕШ ДЛЯ БЫСТРОЙ ЗАГРУЗКИ
            try {
                const cacheData = {
                    rates: currentRates,
                    rawPairs: window.rawPairData || []
                };
                localStorage.setItem('cachedRates', JSON.stringify(cacheData));
                localStorage.setItem('ratesCacheTime', Date.now().toString());
                console.log('⚡ Курсы сохранены в кеш!');
            } catch (cacheError) {
                console.log('⚠️ Ошибка сохранения в кеш:', cacheError.message);
            }
            
            updateCurrencyList();
            updateRatesTime();
            console.log('✅ Актуальные курсы заменили тестовые:', currentRates.length, 'валют');
            // showNotification('Курсы валют обновлены!', 'success'); // УБРАНО ПО ЗАПРОСУ
            
            // 🚀 БОМБОВАЯ ЗАСТАВКА УПРАВЛЯЕТСЯ АВТОМАТИЧЕСКИ
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
        
        // 🚀 БОМБОВАЯ ЗАСТАВКА УПРАВЛЯЕТСЯ АВТОМАТИЧЕСКИ
    }
}

// ❌ FALLBACK КУРСЫ ОТКЛЮЧЕНЫ - ТОЛЬКО GOOGLE SHEETS!
function getTestRates() {
    console.log('❌ FALLBACK КУРСЫ ОТКЛЮЧЕНЫ! ЖДЕМ GOOGLE SHEETS!');
    return []; // ПУСТОЙ МАССИВ - НИКАКИХ КУРСОВ ПОКА НЕ ЗАГРУЗИМ ИЗ ТАБЛИЦЫ!
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
    
    // 🔥 ИЩЕМ ПРЯМУЮ ПАРУ В ДАННЫХ ОТ API
    console.log(`📊 ПРЯМОЙ ПОИСК ПАРЫ ${fromCurrency}/${toCurrency} в данных...`);
    
    // Получаем сырые данные пар (должны быть в глобальном объекте)
    let pairData = null;
    
    // Пытаемся найти прямую пару FROM/TO
    if (window.rawPairData) {
        // 🔥 СНАЧАЛА ИЩЕМ ОБРАТНУЮ ПАРУ ДЛЯ ПРАВИЛЬНЫХ КУРСОВ!
        const reversePair = window.rawPairData.find(p => p.pair === `${toCurrency}/${fromCurrency}`);
        if (reversePair) {
            console.log(`📊 НАЙДЕНА ОБРАТНАЯ ПАРА (ПРИОРИТЕТ): ${reversePair.pair} = ${reversePair.sellRate}/${reversePair.buyRate}`);
            // Инвертируем для расчета
            pairData = {
                pair: `${fromCurrency}/${toCurrency}`,
                sellRate: 1 / reversePair.buyRate,
                buyRate: 1 / reversePair.sellRate
            };
            console.log(`📊 ИНВЕРТИРОВАННАЯ ПАРА: ${pairData.sellRate}/${pairData.buyRate}`);
        } else {
            // Только если нет обратной - ищем прямую пару FROM/TO
            pairData = window.rawPairData.find(p => p.pair === `${fromCurrency}/${toCurrency}`);
            if (pairData) {
                console.log(`📊 НАЙДЕНА ПРЯМАЯ ПАРА (ЗАПАСНОЙ ВАРИАНТ): ${pairData.pair} = ${pairData.sellRate}/${pairData.buyRate}`);
            }
        }
    }
    
    if (!pairData) {
        console.error(`❌ Пара ${fromCurrency}/${toCurrency} НЕ НАЙДЕНА в Google Sheets!`);
        showNotification(`Пара ${fromCurrency}/${toCurrency} недоступна`, 'error');
        updateCalculationDisplay(0, 0, 0, 0);
        document.getElementById('continue-button').disabled = true;
        return;
    }
    
    // 🔥 ПРАВИЛЬНАЯ ЛОГИКА РАСЧЕТА - ПРОВЕРЯЕМ НАПРАВЛЕНИЕ ОБМЕНА
    const exchangeRate = pairData.sellRate;
    let toAmount;
    
    // Определяем направление обмена по названию пары
    const [pairFromCurrency, pairToCurrency] = pairData.pair.split('/');
    
    // 🔥 СПЕЦИАЛЬНЫЕ ПАРЫ ДЛЯ ИНВЕРСИИ ЛОГИКИ РАСЧЕТА
    const specialCalcPairs = ['ARS/UAH', 'UAH/ARS', 'RUB/ARS', 'ARS/RUB', 'RUB/KZT', 'KZT/RUB', 'USDT/ARS', 'ARS/USDT', 'USDT/KZT', 'KZT/USDT', 'BTC/ETH', 'ETH/BTC', 'BTC/ARS', 'ARS/BTC', 'BTC/KZT', 'KZT/BTC'];
    const currentCalcPair = `${fromCurrency}/${toCurrency}`;
    const isSpecialCalc = specialCalcPairs.includes(currentCalcPair);
    
    if (fromCurrency === pairFromCurrency && toCurrency === pairToCurrency) {
        // Прямое направление пары
        if (isSpecialCalc) {
            // Для специальных пар - умножаем вместо деления
            toAmount = fromAmount * exchangeRate;
            console.log(`📊 СПЕЦ ПРЯМОЕ (×): ${fromAmount} ${fromCurrency} * ${exchangeRate} = ${toAmount} ${toCurrency}`);
        } else {
            // Обычная логика - делим  
            toAmount = fromAmount / exchangeRate;
            console.log(`📊 ПРЯМОЕ НАПРАВЛЕНИЕ (/): ${fromAmount} ${fromCurrency} / ${exchangeRate} = ${toAmount} ${toCurrency}`);
        }
    } else if (fromCurrency === pairToCurrency && toCurrency === pairFromCurrency) {
        // Обратное направление пары
        if (isSpecialCalc) {
            // Для специальных пар - делим вместо умножения
            toAmount = fromAmount / exchangeRate;
            console.log(`📊 СПЕЦ ОБРАТНОЕ (/): ${fromAmount} ${fromCurrency} / ${exchangeRate} = ${toAmount} ${toCurrency}`);
        } else {
            // Обычная логика - умножаем
            toAmount = fromAmount * exchangeRate;
            console.log(`📊 ОБРАТНОЕ НАПРАВЛЕНИЕ (×): ${fromAmount} ${fromCurrency} * ${exchangeRate} = ${toAmount} ${toCurrency}`);
        }
    } else {
        console.error(`❌ Ошибка направления! Пара: ${pairData.pair}, обмен: ${fromCurrency}→${toCurrency}`);
        toAmount = fromAmount * exchangeRate; // fallback
    }
    const fee = 0;
    const finalAmount = toAmount;
    
    currentCalculation = {
        fromAmount,
        toAmount: finalAmount,
        exchangeRate,
        fee,
        fromCurrency,
        toCurrency
    };
    
    // 🔥 ПРОСТО ПЕРЕДАЕМ КУРС КАК ЕСТЬ - НЕ ЛОМАЕМ!
    updateCalculationDisplay(fromAmount, finalAmount, exchangeRate, fee);
    document.getElementById('continue-button').disabled = false;
}

// Расчет обмена через API (для сложных пар)
async function calculateExchangeViaAPI(fromAmount) {
    console.log(`🌐 Расчет через API: ${fromAmount} ${fromCurrency} → ${toCurrency}`);
    
    try {
        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fromCurrency,
                toCurrency,
                amount: fromAmount,
                userId: currentUserId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            const toAmount = result.data.toAmount;
            const exchangeRate = result.data.exchangeRate;
            const fee = result.data.fee || 0;
            const finalAmount = toAmount;
            
            console.log(`✅ API расчет: ${fromAmount} ${fromCurrency} = ${finalAmount} ${toCurrency} (курс: ${exchangeRate})`);
            
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
        } else {
            throw new Error(result.error || 'Ошибка расчета');
        }
        
    } catch (error) {
        console.error('❌ Ошибка API расчета:', error.message);
        showNotification('Ошибка расчета курса: ' + error.message, 'error');
        updateCalculationDisplay(0, 0, 0, 0);
        document.getElementById('continue-button').disabled = true;
    }
}

// Обратный расчет обмена
function reverseCalculateExchange() {
    const toAmount = parseFloat(document.getElementById('to-amount').value) || 0;
    
    if (toAmount <= 0) {
        document.getElementById('from-amount').value = '';
        calculateExchange();
        return;
    }
    
    // 🔥 ИСПОЛЬЗУЕМ ПРЯМЫЕ ПАРЫ ДЛЯ ОБРАТНОГО РАСЧЕТА
    let pairData = null;
    
    if (window.rawPairData) {
        pairData = window.rawPairData.find(p => p.pair === `${fromCurrency}/${toCurrency}`);
        if (!pairData) {
            const reversePair = window.rawPairData.find(p => p.pair === `${toCurrency}/${fromCurrency}`);
            if (reversePair) {
                pairData = {
                    sellRate: 1 / reversePair.buyRate,
                    buyRate: 1 / reversePair.sellRate
                };
            }
        }
    }
    
    if (!pairData) {
        return;
    }
    
    const exchangeRate = pairData.sellRate;
    const fee = 0; // Комиссия убрана
    const grossAmount = toAmount; // Без комиссии
    
    // 🔥 ПРАВИЛЬНАЯ ЛОГИКА ОБРАТНОГО РАСЧЕТА
    let fromAmount;
    
    // Определяем направление обмена по названию пары
    const [pairFromCurrency, pairToCurrency] = pairData.pair ? pairData.pair.split('/') : [fromCurrency, toCurrency];
    
    if (fromCurrency === pairFromCurrency && toCurrency === pairToCurrency) {
        // Прямое направление пары: BTC/RUB, обратный расчет RUB → BTC
        fromAmount = grossAmount * exchangeRate;
        console.log(`📊 ОБРАТНЫЙ ПРЯМОЙ: ${grossAmount} ${toCurrency} * ${exchangeRate} = ${fromAmount} ${fromCurrency}`);
    } else if (fromCurrency === pairToCurrency && toCurrency === pairFromCurrency) {
        // Обратное направление пары: RUB/BTC через пару BTC/RUB, обратный расчет BTC → RUB
        fromAmount = grossAmount / exchangeRate;
        console.log(`📊 ОБРАТНЫЙ ОБРАТНЫЙ: ${grossAmount} ${toCurrency} / ${exchangeRate} = ${fromAmount} ${fromCurrency}`);
    } else {
        fromAmount = grossAmount / exchangeRate; // fallback
    }
    
    document.getElementById('from-amount').value = formatCurrencyAmount(fromAmount);
    calculateExchange();
}

// Обновление отображения расчета
function updateCalculationDisplay(fromAmount, toAmount, exchangeRate, fee) {
    console.log(`🔍 updateCalculationDisplay получил:
    - fromAmount: ${fromAmount}
    - toAmount: ${toAmount}  
    - exchangeRate: ${exchangeRate}
    - fromCurrency: ${fromCurrency}
    - toCurrency: ${toCurrency}`);
    
    document.getElementById('to-amount').value = formatCurrencyAmount(toAmount);
    
    // 🔥 ПРАВИЛЬНАЯ ЛОГИКА ОТОБРАЖЕНИЯ КУРСА
    let rateText;
    
    // Для криптовалют показываем как основную валюту
    const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'ADA', 'DOT', 'LINK', 'LTC', 'XRP', 'SOL', 'MATIC', 'AVAX', 'BCH'];
    
    // 🔥 СПЕЦИАЛЬНЫЕ ПАРЫ ДЛЯ ИНВЕРСИИ ОТОБРАЖЕНИЯ
    const specialInvertPairs = [
        'RUB/BTC', 'BTC/RUB',
        'RUB/ETH', 'ETH/RUB', 
        'USDT/BTC', 'BTC/USDT',
        'USDT/ETH', 'ETH/USDT',
        'ARS/UAH', 'UAH/ARS'
    ];
    
    const currentPair = `${fromCurrency}/${toCurrency}`;
    const isSpecialPair = specialInvertPairs.includes(currentPair);
    
    // 🔥 ОСОБАЯ ЛОГИКА ДЛЯ USDT/BTC - ВСЕГДА ПОКАЗЫВАЕМ 1 BTC = X USDT
    if (currentPair === 'USDT/BTC' || currentPair === 'BTC/USDT') {
        const btcToUsdtRate = (currentPair === 'USDT/BTC') ? exchangeRate : (1 / exchangeRate);
        rateText = `1 BTC = ${formatCurrencyAmount(btcToUsdtRate)} USDT`;
        console.log(`📊 USDT/BTC СПЕЦ: ${currentPair}, курс ${exchangeRate} → показываем 1 BTC = ${btcToUsdtRate} USDT`);
    } 
    // 🔥 ОСОБАЯ ЛОГИКА ДЛЯ USDT/ETH - ВСЕГДА ПОКАЗЫВАЕМ 1 ETH = X USDT
    else if (currentPair === 'USDT/ETH' || currentPair === 'ETH/USDT') {
        const ethToUsdtRate = (currentPair === 'USDT/ETH') ? exchangeRate : (1 / exchangeRate);
        rateText = `1 ETH = ${formatCurrencyAmount(ethToUsdtRate)} USDT`;
        console.log(`📊 USDT/ETH СПЕЦ: ${currentPair}, курс ${exchangeRate} → показываем 1 ETH = ${ethToUsdtRate} USDT`);
    }
    // 🔥 ОСОБАЯ ЛОГИКА ДЛЯ RUB/USDT - ВСЕГДА ПОКАЗЫВАЕМ 1 USDT = X RUB
    else if (currentPair === 'RUB/USDT' || currentPair === 'USDT/RUB') {
        const usdtToRubRate = (currentPair === 'RUB/USDT') ? exchangeRate : (1 / exchangeRate);
        rateText = `1 USDT = ${formatCurrencyAmount(usdtToRubRate)} RUB`;
        console.log(`📊 RUB/USDT СПЕЦ: ${currentPair}, курс ${exchangeRate} → показываем 1 USDT = ${usdtToRubRate} RUB`);
    }
    // 🔥 ОСОБАЯ ЛОГИКА ДЛЯ RUB/BTC - ВСЕГДА ПОКАЗЫВАЕМ 1 BTC = X RUB
    else if (currentPair === 'RUB/BTC' || currentPair === 'BTC/RUB') {
        const btcToRubRate = (currentPair === 'RUB/BTC') ? exchangeRate : (1 / exchangeRate);
        rateText = `1 BTC = ${formatCurrencyAmount(btcToRubRate)} RUB`;
        console.log(`📊 RUB/BTC СПЕЦ: ${currentPair}, курс ${exchangeRate} → показываем 1 BTC = ${btcToRubRate} RUB`);
    }
    // 🔥 ОСОБАЯ ЛОГИКА ДЛЯ RUB/ETH - ВСЕГДА ПОКАЗЫВАЕМ 1 ETH = X RUB
    else if (currentPair === 'RUB/ETH' || currentPair === 'ETH/RUB') {
        const ethToRubRate = (currentPair === 'RUB/ETH') ? exchangeRate : (1 / exchangeRate);
        rateText = `1 ETH = ${formatCurrencyAmount(ethToRubRate)} RUB`;
        console.log(`📊 RUB/ETH СПЕЦ: ${currentPair}, курс ${exchangeRate} → показываем 1 ETH = ${ethToRubRate} RUB`);
    }
    // 🔥 ОСОБАЯ ЛОГИКА ДЛЯ RUB/UAH - ИНВЕРТИРУЕМ ОТОБРАЖЕНИЕ
    else if (currentPair === 'RUB/UAH' || currentPair === 'UAH/RUB') {
        const invertedRate = 1 / exchangeRate;
        if (currentPair === 'RUB/UAH') {
            rateText = `1 RUB = ${formatCurrencyAmount(invertedRate)} UAH`;
        } else {
            rateText = `1 UAH = ${formatCurrencyAmount(invertedRate)} RUB`;
        }
        console.log(`📊 RUB/UAH СПЕЦ: ${currentPair}, курс ${exchangeRate} → инвертируем ${invertedRate}`);
    } else if (isSpecialPair && exchangeRate < 0.01) {
        // Для других специальных пар с маленьким курсом - инвертируем
        const normalRate = 1 / exchangeRate;
        rateText = `1 ${fromCurrency} = ${formatCurrencyAmount(normalRate)} ${toCurrency}`;
        console.log(`📊 СПЕЦ ПАРА ${currentPair}: ИНВЕРТИРОВАЛИ ${exchangeRate} → ${normalRate}`);
    } else {
        // Обычный курс - показываем как есть
        rateText = `1 ${fromCurrency} = ${formatCurrencyAmount(exchangeRate)} ${toCurrency}`;
        console.log(`📊 ОБЫЧНЫЙ КУРС для ${currentPair}: ${exchangeRate}`);
    }
    
    document.getElementById('exchange-rate').textContent = rateText;
    document.getElementById('final-amount').textContent = `${formatCurrencyAmount(toAmount)} ${toCurrency}`;
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
            // currency-desc удален
    fromButton.querySelector('.currency-icon').innerHTML = getCurrencyIcon(fromCurrency);
    
    toButton.querySelector('.currency-name').textContent = toCurrency;
            // currency-desc удален
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

async function openCurrencyModal(type) {
    currentCurrencyType = type;
    
    // 🚀 МГНОВЕННАЯ ПРОВЕРКА И ЗАГРУЗКА КУРСОВ
    if (!currentRates || currentRates.length === 0) {
        console.log('⚡ Курсы еще не загружены - ФОРСИРУЕМ ЗАГРУЗКУ ИЗ GOOGLE SHEETS!');
        await loadExchangeRates(); // ПРИНУДИТЕЛЬНАЯ ЗАГРУЗКА
    }
    
    updateCurrencyList();
    document.getElementById('currency-modal').classList.add('active');
    
    // 🔄 ВСЕГДА ФОРСИРУЕМ АКТУАЛЬНЫЕ КУРСЫ В ФОНЕ
    loadExchangeRates().then(() => {
        console.log('✅ Актуальные курсы загружены - обновляем список');
        updateCurrencyList();
    }).catch(error => {
        console.log('❌ Ошибка загрузки курсов:', error.message);
        showNotification('Ошибка загрузки курсов из Google Sheets', 'error');
    });
}

// Закрытие модала валют
function closeCurrencyModal() {
    document.getElementById('currency-modal').classList.remove('active');
}

// Обновление списка валют
function updateCurrencyList() {
    const currencyList = document.getElementById('currency-list');
    currencyList.innerHTML = '';
    
    // 🔥 ЕСЛИ НЕТ КУРСОВ - ПОКАЗЫВАЕМ ЗАГРУЗКУ
    if (!currentRates || currentRates.length === 0) {
        console.log('⚡ Нет курсов - ждем Google Sheets');
        currencyList.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;"><div style="font-size: 24px; margin-bottom: 10px;">📊</div><div>Загружаем курсы из Google Sheets...</div><div style="font-size: 12px; margin-top: 10px; opacity: 0.7;">Ждите, курсы загружаются из таблицы</div></div>';
        return;
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
        'BTC', 'ETH', 'USDT', 'USDC',
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
        // currency-desc удален
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
        // currency-desc удален  
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
    const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'XRP', 'LTC', 'BCH', 'LINK'];
    return cryptoCurrencies.includes(fromCurrency) && cryptoCurrencies.includes(toCurrency);
}

// Проверка является ли пара смешанной (крипто → фиат)
function isCryptoToFiatPair(fromCurrency, toCurrency) {
    const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'XRP', 'LTC', 'BCH', 'LINK'];
    const fiatCurrencies = ['USD', 'EUR', 'RUB', 'UAH', 'KZT', 'ARS', 'BRL'];
    return cryptoCurrencies.includes(fromCurrency) && fiatCurrencies.includes(toCurrency);
}

// Проверка является ли пара смешанной (фиат → крипто)
function isFiatToCryptoPair(fromCurrency, toCurrency) {
    const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'XRP', 'LTC', 'BCH', 'LINK'];
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
    console.log('🔧 ========== ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ==========');
    console.log('🔧 Тип пары:', pairType);
    
    const addressLabel = document.querySelector('label[for="wallet-address"]');
    const addressInput = document.getElementById('wallet-address');
    const amlSection = document.getElementById('aml-section');
    const inputHelp = document.querySelector('.input-help');
    
    console.log('🔧 Найденные элементы:');
    console.log('🔧 addressLabel:', !!addressLabel);
    console.log('🔧 addressInput:', !!addressInput);
    console.log('🔧 amlSection:', !!amlSection);
    console.log('🔧 inputHelp:', !!inputHelp);
    
    // Удаляем дополнительные поля если они есть
    const toAddressDiv = document.getElementById('to-address-input');
    const receivingDetailsDiv = document.getElementById('receiving-details-input');
    if (toAddressDiv) {
        console.log('🔧 Удаляем старое поле to-address-input');
        toAddressDiv.remove();
    }
    if (receivingDetailsDiv) {
        console.log('🔧 Удаляем старое поле receiving-details-input');
        receivingDetailsDiv.remove();
    }
    
    if (pairType === 'crypto') {
        // Криптовалютная пара (BTC → ETH) - два адреса БЕЗ AML!
        console.log('🔧 ========== CRYPTO БЕЗ AML ==========');
        
        if (addressLabel) {
            addressLabel.textContent = 'Адрес кошелька для отправки';
            console.log('🔧 ✅ Установлен текст addressLabel');
        }
        if (addressInput) {
            addressInput.placeholder = 'Введите адрес отправки';
            console.log('🔧 ✅ Установлен placeholder addressInput');
        }
        if (amlSection) {
            console.log('🔧 ✅ amlSection найдена, создаем поле для адреса получения...');
            amlSection.style.display = 'block';
            
            // Добавляем второе поле для адреса получения БЕЗ AML
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
            
            // УБИРАЕМ AML СЕКЦИЮ ПОЛНОСТЬЮ!
            amlSection.innerHTML = '';
            amlSection.style.display = 'none';
            
            // Добавляем обработчики БЕЗ AML
            setTimeout(() => {
                const fromInput = document.getElementById('wallet-address');
                const toInput = document.getElementById('to-wallet-address');
                
                if (fromInput) fromInput.addEventListener('input', () => validateCryptoAddresses());
                if (toInput) toInput.addEventListener('input', () => validateCryptoAddresses());
                console.log('🔧 ✅ Обработчики событий привязаны БЕЗ AML');
            }, 100);
        } else {
            console.log('🔧 ❌ amlSection НЕ НАЙДЕНА!');
        }
        if (inputHelp) {
            inputHelp.textContent = 'Введите оба адреса для обмена';
            console.log('🔧 ✅ Установлен текст inputHelp');
        }
        
    } else if (pairType === 'crypto-to-fiat') {
        // Смешанная пара (USDT → RUB) - криптоадрес + реквизиты БЕЗ AML!
        console.log('🔧 ========== CRYPTO-TO-FIAT БЕЗ AML ==========');
        
        if (addressLabel) {
            addressLabel.textContent = 'Адрес криптокошелька для отправки';
            console.log('🔧 ✅ Установлен текст addressLabel');
        }
        if (addressInput) {
            addressInput.placeholder = 'Введите адрес USDT кошелька';
            console.log('🔧 ✅ Установлен placeholder addressInput');
        }
        if (amlSection) {
            console.log('🔧 ✅ amlSection найдена, создаем поле для реквизитов...');
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
            
            console.log('🔧 Создано поле receivingDetailsDiv:', receivingDetailsDiv);
            console.log('🔧 Вставляем перед amlSection...');
            amlSection.parentNode.insertBefore(receivingDetailsDiv, amlSection);
            console.log('🔧 ✅ Поле для реквизитов добавлено!');
            
            // УБИРАЕМ AML СЕКЦИЮ ПОЛНОСТЬЮ!
            amlSection.innerHTML = '';
            amlSection.style.display = 'none';
            
            // Добавляем обработчики БЕЗ AML
            setTimeout(() => {
                const cryptoInput = document.getElementById('wallet-address');
                const receivingInput = document.getElementById('receiving-details');
                
                if (cryptoInput) cryptoInput.addEventListener('input', () => validateCryptoToFiatAddresses());
                if (receivingInput) receivingInput.addEventListener('input', () => validateCryptoToFiatAddresses());
                console.log('🔧 ✅ Обработчики событий привязаны БЕЗ AML');
            }, 100);
        } else {
            console.log('🔧 ❌ amlSection НЕ НАЙДЕНА! Не можем создать поле для реквизитов');
        }
        if (inputHelp) {
            inputHelp.textContent = 'Укажите адрес отправки и реквизиты получения';
            console.log('🔧 ✅ Установлен текст inputHelp');
        }
         
     } else if (pairType === 'fiat-to-crypto') {
         // Смешанная пара (RUB → USDT) - только кошелек получения БЕЗ AML!
         console.log('🔧 ========== FIAT-TO-CRYPTO БЕЗ AML ==========');
         
         if (addressLabel) {
             addressLabel.textContent = 'Кошелек для получения криптовалюты';
             console.log('🔧 ✅ Установлен текст addressLabel');
         }
         if (addressInput) {
             addressInput.placeholder = `Введите адрес ${currentCalculation?.toCurrency || 'USDT'} кошелька`;
             console.log('🔧 ✅ Установлен placeholder addressInput');
         }
         if (amlSection) {
             console.log('🔧 ✅ amlSection найдена, убираем AML...');
             
             // УБИРАЕМ AML СЕКЦИЮ ПОЛНОСТЬЮ!
             amlSection.innerHTML = '';
             amlSection.style.display = 'none';
             
             // Добавляем обработчики БЕЗ AML
             setTimeout(() => {
                 const walletInput = document.getElementById('wallet-address');
                 
                 if (walletInput) walletInput.addEventListener('input', () => validateFiatToCryptoAddresses());
                 console.log('🔧 ✅ Обработчики событий привязаны БЕЗ AML');
             }, 100);
         }
         if (inputHelp) {
             inputHelp.textContent = 'Укажите адрес кошелька для получения криптовалюты';
             console.log('🔧 ✅ Установлен текст inputHelp');
         }
         
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
            <span><strong>${formatCurrencyAmount(currentCalculation.toAmount)} ${currentCalculation.toCurrency}</strong></span>
        </div>
        <div class="info-row">
            <span>Курс обмена</span>
            <span>1 ${currentCalculation.fromCurrency} = ${formatCurrencyAmount(currentCalculation.exchangeRate)} ${currentCalculation.toCurrency}</span>
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
        // Базовая валидация без currentCalculation (ЛЮБЫЕ символы)
        const shouldEnable = address.length >= 1;
        console.log('🔍 shouldEnable:', shouldEnable, '(адрес заполнен?)');
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

// Валидация криптовалютных адресов (два адреса) БЕЗ AML!
function validateCryptoAddresses() {
    const fromAddress = document.getElementById('wallet-address')?.value?.trim() || ''; // адрес отправки
    const toAddress = document.getElementById('to-wallet-address')?.value?.trim() || ''; // адрес получения
    
    console.log('🔄 ВАЛИДАЦИЯ CRYPTO БЕЗ AML:', { fromAddress: fromAddress.length, toAddress: toAddress.length });
    
    // Разрешаем создание заявки если оба адреса заполнены (ЛЮБЫЕ символы и количество)
    const shouldEnable = fromAddress.length >= 1 && toAddress.length >= 1;
    setCreateButtonState(shouldEnable);
    console.log(`🔄 CRYPTO ВАЛИДАЦИЯ БЕЗ AML: ${shouldEnable ? '✅ АКТИВНА' : '❌ НЕАКТИВНА'}`);
    
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
        // Для фиатных пар требуется только номер счета или реквизиты (ЛЮБЫЕ символы)
        setCreateButtonState(account.length >= 1);
    }
    
    // Обновляем сводку заказа
    if (currentCalculation) {
        updateOrderSummary();
    }
}

// Валидация смешанных пар (крипто → фиат) БЕЗ AML!
function validateCryptoToFiatAddresses() {
    const cryptoAddress = document.getElementById('wallet-address')?.value?.trim() || ''; // USDT адрес
    const receivingDetails = document.getElementById('receiving-details')?.value?.trim() || ''; // реквизиты получения
    
    console.log('🔄 ВАЛИДАЦИЯ CRYPTO-TO-FIAT БЕЗ AML:', { cryptoAddress: cryptoAddress.length, receivingDetails: receivingDetails.length });
    
    // Разрешаем создание заявки если оба поля заполнены (ЛЮБЫЕ символы и количество)
    const shouldEnable = cryptoAddress.length >= 1 && receivingDetails.length >= 1;
    setCreateButtonState(shouldEnable);
    console.log(`🔄 CRYPTO-TO-FIAT ВАЛИДАЦИЯ БЕЗ AML: ${shouldEnable ? '✅ АКТИВНА' : '❌ НЕАКТИВНА'}`);
    
    // Обновляем сводку заказа
    if (currentCalculation) {
        updateOrderSummary();
    }
}

// Валидация смешанных пар (фиат → крипто) БЕЗ AML!
function validateFiatToCryptoAddresses() {
    const walletAddress = document.getElementById('wallet-address')?.value?.trim() || ''; // адрес кошелька для получения крипты
    
    console.log('🔄 ВАЛИДАЦИЯ FIAT-TO-CRYPTO БЕЗ AML:', { walletAddress: walletAddress.length });
    
    // Разрешаем создание заявки если адрес заполнен (ЛЮБЫЕ символы и количество)
    const shouldEnable = walletAddress.length >= 1;
    setCreateButtonState(shouldEnable);
    console.log(`🔄 FIAT-TO-CRYPTO ВАЛИДАЦИЯ БЕЗ AML: ${shouldEnable ? '✅ АКТИВНА' : '❌ НЕАКТИВНА'}`);
    
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
                userData: currentUserData, // Добавляем данные пользователя
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
                pairType: 'crypto',
                network: currentNetwork || null,
                bank: (currentCalculation.fromCurrency === 'RUB' || currentCalculation.toCurrency === 'RUB') ? currentBank : null
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
                userData: currentUserData, // Добавляем данные пользователя
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
                pairType: 'crypto-to-fiat',
                network: currentNetwork || null,
                bank: (currentCalculation.fromCurrency === 'RUB' || currentCalculation.toCurrency === 'RUB') ? currentBank : null
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
                userData: currentUserData, // Добавляем данные пользователя
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
                pairType: 'fiat-to-crypto',
                network: currentNetwork || null,
                bank: (currentCalculation.fromCurrency === 'RUB' || currentCalculation.toCurrency === 'RUB') ? currentBank : null
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
                    userData: currentUserData, // Добавляем данные пользователя
                    fromCurrency: currentCalculation.fromCurrency,
                    toCurrency: currentCalculation.toCurrency,
                    fromAmount: currentCalculation.fromAmount,
                    toAmount: currentCalculation.toAmount,
                    fromAddress: '', // Будет заполнено оператором
                    toAddress: address, // Реквизиты для получения средств
                    exchangeRate: currentCalculation.exchangeRate,
                    fee: currentCalculation.fee,
                    pairType: 'fiat',
                    bank: (currentCalculation.fromCurrency === 'RUB' || currentCalculation.toCurrency === 'RUB') ? currentBank : null
                };
                 console.log(`💳 ФИНАЛЬНЫЕ ДАННЫЕ ${pairName} ЗАЯВКИ:`, orderData);
             } else {
                                 console.log('🏦 СОЗДАНИЕ ФИАТНОЙ ЗАЯВКИ - номер счета:', address);
                                orderData = {
                    userId: currentUserId,
                    userData: currentUserData, // Добавляем данные пользователя
                    fromCurrency: currentCalculation.fromCurrency,
                    toCurrency: currentCalculation.toCurrency,
                    fromAmount: currentCalculation.fromAmount,
                    toAmount: currentCalculation.toAmount,
                    fromAddress: '', // Будет заполнено оператором
                    toAddress: address, // Номер счета для фиатных пар
                    exchangeRate: currentCalculation.exchangeRate,
                    fee: currentCalculation.fee,
                    pairType: 'fiat',
                    bank: (currentCalculation.fromCurrency === 'RUB' || currentCalculation.toCurrency === 'RUB') ? currentBank : null
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
    console.log('📋 data.data:', data.data);
    console.log('📋 data.data.id:', data.data.id);
    console.log('📋 data.data.orderId:', data.data.orderId);
    
    if (data.success) {
        console.log('🚀 ========== ЗАЯВКА УСПЕШНО СОЗДАНА ==========');
        console.log('✅ Заявка успешно создана:', data.data);
        
        // Используем id или orderId как fallback
        const orderIdToShow = data.data.id || data.data.orderId || 'неизвестно';
        console.log('📋 ID для отображения:', orderIdToShow);
        
        showNotification(`Заявка #${orderIdToShow} успешно создана!`, 'success');
            
            // Показываем информацию о заявке
            try {
                if (tg && typeof tg.showAlert === 'function') {
                    tg.showAlert(`Заявка #${orderIdToShow} создана!\n\nОператор свяжется с вами в течение 15 минут.`);
                } else {
                    // Если нет Telegram, показываем обычное уведомление
                    alert(`Заявка #${orderIdToShow} создана!\n\nОператор свяжется с вами в течение 15 минут.`);
                }
            } catch (alertError) {
                console.error('❌ Ошибка показа уведомления:', alertError);
                // Fallback уведомление
                alert(`Заявка #${orderIdToShow} создана!\n\nОператор свяжется с вами в течение 15 минут.`);
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
    if (!currentUserId) {
        console.log('⚠️ currentUserId отсутствует, устанавливаем тестовый');
        currentUserId = 123456789;
    }
    
    const data = {
        userId: currentUserId,
        timestamp: new Date().toISOString(),
        favoriteCurrencies: favoriteCurrencies,
        version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exmachinax_data_${currentUserId}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// 🧪 ГЛОБАЛЬНАЯ ОТЛАДОЧНАЯ ФУНКЦИЯ ДЛЯ ИЗБРАННЫХ ВАЛЮТ
window.debugFavorites = function() {
    console.log('⭐ ========== ОТЛАДКА ИЗБРАННЫХ ВАЛЮТ ==========');
    console.log('⭐ Текущие избранные:', favoriteCurrencies);
    console.log('⭐ localStorage доступен?', typeof Storage !== "undefined");
    
    // Тест сохранения
    console.log('⭐ Тестируем сохранение...');
    const testArray = ['TEST1', 'TEST2', 'TEST3'];
    try {
        localStorage.setItem('test_favorites', JSON.stringify(testArray));
        const readBack = localStorage.getItem('test_favorites');
        console.log('⭐ Тест сохранения результат:', readBack);
        localStorage.removeItem('test_favorites');
        console.log('⭐ Тест сохранения:', readBack === JSON.stringify(testArray) ? '✅ РАБОТАЕТ' : '❌ НЕ РАБОТАЕТ');
    } catch (e) {
        console.log('⭐ Тест сохранения: ❌ ОШИБКА', e);
    }
    
    // Тест toggleFavorite
    console.log('⭐ Тестируем добавление ETH...');
    toggleFavorite('ETH');
    
    // Тест перезагрузки
    console.log('⭐ Тестируем перезагрузку избранных...');
    loadFavorites();
    
    console.log('⭐ ========== КОНЕЦ ОТЛАДКИ ==========');
};

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

// Умное форматирование валютных сумм
function formatCurrencyAmount(amount) {
    if (amount === 0) return '0';
    
    const absAmount = Math.abs(amount);
    
    // Для больших чисел (>1000) - максимум 2 знака после запятой
    if (absAmount >= 1000) {
        return amount.toFixed(2).replace(/\.?0+$/, '');
    }
    // Для средних чисел (1-1000) - максимум 4 знака
    else if (absAmount >= 1) {
        return amount.toFixed(4).replace(/\.?0+$/, '');
    }
    // Для маленьких чисел (<1) - максимум 6 знаков
    else if (absAmount >= 0.001) {
        return amount.toFixed(6).replace(/\.?0+$/, '');
    }
    // Для очень маленьких чисел - научная нотация или 8 знаков
    else {
        const formatted = amount.toFixed(8).replace(/\.?0+$/, '');
        return formatted === '0' ? amount.toExponential(2) : formatted;
    }
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

// 🚀 БОМБОВАЯ ЗАСТАВКА С ЭТАПАМИ ЗАГРУЗКИ
let loadingProgress = 0;
let loadingStageIndex = 0;

const loadingStages = [
    {
        icon: 'fas fa-rocket',
        title: 'Инициализация системы...',
        subtitle: 'Подготавливаем всё к работе',
        duration: 1000
    },
    {
        icon: 'fas fa-chart-line',
        title: 'Загружаем курсы валют...',
        subtitle: 'Синхронизируемся с Google Sheets',
        duration: 1500
    },
    {
        icon: 'fas fa-user-circle',
        title: 'Загружаем ваш профиль...',
        subtitle: 'Настраиваем персональные данные',
        duration: 1000
    },
    {
        icon: 'fas fa-shield-alt',
        title: 'Проверяем безопасность...',
        subtitle: 'Защищаем ваши операции',
        duration: 700
    },
    {
        icon: 'fas fa-check-circle',
        title: 'Всё готово!',
        subtitle: 'Добро пожаловать в ExMachinaX',
        duration: 300
    }
];

function updateLoadingStage(stageIndex) {
    const stage = loadingStages[stageIndex];
    if (!stage) return;
    
    const iconElement = document.getElementById('loading-stage-icon');
    const titleElement = document.getElementById('loading-stage-title');
    const subtitleElement = document.getElementById('loading-stage-subtitle');
    
    if (iconElement && titleElement && subtitleElement) {
        // Анимация смены иконки
        iconElement.style.transform = 'scale(0)';
        setTimeout(() => {
            iconElement.className = stage.icon;
            iconElement.style.transform = 'scale(1)';
        }, 150);
        
        // Анимация смены текста
        titleElement.style.opacity = '0';
        subtitleElement.style.opacity = '0';
        
        setTimeout(() => {
            titleElement.textContent = stage.title;
            subtitleElement.textContent = stage.subtitle;
            titleElement.style.opacity = '1';
            subtitleElement.style.opacity = '1';
        }, 200);
    }
}

function updateProgress(targetProgress) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill && progressText) {
        progressFill.style.width = targetProgress + '%';
        
        // Анимированный счётчик
        const currentProgress = loadingProgress;
        const increment = (targetProgress - currentProgress) / 20;
        let current = currentProgress;
        
        const counter = setInterval(() => {
            current += increment;
            if (current >= targetProgress) {
                current = targetProgress;
                clearInterval(counter);
            }
            progressText.textContent = Math.round(current) + '%';
        }, 50);
        
        loadingProgress = targetProgress;
    }
}

function startLoadingSequence() {
    let currentStage = 0;
    let currentProgress = 0;
    
    function nextStage() {
        if (currentStage < loadingStages.length) {
            const stage = loadingStages[currentStage];
            updateLoadingStage(currentStage);
            
            // Прогресс для каждого этапа
            const progressStep = 100 / loadingStages.length;
            currentProgress += progressStep;
            updateProgress(Math.min(currentProgress, 100));
            
            currentStage++;
            
            if (currentStage < loadingStages.length) {
                setTimeout(nextStage, stage.duration);
            } else {
                // Финальный этап - скрываем заставку
                setTimeout(() => {
                    hideLoadingScreen();
                }, stage.duration);
            }
        }
    }
    
    // Запускаем последовательность
    setTimeout(nextStage, 500); // Небольшая задержка для эффекта
}

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
        }, 500);
    }
}

// 📱 ПОЛНОЭКРАННЫЙ РЕЖИМ ДЛЯ МОБИЛЬНЫХ
function setupFullscreenMode() {
    // Настройка высоты для мобильных браузеров и Telegram WebApp
    function setMobileVH() {
        let vh = window.innerHeight * 0.01;
        let viewportHeight = window.innerHeight;
        
        // Если это Telegram WebApp, используем его viewport
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            if (tg.viewportHeight && tg.viewportHeight > 0) {
                viewportHeight = tg.viewportHeight;
                vh = tg.viewportHeight * 0.01;
                console.log('📱 Используем Telegram viewport height:', tg.viewportHeight);
            }
        }
        
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        document.documentElement.style.setProperty('--tg-viewport-height', `${viewportHeight}px`);
        
        console.log('📱 Viewport установлен:', viewportHeight + 'px');
    }
    
    // Устанавливаем при загрузке
    setMobileVH();
    
    // Telegram WebApp viewport change listener
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.onEvent('viewportChanged', () => {
            console.log('📱 Telegram viewport изменился!');
            setTimeout(setMobileVH, 50);
        });
    }
    
    // Обновляем при изменении ориентации/размера
    window.addEventListener('resize', setMobileVH);
    window.addEventListener('orientationchange', () => {
        setTimeout(setMobileVH, 100); // Небольшая задержка для корректного расчета
    });
    
    // Скрыть адресную строку на мобильных (только если НЕ Telegram WebApp)
    if (!window.Telegram?.WebApp) {
        window.addEventListener('load', () => {
            setTimeout(() => {
                window.scrollTo(0, 1);
            }, 100);
        });
    }
    
    // Предотвращаем zoom на iOS
    document.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    });
    
    // Предотвращаем pull-to-refresh
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });
    
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    console.log('📱 Полноэкранный режим настроен!');
}

// Автозапуск заставки при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // setupFullscreenMode вызывается теперь из initTelegramWebApp
    startLoadingSequence();
});

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
    const referralLink = `https://t.me/ExMachinaX_bot?start=${currentUserId}`;
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

function updateCurrencyButtons() {
    console.log('🔄 Обновляем кнопки валют...');
    
    const fromButton = document.querySelector('#from-currency');
    const toButton = document.querySelector('#to-currency');
    
    if (fromButton) {
        if (fromCurrency) {
            fromButton.querySelector('.currency-icon').innerHTML = getCurrencyIcon(fromCurrency);
            fromButton.querySelector('.currency-name').textContent = fromCurrency;
        } else {
            fromButton.querySelector('.currency-icon').innerHTML = '💰';
            fromButton.querySelector('.currency-name').textContent = 'Выберите валюту';
        }
    }
    
    if (toButton) {
        if (toCurrency) {
            toButton.querySelector('.currency-icon').innerHTML = getCurrencyIcon(toCurrency);
            toButton.querySelector('.currency-name').textContent = toCurrency;
        } else {
            toButton.querySelector('.currency-icon').innerHTML = '💰';
            toButton.querySelector('.currency-name').textContent = 'Выберите валюту';
        }
    }
    
    console.log(`✅ Кнопки обновлены: ${fromCurrency || 'не выбрана'} → ${toCurrency || 'не выбрана'}`);
}