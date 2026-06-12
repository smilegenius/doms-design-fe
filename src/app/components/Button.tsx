import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  onClick,
  disabled,
  loading,
  className = '',
}: ButtonProps) {
  const variants = {
    primary: 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white hover:opacity-90 active:opacity-80',
    secondary: 'bg-[#E8E5F0] text-[#030213] hover:bg-[#D4CEE1]',
    outline: 'border-2 border-[#E0E0E6] text-[#030213] hover:bg-[#F8F9FC]',
    ghost: 'text-[#5A5568] hover:bg-[#F3F3F5]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  );
}
