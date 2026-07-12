const express = require('express');
const router = express.Router();
const db = require('../shared/db');

router.get('/users', async (req, res) => {
  const users = await db.query('SELECT * FROM users LIMIT 100');
  res.json(users);
});

router.get('/users/:id', async (req, res) => {
  const user = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

router.get('/users/:id/orders', async (req, res) => {
  const orders = await db.query(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
    [req.params.id]
  );
  res.json(orders);
});

router.post('/users', async (req, res) => {
  const { name, email } = req.body;
  const id = await db.insert('users', { name, email });
  res.status(201).json({ id, name, email });
});

module.exports = router;
