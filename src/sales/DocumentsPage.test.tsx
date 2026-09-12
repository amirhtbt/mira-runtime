// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentsPage } from './DocumentsPage';
import * as api from '../api/client';

vi.spyOn(api,'listSalesDocuments').mockResolvedValue({documents:[
  {id:'p1',customerId:'c1',customerName:'مشتری پیش‌فاکتور',documentType:'proforma',lifecycleStatus:'issued',settlementStatus:'partial',documentNumber:'PF-00001',sourceDocumentId:null,currencyUnit:'toman',subtotalBaseUnit:'10000000',discountBaseUnit:'0',surchargeBaseUnit:'0',grandTotalBaseUnit:'10000000',paidAmountBaseUnit:'3000000',remainingAmountBaseUnit:'7000000',version:3,items:[],payments:[],canIssueFinalInvoice:false},
  {id:'i1',customerId:'c2',customerName:'مشتری فاکتور',documentType:'invoice',lifecycleStatus:'issued',settlementStatus:'paid',documentNumber:'INV-00001',sourceDocumentId:null,currencyUnit:'toman',subtotalBaseUnit:'2500000',discountBaseUnit:'0',surchargeBaseUnit:'0',grandTotalBaseUnit:'2500000',paidAmountBaseUnit:'2500000',remainingAmountBaseUnit:'0',version:2,items:[],canIssueFinalInvoice:false}
],nextCursor:null});
vi.spyOn(api,'duplicateSalesDocument').mockImplementation(async()=>({id:'copy',customerId:'c1',customerName:'مشتری پیش‌فاکتور',documentType:'proforma',lifecycleStatus:'draft',settlementStatus:'unpaid',documentNumber:null,sourceDocumentId:null,currencyUnit:'rial',subtotalBaseUnit:'10000000',discountBaseUnit:'0',surchargeBaseUnit:'0',grandTotalBaseUnit:'10000000',paidAmountBaseUnit:'0',remainingAmountBaseUnit:'10000000',version:1,items:[],canIssueFinalInvoice:false}));
vi.spyOn(api,'setSalesDocumentArchived').mockImplementation(async(_id,archived)=>({id:'p1',customerId:'c1',customerName:'مشتری پیش‌فاکتور',documentType:'proforma',lifecycleStatus:'issued',settlementStatus:'partial',documentNumber:'PF-00001',sourceDocumentId:null,currencyUnit:'rial',subtotalBaseUnit:'10000000',discountBaseUnit:'0',surchargeBaseUnit:'0',grandTotalBaseUnit:'10000000',paidAmountBaseUnit:'3000000',remainingAmountBaseUnit:'7000000',version:3,items:[],payments:[],canIssueFinalInvoice:false,archivedAt:archived?'2026-09-11':null}));

describe('G04 document archive',()=>{
  it('shows issued proformas and direct invoices and reopens the selected record',async()=>{
    const open=vi.fn();render(<DocumentsPage onOpen={open}/>);
    await waitFor(()=>expect(screen.getByText('مشتری پیش‌فاکتور')).toBeTruthy());
    expect(screen.getByText('مشتری فاکتور')).toBeTruthy(); expect(screen.getByText(/مانده ۷٬۰۰۰٬۰۰۰/)).toBeTruthy();
    fireEvent.click(screen.getByText('PF-۰۰۰۰۱')); expect(open).toHaveBeenCalledWith(expect.objectContaining({id:'p1',documentType:'proforma'}));
    expect(screen.getByText('INV-۰۰۰۰۱')).toBeTruthy();
  });

  it('groups by customer and exposes server-backed filters and reuse actions',async()=>{
    const open=vi.fn();render(<DocumentsPage onOpen={open}/>);await screen.findByText('مشتری پیش‌فاکتور');
    fireEvent.change(screen.getByPlaceholderText('نام، تلفن، شماره سند یا شرح کالا'),{target:{value:'سفارش'}});
    await waitFor(()=>expect(api.listSalesDocuments).toHaveBeenLastCalledWith(expect.objectContaining({query:'سفارش'})));
    fireEvent.click(screen.getAllByRole('button',{name:'کپی برای سند جدید'})[0]);await waitFor(()=>expect(api.duplicateSalesDocument).toHaveBeenCalledWith('p1'));expect(open).toHaveBeenCalledWith(expect.objectContaining({id:'copy'}));
  });
});
