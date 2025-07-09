#!/bin/bash

echo "🚀 Запуск SwapCoon Bot..."

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js версии 16 или выше."
    exit 1
fi

# Проверяем наличие npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен."
    exit 1
fi

# Устанавливаем зависимости если их нет
if [ ! -d "node_modules" ]; then
    echo "📦 Устанавливаем зависимости..."
    npm install
fi

# Проверяем наличие .env файла
if [ ! -f ".env" ]; then
    echo "⚠️  Файл .env не найден. Скопируйте .env.example в .env и заполните переменные."
    echo "📋 Копируем .env.example в .env..."
    cp .env.example .env
    echo "✅ Файл .env создан. Отредактируйте его и добавьте ваш BOT_TOKEN."
    exit 1
fi

# Создаем папку для базы данных
mkdir -p data

echo "🌐 Запускаем веб-сервер..."
npm run web &
WEB_PID=$!

echo "🤖 Запускаем Telegram бота..."
npm run dev &
BOT_PID=$!

echo "✅ SwapCoon запущен!"
echo "📱 Мини-приложение: http://localhost:3000"
echo "🤖 Telegram бот активен"
echo ""
echo "Для остановки нажмите Ctrl+C"

# Функция для корректного завершения
cleanup() {
    echo ""
    echo "🛑 Останавливаем сервисы..."
    kill $WEB_PID 2>/dev/null
    kill $BOT_PID 2>/dev/null
    echo "✅ Сервисы остановлены"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Ждем завершения
wait 