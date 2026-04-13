import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error('Email ou senha incorretos.');
      } else {
        navigate('/dashboard');
      }
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      {/* Subtle radial glow behind the card */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 700px 500px at 50% 40%, hsl(258 82% 64% / 0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <img
            src="/icon-inner-ai.png"
            alt="Inner AI"
            className="h-16 w-16 mb-6 object-contain"
            draggable={false}
          />
          <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
            {t('auth.login')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Inner AI — Central de Inteligência
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-xl p-7 space-y-5 bg-card border border-border">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('auth.email')}
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="bg-background border-border/60 focus:border-accent/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('auth.password')}
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="bg-background border-border/60 focus:border-accent/50"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className={`w-full font-semibold mt-2 text-white ${loading ? '' : 'bg-accent hover:bg-accent/90'}`}
            >
              {loading ? t('auth.waiting') : t('auth.login')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
