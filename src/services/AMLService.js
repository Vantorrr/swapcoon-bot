const axios = require('axios');

class AMLService {
    constructor() {
        this.apiUrl = process.env.AML_API_URL;
        this.apiKey = process.env.AML_API_KEY;
        this.cache = new Map(); // Кеш для результатов проверки
        this.cacheExpiry = 60 * 60 * 1000; // 1 час
    }

    async checkAddress(address, currency) {
        try {
            // Проверяем кеш
            const cacheKey = `${address}_${currency}`;
            const cached = this.cache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                console.log('✅ AML результат из кеша для', address);
                return cached.result;
            }

            // Если нет API ключа, возвращаем тестовый результат
            if (!this.apiKey || !this.apiUrl) {
                console.log('⚠️ AML API не настроен, используем тестовый режим');
                return this.getTestResult(address, currency);
            }

            // Выполняем запрос к AML API
            const response = await axios.post(this.apiUrl, {
                address: address,
                currency: currency.toUpperCase(),
                checks: ['sanctions', 'blacklist', 'mixer', 'exchange']
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 секунд
            });

            const result = this.parseAMLResponse(response.data);
            
            // Сохраняем в кеш
            this.cache.set(cacheKey, {
                result: result,
                timestamp: Date.now()
            });

            console.log('✅ AML проверка завершена для', address, '- статус:', result.status);
            return result;

        } catch (error) {
            console.error('❌ Ошибка AML проверки:', error.message);
            
            // В случае ошибки возвращаем безопасный результат
            return {
                status: 'failed',
                risk: 'unknown',
                score: 0,
                reasons: ['Ошибка проверки AML'],
                details: {
                    sanctions: false,
                    blacklist: false,
                    mixer: false,
                    exchange: false
                },
                timestamp: Date.now()
            };
        }
    }

    parseAMLResponse(data) {
        // Парсим ответ от AML сервиса
        const riskScore = data.risk_score || 0;
        let status = 'approved';
        let risk = 'low';

        if (riskScore > 80) {
            status = 'rejected';
            risk = 'high';
        } else if (riskScore > 50) {
            status = 'manual_review';
            risk = 'medium';
        }

        return {
            status: status,
            risk: risk,
            score: riskScore,
            reasons: data.flags || [],
            details: {
                sanctions: data.sanctions || false,
                blacklist: data.blacklist || false,
                mixer: data.mixer || false,
                exchange: data.exchange || false
            },
            timestamp: Date.now()
        };
    }

    getTestResult(address, currency) {
        // Тестовые результаты для разработки
        const addressHash = this.simpleHash(address);
        const riskScore = addressHash % 100;

        let status = 'approved';
        let risk = 'low';
        const reasons = [];

        // Симулируем различные сценарии
        if (riskScore > 85) {
            status = 'rejected';
            risk = 'high';
            reasons.push('Адрес в черном списке');
        } else if (riskScore > 60) {
            status = 'manual_review';
            risk = 'medium';
            reasons.push('Требуется ручная проверка');
        }

        // Специальные адреса для тестирования
        if (address.includes('test-reject')) {
            status = 'rejected';
            risk = 'high';
            reasons.push('Тестовый адрес для отклонения');
        } else if (address.includes('test-review')) {
            status = 'manual_review';
            risk = 'medium';
            reasons.push('Тестовый адрес для ручной проверки');
        }

        return {
            status: status,
            risk: risk,
            score: riskScore,
            reasons: reasons,
            details: {
                sanctions: riskScore > 90,
                blacklist: riskScore > 85,
                mixer: riskScore > 70,
                exchange: riskScore > 30
            },
            timestamp: Date.now()
        };
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    getRiskDescription(risk) {
        const descriptions = {
            'low': '🟢 Низкий риск - адрес безопасен',
            'medium': '🟡 Средний риск - требуется проверка оператором',
            'high': '🔴 Высокий риск - адрес заблокирован',
            'unknown': '⚪ Неизвестный риск - ошибка проверки'
        };

        return descriptions[risk] || descriptions['unknown'];
    }

    getStatusMessage(status) {
        const messages = {
            'approved': '✅ Проверка пройдена успешно',
            'rejected': '❌ Адрес отклонен системой безопасности',
            'manual_review': '⏳ Требуется ручная проверка оператором',
            'failed': '❌ Ошибка проверки, обратитесь к оператору'
        };

        return messages[status] || messages['failed'];
    }

    // Очистка кеша
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Кеш AML проверок очищен');
    }

    // Получение статистики кеша
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

module.exports = AMLService; 