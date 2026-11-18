import { accountUser, currentUser } from "@/er/server/auth";
import { myTournaments } from "@/er/server/tournament";
import { handle, json } from "@/er/server/http";

export async function GET() {
  return handle(async () => {
    const user = await currentUser();
    if (!user) return json({ user: null, tournaments: [] });
    return json({ user: { ...user, ...accountUser(user) }, tournaments: myTournaments(user) });
  });
}
