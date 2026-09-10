-- Map only editable business defaults. Issued document snapshots remain immutable.
UPDATE business_settings
SET settings_json = JSON_SET(
  settings_json,
  '$.visual.templateId',
  CASE JSON_UNQUOTE(JSON_EXTRACT(settings_json, '$.visual.templateId'))
    WHEN 'luxury' THEN 'classic-business'
    WHEN 'boutique' THEN 'minimal'
    WHEN 'bazaar' THEN 'modern-business'
    ELSE JSON_UNQUOTE(JSON_EXTRACT(settings_json, '$.visual.templateId'))
  END
)
WHERE JSON_UNQUOTE(JSON_EXTRACT(settings_json, '$.visual.templateId')) IN ('luxury', 'boutique', 'bazaar');
