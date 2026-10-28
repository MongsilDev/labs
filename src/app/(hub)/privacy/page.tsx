import type { Metadata } from "next";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import ThemeToggle from "@/er/components/ThemeToggle";

export const metadata: Metadata = { title: "개인정보 처리방침" };

const H3 = "mt-5 mb-2 text-[15px] font-bold";

export default function Privacy() {
  return (
    <>
      <SiteHeader>
        <ThemeToggle />
      </SiteHeader>
      <main id="main" className="wrap slim doc">
        <h1 className="mt-3 mb-[18px] text-[28px] font-extrabold tracking-[-0.5px]">개인정보 처리방침</h1>
        <p className="text-[14px] text-fg-3">2026년 10월 28일 시행</p>
        <p>
          labs.mongsil.dev가 처리하는 개인정보를 개인정보 보호법 제30조에 따라 공개합니다.<br />개인이 운영하는 무료 서비스이며, 이터널 리턴 도구와 Escape from Tarkov 도구가
          있습니다.<br />로그인 기능은 이터널 리턴 대회 운영자만 사용합니다.
        </p>

        <h2>1. 처리 목적</h2>
        <ul>
          <li>이터널 리턴 대회 순위 계산과 공유</li>
          <li>이터널 리턴 대회 운영자 로그인과 권한 확인</li>
          <li>디스코드 채널에 올라온 이터널 리턴 경기 결과 반영</li>
          <li>Escape from Tarkov 계정 전적 조회와 판정 배지 계산</li>
          <li>Escape from Tarkov 닉네임 변경 이력과 전적 변화 기록</li>
          <li>오류 확인과 남용 방지</li>
          <li>방문 통계</li>
        </ul>

        <h2>2. 처리 항목과 보유 기간</h2>
        <h3 className={H3}>이터널 리턴</h3>
        <div className="doc-table cards">
          <table>
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">수집 시점</th>
                <th scope="col">보유 기간</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="항목">게임 닉네임, 실험체, 팀 이름, 경기 순위와 기록</td>
                <td data-label="수집 시점">운영자가 경기 결과 CSV를 올리거나, 연결된 디스코드 채널에 누군가 CSV를 올릴 때</td>
                <td data-label="보유 기간">대회를 마지막으로 수정하고 24시간 뒤까지</td>
              </tr>
              <tr>
                <td data-label="항목">대회 이름, 감점, 날씨, 변경 기록과 변경한 운영자나 디스코드에서 결과를 올린 사람의 이름</td>
                <td data-label="수집 시점">운영자가 대회를 만들거나 수정할 때</td>
                <td data-label="보유 기간">대회를 마지막으로 수정하고 24시간 뒤까지</td>
              </tr>
              <tr>
                <td data-label="항목">연결한 디스코드 서버 이름, 채널 이름과 채널 ID, 마지막으로 결과를 올린 사람의 디스코드 이름</td>
                <td data-label="수집 시점">운영자가 조에 디스코드 채널을 연결할 때와 연결된 채널에 결과가 올라올 때</td>
                <td data-label="보유 기간">대회를 마지막으로 수정하고 24시간 뒤까지</td>
              </tr>
              <tr>
                <td data-label="항목">디스코드 ID, 사용자 이름, 프로필 사진 주소</td>
                <td data-label="수집 시점">디스코드로 로그인할 때</td>
                <td data-label="보유 기간">로그인 후 7일이 지나거나 로그아웃하고, 운영하던 대회가 모두 삭제될 때까지</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>디스코드 로그인은 사용자 식별 권한만 요청합니다.<br />디스코드 로그인으로 서버 목록, 메시지, 이메일을 받지 않고, 디스코드 접속 토큰은 저장하지 않습니다.</p>
        <p>디스코드에서 몽실봇의 /대회 명령을 쓰면, 몽실봇이 사용자의 디스코드 ID로 그 사람이 운영하는 대회 목록과 대회 권한을 Labs에 조회합니다.<br />조회에 쓴 디스코드 ID는 Labs에 따로 저장하지 않습니다.</p>
        <p>관리 화면에서 디스코드 채널을 고를 때, Labs는 운영자의 디스코드 ID를 몽실봇에 보내 그 운영자가 고를 수 있는 서버와 채널 목록을 받습니다.<br />받은 목록은 저장하지 않고, 고른 채널만 위 표처럼 저장합니다.<br />연결된 채널에 CSV가 올라오면 몽실봇이 올린 사람의 디스코드 ID와 이름을 함께 보내고, Labs는 디스코드 ID를 운영자 권한 확인에만 쓰고 저장하지 않습니다.</p>

        <h3 className={H3}>Escape from Tarkov</h3>
        <div className="doc-table cards">
          <table>
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">수집 경로</th>
                <th scope="col">보유 기간</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="항목">게임 계정 번호, 닉네임, 마지막 갱신 시각</td>
                <td data-label="수집 경로">tarkov.dev가 공개하는 이름 목록, 하루 한 번</td>
                <td data-label="보유 기간">tarkov.dev 목록에 있는 동안</td>
              </tr>
              <tr>
                <td data-label="항목">닉네임 변경 이력</td>
                <td data-label="수집 경로">위 이름 목록을 전날 목록과 비교</td>
                <td data-label="보유 기간">삭제 요청이 있을 때까지</td>
              </tr>
              <tr>
                <td data-label="항목">전적 숫자, 진영, 레벨, 계정 등급, 도전과제 달성 시각, 플레이 시간</td>
                <td data-label="수집 경로">tarkov.dev가 공개하는 계정 기록.<br />누군가 이 사이트에서 조회할 때와 판정 비교군을 만들 때</td>
                <td data-label="보유 기간">삭제 요청이 있을 때까지.<br />장비와 아이템 정보는 저장하지 않음</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          게임 기록은 tarkov.dev가 이미 공개한 정보입니다.<br />이 사이트는 Battlestate Games 서버에 직접 접속하지 않고, tarkov.dev에서 누군가 조회한 적 있는 계정의 공개
          기록만 수집합니다.
        </p>

        <h3 className={H3}>공통</h3>
        <div className="doc-table cards">
          <table>
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">수집 시점</th>
                <th scope="col">보유 기간</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="항목">접속 IP 주소</td>
                <td data-label="수집 시점">사이트에 접속할 때</td>
                <td data-label="보유 기간">요청 횟수 제한에만 사용하고 저장하지 않음.<br />서버 메모리에서 1시간 안에 삭제됨</td>
              </tr>
              <tr>
                <td data-label="항목">방문한 페이지 주소, 브라우저와 기기 정보, 방문 통계 쿠키 식별자</td>
                <td data-label="수집 시점">페이지를 조작하거나 10초 넘게 머물 때</td>
                <td data-label="보유 기간">수집일로부터 14개월</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>3. 파기</h2>
        <p>
          보유 기간이 지난 이터널 리턴 대회와 로그인 정보는 10분마다 자동으로 파기하며, 백업하지 않습니다.<br />Escape from Tarkov 기록은 삭제 요청을 받으면 해당 계정의
          닉네임 변경 이력과 저장된 전적을 삭제하고, 이후 화면에 표시하지 않습니다.<br />암호화한 백업본은 최대 5주 뒤 삭제됩니다.<br />파기한 정보는 복구할 수 없습니다.
        </p>

        <h2>4. 제3자 제공</h2>
        <p>
          수집한 개인정보는 제3자에게 제공하거나 판매하지 않습니다.<br />대회 순위와 선수 기록은 대회 코드를 아는 사람이라면 누구나 열람할 수 있습니다.<br />몽실봇의 /대회 명령으로 대회를 디스코드 채널에 올리면 순위 이미지와 개최자의 디스코드 이름이 담긴 대회 정보 이미지가 그 채널에 게시되므로, 채널을 볼 수 있는 사람도 열람할 수 있습니다.<br />사이트에 표시되는 Escape from
          Tarkov 전적도 누구나 열람할 수 있습니다.
        </p>

        <h2>5. 처리 위탁과 국외 이전</h2>
        <div className="doc-table cards">
          <table>
            <thead>
              <tr>
                <th scope="col">수탁자</th>
                <th scope="col" className="whitespace-nowrap">국가</th>
                <th scope="col">업무와 항목</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="수탁자">
                  Sentry
                  <br />
                  <span className="whitespace-nowrap">compliance@sentry.io</span>
                </td>
                <td data-label="국가" className="whitespace-nowrap">미국</td>
                <td data-label="업무와 항목">서버 오류 기록.<br />서버 오류가 날 때 오류가 난 페이지 주소와 오류 내용이 전송됨.<br />접속 IP 주소, 쿠키, 요청 내용은 전송하지 않음.<br />보유 기간은 Sentry 보관 정책을 따름</td>
              </tr>
              <tr>
                <td data-label="수탁자">
                  Cloudflare
                  <br />
                  <span className="whitespace-nowrap">dpo@cloudflare.com</span>
                </td>
                <td data-label="국가" className="whitespace-nowrap">미국</td>
                <td data-label="업무와 항목">사이트 접속 중계, 방문 통계, 백업 보관.<br />접속할 때마다 접속 IP 주소, 요청 정보, 방문한 페이지 주소, 브라우저 종류가 전송됨.<br />Escape from Tarkov 기록의 암호화한 백업본이 매일 전송됨.<br />방문 통계는 쿠키를 사용하지 않음.<br />보유 기간은 Cloudflare 정책을 따르고, 백업본은 최대 5주 보관</td>
              </tr>
              <tr>
                <td data-label="수탁자">
                  Google LLC
                  <br />
                  <span className="whitespace-nowrap">googlekrsupport@google.com</span>
                </td>
                <td data-label="국가" className="whitespace-nowrap">미국</td>
                <td data-label="업무와 항목">Google 애널리틱스 방문 통계 분석.<br />페이지를 조작하거나 10초 넘게 머물 때 쿠키 식별자, 방문한 페이지 주소, 브라우저와 기기 정보, 접속 IP 주소가 전송됨.<br />보유 기간은 수집일로부터 14개월</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          디스코드로 로그인하면 미국 회사인 디스코드의 로그인 화면으로 이동하며, 몽실봇 디스코드 앱을 통해 로그인합니다.<br />위 국외 이전과 디스코드 로그인은 서비스 제공에
          필요한 처리 위탁이며, 개인정보 보호법 제28조의8 제1항 제3호에 따릅니다.<br />Cloudflare를 거치지 않고는 사이트에 접속할 수 없으며, Google 애널리틱스 수집만 거부하는 방법은 6번 항목에 있습니다.
        </p>

        <h2>6. 쿠키와 브라우저 저장소</h2>
        <ul>
          <li>__Host-er_session: 이터널 리턴 운영자 로그인 유지, 최대 7일</li>
          <li>__Host-er_state: 디스코드 로그인 중 위조 요청 방지, 10분</li>
          <li>_ga, _ga_JBT8KDS281: Google 애널리틱스 방문자 구분, 최대 2년</li>
          <li>브라우저 저장소: 화면 테마, 이 브라우저에서 연 대회 목록, 로그인 전에 입력한 새 대회 설정, 최근 본 Escape from Tarkov 계정 8개</li>
        </ul>
        <p>
          광고 쿠키는 사용하지 않고, 브라우저 저장소의 내용은 서버로 보내지 않습니다.<br />쿠키를 차단하면 운영자로 로그인할 수 없지만 대회 순위 확인과 계정 조회는 그대로 이용할 수
          있습니다.<br />Google 애널리틱스의 수집만 거부하려면{" "}
          <a href="https://tools.google.com/dlpage/gaoptout">Google 애널리틱스 차단 브라우저 부가기능</a>을 설치해주세요.<br />최근 본 계정은 계정 조회 화면의 기록 지우기 버튼으로 바로 삭제할 수 있습니다.
        </p>

        <h2>7. 안전 조치</h2>
        <ul>
          <li>운영자만 접근할 수 있는 서버에 저장</li>
          <li>로그인 세션 값은 해시로 저장하고, 디스코드 접속 토큰은 저장하지 않음</li>
          <li>HTTPS 접속만 허용, 백업본 암호화</li>
        </ul>

        <h2>8. 정보주체의 권리</h2>
        <p>
          정보주체는 언제든지 자신의 개인정보 열람, 정정, 삭제, 처리 정지를 요구할 수 있습니다.<br />로그인 정보는 로그아웃하면 바로 삭제되고, 대회는 개최자가 대회 삭제 버튼으로 바로 삭제할 수
          있습니다.<br />Escape from Tarkov 기록은 아래 이메일로 계정 번호나 닉네임을 보내면 게임 안에서 본인 계정임을 확인한 뒤 처리합니다.<br />그 밖의 요구도 아래 이메일로
          요청하면 본인 확인 후 지체 없이 처리합니다.<br />만 14세 미만 아동의 권리는 법정대리인이 행사할 수 있습니다.
        </p>

        <h2>9. 개인정보 보호책임자</h2>
        <p>
          몽실, Labs 운영자
          <br />
          <a href="mailto:mail@mongsil.dev">mail@mongsil.dev</a>
        </p>

        <h2>10. 권리 침해 상담</h2>
        <ul>
          <li>개인정보분쟁조정위원회: 1833-6972, www.kopico.go.kr</li>
          <li>개인정보침해신고센터: 118, privacy.kisa.or.kr</li>
          <li>대검찰청: 1301, www.spo.go.kr</li>
          <li>경찰청: 182, ecrm.police.go.kr</li>
        </ul>

        <h2>11. 변경</h2>
        <p>처리방침을 변경하면 이 페이지에 시행일과 함께 게시합니다.</p>
      </main>
      <SiteFooter />
    </>
  );
}
