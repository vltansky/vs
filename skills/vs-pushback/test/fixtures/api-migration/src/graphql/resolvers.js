const db = require('../shared/db');

const resolvers = {
  Query: {
    users: () => db.query('SELECT * FROM users LIMIT 100'),
    user: (_, { id }) => db.query('SELECT * FROM users WHERE id = ?', [id]),
  },
  User: {
    orders: (parent) =>
      db.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [parent.id]),
  },
  Mutation: {
    createUser: async (_, { name, email }) => {
      const id = await db.insert('users', { name, email });
      return { id, name, email };
    },
  },
};

module.exports = { resolvers };
