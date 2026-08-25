import { currentUser } from "@/lib/auth";
import SettingsPanel from "@/components/settings-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const user = await currentUser();
  return (
    <div className="space-y-5">
      <header>
      <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// event configuration — changes are audit-logged"}</div>
        <h1 className="text-2xl font-bold tracking-tight">Event Settings</h1>
      </header>
      <SettingsPanel isSuperAdmin={user?.role === "super_admin"} />
    </div>
  );
}
