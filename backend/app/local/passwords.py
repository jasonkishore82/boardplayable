"""Password hashing for local mode. bcrypt, so hashes can be imported into Supabase later.

bcrypt is only installed for local testing (requirements-dev.txt), so it is imported when first used.
The production image does not have it and must still start.
"""


def hash_password(password: str) -> str:
    import bcrypt

    # bcrypt only reads the first 72 bytes.
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    import bcrypt

    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except ValueError:
        return False
