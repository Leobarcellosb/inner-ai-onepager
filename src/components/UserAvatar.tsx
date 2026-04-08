import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserAvatarProps {
  src: string | null | undefined;
  name: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-xs',
  lg: 'h-16 w-16 text-2xl',
};

/**
 * Resolve avatar_url to a renderable URL.
 * Handles: full URL, bare storage path, or old bucket reference.
 */
function resolveAvatarUrl(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;

  // Already a full URL — use as-is
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  // Bare storage path like "uid/avatar.webp" or "avatars/uid/avatar.webp"
  // Resolve via the avatars bucket
  const path = raw.startsWith('avatars/') ? raw.slice('avatars/'.length) : raw;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

export function UserAvatar({ src, name, size = 'md', className = '' }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = name?.charAt(0)?.toUpperCase() || 'U';
  const sizeClass = SIZES[size];

  const resolvedUrl = useMemo(() => resolveAvatarUrl(src), [src]);

  // Reset failed state when src changes (e.g. after new upload)
  useEffect(() => { setFailed(false); }, [src]);
  const showImg = !!resolvedUrl && !failed;

  if (showImg) {
    return (
      <img
        src={resolvedUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{ background: 'hsl(258 82% 55%)' }}
    >
      {initial}
    </div>
  );
}
