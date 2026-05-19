import vi from './vi.json';
import en from './en.json';

const translations = { vi, en };
const STORAGE_KEY = 'la_lang';

export function getLang() {
  return localStorage.getItem(STORAGE_KEY) || 'vi';
}

export function setLang(lang) {
  localStorage.setItem(STORAGE_KEY, lang);
  window.location.reload();
}

export function t(key) {
  const lang = getLang();
  const dict = translations[lang] || translations['vi'];
  return key.split('.').reduce((o, k) => o?.[k], dict) ?? key;
}

export const availableLangs = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
];
