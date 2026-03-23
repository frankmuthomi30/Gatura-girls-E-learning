'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import { formatBytes } from '@/lib/storage';

type CleanupItem = {
  id: string;
  objectPath: string;
  fileName: string;
  createdAt: string;
  ageDays: number;
  sizeBytes: number;
  status: 'orphaned' | 'old-linked' | 'active-linked';
  referenceCount: number;
  latestSubmission: {
    id: string;
    assignmentId: string;
    studentId: string;
    submittedAt: string;
  } | null;
};

type CleanupPayload = {
  summary: {
    totalFiles: number;
    orphanedFiles: number;
    oldFiles: number;
    reclaimableBytes: number;
    cleanupCandidateDays: number;
  };
  orphanedItems: CleanupItem[];
  oldItems: CleanupItem[];
};

export default function AdminCleanupPage() {
  const [payload, setPayload] = useState<CleanupPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await fetch('/api/admin/storage-cleanup');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load cleanup data');
      }

      setPayload(result as CleanupPayload);
    } catch (err: any) {
      setError(err?.message || 'Failed to load cleanup data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const orphanedItems = payload?.orphanedItems || [];
  const oldLinkedItems = useMemo(
    () => (payload?.oldItems || []).filter((item) => item.status === 'old-linked'),
    [payload]
  );

  const deleteOrphaned = async (paths?: string[]) => {
    setDeleting(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/admin/storage-cleanup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paths && paths.length > 0 ? { paths } : {}),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete orphaned uploads');
      }

      setMessage(
        result.deletedCount > 0
          ? `Deleted ${result.deletedCount} orphaned upload${result.deletedCount === 1 ? '' : 's'}.`
          : 'No orphaned uploads were available for deletion.'
      );

      await loadData(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete orphaned uploads');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Admin Cleanup</p>
          <h1 className="page-title mt-2">Storage Cleanup Console</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-slate-300">
            Review uploaded submission files, find storage objects that no longer map to submission records, and delete only verified orphaned uploads in one click.
          </p>
        </div>
        <button onClick={() => loadData(true)} disabled={refreshing || deleting} className="btn-secondary text-sm">
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      {payload && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Stored Files</p>
              <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">{payload.summary.totalFiles}</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Orphaned Uploads</p>
              <p className="mt-3 text-3xl font-bold text-rose-600">{payload.summary.orphanedFiles}</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Aged Files</p>
              <p className="mt-3 text-3xl font-bold text-amber-600">{payload.summary.oldFiles}</p>
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Reclaimable</p>
              <p className="mt-3 text-3xl font-bold text-emerald-700">{formatBytes(payload.summary.reclaimableBytes)}</p>
            </div>
          </div>

          <div className="card border border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,245,245,0.92))] dark:border-rose-400/20 dark:bg-slate-900/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-rose-500">One-Click Orphan Cleanup</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">Delete uploads with no matching submission record</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  These files are safe cleanup candidates because they are not referenced by any current submission. This action does not touch uploads still linked to student work.
                </p>
              </div>
              <button
                onClick={() => deleteOrphaned()}
                disabled={deleting || orphanedItems.length === 0}
                className="btn-primary text-sm min-w-[220px] flex items-center justify-center gap-2"
              >
                {deleting ? <><LoadingSpinner size="sm" /> Deleting...</> : `Delete All Orphans (${orphanedItems.length})`}
              </button>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="card space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Orphaned Uploads</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Ready for deletion</h2>
                </div>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                  {orphanedItems.length} file(s)
                </span>
              </div>

              {orphanedItems.length === 0 ? (
                <p className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                  No orphaned uploads found. Storage objects currently line up with submission records.
                </p>
              ) : (
                <div className="space-y-3">
                  {orphanedItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-rose-200/70 bg-white/75 px-4 py-4 dark:border-rose-400/15 dark:bg-slate-900/60">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{item.fileName}</p>
                          <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{item.objectPath}</p>
                        </div>
                        <button onClick={() => deleteOrphaned([item.objectPath])} disabled={deleting} className="btn-secondary text-xs px-4 py-2">
                          Delete
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{formatBytes(item.sizeBytes)}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{item.ageDays} days old</span>
                        <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">No submission reference</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Old Linked Files</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Review before deletion</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  These uploads are older than {payload.summary.cleanupCandidateDays} days but still referenced by submissions. They are listed for review only to avoid deleting student evidence unintentionally.
                </p>
              </div>

              {oldLinkedItems.length === 0 ? (
                <p className="rounded-2xl bg-sky-50 px-4 py-4 text-sm text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
                  No linked uploads have crossed the review threshold yet.
                </p>
              ) : (
                <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
                  {oldLinkedItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-amber-200/70 bg-white/75 px-4 py-4 dark:border-amber-300/15 dark:bg-slate-900/60">
                      <p className="font-medium text-slate-900 dark:text-white">{item.fileName}</p>
                      <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{item.objectPath}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{formatBytes(item.sizeBytes)}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{item.ageDays} days old</span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">{item.referenceCount} linked submission(s)</span>
                      </div>
                      {item.latestSubmission && (
                        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          Last linked submission: {new Date(item.latestSubmission.submittedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}