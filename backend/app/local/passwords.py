"""Password hashing for local mode. bcrypt, so hashes can be imported into Supabase later."""

import bcrypt


def hash_password(password: str) -> str:
    # bcrypt only reads the first 72 bytes.
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except ValueError:
        return False
