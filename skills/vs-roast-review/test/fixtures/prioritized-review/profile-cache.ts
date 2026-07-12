type Profile = {
  id: string;
  email: string;
  updatedAt: number;
};

const cache: Record<string, Profile> = {};

export async function loadProfile(
  id: string,
  fetchProfile: (id: string) => Promise<Profile>,
) {
  if (cache[id]) {
    return cache[id];
  }

  const profile = await fetchProfile(id);
  cache[id] = profile;
  return profile;
}

export async function warmProfiles(
  ids: string[],
  fetchProfile: (id: string) => Promise<Profile>,
) {
  await Promise.all(ids.map((id) => loadProfile(id, fetchProfile)));
}
