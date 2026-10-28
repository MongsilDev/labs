import SiteHeader from "@/components/SiteHeader";

export default function Header({ crumb }: { crumb?: { href: string; label: string } }) {
  return <SiteHeader crumb={crumb} />;
}
