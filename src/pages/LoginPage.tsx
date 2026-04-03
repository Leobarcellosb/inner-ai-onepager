import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password, name);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Conta criada! Verifique seu email para confirmar.');
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error('Email ou senha incorretos.');
      } else {
        navigate('/dashboard');
      }
    }
    setLoading(false);
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: 'hsl(240 20% 3%)' }}
    >
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
            {isSignUp ? 'Criar conta' : 'Acessar plataforma'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Inner AI — Central de Inteligência
          </p>
        </div>

        {/* Form card */}
        <div
          className="rounded-xl p-7 space-y-5"
          style={{
            background: 'hsl(240 13% 7%)',
            border: '1px solid hsl(240 11% 13%)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Nome
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  required={isSignUp}
                  className="bg-background border-border/60 focus:border-accent/50"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Email
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
                Senha
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
              className="w-full font-semibold mt-2"
              style={{
                background: loading ? undefined : 'hsl(258 82% 64%)',
                color: '#fff',
              }}
            >
              {loading ? 'Aguarde...' : isSignUp ? 'Criar conta' : 'Entrar'}
            </Button>
          </form>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar conta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
