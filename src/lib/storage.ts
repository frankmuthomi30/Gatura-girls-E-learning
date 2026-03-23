export function extractSubmissionFilePath(fileUrl: string): string | null {
  const match = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/submissions\/(.+?)(?:\?|$)/);
  if (match) return match[1];

  const fallback = fileUrl.match(/\/submissions\/(.+?)(?:\?|$)/);
  return fallback ? fallback[1] : null;
}

export function getStorageObjectFileName(objectPath: string): string {
  return objectPath.split('/').pop() || objectPath;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}