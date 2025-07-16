import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import enTranslation from "./locales/ENtranslations.json";
import ruTranslation from "./locales/RUtranslations.json";
import rsTranslation from "./locales/RStranslations.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: true,
    fallbackLng: "en",
    supportedLngs: ["en", "ru", "rs"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: [
        "path",
        "cookie",
        "localStorage",
        "sessionStorage",
        "navigator",
        "htmlTag",
        "subdomain",
      ],
      caches: ["cookie"],
    },
    resources: {
      en: {
        translation: enTranslation,
      },
      ru: {
        translation: ruTranslation,
      },
      rs: {
        translation: rsTranslation,
      },
    },
  });

// Listen for the language change and update the lang tag of the <html> element
i18n.on("languageChanged", (lng) => {
  if (lng === "rs") {
    document.documentElement.lang = "rs-latn";
  } else {
    document.documentElement.lang = lng;
  }
});

export default i18n;
