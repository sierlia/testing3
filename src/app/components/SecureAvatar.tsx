import { useEffect, useState } from "react";
import type * as React from "react";
import { DefaultAvatar } from "./DefaultAvatar";
import { signedStorageUrl } from "../utils/privateStorage";

type SecureAvatarProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  iconClassName?: string;
} & Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "className">;

export function SecureAvatar({ src, alt = "Avatar", className, fallbackClassName, iconClassName, ...props }: SecureAvatarProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResolvedSrc(null);
    if (!src) return;
    signedStorageUrl("avatars", src).then((url) => {
      if (!cancelled) setResolvedSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!resolvedSrc) {
    return <DefaultAvatar className={fallbackClassName ?? className} iconClassName={iconClassName} style={props.style} />;
  }

  return <img src={resolvedSrc} alt={alt} className={className} {...props} />;
}
