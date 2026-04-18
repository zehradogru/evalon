'use client';

import { useAuthStore } from '@/store/use-auth-store';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LandingPage } from '@/features/landing/landing-page';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading, requiresEmailVerification } = useAuthStore();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (isAuthenticated && requiresEmailVerification) {
      router.replace('/verify-email');
    }
  }, [isAuthenticated, loading, requiresEmailVerification, router]);

  // Prevent hydration mismatch or flash of content
  if (loading || requiresEmailVerification) {
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
