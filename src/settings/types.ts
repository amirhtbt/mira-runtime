/** Legacy `toman` is readable for historical API snapshots; G05 creates only Rial documents. */
export type CurrencyUnit = 'toman' | 'rial';
export type DigitStyle = 'persian' | 'latin';
export type CalendarStyle = 'jalali' | 'gregorian';
export type NumberingMode = 'auto' | 'manual';
export type DiscountKind = 'none' | 'fixed' | 'percent';

export interface SellerSettings {
  businessName: string;
  displayName: string;
  subtitle: string;
  sellerName: string;
  phone: string;
  telegramUsername: string;
  address: string;
  showAddress: boolean;
  customContactLine: string;
}

export interface OfficialSellerSettings {
  companyName: string;
  address: string;
  phone: string;
  nationalId: string;
}

export interface PaymentSettings {
  accounts?: Array<{cardNumber:string;sheba:string;bankName:string;accountHolder:string}>;
  cardNumber: string;
  accountNumber: string;
  sheba: string;
  bankName: string;
  accountHolder: string;
  instructions: string;
}

export interface DocumentSettings {
  proformaLabel: string;
  invoiceLabel: string;
  numberingMode: NumberingMode;
  proformaPrefix: string;
  invoicePrefix: string;
  numberPadding: number;
  issueDateMode: 'today' | 'manual';
  validityDays: number;
  calendar: CalendarStyle;
  digits: DigitStyle;
}

export interface PresentationSettings {
  currencyUnit: CurrencyUnit;
  thousandsSeparator: boolean;
  decimalPolicy: 'none' | 'auto';
  roundTotal: 'none' | 'nearest10' | 'nearest100' | 'nearest1000';
}

export interface ItemVisibilitySettings {
  rowNumber: boolean;
  sku: boolean;
  image: boolean;
  title: boolean;
  description: boolean;
  unit: boolean;
  quantity: boolean;
  unitPrice: boolean;
  lineDiscount: boolean;
  tax: boolean;
  lineTotal: boolean;
}

export interface CustomAdjustmentDefault {
  label: string;
  direction: 'surcharge' | 'discount';
  amountBaseUnit: string;
}

export interface FinancialSettings {
  discount: { kind: DiscountKind; amountBaseUnit: string; percentBasisPoints: number };
  shippingAmountBaseUnit: string;
  serviceFeeAmountBaseUnit: string;
  taxEnabled: boolean;
  taxRateBasisPoints: number;
  customAdjustments: CustomAdjustmentDefault[];
}

export interface TextSettings {
  sellerNote: string;
  paymentTerms: string;
  shippingTerms: string;
  footer: string;
  validityNotice: string;
  thankYou: string;
}

export interface VisualSettings {
  templateId: string;
  accent: string;
  invoiceVariant: 'auto' | 'light' | 'dark';
  logoPosition: 'start' | 'center' | 'end';
  density: 'compact' | 'comfortable';
  fontSize: 'small' | 'medium' | 'large';
}

export interface BusinessSettings {
  seller: SellerSettings;
  payment: PaymentSettings;
  officialSeller: OfficialSellerSettings;
  officialPayment: PaymentSettings;
  document: DocumentSettings;
  presentation: PresentationSettings;
  items: ItemVisibilitySettings;
  financial: FinancialSettings;
  text: TextSettings;
  visual: VisualSettings;
}

export interface LogoMetadata {
  present: boolean;
  mimeType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  updatedAt: string | null;
}

export interface SettingsResponse {
  schemaVersion: number;
  settings: BusinessSettings;
  version: number;
  updatedAt: string | null;
  logo: LogoMetadata;
  officialLogo: LogoMetadata;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type SettingsPatch = DeepPartial<BusinessSettings>;
