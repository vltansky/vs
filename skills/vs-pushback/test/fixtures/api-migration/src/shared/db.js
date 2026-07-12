// Shared database layer used by both REST and GraphQL
// 47 REST endpoints depend on this, 12 GraphQL resolvers use it
// Auth middleware injects req.user before queries run

const pool = {
  query: async (sql, params) => {
    // Production: MySQL pool with 20 connections
    // Test: SQLite in-memory
    throw new Error('Not implemented in fixture');
  },
  insert: async (table, data) => {
    throw new Error('Not implemented in fixture');
  },
};

module.exports = pool;
