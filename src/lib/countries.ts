// Shared country dial-code list for phone-number inputs (Italy first, then the
// markets a Lombardy-based private chef realistically serves). Used by the
// /richiesta request form's phone prefix selector.
export interface Country {
  name: string;
  dial_code: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { name: 'Italy', dial_code: '+39', flag: '🇮🇹' },
  { name: 'United Kingdom', dial_code: '+44', flag: '🇬🇧' },
  { name: 'United States', dial_code: '+1', flag: '🇺🇸' },
  { name: 'Switzerland', dial_code: '+41', flag: '🇨🇭' },
  { name: 'France', dial_code: '+33', flag: '🇫🇷' },
  { name: 'Germany', dial_code: '+49', flag: '🇩🇪' },
  { name: 'Spain', dial_code: '+34', flag: '🇪🇸' },
  { name: 'Austria', dial_code: '+43', flag: '🇦🇹' },
  { name: 'Netherlands', dial_code: '+31', flag: '🇳🇱' },
  { name: 'Belgium', dial_code: '+32', flag: '🇧🇪' },
  { name: 'Ireland', dial_code: '+353', flag: '🇮🇪' },
  { name: 'Portugal', dial_code: '+351', flag: '🇵🇹' },
  { name: 'Monaco', dial_code: '+377', flag: '🇲🇨' },
  { name: 'Sweden', dial_code: '+46', flag: '🇸🇪' },
  { name: 'Norway', dial_code: '+47', flag: '🇳🇴' },
  { name: 'Denmark', dial_code: '+45', flag: '🇩🇰' },
  { name: 'Finland', dial_code: '+358', flag: '🇫🇮' },
  { name: 'Poland', dial_code: '+48', flag: '🇵🇱' },
  { name: 'Greece', dial_code: '+30', flag: '🇬🇷' },
  { name: 'Czechia', dial_code: '+420', flag: '🇨🇿' },
  { name: 'Russia', dial_code: '+7', flag: '🇷🇺' },
  { name: 'United Arab Emirates', dial_code: '+971', flag: '🇦🇪' },
  { name: 'Qatar', dial_code: '+974', flag: '🇶🇦' },
  { name: 'Saudi Arabia', dial_code: '+966', flag: '🇸🇦' },
  { name: 'Australia', dial_code: '+61', flag: '🇦🇺' },
  { name: 'Canada', dial_code: '+1', flag: '🇨🇦' },
];
