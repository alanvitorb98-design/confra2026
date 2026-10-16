// Retired: the app no longer offers "Salvar na agenda". Kept answering so old links fail cleanly.
Deno.serve(() => new Response('indisponível', { status: 410, headers: { 'Cache-Control': 'no-store' } }))
