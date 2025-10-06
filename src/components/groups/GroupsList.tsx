import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listMyGroups } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Group {
  id: number;
  name: string;
  code: string;
  created_at: string;
  member_count: number;
}

interface GroupsListProps {
  onSelectGroup: (groupId: number) => void;
  selectedGroupId: number | null;
}

const GroupsList = ({ onSelectGroup, selectedGroupId }: GroupsListProps) => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    // when auth user changes (login/logout), refresh list
    setLoading(true);
    fetchGroups();
  }, [user]);

  const fetchGroups = async () => {
    try {
      if (!user) {
        setGroups([]);
        return;
      }
      const res = await listMyGroups();
      setGroups(res.groups || []);
    } catch (error: any) {
      toast.error(t('groups.list_load_failed'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <Card className="rounded-2xl shadow-soft border border-white/20 bg-gradient-to-br from-white to-white/90 dark:from-neutral-900 dark:to-neutral-900/90">
        <CardContent className="py-8 text-center text-muted-foreground">
          {t('groups.empty_list')}
        </CardContent>
      </Card>
    );
  }
  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error(t('groups.copy_failed'));
    }
  };

  return (
    <div className="grid gap-4 grid-cols-1">
      {groups.map((group) => {
        const inviteLink = `${window.location.origin}/?join=${group.code}`;
        return (
          <Card
            key={group.id}
            className={`w-full cursor-pointer rounded-2xl border border-white/20 bg-gradient-to-br from-white to-white/90 dark:from-neutral-900 dark:to-neutral-900/90 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)] ${
              selectedGroupId === group.id ? 'ring-2 ring-[#3a013e]' : ''
            }`}
            onClick={() => onSelectGroup(group.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="font-semibold text-foreground/90">{group.name}</span>
                <Badge variant="secondary" className="rounded-full">
                  <Users className="h-3 w-3 mr-1" />
                  {group.member_count}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">{t('groups.code_label')}</div>
                  <div className="font-mono tracking-widest text-lg">{group.code}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); copy(group.code, t('groups.copied_code')); }}
                    className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
                    title={t('groups.copy_code')}
                  >{t('groups.copy_code')}</button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); copy(inviteLink, t('groups.copied_link')); }}
                    className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
                    title={t('groups.copy_link')}
                  >{t('groups.copy_link')}</button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if ((navigator as any).share) {
                        try {
                          await (navigator as any).share({ title: t('groups.invite_title'), text: t('groups.invite_text'), url: inviteLink });
                        } catch {}
                      } else {
                        copy(inviteLink, t('groups.copied_link'));
                      }
                    }}
                    className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
                    title={t('groups.share')}
                  >{t('groups.share')}</button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default GroupsList;
