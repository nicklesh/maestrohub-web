/**
 * Date Localization Utilities
 * Handles date formatting with localized months, days, and numbers
 */

// Hindi numerals mapping
const HINDI_NUMERALS: Record<string, string> = {
  '0': '०',
  '1': '१',
  '2': '२',
  '3': '३',
  '4': '४',
  '5': '५',
  '6': '६',
  '7': '७',
  '8': '८',
  '9': '९',
};

// Localized month names
const MONTH_NAMES: Record<string, string[]> = {
  en_US: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  hi_IN: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  es_ES: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  fr_FR: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  de_DE: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
};

// Short month names
const MONTH_SHORT_NAMES: Record<string, string[]> = {
  en_US: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  hi_IN: ['जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुल', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'],
  es_ES: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  fr_FR: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
  de_DE: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
};

// Localized day names
const DAY_NAMES: Record<string, string[]> = {
  en_US: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  hi_IN: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
  es_ES: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  fr_FR: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  de_DE: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
};

// Short day names
const DAY_SHORT_NAMES: Record<string, string[]> = {
  en_US: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  hi_IN: ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'],
  es_ES: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  fr_FR: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
  de_DE: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
};

// Locales that use native numerals
const NATIVE_NUMERAL_LOCALES: Record<string, Record<string, string>> = {
  hi_IN: HINDI_NUMERALS,
  // Add more locales as needed
};

/**
 * Convert numbers to localized numerals
 */
export function toLocalizedNumber(num: number | string, locale: string): string {
  const numStr = num.toString();
  const numerals = NATIVE_NUMERAL_LOCALES[locale];
  
  if (!numerals) {
    return numStr;
  }
  
  return numStr.split('').map(char => numerals[char] || char).join('');
}

/**
 * Get localized month name
 */
export function getLocalizedMonthName(monthIndex: number, locale: string, short = false): string {
  const months = short ? MONTH_SHORT_NAMES : MONTH_NAMES;
  return (months[locale] || months['en_US'])[monthIndex];
}

/**
 * Get localized day name
 */
export function getLocalizedDayName(dayIndex: number, locale: string, short = false): string {
  const days = short ? DAY_SHORT_NAMES : DAY_NAMES;
  return (days[locale] || days['en_US'])[dayIndex];
}

/**
 * Format date with full localization
 * Supports formats like:
 * - 'EEEE, MMMM d, yyyy' -> 'रविवार, जनवरी २७, २०२६' (Hindi)
 * - 'MMM d, yyyy' -> 'जन २७, २०२६' (Hindi)
 * - 'EEE' -> 'रवि' (Hindi)
 */
export function formatLocalizedDate(date: Date | string, formatStr: string, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  const dayOfWeek = d.getDay();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  
  let result = formatStr;
  
  // Replace year
  result = result.replace('yyyy', toLocalizedNumber(year, locale));
  result = result.replace('yy', toLocalizedNumber(year.toString().slice(-2), locale));
  
  // Replace month
  result = result.replace('MMMM', getLocalizedMonthName(month, locale, false));
  result = result.replace('MMM', getLocalizedMonthName(month, locale, true));
  result = result.replace('MM', toLocalizedNumber(String(month + 1).padStart(2, '0'), locale));
  result = result.replace(/M(?!M|a|o)/, toLocalizedNumber(month + 1, locale));
  
  // Replace day
  result = result.replace('EEEE', getLocalizedDayName(dayOfWeek, locale, false));
  result = result.replace('EEE', getLocalizedDayName(dayOfWeek, locale, true));
  result = result.replace('dd', toLocalizedNumber(String(day).padStart(2, '0'), locale));
  result = result.replace(/d(?!d|e|a)/, toLocalizedNumber(day, locale));
  
  // Replace time (12-hour format)
  const hours12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const localizedAmPm = locale === 'hi_IN' ? (hours >= 12 ? 'अपराह्न' : 'पूर्वाह्न') : ampm;
  
  result = result.replace('hh', toLocalizedNumber(String(hours12).padStart(2, '0'), locale));
  result = result.replace(/h(?!h)/, toLocalizedNumber(hours12, locale));
  result = result.replace('HH', toLocalizedNumber(String(hours).padStart(2, '0'), locale));
  result = result.replace(/H(?!H)/, toLocalizedNumber(hours, locale));
  result = result.replace('mm', toLocalizedNumber(String(minutes).padStart(2, '0'), locale));
  result = result.replace('a', localizedAmPm);
  
  return result;
}

/**
 * Format currency amount with localized numbers
 */
export function formatLocalizedCurrency(amount: number, locale: string, currencySymbol = '$'): string {
  const formattedAmount = amount.toFixed(2);
  return `${currencySymbol}${toLocalizedNumber(formattedAmount, locale)}`;
}

/**
 * Format time duration
 */
export function formatLocalizedDuration(minutes: number, locale: string): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (locale === 'hi_IN') {
    if (hours > 0 && mins > 0) {
      return `${toLocalizedNumber(hours, locale)} घंटे ${toLocalizedNumber(mins, locale)} मिनट`;
    } else if (hours > 0) {
      return `${toLocalizedNumber(hours, locale)} घंटे`;
    } else {
      return `${toLocalizedNumber(mins, locale)} मिनट`;
    }
  }
  
  // Default English
  if (hours > 0 && mins > 0) {
    return `${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${mins}m`;
  }
}

export default {
  toLocalizedNumber,
  getLocalizedMonthName,
  getLocalizedDayName,
  formatLocalizedDate,
  formatLocalizedCurrency,
  formatLocalizedDuration,
};
