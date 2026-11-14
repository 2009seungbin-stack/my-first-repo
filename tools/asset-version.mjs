import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
/** A stable URL for directly linked text code, normalizing checkout line endings. */
export function versionedAsset(file){
 const url=new URL(file,root);
 if(!url.href.startsWith(root.href)||url.search||url.hash)throw Error('Expected a repository-relative public asset');
 const source=readFileSync(url,'utf8').replace(/\r\n/g,'\n');
 return file+'?v='+createHash('sha256').update(source).digest('hex').slice(0,12);
}
