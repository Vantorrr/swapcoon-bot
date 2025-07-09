# 🚀 Инструкция по настройке SwapCoon Bot

## 📋 Требования

- Node.js версии 16 или выше
- npm или yarn
- Telegram Bot Token
- (Опционально) Google Sheets API
- (Опционально) AML API
- (Опционально) CRM API

## 🛠 Быстрая установка

### 1. Клонирование и установка зависимостей

```bash
# Если вы клонируете репозиторий
git clone <your-repo-url>
cd swapcoon

# Установка зависимостей
npm install
```

### 2. Создание Telegram бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду `/newbot`
3. Выберите имя для бота (например: "SwapCoon Exchange Bot")
4. Выберите username (например: "swapcoon_exchange_bot")
5. Скопируйте полученный токен

### 3. Настройка мини-приложения

1. Отправьте `/setmenubutton` в @BotFather
2. Выберите вашего бота
3. Отправьте название кнопки: "🚀 Открыть SwapCoon"
4. Отправьте URL: `https://your-domain.com` (или `http://localhost:3000` для тестирования)

### 4. Настройка переменных окружения

```bash
# Скопируйте файл примера
cp .env.example .env

# Отредактируйте .env файл
nano .env
```

**Обязательные настройки:**
```env
BOT_TOKEN=YOUR_BOT_TOKEN_FROM_BOTFATHER
WEBAPP_URL=http://localhost:3000  # Или ваш домен
OPERATOR_GROUP_ID=-100123456789   # ID группы операторов
```

### 5. Запуск проекта

```bash
# Быстрый запуск (Linux/Mac)
chmod +x start.sh
./start.sh

# Или вручную
npm run web &
npm run dev
```

## 🔧 Дополнительная настройка

### Google Sheets Integration

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите Google Sheets API
4. Создайте Service Account
5. Скачайте JSON ключ
6. Добавьте настройки в `.env`:

```env
GOOGLE_SHEETS_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### AML API Integration

Для подключения AML сервиса:

```env
AML_API_URL=https://api.your-aml-provider.com
AML_API_KEY=your_aml_api_key
```

### CRM Integration

```env
CRM_API_URL=https://your-crm.com/api
CRM_API_KEY=your_crm_api_key
```

## 🏗 Структура проекта

```
swapcoon/
├── src/
│   ├── bot.js              # Основной файл бота
│   ├── web-server.js       # Веб-сервер
│   ├── models/
│   │   └── Database.js     # База данных SQLite
│   ├── services/
│   │   ├── GoogleSheetsService.js
│   │   ├── AMLService.js
│   │   └── CRMService.js
│   └── webapp/
│       ├── index.html      # Мини-приложение
│       ├── styles.css      # Стили
│       └── app.js          # JavaScript логика
├── data/                   # База данных SQLite
├── .env                    # Переменные окружения
├── package.json
└── README.md
```

## 🚀 Развертывание в продакшене

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PM2 для управления процессами
npm install -g pm2
```

### 2. Клонирование и настройка

```bash
git clone <your-repo-url>
cd swapcoon
npm install --production
```

### 3. Настройка .env для продакшена

```env
NODE_ENV=production
WEBAPP_URL=https://yourdomain.com
PORT=3000
```

### 4. Запуск с PM2

```bash
# Запуск веб-сервера
pm2 start src/web-server.js --name "swapcoon-web"

# Запуск бота
pm2 start src/bot.js --name "swapcoon-bot"

# Сохранение конфигурации
pm2 save
pm2 startup
```

### 5. Настройка Nginx (опционально)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔍 Отладка

### Проверка логов

```bash
# Логи PM2
pm2 logs

# Логи конкретного процесса
pm2 logs swapcoon-bot
pm2 logs swapcoon-web

# Остановка процессов
pm2 stop all
pm2 restart all
```

### Часто встречающиеся проблемы

1. **Bot Token не работает**
   - Проверьте правильность токена
   - Убедитесь, что бот не заблокирован

2. **Мини-приложение не открывается**
   - Проверьте URL в настройках бота
   - Убедитесь, что веб-сервер запущен

3. **База данных не создается**
   - Проверьте права на запись в папку `data/`
   - Создайте папку вручную: `mkdir -p data`

## 📞 Поддержка

Если у вас возникли проблемы:

1. Проверьте логи приложения
2. Убедитесь, что все переменные окружения настроены
3. Проверьте подключение к интернету
4. Обратитесь к документации Telegram Bot API

## 🎯 Функции

### ✅ Реализовано

- ✅ Telegram Bot с командами
- ✅ Мини-приложение с калькулятором
- ✅ AML проверка адресов
- ✅ Создание и отслеживание заявок
- ✅ Уведомления операторов
- ✅ Реферальная система
- ✅ История операций
- ✅ Адаптивный дизайн
- ✅ SQLite база данных
- ✅ Google Sheets интеграция
- ✅ CRM интеграция

### 🔄 В разработке

- 🔄 Автоматическое обновление курсов
- 🔄 Push уведомления
- 🔄 Расширенная аналитика
- 🔄 Мультиязычность

Удачного использования! 🚀 