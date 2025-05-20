export const logoNames = [
  'google-logo',
  'logo-favicon',
  'logo-standard',
  'logo',
  'marble',
  'microsoft-logo',
  'logo-text',
] as const;

export type LogoName = (typeof logoNames)[number];
