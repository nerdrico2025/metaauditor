import { useState } from "react";
import { Image } from "lucide-react";
import type { Creative } from "@shared/schema";

interface CreativeImageProps {
  creative: Creative;
  className?: string;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'problem';
}

export const CreativeImage = ({ 
  creative, 
  className,
  size = 'medium',
  variant = 'default'
}: CreativeImageProps) => {
  const [imageError, setImageError] = useState(false);
  
  // Size configurations
  const sizeConfig = {
    small: {
      container: 'h-16 w-16',
      icon: 'h-4 w-4',
      text: 'text-xs',
      spacing: 'mb-1'
    },
    medium: {
      container: 'w-full h-32',
      icon: 'h-6 w-6',
      text: 'text-xs',
      spacing: 'mb-2'
    },
    large: {
      container: 'w-full h-48',
      icon: 'h-12 w-12',
      text: 'text-sm',
      spacing: 'mb-4'
    }
  };

  // Variant configurations
  const variantConfig = {
    default: {
      errorBg: 'bg-gradient-to-br from-orange-50 to-orange-100',
      errorBorder: 'border-2 border-dashed border-orange-200',
      errorIcon: 'text-orange-400',
      errorText: 'text-orange-600',
      errorSubtext: 'text-orange-400',
      emptyBg: 'bg-gradient-to-br from-slate-50 to-slate-100',
      emptyBorder: 'border-2 border-dashed border-slate-200',
      emptyIcon: 'text-slate-400',
      emptyText: 'text-slate-500',
      emptySubtext: 'text-slate-400'
    },
    problem: {
      errorBg: 'bg-gradient-to-br from-red-50 to-red-100',
      errorBorder: 'border border-red-200',
      errorIcon: 'text-red-400',
      errorText: 'text-red-500',
      errorSubtext: 'text-red-400',
      emptyBg: 'bg-gradient-to-br from-slate-50 to-slate-100',
      emptyBorder: 'border border-slate-200',
      emptyIcon: 'text-slate-400',
      emptyText: 'text-slate-400',
      emptySubtext: 'text-slate-400'
    }
  };

  const config = sizeConfig[size];
  const colors = variantConfig[variant];
  
  // No image URL
  if (!creative.imageUrl) {
    return (
      <div className={`${config.container} ${colors.emptyBg} rounded-lg flex flex-col items-center justify-center ${colors.emptyBorder}`}>
        <Image className={`${config.icon} ${colors.emptyIcon} ${config.spacing}`} />
        {size === 'small' ? (
          <span className={`${config.text} ${colors.emptyText}`}>N/A</span>
        ) : (
          <span className={`${config.text} ${colors.emptyText} text-center px-2`}>
            {size === 'large' ? (
              <>
                <span className="font-medium">{creative.name}</span><br/>
                <span className={`${colors.emptySubtext} mt-2 block`}>Nenhuma imagem cadastrada</span>
              </>
            ) : (
              <>
                {creative.name}<br/>
                <span className={colors.emptySubtext}>Sem imagem</span>
              </>
            )}
          </span>
        )}
      </div>
    );
  }

  // Image failed to load
  if (imageError) {
    return (
      <div className={`${config.container} ${colors.errorBg} rounded-lg flex flex-col items-center justify-center ${colors.errorBorder}`}>
        <svg className={`${config.icon} ${colors.errorIcon} ${config.spacing}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
        </svg>
        {size === 'small' ? (
          <span className={`${config.text} ${colors.errorText}`}>URL</span>
        ) : (
          <span className={`${config.text} ${colors.errorText} text-center px-2`}>
            {size === 'large' ? (
              <>
                <span className="font-medium">{creative.name}</span><br/>
                <span className={`${colors.errorSubtext} mt-2 block`}>Imagem não disponível (URL expirada)</span>
              </>
            ) : (
              <>
                {creative.name}<br/>
                <span className={colors.errorSubtext}>URL expirada</span>
              </>
            )}
          </span>
        )}
      </div>
    );
  }

  // Render image
  const imageClassName = className || `${config.container} object-cover rounded-lg`;
  
  return (
    <img 
      src={creative.imageUrl}
      alt={creative.name}
      className={imageClassName}
      onError={() => setImageError(true)}
      data-testid={`img-creative-${creative.id}`}
    />
  );
};