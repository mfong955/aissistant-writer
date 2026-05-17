import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
const USER_FILE = path.join(DATA_DIR, "user.json");

let cachedUserId: string | null = null;

export function getLocalUserId(): string {
  if (cachedUserId) return cachedUserId;

  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(USER_FILE)) {
    const data = JSON.parse(fs.readFileSync(USER_FILE, "utf-8")) as { id: string };
    cachedUserId = data.id;
    return cachedUserId;
  }

  const id = crypto.randomUUID();
  fs.writeFileSync(USER_FILE, JSON.stringify({ id }));
  cachedUserId = id;
  return id;
}
