import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    // استعمال المتغيرات اللي جات من Railway (اللي كتبدا بـ MYSQL_)
    host: process.env.MYSQL_HOST, 
    user: process.env.MYSQL_USER, // أو MYSQL_ROOT_USER إذا كان هذا هو الإسم
    password: process.env.MYSQL_ROOT_PASSWORD, // هاد الإسم هو ديال كلمة السر ديالك
    database: process.env.MYSQL_DATABASE,
    port: Number(process.env.MYSQL_PORT),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // يجب إضافة حل SSL هنا أيضًا
    ssl: {
        rejectUnauthorized: false
    }
});

export default pool;
