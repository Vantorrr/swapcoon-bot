const axios = require('axios');

class CRMService {
    constructor() {
        this.apiUrl = process.env.CRM_API_URL;
        this.apiKey = process.env.CRM_API_KEY;
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 секунда
    }

    async createLead(orderData, userData) {
        try {
            if (!this.apiUrl || !this.apiKey) {
                console.log('⚠️ CRM API не настроен, лид не создан');
                return { success: false, message: 'CRM не настроен' };
            }

            const leadData = this.formatLeadData(orderData, userData);
            
            for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
                try {
                    const response = await axios.post(`${this.apiUrl}/leads`, leadData, {
                        headers: {
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000 // 10 секунд
                    });

                    console.log('✅ Лид создан в CRM:', response.data.id);
                    return {
                        success: true,
                        leadId: response.data.id,
                        data: response.data
                    };

                } catch (error) {
                    console.error(`❌ Попытка ${attempt} создания лида неудачна:`, error.message);
                    
                    if (attempt === this.retryAttempts) {
                        throw error;
                    }
                    
                    await this.delay(this.retryDelay * attempt);
                }
            }

        } catch (error) {
            console.error('❌ Ошибка создания лида в CRM:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    formatLeadData(orderData, userData) {
        return {
            // Основная информация о лиде
            source: 'telegram_bot',
            status: 'new',
            priority: this.calculatePriority(orderData),
            
            // Информация о пользователе
            contact: {
                telegram_id: userData.telegram_id,
                username: userData.username,
                first_name: userData.first_name,
                last_name: userData.last_name,
                created_at: userData.created_at
            },

            // Информация о заявке
            order: {
                id: orderData.id,
                from_currency: orderData.fromCurrency,
                to_currency: orderData.toCurrency,
                from_amount: orderData.fromAmount,
                to_amount: orderData.toAmount,
                exchange_rate: orderData.exchangeRate,
                fee: orderData.fee,
                from_address: orderData.fromAddress,
                to_address: orderData.toAddress,
                aml_status: orderData.amlStatus,
                status: orderData.status,
                created_at: new Date().toISOString()
            },

            // Метаданные
            metadata: {
                bot_version: '1.0.0',
                platform: 'telegram',
                created_by: 'exmachinax_bot'
            }
        };
    }

    calculatePriority(orderData) {
        const amount = parseFloat(orderData.fromAmount) || 0;
        
        if (amount >= 10000) return 'high';
        if (amount >= 1000) return 'medium';
        return 'low';
    }

    async updateLead(leadId, updateData) {
        try {
            if (!this.apiUrl || !this.apiKey) {
                console.log('⚠️ CRM API не настроен, лид не обновлен');
                return { success: false, message: 'CRM не настроен' };
            }

            const response = await axios.put(`${this.apiUrl}/leads/${leadId}`, updateData, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            console.log('✅ Лид обновлен в CRM:', leadId);
            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            console.error('❌ Ошибка обновления лида в CRM:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getLead(leadId) {
        try {
            if (!this.apiUrl || !this.apiKey) {
                return { success: false, message: 'CRM не настроен' };
            }

            const response = await axios.get(`${this.apiUrl}/leads/${leadId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                timeout: 10000
            });

            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            console.error('❌ Ошибка получения лида из CRM:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async createActivity(leadId, activityData) {
        try {
            if (!this.apiUrl || !this.apiKey) {
                return { success: false, message: 'CRM не настроен' };
            }

            const response = await axios.post(`${this.apiUrl}/leads/${leadId}/activities`, {
                type: activityData.type || 'note',
                title: activityData.title,
                description: activityData.description,
                created_at: new Date().toISOString(),
                created_by: 'exmachinax_bot'
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            console.log('✅ Активность создана в CRM для лида:', leadId);
            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            console.error('❌ Ошибка создания активности в CRM:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getAnalytics(dateFrom, dateTo) {
        try {
            if (!this.apiUrl || !this.apiKey) {
                return { success: false, message: 'CRM не настроен' };
            }

            const response = await axios.get(`${this.apiUrl}/analytics`, {
                params: {
                    date_from: dateFrom,
                    date_to: dateTo,
                    source: 'telegram_bot'
                },
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                timeout: 15000
            });

            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            console.error('❌ Ошибка получения аналитики из CRM:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Утилитарные методы
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isConfigured() {
        return !!(this.apiUrl && this.apiKey);
    }

    getConnectionStatus() {
        return {
            configured: this.isConfigured(),
            url: this.apiUrl ? '***' : null,
            key: this.apiKey ? '***' : null
        };
    }
}

module.exports = CRMService; 