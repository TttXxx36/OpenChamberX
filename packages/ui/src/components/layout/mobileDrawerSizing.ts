export type MobileDrawerSide = 'left' | 'right';

export const normalizeMobileDrawerWidth = (width: number): number => {
  return Number.isFinite(width) && width > 0 ? width : 0;
};

export const getMobileDrawerTargetX = ({
  side,
  width,
  open,
}: {
  side: MobileDrawerSide;
  width: number;
  open: boolean;
}): number => {
  if (open) {
    return 0;
  }
  const normalizedWidth = normalizeMobileDrawerWidth(width);
  return side === 'left' ? -normalizedWidth : normalizedWidth;
};
