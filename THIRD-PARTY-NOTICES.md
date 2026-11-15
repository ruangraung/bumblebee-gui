# Third party notices

Bumblebee GUI is licensed under Apache-2.0 (see [LICENSE](LICENSE)). It redistributes and depends on work by
others, recorded here.

## Bumblebee CLI

- Project: <https://github.com/perplexityai/bumblebee>
- Copyright: Perplexity AI and contributors
- License: Apache-2.0
- What we ship: the `linux_amd64` binary, compiled during the image build from commit
  `c1e83c0adb53a7f527b40a7181a690ad99a0a6e0`. Upstream has published no release since `v0.1.2`, so the build
  resolves the commit directly instead of a release asset.
- Modifications: none to the source. The commit is cloned, the checkout is asserted to be that commit, and the
  unmodified source is compiled into the binary installed in the image.

## Exposure catalogues

- Project: <https://github.com/perplexityai/bumblebee>, directory `threat_intel`
- License: Apache-2.0
- What we ship: fifteen JSON catalogues, fetched at build time from the same pinned commit, verified per file by
  the sha256 digests in [`threat-intel.manifest`](threat-intel.manifest), and installed into the image at
  `/opt/bumblebee/threat-intel`
- Modifications: none

## Runtime dependencies

The backend's Python dependencies are pinned in `backend/requirements.txt`, and the frontend's are pinned in
`frontend/package-lock.json`. Each carries its own license, and those files are the authoritative list. The
projects worth naming: FastAPI (MIT), Uvicorn (BSD-3-Clause), Pydantic (MIT), React (MIT), Vite (MIT),
Tailwind CSS (MIT), shadcn/ui (MIT), Recharts (MIT), Zustand (MIT).
