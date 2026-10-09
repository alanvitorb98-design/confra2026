---
title: Confra Rostos
emoji: 🥂
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

Face server for the Confra da Firma app. It asks the app's `faces` function for work, reads each photo
once from a 5-minute link, and sends back only face signatures (512 numbers per face). Photos are kept
in memory only and never written to disk.

Secrets (set by `.github/workflows/faces-space.yml`): `FACE_SECRET`, `FACES_URL`.
