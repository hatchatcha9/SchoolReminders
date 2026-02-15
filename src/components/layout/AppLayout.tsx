'use client';

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';
import { AuthProvider } from '@/components/auth';

interface AppLayoutProps {
  children: React.ReactNode;
}

// Routes that should not show the main navigation
const authRoutes = ['/login', '/register'];

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const isAuthRoute = authRoutes.includes(pathname);

  // Auth routes get a simple layout without navigation
  if (isAuthRoute) {
    return (
      <AuthProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {children}
        </div>
      </AuthProvider>
    );
  }

  // Main app layout with navigation
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Navigation />

        {/* Main Content Area */}
        <main className="md:pl-64 pt-16 md:pt-0 pb-20 md:pb-0 flex-1">
          {children}
        </main>

        {/* Footer - hidden on mobile due to bottom nav */}
        <footer className="hidden md:block md:pl-64 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <p>School Reminder - Stay organized, stay ahead</p>
              <p>Built with Next.js + Canvas API</p>
            </div>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
