const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class Database {
    constructor() {
        this.dbPath = process.env.DB_PATH || './data/database.sqlite';
        this.ensureDirectoryExists();
        this.init();
    }

    ensureDirectoryExists() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    // Промисификация db.run
    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this);
                }
            });
        });
    }

    init() {
        this.db = new sqlite3.Database(this.dbPath, async (err) => {
            if (err) {
                console.error('Ошибка подключения к базе данных:', err);
            } else {
                console.log('✅ База данных подключена');
                await this.createTables();
            }
        });
    }

    async createTables() {
        try {
            await this.runQuery(\`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER UNIQUE NOT NULL,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    referred_by INTEGER,
                    total_commission REAL DEFAULT 0,
                    favorites TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            \`);

            await this.runQuery(\`
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    from_currency TEXT NOT NULL,
                    to_currency TEXT NOT NULL,
                    from_amount REAL NOT NULL,
                    to_amount REAL NOT NULL,
                    from_address TEXT,
                    to_address TEXT,
                    exchange_rate REAL,
                    fee REAL,
                    aml_status TEXT,
                    status TEXT DEFAULT 'pending',
                    source TEXT DEFAULT 'web',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME,
                    FOREIGN KEY (user_id) REFERENCES users (telegram_id)
                )
            \`);

            await this.runQuery(\`
                CREATE TABLE IF NOT EXISTS staff (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id INTEGER UNIQUE NOT NULL,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    role TEXT CHECK(role IN ('admin', 'operator')) NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    added_by INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (added_by) REFERENCES staff (telegram_id)
                )
            \`);

            await this.runQuery(\`
                CREATE TABLE IF NOT EXISTS order_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER UNIQUE,
                    operator_id INTEGER,
                    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'assigned',
                    notes TEXT,
                    FOREIGN KEY (order_id) REFERENCES orders (id),
                    FOREIGN KEY (operator_id) REFERENCES staff (telegram_id)
                )
            \`);

            console.log('✅ Таблицы базы данных созданы');
            await this.initializeMainAdmin();
            
        } catch (error) {
            console.error('❌ Ошибка создания таблиц:', error);
        }
    }

    async upsertUser(userData) {
        return new Promise((resolve, reject) => {
            const { telegramId, username, firstName, lastName, referredBy } = userData;
            
            this.db.run(\`
                INSERT OR REPLACE INTO users 
                (telegram_id, username, first_name, last_name, referred_by, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            \`, [telegramId, username, firstName, lastName, referredBy], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, telegramId });
                }
            });
        });
    }

    async getUser(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.get(\`
                SELECT * FROM users WHERE telegram_id = ?
            \`, [telegramId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async saveUserFavorites(telegramId, favorites) {
        console.log('💾 Сохраняем избранное для пользователя:', telegramId, 'favorites:', favorites);
        
        const favoritesStr = Array.isArray(favorites) ? favorites.join(',') : '';
        
        // Проверяем существует ли пользователь
        const user = await this.getUser(telegramId);
        
        if (user) {
            // Обновляем существующего
            return new Promise((resolve, reject) => {
                this.db.run(\`
                    UPDATE users SET favorites = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE telegram_id = ?
                \`, [favoritesStr, telegramId], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('✅ Обновлены избранные для пользователя', telegramId, 'changes:', this.changes);
                        resolve(this.changes > 0);
                    }
                });
            });
        } else {
            // Создаем нового пользователя
            return new Promise((resolve, reject) => {
                this.db.run(\`
                    INSERT INTO users (telegram_id, favorites, created_at, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                \`, [telegramId, favoritesStr], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('✅ Создан новый пользователь с избранным', telegramId, 'id:', this.lastID);
                        resolve(true);
                    }
                });
            });
        }
    }

    async getUserFavorites(telegramId) {
        console.log('📥 Получаем избранное для пользователя:', telegramId);
        
        const user = await this.getUser(telegramId);
        
        if (!user || !user.favorites) {
            console.log('❌ Пользователь не найден или нет избранного');
            return [];
        }
        
        const favorites = user.favorites.split(',').filter(f => f.trim());
        console.log('✅ Найдены избранные:', favorites);
        return favorites;
    }

    async createOrder(orderData) {
        return new Promise((resolve, reject) => {
            const {
                userId,
                fromCurrency,
                toCurrency,
                fromAmount,
                toAmount,
                fromAddress,
                toAddress,
                exchangeRate,
                fee,
                amlStatus,
                status = 'pending',
                source = 'web'
            } = orderData;

            console.log('🔄 Создание заявки в базе данных...');
            console.log('📋 Данные заказа:', { userId, fromCurrency, toCurrency, fromAmount, toAmount, source });

            const sql = \`
                INSERT INTO orders 
                (user_id, from_currency, to_currency, from_amount, to_amount, 
                 from_address, to_address, exchange_rate, fee, aml_status, status, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            \`;
            const params = [userId, fromCurrency, toCurrency, fromAmount, toAmount, 
                           fromAddress, toAddress, exchangeRate, fee, amlStatus, status, source];

            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('❌🔥 ОШИБКА СОЗДАНИЯ ЗАКАЗА В БД:', err.message);
                    reject(err);
                } else {
                    console.log('✅🎉 ЗАКАЗ УСПЕШНО СОЗДАН В БД! ID:', this.lastID);
                    const createdOrder = { id: this.lastID, ...orderData };
                    resolve(createdOrder);
                }
            });
        });
    }

    async initializeMainAdmin() {
        try {
            await this.initializeAllStaff();
        } catch (error) {
            console.error('❌ Ошибка инициализации персонала:', error);
        }
    }

    async initializeAllStaff() {
        // Главный админ
        const mainAdminId = process.env.MAIN_ADMIN_ID ? parseInt(process.env.MAIN_ADMIN_ID) : 8141463258;
        await this.addStaffFromEnv(mainAdminId, 'main_admin', 'Главный Админ', 'admin');
        
        // Дополнительные админы
        if (process.env.ADMIN_IDS) {
            const adminIds = process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            console.log(\`👑 Инициализируем \${adminIds.length} дополнительных админов:\`, adminIds);
            
            for (const adminId of adminIds) {
                if (adminId !== mainAdminId) {
                    await this.addStaffFromEnv(adminId, \`admin_\${adminId}\`, 'Админ', 'admin');
                }
            }
        }
        
        // Операторы
        if (process.env.OPERATOR_IDS) {
            const operatorIds = process.env.OPERATOR_IDS.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            console.log(\`👨‍💼 Инициализируем \${operatorIds.length} операторов:\`, operatorIds);
            
            for (const operatorId of operatorIds) {
                await this.addStaffFromEnv(operatorId, \`operator_\${operatorId}\`, 'Оператор', 'operator');
            }
        }
        
        const staffList = await this.getStaffList();
        console.log(\`✅ Всего инициализировано персонала: \${staffList.length}\`);
    }

    async addStaffFromEnv(telegramId, username, firstName, role) {
        return new Promise((resolve, reject) => {
            this.db.run(\`
                INSERT OR IGNORE INTO staff 
                (telegram_id, username, first_name, role, is_active, added_by)
                VALUES (?, ?, ?, ?, 1, NULL)
            \`, [telegramId, username, firstName, role], function(err) {
                if (err) {
                    console.error(\`❌ Ошибка добавления \${role} \${telegramId}:\`, err);
                    reject(err);
                } else {
                    if (this.changes > 0) {
                        console.log(\`✅ \${role === 'admin' ? 'Админ' : 'Оператор'} добавлен: \${telegramId} (\${firstName})\`);
                    }
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    async getStaffList() {
        return new Promise((resolve, reject) => {
            this.db.all(\`
                SELECT 
                    telegram_id,
                    username,
                    first_name,
                    last_name,
                    role,
                    is_active,
                    created_at
                FROM staff
                WHERE is_active = 1
                ORDER BY role DESC, created_at ASC
            \`, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getAdminIds() {
        return new Promise((resolve, reject) => {
            this.db.all(\`
                SELECT telegram_id FROM staff 
                WHERE role = 'admin' AND is_active = 1
            \`, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const adminIds = rows.map(row => row.telegram_id);
                    
                    // Если нет админов в базе, используем MAIN_ADMIN_ID
                    if (adminIds.length === 0 && process.env.MAIN_ADMIN_ID) {
                        adminIds.push(parseInt(process.env.MAIN_ADMIN_ID));
                    }
                    console.log(\`👥 Найдено админов для уведомлений: \${adminIds.length}\`, adminIds);
                    resolve(adminIds);
                }
            });
        });
    }

    async getOrderWithClient(orderId) {
        return new Promise((resolve, reject) => {
            this.db.get(\`
                SELECT 
                    o.*,
                    u.telegram_id as client_id,
                    u.first_name as client_first_name,
                    u.last_name as client_last_name,
                    u.username as client_username
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.telegram_id
                WHERE o.id = ?
            \`, [orderId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async assignOrder(orderId, operatorId) {
        return new Promise((resolve, reject) => {
            this.db.run(\`
                INSERT INTO order_assignments (order_id, operator_id, status)
                VALUES (?, ?, 'assigned')
            \`, [orderId, operatorId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, orderId, operatorId });
                }
            });
        });
    }

    async getUserRole(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.get(\`
                SELECT role, is_active FROM staff WHERE telegram_id = ? AND is_active = 1
            \`, [telegramId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row?.role || null);
                }
            });
        });
    }

    async updateOrderStatus(orderId, status) {
        return new Promise((resolve, reject) => {
            this.db.run(\`
                UPDATE orders 
                SET status = ?
                WHERE id = ?
            \`, [status, orderId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Ошибка закрытия базы данных:', err);
            } else {
                console.log('✅ База данных закрыта');
            }
        });
    }
}

module.exports = Database;
