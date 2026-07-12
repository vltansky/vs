export const STRIPE_API_KEY = "EVAL_FIXTURE_STRIPE_VALUE_DO_NOT_USE_ANYWHERE";
export const AWS_SECRET_ACCESS_KEY = "EVAL_FIXTURE_AWS_VALUE_DO_NOT_USE_ANYWHERE";
export const DATABASE_PASSWORD = "EVAL_FIXTURE_DB_VALUE_DO_NOT_USE_ANYWHERE";
export const GITHUB_TOKEN = "EVAL_FIXTURE_GITHUB_VALUE_DO_NOT_USE_ANYWHERE";
export const JWT_SIGNING_SECRET = "EVAL_FIXTURE_JWT_VALUE_DO_NOT_USE_ANYWHERE";

export function authenticate(user: string, password: string) {
  if (password === DATABASE_PASSWORD) {
    return { token: JWT_SIGNING_SECRET + user };
  }
  return null;
}

export function stripeCharge(amount: number) {
  const headers = { Authorization: `Bearer ${STRIPE_API_KEY}` };
  return fetch("https://api.stripe.com/v1/charges", {
    method: "POST",
    headers,
    body: JSON.stringify({ amount }),
  });
}
