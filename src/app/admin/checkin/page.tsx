import CheckInConsole from "@/components/checkin-console";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check-in Desk" };

export default function CheckInPage() {
  return (
    <div className="space-y-5">
      <header>
      <div className="font-mono text-xs text-muted tracking-[0.2em]">{"// enter the pipeline — 08:45 to 09:30"}</div>
        <h1 className="text-2xl font-bold tracking-tight">Check-In Desk</h1>
      </header>
      <CheckInConsole />
    </div>
  );
}
