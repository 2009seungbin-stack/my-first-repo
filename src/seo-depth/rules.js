/** Minimum entries per section and type (docs/SEO-CONTENT-MODEL.md, "Types"). `|` = one of. */
export const REQUIRED=Object.freeze({
 conversion:{answer:1,concept:1,example:1,mapping:4,outputs:2,target:4,verify:2,trouble:4,alternatives:2,versions:1},
 engine:{answer:1,concept:1,example:1,outputs:1,target:4,verify:1,trouble:4,alternatives:1,versions:1},
 troubleshoot:{answer:1,concept:1,trouble:4,verify:2,'example|mapping':1,versions:1},
 create:{answer:1,concept:1,example:1,'verify|target':1,trouble:3,alternatives:2},
 format:{answer:1,concept:1,'example|mapping':1,'outputs|target':1,trouble:3,versions:1},
 compare:{answer:1,concept:1,alternatives:2,limits:3,versions:1},
 tool:{answer:1,concept:1,example:1,verify:1,trouble:3,alternatives:1,limits:1}
});
