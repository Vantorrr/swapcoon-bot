const fs = require('fs');
const path = require('path');

class BackupService {
    constructor(database) {
        this.db = database;
        this.backupInterval = 6 * 60 * 60 * 1000; // 6 часов
        this.maxBackups = 10; // Хранить последние 10 бэкапов
    }

    // Создание бэкапа в Google Sheets
    async createBackup() {
        try {
            console.log('💾 Создаем бэкап базы данных...');
            
            if (!global.googleSheetsManager || !global.googleSheetsManager.isReady()) {
                console.log('⚠️ Google Sheets недоступен для бэкапа');
                return false;
            }

            // Экспортируем все таблицы
            const results = await Promise.allSettled([
                global.googleSheetsManager.exportUsers(this.db),
                global.googleSheetsManager.exportStaff(this.db),
                global.googleSheetsManager.exportDailyStats(this.db),
                global.googleSheetsManager.exportAMLMonitoring(this.db)
            ]);

            const successful = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
            console.log(`✅ Бэкап завершен: ${successful}/4 таблиц экспортировано`);
            
            return successful > 0;
        } catch (error) {
            console.error('❌ Ошибка создания бэкапа:', error.message);
            return false;
        }
    }

    // Экспорт критических данных в JSON
    async exportCriticalData() {
        try {
            console.log('📤 Экспорт критических данных...');
            
            const users = await this.db.getUsersForExport();
            const orders = await this.db.getAllOrders();
            const referrals = await this.db.getAllReferrals();
            
            const backup = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                data: {
                    users: users || [],
                    orders: orders || [],
                    referrals: referrals || []
                }
            };

            // Сохраняем в файл (если есть место)
            try {
                const backupPath = path.join(process.cwd(), 'data', `backup_${Date.now()}.json`);
                fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
                console.log(`💾 JSON бэкап сохранен: ${backupPath}`);
            } catch (fsError) {
                console.log('⚠️ Не удалось сохранить JSON бэкап на диск:', fsError.message);
            }

            return backup;
        } catch (error) {
            console.error('❌ Ошибка экспорта критических данных:', error.message);
            return null;
        }
    }

    // Запуск автоматических бэкапов
    startAutoBackup() {
        console.log('🔄 Запуск автоматического бэкапа (каждые 6 часов)');
        
        // Первый бэкап через 5 минут после запуска
        setTimeout(() => {
            this.createBackup();
        }, 5 * 60 * 1000);

        // Затем каждые 6 часов
        setInterval(() => {
            this.createBackup();
        }, this.backupInterval);
    }

    // Восстановление из JSON бэкапа (если понадобится)
    async restoreFromJSON(backupData) {
        try {
            console.log('🔄 Восстановление из JSON бэкапа...');
            
            let restored = 0;
            
            // Восстанавливаем пользователей
            if (backupData.data.users) {
                for (const user of backupData.data.users) {
                    try {
                        await this.db.upsertUser({
                            telegramId: user.telegram_id,
                            username: user.username,
                            firstName: user.first_name,
                            lastName: user.last_name,
                            referredBy: user.referred_by
                        });
                        if (user.total_commission) {
                            await this.db.updateUserCommission(user.telegram_id);
                        }
                        restored++;
                    } catch (userError) {
                        console.log(`⚠️ Ошибка восстановления пользователя ${user.telegram_id}:`, userError.message);
                    }
                }
            }

            console.log(`✅ Восстановлено ${restored} пользователей`);
            return true;
        } catch (error) {
            console.error('❌ Ошибка восстановления:', error.message);
            return false;
        }
    }
}

module.exports = BackupService;