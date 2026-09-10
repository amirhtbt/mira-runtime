export type TemplateId='minimal'|'luxury'|'boutique'|'modern-business'|'bazaar'|'classic-business';
export type TemplateOrientation='portrait'|'landscape';
export interface PartyViewModel{name:string;legalId?:string;economicId?:string;registrationId?:string;postalCode?:string;phone?:string;address?:string;email?:string;telegram?:string}
export interface ItemViewModel{row:number;sku?:string;title:string;description?:string;unit?:string;quantity:string;unitPriceRial:string;discountRial?:string;taxRial?:string;totalRial:string}
export interface AdjustmentViewModel{label:string;amountRial:string;direction:'discount'|'surcharge'}
export interface InvoiceViewModel{
  schemaVersion:1; documentType:'proforma'|'invoice'; documentNumber:string; issueDate:string; validUntil?:string; orderNumber?:string;
  seller:PartyViewModel&{subtitle?:string;logoUrl?:string}; customer:PartyViewModel; items:ItemViewModel[];
  subtotalRial:string; discountRial?:string; taxRial?:string; shippingRial?:string; serviceFeeRial?:string; adjustments?:AdjustmentViewModel[]; grandTotalRial:string;
  sellerNote?:string; paymentTerms?:string; shippingTerms?:string; validityNotice?:string; footer?:string; thankYou?:string;
  payment?:{cardNumber?:string;accountNumber?:string;sheba?:string;bankName?:string;accountHolder?:string;instructions?:string};
  signature?:{sellerLabel?:string;customerLabel?:string;showStampArea?:boolean}; templateId:TemplateId; templateVersion:1; orientation:TemplateOrientation;
}
export interface TemplateDefinition{id:TemplateId;version:1;name:string;description:string;accent:string;capabilities:readonly string[];orientations:readonly TemplateOrientation[]}
