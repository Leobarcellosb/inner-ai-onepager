import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Save, Loader2, LogOut, Shield, Mail, Key, Camera, Sun, Moon, Monitor, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { setTheme as applyTheme } from '@/lib/theme';
import { AvatarCropModal } from '@/components/AvatarCropModal';
import { UserAvatar } from '@/components/UserAvatar';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: 'Administrador', color: 'hsl(258 82% 64%)' },
  operator: { label: 'Operador', color: 'hsl(217 88% 58%)' },
  social_media: { label: 'Social Media', color: 'hsl(38 90% 50%)' },
  designer: { label: 'Designer', color: 'hsl(142 60% 42%)' },
};

const LANGUAGES = [
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

const THEMES = [
  { id: 'dark', labelKey: 'settings.theme_dark', icon: Moon },
  { id: 'light', labelKey: 'settings.theme_light', icon: Sun },
  { id: 'system', labelKey: 'settings.theme_system', icon: Monitor },
];

export default function SettingsPage() {
  const { user, profile, roles, signOut, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const { lang, setLang, t } = useI18n();
  const [theme, setTheme] = useState(() => localStorage.getItem('inner-theme') || 'dark');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setEmail(profile.email || '');
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ name }).eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Perfil atualizado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = (file: File) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Máximo 10 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!user) return;
    setUploadingAvatar(true);

    // Path follows Supabase storage policy pattern: avatars/{uid}/avatar.webp
    const filePath = `${user.id}/avatar.webp`;

    try {
      // Step 1 — upload to dedicated "avatars" bucket
      const { error: storageErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { upsert: true, contentType: 'image/webp' });
      if (storageErr) {
        toast.error(`Storage: ${storageErr.message}`);
        return;
      }

      // Step 2 — public URL + cache-bust
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const url = `${urlData.publicUrl}?v=${Date.now()}`;

      // Step 3 — persist URL on own profile row
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id);
      if (profileErr) {
        toast.error(`Profile: ${profileErr.message}`);
        return;
      }

      setAvatarUrl(url);
      setCropSrc(null);
      await refreshProfile();
      toast.success('Avatar atualizado');
    } catch (e: any) {
      toast.error(e.message || 'Erro no upload');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Mínimo 6 caracteres');
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha alterada');
      setNewPassword('');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    applyTheme(newTheme as 'dark' | 'light' | 'system');
  };

  const handleLanguageChange = (newLang: 'pt-BR' | 'en' | 'es') => {
    setLang(newLang);
    toast.success(t('common.save'));
  };

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-5 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-6 w-6 text-accent" />
            {t('settings.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('settings.subtitle')}</p>
        </div>

        {/* ── Profile ── */}
        <div className="rounded-xl overflow-hidden bg-card border border-border">
          <div className="px-5 py-5 flex items-center gap-5 border-b border-border">
            {/* Avatar */}
            <div className="relative shrink-0">
              <UserAvatar src={avatarUrl} name={name} size="lg" />
              <label className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white cursor-pointer hover:brightness-110 transition-all">
                {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) { handleAvatarSelect(e.target.files[0]); e.target.value = ''; } }} />
              </label>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-foreground truncate">{name || 'Sem nome'}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {roles.map(r => {
                  const cfg = ROLE_LABELS[r] || { label: r, color: 'hsl(240 5% 50%)' };
                  return (
                    <span key={r} className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${cfg.color}15`, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-5 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> {t('auth.name')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {t('auth.email')}</Label>
              <Input value={email} disabled className="h-9 text-sm opacity-50" />
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} size="sm" className="bg-accent text-white hover:bg-accent/90">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              {t('settings.save_profile')}
            </Button>
          </div>
        </div>

        {/* ── Appearance ── */}
        <div className="rounded-xl overflow-hidden bg-card border border-border">
          <div className="px-5 py-3 flex items-center gap-2 border-b border-border">
            <Moon className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-foreground/80">{t('settings.appearance')}</span>
          </div>
          <div className="px-5 py-4">
            <div className="flex gap-2">
              {THEMES.map(({ id, labelKey, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleThemeChange(id)}
                  className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-lg border transition-all ${
                    theme === id
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-transparent border-border'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${theme === id ? 'text-accent' : 'text-muted-foreground'}`} />
                  <span className={`text-[10px] font-medium ${theme === id ? 'text-accent' : 'text-muted-foreground'}`}>
                    {t(labelKey)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Language ── */}
        <div className="rounded-xl overflow-hidden bg-card border border-border">
          <div className="px-5 py-3 flex items-center gap-2 border-b border-border">
            <Globe className="h-4 w-4 text-info" />
            <span className="text-sm font-semibold text-foreground/80">{t('settings.language')}</span>
          </div>
          <div className="px-5 py-4">
            <div className="flex gap-2">
              {LANGUAGES.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => handleLanguageChange(code as 'pt-BR' | 'en' | 'es')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                    lang === code
                      ? 'bg-info/10 border-info/30 text-info'
                      : 'bg-transparent border-border text-muted-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Security ── */}
        <div className="rounded-xl overflow-hidden bg-card border border-border">
          <div className="px-5 py-3 flex items-center gap-2 border-b border-border">
            <Shield className="h-4 w-4 text-warning" />
            <span className="text-sm font-semibold text-foreground/80">{t('settings.security')}</span>
          </div>
          <div className="px-5 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Key className="h-3 w-3" /> {t('settings.new_password')}</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="******" className="h-9 text-sm" />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword} size="sm" variant="outline">
              {changingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Key className="h-3.5 w-3.5 mr-1" />}
              {t('settings.change_password')}
            </Button>
          </div>
        </div>

        {/* ── Account info ── */}
        <div className="rounded-xl px-5 py-4 space-y-2 bg-card border border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">ID</span>
            <span className="text-foreground/40 font-mono text-[10px]">{user?.id?.slice(0, 16)}...</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('settings.member_since')}</span>
            <span className="text-foreground/40">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '—'}</span>
          </div>
        </div>

        {/* ── Logout ── */}
        <Button onClick={signOut} variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10">
          <LogOut className="h-4 w-4 mr-2" />
          {t('auth.logout')}
        </Button>
      </div>

      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onConfirm={handleCroppedUpload}
          onCancel={() => setCropSrc(null)}
          saving={uploadingAvatar}
        />
      )}
    </AppLayout>
  );
}
