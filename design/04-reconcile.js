/* Resume patch: align the already-created 00 and 03 copy with the working app.
 * Run with figma-use after account tool access becomes available.
 * No page is recreated. Exact current fonts are loaded before text mutations.
 */
const page=await figma.getNodeByIdAsync('4:2');await figma.setCurrentPageAsync(page);
const changes={
 'Sarykum Field  ⌄':'Karatau Field  ⌄',
 'Sarykum Field and all displayed operating values are fictional.':'Karatau Field and all displayed operating values are fictional.',
 '15 Oct 2026 · 09:42':'23 Oct 2026 · 07:00',
 'Well limits are entered and reviewed by a production engineer.':'Constant rates. Review well and restart limits with an engineer.'
};
const candidates=page.findAllWithCriteria({types:['TEXT']}).filter(n=>Object.prototype.hasOwnProperty.call(changes,n.characters));
const fonts=new Map();for(const n of candidates)for(const segment of n.getStyledTextSegments(['fontName']))fonts.set(JSON.stringify(segment.fontName),segment.fontName);
await Promise.all([...fonts.values()].map(font=>figma.loadFontAsync(font)));
for(const n of candidates){n.characters=changes[n.characters];if(n.textAutoResize==='NONE')n.textAutoResize='HEIGHT';}
return {success:true,createdNodeIds:[],mutatedNodeIds:candidates.map(n=>n.id),updated:candidates.map(n=>({id:n.id,text:n.characters,width:n.width,height:n.height}))};
