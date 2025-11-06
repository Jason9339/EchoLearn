# routes/worker_routes.py
from flask import Blueprint, jsonify

# 1. 建立一個 Blueprint
#    'worker_bp' 是名稱, __name__ 是固定的
example_worker_bp = Blueprint('example_worker_bp', __name__)

# 2. 在 Blueprint 上定義路由
#    注意：這裡的路徑是相對的！
#    '/hello' 會自動變成 '/example/hello' (因為我們等下會設定前綴)
@example_worker_bp.route('/hello', methods=['GET'])
def get_hello():
    """
    這會對應到 GET /example/hello
    """
    # 這裡可以 call 您從其他 .py import 的邏輯
    # from some_logic_file import calculate_something
    # result = calculate_something()
    print("Hello endpoint was called")
    return jsonify({"message": "Hello from worker blueprint"})

@example_worker_bp.route('/data', methods=['POST'])
def process_data():
    """
    這會對應到 POST /example/data
    """
    return jsonify({"response": "Data received in blueprint"})

# ... 您可以繼續在這裡新增 @worker_bp.route('/new-feature') ...
