import test from 'node:test';
import assert from 'node:assert/strict';
import {withLocalFragments} from '../tools/local-fragments-build.mjs';
test('base-aware named links resolve to this page, with focusable skip targets and one early module',()=>{
 const input='<head><base href="../../"><script type="module" src="src/app.js"></script></head><body><a class="skip" href="#main">Skip</a><a href="#more">More</a><main id="main"><section id="more">Details</section></main></body>';
 const output=withLocalFragments(input,'en/audio-lab');
 assert.match(output,/<a class="skip" href="en\/audio-lab\/#main" data-local-fragment="main">/);
 assert.match(output,/<main id="main" tabindex="-1">/);assert.match(output,/href="en\/audio-lab\/#more" data-local-fragment="more"/);
 const page=new URL('https://example.test/sub/en/audio-lab/'),base=new URL('../../',page);
 assert.equal(new URL('en/audio-lab/#main',base).pathname,page.pathname);
 assert.equal((output.match(/data-local-fragments>/g)||[]).length,1);
 assert(output.indexOf('<base')<output.indexOf('src/local-fragments.js')&&output.indexOf('src/local-fragments.js')<output.indexOf('src/app.js'));
 assert.equal(withLocalFragments(output,'en/audio-lab'),output,'qualification is idempotent');
});
test('state hashes, absent targets, scripts and dormant templates are not rewritten',()=>{
 const input='<base href="../../"><script>const x=`<a href="#main">x</a>`;</script><template><a href="#main">Dormant</a><span id="hidden"></span></template><a href="#state=abc">State</a><a href="#hidden">Absent</a><main id="main"></main>';
 assert.equal(withLocalFragments(input,'en/game/studio'),input);
 assert.equal(withLocalFragments('<a href="#main">Skip</a><main id="main"></main>','en/a'),'<a href="#main">Skip</a><main id="main"></main>');
});
test('encoded targets and explicit tabindex are preserved without treating data-id as id',()=>{
 const input='<base href="../"><a class="gs-skip" href="#%EB%B3%B8%EB%AC%B8">Skip</a><main id="본문" tabindex="0"></main><a href="#fake">No</a><div data-id="fake"></div>';
 const out=withLocalFragments(input,'ko');assert.match(out,/data-local-fragment="본문"/);assert.match(out,/<main id="본문" tabindex="0">/);assert.match(out,/<a href="#fake">/);
});
