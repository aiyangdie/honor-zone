"""security 模块单元测试"""
import os
import unittest

from security import is_safe_avatar_url, safe_message


class TestSafeMessage(unittest.TestCase):
    def test_debug_shows_exception(self):
        os.environ["FLASK_DEBUG"] = "true"
        self.assertEqual(safe_message(ValueError("detail")), "detail")
        os.environ.pop("FLASK_DEBUG", None)

    def test_production_hides_exception(self):
        os.environ.pop("FLASK_DEBUG", None)
        self.assertEqual(safe_message(ValueError("secret")), "服务异常，请稍后重试")


class TestAvatarUrl(unittest.TestCase):
    def test_https_ok(self):
        self.assertTrue(is_safe_avatar_url("https://example.com/a.jpg"))

    def test_javascript_rejected(self):
        self.assertFalse(is_safe_avatar_url("javascript:alert(1)"))

    def test_empty_ok(self):
        self.assertTrue(is_safe_avatar_url(""))


if __name__ == "__main__":
    unittest.main()
