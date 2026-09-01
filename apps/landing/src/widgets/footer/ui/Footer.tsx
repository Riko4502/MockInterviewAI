import { FooterBottom } from "./FooterBottom";
import { FooterBrand } from "./FooterBrand";
import { FooterNavLinks } from "./FooterNavLinks";

export function Footer() {
  return (
    <footer className="bg-[#050609]/70 backdrop-blur-2xl pt-16 pb-12 text-slate-400 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-16 border-b border-white/10">
          <FooterBrand />
          <FooterNavLinks />
        </div>
        <FooterBottom />
      </div>
    </footer>
  );
}
