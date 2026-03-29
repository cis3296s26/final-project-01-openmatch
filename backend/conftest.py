import os

# main.py requires SECRET_KEY at import time; tests must set it before test_main imports main.
os.environ.setdefault("SECRET_KEY", "pytest-secret-key-for-jwt-signing-only")
