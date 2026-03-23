type StorageListItem = {
  id?: string | null;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SubmissionStorageObject = {
  id: string;
  name: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function isFileEntry(item: StorageListItem): item is StorageListItem & { id: string } {
  return typeof item.id === 'string' && item.id.length > 0;
}

export async function listSubmissionStorageObjects(adminClient: any): Promise<{
  data: SubmissionStorageObject[] | null;
  error: string | null;
}> {
  const bucket = adminClient.storage.from('submissions');
  const collected: SubmissionStorageObject[] = [];
  const prefixes: string[] = [''];

  while (prefixes.length > 0) {
    const currentPrefix = prefixes.pop() || '';
    let offset = 0;

    while (true) {
      const { data, error } = await bucket.list(currentPrefix, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });

      if (error) {
        return { data: null, error: error.message };
      }

      const items = (data || []) as StorageListItem[];
      for (const item of items) {
        if (isFileEntry(item)) {
          collected.push({
            id: item.id,
            name: currentPrefix ? `${currentPrefix}/${item.name}` : item.name,
            created_at: item.created_at || item.updated_at || new Date(0).toISOString(),
            metadata: item.metadata || null,
          });
        } else {
          prefixes.push(currentPrefix ? `${currentPrefix}/${item.name}` : item.name);
        }
      }

      if (items.length < 100) {
        break;
      }

      offset += items.length;
    }
  }

  return { data: collected, error: null };
}