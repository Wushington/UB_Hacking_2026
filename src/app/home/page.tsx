import { redirect } from "next/navigation";

/** The dashboard lives at `/`; keep old `/home` links and bookmarks working. */
export default function HomeRedirect() {
  redirect("/");
}
