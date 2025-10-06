import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createGroup } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

const CreateGroup = () => {
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    setLoading(true);
    try {
      const res = await createGroup(groupName);
      const code = res.code;
      toast.success(t('groups.create_success', { code }));
      setGroupName('');
      window.location.reload();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error ?? '');
      toast.error(msg || t('groups.create_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-soft border border-white/20 bg-gradient-to-br from-white to-white/90 dark:from-neutral-900 dark:to-neutral-900/90">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-lg font-semibold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#3a013e]/10 text-[#3a013e] mr-2">
            <Plus className="h-4 w-4" />
          </span>
          {t('groups.create_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="groupName" className="text-sm font-medium">{t('groups.group_name')}</Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t('groups.group_name_placeholder')}
              disabled={loading}
              className="h-11 rounded-full"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-11 rounded-full bg-[#3a013e] hover:bg-[#54015b] text-white"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('groups.create_button')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateGroup;
