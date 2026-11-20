import type { SettingsSource } from '../settings/SettingsPage';
import type { LogoMetadata, SettingsPatch } from '../settings/types';
import { defaultOfflineSettings } from './offlineSettings';
import type { OfflineStore } from './offlineStore';

export function offlineSettingsSource(store: OfflineStore, onChange: () => Promise<void>) {
  const urls = { logo: '', officialLogo: '' };
  const keys = ['logo', 'officialLogo'] as const;
  function logoMetadata(key: typeof keys[number], blob?: Blob): LogoMetadata {
    if (urls[key]) URL.revokeObjectURL(urls[key]);
    urls[key] = blob ? URL.createObjectURL(blob) : '';
    return {
      present: Boolean(blob), mimeType: blob?.type ?? null, byteSize: blob?.size ?? null,
      width: null, height: null, updatedAt: urls[key] || null,
    };
  }
  async function getBusinessSettings() {
    const profile = await store.getProfile();
    return {
      schemaVersion: 1, version: 1, updatedAt: null, settings: profile?.settings ?? defaultOfflineSettings(),
      logo: logoMetadata('logo', profile?.logo), officialLogo: logoMetadata('officialLogo', profile?.officialLogo),
    };
  }
  async function saveLogo(key: typeof keys[number], file?: File) {
    const profile = await store.getProfile() ?? { settings: defaultOfflineSettings() };
    await store.saveProfile({ ...profile, [key]: file });
    await onChange();
    return logoMetadata(key, file);
  }
  const source: SettingsSource = {
    getBusinessSettings,
    async updateBusinessSettings(patch: SettingsPatch) {
      const profile = await store.getProfile() ?? { settings: defaultOfflineSettings() };
      // Both shared screens send complete edited groups, except the template's visual patch.
      const settings = { ...profile.settings, ...patch,
        visual: { ...profile.settings.visual, ...patch.visual },
      } as typeof profile.settings;
      await store.saveProfile({ ...profile, settings });
      await onChange();
      return getBusinessSettings();
    },
    recordPilotEvent: () => Promise.resolve(),
    businessLogoUrl: () => urls.logo,
    officialLogoUrl: () => urls.officialLogo,
    uploadBusinessLogo: file => saveLogo('logo', file),
    uploadOfficialLogo: file => saveLogo('officialLogo', file),
    deleteBusinessLogo: () => saveLogo('logo'),
    deleteOfficialLogo: () => saveLogo('officialLogo'),
  };
  return {
    source,
    dispose() { for (const key of keys) if (urls[key]) URL.revokeObjectURL(urls[key]); },
  };
}
