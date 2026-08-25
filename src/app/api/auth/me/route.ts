import { currentUser } from "@/lib/auth";
import { ok } from "@/lib/api-helpers";

export async function GET() {
  const user = await currentUser();
  if (!user) return ok({ user: null });
  return ok({ user: { id: user.id, email: user.email, role: user.role, name: user.name } });
}
