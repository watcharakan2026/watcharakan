import React from 'react';

interface DriveImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const DriveImage: React.FC<DriveImageProps> = ({ src, alt, className = '' }) => {
  const resolvedSrc = src.startsWith('turso://')
    ? `/api/media/${encodeURIComponent(src.replace('turso://', '').trim())}`
    : src.startsWith('drive://')
      ? `/api/drive-file/${encodeURIComponent(src.replace('drive://', '').trim())}`
      : src;

  return <img src={resolvedSrc} alt={alt} className={className} />;
};
