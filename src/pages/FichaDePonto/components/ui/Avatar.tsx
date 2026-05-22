import styles from './Avatar.module.css';

interface AvatarProps {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ initials, size = 'md' }: AvatarProps) {
  return (
    <div className={`${styles.avatar} ${styles[size]}`} aria-hidden="true">
      {initials}
    </div>
  );
}
