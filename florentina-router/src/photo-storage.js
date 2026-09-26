import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif"
};

export class LocalPhotoStore {
  constructor({ directory, publicPrefix = "/uploads" }) {
    this.directory = directory;
    this.publicPrefix = publicPrefix.replace(/\/$/, "");
  }

  async saveBuffer(buffer, { mimeType }) {
    const ext = EXTENSIONS[mimeType];
    if (!ext) throw new Error("Unsupported image type");
    if (!buffer?.length) throw new Error("Empty image");

    await fs.mkdir(this.directory, { recursive: true });
    const filename = `${crypto.randomUUID()}${ext}`;
    await fs.writeFile(path.join(this.directory, filename), buffer);
    return `${this.publicPrefix}/${filename}`;
  }
}

export function isAllowedPhotoMime(mimeType) {
  return Boolean(EXTENSIONS[mimeType]);
}
