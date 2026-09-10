-- G05 compatibility repair for business defaults saved before the versioned template engine.
-- Historical issued-document snapshots are intentionally untouched.
-- The pre-G05 settings schema allowed arbitrary template slugs and defaulted to
-- `mira-classic`; G05 accepts only the six versioned template ids.

UPDATE business_settings
SET settings_json = JSON_SET(
    settings_json,
    '$.visual.templateId',
    CASE JSON_UNQUOTE(JSON_EXTRACT(settings_json, '$.visual.templateId'))
        WHEN 'mira-classic' THEN 'classic-business'
        ELSE 'minimal'
    END
)
WHERE JSON_EXTRACT(settings_json, '$.visual.templateId') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(settings_json, '$.visual.templateId')) NOT IN (
      'minimal',
      'luxury',
      'boutique',
      'modern-business',
      'bazaar',
      'classic-business'
  );
