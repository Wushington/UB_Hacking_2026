import { auth, currentUser } from "@clerk/nextjs/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardArrival } from "@/components/auth/dashboard-arrival";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { getDashboardView } from "@/lib/dashboard/queries";


/** Reads the session and the user's rows at request time. */
async function Dashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-up");
  const user = await currentUser();
  const view = await getDashboardView(userId, user?.firstName?.trim() || null);
  return <DashboardArrival><DashboardScreen view={view} /></DashboardArrival>;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <Dashboard />
    </Suspense>
  );
}
