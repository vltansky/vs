type User = { id: string };

export function loadUser(input: object): User {
  return input as object as User;
}
