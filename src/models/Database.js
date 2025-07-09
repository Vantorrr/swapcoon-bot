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

    init() {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Ошибка подключения к базе данных:', err);
            } else {
                console.log('✅ База данных подключена');
                this.createTables();
            }
        });
    }

    createTables() {
        // Таблица пользователей
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                referred_by INTEGER,
                total_commission REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица заявок
        this.db.run(`
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
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users (telegram_id)
            )
        `);

        // Таблица рефералов
        this.db.run(`
            CREATE TABLE IF NOT EXISTS referrals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                referrer_id INTEGER,
                referee_id INTEGER,
                order_id INTEGER,
                commission REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (referrer_id) REFERENCES users (telegram_id),
                FOREIGN KEY (referee_id) REFERENCES users (telegram_id),
                FOREIGN KEY (order_id) REFERENCES orders (id)
            )
        `);

        // Таблица достижений пользователей
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_achievements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                achievement_id TEXT,
                earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (telegram_id),
                UNIQUE(user_id, achievement_id)
            )
        `);

        // Таблица настроек пользователей
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE,
                notifications_enabled BOOLEAN DEFAULT 1,
                language TEXT DEFAULT 'ru',
                theme TEXT DEFAULT 'auto',
                currency_preference TEXT DEFAULT 'USD',
                privacy_level TEXT DEFAULT 'normal',
                two_fa_enabled BOOLEAN DEFAULT 0,
                settings_json TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (telegram_id)
            )
        `);

        // Таблица статистики пользователей (дневная агрегация)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_daily_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                date TEXT,
                orders_count INTEGER DEFAULT 0,
                volume_usd REAL DEFAULT 0,
                commission_earned REAL DEFAULT 0,
                fees_paid REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (telegram_id),
                UNIQUE(user_id, date)
            )
        `);

        // Таблица админов и операторов
        this.db.run(`
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
        `);

        // Таблица для отслеживания принятых заказов операторами
        this.db.run(`
            CREATE TABLE IF NOT EXISTS order_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER UNIQUE,
                operator_id INTEGER,
                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'assigned' CHECK(status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
                notes TEXT,
                FOREIGN KEY (order_id) REFERENCES orders (id),
                FOREIGN KEY (operator_id) REFERENCES staff (telegram_id)
            )
        `);

        // Таблица уведомлений для операторов
        this.db.run(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipient_id INTEGER,
                type TEXT,
                title TEXT,
                message TEXT,
                order_id INTEGER,
                is_read BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (recipient_id) REFERENCES staff (telegram_id),
                FOREIGN KEY (order_id) REFERENCES orders (id)
            )
        `);

        // Таблица сообщений чата между оператором и клиентом
        this.db.run(`
            CREATE TABLE IF NOT EXISTS order_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                sender_id INTEGER NOT NULL,
                sender_type TEXT NOT NULL, -- 'client' или 'operator'
                message TEXT NOT NULL,
                message_type TEXT DEFAULT 'text', -- 'text', 'status_change', 'system'
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders (id)
            )
        `);

        console.log('✅ Таблицы базы данных созданы');
        
        // Добавляем главного админа (ваш ID)
        this.initializeMainAdmin();
    }

    // Создание или обновление пользователя
    async upsertUser(userData) {
        return new Promise((resolve, reject) => {
            const { telegramId, username, firstName, lastName, referredBy } = userData;
            
            this.db.run(`
                INSERT OR REPLACE INTO users 
                (telegram_id, username, first_name, last_name, referred_by, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [telegramId, username, firstName, lastName, referredBy], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, telegramId });
                }
            });
        });
    }

    // Получение пользователя
    async getUser(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM users WHERE telegram_id = ?
            `, [telegramId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Создание заявки
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
                status
            } = orderData;

            this.db.run(`
                INSERT INTO orders 
                (user_id, from_currency, to_currency, from_amount, to_amount, 
                 from_address, to_address, exchange_rate, fee, aml_status, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [userId, fromCurrency, toCurrency, fromAmount, toAmount, 
                fromAddress, toAddress, exchangeRate, fee, amlStatus, status], 
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...orderData });
                }
            });
        });
    }

    // Получение истории пользователя
    async getUserHistory(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    o.*,
                    datetime(o.created_at, 'localtime') as created_at_local
                FROM orders o
                WHERE o.user_id = ?
                ORDER BY o.created_at DESC
                LIMIT 50
            `, [telegramId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Получение статистики рефералов
    async getReferralStats(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    COUNT(DISTINCT referee_id) as total_referrals,
                    COALESCE(SUM(commission), 0) as total_commission,
                    COUNT(DISTINCT order_id) as successful_orders
                FROM referrals
                WHERE referrer_id = ?
            `, [telegramId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || { total_referrals: 0, total_commission: 0, successful_orders: 0 });
                }
            });
        });
    }

    // Получение списка рефералов
    async getReferralList(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    u.telegram_id,
                    u.first_name,
                    u.last_name,
                    u.username,
                    u.created_at,
                    COUNT(r.order_id) as orders_count,
                    COALESCE(SUM(r.commission), 0) as total_earned
                FROM users u
                LEFT JOIN referrals r ON u.telegram_id = r.referee_id AND r.referrer_id = ?
                WHERE u.referred_by = ?
                GROUP BY u.telegram_id
                ORDER BY u.created_at DESC
                LIMIT 100
            `, [telegramId, telegramId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Добавление реферальной комиссии
    async addReferralCommission(data) {
        return new Promise((resolve, reject) => {
            const { referrerId, refereeId, orderId, commission } = data;
            
            this.db.run(`
                INSERT INTO referrals (referrer_id, referee_id, order_id, commission)
                VALUES (?, ?, ?, ?)
            `, [referrerId, refereeId, orderId, commission], function(err) {
                if (err) {
                    reject(err);
                } else {
                    // Обновляем общую комиссию пользователя
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    // Обновление общей комиссии пользователя
    async updateUserCommission(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE users 
                SET total_commission = (
                    SELECT COALESCE(SUM(commission), 0) 
                    FROM referrals 
                    WHERE referrer_id = ?
                )
                WHERE telegram_id = ?
            `, [telegramId, telegramId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Получение общей статистики для админов
    async getStats() {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as totalUsers,
                    (SELECT COUNT(*) FROM orders WHERE date(created_at) = date('now')) as ordersToday,
                    (SELECT COALESCE(SUM(to_amount), 0) FROM orders WHERE status = 'completed') as totalVolume,
                    (SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'processing')) as activeOrders,
                    (SELECT COUNT(*) FROM referrals) as totalReferrals,
                    (SELECT COALESCE(SUM(commission), 0) FROM referrals) as totalCommissions
            `, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Обновление статуса заявки
    async updateOrderStatus(orderId, status) {
        return new Promise((resolve, reject) => {
            const completedAt = status === 'completed' ? 'CURRENT_TIMESTAMP' : 'NULL';
            
            this.db.run(`
                UPDATE orders 
                SET status = ?, completed_at = ${completedAt}
                WHERE id = ?
            `, [status, orderId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Получение топ рефереров
    async getTopReferrers(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    u.telegram_id,
                    u.first_name,
                    u.last_name,
                    u.username,
                    COUNT(DISTINCT r.referee_id) as referrals_count,
                    COALESCE(SUM(r.commission), 0) as total_earned,
                    COUNT(r.order_id) as total_orders
                FROM users u
                JOIN referrals r ON u.telegram_id = r.referrer_id
                GROUP BY u.telegram_id
                ORDER BY total_earned DESC
                LIMIT ?
            `, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Инициализация главного админа
    async initializeMainAdmin() {
        const mainAdminId = 8141463258; // Ваш Telegram ID
        
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT OR IGNORE INTO staff 
                (telegram_id, username, first_name, role, is_active, added_by)
                VALUES (?, 'main_admin', 'Главный Админ', 'admin', 1, NULL)
            `, [mainAdminId], function(err) {
                if (err) {
                    console.error('Ошибка добавления главного админа:', err);
                    reject(err);
                } else {
                    console.log('✅ Главный админ инициализирован');
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    // Проверка роли пользователя
    async getUserRole(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT role, is_active FROM staff WHERE telegram_id = ? AND is_active = 1
            `, [telegramId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row?.role || null);
                }
            });
        });
    }

    // Добавление нового администратора или оператора
    async addStaff(staffData) {
        return new Promise((resolve, reject) => {
            const { telegramId, username, firstName, lastName, role, addedBy } = staffData;
            
            this.db.run(`
                INSERT OR REPLACE INTO staff 
                (telegram_id, username, first_name, last_name, role, is_active, added_by, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
            `, [telegramId, username, firstName, lastName, role, addedBy], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, telegramId, role });
                }
            });
        });
    }

    // Удаление администратора или оператора
    async removeStaff(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE staff SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
                WHERE telegram_id = ?
            `, [telegramId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Получение списка персонала
    async getStaffList() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    telegram_id,
                    username,
                    first_name,
                    last_name,
                    role,
                    is_active,
                    created_at,
                    (SELECT COUNT(*) FROM order_assignments WHERE operator_id = staff.telegram_id) as orders_handled
                FROM staff
                WHERE is_active = 1
                ORDER BY role DESC, created_at ASC
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Получение списка всех администраторов для уведомлений
    async getAdminIds() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT telegram_id FROM staff 
                WHERE role = 'admin' AND is_active = 1
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const adminIds = rows.map(row => row.telegram_id);
                    // Если нет админов в базе, используем MAIN_ADMIN_ID из переменных
                    if (adminIds.length === 0 && process.env.MAIN_ADMIN_ID) {
                        adminIds.push(parseInt(process.env.MAIN_ADMIN_ID));
                    }
                    console.log(`👥 Найдено админов для уведомлений: ${adminIds.length}`, adminIds);
                    resolve(adminIds);
                }
            });
        });
    }

    // Создание уведомления
    async createNotification(notificationData) {
        return new Promise((resolve, reject) => {
            const { recipientId, type, title, message, orderId } = notificationData;
            
            this.db.run(`
                INSERT INTO notifications 
                (recipient_id, type, title, message, order_id)
                VALUES (?, ?, ?, ?, ?)
            `, [recipientId, type, title, message, orderId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID });
                }
            });
        });
    }

    // Уведомление всех операторов о новом заказе
    async notifyAllOperators(orderData) {
        return new Promise((resolve, reject) => {
            // Получаем всех активных операторов
            this.db.all(`
                SELECT telegram_id FROM staff 
                WHERE role IN ('admin', 'operator') AND is_active = 1
            `, async (err, operators) => {
                if (err) {
                    reject(err);
                    return;
                }

                const notifications = operators.map(op => ({
                    recipientId: op.telegram_id,
                    type: 'new_order',
                    title: '🆕 Новый заказ',
                    message: `Новый обмен: ${orderData.fromAmount} ${orderData.fromCurrency} → ${orderData.toCurrency}`,
                    orderId: orderData.id
                }));

                // Создаем уведомления для всех операторов
                for (const notification of notifications) {
                    await this.createNotification(notification);
                }

                resolve({ notified: operators.length });
            });
        });
    }

    // Принятие заказа оператором
    async assignOrder(orderId, operatorId) {
        return new Promise((resolve, reject) => {
            // Проверяем, не занят ли уже заказ
            this.db.get(`
                SELECT * FROM order_assignments WHERE order_id = ?
            `, [orderId], (err, existing) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (existing) {
                    reject(new Error('Заказ уже занят другим оператором'));
                    return;
                }

                // Назначаем заказ оператору
                this.db.run(`
                    INSERT INTO order_assignments (order_id, operator_id, status)
                    VALUES (?, ?, 'assigned')
                `, [orderId, operatorId], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        // Обновляем статус заказа
                        resolve({ id: this.lastID, orderId, operatorId });
                    }
                });
            });
        });
    }

    // Получение назначенных заказов оператора
    async getOperatorOrders(operatorId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    o.*,
                    oa.status as assignment_status,
                    oa.assigned_at,
                    oa.notes,
                    u.first_name,
                    u.username
                FROM orders o
                JOIN order_assignments oa ON o.id = oa.order_id
                LEFT JOIN users u ON o.user_id = u.telegram_id
                WHERE oa.operator_id = ?
                ORDER BY oa.assigned_at DESC
                LIMIT 50
            `, [operatorId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Получение неназначенных заказов
    async getUnassignedOrders() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    o.*,
                    u.first_name,
                    u.username
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.telegram_id
                LEFT JOIN order_assignments oa ON o.id = oa.order_id
                WHERE oa.order_id IS NULL 
                AND o.status IN ('pending', 'processing')
                ORDER BY o.created_at DESC
                LIMIT 20
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Получение уведомлений для пользователя
    async getNotifications(telegramId, limit = 20) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM notifications
                WHERE recipient_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `, [telegramId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Отметить уведомления как прочитанные
    async markNotificationsAsRead(telegramId, notificationIds = null) {
        return new Promise((resolve, reject) => {
            let query = `UPDATE notifications SET is_read = 1 WHERE recipient_id = ?`;
            let params = [telegramId];

            if (notificationIds && notificationIds.length > 0) {
                query += ` AND id IN (${notificationIds.map(() => '?').join(',')})`;
                params.push(...notificationIds);
            }

            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // Получение расширенной статистики для админ панели
    async getAdminStats() {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as totalUsers,
                    (SELECT COUNT(*) FROM users WHERE date(created_at) = date('now')) as newUsersToday,
                    (SELECT COUNT(*) FROM orders) as totalOrders,
                    (SELECT COUNT(*) FROM orders WHERE date(created_at) = date('now')) as ordersToday,
                    (SELECT COUNT(*) FROM orders WHERE status = 'completed') as completedOrders,
                    (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pendingOrders,
                    (SELECT COUNT(*) FROM orders WHERE status = 'processing') as processingOrders,
                    (SELECT COALESCE(SUM(to_amount), 0) FROM orders WHERE status = 'completed') as totalVolume,
                    (SELECT COALESCE(SUM(to_amount), 0) FROM orders WHERE status = 'completed' AND date(created_at) = date('now')) as volumeToday,
                    (SELECT COUNT(*) FROM referrals) as totalReferrals,
                    (SELECT COALESCE(SUM(commission), 0) FROM referrals) as totalCommissions,
                    (SELECT COUNT(*) FROM staff WHERE is_active = 1) as activeStaff,
                    (SELECT COUNT(*) FROM staff WHERE role = 'operator' AND is_active = 1) as activeOperators,
                    (SELECT COUNT(*) FROM order_assignments WHERE status IN ('assigned', 'in_progress')) as assignedOrders,
                    (SELECT COUNT(*) FROM notifications WHERE is_read = 0) as unreadNotifications
            `, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Обновление статуса назначения заказа
    async updateOrderAssignmentStatus(orderId, status, notes = null) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE order_assignments 
                SET status = ?, notes = ?
                WHERE order_id = ?
            `, [status, notes, orderId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // === МЕТОДЫ ДЛЯ РАБОТЫ С ЧАТОМ ===

    // Добавление сообщения в чат заказа
    async addOrderMessage(orderData) {
        return new Promise((resolve, reject) => {
            const { orderId, senderId, senderType, message, messageType = 'text' } = orderData;
            
            this.db.run(`
                INSERT INTO order_messages 
                (order_id, sender_id, sender_type, message, message_type)
                VALUES (?, ?, ?, ?, ?)
            `, [orderId, senderId, senderType, message, messageType], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...orderData });
                }
            });
        });
    }

    // Получение истории сообщений для заказа
    async getOrderMessages(orderId, limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    om.*,
                    CASE 
                        WHEN om.sender_type = 'client' THEN u.first_name || ' ' || COALESCE(u.last_name, '')
                        WHEN om.sender_type = 'operator' THEN s.first_name || ' ' || COALESCE(s.last_name, '') || ' (Оператор)'
                        ELSE 'Система'
                    END as sender_name,
                    datetime(om.created_at, 'localtime') as created_at_local
                FROM order_messages om
                LEFT JOIN orders o ON om.order_id = o.id
                LEFT JOIN users u ON o.user_id = u.telegram_id AND om.sender_type = 'client'
                LEFT JOIN staff s ON om.sender_id = s.telegram_id AND om.sender_type = 'operator'
                WHERE om.order_id = ?
                ORDER BY om.created_at ASC
                LIMIT ?
            `, [orderId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Получение заказа с информацией о клиенте
    async getOrderWithClient(orderId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    o.*,
                    u.telegram_id as client_id,
                    u.first_name as client_first_name,
                    u.last_name as client_last_name,
                    u.username as client_username,
                    oa.operator_id,
                    s.first_name as operator_first_name,
                    s.last_name as operator_last_name
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.telegram_id
                LEFT JOIN order_assignments oa ON o.id = oa.order_id
                LEFT JOIN staff s ON oa.operator_id = s.telegram_id
                WHERE o.id = ?
            `, [orderId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Обновление статуса заказа с автоматическим сообщением в чат
    async updateOrderStatusWithMessage(orderId, newStatus, operatorId, statusMessage = null) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                // Обновляем статус заказа
                this.db.run(`
                    UPDATE orders SET status = ? 
                    WHERE id = ?
                `, [newStatus, orderId], (err) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        return reject(err);
                    }

                    // Добавляем системное сообщение о смене статуса
                    const systemMessage = statusMessage || this.getStatusMessage(newStatus);
                    
                    this.db.run(`
                        INSERT INTO order_messages 
                        (order_id, sender_id, sender_type, message, message_type)
                        VALUES (?, ?, 'operator', ?, 'status_change')
                    `, [orderId, operatorId, systemMessage], (err) => {
                        if (err) {
                            this.db.run('ROLLBACK');
                            return reject(err);
                        }

                        this.db.run('COMMIT', (err) => {
                            if (err) {
                                return reject(err);
                            }
                            resolve({ orderId, newStatus, message: systemMessage });
                        });
                    });
                });
            });
        });
    }

    // Получение сообщений о статусах
    getStatusMessage(status) {
        const statusMessages = {
            'pending': '⏳ Заказ ожидает обработки',
            'processing': '🔄 Заказ принят в обработку',
            'payment_details_sent': '💳 Реквизиты для оплаты отправлены',
            'payment_waiting': '⏰ Ожидаем поступления платежа',
            'payment_received': '✅ Платеж получен, проверяем',
            'payment_confirmed': '✅ Платеж подтвержден',
            'sending': '📤 Отправляем средства на ваш адрес',
            'completed': '🎉 Заказ успешно завершен!',
            'cancelled': '❌ Заказ отменен',
            'refund': '↩️ Возврат средств инициирован'
        };
        
        return statusMessages[status] || `🔄 Статус изменен на: ${status}`;
    }

    // Получение статистики пользователя для достижений
    async getUserStats(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    COUNT(o.id) as ordersCount,
                    COALESCE(SUM(o.to_amount), 0) as totalVolume,
                    COALESCE(SUM(o.from_amount), 0) as totalFromVolume,
                    COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completedOrders,
                    AVG(o.to_amount) as avgOrderValue
                FROM orders o
                WHERE o.user_id = ?
            `, [telegramId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || { ordersCount: 0, totalVolume: 0, totalFromVolume: 0, completedOrders: 0, avgOrderValue: 0 });
                }
            });
        });
    }

    // Проверка наличия достижения у пользователя
    async hasAchievement(telegramId, achievementId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT id FROM user_achievements 
                WHERE user_id = ? AND achievement_id = ?
            `, [telegramId, achievementId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(!!row);
                }
            });
        });
    }

    // Добавление достижения пользователю
    async addUserAchievement(telegramId, achievementId) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT OR IGNORE INTO user_achievements 
                (user_id, achievement_id)
                VALUES (?, ?)
            `, [telegramId, achievementId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // Получение достижений пользователя
    async getUserAchievements(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT achievement_id, earned_at
                FROM user_achievements
                WHERE user_id = ?
                ORDER BY earned_at DESC
            `, [telegramId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Получение доступных достижений
    async getAvailableAchievements() {
        return [
            {
                id: 'first_exchange',
                name: 'Первый обмен',
                description: 'Совершите свой первый обмен',
                icon: '🎯',
                reward: '🎉 Добро пожаловать!'
            },
            {
                id: 'volume_1k',
                name: 'Трейдер $1K',
                description: 'Суммарный объем обменов $1,000',
                icon: '💰',
                reward: '🏆 Уровень "Трейдер"'
            },
            {
                id: 'volume_10k',
                name: 'Про трейдер $10K',
                description: 'Суммарный объем обменов $10,000',
                icon: '🚀',
                reward: '👑 Уровень "Про трейдер"'
            },
            {
                id: 'orders_10',
                name: 'Опытный пользователь',
                description: 'Совершите 10 обменов',
                icon: '⭐',
                reward: '🎖️ Опыт и мастерство'
            }
        ];
    }

    // === НОВЫЕ МЕТОДЫ ДЛЯ МОНИТОРИНГА ===

    // Получение последних заказов с сайта
    async getRecentWebOrders(limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    o.*,
                    u.username,
                    oa.status as assignment_status,
                    datetime(o.created_at, 'localtime') as created_at_local
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.telegram_id
                LEFT JOIN order_assignments oa ON o.id = oa.order_id
                WHERE date(o.created_at) = date('now')
                AND o.source = 'web'
                ORDER BY o.created_at DESC
                LIMIT ?
            `, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    // Статистика активности сайта за сегодня
    async getTodayWebStats() {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    COUNT(CASE WHEN o.source = 'web' AND date(o.created_at) = date('now') THEN 1 END) as ordersToday,
                    COUNT(DISTINCT CASE WHEN o.source = 'web' AND date(o.created_at) = date('now') THEN o.user_id END) as uniqueUsers,
                    COALESCE(SUM(CASE WHEN o.source = 'web' AND date(o.created_at) = date('now') THEN o.to_amount ELSE 0 END), 0) as volumeToday
                FROM orders o
            `, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || { ordersToday: 0, uniqueUsers: 0, volumeToday: 0 });
                }
            });
        });
    }

    // Расширенная статистика дня для админов и операторов
    async getDailyStats() {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    (SELECT COUNT(*) FROM users WHERE date(created_at) = date('now')) as newUsersToday,
                    (SELECT COUNT(*) FROM orders WHERE source = 'bot' AND date(created_at) = date('now')) as botOrdersToday,
                    (SELECT COALESCE(SUM(to_amount), 0) FROM orders WHERE source = 'bot' AND date(created_at) = date('now')) as botVolumeToday,
                    (SELECT COUNT(*) FROM orders WHERE date(created_at) = date('now')) as ordersToday,
                    (SELECT COALESCE(SUM(to_amount), 0) FROM orders WHERE date(created_at) = date('now')) as volumeToday,
                    (SELECT COUNT(*) FROM users) as totalUsers,
                    (SELECT COUNT(*) FROM orders WHERE status = 'completed' AND date(updated_at) = date('now')) as processedToday,
                    (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pendingOrders,
                    (SELECT COUNT(*) FROM orders WHERE status = 'processing') as processingOrders
            `, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row || {
                        newUsersToday: 0,
                        botOrdersToday: 0,
                        botVolumeToday: 0,
                        ordersToday: 0,
                        volumeToday: 0,
                        totalUsers: 0,
                        processedToday: 0,
                        pendingOrders: 0,
                        processingOrders: 0
                    });
                }
            });
        });
    }

    // === НОВЫЕ МЕТОДЫ ДЛЯ АДМИН ПАНЕЛИ ===

    // Очистка старых уведомлений
    async clearOldNotifications(daysOld = 7) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                DELETE FROM notifications 
                WHERE datetime(created_at) < datetime('now', '-${daysOld} days')
            `, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Получение активных заказов для админа с информацией об операторе
    async getActiveOrdersForAdmin() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    o.*,
                    u.username,
                    u.first_name as user_first_name,
                    oa.operator_id,
                    s.first_name as operator_name,
                    s.username as operator_username
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.telegram_id
                LEFT JOIN order_assignments oa ON o.id = oa.order_id
                LEFT JOIN staff s ON oa.operator_id = s.telegram_id
                WHERE o.status IN ('pending', 'processing', 'payment_waiting', 'payment_received')
                ORDER BY o.created_at DESC
                LIMIT 20
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Получение заказа с информацией об операторе
    async getOrderWithOperator(orderId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    o.*,
                    u.username,
                    u.first_name as user_first_name,
                    oa.operator_id,
                    s.first_name as operator_name,
                    s.username as operator_username
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.telegram_id
                LEFT JOIN order_assignments oa ON o.id = oa.order_id
                LEFT JOIN staff s ON oa.operator_id = s.telegram_id
                WHERE o.id = ?
            `, [orderId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Смена оператора у заказа
    async changeOrderOperator(orderId, newOperatorId) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                // Проверяем существует ли назначение
                this.db.get(`
                    SELECT id FROM order_assignments WHERE order_id = ?
                `, [orderId], (err, row) => {
                    if (err) {
                        this.db.run('ROLLBACK');
                        return reject(err);
                    }

                    if (row) {
                        // Обновляем существующее назначение
                        this.db.run(`
                            UPDATE order_assignments 
                            SET operator_id = ?, assigned_at = datetime('now'), status = 'assigned'
                            WHERE order_id = ?
                        `, [newOperatorId, orderId], (err) => {
                            if (err) {
                                this.db.run('ROLLBACK');
                                return reject(err);
                            }

                            this.db.run('COMMIT', (err) => {
                                if (err) {
                                    return reject(err);
                                }
                                resolve({ orderId, newOperatorId, action: 'updated' });
                            });
                        });
                    } else {
                        // Создаем новое назначение
                        this.db.run(`
                            INSERT INTO order_assignments (order_id, operator_id, status)
                            VALUES (?, ?, 'assigned')
                        `, [orderId, newOperatorId], (err) => {
                            if (err) {
                                this.db.run('ROLLBACK');
                                return reject(err);
                            }

                            this.db.run('COMMIT', (err) => {
                                if (err) {
                                    return reject(err);
                                }
                                resolve({ orderId, newOperatorId, action: 'created' });
                            });
                        });
                    }
                });
            });
        });
    }

    // Снятие назначения оператора с заказа
    async unassignOrder(orderId) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                DELETE FROM order_assignments 
                WHERE order_id = ?
            `, [orderId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ orderId, changes: this.changes });
                }
            });
        });
    }

    // Получение информации о сотруднике по ID
    async getStaffById(telegramId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM staff 
                WHERE telegram_id = ? AND is_active = 1
            `, [telegramId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Пересчет статистики (для обслуживания БД)
    async recalculateStats() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                
                // Здесь можно добавить различные операции пересчета
                // Например, пересчет комиссий, статистики операторов и т.д.
                
                this.db.run('COMMIT', (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve({ message: 'Статистика пересчитана' });
                });
            });
        });
    }

    // === МЕТОДЫ ДЛЯ ЭКСПОРТА В GOOGLE SHEETS ===

    // Получение всех заказов для экспорта
    async getAllOrdersForExport() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    o.*,
                    u.username,
                    u.first_name as user_first_name,
                    oa.operator_id,
                    s.first_name as operator_name,
                    s.username as operator_username,
                    (o.from_amount * 0.03) as commission,
                    (o.from_amount * 0.03) as profit
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.telegram_id
                LEFT JOIN order_assignments oa ON o.id = oa.order_id
                LEFT JOIN staff s ON oa.operator_id = s.telegram_id
                ORDER BY o.created_at DESC
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Получение операторов для экспорта
    async getStaffForExport() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    s.*,
                    COUNT(DISTINCT oa.order_id) as orders_handled,
                    COALESCE(SUM(o.from_amount), 0) as total_amount,
                    COALESCE(AVG(o.from_amount * 0.03), 0) as avg_commission,
                    MAX(oa.assigned_at) as last_activity
                FROM staff s
                LEFT JOIN order_assignments oa ON s.telegram_id = oa.operator_id
                LEFT JOIN orders o ON oa.order_id = o.id
                GROUP BY s.telegram_id
                ORDER BY s.created_at DESC
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Получение дневной статистики для экспорта
    async getDailyStatsForExport() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total_orders,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
                    COUNT(CASE WHEN status IN ('pending', 'processing', 'payment_waiting') THEN 1 END) as processing_orders,
                    SUM(from_amount) as total_volume,
                    SUM(from_amount * 0.03) as total_profit,
                    COUNT(DISTINCT user_id) as active_users,
                    0 as new_users,
                    0 as active_operators,
                    0 as avg_processing_time
                FROM orders 
                WHERE created_at >= date('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Получение пользователей для экспорта
    async getUsersForExport() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    u.*,
                    COUNT(o.id) as total_orders,
                    COALESCE(SUM(o.from_amount), 0) as total_amount,
                    MAX(o.created_at) as last_order_date,
                    1 as is_active,
                    u.referred_by,
                    (SELECT COUNT(*) FROM users WHERE referred_by = u.telegram_id) as referrals_count
                FROM users u
                LEFT JOIN orders o ON u.telegram_id = o.user_id
                GROUP BY u.telegram_id
                ORDER BY u.created_at DESC
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Получение AML данных для экспорта
    async getAMLDataForExport() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    o.created_at,
                    o.user_id,
                    o.id as order_id,
                    o.from_amount as amount,
                    o.from_currency as currency,
                    'unknown' as aml_status,
                    0 as risk_score,
                    '' as blockchain_analysis,
                    '' as action_taken,
                    '' as notes
                FROM orders o
                WHERE o.from_amount >= 1000
                ORDER BY o.created_at DESC
                LIMIT 1000
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Закрытие подключения к базе данных
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