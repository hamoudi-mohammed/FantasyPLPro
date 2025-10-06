import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { email, password, username, type } = req.body;
    try {
      if (type === 'register') {
        // تحقق من وجود المستخدم مسبقًا
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (Array.isArray(existing) && existing.length > 0) {
          return res.status(400).json({ error: 'البريد الإلكتروني مستخدم مسبقًا' });
        }
        // تشفير كلمة المرور
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);
        return res.status(201).json({ success: true });
      } else if (type === 'login') {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (!Array.isArray(users) || users.length === 0) {
          return res.status(400).json({ error: 'البريد الإلكتروني غير موجود' });
        }
        const user = users[0];
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          return res.status(400).json({ error: 'كلمة المرور غير صحيحة' });
        }
        // هنا يمكنك إنشاء توكن أو جلسة حسب الحاجة
        return res.status(200).json({ success: true, user });
      }
    } catch (error) {
      return res.status(500).json({ error: 'خطأ في قاعدة البيانات' });
    }
  } else {
    res.status(405).end();
  }
}
