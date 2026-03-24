'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, getProfile } from '@/lib/auth';
import { getDashboardPath } from '@/lib/auth';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GraduationCap, BookOpen, Search, ShieldCheck, ArrowRight, Loader2, KeyRound, User } from 'lucide-react';

const ThemeToggle = dynamic(
  () => import('@/components/ThemeToggle').then((module) => module.ThemeToggle),
  { ssr: false }
);

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
};

export default function LoginPage() {
  const router = useRouter();
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!admissionNumber.trim()) {
      setError('Please enter your admission or staff number');
      return;
    }
    if (!pin.trim() || pin.length < 6) {
      setError('Please enter your 6-digit PIN');
      return;
    }

    setLoading(true);
    try {
      await signIn(admissionNumber.trim(), pin);
      const profile = await getProfile();

      if (!profile) {
        setError('Account not found. Please contact your administrator.');
        return;
      }

      if (profile.must_change_pin) {
        router.push('/change-pin');
      } else {
        router.push(getDashboardPath(profile.role));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('rate limit')) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else {
        setError('Invalid admission number or PIN. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-4 lg:p-8">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />
      
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-6xl mx-auto rounded-[2.5rem] border border-border/50 bg-card/40 shadow-2xl backdrop-blur-3xl overflow-hidden grid lg:grid-cols-[1.2fr_1fr] relative z-10"
      >
        {/* Left Side: Branding / Features */}
        <section className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-border/50 bg-gradient-to-br from-primary/10 via-background to-background overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")' }} />
          
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="relative z-10 space-y-8">
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary shadow-sm mb-6">
                Official Portal
              </span>
              <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                Learn, <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">submit,</span> <br/>
                track progress.
              </h1>
              <p className="mt-6 max-w-md text-base text-muted-foreground leading-relaxed">
                The centralized academic workspace for Gatura Girls Secondary School. Access assignments, monitor grades, and stay connected with live updates.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              {[
                { title: "For Students", desc: "Assignments, grades, and active progress insights.", icon: <GraduationCap className="w-5 h-5 text-primary" /> },
                { title: "For Teachers", desc: "Create work, grade fast, and monitor class activity.", icon: <BookOpen className="w-5 h-5 text-blue-500" /> },
                { title: "For Admin", desc: "Control user roles, subjects, and analytics.", icon: <ShieldCheck className="w-5 h-5 text-emerald-500" /> }
              ].map((feature, i) => (
                <div key={i} className={`p-5 rounded-2xl border border-border/50 bg-background/50 backdrop-blur-sm shadow-sm ${i === 2 ? 'sm:col-span-2' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center mb-3 shadow-sm">
                    {feature.icon}
                  </div>
                  <h3 className="font-bold text-foreground text-sm">{feature.title}</h3>
                  <p className="mt-1 text-xs font-medium text-muted-foreground leading-snug">{feature.desc}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* Right Side: Login Form */}
        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14 relative bg-background/60">
          <div className="w-full max-w-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8 text-center lg:text-left"
            >
              <div className="mx-auto lg:mx-0 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark shadow-xl shadow-primary/20">
                <span className="text-white text-2xl font-black tracking-tighter">GG</span>
              </div>
              <h2 className="text-3xl font-extrabold text-foreground tracking-tight">Welcome back</h2>
              <p className="mt-2 text-sm font-medium text-muted-foreground">Sign in with your standard credentials to access your dashboard.</p>
            </motion.div>

            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onSubmit={handleSubmit} 
              className="space-y-5"
            >
              <AnimatePresence mode="popLayout">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, scale: 0.9 }}
                    animate={{ opacity: 1, height: "auto", scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.9 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400 flex items-start gap-2">
                       <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                       <p>{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label htmlFor="admission" className="text-muted-foreground ml-1">Admission / Staff Number</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <Input
                    id="admission"
                    type="text"
                    maxLength={20}
                    placeholder="e.g. 8074 or T001"
                    value={admissionNumber}
                    onChange={(e) => setAdmissionNumber(e.target.value.replace(/\s/g, ''))}
                    disabled={loading}
                    className="pl-10 h-12 rounded-xl bg-muted/50 border-transparent hover:border-primary/30 focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:bg-background transition-all"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="pin" className="text-muted-foreground">Security PIN</Label>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">6 digits</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="••••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    disabled={loading}
                    className="pl-10 h-12 rounded-xl bg-muted/50 border-transparent hover:border-primary/30 focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:bg-background transition-all tracking-widest text-lg"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 mt-4 rounded-xl font-bold shadow-lg shadow-primary/20 group relative overflow-hidden"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Signing in...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2 w-full">
                    Sign In to Portal
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              </Button>

              <div className="mt-8 rounded-2xl border border-border bg-muted/30 p-4 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40 rounded-l-2xl" />
                <div className="text-[11px] font-medium text-muted-foreground space-y-1.5 pl-2">
                  <p className="flex justify-between"><span>Students:</span> <span className="text-foreground">Use Admission No.</span></p>
                  <p className="flex justify-between"><span>Teachers/Admin:</span> <span className="text-foreground">Use Staff ID</span></p>
                  <div className="h-px w-full bg-border/60 my-2" />
                  <p className="opacity-70 italic">Ensure you use the temporary PIN provided by the administrator.</p>
                </div>
              </div>
            </motion.form>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center lg:text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mt-10"
            >
              Gatura Girls Secondary &copy; {new Date().getFullYear()}
            </motion.p>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
