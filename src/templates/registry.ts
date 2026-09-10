import type{TemplateDefinition,TemplateId}from'./types';
const capabilities=['logo','seller','customer','document-meta','sku','description','unit','discount','tax','shipping','service-fee','custom-adjustments','payment','notes','terms','signature','multi-item','landscape'] as const;
export const templates:readonly TemplateDefinition[]=[
 {id:'minimal',version:1,name:'مینیمال',description:'خلوت، خوانا و بدون تزئین اضافه',accent:'#2463a7',capabilities,orientations:['landscape'],bestFor:'فریلنسرها و خدمات حرفه‌ای',structure:'هدر سبک، اطلاعات فشرده و تمرکز روی اقلام و مبلغ نهایی'},
 {id:'modern-business',version:1,name:'تجاری مدرن',description:'سازمانی، واضح و امروزی',accent:'#087da4',capabilities,orientations:['landscape'],bestFor:'شرکت‌ها و فروشگاه‌های حرفه‌ای',structure:'هدر نواری، کارت‌های اطلاعات و جمع مالی برجسته'},
 {id:'classic-business',version:1,name:'تجاری کلاسیک',description:'رسمی، جدولی و مناسب بایگانی',accent:'#80622b',capabilities,orientations:['landscape'],bestFor:'فروش رسمی و اسناد شرکتی',structure:'جدول‌های قاب‌دار، مشخصات کامل طرفین و محل مهر و امضا'}
];
export function getTemplate(id:string):TemplateDefinition{return templates.find(t=>t.id===id)??templates[0];}
export function isTemplateId(id:string):id is TemplateId{return templates.some(t=>t.id===id);}
