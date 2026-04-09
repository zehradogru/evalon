'use client';

import { useAuthStore } from '@/store/use-auth-store';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LandingPage } from '@/features/landing/landing-page';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { isAuthenticated, loading } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch or flash of content
  if (!mounted || loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <DashboardShell>
        <DashboardView />
      </DashboardShell>
    );
  }

  return <LandingPage />;
}
