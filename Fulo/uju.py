import requests
import json
import random
import datetime
import base64


class GoogleBatchExecute:
    BASE_URL = "https://gemini.google.com/_/BardChatUi/data/batchexecute"
    
    def __init__(self):
        self.req_counter = 0
        now = datetime.datetime.now()
        midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
        self.seed_time = int((now - midnight).total_seconds())
        self.f_sid = str(random.randint(-2**63, 2**63 - 1))

    def _generate_reqid(self):
        req_id = 1 + self.seed_time + (self.req_counter * 100000)
        self.req_counter += 1
        return str(req_id)

    def execute(self, rpcid, f_req, source_path="/app"):
        params = {
            "rpcids": rpcid,
            "source-path": source_path,
            "bl": "boq_assistant-bard-web-server_20251123.09_p0",
            "f.sid": self.f_sid,
            "hl": "en",
            "_reqid": self._generate_reqid(),
            "rt": "c"
        }

        headers = {
            "X-Same-Domain": "1",
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        }

        response = requests.post(self.BASE_URL, params=params, headers=headers, data={"f.req": f_req})
        return response


if __name__ == "__main__":
    client = GoogleBatchExecute()

    message = "(f) Trong năm qua, mình đã xây dựng hơn 200 quy trình tự động hóa AI trên n8n. Những quy trình này có thể là dành cho khách hàng thực tế, cho các video YouTube, hoặc cho chính công việc kinh doanh cá nhân của mình. Và khi nhìn lại tất cả các quy trình tự động hóa khác nhau mà mình (s) đã xây dựng, mình nhận thấy rằng mình đang sử dụng khoảng 17 node (nút) giống nhau trong hầu hết các quy trình đó. Vì vậy, nếu bạn muốn bắt đầu với n8n, mình khuyên bạn chỉ nên tập trung vào 17 node cốt lõi này trước, sau đó hãy mở rộng ra khi cần thiết."
    
    f_req = json.dumps([[["XqA3Ic", json.dumps([None, message, "vi-VN", None, 2]), None, "generic"]]])

    response = client.execute(rpcid="XqA3Ic", f_req=f_req, source_path="/app/b4fa1d6db3d53d9f")
    
    print(f"Status: {response.status_code}")
    
    # Parse response - get first JSON block after the length number
    text = response.text.lstrip(")]}'\n")
    lines = text.split('\n')
    
    # Skip the length number (8167), get the JSON on line 1
    chunk_json = lines[1]
    chunk = json.loads(chunk_json)
    
    # Extract: chunk[0][2] is '["base64..."]', parse it to get base64 string
    inner = json.loads(chunk[0][2])
    base64_data = inner[0]
    
    # Decode and save
    audio = base64.b64decode(base64_data)
    with open("output.ogg", "wb") as f:
        f.write(audio)
    
    print(f"Saved output.ogg ({len(audio)} bytes)")