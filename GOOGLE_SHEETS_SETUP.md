# 📋 Настройка Google Sheets интеграции для SwapCoon

## 🎯 Что будет создано

После настройки вы получите Google Таблицу с 5 листами:

1. **📊 Orders** - все заказы с полной информацией
2. **👥 Staff** - операторы и их статистика  
3. **📈 Daily_Stats** - дневная статистика
4. **👤 Users** - пользователи и их активность
5. **🛡️ AML_Monitoring** - мониторинг крупных операций

## 🔧 Пошаговая настройка

### Шаг 1: Google Cloud Console
1. Перейдите на [console.cloud.google.com](https://console.cloud.google.com)
2. Создайте новый проект или выберите существующий
3. В поиске найдите "Google Sheets API" и включите его

### Шаг 2: Service Account
1. Перейдите в "IAM & Admin" → "Service Accounts"
2. Нажмите "Create Service Account"
3. Введите имя (например: `swapcoon-sheets`)
4. Выберите роль "Editor"
5. Нажмите "Done"

### Шаг 3: Получение ключа
1. Нажмите на созданный Service Account
2. Перейдите во вкладку "Keys"
3. Нажмите "Add Key" → "Create new key"
4. Выберите тип "JSON" и скачайте файл

### Шаг 4: Создание таблицы
1. Перейдите на [sheets.google.com](https://sheets.google.com)
2. Создайте новую таблицу
3. Дайте ей название "SwapCoon Analytics"
4. Скопируйте ID таблицы из URL (часть между `/d/` и `/edit`)

### Шаг 5: Предоставление доступа
1. В Google Таблице нажмите "Share"
2. Добавьте email из JSON файла (поле `client_email`)
3. Выберите права "Editor"
4. Нажмите "Send"

### Шаг 6: Настройка бота
1. Откройте файл `config/google-sheets.json`
2. Скопируйте содержимое скачанного JSON в поле `credentials`
3. Вставьте ID таблицы в поле `spreadsheet_id`
4. Установите `"enabled": true`

### Шаг 7: Перезапуск
```bash
# Остановите бота
Ctrl+C

# Запустите снова
node src/bot.js
```

## 📋 Пример конфигурации

```json
{
  "credentials": {
    "type": "service_account",
    "project_id": "your-project-123456",
    "private_key_id": "abc123...",
    "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n",
    "client_email": "swapcoon-sheets@your-project-123456.iam.gserviceaccount.com",
    "client_id": "123456789...",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token"
  },
  "spreadsheet_id": "1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
  "enabled": true,
  "auto_export_interval": 3600000
}
```

## 🚀 Возможности

### ⚡ Автоматический экспорт
- Данные обновляются каждый час автоматически
- Настраивается через `auto_export_interval` (в миллисекундах)

### 🎮 Ручной экспорт через бота
- `/admin` → `⚙️ Настройки` → `📋 Google Sheets`
- Экспорт всех данных или отдельных категорий
- Мгновенные обновления

### 📊 Структура данных

#### Лист "Orders"
- ID заказа, дата, пользователь
- Валютные пары и суммы
- Статус, оператор, время обработки
- AML статус, прибыль, приоритет

#### Лист "Staff"  
- ID, имя, роль оператора
- Количество обработанных заказов
- Общие суммы и комиссии
- Активность и статистика

#### Лист "Daily_Stats"
- Дневная статистика по заказам
- Обороты и прибыль
- Новые пользователи
- Активность операторов

#### Лист "Users"
- Данные пользователей
- История заказов  
- Реферальная статистика
- Активность

#### Лист "AML_Monitoring"
- Крупные операции (>$1000)
- AML статусы и риск-скоры
- Блокчейн анализ
- Действия операторов

## 🔧 Устранение проблем

### Ошибка "Google Sheets недоступен"
- Проверьте правильность JSON ключа
- Убедитесь что Service Account имеет доступ к таблице
- Проверьте что Google Sheets API включен

### Ошибка "Permission denied"
- Поделитесь таблицей с email из `client_email`
- Выдайте права "Editor"

### Ошибка "Spreadsheet not found"
- Проверьте правильность `spreadsheet_id`
- Убедитесь что таблица существует

## 🎉 Результат

После настройки вы получите:
- ✅ Красивую аналитическую таблицу
- ✅ Автоматическое обновление данных  
- ✅ Графики и сводные таблицы (настраиваются в Google Sheets)
- ✅ Экспорт в CSV/Excel из Google Sheets
- ✅ Совместный доступ для команды

Ваши данные SwapCoon теперь всегда под рукой! 🚀 