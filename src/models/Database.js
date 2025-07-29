const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class DatabaseService {
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

    init() {
        try {
            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL');
            console.log('✅ База данных подключена (better-sqlite3)');
            this.createTables();
        } catch (err) {
            console.error('❌ Ошибка подключения к базе данных:', err);
        }
    }

    createTables() {
        try {
            this.db.exec(\`
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

            this.db.exec(\`
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

            this.db.exec(\`
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

            this.db.exec(\`
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
            this.initializeMainAdmin();
            
        } catch (error) {
            console.error('❌ Ошибка создания таблиц:', error);
        }
    }

    upsertUser(userData) {
        const { telegramId, username, firstName, lastName, referredBy } = userData;
        const stmt = this.db.prepare(\`
            INSERT OR REPLACE INTO users 
            (telegram_id, username, first_name, last_name, referred_by, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        \`);
        const result = stmt.run(telegramId, username, firstName, lastName, referredBy);
        return { id: result.lastInsertRowid, telegramId };
    }

    getUser(telegramId) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE telegram_id = ?');
        return stmt.get(telegramId);
    }

    saveUserFavorites(telegramId, favorites) {
        const favoritesStr = Array.isArray(favorites) ? favorites.join(',') : '';
        const user = this.getUser(telegramId);
        
        if (user) {
            const stmt = this.db.prepare(\`UPDATE users SET favorites = ? WHERE telegram_id = ?\`);
            const result = stmt.run(favoritesStr, telegramId);
            return result.changes > 0;
        } else {
            const stmt = this.db.prepare(\`INSERT INTO users (telegram_id, favorites) VALUES (?, ?)\`);
            const result = stmt.run(telegramId, favoritesStr);
            return true;
        }
    }

    getUserFavorites(telegramId) {
        const user = this.getUser(telegramId);
        if (!user || !user.favorites) return [];
        return user.favorites.split(',').filter(f => f.trim());
    }

    createOrder(orderData) {
        const {
            userId, fromCurrency, toCurrency, fromAmount, toAmount,
            fromAddress, toAddress, exchangeRate, fee, amlStatus,
            status = 'pending', source = 'web'
        } = orderData;

        const stmt = this.db.prepare(\`
            INSERT INTO orders 
            (user_id, from_currency, to_currency, from_amount, to_amount, 
             from_address, to_address, exchange_rate, fee, aml_status, status, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        \`);

        const result = stmt.run(userId, fromCurrency, toCurrency, fromAmount, toAmount, 
                               fromAddress, toAddress, exchangeRate, fee, amlStatus, status, source);
        
        return { id: result.lastInsertRowid, ...orderData };
    }

    initializeMainAdmin() {
        this.initializeAllStaff();
    }

    initializeAllStaff() {
        const mainAdminId = process.env.MAIN_ADMIN_ID ? parseInt(process.env.MAIN_ADMIN_ID) : 8141463258;
        this.addStaffFromEnv(mainAdminId, 'main_admin', 'Главный Админ', 'admin');
        
        if (process.env.ADMIN_IDS) {
            const adminIds = process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            for (const adminId of adminIds) {
                if (adminId !== mainAdminId) {
                    this.addStaffFromEnv(adminId, \`admin_\${adminId}\`, 'Админ', 'admin');
                }
            }
        }
        
        if (process.env.OPERATOR_IDS) {
            const operatorIds = process.env.OPERATOR_IDS.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            for (const operatorId of operatorIds) {
                this.addStaffFromEnv(operatorId, \`operator_\${operatorId}\`, 'Оператор', 'operator');
            }
        }
    }

    addStaffFromEnv(telegramId, username, firstName, role) {
        const stmt = this.db.prepare(\`
            INSERT OR IGNORE INTO staff 
            (telegram_id, username, first_name, role, is_active, added_by)
            VALUES (?, ?, ?, ?, 1, NULL)
        \`);
        
        const result = stmt.run(telegramId, username, firstName, role);
        if (result.changes > 0) {
            console.log(\`✅ \${role === 'admin' ? 'Админ' : 'Оператор'} добавлен: \${telegramId} (\${firstName})\`);
        }
        return { id: result.lastInsertRowid };
    }

    getStaffList() {
        const stmt = this.db.prepare(\`
            SELECT telegram_id, username, first_name, last_name, role, is_active, created_at
            FROM staff WHERE is_active = 1 ORDER BY role DESC, created_at ASC
        \`);
        return stmt.all();
    }

    getAdminIds() {
        const stmt = this.db.prepare('SELECT telegram_id FROM staff WHERE role = "admin" AND is_active = 1');
        const rows = stmt.all();
        const adminIds = rows.map(row => row.telegram_id);
        
        if (adminIds.length === 0 && process.env.MAIN_ADMIN_ID) {
            adminIds.push(parseInt(process.env.MAIN_ADMIN_ID));
        }
        return adminIds;
    }

    getOrderWithClient(orderId) {
        const stmt = this.db.prepare(\`
            SELECT o.*, u.telegram_id as client_id, u.first_name as client_first_name,
                   u.last_name as client_last_name, u.username as client_username
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.telegram_id
            WHERE o.id = ?
        \`);
        return stmt.get(orderId);
    }

    assignOrder(orderId, operatorId) {
        const stmt = this.db.prepare('INSERT INTO order_assignments (order_id, operator_id, status) VALUES (?, ?, "assigned")');
        const result = stmt.run(orderId, operatorId);
        return { id: result.lastInsertRowid, orderId, operatorId };
    }

    getUserRole(telegramId) {
        const stmt = this.db.prepare('SELECT role FROM staff WHERE telegram_id = ? AND is_active = 1');
        const row = stmt.get(telegramId);
        return row?.role || null;
    }

    updateOrderStatus(orderId, status) {
        const stmt = this.db.prepare('UPDATE orders SET status = ? WHERE id = ?');
        const result = stmt.run(status, orderId);
        return { changes: result.changes };
    }

    close() {
        try {
            this.db.close();
            console.log('✅ База данных закрыта');
        } catch (err) {
            console.error('❌ Ошибка закрытия базы данных:', err);
        }
    }
}

module.exports = DatabaseService;
