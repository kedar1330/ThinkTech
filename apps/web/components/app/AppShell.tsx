import { FloatingAssistantWidget } from '@/components/chat/FloatingAssistantWidget';
import { TopNav } from './TopNav';

/**
 * Signed-in layout: the top navigation bar (all sections, account menu, mobile drawer) above a
 * centred content column. Shared by every page in the (app) route group.
 */
export function AppShell({
  userName,
  userEmail,
  userRole,
  profileIncomplete = false,
  children,
}: {
  userName: string;
  userEmail: string;
  userRole?: string;
  /** Shows "Complete your profile" in the navigation (FR-ONB-05). */
  profileIncomplete?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav userName={userName} userEmail={userEmail} userRole={userRole} profileIncomplete={profileIncomplete} />
      <main id="main" className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {children}
      </main>
      {/* Floating Style Assistant launcher accessible from anywhere (Meta AI WhatsApp style) */}
      <FloatingAssistantWidget />
    </div>
  );
}
