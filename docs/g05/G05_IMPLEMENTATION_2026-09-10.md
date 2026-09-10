# G05 Implementation Record — 2026-09-10

Status: implementation complete on feature branch; deployment and human acceptance require exact-SHA CI/staging evidence.

Implemented:

- six approved, versioned templates including «تجاری کلاسیک»;
- portrait and landscape layouts for every template (12 variants);
- a normalized `InvoiceViewModel` containing every defined V1 field;
- conditional rendering with no empty optional labels;
- live template/orientation preview in business settings;
- restrained template-specific colour tokens;
- integer-Rial-only creation/defaults and explicit Rial labels;
- preservation of legacy issued records without silently changing historical amounts;
- final invoice rendering contract excludes deposit/installment breakdown;
- automated registry, orientation, conditional-field, Rial, and 100-row stress tests.

Deferred to G06: PDF/image generation, print pagination and export-specific visual acceptance.
