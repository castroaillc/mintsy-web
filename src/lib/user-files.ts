import { Directory, File, Paths } from 'expo-file-system';

/**
 * Small per-user JSON files on this device (`<documents>/users/<userId>/<name>.json`): watch progress,
 * finished series, ratings and recent searches. Nothing here reaches the API. Deleting an account removes
 * the user's folder (see deleteUserFiles).
 */
// Built on demand, never at import: expo-file-system objects can't be created on web (static export)
const root = () => new Directory(Paths.document, 'users');

const folderName = (userId: string) => userId.replace(/[^\w.-]/g, '_');
const userDir = (userId: string) => new Directory(root(), folderName(userId));
const userFile = (userId: string, name: string) => new File(userDir(userId), `${name}.json`);

export function readUserJson<T>(userId: string, name: string, fallback: T): T {
  try {
    const file = userFile(userId, name);
    if (!file.exists) return fallback;
    return { ...fallback, ...(JSON.parse(file.textSync()) as T) };
  } catch (err) {
    console.warn(`Failed to read ${name}`, err);
    return fallback;
  }
}

export function writeUserJson(userId: string, name: string, value: unknown) {
  try {
    const dir = userDir(userId);
    dir.create({ idempotent: true, intermediates: true });
    const file = userFile(userId, name);
    if (!file.exists) file.create();
    file.write(JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to write ${name}`, err);
  }
}

/** Removes everything stored on this device for `userId` (account deletion). */
export function deleteUserFiles(userId: string) {
  try {
    const dir = userDir(userId);
    if (dir.exists) dir.delete();
  } catch (err) {
    console.warn('Failed to delete local user data', err);
  }
}
