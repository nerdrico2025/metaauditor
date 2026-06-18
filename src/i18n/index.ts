import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enSidebar from './locales/en/sidebar.json';
import enDashboard from './locales/en/dashboard.json';
import enCampaigns from './locales/en/campaigns.json';
import enAdsets from './locales/en/adsets.json';
import enCreatives from './locales/en/creatives.json';
import enAudits from './locales/en/audits.json';
import enDiagnostics from './locales/en/diagnostics.json';
import enRules from './locales/en/rules.json';
import enIntegrations from './locales/en/integrations.json';
import enSettings from './locales/en/settings.json';
import enUsers from './locales/en/users.json';
import enCompany from './locales/en/company.json';
import enBrand from './locales/en/brand.json';
import enMonitoring from './locales/en/monitoring.json';
import enReports from './locales/en/reports.json';
import enAuth from './locales/en/auth.json';
import enPrivacy from './locales/en/privacy.json';
import enTerms from './locales/en/terms.json';
import enAiChat from './locales/en/ai-chat.json';

import ptBRCommon from './locales/pt-BR/common.json';
import ptBRSidebar from './locales/pt-BR/sidebar.json';
import ptBRDashboard from './locales/pt-BR/dashboard.json';
import ptBRCampaigns from './locales/pt-BR/campaigns.json';
import ptBRAdsets from './locales/pt-BR/adsets.json';
import ptBRCreatives from './locales/pt-BR/creatives.json';
import ptBRAudits from './locales/pt-BR/audits.json';
import ptBRDiagnostics from './locales/pt-BR/diagnostics.json';
import ptBRRules from './locales/pt-BR/rules.json';
import ptBRIntegrations from './locales/pt-BR/integrations.json';
import ptBRSettings from './locales/pt-BR/settings.json';
import ptBRUsers from './locales/pt-BR/users.json';
import ptBRCompany from './locales/pt-BR/company.json';
import ptBRBrand from './locales/pt-BR/brand.json';
import ptBRMonitoring from './locales/pt-BR/monitoring.json';
import ptBRReports from './locales/pt-BR/reports.json';
import ptBRAuth from './locales/pt-BR/auth.json';
import ptBRPrivacy from './locales/pt-BR/privacy.json';
import ptBRTerms from './locales/pt-BR/terms.json';
import ptBRAiChat from './locales/pt-BR/ai-chat.json';

const resources = {
  en: {
    common: enCommon,
    sidebar: enSidebar,
    dashboard: enDashboard,
    campaigns: enCampaigns,
    adsets: enAdsets,
    creatives: enCreatives,
    audits: enAudits,
    diagnostics: enDiagnostics,
    rules: enRules,
    integrations: enIntegrations,
    settings: enSettings,
    users: enUsers,
    company: enCompany,
    brand: enBrand,
    monitoring: enMonitoring,
    reports: enReports,
    auth: enAuth,
    privacy: enPrivacy,
    terms: enTerms,
    'ai-chat': enAiChat,
  },
  'pt-BR': {
    common: ptBRCommon,
    sidebar: ptBRSidebar,
    dashboard: ptBRDashboard,
    campaigns: ptBRCampaigns,
    adsets: ptBRAdsets,
    creatives: ptBRCreatives,
    audits: ptBRAudits,
    diagnostics: ptBRDiagnostics,
    rules: ptBRRules,
    integrations: ptBRIntegrations,
    settings: ptBRSettings,
    users: ptBRUsers,
    company: ptBRCompany,
    brand: ptBRBrand,
    monitoring: ptBRMonitoring,
    reports: ptBRReports,
    auth: ptBRAuth,
    privacy: ptBRPrivacy,
    terms: ptBRTerms,
    'ai-chat': ptBRAiChat,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: [
      'common', 'sidebar', 'dashboard', 'campaigns', 'adsets',
      'creatives', 'audits', 'diagnostics', 'rules', 'integrations',
      'settings', 'users', 'company', 'brand', 'monitoring',
      'reports', 'auth', 'privacy', 'terms', 'ai-chat',
    ],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'clickhero-language',
      caches: ['localStorage'],
    },
  });

export default i18n;
