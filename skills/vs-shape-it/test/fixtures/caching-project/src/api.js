const express = require('express');
const db = require('./db');

const app = express();

// GET /users/:id - no caching, hits DB every time
app.get('/users/:id', async (req, res) => {
  const user = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  res.json(user);
});

// GET /products - expensive aggregation, no caching
app.get('/products', async (req, res) => {
  const products = await db.query('SELECT p.*, AVG(r.score) as rating FROM products p LEFT JOIN reviews r ON p.id = r.product_id GROUP BY p.id');
  res.json(products);
});

module.exports = app;
