Ferdowsi Paper — Overleaf setup
================================

1. Upload this zip to Overleaf as a new project (New Project > Upload Project).
2. IMPORTANT: set the compiler to LuaLaTeX.
   Menu (top left) > Settings > Compiler > LuaLaTeX
   (Required because the document embeds its own fonts via fontspec and
   draws the banner/page-number overlay via eso-pic — both need LuaLaTeX
   or XeLaTeX; plain pdfLaTeX will fail.)
3. Compile main.tex. Overleaf runs LaTeX twice automatically, which is
   enough to resolve all citations and cross-references.

Folder contents:
  main.tex            - the paper source
  assets/fonts/        - bundled Liberation Serif/Sans (Times/Calibri-compatible), no system fonts needed
  assets/header_banner.jpeg - the conference banner image
  figures/             - the result plots (regenerated from the repo's own experiments)
