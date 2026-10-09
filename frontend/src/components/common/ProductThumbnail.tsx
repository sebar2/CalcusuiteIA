import React, { useState } from 'react';
import { Package } from 'lucide-react';

export type ThumbnailSize = 'xs' | 'sm' | 'md' | 'lg';

interface ProductThumbnailProps {
  src?: string | null;
  alt?: string;
  sku?: string;
  size?: ThumbnailSize;
  className?: string;
}

const SIZE_MAP: Record<ThumbnailSize, { box: string; icon: number }> = {
  xs: { box: 'w-6 h-6 min-w-[24px] min-h-[24px] rounded', icon: 14 },
  sm: { box: 'w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg', icon: 18 },
  md: { box: 'w-12 h-12 min-w-[48px] min-h-[48px] rounded-lg', icon: 22 },
  lg: { box: 'w-16 h-16 min-w-[64px] min-h-[64px] rounded-xl', icon: 28 },
};

export const ProductThumbnail: React.FC<ProductThumbnailProps> = ({
  src,
  alt = 'Producto',
  size = 'md',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);
  const { box, icon } = SIZE_MAP[size];

  if (!src || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-400 dark:text-slate-500 overflow-hidden shrink-0 shadow-xs ${box} ${className}`}
        title={alt}
      >
        <Package size={icon} className="opacity-70" />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/60 shrink-0 shadow-xs group ${box} ${className}`}
      title={alt}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
      />
    </div>
  );
};

export default ProductThumbnail;
