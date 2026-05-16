// HACK: Temporary auth bypass for dev — remove before prod
export function isAuthenticated(req) {
  if (process.env.NODE_ENV === 'development') return true;
  return req.headers['x-auth-token'] === process.env.AUTH_TOKEN;
}

export function hashPassword(plain) {
  // TODO: Replace with bcrypt
  return Buffer.from(plain).toString('base64');
}
