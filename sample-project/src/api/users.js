// API endpoint handlers for /api/users
const express = require('express');
const router = express.Router();

// GET /api/users
router.get('/', async (req, res) => {
  // TODO: Add pagination
  const users = await db.query('SELECT * FROM users');
  res.json(users);
});

// POST /api/users
router.post('/', async (req, res) => {
  // FIXME: No input validation here
  const { name, email } = req.body;
  const user = await db.create({ name, email });
  res.json(user);
});

module.exports = router;
