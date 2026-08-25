import { listAnnouncements } from "@/lib/services/event-ops";
import { ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({ announcements: await listAnnouncements(true) });
}
