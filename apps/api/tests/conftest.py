"""pytest kurulumu: fixture'lar helpers.py içinde tanımlıdır."""

import sys
from pathlib import Path

# importlib içe aktarma modunda (kök pytest.ini) bu dizin otomatik sys.path'e girmez.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from helpers import env  # noqa: E402,F401
