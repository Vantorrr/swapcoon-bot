const Database = require('./src/models/Database');

// Список всех админов из локальной базы
const ADMINS_TO_MIGRATE = [
    {
        telegramId: 8141463258,
        username: 'main_admin', 
        firstName: 'Главный Админ',
        lastName: null
    },
    {
        telegramId: 461759951,
        username: 'admin_user',
        firstName: 'Admin', 
        lastName: null
    },
    {
        telegramId: 280417617,
        username: null,
        firstName: 'Админ',
        lastName: null
    }
];

// Операторы для миграции
const OPERATORS_TO_MIGRATE = [
    {
        telegramId: 7692725312,
        username: null,
        firstName: 'Новый оператор',
        lastName: null
    }
];

async function migrateAdmins() {
    const db = new Database();
    
    // Ждем инициализации базы
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        console.log('🚀 МИГРАЦИЯ АДМИНОВ И ОПЕРАТОРОВ');
        console.log('');
        
        // Проверяем текущее состояние
        console.log('🔍 Проверяем текущий состав...');
        const currentStaff = await db.getStaffList();
        console.log(`📊 Найдено: ${currentStaff.length} сотрудников`);
        
        // Мигрируем админов
        console.log('');
        console.log('🛡️ ДОБАВЛЯЕМ АДМИНОВ:');
        
        for (const admin of ADMINS_TO_MIGRATE) {
            try {
                // Проверяем не существует ли уже
                const existing = await db.getStaffById(admin.telegramId);
                if (existing) {
                    console.log(`   ⚠️ ${admin.firstName} (${admin.telegramId}) уже существует`);
                    continue;
                }
                
                await db.addStaff({
                    telegramId: admin.telegramId,
                    username: admin.username,
                    firstName: admin.firstName,
                    lastName: admin.lastName,
                    role: 'admin',
                    addedBy: 8141463258
                });
                
                console.log(`   ✅ ${admin.firstName} (${admin.telegramId}) добавлен`);
                
            } catch (error) {
                console.log(`   ❌ Ошибка добавления ${admin.firstName}: ${error.message}`);
            }
        }
        
        // Мигрируем операторов
        console.log('');
        console.log('👨‍💼 ДОБАВЛЯЕМ ОПЕРАТОРОВ:');
        
        for (const operator of OPERATORS_TO_MIGRATE) {
            try {
                // Проверяем не существует ли уже
                const existing = await db.getStaffById(operator.telegramId);
                if (existing) {
                    console.log(`   ⚠️ ${operator.firstName} (${operator.telegramId}) уже существует`);
                    continue;
                }
                
                await db.addStaff({
                    telegramId: operator.telegramId,
                    username: operator.username,
                    firstName: operator.firstName,
                    lastName: operator.lastName,
                    role: 'operator',
                    addedBy: 8141463258
                });
                
                console.log(`   ✅ ${operator.firstName} (${operator.telegramId}) добавлен`);
                
            } catch (error) {
                console.log(`   ❌ Ошибка добавления ${operator.firstName}: ${error.message}`);
            }
        }
        
        console.log('');
        console.log('📋 ИТОГОВЫЙ СОСТАВ:');
        const finalStaff = await db.getStaffList();
        
        const admins = finalStaff.filter(s => s.role === 'admin');
        const operators = finalStaff.filter(s => s.role === 'operator');
        
        console.log('🛡️ АДМИНЫ:');
        admins.forEach(admin => {
            console.log(`   - ${admin.first_name} (@${admin.username || 'null'}) - ID: ${admin.telegram_id}`);
        });
        
        console.log('👨‍💼 ОПЕРАТОРЫ:');
        operators.forEach(op => {
            console.log(`   - ${op.first_name} (@${op.username || 'null'}) - ID: ${op.telegram_id}`);
        });
        
        const adminIds = await db.getAdminIds();
        console.log('');
        console.log(`📢 Админы для уведомлений: ${adminIds.join(', ')}`);
        
        console.log('');
        console.log('✅ МИГРАЦИЯ ЗАВЕРШЕНА!');
        console.log('');
        console.log('📝 НЕ ЗАБУДЬ:');
        console.log('   1. Установить MAIN_ADMIN_ID=8141463258 в переменных Railway');
        console.log('   2. Перезапустить приложение на Railway');
        console.log('   3. Проверить права в боте');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Ошибка миграции:', error);
        process.exit(1);
    }
}

// Запускаем если это главный файл
if (require.main === module) {
    migrateAdmins();
}

module.exports = { migrateAdmins }; 