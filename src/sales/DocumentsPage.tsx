import { useEffect, useState } from 'react';
import { listSalesDocuments, type SalesDocument } from '../api/client';

const amount=(doc:SalesDocument)=>`${Number(doc.grandTotalBaseUnit).toLocaleString('fa-IR')} ${doc.currencyUnit==='toman'?'تومان':'ریال'}`;
const status=(doc:SalesDocument)=>doc.lifecycleStatus==='cancelled'?'باطل‌شده':doc.lifecycleStatus==='draft'?'پیش‌نویس':doc.documentType==='invoice'?'تسویه‌شده':doc.settlementStatus==='paid'?'تسویه کامل':doc.settlementStatus==='partial'?'پرداخت ناقص':'در انتظار پرداخت';

export function DocumentsPage({preview=false,onOpen}:{preview?:boolean;onOpen:(doc:SalesDocument)=>void}){
  const [documents,setDocuments]=useState<SalesDocument[]>([]); const [loading,setLoading]=useState(!preview); const [error,setError]=useState('');
  useEffect(()=>{if(preview){setDocuments([]);return;}let active=true;setLoading(true);void listSalesDocuments().then(value=>{if(active)setDocuments(value);}).catch(()=>{if(active)setError('فهرست اسناد دریافت نشد. دوباره تلاش کنید.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[preview]);
  return <div className="page documents-page"><header className="page-header"><span>فاکتورها و پیش‌فاکتورها</span><h1>فاکتورها</h1><p>هر سند صادرشده یا نیمه‌کاره اینجا ثبت می‌شود و می‌توانید پرداخت یا تبدیل آن را ادامه دهید.</p></header>
    {loading?<section className="empty-card" role="status"><p>در حال دریافت اسناد…</p></section>:error?<section className="empty-card" role="alert"><p>{error}</p></section>:documents.length===0?<section className="empty-card"><div className="empty-visual" aria-hidden="true"><span/><span/><span/></div><div><h2>هنوز سندی ندارید</h2><p>اولین فاکتور یا پیش‌فاکتور شما پس از ذخیره همین‌جا نمایش داده می‌شود.</p></div></section>:<section className="documents-list" aria-label="اسناد ثبت‌شده">{documents.map(doc=><button type="button" className="document-row" key={doc.id} onClick={()=>onOpen(doc)}><span className={`document-kind ${doc.documentType}`}>{doc.documentType==='proforma'?'پیش‌فاکتور':'فاکتور'}</span><span className="document-main"><strong>{doc.customerName}</strong><small><bdi dir="ltr">{doc.documentNumber??'پیش‌نویس'}</bdi> · {status(doc)}</small></span><span className="document-total"><bdi>{amount(doc)}</bdi><small>{doc.documentType==='proforma'&&doc.settlementStatus==='partial'?`مانده ${Number(doc.remainingAmountBaseUnit).toLocaleString('fa-IR')}`:'مشاهده'}</small></span></button>)}</section>}
  </div>;
}
