const Database = require('./src/models/Database');

async function addStaff() {
    const db = new Database();
    
    // Ждем инициализации базы
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('📋 ИНСТРУКЦИЯ ПО ДОБАВЛЕНИЮ ПЕРСОНАЛА');
        console.log('');
        console.log('🛡️ Добавить админа:');
        console.log('   node add_staff.js admin [TELEGRAM_ID] [ИМЯ] [USERNAME]');
        console.log('   Пример: node add_staff.js admin 123456789 "Павел" pavel_admin');
        console.log('');
        console.log('👨‍💼 Добавить оператора:');
        console.log('   node add_staff.js operator [TELEGRAM_ID] [ИМЯ] [USERNAME]');
        console.log('   Пример: node add_staff.js operator 987654321 "Анна" anna_operator');
        console.log('');
        console.log('🔍 Показать всех:');
        console.log('   node add_staff.js list');
        console.log('');
        console.log('🗑️ Удалить пользователя:');
        console.log('   node add_staff.js remove [TELEGRAM_ID]');
        console.log('   Пример: node add_staff.js remove 123456789');
        console.log('');
        
        // Показываем текущий состав
        try {
            const staff = await db.getStaffList();
            console.log('👥 ТЕКУЩИЙ СОСТАВ:');
            if (staff.length === 0) {
                console.log('   Пусто');
            } else {
                staff.forEach(person => {
                    const icon = person.role === 'admin' ? '🛡️' : '👨‍💼';
                    console.log(`   ${icon} ${person.first_name} (@${person.username || 'null'}) - ID: ${person.telegram_id} - ${person.role}`);
                });
            }
        } catch (error) {
            console.error('Ошибка получения списка:', error.message);
        }
        
        process.exit(0);
    }
    
    const command = args[0].toLowerCase();
    
    try {
        if (command === 'list') {
            const staff = await db.getStaffList();
            console.log('👥 ПОЛНЫЙ СПИСОК ПЕРСОНАЛА:');
            console.log('');
            
            const admins = staff.filter(p => p.role === 'admin');
            const operators = staff.filter(p => p.role === 'operator');
            
            console.log('🛡️ АДМИНЫ:');
            if (admins.length === 0) {
                console.log('   Нет админов');
            } else {
                admins.forEach(admin => {
                    console.log(`   - ${admin.first_name} (@${admin.username || 'null'}) - ID: ${admin.telegram_id}`);
                });
            }
            
            console.log('');
            console.log('👨‍💼 ОПЕРАТОРЫ:');
            if (operators.length === 0) {
                console.log('   Нет операторов');
            } else {
                operators.forEach(op => {
                    console.log(`   - ${op.first_name} (@${op.username || 'null'}) - ID: ${op.telegram_id}`);
                });
            }
            
            const adminIds = await db.getAdminIds();
            console.log(`\n📢 Админы для уведомлений: ${adminIds.join(', ')}`);
            
        } else if (command === 'admin' || command === 'operator') {
            const telegramId = args[1];
            const firstName = args[2];
            const username = args[3];
            
            if (!telegramId || !firstName) {
                console.log(`❌ Не хватает данных для добавления ${command}а`);
                console.log(`Использование: node add_staff.js ${command} [TELEGRAM_ID] [ИМЯ] [USERNAME]`);
                process.exit(1);
            }
            
            if (!/^\d+$/.test(telegramId)) {
                console.log('❌ TELEGRAM_ID должен содержать только цифры');
                process.exit(1);
            }
            
            // Проверяем не существует ли уже
            const existing = await db.getStaffById(parseInt(telegramId));
            if (existing) {
                console.log(`❌ Пользователь с ID ${telegramId} уже существует: ${existing.first_name} (${existing.role})`);
                process.exit(1);
            }
            
            const role = command;
            const result = await db.addStaff({
                telegramId: parseInt(telegramId),
                username: username || null,
                firstName: firstName,
                lastName: null,
                role: role,
                addedBy: 8141463258 // Главный админ как добавивший
            });
            
            const roleIcon = role === 'admin' ? '🛡️' : '👨‍💼';
            console.log(`✅ ${roleIcon} ${role.toUpperCase()} добавлен!`);
            console.log(`   Имя: ${firstName}`);
            console.log(`   ID: ${telegramId}`);
            console.log(`   Username: @${username || 'не указан'}`);
            
        } else if (command === 'remove') {
            const telegramId = args[1];
            
            if (!telegramId) {
                console.log('❌ Укажите TELEGRAM_ID для удаления');
                console.log('Использование: node add_staff.js remove [TELEGRAM_ID]');
                process.exit(1);
            }
            
            if (!/^\d+$/.test(telegramId)) {
                console.log('❌ TELEGRAM_ID должен содержать только цифры');
                process.exit(1);
            }
            
            const id = parseInt(telegramId);
            
            // Проверяем существует ли
            const existing = await db.getStaffById(id);
            if (!existing) {
                console.log(`❌ Пользователь с ID ${telegramId} не найден`);
                process.exit(1);
            }
            
            // Проверяем не главный ли это админ
            if (id === 8141463258) {
                console.log('❌ Нельзя удалить главного админа');
                process.exit(1);
            }
            
            await db.removeStaff(id);
            console.log(`✅ Пользователь удален: ${existing.first_name} (${existing.role})`);
            
        } else {
            console.log(`❌ Неизвестная команда: ${command}`);
            console.log('Доступные команды: admin, operator, list, remove');
            process.exit(1);
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        process.exit(1);
    }
}

// Запускаем если это главный файл
if (require.main === module) {
    addStaff();
}

module.exports = { addStaff }; 