import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRoute } from '@/lib/admin-route';
import { listSubmissionStorageObjects } from '@/lib/admin-storage';

const STORAGE_WARNING_MB = 350;
const STORAGE_CRITICAL_MB = 450;
const CLEANUP_CANDIDATE_DAYS = 180;

export async function GET(request: NextRequest) {
  const routeContext = await requireAdminRoute(request, { requireServiceRole: false });
  if (routeContext instanceof NextResponse) {
    return routeContext;
  }

  const { adminClient } = routeContext;
  const cleanupCutoff = new Date(Date.now() - CLEANUP_CANDIDATE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: submissionFiles, error: storageError } = await listSubmissionStorageObjects(adminClient);

  const [
    { count: fileSubmissionCount, error: submissionsError },
    { count: cleanupCandidateCount, error: cleanupCountError },
  ] = await Promise.all([
    adminClient
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .not('file_url', 'is', null),
    adminClient
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .not('file_url', 'is', null)
      .lt('submitted_at', cleanupCutoff),
  ]);

  if (storageError || submissionsError || cleanupCountError) {
    return NextResponse.json({ error: 'Failed to load storage health' }, { status: 500 });
  }

  const totalBytes = (submissionFiles || []).reduce((sum, file: any) => {
    const size = typeof file?.metadata?.size === 'number'
      ? file.metadata.size
      : typeof file?.metadata?.size === 'string'
        ? parseInt(file.metadata.size, 10)
        : 0;

    return sum + (Number.isFinite(size) ? size : 0);
  }, 0);

  const totalMegabytes = Number((totalBytes / (1024 * 1024)).toFixed(1));
  const fileCount = submissionFiles?.length || 0;
  const oldestUploadAt = submissionFiles && submissionFiles.length > 0
    ? [...submissionFiles]
        .sort((left: any, right: any) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())[0]
        ?.created_at || null
    : null;

  const status = totalMegabytes >= STORAGE_CRITICAL_MB
    ? 'critical'
    : totalMegabytes >= STORAGE_WARNING_MB
      ? 'warning'
      : 'healthy';

  const recommendations: string[] = [];
  if (cleanupCandidateCount && cleanupCandidateCount > 0) {
    recommendations.push(`${cleanupCandidateCount} uploaded submission file(s) are older than ${CLEANUP_CANDIDATE_DAYS} days and can be reviewed for deletion.`);
  }
  if (totalMegabytes >= STORAGE_WARNING_MB) {
    recommendations.push('Storage usage is approaching the configured dashboard threshold. Archive or delete outdated uploaded submissions.');
  }
  if (fileSubmissionCount && fileCount > fileSubmissionCount) {
    recommendations.push('Some files exist in storage without matching submission records. Review the submissions bucket for orphaned uploads.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Storage usage is within the safe range. Continue monitoring uploads from student submissions.');
  }

  return NextResponse.json({
    status,
    totalBytes,
    totalMegabytes,
    fileCount,
    fileSubmissionCount: fileSubmissionCount || 0,
    cleanupCandidateCount: cleanupCandidateCount || 0,
    oldestUploadAt,
    thresholds: {
      warningMb: STORAGE_WARNING_MB,
      criticalMb: STORAGE_CRITICAL_MB,
      cleanupCandidateDays: CLEANUP_CANDIDATE_DAYS,
    },
    recommendations,
  });
}