// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SalesDocument } from '../api/client';
const mocks = vi.hoisted(() => ({ stage:vi.fn(), download:vi.fn(), share:vi.fn(), available:vi.fn() }));
vi.mock('html-to-image',()=>({toJpeg:vi.fn(async()=> 'data:image/jpeg;base64,AA==')}));
vi.mock('jspdf',()=>({jsPDF:class { addPage(){} addImage(){} output(){return new Blob(['%PDF-test'],{type:'application/pdf'});} }}));
vi.mock('../api/client',()=>({recordDocumentExport:vi.fn(async()=>{}),recordPilotEvent:vi.fn(async()=>{})}));
vi.mock('./deliveryApi',()=>({stageExportFile:mocks.stage}));
vi.mock('./telegramNativeDelivery',()=>({canUseTelegramDownload:mocks.available,canUseTelegramShare:()=>true,requestTelegramDownload:mocks.download,requestTelegramShare:mocks.share,isDeliveryCancellation:()=>false,openExportLink:()=>false}));
import { DocumentExportActions } from './DocumentExportActions';
const doc = {id:'test-doc',version:1,documentType:'proforma',customerName:'Test',items:[],subtotalBaseUnit:'0',discountBaseUnit:'0',grandTotalBaseUnit:'0',lifecycleStatus:'draft'} as unknown as SalesDocument;
beforeEach(()=>{
  vi.clearAllMocks();
  Object.defineProperty(document,'fonts',{configurable:true,value:{ready:Promise.resolve()}});
  mocks.available.mockReturnValue(true);
  mocks.download.mockResolvedValue(undefined);
  mocks.share.mockResolvedValue(undefined);
  mocks.stage.mockResolvedValue({url:'https://example.test/file.pdf',fileName:'test.pdf',expiresAt:9999999999,preparedMessageId:'prepared'});
});
afterEach(cleanup);
it('uses Telegram download on desktop and keeps a visible HTTPS fallback',async()=>{
  render(createElement(DocumentExportActions,{doc}));
  await waitFor(()=>expect((screen.getByRole('button',{name:'دریافت PDF'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'دریافت PDF'}));
  await waitFor(()=>expect(mocks.download).toHaveBeenCalledWith('https://example.test/file.pdf','test.pdf'));
  expect(screen.getByRole('link',{name:'ذخیره فایل در مرورگر'}).getAttribute('href')).toBe('https://example.test/file.pdf');
});
it('keeps a direct link when native download fails without claiming a saved file',async()=>{
  mocks.download.mockRejectedValue(new Error('unsupported'));
  render(createElement(DocumentExportActions,{doc}));
  await waitFor(()=>expect((screen.getByRole('button',{name:'دریافت PDF'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'دریافت PDF'}));
  await screen.findByText(/فایل آماده است؛ دکمهٔ/);
  expect(screen.getByRole('link',{name:'ذخیره فایل در مرورگر'})).toBeTruthy();
});
it('prepares a PDF and opens Telegram recipient selection',async()=>{
  render(createElement(DocumentExportActions,{doc}));
  await waitFor(()=>expect((screen.getByRole('button',{name:'ارسال فایل در تلگرام'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'ارسال فایل در تلگرام'}));
  await waitFor(()=>expect(mocks.share).toHaveBeenCalledWith('prepared'));
  expect(mocks.stage.mock.calls[0][0].purpose).toBe('share');
});
