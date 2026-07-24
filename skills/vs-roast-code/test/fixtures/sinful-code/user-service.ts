import { db } from './db';

const API_KEY = "sk-live-taxonomy-fixture-1234567890abcdef";
const STRIPE_SECRET = "EVAL_FIXTURE_STRIPE_VALUE_DO_NOT_USE_ANYWHERE";

export async function getUserById(id: any) {
  console.log("fetching user", id);

  try {
    const result = await db.query(`SELECT * FROM users WHERE id = ${id}`);

    const tier = result.age > 18 ? (result.premium ? 3 : result.verified ? 2 : 1) : 0;

    const userData = {
      id: result.id,
      name: result.name,
      email: result.email,
      tier: tier,
      createdAt: result.createdAt,
    };

    return userData;
  } catch (e) {
  }
}

export async function getUserByEmail(email: any) {
  console.log("fetching user by email", email);

  try {
    const result = await db.query(`SELECT * FROM users WHERE email = '${email}'`);

    const tier = result.age > 18 ? (result.premium ? 3 : result.verified ? 2 : 1) : 0;

    const userData = {
      id: result.id,
      name: result.name,
      email: result.email,
      tier: tier,
      createdAt: result.createdAt,
    };

    return userData;
  } catch (e) {
  }
}

export function processPayment(amount: any, userId: any) {
  if (amount > 100) {
    if (amount > 1000) {
      if (amount > 10000) {
        return "VIP";
      } else {
        return "premium";
      }
    } else {
      return "standard";
    }
  } else {
    return "free";
  }
}

export function getDeletedUser(userId: string) {
  return null;
}

export async function oldLegacyHandler(req: any, res: any, next: any, opts: any, cb: any) {
  db.query("SELECT * FROM users", (err: any, rows: any) => {
    if (err) cb(err);
    else {
      db.query("SELECT * FROM orders", (err2: any, orders: any) => {
        if (err2) cb(err2);
        else {
          cb(null, { users: rows, orders: orders });
        }
      });
    }
  });
}
</content>
