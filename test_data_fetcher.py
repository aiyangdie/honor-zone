import unittest
from data_fetcher import HonorOfKingsDataFetcher

class TestDataFetcher(unittest.TestCase):
    def test_mock_data_generation(self):
        """测试模拟数据生成"""
        data = HonorOfKingsDataFetcher.generate_mock_data()
        self.assertGreater(len(data), 0)
        self.assertIn('nickname', data[0])
        self.assertIn('score', data[0])
        
    def test_real_data_fallback(self):
        """测试真实数据获取失败时回退到模拟数据"""
        data = HonorOfKingsDataFetcher.get_rankings_data()
        self.assertGreater(len(data), 0)

if __name__ == '__main__':
    unittest.main()