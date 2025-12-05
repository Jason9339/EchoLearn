"""
Supabase client for Python backend
提供資料庫存取功能，用於儲存和讀取 AI 評分結果
"""

import os
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
from dotenv import load_dotenv

# 載入環境變數
load_dotenv()


class SupabaseClient:
    """
    Supabase 客戶端封裝
    提供簡單的介面來存取資料庫
    """

    _instance: Optional['SupabaseClient'] = None
    _client: Optional[Client] = None

    def __new__(cls):
        """單例模式，確保只有一個 Supabase 客戶端實例"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """初始化 Supabase 客戶端"""
        if self._client is None:
            supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

            if not supabase_url or not supabase_key:
                raise ValueError(
                    'Missing required environment variables: '
                    'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
                )

            self._client = create_client(supabase_url, supabase_key)
            print(f"✅ Supabase client initialized: {supabase_url}")

    @property
    def client(self) -> Client:
        """取得 Supabase 客戶端實例"""
        if self._client is None:
            raise RuntimeError('Supabase client not initialized')
        return self._client

    def save_ai_score(
        self,
        user_id: str,
        course_id: str,
        sentence_id: int,
        slot_index: int,
        score: float
    ) -> Dict[str, Any]:
        """
        儲存 AI 評分結果到資料庫

        Args:
            user_id: 使用者 ID
            course_id: 課程 ID
            sentence_id: 句子 ID
            slot_index: 錄音槽位索引 (0-3)
            score: AI 評分 (0.00-5.00)

        Returns:
            Dict: 儲存結果 {'success': bool, 'data': Any, 'error': str}
        """
        try:
            # 使用 upsert 來處理新增或更新
            data = {
                'user_id': user_id,
                'course_id': course_id,
                'sentence_id': sentence_id,
                'slot_index': slot_index,
                'score': round(score, 2)  # 確保最多兩位小數
            }

            result = self.client.table('ai_scores').upsert(
                data,
                on_conflict='user_id,course_id,sentence_id,slot_index'
            ).execute()

            print(f"✅ AI score saved: user={user_id}, course={course_id}, "
                  f"sentence={sentence_id}, slot={slot_index}, score={score:.2f}")

            return {
                'success': True,
                'data': result.data[0] if result.data else None,
                'error': None
            }

        except Exception as e:
            error_msg = f"Failed to save AI score: {str(e)}"
            print(f"❌ {error_msg}")
            return {
                'success': False,
                'data': None,
                'error': error_msg
            }

    def get_ai_score(
        self,
        user_id: str,
        course_id: str,
        sentence_id: int,
        slot_index: int
    ) -> Optional[float]:
        """
        從資料庫讀取 AI 評分

        Args:
            user_id: 使用者 ID
            course_id: 課程 ID
            sentence_id: 句子 ID
            slot_index: 錄音槽位索引 (0-3)

        Returns:
            Optional[float]: AI 評分，如果沒有則回傳 None
        """
        try:
            print(f"🔍 Querying database with:")
            print(f"   user_id: {user_id} (type: {type(user_id).__name__})")
            print(f"   course_id: {course_id} (type: {type(course_id).__name__})")
            print(f"   sentence_id: {sentence_id} (type: {type(sentence_id).__name__})")
            print(f"   slot_index: {slot_index} (type: {type(slot_index).__name__})")

            result = self.client.table('ai_scores').select('score').eq(
                'user_id', user_id
            ).eq(
                'course_id', course_id
            ).eq(
                'sentence_id', sentence_id
            ).eq(
                'slot_index', slot_index
            ).execute()

            print(f"📊 Query result: count={result.count}, data={result.data}")

            if result.data and len(result.data) > 0:
                score = float(result.data[0]['score'])
                print(f"✅ AI score found: user={user_id}, course={course_id}, "
                      f"sentence={sentence_id}, slot={slot_index}, score={score:.2f}")
                return score
            else:
                print(f"ℹ️  No AI score found for: user={user_id}, course={course_id}, "
                      f"sentence={sentence_id}, slot={slot_index}")

                # Debug: 檢查是否有任何記錄符合部分條件
                print(f"   檢查 user_id 是否存在...")
                test_result = self.client.table('ai_scores').select('count', count='exact').eq(
                    'user_id', user_id
                ).execute()
                print(f"   該 user_id 有 {test_result.count} 筆記錄")

                return None

        except Exception as e:
            print(f"❌ Failed to get AI score: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def get_ai_scores_by_sentence(
        self,
        user_id: str,
        course_id: str,
        sentence_id: int
    ) -> List[Dict[str, Any]]:
        """
        取得某個句子的所有評分（所有槽位）

        Args:
            user_id: 使用者 ID
            course_id: 課程 ID
            sentence_id: 句子 ID

        Returns:
            List[Dict]: 評分列表，每個包含 slot_index 和 score
        """
        try:
            result = self.client.table('ai_scores').select(
                'slot_index, score'
            ).eq(
                'user_id', user_id
            ).eq(
                'course_id', course_id
            ).eq(
                'sentence_id', sentence_id
            ).order('slot_index').execute()

            if result.data:
                print(f"✅ Found {len(result.data)} AI scores for sentence {sentence_id}")
                return result.data
            else:
                return []

        except Exception as e:
            print(f"❌ Failed to get AI scores by sentence: {str(e)}")
            return []

    def get_ai_scores_by_course(
        self,
        user_id: str,
        course_id: str
    ) -> List[Dict[str, Any]]:
        """
        取得某個課程的所有評分

        Args:
            user_id: 使用者 ID
            course_id: 課程 ID

        Returns:
            List[Dict]: 評分列表，每個包含 sentence_id, slot_index 和 score
        """
        try:
            result = self.client.table('ai_scores').select(
                'sentence_id, slot_index, score'
            ).eq(
                'user_id', user_id
            ).eq(
                'course_id', course_id
            ).order('sentence_id').order('slot_index').execute()

            if result.data:
                print(f"✅ Found {len(result.data)} AI scores for course {course_id}")
                return result.data
            else:
                return []

        except Exception as e:
            print(f"❌ Failed to get AI scores by course: {str(e)}")
            return []

    def delete_ai_score(
        self,
        user_id: str,
        course_id: str,
        sentence_id: int,
        slot_index: int
    ) -> Dict[str, Any]:
        """
        刪除 AI 評分記錄

        Args:
            user_id: 使用者 ID
            course_id: 課程 ID
            sentence_id: 句子 ID
            slot_index: 錄音槽位索引 (0-3)

        Returns:
            Dict: 刪除結果 {'success': bool, 'error': str}
        """
        try:
            result = self.client.table('ai_scores').delete().eq(
                'user_id', user_id
            ).eq(
                'course_id', course_id
            ).eq(
                'sentence_id', sentence_id
            ).eq(
                'slot_index', slot_index
            ).execute()

            print(f"✅ AI score deleted: user={user_id}, course={course_id}, "
                  f"sentence={sentence_id}, slot={slot_index}")

            return {
                'success': True,
                'error': None
            }

        except Exception as e:
            error_msg = f"Failed to delete AI score: {str(e)}"
            print(f"❌ {error_msg}")
            return {
                'success': False,
                'error': error_msg
            }


# 全域單例實例
_supabase_client: Optional[SupabaseClient] = None


def get_supabase_client() -> SupabaseClient:
    """
    取得 Supabase 客戶端單例

    Returns:
        SupabaseClient: Supabase 客戶端實例
    """
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = SupabaseClient()
    return _supabase_client
