/* STRATUM — editable Figma foundations.
 * Run as the body of use_figma; no wrapper is required.
 * Skills: figma-use, figma-generate-library.
 * Helpers below adapt the shipped createVariableCollection,
 * createSemanticTokens, createComponentWithVariants and binding scripts.
 * This script creates one page only and returns every created node ID.
 */
const PAGE_NAME = 'STRATUM — Foundations';
const createdNodeIds = [];
const mutatedNodeIds = [];
const createdVariableIds = [];
const createdCollectionIds = [];
const createdStyleIds = [];
const page = figma.root.children.find(p => p.name === PAGE_NAME) || figma.createPage();
if (page.name !== PAGE_NAME) { page.name = PAGE_NAME; createdNodeIds.push(page.id); }
await figma.setCurrentPageAsync(page);

const availableFonts = await figma.listAvailableFontsAsync();
const inter = availableFonts.filter(f => f.fontName.family === 'Inter').map(f => f.fontName);
if (!inter.length) throw new Error('Inter is required but is unavailable in this file.');
function fontFor(weight) {
  const styleLists = { regular:['Regular'], medium:['Medium','Regular'], semibold:['Semi Bold','SemiBold','Bold'], bold:['Bold','Semi Bold','SemiBold'] };
  for (const style of styleLists[weight]) { const match=inter.find(f=>f.style===style); if(match) return match; }
  return inter[0];
}
const fonts = {regular:fontFor('regular'),medium:fontFor('medium'),semibold:fontFor('semibold'),bold:fontFor('bold')};
await Promise.all(Object.values(fonts).map(f=>figma.loadFontAsync(f)));

function rgb(hex) { const h=hex.replace('#',''); return {r:parseInt(h.slice(0,2),16)/255,g:parseInt(h.slice(2,4),16)/255,b:parseInt(h.slice(4,6),16)/255}; }
async function createVariableCollection(name, modeNames) {
  const collections=await figma.variables.getLocalVariableCollectionsAsync();
  let collection=collections.find(c=>c.name===name);
  if(!collection) { collection=figma.variables.createVariableCollection(name); collection.renameMode(collection.modes[0].modeId,modeNames[0]); createdCollectionIds.push(collection.id); }
  return {collection,modeIds:Object.fromEntries(collection.modes.map(m=>[m.name,m.modeId]))};
}
async function createSemanticTokens(collection, modeIds, tokenMap) {
  const existing=(await figma.variables.getLocalVariablesAsync()).filter(v=>v.variableCollectionId===collection.id);
  const variables={};
  for(const token of tokenMap) {
    let v=existing.find(v=>v.name===token.name);
    if(!v) { v=figma.variables.createVariable(token.name,collection,token.type); createdVariableIds.push(v.id); }
    for(const [mode,value] of Object.entries(token.values)) v.setValueForMode(modeIds[mode],value);
    v.scopes=token.scopes || [];
    v.setVariableCodeSyntax('WEB',token.css || `var(--stratum-${token.name.replace(/[\s/]+/g,'-').toLowerCase()})`);
    variables[token.name]=v;
  }
  return {variables};
}
const primitiveCollection=await createVariableCollection('STRATUM / Primitives',['Value']);
const palette={navy:'#081215',panel:'#102025',elevated:'#172B30',border:'#24373B',white:'#EDF5F0',muted:'#8FA4A6',lime:'#D5F87A',cyan:'#67D8E5',amber:'#F2BF75',red:'#ED8E81',ink:'#162211',black:'#03090B'};
const primitives=(await createSemanticTokens(primitiveCollection.collection,primitiveCollection.modeIds,Object.entries(palette).map(([name,hex])=>({name:`palette/${name}`,type:'COLOR',values:{Value:{...rgb(hex),a:1}},scopes:[]})))).variables;
const semanticCollection=await createVariableCollection('STRATUM / Semantic',['Dark']);
const colorDefinitions={
  'color/bg/canvas':['navy',['FRAME_FILL','SHAPE_FILL']],
  'color/bg/panel':['panel',['FRAME_FILL','SHAPE_FILL']],
  'color/bg/elevated':['elevated',['FRAME_FILL','SHAPE_FILL']],
  'color/text/primary':['white',['TEXT_FILL']],
  'color/text/secondary':['muted',['TEXT_FILL']],
  'color/text/on-accent':['ink',['TEXT_FILL']],
  'color/border/default':['border',['STROKE_COLOR']],
  'color/accent/primary':['lime',['FRAME_FILL','SHAPE_FILL','TEXT_FILL','STROKE_COLOR']],
  'color/accent/data':['cyan',['FRAME_FILL','SHAPE_FILL','TEXT_FILL','STROKE_COLOR']],
  'color/status/warning':['amber',['FRAME_FILL','SHAPE_FILL','TEXT_FILL','STROKE_COLOR']],
  'color/status/critical':['red',['FRAME_FILL','SHAPE_FILL','TEXT_FILL','STROKE_COLOR']]
};
const semantic=(await createSemanticTokens(semanticCollection.collection,semanticCollection.modeIds,Object.entries(colorDefinitions).map(([name,[p,scopes]])=>({name,type:'COLOR',values:{Dark:{type:'VARIABLE_ALIAS',id:primitives[`palette/${p}`].id}},scopes})))).variables;
const dimensionCollection=await createVariableCollection('STRATUM / Dimensions',['Value']);
const spacing={ 'spacing/1':4,'spacing/2':8,'spacing/3':12,'spacing/4':16,'spacing/5':20,'spacing/6':24,'spacing/8':32,'spacing/10':40,'spacing/12':48,'radius/sm':6,'radius/md':10,'radius/lg':16,'radius/full':999 };
const dimensions=(await createSemanticTokens(dimensionCollection.collection,dimensionCollection.modeIds,Object.entries(spacing).map(([name,value])=>({name,type:'FLOAT',values:{Value:value},scopes:name.startsWith('radius')?['CORNER_RADIUS']:['GAP']})))).variables;
const tokens={...semantic,...dimensions};

const styleDefinitions={Display:[52,58,'semibold'],Headline:[28,36,'semibold'],Title:[18,26,'semibold'],Body:[14,22,'regular'],Label:[13,18,'medium'],Caption:[11,16,'medium'],Metric:[32,38,'semibold'],SmallMetric:[22,28,'semibold']};
const localTextStyles=await figma.getLocalTextStylesAsync();
const styles={};
for(const [key,[size,lineHeight,weight]] of Object.entries(styleDefinitions)) {
  let s=localTextStyles.find(s=>s.name===`STRATUM / ${key}`);
  if(!s) {s=figma.createTextStyle();s.name=`STRATUM / ${key}`;createdStyleIds.push(s.id);}
  s.fontName=fonts[weight]; s.fontSize=size;s.lineHeight={unit:'PIXELS',value:lineHeight};
  s.letterSpacing={unit:'PERCENT',value:key==='Display'?-3:key==='Metric'?-2:0};styles[key]=s;
}
const bindPaint=(key,opacity=1)=>({...figma.variables.setBoundVariableForPaint({type:'SOLID',color:rgb('#FFFFFF')},'color',tokens[key]),opacity});
function bindFrame(node,fill='color/bg/panel',radius='radius/md') {
  node.fills=fill?[bindPaint(fill)]:[];
  if(radius) for(const field of ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']) node.setBoundVariable(field,tokens[radius]);
}
function al(parent,name,direction,w,h,fill=null,gap=12,pad=0) {
  const n=figma.createAutoLayout(direction);n.name=name;parent.appendChild(n);n.resize(w,h);
  n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='FIXED';n.itemSpacing=gap;
  n.paddingTop=pad;n.paddingBottom=pad;n.paddingLeft=pad;n.paddingRight=pad;
  bindFrame(n,fill,null);n.clipsContent=false;
  const gapToken=Object.keys(spacing).find(k=>k.startsWith('spacing')&&spacing[k]===gap);if(gapToken)n.setBoundVariable('itemSpacing',tokens[gapToken]);
  const padToken=Object.keys(spacing).find(k=>k.startsWith('spacing')&&spacing[k]===pad);if(padToken)for(const k of ['paddingTop','paddingBottom','paddingLeft','paddingRight'])n.setBoundVariable(k,tokens[padToken]);
  return n;
}
function text(parent,name,value,style='Body',color='color/text/primary',width) {
  const n=figma.createText();n.name=name;n.fontName=fonts.regular;parent.appendChild(n);n.textStyleId=styles[style].id;
  n.textAutoResize=width?'HEIGHT':'WIDTH_AND_HEIGHT';if(width)n.resize(width,30);n.characters=value;if(width)n.textAutoResize='HEIGHT';n.fills=[bindPaint(color)];return n;
}
function property(owner,node,label,value) {const key=owner.addComponentProperty(label,'TEXT',value);node.componentPropertyReferences={characters:key};return key;}
const iconPaths={
  Overview:'<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
  Diagnostics:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  Scenarios:'<path d="M6 3v18M18 3v18M3 8h6M15 16h6"/><circle cx="6" cy="8" r="2"/><circle cx="18" cy="16" r="2"/>',
  Actions:'<path d="m4 12 5 5L20 6M4 4h6M16 20h4"/>',
  Data:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  Arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  Plus:'<path d="M12 4v16M4 12h16"/>'
};
const iconIds={};let libraryX=2400;let libraryY=100;
for(const [name,paths]of Object.entries(iconPaths)) {
  let c=page.findChild(n=>n.type==='COMPONENT'&&n.name===`STRATUM / Icon / ${name}`);
  if(!c){c=figma.createComponent();page.appendChild(c);c.name=`STRATUM / Icon / ${name}`;c.resize(20,20);c.fills=[];c.description=`Editable ${name.toLowerCase()} navigation icon.`;const v=figma.createNodeFromSvg(`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FA4A6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`);c.appendChild(v);v.x=0;v.y=0;}
  c.x=libraryX;c.y=libraryY;libraryY+=44;iconIds[name]=c.id;
}
async function createComponentWithVariants(name,axis,values,w,h,build) {
  let set=page.findChild(n=>n.type==='COMPONENT_SET'&&n.name===name);
  if(set)return set;
  const parts=[];
  for(const value of values){const c=figma.createComponent();page.appendChild(c);c.name=`${axis}=${value}`;c.layoutMode='HORIZONTAL';c.resize(w,h);c.primaryAxisSizingMode='FIXED';c.counterAxisSizingMode='FIXED';c.itemSpacing=8;c.counterAxisAlignItems='CENTER';await build(c,value);parts.push(c);}
  set=figma.combineAsVariants(parts,page);set.name=name;set.description=`STRATUM ${name.split(' / ').pop()} family. Reuse these variants and edit exposed text properties.`;
  for(let i=0;i<parts.length;i++){parts[i].x=24+(i%3)*(w+20);parts[i].y=24+Math.floor(i/3)*(h+20);}
  set.resizeWithoutConstraints(48+Math.min(3,parts.length)*(w+20)-20,48+Math.ceil(parts.length/3)*(h+20)-20);set.x=libraryX;set.y=libraryY;libraryY+=set.height+100;return set;
}
const button=await createComponentWithVariants('STRATUM / Button','Style',['Primary','Secondary','Ghost','Disabled'],154,42,async(c,v)=>{
  c.primaryAxisAlignItems='CENTER';c.paddingLeft=16;c.paddingRight=16;bindFrame(c,v==='Primary'?'color/accent/primary':v==='Secondary'?'color/bg/elevated':null,'radius/sm');
  if(v==='Secondary'){c.strokes=[bindPaint('color/border/default')];c.strokeWeight=1;}
  if(v==='Disabled')c.opacity=.4;
  text(c,'Label','View details','Label',v==='Primary'?'color/text/on-accent':'color/text/primary');
});
if(!Object.keys(button.componentPropertyDefinitions).some(k=>k.startsWith('Label#'))){const key=button.addComponentProperty('Label','TEXT','View details');for(const c of button.children)c.findOne(n=>n.type==='TEXT'&&n.name==='Label').componentPropertyReferences={characters:key};}
const badge=await createComponentWithVariants('STRATUM / Badge','Tone',['Positive','Warning','Critical','Neutral'],116,26,async(c,v)=>{
  c.paddingLeft=10;c.paddingRight=10;bindFrame(c,'color/bg/elevated','radius/full');const colors={Positive:'color/accent/primary',Warning:'color/status/warning',Critical:'color/status/critical',Neutral:'color/text/secondary'};text(c,'Label',v==='Positive'?'Within limits':v==='Warning'?'Review needed':v==='Critical'?'Action required':'Demo dataset','Caption',colors[v]);
});
if(!Object.keys(badge.componentPropertyDefinitions).some(k=>k.startsWith('Label#'))){const key=badge.addComponentProperty('Label','TEXT','Within limits');for(const c of badge.children)c.findOne(n=>n.type==='TEXT'&&n.name==='Label').componentPropertyReferences={characters:key};}
const nav=await createComponentWithVariants('STRATUM / Navigation','State',['Default','Selected'],184,44,async(c,v)=>{
  c.paddingLeft=14;c.paddingRight=14;c.itemSpacing=12;bindFrame(c,v==='Selected'?'color/bg/elevated':null,'radius/sm');const icon=(await figma.getNodeByIdAsync(iconIds.Overview)).createInstance();c.appendChild(icon);icon.name='Icon';text(c,'Label','Field overview','Label',v==='Selected'?'color/text/primary':'color/text/secondary');
});
if(!Object.keys(nav.componentPropertyDefinitions).some(k=>k.startsWith('Label#'))){const key=nav.addComponentProperty('Label','TEXT','Field overview');for(const c of nav.children)c.findOne(n=>n.type==='TEXT'&&n.name==='Label').componentPropertyReferences={characters:key};}
if(!Object.keys(nav.componentPropertyDefinitions).some(k=>k.startsWith('Icon#'))){const key=nav.addComponentProperty('Icon','INSTANCE_SWAP',iconIds.Overview);for(const c of nav.children)c.findOne(n=>n.type==='INSTANCE'&&n.name==='Icon').componentPropertyReferences={mainComponent:key};}
let metric=page.findChild(n=>n.type==='COMPONENT'&&n.name==='STRATUM / Metric');
if(!metric){metric=figma.createComponent();page.appendChild(metric);metric.name='STRATUM / Metric';metric.layoutMode='VERTICAL';metric.resize(256,108);metric.primaryAxisSizingMode='FIXED';metric.counterAxisSizingMode='FIXED';metric.itemSpacing=4;bindFrame(metric,null,null);const title=text(metric,'Title','Oil production','Label','color/text/secondary');const value=text(metric,'Value','12,480','Metric');const meta=text(metric,'Meta','bbl/d · +2.4% vs yesterday','Caption','color/accent/primary');property(metric,title,'Title','Oil production');property(metric,value,'Value','12,480');property(metric,meta,'Meta','bbl/d · +2.4% vs yesterday');metric.description='Primary operational metric. Set title, value, and contextual metadata. Values in the concept are illustrative.';metric.x=libraryX;metric.y=libraryY;libraryY+=160;}
const input=await createComponentWithVariants('STRATUM / Input','State',['Default','Focused'],272,72,async(c,v)=>{
  c.layoutMode='VERTICAL';c.counterAxisAlignItems='MIN';c.itemSpacing=8;c.paddingTop=10;c.paddingBottom=10;c.paddingLeft=14;c.paddingRight=14;bindFrame(c,'color/bg/canvas','radius/sm');c.strokes=[bindPaint(v==='Focused'?'color/accent/primary':'color/border/default')];c.strokeWeight=1;text(c,'Label','Export capacity','Caption','color/text/secondary');text(c,'Value','8,500 bbl/d','Title');
});
if(!Object.keys(input.componentPropertyDefinitions).some(k=>k.startsWith('Label#'))){for(const label of ['Label','Value']){const key=input.addComponentProperty(label,'TEXT',label==='Label'?'Export capacity':'8,500 bbl/d');for(const c of input.children)c.findOne(n=>n.type==='TEXT'&&n.name===label).componentPropertyReferences={characters:key};}}

let specimen=page.findChild(n=>n.type==='FRAME'&&n.name==='STRATUM / Foundations review');
if(!specimen){
  const maxX=Math.max(0,...page.children.filter(n=>n.x<2000).map(n=>n.x+n.width));
  specimen=al(page,'STRATUM / Foundations review','VERTICAL',1440,1340,'color/bg/canvas',32,64);specimen.x=maxX+160;specimen.y=100;
  text(specimen,'Eyebrow','STRATUM  /  DESIGN FOUNDATION','Caption','color/accent/primary');
  text(specimen,'Title','Precision without the noise.','Display');
  text(specimen,'Description','A focused oilfield workspace for the next decision. Dark instrument surfaces, legible evidence, and deliberate use of color.','Body','color/text/secondary',1000);
  const paletteRow=al(specimen,'Semantic palette','HORIZONTAL',1312,116,null,16,0);
  for(const [label,key]of [['Canvas','color/bg/canvas'],['Surface','color/bg/panel'],['Structure','color/border/default'],['Action','color/accent/primary'],['Telemetry','color/accent/data'],['Attention','color/status/warning']]){const swatch=al(paletteRow,label,'VERTICAL',200,108,null,8,0);const box=al(swatch,'Color','HORIZONTAL',200,64,key,0,0);box.cornerRadius=8;text(swatch,'Name',label,'Caption','color/text/secondary');}
  text(specimen,'Typography','Inter, with room to think.','Headline');
  const typeRow=al(specimen,'Type specimens','HORIZONTAL',1312,108,null,48,0);text(typeRow,'Metric specimen','12,480','Display');const typeCopy=al(typeRow,'Hierarchy','VERTICAL',720,100,null,8,0);text(typeCopy,'Section specimen','Evidence before action','Title');text(typeCopy,'Body specimen','See the change, understand the cause, and choose the next step.','Body','color/text/secondary');text(typeCopy,'Caption specimen','ILLUSTRATIVE DATA  ·  15 OCT 2026, 09:42','Caption','color/text/secondary');
  text(specimen,'Components title','A small, useful vocabulary','Headline');
  const row=al(specimen,'Button examples','HORIZONTAL',1312,64,null,16,0);for(const c of button.children){const instance=c.createInstance();row.appendChild(instance);}
  const badgeRow=al(specimen,'Status examples','HORIZONTAL',1312,40,null,16,0);for(const c of badge.children)badgeRow.appendChild(c.createInstance());
  const lower=al(specimen,'Component examples','HORIZONTAL',1312,140,null,48,0);lower.appendChild(nav.children[1].createInstance());lower.appendChild(metric.createInstance());lower.appendChild(input.children[0].createInstance());
  text(specimen,'Usage note','Lime guides action. Cyan carries measured data. Amber marks a decision that needs attention. All screen values belong to a clearly identified demo dataset.','Body','color/text/secondary',1000);
}
const allComponentNodes=[button,badge,nav,metric,input,...Object.values(iconIds).map(id=>page.findChild(n=>n.id===id))];
const nodes=[specimen,...allComponentNodes];
for(const root of nodes){createdNodeIds.push(root.id);if('findAll'in root)createdNodeIds.push(...root.findAll(()=>true).map(n=>n.id));}
const componentMap={
  Button:Object.fromEntries(button.children.map(n=>[n.variantProperties.Style,n.id])),
  Badge:Object.fromEntries(badge.children.map(n=>[n.variantProperties.Tone,n.id])),
  Navigation:Object.fromEntries(nav.children.map(n=>[n.variantProperties.State,n.id])),
  Metric:metric.id,
  Input:Object.fromEntries(input.children.map(n=>[n.variantProperties.State,n.id])),
  Icons:iconIds
};
return {
  success:true,pageId:page.id,reviewFrameId:specimen.id,
  createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds,
  createdCollectionIds,createdVariableIds,createdStyleIds,
  collections:{primitives:primitiveCollection.collection.id,semantic:semanticCollection.collection.id,dimensions:dimensionCollection.collection.id},
  variables:Object.fromEntries(Object.entries(tokens).map(([k,v])=>[k,v.id])),
  styles:Object.fromEntries(Object.entries(styles).map(([k,v])=>[k,v.id])),
  fonts,components:componentMap,
  validation:{componentSets:4,standaloneComponents:8,colorTokens:Object.keys(semantic).length,dimensionTokens:Object.keys(dimensions).length,reviewBounds:{width:specimen.width,height:specimen.height}}
};
