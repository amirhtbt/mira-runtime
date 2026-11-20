import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { SalesDocument } from '../api/client';
import { getTemplate } from '../templates/registry';
import type { InvoiceViewModel, TemplateId } from '../templates/types';

export function documentPdfName(doc: Pick<SalesDocument, 'documentType' | 'customerName'>): string {
  const type = doc.documentType === 'proforma' ? 'پیش‌فاکتور' : 'فاکتور';
  const clean = doc.customerName.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  return type + ' - ' + (Array.from(clean).slice(0, 90).join('').replace(/[. ]+$/, '') || 'مشتری') + '.pdf';
}

const pageSize = 12;
const shippingNames:Record<string,string>={pickup:'تحویل حضوری',snapp_box:'پیک اسنپ‌باکس؛ کرایه در مقصد',snapp_car:'ماشین اسنپ؛ کرایه در مقصد',snapp_van:'وانت اسنپ؛ کرایه در مقصد',post:'پست؛ کرایه در مقصد',tipax:'تیپاکس؛ کرایه در مقصد'};
const quantity=(milli:string|number)=>(Number(milli)/1000).toLocaleString('fa-IR',{maximumFractionDigits:3});
export const paginateDocumentModel=(model:InvoiceViewModel)=>Array.from({length:Math.max(1,Math.ceil(model.items.length/pageSize))},(_,index)=>({...model,items:model.items.slice(index*pageSize,(index+1)*pageSize)}));

export function documentViewModel(doc:SalesDocument, logoUrl = doc.logoPresent ? `/api/v1/documents/${encodeURIComponent(doc.id)}/logo` : undefined):InvoiceViewModel{
  const settings=doc.settingsSnapshot;const template=getTemplate(settings?.visual.templateId||'minimal');const informal=settings?.seller;const official=settings?.officialSeller;const hasOfficialProfile=Boolean(official);const seller=doc.isOfficial&&hasOfficialProfile?official:informal;const payment=doc.isOfficial&&hasOfficialProfile?settings?.officialPayment:settings?.payment;
  return{schemaVersion:1,documentType:doc.documentType,documentNumber:doc.documentNumber||'—',issueDate:doc.issueDate||'—',validUntil:doc.validUntil||undefined,
    seller:{name:(doc.isOfficial&&hasOfficialProfile?official?.companyName:informal?.businessName||informal?.displayName)||'فروشنده',subtitle:doc.isOfficial&&hasOfficialProfile?undefined:informal?.subtitle||undefined,legalId:doc.isOfficial&&hasOfficialProfile?official?.nationalId:undefined,phone:seller?.phone||undefined,address:doc.isOfficial&&hasOfficialProfile?official?.address:(informal?.showAddress?informal.address:undefined),telegram:doc.isOfficial&&hasOfficialProfile?undefined:informal?.telegramUsername||undefined,logoUrl},
    customer:{name:doc.customerName,phone:doc.customerPhone,legalId:doc.isOfficial?doc.nationalId:undefined,address:doc.customerAddress||undefined},
    items:doc.items.map((item,index)=>({row:index+1,title:item.title,description:item.description||undefined,quantity:quantity(item.quantityMilli),unitPriceRial:String(item.unitPriceBaseUnit),discountRial:String(item.discountBaseUnit||0),taxRial:doc.isOfficial?String(item.taxBaseUnit||0):undefined,totalRial:String(item.lineTotalBaseUnit)})),
    subtotalRial:doc.subtotalBaseUnit,discountRial:doc.discountBaseUnit,taxRial:doc.isOfficial?doc.taxTotalBaseUnit:undefined,taxRateBasisPoints:doc.taxRateBasisPoints,grandTotalRial:doc.grandTotalBaseUnit,
    sellerNote:doc.notes||settings?.text.sellerNote||undefined,paymentTerms:settings?.text.paymentTerms||undefined,shippingTerms:doc.shippingMethod?shippingNames[doc.shippingMethod]:settings?.text.shippingTerms||undefined,validityNotice:settings?.text.validityNotice||undefined,footer:settings?.text.footer||undefined,thankYou:settings?.text.thankYou||undefined,
    payment:doc.documentType==='proforma'?payment:undefined,signature:{sellerLabel:'مهر و امضای فروشنده',customerLabel:'تأیید خریدار',showStampArea:true},templateId:template.id as TemplateId,templateVersion:template.version,orientation:'landscape',accent:settings?.visual.accent,cancelled:doc.lifecycleStatus==='cancelled'};
}

export async function renderDocumentPdf(pages: readonly (HTMLElement | null)[]): Promise<Blob> {
  if (pages.length === 0) throw new Error('pdf_pages_missing');
  await document.fonts.ready;
  const output = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  for (const [index, page] of pages.entries()) {
    if (!page) throw new Error('pdf_page_missing');
    if (index) output.addPage('a4', 'landscape');
    const jpeg = await toJpeg(page, { pixelRatio: 2, quality: .94, cacheBust: true, backgroundColor: '#ffffff' });
    output.addImage(jpeg, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
  }
  return output.output('blob');
}
