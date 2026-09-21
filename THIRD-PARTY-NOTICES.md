# Third party notices

Bumblebee GUI is licensed under Apache-2.0 (see [LICENSE](LICENSE)). It redistributes and depends on work by
others, recorded here.

## Bumblebee CLI

- Project: <https://github.com/perplexityai/bumblebee>
- Copyright: Perplexity AI and contributors
- License: Apache-2.0
- What we ship: the compiled `linux_amd64` binary, version **0.1.2**, tag `v0.1.2`, commit
  `cc57710eeaf685e7b89924a36c8583cad0a378fe`
- Modifications: none. The binary is downloaded, its sha256 is verified against the published digest, and it is
  installed unmodified into the image. No source changes were made to it.

## Exposure catalogues

- Project: <https://github.com/perplexityai/bumblebee>, directory `threat_intel`
- License: Apache-2.0
- What we ship: eleven JSON catalogues, fetched at build time from the same pinned commit, verified per file by
  the sha256 digests in [`threat-intel.manifest`](threat-intel.manifest), and installed into the image at
  `/opt/bumblebee/threat-intel`
- Modifications: none

## Runtime dependencies

The backend's Python dependencies are pinned in `backend/requirements.txt`, and the frontend's are pinned in
`frontend/package-lock.json`. Each carries its own license, and those files are the authoritative list. The
projects worth naming: FastAPI (MIT), Uvicorn (BSD-3-Clause), Pydantic (MIT), React (MIT), Vite (MIT),
Tailwind CSS (MIT), shadcn/ui (MIT), Recharts (MIT), Zustand (MIT).
