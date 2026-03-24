'use client';

import { useEffect, useState, useRef } from 'react';
import { PageLoading, LoadingSpinner } from '@/components/Loading';
import { StreamBadge } from '@/components/StreamBadge';
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog';
import type { Profile, StreamName } from '@/lib/types';

export default function AdminStudents() {
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStream, setFilterStream] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importGrade, setImportGrade] = useState('10');
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
    importedUsers: { admission_number: string; full_name: string; temporary_pin: string }[];
  } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ done: 0, total: 0, failed: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const response = await fetch('/api/admin/students', { cache: 'no-store' });
      if (response.ok) {
        const result = await response.json();
        setStudents((result.students || []) as Profile[]);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setImportProgress({ done: 0, total: 0, failed: 0 });

    // Step 1: Parse file on server
    const formData = new FormData();
    formData.append('file', file);

    const parseRes = await fetch('/api/admin/import-students', {
      method: 'POST',
      body: formData,
    });

    const parseResult = await parseRes.json();

    if (!parseRes.ok || !parseResult.rows) {
      setImportResult({ success: 0, failed: 0, errors: [parseResult.error || 'Failed to parse file'], importedUsers: [] });
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    const allRows = parseResult.rows;
    const total = allRows.length;
    const grade = parseInt(importGrade, 10);
    setImportProgress({ done: 0, total, failed: 0 });

    // Step 2: Send rows in batches
    let success = 0;
    let failed = 0;
    const allErrors: string[] = [];
    const importedUsers: { admission_number: string; full_name: string; temporary_pin: string }[] = [];
    const BATCH = 10;

    for (let i = 0; i < allRows.length; i += BATCH) {
      const batch = allRows.slice(i, i + BATCH);
      try {
        const res = await fetch('/api/admin/import-students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: batch, grade }),
        });
        const result = await res.json();
        success += result.success || 0;
        failed += result.failed || 0;
        if (result.errors) allErrors.push(...result.errors);
        if (result.importedUsers) importedUsers.push(...result.importedUsers);
      } catch {
        failed += batch.length;
        allErrors.push(`Batch starting at row ${i + 1}: Network error`);
      }
      setImportProgress({ done: success + failed, total, failed });
    }

    setImportResult({ success, failed, errors: allErrors, importedUsers });
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
    await loadStudents();
  };

  const handleResetPin = async (student: Profile) => {
    const confirmed = await confirm(
      'Reset PIN',
      `Generate a new temporary PIN for ${student.full_name} (#${student.admission_number})?`,
      'Reset PIN'
    );
    if (!confirmed) return;

    const res = await fetch('/api/admin/reset-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: student.id }),
    });

    const result = await res.json();

    if (!res.ok) {
      alert(result.error || 'Failed to reset PIN.');
      return;
    }

    alert(`Temporary PIN for ${student.full_name}: ${result.temporary_pin}. They will be required to change it on next login.`);
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;

    const confirmed = await confirm(
      'Delete Students',
      `Are you sure you want to permanently delete ${selected.size} student${selected.size > 1 ? 's' : ''}? This removes their accounts, submissions, and all data. This cannot be undone.`,
      'Delete'
    );
    if (!confirmed) return;

    const ids = Array.from(selected);
    const total = ids.length;
    setDeleting(true);
    setDeleteProgress({ done: 0, total, failed: 0 });

    let deleted = 0;
    let failed = 0;
    // Delete in batches for progress visibility
    const BATCH = 10;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      try {
        const res = await fetch('/api/admin/delete-student', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentIds: batch }),
        });
        const result = await res.json();
        deleted += result.deleted || 0;
        failed += result.errors?.length || 0;
      } catch {
        failed += batch.length;
      }
      setDeleteProgress({ done: deleted + failed, total, failed });
    }

    setSelected(new Set());
    setDeleting(false);

    if (failed > 0) {
      alert(`Deleted ${deleted} of ${total}. ${failed} failed.`);
    }

    await loadStudents();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(s => s.id)));
    }
  };

  if (loading) return <PageLoading />;

  const filtered = students.filter((s) => {
    const matchStream = !filterStream || s.stream === filterStream;
    const matchGrade = !filterGrade || s.grade === parseInt(filterGrade);
    const matchSearch = !search ||
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.admission_number.includes(search);
    return matchStream && matchGrade && matchSearch;
  });

  const gradeCount = (g: number) => students.filter(s => s.grade === g).length;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Students ({students.length})</h1>

      {/* Grade Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[10, 11, 12].map(g => (
          <div key={g} className="card text-center py-3">
            <p className="text-2xl font-bold text-primary">{gradeCount(g)}</p>
            <p className="text-xs text-gray-500">Grade {g}</p>
          </div>
        ))}
      </div>

      {/* Excel Import */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-3">Import Students from Excel</h2>
        <p className="text-sm text-gray-500 mb-3">
          Excel columns: <code className="bg-gray-100 px-1 rounded">Admission Number</code>, <code className="bg-gray-100 px-1 rounded">Full Name</code>, <code className="bg-gray-100 px-1 rounded">Stream</code>
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade *</label>
            <select
              value={importGrade}
              onChange={(e) => setImportGrade(e.target.value)}
              className="input-field w-36"
            >
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Excel File</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileImport}
                disabled={importing}
                className="text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {importing && <LoadingSpinner size="sm" />}
            </div>
          </div>
        </div>

        {importing && importProgress.total > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center justify-between text-xs text-blue-700 mb-1">
              <span>Importing {importProgress.done} of {importProgress.total}...</span>
              <span>{Math.round((importProgress.done / importProgress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
              />
            </div>
            {importProgress.failed > 0 && (
              <p className="text-xs text-red-500 mt-1">{importProgress.failed} failed so far</p>
            )}
          </div>
        )}

        {importResult && (
          <div className="mt-3 p-3 rounded-lg bg-gray-50">
            <p className="text-sm">
              <span className="font-medium text-green-600">{importResult.success} imported</span>
              {importResult.failed > 0 && (
                <span className="font-medium text-red-600 ml-3">{importResult.failed} failed</span>
              )}
            </p>
            {importResult.errors.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto">
                {importResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-500">{err}</p>
                ))}
              </div>
            )}
            {importResult.importedUsers.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/70">
                <div className="border-b border-emerald-200 px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-800">
                  Temporary PINs for imported students
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-emerald-100/70 text-emerald-900">
                      <tr>
                        <th className="px-3 py-2 font-medium">Admission No.</th>
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Temporary PIN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.importedUsers.map((user) => (
                        <tr key={user.admission_number} className="border-t border-emerald-200/70 text-emerald-950">
                          <td className="px-3 py-2 font-mono">{user.admission_number}</td>
                          <td className="px-3 py-2">{user.full_name}</td>
                          <td className="px-3 py-2 font-mono tracking-[0.24em]">{user.temporary_pin}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by name or admission number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field flex-1"
        />
        <select
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value)}
          className="input-field sm:w-36"
        >
          <option value="">All Grades</option>
          <option value="10">Grade 10</option>
          <option value="11">Grade 11</option>
          <option value="12">Grade 12</option>
        </select>
        <select
          value={filterStream}
          onChange={(e) => setFilterStream(e.target.value)}
          className="input-field sm:w-40"
        >
          <option value="">All Streams</option>
          <option value="Blue">Blue</option>
          <option value="Green">Green</option>
          <option value="Magenta">Magenta</option>
          <option value="Red">Red</option>
          <option value="White">White</option>
          <option value="Yellow">Yellow</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {(selected.size > 0 || deleting) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-red-700">{selected.size} selected</span>
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="text-sm bg-red-600 text-white px-4 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? <><LoadingSpinner size="sm" /> Deleting...</> : 'Delete Selected'}
            </button>
            {!deleting && (
              <button
                onClick={() => setSelected(new Set())}
                className="text-sm text-gray-600 hover:underline"
              >
                Clear selection
              </button>
            )}
          </div>
          {deleting && deleteProgress.total > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs text-red-700 mb-1">
                <span>Deleting {deleteProgress.done} of {deleteProgress.total}...</span>
                <span>{Math.round((deleteProgress.done / deleteProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-red-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-red-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(deleteProgress.done / deleteProgress.total) * 100}%` }}
                />
              </div>
              {deleteProgress.failed > 0 && (
                <p className="text-xs text-red-500 mt-1">{deleteProgress.failed} failed</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Student List */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 w-10">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Adm. No.</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Full Name</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Grade</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Stream</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className={`border-b border-gray-100 last:border-0 ${selected.has(s.id) ? 'bg-red-50/50' : ''}`}>
                <td className="py-2.5 px-3">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="py-2.5 px-3 font-mono text-gray-600">{s.admission_number}</td>
                <td className="py-2.5 px-3 font-medium">{s.full_name}</td>
                <td className="py-2.5 px-3 text-gray-600">{s.grade ? `Grade ${s.grade}` : '—'}</td>
                <td className="py-2.5 px-3">
                  {s.stream && <StreamBadge stream={s.stream as StreamName} />}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    onClick={() => handleResetPin(s)}
                    className="text-xs text-red-600 hover:underline min-h-[44px] px-2"
                  >
                    Reset PIN
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 py-6 text-sm">No students found.</p>
        )}
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
