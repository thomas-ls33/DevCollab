import re

from .http import ApiError

_URL = re.compile(r"^https?://[^\s]+$", re.IGNORECASE)


def required_str(data, key, label, max_len):
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ApiError(400, f"Le champ « {label} » est obligatoire")
    value = value.strip()
    if len(value) > max_len:
        raise ApiError(400, f"Le champ « {label} » ne doit pas dépasser {max_len} caractères")
    return value


def optional_str(data, key, label, max_len, default=None):
    value = data.get(key)
    if value is None:
        return default
    if not isinstance(value, str):
        raise ApiError(400, f"Le champ « {label} » doit être une chaîne de caractères")
    value = value.strip()
    if len(value) > max_len:
        raise ApiError(400, f"Le champ « {label} » ne doit pas dépasser {max_len} caractères")
    return value or default


def optional_url(data, key, label):
    value = optional_str(data, key, label, 255)
    if value and not _URL.match(value):
        raise ApiError(400, f"Le champ « {label} » doit être une URL http(s) valide")
    return value


def name_list(data, key, label, max_items=20, max_len=50):
    value = data.get(key, [])
    if value is None:
        return []
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise ApiError(400, f"Le champ « {label} » doit être une liste de chaînes")
    seen = {}
    for v in value:
        v = v.strip()
        if not v:
            continue
        if len(v) > max_len:
            raise ApiError(400, f"Chaque élément de « {label} » doit faire au plus {max_len} caractères")
        seen.setdefault(v.lower(), v)
    if len(seen) > max_items:
        raise ApiError(400, f"« {label} » est limité à {max_items} éléments")
    return list(seen.values())


def one_of(value, allowed, label):
    if value not in allowed:
        raise ApiError(400, f"Valeur invalide pour « {label} » (attendu : {', '.join(allowed)})")
    return value


def int_param(query, key, default, minimum, maximum):
    raw = query.get(key)
    if raw in (None, ""):
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ApiError(400, f"Le paramètre « {key} » doit être un entier")
    return max(minimum, min(maximum, value))
