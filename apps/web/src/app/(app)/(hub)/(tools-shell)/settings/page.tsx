import type { Metadata } from 'next';

import { getRequestLocale } from '@/i18n/runtime/get-request-locale';
import { loadMessages } from '@/i18n/runtime/load-messages';
import { RequestTimeMetadataMarker } from '@/shared/presentation/components/request-time-metadata-marker';

import { HomeI18nToolbar } from '../../../home-i18n-toolbar';
import { SettingsHeading } from './settings-heading';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  return {
    title: messages.settings,
  };
}

export default function SettingsPage() {
  return (
    <div>
      <SettingsHeading />
      <HomeI18nToolbar />
      <RequestTimeMetadataMarker />
    </div>
  );
}
