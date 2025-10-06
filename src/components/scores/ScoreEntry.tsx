import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getLatestScore, saveScore, getUserRounds } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface ScoreEntryProps {
  groupId: number;
}

const ScoreEntry = ({ groupId }: ScoreEntryProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [roundNumber, setRoundNumber] = useState('1');
  // Base points user enters
  const [basePoints, setBasePoints] = useState('');
  // Derived/computed points preview
  const [prevTotal, setPrevTotal] = useState(0);
  const [matchStatus, setMatchStatus] = useState<string>('');
  const [opponentMoreThan4, setOpponentMoreThan4] = useState(false);
  const [valueGt12M, setValueGt12M] = useState(false);
  // Legacy fields kept for insert compatibility (not exposed in UI now)
  const [expensivePlayerName, setExpensivePlayerName] = useState('');
  const [expensivePlayerPoints, setExpensivePlayerPoints] = useState('');
  const [teamWonLeague, setTeamWonLeague] = useState<boolean | null>(null);

  const [username, setUsername] = useState<string>('');
  const { user } = useAuth();
  const [myRounds, setMyRounds] = useState<Array<{ round: number; round_points: number; total_points: number; created_at: string }>>([]);

  const statusBonus = useMemo(() => {
    if (matchStatus === 'win') return 10;
    if (matchStatus === 'draw') return -5;
    if (matchStatus === 'loss') return -10;
    return 0;
  }, [matchStatus]);

  const opponentPenalty = opponentMoreThan4 ? -5 : 0;
  const valueBonus = valueGt12M ? 0 : 0; // Placeholder per provided design (no points shown)

  const parsedBase = Number(basePoints || 0);
  const leagueBonus = roundNumber === '38' && teamWonLeague ? 50 : 0;
  const computedRoundPoints = parsedBase + statusBonus + opponentPenalty + valueBonus + leagueBonus;
  const computedTotal = prevTotal + computedRoundPoints;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await saveScore(groupId, {
        round_number: parseInt(roundNumber),
        round_points: computedRoundPoints,
        total_points: computedTotal,
        expensive_player_name: expensivePlayerName || null,
        expensive_player_points: expensivePlayerPoints ? parseInt(expensivePlayerPoints) : null,
      });
      toast.success(t('scores.save_success'));
      resetForm();
      // refresh latest total and my rounds after save
      try {
        const { latest } = await getLatestScore(groupId);
        if (latest?.total_points) setPrevTotal(latest.total_points);
        if (latest?.round_number) setRoundNumber(String(Math.min(38, Number(latest.round_number) + 1)));
      } catch {}
      await loadMyRounds();
    } catch (error: any) {
      toast.error(error.message || t('scores.save_failed'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setBasePoints('');
    setExpensivePlayerName('');
    setExpensivePlayerPoints('');
    setOpponentMoreThan4(false);
    setValueGt12M(false);
    setMatchStatus('');
    setTeamWonLeague(null);
  };

  useEffect(() => {
    const bootstrap = async () => {
      // username from auth
      if (user?.username) setUsername(user.username);
      // last total for this group
      const { latest } = await getLatestScore(groupId);
      if (latest?.total_points) setPrevTotal(latest.total_points);
      if (latest?.round_number) setRoundNumber(String(Math.min(38, Number(latest.round_number) + 1)));
      await loadMyRounds();
    };
    bootstrap();
  }, [groupId, user?.id]);

  // أخفِ خيار "أكثر من 4 لاعبين" تلقائياً للجولات غير الأولى وأعد ضبطه
  useEffect(() => {
    if (roundNumber !== '1' && opponentMoreThan4) {
      setOpponentMoreThan4(false);
    }
  }, [roundNumber]);

  // Load only my rounds in this group
  const loadMyRounds = async () => {
    try {
      if (!user?.id) { setMyRounds([]); return; }
      const res = await getUserRounds(groupId, Number(user.id));
      setMyRounds(Array.isArray(res.rounds) ? res.rounds : []);
    } catch (e: any) {
      setMyRounds([]);
      try {
        const msg = e?.message || t('scores.rounds_load_failed');
        toast.error(msg);
      } catch {}
    }
  };

  return (
    <>
    <Card className="rounded-2xl shadow-soft border border-white/20 bg-gradient-to-br from-white to-white/90 dark:from-neutral-900 dark:to-neutral-900/90">
      <CardHeader className="pb-2 text-center">
        <CardTitle className="flex flex-col items-center gap-1 text-lg font-semibold">
          {t('scores.entry_title')}
          <span className="text-xs text-muted-foreground">{t('scores.current_round')} {roundNumber}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-5">
        <div className="rounded-xl border bg-card/50 p-3">
          <div className="text-sm font-medium">{username}</div>
          <div className="text-xs text-muted-foreground">{t('scores.your_total')}: {prevTotal}</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="round">{t('scores.round_label')}</Label>
              <Select value={roundNumber} onValueChange={setRoundNumber}>
                <SelectTrigger className="h-11 rounded-full">
                  <SelectValue placeholder={t('scores.select_round')} />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 38 }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {t('scores.round_label')} {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="basePoints">{t('scores.your_points_this_round')}</Label>
              <Input
                id="basePoints"
                type="number"
                value={basePoints}
                onChange={(e) => setBasePoints(e.target.value)}
                required
                className="h-11 rounded-full"
                placeholder={t('scores.your_points_this_round')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{t('scores.match_status')}</Label>
              <div className="grid grid-cols-3 gap-3">
                <button type="button" onClick={() => setMatchStatus('win')} className={`rounded-xl border px-3 py-3 text-sm transition ${matchStatus==='win' ? 'border-emerald-400 bg-emerald-50' : 'hover:bg-muted'}`}>{t('scores.win')}</button>
                <button type="button" onClick={() => setMatchStatus('draw')} className={`rounded-xl border px-3 py-3 text-sm transition ${matchStatus==='draw' ? 'border-amber-400 bg-amber-50' : 'hover:bg-muted'}`}>{t('scores.draw')}</button>
                <button type="button" onClick={() => setMatchStatus('loss')} className={`rounded-xl border px-3 py-3 text-sm transition ${matchStatus==='loss' ? 'border-rose-400 bg-rose-50' : 'hover:bg-muted'}`}>{t('scores.loss')}</button>
              </div>
            </div>

          </div>

          {roundNumber === '1' && (
            <div className="space-y-2">
              <Label>{t('scores.more_than_4')}</Label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setOpponentMoreThan4(false)} className={`rounded-xl px-4 py-3 text-sm border ${!opponentMoreThan4 ? 'bg-[#3a013e] text-white border-transparent' : 'bg-muted'}`}>{t('scores.no')}</button>
                <button type="button" onClick={() => setOpponentMoreThan4(true)} className={`rounded-xl px-4 py-3 text-sm border ${opponentMoreThan4 ? 'bg-[#3a013e] text-white border-transparent' : 'bg-muted'}`}>{t('scores.yes')}</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('scores.player_value')}12M)</Label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setValueGt12M(false)} className={`rounded-xl px-4 py-3 text-sm border ${!valueGt12M ? 'bg-[#3a013e] text-white border-transparent' : 'bg-muted'}`}>{t('scores.no')}</button>
              <button type="button" onClick={() => setValueGt12M(true)} className={`rounded-xl px-4 py-3 text-sm border ${valueGt12M ? 'bg-[#3a013e] text-white border-transparent' : 'bg-muted'}`}>{t('scores.yes')}</button>
            </div>
          </div>
          {roundNumber === '38' && (
            <div className="space-y-2">
              <Label>{t('scores.team_won_league')}</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={teamWonLeague === true ? 'default' : 'outline'}
                  onClick={() => setTeamWonLeague(true)}
                  className="rounded-full"
                >
                  {t('scores.yes')}
                </Button>
                <Button
                  type="button"
                  variant={teamWonLeague === false ? 'default' : 'outline'}
                  onClick={() => setTeamWonLeague(false)}
                  className="rounded-full"
                >
                  {t('scores.no')}
                </Button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-11 rounded-full bg-[#3a013e] hover:bg-[#54015b] text-white"
            disabled={loading || !basePoints || !matchStatus}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('scores.save_points')}
          </Button>
        </form>
      </CardContent>
    </Card>
    </>
  );
};

export default ScoreEntry;
