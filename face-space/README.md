Face worker for the Confra da Firma app. It asks the app's `faces` function for work, reads each photo
once from a 5-minute link, and sends back only face signatures (512 numbers per face). Photos are kept
in memory only and never written to disk.

It runs on GitHub Actions (`.github/workflows/faces-worker.yml`), which is free for this public repo:
every 30 minutes it clears the queue, and on the party day it runs non-stop. Needs the `FACE_SECRET`
repository secret (generated in the app's organizer panel). The Dockerfile is there for running it on
any machine with Docker instead.
