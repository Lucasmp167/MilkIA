let STORE_OK=false;
let CORRUPT=null;let SV={ok:null,ts:null,err:null,len:0,pend:false};
function ldS(){try{localStorage.setItem("mq_t","1");localStorage.removeItem("mq_t");STORE_OK=true}catch(e){STORE_OK=false;return{sessions:[],drafts:{}}}
let raw=null;try{raw=localStorage.getItem("mq_ord")}catch(e){STORE_OK=false;return{sessions:[],drafts:{}}}
if(raw){try{const o=JSON.parse(raw);if(!o||typeof o!="object"||Array.isArray(o))throw Error("fmt");o.sessions=Array.isArray(o.sessions)?o.sessions:[];o.drafts=o.drafts&&typeof o.drafts=="object"?o.drafts:{};return o}catch(e){CORRUPT=raw;return{sessions:[],drafts:{}}}}
return{sessions:[],drafts:{}}}
function svS(){if(CORRUPT!==null){SV.ok=false;SV.err="dados ilegíveis protegidos";return false}if(!STORE_OK){SV.ok=false;SV.err="armazenamento indisponível";return false}
/* grava na cópia rápida (localStorage, conferida) e no banco do aparelho (IndexedDB, js/13-offline.js);
   se o localStorage encher, segue gravando só no IndexedDB (SV.mode="idb") */
let s;try{if(DB.meta&&typeof DB.meta=="object")DB.meta.savedAt=Date.now();s=JSON.stringify(DB)}catch(e){SV.ok=false;SV.err=String(e&&e.message||e).slice(0,60);return false}
let ok=false,er=null;try{localStorage.setItem("mq_ord",s);ok=localStorage.getItem("mq_ord")===s;if(!ok)er="conferência falhou"}catch(e){er=(e&&e.name=="QuotaExceededError")?"espaço cheio":String(e&&e.message||e).slice(0,60)}
const idb=typeof idbMirror=="function"&&idbMirror(s);SV.len=s.length;
if(ok||idb){SV.ok=true;SV.err=null;SV.ts=Date.now();SV.mode=ok?"ls":"idb";return true}SV.ok=false;SV.err=er;return false}
let DB=ldS();
