/* eslint-disable @next/next/no-img-element */
// 타르코프 화면은 Tailwind를 쓰지 않아 site.css 클래스로 그림
const AV = "site-av";
const COLORS = ["#26f1f6", "#ffd621", "#7fe6ec", "#ff9f6b", "#a3e36b", "#c79bff"];

export default function Avatar({ name, src, size = 24 }: { name: string; src: string | null; size?: number }) {
  if (src) return <img className={AV} src={src} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span className={AV} aria-hidden="true" style={{ width: size, height: size, background: COLORS[h % COLORS.length], fontSize: size * 0.45 }}>
      {[...name][0] ?? "?"}
    </span>
  );
}
