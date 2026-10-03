// @ts-check
/** Licensed photographs of specific retail boards, not pictures of measured submissions.
 * The image license belongs to the image; it does not change the site's code license.
 * Provenance and original hashes: assets/hardware/photos.json. */
export const GPU_PHOTOS = [
 {model:'NVIDIA GeForce RTX 3060',aliases:['rtx3060','rtx306012gb'],src:'/assets/hardware/rtx-3060.jpg',board:'ZOTAC RTX 3060 12GB LHR',author:'Qurren',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',source:'https://commons.wikimedia.org/wiki/File:Zotac_GeForce_RTX_3060_12GB_VRAM_LHR_video_card.jpg'},
 {model:'NVIDIA GeForce RTX 4060',aliases:['rtx4060','rtx40608gb'],src:'/assets/hardware/rtx-4060.png',board:'ASUS Dual RTX 4060 8GB',author:'极客湾Geekerwan',license:'CC BY 3.0',licenseUrl:'https://creativecommons.org/licenses/by/3.0/',source:'https://commons.wikimedia.org/wiki/File:Video_%C3%BCber_die_GeForce_RTX_4060_(%E6%9E%81%E5%AE%A2%E6%B9%BEGeekerwan)_05.png',original:'https://www.youtube.com/watch?v=exHvYy0x66w'},
 {model:'NVIDIA GeForce RTX 4090',aliases:['rtx4090','rtx409024gb'],src:'/assets/hardware/rtx-4090.jpg',board:'ASUS ROG Strix RTX 4090',author:'Benlisquare',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',source:'https://commons.wikimedia.org/wiki/File:Asus_Strix_RTX_4090.jpg'},
 {model:'AMD Radeon RX 6600 XT',aliases:['rx6600xt','rx6600xt8gb'],src:'/assets/hardware/rx-6600-xt.jpg',board:'ASUS Dual RX 6600 XT',author:'Chi Ho Chan',license:'CC BY 2.0',licenseUrl:'https://creativecommons.org/licenses/by/2.0/',source:'https://commons.wikimedia.org/wiki/File:Asus_AMD_RX_6600_XT_GPU._With_dual_fan._(52000339764).jpg'},
 {model:'Intel(R) Arc(TM) A770 Graphics',aliases:['arca770','arca77016gb','a770','a77016gb'],src:'/assets/hardware/arc-a770.jpg',board:'Intel Arc A770 16GB',author:'Telaneo',license:'CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',source:'https://commons.wikimedia.org/wiki/File:Intel_Arc_A770_front.jpg'},
];
/** Exact desktop device names, or a small whitelist of price-search aliases.
 * No substring matching: 4060 Ti, 4090 D, laptops and different VRAM variants must not inherit photos.
 * @param {string} name */
export function gpuPhoto(name){
 const key=name.toLowerCase().replace(/^(nvidia |amd |intel )/,'').replace(/^(geforce |radeon )/,'').replace(/[^a-z0-9]/g,'');
 return GPU_PHOTOS.find(p=>p.model===name||p.aliases.includes(key))||null;
}
