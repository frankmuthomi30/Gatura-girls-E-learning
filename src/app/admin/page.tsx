'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageLoading } from '@/components/Loading';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts';
import {
  Users, Briefcase, BookOpen, FileCheck,
  HardDrive, Trash2, Clock, AlertTriangle,
  ArrowRight, Radio,
} from 'lucide-react';

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalAssignments: number;
  totalSubmissions: number;
  streamCounts: Record<string, number>;
}

interface ExamStats {
  activeExams: number;
  inProgress: number;
  submitted: number;
  timedOut: number;
}

interface StorageHealth {
  status: 'healthy' | 'warning' | 'critical';
  totalMegabytes: number;
  fileCount: number;
  fileSubmissionCount: number;
  cleanupCandidateCount: number;
  oldestUploadAt: string | null;
  thresholds: {
    warningMb: number;
    criticalMb: number;
    cleanupCandidateDays: number;
  };
  recommendations: string[];
}

function formatStorage(valueMb: number) {
  if (valueMb >= 1024) return `${(valueMb / 1024).toFixed(2)} GB`;
  return `${valueMb.toFixed(1)} MB`;
}

/* ── SVG Gauge / Speedometer ───────────────────────────────── */
function Gauge({ value, max, label, color, icon }: {
  value: number; max: number; label: string; color: string;
  icon: React.ReactNode;
}) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;           // 270° sweep
  const offset = arc - arc * pct;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 128 110" className="w-full max-w-[160px]">
        {/* track */}
        <circle cx="64" cy="64" r={r} fill="none"
          stroke="currentColor" className="text-border/40 dark:text-white/[0.07]"
          strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`}
          transform="rotate(135 64 64)" />
        {/* value */}
        <circle cx="64" cy="64" r={r} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`}
          strokeDashoffset={offset}
          transform="rotate(135 64 64)"
          className="transition-all duration-1000 ease-out" />
        {/* center value */}
        <text x="64" y="58" textAnchor="middle"
          className="fill-foreground font-bold" style={{ fontSize: 26 }}>
          {value}
        </text>
        <text x="64" y="76" textAnchor="middle"
          className="fill-muted-foreground" style={{ fontSize: 10 }}>
          {label}
        </text>
      </svg>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground -mt-2">
        {icon}
      </div>
    </div>
  );
}

/* ── Mini Ring Stat ────────────────────────────────────────── */
function RingStat({ value, total, label, color }: {
  value: number; total: number; label: string; color: string;
}) {
  const data = [
    { name: 'val', value: value },
    { name: 'rest', value: Math.max(total - value, 0) },
  ];
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="w-16 h-16 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%"
              innerRadius={20} outerRadius={28} startAngle={90} endAngle={-270}
              strokeWidth={0}>
              <Cell fill={color} />
              <Cell fill="var(--color-border-soft, rgba(148,163,184,0.18))" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
          {value}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground leading-tight text-center">{label}</span>
    </div>
  );
}

/* ── Storage Ring (SVG green→yellow→red arc) ──────────────── */
function StorageGauge({ usedMb, warningMb, criticalMb }: {
  usedMb: number; warningMb: number; criticalMb: number; status: string;
}) {
  const cap = criticalMb * 1.2;               // ring represents 0 → 120% of critical
  const pct = Math.min(usedMb / cap, 1);      // 0–1
  const warnPct = warningMb / cap;             // where warning starts on ring
  const critPct = criticalMb / cap;            // where critical starts on ring

  // Ring geometry: 240° sweep (from 150° to -90° = 240°)
  const r = 58;
  const cx = 70;
  const cy = 70;
  const circ = 2 * Math.PI * r;
  const sweepDeg = 240;
  const arc = circ * (sweepDeg / 360);
  const startAngle = 150;                      // bottom-left

  // Helper: polar → cartesian at angle (degrees, CW from top)
  const polarToXY = (angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  // Gradient stop positions mapped to ring
  const gradId = 'storageGrad';

  // Value arc dashoffset
  const valueOffset = arc - arc * pct;

  // Tick marks at warning & critical
  const warnAngle = startAngle - sweepDeg * warnPct;
  const critAngle = startAngle - sweepDeg * critPct;
  const warnPt = polarToXY(warnAngle);
  const critPt = polarToXY(critAngle);
  const warnPtInner = (() => { const rad = ((warnAngle - 90) * Math.PI) / 180; return { x: cx + (r - 14) * Math.cos(rad), y: cy + (r - 14) * Math.sin(rad) }; })();
  const critPtInner = (() => { const rad = ((critAngle - 90) * Math.PI) / 180; return { x: cx + (r - 14) * Math.cos(rad), y: cy + (r - 14) * Math.sin(rad) }; })();

  // Needle position
  const needleAngle = startAngle - sweepDeg * pct;
  const needlePt = polarToXY(needleAngle);
  const needlePtShort = (() => { const rad = ((needleAngle - 90) * Math.PI) / 180; return { x: cx + (r - 22) * Math.cos(rad), y: cy + (r - 22) * Math.sin(rad) }; })();

  // Color at current position
  const currentColor = pct >= critPct ? '#ef4444' : pct >= warnPct ? '#f59e0b' : '#22c55e';

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg viewBox="0 0 140 140" className="w-full h-full">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="45%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        {/* Background track */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="currentColor" className="text-border/30 dark:text-white/[0.06]"
          strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`}
          transform={`rotate(${startAngle + 180} ${cx} ${cy})`} />

        {/* Colored value arc with gradient */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`}
          strokeDashoffset={valueOffset}
          transform={`rotate(${startAngle + 180} ${cx} ${cy})`}
          className="transition-all duration-1000 ease-out" />

        {/* Warning tick */}
        <line x1={warnPtInner.x} y1={warnPtInner.y} x2={warnPt.x} y2={warnPt.y}
          stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        {/* Critical tick */}
        <line x1={critPtInner.x} y1={critPtInner.y} x2={critPt.x} y2={critPt.y}
          stroke="#ef4444" strokeWidth="2" strokeLinecap="round" opacity="0.6" />

        {/* Needle dot */}
        <line x1={needlePtShort.x} y1={needlePtShort.y} x2={needlePt.x} y2={needlePt.y}
          stroke={currentColor} strokeWidth="3" strokeLinecap="round"
          className="transition-all duration-1000 ease-out" />
        <circle cx={needlePt.x} cy={needlePt.y} r="4" fill={currentColor}
          className="transition-all duration-1000 ease-out" />

        {/* Center text */}
        <text x={cx} y={cy - 4} textAnchor="middle"
          className="fill-foreground font-bold" style={{ fontSize: 18 }}>
          {formatStorage(usedMb)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle"
          className="fill-muted-foreground" style={{ fontSize: 9 }}>
          of {formatStorage(criticalMb)} limit
        </text>

        {/* Scale labels */}
        <text x="18" y="118" textAnchor="middle"
          className="fill-muted-foreground" style={{ fontSize: 8 }}>0</text>
        <text x="122" y="118" textAnchor="middle"
          className="fill-muted-foreground" style={{ fontSize: 8 }}>{formatStorage(cap)}</text>
      </svg>
    </div>
  );
}

/* ── Shared 3D glass card class ────────────────────────────── */
const glass = [
  'relative overflow-hidden rounded-[28px]',
  'border border-white/20 dark:border-white/[0.08]',
  'bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl',
  'p-5 transition-all duration-300',
  'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06),0_10px_22px_-5px_rgba(0,0,0,0.08),0_20px_50px_-12px_rgba(0,0,0,0.12),inset_0_1px_0_0_rgba(255,255,255,0.5)]',
  'dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.2),0_10px_22px_-5px_rgba(0,0,0,0.3),0_20px_50px_-12px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.06)]',
].join(' ');

const glassHover = `${glass} hover:-translate-y-1 hover:shadow-2xl`;

const glassOverlay = 'absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-black/[0.02] dark:from-white/[0.06] dark:to-black/[0.08] pointer-events-none';

/* ── Main Dashboard ────────────────────────────────────────── */
export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [examStats, setExamStats] = useState<ExamStats>({ activeExams: 0, inProgress: 0, submitted: 0, timedOut: 0 });
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [dashboardResponse, storageHealthResponse] = await Promise.all([
          fetch('/api/admin/dashboard', { cache: 'no-store' }),
          fetch('/api/admin/storage-health'),
        ]);
        if (dashboardResponse.ok) {
          const result = await dashboardResponse.json();
          setStats(result.stats);
          setExamStats(result.examStats);
        }
        if (storageHealthResponse.ok) {
          const storageResult = await storageHealthResponse.json();
          setStorageHealth(storageResult as StorageHealth);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <PageLoading />;
  if (!stats) return <div className="p-6 text-center text-gray-500">Failed to load dashboard data.</div>;

  const streamColors: Record<string, string> = {
    Blue: '#3b82f6', Green: '#22c55e', Magenta: '#ec4899',
    Red: '#ef4444', White: '#94a3b8', Yellow: '#eab308',
  };

  const totalStudents = stats.totalStudents || 1;
  const barData = Object.entries(streamColors).map(([name, color]) => ({
    name, students: stats.streamCounts[name] || 0, fill: color,
  }));
  const pieData = barData.filter(d => d.students > 0);

  const examTotal = examStats.inProgress + examStats.submitted + examStats.timedOut || 1;

  return (
    <div className="space-y-6" style={{ perspective: '1200px' }}>
      <h1 className="page-title">Admin Dashboard</h1>

      {/* ─── Top Gauges Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { val: stats.totalStudents, max: 1200, label: 'Students', color: '#22c55e',
            icon: <Users className="w-3.5 h-3.5" />, href: '/admin/students' },
          { val: stats.totalTeachers, max: 50, label: 'Teachers', color: '#3b82f6',
            icon: <Briefcase className="w-3.5 h-3.5" />, href: '/admin/teachers' },
          { val: stats.totalAssignments, max: Math.max(stats.totalAssignments * 1.5, 20), label: 'Assignments', color: '#a855f7',
            icon: <BookOpen className="w-3.5 h-3.5" />, href: '#' },
          { val: stats.totalSubmissions, max: Math.max(stats.totalSubmissions * 1.3, 50), label: 'Submissions', color: '#f97316',
            icon: <FileCheck className="w-3.5 h-3.5" />, href: '#' },
        ].map((g) => (
          <Link key={g.label} href={g.href} className={glassHover}>
            <div className={glassOverlay} />
            <div className="relative">
              <Gauge value={g.val} max={g.max} label={g.label}
                color={g.color} icon={g.icon} />
            </div>
          </Link>
        ))}
      </div>

      {/* ─── Live Exam Activity ─── */}
      {(examStats.activeExams > 0 || examStats.inProgress > 0) && (
        <div className={glass}>
          <div className={glassOverlay} />
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/[0.04] via-transparent to-orange-500/[0.04] pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex items-center justify-center w-8 h-8">
                <span className="absolute inline-flex h-full w-full rounded-full bg-yellow-400/40 animate-ping" />
                <Radio className="w-4 h-4 text-yellow-500 relative z-10" />
              </div>
              <h2 className="font-semibold text-lg text-foreground">Live Exam Activity</h2>
              <span className="ml-auto text-xs text-muted-foreground">{examStats.activeExams} active exam(s)</span>
            </div>
            <div className="flex items-center justify-center gap-6">
              <RingStat value={examStats.inProgress} total={examTotal} label="In Progress" color="#eab308" />
              <RingStat value={examStats.submitted} total={examTotal} label="Submitted" color="#22c55e" />
              <RingStat value={examStats.timedOut} total={examTotal} label="Timed Out" color="#ef4444" />
            </div>
          </div>
        </div>
      )}

      {/* ─── Stream Breakdown: Bar + Pie ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart */}
        <div className={glass}>
          <div className={glassOverlay} />
          <div className="relative">
            <h2 className="font-semibold text-base mb-4 text-foreground">Students per Stream</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barSize={28} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                    className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                    className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.85)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(148,163,184,0.2)',
                      borderRadius: 16,
                      boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                    }}
                    cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                  />
                  <Bar dataKey="students" radius={[8, 8, 0, 0]}>
                    {barData.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Pie / donut chart */}
        <div className={glass}>
          <div className={glassOverlay} />
          <div className="relative">
            <h2 className="font-semibold text-base mb-4 text-foreground">Stream Distribution</h2>
            <div className="h-52 flex items-center">
              <div className="w-1/2 h-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="students" cx="50%" cy="50%"
                      innerRadius="48%" outerRadius="80%" paddingAngle={3}
                      strokeWidth={0}>
                      {pieData.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(255,255,255,0.85)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(148,163,184,0.2)',
                        borderRadius: 16,
                        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-foreground pointer-events-none">
                  {stats.totalStudents}
                </span>
              </div>
              <div className="w-1/2 space-y-2 pl-2">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                    <span className="text-xs text-foreground">{d.name}</span>
                    <span className="ml-auto text-xs font-semibold text-foreground">{d.students}</span>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">
                      {Math.round((d.students / totalStudents) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Storage Health Gauge ─── */}
      {storageHealth && (
        <div className={glass}>
          <div className={glassOverlay} />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-teal-500/[0.03] pointer-events-none" />
          <div className="relative">
            <h2 className="font-semibold text-base mb-2 text-foreground flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-muted-foreground" />
              Storage Health
              <span className={`ml-2 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                storageHealth.status === 'critical'
                  ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                  : storageHealth.status === 'warning'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              }`}>
                {storageHealth.status}
              </span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <StorageGauge
                usedMb={storageHealth.totalMegabytes}
                warningMb={storageHealth.thresholds.warningMb}
                criticalMb={storageHealth.thresholds.criticalMb}
                status={storageHealth.status}
              />

              <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                {[
                  { icon: <HardDrive className="w-3.5 h-3.5" />, label: 'Files Stored', value: storageHealth.fileCount },
                  { icon: <Trash2 className="w-3.5 h-3.5" />, label: 'Cleanup Ready', value: storageHealth.cleanupCandidateCount },
                  { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Warning At', value: formatStorage(storageHealth.thresholds.warningMb) },
                  { icon: <Clock className="w-3.5 h-3.5" />, label: 'Oldest Upload', value: storageHealth.oldestUploadAt
                    ? new Date(storageHealth.oldestUploadAt).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })
                    : '—' },
                ].map((item) => (
                  <div key={item.label}
                    className="rounded-2xl bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-white/30 dark:border-white/[0.06] p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)]">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      {item.icon}
                      <span className="text-[10px] uppercase tracking-wider">{item.label}</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {storageHealth.recommendations.length > 0 && (
              <div className="mt-4 rounded-2xl bg-white/30 dark:bg-white/[0.03] backdrop-blur-sm border border-border/30 p-3">
                {storageHealth.recommendations.map((r) => (
                  <p key={r} className="text-xs text-muted-foreground leading-5">{r}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Quick Actions ─── */}
      <div className={glass}>
        <div className={glassOverlay} />
        <div className="relative">
          <h2 className="font-semibold text-base mb-4 text-foreground">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'Import Students', href: '/admin/students', style: 'from-green-500 to-emerald-600' },
              { label: 'Add Teacher', href: '/admin/teachers', style: 'from-blue-500 to-indigo-600' },
              { label: 'Manage Subjects', href: '/admin/subjects', style: 'from-purple-500 to-violet-600' },
              { label: 'Grade Chats', href: '/admin/chat', style: 'from-pink-500 to-rose-600' },
              { label: 'Storage Cleanup', href: '/admin/cleanup', style: 'from-amber-500 to-orange-600' },
              { label: 'View Reports', href: '/admin/reports', style: 'from-cyan-500 to-teal-600' },
            ].map((a) => (
              <Link key={a.label} href={a.href}
                className={`group flex items-center justify-between px-5 py-3.5 rounded-2xl bg-gradient-to-r ${a.style} text-white font-semibold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300`}>
                {a.label}
                <ArrowRight className="w-4 h-4 opacity-60 group-hover:translate-x-1 transition-transform" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
