import { useEffect, useMemo, useRef, useState } from 'react';
import type { SalesDocument } from '../api/client';
import { recordDocumentExport, recordPilotEvent } from '../api/client';
import { InvoiceTemplate } from '../templates/InvoiceTemplate';
import { documentPdfName, documentViewModel, paginateDocumentModel, renderDocumentPdf } from './documentPdf';
export { documentPdfName, documentViewModel, paginateDocumentModel } from './documentPdf';
import { stageExportFile } from './deliveryApi';
import { canUseTelegramDownload, canUseTelegramShare, isDeliveryCancellation, requestTelegramDownload, requestTelegramShare, openExportLink } from './telegramNativeDelivery';

const browserDownload=(blob:Blob,name:string)=>{const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
const isMobileDevice=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function DocumentExportActions({doc}:{doc:SalesDocument}){
  const model=useMemo(()=>documentViewModel(doc),[doc]);const pages=useMemo(()=>paginateDocumentModel(model),[model]);
  const refs=useRef<Array<HTMLElement|null>>([]);const prepared=useRef<Blob|null>(null);const[ready,setReady]=useState(false);const[busy,setBusy]=useState(false);const[message,setMessage]=useState('');const[downloadLink,setDownloadLink]=useState<{url:string;fileName:string;expiresAt:number}|null>(null);const filename=documentPdfName(doc);const documentTitle=doc.documentType==='proforma'?'پیش‌فاکتور':'فاکتور فروش';

  useEffect(()=>{let cancelled=false;prepared.current=null;setReady(false);void renderDocumentPdf(refs.current).then(blob=>{if(!cancelled){prepared.current=blob;setReady(true);}}).catch(()=>{if(!cancelled)setMessage('آماده‌سازی PDF انجام نشد؛ پیش‌نمایش را دوباره باز کنید.');});return()=>{cancelled=true;prepared.current=null;};},[doc.id,doc.version,model]);
  async function deliverDownload(blob:Blob,fileName:string){
    if(doc.id==='preview'){browserDownload(blob,fileName);return 'browser' as const;}
    const delivery=await stageExportFile({documentId:doc.id,purpose:'download',format:'pdf',blob,fileName,title:documentTitle});
    setDownloadLink(delivery);
    if(canUseTelegramDownload()){
      try{await requestTelegramDownload(delivery.url,delivery.fileName);return 'telegram' as const;}
      catch(error){if(isDeliveryCancellation(error))throw error;}
    }
    return 'link' as const;
  }
  async function telegramShare(blob:Blob){
    if(!canUseTelegramShare()){
      await deliverDownload(blob,filename);
      setMessage('ارسال مستقیم در این نسخهٔ تلگرام پشتیبانی نمی‌شود. از لینک ذخیرهٔ فایل زیر استفاده کنید.');return;
    }
    const delivery=await stageExportFile({documentId:doc.id,purpose:'share',format:'pdf',blob,fileName:filename,title:documentTitle});
    setDownloadLink(delivery);
    if(!delivery.preparedMessageId)throw new Error('share_not_prepared');
    await requestTelegramShare(delivery.preparedMessageId);
    void recordDocumentExport(doc.id,{format:'share',byteSize:blob.size}).catch(()=>undefined);
    setMessage('ارسال فایل در تلگرام انجام شد؛ فایل را در گفت‌وگوی انتخاب‌شده مشاهده کنید.');
  }
  async function browserShareOrDownload(blob:Blob){
    const file=new File([blob],filename,{type:'application/pdf'});
    if(isMobileDevice() && navigator.share){
      let canShareFile=false;
      try{canShareFile=!navigator.canShare||navigator.canShare({files:[file]});}catch{canShareFile=false;}
      if(canShareFile){
        try{await navigator.share({title:documentTitle,text:'سند ساخته شده با فاکتورساز بهار',files:[file]});void recordDocumentExport(doc.id,{format:'share',byteSize:blob.size}).catch(()=>undefined);setMessage('فایل با پنجره اشتراک‌گذاری دستگاه ارسال شد.');return;}
        catch(error){if(error instanceof DOMException && error.name==='AbortError')throw error;/* WebView may reject file shares despite advertising support. */}
      }
    }
    const channel=await deliverDownload(blob,file.name);
    void recordDocumentExport(doc.id,{format:'pdf',byteSize:blob.size}).catch(()=>undefined);
    setMessage(channel==='telegram'?'تلگرام پنجره ذخیره PDF را باز کرد. بعد از ذخیره، فایل را از «فایل‌ها/Downloads» با واتساپ، بله یا هر برنامهٔ دیگری اشتراک‌گذاری کنید.':'فایل آماده است؛ از دکمهٔ «ذخیره فایل در مرورگر» زیر استفاده کنید.');
  }
  async function run(action:'pdf'|'share'|'telegram'){setBusy(true);setMessage('');try{
    const blob=prepared.current;if(!blob)throw new Error('pdf_not_ready');
    if(action==='telegram'){await telegramShare(blob);return;}
    if(action==='share'){
      await browserShareOrDownload(blob);return;
    }
    const channel=await deliverDownload(blob,filename);void recordDocumentExport(doc.id,{format:'pdf',byteSize:blob.size}).catch(()=>undefined);setMessage(channel==='telegram'?'پنجره دانلود تلگرام باز شد؛ محل ذخیره را خود تلگرام/سیستم‌عامل مدیریت می‌کند.':'فایل آماده است؛ دکمهٔ «ذخیره فایل در مرورگر» زیر را بزنید و محل ذخیره را انتخاب کنید.');
  }catch(error){const cancelled=isDeliveryCancellation(error);if(!cancelled)void recordPilotEvent('export_failed',{format:action==='telegram'?'share':action,stage:action==='pdf'?'download':'share'}).catch(()=>undefined);setMessage(cancelled?(action!=='pdf'?'اشتراک‌گذاری لغو شد؛ سند شما محفوظ است.':'دانلود لغو شد؛ سند شما محفوظ است.'):'ساخت یا تحویل فایل انجام نشد؛ اطلاعات سند محفوظ است و می‌توانید دوباره تلاش کنید.');}finally{setBusy(false);}}
  return <div className="export-actions"><div className="export-buttons"><button className="primary-button" disabled={busy||!ready} onClick={()=>void run('telegram')}>ارسال فایل در تلگرام</button><button disabled={busy||!ready} onClick={()=>void run('pdf')}>دریافت PDF</button><button className="primary-button" disabled={busy||!ready} onClick={()=>void run('share')}>اشتراک‌گذاری فایل</button></div>{!ready&&!message&&<p role="status">در حال آماده‌سازی PDF…</p>}{busy&&<p role="status">در حال آماده‌سازی و تحویل فایل…</p>}{message&&<p role="status">{message}</p>}{downloadLink&&<div><p>{downloadLink.fileName}</p><a className="secondary-button" href={downloadLink.url} onClick={event=>{if(openExportLink(downloadLink.url))event.preventDefault();}} target="_blank" rel="noopener noreferrer" download={downloadLink.fileName}>ذخیره فایل در مرورگر</a><p>برای داشتن فایل داخل تلگرام، «ارسال فایل در تلگرام» را بزنید و «پیام‌های ذخیره‌شده» را انتخاب کنید. لینک ذخیره موقت است.</p></div>}<div className="export-render-stage" aria-hidden="true">{pages.map((page,index)=><div key={index} ref={node=>{refs.current[index]=node;}}><InvoiceTemplate model={page}/></div>)}</div></div>;
}
