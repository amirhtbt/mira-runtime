import { useMemo, useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { SalesDocument } from '../api/client';
import { recordDocumentExport, recordPilotEvent } from '../api/client';
import { InvoiceTemplate } from '../templates/InvoiceTemplate';
import { getTemplate } from '../templates/registry';
import type { InvoiceViewModel, TemplateId } from '../templates/types';
import { stageExportFile } from './deliveryApi';
import { canUseTelegramDownload, canUseTelegramShare, isDeliveryCancellation, requestTelegramDownload, requestTelegramShare } from './telegramNativeDelivery';

const pageSize = 12;
const shippingNames:Record<string,string>={pickup:'تحویل حضوری',snapp_box:'پیک اسنپ‌باکس؛ کرایه در مقصد',snapp_car:'ماشین اسنپ؛ کرایه در مقصد',snapp_van:'وانت اسنپ؛ کرایه در مقصد',post:'پست؛ کرایه در مقصد',tipax:'تیپاکس؛ کرایه در مقصد'};
const quantity=(milli:string|number)=>(Number(milli)/1000).toLocaleString('fa-IR',{maximumFractionDigits:3});
export const paginateDocumentModel=(model:InvoiceViewModel)=>Array.from({length:Math.max(1,Math.ceil(model.items.length/pageSize))},(_,index)=>({...model,items:model.items.slice(index*pageSize,(index+1)*pageSize)}));

export function documentViewModel(doc:SalesDocument):InvoiceViewModel{
  const settings=doc.settingsSnapshot;const template=getTemplate(settings?.visual.templateId||'minimal');const informal=settings?.seller;const official=settings?.officialSeller;const hasOfficialProfile=Boolean(official);const seller=doc.isOfficial&&hasOfficialProfile?official:informal;const payment=doc.isOfficial&&hasOfficialProfile?settings?.officialPayment:settings?.payment;
  return{schemaVersion:1,documentType:doc.documentType,documentNumber:doc.documentNumber||'—',issueDate:doc.issueDate||'—',validUntil:doc.validUntil||undefined,
    seller:{name:(doc.isOfficial&&hasOfficialProfile?official?.companyName:informal?.businessName||informal?.displayName)||'فروشنده',subtitle:doc.isOfficial&&hasOfficialProfile?undefined:informal?.subtitle||undefined,legalId:doc.isOfficial&&hasOfficialProfile?official?.nationalId:undefined,phone:seller?.phone||undefined,address:doc.isOfficial&&hasOfficialProfile?official?.address:(informal?.showAddress?informal.address:undefined),telegram:doc.isOfficial&&hasOfficialProfile?undefined:informal?.telegramUsername||undefined,logoUrl:doc.logoPresent?`/api/v1/documents/${encodeURIComponent(doc.id)}/logo`:undefined},
    customer:{name:doc.customerName,phone:doc.customerPhone,legalId:doc.isOfficial?doc.nationalId:undefined,address:doc.customerAddress||undefined},
    items:doc.items.map((item,index)=>({row:index+1,title:item.title,description:item.description||undefined,quantity:quantity(item.quantityMilli),unitPriceRial:String(item.unitPriceBaseUnit),discountRial:String(item.discountBaseUnit||0),taxRial:doc.isOfficial?String(item.taxBaseUnit||0):undefined,totalRial:String(item.lineTotalBaseUnit)})),
    subtotalRial:doc.subtotalBaseUnit,discountRial:doc.discountBaseUnit,taxRial:doc.isOfficial?doc.taxTotalBaseUnit:undefined,taxRateBasisPoints:doc.taxRateBasisPoints,grandTotalRial:doc.grandTotalBaseUnit,
    sellerNote:doc.notes||settings?.text.sellerNote||undefined,paymentTerms:settings?.text.paymentTerms||undefined,shippingTerms:doc.shippingMethod?shippingNames[doc.shippingMethod]:settings?.text.shippingTerms||undefined,validityNotice:settings?.text.validityNotice||undefined,footer:settings?.text.footer||undefined,thankYou:settings?.text.thankYou||undefined,
    payment:doc.documentType==='proforma'?payment:undefined,signature:{sellerLabel:'مهر و امضای فروشنده',customerLabel:'تأیید خریدار',showStampArea:true},templateId:template.id as TemplateId,templateVersion:template.version,orientation:'landscape',accent:settings?.visual.accent,cancelled:doc.lifecycleStatus==='cancelled'};
}

const browserDownload=(blob:Blob,name:string)=>{const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.rel='noopener';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};

export function DocumentExportActions({doc}:{doc:SalesDocument}){
  const model=useMemo(()=>documentViewModel(doc),[doc]);const pages=useMemo(()=>paginateDocumentModel(model),[model]);
  const refs=useRef<Array<HTMLElement|null>>([]);const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');const filename=`${doc.documentType==='proforma'?'proforma':'invoice'}-${doc.documentNumber||doc.id}`;const documentTitle=doc.documentType==='proforma'?'پیش‌فاکتور':'فاکتور فروش';
  async function pdf(){await document.fonts.ready;const output=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});for(let index=0;index<refs.current.length;index++){const node=refs.current[index];if(!node)continue;if(index)output.addPage('a4','landscape');const jpeg=await toJpeg(node,{pixelRatio:2,quality:.94,cacheBust:true,backgroundColor:'#ffffff'});output.addImage(jpeg,'JPEG',0,0,297,210,undefined,'FAST');}return output.output('blob');}
  async function deliverDownload(blob:Blob,fileName:string){
    if(canUseTelegramDownload()){
      try{const delivery=await stageExportFile({documentId:doc.id,purpose:'download',format:'pdf',blob,fileName,title:documentTitle});await requestTelegramDownload(delivery.url,delivery.fileName);return 'telegram' as const;}catch(error){if(isDeliveryCancellation(error))throw error;void recordPilotEvent('export_failed',{format:'pdf',stage:'download'}).catch(()=>undefined);}
    }
    browserDownload(blob,fileName);return 'browser' as const;
  }
  async function browserShareOrDownload(blob:Blob){
    const file=new File([blob],`${filename}.pdf`,{type:'application/pdf'});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:documentTitle,text:'سند ساخته شده با فاکتورساز بهار',files:[file]});await recordDocumentExport(doc.id,{format:'share',byteSize:blob.size});setMessage('فایل با پنجره اشتراک‌گذاری دستگاه ارسال شد.');return;}
    browserDownload(blob,file.name);await recordDocumentExport(doc.id,{format:'pdf',byteSize:blob.size});setMessage('اشتراک‌گذاری مستقیم در این نسخه در دسترس نیست؛ دانلود PDF توسط مرورگر شروع شد تا بتوانید فایل را دستی پیوست کنید.');
  }
  async function run(action:'pdf'|'share'){setBusy(true);setMessage('');try{
    const blob=await pdf();
    if(action==='share'){
      if(canUseTelegramShare()){
        let preparedMessageId:string|null=null;
        try{const delivery=await stageExportFile({documentId:doc.id,purpose:'share',format:'pdf',blob,fileName:`${filename}.pdf`,title:documentTitle});preparedMessageId=delivery.preparedMessageId;}catch{void recordPilotEvent('export_failed',{format:'share',stage:'share'}).catch(()=>undefined);}
        if(preparedMessageId){await requestTelegramShare(preparedMessageId);await recordDocumentExport(doc.id,{format:'share',byteSize:blob.size});setMessage('فایل از طریق پنجره اشتراک‌گذاری تلگرام ارسال شد.');return;}
      }
      await browserShareOrDownload(blob);return;
    }
    const channel=await deliverDownload(blob,`${filename}.pdf`);await recordDocumentExport(doc.id,{format:'pdf',byteSize:blob.size});setMessage(channel==='telegram'?'پنجره دانلود تلگرام باز شد؛ محل ذخیره را خود تلگرام/سیستم‌عامل مدیریت می‌کند.':'دانلود PDF توسط مرورگر شروع شد؛ فایل را در بخش Downloads دستگاه یا مرورگر بررسی کنید.');
  }catch(error){const cancelled=isDeliveryCancellation(error);if(!cancelled)void recordPilotEvent('export_failed',{format:action,stage:action==='share'?'share':'render'}).catch(()=>undefined);setMessage(cancelled?(action==='share'?'اشتراک‌گذاری لغو شد؛ سند شما محفوظ است.':'دانلود لغو شد؛ سند شما محفوظ است.'):'ساخت یا تحویل فایل انجام نشد؛ اطلاعات سند محفوظ است و می‌توانید دوباره تلاش کنید.');}finally{setBusy(false);}}
  return <div className="export-actions"><div className="export-buttons"><button disabled={busy} onClick={()=>void run('pdf')}>دریافت PDF</button><button className="primary-button" disabled={busy} onClick={()=>void run('share')}>اشتراک‌گذاری فایل</button></div>{message&&<p role="status">{message}</p>}<div className="export-render-stage" aria-hidden="true">{pages.map((page,index)=><div key={index} ref={node=>{refs.current[index]=node;}}><InvoiceTemplate model={page}/></div>)}</div></div>;
}
