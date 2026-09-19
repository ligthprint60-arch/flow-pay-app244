import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "ru" | "en";
const KEY = "flow.lang.v1";

const DICT: Record<string, { ru: string; en: string }> = {
  "settings.title": { ru: "Настройки", en: "Settings" },
  "settings.subtitle": { ru: "Персонализация и доступы", en: "Personalization & access" },
  "settings.avatar": { ru: "Фото профиля", en: "Profile photo" },
  "settings.avatar.desc": { ru: "JPG или PNG из устройства", en: "JPG or PNG from your device" },
  "settings.bg": { ru: "Фон приложения", en: "App background" },
  "settings.bg.set": { ru: "Установлен пользовательский фон", en: "Custom background is set" },
  "settings.bg.desc": { ru: "Загрузите изображение из устройства", en: "Upload an image from your device" },
  "settings.video": { ru: "Видео-фон", en: "Video background" },
  "settings.video.desc": { ru: "MP4 / WebM до 25 МБ", en: "MP4 / WebM up to 25 MB" },
  "settings.audio": { ru: "Аудио в профиле", en: "Profile audio" },
  "settings.audio.desc": { ru: "MP3 для фона профиля", en: "MP3 for your profile" },
  "settings.audio.locked": { ru: "Только Premium", en: "Premium only" },
  "settings.geo": { ru: "Местоположение", en: "Location" },
  "settings.geo.desc": { ru: "Разрешите доступ для геофункций", en: "Allow access for geo features" },
  "settings.notifications": { ru: "Уведомления", en: "Notifications" },
  "settings.notifications.desc": { ru: "Объявления команды FLOW", en: "Announcements from FLOW" },
  "settings.shop": { ru: "FLOW Shop", en: "FLOW Shop" },
  "settings.shop.desc": { ru: "Скины · эмодзи · Premium", en: "Skins · emoji · Premium" },
  "settings.premium.on": { ru: "Premium · соцсети / песочница", en: "Premium · socials / sandbox" },
  "settings.premium.off": { ru: "Получить Premium", en: "Get Premium" },
  "settings.premium.on.desc": { ru: "Настройки premium-возможностей", en: "Manage premium features" },
  "settings.premium.off.desc": { ru: "Кастомные эмодзи, аудио, песочница", en: "Custom emoji, audio, sandbox" },
  "settings.graphics": { ru: "Настройки графики", en: "Graphics settings" },
  "settings.graphics.desc": { ru: "Качество стекла, фон, анимации", en: "Glass quality, background, animations" },
  "settings.lang": { ru: "Язык интерфейса", en: "Interface language" },
  "settings.lang.desc": { ru: "Русский или English", en: "Russian or English" },
  "common.open": { ru: "Открыть", en: "Open" },
  "common.upload": { ru: "Загрузить", en: "Upload" },
  "common.photo": { ru: "Фото", en: "Photo" },
  "common.allow": { ru: "Разрешить", en: "Allow" },
  "common.premium": { ru: "Premium", en: "Premium" },
  "common.close": { ru: "Закрыть", en: "Close" },
  "common.reset": { ru: "Сбросить", en: "Reset" },
  "common.send": { ru: "Отправить", en: "Send" },

  "gfx.title": { ru: "Графика", en: "Graphics" },
  "gfx.subtitle": { ru: "Полный контроль над визуальным движком", en: "Full control over the visual engine" },
  "gfx.preset": { ru: "Пресет", en: "Preset" },
  "gfx.preset.low": { ru: "Экономия", en: "Battery" },
  "gfx.preset.balanced": { ru: "Баланс", en: "Balanced" },
  "gfx.preset.ultra": { ru: "Ультра", en: "Ultra" },
  "gfx.preset.custom": { ru: "Свои настройки", en: "Custom" },
  "gfx.blur": { ru: "Размытие стекла", en: "Glass blur" },
  "gfx.saturation": { ru: "Насыщенность стекла", en: "Glass saturation" },
  "gfx.fluid": { ru: "Жидкий фон (WebGL)", en: "Fluid background (WebGL)" },
  "gfx.fluidOpacity": { ru: "Яркость фона", en: "Background brightness" },
  "gfx.glassAnim": { ru: "Анимация бликов", en: "Specular animation" },
  "gfx.caustics": { ru: "Каустика и зерно", en: "Caustics & grain" },
  "gfx.motion": { ru: "Плавные переходы", en: "Motion transitions" },
  "gfx.shadows": { ru: "Глубокие тени", en: "Deep shadows" },
  "gfx.fps": { ru: "Лимит FPS фона", en: "Background FPS cap" },
  "gfx.lightLevel": { ru: "Уровень света", en: "Light level" },
  "gfx.light.static": { ru: "Static", en: "Static" },
  "gfx.light.dynamic": { ru: "Dynamic", en: "Dynamic" },
  "gfx.light.photonic": { ru: "Photonic", en: "Photonic" },
  "gfx.reducedLight": { ru: "Reduced Light", en: "Reduced Light" },
  "gfx.hint": { ru: "Изменения применяются мгновенно и сохраняются на устройстве.", en: "Changes apply instantly and are stored on this device." },

  "ai.title": { ru: "FLOW AI", en: "FLOW AI" },
  "ai.subtitle": { ru: "Анализирует ваши действия и подсказывает", en: "Analyzes your activity and advises" },
  "ai.placeholder": { ru: "Спросите об аккаунте или приложении…", en: "Ask about your account or the app…" },
  "ai.analyze": { ru: "Проанализировать мои действия", en: "Analyze my activity" },
  "ai.empty": { ru: "Помощник видит, какие разделы вы открывали, и помогает с кошельком, партнёрствами, видео и учёбой.", en: "The assistant sees which sections you used and helps with wallet, partnerships, video and learning." },
  "ai.thinking": { ru: "Думает…", en: "Thinking…" },
  "ai.error": { ru: "Не удалось получить ответ", en: "Could not get a response" },
  "ai.button": { ru: "AI-помощник", en: "AI assistant" },

  "sections.title": { ru: "Разделы", en: "Sections" },
  "sections.subtitle": { ru: "Закрепите до 4 разделов в доке", en: "Pin up to 4 sections to the dock" },
  "nav.more": { ru: "Ещё", en: "More" },

  "sec.wallet": { ru: "Кошелёк", en: "Wallet" },
  "sec.wallet.d": { ru: "Балансы, P2P, пополнение", en: "Balances, P2P, top-up" },
  "sec.video": { ru: "Видео", en: "Video" },
  "sec.video.d": { ru: "FLOW Video — видеохостинг", en: "FLOW Video hosting" },
  "sec.feed": { ru: "Лента", en: "Feed" },
  "sec.feed.d": { ru: "Посты сообщества", en: "Community posts" },
  "sec.ecosystem": { ru: "Apps", en: "Apps" },
  "sec.ecosystem.d": { ru: "Экосистема мини-приложений", en: "Mini-app ecosystem" },
  "sec.partners": { ru: "PAS", en: "PAS" },
  "sec.partners.d": { ru: "Цифровые партнёрства", en: "Digital partnerships" },
  "sec.chats": { ru: "Чаты", en: "Chats" },
  "sec.chats.d": { ru: "Личные сообщения", en: "Direct messages" },
  "sec.learn": { ru: "Учёба", en: "Learn" },
  "sec.learn.d": { ru: "Квизы и награды", en: "Quizzes and rewards" },
  "sec.profile": { ru: "Я", en: "Me" },
  "sec.profile.d": { ru: "Профиль и настройки", en: "Profile and settings" },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };
const I18nCtx = createContext<Ctx>({ lang: "ru", setLang: () => {}, t: (k) => DICT[k]?.ru ?? k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ru");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY) as Lang | null;
      if (saved === "ru" || saved === "en") setLangState(saved);
      else if (navigator.language && !navigator.language.startsWith("ru")) setLangState("en");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(KEY, l); } catch { /* ignore */ }
  }, []);

  const t = useCallback((key: string) => DICT[key]?.[lang] ?? key, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  return useContext(I18nCtx);
}
