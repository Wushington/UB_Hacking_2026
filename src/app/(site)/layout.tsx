import { SiteHeader } from "@/components/layout/site-header";

/** Pages that use the standard light site header. Full-screen design routes (e.g. /explain) live outside this group. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
