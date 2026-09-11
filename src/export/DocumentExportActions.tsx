import { useMemo, useRef, useState } from 'react';
import { toBlob, toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { SalesDocument } from '../api/client';
import { recordDocumentExport } from '../api/client';
import { InvoiceTemplate } from '../templates/InvoiceTemplate';
import { getTemplate } from '../templates/registry';
import type { InvoiceViewModel, TemplateId } from '../templates/types';

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

const download=(blob:Blob,name:string)=>{const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

export function DocumentExportActions({doc}:{doc:SalesDocument}){
  const model=useMemo(()=>documentViewModel(doc),[doc]);const pages=useMemo(()=>paginateDocumentModel(model),[model]);
  const refs=useRef<Array<HTMLElement|null>>([]);const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');const filename=`${doc.documentType==='proforma'?'proforma':'invoice'}-${doc.documentNumber||doc.id}`;
  async function pngs(){await document.fonts.ready;const blobs:Blob[]=[];for(const node of refs.current){if(!node)continue;const blob=await toBlob(node,{pixelRatio:2,cacheBust:true,backgroundColor:'#ffffff'});if(!blob)throw new Error('image_export_failed');blobs.push(blob);}if(!blobs.length)throw new Error('image_export_failed');return blobs;}
  async function pdf(){await document.fonts.ready;const output=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});for(let index=0;index<refs.current.length;index++){const node=refs.current[index];if(!node)continue;if(index)output.addPage('a4','landscape');const jpeg=await toJpeg(node,{pixelRatio:2,quality:.94,cacheBust:true,backgroundColor:'#ffffff'});output.addImage(jpeg,'JPEG',0,0,297,210,undefined,'FAST');}return output.output('blob');}
  async function run(action:'png'|'pdf'|'share'){setBusy(true);setMessage('');try{if(action==='png'){const files=await pngs();files.forEach((blob,index)=>download(blob,`${filename}${files.length>1?`-${index+1}`:''}.png`));await recordDocumentExport(doc.id,{format:'png',byteSize:files.reduce((sum,file)=>sum+file.size,0)});setMessage('تصویر با کیفیت آماده و ذخیره شد.');return;}const blob=await pdf();if(action==='share'){const file=new File([blob],`${filename}.pdf`,{type:'application/pdf'});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]})))await navigator.share({title:doc.documentType==='proforma'?'پیش‌فاکتور':'فاکتور فروش',text:`${doc.customerName} · ${doc.documentNumber}`,files:[file]});else download(blob,file.name);await recordDocumentExport(doc.id,{format:'share',byteSize:blob.size});setMessage('فایل PDF آماده شد.');return;}download(blob,`${filename}.pdf`);await recordDocumentExport(doc.id,{format:'pdf',byteSize:blob.size});setMessage('PDF آماده و ذخیره شد.');}catch(error){setMessage(error instanceof DOMException&&error.name==='AbortError'?'اشتراک‌گذاری لغو شد؛ سند شما محفوظ است.':'ساخت فایل انجام نشد؛ اطلاعات سند محفوظ است و می‌توانید دوباره تلاش کنید.');}finally{setBusy(false);}}
  return <div className="export-actions"><div className="export-buttons"><button disabled={busy} onClick={()=>void run('png')}>دریافت تصویر</button><button disabled={busy} onClick={()=>void run('pdf')}>دریافت PDF</button><button className="primary-button" disabled={busy} onClick={()=>void run('share')}>اشتراک‌گذاری فایل</button></div>{message&&<p role="status">{message}</p>}<div className="export-render-stage" aria-hidden="true">{pages.map((page,index)=><div key={index} ref={node=>{refs.current[index]=node;}}><InvoiceTemplate model={page}/></div>)}</div></div>;
}
