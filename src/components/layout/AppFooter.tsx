import { useTranslation } from 'react-i18next';
import { Facebook, Instagram, Github, Linkedin, Phone } from 'lucide-react';

export default function AppFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="w-full border-t bg-gradient-to-r from-[#3a013e] via-[#5b2b83] to-[#00e7a0] rounded-tl-[56px] md:rounded-tl-[72px] overflow-hidden">
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 items-start">
          {/* Left: Large Premier League logo only (white, centered in column) */}
          <div className="text-white/90 flex items-center justify-center">
            <a
              href="#top"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              aria-label="Scroll to top"
              className="inline-block transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              <img
                src="/premier-league-logo.png"
                alt={t('footer.brand')}
                className="h-20 md:h-24 w-auto opacity-95 filter grayscale brightness-0 invert"
              />
            </a>
          </div>

          {/* Contact + Socials stacked (contact above icons) */}
          <div className="text-white/90">
            <div className="text-base font-semibold mb-2">{t('footer.contact')}</div>
            <div className="flex items-center gap-2 text-white/85">
              <Phone className="h-4 w-4" />
              <a href="tel:+212617233671" className="hover:text-white transition-colors">+212 617233671</a>
            </div>
            <div className="mt-5 text-base font-semibold mb-2">{t('footer.stay_in_touch')}</div>
            <div className="flex items-center gap-3">
              <a href="https://www.facebook.com/profile.php?id=100009893058577" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors shadow-sm">
                <Facebook className="h-4 w-4 text-white" />
              </a>
              <a href="https://www.instagram.com/hamoudi_mohammed2/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors shadow-sm">
                <Instagram className="h-4 w-4 text-white" />
              </a>
              <a href="https://github.com/hamoudi-mohammed" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors shadow-sm">
                <Github className="h-4 w-4 text-white" />
              </a>
              <a href="https://www.linkedin.com/in/mohammed-hamoudi-1b3795388/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors shadow-sm">
                <Linkedin className="h-4 w-4 text-white" />
              </a>
            </div>
          </div>

          {/* Right: Site name and short note (aligned to right) */}
          <div className="text-white/90 text-right">
            <div className="text-lg font-semibold tracking-tight">{t('footer.brand')}</div>
            <p className="mt-3 text-sm/6 text-white/80 max-w-md ml-auto">
              Fantasy Premier League companion. Track points, rankings, and chat with your group.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-white/20 pt-3 text-center text-xs text-white/80">
          © {year} {t('footer.copyright')}. {t('footer.all_rights_reserved')} — <span className="font-semibold text-white">Mohammed Hamoudi</span>
        </div>
      </div>
    </footer>
  );
}
