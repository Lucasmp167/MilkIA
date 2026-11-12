/* ===== Ambiente (estável / testes) =====
 * O site publicado tem duas versões na mesma origem: a estável (/MilkIA/) e a de testes (/MilkIA/teste/).
 * Para a versão de testes nunca tocar nos dados da estável, todas as chaves "mq_*" do localStorage
 * ganham o prefixo "teste_" e o banco IndexedDB tem outro nome. O ambiente vem da meta tag
 * <meta name="milkiq-env">, colocada por tools/build-site.js. Sem a meta (uso local), nada muda.
 */
const MQ_ENV = (() => { try { const m = document.querySelector('meta[name="milkiq-env"]'); return m ? m.content : ""; } catch (e) { return ""; } })();
const MQ_NS = MQ_ENV == "teste" ? "teste_" : "";
if (MQ_NS && typeof Storage != "undefined") {
  const P = Storage.prototype, g = P.getItem, s = P.setItem, r = P.removeItem;
  const k = x => (String(x).startsWith("mq_") ? MQ_NS + x : x);
  P.getItem = function (x) { return g.call(this, k(x)); };
  P.setItem = function (x, v) { return s.call(this, k(x), v); };
  P.removeItem = function (x) { return r.call(this, k(x)); };
}
