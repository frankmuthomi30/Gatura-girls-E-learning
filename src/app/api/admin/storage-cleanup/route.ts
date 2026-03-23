import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-route';
import { listSubmissionStorageObjects } from '@/lib/admin-storage';
import { extractSubmissionFilePath, getStorageObjectFileName } from '@/lib/storage';

const CLEANUP_CANDIDATE_DAYS = 180;

type SubmissionReference = {
  id: string;
  assignment_id: string;
  student_id: string;
  submitted_at: string;
  file_url: string | null;
};

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

function getObjectSizeBytes(metadata: Record<string, unknown> | null | undefined): number {
  const rawSize = metadata?.size;

  if (typeof rawSize === 'number') {
    return Number.isFinite(rawSize) ? rawSize : 0;
  }

  if (typeof rawSize === 'string') {
    const parsed = Number.parseInt(rawSize, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

async function loadCleanupData(adminClient: any) {
  const cleanupCutoff = new Date(Date.now() - CLEANUP_CANDIDATE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: storageObjects, error: storageError } = await listSubmissionStorageObjects(adminClient);

  const [
    { data: submissionRefs, error: submissionsError },
  ] = await Promise.all([
    adminClient
      .from('submissions')
      .select('id, assignment_id, student_id, submitted_at, file_url')
      .not('file_url', 'is', null),
  ]);

  if (storageError || submissionsError) {
    return { error: 'Failed to load cleanup data' as const };
  }

  const referencesByPath = new Map<string, SubmissionReference[]>();
  (submissionRefs || []).forEach((submission: SubmissionReference) => {
    if (!submission.file_url) return;
    const objectPath = extractSubmissionFilePath(submission.file_url);
    if (!objectPath) return;

    const existing = referencesByPath.get(objectPath) || [];
    existing.push(submission);
    referencesByPath.set(objectPath, existing);
  });

  const items: CleanupItem[] = (storageObjects || []).map((object: any) => {
    const objectPath = object.name as string;
    const references = referencesByPath.get(objectPath) || [];
    const latestReference = [...references].sort((left, right) => new Date(right.submitted_at).getTime() - new Date(left.submitted_at).getTime())[0] || null;
    const ageDays = Math.max(0, Math.floor((Date.now() - new Date(object.created_at).getTime()) / (24 * 60 * 60 * 1000)));
    const isOrphaned = references.length === 0;
    const isOld = object.created_at < cleanupCutoff;

    return {
      id: object.id as string,
      objectPath,
      fileName: getStorageObjectFileName(objectPath),
      createdAt: object.created_at as string,
      ageDays,
      sizeBytes: getObjectSizeBytes(object.metadata as Record<string, unknown> | null),
      status: isOrphaned ? 'orphaned' : isOld ? 'old-linked' : 'active-linked',
      referenceCount: references.length,
      latestSubmission: latestReference
        ? {
            id: latestReference.id,
            assignmentId: latestReference.assignment_id,
            studentId: latestReference.student_id,
            submittedAt: latestReference.submitted_at,
          }
        : null,
    };
  });

  const orphanedItems = items.filter((item: CleanupItem) => item.status === 'orphaned');
  const oldItems = items.filter((item: CleanupItem) => item.status === 'old-linked' || item.status === 'orphaned');

  return {
    error: null,
    items,
    orphanedItems,
    oldItems,
    summary: {
      totalFiles: items.length,
      orphanedFiles: orphanedItems.length,
      oldFiles: oldItems.length,
      reclaimableBytes: orphanedItems.reduce((sum, item) => sum + item.sizeBytes, 0),
      cleanupCandidateDays: CLEANUP_CANDIDATE_DAYS,
    },
  };
}

export async function GET(request: NextRequest) {
  const routeContext = await requireAdminRoute(request);
  if (routeContext instanceof NextResponse) {
    return routeContext;
  }

  const result = await loadCleanupData(routeContext.adminClient);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result);
}

export async function DELETE(request: NextRequest) {
  const routeContext = await requireAdminRoute(request, { enforceOrigin: true });
  if (routeContext instanceof NextResponse) {
    return routeContext;
  }

  const body = await request.json().catch(() => ({}));
  const requestedPaths = Array.isArray(body.paths) ? body.paths.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0) : null;

  const result = await loadCleanupData(routeContext.adminClient);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const orphanedPaths = new Set(result.orphanedItems.map((item) => item.objectPath));
  const deletionTargets = requestedPaths && requestedPaths.length > 0
    ? requestedPaths.filter((path: string) => orphanedPaths.has(path))
    : Array.from(orphanedPaths);

  if (deletionTargets.length === 0) {
    return NextResponse.json({ success: true, deletedCount: 0, deletedPaths: [] });
  }

  const { error } = await routeContext.adminClient.storage.from('submissions').remove(deletionTargets);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    deletedCount: deletionTargets.length,
    deletedPaths: deletionTargets,
  });
}