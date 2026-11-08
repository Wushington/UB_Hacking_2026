import { auth, currentUser } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { getDashboardView } from "@/lib/dashboard/queries";
import { emptyDashboard } from "@/lib/dashboard/view";

/** Reads the session and the user's rows at request time. */
async function Dashboard() {
  const { userId } = await auth();
  if (!userId) return <DashboardScreen view={emptyDashboard(false)} />;
  const user = await currentUser();
  const view = await getDashboardView(userId, user?.firstName?.trim() || null);
  return <DashboardScreen view={view} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <Dashboard />
    </Suspense>
  );
}
