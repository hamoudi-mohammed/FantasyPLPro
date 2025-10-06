import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRankings } from '@/lib/api';
import { getUserRounds } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Trophy, Medal, Award, RefreshCcw, ArrowUpRight, ArrowDownRight, MoreHorizontal, Users } from 'lucide-react';
import { toast } from 'sonner';

interface RankingsProps {
  groupId: number;
}

interface UserScore {
  user_id: number;
  username: string;
  total_points: number;
  rounds_played: number;
  average_points: number;
  latest_round_points?: number;
  chosen_team?: string | null;
  avatar_url?: string | null;
}

interface GroupSummary {
  members: number;
  currentRound: number;
}

const Rankings = ({ groupId }: RankingsProps) => {
  const { t, i18n } = useTranslation();
  const [rankings, setRankings] = useState<UserScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [roundFilter, setRoundFilter] = useState<string>('all');
  const [summary, setSummary] = useState<GroupSummary>({ members: 0, currentRound: 0 });
  const [selected, setSelected] = useState<UserScore | null>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [userRounds, setUserRounds] = useState<Array<{ round: number; round_points: number; total_points: number; expensive_player_name?: string | null; expensive_player_points?: number | null; created_at: string }>>([]);

  // FPL brand color for names (Premier League / Fantasy theme)
  const FPL_COLOR = '#37003C';
  const FPL_ACCENT = '#00FF85';

  // Build initials map to avoid duplicates: default two letters (FN + LN). If collision, add second letter from second word.
  const initialsMap = useMemo(() => {
    const baseCounts = new Map<string, number>();
    const result = new Map<number, string>();
    rankings.forEach(u => {
      const name = (u.username || '').trim();
      const parts = name.split(/\s+/).filter(Boolean);
      const first = parts[0]?.[0] || '';
      const second = parts[1]?.[0] || '';
      const base = (first + second).toUpperCase();
      const count = (baseCounts.get(base) || 0) + 1;
      baseCounts.set(base, count);
      if (count === 1) {
        result.set(u.user_id, base);
      } else {
        // add second letter of second word if available, else use next available char from name
        const extra = parts[1]?.[1] ? parts[1][1].toUpperCase() : (parts[0]?.[1]?.toUpperCase() || '');
        result.set(u.user_id, (base + extra).toUpperCase());
      }
    });
    return result;
  }, [rankings]);

  useEffect(() => {
    fetchAll();
    // dependency note: fetchAll reads groupId and roundFilter
  }, [groupId, roundFilter]);

  // Initialize selectedRound from top filter or currentRound when selecting a user or changing filter
  useEffect(() => {
    if (!selected) { setSelectedRound(null); return; }
    const r = roundFilter !== 'all' ? Number(roundFilter) : (summary.currentRound || 1);
    setSelectedRound(r);
  }, [selected, roundFilter, summary.currentRound]);

  // Fetch per-user rounds when a user is selected
  useEffect(() => {
    const run = async () => {
      if (!selected) { setUserRounds([]); return; }
      try {
        const res = await getUserRounds(groupId, Number(selected.user_id));
        setUserRounds(res.rounds || []);
      } catch (_e) {
        setUserRounds([]);
      }
    };
    run();
  }, [selected, groupId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await getRankings(groupId, roundFilter !== 'all' ? Number(roundFilter) : undefined);
      setSummary(res.summary || { members: 0, currentRound: 0 });
      const array: UserScore[] = (res.rankings || []).map((u) => ({
        user_id: Number(u.user_id),
        username: (u.username || t('rankings_page.player', { defaultValue: 'Player' })) as string,
        total_points: u.total_points,
        rounds_played: u.rounds_played,
        average_points: u.average_points,
        latest_round_points: u.latest_round_points,
        // optional fields may exist in API
        chosen_team: (u as any).chosen_team ?? null,
        avatar_url: (u as any).avatar_url ?? null,
      }));
      setRankings(array);
    } catch (_e) {
      toast.error(t('rankings_page.load_failed', { defaultValue: 'Failed to load rankings' }));
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-amber-600" />;
    return null;
  };

  const averages = useMemo(() => {
    if (!rankings.length) return { avg: 0, maxRoundPts: 0 };
    const avg = Math.round(rankings.reduce((s, u) => s + u.total_points, 0) / rankings.length);
    return { avg, maxRoundPts: Math.max(...rankings.map(u => u.latest_round_points || 0)) };
  }, [rankings]);

  const percent = useMemo(() => (summary.currentRound ? (summary.currentRound / 38) * 100 : 0), [summary.currentRound]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top: Extended Summary */}
      <Card className="w-full hover:shadow-md transition-shadow bg-transparent border-[#37003C]/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            <CardTitle>{t('rankings_page.group_rankings')}</CardTitle>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1"><Users className="h-4 w-4" />{summary.members} {t('rankings_page.members')}</div>
            <div>{t('rankings_page.current_round')}: {summary.currentRound || '-'} </div>
            <Button size="sm" variant="outline" onClick={fetchAll} className="border-[#37003C] text-[#37003C] hover:bg-[#37003C]/10 transition-colors">
              <RefreshCcw className="h-4 w-4 mr-1" /> {t('rankings_page.refresh')}
            </Button>
          </div>
        </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <div className="min-w-[200px]">
              <div className="text-xs text-muted-foreground mb-1">{t('rankings_page.filter_by')}</div>
              <Select value={roundFilter} onValueChange={setRoundFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={t('rankings_page.all_rounds')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('rankings_page.all_rounds')}</SelectItem>
                  {Array.from({ length: 38 }, (_, i) => String(i + 1)).map(r => (
                    <SelectItem key={r} value={r}>{t('rankings_page.round')} {r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

      {/* Middle: Centered Leaderboard Table */}
      <div className="w-full flex justify-center">
        <Card className="w-full max-w-4xl hover:shadow-md transition-shadow bg-transparent border-[#37003C]/20">
          <CardHeader>
            <CardTitle>{t('rankings')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right bg-[#37003C]/5">{t('rankings_page.table_rank')}</TableHead>
                  <TableHead className="text-right bg-[#37003C]/5">{t('rankings_page.table_player')}</TableHead>
                  <TableHead className="text-right bg-[#37003C]/5">{t('rankings_page.table_total_points')}</TableHead>
                  <TableHead className="text-right bg-[#37003C]/5">{t('rankings_page.table_round_points')}</TableHead>
                  <TableHead className="text-right bg-[#37003C]/5">{t('rankings_page.table_change')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((user, index) => (
                  <TableRow key={user.user_id} className="cursor-pointer hover:bg-fuchsia-50/60 dark:hover:bg-fuchsia-900/10 transition-colors" onClick={() => setSelected(user)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getRankIcon(index)}
                        {index + 1}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 ring-1 ring-[#37003C] overflow-hidden">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.username} className="h-full w-full object-cover" />
                          ) : (
                            <AvatarFallback>{(initialsMap.get(user.user_id) || (user.username?.[0] || 'م').toUpperCase())}</AvatarFallback>
                          )}
                        </Avatar>
                        <div className="leading-tight">
                          <div className="font-medium" style={{ color: FPL_COLOR }}>{user.username}</div>
                          {user.chosen_team ? (
                            <div className="text-xs text-muted-foreground"><span className="font-medium">{user.chosen_team}</span></div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelected(user); }}>{user.total_points}</Badge>
                    </TableCell>
                    <TableCell>{user.latest_round_points ?? '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center text-sm ${
                        (user.latest_round_points || 0) >= averages.maxRoundPts && averages.maxRoundPts > 0
                          ? 'text-emerald-600'
                          : 'text-muted-foreground'
                      }`}>
                        {(user.latest_round_points || 0) >= averages.maxRoundPts && averages.maxRoundPts > 0 ? (
                          <ArrowUpRight className="h-4 w-4 mr-1" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 mr-1" />
                        )}
                        {/* Placeholder change indicator */}
                        0
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Details panel for selected user */}
      {selected && (
        <Card className="w-full hover:shadow-md transition-shadow bg-transparent border-[#37003C]/20">
          <CardHeader>
            <CardTitle>{t('rankings_page.player_details')}: <span style={{ color: FPL_COLOR }}>{selected.username}</span></CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">{t('rankings_page.total_points')}: <span className="font-semibold">{selected.total_points}</span></div>
            <div className="text-sm text-muted-foreground">{t('rankings_page.last_round_points')}: <span className="font-semibold">{selected.latest_round_points ?? '-'}</span></div>
            <div className="grid gap-2 md:grid-cols-2 items-end">
              <div>
                <div className="text-xs text-muted-foreground mb-1">{t('rankings_page.select_round')}</div>
                <Select value={String(selectedRound ?? (summary.currentRound ?? 1))} onValueChange={(v) => setSelectedRound(Number(v))}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t('rankings_page.round')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 38 }, (_, i) => String(i + 1)).map(r => (
                      <SelectItem key={r} value={r}>{t('rankings_page.round')} {r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm space-y-1">
                {(() => {
                  const r = Number(selectedRound ?? (summary.currentRound || 1));
                  const info = userRounds.find(x => Number(x.round) === r);
                  const pts = info?.round_points ?? (r === summary.currentRound ? selected.latest_round_points : undefined);
                  return (
                    <>
                      <div>{t('rankings_page.selected_round')}: <span className="font-semibold">{r}</span></div>
                      <div>{t('rankings_page.points_this_round')}: <span className="font-semibold">{typeof pts === 'number' ? pts : '-'}</span></div>
                      <div className="text-xs text-muted-foreground">{t('rankings_page.total_until_round')}: <span className="font-medium">{info?.total_points ?? '-'}</span></div>
                      {info?.expensive_player_name && (
                        <div className="text-xs text-muted-foreground">{t('rankings_page.best_player')}: <span className="font-medium">{info.expensive_player_name}</span> (<span className="font-medium">{info.expensive_player_points ?? 0}</span>)</div>
                      )}
                      {info?.created_at && (
                        <div className="text-[11px] text-muted-foreground">{t('rankings_page.updated')}: {new Date(info.created_at).toLocaleString()}</div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Previous rounds chips removed per request */}
            <div>
              <Button variant="outline" onClick={() => setSelected(null)} className="border-[#37003C] text-[#37003C] hover:bg-[#37003C]/10 transition-colors">{t('rankings_page.close')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom: Group Statistics */}
        <Card className="w-full hover:shadow-md transition-shadow bg-transparent border-[#37003C]/20">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>{t('rankings_page.group_stats')}</CardTitle>
            {rankings[0] && (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8 ring-1 ring-[#37003C]">
                  <AvatarFallback>{(initialsMap.get(rankings[0].user_id) || (rankings[0].username || '').split(/\s+/).slice(0,2).map(p=>p[0]||'').join('').toUpperCase() || 'م')}</AvatarFallback>
                </Avatar>
                <span className="text-sm" style={{ color: FPL_COLOR }}>{rankings[0].username}</span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">{t('rankings_page.average')}</div>
                <div className="font-semibold">{averages.avg}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">{t('rankings_page.max_round_points')}</div>
                <div className="font-semibold">{averages.maxRoundPts}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">{t('rankings_page.rounds_count')}</div>
                <div className="font-semibold">{summary.currentRound}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">{t('rankings_page.active_members')}</div>
                <div className="font-semibold">{summary.members}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium" style={{ color: FPL_COLOR }}>{t('rankings_page.competition_progress')}</div>
              <div className="h-2 w-full rounded bg-[#37003C]/10">
                <div className="h-2 rounded bg-[#37003C]/60 transition-all" style={{ width: `${percent}%` }} />
              </div>
              <div className="text-xs text-muted-foreground">{summary.currentRound}/38 {t('rankings_page.completed_of')}</div>
            </div>

            {rankings[0] && (
              <div className="rounded-lg border p-3 bg-transparent border-[#37003C]/20">
                <div className="text-xs text-muted-foreground mb-1">{t('rankings_page.best_player')}</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 ring-1 ring-[#37003C]">
                      <AvatarFallback>{(initialsMap.get(rankings[0].user_id) || (rankings[0].username || '').split(/\s+/).slice(0,2).map(p=>p[0]||'').join('').toUpperCase() || 'م')}</AvatarFallback>
                    </Avatar>
                    <div className="font-medium" style={{ color: FPL_COLOR }}>{rankings[0].username}</div>
                  </div>
                  <div className="font-semibold">{rankings[0].total_points}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
};

export default Rankings;
