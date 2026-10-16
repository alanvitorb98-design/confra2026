# Núcleo comum + tema

Este app tem duas cópias: **confra2026** (Confra da Firma) e **instante-fotos** (casamento Letícia & Alisson). O código é o mesmo; só o tema muda.

- **`src/brand/`** é o tema deste evento: `brand.ts` (nomes, textos, datas, prefixos das chaves guardadas no celular, endereço e chave pública do Supabase, cores usadas fora do CSS), `brand.css` (cores, fontes e regras que são só deste visual) e a arte da cena (`PartyScene.tsx`).
- **Todo o resto de `src/`** precisa ficar idêntico byte a byte nas duas cópias. Uma correção feita numa cópia é copiada como está para a outra. Se algo precisa ser diferente, vira um campo em `BRAND` (ou um token em `brand.css`) em vez de um `if` por evento.
- Arquivos fora de `src/` (migrations, funções, workflows, `vite.config.ts`, `index.html`, `public/`) continuam podendo diferir.

Para comparar as duas cópias:

```bash
node scripts/check-core.mjs > a.txt    # nesta cópia
node scripts/check-core.mjs > b.txt    # na outra
diff a.txt b.txt                       # sem saída = núcleo igual
```
