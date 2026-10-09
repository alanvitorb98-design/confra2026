# Confra 26

App de fotos da confraternização de fim de ano 2026. É um PWA: o convidado lê o QR code, abre no navegador e adiciona à tela inicial. Funciona em Android e iPhone sem loja de apps.

## Rodar local

```bash
npm install
npm run dev
```

Pra testar no celular na mesma rede: `npm run dev -- --host` e abra o endereço mostrado.

## O que já tem

- Entrada com nome, @ do Instagram e selfie opcional (com aviso de reconhecimento facial)
- Botão de foto que abre a câmera nativa e guarda o arquivo original, sem compressão
- Foto que dá zoom para dentro de uma Polaroid escura e revela ao chacoalhar ou segurar
- Feed com reações, telas de missões, ranking e perfil

Os dados ainda são de exemplo e ficam só no aparelho. O próximo passo é ligar ao Supabase (feed, reações, login) e ao Cloudflare R2 (fotos originais).

## Publicação

Cada push na `main` publica no GitHub Pages pelo workflow `.github/workflows/pages.yml`.
