import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { joinGroup } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';

const JoinGroup = () => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    const j = qp.get('join');
    if (j) {
      setCode(j.toUpperCase());
      // small timeout to ensure element mounted
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    try {
      const res = await joinGroup(code.toUpperCase());
      toast.success(t('groups.join_success', { name: res.group.name }));
      setCode('');
      window.location.reload();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error ?? '');
      toast.error(msg || t('groups.join_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-soft border border-white/20 bg-gradient-to-br from-white to-white/90 dark:from-neutral-900 dark:to-neutral-900/90">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-lg font-semibold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#3a013e]/10 text-[#3a013e] mr-2">
            <UserPlus className="h-4 w-4" />
          </span>
          {t('groups.join_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code" className="text-sm font-medium">{t('groups.group_code')}</Label>
            <Input
              id="code"
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t('groups.group_code_placeholder')}
              maxLength={6}
              disabled={loading}
              className="h-11 rounded-full tracking-widest text-center"
            />
          </div>
          <Button type="submit" className="w-full h-11 rounded-full bg-[#3a013e] hover:bg-[#54015b] text-white" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('groups.join_button')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default JoinGroup;
