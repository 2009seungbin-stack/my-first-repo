// @ts-check
import {makeSample} from './sample.js';
const sample=makeSample('studio');
export const catalog=/** @type {import('../core/types').CatalogEntry[]} */([
 {id:'logic-pro',name:'Logic Pro',vendor:'Apple',category:'DAW',aliases:['Logic'],vendorUrl:'https://www.apple.com/logic-pro/'},
 {id:'ableton-live',name:'Ableton Live',vendor:'Ableton',category:'DAW',aliases:['Live'],vendorUrl:'https://help.ableton.com/'},
 {id:'reaper',name:'REAPER',vendor:'Cockos',category:'DAW',aliases:[],vendorUrl:'https://www.reaper.fm/'},
 {id:'cubase',name:'Cubase',vendor:'Steinberg',category:'DAW',aliases:[],vendorUrl:'https://www.steinberg.net/cubase/'},
 {id:'pro-tools',name:'Pro Tools',vendor:'Avid',category:'DAW',aliases:[],vendorUrl:'https://www.avid.com/pro-tools'},
 {id:'fabfilter-pro-q',name:'FabFilter Pro-Q',vendor:'FabFilter',category:'VST3',aliases:['Pro-Q'],vendorUrl:'https://www.fabfilter.com/support/'},
 {id:'kontakt',name:'Kontakt',vendor:'Native Instruments',category:'AU',aliases:['NI Kontakt'],vendorUrl:'https://support.native-instruments.com/'},
 {id:'native-access',name:'Native Access',vendor:'Native Instruments',category:'License Manager',aliases:['NI Native Access'],vendorUrl:'https://support.native-instruments.com/'},
 {id:'izotope-rx',name:'iZotope RX',vendor:'iZotope',category:'Standalone Application',aliases:['RX'],vendorUrl:'https://support.izotope.com/'},
 {id:'valhalla-vintageverb',name:'Valhalla VintageVerb',vendor:'Valhalla DSP',category:'AU',aliases:['VintageVerb'],vendorUrl:'https://valhalladsp.com/'},
 {id:'rme-driver',name:'RME Interface Driver',vendor:'RME',category:'Driver',aliases:['RME Driver'],vendorUrl:'https://www.rme-audio.de/downloads.html'},
 {id:'totalmix',name:'TotalMix FX',vendor:'RME',category:'Control Software',aliases:['TotalMix'],vendorUrl:'https://www.rme-audio.de/totalmix-fx.html'},
 {id:'ilok',name:'iLok License Manager',vendor:'PACE',category:'License Manager',aliases:['iLok'],vendorUrl:'https://www.ilok.com/'},
 {id:'rme-interface',name:'RME Audio Interface',vendor:'RME',category:'Audio Interface',aliases:['RME'],vendorUrl:'https://www.rme-audio.de/'},
 {id:'midi-tool',name:'MIDI Monitor',vendor:'Snoize',category:'MIDI Tool',aliases:[],vendorUrl:'https://www.snoize.com/'},
 ...sample.catalog,
]);
export const records=sample.records;
export const sampleEnvironment=sample.environment;
