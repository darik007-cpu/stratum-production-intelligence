/* STRATUM — wire navigation after all six bounded screen calls complete.
 * Run with figma-use skill. No text is changed by this script.
 */
const page=figma.root.children.find(p=>p.name==='STRATUM — Product');
if(!page)throw new Error('STRATUM Product page is missing.');
await figma.setCurrentPageAsync(page);
const frames=Object.fromEntries(page.children.filter(n=>n.type==='FRAME'&&/^STRATUM \/ 0[0-5]$/.test(n.name)).map(n=>[n.name.slice(-2),n]));
const targets={
 'Navigate / Field overview':'01','Navigate / Well diagnostics':'02','Navigate / Scenario lab':'03','Navigate / Action center':'04','Navigate / Data workspace':'05',
 'Button / Open workspace':'01','Button / Run a scenario':'03','Button / Inspect evidence':'02','Button / Create review':'04','Button / Add to action center':'04','Button / Save comparison':'04','Button / New review':'02','Button / Open evidence':'02','Button / Review scenario':'03',
 'Action / Review high pump load and falling production':'02','Action / Review 7-day export scenario':'03','Action / Check pressure sensor calibration':'02','Action / Confirm hub storage reading':'05','Action / Review pump operating envelope':'02','Action / Validate production CSV import':'05'
};
const mutatedNodeIds=[];
for(const frame of Object.values(frames)){
 const nodes=frame.findAll(n=>(n.type==='INSTANCE'||n.type==='FRAME')&&Object.prototype.hasOwnProperty.call(targets,n.name));
 for(const node of nodes){const destination=frames[targets[node.name]];if(!destination||destination.id===frame.id)continue;await node.setReactionsAsync([{trigger:{type:'ON_CLICK'},actions:[{type:'NODE',destinationId:destination.id,navigation:'NAVIGATE',transition:{type:'DISSOLVE',duration:.18,easing:{type:'EASE_OUT'}},resetScrollPosition:true}]}]);mutatedNodeIds.push(node.id);}
}
return {success:true,pageId:page.id,createdNodeIds:[],mutatedNodeIds,screenIds:Object.fromEntries(Object.entries(frames).map(([k,n])=>[k,n.id])),prototypeLinkCount:mutatedNodeIds.length,limitations:['Figma prototype navigation is functional. CSV import, editable scenario calculation, and the Three.js scene belong to the working app.']};
