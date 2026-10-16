Face worker for the Confra da Firma app. It asks the app's `faces` function for work, reads each photo
once from a 5-minute link, and sends back only face signatures (512 numbers per face). Photos are kept
in memory only and never written to disk.

It runs on GitHub Actions (`.github/workflows/faces-worker.yml`), which is free for this public repo:
the app's database starts it only when a selfie or photo is waiting, and it stops a few minutes after
the queue empties; on the party day four of them run non-stop. Needs the `FACE_SECRET`
repository secret (generated in the app's organizer panel). The Dockerfile is there for running it on
any machine with Docker instead.
