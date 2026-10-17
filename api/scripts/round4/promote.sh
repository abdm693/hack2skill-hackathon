#!/usr/bin/env bash
# Round 4 sample promotion (BE-F1 concepts and captions, BE-F5 staged versions and floors). Dry run by default; pass
# --apply to write the live samples (this changes what every visitor sees: get the go-ahead first). Nothing is deleted:
# old images and versions stay for rollback. Run from api/:  bash scripts/round4/promote.sh [--apply]
set -euo pipefail
cd "$(dirname "$0")/../.."
export PYTHONPATH=.
APPLY="${1:-}"
HERE=scripts/round4
run() { uv run python scripts/promote_round2.py "$@" $APPLY; }

# BE-F1: the flagship 10 marla's concepts A and B re-rolled as mid-row (same ids and titles, B stays chosen; the thumbnail
# follows B), and plain captions on all eight sample concepts.
run concept p_5a5893a2bcaa c_1f43b123ec11 "$HERE/c_1f43b123ec11-day.png" "$HERE/c_1f43b123ec11-night.png" --tag=r4
run concept p_5a5893a2bcaa c_0026dc7358eb "$HERE/c_0026dc7358eb-day.png" "$HERE/c_0026dc7358eb-night.png" --tag=r4
run captions p_5a5893a2bcaa
run captions p_1a42e70989af

# BE-F5: the staged versions (0 fail, 0 warn, no major architect's note), then the Brief's floors naming the upstairs master.
run version p_5a5893a2bcaa p_1c8a50a2ff9b v_acb3189dc5f3 --strict "--summary=Kitchens widened, a guest powder room under Bath 2"
run floors p_5a5893a2bcaa
run version p_1a42e70989af p_b6192f303371 v_c40ec6a1a359 --strict "--summary=A front door to the lobby, the dirty kitchen off the passage, Bath 3 split"
run floors p_1a42e70989af

uv run python scripts/promote_round2.py verify p_5a5893a2bcaa
uv run python scripts/promote_round2.py verify p_1a42e70989af
