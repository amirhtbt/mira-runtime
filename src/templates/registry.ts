import type{TemplateDefinition,TemplateId}from'./types';
const capabilities=['logo','seller','customer','document-meta','sku','description','unit','discount','tax','shipping','service-fee','custom-adjustments','payment','notes','terms','signature','multi-item','portrait','landscape'] as const;
export const templates:readonly TemplateDefinition[]=[
 {id:'minimal',version:1,name:'مینیمال',description:'ساده، خلوت و عمومی',accent:'#2463a7',capabilities,orientations:['portrait','landscape']},
 {id:'luxury',version:1,name:'لوکس',description:'رسمی با طلایی محدود',accent:'#9a762e',capabilities,orientations:['portrait','landscape']},
 {id:'boutique',version:1,name:'بوتیک',description:'ظریف با صورتی چرک محدود',accent:'#a65c72',capabilities,orientations:['portrait','landscape']},
 {id:'modern-business',version:1,name:'تجاری مدرن',description:'ساختاریافته و سازمانی',accent:'#087da4',capabilities,orientations:['portrait','landscape']},
 {id:'bazaar',version:1,name:'بازار',description:'خوانا برای فروش روزمره',accent:'#177554',capabilities,orientations:['portrait','landscape']},
 {id:'classic-business',version:1,name:'تجاری کلاسیک',description:'جدولی، رسمی و تقریباً تک‌رنگ',accent:'#80622b',capabilities,orientations:['portrait','landscape']}
];
export function getTemplate(id:string):TemplateDefinition{return templates.find(t=>t.id===id)??templates[0];}
export function isTemplateId(id:string):id is TemplateId{return templates.some(t=>t.id===id);}
