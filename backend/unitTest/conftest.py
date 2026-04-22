import os
import sys
from pathlib import Path

# ensure backend root is on PYTHONPATH
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# env needed before importing main
os.environ.setdefault("SECRET_KEY", "pytest-secret-key-for-jwt-signing-only")