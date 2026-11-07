import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ExplainAloudScreen } from "@/components/explain-aloud/explain-aloud-screen";
import { sampleExplainAloud } from "@/components/explain-aloud/sample-data";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Explain aloud · Orbit Study",
};

export default function ExplainAloudPage() {
  return (
    <main className="flex flex-1 flex-col">
      <ExplainAloudScreen {...sampleExplainAloud} className={inter.className} />
    </main>
  );
}
