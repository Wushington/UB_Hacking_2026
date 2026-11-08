import { auth, currentUser } from "@clerk/nextjs/server";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { getDashboardView } from "@/lib/dashboard/queries";
import { emptyDashboard } from "@/lib/dashboard/view";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

/** Reads the session and the user's rows at request time. */
async function Dashboard() {
  const { userId } = await auth();
  if (!userId) return <DashboardScreen view={emptyDashboard(false)} className={inter.className} />;
  const user = await currentUser();
  const view = await getDashboardView(userId, user?.firstName?.trim() || null);
  return <DashboardScreen view={view} className={inter.className} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-orbit-bg" aria-busy="true" />}>
      <Dashboard />
    </Suspense>
  );
}
