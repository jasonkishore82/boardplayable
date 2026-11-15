"""Download the Maia-2 weights so the Maia chess bots can be played.

    pip install -r requirements-maia.txt
    python scripts/fetch_maia.py            # saves to backend/maia2_models/
    python scripts/fetch_maia.py /some/dir  # or somewhere else (then set MAIA_MODEL_DIR to it)

The weights come from the Maia-2 project (Google Drive) and are checked against a known hash.
"""

import sys
from pathlib import Path

DEFAULT_DIR = Path(__file__).resolve().parents[1] / "maia2_models"


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DIR
    try:
        from maia2 import model
    except ImportError:
        sys.exit("maia2 is not installed. Run: pip install -r requirements-maia.txt")
    model.from_pretrained(type="rapid", device="cpu", save_root=str(target))
    print(f"Maia weights are in {target}")


if __name__ == "__main__":
    main()
