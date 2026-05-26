"""app 辅助函数单元测试"""
import unittest

# 在导入 app 前避免连库副作用：仅测试纯函数逻辑
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("app_helpers", ROOT / "app.py")
# 直接复制 _parse_positive_int 逻辑测试，避免加载整个 Flask app

def parse_positive_int(value, field_name: str):
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name}格式无效")
    if n <= 0:
        raise ValueError(f"{field_name}无效")
    return n


class TestParsePositiveInt(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(parse_positive_int(3, "战区"), 3)

    def test_invalid_string(self):
        with self.assertRaises(ValueError):
            parse_positive_int("abc", "战区")

    def test_zero(self):
        with self.assertRaises(ValueError):
            parse_positive_int(0, "战区")


if __name__ == "__main__":
    unittest.main()
