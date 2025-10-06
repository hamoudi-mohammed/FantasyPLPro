import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageToggle() {
  const { i18n } = useTranslation();

  // Ensure dir and html lang reflect current language
  useEffect(() => {
    const applyDir = () => {
      const isAr = i18n.language?.startsWith('ar');
      document.documentElement.dir = isAr ? 'rtl' : 'ltr';
      document.documentElement.lang = isAr ? 'ar' : 'en';
    };
    applyDir();
    i18n.on('languageChanged', applyDir);
    return () => {
      i18n.off('languageChanged', applyDir);
    };
  }, [i18n]);

  const toggle = () => {
    const next = i18n.language?.startsWith('ar') ? 'en' : 'ar';
    i18n.changeLanguage(next);
    try { localStorage.setItem('i18nextLng', next); } catch {}
  };

  const isAr = i18n.language?.startsWith('ar');

  return (
    <button
      onClick={toggle}
      className="fixed top-3 right-3 z-50 px-3 py-1.5 rounded-full text-sm border bg-white/80 backdrop-blur hover:bg-white shadow"
      aria-label={isAr ? 'تبديل اللغة إلى الإنجليزية' : 'Switch language to Arabic'}
    >
      {isAr ? 'English' : 'العربية'}
    </button>
  );
}
