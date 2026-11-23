import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 100 * 1024 * 1024;
export const ALLOWED_TYPES: Record<string, number> = {
  "video/mp4": MAX_BYTES,
  "audio/mpeg": 20 * 1024 * 1024,
  "application/pdf": 20 * 1024 * 1024,
};

export class LocalMediaStorage {
  constructor(private readonly root: string, private readonly secret: string) {}

  createKey() { return randomUUID(); }

  sign(key: string, action: "upload" | "download", expires: number) {
    return createHmac("sha256", this.secret).update(`${action}:${key}:${expires}`).digest("hex");
  }

  valid(key: string, action: "upload" | "download", expires: number, signature: string) {
    if (!/^[0-9a-f-]{36}$/.test(key) || !Number.isSafeInteger(expires) || expires <= Date.now() || expires > Date.now() + 10 * 60_000 || !/^[0-9a-f]{64}$/.test(signature)) return false;
    return timingSafeEqual(Buffer.from(this.sign(key, action, expires), "hex"), Buffer.from(signature, "hex"));
  }

  private file(key: string) { return path.join(this.root, key); }

  async put(key: string, bytes: Buffer) {
    await mkdir(this.root, { recursive: true });
    const temporary = this.file(`${key}.${randomUUID()}.tmp`);
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, this.file(key));
  }

  async get(key: string) { return readFile(this.file(key)); }
  async size(key: string) { return (await stat(this.file(key))).size; }
}
