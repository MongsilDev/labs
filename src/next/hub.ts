import { avatarUrl, currentUser } from "@/er/server/auth";
import { getCut } from "@/er/server/cut";
import { kelData } from "@/er/server/kel";
import { scoreStages } from "@/er/server/kel-stats";
import { getTier } from "@/er/server/tier";
import { myTournaments } from "@/er/server/tournament";
import { pickView } from "@/er/lib/tier";

// 첫 화면이 쓰는 값. 로그인 쿠키가 있는 요청은 CDN 캐시를 거치지 않아 내 대회를 서버에서 그림
export async function hubData() {
  const [cut, tier, user] = await Promise.all([getCut(), getTier(), currentUser()]);
  const picked = tier ? pickView(tier) : null;
  const view = picked?.combos.length ? picked : null;
  // 점수가 같으면 판 수가 많은 쪽이 먼저. 실험체 티어 화면의 순서와 같음
  const combos = view ? [...view.combos].sort((a, b) => b.score - a.score || b.n - a.n) : [];
  const kel = kelData();
  return {
    cut,
    view,
    combos,
    final: kel ? scoreStages(kel).at(-1) : undefined,
    user: user ? { name: user.name, avatar: avatarUrl(user) } : null,
    mine: user ? myTournaments(user).slice(0, 3) : [],
  };
}

export type Hub = Awaited<ReturnType<typeof hubData>>;
