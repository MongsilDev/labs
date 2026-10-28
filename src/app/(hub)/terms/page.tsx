import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import ThemeToggle from "@/er/components/ThemeToggle";

export const metadata: Metadata = { title: "이용약관" };

export default function Terms() {
  return (
    <>
      <SiteHeader>
        <ThemeToggle />
      </SiteHeader>
      <main id="main" className="wrap slim doc">
        <h1 className="mt-3 mb-[18px] text-[28px] font-extrabold tracking-[-0.5px]">이용약관</h1>
        <p className="text-[14px] text-fg-3">2026년 10월 28일 시행</p>
        <p>
          이 약관은 labs.mongsil.dev와 이 사이트가 제공하는 모든 도구에 적용됩니다.
          <br />
          사이트를 이용하면 이 약관에 동의한 것으로 간주합니다.
        </p>

        <h2>1. 서비스</h2>
        <p>
          Labs는 개인이 운영하는 무료 게임 도구 모음입니다.
          <br />
          이터널 리턴 KEL 기록, 점수 계산, 이터컷 예측과 Escape from Tarkov 계정 조회, KORD BREACH 특성 시뮬레이터가 있습니다.
          <br />
          님블뉴런이나 Battlestate Games가 운영하거나 보증하는 서비스가 아닙니다.
          <br />
          게임 정보는 공식 API와 공식 사이트, tarkov.dev가 공개하는 자료에서 수집하므로 실제와 다르거나 늦게 반영될 수 있습니다.
          <br />
          KEL 기록은 님블뉴런 이스포츠 팀에게 제공받은 경기 기록과 dak.gg e스포츠 경기 기록, bori.wiki 대회 결과를 정리한 자료이며, 공식 발표와 다를 수 있습니다.
        </p>

        <h2>2. 대회 운영</h2>
        <p>
          대회는 디스코드로 로그인한 사용자만 만들 수 있고, 대회를 만든 개최자는 초대 링크로 다른 운영자를 추가할 수 있습니다.
          <br />
          운영자가 조에 디스코드 채널을 연결하면, 그 채널에 올라온 경기 결과 CSV는 올린 사람과 관계없이 몽실봇을 거쳐 그 조에 반영됩니다.
          <br />
          몽실봇은 연결된 채널에 대회 순위 이미지를 올리고, 메시지 관리 권한이 있으면 반영을 마친 CSV만 담긴 메시지를 삭제합니다.
          <br />
          연결한 채널에 파일을 올릴 수 있는 사람은 디스코드 서버의 권한 설정으로 관리해주세요.
          <br />
          대회 운영자는 반영된 경기 결과와 입력한 대회 정보가 정확한지 확인할 책임이 있습니다.
          <br />
          대회 순위와 선수 기록은 대회 코드를 아는 사람이라면 누구나 열람할 수 있습니다.
          <br />
          대회는 마지막으로 수정한 지 24시간이 지나면 자동으로 삭제되며, 삭제된 대회는 복구할 수 없습니다.
        </p>

        <h2>3. 판정 배지</h2>
        <p>
          Escape from Tarkov 판정 배지는 공개된 전적을 비교군과 통계적으로 비교한 참고 정보입니다.
          <br />
          실력이 좋거나 친구와 함께 플레이하는 계정도 높게 판정될 수 있으며, 판정 결과는 부정행위의 증거가 아닙니다.
          <br />
          판정 결과를 근거로 다른 플레이어를 비방하거나 괴롭혀서는 안 됩니다.
          <br />
          자세한 기준은 <Link href="/tarkov/criteria">판정 기준</Link>에서 확인할 수 있습니다.
        </p>

        <h2>4. KEL 기록</h2>
        <p>
          부진한 기록을 포함한 모든 KEL 기록은 경기 결과를 정리한 자료이며, 선수나 팀을 평가하거나 비방하려는 목적으로 만들지 않았습니다.
          <br />
          KEL 기록을 근거로 특정 선수나 팀을 비방하거나 괴롭혀서는 안 됩니다.
        </p>

        <h2>5. 이용 제한</h2>
        <p>
          자동화된 방법으로 요청을 과도하게 반복하거나, 버그를 악용하거나, 권한이 없는 대회를 수정하려고 시도하면 해당 이용자의 이용을 제한할 수 있습니다.
        </p>

        <h2>6. 변경과 중단</h2>
        <p>
          기능은 예고 없이 변경되거나 종료될 수 있습니다.
          <br />
          게임 API, tarkov.dev, 몽실봇에 장애가 발생하면 일부 기능이 일시적으로 동작하지 않을 수 있습니다.
        </p>

        <h2>7. 책임</h2>
        <p>
          Labs는 무료이며 현재 상태 그대로 제공됩니다.
          <br />
          사이트 운영자는 고의나 중대한 과실이 없는 한, 서비스 중단이나 잘못된 정보로 발생한 손해에 대해 책임을 지지 않습니다.
        </p>

        <h2>8. 개인정보</h2>
        <p>
          수집하는 정보와 보유 기간은 <Link href="/privacy">개인정보 처리방침</Link>에서 확인할 수 있습니다.
        </p>

        <h2>9. 약관 변경</h2>
        <p>
          약관을 변경하면 이 페이지에 시행일과 함께 공지합니다.
          <br />
          이 약관은 대한민국 법에 따라 해석합니다.
        </p>

        <h2>10. 문의</h2>
        <p>
          <a href="mailto:mail@mongsil.dev">mail@mongsil.dev</a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
