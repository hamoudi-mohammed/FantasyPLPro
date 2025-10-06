import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Supabase removed: using MySQL REST + JWT only
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '@/lib/api';

// schema will be created inside component to localize messages

const Auth = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language === 'ar' ? 'العربية' : 'English';
  const handleLangChange = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  };
  // Keep <html> lang/dir in sync on this page
  useEffect(() => {
    const lang = i18n.language?.startsWith('ar') ? 'ar' : 'en';
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }, [i18n.language]);
  // Localized validation schema
  const authSchema = z.object({
    email: z.string().email({ message: t('auth_messages.email_invalid') }),
    password: z.string().min(6, { message: t('auth_messages.password_min') }),
    firstName: z.string().min(2, { message: t('auth_messages.first_name_min') }).optional(),
    lastName: z.string().min(2, { message: t('auth_messages.last_name_min') }).optional(),
  });
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    // If token exists, redirect in
    const token = localStorage.getItem('app_token');
    if (token) navigate('/');
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validationData = isLogin 
        ? { email, password }
        : { email, password, firstName, lastName };
      
      authSchema.parse(validationData);

      const waitForSession = async () => true; // no-op with JWT

      const ensureProfile = async () => { return; };

      if (isLogin) {
        // سياسة الدخول: ممنوع الدخول إن لم يكن المستخدم موجودًا في قاعدة MySQL
        const dbRes = await fetch(`${API_BASE}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'login', email, password }),
        });
        if (!dbRes.ok) {
          const data = await dbRes.json().catch(() => ({}));
          if (data?.error === 'not_found') {
            toast.error(t('auth_messages.account_not_found'));
          } else if (data?.error === 'bad_password') {
            toast.error(t('auth_messages.bad_password'));
          } else {
            toast.error(t('auth_messages.verify_failed'));
          }
          return;
        }
        // نجاح MySQL: خزّن التوكن وهوية المستخدم
        const data = await dbRes.json().catch(() => ({} as Record<string, unknown>));
        if (data?.token) localStorage.setItem('app_token', data.token);
        // 2) خزّن معرف المستخدم من رد MySQL
        try {
          const u = (data as { user?: { id?: number } })?.user;
          const mysqlUserId = u?.id;
          if (mysqlUserId) {
            localStorage.setItem('app_user_id', String(mysqlUserId));
            localStorage.setItem('app_user_email', email);
          }
        } catch (_e) { /* ignore */ }
        toast.success(t('auth_messages.login_success'));
        navigate('/');
        return;
      } else {
        // تسجيل مستخدم جديد في MySQL
        const res = await fetch(`${API_BASE}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'register', email, password, username: `${firstName} ${lastName}`.trim() }),
        });
        if (!res.ok) {
          const dataRes = await res.json().catch(() => ({}));
          if (dataRes?.error !== 'email_in_use') {
            toast.error(dataRes?.error || t('auth_messages.db_error'));
            return;
          }
        }
        // إذا أرجع التسجيل توكن مباشرة، خزّنه وادخل
        try {
          const dataReg = await res.json().catch(() => ({} as Record<string, unknown>));
          if (dataReg?.token) {
            localStorage.setItem('app_token', (dataReg as { token: string }).token);
            const mysqlUserIdReg = (dataReg as { user?: { id?: number } })?.user?.id;
            if (mysqlUserIdReg) {
              localStorage.setItem('app_user_id', String(mysqlUserIdReg));
              localStorage.setItem('app_user_email', email);
            }
            toast.success(t('auth_messages.signup_success'));
            navigate('/');
            return;
          }
        } catch (_e) { /* ignore */ }
        // تسجيل الدخول للحصول على JWT
        const resLogin = await fetch(`${API_BASE}/api/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'login', email, password }),
        });
        if (!resLogin.ok) {
          toast.error(t('auth_messages.signup_prompt'));
          return;
        }
        const dataLogin = await resLogin.json().catch(() => ({} as Record<string, unknown>));
        if ((dataLogin as { token?: string }).token) localStorage.setItem('app_token', (dataLogin as { token: string }).token);
        const mysqlUserId = (dataLogin as { user?: { id?: number } })?.user?.id;
        if (mysqlUserId) {
          localStorage.setItem('app_user_id', String(mysqlUserId));
          localStorage.setItem('app_user_email', email);
        }
        toast.success(t('auth_messages.signup_success'));
        navigate('/');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0]?.message ?? '');
      } else {
        const msg = error instanceof Error ? error.message : String(error ?? '');
        toast.error(msg || t('auth_messages.unknown_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ background: '#fafafa' }}>
      <div className="absolute top-3 right-3">
        <button
          onClick={handleLangChange}
          className="flex cursor-pointer items-center border-none bg-white/80 backdrop-blur px-2 py-1 rounded-full text-[13px] font-medium text-foreground shadow hover:bg-white"
          title={currentLang}
        >
          <span className="mr-1 text-base">🌐</span>
          {currentLang}
          <span className="ml-0.5 text-xs">▼</span>
        </button>
      </div>
      <Card className="w-full max-w-3xl border shadow-md bg-white rounded-2xl overflow-hidden min-h-[560px]">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-2 items-stretch md:items-center">
            {/* Logo side */}
            <div
              className={
                `h-full md:min-h-[560px] flex items-center justify-center p-6 bg-[#3a013e] overflow-hidden` +
                ` ${isLogin ? 'md:order-2 md:rounded-r-2xl rounded-b-2xl' : 'md:order-1 md:rounded-l-2xl rounded-t-2xl'}`
              }
            >
              <div className={`transition-transform duration-500 ease-out ${isLogin ? 'translate-x-6' : '-translate-x-6'}`}>
                <img
                  src="/premier-league-logo.png"
                  alt="Premier League"
                  className="max-h-48 md:max-h-64 w-auto opacity-95 filter grayscale brightness-0 invert"
                />
              </div>
            </div>

            {/* Form + toggle grouped to move together */}
            <div
              className={
                `h-full md:min-h-[560px] flex flex-col items-center justify-center px-8 md:px-12 py-8 overflow-hidden` +
                ` ${isLogin ? 'md:order-1' : 'md:order-2'}`
              }
            >
            <form onSubmit={handleSubmit} className={`w-full space-y-5 max-w-sm mx-auto transition-transform duration-500 ease-out ${isLogin ? '-translate-x-4' : 'translate-x-4'}`}>
              <div className="text-center mb-2">
                <h3 className="text-2xl font-semibold text-gray-900">
                  {isLogin ? t('auth.login_title') : t('auth.signup_title')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isLogin ? t('auth.login_subtitle') : t('auth.signup_subtitle')}
                </p>
              </div>
            {!isLogin && (
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Input
                    id="firstName"
                    type="text"
                    placeholder={t('auth.first_name_placeholder')}
                    className="w-full rounded-full h-11"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required={!isLogin}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    id="lastName"
                    type="text"
                    placeholder={t('auth.last_name_placeholder')}
                    className="w-full rounded-full h-11"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required={!isLogin}
                    disabled={loading}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Input
                id="email"
                type="email"
                placeholder={t('auth.email_placeholder')}
                className="w-full rounded-full h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Input
                id="password"
                type="password"
                placeholder={t('auth.password_placeholder')}
                className="w-full rounded-full h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              className="w-full rounded-full h-11 bg-[#3a013e] text-white border border-transparent hover:bg-white hover:text-black hover:border-neutral-300"
              disabled={loading}
              variant="default"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? t('auth.login_button') : t('auth.signup_button')}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-semibold rounded-full px-4 py-2 m-0 cursor-pointer focus:outline-none transition-colors bg-white text-neutral-800 hover:bg-neutral-50 border border-neutral-300"
            >
              {isLogin ? t('auth.no_account_cta') : t('auth.have_account_cta')}
            </button>
          </div>
          </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
