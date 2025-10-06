import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { API_BASE } from "@/lib/api";
import { Settings, Loader2 } from "lucide-react";

// قائمة الفرق كما طلبت + شعارات بجانب الاسم
type TeamDef = { name: string; slug: string; logo: string; cdn?: string; cdnPng?: string };
const TEAMS: TeamDef[] = [
  { name: 'Arsenal', slug: 'arsenal', logo: '/logos/arsenal.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg' },
  { name: 'Aston Villa', slug: 'aston-villa', logo: '/logos/aston-villa.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/f/f9/Aston_Villa_FC_crest.svg', cdnPng: 'https://1000logos.net/wp-content/uploads/2022/05/Aston-Villa-Logo.jpg' },
  { name: 'AFC Bournemouth', slug: 'afc-bournemouth', logo: '/logos/afc-bournemouth.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/e/e5/AFC_Bournemouth_%282013%29.svg' },
  { name: 'Brentford', slug: 'brentford', logo: '/logos/brentford.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/2/2a/Brentford_FC_crest.svg' },
  { name: 'Brighton & Hove Albion', slug: 'brighton-hove-albion', logo: '/logos/brighton-hove-albion.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/f/fd/Brighton_%26_Hove_Albion_logo.svg' },
  { name: 'Burnley', slug: 'burnley', logo: '/logos/burnley.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/6/6d/Burnley_FC_Logo.svg' },
  { name: 'Chelsea', slug: 'chelsea', logo: '/logos/chelsea.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg' },
  { name: 'Crystal Palace', slug: 'crystal-palace', logo: '/logos/crystal-palace.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Crystal_Palace_FC_logo.svg', cdnPng: 'https://1000logos.net/wp-content/uploads/2023/04/Crystal-Palace-logo.png' },
  { name: 'Everton', slug: 'everton', logo: '/logos/everton.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/7/7c/Everton_FC_logo.svg' },
  { name: 'Fulham', slug: 'fulham', logo: '/logos/fulham.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/3/3e/Fulham_FC_%28shield%29.svg', cdnPng: 'https://cdn.freebiesupply.com/logos/large/2x/fulham-fc-1-logo-png-transparent.png' },
  // Provided logos priority — add CDN fallbacks for these five
  { name: 'Leeds United', slug: 'leeds-united', logo: '/logos/leeds-united.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/2/2a/Leeds_United_F.C._logo.svg', cdnPng: 'https://cdn.freebiesupply.com/logos/large/2x/leeds-united-afc-3-logo-png-transparent.png' },
  { name: 'Liverpool', slug: 'liverpool', logo: '/logos/liverpool.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg' },
  { name: 'Manchester City', slug: 'manchester-city', logo: '/logos/manchester-city.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg' },
  { name: 'Manchester United', slug: 'manchester-united', logo: '/logos/manchester-united.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg' },
  { name: 'Newcastle United', slug: 'newcastle-united', logo: '/logos/newcastle-united.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/5/56/Newcastle_United_Logo.svg', cdnPng: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Newcastle_United_Logo.svg/120px-Newcastle_United_Logo.svg.png' },
  { name: 'Nottingham Forest', slug: 'nottingham-forest', logo: '/logos/nottingham-forest.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/7/79/Nottingham_Forest_F.C._logo.svg', cdnPng: 'https://images.seeklogo.com/logo-png/49/2/nottingham-forest-logo-png_seeklogo-498968.png' },
  { name: 'Sunderland', slug: 'sunderland', logo: '/logos/sunderland.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/7/77/Sunderland_A.F.C._crest.svg', cdnPng: 'https://cdn.freebiesupply.com/logos/thumbs/2x/sunderland-afc-logo.png' },
  { name: 'Tottenham Hotspur', slug: 'tottenham-hotspur', logo: '/logos/tottenham-hotspur.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg', cdnPng: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Tottenham_Hotspur.svg/120px-Tottenham_Hotspur.svg.png' },
  { name: 'West Ham United', slug: 'west-ham-united', logo: '/logos/west-ham-united.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg', cdnPng: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/c2/West_Ham_United_FC_logo.svg/120px-West_Ham_United_FC_logo.svg.png' },
  { name: 'Wolverhampton Wanderers', slug: 'wolverhampton-wanderers', logo: '/logos/wolverhampton-wanderers.png', cdn: 'https://upload.wikimedia.org/wikipedia/en/f/fc/Wolverhampton_Wanderers.svg', cdnPng: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/fc/Wolverhampton_Wanderers.svg/120px-Wolverhampton_Wanderers.svg.png' },
];

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();
  // ميزة رفع الصور أُزيلت بناءً على طلبك

  const [email, setEmail] = useState<string>("");
  const [originalEmail, setOriginalEmail] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const displayName = useMemo(() => `${firstName} ${lastName}`.trim(), [firstName, lastName]);

  // لم نعد نخزن رابط صورة؛ سنعرض الحرف الأول فقط

  const [winnerTeam, setWinnerTeam] = useState<string | null>(null);
  const [winnerLocked, setWinnerLocked] = useState(false);
  const [teamName, setTeamName] = useState<string>("");
  const [groupName, setGroupName] = useState<string>("");
  const [groupId, setGroupId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [savingWinner, setSavingWinner] = useState<boolean>(false);
  // Avatar upload feature removed; we only render initials

  // تاريخ النقاط (مصدر عام)
  const [scoreHistory, setScoreHistory] = useState<Array<{ id: number; group_id: number; round_number: number; round_points: number; total_points: number; created_at: string; group_name?: string }>>([]);
  // تاريخ الجولات المفصل كما في واجهة الترتيب (إن توفر groupId + myUserId)
  const [detailedRounds, setDetailedRounds] = useState<Array<{ round: number; round_points: number; total_points: number; expensive_player_name?: string | null; expensive_player_points?: number | null; created_at: string }>>([]);
  // ترتيب المجموعة الحالي
  const [groupRankings, setGroupRankings] = useState<Array<{ user_id: number; username?: string; total_points: number; latest_round_points?: number }>>([]);
  const [myUserId, setMyUserId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      // احصل على البريد من localStorage ثم فضّل بريد التوكين إن وُجد
      let userEmail = localStorage.getItem('app_user_email') || '';
      try {
        const token = localStorage.getItem('app_token');
        if (token) {
          const res = await fetch(API_BASE + '/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const js = await res.json();
            const tokenEmail = js?.user?.email || '';
            if (js?.user?.id) setMyUserId(js.user.id);
            if (tokenEmail) {
              userEmail = tokenEmail; // فضّل بريد الجلسة
              try { localStorage.setItem('app_user_email', tokenEmail); } catch {}
            }
          }
        }
      } catch {}
      if (!userEmail) return;
      setEmail(userEmail);
      setOriginalEmail(userEmail);
      // جلب الملف الشخصي
      const profRes = await fetch(`${API_BASE}/api/profile?email=${encodeURIComponent(userEmail)}`);
      const profJson = profRes.ok ? await profRes.json() : null;
      const uname = profJson?.user?.username || "";
      if (!myUserId && profJson?.user?.id) setMyUserId(profJson.user.id);
      const [fn, ...rest] = uname.split(" ");
      setFirstName(fn || "");
      setLastName(rest.join(" ") || "");
      setTeamName("");
      // أزلنا الصور؛ لا حاجة لقراءة avatar_url

      // جلب بيانات MySQL (username/chosen_team) لملء الحقول إن وُجدت
      try {
        const resp = await fetch(`${API_BASE}/api/profile?email=${encodeURIComponent(userEmail)}`);
        if (resp.ok) {
          const js = await resp.json();
          if (js?.user) {
            const name = String(js.user.username || '').trim();
            if (name) {
              const [f, ...r] = name.split(' ');
              setFirstName(f || '');
              setLastName(r.join(' ') || '');
            }
            setTeamName(js.user.chosen_team || '');
            // إذا كان الفريق محفوظاً في الملف الشخصي، اقفل الاختيار مباشرة
            if (js.user.chosen_team) {
              setWinnerTeam(js.user.chosen_team);
              setWinnerLocked(true);
            }
          }
        }
      } catch {}

      // تحقق من وجود تصويت سابق
      try {
        const vRes = await fetch(`${API_BASE}/api/votes/league-winner?email=${encodeURIComponent(userEmail)}`);
        if (vRes.ok) {
          const js = await vRes.json();
          if (js?.vote?.team_name) {
            setWinnerTeam(js.vote.team_name);
            setWinnerLocked(true);
          }
        }
      } catch {}

      // تم إزالة ميزة رفع/عرض صورة الملف من الخادم
    };
    load();
  }, []);

  // جلب آخر مجموعة بعد توفر البريد
  useEffect(() => {
    const run = async () => {
      if (!email) return;
      try {
        const resp = await fetch(`${API_BASE}/api/profile/groups/latest?email=${encodeURIComponent(email)}`);
        if (resp.ok) {
          const js = await resp.json();
          setGroupName(js?.group?.name || '');
          setGroupId(js?.group?.group_id ?? null);
        } else { setGroupName(''); setGroupId(null); }
      } catch { setGroupName(''); setGroupId(null); }
    };
    run();
  }, [email]);

  // جلب سجل النقاط العام + ترتيب المجموعة + الجولات المفصلة عندما تتوفر المعطيات
  useEffect(() => {
    const run = async () => {
      if (!email) return;
      // سجل النقاط (كل المجموعات)
      try {
        const sRes = await fetch(`${API_BASE}/api/user/scores?email=${encodeURIComponent(email)}`);
        if (sRes.ok) {
          const js = await sRes.json();
          setScoreHistory(Array.isArray(js?.scores) ? js.scores : []);
        } else {
          setScoreHistory([]);
        }
      } catch { setScoreHistory([]); }

      // ترتيب المجموعة
      try {
        if (groupId) {
          const token = localStorage.getItem('app_token');
          const rRes = await fetch(`${API_BASE}/api/groups/${groupId}/rankings`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (rRes.ok) {
            const js = await rRes.json();
            let arr = Array.isArray(js?.rankings) ? js.rankings : [];
            if (myUserId) arr = arr.filter((u: any) => u.user_id !== myUserId);
            setGroupRankings(arr);
          } else {
            setGroupRankings([]);
          }
        } else {
          setGroupRankings([]);
        }
      } catch { setGroupRankings([]); }

      // الجولات المفصلة مثل الترتيب
      try {
        if (groupId && myUserId) {
          const token = localStorage.getItem('app_token');
          const dRes = await fetch(`${API_BASE}/api/groups/${groupId}/rankings/${myUserId}/rounds`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (dRes.ok) {
            const js = await dRes.json();
            setDetailedRounds(Array.isArray(js?.rounds) ? js.rounds : []);
          } else {
            setDetailedRounds([]);
          }
        } else {
          setDetailedRounds([]);
        }
      } catch { setDetailedRounds([]); }
    };
    run();
  }, [email, groupId, myUserId]);

  // لا توجد عمليات حذف/رفع للصور بعد الآن

  const handleSaveProfile = async () => {
    try {
      if (!email) throw new Error("لا يوجد بريد مستخدم");
      // حفظ في MySQL: username + chosen_team
      try {
        const resp = await fetch(`${API_BASE}/api/profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // لا نغير الفريق من هنا. دعم تغيير البريد عبر new_email
          body: JSON.stringify({
            email: originalEmail,
            username: displayName || email,
            // إن كان لدينا فريق مختار، خزّنه أيضاً في حقل chosen_team
            ...(winnerTeam || teamName ? { chosen_team: winnerTeam || teamName } : {}),
            ...(email && email !== originalEmail ? { new_email: email } : {})
          })
        });
        if (!resp.ok) throw new Error('فشل حفظ الملف');
      } catch {}
      toast.success("تم حفظ الملف الشخصي");
      // إذا تم تغيير البريد نجدد الأصل ونحدّث التخزين المحلي
      if (email && email !== originalEmail) {
        setOriginalEmail(email);
        try { localStorage.setItem('app_user_email', email); } catch {}
      }
      setIsEditing(false);
    } catch (e: any) {
      toast.error(e.message || "فشل حفظ الملف الشخصي");
    }
  };

  // لا توجد دالة رفع صور بعد الآن

  const handleChooseWinner = async (selectedTeam?: string) => {
    const team = selectedTeam ?? winnerTeam;
    if (!team) return;
    if (!email) { toast.error('لا يوجد بريد مستخدم'); return; }
    if (savingWinner) return; // avoid duplicate requests
    // Optimistic UI: lock immediately so it feels instant
    const prevLocked = winnerLocked;
    const prevTeamName = teamName;
    setWinnerLocked(true);
    setTeamName(team);
    setSavingWinner(true);
    try {
      const resp = await fetch(`${API_BASE}/api/votes/league-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, team_name: team })
      });
      if (resp.ok || resp.status === 409) {
        // Persist also to profile
        try {
          await fetch(`${API_BASE}/api/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, chosen_team: team })
          });
        } catch {}
        toast.success(resp.status === 409 ? 'تم تسجيل اختيارك مسبقًا' : 'تم حفظ اختيارك لبطَل الدوري 2026');
      } else {
        const js = await resp.json().catch(() => ({}));
        throw new Error(js?.error || 'فشل حفظ الاختيار');
      }
    } catch (e: any) {
      // Rollback optimistic state on failure
      setWinnerLocked(prevLocked);
      setTeamName(prevTeamName);
      toast.error(e.message || 'فشل حفظ الاختيار');
    } finally {
      setSavingWinner(false);
    }
  };
  // تم حذف دوال رفع الصور بالكامل بناءً على طلبك

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 bg-gradient-to-b from-[#f9f5ff] via-white to-[#f0fdf4]">
      {/* Section: Personal Information */}
      <Card className="rounded-2xl border border-[#ead8ff] bg-white shadow-md shadow-[#3a013e0d]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[#3a013e]">{t('profile.personal_info')}</CardTitle>
          <button
            aria-label={t('profile.settings_aria')}
            title={t('profile.settings_title')}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-[#ead8ff] bg-white text-[#3a013e] hover:bg-[#f7ecff]"
            onClick={() => setIsEditing(v => !v)}
          >
            <Settings className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* تمت إزالة دائرة الصورة بناءً على طلبك */}

          {/* الاسم الكامل */}
          <div className="grid gap-1">
            <Label>{t('profile.full_name')}</Label>
            {isEditing ? (
              <Input
                value={displayName}
                onChange={(e) => {
                  const val = e.target.value;
                  const parts = val.trim().split(/\s+/);
                  setFirstName(parts[0] || '');
                  setLastName(parts.slice(1).join(' ') || '');
                }}
                placeholder={t('profile.full_name_placeholder')}
                className="h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-[#3a013e]"
              />
            ) : (
              <div className="h-11 flex items-center rounded-xl bg-muted/30 px-3 text-sm">{displayName || '—'}</div>
            )}
          </div>

          {/* البريد الإلكتروني */}
          <div className="grid gap-1">
            <Label>{t('profile.email')}</Label>
            {isEditing ? (
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('profile.email_placeholder')}
                className="h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-[#3a013e]"
              />
            ) : (
              <div className="h-11 flex items-center rounded-xl bg-muted/60 px-3 text-sm">{email || '—'}</div>
            )}
          </div>

          {/* اسم الفريق (غير قابل للتعديل هنا) */}
          <div className="grid gap-1">
            <Label>{t('profile.team')}</Label>
            <div className="h-11 flex items-center rounded-xl bg-muted/30 px-3 text-sm">
              {teamName || '—'}
            </div>
            <div className="text-[11px] text-muted-foreground">{t('profile.cannot_edit_team')}</div>
          </div>

          {/* اسم المجموعة */}
          <div className="grid gap-1">
            <Label>{t('profile.group_joined')}</Label>
            <div className="h-11 flex items-center rounded-xl bg-muted/30 px-3 text-sm">{groupName || t('profile.no_group')}</div>
          </div>

          {isEditing && (
            <div className="pt-1">
              <Button onClick={handleSaveProfile} className="h-11 rounded-full bg-[#3a013e] hover:bg-[#54015b] text-white w-full shadow">
                {t('save')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section: Team Selection */}
      <Card className="mt-5 rounded-2xl border border-[#ead8ff] bg-white shadow-md shadow-[#3a013e0d]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#3a013e]">{t('rankings')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('choose_winner')}</p>
        </CardHeader>
        <CardContent>
          {winnerLocked ? (
            <div className="rounded-xl border bg-card/50 p-3 text-sm">
              {t('profile.team_chosen_prefix')} <span className="font-semibold">{winnerTeam}</span>
              <div className="text-xs text-muted-foreground mt-1">{t('profile.cannot_change_selection')}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Select
                value={winnerTeam ?? undefined}
                onValueChange={(val) => { setWinnerTeam(val); void handleChooseWinner(val); }}
              >
                <SelectTrigger className="w-full h-11 rounded-xl focus:ring-2 focus:ring-[#00e7a0]">
                  <SelectValue placeholder={t('profile.select_team_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map(team => (
                    <SelectItem key={team.slug} value={team.name}>
                      <div className="flex items-center gap-2">
                        {/* شعار الفريق */}
                        {/* ستحتاج لوضع الصور في المجلد public/logos/ بأسماء الملفات المحددة أعلاه */}
                        <div className="h-7 w-7 shrink-0 rounded-sm bg-white overflow-hidden flex items-center justify-center">
                          <img
                            src={team.logo}
                            alt={team.name}
                            className={`${team.slug==='sunderland' ? 'scale-[1.45]' : (['aston-villa','crystal-palace','nottingham-forest'].includes(team.slug) ? 'scale-[1.6]' : 'scale-100')} max-h-full max-w-full object-contain`}
                            onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            // Try CDN once if available
                            const triedCdn = img.getAttribute('data-tried-cdn') === '1';
                            const triedCdnPng = img.getAttribute('data-tried-cdn-png') === '1';
                            if (!triedCdn && team.cdn) {
                              img.setAttribute('data-tried-cdn', '1');
                              img.src = team.cdn;
                              return;
                            }
                            if (!triedCdnPng && team.cdnPng) {
                              img.setAttribute('data-tried-cdn-png', '1');
                              img.src = team.cdnPng;
                              return;
                            }
                            // Fallback to PL logo
                            img.onerror = null;
                            img.src = '/premier-league-logo.png';
                            }}
                          />
                        </div>
                        <span>{team.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{t('profile.no_change_after_save')}</div>
                <Button onClick={() => handleChooseWinner()} disabled={!winnerTeam || savingWinner} className="h-10 rounded-full bg-[#00e7a0] hover:bg-[#05c28a] text-black px-5">
                  {savingWinner && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('save')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section: Rounds History (moved from ScoreEntry per request) */}
      <Card className="mt-5 rounded-2xl border border-[#ead8ff] bg-white shadow-md shadow-[#3a013e0d]">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[#3a013e]">{t('profile.rounds_history')}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                // اجلب دائمًا كل الجولات لكل المجموعات
                if (email) {
                  const sRes = await fetch(`${API_BASE}/api/user/scores?email=${encodeURIComponent(email)}`);
                  if (sRes.ok) {
                    const js = await sRes.json();
                    setScoreHistory(Array.isArray(js?.scores) ? js.scores : []);
                  }
                }
                // واجلب التفصيلي للمجموعة الحالية إن وُجدت لعرض معلومات إضافية
                if (groupId && myUserId) {
                  const token = localStorage.getItem('app_token');
                  const dRes = await fetch(`${API_BASE}/api/groups/${groupId}/rankings/${myUserId}/rounds`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                  });
                  if (dRes.ok) {
                    const js = await dRes.json();
                    setDetailedRounds(Array.isArray(js?.rounds) ? js.rounds : []);
                  }
                }
              } catch {}
            }}
          >
            {t('profile.update')}
          </Button>
        </CardHeader>
        <CardContent>
          {(detailedRounds.length === 0 && scoreHistory.length === 0) ? (
            <div className="text-sm text-muted-foreground">{t('profile.no_rounds')}</div>
          ) : (
            <div className="space-y-2">
              {(detailedRounds.length > 0 ? [...detailedRounds]
                .sort((a, b) => (Number(b.round) || 0) - (Number(a.round) || 0))
                .map((r, idx) => (
                  <div key={`${r.round}-${r.created_at}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="text-sm">{t('profile.round_label')} {r.round}</div>
                    <div className="text-xs text-muted-foreground">{t('profile.round_points')}: <span className="font-medium">{r.round_points}</span></div>
                    <div className="text-xs text-muted-foreground">{t('profile.total')}: <span className="font-medium">{r.total_points}</span></div>
                    {r.expensive_player_name && (
                      <div className="text-xs text-muted-foreground">{t('profile.expensive_player')}: <span className="font-medium">{r.expensive_player_name}</span> (<span className="font-medium">{r.expensive_player_points ?? 0}</span>)</div>
                    )}
                  </div>
                )) : [...scoreHistory]
                .sort((a, b) => (Number(b.round_number) || 0) - (Number(a.round_number) || 0))
                .map((r) => (
                  <div key={`${r.id}-${r.round_number}-${r.created_at}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="text-sm">{t('profile.round_label')} {r.round_number}</div>
                    <div className="text-xs text-muted-foreground">{t('profile.round_points')}: <span className="font-medium">{r.round_points}</span></div>
                    <div className="text-xs text-muted-foreground">{t('profile.total')}: <span className="font-medium">{r.total_points}</span></div>
                    {r.group_name && (<div className="text-xs text-muted-foreground">{t('profile.group_label')}: <span className="font-medium">{r.group_name}</span></div>)}
                  </div>
                )))}
              <div className="text-[11px] text-muted-foreground text-right">{t('profile.total_rounds_count')}: {detailedRounds.length || scoreHistory.length}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logout */}
      <div className="mt-6">
        <Button variant="destructive" onClick={signOut} className="w-full h-11 rounded-xl bg-[#ffe8f1] text-[#a10c39] hover:bg-[#ffd9e7] border border-[#ffd9e7]">
          {t('logout')}
        </Button>
      </div>
    </div>
  );
}
