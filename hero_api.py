import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

HERO_TYPES = {
    "aqq": {"name": "安卓 QQ", "short": "AQ"},
    "awx": {"name": "安卓微信", "short": "AW"},
    "iqq": {"name": "苹果 QQ", "short": "iQ"},
    "iwx": {"name": "苹果微信", "short": "iW"},
}

API_TIMEOUT = int(os.environ.get("HERO_API_TIMEOUT", "12"))

# 已实测可用的第三方数据源（非腾讯官方，社区广泛使用）
PROVIDERS = {
    "sapi": {
        "name": "sapi.run",
        "label": "主数据源",
        "list_url": os.environ.get(
            "HERO_LIST_URL", "https://www.sapi.run/hero/herolist.json"
        ),
        "power_url": os.environ.get(
            "HERO_POWER_URL", "https://www.sapi.run/hero/select.php"
        ),
        "power_params": lambda hero, ptype: {"hero": hero, "type": ptype},
    },
    "xxoo": {
        "name": "api.xxoo.team",
        "label": "备用数据源",
        "list_url": os.environ.get(
            "HERO_LIST_URL_FALLBACK",
            "https://api.xxoo.team/hero/getHeroList.php",
        ),
        "power_url": os.environ.get(
            "HERO_POWER_URL_FALLBACK",
            "https://api.xxoo.team/hero/getHeroInfo.php",
        ),
        "power_params": lambda hero, ptype: {"hero": hero, "type": ptype},
    },
}

OFFICIAL_HERO_LIST_URL = os.environ.get(
    "HERO_OFFICIAL_LIST_URL",
    "https://pvp.qq.com/web201605/js/herolist.json",
)

PRIMARY_PROVIDER = os.environ.get("HERO_API_PRIMARY", "sapi")
FALLBACK_PROVIDER = os.environ.get("HERO_API_FALLBACK", "xxoo")
USE_OFFICIAL_LIST = os.environ.get("HERO_USE_OFFICIAL_LIST", "true").lower() in (
    "1",
    "true",
    "yes",
)

DATA_DISCLAIMER = (
    "数据来自第三方公开接口（sapi.run / xxoo.team），非腾讯官方实时数据；"
    "通常每周一更新，仅供冲标选区参考。"
)

HERO_IMG_BASE = "https://game.gtimg.cn/images/yxzj/img201606/heroimg"
_hero_ename_cache: Optional[Dict[str, str]] = None


def _get_hero_ename_map() -> Dict[str, str]:
    """英雄名 -> 官方 ename，用于补全头像 URL"""
    global _hero_ename_cache
    if _hero_ename_cache is not None:
        return _hero_ename_cache

    response = requests.get(OFFICIAL_HERO_LIST_URL, timeout=API_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    mapping: Dict[str, str] = {}
    if isinstance(payload, list):
        for item in payload:
            name = item.get("cname") or item.get("name")
            ename = item.get("ename")
            if name and ename is not None:
                mapping[name] = str(ename)
    _hero_ename_cache = mapping
    return mapping


def _resolve_hero_photo(hero_name: str, photo: Optional[str]) -> str:
    if photo:
        return photo
    ename = _get_hero_ename_map().get(hero_name)
    if ename:
        return f"{HERO_IMG_BASE}/{ename}/{ename}.jpg"
    return ""


def _provider_chain() -> List[str]:
    chain = []
    for key in (PRIMARY_PROVIDER, FALLBACK_PROVIDER):
        if key in PROVIDERS and key not in chain:
            chain.append(key)
    for key in PROVIDERS:
        if key not in chain:
            chain.append(key)
    return chain


def _normalize_hero_item(item: Dict[str, Any]) -> Optional[Dict[str, str]]:
    name = item.get("cname") or item.get("name")
    if not name:
        return None
    ename = item.get("ename")
    icon = item.get("iconUrl") or item.get("photo") or ""
    if not icon and ename is not None:
        icon = f"{HERO_IMG_BASE}/{ename}/{ename}.jpg"
    return {
        "name": name,
        "alias": item.get("title") or item.get("alias") or "",
        "icon": icon,
    }


def _fetch_official_hero_list() -> List[Dict[str, str]]:
    response = requests.get(OFFICIAL_HERO_LIST_URL, timeout=API_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list):
        return []
    return [h for item in payload if (h := _normalize_hero_item(item))]


def _fetch_provider_list(provider_key: str) -> List[Dict[str, str]]:
    cfg = PROVIDERS[provider_key]
    response = requests.get(cfg["list_url"], timeout=API_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    raw = payload.get("data") if isinstance(payload, dict) else payload
    if not isinstance(raw, list):
        return []
    return [h for item in raw if (h := _normalize_hero_item(item))]


def fetch_hero_list() -> Dict[str, Any]:
    source = "unknown"
    heroes: List[Dict[str, str]] = []
    errors: List[str] = []

    if USE_OFFICIAL_LIST:
        try:
            heroes = _fetch_official_hero_list()
            source = "腾讯官方英雄列表"
        except Exception as e:
            errors.append(f"official: {e}")

    if not heroes:
        for provider_key in _provider_chain():
            try:
                heroes = _fetch_provider_list(provider_key)
                if heroes:
                    source = PROVIDERS[provider_key]["name"]
                    break
            except Exception as e:
                errors.append(f"{provider_key}: {e}")

    return {"heroes": heroes, "source": source, "count": len(heroes), "errors": errors}


def _normalize_power_data(
    data: Dict[str, Any], hero: str, platform_type: str, provider: str
) -> Dict[str, Any]:
    p = HERO_TYPES.get(platform_type, {})
    hero_name = data.get("name") or hero
    photo = _resolve_hero_photo(hero_name, data.get("photo"))
    return {
        "hero": hero_name,
        "alias": data.get("alias"),
        "platform_id": platform_type,
        "platform": data.get("platform") or p.get("name", platform_type),
        "photo": photo or None,
        "province": data.get("province"),
        "province_power": _to_int(data.get("provincePower") or data.get("province_power")),
        "city": data.get("city"),
        "city_power": _to_int(data.get("cityPower") or data.get("city_power")),
        "area": data.get("area"),
        "area_power": _to_int(data.get("areaPower") or data.get("area_power")),
        "guobiao": _to_int(data.get("guobiao")),
        "updated_at": data.get("updatetime") or data.get("updated_at"),
        "provider": provider,
    }


def _to_int(value) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(float(str(value).replace(",", "")))
    except (TypeError, ValueError):
        return None


def _fetch_provider_power(provider_key: str, hero: str, platform_type: str) -> Dict[str, Any]:
    cfg = PROVIDERS[provider_key]
    response = requests.get(
        cfg["power_url"],
        params=cfg["power_params"](hero, platform_type),
        timeout=API_TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("code") != 200:
        raise RuntimeError(payload.get("msg") or "查询失败")
    return _normalize_power_data(
        payload.get("data") or {}, hero, platform_type, cfg["name"]
    )


def fetch_hero_power(hero: str, platform_type: str = "aqq") -> Dict[str, Any]:
    if platform_type not in HERO_TYPES:
        raise ValueError(f"无效平台，可选: {', '.join(HERO_TYPES)}")

    errors = []
    for provider_key in _provider_chain():
        try:
            return _fetch_provider_power(provider_key, hero, platform_type)
        except Exception as e:
            errors.append(f"{PROVIDERS[provider_key]['name']}: {e}")

    raise RuntimeError("所有数据源不可用。 " + " | ".join(errors))


def fetch_hero_power_all_platforms(hero: str) -> Dict[str, Any]:
    """一次查询四个大区（真实第三方数据）"""
    results = {}
    errors = {}

    def _task(ptype: str):
        return ptype, fetch_hero_power(hero, ptype)

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(_task, p): p for p in HERO_TYPES}
        for fut in as_completed(futures):
            ptype = futures[fut]
            try:
                _, data = fut.result()
                results[ptype] = data
            except Exception as e:
                errors[ptype] = str(e)

    return {
        "hero": hero,
        "platforms": results,
        "errors": errors,
        "success_count": len(results),
        "disclaimer": DATA_DISCLAIMER,
    }


def get_api_status() -> Dict[str, Any]:
    status = {
        "disclaimer": DATA_DISCLAIMER,
        "primary": PRIMARY_PROVIDER,
        "fallback": FALLBACK_PROVIDER,
        "use_official_list": USE_OFFICIAL_LIST,
        "providers": {
            k: {
                "name": v["name"],
                "label": v["label"],
                "list_url": v["list_url"],
                "power_url": v["power_url"],
            }
            for k, v in PROVIDERS.items()
        },
        "official_list_url": OFFICIAL_HERO_LIST_URL,
        "platforms": [
            {"id": k, "name": v["name"]} for k, v in HERO_TYPES.items()
        ],
    }

    probes = {}
    try:
        probes["official_list"] = len(_fetch_official_hero_list()) > 50
    except Exception:
        probes["official_list"] = False

    for provider_key in _provider_chain():
        try:
            _fetch_provider_power(provider_key, "李白", "aqq")
            probes[f"{provider_key}_power"] = True
        except Exception:
            probes[f"{provider_key}_power"] = False

    status["probes"] = probes
    status["healthy"] = probes.get("sapi_power") or probes.get("xxoo_power")
    return status
